-- Entrega de credenciais do fornecedor pelo WhatsApp e confirmação de recebimento.
-- Aditivo: não altera cobrança, gateway nem chaves existentes. Execute como postgres no SQL Editor.
-- O segredo da chave nunca é gravado: só os últimos caracteres (key_hint).
-- Acesso exclusivo da service role (funções em api/). O navegador nunca lê esta tabela direto.
begin;

create table if not exists public.credential_deliveries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  product text not null check (product in ('claude', 'gpt', 'glm', 'outro')),
  supplier text not null check (length(supplier) between 1 and 60),
  key_hint text not null check (key_hint ~ '^[A-Za-z0-9_-]{2,8}$'),
  base_url text not null check (length(base_url) <= 200 and base_url ~ '^https://[^?#@[:space:]]+$'),
  model_id text check (model_id is null or model_id ~ '^[A-Za-z0-9._:/-]{1,80}$'),
  notes text check (notes is null or length(notes) <= 500),
  expires_at timestamptz,
  delivered_at timestamptz not null default now(),
  created_by text not null check (length(created_by) between 3 and 254),
  replaced_at timestamptz,
  revoked_at timestamptz,
  revoked_by text check (revoked_by is null or length(revoked_by) <= 254),
  confirmed_at timestamptz,
  confirm_ip text check (confirm_ip is null or length(confirm_ip) <= 64),
  confirm_user_agent text check (confirm_user_agent is null or length(confirm_user_agent) <= 300),
  confirm_text text check (confirm_text is null or length(confirm_text) <= 400),
  confirm_text_version text check (confirm_text_version is null or length(confirm_text_version) <= 40)
);
create index if not exists credential_deliveries_user_idx on public.credential_deliveries(user_id, delivered_at desc);
create index if not exists credential_deliveries_recent_idx on public.credential_deliveries(delivered_at desc);

-- A prova de entrega não pode ser reescrita: quem, o quê, quando e a confirmação ficam fixos.
create or replace function public.credential_deliveries_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id
     or new.key_hint is distinct from old.key_hint or new.base_url is distinct from old.base_url
     or new.product is distinct from old.product or new.delivered_at is distinct from old.delivered_at
     or new.created_by is distinct from old.created_by then
    raise exception 'Delivery record is immutable';
  end if;
  if old.confirmed_at is not null and (
       new.confirmed_at is distinct from old.confirmed_at or new.confirm_ip is distinct from old.confirm_ip
       or new.confirm_user_agent is distinct from old.confirm_user_agent or new.confirm_text is distinct from old.confirm_text
       or new.confirm_text_version is distinct from old.confirm_text_version) then
    raise exception 'Confirmation is immutable';
  end if;
  if (old.replaced_at is not null and new.replaced_at is distinct from old.replaced_at)
     or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then
    raise exception 'Delivery state cannot go back';
  end if;
  return new;
end;
$$;
drop trigger if exists credential_deliveries_guard on public.credential_deliveries;
create trigger credential_deliveries_guard before update on public.credential_deliveries
  for each row execute function public.credential_deliveries_guard();

-- Registra uma entrega (ou rotação). Idempotente pelo id gerado no navegador do admin.
-- Devolve o id, ou null quando a credencial a substituir/assinatura não pertence ao cliente.
create or replace function public.admin_register_delivery(
  p_id uuid, p_user_id uuid, p_subscription_id uuid, p_product text, p_supplier text, p_key_hint text,
  p_base_url text, p_model_id text, p_notes text, p_expires_at timestamptz, p_replaces uuid, p_created_by text)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  if p_id is null or p_user_id is null then return null; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  if exists(select 1 from public.credential_deliveries where id = p_id) then
    return (select id from public.credential_deliveries where id = p_id and user_id = p_user_id);
  end if;
  if p_subscription_id is not null
     and not exists(select 1 from public.billing_subscriptions where id = p_subscription_id and user_id = p_user_id) then
    return null;
  end if;
  if p_replaces is not null then
    update public.credential_deliveries set replaced_at = now()
     where id = p_replaces and user_id = p_user_id and replaced_at is null and revoked_at is null;
    if not found then return null; end if;
  end if;
  insert into public.credential_deliveries(id, user_id, subscription_id, product, supplier, key_hint, base_url, model_id, notes, expires_at, created_by)
  values (p_id, p_user_id, p_subscription_id, p_product, p_supplier, p_key_hint, p_base_url, p_model_id, p_notes, p_expires_at, p_created_by);
  return p_id;
end;
$$;

-- Revoga uma entrega (ex.: chave desativada no fornecedor). Devolve true se revogou agora.
create or replace function public.admin_revoke_delivery(p_id uuid, p_by text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.credential_deliveries set revoked_at = now(), revoked_by = p_by
   where id = p_id and revoked_at is null;
  return found;
end;
$$;

-- O cliente confirma o recebimento. Grava uma única vez; repetir devolve a data já registrada.
-- Devolve null quando a entrega não é do cliente, foi substituída, revogada ou venceu sem confirmação.
create or replace function public.account_confirm_delivery(
  p_user_id uuid, p_id uuid, p_ip text, p_user_agent text, p_text text, p_version text)
returns timestamptz language plpgsql security invoker set search_path = '' as $$
declare done timestamptz;
begin
  if p_user_id is null or p_id is null then return null; end if;
  update public.credential_deliveries
     set confirmed_at = now(), confirm_ip = left(p_ip, 64), confirm_user_agent = left(p_user_agent, 300),
         confirm_text = left(p_text, 400), confirm_text_version = left(p_version, 40)
   where id = p_id and user_id = p_user_id and confirmed_at is null
     and replaced_at is null and revoked_at is null and (expires_at is null or expires_at > now())
  returning confirmed_at into done;
  if done is not null then return done; end if;
  select confirmed_at into done from public.credential_deliveries
   where id = p_id and user_id = p_user_id and replaced_at is null and revoked_at is null;
  return done;
end;
$$;

alter table public.credential_deliveries enable row level security;
revoke all on public.credential_deliveries from public, anon, authenticated;
grant select, insert, update on public.credential_deliveries to service_role;
revoke delete, truncate on public.credential_deliveries from service_role;

revoke all on function public.admin_register_delivery(uuid,uuid,uuid,text,text,text,text,text,text,timestamptz,uuid,text) from public, anon, authenticated;
revoke all on function public.admin_revoke_delivery(uuid,text) from public, anon, authenticated;
revoke all on function public.account_confirm_delivery(uuid,uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.credential_deliveries_guard() from public, anon, authenticated;
grant execute on function public.admin_register_delivery(uuid,uuid,uuid,text,text,text,text,text,text,timestamptz,uuid,text) to service_role;
grant execute on function public.admin_revoke_delivery(uuid,text) to service_role;
grant execute on function public.account_confirm_delivery(uuid,uuid,text,text,text,text) to service_role;
commit;

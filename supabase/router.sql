-- Roteador (aba "Roteador" do /admin): provedores com key mestra, modelos vendidos e
-- chaves manuais sk-rt- com validade. Aditivo: não altera nenhuma tabela existente.
-- Execute uma vez no SQL Editor do Supabase (como postgres).
begin;

-- Provedores: a key mestra fica criptografada (AES-GCM com a service role) e nunca volta ao navegador.
create table if not exists public.router_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  base_url text not null check (base_url ~ '^https://[^[:space:]]+$' and length(base_url) <= 300),
  encrypted_key text not null check (length(encrypted_key) <= 2000),
  key_hint text not null check (length(key_hint) <= 20),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Modelos vendidos: o apelido que o cliente usa → o modelo no provedor.
-- in_pro: entra no plano Pro e no teste grátis.
create table if not exists public.router_models (
  alias text primary key check (alias ~ '^[a-z0-9][a-z0-9._-]{0,79}$'),
  provider_id uuid not null references public.router_providers(id) on delete cascade,
  upstream_model text not null check (length(upstream_model) between 1 and 200),
  label text not null check (length(trim(label)) between 1 and 80),
  enabled boolean not null default true,
  in_pro boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists router_models_provider_idx on public.router_models(provider_id);

-- Chaves manuais (venda pelo WhatsApp). O consumo vai para gateway_usage pelo gateway_client_id.
create table if not exists public.router_keys (
  id uuid primary key default gen_random_uuid(),
  gateway_client_id uuid not null unique references public.gateway_clients(id),
  name text not null check (length(trim(name)) between 1 and 80),
  contact text check (contact is null or length(contact) <= 80),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_prefix text not null,
  encrypted_token text not null check (length(encrypted_token) <= 1000),
  models text[], -- null = todos os modelos ativos do roteador
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.router_providers enable row level security;
alter table public.router_models enable row level security;
alter table public.router_keys enable row level security;
revoke all on public.router_providers, public.router_models, public.router_keys from public, anon, authenticated;
grant select, insert, update, delete on public.router_providers, public.router_models to service_role;
grant select, insert, update on public.router_keys to service_role;

-- Cria a chave manual e o vínculo em gateway_clients numa transação só.
-- p_bridge_hash é o hash de um segredo descartado: ninguém consegue usar esse vínculo no 66cloud.
create or replace function public.router_create_key(p_name text, p_contact text, p_hash text, p_prefix text, p_encrypted_token text, p_bridge_hash text, p_models text[], p_days integer, p_created_by text)
returns public.router_keys language plpgsql security invoker set search_path = '' as $$
declare created_client uuid; created public.router_keys;
begin
  if p_days is null or p_days not between 1 and 366 or p_hash !~ '^[0-9a-f]{64}$' or p_bridge_hash !~ '^[0-9a-f]{64}$' or length(trim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Invalid key';
  end if;
  insert into public.gateway_clients(name, token_hash, enabled, key_prefix)
    values ('Roteador · ' || trim(p_name), p_bridge_hash, true, p_prefix) returning id into created_client;
  insert into public.router_keys(gateway_client_id, name, contact, token_hash, token_prefix, encrypted_token, models, expires_at, created_by)
    values (created_client, trim(p_name), nullif(trim(coalesce(p_contact, '')), ''), p_hash, p_prefix, p_encrypted_token, p_models, now() + make_interval(days => p_days), p_created_by)
    returning * into created;
  return created;
end;
$$;

-- Renova somando dias a partir do vencimento (ou de agora, se já venceu) e reativa a chave.
create or replace function public.router_renew_key(p_id uuid, p_days integer)
returns public.router_keys language plpgsql security invoker set search_path = '' as $$
declare renewed public.router_keys;
begin
  if p_days is null or p_days not between 1 and 366 then raise exception 'Invalid days'; end if;
  update public.router_keys set expires_at = greatest(expires_at, now()) + make_interval(days => p_days), revoked_at = null
    where id = p_id returning * into renewed;
  if not found then raise exception 'Key not found'; end if;
  update public.gateway_clients set enabled = true, revoked_at = null where id = renewed.gateway_client_id;
  return renewed;
end;
$$;

-- Bloqueia ou desbloqueia na hora. O histórico de consumo é preservado.
create or replace function public.router_set_blocked(p_id uuid, p_blocked boolean)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare client uuid;
begin
  update public.router_keys set revoked_at = case when p_blocked then coalesce(revoked_at, now()) else null end
    where id = p_id returning gateway_client_id into client;
  if not found then return false; end if;
  update public.gateway_clients set enabled = not p_blocked, revoked_at = case when p_blocked then coalesce(revoked_at, now()) else null end
    where id = client;
  return true;
end;
$$;

revoke all on function public.router_create_key(text, text, text, text, text, text, text[], integer, text) from public, anon, authenticated;
revoke all on function public.router_renew_key(uuid, integer) from public, anon, authenticated;
revoke all on function public.router_set_blocked(uuid, boolean) from public, anon, authenticated;
grant execute on function public.router_create_key(text, text, text, text, text, text, text[], integer, text) to service_role;
grant execute on function public.router_renew_key(uuid, integer) to service_role;
grant execute on function public.router_set_blocked(uuid, boolean) to service_role;

commit;

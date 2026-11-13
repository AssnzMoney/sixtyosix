-- Programa de afiliados: só as contas que o admin ativar. Quem chega pelo link do afiliado
-- (www.sixtysix.online/?ref=CODIGO) e cria a conta fica ligado a ele; cada pagamento aprovado
-- dessa pessoa, inclusive renovações, dá ao afiliado dias de acesso (7 por padrão). Sem dinheiro e sem
-- desconto para o indicado. Estorno ou contestação do pagamento tira os dias de novo.
--
-- Os dias entram como um pagamento-bônus de R$ 0 na assinatura do afiliado (invoice "affiliate-..."),
-- logo depois do vencimento atual: o "ativo até" é o maior fim de período pago, então o bônus não se
-- perde na próxima renovação. As chaves do Roteador ligadas à conta dele ganham os mesmos dias.
-- Aditivo: não muda cobrança, gateway nem entregas. Execute no SQL Editor.
begin;

create table if not exists public.affiliates (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9-]{2,29}$'),
  days_per_payment integer not null default 7 check (days_per_payment between 1 and 60),
  enabled boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.affiliate_referrals (
  referred_user_id uuid primary key references auth.users(id) on delete cascade,
  affiliate_user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  check (referred_user_id <> affiliate_user_id)
);
create index if not exists affiliate_referrals_affiliate_idx on public.affiliate_referrals (affiliate_user_id, created_at desc);

create table if not exists public.affiliate_rewards (
  payment_id text primary key,
  affiliate_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  days integer not null check (days > 0),
  subscription_id uuid references public.billing_subscriptions(id),
  bonus_payment_id text,
  keys_extended integer not null default 0,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists affiliate_rewards_affiliate_idx on public.affiliate_rewards (affiliate_user_id, created_at desc);

alter table public.affiliates enable row level security;
alter table public.affiliate_referrals enable row level security;
alter table public.affiliate_rewards enable row level security;
revoke all on public.affiliates, public.affiliate_referrals, public.affiliate_rewards from public, anon, authenticated;
grant select, insert, update on public.affiliates, public.affiliate_referrals, public.affiliate_rewards to service_role;

-- Liga a conta ao afiliado do link. Só vale para quem ainda não é cliente (nenhum pagamento aprovado)
-- e ainda não foi indicado por ninguém; o afiliado não pode indicar a si mesmo.
create or replace function public.affiliate_claim(p_user_id uuid, p_code text)
returns text language plpgsql security invoker set search_path = '' as $$
declare aff public.affiliates;
begin
  select * into aff from public.affiliates where code = lower(trim(p_code)) and enabled;
  if not found then return 'unknown'; end if;
  if aff.user_id = p_user_id then return 'self'; end if;
  if exists (select 1 from public.affiliate_referrals where referred_user_id = p_user_id) then return 'already'; end if;
  if exists (
    select 1 from public.billing_payments p join public.billing_subscriptions s on s.id = p.subscription_id
    where s.user_id = p_user_id and p.status = 'approved' and p.amount_cents > 0
  ) then return 'customer'; end if;
  insert into public.affiliate_referrals (referred_user_id, affiliate_user_id, code) values (p_user_id, aff.user_id, aff.code)
  on conflict (referred_user_id) do nothing;
  return 'ok';
end;
$$;

-- Chamada depois de cada pagamento registrado: aprovado de um indicado dá os dias (uma vez por pagamento);
-- estornado ou contestado tira os dias que aquele pagamento tinha dado.
create or replace function public.affiliate_payment(p_payment_id text)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  pay public.billing_payments; buyer uuid; ref public.affiliate_referrals; aff public.affiliates;
  reward public.affiliate_rewards; has_reward boolean; target public.billing_subscriptions; has_target boolean;
  start_at timestamptz; bonus text; extended integer;
begin
  if p_payment_id like 'affiliate-%' then return 'none'; end if;
  select * into pay from public.billing_payments where id = p_payment_id;
  if not found then return 'none'; end if;
  select user_id into buyer from public.billing_subscriptions where id = pay.subscription_id;
  select * into ref from public.affiliate_referrals where referred_user_id = buyer;
  if not found then return 'none'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(ref.affiliate_user_id::text, 66));
  select * into reward from public.affiliate_rewards where payment_id = p_payment_id for update;
  has_reward := found;

  if pay.status = 'approved' and pay.amount_cents > 0 then
    if has_reward then return 'none'; end if;
    select * into aff from public.affiliates where user_id = ref.affiliate_user_id and enabled;
    if not found then return 'none'; end if;
    -- Assinatura do afiliado: a ativa; se não houver, a última que já foi paga.
    select * into target from public.billing_subscriptions
      where user_id = aff.user_id and paid_until is not null
      order by (paid_until > now()) desc, paid_until desc limit 1 for update;
    has_target := found;
    bonus := 'affiliate-' || p_payment_id;
    if has_target then
      start_at := greatest(now(), target.paid_until);
      insert into public.billing_payments (id, subscription_id, invoice_id, status, amount_cents, currency, live_mode, period_start, period_end, approved_at, provider_updated_at)
      values (bonus, target.id, bonus, 'approved', 0, 'BRL', true, start_at, start_at + pg_catalog.make_interval(days => aff.days_per_payment), now(), now());
      update public.billing_subscriptions set paid_until = (
        select max(period_end) from public.billing_payments where subscription_id = target.id and status = 'approved'
      ) where id = target.id;
    end if;
    update public.router_keys k set expires_at = greatest(now(), k.expires_at) + pg_catalog.make_interval(days => aff.days_per_payment)
      from public.gateway_clients c where c.id = k.gateway_client_id and c.user_id = aff.user_id and k.revoked_at is null;
    get diagnostics extended = row_count;
    insert into public.affiliate_rewards (payment_id, affiliate_user_id, referred_user_id, days, subscription_id, bonus_payment_id, keys_extended)
    values (p_payment_id, aff.user_id, buyer, aff.days_per_payment, case when has_target then target.id end, case when has_target then bonus end, extended);
    return 'granted';
  end if;

  if pay.status in ('refunded', 'charged_back') and has_reward and reward.revoked_at is null then
    if reward.bonus_payment_id is not null then
      update public.billing_payments set status = 'revoked', provider_updated_at = now() where id = reward.bonus_payment_id;
      update public.billing_subscriptions set paid_until = (
        select max(period_end) from public.billing_payments where subscription_id = reward.subscription_id and status = 'approved'
      ) where id = reward.subscription_id;
    end if;
    update public.router_keys k set expires_at = greatest(now(), k.expires_at - pg_catalog.make_interval(days => reward.days))
      from public.gateway_clients c where c.id = k.gateway_client_id and c.user_id = reward.affiliate_user_id and k.revoked_at is null;
    update public.affiliate_rewards set revoked_at = now() where payment_id = p_payment_id;
    return 'revoked';
  end if;
  return 'none';
end;
$$;

revoke all on function public.affiliate_claim(uuid, text), public.affiliate_payment(text) from public, anon, authenticated;
grant execute on function public.affiliate_claim(uuid, text), public.affiliate_payment(text) to service_role;

commit;

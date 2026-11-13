-- Afiliados, parte 2 (rode depois de supabase/affiliates.sql):
--  * Quem é indicado ganha dias na primeira assinatura (3 por padrão, `referred_days`), além dos dias do afiliado.
--  * Venda feita pelo WhatsApp: o admin registra (affiliate_manual) e o afiliado ganha os dias dele; se o cliente
--    tiver conta, ele também ganha os dias de boas-vindas e fica ligado ao afiliado para as próximas renovações.
-- Os dias entram como antes: pagamento-bônus de R$ 0 na assinatura (id "affiliate-..." ou "welcome-...") logo depois
-- do vencimento atual, e a mesma validade a mais nas chaves do Roteador da conta. Estorno tira os dias de novo.
-- Aditivo. Execute no SQL Editor.
begin;

alter table public.affiliates add column if not exists referred_days integer not null default 3 check (referred_days between 0 and 60);
alter table public.affiliate_rewards alter column referred_user_id drop not null;
alter table public.affiliate_rewards add column if not exists source text not null default 'payment' check (source in ('payment', 'manual'));
alter table public.affiliate_rewards add column if not exists note text check (note is null or length(note) <= 200);
alter table public.affiliate_rewards add column if not exists created_by text;

-- Dias de boas-vindas de quem foi indicado: uma vez por conta.
create table if not exists public.affiliate_welcome (
  referred_user_id uuid primary key references auth.users(id) on delete cascade,
  affiliate_user_id uuid not null references auth.users(id) on delete cascade,
  payment_id text unique,
  days integer not null check (days > 0),
  subscription_id uuid references public.billing_subscriptions(id),
  bonus_payment_id text,
  keys_extended integer not null default 0,
  source text not null default 'payment' check (source in ('payment', 'manual')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.affiliate_welcome enable row level security;
revoke all on public.affiliate_welcome from public, anon, authenticated;
grant select, insert, update on public.affiliate_welcome to service_role;

-- Dá `p_days` dias de acesso a uma conta: pagamento-bônus na assinatura (a ativa ou a última paga) e a mesma
-- validade a mais nas chaves do Roteador ligadas a ela. Devolve a assinatura usada e quantas chaves mudaram.
create or replace function public.affiliate_extend(p_user uuid, p_days integer, p_bonus text, out subscription_id uuid, out keys integer)
language plpgsql security invoker set search_path = '' as $$
declare target public.billing_subscriptions; start_at timestamptz;
begin
  select * into target from public.billing_subscriptions s
    where s.user_id = p_user and s.paid_until is not null
    order by (s.paid_until > now()) desc, s.paid_until desc limit 1 for update;
  if found then
    start_at := greatest(now(), target.paid_until);
    insert into public.billing_payments (id, subscription_id, invoice_id, status, amount_cents, currency, live_mode, period_start, period_end, approved_at, provider_updated_at)
    values (p_bonus, target.id, p_bonus, 'approved', 0, 'BRL', true, start_at, start_at + pg_catalog.make_interval(days => p_days), now(), now())
    on conflict (id) do nothing;
    update public.billing_subscriptions set paid_until = (
      select max(p.period_end) from public.billing_payments p where p.subscription_id = target.id and p.status = 'approved'
    ) where id = target.id;
    subscription_id := target.id;
  end if;
  update public.router_keys k set expires_at = greatest(now(), k.expires_at) + pg_catalog.make_interval(days => p_days)
    from public.gateway_clients c where c.id = k.gateway_client_id and c.user_id = p_user and k.revoked_at is null;
  get diagnostics keys = row_count;
end;
$$;

-- Desfaz affiliate_extend (estorno): o bônus deixa de valer e as chaves perdem os dias.
create or replace function public.affiliate_unextend(p_user uuid, p_days integer, p_bonus text, p_subscription uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_bonus is not null then
    update public.billing_payments set status = 'revoked', provider_updated_at = now() where id = p_bonus;
    update public.billing_subscriptions set paid_until = (
      select max(p.period_end) from public.billing_payments p where p.subscription_id = p_subscription and p.status = 'approved'
    ) where id = p_subscription;
  end if;
  update public.router_keys k set expires_at = greatest(now(), k.expires_at - pg_catalog.make_interval(days => p_days))
    from public.gateway_clients c where c.id = k.gateway_client_id and c.user_id = p_user and k.revoked_at is null;
end;
$$;

-- Depois de cada pagamento registrado: aprovado de um indicado dá os dias do afiliado (a cada pagamento) e, na
-- primeira vez, os dias de boas-vindas do indicado; estornado ou contestado tira o que aquele pagamento deu.
create or replace function public.affiliate_payment(p_payment_id text)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  pay public.billing_payments; buyer uuid; ref public.affiliate_referrals; aff public.affiliates;
  reward public.affiliate_rewards; has_reward boolean; welcome public.affiliate_welcome; has_welcome boolean;
  ext record; result text := 'none';
begin
  if p_payment_id like 'affiliate-%' or p_payment_id like 'welcome-%' then return 'none'; end if;
  select * into pay from public.billing_payments where id = p_payment_id;
  if not found then return 'none'; end if;
  select s.user_id into buyer from public.billing_subscriptions s where s.id = pay.subscription_id;
  select * into ref from public.affiliate_referrals where referred_user_id = buyer;
  if not found then return 'none'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(ref.affiliate_user_id::text, 66));
  select * into reward from public.affiliate_rewards where payment_id = p_payment_id for update;
  has_reward := found;
  select * into welcome from public.affiliate_welcome where referred_user_id = buyer for update;
  has_welcome := found;

  if pay.status = 'approved' and pay.amount_cents > 0 then
    select * into aff from public.affiliates where user_id = ref.affiliate_user_id and enabled;
    if not found then return 'none'; end if;
    if not has_reward then
      select * into ext from public.affiliate_extend(aff.user_id, aff.days_per_payment, 'affiliate-' || p_payment_id);
      insert into public.affiliate_rewards (payment_id, affiliate_user_id, referred_user_id, days, subscription_id, bonus_payment_id, keys_extended)
      values (p_payment_id, aff.user_id, buyer, aff.days_per_payment, ext.subscription_id, case when ext.subscription_id is not null then 'affiliate-' || p_payment_id end, ext.keys);
      result := 'granted';
    end if;
    if not has_welcome and aff.referred_days > 0 then
      select * into ext from public.affiliate_extend(buyer, aff.referred_days, 'welcome-' || p_payment_id);
      insert into public.affiliate_welcome (referred_user_id, affiliate_user_id, payment_id, days, subscription_id, bonus_payment_id, keys_extended)
      values (buyer, aff.user_id, p_payment_id, aff.referred_days, ext.subscription_id, case when ext.subscription_id is not null then 'welcome-' || p_payment_id end, ext.keys);
      result := 'granted';
    end if;
    return result;
  end if;

  if pay.status in ('refunded', 'charged_back') then
    if has_reward and reward.revoked_at is null then
      perform public.affiliate_unextend(reward.affiliate_user_id, reward.days, reward.bonus_payment_id, reward.subscription_id);
      update public.affiliate_rewards set revoked_at = now() where payment_id = p_payment_id;
      result := 'revoked';
    end if;
    if has_welcome and welcome.payment_id = p_payment_id and welcome.revoked_at is null then
      perform public.affiliate_unextend(buyer, welcome.days, welcome.bonus_payment_id, welcome.subscription_id);
      update public.affiliate_welcome set revoked_at = now() where referred_user_id = buyer;
      result := 'revoked';
    end if;
  end if;
  return result;
end;
$$;

-- Venda feita pelo WhatsApp (o cliente mandou o código do afiliado): o admin registra e o afiliado ganha os dias.
-- Com a conta do cliente (`p_referred`), ele ganha os dias de boas-vindas (uma vez) e fica ligado ao afiliado,
-- então as próximas renovações pelo site também contam.
create or replace function public.affiliate_manual(p_affiliate uuid, p_referred uuid, p_by text, p_note text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare aff public.affiliates; ref public.affiliate_referrals; ext record; id text := 'manual-' || gen_random_uuid()::text;
  affiliate_days integer; referred_days integer := 0;
begin
  select * into aff from public.affiliates where user_id = p_affiliate and enabled;
  if not found then raise exception 'Afiliado desativado ou inexistente'; end if;
  if p_referred = p_affiliate then raise exception 'O afiliado não pode indicar a si mesmo'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(aff.user_id::text, 66));
  if p_referred is not null then
    select * into ref from public.affiliate_referrals where referred_user_id = p_referred;
    if found and ref.affiliate_user_id <> aff.user_id then raise exception 'Esse cliente já foi indicado por outro afiliado'; end if;
    if not found then
      insert into public.affiliate_referrals (referred_user_id, affiliate_user_id, code) values (p_referred, aff.user_id, aff.code);
    end if;
  end if;
  select * into ext from public.affiliate_extend(aff.user_id, aff.days_per_payment, 'affiliate-' || id);
  insert into public.affiliate_rewards (payment_id, affiliate_user_id, referred_user_id, days, subscription_id, bonus_payment_id, keys_extended, source, note, created_by)
  values (id, aff.user_id, p_referred, aff.days_per_payment, ext.subscription_id, case when ext.subscription_id is not null then 'affiliate-' || id end, ext.keys, 'manual', left(p_note, 200), p_by);
  affiliate_days := aff.days_per_payment;
  if p_referred is not null and aff.referred_days > 0 and not exists (select 1 from public.affiliate_welcome where referred_user_id = p_referred) then
    select * into ext from public.affiliate_extend(p_referred, aff.referred_days, 'welcome-' || id);
    insert into public.affiliate_welcome (referred_user_id, affiliate_user_id, payment_id, days, subscription_id, bonus_payment_id, keys_extended, source)
    values (p_referred, aff.user_id, id, aff.referred_days, ext.subscription_id, case when ext.subscription_id is not null then 'welcome-' || id end, ext.keys, 'manual');
    referred_days := aff.referred_days;
  end if;
  return jsonb_build_object('affiliate_days', affiliate_days, 'referred_days', referred_days);
end;
$$;

revoke all on function public.affiliate_extend(uuid, integer, text), public.affiliate_unextend(uuid, integer, text, uuid),
  public.affiliate_payment(text), public.affiliate_manual(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.affiliate_extend(uuid, integer, text), public.affiliate_unextend(uuid, integer, text, uuid),
  public.affiliate_payment(text), public.affiliate_manual(uuid, uuid, text, text) to service_role;

commit;

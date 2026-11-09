begin;
create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  plan_code text not null check(plan_code in ('dev','devApi','pro')),
  amount_cents integer not null check(amount_cents>0),
  api_enabled boolean not null,
  models text[] not null,
  provider_id text unique,
  merchant_id text,
  provider_status text not null default 'pending',
  provider_updated_at timestamptz,
  checkout_url text,
  checkout_lock_until timestamptz,
  paid_until timestamptz,
  billing_anchor integer check(billing_anchor between 1 and 31),
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists billing_subscriptions_user_idx on public.billing_subscriptions(user_id,created_at desc);
alter table public.billing_subscriptions add column if not exists billing_mode text not null default 'recurring' check(billing_mode in ('recurring','pix'));
create table if not exists public.billing_payments (
  id text primary key,
  subscription_id uuid not null references public.billing_subscriptions(id),
  invoice_id text not null,
  status text not null,
  amount_cents integer not null,
  currency text not null,
  live_mode boolean not null,
  period_start timestamptz not null,
  period_end timestamptz not null check(period_end>period_start),
  approved_at timestamptz,
  provider_updated_at timestamptz not null,
  recorded_at timestamptz not null default now()
);
create index if not exists billing_payments_subscription_idx on public.billing_payments(subscription_id,period_end desc);
create table if not exists public.billing_access (
  subscription_id uuid primary key references public.billing_subscriptions(id),
  user_id uuid not null references auth.users(id),
  gateway_client_id uuid not null unique references public.gateway_clients(id),
  token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
  token_prefix text not null,
  encrypted_token text not null,
  encrypted_upstream text not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists billing_access_user_idx on public.billing_access(user_id);
alter table public.billing_subscriptions enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_access enable row level security;
revoke all on public.billing_subscriptions,public.billing_payments,public.billing_access from public,anon,authenticated;
grant select,insert,update on public.billing_subscriptions,public.billing_payments,public.billing_access to service_role;

create or replace function public.billing_begin_checkout(p_user_id uuid,p_plan text)
returns public.billing_subscriptions language plpgsql security invoker set search_path='' as $$
declare item public.billing_subscriptions;
begin
  if p_user_id is null or p_plan not in ('dev','devApi','pro') then raise exception 'Invalid plan'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,72));
  if exists(select 1 from public.billing_subscriptions where user_id=p_user_id and paid_until>now()) then raise exception 'An active plan already exists'; end if;
  select * into item from public.billing_subscriptions where user_id=p_user_id and plan_code=p_plan and billing_mode='recurring' and provider_status='pending' and created_at>now()-interval '1 day' order by created_at desc limit 1 for update;
  if found then
    if item.checkout_url is not null then return item; end if;
    if item.checkout_lock_until>now() then raise exception 'Checkout in progress'; end if;
    update public.billing_subscriptions set checkout_lock_until=now()+interval '90 seconds' where id=item.id returning * into item;
    return item;
  end if;
  if (select count(*) from public.billing_subscriptions where user_id=p_user_id and created_at>now()-interval '1 hour')>=5 then raise exception 'Checkout limit reached'; end if;
  insert into public.billing_subscriptions(user_id,plan_code,amount_cents,api_enabled,models,checkout_lock_until)
  values(p_user_id,p_plan,case p_plan when 'dev' then 7999 when 'devApi' then 9499 else 11999 end,p_plan<>'dev',
    case when p_plan='pro' then array['claude-fable-5-1','gpt-6-astra','glm-5'] else array['gpt-6-astra','glm-5'] end,now()+interval '90 seconds') returning * into item;
  return item;
end;
$$;
create or replace function public.billing_link_checkout(p_id uuid,p_user_id uuid,p_provider_id text,p_merchant_id text,p_url text,p_modified timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
begin
  update public.billing_subscriptions set provider_id=p_provider_id,merchant_id=p_merchant_id,checkout_url=p_url,
    provider_updated_at=p_modified,checkout_lock_until=null
  where id=p_id and user_id=p_user_id and (provider_id is null or provider_id=p_provider_id);
  if not found then raise exception 'Order unavailable'; end if;
end;
$$;
create or replace function public.billing_update_status(p_id uuid,p_provider_id text,p_status text,p_modified timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
begin
  update public.billing_subscriptions set provider_status=p_status,provider_updated_at=p_modified
  where id=p_id and provider_id=p_provider_id and (provider_updated_at is null or provider_updated_at<=p_modified)
    and not(provider_status='cancelled' and p_status<>'cancelled');
end;
$$;
create or replace function public.billing_apply_payment(
  p_id uuid,p_payment_id text,p_invoice_id text,p_status text,p_amount integer,p_currency text,p_live boolean,
  p_start timestamptz,p_end timestamptz,p_approved timestamptz,p_modified timestamptz,
  p_hash text,p_prefix text,p_encrypted_token text,p_upstream_hash text,p_encrypted_upstream text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare item public.billing_subscriptions; previous public.billing_payments; client_id uuid; expiry timestamptz;
begin
  select * into item from public.billing_subscriptions where id=p_id for update;
  if not found then raise exception 'Unknown subscription'; end if;
  if p_amount<>item.amount_cents or p_currency<>'BRL' or not p_live or p_end<=p_start or p_modified is null then raise exception 'Payment mismatch'; end if;
  if p_status='approved' and p_approved is null then raise exception 'Payment not approved'; end if;
  select * into previous from public.billing_payments where id=p_payment_id for update;
  if found then
    if previous.subscription_id<>p_id or previous.invoice_id<>p_invoice_id then raise exception 'Payment already assigned'; end if;
    if previous.provider_updated_at>p_modified or (previous.status in ('refunded','charged_back') and p_status not in ('refunded','charged_back')) then return false; end if;
    if item.billing_mode='pix' then p_start:=previous.period_start; p_end:=previous.period_end; end if;
    if previous.period_start<>p_start or previous.period_end<>p_end then raise exception 'Payment period changed'; end if;
  elsif item.billing_mode='pix' then
    if p_status<>'approved' then return false; end if;
    p_start:=greatest(p_approved,coalesce(item.paid_until,p_approved));
    p_end:=p_start+interval '30 days';
  end if;
  insert into public.billing_payments(id,subscription_id,invoice_id,status,amount_cents,currency,live_mode,period_start,period_end,approved_at,provider_updated_at)
  values(p_payment_id,p_id,p_invoice_id,p_status,p_amount,p_currency,p_live,p_start,p_end,p_approved,p_modified)
  on conflict(id) do update set status=excluded.status,approved_at=excluded.approved_at,provider_updated_at=excluded.provider_updated_at;
  select max(period_end) into expiry from public.billing_payments where subscription_id=p_id and status='approved';
  update public.billing_subscriptions set paid_until=expiry,billing_anchor=coalesce(billing_anchor,greatest(extract(day from p_start at time zone 'UTC')::integer,extract(day from p_end at time zone 'UTC')::integer)) where id=p_id;
  if expiry>now() and not exists(select 1 from public.billing_access where subscription_id=p_id) then
    if p_hash !~ '^[0-9a-f]{64}$' or p_upstream_hash !~ '^[0-9a-f]{64}$' or p_encrypted_token is null or p_encrypted_upstream is null then raise exception 'Invalid credential'; end if;
    insert into public.gateway_clients(name,token_hash,enabled) values('Assinatura · '||p_id::text,p_upstream_hash,true) returning id into client_id;
    insert into public.billing_access(subscription_id,user_id,gateway_client_id,token_hash,token_prefix,encrypted_token,encrypted_upstream)
    values(p_id,item.user_id,client_id,p_hash,p_prefix,p_encrypted_token,p_encrypted_upstream);
  end if;
  return true;
end;
$$;
create or replace function public.billing_take_sync(p_user_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,73));
  if exists(select 1 from public.billing_subscriptions where user_id=p_user_id and last_sync_at>now()-interval '45 seconds') then return false; end if;
  update public.billing_subscriptions set last_sync_at=now() where user_id=p_user_id;
  return found;
end;
$$;
create or replace function public.billing_revoke_key(p_user_id uuid,p_client_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  update public.billing_access set revoked_at=coalesce(revoked_at,now()) where user_id=p_user_id and gateway_client_id=p_client_id;
  if not found then return false; end if;
  update public.gateway_clients set enabled=false,revoked_at=coalesce(revoked_at,now()) where id=p_client_id;
  return true;
end;
$$;

create or replace view public.billing_subscription_state with (security_invoker=true) as
  select s.id,s.user_id,s.plan_code,s.amount_cents,s.api_enabled,s.models,s.provider_id,s.merchant_id,s.provider_status,s.provider_updated_at,s.checkout_url,s.checkout_lock_until,s.paid_until,s.billing_anchor,s.last_sync_at,s.created_at,
    exists(select 1 from public.billing_payments p where p.subscription_id=s.id and p.status='approved' and p.period_start<=now() and p.period_end>now()) as entitled,s.billing_mode
  from public.billing_subscriptions s;
revoke all on public.billing_subscription_state from public,anon,authenticated;
grant select on public.billing_subscription_state to service_role;
create or replace view public.billing_key_access with (security_invoker=true) as
  select a.*,s.plan_code,s.api_enabled,s.models,s.paid_until,s.provider_status,s.entitled,s.billing_mode
  from public.billing_access a join public.billing_subscription_state s on s.id=a.subscription_id and s.user_id=a.user_id;
revoke all on public.billing_key_access from public,anon,authenticated;
grant select on public.billing_key_access to service_role;

create or replace function public.billing_restore_key(p_user_id uuid,p_id uuid,p_hash text,p_prefix text,p_encrypted_token text,p_upstream_hash text,p_encrypted_upstream text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare client_id uuid;
begin
  perform 1 from public.billing_subscriptions where id=p_id and user_id=p_user_id for update;
  if not found or not exists(select 1 from public.billing_subscription_state where id=p_id and user_id=p_user_id and entitled and api_enabled) then return false; end if;
  if p_hash !~ '^[0-9a-f]{64}$' or p_upstream_hash !~ '^[0-9a-f]{64}$' or p_encrypted_token is null or p_encrypted_upstream is null then raise exception 'Invalid credential'; end if;
  update public.billing_access set token_hash=p_hash,token_prefix=p_prefix,encrypted_token=p_encrypted_token,encrypted_upstream=p_encrypted_upstream,revoked_at=null
  where subscription_id=p_id and user_id=p_user_id and revoked_at is not null returning gateway_client_id into client_id;
  if not found then return false; end if;
  update public.gateway_clients set token_hash=p_upstream_hash,enabled=true,revoked_at=null where id=client_id;
  return true;
end;
$$;
revoke all on function public.billing_restore_key(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.billing_restore_key(uuid,uuid,text,text,text,text,text) to service_role;

create or replace function public.billing_begin_pix(p_user_id uuid,p_plan text)
returns public.billing_subscriptions language plpgsql security invoker set search_path='' as $$
declare item public.billing_subscriptions;
begin
  if p_user_id is null or p_plan not in ('dev','devApi','pro') then raise exception 'Invalid plan'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,72));
  if exists(select 1 from public.billing_subscriptions where user_id=p_user_id and paid_until>now() and (billing_mode<>'pix' or plan_code<>p_plan)) then raise exception 'An active plan already exists'; end if;
  select * into item from public.billing_subscriptions where user_id=p_user_id and plan_code=p_plan and billing_mode='pix' order by created_at desc limit 1 for update;
  if found then
    if item.checkout_url is not null then return item; end if;
    if item.checkout_lock_until>now() then raise exception 'Checkout in progress'; end if;
    update public.billing_subscriptions set checkout_lock_until=now()+interval '90 seconds' where id=item.id returning * into item;
    return item;
  end if;
  insert into public.billing_subscriptions(user_id,plan_code,billing_mode,amount_cents,api_enabled,models,checkout_lock_until)
  values(p_user_id,p_plan,'pix',case p_plan when 'dev' then 7999 when 'devApi' then 9499 else 11999 end,p_plan<>'dev',case when p_plan='pro' then array['claude-fable-5-1','gpt-6-astra','glm-5'] else array['gpt-6-astra','glm-5'] end,now()+interval '90 seconds') returning * into item;
  return item;
end;
$$;
revoke all on function public.billing_begin_pix(uuid,text) from public,anon,authenticated;
grant execute on function public.billing_begin_pix(uuid,text) to service_role;

revoke all on function public.billing_begin_checkout(uuid,text),public.billing_link_checkout(uuid,uuid,text,text,text,timestamptz),public.billing_update_status(uuid,text,text,timestamptz),public.billing_apply_payment(uuid,text,text,text,integer,text,boolean,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,text,text),public.billing_take_sync(uuid),public.billing_revoke_key(uuid,uuid) from public,anon,authenticated;
grant execute on function public.billing_begin_checkout(uuid,text),public.billing_link_checkout(uuid,uuid,text,text,text,timestamptz),public.billing_update_status(uuid,text,text,timestamptz),public.billing_apply_payment(uuid,text,text,text,integer,text,boolean,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,text,text),public.billing_take_sync(uuid),public.billing_revoke_key(uuid,uuid) to service_role;
commit;

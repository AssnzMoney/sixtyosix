-- Planos v2: Starter (dev), Starter + API (devApi), Pro (pro) e Enterprise (enterprise)
begin;
alter table public.billing_subscriptions drop constraint if exists billing_subscriptions_plan_code_check;
alter table public.billing_subscriptions add constraint billing_subscriptions_plan_code_check check (plan_code in ('dev','devApi','pro','enterprise'));

create or replace function public.billing_plan_amount_cents(p_plan text, p_existing boolean default false)
returns integer language sql immutable set search_path = '' as $$
  select case p_plan
    when 'dev' then 24990
    when 'devApi' then 26490
    when 'pro' then 31990
    when 'enterprise' then 60990
    else 31990
  end;
$$;

create or replace function public.billing_plan_models(p_plan text)
returns text[] language sql immutable set search_path = '' as $$
  select case when p_plan in ('pro','enterprise') then array['claude-fable-5-2','argon-4','gpt-6-astra','glm-5'] else array['gpt-6-astra'] end;
$$;

create or replace function public.billing_begin_checkout(p_user_id uuid, p_plan text)
returns public.billing_subscriptions language plpgsql security invoker set search_path = '' as $$
declare item public.billing_subscriptions; v_amount integer;
begin
  if p_user_id is null or p_plan not in ('dev','devApi','pro','enterprise') then raise exception 'Invalid plan'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 72));
  if exists(select 1 from public.billing_subscriptions where user_id = p_user_id and paid_until > now()) then raise exception 'An active plan already exists'; end if;
  v_amount := public.billing_plan_amount_cents(p_plan, false);
  select * into item from public.billing_subscriptions where user_id = p_user_id and plan_code = p_plan and billing_mode = 'recurring' and provider_status = 'pending' and created_at > now() - interval '1 day' order by created_at desc limit 1 for update;
  if found then
    if item.checkout_url is not null and item.amount_cents = v_amount then return item; end if;
    if item.checkout_lock_until > now() then raise exception 'Checkout in progress'; end if;
    update public.billing_subscriptions set amount_cents = v_amount, models = public.billing_plan_models(p_plan), checkout_url = null, checkout_lock_until = now() + interval '90 seconds' where id = item.id returning * into item;
    return item;
  end if;
  if (select count(*) from public.billing_subscriptions where user_id = p_user_id and created_at > now() - interval '1 hour') >= 5 then raise exception 'Checkout limit reached'; end if;
  insert into public.billing_subscriptions(user_id, plan_code, amount_cents, api_enabled, models, checkout_lock_until)
  values(p_user_id, p_plan, v_amount, p_plan <> 'dev', public.billing_plan_models(p_plan), now() + interval '90 seconds') returning * into item;
  return item;
end;
$$;

create or replace function public.billing_begin_pix(p_user_id uuid, p_plan text)
returns public.billing_subscriptions language plpgsql security invoker set search_path = '' as $$
declare item public.billing_subscriptions; v_amount integer;
begin
  if p_user_id is null or p_plan not in ('dev','devApi','pro','enterprise') then raise exception 'Invalid plan'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 72));
  v_amount := public.billing_plan_amount_cents(p_plan, false);
  select * into item from public.billing_subscriptions where user_id = p_user_id and plan_code = p_plan and billing_mode = 'pix' and provider_status = 'pending' and created_at > now() - interval '1 day' order by created_at desc limit 1 for update;
  if found then
    if item.checkout_lock_until > now() then raise exception 'Checkout in progress'; end if;
    update public.billing_subscriptions set amount_cents = v_amount, models = public.billing_plan_models(p_plan), checkout_url = null, checkout_lock_until = now() + interval '90 seconds' where id = item.id returning * into item;
    return item;
  end if;
  if (select count(*) from public.billing_subscriptions where user_id = p_user_id and created_at > now() - interval '1 hour') >= 10 then raise exception 'Checkout limit reached'; end if;
  insert into public.billing_subscriptions(user_id, plan_code, billing_mode, amount_cents, api_enabled, models, checkout_lock_until)
  values(p_user_id, p_plan, 'pix', v_amount, p_plan <> 'dev', public.billing_plan_models(p_plan), now() + interval '90 seconds') returning * into item;
  return item;
end;
$$;

revoke all on function public.billing_begin_checkout(uuid,text), public.billing_begin_pix(uuid,text) from public, anon, authenticated;
grant execute on function public.billing_begin_checkout(uuid,text), public.billing_begin_pix(uuid,text) to service_role;
commit;

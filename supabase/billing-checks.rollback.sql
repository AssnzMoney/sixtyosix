begin;
do $$
declare u uuid; s public.billing_subscriptions; c uuid; n integer; h text; expiry timestamptz;
begin
 select id into u from auth.users where email='alisongeneral25@gmail.com';
 if u is null then raise exception 'QA account missing'; end if;
 -- All records in this verification are rolled back, including credentials.
 insert into public.billing_subscriptions(user_id,plan_code,amount_cents,api_enabled,models,provider_id)
 values(u,'devApi',9499,true,array['gpt-6-astra','glm-5'],'qa-'||gen_random_uuid()) returning * into s;
 if (select entitled from public.billing_subscription_state where id=s.id) then raise exception 'Pending granted access'; end if;
 perform public.billing_update_status(s.id,s.provider_id,'authorized',now());
 if (select entitled from public.billing_subscription_state where id=s.id) then raise exception 'Authorization granted unpaid access'; end if;
 perform public.billing_apply_payment(s.id,'qa-payment-'||s.id,'qa-invoice','approved',9499,'BRL',true,now()-interval '1 day',now()+interval '29 days',now(),now(),repeat('a',64),'sk-sp-qa', 'cipher',repeat('b',64),'cipher');
 select gateway_client_id,token_hash into c,h from public.billing_access where subscription_id=s.id;
 if c is null or not(select entitled from public.billing_subscription_state where id=s.id) then raise exception 'Approved payment did not grant'; end if;
 if (select user_id from public.gateway_clients where id=c) is not null then raise exception 'Raw bridge exposed to legacy issuance'; end if;
 perform public.billing_apply_payment(s.id,'qa-payment-'||s.id,'qa-invoice','approved',9499,'BRL',true,now()-interval '1 day',now()+interval '29 days',now(),now(),repeat('c',64),'sk-sp-other','other',repeat('d',64),'other');
 if (select token_hash from public.billing_access where subscription_id=s.id)<>h then raise exception 'Duplicate changed key'; end if;
 select count(*) into n from public.billing_payments where subscription_id=s.id;
 if n<>1 then raise exception 'Duplicate payment'; end if;
 perform public.billing_update_status(s.id,s.provider_id,'cancelled',now());
 if not(select entitled from public.billing_subscription_state where id=s.id) then raise exception 'Cancellation removed paid period'; end if;
 -- Same payment is refunded; a delayed approved snapshot cannot resurrect it.
 perform public.billing_apply_payment(s.id,'qa-payment-'||s.id,'qa-invoice','refunded',9499,'BRL',true,now()-interval '1 day',now()+interval '29 days',now(),now()+interval '1 minute',repeat('a',64),'sk-sp-qa','cipher',repeat('b',64),'cipher');
 perform public.billing_apply_payment(s.id,'qa-payment-'||s.id,'qa-invoice','approved',9499,'BRL',true,now()-interval '1 day',now()+interval '29 days',now(),now(),repeat('a',64),'sk-sp-qa','cipher',repeat('b',64),'cipher');
 if (select entitled from public.billing_subscription_state where id=s.id) then raise exception 'Refund retained access'; end if;
 -- A different approved monthly payment restores entitlement with the same key.
 perform public.billing_apply_payment(s.id,'qa-renewal-'||s.id,'qa-renewal','approved',9499,'BRL',true,now()-interval '1 hour',now()+interval '1 month',now(),now(),repeat('c',64),'sk-sp-other','other',repeat('d',64),'other');
 if not(select entitled from public.billing_subscription_state where id=s.id) or (select token_hash from public.billing_access where subscription_id=s.id)<>h then raise exception 'Renewal failed'; end if;
 if public.billing_revoke_key(gen_random_uuid(),c) then raise exception 'Foreign revoke allowed'; end if;
 if not public.billing_revoke_key(u,c) then raise exception 'Own revoke failed'; end if;
 if not public.billing_restore_key(u,s.id,repeat('e',64),'sk-sp-new','cipher',repeat('f',64),'cipher') then raise exception 'Restore failed'; end if;
 if not(select enabled from public.gateway_clients where id=c) then raise exception 'Bridge not restored'; end if;
 -- Time is represented by an already-finished approved period, without changing system time.
 update public.billing_payments set period_start=now()-interval '31 days',period_end=now()-interval '1 second' where subscription_id=s.id;
 update public.billing_subscriptions set paid_until=now()-interval '1 second' where id=s.id;
 if (select entitled from public.billing_key_access where subscription_id=s.id) then raise exception 'Expired remained entitled'; end if;
 begin
  perform public.billing_apply_payment(s.id,'qa-bad-'||s.id,'bad','approved',1,'BRL',true,now(),now()+interval '1 month',now(),now(),repeat('a',64),'prefix','cipher',repeat('b',64),'cipher');
  raise exception 'Wrong amount accepted';
 exception when others then if sqlerrm='Wrong amount accepted' then raise; end if; end;
 if has_table_privilege('authenticated','public.billing_access','select') or has_table_privilege('anon','public.billing_payments','select') or has_table_privilege('authenticated','public.billing_subscriptions','update') then raise exception 'Public billing permissions'; end if;
 if has_function_privilege('authenticated','public.billing_begin_checkout(uuid,text)','execute') then raise exception 'Public billing RPC'; end if;
 if not exists(select 1 from pg_class where oid='public.billing_access'::regclass and relrowsecurity) then raise exception 'RLS missing'; end if;
 -- Pix: fixed 30-day periods, renewal stacks, retries do not extend again.
 update public.billing_subscriptions set billing_mode='pix',paid_until=null where id=s.id;
 perform public.billing_apply_payment(s.id,'qa-pix-'||s.id,'qa-pix','approved',9499,'BRL',true,now(),now()+interval '30 days',now(),now(),repeat('a',64),'prefix','cipher',repeat('b',64),'cipher');
 select paid_until into expiry from public.billing_subscriptions where id=s.id;
 if expiry<>now()+interval '30 days' then raise exception 'Pix 30-day period wrong'; end if;
 perform public.billing_apply_payment(s.id,'qa-pix-renew-'||s.id,'qa-pix-renew','approved',9499,'BRL',true,now(),now()+interval '30 days',now(),now(),repeat('a',64),'prefix','cipher',repeat('b',64),'cipher');
 perform public.billing_apply_payment(s.id,'qa-pix-renew-'||s.id,'qa-pix-renew','approved',9499,'BRL',true,now(),now()+interval '30 days',now(),now(),repeat('a',64),'prefix','cipher',repeat('b',64),'cipher');
 if (select paid_until from public.billing_subscriptions where id=s.id)<>now()+interval '60 days' then raise exception 'Pix renewal or duplicate wrong'; end if;
 if (select token_hash from public.billing_access where subscription_id=s.id)<>repeat('e',64) then raise exception 'Pix rotated existing key'; end if;
 raise notice 'PASS: approval, duplicate, cancellation, refund, stale event, renewal, ownership, restore, expiry and privacy';
end $$;
rollback;
select 'PASS — lifecycle checked, all QA changes rolled back' as verification;

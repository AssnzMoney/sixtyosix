-- Verification only: creates no persistent trial or credential.
begin;
do $$
declare u uuid; first_trial public.gateway_trials; again public.gateway_trials; total_before bigint;
begin
  select id into u from auth.users where email_confirmed_at is not null and not exists(select 1 from public.gateway_trials t where t.user_id=auth.users.id) limit 1;
  if u is null then raise exception 'A confirmed account without a trial is required for this rollback check'; end if;
  select count(*) into total_before from public.gateway_clients;
  first_trial:=public.account_start_trial(u,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),'sk-sx-QA','encrypted-qa-public',replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),'encrypted-qa-upstream');
  again:=public.account_start_trial(u,repeat('a',64),'sk-sx-QA2','candidate-discarded',repeat('b',64),'candidate-discarded');
  if first_trial.gateway_client_id<>again.gateway_client_id or first_trial.expires_at<>again.expires_at then raise exception 'Trial was restarted'; end if;
  if extract(epoch from first_trial.expires_at-first_trial.created_at)<>604800 then raise exception 'Wrong trial duration'; end if;
  if (select count(*) from public.gateway_clients)<>total_before+1 then raise exception 'Duplicate upstream access'; end if;
  if exists(select 1 from public.gateway_clients where id=first_trial.gateway_client_id and user_id is not null) then raise exception 'Private bridge was exposed as a legacy owned key'; end if;
  if public.account_revoke_trial(gen_random_uuid(),first_trial.gateway_client_id) then raise exception 'Foreign revocation accepted'; end if;
  if not public.account_revoke_trial(u,first_trial.gateway_client_id) then raise exception 'Own revocation failed'; end if;
  again:=public.account_start_trial(u,repeat('a',64),'sk-sx-QA2','candidate-discarded',repeat('b',64),'candidate-discarded');
  if again.revoked_at is null then raise exception 'Revoked trial restarted'; end if;
  if has_table_privilege('anon','public.gateway_trials','select') or has_table_privilege('authenticated','public.gateway_trials','insert') then raise exception 'Trial table exposed'; end if;
  if has_function_privilege('authenticated','public.account_start_trial(uuid,text,text,text,text,text)','execute') then raise exception 'Trial RPC exposed'; end if;
end;
$$;
rollback;
select 'passed: one trial, 7 days, isolation, revocation, rollback' as result;

-- Teste grátis de 3 horas, mais lento que os planos pagos.
-- Rode depois de supabase/trial-access.sql e supabase/gateway-guard.sql. Não mexe em quem já pagou.
-- Continua sendo um teste por conta: quem já fez (inclusive os de 7 dias) não ganha outro.
begin;

-- 1) A duração deixa de ser fixa em 7 dias.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.gateway_trials'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%7 days%'
  loop
    execute format('alter table public.gateway_trials drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.gateway_trials alter column expires_at set default (now() + interval '3 hours');
alter table public.gateway_trials drop constraint if exists gateway_trials_duration_check;
alter table public.gateway_trials add constraint gateway_trials_duration_check
  check (expires_at > created_at and expires_at <= created_at + interval '7 days');

-- 2) Ritmo do teste (padrão: 10 chamadas por minuto e 1 resposta por vez). Editável no admin.
alter table public.gateway_settings add column if not exists trial_rpm integer check (trial_rpm is null or trial_rpm between 1 and 100000);
alter table public.gateway_settings add column if not exists trial_concurrency integer check (trial_concurrency is null or trial_concurrency between 1 and 1000);
insert into public.gateway_settings (id, rpm, concurrency, trial_rpm, trial_concurrency) values (true, 60, 4, 10, 1)
  on conflict (id) do update set trial_rpm = coalesce(public.gateway_settings.trial_rpm, 10), trial_concurrency = coalesce(public.gateway_settings.trial_concurrency, 1);

-- 3) Início do teste: 3 horas, com o ritmo do teste gravado como limite próprio da chave.
create or replace function public.account_start_trial_3h(p_user_id uuid, p_hash text, p_prefix text, p_encrypted_token text, p_upstream_hash text, p_encrypted_upstream text)
returns public.gateway_trials language plpgsql security invoker set search_path = '' as $$
declare
  existing public.gateway_trials;
  created_client uuid;
  v_rpm integer;
  v_conc integer;
begin
  if p_user_id is null or p_hash !~ '^[0-9a-f]{64}$' or p_upstream_hash !~ '^[0-9a-f]{64}$'
     or length(p_encrypted_token) > 1000 or length(p_encrypted_upstream) > 1000 then
    raise exception 'Invalid trial';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 71));
  select * into existing from public.gateway_trials where user_id = p_user_id;
  if found then return existing; end if;

  insert into public.gateway_clients(name, token_hash, enabled)
    values ('Teste 3 horas · ' || p_user_id::text, p_upstream_hash, true) returning id into created_client;
  insert into public.gateway_trials(user_id, gateway_client_id, token_hash, token_prefix, encrypted_token, encrypted_upstream, created_at, expires_at)
    values (p_user_id, created_client, p_hash, p_prefix, p_encrypted_token, p_encrypted_upstream, now(), now() + interval '3 hours')
    returning * into existing;

  select trial_rpm, trial_concurrency into v_rpm, v_conc from public.gateway_settings where id;
  insert into public.gateway_controls (client_id, rpm, concurrency)
    values (created_client, coalesce(v_rpm, 10), coalesce(v_conc, 1))
    on conflict (client_id) do update set rpm = excluded.rpm, concurrency = excluded.concurrency, updated_at = now();
  return existing;
end;
$$;

revoke all on function public.account_start_trial_3h(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.account_start_trial_3h(uuid, text, text, text, text, text) to service_role;

commit;

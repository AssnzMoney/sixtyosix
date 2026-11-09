begin;
create table if not exists public.gateway_trials (
  user_id uuid primary key references auth.users(id),
  gateway_client_id uuid not null unique references public.gateway_clients(id),
  token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
  token_prefix text not null,
  encrypted_token text not null,
  encrypted_upstream text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '7 days'),
  revoked_at timestamptz,
  check(expires_at=created_at+interval '7 days')
);
alter table public.gateway_trials enable row level security;
revoke all on public.gateway_trials from public,anon,authenticated;
grant select,insert,update on public.gateway_trials to service_role;
create or replace function public.account_start_trial(p_user_id uuid,p_hash text,p_prefix text,p_encrypted_token text,p_upstream_hash text,p_encrypted_upstream text)
returns public.gateway_trials language plpgsql security invoker set search_path='' as $$
declare existing public.gateway_trials; created_client uuid;
begin
  if p_user_id is null or p_hash !~ '^[0-9a-f]{64}$' or p_upstream_hash !~ '^[0-9a-f]{64}$' or length(p_encrypted_token)>1000 or length(p_encrypted_upstream)>1000 then raise exception 'Invalid trial'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,71));
  select * into existing from public.gateway_trials where user_id=p_user_id;
  if found then return existing; end if;
  -- The bridge credential is private and never owned/claimable by a portal user.
  insert into public.gateway_clients(name,token_hash,enabled) values('Teste 7 dias · '||p_user_id::text,p_upstream_hash,true) returning id into created_client;
  insert into public.gateway_trials(user_id,gateway_client_id,token_hash,token_prefix,encrypted_token,encrypted_upstream)
    values(p_user_id,created_client,p_hash,p_prefix,p_encrypted_token,p_encrypted_upstream) returning * into existing;
  return existing;
end;
$$;
revoke all on function public.account_start_trial(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.account_start_trial(uuid,text,text,text,text,text) to service_role;
create or replace function public.account_revoke_trial(p_user_id uuid,p_client_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  update public.gateway_trials set revoked_at=coalesce(revoked_at,now()) where user_id=p_user_id and gateway_client_id=p_client_id;
  if not found then return false; end if;
  update public.gateway_clients set enabled=false,revoked_at=coalesce(revoked_at,now()) where id=p_client_id;
  return true;
end;
$$;
revoke all on function public.account_revoke_trial(uuid,uuid) from public,anon,authenticated;
grant execute on function public.account_revoke_trial(uuid,uuid) to service_role;
commit;

begin;
create or replace function public.account_replace_trial_key(p_user_id uuid,p_hash text,p_prefix text,p_encrypted_token text,p_upstream_hash text,p_encrypted_upstream text)
returns public.gateway_trials language plpgsql security invoker set search_path='' as $$
declare existing public.gateway_trials;
begin
 if p_user_id is null or p_hash !~ '^[0-9a-f]{64}$' or p_upstream_hash !~ '^[0-9a-f]{64}$' or length(p_encrypted_token)>1000 or length(p_encrypted_upstream)>1000 then raise exception 'Invalid key'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,71));
 select * into existing from public.gateway_trials where user_id=p_user_id for update;
 if not found or existing.expires_at<=now() then raise exception 'Trial expired or unavailable'; end if;
 if existing.revoked_at is null then return existing; end if;
 update public.gateway_clients set token_hash=p_upstream_hash,enabled=true,revoked_at=null where id=existing.gateway_client_id;
 if not found then raise exception 'Trial client unavailable'; end if;
 update public.gateway_trials set token_hash=p_hash,token_prefix=p_prefix,encrypted_token=p_encrypted_token,encrypted_upstream=p_encrypted_upstream,revoked_at=null where user_id=p_user_id returning * into existing;
 return existing;
end;
$$;
revoke all on function public.account_replace_trial_key(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.account_replace_trial_key(uuid,text,text,text,text,text) to service_role;
commit;

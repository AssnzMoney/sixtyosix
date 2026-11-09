-- Additive integration: existing clients, token hashes and usage remain intact.
-- Execute as postgres. New RPCs are service-role only, never browser-callable.
begin;
alter table public.gateway_clients add column if not exists user_id uuid references auth.users(id);
alter table public.gateway_clients add column if not exists key_prefix text;
create index if not exists gateway_clients_owner_idx on public.gateway_clients(user_id, created_at desc);

create or replace function public.account_claim_gateway_key(p_user_id uuid, p_token_hash text, p_prefix text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_user_id is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid claim'; end if;
  update public.gateway_clients set user_id = p_user_id, key_prefix = p_prefix
  where token_hash = p_token_hash and enabled and (user_id is null or user_id = p_user_id);
  if not found then raise exception 'Key unavailable'; end if;
end;
$$;
revoke all on function public.account_claim_gateway_key(uuid,text,text) from public, anon, authenticated;
grant execute on function public.account_claim_gateway_key(uuid,text,text) to service_role;

create or replace function public.account_issue_gateway_key(p_user_id uuid, p_name text, p_token_hash text, p_prefix text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare created_id uuid;
begin
  if p_user_id is null or length(trim(p_name)) not between 1 and 80 or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid key'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  if not exists(select 1 from public.gateway_clients where user_id = p_user_id and enabled) then raise exception 'Test access required'; end if;
  if (select count(*) from public.gateway_clients where user_id = p_user_id and enabled) >= 10 then raise exception 'Key limit reached'; end if;
  insert into public.gateway_clients(name,token_hash,enabled,user_id,key_prefix)
    values(trim(p_name),p_token_hash,true,p_user_id,p_prefix) returning id into created_id;
  return created_id;
end;
$$;
revoke all on function public.account_issue_gateway_key(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.account_issue_gateway_key(uuid,text,text,text) to service_role;
alter table public.gateway_clients enable row level security;
alter table public.gateway_usage enable row level security;
revoke all on public.gateway_clients, public.gateway_usage from anon, authenticated;
commit;

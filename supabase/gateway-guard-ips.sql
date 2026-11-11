-- Limite de IPs por chave, com aprovação no admin (aba Roteador → botão Detalhes da chave).
-- Rode depois de supabase/gateway-guard.sql. Aditivo: só acrescenta colunas e atualiza gateway_gate.
--
-- Como funciona: com "Máximo de IPs" definido, a chave aceita sozinha até esse número de IPs.
-- Um IP novo além do limite fica "aguardando" (a chamada é recusada) até você aceitar no painel.
-- IPs sem uso há 7 dias deixam de ocupar vaga, porque IP de casa e de celular muda com o tempo.
begin;

alter table public.gateway_settings add column if not exists max_ips integer check (max_ips is null or max_ips between 1 and 100);
alter table public.gateway_controls add column if not exists max_ips integer check (max_ips is null or max_ips between 1 and 100);
alter table public.gateway_client_ips add column if not exists accepted boolean not null default true;

create or replace function public.gateway_gate(p_client uuid, p_ip text, p_request uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_ip inet;
  v_rpm integer;
  v_conc integer;
  v_max_ips integer;
  v_hits integer;
  v_busy integer;
  v_used integer;
  v_row public.gateway_client_ips;
begin
  if p_client is null then return jsonb_build_object('ok', true, 'leased', false); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_client::text, 0));

  begin
    v_ip := nullif(trim(coalesce(p_ip, '')), '')::inet;
  exception when others then
    v_ip := null;
  end;

  select coalesce(c.rpm, s.rpm), coalesce(c.concurrency, s.concurrency), coalesce(c.max_ips, s.max_ips)
    into v_rpm, v_conc, v_max_ips
    from (select 1) one
    left join public.gateway_settings s on s.id
    left join public.gateway_controls c on c.client_id = p_client;

  if v_ip is not null then
    if exists (select 1 from public.gateway_ip_blocks b where v_ip <<= b.network) then
      return jsonb_build_object('ok', false, 'reason', 'ip_blocked');
    end if;

    -- IPs aceitos e em uso nos últimos 7 dias (sem contar este).
    select count(*) into v_used from public.gateway_client_ips x
      where x.client_id = p_client and x.ip <> v_ip and x.accepted and x.blocked_at is null and x.last_seen > now() - interval '7 days';

    select * into v_row from public.gateway_client_ips x where x.client_id = p_client and x.ip = v_ip for update;
    if found then
      update public.gateway_client_ips set last_seen = now(), requests = requests + 1
        where client_id = p_client and ip = v_ip;
      if v_row.blocked_at is not null then
        return jsonb_build_object('ok', false, 'reason', 'ip_blocked');
      end if;
      if not v_row.accepted then
        -- Abriu vaga (limite maior ou IP antigo parado): aceita sozinho.
        if v_max_ips is null or v_used < v_max_ips then
          update public.gateway_client_ips set accepted = true where client_id = p_client and ip = v_ip;
        else
          return jsonb_build_object('ok', false, 'reason', 'ip_pending');
        end if;
      end if;
    else
      if v_max_ips is not null and v_used >= v_max_ips then
        insert into public.gateway_client_ips (client_id, ip, requests, accepted) values (p_client, v_ip, 1, false);
        return jsonb_build_object('ok', false, 'reason', 'ip_pending');
      end if;
      insert into public.gateway_client_ips (client_id, ip, requests, accepted) values (p_client, v_ip, 1, true);
    end if;
  end if;

  delete from public.gateway_inflight where client_id = p_client and expires_at < now();
  if v_conc is not null then
    select count(*) into v_busy from public.gateway_inflight where client_id = p_client;
    if v_busy >= v_conc then
      return jsonb_build_object('ok', false, 'reason', 'busy', 'retry_after', 3);
    end if;
  end if;

  if v_rpm is not null then
    delete from public.gateway_rate where client_id = p_client and bucket < now() - interval '10 minutes';
    insert into public.gateway_rate as r (client_id, bucket, hits) values (p_client, date_trunc('minute', now()), 1)
      on conflict (client_id, bucket) do update set hits = r.hits + 1
      returning r.hits into v_hits;
    if v_hits > v_rpm then
      return jsonb_build_object('ok', false, 'reason', 'rate', 'retry_after', greatest(1, 60 - floor(extract(second from now()))::integer));
    end if;
  end if;

  if v_conc is not null and p_request is not null then
    insert into public.gateway_inflight (id, client_id, expires_at) values (p_request, p_client, now() + interval '6 minutes')
      on conflict (id) do nothing;
    return jsonb_build_object('ok', true, 'leased', true);
  end if;
  return jsonb_build_object('ok', true, 'leased', false);
end;
$$;

revoke all on function public.gateway_gate(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.gateway_gate(uuid, text, uuid) to service_role;

commit;

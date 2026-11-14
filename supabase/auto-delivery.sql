-- Entrega automática da chave e troca automática de IP.
-- Rode depois de router.sql, gateway-guard.sql, gateway-guard-ips.sql e billing-lifecycle.sql.
-- Aditivo: cria tabelas e colunas novas e troca gateway_gate por uma versão com dispositivo.
--
-- 1) Chave do site: cada assinatura com API tem uma chave do Roteador (router_keys), criada no
--    pagamento aprovado e renovada a cada pagamento. A primeira vez que o cliente vê a chave no
--    painel fica registrada (data, IP e navegador) como prova de entrega.
-- 2) IP: a chave segue o cliente. IP novo além do limite troca de lugar com o antigo, sozinho:
--    - na hora, se o pedido vem do mesmo dispositivo (a instalação do Claude Code);
--    - senão, só se o IP antigo estiver parado há alguns minutos (uso ao mesmo tempo = chave compartilhada);
--    - com um máximo de trocas por dia.
begin;

create table if not exists public.billing_router_keys (
  subscription_id uuid primary key references public.billing_subscriptions(id) on delete cascade,
  router_key_id uuid not null unique references public.router_keys(id) on delete cascade,
  adopted boolean not null default false, -- chave que já existia (entregue pelo WhatsApp) e passou a renovar sozinha
  created_at timestamptz not null default now(),
  revealed_at timestamptz,
  revealed_ip text check (revealed_ip is null or length(revealed_ip) <= 64),
  revealed_user_agent text check (revealed_user_agent is null or length(revealed_user_agent) <= 300),
  rotated_at timestamptz
);
alter table public.billing_router_keys enable row level security;
revoke all on public.billing_router_keys from public, anon, authenticated;
grant select, insert, update, delete on public.billing_router_keys to service_role;

-- Troca de IP: quanto tempo o IP antigo precisa estar parado e quantas trocas por dia.
alter table public.gateway_settings add column if not exists ip_swap_idle_minutes integer not null default 10 check (ip_swap_idle_minutes between 0 and 1440);
alter table public.gateway_settings add column if not exists ip_swaps_per_day integer not null default 12 check (ip_swaps_per_day between 1 and 500);

-- Dispositivo visto em cada IP: "cc:" = instalação do Claude Code (forte); "ua:" = sistema e ferramenta (fraco).
alter table public.gateway_client_ips add column if not exists device text check (device is null or length(device) <= 80);
alter table public.gateway_client_ips add column if not exists device_label text check (device_label is null or length(device_label) <= 120);

create table if not exists public.gateway_ip_swaps (
  id bigint generated always as identity primary key,
  client_id uuid not null,
  from_ip inet,
  to_ip inet not null,
  same_device boolean not null default false,
  device_label text,
  at timestamptz not null default now()
);
create index if not exists gateway_ip_swaps_client_idx on public.gateway_ip_swaps(client_id, at desc);
alter table public.gateway_ip_swaps enable row level security;
revoke all on public.gateway_ip_swaps from public, anon, authenticated;
grant select, insert, delete on public.gateway_ip_swaps to service_role;

drop function if exists public.gateway_gate(uuid, text, uuid);
create or replace function public.gateway_gate(p_client uuid, p_ip text, p_request uuid, p_device text default null, p_device_label text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_ip inet;
  v_rpm integer;
  v_conc integer;
  v_max_ips integer;
  v_idle integer;
  v_per_day integer;
  v_hits integer;
  v_busy integer;
  v_used integer;
  v_row public.gateway_client_ips;
  v_old public.gateway_client_ips;
  v_same boolean := false;
  v_exists boolean := false;
  v_swaps integer;
  v_wait integer;
  v_device text := nullif(left(trim(coalesce(p_device, '')), 80), '');
  v_label text := nullif(left(trim(coalesce(p_device_label, '')), 120), '');
begin
  if p_client is null then return jsonb_build_object('ok', true, 'leased', false); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_client::text, 0));

  begin
    v_ip := nullif(trim(coalesce(p_ip, '')), '')::inet;
  exception when others then
    v_ip := null;
  end;

  select coalesce(c.rpm, s.rpm), coalesce(c.concurrency, s.concurrency), coalesce(c.max_ips, s.max_ips),
         coalesce(s.ip_swap_idle_minutes, 10), coalesce(s.ip_swaps_per_day, 12)
    into v_rpm, v_conc, v_max_ips, v_idle, v_per_day
    from (select 1) one
    left join public.gateway_settings s on s.id
    left join public.gateway_controls c on c.client_id = p_client;

  if v_ip is not null then
    if exists (select 1 from public.gateway_ip_blocks b where v_ip <<= b.network) then
      return jsonb_build_object('ok', false, 'reason', 'ip_blocked');
    end if;

    select * into v_row from public.gateway_client_ips x where x.client_id = p_client and x.ip = v_ip for update;
    v_exists := found;
    if v_exists and v_row.blocked_at is not null then
      update public.gateway_client_ips set last_seen = now(), requests = requests + 1 where client_id = p_client and ip = v_ip;
      return jsonb_build_object('ok', false, 'reason', 'ip_blocked');
    end if;

    -- IPs aceitos e em uso nos últimos 7 dias (sem contar este).
    select count(*) into v_used from public.gateway_client_ips x
      where x.client_id = p_client and x.ip <> v_ip and x.accepted and x.blocked_at is null and x.last_seen > now() - interval '7 days';

    if (not v_exists or not v_row.accepted) and v_max_ips is not null and v_used >= v_max_ips then
      -- Limite cheio: este IP só entra trocando de lugar com o IP aceito usado há mais tempo.
      select * into v_old from public.gateway_client_ips x
        where x.client_id = p_client and x.ip <> v_ip and x.accepted and x.blocked_at is null and x.last_seen > now() - interval '7 days'
        order by x.last_seen asc limit 1;
      v_same := v_device like 'cc:%' and exists (
        select 1 from public.gateway_client_ips x
          where x.client_id = p_client and x.ip <> v_ip and x.accepted and x.blocked_at is null and x.device = v_device);
      if not v_same then
        -- Outro dispositivo: o IP antigo mais recente precisa estar parado (uso ao mesmo tempo não troca).
        select ceil(extract(epoch from (max(x.last_seen) + make_interval(mins => v_idle) - now())) / 60)::integer into v_wait
          from public.gateway_client_ips x
          where x.client_id = p_client and x.ip <> v_ip and x.accepted and x.blocked_at is null and x.last_seen > now() - interval '7 days';
        if coalesce(v_wait, 0) > 0 then
          if v_exists then
            update public.gateway_client_ips set last_seen = now(), requests = requests + 1, device = coalesce(v_device, device), device_label = coalesce(v_label, device_label)
              where client_id = p_client and ip = v_ip;
          else
            insert into public.gateway_client_ips (client_id, ip, requests, accepted, device, device_label) values (p_client, v_ip, 1, false, v_device, v_label);
          end if;
          return jsonb_build_object('ok', false, 'reason', 'ip_in_use', 'retry_after', least(v_wait, v_idle) * 60);
        end if;
      end if;
      select count(*) into v_swaps from public.gateway_ip_swaps w where w.client_id = p_client and w.at > now() - interval '24 hours';
      if v_swaps >= v_per_day then
        if not v_exists then
          insert into public.gateway_client_ips (client_id, ip, requests, accepted, device, device_label) values (p_client, v_ip, 1, false, v_device, v_label)
            on conflict (client_id, ip) do nothing;
        end if;
        return jsonb_build_object('ok', false, 'reason', 'ip_swap_limit');
      end if;
      delete from public.gateway_client_ips x where x.client_id = p_client and x.ip = v_old.ip;
      insert into public.gateway_ip_swaps (client_id, from_ip, to_ip, same_device, device_label) values (p_client, v_old.ip, v_ip, v_same, v_label);
    end if;

    insert into public.gateway_client_ips as x (client_id, ip, requests, accepted, device, device_label)
      values (p_client, v_ip, 1, true, v_device, v_label)
      on conflict (client_id, ip) do update set
        last_seen = now(), requests = x.requests + 1, accepted = true,
        device = coalesce(excluded.device, x.device), device_label = coalesce(excluded.device_label, x.device_label);
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

revoke all on function public.gateway_gate(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.gateway_gate(uuid, text, uuid, text, text) to service_role;

commit;

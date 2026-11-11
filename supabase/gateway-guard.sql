-- Proteção contra sobrecarga e controle de IP do gateway (aba Roteador do /admin).
-- Sem limite diário: só chamadas por minuto e respostas simultâneas por chave. Acima disso o
-- cliente recebe 429 com Retry-After e a ferramenta tenta de novo sozinha (fica mais lento).
-- Aditivo: não altera nenhuma tabela existente. Execute uma vez no SQL Editor do Supabase.
begin;

-- Padrões que valem para todas as chaves (uma linha só). null = sem limite.
create table if not exists public.gateway_settings (
  id boolean primary key default true check (id),
  rpm integer check (rpm is null or rpm between 1 and 100000),
  concurrency integer check (concurrency is null or concurrency between 1 and 1000),
  updated_at timestamptz not null default now()
);
insert into public.gateway_settings (id, rpm, concurrency) values (true, 60, 4) on conflict (id) do nothing;

-- Limite próprio de uma chave (sobrepõe o padrão). null = usa o padrão.
create table if not exists public.gateway_controls (
  client_id uuid primary key references public.gateway_clients(id) on delete cascade,
  rpm integer check (rpm is null or rpm between 1 and 100000),
  concurrency integer check (concurrency is null or concurrency between 1 and 1000),
  updated_at timestamptz not null default now()
);

-- IPs ou faixas bloqueados em todas as chaves.
create table if not exists public.gateway_ip_blocks (
  network cidr primary key,
  reason text check (reason is null or length(reason) <= 200),
  created_by text,
  created_at timestamptz not null default now()
);

-- IPs vistos em cada chave, com bloqueio por chave.
create table if not exists public.gateway_client_ips (
  client_id uuid not null references public.gateway_clients(id) on delete cascade,
  ip inet not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  requests bigint not null default 0,
  blocked_at timestamptz,
  primary key (client_id, ip)
);
create index if not exists gateway_client_ips_recent_idx on public.gateway_client_ips (client_id, last_seen desc);

-- Contador por minuto e respostas em andamento (expiram sozinhas se a função cair).
create table if not exists public.gateway_rate (
  client_id uuid not null,
  bucket timestamptz not null,
  hits integer not null default 0,
  primary key (client_id, bucket)
);
create table if not exists public.gateway_inflight (
  id uuid primary key,
  client_id uuid not null,
  expires_at timestamptz not null
);
create index if not exists gateway_inflight_client_idx on public.gateway_inflight (client_id, expires_at);

alter table public.gateway_settings enable row level security;
alter table public.gateway_controls enable row level security;
alter table public.gateway_ip_blocks enable row level security;
alter table public.gateway_client_ips enable row level security;
alter table public.gateway_rate enable row level security;
alter table public.gateway_inflight enable row level security;
revoke all on public.gateway_settings, public.gateway_controls, public.gateway_ip_blocks, public.gateway_client_ips, public.gateway_rate, public.gateway_inflight from public, anon, authenticated;
grant select, insert, update, delete on public.gateway_settings, public.gateway_controls, public.gateway_ip_blocks, public.gateway_client_ips, public.gateway_rate, public.gateway_inflight to service_role;

-- Uma checagem por chamada: IP bloqueado, respostas simultâneas e chamadas por minuto.
-- Devolve {ok, reason, retry_after, leased}. leased = a chamada ocupa uma vaga até gateway_release.
create or replace function public.gateway_gate(p_client uuid, p_ip text, p_request uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_ip inet;
  v_rpm integer;
  v_conc integer;
  v_hits integer;
  v_busy integer;
  v_blocked timestamptz;
begin
  if p_client is null then return jsonb_build_object('ok', true, 'leased', false); end if;
  -- Uma chave por vez: evita que duas chamadas simultâneas passem juntas do limite.
  perform pg_advisory_xact_lock(hashtextextended(p_client::text, 0));

  begin
    v_ip := nullif(trim(coalesce(p_ip, '')), '')::inet;
  exception when others then
    v_ip := null;
  end;

  if v_ip is not null then
    if exists (select 1 from public.gateway_ip_blocks b where v_ip <<= b.network) then
      return jsonb_build_object('ok', false, 'reason', 'ip_blocked');
    end if;
    insert into public.gateway_client_ips as c (client_id, ip, requests) values (p_client, v_ip, 1)
      on conflict (client_id, ip) do update set last_seen = now(), requests = c.requests + 1
      returning c.blocked_at into v_blocked;
    if v_blocked is not null then
      return jsonb_build_object('ok', false, 'reason', 'ip_blocked');
    end if;
  end if;

  select coalesce(c.rpm, s.rpm), coalesce(c.concurrency, s.concurrency) into v_rpm, v_conc
    from (select 1) one
    left join public.gateway_settings s on s.id
    left join public.gateway_controls c on c.client_id = p_client;

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

-- Libera a vaga quando a resposta termina.
create or replace function public.gateway_release(p_request uuid)
returns void language sql security invoker set search_path = '' as $$
  delete from public.gateway_inflight where id = p_request;
$$;

revoke all on function public.gateway_gate(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.gateway_release(uuid) from public, anon, authenticated;
grant execute on function public.gateway_gate(uuid, text, uuid) to service_role;
grant execute on function public.gateway_release(uuid) to service_role;

commit;

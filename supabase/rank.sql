-- Rank do mês (aba "Rank do mês" do painel e aba "Rank" do admin):
--  * Todo mês um tema (rank_challenges). Assinantes enviam um projeto por mês (rank_entries) até `submit_until`
--    e votam no projeto de outra pessoa (rank_votes, um voto por mês, dá para trocar) até `closes_at`.
--  * Quem participa: plano do site ativo ou chave paga do Roteador ligada à conta (venda pelo WhatsApp).
--    Chave de poucas horas é teste grátis e não conta (mesma regra de server/auto-key.ts).
--  * O admin confirma o campeão depois que a votação fecha; os dias do prêmio entram na hora, como o bônus
--    dos afiliados (public.affiliate_extend, de supabase/affiliates-v2.sql): pagamento-bônus "rank-<tema>" de R$ 0
--    na assinatura e a mesma validade a mais nas chaves do Roteador da conta.
--  * Capas no Storage, bucket público "rank": só o servidor grava (chave de serviço), qualquer um vê.
-- Aditivo. Rode depois de supabase/affiliates-v2.sql. Execute no SQL Editor.
begin;

create table if not exists public.rank_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 80),
  description text not null default '' check (length(description) <= 2000),
  prize_days integer not null default 30 check (prize_days between 0 and 365),
  prize_text text not null default '' check (length(prize_text) <= 200),
  starts_at timestamptz not null unique,
  submit_until timestamptz not null,
  closes_at timestamptz not null,
  winner_entry_id uuid,
  winner_at timestamptz,
  winner_by text,
  winner_subscription_id uuid,
  winner_keys integer,
  created_at timestamptz not null default now(),
  check (starts_at < submit_until and submit_until <= closes_at)
);

create table if not exists public.rank_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.rank_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author text not null check (length(trim(author)) between 1 and 40),
  title text not null check (length(trim(title)) between 3 and 80),
  description text not null check (length(trim(description)) between 10 and 1000),
  link text not null check (link ~ '^https://[^[:space:]]+$' and length(link) <= 300),
  cover_path text check (cover_path is null or (length(cover_path) <= 120 and cover_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{6,40}\.(webp|png|jpg)$')),
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);
create index if not exists rank_entries_challenge on public.rank_entries (challenge_id);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rank_challenges_winner_fk') then
    alter table public.rank_challenges add constraint rank_challenges_winner_fk foreign key (winner_entry_id) references public.rank_entries(id);
  end if;
end $$;

create table if not exists public.rank_votes (
  challenge_id uuid not null references public.rank_challenges(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null references public.rank_entries(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (challenge_id, voter_id)
);
create index if not exists rank_votes_entry on public.rank_votes (entry_id);

-- Votos somados por projeto (a API do banco devolve no máximo 1000 linhas: contar voto por voto não escala).
create or replace view public.rank_scores with (security_invoker = true) as
  select v.challenge_id, v.entry_id, count(*)::integer as votes from public.rank_votes v group by v.challenge_id, v.entry_id;

alter table public.rank_challenges enable row level security;
alter table public.rank_entries enable row level security;
alter table public.rank_votes enable row level security;
revoke all on public.rank_challenges, public.rank_entries, public.rank_votes from public, anon, authenticated;
grant select, insert, update, delete on public.rank_challenges, public.rank_entries, public.rank_votes to service_role;
revoke all on public.rank_scores from public, anon, authenticated;
grant select on public.rank_scores to service_role;

-- Pode enviar e votar: plano do site ativo, ou chave paga do Roteador ligada à conta e ainda válida.
create or replace function public.rank_eligible(p_user uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.billing_subscription_state s where s.user_id = p_user and s.entitled and s.paid_until > now()
  ) or exists (
    select 1 from public.router_keys k join public.gateway_clients c on c.id = k.gateway_client_id
    where c.user_id = p_user and k.revoked_at is null and k.expires_at > now() and k.expires_at - k.created_at >= interval '23 hours'
  );
$$;

-- Envia ou atualiza o projeto do mês (um por pessoa). Projeto removido pela moderação não volta sozinho.
create or replace function public.rank_submit(p_user uuid, p_challenge uuid, p_author text, p_title text, p_description text, p_link text, p_cover text)
returns public.rank_entries language plpgsql security invoker set search_path = '' as $$
declare ch public.rank_challenges; item public.rank_entries;
begin
  select * into ch from public.rank_challenges where id = p_challenge;
  if not found then raise exception 'rank_missing'; end if;
  if now() < ch.starts_at or now() >= ch.submit_until then raise exception 'rank_closed'; end if;
  if not public.rank_eligible(p_user) then raise exception 'rank_not_eligible'; end if;
  if exists (select 1 from public.rank_entries e where e.challenge_id = p_challenge and e.user_id = p_user and e.hidden_at is not null) then
    raise exception 'rank_hidden';
  end if;
  insert into public.rank_entries (challenge_id, user_id, author, title, description, link, cover_path)
  values (p_challenge, p_user, p_author, p_title, p_description, p_link, p_cover)
  on conflict (challenge_id, user_id) do update set author = excluded.author, title = excluded.title, description = excluded.description,
    link = excluded.link, cover_path = excluded.cover_path, updated_at = now()
  returning * into item;
  return item;
end;
$$;

-- Vota (ou troca o voto) num projeto do mês. Votar de novo no mesmo projeto tira o voto. Devolve o projeto votado agora.
create or replace function public.rank_vote(p_user uuid, p_entry uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare e public.rank_entries; ch public.rank_challenges; current_entry uuid;
begin
  select * into e from public.rank_entries where id = p_entry and hidden_at is null;
  if not found then raise exception 'rank_entry_missing'; end if;
  select * into ch from public.rank_challenges where id = e.challenge_id;
  if now() < ch.starts_at or now() >= ch.closes_at then raise exception 'rank_voting_closed'; end if;
  if e.user_id = p_user then raise exception 'rank_own_entry'; end if;
  if not public.rank_eligible(p_user) then raise exception 'rank_not_eligible'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text || ch.id::text, 66));
  select v.entry_id into current_entry from public.rank_votes v where v.challenge_id = ch.id and v.voter_id = p_user;
  if current_entry = p_entry then
    delete from public.rank_votes where challenge_id = ch.id and voter_id = p_user;
    return null;
  end if;
  insert into public.rank_votes (challenge_id, voter_id, entry_id) values (ch.id, p_user, p_entry)
  on conflict (challenge_id, voter_id) do update set entry_id = excluded.entry_id, created_at = now();
  return p_entry;
end;
$$;

-- Confirma o campeão (só depois que a votação fecha, uma vez por tema) e já dá os dias do prêmio.
create or replace function public.rank_confirm_winner(p_challenge uuid, p_entry uuid, p_by text)
returns public.rank_challenges language plpgsql security invoker set search_path = '' as $$
declare ch public.rank_challenges; e public.rank_entries; v_subscription uuid; v_keys integer := 0;
begin
  select * into ch from public.rank_challenges where id = p_challenge for update;
  if not found then raise exception 'rank_missing'; end if;
  if ch.winner_entry_id is not null then raise exception 'rank_already_confirmed'; end if;
  if now() < ch.closes_at then raise exception 'rank_still_open'; end if;
  select * into e from public.rank_entries where id = p_entry and challenge_id = p_challenge and hidden_at is null;
  if not found then raise exception 'rank_entry_missing'; end if;
  if ch.prize_days > 0 then
    select x.subscription_id, x.keys into v_subscription, v_keys from public.affiliate_extend(e.user_id, ch.prize_days, 'rank-' || ch.id::text) x;
  end if;
  update public.rank_challenges set winner_entry_id = e.id, winner_at = now(), winner_by = p_by,
    winner_subscription_id = v_subscription, winner_keys = coalesce(v_keys, 0)
  where id = ch.id returning * into ch;
  return ch;
end;
$$;

revoke all on function public.rank_eligible(uuid), public.rank_submit(uuid, uuid, text, text, text, text, text),
  public.rank_vote(uuid, uuid), public.rank_confirm_winner(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.rank_eligible(uuid), public.rank_submit(uuid, uuid, text, text, text, text, text),
  public.rank_vote(uuid, uuid), public.rank_confirm_winner(uuid, uuid, text) to service_role;

-- Capas dos projetos: bucket público, até 1 MB, só imagem.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rank', 'rank', true, 1048576, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

commit;

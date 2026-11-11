-- Controle dos e-mails enviados (boas-vindas, credencial entregue, plano vencendo, plano vencido).
-- Cada aviso é único por (kind, ref): o mesmo e-mail nunca sai duas vezes.
-- Aditivo: não altera cobrança, gateway nem entregas. Execute no SQL Editor.
create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('welcome', 'delivery', 'expiring', 'expired')),
  ref text not null check (length(ref) between 1 and 200),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null check (length(email) between 3 and 320),
  provider_id text check (provider_id is null or length(provider_id) <= 200),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (kind, ref)
);

create index if not exists email_notifications_user_idx on public.email_notifications (user_id, created_at desc);

alter table public.email_notifications enable row level security;
revoke all on public.email_notifications from public, anon, authenticated;
grant select, insert, update, delete on public.email_notifications to service_role;

begin;
create table if not exists public.billing_webhook_events (
  fingerprint text primary key check (fingerprint ~ '^[0-9a-f]{64}$'),
  topic text not null,
  resource_id text not null,
  snapshot jsonb not null,
  state text not null default 'awaiting_account_link',
  received_at timestamptz not null default now()
);
alter table public.billing_webhook_events enable row level security;
revoke all on public.billing_webhook_events from public, anon, authenticated;
grant select,insert,update on public.billing_webhook_events to service_role;
create index if not exists billing_events_pending_idx on public.billing_webhook_events(state,received_at);
commit;

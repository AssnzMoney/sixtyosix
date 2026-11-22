-- Reserva automática entre provedores (Roteador): cada modelo pode apontar para outro modelo ativo,
-- de outro provedor, que responde quando o provedor dele cai, recusa todas as keys ou fica no limite.
-- Aditivo: só acrescenta uma coluna. Sem ela o gateway funciona como antes (sem reserva).
alter table public.router_models add column if not exists fallback_alias text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'router_models_fallback_fk') then
    alter table public.router_models add constraint router_models_fallback_fk
      foreign key (fallback_alias) references public.router_models(alias) on update cascade on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'router_models_fallback_self') then
    alter table public.router_models add constraint router_models_fallback_self check (fallback_alias is null or fallback_alias <> alias);
  end if;
end $$;

-- Apaga todo o consumo registrado pela API antiga (rotação de modelos chineses).
-- ATENÇÃO: apagar logs não tem volta. Rode uma vez no SQL Editor do Supabase.
--
-- A nova API (Roteador) só passou a registrar consumo em 12/11/2026 às 02:25 de Brasília
-- (05:25 UTC). Tudo antes disso veio da API antiga e é apagado.
-- Não mexe em clientes, chaves, assinaturas nem pagamentos: só nos registros de consumo.
--
-- Também deixa de exigir a coluna upstream_tier, que só a API antiga preenchia.
begin;

alter table public.gateway_usage alter column upstream_tier drop not null;

with apagados as (
  delete from public.gateway_usage
  where created_at < '2026-11-12 05:25:00+00'
  returning 1
)
select
  (select count(*) from apagados) as logs_da_api_antiga_apagados,
  (select count(*) from public.gateway_usage) - (select count(*) from apagados) as logs_da_nova_api_mantidos;

commit;

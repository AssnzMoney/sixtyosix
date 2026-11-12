-- Apaga os testes grátis antigos (o teste automático do site, chaves sk-sx-).
-- ATENÇÃO: não tem volta. Rode uma vez no SQL Editor do Supabase.
--
-- O teste agora é feito à mão no Roteador (Nova chave → "3 horas (teste)"), então
-- esses registros não servem mais. Eles também somem do painel dos clientes.
-- O cadastro interno de cada chave de teste fica, mas desligado de vez.
-- Não mexe em clientes, assinaturas, pagamentos nem nas chaves do Roteador.
begin;

update public.gateway_clients c
  set enabled = false, revoked_at = coalesce(c.revoked_at, now())
  where c.id in (select gateway_client_id from public.gateway_trials);

with apagados as (
  delete from public.gateway_trials
  returning 1
)
select (select count(*) from apagados) as testes_antigos_apagados;

commit;

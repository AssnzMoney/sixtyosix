-- Limpeza: apaga os logs de consumo antigos e encerra os testes grátis antigos.
-- ATENÇÃO: apagar logs não tem volta. Rode uma vez no SQL Editor do Supabase.
--
-- NÃO MEXE em quem já pagou: assinaturas, pagamentos, chaves e o consumo dessas pessoas ficam.
-- Também ficam: o consumo das chaves do Roteador (sk-rt-, vendas pelo WhatsApp) e das chaves do site (sk-sp-).
-- Os testes continuam cadastrados (uma linha por conta): só são encerrados, então a pessoa
-- que já fez um teste não ganha outro.
begin;

-- Quem já pagou alguma vez (tem período pago aplicado).
create temporary table limpeza_pagantes on commit drop as
  select distinct user_id from public.billing_subscriptions where paid_until is not null;

-- Chaves cujo consumo fica: Roteador, chaves do site, chaves e testes de quem já pagou.
create temporary table limpeza_chaves_mantidas on commit drop as
  select gateway_client_id as id from public.router_keys
  union select gateway_client_id from public.billing_key_access where gateway_client_id is not null
  union select c.id from public.gateway_clients c join limpeza_pagantes p on p.user_id = c.user_id
  union select t.gateway_client_id from public.gateway_trials t join limpeza_pagantes p on p.user_id = t.user_id;

with apagados as (
  delete from public.gateway_usage u
  where not exists (select 1 from limpeza_chaves_mantidas k where k.id = u.client_id)
  returning 1
), testes_encerrados as (
  update public.gateway_trials t set revoked_at = coalesce(t.revoked_at, now())
  where t.revoked_at is null
    and not exists (select 1 from limpeza_pagantes p where p.user_id = t.user_id)
  returning t.gateway_client_id
), chaves_de_teste_desligadas as (
  update public.gateway_clients c set enabled = false, revoked_at = coalesce(c.revoked_at, now())
  where c.id in (select gateway_client_id from testes_encerrados)
  returning 1
)
select
  (select count(*) from apagados) as logs_apagados,
  (select count(*) from testes_encerrados) as testes_encerrados,
  (select count(*) from chaves_de_teste_desligadas) as chaves_de_teste_desligadas,
  (select count(*) from public.gateway_usage) - (select count(*) from apagados) as logs_mantidos,
  (select count(*) from public.gateway_trials) as testes_cadastrados;

commit;

# Dashboard SixtySix

A conta usa login Supabase e os registros de gateway_clients/gateway_usage através de uma API privada no servidor do site. Consulte ACCOUNT-INTEGRATION.md para ativação, isolamento e validação.

A demonstração visual continua disponível apenas no localhost em /dashboard?demo=1. Em produção, /dashboard exige uma sessão real e não usa consumo gerado.

Inclui temas claro/escuro, logo SX, navegação recolhível e rolável, números animados, filtros de período/modelo, CSV, consumo por perfil e histórico. As chaves individuais podem ser vinculadas, emitidas e revogadas na conta autorizada. O segredo de uma chave nova aparece uma vez, apenas em memória.

A economia usa os tokens filtrados e tarifas de referência editáveis, sempre como estimativa. Clientes de teste não têm cobrança. Mercado Pago ainda não foi conectado.

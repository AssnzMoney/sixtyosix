# SixtySix — operação e pagamentos

Atualizado em 9 de novembro de 2026. Registro das decisões e implementação; não é transcrição do chat. Credenciais excluídas.

## Conta e catálogo

Site: https://www.sixtysix.online. Painel /dashboard; entrada /login; nome preferido /onboarding. Sessão persistida no navegador e validada no servidor, com e-mail confirmado. Não há bloqueio por IP.

- Dev: R$79,99, somente site, Astra 6 e GLM 5.
- Dev + API: R$94,99, site e chave externa, Astra 6 e GLM 5.
- Pro: R$119,99, site e chave externa, Fable 5.1, Astra 6 e GLM 5.
- IDs: gpt-6-astra, glm-5, claude-fable-5-1. Permissões aplicadas pelo servidor.

## Compra automática

Botões da LP abrem /comprar/dev, /comprar/devApi ou /comprar/pro. Antes do checkout, cliente entra/cria conta e conclui o nome preferido. O servidor cria pedido com UUID, proprietário verificado, preço e modelos fixos. O e-mail pagador pode ser diferente do login; nunca é usado para adivinhar o proprietário.

Cartão: POST /preapproval cria assinatura pendente sem plano associado, frequência mensal e external_reference igual ao UUID do pedido. Autorização sem pagamento aprovado não concede acesso. A cobrança segue mês de calendário, que pode ter 28 a 31 dias.

Pix: POST /checkout/preferences cria checkout com Pix selecionado e cartões excluídos. Não cria débito automático. Cada pagamento aprovado libera 30 dias; renovação antecipada soma ao prazo restante sem trocar a chave. Pagamentos duplicados não somam novamente. A renovação é feita pelo cliente na página /assinatura.

O cliente paga no Mercado Pago. O webhook assinado consulta a API privada e valida recebedor, pedido conhecido, assinatura, moeda BRL, valor, ambiente real e aprovação. A URL de retorno e o corpo livre da notificação não autorizam acesso. A confirmação registra o pagamento e cria o acesso individual em uma transação idempotente. /assinatura entrega a chave aos planos com API, mostra pagamentos, vencimento e cancelamento.

Links genéricos antigos não vinculam compras automaticamente: eventos sem external_reference conhecida permanecem awaiting_account_link. Os botões novos usam checkout personalizado.

## Vencimento e alterações

O gateway verifica um período aprovado atual em cada solicitação. No limite exato do vencimento, novas solicitações são bloqueadas. Solicitações em execução podem terminar. Renovação aprovada mantém a mesma chave. Cancelar assinatura interrompe próximas cobranças, preservando o período pago. Pix não tem renovação automática para cancelar.

Estorno parcial/integral e contestação retiram a autorização do pagamento correspondente. Eventos atrasados não ressuscitam pagamentos estornados. Outro período válido aprovado continua contando. Revogar chave não cancela cobrança; uma chave paga revogada pode ser substituída enquanto o plano com API estiver ativo.

O botão Atualizar pagamento reconcilia assinatura/faturas ou pagamentos Pix com a API, com intervalo mínimo de 45 segundos. Webhooks são o mecanismo automático principal, com erro em falha de processamento para o provedor repetir a entrega.

## Acesso, privacidade e infraestrutura

/api/billing oferece checkout, status, sync, cancel, key, restore e chat. Cada operação valida sessão e propriedade. Chat do site valida plano/modelo e usa credencial privada; Dev não recebe chave externa. Não se usam flags editáveis do navegador como autorização.

Tabelas billing_subscriptions, billing_payments, billing_access e billing_webhook_events têm RLS e acesso somente service_role. Views usam security_invoker. RPCs de cobrança são exclusivos do servidor.

Chaves pagas sk-sp- são individuais, com hash para autenticação e cópia cifrada AES-256-GCM para entrega na sessão autenticada. O token privado sk-flg- de conexão fica cifrado no servidor e nunca é entregue. O gateway_client privado tem user_id legado nulo, impedindo emissão de chaves antigas ilimitadas. Cifragem deriva da credencial privada Supabase e usa AAD por usuário/assinatura/finalidade. Antes de rotacionar essa credencial, migrar a cifragem existente.

Gateway interno: 66cloud.vercel.app. /v1, /glm/v1 e /api/codex no domínio novo validam chaves gerenciadas por api/access.ts e preservam streaming. As chaves legadas mantêm seu funcionamento. Não depende do computador pessoal ligado.

Claude: https://www.sixtysix.online. Clientes OpenAI compatíveis: https://www.sixtysix.online/v1.

## Teste grátis

/teste-gratis ativa sete dias uma única vez por conta, sem cartão. Repetir recupera a mesma chave sk-sx- e o mesmo vencimento; expiração/revogação não reiniciam o prazo. gateway_trials e RPCs são privados. A vigência é aplicada em cada solicitação. Testes e chaves existentes foram preservados.

## Configuração e verificação

Webhook: https://www.sixtysix.online/api/mercadopago/webhook. Tópicos: payment, subscription_preapproval, subscription_authorized_payment e subscription_preapproval_plan.

Segredos privados na Vercel: MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL. Nunca usar VITE_ para segredos. Chave pública Supabase: VITE_SUPABASE_ANON_KEY ou SUPABASE_PUBLISHABLE_KEY.

Schema: supabase/billing-lifecycle.sql. Verificação transacional: supabase/billing-checks.rollback.sql. Testes: server/billing.test.ts, server/access.test.ts, server/account.test.ts e server/mercadopago.test.ts. Verificam aprovação, duplicação, cancelamento, estorno, evento atrasado, renovação, propriedade, recuperação de chave, expiração e privacidade. Os dados QA são revertidos por rollback.

Nenhuma cobrança real foi feita nesta validação. A primeira compra real deve ser acompanhada para confirmar o evento real de pagamento e a entrega. Testes controlados não equivalem a uma compra efetivamente paga.

## Conferência após publicação

Commit funcional: 1d831e3, publicado na Vercel em produção. Checkout Pix real abriu com Pix disponível e valor de R$94,99; checkout de assinatura abriu com cartão de crédito disponível. Nenhuma compra/cobrança foi concluída. Pedido pendente apareceu corretamente em /assinatura e não gerou chave. API de status sem sessão devolve 401; tabelas/views de cobrança são negadas à chave pública (401) e acessíveis ao servidor (200). A chave de teste grátis existente continuou acessando /v1/models (200). A documentação de operação fica excluída do pacote público pela .vercelignore.

Cancelamento real do pedido pendente criado exclusivamente para QA: autorizado pelo proprietário e confirmado em /assinatura como cancelado. Não houve pagamento nem cobrança. Não foi cancelada assinatura de cliente.

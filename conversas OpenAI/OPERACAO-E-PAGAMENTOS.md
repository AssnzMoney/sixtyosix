# SixtySix — registro da operação e da próxima integração

Atualizado em 9 de novembro de 2026. Resumo técnico das decisões desta conversa. Não é uma transcrição integral. Credenciais, códigos de login, dados de clientes e chaves privadas foram excluídos.

## O que está publicado

- Site e painel: https://www.sixtysix.online.
- Painel privado: /dashboard. Cadastro: /criar-conta. Entrada: /login.
- Primeiro acesso: /onboarding pede o nome escolhido pelo cliente e salva na conta.
- Sessão persistida no navegador; sair da conta ou limpar os dados exige entrar novamente.
- Autenticação por Supabase, com Google, Discord e e-mail por link/código.
- A API de conta valida a sessão no servidor e exige e-mail confirmado. Não existe bloqueio por IP: rede móvel, Wi-Fi e VPN podem mudar o endereço.
- /api/account/summary consulta apenas as chaves e o consumo pertencentes ao usuário autenticado.
- /api/account/claim associa uma chave existente mediante prova da chave completa. Uma chave vinculada a outro usuário não pode ser transferida assim.
- /api/account/keys permite criar uma chave individual para quem já tem acesso de teste ativo. Ainda não libera o primeiro acesso só por cadastrar uma conta.
- /api/account/revoke revoga uma chave própria, preservando o histórico.
- As chaves usam prefixo sk-flg-. O banco guarda o hash SHA-256, não o segredo completo. A chave nova aparece uma vez no painel.
- O servidor do gateway continua no projeto existente 66cloud.vercel.app. O domínio novo encaminha /v1, /glm e as rotas existentes. Não é um serviço dependente do computador pessoal ligado.
- Claude usa URL base https://www.sixtysix.online. Clientes OpenAI compatíveis usam https://www.sixtysix.online/v1. Os tutoriais existentes apresentam os identificadores claude-fable-5-1, gpt-6-astra e a rota GLM configurada.

## Navegação dos planos

O botão do painel usa /planos, que abre a seção /#planos diretamente. A rolagem acompanha a âncora também ao navegar entre telas. /dashboard não depende de localhost; apenas a demonstração fictícia está restrita ao ambiente local.

## Automação de pagamento solicitada — pendente de conexão

Objetivo: conta confirmada → escolha de plano → pagamento → confirmação recebida pelo servidor → acesso individual no painel → tutorial. Nenhuma entrega manual por WhatsApp.

Mercado Pago ainda não conectado. Não há checkout, webhook de pagamento ou assinatura recorrente operando neste repositório. Não anunciar a entrega automática como concluída antes do teste integrado.

### Dados necessários do proprietário

1. Links de pagamento e correspondência de cada plano/variante.
2. Credencial de servidor da aplicação Mercado Pago e segredo de assinatura das notificações, configurados como variáveis privadas na Vercel. Nunca usar prefixo VITE_ para segredos.
3. Confirmar catálogo, preços, acesso à API e modelos autorizados de cada variante. A LP atual tem Dev por R$79,99, Dev com API por R$94,99 e Pro por R$119; mensagens antigas citaram outros valores. Não assumir que um deles é definitivo.
4. Confirmar se a cobrança será recorrente ou pagamento avulso com vigência. Link de pagamento avulso não cria assinatura recorrente automaticamente.
5. Definir vencimento, cancelamento, reembolso, contestação e política do teste grátis.

### Contrato da implementação

1. Cliente precisa estar autenticado e com e-mail confirmado antes do checkout.
2. Servidor cria pedido com identificador aleatório, user_id verificado, plano, variante, preço, moeda e vigência. Não aceitar preço ou proprietário enviados livremente pelo navegador.
3. Checkout deve carregar uma external_reference que identifique esse pedido. Links estáticos sem vínculo confiável com o pedido não bastam para atribuir uma compra automaticamente. O e-mail do pagador pode ser diferente do e-mail da conta.
4. Ao receber uma notificação, validar assinatura x-signature, x-request-id e identificador do recurso conforme documentação oficial. Consultar o pagamento pela API do Mercado Pago com credencial privada. Não liberar acesso com base apenas no JSON enviado ou na URL de retorno.
5. Validar conta recebedora, modo produção/teste, status aprovado, moeda, valor, pedido conhecido e produto comprado. Pagamento pendente, recusado ou retorno forjado não liberam acesso.
6. Gravar o evento e a concessão em transação idempotente, com unicidade por pagamento. Notificações repetidas e simultâneas não podem duplicar chaves nem estender a vigência indevidamente.
7. Criar o primeiro acesso pertencente ao user_id do pedido. Para disponibilizar o segredo com segurança, escolher entrega autenticada de uso único ou armazenamento cifrado com chave exclusiva do servidor; hashes existentes não são recuperáveis. Não persistir o segredo em logs, Git, URLs ou localStorage.
8. Painel consulta o estado do pedido e exibe a chave individual e os tutoriais ao receber a concessão. O cliente não precisa informar pagamento ao administrador.
9. O gateway precisa aplicar vigência, permissões de modelo e acesso à API a cada requisição. O schema atual enabled/user_id não representa sozinho todas as regras comerciais. Alterações devem preservar os testes já existentes e não conceder API a uma variante vendida somente para uso no site.
10. Tratar renovação, expiração, cancelamento, reembolso e contestação sem alterar chaves de outros clientes. Incluir reconciliação para notificações perdidas.
11. Testar pagamento aprovado, pendente, recusado, assinatura inválida, evento repetido, valor incorreto, conta de outro cliente, renovação e estorno antes de ativar venda automática.

### Não usar como autorização

- Flags de plano em localStorage ou user_metadata editáveis pelo cliente.
- Parâmetros status=approved na volta do checkout.
- Nome/e-mail do pagador sem pedido vinculado à conta.
- Somente o fato de o cliente conseguir criar uma conta.

## Fontes de configuração

- Credenciais do Supabase: variáveis privadas do projeto na Vercel; não incluídas neste documento.
- Chaves individuais: /dashboard, seção Chaves de API.
- Migração atual do portal: supabase/account-portal.sql.
- Implementação atual: api/account.ts; src/lib/account.ts.
- Documentação Mercado Pago: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
- Preferências de checkout: https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/create-preference/post
- Autenticação e-mail: https://supabase.com/docs/guides/auth/auth-email-passwordless

## Limites do registro

Este documento resume o histórico disponível nesta conversa e o código conferido. Não confirma conversas fechadas, credenciais antigas, pagamentos ou funcionalidades ainda não verificadas. Atualizar o estado aqui conforme cada integração for realmente implantada.

# Roteador — SixtySix

Aba **Roteador** do `/admin`, no estilo do 9router: você cadastra provedores (URL + key), escolhe os modelos que vende e cria chaves com validade. Os clientes usam sempre o endereço do SixtySix e nunca veem a key do provedor.

## Como funciona

- **Provedores** (`router_providers`): nome, URL base e a key mestra, guardada criptografada (AES-GCM com a `SUPABASE_SERVICE_ROLE_KEY`). Ela nunca volta para o navegador; o painel mostra só o final (`…2959`).
- **Modelos** (`router_models`): o nome que o cliente usa (ex.: `claude-opus-5-5`) aponta para o modelo no provedor (ex.: `anthropic/claude-opus-5-5`). "Pro e teste" coloca o modelo no plano Pro e no teste grátis do site, inclusive para assinaturas antigas.
- **Chaves manuais** `sk-rt-` (`router_keys`): para quem compra pelo WhatsApp. Nome, contato, validade e modelos (todos ou alguns). Vencida ou bloqueada, é recusada na hora. "+30 dias" soma a partir do vencimento (ou de hoje, se já venceu) e reativa. A chave pode ser copiada de novo pelo painel.
- **Chaves do site**: quem paga no Mercado Pago recebe `sk-sp-`; quem pede o teste recebe `sk-sx-` (7 dias). As duas também usam os modelos do Roteador marcados para o Pro, e são cortadas no vencimento como já eram.
- **Consumo**: toda chamada pelo Roteador grava cliente, modelo, status e tokens em `gateway_usage`. Aparece na aba **Consumo e falhas** (as chaves manuais pelo nome do cliente), no consumo de cada chave na aba Roteador e no painel do cliente.
- **Erros do provedor**: se a key mestra for recusada (sem saldo, bloqueada) ou o provedor cair, o cliente vê "Este modelo está temporariamente indisponível"; você vê o status real (402, 5xx) em Consumo e falhas e o detalhe no log da função `api/access` na Vercel.
- **Só o Roteador**: o gateway antigo (66cloud) foi removido. Só funciona o modelo que está ativo no Roteador. Os planos guardam os nomes `claude-fable-5-1`, `argon-4`, `gpt-6-astra` e `glm-5` (o Dev usa `gpt-6-astra` e `glm-5`): cadastre esses apelidos no Roteador, apontando para modelos do provedor, para que planos antigos e o chat do site continuem funcionando. Chaves antigas `sk-flg-` são recusadas.
- Mudanças no painel valem para novas chamadas em até 30 segundos.

## Proteção contra sobrecarga e IPs

Não existe limite diário: o cliente usa quanto quiser. A proteção só impede que uma chave dispare rápido demais.

- **Chamadas por minuto** e **respostas ao mesmo tempo**, por chave. Padrão: 60 por minuto e 4 ao mesmo tempo, editáveis na seção "Proteção contra sobrecarga" da aba Roteador (vazio = sem limite).
- Passou do ritmo: o cliente recebe 429 com `Retry-After` ("aguarde um instante"). O Claude Code e o Codex tentam de novo sozinhos, então fica mais lento, sem bloquear.
- **Limite próprio** de uma chave: botão **IPs** na chave. Vazio = usa o padrão.
- **IPs**: o botão IPs mostra cada IP que usou a chave (primeiro e último uso, número de chamadas). Dá para bloquear o IP só naquela chave ou em todas. A lista "IPs bloqueados em todas as chaves" aceita IP ou faixa (`177.10.20.0/24`).
- Vale para chaves manuais `sk-rt-`, do plano `sk-sp-`, do teste `sk-sx-` e para o chat do site.
- Uma checagem por chamada (`gateway_gate` no Supabase). Se o banco falhar ou a migração não estiver aplicada, a chamada segue normalmente.

## Endereço dos clientes

- Claude Code: `https://www.sixtysix.online`
- Codex, Cline, OpenCode e apps compatíveis com OpenAI: `https://www.sixtysix.online/v1`
- Endereços antigos continuam aceitos: `/glm/v1` e `/api/codex` viram `/v1` no provedor. `/api/health` responde se há modelos ativos no Roteador.
- A chave vai em `x-api-key` ou `Authorization: Bearer`. Formatos aceitos: Anthropic (`/v1/messages`), OpenAI (`/v1/chat/completions` e `/v1/responses`). `GET /v1/models` lista só o que a chave pode usar.

## Ativação

1. **Supabase** — rode `supabase/router.sql` e depois `supabase/gateway-guard.sql` no SQL Editor (uma vez). São aditivos: não mudam nenhuma tabela existente. Sem eles, a aba Roteador pede a migração e a proteção fica desligada.
2. **Publicar o código** (push na `main`).
3. **Vercel** — `SIXTYSIX_AUTO_GATEWAY_KEYS` = `1` para quem paga no site ver a chave no painel na hora (sem WhatsApp). `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já devem estar lá. As variáveis `FORNECEDOR_URL`/`FORNECEDOR_KEY` não são usadas.
4. **Admin** → `www.sixtysix.online/admin` → aba **Roteador**:
   - **Adicionar provedor**: nome, URL base (ex.: `https://api.delvertokens.store/v1`) e a API key.
   - Na tela de modelos, marque o que vai vender, ajuste os nomes e salve.
   - **Nova chave** para cada venda pelo WhatsApp: o painel monta a mensagem pronta com chave, endereços, modelos e validade.
5. **Teste**: crie uma chave de 1 dia para você, faça uma chamada com `claude-haiku-4-5` e confira em Consumo e falhas. Se a chamada funcionar e não aparecer lá, procure "gateway_usage recusou o registro" no log da função `api/access` na Vercel.

Trocar a `SUPABASE_SERVICE_ROLE_KEY` invalida as keys de provedor guardadas (e as chaves manuais para copiar de novo): cadastre a key do provedor de novo depois de trocar.

## Ainda não coberto

- As páginas de venda e de planos não citam os modelos novos.
- Fallback automático entre provedores (se um cair, tentar outro).
- Limite próprio e lista de IPs para chaves do plano e do teste (hoje só pelo padrão e pela lista de IPs bloqueados em todas as chaves).
- O valor pago ao provedor por cliente não é calculado; o consumo é em tokens.

## Verificação

- `npm test` — `server/router.test.ts` (roteador lendo o banco, chave do provedor criptografada, chaves `sk-rt-` válida/vencida/bloqueada/restrita, teste grátis e plano pelo Roteador, lista de modelos, erro do provedor escondido, admin gravando só dados criptografados) e `server/supplier.test.ts` (contagem de tokens nos formatos Anthropic, OpenAI chat e Responses).
- `npx tsc --noEmit` e `npm run build`.

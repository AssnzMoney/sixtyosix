# Publicar o diagnóstico da ponte e fazer o teste único

Teste pessoal, só no seu workspace Lovable. Não ligar a nenhum cliente nem ao fornecedor da Six.

## O que mudou na ponte
Arquivo: `lovable-source/six-test-messages-bridge.server.ts` (substitui o arquivo de mesmo nome no projeto Lovable; as exportações antigas continuam iguais).

Antes, qualquer recusa do gateway da Lovable virava o mesmo 502 genérico e a causa era jogada fora.
Agora o 502 continua, mas a resposta traz:
- a mensagem dizendo o que houve: `o gateway recusou (HTTP 400, invalid_request_error): <motivo do gateway>`;
- os cabeçalhos `X-Six-Bridge-Stage`, `X-Six-Bridge-Upstream-Status`, `X-Six-Bridge-Upstream-Error-Type` e `X-Six-Bridge-Request-Id`.

Proteções: só quem manda a chave da ponte recebe isso; lê no máximo 8 KiB do erro; só repete erro em JSON (HTML e texto não);
corta a mensagem em 300 caracteres e apaga qualquer coisa com cara de chave. O log da Lovable registra só o tipo do erro, nunca a mensagem.

Testado aqui com o gateway simulado: `lovable-source/bridge-real.test.ts` roda o arquivo real (com zod 3 numa pasta temporária).

## Como colocar no projeto Lovable sem crédito de edição
O editor está "Read only" e o chat gasta crédito. O caminho é o GitHub:
1. Abra o projeto `key-presence-beacon` na Lovable, logado na conta dona (workspace AssnZ's Lovable).
2. Procure o botão/ícone do GitHub no topo do editor (ou nas configurações do projeto, em integrações).
   - Se já estiver conectado: anote o nome do repositório e me diga. Eu envio o arquivo para lá e a Lovable sincroniza.
   - Se não estiver: conecte (a Lovable cria o repositório na sua conta). Depois me diga o nome.
3. Depois da sincronização, publique de novo: Publish → Update.

Se a Lovable não deixar conectar o GitHub nem editar no modo Read only, a única saída é 1 prompt pago pedindo para trocar
esse arquivo pelo conteúdo pronto. Isso é decisão sua, e eu não recomendo comprar crédito só para isso.

## Antes do teste
- Em Cloud → Secrets, renove `SIX_TEST_BRIDGE_EXPIRES_AT` para no máximo 1 hora à frente, em UTC
  (exemplo: `2026-11-18T15:30:00.000Z`). A última validade venceu às 09:27 UTC.
- A ponte só aceita 3 chamadas por instância. O teste usa uma.

## O teste (uma chamada)
No PowerShell, nesta pasta do projeto:

    $env:SIX_TEST_BRIDGE_KEY = '<chave da ponte>'
    node --experimental-strip-types integrations/lovable-test/probe-ponte-tool-result.ts

Ele manda o histórico sintético user → tool_use → tool_result e mostra o status, os cabeçalhos de diagnóstico
e a mensagem do gateway. Não repita se der erro: me mande a saída (ela não contém a chave).

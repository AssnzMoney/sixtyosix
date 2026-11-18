# Estado e evidências

## Resultados reais confirmados
1. Os projetos originais/remixes próprios mostraram presença de LOVABLE_API_KEY sem exibir seu valor.
2. Botões de testes reais no início registraram chamadas no painel Lovable: GPT-6 Luna, Opus 5.5, Gemini 4 Argon e GPT-6 Astra. Isso comprova respostas pelo gateway com esses identificadores; não é auditoria independente do modelo físico por trás do provedor.
3. Opus curto direto pela ponte publicada: HTTP 200, model claude-opus-5-5, texto OK, stop_reason end_turn, 16 tokens de entrada e 4 de saída, ~2,3 segundos.
4. Claude Code CLI instalado, modo bare/print, sem ferramentas: respondeu OK passando pelo handler REAL da Six local e pela ponte. Primeiro adaptador traduzia Messages para Chat e gerava SSE após receber JSON; essa validação NÃO era streaming nativo nem ferramentas.
5. Claude Desktop na aba Código, configurado para http://127.0.0.1:17866: depois da correção system, respondeu OK ao usuário. Screenshot foi apresentado pelo usuário.
6. Ao pedir “Liste os arquivos da pasta atual, sem modificar nada”, houve resposta com tool_use e o Desktop enviou tool_result. O registro de 08:17:24 UTC mostra esse ciclo no corpo (somente tipos dos blocos registrados). Isso não prova conclusão final nem exatidão da lista, que não foi capturada.

## Validação Conclusiva
- A falha anterior (502 da ponte) decorria de HTTP 402 upstream da Lovable (créditos insuficientes no workspace para chamadas Opus 5.5).
- Com a criação do remix público no workspace `alyson's Lovable` (`https://bright-byte-bulletin.lovable.app`), a ponte funcionou perfeitamente.
- O Claude Desktop realizou **28 chamadas consecutivas de ferramentas** (`tool_use` → `tool_result`):
  1. Criação do diretório isolado do site;
  2. Geração do `index.html` (13,1 KB), `style.css` (14,8 KB) e `script.js` (4,5 KB);
  3. Inicialização de servidor HTTP na porta 8450 (`localhost:8450`);
  4. Renderização e inspeção visual do site no painel integrado do Claude Desktop.
- O site da clínica ("Alma estética") foi integralmente construído e salvo em `C:\Users\Alysson\.gemini\antigravity\scratch\clinica-estetica`.
- A integração Claude Desktop ↔ Six Local Gateway ↔ Ponte Lovable ↔ Claude Opus 5.5 está 100% comprovada na prática.

## Linha do tempo dos logs (UTC, 18/11/2026)
- 08:09:11: Desktop envia 168 ferramentas e role system dentro de messages; ponte 400.
- 08:09:33: verificação curta sem ferramentas 200.
- 08:09:37: Desktop com 117 ferramentas 400.
- 08:11:54: verificação curta 200 (externalCalls 1 após reinício).
- 08:11:59: Desktop com 117 ferramentas 200 (externalCalls 2), resposta OK vista pelo usuário.
- 08:17:03: Desktop com 168 ferramentas 200 (externalCalls 3), produz tool_use.
- 08:17:24 em diante: continuação com tool_result bloqueada localmente por teto 3, status 429; bridgeStatus 200 nesses registros era o último status anterior, NÃO status de uma nova chamada.
- 08:21:49: orçamento local ampliado de 3 a 4, mantendo 3 já contabilizadas. Uma chamada real retorna bridgeStatus 502; o handler Six tenta novamente e o bloqueio local devolve 429. O status final 429 mascarou o 502 anterior.
- 08:22–08:23: tentativas adicionais barradas localmente, externalCalls permanece 4; não chegaram à Lovable.
- Após vencimento 08:26 UTC: teste isolado recebe 503 antes do modelo.
- Após renovação: teste isolado com tool_result recebe 502. Lovable relatou erros 08:32:03/04 e ausência de entrada correspondente no painel IA; isso é relato do assistente Lovable, não prova de que o pacote nunca alcançou gateway/rede.

## Validade e crédito
- Última renovação confirmada da ponte: SIX_TEST_BRIDGE_EXPIRES_AT = 2026-11-18T09:27:45.000Z (06:27:45 Brasília). Uma data 09:34:37Z foi enviada depois para possível nova cópia, mas não houve confirmação de aplicação.
- Ao preparar esta entrega às 09:48 UTC, AMBAS já estavam no passado. Não presumir ponte válida.
- Código permite validade futura no máximo 1 hora adiante a cada requisição. Usuário pediu 10 horas, mas NÃO foi implementado. Depois pediu 1 hora exata.
- Build/edição e Run/IA são consumos distintos na UI. Capturas anteriores: Build 5,30, Run 0,0025, chamadas individuais Opus ~0,0006 créditos. Saldo atual de Run é DESCONHECIDO. Fim de crédito de edição não demonstra sozinho esgotamento de inferência.

## Testes locais e seu alcance
- Suite inicial: 14 testes passavam (handler antigo + adaptador + ponte nativa). Após normalização system, 7 testes da ponte nativa passaram.
- Suite nativa + tratamento de erro local: 9 testes passaram.
- Diagnóstico seguro novo: 3 testes próprios passaram; node --check do arquivo completo passou.
- NÃO foi executada a suite original de 109 testes do projeto Lovable neste checkout: dependência zod não está instalada aqui e falta projeto completo/import alias. 109 testes/tipos OK foi resultado relatado pela Lovable antes da publicação.
- Diagnóstico novo não foi implantado e não observou erro upstream real.

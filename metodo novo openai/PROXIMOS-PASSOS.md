# Próximos passos — ordem para economizar tempo e créditos

## Atualização 18/11/2026 (Claude Code)
- Escopo: teste pessoal no workspace próprio. Não ligar a clientes nem usar como fornecedor da Six: os termos da
  Lovable proíbem disponibilizar o serviço a terceiros ("resell, provide, or make the Services available to any third party").
- `codigo/integrations/lovable-test/lovable-source/six-test-messages-bridge.server.ts` agora devolve ao chamador autenticado
  o status, o tipo e a mensagem (cortada e limpa) da recusa do gateway, mais cabeçalhos `X-Six-Bridge-*`. Log sem mensagem.
- `lovable-source/bridge-real.test.ts` testa o arquivo REAL com gateway simulado (zod 3 fora do repo via `SIX_ZOD_DIR`).
  21 testes passando no checkout da Six. Continua NÃO publicado na Lovable.
- `probe-ponte-tool-result.ts`: uma chamada única com histórico sintético tool_use → tool_result.
- `PUBLICAR-DIAGNOSTICO.md`: passo a passo. Bloqueio atual: não há repositório GitHub conhecido do projeto
  key-presence-beacon (nenhum público; nomes prováveis não existem) e o editor está Read only.

1. Leia o código ORIGINAL baixado da Lovable e compare com o arquivo com diagnóstico. Não alegue que testes simulados revelam a causa do 502 real. O estado do servidor publicado é o original, sem diagnóstico.
2. Verifique acesso ao projeto Lovable e à possível sincronização GitHub. Conta atual do navegador integrado não tem acesso; URL terminou com permissionView=requestSent. O usuário pediu navegador integrado, não Chrome nativo. Não estamos logados na conta certa nesse navegador. Se for necessário login/autorização, o usuário deve fazer o passo protegido no destino correto; nunca copiar cookies/tokens de outro navegador.
3. Editor Lovable exibiu “Read only / Upgrade”. Créditos de edição acabaram. Não usar métodos ocultos para ignorar o bloqueio. Conexão legítima GitHub é alternativa a investigar; não foi estabelecida na conversa. O repo da Six não é o repo Lovable.
4. Se houver repo Lovable conectado e autorizado, aplicar APENAS diagnóstico seguro, rodar testes/build reais do projeto, então atualizar publicação dentro do escopo autorizado. O pedido do usuário é terminar o teste; não publicar produção Six nem mexer em clientes. Se houver ampliação de acesso, confirmar especificamente o escopo requerido.
5. Diagnóstico deve distinguir fetch_exception, upstream_rejected (com status), upstream_empty_body, upstream_invalid_content_type. Nunca gravar corpo/headers/segredos. O código preparado já faz isso; considerar levar também identificador seguro upstream se documentação permitir, sem expor dados.
6. Depois da publicação confirmada e vencimento válido, combinar UMA chamada de continuação de ferramenta curta, preferindo payload sintético sem conteúdo do usuário. Consultar diagnóstico para causa exata. Se build/Run acabaram, não fingir chamada funcional nem criar novas contas para contornar limite.
7. Corrigir somente a causa observada: exemplos de hipóteses são schema/headers/options recusados, saldo, auth ou rede. Não trocar para outro modelo silenciosamente nem converter tool_result em texto inventado fingindo suporte nativo.
8. Só após teste isolado passar, retomar uma sessão do Desktop com pequena pasta e ferramenta de leitura, reservando orçamento suficiente para verificação + tool_use + tool_result + resposta final. Primeiro ciclo não deve modificar arquivos. Manter teto e tratar orçamento como erro local definitivo, não rate_limit retryable.
9. Verificar o resultado final no log e na UI. Registrar model, status, stop_reason e uso real quando disponível. Não dizer “modelo real auditado” só por ID de resposta.
10. Ao terminar, usuário pode optar por integrar de forma estável: isso requer orçamento persistente/atômico, política de limites, tratamento de erros, tokens, ferramentas e observabilidade. A trava por instância e Secrets de 1h NÃO são arquitetura final de produção ou serviço ilimitado.

## Testes executáveis offline no checkout Six
Arquivos precisam estar em integrations/lovable-test da raiz do repo. Usar Node 24 instalado:

    node --experimental-strip-types --test integrations/lovable-test/native-messages.test.ts integrations/lovable-test/local-test-errors.test.ts integrations/lovable-test/lovable-source/bridge-diagnostics.test.ts

Para a integração de smoke com handler REAL e fornecedor SIMULADO:

    node --experimental-strip-types --import ./scripts/test-register.mjs integrations/lovable-test/claude-local-smoke.ts --mock

O primeiro comando valida normalização/limites/diagnóstico, não a publicação. O segundo é o adaptador smoke antigo sem ferramentas; não usar como comprovação de conclusão do ciclo nativo.

## Pendências específicas nos arquivos locais
- desktop-local-server.ts aponta corretamente a key-presence-beacon, importa nativeBody e local-test-errors. Últimas alterações 403/422 não foram relançadas nem validadas no Desktop.
- native-messages.server.ts é template LOCAL inicial, não o mesmo arquivo instalado no Lovable. Sua função nativeBody está em uso local e agora move role system para system do topo.
- lovable-source/six-test-messages-bridge.server.ts é o arquivo REAL baixado com diagnóstico acrescentado; preserva alias do projeto Lovable. Não copiar o template inicial sobre ele por acidente.
- local-test-errors.ts troca esgotamento local por 403 e falha de ponte por 422 com mensagem que inclui status real e header X-Six-Bridge-Status. Isso evita que o handler/cliente repita automaticamente 5xx/429 do teste; não muda status upstream registrado. Testes locais passaram; efeito no Desktop ainda não observado.
- mock do desktop-local-server atualmente devolve JSON mesmo quando payload stream=true; não usar esse modo como validação de SSE real. Uma melhoria posterior deve simular SSE com eventos reais, sem fabricar resultado como se fosse inferência.
- handler.ts/route-example.txt/README.md originais dentro de codigo incluem conteúdo antigo Luna/prompt fixo; preservados como histórico, não instruções atuais.

## Mensagens de status corretas
Confirmado: texto no Desktop; emissão de tool_use; recebimento de tool_result no gateway local; 502 no teste isolado; erro público perde causa.
Não confirmado: resposta final de ferramenta; diagnóstico implantado; causa upstream; saldo Run atual; sync GitHub do Lovable; capacidade ilimitada; validade atual.

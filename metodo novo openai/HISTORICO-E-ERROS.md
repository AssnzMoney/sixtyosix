# Histórico e erros a não repetir

## Como começamos
Usuário queria entender a infraestrutura baseada em projetos/remix Lovable e comparar modelos servidos com seu gateway Six. Inicialmente só verificamos presença da variável no servidor, sem ler seu valor, calcular hash/prefixo/tamanho ou exportá-la. Testes reais curtos foram mostrados no painel Lovable. Remixes foram feitos pelo usuário em contas próprias; depois ele migrou o trabalho para sua conta paga existente.

Houve discussão inicial sobre criar/rotacionar várias contas para cotas gratuitas. Não foi implementada automação de contas ou reciclagem de limites. O trabalho autorizado aqui é integração em workspace próprio com seus limites/pagamento, não promessa de uso ilimitado. Remix cria cópia e não significa recursos de inferência independentes/ilimitados.

## Evolução da ponte
1. POST /api/six-test/v1/chat/completions: teste fixo com openai/gpt-6-luna, “Responda apenas OK”, até 16 tokens. Bearer separado, expiração até 1h, JSON no-store, sem segredo no cliente.
2. Movida para /api/public/six-test/v1/chat/completions para caminho externo. Preview pode exigir login antes do handler; usar site publicado não garante preview acessível.
3. Quatro testes da página foram bloqueados no servidor com 403 para não consumir por visitantes; página e /api/verificar-chave ficaram atrás de site Invite only. Em uma etapa publicação foi pública por escolha do usuário; relato posterior indica Invite only novamente. Não alterar visibilidade como “correção” de rota.
4. Modelo mudou para anthropic/claude-opus-5-5. Upstream mudou para /v1/messages e resposta nativa foi convertida para OpenAI Chat. Auth inicial Lovable-API-Key foi corrigida para Authorization: Bearer, conforme o teste funcional Opus. stop_reason mapeado honestamente, sem fabricar OK e sem ocultar saída vazia/cortada como sucesso.
5. Proteções adicionadas: leitura 8 KiB, timeout 30 s, chave >=32 chars, system aceito/descartado no teste fixo, reserva de uma tentativa por instância. Isso NÃO era limite global.
6. Para Desktop, primeiro permitimos texto real até 2000 caracteres e saída 64. Continuava insuficiente: contexto de Desktop inclui histórico e 117–168 ferramentas mesmo pedindo “sem ferramentas”.
7. Nova rota separada POST /api/public/six-test/v1/messages: 4 MiB, 1024 tokens de saída, system/histórico/tools/tool_choice, SSE nativo, timeout 60 s com cancelamento, até 3 tentativas por instância. thinking/output_config retirados para teste sem raciocínio estendido. Rota antiga preservada.
8. Implementação pausou por Build credits, foi concluída na cópia atual, Lovable relatou 109 testes e compilação OK e publicou key-presence-beacon.lovable.app.
9. Corrigimos normalização de mensagens system no gateway local, pois a API Anthropic aceita system no topo, não role system em messages. Texto passou a funcionar no Desktop.
10. Teto 3 foi insuficiente: conexão automática usa chamada, resposta usa outra, ferramenta usa terceira, continuação exige quarta. Ampliamos uma vez até 4 sem zerar contador.
11. 502 na quarta chamada. Novas tentativas recebem 429 do orçamento local; handler Six pode repetir upstream 5xx internamente, mascarando primeira falha.
12. Tratamento local foi preparado para orçamento dar 403 e falha da ponte encerrar com 422, mantendo status upstream no diagnóstico/X-Six-Bridge-Status. Trata-se de política de teste local, NÃO alteração do status real upstream nem solução do 502. Não foi relançado/validado no Desktop após essa última edição.

## Problemas de condução anteriores
- Foi errado supor que smoke test fixed prompt bastava para Desktop real.
- Foi errado recomendar mais prompts/remixes enquanto faltava evidência do erro.
- Download na aba Código baixa SÓ O ARQUIVO ABERTO, não um ZIP do projeto. Usuário perdeu tempo por instrução errada.
- Arquivos da aba “Arquivos” são anexos/coleções, não árvore de fonte. Fonte está em </> Código.
- Anexo do arquivo não apareceu no texto da conversa; havia arquivos no Downloads. Localizamos C:/Users/Alysson/Downloads/six-test-messages-bridge.server.ts e lemos completo. Não pedir para reenviar o que já está disponível.
- “Arquivo pronto localmente” NÃO é “rota atualizada na publicação”. Diagnóstico ainda não publicado.
- Não afirmar “não é Anthropic” além da evidência: texto funciona e o 400 foi de integração; a causa do 502 atual é desconhecida.
- Não assumir que o 502 significa indisponibilidade de modelo, falta de crédito ou que tool_result não é suportado. São hipóteses.
- Não confundir logs de /chat/completions antigo com nova /messages. Ambas existem.

## Interação com navegador
Usuário pediu explicitamente usar navegador integrado, NÃO controlar Chrome do PC. Sessão integrada estava em outra conta e mostrou “You don't have access” para o projeto atual. Ele acionou Request access; último estado fornecido foi URL ?permissionView=requestSent. Não há evidência de aprovação de acesso. Não tornar projeto público, ampliar permissões ou criar credenciais como atalho. Se precisar de autorização de GitHub/Lovable, explicar exatamente o recurso, sem pedir confirmações vagas.

Foram criadas abas integradas com markHandoff, mas elas desapareceram entre turnos. Não garantir ao usuário que vê uma aba sem verificar. A janela Chrome própria do usuário estava minimizada e o controlador não restaurou; teclado/clicks tinham erros de geometria. Esse NÃO é erro da API do projeto.

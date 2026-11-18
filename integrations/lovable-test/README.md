# Teste privado Six → projeto Lovable → gateway Lovable

Preparação local, desativada. Não altera o roteador nem os clientes de produção.

## Estado

- handler.ts: núcleo HTTP de teste, autenticação separada, prazo máximo de uma hora, prompt fixo, saída máxima de 16 tokens, sem retries, streaming ou ferramentas.
- route-example.txt: exemplo TanStack para instalar no projeto próprio. Ainda não compilado no Lovable.
- handler.test.ts: validação com rede simulada; não comprova chamada real pela Six.

Modelo inicial: openai/gpt-6-luna, já observado no teste do workspace. O modelo Opus não é usado nesta primeira ponte.

## Ligação planejada

1. Instalar os arquivos no projeto próprio e configurar os dois Secrets de teste. A credencial gerenciada Lovable fica somente nesse projeto.
2. Validar build e acesso autenticado. Usar endereço de servidor alcançável pela Six; URL privada de preview com sessão de navegador não é garantia de acesso servidor a servidor. Não remover a proteção de acesso para resolver isso.
3. Criar provedor de teste com base https://ENDERECO_DO_PROJETO/api/six-test/v1 e a credencial SIX_TEST_BRIDGE_KEY, nunca LOVABLE_API_KEY.
4. Criar alias exclusivo six-lovable-test apontando para openai/gpt-6-luna, com in_pro=false. Liberar somente uma chave manual de teste restrita a esse alias. Não alterar os modelos existentes.
5. Fazer uma única chamada OpenAI chat pelo gateway da Six: mensagem user exatamente Responda apenas OK, stream=false, max_tokens=16. Não testar por Messages/Responses ainda.
6. Comparar gateway_usage da Six e registro IA da Lovable. Ao concluir, desativar provedor e remover Secrets/rota de teste.

## Limites reais

A trava de tentativa é por instância de servidor: reinícios e múltiplas instâncias podem permitir chamadas adicionais. Não é orçamento global. Para limites persistentes, exigir contador atômico em banco antes de qualquer uso mais amplo. O prazo expira mesmo após reinício. Não configurar recarga automática.

A lista /models existe no núcleo para futuro wrapper GET, mas este pacote só fornece exemplo da rota POST; cadastrar manualmente o modelo no roteador. A validação de acesso ao modelo depende do catálogo do workspace.

## Verificação local

node --experimental-strip-types --test integrations/lovable-test/handler.test.ts

Não houve chamada real, exportação de chave, publicação ou alteração no banco.

## Claude Code: teste local concluído em 18/11/2026

O executável Claude Code instalado foi executado em modo --bare --print, sem ferramentas, sem persistência da sessão e em diretório temporário vazio. Variáveis de configuração valeram somente para o subprocesso; login e configurações permanentes não foram modificados.

Caminho validado: Claude Code → handler real da Six em 127.0.0.1 → adaptador local Messages/Chat → ponte publicada → Opus configurado. Banco de dados, chaves e registro de consumo da Six ficaram em memória; nenhum banco de produção foi chamado.

Resultado real: ponte HTTP 200, resposta OK, is_error=false, 16 tokens de entrada e 4 de saída. Uma chamada externa. O teste simulado anterior respondeu SIMULADO_LOCAL e não chamou a Lovable.

Arquivos: claude-adapter.ts, claude-adapter.test.ts, claude-local-smoke.ts.

Limitação: o adaptador aceita apenas o prompt fixo e descarta instruções de sistema. Converte JSON completo em eventos SSE depois da resposta, portanto não fornece streaming nativo em tempo real. Não valida ferramentas, histórico, edição de arquivos, contexto do repositório nem sessão interativa. Não configurar um cliente de produção apontando para esse teste.

Para repetir somente o teste SEM consumo:

node --experimental-strip-types --import ./scripts/test-register.mjs integrations/lovable-test/claude-local-smoke.ts --mock

Para uma tentativa real, o mesmo comando sem --mock exige SIX_TEST_BRIDGE_KEY no ambiente do processo e uma ponte autorizada com validade ativa. Não colocar o segredo em arquivo rastreado ou argumento de linha de comando.

## Teste pessoal interativo

Abra Abrir-ClaudeLocal.cmd (ou execute Start-ClaudeLocal.ps1 no PowerShell). O iniciador pede a credencial da ponte com entrada oculta; não usa nem grava a LOVABLE_API_KEY. O Claude Code abre num diretório temporário, com configuração própria temporária, sem ferramentas e sem mudar o login salvo. Digite exatamente Responda apenas OK. A janela local encerra após no máximo cinco minutos. Saia com /exit ou Ctrl+C. A ponte publicada precisa estar com validade ativa. Uma segunda chamada é bloqueada pelo processo local.

O comando Start-ClaudeLocal.ps1 -Simulado usa somente SIMULADO_LOCAL, sem consumo. O iniciador não contorna políticas de execução do PowerShell.

## Atualização: Desktop nativo (preparado localmente)

O Desktop real envia histórico, sistema e centenas de ferramentas. O antigo adaptador de texto curto não atende esse uso. desktop-local-server.ts agora usa /messages nativo, limite de 4 MiB e três chamadas por processo; encerra em 30 minutos. O endpoint count_tokens continua com o 404 explícito do handler real da Six, sem estimativas fabricadas.

Instalação remota pendente: INSTALAR-NATIVO.txt, native-messages.server.ts e native-route-example.txt. A nova rota ainda NÃO foi instalada nem publicada por este pacote local. Não iniciar o teste real antes disso. Os testes de rede simulada estão em native-messages.test.ts. O teto de saída é 1024 tokens e o modo de teste desativa thinking/output_config; não é configuração de produção nem comprovação de disponibilidade upstream.

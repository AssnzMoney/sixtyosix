# Arquitetura e ambiente

## Fluxo validado parcialmente
Claude Desktop (aba Código) → http://127.0.0.1:17866/v1/messages → api/access.ts real da Six → fetch interceptado de teste → https://key-presence-beacon.lovable.app/api/public/six-test/v1/messages → https://ai.gateway.lovable.dev/v1/messages → modelo configurado.

- Alias do cliente: claude-opus-5-5.
- Modelo upstream permitido: anthropic/claude-opus-5-5.
- Desktop Gateway: URL base http://127.0.0.1:17866, chave API estática, esquema bearer. A chave local é DIFERENTE da chave Bearer da ponte Lovable.
- O cliente já estava configurado e respondeu OK; não substituir por localhost de outra máquina nem pela URL de produção.
- Instância local vence em 30 minutos. Não presumir que ainda está aberta. Não relançar servidor com orçamento zerado para fingir que chamadas anteriores não ocorreram.
- O processo local usa banco, provider, manual key e consumo em memória. SUPABASE_URL aponta a https://six-local-test.invalid; fetch mockado simula router_models/router_keys/gateway_gate/gateway_usage. Só a URL exata da ponte é permitida para rede real. Não carregar .env de produção.
- A configuração do provedor “Lovable — teste privado” na Six produtiva foi DESLIGADA pelo usuário. Não reativar. O provedor principal Delver permanece fora do escopo.

## Projeto Lovable atual
- ID 3ca5b78c-1500-4e48-87dc-6f41232ffeb4.
- Editor https://lovable.dev/projects/3ca5b78c-1500-4e48-87dc-6f41232ffeb4.
- Workspace observado: AssnZ's Lovable. Título Remix of Remix of Remix of Sixtysix - Presenca de variavel.
- Publicado: https://key-presence-beacon.lovable.app.
- Ponte nativa: /api/public/six-test/v1/messages.
- Ponte antiga: /api/public/six-test/v1/chat/completions.
- GET /models não implementado na ponte remota; admin Six recebeu 404 listando modelos e precisou de cadastro manual. Gateway LOCAL implementa GET /v1/models, autenticado, e lista Opus.
- /v1/messages/count_tokens no handler atual da Six retorna 404 explícito; isso foi observado e não impediu a resposta OK do Desktop. Não inventar contagem exata. Não implementar endpoint upstream especulativo.
- Nenhuma conexão GitHub deste projeto Lovable foi realizada por nós. Ainda não foi verificado se alguma conexão preexistente existe nas configurações. Esse é o próximo caminho proposto para editar sem chat pago.

## Projeto anterior
ID 34749cd1-e00d-4116-955b-7302c14da1f0, workspace alisson's Lovable; publicação hidden-key-checker.lovable.app; preview id-preview--34749cd1-e00d-4116-955b-7302c14da1f0.lovable.app. A integração LOCAL já foi mudada para key-presence-beacon, não voltar ao site antigo por acidente.

## Secrets (somente nomes)
- LOVABLE_API_KEY: credencial gerenciada dentro do servidor Lovable, não exportada/lida. Não confundir com chave do cliente Six.
- SIX_TEST_BRIDGE_KEY: credencial independente de pelo menos 32 chars usada em Authorization: Bearer do cliente servidor-a-servidor da ponte. Usuário a cadastrou por formulário seguro. Valor omitido desta entrega.
- SIX_TEST_BRIDGE_EXPIRES_AT: ISO 8601 UTC, futuro, no máximo 1h adiante (código faz essa checagem a cada requisição).
- SIX_LOCAL_CLIENT_KEY: autenticação do Desktop ao servidor local. Valor omitido.
- SIX_LOCAL_INITIAL_CALLS / SIX_LOCAL_MAX_CALLS: contador inicial/teto por processo. Último relançamento configurado 3/4, portanto só uma chamada restante, já consumida. Máximo aceito pelo script é 4.

O snapshot de Start-ClaudeLocal.ps1 tem placeholder REDACTED_SIX_LOCAL_CLIENT_KEY onde havia chave de teste real. Não executar sem ajustar uso seguro de variável de ambiente. As demais chaves falsas nos testes são deliberadamente simuladas. Não commitar novas credenciais.

## Fonte baixada da Lovable
Arquivo original C:/Users/Alysson/Downloads/six-test-messages-bridge.server.ts, copiado para codigo/integrations/lovable-test/lovable-source/six-test-messages-bridge.original.ts.
Importa zod e expiracaoSixTestValida de @/lib/six-test-bridge.server. Não temos projeto Lovable completo neste checkout. O arquivo original valida user/assistant, mantém blocos via passthrough, max_tokens <=1024, tools e tool_choice. Remove thinking/output_config. Busca /v1/messages com Authorization Bearer.

Ponto decisivo: fetch catch gera 502 (504 apenas timeout). Resposta upstream não OK, sem body ou Content-Type não JSON/SSE também gera o MESMO 502. O status, corpo e motivo upstream não são armazenados. Portanto não é possível recuperar a causa de uma chamada passada por esse código.

Arquivo de mesmo nome sem .original no snapshot contém diagnóstico LOCAL novo. Registra somente requestId gerado localmente, estágio, duração, status e tipo de conteúdo permitido, ou nome/código de erro de uma allowlist. Não registra corpo, headers, segredos, mensagens, respostas ou stack. Mantém mensagens públicas genéricas e proteções. NÃO está publicado.

## Repositório Six e ferramentas
- api/access.ts: handler atual, autenticação, gate, proxy e erros. MAX_BODY produtivo 32 MiB. Tem retries de fornecedor para erros transitórios e ajustes por 400.
- server/supplier.ts: supplierRequestBody reescreve modelo e pode acrescentar sistema de identidade; collectUsage; sanitização de respostas/SSE; não expor dados do fornecedor em produção.
- server/router.ts: cadastro, cache, sealSecret AES-GCM etc.
- ROTEADOR.md: documentação existente da infraestrutura atual.
- VPS/Caddy produtivo usa dois processos Node (8080/8081), não tocados aqui.
- Node C:/Program Files/nodejs/node.exe, versão observada 24.20.0, suporta --experimental-strip-types.
- Git C:/Program Files/Git/cmd/git.exe. Ownership diferente exige -c safe.directory=<checkout> por comando; não alterar configuração global.
- Fetch remoto/fetch Git funcionou sob usuário Alysson. Git em Windows exigiu -c http.sslBackend=openssl no fetch. Não desabilitar verificação TLS.
- CLI Claude real: C:/Users/Alysson/AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe (não cli.js).
- Logs: C:/Users/Alysson/AppData/Local/Temp/six-desktop-diagnostic.log, somente metadados.
- exec_command de algumas sessões falhou antes de iniciar por helper_sandbox_lock_failed; node_repl fs/child_process funcionou. Não confundir isso com falha de build.

Processos Node transitórios, mesmo detached/unref, morreram entre turnos. Uma janela PowerShell persistente foi aberta com autorização explícita do usuário para manter o servidor. Não fechar terminais genéricos ou matar processos fora de integrations/lovable-test/desktop-local-server.ts.

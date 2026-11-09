# Conta real — SixtySix

## Implementação

- `/api/account/*` valida o token da sessão com Supabase Auth antes de consultar dados.
- O servidor deriva o dono da sessão validada. `user_id` enviado pelo navegador nunca autoriza acesso.
- O consumo vem de `gateway_usage`, limitado às chaves vinculadas ao dono. Tokens e status são os registros do gateway; não são gerados pelo dashboard.
- As consultas cobrem o intervalo completo com paginação e uma data de corte estável. O fuso do navegador define os limites do dia.
- A chave existente é vinculada comprovando posse do token completo. A transação só vincula uma chave ativa ainda sem dono ou do mesmo dono.
- Criar outra chave exige acesso de teste ativo já vinculado. O limite de dez chaves ativas é aplicado dentro de transação com trava por usuário.
- Chaves novas usam o formato e o SHA-256 já autenticados pelo gateway. O segredo é devolvido uma vez e mantido apenas na memória da interface.
- Revogar desativa a chave e preserva o histórico. O usuário confirma antes de concluir.
- Nenhuma credencial privilegiada é incluída no bundle do navegador. Não definir `VITE_SUPABASE_SERVICE_ROLE_KEY`.

## Ativação

1. Revisar/aplicar `supabase/account-portal.sql` no projeto já utilizado pelo gateway. É aditivo: não troca token_hash, não remove clientes nem chamadas.
2. No servidor do site, configurar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_PUBLISHABLE_KEY` (ou a chave pública `VITE_SUPABASE_ANON_KEY`). O endereço deve ser o mesmo projeto da autenticação e do gateway.
3. Publicar o site com a função `/api/account/[...path].ts`. O gateway existente e suas rotas continuam em outro deploy.
4. Entrar na conta pelo Google/Discord. Em Chaves de API, vincular a chave individual de teste atual. Não usar a chave administrativa nesse campo.
5. Fazer uma chamada pelo aplicativo já configurado e conferir o histórico. O painel atualiza a cada 30 segundos e permite atualização manual.

## Pagamentos e economia

O usuário informou que ainda não há processador de pagamentos conectado e considera Mercado Pago. Não há cobrança, assinatura paga ou pagamento aprovado criado por esta integração. O acesso vinculado é apresentado como teste sem cobrança.

Economia é estimativa: tokens de entrada e saída multiplicados por preços de referência editáveis, menos o custo do acesso. As tarifas iniciais são hipóteses, não preços oficiais. No teste ativo o custo é zero; na demonstração local a assinatura fictícia é R$ 119. Não apresentar isso como dinheiro efetivamente recebido ou pago.

## Verificação

- `node --experimental-strip-types --test server/account.test.ts`: autenticação, isolamento, revogação de chave alheia, hash/formato de chave, períodos e paginação.
- `npx tsc --noEmit` e `npm run build`.
- O teste ao vivo deve verificar a migração, credenciais, uma sessão real e a chamada do gateway. Passar nos testes locais não significa que essas etapas já foram ativadas.

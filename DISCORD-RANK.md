# Ranking no Discord — SixtySix

Publica no canal do Discord quem mais usa a IA na plataforma, lendo o mesmo consumo da aba **Consumo e falhas** (`gateway_usage`).

## O que aparece

- **🔥 Quem mais usou a IA**: tokens (entrada + saída).
- **🛠️ Quem mais trabalhou**: sessões de trabalho. Uma sessão é um bloco de uso sem pausa maior que 30 min.
  A plataforma não sabe o nome do projeto (o Claude Code e o Codex não mandam isso), então as sessões são a
  medida mais próxima de "quantos projetos a pessoa fez". Também mostra os dias em que a pessoa usou.
- **🤖 Modelos mais usados**: chamadas e quantas pessoas usaram cada modelo.
- Top 10 de cada lista. Só chamadas com sucesso contam. As várias chaves da mesma conta somam juntas.

## Privacidade

- O nome sai curto: "Alisson Medeiros" vira "Alisson M.". E-mail, chave e WhatsApp nunca vão para o Discord.
- Quem não tem nome aparece como "Cliente #a1b2".
- As contas de `SIXTYSIX_ADMIN_EMAILS` ficam fora. Para tirar mais alguém, use `DISCORD_RANK_HIDE`.
- Menções (`@everyone`) ficam desligadas na mensagem.

## Ativação

1. No Discord: **Configurações do canal → Integrações → Webhooks → Novo webhook → Copiar URL**.
2. No `.env` da VPS:
   ```
   DISCORD_RANK_WEBHOOK_URL=https://discord.com/api/webhooks/...
   DISCORD_RANK_DAYS=7                       # opcional, período padrão (1 a 90)
   DISCORD_RANK_HIDE=email@x.com,Nome Tal    # opcional, quem não entra no ranking
   ```
3. Publique (`npm run publicar`).
4. Admin → aba **Consumo e falhas** → **Ranking no Discord**: "Ver prévia" mostra só para você;
   "Publicar no Discord" manda para o canal.

## Publicar sozinho (cron na VPS)

Toda segunda às 10h, ranking da semana (como usuário `sixtysix`, `crontab -e`):

```
0 10 * * 1 for p in 8080 8081; do curl -fsS -X POST "http://127.0.0.1:$p/api/discord-rank?days=7" -H "Authorization: Bearer $(grep '^CRON_SECRET=' ~/app/.env | cut -d= -f2-)" >> ~/discord-rank.log 2>&1 && break; done
```

## Arquivos

- `server/discord-rank.ts`: lê o banco, monta o ranking e a mensagem, publica no webhook.
- `api/discord-rank.ts`: endpoint do cron (`/api/discord-rank`, exige `CRON_SECRET`).
- `api/management.ts`: ações `discord-rank-preview` e `discord-rank-publish` (só admin).
- `src/components/DiscordRankPanel.tsx`: painel na aba Consumo.
- Testes: `server/discord-rank.test.ts`.

## Ainda não coberto

- Cargos automáticos no Discord (ex.: cargo "Top 1"). Isso exige um bot com token e ligar cada conta do site
  à conta do Discord.
- Contar projetos de verdade. Exigiria o cliente mandar um identificador do projeto em cada chamada.

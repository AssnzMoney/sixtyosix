#!/usr/bin/env bash
# Publica a versão mais nova da main na VPS. Rodar como o usuário sixtysix:
#   cd ~/app && ./deploy/deploy.sh
#
# Sem derrubar ninguém: há dois processos iguais (8080 e 8081, deploy/ecosystem.config.cjs) e o Caddy usa o
# 8080, passando para o 8081 quando o 8080 está fora. Reinicia primeiro o 8081 e, com ele de pé, o 8080: o
# processo que sai termina as respostas em andamento (até 10 min) enquanto o outro atende os pedidos novos.
set -euo pipefail
cd "$(dirname "$0")/.."

before=$(sha1sum package-lock.json)
git pull --ff-only
after=$(sha1sum package-lock.json)
if [ "$before" != "$after" ] || [ ! -d node_modules ]; then
  npm ci
fi

# O build grava VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no site (o Vite lê o .env da raiz).
npm run build
npm test

# Espera o processo da porta responder /healthz. Antes de sair, o processo termina as respostas em andamento (até
# 10 min, DRAIN_MS): por isso a espera vai até 11 min (antes eram 60 s e o deploy parava no meio, sem erro de verdade).
up() {
  for i in $(seq 1 660); do
    if curl -fsS "http://127.0.0.1:$1/healthz" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "O processo da porta $1 não voltou. Veja: pm2 logs $2 --lines 80" >&2
  exit 1
}

for app in sixtysix-b:8081 sixtysix-a:8080; do
  name=${app%%:*} port=${app##*:}
  echo "Reiniciando $name (porta $port); quem já está sendo atendido termina antes..."
  pm2 startOrReload deploy/ecosystem.config.cjs --only "$name" --update-env
  up "$port" "$name"
done
# Bot do Discord (cargos automáticos): só com DISCORD_BOT_TOKEN no .env (sem o token, fica desligado).
if grep -q '^DISCORD_BOT_TOKEN=..*' .env 2>/dev/null; then
  pm2 startOrReload deploy/ecosystem.config.cjs --only sixtysix-discord --update-env
fi
pm2 save

if curl -fsS http://127.0.0.1:8080/api/health >/dev/null; then
  echo "Publicado: $(git log -1 --format='%h %s')"
else
  echo "Publicado, mas /api/health não respondeu ok (Roteador ou banco). Veja: pm2 logs sixtysix-a --lines 80" >&2
  exit 1
fi

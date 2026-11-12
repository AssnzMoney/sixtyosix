#!/usr/bin/env bash
# Publica a versão mais nova da main na VPS. Rodar como o usuário sixtysix:
#   cd ~/app && ./deploy/deploy.sh
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

pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

# Confere que o servidor voltou (até 20 s).
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8080/api/health >/dev/null; then
    echo "Publicado: $(git log -1 --format='%h %s')"
    exit 0
  fi
  sleep 1
done
echo "O servidor não respondeu depois da publicação. Veja: pm2 logs sixtysix --lines 80" >&2
exit 1

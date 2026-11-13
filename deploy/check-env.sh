#!/usr/bin/env bash
# Confere o .env da VPS antes de trocar o DNS. Mostra só os NOMES das variáveis, nunca os valores.
#   cd ~/app && ./deploy/check-env.sh
cd "$(dirname "$0")/.."

required=(SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY
  MERCADOPAGO_ACCESS_TOKEN MERCADOPAGO_WEBHOOK_SECRET RESEND_API_KEY EMAIL_FROM CRON_SECRET SIXTYSIX_ADMIN_EMAILS)
optional=(EMAIL_REPLY_TO SUPABASE_PUBLISHABLE_KEY SIXTYSIX_SELF_TRIAL SIXTYSIX_AUTO_GATEWAY_KEYS)

has() { [ -f .env ] && grep -qE "^$1=.+" .env; }
missing=0
echo "Versão: $(git log -1 --format='%h %s')"
for name in "${required[@]}"; do
  if has "$name"; then echo "  ok      $name"; else echo "  FALTA   $name"; missing=1; fi
done
for name in "${optional[@]}"; do has "$name" && echo "  ok      $name (opcional)"; done
grep -qE '^SUPABASE_URL=https://' .env 2>/dev/null || { [ -f .env ] && has SUPABASE_URL && echo "  ATENÇÃO SUPABASE_URL precisa começar com https://"; }

echo "Saúde: $(curl -sS --max-time 10 http://127.0.0.1:8080/api/health || echo 'servidor não respondeu')"
echo "Roteador: $(curl -sS --max-time 10 http://127.0.0.1:8080/api/router-status | head -c 300)"
[ "$missing" = 0 ] && echo "Tudo certo no .env." || echo "Complete o .env (valores na Vercel: Settings > Environment Variables) e rode ./deploy/deploy.sh"

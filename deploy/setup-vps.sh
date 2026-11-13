#!/usr/bin/env bash
# Prepara uma VPS Ubuntu/Debian nova para a SixtySix. Rodar uma vez, como root:
#   curl -fsSL https://raw.githubusercontent.com/AssnzMoney/sixtyosix/main/deploy/setup-vps.sh | bash
# Depois: colocar o /home/sixtysix/app/.env e rodar o primeiro deploy (instruções no fim).
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Rode como root." >&2; exit 1; }

APP_USER=sixtysix
APP_DIR=/home/$APP_USER/app
REPO=https://github.com/AssnzMoney/sixtyosix.git
export DEBIAN_FRONTEND=noninteractive

echo "== Sistema"
timedatectl set-timezone America/Sao_Paulo || true
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl git gnupg ufw fail2ban unattended-upgrades cron \
  debian-keyring debian-archive-keyring apt-transport-https openssl
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== Node.js 22"
if ! node --version 2>/dev/null | grep -qE '^v(2[2-9]|[3-9][0-9])\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node --version
npm install -g pm2

echo "== Caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

echo "== Usuário e código"
id "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$APP_USER"
# O Caddy precisa entrar na pasta para servir o site (dist/).
chmod 755 /home/$APP_USER
[ -d "$APP_DIR/.git" ] || sudo -u "$APP_USER" git clone "$REPO" "$APP_DIR"
chmod +x "$APP_DIR/deploy/"*.sh

if [ ! -f "$APP_DIR/.env" ]; then
  # Modelo do .env: as chaves vêm da Vercel (o CRON_SECRET é novo e já vai preenchido).
  cat > "$APP_DIR/.env" <<EOF
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
RESEND_API_KEY=
CRON_SECRET=$(openssl rand -hex 32)
EOF
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
fi
chmod 600 "$APP_DIR/.env"

echo "== PM2 no boot e logs com rotação"
env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null
sudo -u "$APP_USER" pm2 install pm2-logrotate >/dev/null
sudo -u "$APP_USER" pm2 set pm2-logrotate:max_size 50M >/dev/null
sudo -u "$APP_USER" pm2 set pm2-logrotate:retain 30 >/dev/null

echo "== Caddy (https automático)"
mkdir -p /var/log/caddy
cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
# Valida como o usuário do Caddy: rodando como root, o arquivo de log nasce do root e o Caddy não consegue abrir.
chown -R caddy:caddy /var/log/caddy
sudo -u caddy caddy validate --config /etc/caddy/Caddyfile
# Algumas VPS vêm com um painel (nginx/Apache) ocupando as portas 80 e 443: o Caddy não sobe.
if ss -ltnp | grep -E ':(80|443) ' | grep -vq caddy; then
  echo "As portas 80/443 já estão em uso:" >&2; ss -ltnp | grep -E ':(80|443) ' >&2
  echo "Libere as portas e rode o script de novo." >&2; exit 1
fi
systemctl enable caddy
systemctl restart caddy

echo "== E-mails diários (lembretes de vencimento), 9h de Brasília"
# Tenta o processo 8080 e, se ele estiver reiniciando, o 8081 (cada aviso sai uma vez só, então repetir é seguro).
CRON_LINE="0 9 * * * for p in 8080 8081; do curl -fsS -X POST http://127.0.0.1:\$p/api/notifications -H \"Authorization: Bearer \$(grep '^CRON_SECRET=' $APP_DIR/.env | cut -d= -f2-)\" >> /home/$APP_USER/notifications.log 2>&1 && break; done"
# "|| true": sem agendamento nenhum, o crontab -l e o grep "falham" e, com set -e, a linha nunca era gravada.
{ crontab -u "$APP_USER" -l 2>/dev/null | grep -v '/api/notifications' || true; echo "$CRON_LINE"; } | crontab -u "$APP_USER" -
crontab -u "$APP_USER" -l | grep -q '/api/notifications' || { echo "O agendamento dos e-mails não foi gravado." >&2; exit 1; }

echo "== Firewall"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban

echo "== SSH só por chave (antes, coloque a sua chave em /root/.ssh/authorized_keys)"
if [ -s /root/.ssh/authorized_keys ]; then
  printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' > /etc/ssh/sshd_config.d/00-sixtysix.conf
  sshd -t && systemctl reload ssh
else
  echo "Nenhuma chave em /root/.ssh/authorized_keys: o login por senha continua ligado." >&2
fi

cat <<EOF

Pronto. Próximos passos:
  1. Preencher $APP_DIR/.env
  2. sudo -u $APP_USER bash -lc 'cd $APP_DIR && ./deploy/deploy.sh'
  3. Apontar sixtysix.online e www.sixtysix.online para este servidor na Cloudflare (nuvem cinza).
EOF

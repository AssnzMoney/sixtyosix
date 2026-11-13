// PM2 na VPS: dois processos iguais do servidor (portas 8080 e 8081), reiniciados se caírem, com logs.
// O Caddy manda tudo para o 8080 e usa o 8081 só quando o 8080 está fora (deploy/Caddyfile). Na publicação,
// deploy/deploy.sh reinicia um de cada vez: quem está saindo termina as respostas em andamento e o outro atende
// os pedidos novos. Assim publicar não corta mais ninguém no meio de uma resposta.
// Uso: pm2 startOrReload deploy/ecosystem.config.cjs --only sixtysix-a --update-env
const path = require('node:path')

const app = (name, port) => ({
  name,
  cwd: path.resolve(__dirname, '..'),
  // Node direto, sem o "container" do PM2: o TypeScript roda com --experimental-strip-types,
  // e o loader troca os imports ".js" por ".ts" (o mesmo usado nos testes).
  script: 'node',
  args: '--env-file=.env --experimental-strip-types --import ./scripts/test-register.mjs server/start.ts',
  interpreter: 'none',
  env: { NODE_ENV: 'production', PORT: String(port), HOST: '127.0.0.1', DRAIN_MS: '600000' },
  max_memory_restart: '800M',
  // O servidor espera até 10 min (DRAIN_MS) as respostas em andamento; o PM2 só força a saída depois disso.
  kill_timeout: 660000,
  time: true,
})

module.exports = { apps: [app('sixtysix-a', 8080), app('sixtysix-b', 8081)] }

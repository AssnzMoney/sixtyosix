// PM2 na VPS: mantém o servidor de pé, reinicia se cair e guarda os logs.
// Uso: pm2 startOrReload deploy/ecosystem.config.cjs --update-env
const path = require('node:path')

module.exports = {
  apps: [
    {
      name: 'sixtysix',
      cwd: path.resolve(__dirname, '..'),
      // Node direto, sem o "container" do PM2: o TypeScript roda com --experimental-strip-types,
      // e o loader troca os imports ".js" por ".ts" (o mesmo usado nos testes).
      script: 'node',
      args: '--env-file=.env --experimental-strip-types --import ./scripts/test-register.mjs server/start.ts',
      interpreter: 'none',
      env: { NODE_ENV: 'production', PORT: '8080', HOST: '127.0.0.1' },
      max_memory_restart: '800M',
      // Na atualização, dá até 30 s para as respostas em andamento terminarem.
      kill_timeout: 30000,
      time: true,
    },
  ],
}

// Ponto de partida do servidor na VPS (o PM2 roda este arquivo). Veja deploy/ecosystem.config.cjs.
import { start } from './app.ts'

start()

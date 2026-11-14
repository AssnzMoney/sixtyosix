/**
 * Dados de exemplo da administração, só para revisar o layout no computador local
 * (/adminxv1?demo=1 em localhost). Nada aqui sai do navegador nem toca o banco.
 */
type Row = Record<string, any>

const DAY = 86400000
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString()
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const NAMES = ['Ana Ribeiro', 'Bruno Costa', 'Carla Mendes', 'Diego Alves', 'Elisa Rocha', 'Felipe Nunes', 'Gabriela Lima', 'Henrique Souza', 'Isabela Martins', 'João Pedro', 'Karina Duarte', 'Lucas Farias']

export function adminDemoData(): Record<string, Row[]> {
  const users = NAMES.map((name, i) => ({
    id: id(i + 1),
    email: name.toLowerCase().replace(/[^a-z]+/g, '.') + '@exemplo.com',
    name,
    whatsapp: i % 5 === 4 ? '' : `5581999${String(100000 + i * 7311).slice(0, 6)}`,
    created_at: iso(-30 + i),
    last_sign_in_at: iso(-(i % 4)),
    email_confirmed_at: iso(-30 + i),
    provider: i % 3 ? 'email' : 'google',
  }))
  const plans: [string, number, boolean][] = [['pro', 11999, true], ['devApi', 9499, true], ['dev', 7999, false]]
  const subscriptions = users.slice(0, 10).map((u, i) => {
    const [plan, amount, api] = plans[i % 3]
    const paid = i < 8
    return {
      id: id(100 + i), user_id: u.id, plan_code: plan, amount_cents: amount, api_enabled: api, models: [],
      paid_until: paid ? iso(2 + i * 3) : null, provider_status: paid ? 'approved' : 'pending', created_at: iso(-20 + i),
      entitled: paid, billing_mode: 'pix',
    }
  })
  const payments = subscriptions.filter((s) => s.paid_until).map((s, i) => ({
    id: String(188500000000 + i), subscription_id: s.id, status: 'approved', amount_cents: s.amount_cents, currency: 'BRL',
    approved_at: iso(-i), period_start: iso(-i), period_end: s.paid_until, recorded_at: iso(-i),
  }))
  const sitekeys = subscriptions.filter((s) => s.paid_until && s.api_enabled).map((s, i) => ({
    subscription_id: s.id, router_key_id: id(300 + i), adopted: i === 1, created_at: iso(-i - 1),
    revealed_at: i % 3 === 2 ? null : iso(-i), revealed_ip: i % 3 === 2 ? null : `177.20.${i}.10`, rotated_at: i === 0 ? iso(-1) : null,
  }))
  const clients = users.map((u, i) => ({ id: id(500 + i), user_id: u.id, name: 'Roteador · ' + u.name, enabled: true, created_at: u.created_at, key_prefix: 'sk-rt-demo' + i }))
  const models = ['claude-fable-5-2', 'claude-opus-5-5', 'gpt-6-astra', 'argon-4']
  const usage = Array.from({ length: 240 }, (_, i) => ({
    id: i + 1, client_id: clients[i % 8].id, requested_alias: models[i % 4], status_code: i % 17 === 0 ? 429 : 200,
    input_tokens: 2000 + ((i * 937) % 40000), output_tokens: 200 + ((i * 131) % 3000), latency_ms: 800 + ((i * 53) % 9000),
    created_at: new Date(Date.now() - (i % 28) * DAY - i * 60000).toISOString(),
  }))
  return { users, subscriptions, payments, sitekeys, clients, usage, keys: [], trials: [], deliveries: [] }
}

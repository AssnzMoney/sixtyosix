import { test } from 'node:test'
import assert from 'node:assert/strict'
import { KeyPool, keyHint } from './key-pool.ts'

function pool() {
  let clock = 1_000_000
  return { pool: new KeyPool(() => clock), tick: (ms: number) => { clock += ms } }
}

test('revezamento: cada chamada começa numa key diferente', () => {
  const { pool: p } = pool()
  assert.deepEqual([p.order(['a', 'b', 'c'])[0], p.order(['a', 'b', 'c'])[0], p.order(['a', 'b', 'c'])[0]], ['a', 'b', 'c'])
  assert.deepEqual(p.order(['so']), ['so'])
})

test('key recusada vai para o fim por 5 minutos e volta sozinha', () => {
  const { pool: p, tick } = pool()
  assert.equal(p.rest('a', 'refused'), true, 'primeira recusa')
  assert.equal(p.rest('a', 'refused'), false, 'a mesma key de novo não conta como nova')
  for (let i = 0; i < 3; i++) assert.equal(p.order(['a', 'b', 'c']).at(-1), 'a')
  tick(5 * 60_000 + 1)
  assert.equal(p.isResting('a'), false)
  assert.ok(['a', 'b', 'c'].map(() => p.order(['a', 'b', 'c'])[0]).includes('a'), 'voltou ao revezamento')
})

test('key no limite descansa o retry-after (até 60 s) e a que responde bem volta na hora', () => {
  const { pool: p, tick } = pool()
  p.rest('a', 'limit', 3)
  tick(2000); assert.equal(p.isResting('a'), true)
  tick(1500); assert.equal(p.isResting('a'), false)
  p.rest('b', 'limit', 9999)
  tick(61_000); assert.equal(p.isResting('b'), false, 'nunca mais que 60 s')
  p.rest('c', 'refused'); p.ok('c')
  assert.equal(p.isResting('c'), false)
})

test('todas descansando: nenhuma sai da fila, a que volta primeiro vem na frente', () => {
  const { pool: p } = pool()
  p.rest('a', 'refused'); p.rest('b', 'limit', 2); p.rest('c', 'limit', 30)
  const order = p.order(['a', 'b', 'c'])
  assert.deepEqual(order, ['b', 'c', 'a'])
})

test('o log mostra só o final da key', () => {
  assert.equal(keyHint('sk-segredo-2959'), '…2959')
})

test('saúde por key: conta respostas, mostra só o final e o descanso com hora de volta', () => {
  const { pool: p, tick } = pool()
  assert.equal(p.health(['sk-nova-0001'])[0].state, 'unknown')
  p.record('sk-boa-1111', 200, 812.4)
  p.record('sk-boa-1111', 200, 300)
  p.record('sk-ruim-2222', 503, 90)
  const [boa, ruim] = p.health(['sk-boa-1111', 'sk-ruim-2222'])
  assert.deepEqual([boa.hint, boa.state, boa.ok, boa.failed, boa.lastLatencyMs], ['…1111', 'ok', 2, 0, 300])
  assert.deepEqual([ruim.state, ruim.lastStatus, ruim.failed], ['error', 503, 1])
  assert.ok(!JSON.stringify(p.health(['sk-boa-1111'])).includes('sk-boa'), 'nunca a key inteira')
  // record() só anota: quem descansa a key é o gateway (rest) ou o teste do admin (checked).
  p.record('sk-seca-3333', 402)
  assert.equal(p.isResting('sk-seca-3333'), false)
  p.checked('sk-seca-3333', 402, 50)
  const seca = p.health(['sk-seca-3333'])[0]
  assert.equal(seca.state, 'refused')
  assert.ok(seca.restingUntil && seca.lastCheckAt)
  p.checked('sk-limite-4444', 429, 10, 3)
  assert.equal(p.health(['sk-limite-4444'])[0].state, 'limit')
  tick(3500)
  assert.equal(p.health(['sk-limite-4444'])[0].state, 'error', 'passou o descanso: volta a ser usada, mas a última resposta foi erro')
  p.checked('sk-seca-3333', 200, 40)
  assert.equal(p.health(['sk-seca-3333'])[0].state, 'ok', 'respondeu bem no teste: sai do descanso na hora')
})

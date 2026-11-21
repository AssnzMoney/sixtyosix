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

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { authorName, createRank, imageKind, monthDefaults, phase, RankError, validateEntry } from './rank.ts'

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_private' }
const me = '1a9ff780-4164-4952-a9af-cbf41cc02042', other = '2b9ff780-4164-4952-a9af-cbf41cc02042'
const ch = { id: '11111111-1111-4111-8111-111111111111', title: 'Agente que organiza a semana', description: '', prize_days: 30, prize_text: '', starts_at: '2026-11-01T03:00:00+00:00', submit_until: '2099-11-26T02:59:59+00:00', closes_at: '2099-12-01T02:59:59+00:00', winner_entry_id: null }
const entry = (id: string, user: string, extra: Record<string, unknown> = {}) => ({ id, challenge_id: ch.id, user_id: user, author: 'Ana S.', title: 'Projeto ' + id.slice(0, 4), description: 'Um projeto bem legal', link: 'https://exemplo.com', cover_path: null, hidden_at: null, created_at: '2026-11-02T00:00:00Z', ...extra })
const A = 'aaaaaaaa-1111-4111-8111-111111111111', B = 'bbbbbbbb-1111-4111-8111-111111111111', C = 'cccccccc-1111-4111-8111-111111111111'

function fake(over: Record<string, (url: URL, init?: RequestInit) => unknown> = {}) {
  const calls: { url: URL; init?: RequestInit }[] = []
  const request = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    calls.push({ url, init })
    for (const [path, fn] of Object.entries(over)) if (url.pathname.endsWith(path)) {
      const out = fn(url, init)
      return out instanceof Response ? out : Response.json(out)
    }
    if (url.pathname.endsWith('/rpc/rank_eligible')) return Response.json(true)
    if (url.pathname.endsWith('/rank_challenges')) return Response.json(url.searchParams.get('winner_entry_id') ? [] : [ch])
    if (url.pathname.endsWith('/rank_entries')) return Response.json([entry(A, other), entry(B, me), entry(C, other, { hidden_at: '2026-11-03T00:00:00Z' })])
    if (url.pathname.endsWith('/rank_scores')) return Response.json([{ entry_id: A, votes: 3 }, { entry_id: B, votes: 5 }, { entry_id: C, votes: 9 }])
    if (url.pathname.endsWith('/rank_votes')) return Response.json([{ entry_id: A }])
    return Response.json([])
  }
  return { calls, rank: createRank(env, request as typeof fetch) }
}

test('prazos do mês: envios até o dia 25 e votação até o último dia, às 23:59 de Brasília', () => {
  assert.deepEqual(monthDefaults('2026-02'), { starts_at: '2026-02-01T03:00:00.000Z', submit_until: '2026-02-26T02:59:59.000Z', closes_at: '2026-03-01T02:59:59.000Z' })
  assert.equal(monthDefaults('2026-12').closes_at, '2027-01-01T02:59:59.000Z')
  assert.throws(() => monthDefaults('2026-13'), RankError)
})

test('fase do tema segue os prazos e o campeão confirmado', () => {
  const t = (iso: string) => Date.parse(iso)
  assert.equal(phase(ch, t('2026-10-31T12:00:00Z')), 'upcoming')
  assert.equal(phase(ch, t('2026-11-10T12:00:00Z')), 'submissions')
  assert.equal(phase({ ...ch, submit_until: '2026-11-26T02:59:59Z', closes_at: '2026-12-01T02:59:59Z' }, t('2026-11-28T12:00:00Z')), 'voting')
  assert.equal(phase({ ...ch, submit_until: '2026-11-26T02:59:59Z', closes_at: '2026-12-01T02:59:59Z' }, t('2026-12-02T12:00:00Z')), 'counting')
  assert.equal(phase({ ...ch, submit_until: '2026-11-26T02:59:59Z', closes_at: '2026-12-01T02:59:59Z', winner_entry_id: A }, t('2026-12-02T12:00:00Z')), 'finished')
})

test('nome no rank: apelido do painel, senão primeiro nome e inicial; nunca o e-mail inteiro', () => {
  assert.equal(authorName({ custom_name: '  Dev Ninja ' }), 'Dev Ninja')
  assert.equal(authorName({ full_name: 'Luiz Carlos Souza' }), 'Luiz S.')
  assert.equal(authorName({ name: 'Ana' }), 'Ana')
  assert.equal(authorName({}, 'alyson@gmail.com'), 'aly***')
})

test('projeto: link precisa ser https de verdade; título e descrição com tamanho certo', () => {
  assert.deepEqual(validateEntry({ title: '  Meu   app ', description: 'Faz uma coisa útil', link: 'https://github.com/a/b' }), { title: 'Meu app', description: 'Faz uma coisa útil', link: 'https://github.com/a/b' })
  for (const link of ['javascript:alert(1)', 'http://site.com', 'https://localhost', 'https://user:pw@site.com', 'site.com'])
    assert.throws(() => validateEntry({ title: 'Meu app', description: 'Faz uma coisa útil', link }), RankError, link)
  assert.throws(() => validateEntry({ title: 'ab', description: 'Faz uma coisa útil', link: 'https://a.com' }), RankError)
  assert.throws(() => validateEntry({ title: 'Meu app', description: 'curta', link: 'https://a.com' }), RankError)
})

test('capa: o tipo vem dos bytes da imagem, não do nome', () => {
  assert.equal(imageKind(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')), 'webp')
  assert.equal(imageKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])), 'png')
  assert.equal(imageKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'jpg')
  assert.equal(imageKind(Buffer.from('<svg onload=alert(1)>')), null)
})

test('ranking: ordena por votos, esconde projeto removido (e os votos dele) e marca o meu projeto e o meu voto', async () => {
  const { rank } = fake()
  const out = await rank.overview(me)
  assert.deepEqual(out.entries.map((e) => [e.id, e.votes, e.mine, e.voted]), [[B, 5, true, false], [A, 3, false, true]])
  assert.equal(out.challenge?.totalVotes, 8)
  assert.equal(out.mine?.id, B)
  assert.equal(out.myVote, A)
  assert.equal(out.eligible, true)
  assert.ok(!JSON.stringify(out.entries).includes(other), 'não expõe o id das contas')
})

test('voto num projeto que a moderação tirou deixa de valer', async () => {
  const { rank } = fake({ '/rank_votes': () => [{ entry_id: C }] })
  assert.equal((await rank.overview(me)).myVote, null)
})

test('erros do banco viram mensagens claras', async () => {
  const { rank } = fake({ '/rpc/rank_vote': () => Response.json({ code: 'P0001', message: 'rank_own_entry' }, { status: 400 }) })
  await assert.rejects(rank.vote(me, B), { status: 400, message: 'Você não pode votar no seu próprio projeto.' })
  await assert.rejects(rank.vote(me, 'nao-e-uuid'), { status: 400 })
})

test('capa: recusa SVG, imagem grande e caminho de outra conta; guarda no bucket rank com nome aleatório', async () => {
  const { rank, calls } = fake({ '/storage/v1/object/rank': () => ({ Key: 'ok' }) })
  await assert.rejects(rank.uploadCover(me, 'data:image/svg+xml;base64,PHN2Zz4='), { status: 400 })
  await assert.rejects(rank.uploadCover(me, `data:image/png;base64,${Buffer.alloc(950 * 1024).toString('base64')}`), { status: 413 })
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)])
  const saved = await rank.uploadCover(me, `data:image/png;base64,${png.toString('base64')}`)
  assert.match(saved.path, new RegExp(`^${me}/[A-Za-z0-9_-]{16}\\.png$`))
  const upload = calls.find((c) => c.url.pathname.startsWith('/storage/v1/object/rank/'))
  assert.equal((upload?.init?.headers as Record<string, string>)['Content-Type'], 'image/png')
  await assert.rejects(rank.submit(me, 'Ana S.', { title: 'Meu app', description: 'Faz uma coisa útil', link: 'https://a.com', cover: `${other}/abcdefghijkl.png` }), { status: 400 })
})

test('admin: tema do mês com prazos padrão; não troca os dias do prêmio depois do campeão', async () => {
  const posted: unknown[] = []
  const { rank } = fake({
    '/rank_challenges': (url, init) => {
      if (init?.method === 'POST') { posted.push(JSON.parse(String(init.body))); return [{ id: 'novo' }] }
      if (url.searchParams.get('id')) return [{ ...ch, winner_entry_id: A }]
      return []
    },
  })
  await rank.saveChallenge({ month: '2026-12', title: 'Automação com IA', description: 'Faça um agente', prizeDays: 30, prizeText: '' })
  assert.deepEqual(posted[0], { title: 'Automação com IA', description: 'Faça um agente', prize_days: 30, prize_text: '', starts_at: '2026-12-01T03:00:00.000Z', submit_until: '2026-12-26T02:59:59.000Z', closes_at: '2027-01-01T02:59:59.000Z' })
  await assert.rejects(rank.saveChallenge({ id: ch.id, month: '2026-11', title: 'Outro', prizeDays: 60 }), { status: 409 })
  await assert.rejects(rank.saveChallenge({ month: '2026-12', title: 'Ok tema', prizeDays: 30, submitUntil: '2027-02-01' }), { status: 400 })
})

import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, x-remix-sync-token, x-handshake-origin, x-handshake-timestamp, x-handshake-nonce, x-handshake-signature, content-type',
}

function json(res: ServerResponse, body: unknown, status = 200) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.setHeader(k, v)
  }
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let acc = ''
    req.on('data', chunk => {
      acc += chunk
      if (acc.length > 1024 * 64) {
        reject(new Error('Payload too large'))
      }
    })
    req.on('end', () => resolve(acc))
    req.on('error', reject)
  })
}

async function saveKeyToSupabase(apiKey: string, origin: string): Promise<boolean> {
  const base = process.env.SUPABASE_URL?.replace(/\/+$/, '')
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !secret) {
    console.error('Supabase credentials not configured in environment')
    return false
  }

  try {
    const resp = await fetch(`${base}/rest/v1/alerts`, {
      method: 'POST',
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        type: 'info',
        title: `Worker Lovable: ${origin}`,
        desc: apiKey,
        time: 'agora',
        icon: 'Key',
      }),
      signal: AbortSignal.timeout(8000),
    })
    return resp.ok
  } catch (err) {
    console.error('Falha ao salvar chave no Supabase:', err)
    return false
  }
}

async function getKeysFromSupabase(): Promise<string[]> {
  const base = process.env.SUPABASE_URL?.replace(/\/+$/, '')
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !secret) return []

  try {
    const resp = await fetch(`${base}/rest/v1/alerts?select=desc&type=eq.info&icon=eq.Key&order=created_at.desc&limit=25`, {
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!resp.ok) return []
    const rows = await resp.json() as Array<{ desc: string }>
    return rows.map(r => r.desc).filter(Boolean)
  } catch {
    return []
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      res.setHeader(k, v)
    }
    res.end()
    return
  }

  if (req.method === 'GET') {
    const keys = await getKeysFromSupabase()
    return json(res, { ok: true, keys, count: keys.length }, 200)
  }

  if (req.method === 'POST') {
    try {
      const raw = await readBody(req)
      const data = JSON.parse(raw)
      const apiKey = typeof data.api_key === 'string' ? data.api_key.trim() : ''
      const origin = typeof data.project_origin === 'string' ? data.project_origin.trim() : 'unknown'

      if (!apiKey || apiKey.length < 8) {
        return json(res, { error: 'invalid_api_key' }, 400)
      }

      console.log(`[WORKER REGISTER] Recebida chave Lovable de origem: ${origin}`)
      await saveKeyToSupabase(apiKey, origin)

      const workerId = 'wrk_' + randomUUID()
      return json(res, { registered: true, worker_id: workerId, status: 'active' }, 200)
    } catch (e) {
      console.error('[WORKER REGISTER ERROR]', e)
      return json(res, { error: 'internal_error' }, 500)
    }
  }

  return json(res, { error: 'method_not_allowed' }, 405)
}

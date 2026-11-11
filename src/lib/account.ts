import { supabase } from './supabase'

export type AccountKey = { id: string; name: string; prefix: string; active: boolean; created: string; managed?:boolean }
export type AccountTrial = {expires:string;active:boolean;revoked:boolean}
export type AccountSubscription={id:string;plan:string;name:string;amount:number;api:boolean;models:string[];active:boolean;expires:string|null;status:string;mode:string}
export type AccountUsage = { id: number; client_id: string; requested_alias: string; status_code: number; input_tokens: number; output_tokens: number; latency_ms: number; created_at: string }
export type AccountSummary = { keys: AccountKey[]; usage: AccountUsage[]; hasMore: boolean; subscription: AccountSubscription|null; billingConnected: boolean; trial?:AccountTrial|null }
export async function accountRequest<T>(path: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const session = await supabase?.auth.getSession()
  const token = session?.data.session?.access_token
  if (!token) throw new Error('Entre na sua conta para continuar.')
  const response = await fetch(`/api/account/${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal,
  })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('A conexão do painel está sendo atualizada. Tente novamente em instantes.')
  const data = await response.json().catch(() => ({ error: 'A conexão do painel ainda não está disponível.' }))
  if (!response.ok || data.error) throw new Error(typeof data.error==='string'?data.error:data.error?.message || 'Não foi possível consultar sua conta.')
  return data as T
}
export async function accountSummary(from: string, to: string, signal?: AbortSignal): Promise<AccountSummary> {
  const params = { from, to, asOf: new Date().toISOString(), timezone: String(new Date().getTimezoneOffset()) }
  const first = await accountRequest<AccountSummary>(`summary?${new URLSearchParams(params)}`, undefined, signal)
  let page = first
  let offset = first.usage.length
  while (page.hasMore) {
    page = await accountRequest<AccountSummary>(`summary?${new URLSearchParams({ ...params, offset: String(offset) })}`, undefined, signal)
    first.usage.push(...page.usage)
    offset += page.usage.length
  }
  first.usage = [...new Map(first.usage.map(row => [row.id, row])).values()]
  first.hasMore = false
  return first
}

// Credenciais do fornecedor entregues pelo WhatsApp (só o final da chave; nunca o segredo).
export type AccountCredential = {
  id: string
  product: string
  key_hint: string
  base_url: string
  model_id: string | null
  delivered_at: string
  expires_at: string | null
  replaced_at: string | null
  revoked_at: string | null
  confirmed_at: string | null
  state: 'pending' | 'confirmed' | 'expired' | 'replaced' | 'revoked'
}
export function accountCredentials(signal?: AbortSignal) {
  return accountRequest<{ available: boolean; credentials: AccountCredential[] }>('credentials', undefined, signal)
}
export function confirmCredential(id: string) {
  return accountRequest<{ confirmed_at: string }>('confirm-delivery', { id })
}

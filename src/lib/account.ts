import { supabase } from './supabase'

export type AccountKey = { id: string; name: string; prefix: string; active: boolean; created: string; managed?:boolean; expires?:string|null }
export type AccountTrial = {expires:string;active:boolean;revoked:boolean;models?:string[]}
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

/** Chave entregue pelo site (server/auto-key.ts). O segredo só vem quando o cliente pede para ver. */
export type SiteKeyStatus =
  | { ready: true; prefix: string; expires: string; blocked: boolean; models: string[] | null; revealed: string | null }
  | { ready: false; reason: 'sem_plano' | 'vencida' | 'preparando' }
export type SiteKeySecret = { key: string; expires: string; models: string[] | null }
export function siteKeyStatus(signal?: AbortSignal) {
  return accountRequest<SiteKeyStatus>('site-key', undefined, signal)
}
export function revealSiteKey() {
  return accountRequest<SiteKeySecret>('site-key-reveal', {})
}
export function rotateSiteKey() {
  return accountRequest<SiteKeySecret>('site-key-rotate', {})
}

/** Endereços (IPs) que usaram a chave. `current`: IP de quem está no painel agora. */
export type SiteKeyIp = { ip: string; device: string | null; firstSeen: string; lastSeen: string; requests: number; state: 'em_uso' | 'liberado' | 'recusado' | 'bloqueado'; here: boolean }
export type SiteKeyIps = { current: string | null; inUse: string | null; maxIps: number | null; items: SiteKeyIp[] }
export function siteKeyIps(signal?: AbortSignal) {
  return accountRequest<SiteKeyIps>('site-key-ips', undefined, signal)
}
export function removeSiteKeyIp(ip: string) {
  return accountRequest<{ ok: true }>('site-key-ip-remove', { ip })
}

/** Mostra uma chave do Roteador ligada à conta (ex.: teste grátis vinculado pelo admin). */
export function revealLinkedKey(id: string) {
  return accountRequest<{ key: string; expires: string }>('key-reveal', { id })
}

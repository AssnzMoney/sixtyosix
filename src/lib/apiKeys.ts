import { accountRequest, accountSummary } from './account'
export interface ApiKeyItem { id: string; name: string; keyPrefix: string; fullKey?: string; createdAt: string; lastUsedAt?: string | null; isActive: boolean }
export async function getApiKeys(_userId?: string): Promise<ApiKeyItem[]> {
  const day = new Date().toISOString().slice(0,10)
  const data = await accountSummary(day,day)
  return data.keys.map(k => ({ id:k.id, name:k.name, keyPrefix:k.prefix, createdAt:k.created, isActive:k.active }))
}
export async function createApiKey(_userId: string, name: string) {
  const result = await accountRequest<{key:string;created:string}>('keys',{name})
  return { fullKey:result.key, key:{id:result.created,name,keyPrefix:result.key.slice(0,14),createdAt:new Date().toISOString(),isActive:true} as ApiKeyItem }
}
export async function revokeApiKey(_userId: string, id: string) { await accountRequest('revoke',{id}) }

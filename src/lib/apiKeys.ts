import { supabase, isSupabaseConfigured } from './supabase'

export interface ApiKeyItem {
  id: string
  name: string
  keyPrefix: string
  fullKey?: string // apenas visível no momento da criação
  createdAt: string
  lastUsedAt?: string | null
  isActive: boolean
}

const LOCAL_STORAGE_KEYS_PREFIX = 'sixtysix_api_keys_'

export const getApiKeys = async (userId: string): Promise<ApiKeyItem[]> => {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        return data.map((k) => ({
          id: k.id,
          name: k.name,
          keyPrefix: k.key_prefix,
          createdAt: k.created_at,
          lastUsedAt: k.last_used_at,
          isActive: k.is_active,
        }))
      }
    } catch {
      // Fallback para armazenamento local
    }
  }

  // Fallback persistente local para funcionamento imediato
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEYS_PREFIX}${userId}`)
    if (raw) return JSON.parse(raw)
  } catch {
    // vazio
  }

  // Chave padrão inicial pronta para uso imediato
  const defaultInitialKeys: ApiKeyItem[] = [
    {
      id: 'key-default-1',
      name: 'Chave Padrão (Cursor & Claude)',
      keyPrefix: 'sk-live-66-9a2f••••••••',
      fullKey: 'sk-live-66-9a2f7c41b8e05d39f',
      createdAt: new Date().toISOString(),
      lastUsedAt: 'Agora mesmo',
      isActive: true,
    },
  ]
  localStorage.setItem(
    `${LOCAL_STORAGE_KEYS_PREFIX}${userId}`,
    JSON.stringify(defaultInitialKeys)
  )
  return defaultInitialKeys
}

export const createApiKey = async (
  userId: string,
  name: string
): Promise<{ key: ApiKeyItem; fullKey: string }> => {
  // Gera chave única SixtySix: sk-live-66-xxxx
  const randHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const fullKey = `sk-live-66-${randHex}`
  const keyPrefix = `${fullKey.slice(0, 16)}••••••••`

  const newKeyItem: ApiKeyItem = {
    id: `key-${Date.now()}`,
    name: name.trim() || 'Nova Chave IDE',
    keyPrefix,
    fullKey,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    isActive: true,
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('api_keys').insert({
        user_id: userId,
        name: newKeyItem.name,
        key_prefix: keyPrefix,
        key_hash: randHex,
        is_active: true,
      })
    } catch {
      // Fallback silencioso
    }
  }

  try {
    const current = await getApiKeys(userId)
    const updated = [newKeyItem, ...current]
    localStorage.setItem(
      `${LOCAL_STORAGE_KEYS_PREFIX}${userId}`,
      JSON.stringify(updated)
    )
  } catch {
    // vazio
  }

  return { key: newKeyItem, fullKey }
}

export const revokeApiKey = async (userId: string, keyId: string): Promise<void> => {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('api_keys').delete().eq('id', keyId).eq('user_id', userId)
    } catch {
      // Fallback
    }
  }

  try {
    const current = await getApiKeys(userId)
    const updated = current.filter((k) => k.id !== keyId)
    localStorage.setItem(
      `${LOCAL_STORAGE_KEYS_PREFIX}${userId}`,
      JSON.stringify(updated)
    )
  } catch {
    // vazio
  }
}


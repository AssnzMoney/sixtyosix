export function normalizeDisplayName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ')
  if (!name || name.length > 30 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error('Escolha um nome ou apelido de 1 a 30 caracteres.')
  }
  return name
}

export function savedDisplayName(metadata: Record<string, unknown>): string {
  if (typeof metadata.custom_name !== 'string') return ''
  try { return normalizeDisplayName(metadata.custom_name) } catch { return '' }
}

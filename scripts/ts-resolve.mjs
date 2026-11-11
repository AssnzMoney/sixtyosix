// Usado só nos testes locais (node --test): as funções em api/ importam módulos
// com ".js" (padrão do deploy no Vercel). Aqui, se o ".js" não existir, tenta o ".ts".
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && specifier.endsWith('.js')) {
      return nextResolve(`${specifier.slice(0, -3)}.ts`, context)
    }
    throw error
  }
}

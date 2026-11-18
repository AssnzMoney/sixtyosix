// Só para testes locais do arquivo real da ponte Lovable.
// "zod" vem de uma pasta temporária (SIX_ZOD_DIR) e o import do projeto Lovable vira um stub.
import { pathToFileURL } from 'node:url'

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/six-test-bridge.server') {
    return { url: new URL('./stub-six-test-bridge.ts', import.meta.url).href, shortCircuit: true }
  }
  if (specifier === 'zod' && process.env.SIX_ZOD_DIR) {
    return nextResolve(specifier, { ...context, parentURL: pathToFileURL(process.env.SIX_ZOD_DIR + '/').href })
  }
  return nextResolve(specifier, context)
}

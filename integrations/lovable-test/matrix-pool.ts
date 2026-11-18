import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const accountsDir = join(process.cwd(), 'integrations/lovable-test/accounts')
const matrizesFile = join(accountsDir, 'matrizes_remix.txt')
const matrizesMortasFile = join(accountsDir, 'matrizes_remix_mortas.txt')
const bridgesFile = join(process.cwd(), 'integrations/lovable-test/bridges.txt')

export function getBridgePool(): string[] {
    const fromEnv = process.env.SIX_TEST_BRIDGE_URLS
        ? process.env.SIX_TEST_BRIDGE_URLS.split(',').map(s => s.trim()).filter(Boolean)
        : []
    if (fromEnv.length > 0) return fromEnv

    if (existsSync(bridgesFile)) {
        try {
            const lines = readFileSync(bridgesFile, 'utf8')
                .split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('#'))
            if (lines.length > 0) return lines
        } catch { }
    }
    return [process.env.SIX_TEST_BRIDGE_URL || 'https://bright-byte-bulletin.lovable.app/api/public/six-test/v1']
}

let roundRobinIndex = 0

export function carregarMatrizes(): string[] {
    if (!existsSync(matrizesFile)) return []
    try {
        return readFileSync(matrizesFile, 'utf8')
            .split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('#'))
    } catch {
        return []
    }
}

export function sortearMatriz(): string | null {
    const matrizes = carregarMatrizes()
    if (matrizes.length === 0) return null
    const escolhida = matrizes[roundRobinIndex % matrizes.length]
    roundRobinIndex = (roundRobinIndex + 1) % matrizes.length
    return escolhida
}

export function registrarNovaMatriz(projectId: string): boolean {
    const idLimpo = projectId.trim()
    if (!idLimpo || idLimpo.length < 10) return false
    const matrizes = carregarMatrizes()
    if (matrizes.includes(idLimpo)) return false

    try {
        appendFileSync(matrizesFile, idLimpo + '\n')
        console.log(`[ÁRVORE MATRIX] Novo projeto adicionado ao pool de matrizes: ${idLimpo} (Total: ${matrizes.length + 1})`)
        return true
    } catch {
        return false
    }
}

export function marcarMatrizMorta(projectId: string, motivo: string = 'falha'): void {
    const idLimpo = projectId.trim()
    const matrizes = carregarMatrizes()
    const restantes = matrizes.filter(m => m !== idLimpo)
    
    try {
        writeFileSync(matrizesFile, '# Pool vivo de Matrizes Públicas da Lovable\n' + restantes.join('\n') + '\n')
        appendFileSync(matrizesMortasFile, `${idLimpo} # ${new Date().toISOString()} - ${motivo}\n`)
        console.log(`[ÁRVORE MATRIX] Matriz ${idLimpo} marcada como morta (${motivo}). Restantes: ${restantes.length}`)
    } catch (e) {
        console.error('[ÁRVORE MATRIX] Erro ao marcar matriz morta:', e)
    }
}

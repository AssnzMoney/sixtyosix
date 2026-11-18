#!/usr/bin/env node
import { carregarMatrizes, sortearMatriz, registrarNovaMatriz, marcarMatrizMorta, getBridgePool } from './matrix-pool.ts'

const [,, cmd, arg1, arg2] = process.argv

console.log('═══════════════════════════════════════════════════════════')
console.log('       SIX GATEWAY — GERENCIADOR DE POOL & MATRIZES         ')
console.log('═══════════════════════════════════════════════════════════\n')

switch (cmd) {
    case 'status':
    case undefined: {
        const bridges = getBridgePool()
        const matrizes = carregarMatrizes()
        console.log(`🌐 Pontes Ativas no Pool (${bridges.length}):`)
        bridges.forEach((b, i) => console.log(`   [${i + 1}] ${b}`))
        console.log(`\n🌱 Matrizes de Remix Disponíveis (${matrizes.length}):`)
        matrizes.forEach((m, i) => console.log(`   [${i + 1}] ${m} -> https://lovable.dev/projects/${m}/remix`))
        console.log('\nComandos disponíveis:')
        console.log('  node --import ./scripts/test-register.mjs integrations/lovable-test/gerenciar-pool.ts proxima')
        console.log('  node --import ./scripts/test-register.mjs integrations/lovable-test/gerenciar-pool.ts add-matriz <project_id>')
        console.log('  node --import ./scripts/test-register.mjs integrations/lovable-test/gerenciar-pool.ts mata-matriz <project_id> [motivo]')
        break
    }
    case 'proxima': {
        const m = sortearMatriz()
        if (!m) {
            console.log('❌ Nenhuma matriz cadastrada em accounts/matrizes_remix.txt')
        } else {
            console.log(`🎯 Matriz sorteada (Round-Robin): ${m}`)
            console.log(`👉 Link direto para Remix: https://lovable.dev/projects/${m}/remix`)
        }
        break
    }
    case 'add-matriz': {
        if (!arg1) {
            console.log('❌ Informe o ID do projeto Lovable. Exemplo: add-matriz 448b5334-3b25-4ed6-9e4d-b6ce9035dd07')
        } else {
            const ok = registrarNovaMatriz(arg1)
            console.log(ok ? `✅ Matriz ${arg1} adicionada com sucesso ao pool!` : `⚠️ Matriz ${arg1} já existe ou é inválida.`)
        }
        break
    }
    case 'mata-matriz': {
        if (!arg1) {
            console.log('❌ Informe o ID do projeto a ser desativado.')
        } else {
            marcarMatrizMorta(arg1, arg2 || 'manual')
            console.log(`🚫 Matriz ${arg1} desativada e movida para matrizes_remix_mortas.txt`)
        }
        break
    }
    default:
        console.log(`Comando desconhecido: ${cmd}`)
}
console.log('')

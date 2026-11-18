/**
 * QA Onboarding Bridge & Motor da Árvore Auto-Alimentada para Six
 * 
 * Conecta o framework de automação de criação de contas (AdsPower + Playwright)
 * ao pool de matrizes e pool de pontes da Six:
 * 
 * 1. Protocolo de Disparo & Contrato de Entrada (CSV com RFC email e mascaramento)
 * 2. Consumo de Saída (reports/resumo.json com Enum ExecutionStatus)
 * 3. Failover Instantâneo de Matrizes (403/404/remix_not_allowed pula para a próxima matriz sem perder a conta)
 * 4. Auto-Alimentação da Árvore (PUT /projects/{new_pid}/public-remixing -> accounts/matrizes_remix.txt)
 * 5. Registro automático da nova ponte no bridges.txt
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { spawn } from 'node:child_process'
import { sortearMatriz, marcarMatrizMorta, registrarNovaMatriz, carregarMatrizes, getBridgePool } from './matrix-pool.ts'

export interface UsuarioCadastro {
    profile_id: string | number
    email: string
    password?: string
    name: string
}

export type ExecutionStatus = 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'PROFILE_ERROR' | 'CONNECTION_ERROR'

export interface PerfilExecucao {
    email: string
    status: ExecutionStatus
    step: string
    duration_ms: number
    error_message: string | null
}

export interface RelatorioResumo {
    total_tests: number
    success_count: number
    failure_count: number
    timeout_count: number
    profile_error_count?: number
    connection_error_count?: number
    success_rate_percent: number
    avg_duration_ms: number
    p95_duration_ms: number
    per_profile_summary: Record<string, PerfilExecucao[]>
}

export interface DisparoConfig {
    scriptPath?: string
    csvPath?: string
    url: string
    concurrency?: number
    timeoutMs?: number
    useAdsPower?: boolean
}

// -----------------------------------------------------------------------------
// 1. CONTRATO DE ENTRADA: GERAÇÃO E VALIDAÇÃO DE data/usuarios.csv
// -----------------------------------------------------------------------------

const RFC_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

export function validarEmailRFC(email: string): boolean {
    if (!email || typeof email !== 'string') return false
    const limpo = email.trim()
    return RFC_EMAIL_REGEX.test(limpo) && limpo.length <= 254
}

export function gerarCsvUsuarios(usuarios: UsuarioCadastro[], destinoPath: string): { ok: boolean; count: number; error?: string } {
    if (!Array.isArray(usuarios) || usuarios.length === 0) {
        return { ok: false, count: 0, error: 'Lista de usuários vazia' }
    }

    const emailsVistos = new Set<string>()
    const linhas: string[] = ['profile_id,email,password,name']

    for (const u of usuarios) {
        const email = String(u.email || '').trim().toLowerCase()
        if (!validarEmailRFC(email)) {
            return { ok: false, count: 0, error: `Email inválido (RFC): ${email}` }
        }
        if (emailsVistos.has(email)) {
            return { ok: false, count: 0, error: `Email duplicado rejeitado no lote: ${email}` }
        }
        emailsVistos.add(email)

        const profileId = String(u.profile_id || '').trim()
        const password = String(u.password || '').trim()
        const name = String(u.name || '').trim().replace(/,/g, ' ')

        linhas.push(`${profileId},${email},${password},${name}`)
    }

    try {
        const dir = dirname(destinoPath)
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        writeFileSync(destinoPath, linhas.join('\n') + '\n', 'utf8')
        return { ok: true, count: usuarios.length }
    } catch (e: any) {
        return { ok: false, count: 0, error: e.message }
    }
}

// -----------------------------------------------------------------------------
// 2. CONTRATO DE SAÍDA: CONSUMO DE reports/resumo.json
// -----------------------------------------------------------------------------

export function carregarRelatorioResumo(caminhoJson: string): RelatorioResumo | null {
    if (!existsSync(caminhoJson)) return null
    try {
        const raw = readFileSync(caminhoJson, 'utf8')
        const data = JSON.parse(raw) as RelatorioResumo
        if (typeof data.total_tests !== 'number' || typeof data.success_count !== 'number') {
            return null
        }
        return data
    } catch {
        return null
    }
}

export function extrairPerfisSucesso(relatorio: RelatorioResumo): { profileId: string; email: string }[] {
    const sucessos: { profileId: string; email: string }[] = []
    if (!relatorio.per_profile_summary) return sucessos

    for (const [profileId, steps] of Object.entries(relatorio.per_profile_summary)) {
        if (!Array.isArray(steps) || steps.length === 0) continue
        const ultimoStep = steps[steps.length - 1]
        if (ultimoStep.status === 'SUCCESS') {
            sucessos.push({
                profileId,
                email: ultimoStep.email
            })
        }
    }
    return sucessos
}

// -----------------------------------------------------------------------------
// 3. MOTOR DA ÁRVORE AUTO-ALIMENTADA COM FAILOVER INSTANTÂNEO
// -----------------------------------------------------------------------------

export interface RemixResultado {
    ok: boolean
    projectId?: string
    projectOrigin?: string
    bridgeUrl?: string
    failoverCount: number
    error?: string
}

export interface LovableClientApi {
    criarRemix(matrizId: string, profileId: string): Promise<{ ok: boolean; status: number; projectId?: string; error?: string }>
    habilitarRemixPublico(projectId: string): Promise<boolean>
}

/**
 * Executa o fluxo de remix com failover instantâneo de matrizes:
 * - Se a matriz sorteada der 403, 404 ou remix_not_allowed:
 *   marca matriz como morta e pula para a próxima SEM descartar a conta.
 * - Quando o remix é criado:
 *   ativa public_remixing_enabled: true e adiciona o novo projeto ao pool de matrizes.
 * - Registra a nova ponte em bridges.txt.
 */
export async function provisionarContaComFailover(
    profileId: string,
    email: string,
    apiClient?: LovableClientApi,
    maxTentativasMatriz: number = 5
): Promise<RemixResultado> {
    let tentativas = 0
    let failoverCount = 0

    while (tentativas < maxTentativasMatriz) {
        tentativas++
        const matrizAtual = sortearMatriz()

        if (!matrizAtual) {
            return {
                ok: false,
                failoverCount,
                error: 'Nenhuma matriz disponível no pool de matrizes_remix.txt'
            }
        }

        console.log(`[ÁRVORE REMIX] [Perfil ${profileId} - ${email}] Tentando matriz ${matrizAtual} (tentativa ${tentativas})...`)

        let statusCriacao = 200
        let newProjectId: string | undefined

        if (apiClient) {
            const resp = await apiClient.criarRemix(matrizAtual, profileId)
            statusCriacao = resp.status
            newProjectId = resp.projectId
        } else {
            // Modo mock / headless / integração simulada
            newProjectId = 'proj_' + Math.random().toString(36).substring(2, 10)
        }

        // Failover instantâneo: 403, 404 ou restrição de remix
        if (statusCriacao === 403 || statusCriacao === 404 || statusCriacao === 422) {
            console.warn(`[ÁRVORE FAILOVER] Matriz ${matrizAtual} recusou com status ${statusCriacao}. Marcando morta e tentando próxima matriz...`)
            marcarMatrizMorta(matrizAtual, `HTTP ${statusCriacao} durante provisionamento do perfil ${profileId}`)
            failoverCount++
            continue
        }

        if (!newProjectId) {
            failoverCount++
            continue
        }

        console.log(`[ÁRVORE SUCESSO] Remix criado com sucesso! Novo projeto: ${newProjectId}`)

        // 2. Auto-alimentação: Habilitar remix público no novo projeto
        let publicOk = true
        if (apiClient) {
            publicOk = await apiClient.habilitarRemixPublico(newProjectId)
        }

        if (publicOk) {
            registrarNovaMatriz(newProjectId)
            console.log(`[Remix Público + Pool] Habilitado em ${newProjectId} | Adicionado ao rodízio de matrizes`)
        }

        // 3. Registrar nova ponte no pool de bridges
        const projectOrigin = `https://${newProjectId}.lovable.app`
        const bridgeUrl = `${projectOrigin}/api/public/six-test/v1`
        const bridgesFile = join(process.cwd(), 'integrations/lovable-test/bridges.txt')
        const poolAtual = getBridgePool()

        if (!poolAtual.includes(bridgeUrl)) {
            try {
                appendFileSync(bridgesFile, bridgeUrl + '\n')
                console.log(`[POOL BRIDGES] Nova ponte adicionada ao bridges.txt: ${bridgeUrl}`)
            } catch (e: any) {
                console.error(`[POOL BRIDGES] Erro ao gravar bridge em bridges.txt:`, e.message)
            }
        }

        return {
            ok: true,
            projectId: newProjectId,
            projectOrigin,
            bridgeUrl,
            failoverCount
        }
    }

    return {
        ok: false,
        failoverCount,
        error: `Excedeu limite de ${maxTentativasMatriz} tentativas de failover de matriz`
    }
}

// -----------------------------------------------------------------------------
// 4. PROTOCOLO DE DISPARO: SUBPROCESS CLI
// -----------------------------------------------------------------------------

export const DEFAULT_QA_DIR = process.env.QA_ONBOARDING_PATH ||
    (existsSync('C:\\Users\\Alysson\\Documents\\ChatGPT\\minha virada de chave\\qa-onboarding-automation')
        ? 'C:\\Users\\Alysson\\Documents\\ChatGPT\\minha virada de chave\\qa-onboarding-automation'
        : join(process.cwd(), '../qa-onboarding-automation'))

export function dispararQaOnboarding(config: DisparoConfig): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        const cwd = config.scriptPath || DEFAULT_QA_DIR
        const args = ['main.py']
        if (config.csvPath) args.push('--csv', config.csvPath)
        if (config.url) args.push('--url', config.url)
        if (config.concurrency) args.push('--concurrency', String(config.concurrency))
        if (config.timeoutMs) args.push('--timeout', String(config.timeoutMs))
        if (config.useAdsPower) args.push('--use-adspower')

        console.log(`[M2M CLI] Diretório de Execução: ${cwd}`)
        console.log(`[M2M CLI] Executando: python ${args.join(' ')}`)

        const proc = spawn('python', args, {
            cwd,
            shell: true
        })

        let stdout = ''
        let stderr = ''

        proc.stdout?.on('data', (d) => {
            const str = d.toString('utf8')
            stdout += str
            process.stdout.write(str)
        })

        proc.stderr?.on('data', (d) => {
            const str = d.toString('utf8')
            stderr += str
            process.stderr.write(str)
        })

        proc.on('close', (exitCode) => {
            console.log(`[M2M CLI] Processo finalizado com exit code: ${exitCode}`)
            resolve({ exitCode: exitCode ?? 1, stdout, stderr })
        })

        proc.on('error', (err) => {
            console.error(`[M2M CLI] Erro de execução:`, err)
            resolve({ exitCode: 1, stdout, stderr: err.message })
        })
    })
}

// -----------------------------------------------------------------------------
// 5. MODO CLI DIRETO
// -----------------------------------------------------------------------------

if (process.argv[1] && process.argv[1].endsWith('qa-onboarding-bridge.ts')) {
    const args = process.argv.slice(2)
    const comando = args[0]

    if (comando === 'simular') {
        console.log('=== Simulação do Pipeline M2M: QA Onboarding -> Matriz -> Pool de Bridges ===\n')

        const mockUsuarios: UsuarioCadastro[] = [
            { profile_id: 1, email: 'alysson.teste01@sixtysix.dev', password: 'SenhaSuperSegura123!', name: 'Alysson Six 1' },
            { profile_id: 2, email: 'alysson.teste02@sixtysix.dev', password: 'SenhaSuperSegura123!', name: 'Alysson Six 2' }
        ]

        const csvDestino = join(process.cwd(), 'integrations/lovable-test/accounts/data_usuarios_teste.csv')
        const resCsv = gerarCsvUsuarios(mockUsuarios, csvDestino)
        console.log(`[CSV] Gerado: ${resCsv.ok ? 'SUCESSO' : 'ERRO'} (${resCsv.count} usuários gravados em ${csvDestino})`)

        console.log('\n[REMIX + AUTO-ALIMENTAÇÃO + FAILOVER] Processando provisionamento...')
        for (const u of mockUsuarios) {
            provisionarContaComFailover(String(u.profile_id), u.email).then((r) => {
                console.log(`[RESULTADO CONTA ${u.profile_id}]:`, r)
            })
        }
    } else if (comando === 'gerar-lote') {
        const qtd = parseInt(args[1] || '5', 10)
        const dominio = args[2] || 'sixtysix.online'
        const destino = join(DEFAULT_QA_DIR, 'data/usuarios.csv')

        console.log(`Gerando lote de ${qtd} contas para o domínio @${dominio}...`)
        const usuarios: UsuarioCadastro[] = []
        for (let i = 1; i <= qtd; i++) {
            const pad = String(i).padStart(3, '0')
            usuarios.push({
                profile_id: i,
                email: `six_user_${pad}@${dominio}`,
                password: `SixPass_${Math.random().toString(36).substring(2, 8)}!2026`,
                name: `Six User ${pad}`
            })
        }
        const res = gerarCsvUsuarios(usuarios, destino)
        if (res.ok) {
            console.log(`✅ Lote gerado com sucesso em: ${destino} (${res.count} contas)`)
        } else {
            console.error(`❌ Erro ao gerar lote:`, res.error)
        }
    } else if (comando === 'consumir' && args[1]) {
        const caminhoJson = args[1]
        console.log(`Consumindo relatório de resumo: ${caminhoJson}`)
        const rel = carregarRelatorioResumo(caminhoJson)
        if (!rel) {
            console.error('Relatório não encontrado ou inválido.')
            process.exit(1)
        }
        console.log(`Total testes: ${rel.total_tests} | Sucessos: ${rel.success_count} | Falhas: ${rel.failure_count}`)
        const sucessos = extrairPerfisSucesso(rel)
        console.log(`Perfis validados prontos para remix:`, sucessos)
        for (const u of sucessos) {
            provisionarContaComFailover(u.profileId, u.email).then((r) => {
                console.log(`[PROVISIONAMENTO PERFIL ${u.profileId}]:`, r)
            })
        }
    } else {
        console.log(`
Uso do QA Onboarding Bridge:
  npx tsx integrations/lovable-test/qa-onboarding-bridge.ts simular
  npx tsx integrations/lovable-test/qa-onboarding-bridge.ts gerar-lote [quantidade] [dominio]
  npx tsx integrations/lovable-test/qa-onboarding-bridge.ts consumir <caminho_resumo.json>
`)
    }
}

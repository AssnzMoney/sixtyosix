import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
    validarEmailRFC,
    gerarCsvUsuarios,
    carregarRelatorioResumo,
    extrairPerfisSucesso,
    provisionarContaComFailover
} from './qa-onboarding-bridge.ts'
import type {
    UsuarioCadastro,
    RelatorioResumo,
    LovableClientApi
} from './qa-onboarding-bridge.ts'
import { carregarMatrizes } from './matrix-pool.ts'

test('Validação de e-mail RFC rigorosa', () => {
    assert.equal(validarEmailRFC('usuario@dominio.com'), true)
    assert.equal(validarEmailRFC('usuario.teste+123@sub.dominio.org'), true)
    assert.equal(validarEmailRFC('invalido'), false)
    assert.equal(validarEmailRFC('@dominio.com'), false)
    assert.equal(validarEmailRFC('usuario@'), false)
    assert.equal(validarEmailRFC('usuario@dominio..com'), false)
})

test('Geração de data/usuarios.csv rejeita duplicidades e valida formato', () => {
    const tmpCsv = join(process.cwd(), 'integrations/lovable-test/accounts/test_temp_usuarios.csv')
    if (existsSync(tmpCsv)) unlinkSync(tmpCsv)

    const duplicados: UsuarioCadastro[] = [
        { profile_id: 1, email: 'user1@teste.com', name: 'User 1' },
        { profile_id: 2, email: 'user1@teste.com', name: 'User 2' },
    ]
    const resDup = gerarCsvUsuarios(duplicados, tmpCsv)
    assert.equal(resDup.ok, false)
    assert.match(resDup.error || '', /duplicado/)

    const validos: UsuarioCadastro[] = [
        { profile_id: 'prof_1', email: 'user1@teste.com', password: 'SecretPassword123!', name: 'User 1' },
        { profile_id: 'prof_2', email: 'user2@teste.com', password: 'SecretPassword456!', name: 'User 2' },
    ]
    const resOk = gerarCsvUsuarios(validos, tmpCsv)
    assert.equal(resOk.ok, true)
    assert.equal(resOk.count, 2)

    const conteudo = readFileSync(tmpCsv, 'utf8')
    assert.match(conteudo, /^profile_id,email,password,name/)
    assert.match(conteudo, /prof_1,user1@teste\.com,SecretPassword123!,User 1/)
    assert.match(conteudo, /prof_2,user2@teste\.com,SecretPassword456!,User 2/)

    if (existsSync(tmpCsv)) unlinkSync(tmpCsv)
})

test('Consumo de reports/resumo.json conforme contrato M2M', () => {
    const mockJsonPath = join(process.cwd(), 'integrations/lovable-test/accounts/test_resumo.json')
    const mockPayload: RelatorioResumo = {
        total_tests: 2,
        success_count: 1,
        failure_count: 1,
        timeout_count: 0,
        success_rate_percent: 50.0,
        avg_duration_ms: 3400,
        p95_duration_ms: 4000,
        per_profile_summary: {
            "1": [
                {
                    email: "sucesso@dominio.com",
                    status: "SUCCESS",
                    step: "COMPLETE",
                    duration_ms: 3200,
                    error_message: null
                }
            ],
            "2": [
                {
                    email: "falha@dominio.com",
                    status: "FAILED",
                    step: "EMAIL_VERIFICATION",
                    duration_ms: 4100,
                    error_message: "Email already registered"
                }
            ]
        }
    }

    writeFileSync(mockJsonPath, JSON.stringify(mockPayload, null, 2), 'utf8')

    const carregado = carregarRelatorioResumo(mockJsonPath)
    assert.ok(carregado)
    assert.equal(carregado.total_tests, 2)
    assert.equal(carregado.success_count, 1)

    const sucessos = extrairPerfisSucesso(carregado)
    assert.equal(sucessos.length, 1)
    assert.equal(sucessos[0].profileId, '1')
    assert.equal(sucessos[0].email, 'sucesso@dominio.com')

    if (existsSync(mockJsonPath)) unlinkSync(mockJsonPath)
})

test('Motor de Remix com failover instantâneo de matriz', async (t) => {
    const matrizesFile = join(process.cwd(), 'integrations/lovable-test/accounts/matrizes_remix.txt')
    const bridgesFile = join(process.cwd(), 'integrations/lovable-test/bridges.txt')
    const mortasFile = join(process.cwd(), 'integrations/lovable-test/accounts/matrizes_remix_mortas.txt')

    const matrizesBackup = readFileSync(matrizesFile, 'utf8')
    const bridgesBackup = readFileSync(bridgesFile, 'utf8')
    const mortasBackup = existsSync(mortasFile) ? readFileSync(mortasFile, 'utf8') : ''

    t.after(() => {
        writeFileSync(matrizesFile, matrizesBackup, 'utf8')
        writeFileSync(bridgesFile, bridgesBackup, 'utf8')
        if (mortasBackup) writeFileSync(mortasFile, mortasBackup, 'utf8')
    })

    let tentativasChamadas = 0

    // Simula API onde a primeira matriz dá 403 e a segunda dá sucesso 200
    const mockApiClient: LovableClientApi = {
        async criarRemix(matrizId: string, profileId: string) {
            tentativasChamadas++
            if (tentativasChamadas === 1) {
                return { ok: false, status: 403, error: 'remix_not_allowed' }
            }
            return { ok: true, status: 200, projectId: 'proj_novo_auto_alimentado_123' }
        },
        async habilitarRemixPublico(projectId: string) {
            return true
        }
    }

    const resultado = await provisionarContaComFailover('prof_test', 'test@six.dev', mockApiClient, 3)

    assert.equal(resultado.ok, true)
    assert.equal(resultado.failoverCount, 1)
    assert.equal(resultado.projectId, 'proj_novo_auto_alimentado_123')

    // Confirma que o novo projeto foi auto-alimentado na lista de matrizes vivas
    const matrizesDepois = carregarMatrizes()
    assert.ok(matrizesDepois.includes('proj_novo_auto_alimentado_123'))
})

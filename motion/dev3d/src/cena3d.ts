import * as THREE from 'three'
import { criarAssistente, criarRafa, type Pose } from './bonecos'
import { CENAS, janelaDaCena, type Cena } from './roteiro'

const FUNDO: Record<Cena, string> = { quarto: '#12162b', chamado: '#1a1f3d', investiga: '#17243a', correcao: '#1b2a3a', deploy: '#14301f', ideia: '#3a2a1a', final: '#d97757' }
const TELA: Record<Cena, string> = { quarto: '#ff4d4d', chamado: '#3d6bff', investiga: '#ffd166', correcao: '#7bdcb5', deploy: '#3ddc84', ideia: '#ffb066', final: '#fff1e0' }
// Câmera por cena: posição no começo e no fim (empurra devagar), olhando para o centro.
const CAM: Record<Cena, [number[], number[]]> = {
  quarto: [[0, 2.2, 7.5], [-0.6, 1.9, 5.2]], chamado: [[2.5, 2.0, 6], [1, 1.9, 5]], investiga: [[-2.5, 2.2, 5.5], [0, 2.4, 4.6]],
  correcao: [[0, 1.8, 6.5], [0.4, 2.0, 5]], deploy: [[0, 1.2, 5.5], [0, 2.4, 7.5]], ideia: [[-1.5, 2.0, 5], [1.5, 2.0, 5.5]], final: [[0, 1.8, 6.5], [0, 2.1, 5]],
}
const lim = (x: number) => Math.min(1, Math.max(0, x))
const suave = (x: number) => lim(x) * lim(x) * (3 - 2 * lim(x))
const mix = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k)

export function montarCena(host: HTMLElement, w: number, h: number) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.shadowMap.enabled = true
  host.appendChild(renderer.domElement)
  const cena = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(40, w / h, 0.1, 60)
  cena.add(new THREE.HemisphereLight('#ffffff', '#4a4f7a', 1.2))
  const sol = new THREE.DirectionalLight('#ffffff', 2.4)
  sol.position.set(3, 6, 4)
  sol.castShadow = true
  cena.add(sol)
  const std = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })
  const chao = new THREE.Mesh(new THREE.CircleGeometry(7, 64), std('#2a2f55'))
  chao.rotation.x = -Math.PI / 2
  chao.receiveShadow = true
  const mesa = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 1), std('#6b4a3a'))
  mesa.position.set(0, 0.95, -1.3)
  mesa.castShadow = true
  const telaMat = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#3d6bff', emissiveIntensity: 1.3 })
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.95, 0.06), telaMat)
  monitor.position.set(0, 1.55, -1.45)
  cena.add(chao, mesa, monitor)
  const rafa = criarRafa()
  const ia = criarAssistente()
  cena.add(rafa.grupo, ia.grupo)
  const fundo = new THREE.Color()

  function poses(c: Cena, t: number, de: number): [Pose, Pose] {
    const s = Math.sin(t * 2.4), f = Math.sin(t * 5), d = t - de
    const R: Pose = { x: -1, giro: 0.45 }, A: Pose = { x: 1, giro: -0.45 }
    if (c === 'quarto') Object.assign(R, { olhos: 0.35 + 0.1 * s, sorriso: -0.7, inclina: 0.15 + 0.05 * s, bracoD: 0.9 + 0.3 * f })
    if (c === 'chamado') Object.assign(R, { olhos: 1, sorriso: 0.5, bracoD: 1.0 + 0.25 * f, bracoE: 1.0 - 0.25 * f, cabeca: 0.2 }, {})
    if (c === 'investiga') { Object.assign(A, { inclina: 0.2, cabeca: -0.3 * s, bracoE: 2.2, sorriso: 0.8 }); Object.assign(R, { cabeca: 0.3, sorriso: 0.3 }) }
    if (c === 'correcao') { Object.assign(A, { bracoD: 1.2 + 0.4 * f, sorriso: 0.9 }); Object.assign(R, { cabeca: 0.25 * s, bracoE: 0.9, sorriso: 0.5 }) }
    if (c === 'deploy') { const p = Math.abs(Math.sin(d * 4)) * 0.35; Object.assign(R, { pula: p, bracoE: 2.6, bracoD: 2.6, sorriso: 1 }); Object.assign(A, { pula: p, bracoE: 2.6, bracoD: 2.6, sorriso: 1 }) }
    if (c === 'ideia') { Object.assign(R, { pula: Math.abs(Math.sin(d * 3)) * 0.2, bracoD: 2.6, sorriso: 1 }); Object.assign(A, { bracoE: 1.2 + 0.2 * f, sorriso: 0.9 }) }
    if (c === 'final') { Object.assign(R, { x: -0.8, bracoD: 2.4 + 0.4 * f, sorriso: 1 }); Object.assign(A, { x: 0.8, bracoE: 2.4 - 0.4 * f, sorriso: 1 }) }
    return [R, A]
  }

  function ir(t: number) {
    const atual = [...CENAS].reverse().find((c) => t >= janelaDaCena(c).de) ?? 'quarto'
    const i = CENAS.indexOf(atual)
    const { de, ate } = janelaDaCena(atual)
    fundo.set(FUNDO[CENAS[Math.max(0, i - 1)]]).lerp(new THREE.Color(FUNDO[atual]), suave((t - de) / 0.6))
    cena.background = fundo
    telaMat.emissive.set(TELA[atual])
    const [p0, p1] = CAM[atual]
    const vertical = w / h < 1
    const k = vertical ? 1.55 : 1 // formato vertical: afasta a câmera para caber os dois
    const p = mix(p0, p1, suave((t - de) / (ate - de))).map((v, n) => (n === 2 ? v * k : v))
    cam.position.set(p[0], p[1], p[2])
    // No vertical, mira mais baixo para os bonecos subirem e a legenda ficar no espaço de baixo.
    cam.lookAt(0, vertical ? 0.75 : 1.3, 0)
    const [pr, pa] = poses(atual, t, de)
    rafa.posar(pr)
    ia.posar(pa)
    const entra = suave((t - janelaDaCena('chamado').de) / 0.5)
    ia.grupo.visible = entra > 0
    ia.grupo.scale.setScalar(Math.max(0.001, entra))
    renderer.render(cena, cam)
  }
  const redimensionar = (nw: number, nh: number) => { w = nw; h = nh; renderer.setSize(nw, nh); cam.aspect = nw / nh; cam.updateProjectionMatrix() }
  redimensionar(w, h)
  return { ir, redimensionar, limpar: () => { renderer.dispose(); renderer.domElement.remove() } }
}
import * as THREE from 'three'

/** Bonecos 3D feitos só com formas simples; as poses são parâmetros, para o filme ir a qualquer segundo. */
export type Pose = {
  x?: number; z?: number; giro?: number
  cabeca?: number; inclina?: number
  bracoE?: number; bracoD?: number
  pula?: number; olhos?: number
  sorriso?: number
}

export type Boneco = { grupo: THREE.Group; posar: (p: Pose) => void }

const mat = (cor: string, rough = 0.55) => new THREE.MeshStandardMaterial({ color: cor, roughness: rough, metalness: 0.05 })

function braco(cor: string, mao: string) {
  const ombro = new THREE.Group()
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.5, 8, 16), mat(cor))
  b.position.y = -0.33
  b.castShadow = true
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 16), mat(mao))
  m.position.y = -0.68
  ombro.add(b, m)
  return ombro
}

function rosto(cabeca: THREE.Object3D, raio: number, corOlho = '#1b1b24') {
  const olhos: THREE.Mesh[] = []
  for (const lado of [-1, 1]) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(raio * 0.13, 16, 12), mat(corOlho, 0.2))
    o.position.set(lado * raio * 0.36, raio * 0.12, raio * 0.9)
    cabeca.add(o)
    olhos.push(o)
  }
  const boca = new THREE.Mesh(new THREE.TorusGeometry(raio * 0.24, raio * 0.04, 8, 24, Math.PI), mat(corOlho, 0.3))
  boca.position.set(0, -raio * 0.22, raio * 0.92)
  boca.rotation.z = Math.PI
  cabeca.add(boca)
  return { olhos, boca }
}

function montar(corpoCor: string, peleCor: string, extra: (cabeca: THREE.Group, corpo: THREE.Mesh) => void, raio = 0.42): Boneco {
  const grupo = new THREE.Group()
  const raiz = new THREE.Group()
  grupo.add(raiz)
  const corpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.55, 10, 24), mat(corpoCor))
  corpo.position.y = 0.95
  corpo.castShadow = true
  for (const lado of [-1, 1]) {
    const perna = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.4, 8, 16), mat('#2b2f45'))
    perna.position.set(lado * 0.17, 0.33, 0)
    perna.castShadow = true
    raiz.add(perna)
  }
  const cabeca = new THREE.Group()
  cabeca.position.y = 1.78
  const cranio = new THREE.Mesh(new THREE.SphereGeometry(raio, 32, 24), mat(peleCor, 0.45))
  cranio.castShadow = true
  cabeca.add(cranio)
  const { olhos, boca } = rosto(cabeca, raio)
  const bE = braco(corpoCor, peleCor)
  const bD = braco(corpoCor, peleCor)
  bE.position.set(-0.48, 1.32, 0)
  bD.position.set(0.48, 1.32, 0)
  raiz.add(corpo, cabeca, bE, bD)
  extra(cabeca, corpo)

  const posar = (p: Pose) => {
    grupo.position.set(p.x ?? grupo.position.x, 0, p.z ?? grupo.position.z)
    grupo.rotation.y = p.giro ?? 0
    raiz.position.y = Math.max(0, p.pula ?? 0)
    cabeca.rotation.set(p.inclina ?? 0, p.cabeca ?? 0, 0)
    bE.rotation.z = -(p.bracoE ?? 0.15)
    bD.rotation.z = p.bracoD ?? 0.15
    const ab = Math.max(0.08, p.olhos ?? 1)
    olhos.forEach((o) => o.scale.set(1, ab, 1))
    const s = p.sorriso ?? 0.6
    boca.scale.set(1, s >= 0 ? 0.4 + s : 0.4 - s, 1)
    boca.rotation.z = s >= 0 ? Math.PI : 0
  }
  posar({})
  return { grupo, posar }
}

/** Rafa: dev de moletom azul, cabelo escuro e óculos. */
export function criarRafa(): Boneco {
  return montar('#3d6bff', '#e8b48f', (cabeca) => {
    const cabelo = new THREE.Mesh(new THREE.SphereGeometry(0.44, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), mat('#2a1d17', 0.8))
    cabelo.position.y = 0.06
    cabelo.rotation.x = -0.25
    cabeca.add(cabelo)
    const aro = mat('#15151c', 0.3)
    for (const lado of [-1, 1]) {
      const lente = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 24), aro)
      lente.position.set(lado * 0.15, 0.05, 0.4)
      cabeca.add(lente)
    }
  })
}

/** O assistente: um parceiro redondo cor de terracota, com antena luminosa. */
export function criarAssistente(): Boneco {
  return montar('#d97757', '#f2c9a8', (cabeca) => {
    const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 10), mat('#7a3f2a'))
    haste.position.y = 0.55
    const luz = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffb066', emissiveIntensity: 1.6 }))
    luz.position.y = 0.72
    cabeca.add(haste, luz)
  }, 0.46)
}
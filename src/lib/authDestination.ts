// Páginas que podem pedir para voltar depois do login (Google, Discord ou e-mail).
// Só caminhos desta lista são aceitos, para o login nunca mandar para um endereço qualquer.
const RETURN_KEY = 'sixtysix_return_to'
const RETURNABLE = ['/adminxv1']

/** Guarda a página para onde voltar depois do login (vale nesta aba, inclusive na ida e volta do Google). */
export function rememberReturn(path: string) {
  if (RETURNABLE.includes(path)) sessionStorage.setItem(RETURN_KEY, path)
}

export function accountDestination(hasChosenName:boolean):string {
  if(!hasChosenName)return '/onboarding'
  const back=sessionStorage.getItem(RETURN_KEY)
  if(back){sessionStorage.removeItem(RETURN_KEY);if(RETURNABLE.includes(back))return back}
  const plan=sessionStorage.getItem('sixtysix_pending_purchase')
  if(plan&&['dev','devApi','pro'].includes(plan))return `/comprar/${plan}`
  if(sessionStorage.getItem('sixtysix_pending_subscription')==='1')return '/assinatura'
  return '/dashboard'
}

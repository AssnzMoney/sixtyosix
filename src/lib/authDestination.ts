export function accountDestination(hasChosenName:boolean):string {
  if(!hasChosenName)return '/onboarding'
  const plan=sessionStorage.getItem('sixtysix_pending_purchase')
  if(plan&&['dev','devApi','pro'].includes(plan))return `/comprar/${plan}`
  if(sessionStorage.getItem('sixtysix_pending_subscription')==='1')return '/assinatura'
  return '/dashboard'
}

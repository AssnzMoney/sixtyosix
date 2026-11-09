export function accountDestination(hasChosenName:boolean):string {
  if(!hasChosenName)return '/onboarding'
  return sessionStorage.getItem('sixtysix_pending_trial')==='1'?'/teste-gratis':'/dashboard'
}

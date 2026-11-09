import { supabase } from './supabase'
export const planLabels={dev:'Dev',devApi:'Dev + API',pro:'Pro'} as const
export const planAmounts={dev:79.99,devApi:94.99,pro:119.99} as const
export type PlanCode=keyof typeof planLabels
export type PaidSubscription={id:string;plan:PlanCode;name:string;amount:number;api:boolean;models:string[];mode:'recurring'|'pix';active:boolean;expires:string|null;status:string;created:string;keyRevoked:boolean;checkoutUrl:string|null}
export type BillingState={subscriptions:PaidSubscription[];payments:{id:string;subscription_id:string;status:string;amount_cents:number;currency:string;approved_at:string|null;period_start:string;period_end:string}[]}
export async function billingRequest<T>(action:string,body?:Record<string,unknown>,signal?:AbortSignal):Promise<T>{
  const session=await supabase?.auth.getSession(),token=session?.data.session?.access_token
  if(!token)throw new Error('Entre na sua conta para continuar.')
  const response=await fetch(`/api/billing/${action}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal})
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('A conexão está sendo atualizada. Tente novamente em instantes.')
  const data=await response.json()
  if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Não foi possível concluir a operação.')
  return data as T
}

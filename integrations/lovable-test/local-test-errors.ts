/** Erros locais definitivos não devem provocar retries automáticos do cliente. */
export function localBudgetExhausted() {
 return Response.json({type:'error',error:{type:'permission_error',message:'Orçamento deste teste local esgotado. Nenhuma chamada externa foi realizada.'}},{status:403,headers:{'Cache-Control':'no-store'}})
}
export function localBridgeFailure(status:number) {
 return Response.json({type:'error',error:{type:'invalid_request_error',message:'A ponte de teste falhou (HTTP '+status+'). Tentativa interrompida para diagnóstico; não repetir automaticamente.'}},{status:422,headers:{'Cache-Control':'no-store','X-Six-Bridge-Status':String(status)}})
}

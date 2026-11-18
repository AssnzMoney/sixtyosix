export type BridgeDiagnostic = {requestId:string;stage:string;durationMs:number;status?:number;contentType?:string;errorName?:string;errorCode?:string}
export function safeBridgeDiagnostic(requestId:string,stage:string,started:number,response?:Response,error?:unknown):BridgeDiagnostic {
 const result:BridgeDiagnostic={requestId,stage,durationMs:Math.max(0,Date.now()-started)}
 if(response){result.status=response.status;const type=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();result.contentType=['application/json','text/event-stream','text/html','text/plain'].includes(type??'')?type:'other'}
 if(error){const e=error as {name?:unknown;code?:unknown;cause?:{code?:unknown}};result.errorName=['AbortError','TimeoutError','TypeError','Error'].includes(String(e.name))?String(e.name):'OtherError';const code=String(e.code??e.cause?.code??'');if(/^(ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET)$/.test(code))result.errorCode=code}
 return result
}

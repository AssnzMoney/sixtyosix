/** Núcleo para instalar no servidor Lovable; não importar no navegador. */
export const NATIVE_BODY_LIMIT = 4 * 1024 * 1024
export const NATIVE_OUTPUT_LIMIT = 1024
export type NativeConfig = { bridgeKey?: string; lovableKey?: string; expiresAt?: string }
export function nativeBody(value: any) {
 if (!value || value.model !== 'anthropic/claude-opus-5-5' || !Array.isArray(value.messages) || !value.messages.length) throw Error('invalid_request')
 if (value.stream !== undefined && typeof value.stream !== 'boolean') throw Error('invalid_request')
 if (value.max_tokens !== undefined && (!Number.isInteger(value.max_tokens) || value.max_tokens < 1)) throw Error('invalid_request')
 if (value.tools !== undefined && !Array.isArray(value.tools)) throw Error('invalid_request')
 const systems:any[] = []
 const addSystem = (content:any) => {
  if(typeof content === 'string') systems.push({type:'text',text:content})
  else if(Array.isArray(content) && content.every(b=>b?.type==='text' && typeof b.text==='string')) systems.push(...content)
  else throw Error('invalid_system')
 }
 if(value.system !== undefined) addSystem(value.system)
 const messages = value.messages.filter((message:any)=>{
  if(message.role==='system'){addSystem(message.content);return false}
  if(!['user','assistant'].includes(message.role))throw Error('invalid_role')
  return true
 })
 if(!messages.length)throw Error('invalid_request')
 const body = { ...value, messages, ...(systems.length?{system:systems}:{}), max_tokens: Math.min(value.max_tokens ?? NATIVE_OUTPUT_LIMIT, NATIVE_OUTPUT_LIMIT) }
 // Teste de texto e ferramentas sem orçamento de raciocínio estendido.
 delete body.thinking
 delete body.output_config
 return body
}
const error = (status: number, message: string) => Response.json({type:'error',error:{type:status===401?'authentication_error':status===413?'request_too_large':'api_error',message}},{status,headers:{'Cache-Control':'no-store'}})
export function createNativeBridge(fetchImpl: typeof fetch = fetch, clock = () => Date.now()) {
 let attempts = 0
 return async (request: Request, config: NativeConfig): Promise<Response> => {
  const expires = Date.parse(config.expiresAt ?? '')
  if (!config.bridgeKey || config.bridgeKey.length < 32 || !config.lovableKey || !Number.isFinite(expires) || expires <= clock() || expires > clock()+3600000) return error(503,'Ponte indisponível.')
  const auth = request.headers.get('authorization') ?? ''
  const hash = async (s:string) => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))
  const [a,b] = await Promise.all([hash(auth),hash('Bearer '+config.bridgeKey)])
  let difference=0; for(let i=0;i<a.length;i++) difference |= a[i]! ^ b[i]!
  if(difference) return error(401,'Não autorizado.')
  if(!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return error(400,'JSON obrigatório.')
  let body:any
  try {
   const reader=request.body?.getReader(); if(!reader)return error(400,'Corpo obrigatório.')
   const chunks:Uint8Array[]=[];let size=0
   while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>NATIVE_BODY_LIMIT){await reader.cancel();return error(413,'Corpo acima de 4 MiB.')}chunks.push(part.value)}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
   body=nativeBody(JSON.parse(new TextDecoder().decode(bytes)))
  } catch { return error(400,'Requisição inválida.') }
  // Defesa adicional por instância; não representa orçamento global da hospedagem.
  if(attempts>=3)return error(429,'Limite de três tentativas desta instância atingido.')
  attempts++
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),60000)
  try {
   const upstream=await fetchImpl('https://ai.gateway.lovable.dev/v1/messages',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.lovableKey,'X-Lovable-AIG-SDK':'fetch'},body:JSON.stringify(body),redirect:'manual',signal:controller.signal})
   if(!upstream.ok){clearTimeout(timeout);await upstream.body?.cancel();return error(upstream.status===429?429:502,'Gateway não concluiu a solicitação.')}
   if(!upstream.body){clearTimeout(timeout);return error(502,'Gateway sem resposta.')}
   const reader=upstream.body.getReader()
   const stream=new ReadableStream<Uint8Array>({async pull(c){try{const p=await reader.read();if(p.done){clearTimeout(timeout);c.close()}else c.enqueue(p.value)}catch(e){clearTimeout(timeout);c.error(e)}},async cancel(){clearTimeout(timeout);controller.abort();await reader.cancel()}})
   return new Response(stream,{status:200,headers:{'Content-Type':body.stream?'text/event-stream; charset=utf-8':'application/json; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'}})
  } catch {clearTimeout(timeout);return error(502,'Gateway não concluiu a solicitação.')}
 }
}

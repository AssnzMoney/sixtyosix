/** Adaptador LOCAL do teste de texto curto; não é suporte geral a Claude Code. */
export const OPUS = 'anthropic/claude-opus-5-5'
export const PROMPT = 'Responda apenas OK'
export function bridgeBody(payload: any) {
 if (!payload || payload.model !== OPUS || (payload.tools?.length) || payload.tool_choice) throw Error('Teste não aceita ferramentas ou outro modelo.')
 if (!Array.isArray(payload.messages) || payload.messages.length !== 1 || payload.messages[0]?.role !== 'user') throw Error('Teste aceita uma única mensagem user.')
 const content = payload.messages[0].content
 const text = typeof content === 'string' ? content : Array.isArray(content) && content.every((p:any)=>p?.type==='text' && typeof p.text==='string') ? content.map((p:any)=>p.text).join('') : null
 if (typeof text !== 'string' || !text.trim() || text.length > 2000) throw Error('Teste aceita texto entre 1 e 2000 caracteres.')
 return {model:OPUS,messages:[{role:'user',content:text}],max_tokens:64,stream:false}
}
export async function anthropicReply(upstream: Response, stream: boolean) {
 if(!upstream.ok) return upstream
 const data = await upstream.json() as any
 const choice=data?.choices?.[0], text=choice?.message?.content
 if(typeof text!=='string' || text.length>2048) throw Error('Resposta de teste inválida.')
 const reason=choice.finish_reason==='stop'?'end_turn':choice.finish_reason==='length'?'max_tokens':null
 if(!reason) throw Error('Motivo de término não suportado no teste.')
 const input=data.usage?.prompt_tokens||0, output=data.usage?.completion_tokens||0
 const message={id:'msg_six_local_test',type:'message',role:'assistant',model:OPUS,content:[{type:'text',text}],stop_reason:reason,stop_sequence:null,usage:{input_tokens:input,output_tokens:output}}
 if(!stream)return Response.json(message)
 // Eventos emitidos APÓS receber o JSON completo; não é streaming nativo do provedor.
 const event=(name:string,data:unknown)=>'event: '+name+'\ndata: '+JSON.stringify(data)+'\n\n'
 const wire=event('message_start',{type:'message_start',message:{...message,content:[],stop_reason:null,usage:{input_tokens:input,output_tokens:0}}})
  +event('content_block_start',{type:'content_block_start',index:0,content_block:{type:'text',text:''}})
  +event('content_block_delta',{type:'content_block_delta',index:0,delta:{type:'text_delta',text}})
  +event('content_block_stop',{type:'content_block_stop',index:0})
  +event('message_delta',{type:'message_delta',delta:{stop_reason:reason,stop_sequence:null},usage:{output_tokens:output}})
  +event('message_stop',{type:'message_stop'})
 return new Response(wire,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store'}})
}

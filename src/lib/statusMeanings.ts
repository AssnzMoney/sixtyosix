/*
 * Significado das respostas gravadas no consumo (gateway_usage.status_code), para o admin.
 *
 * Importante: o consumo só é gravado depois que a chave do cliente foi aceita e o pedido foi ao fornecedor.
 * Então o código é a resposta FINAL do fornecedor, depois das novas tentativas do gateway (até 30 s em 429/502/503/529).
 * Recusas do próprio gateway (chave do cliente inválida, limite por minuto, IP bloqueado) não aparecem aqui.
 * O cliente nunca vê o erro do fornecedor como veio: 401/402/403 e 5xx viram "temporariamente indisponível".
 */
export type StatusSource = 'ok' | 'cliente' | 'fornecedor' | 'chave-mestra'
export type StatusMeaning = { title: string; meaning: string; action: string; source: StatusSource }

const MEANINGS: Record<number, StatusMeaning> = {
  200: { title: 'Respondida', source: 'ok', meaning: 'A chamada deu certo.', action: 'Nada a fazer.' },
  400: {
    title: 'Pedido recusado',
    source: 'cliente',
    meaning: 'O fornecedor recusou o pedido como veio: conversa grande demais para o modelo, parâmetro que o modelo não aceita ou formato inválido. Campos conhecidos (esforço, campos novos do Claude Code) o gateway já tira sozinho e tenta de novo.',
    action: 'Se for pontual, é do pedido do cliente (ex.: conversa longa demais; o Claude Code resume sozinho). Se muitos clientes tiverem, pode ser um campo novo de alguma ferramenta: veja o log do servidor ("Provedor recusou a chamada").',
  },
  401: {
    title: 'Key mestra recusada',
    source: 'chave-mestra',
    meaning: 'O fornecedor não aceitou a key mestra do Roteador ("Token inválido"). Não é a chave do cliente: todos os clientes daquele provedor caem juntos. O cliente recebe "temporariamente indisponível".',
    action: 'Urgente: confira no painel do fornecedor se a key continua válida e com saldo. Se trocou a key, atualize no admin (Roteador › Provedores). Você recebe um e-mail de alerta quando isso acontece.',
  },
  402: {
    title: 'Sem saldo no fornecedor',
    source: 'chave-mestra',
    meaning: 'O fornecedor recusou por falta de saldo ou crédito na conta da key mestra. Todos os clientes daquele provedor caem juntos.',
    action: 'Urgente: recarregue o saldo no fornecedor.',
  },
  403: {
    title: 'Acesso negado pelo fornecedor',
    source: 'chave-mestra',
    meaning: 'A key mestra é válida, mas o fornecedor não liberou este modelo ou este recurso para ela (ou bloqueou a conta).',
    action: 'Confira no fornecedor se o modelo está liberado para a sua key. Se for um modelo só, desative-o no Roteador até resolver.',
  },
  404: {
    title: 'Modelo ou endereço inexistente',
    source: 'fornecedor',
    meaning: 'O fornecedor não reconheceu o modelo ou o endereço chamado. Costuma acontecer quando o fornecedor muda o nome de um modelo.',
    action: 'Confira no Roteador se o "modelo no provedor" ainda existe (botão de listar modelos do provedor).',
  },
  413: {
    title: 'Pedido grande demais',
    source: 'cliente',
    meaning: 'O corpo do pedido passou do tamanho que o fornecedor aceita (muitas imagens ou arquivos de uma vez).',
    action: 'É do pedido do cliente: mandar menos arquivos por vez.',
  },
  429: {
    title: 'Limite do fornecedor',
    source: 'fornecedor',
    meaning: 'O fornecedor limitou as chamadas da key mestra (muitas ao mesmo tempo). O gateway esperou e tentou de novo por até 30 s, revezando as keys, e mesmo assim não passou.',
    action: 'Se acontecer com frequência, cadastre mais keys no provedor (uma por linha) ou peça um limite maior ao fornecedor.',
  },
  499: {
    title: 'Cancelada pelo cliente',
    source: 'cliente',
    meaning: 'O cliente desistiu antes da resposta (apertou Esc, fechou a ferramenta ou a conexão caiu).',
    action: 'Nada a fazer, a não ser que seja muito frequente: aí pode ser demora do modelo.',
  },
  500: {
    title: 'Erro interno do fornecedor',
    source: 'fornecedor',
    meaning: 'O fornecedor quebrou ao processar o pedido.',
    action: 'Se for pontual, ignore. Se repetir, fale com o fornecedor.',
  },
  501: {
    title: 'Recurso não suportado',
    source: 'fornecedor',
    meaning: 'O fornecedor não tem esse recurso para o modelo (ex.: uma rota ou formato que ele não implementa).',
    action: 'Normalmente é uma ferramenta usando um recurso que o fornecedor não oferece. Se for comum, avise o fornecedor.',
  },
  502: {
    title: 'Fornecedor fora do ar',
    source: 'fornecedor',
    meaning: 'O fornecedor (ou o servidor dele) não respondeu direito, mesmo depois de o gateway tentar de novo por até 30 s.',
    action: 'Instabilidade do fornecedor. Se durar, você recebe o e-mail de alerta; fale com ele.',
  },
  503: {
    title: 'Fornecedor instável',
    source: 'fornecedor',
    meaning: 'O fornecedor disse que estava sobrecarregado ou sem contas disponíveis, mesmo depois de o gateway tentar de novo por até 30 s.',
    action: 'Instabilidade do fornecedor. Se durar, você recebe o e-mail de alerta; fale com ele.',
  },
  504: {
    title: 'Demorou demais',
    source: 'fornecedor',
    meaning: 'O fornecedor desistiu de esperar o modelo (ou respondeu "OK" com um erro de demora dentro). Acontece em raciocínios muito longos.',
    action: 'Se for frequente, oriente o cliente a usar streaming ou um nível de raciocínio menor.',
  },
  520: {
    title: 'Erro desconhecido no fornecedor',
    source: 'fornecedor',
    meaning: 'A Cloudflare do fornecedor recebeu uma resposta inválida do servidor dele.',
    action: 'Instabilidade do fornecedor. Se repetir, fale com ele.',
  },
  524: {
    title: 'Fornecedor sem resposta em 100 s',
    source: 'fornecedor',
    meaning: 'A Cloudflare do fornecedor encerrou a chamada porque o servidor dele passou de 100 s sem mandar nada (comum sem streaming em respostas longas).',
    action: 'Oriente o cliente a usar streaming. Se for geral, fale com o fornecedor.',
  },
  529: {
    title: 'Fornecedor sobrecarregado',
    source: 'fornecedor',
    meaning: 'O modelo está sobrecarregado na origem, mesmo depois de o gateway tentar de novo por até 30 s.',
    action: 'Espere alguns minutos. Se durar, fale com o fornecedor.',
  },
}

export function statusMeaning(code: number): StatusMeaning {
  if (MEANINGS[code]) return MEANINGS[code]
  if (code >= 200 && code < 300) return MEANINGS[200]
  if (code >= 500) return { title: 'Falha do fornecedor', source: 'fornecedor', meaning: `O fornecedor respondeu ${code}, um erro do lado dele.`, action: 'Se repetir, fale com o fornecedor.' }
  return { title: 'Recusada', source: 'cliente', meaning: `O fornecedor respondeu ${code} ao pedido.`, action: 'Veja o log do servidor ("Provedor recusou a chamada") para o detalhe.' }
}

export const SOURCE_LABELS: Record<StatusSource, string> = {
  ok: 'Tudo certo',
  cliente: 'Do pedido do cliente',
  fornecedor: 'Do fornecedor',
  'chave-mestra': 'Key mestra (urgente)',
}

import { z } from "zod";

import { expiracaoSixTestValida } from "@/lib/six-test-bridge.server";

export type BridgeDiagnostic = {requestId:string;stage:string;durationMs:number;status?:number;contentType?:string;errorName?:string;errorCode?:string}
export function safeBridgeDiagnostic(requestId:string,stage:string,started:number,response?:Response,error?:unknown):BridgeDiagnostic {
 const result:BridgeDiagnostic={requestId,stage,durationMs:Math.max(0,Date.now()-started)}
 if(response){result.status=response.status;const type=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();result.contentType=['application/json','text/event-stream','text/html','text/plain'].includes(type??'')?type:'other'}
 if(error){const e=error as {name?:unknown;code?:unknown;cause?:{code?:unknown}};result.errorName=['AbortError','TimeoutError','TypeError','Error'].includes(String(e.name))?String(e.name):'OtherError';const code=String(e.code??e.cause?.code??'');if(/^(ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET)$/.test(code))result.errorCode=code}
 return result
}

// Temporary native Anthropic bridge for the local Claude Desktop test.
// Secrets arrive as parameters and are never logged, returned or persisted.

export const MODELO_MESSAGES_SIX_TEST = "anthropic/claude-opus-5-5";
export const MAX_TOKENS_MESSAGES_SIX_TEST = 1024;
export const LIMITE_CORPO_MESSAGES_SIX_TEST_BYTES = 4 * 1024 * 1024;
export const TIMEOUT_MESSAGES_SIX_TEST_MS = 60_000;
export const MAX_TENTATIVAS_MESSAGES_SIX_TEST = 3;

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/messages";

const blocoConteudoSchema = z
  .object({
    type: z.string().min(1),
  })
  .passthrough();

const mensagemSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    // Text, tool_use, tool_result and other native content blocks remain untouched.
    content: z.union([z.string(), z.array(blocoConteudoSchema)]),
  })
  .strict();

const corpoRequisicaoSchema = z
  .object({
    model: z.literal(MODELO_MESSAGES_SIX_TEST),
    messages: z.array(mensagemSchema).min(1),
    max_tokens: z.number().int().min(1).max(MAX_TOKENS_MESSAGES_SIX_TEST),
    system: z.union([z.string(), z.array(blocoConteudoSchema)]).optional(),
    tools: z.array(z.record(z.unknown())).optional(),
    tool_choice: z.record(z.unknown()).optional(),
    stream: z.boolean().optional(),
    // Accepted only so they can be removed: extended reasoning is disabled in this test.
    thinking: z.unknown().optional(),
    output_config: z.unknown().optional(),
  })
  // Other native Messages options, such as metadata and stop_sequences, pass through unchanged.
  .passthrough();

type CorpoRequisicao = z.infer<typeof corpoRequisicaoSchema>;

export type ConfiguracaoMessagesSixTest = {
  chaveBridge: string | undefined;
  expiraEm: string | undefined;
  chaveLovable: string | undefined;
};

export class ReservaTentativasMessagesSixTest {
  private tentativasReservadas = 0;

  reservar(): boolean {
    if (this.tentativasReservadas >= MAX_TENTATIVAS_MESSAGES_SIX_TEST) return false;
    this.tentativasReservadas += 1;
    return true;
  }
}

// At most three reservations per loaded server module instance. This is NOT a global
// budget: separate server instances can each reserve their own three attempts.
const reservaTentativasPorInstancia = new ReservaTentativasMessagesSixTest();

export function montarCorpoMessagesSixTest(corpo: CorpoRequisicao): Record<string, unknown> {
  const copia: Record<string, unknown> = { ...corpo };
  delete copia["thinking"];
  delete copia["output_config"];
  return copia;
}

export async function processarRequisicaoMessagesSixTest(
  request: Request,
  configuracao: ConfiguracaoMessagesSixTest,
  fetchImpl: typeof fetch = fetch,
  agora: number = Date.now(),
  reservaTentativas: ReservaTentativasMessagesSixTest = reservaTentativasPorInstancia,
): Promise<Response> {
  if (
    !configuracao.chaveBridge ||
    configuracao.chaveBridge.length < 32 ||
    !configuracao.chaveLovable ||
    !expiracaoSixTestValida(configuracao.expiraEm, agora)
  ) {
    return respostaErro(503, "Ponte temporária indisponível.", "api_error");
  }

  const bearer = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!bearer || !(await segredosIguais(bearer, configuracao.chaveBridge))) {
    return respostaErro(401, "Não autorizado.", "authentication_error");
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return requisicaoInvalida();
  }

  const leitura = await lerJsonComLimite(request);
  if (leitura.tipo === "muito_grande") {
    return respostaErro(413, "O corpo excede o limite de 4 MiB.", "invalid_request_error");
  }
  if (leitura.tipo === "invalido") return requisicaoInvalida();

  const corpo = corpoRequisicaoSchema.safeParse(leitura.valor);
  if (!corpo.success) return requisicaoInvalida();

  // Reserve synchronously before fetch so concurrent requests cannot exceed this instance's cap.
  if (!reservaTentativas.reservar()) {
    return respostaErro(429, "Limite de tentativas desta instância atingido.", "rate_limit_error");
  }

  const controlador = new AbortController();
  const estado: { motivoAbort: "timeout" | "cliente" | null } = { motivoAbort: null };
  const timeout = setTimeout(() => {
    estado.motivoAbort = "timeout";
    controlador.abort();
  }, TIMEOUT_MESSAGES_SIX_TEST_MS);
  const aoAbortarCliente = () => {
    if (estado.motivoAbort === null) estado.motivoAbort = "cliente";
    controlador.abort(request.signal.reason);
  };
  request.signal.addEventListener("abort", aoAbortarCliente, { once: true });
  if (request.signal.aborted) aoAbortarCliente();

  const aoFinalizar = () => {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", aoAbortarCliente);
  };

  const diagnosticId = crypto.randomUUID();
  const diagnosticStart = Date.now();
  let upstream: Response;
  try {
    upstream = await fetchImpl(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${configuracao.chaveLovable}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify(montarCorpoMessagesSixTest(corpo.data)),
      redirect: "manual",
      signal: controlador.signal,
    });
  } catch (error) {
    console.info("six-test-bridge", safeBridgeDiagnostic(diagnosticId, "fetch_exception", diagnosticStart, undefined, error));
    aoFinalizar();
    return respostaErro(
      estado.motivoAbort === "timeout" ? 504 : 502,
      "Não foi possível concluir o teste no gateway de IA.",
      "api_error",
    );
  }

  console.info("six-test-bridge", safeBridgeDiagnostic(diagnosticId, "upstream_response", diagnosticStart, upstream));
  const contentType = upstream.headers.get("content-type")?.toLowerCase() ?? "";
  const eSse = contentType.startsWith("text/event-stream");
  const eJson = contentType.startsWith("application/json");
  if (!upstream.ok || !upstream.body || (!eSse && !eJson)) {
    const stage = !upstream.ok ? "upstream_rejected" : !upstream.body ? "upstream_empty_body" : "upstream_invalid_content_type";
    console.info("six-test-bridge", safeBridgeDiagnostic(diagnosticId, stage, diagnosticStart, upstream));
    aoFinalizar();
    await upstream.body?.cancel().catch(() => undefined);
    return respostaErro(502, "Não foi possível concluir o teste no gateway de IA.", "api_error");
  }

  // Only the safe content type is forwarded. The body remains byte-for-byte native Anthropic.
  return new Response(
    criarCorpoPassagem(upstream.body, controlador, estado, eSse, aoFinalizar),
    {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type")!,
        "Cache-Control": "no-store",
      },
    },
  );
}

function criarCorpoPassagem(
  corpoUpstream: ReadableStream<Uint8Array>,
  controlador: AbortController,
  estado: { motivoAbort: "timeout" | "cliente" | null },
  eSse: boolean,
  aoFinalizar: () => void,
): ReadableStream<Uint8Array> {
  const reader = corpoUpstream.getReader();
  const encoder = new TextEncoder();
  let encerrado = false;
  let canceladoPeloCliente = false;

  const cancelarLeitura = () => {
    void reader.cancel().catch(() => undefined);
  };
  controlador.signal.addEventListener("abort", cancelarLeitura, { once: true });

  const finalizar = () => {
    controlador.signal.removeEventListener("abort", cancelarLeitura);
    aoFinalizar();
  };

  const encerrarComErroGenerico = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (encerrado || canceladoPeloCliente) return;
    encerrado = true;
    if (eSse) {
      // Leading blank lines terminate any partial SSE frame without exposing upstream details.
      controller.enqueue(
        encoder.encode(
          '\n\nevent: error\ndata: {"type":"error","error":{"type":"api_error","message":"Falha na transmissão do gateway de IA."}}\n\n',
        ),
      );
      controller.close();
    } else {
      controller.error(new Error("Falha na transmissão do gateway de IA."));
    }
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            if (estado.motivoAbort === "timeout" || (!controlador.signal.aborted && !encerrado)) {
              if (estado.motivoAbort === "timeout") {
                encerrarComErroGenerico(controller);
              } else if (!encerrado && !canceladoPeloCliente) {
                encerrado = true;
                controller.close();
              }
            }
            break;
          }
          if (encerrado || canceladoPeloCliente) break;
          controller.enqueue(value);
        }
      } catch {
        if (estado.motivoAbort !== "cliente") encerrarComErroGenerico(controller);
      } finally {
        finalizar();
      }
    },
    async cancel(reason) {
      canceladoPeloCliente = true;
      encerrado = true;
      if (estado.motivoAbort === null) estado.motivoAbort = "cliente";
      if (!controlador.signal.aborted) controlador.abort(reason);
      await reader.cancel(reason).catch(() => undefined);
      finalizar();
    },
  });
}

type LeituraJson = { tipo: "ok"; valor: unknown } | { tipo: "muito_grande" } | { tipo: "invalido" };

async function lerJsonComLimite(request: Request): Promise<LeituraJson> {
  if (!request.body) return { tipo: "invalido" };
  const reader = request.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > LIMITE_CORPO_MESSAGES_SIX_TEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { tipo: "muito_grande" };
      }
      partes.push(value);
    }
  } catch {
    return { tipo: "invalido" };
  }

  const bytes = new Uint8Array(total);
  let deslocamento = 0;
  for (const parte of partes) {
    bytes.set(parte, deslocamento);
    deslocamento += parte.byteLength;
  }

  try {
    const texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { tipo: "ok", valor: JSON.parse(texto) };
  } catch {
    return { tipo: "invalido" };
  }
}

async function segredosIguais(recebido: string, esperado: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [hashRecebido, hashEsperado] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(recebido)),
    crypto.subtle.digest("SHA-256", encoder.encode(esperado)),
  ]);
  const a = new Uint8Array(hashRecebido);
  const b = new Uint8Array(hashEsperado);
  let diferenca = 0;
  for (let i = 0; i < a.length; i += 1) diferenca |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diferenca === 0;
}

function requisicaoInvalida(): Response {
  return respostaErro(400, "A requisição não corresponde ao teste permitido.", "invalid_request_error");
}

function respostaErro(status: number, message: string, type: string): Response {
  return new Response(JSON.stringify({ type: "error", error: { type, message } }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

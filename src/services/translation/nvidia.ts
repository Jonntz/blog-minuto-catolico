/**
 * Provider NVIDIA NIM (`https://integrate.api.nvidia.com`) — padrão do projeto.
 *
 * Substitui o Workers AI como provider de adaptação. O motivo não é preço: os
 * dois são gratuitos. É DISPONIBILIDADE e QUALIDADE.
 *
 * ---------------------------------------------------------------------------
 * POR QUE SAIR DO WORKERS AI
 * ---------------------------------------------------------------------------
 * A cota do Workers AI é de 10.000 Neurons/dia e cada artigo custa DUAS
 * chamadas carregando o glossário inteiro. Medido em 28/07 (MEMORY.md §5a):
 * ~34 artigos/dia contra ~75 itens/dia que as fontes produzem — ou seja, a
 * fila NASCE represada. Pior: quando a cota estoura, todo item do lote vira
 * erro `quota`, o lote aborta e os artigos ficam em `draft` até o reset das
 * 00:00 UTC. Foi essa a causa do "a automação às vezes não funciona": não era
 * bug, era teto de cota batendo todo dia.
 *
 * O free tier da NVIDIA é dimensionado por REQUISIÇÃO (~40 req/min por modelo,
 * conta no NVIDIA Developer Program), não por um orçamento diário de compute
 * que o glossário consome desproporcionalmente. Com lote de 5 itens a cada 15
 * minutos são 10 chamadas por execução — duas ordens de grandeza abaixo do
 * limite por minuto.
 *
 * ---------------------------------------------------------------------------
 * O GANHO ESTRUTURAL: JUIZ ≠ RÉU
 * ---------------------------------------------------------------------------
 * Leia o aviso em `VerificacaoFactual` (provider.ts). Ele diz que a checagem
 * factual é feita pelo MESMO modelo que escreveu o texto, e chama isso de
 * "limitação estrutural, não descuido: com Workers AI não há um segundo modelo
 * de qualidade superior disponível de graça".
 *
 * Com a NVIDIA essa limitação DEIXA DE EXISTIR. O catálogo tem mais de 100
 * modelos no mesmo tier, então a adaptação roda num Nemotron da NVIDIA e a
 * verificação roda num Llama da Meta — famílias, pesos e dados de treino
 * diferentes. Um verificador de outra família não herda os vícios de quem
 * escreveu, que é justamente o que se quer de uma checagem adversarial.
 *
 * Efeito colateral bem-vindo: como o limite de ~40 req/min é POR MODELO, usar
 * dois modelos distintos também dobra a vazão disponível.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE ARQUIVO NÃO FAZ
 * ---------------------------------------------------------------------------
 * Não manda `response_format`, não manda `chat_template_kwargs`, não manda
 * nenhum campo fora do contrato OpenAI padrão. A lição está em `workers-ai.ts`:
 * mandar `response_format` para um modelo que não o suporta fez a API REJEITAR
 * a requisição inteira (erro 5025), e o sintoma chegou disfarçado de
 * "incapacidade do modelo". Aqui o formato de saída é pedido em prosa no
 * prompt (`prompt.ts`, formato de blocos) e recuperado pelos parsers, que já
 * são tolerantes na forma e rígidos no conteúdo. Resposta ilegível continua
 * reprovando como `resposta_invalida` — nada foi afrouxado.
 */

import {
  montarMensagensAdaptacao,
  montarMensagensVerificacao,
  parsearAdaptacao,
  parsearVerificacao,
  type MensagemChat,
} from "./prompt";
import type {
  ErroProvider,
  PedidoAdaptacao,
  PedidoVerificacao,
  RespostaAdaptacao,
  ResultadoProvider,
  TranslationProvider,
  UsoModelo,
  VerificacaoFactual,
} from "./provider";

// ---------------------------------------------------------------------------
// Endpoint e modelos
// ---------------------------------------------------------------------------

/** Endpoint OpenAI-compatível hospedado da NVIDIA. */
export const ENDPOINT_NVIDIA =
  "https://integrate.api.nvidia.com/v1/chat/completions";

/**
 * Modelos verificados como presentes em `GET /v1/models` (03/08/2026).
 *
 * O catálogo é público e muda; por isso os identificadores ficam aqui, num
 * lugar só, e são trocáveis por variável de ambiente sem rebuild.
 */
export const MODELOS_NVIDIA = {
  /** MoE 120B/12B ativos. O modelo próprio da NVIDIA, geração mais recente. */
  nemotronSuper: "nvidia/nemotron-3-super-120b-a12b",
  /** MoE 550B/55B ativos. O topo do catálogo — mais caro em crédito e tempo. */
  nemotronUltra: "nvidia/nemotron-3-ultra-550b-a55b",
  /** MoE 30B/3B ativos. Barato e rápido, para tarefa de comparação. */
  nemotronNano: "nvidia/nemotron-3-nano-30b-a3b",
  /** Geração anterior, dense 49B. Reserva estável. */
  nemotronSuper49b: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
  /** Meta, fora da família Nemotron — é o que torna a verificação independente. */
  llama70b: "meta/llama-3.3-70b-instruct",
  /** Mistral, terceira família disponível. */
  mistralMedium: "mistralai/mistral-medium-3.5-128b",
} as const satisfies Record<string, string>;

/** Modelo da ADAPTAÇÃO — é onde a qualidade editorial se decide. */
const MODELO_PADRAO: string = MODELOS_NVIDIA.nemotronSuper;

/**
 * Modelo da VERIFICAÇÃO — de OUTRA FAMÍLIA de propósito.
 *
 * Não é economia, é independência: ver "JUIZ ≠ RÉU" no cabeçalho. Se um dia
 * este voltar a ser um Nemotron, o veredito passa a ser o autor se avaliando, e
 * o aviso de `VerificacaoFactual` volta a valer integralmente.
 */
const MODELO_VERIFICACAO_PADRAO: string = MODELOS_NVIDIA.llama70b;

/** Aceita apelido de `MODELOS_NVIDIA` ou identificador completo `vendor/modelo`. */
function resolverModelo(bruto: string | undefined, padrao: string): string {
  const limpo = bruto?.trim();
  if (!limpo) return padrao;
  return (MODELOS_NVIDIA as Record<string, string>)[limpo] ?? limpo;
}

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

/**
 * Só o que o provider precisa. `NVIDIA_API_KEY` é SEGREDO (`wrangler secret
 * put`), nunca `vars` — e por isso é lido do binding do Worker, não de
 * `process.env`: MEMORY.md §2b registra que segredos não chegam em
 * `process.env` de forma confiável.
 */
export interface EnvNvidia {
  NVIDIA_API_KEY?: string;
  /** Apelido (`nemotronSuper`) ou id completo. Vazio usa o padrão. */
  NVIDIA_MODEL?: string;
  /** Idem, para a checagem factual. */
  NVIDIA_VERIFY_MODEL?: string;
}

// ---------------------------------------------------------------------------
// Controle de raciocínio
// ---------------------------------------------------------------------------

/**
 * Os Nemotron 3 são modelos de RACIOCÍNIO com raciocínio CONTROLÁVEL, e para
 * este pipeline ele precisa ficar DESLIGADO.
 *
 * Medido em produção em 03/08/2026, nas três primeiras adaptações reais:
 *   - 1 resposta parseou, com `tokens_out: 4629` — para um corpo de ~950
 *     tokens. Ou seja, ~3.500 tokens gastos pensando.
 *   - 2 respostas vieram INPARSEÁVEIS (`resposta_invalida`), ~54s cada.
 *
 * Raciocínio atrapalha aqui por dois motivos somados: ele sai do mesmo teto de
 * `max_tokens` que a resposta (raciocínio longo trunca a resposta no meio, o
 * `<think>` nunca fecha e sobra string vazia), e modelo raciocinando tende a
 * "explicar" em vez de emitir o formato de blocos exato que `prompt.ts` pede.
 * Nada aqui exige raciocínio: o trabalho é reescrever um texto seguindo um
 * gabarito, não resolver problema.
 *
 * Efeito colateral relevante: corta o consumo de token de saída em ~4x, o que
 * estica os créditos gratuitos.
 *
 * ⚠️ Este é o ÚNICO campo fora do contrato OpenAI que enviamos, e vai com rede
 * de proteção (`SEM_SUPORTE_A_EXTRAS`) justamente pela lição do `workers-ai.ts`:
 * campo não suportado pode fazer a API rejeitar a requisição INTEIRA.
 */
const EXTRAS_NEMOTRON = {
  chat_template_kwargs: { enable_thinking: false },
} as const;

/**
 * Só famílias que documentam o campo. O verificador é um Llama da Meta, cujo
 * chat template não conhece `enable_thinking` — mandar para ele seria criar
 * risco de 400 em troca de nada.
 */
function precisaDesligarRaciocinio(modelo: string): boolean {
  return /nemotron/i.test(modelo);
}

/**
 * Modelos que já rejeitaram os extras. Latch por isolate: aprendida a lição,
 * as chamadas seguintes nem tentam — em vez de pagar uma requisição perdida
 * por artigo, para sempre.
 */
const SEM_SUPORTE_A_EXTRAS = new Set<string>();

/** 400 causado pelo campo extra, e não pelo resto da requisição. */
function ehRecusaDeExtras(status: number, corpo: string): boolean {
  return (
    status === 400 &&
    /chat_template_kwargs|enable_thinking|unrecognized|unexpected|extra_forbidden|additional properties/i.test(
      corpo,
    )
  );
}

interface OpcoesChamada {
  maxTokens: number;
  temperatura: number;
  timeoutMs: number;
}

const OPCOES_ADAPTACAO: OpcoesChamada = {
  /**
   * Folgado de propósito, por DOIS motivos somados.
   *
   * O primeiro é o mesmo do Workers AI: `MAX_CHARS_CORPO` vai a 3.200
   * caracteres e em português são ~3,4 caracteres por token, ou seja ~950
   * tokens só de corpo, mais título, linha fina e tags. Teto apertado corta o
   * modelo no meio e o erro chega disfarçado de "resposta ilegível".
   *
   * O segundo é novo e específico daqui: os Nemotron são modelos de
   * RACIOCÍNIO. Eles podem gastar centenas de tokens pensando ANTES de escrever
   * a resposta, e esse gasto sai do mesmo teto. Cortar o raciocínio pela metade
   * produz resposta truncada. Em vez de tentar desligar o raciocínio com um
   * campo de API que talvez não exista (ver o cabeçalho), o teto é dimensionado
   * para caber os dois e `limparRaciocinio()` descarta o pensamento depois.
   */
  maxTokens: 8000,
  // Alguma liberdade é necessária: o texto precisa ser reescrito, não
  // decalcado. Acima disto o modelo começa a floreá-lo e a inventar.
  temperatura: 0.4,
  // Chamada de rede para fora da Cloudflare, em modelo grande e possivelmente
  // com raciocínio. O cron roda a cada 15 min com lote de 5, então há folga.
  timeoutMs: 180_000,
};

const OPCOES_VERIFICACAO: OpcoesChamada = {
  maxTokens: 2000,
  // Julgamento não é lugar para criatividade.
  temperatura: 0,
  /**
   * 150s, não 120s. Um `TimeoutError` real foi observado aqui em 03/08/2026, e
   * o custo do teto curto é assimétrico: a adaptação JÁ foi paga quando a
   * verificação começa, então estourar aqui joga fora as duas chamadas e adia o
   * artigo. Esperar 30s a mais é mais barato que refazer tudo.
   *
   * Se o timeout voltar a aparecer com frequência, o caminho não é subir de
   * novo — é trocar `NVIDIA_VERIFY_MODEL` por um modelo menor de OUTRA família
   * que não Nemotron (para preservar o juiz ≠ réu), como `google/gemma-4-31b-it`.
   */
  timeoutMs: 150_000,
};

// ---------------------------------------------------------------------------
// Classificação de erro
// ---------------------------------------------------------------------------

/**
 * A distinção decide o destino do artigo (ver `statusParaErro`): transitório
 * mantém `draft` para nova tentativa, definitivo reprova. Na dúvida
 * classificamos como transitório — errar para o lado de tentar de novo é
 * barato; errar para o lado de reprovar queima conteúdo bom por causa de um
 * soluço de rede.
 */
export function classificarErroHttp(status: number, corpo: string): ErroProvider {
  const mensagem = `HTTP ${status}: ${corpo.slice(0, 300)}`;

  // Chave ausente, inválida ou sem permissão. NÃO é falha de conteúdo nem de
  // rede: é configuração. `desativado` aborta o lote inteiro (deveAbortarLote)
  // em vez de deixar cada artigo descobrir sozinho que a chave não presta.
  if (status === 401 || status === 403) {
    return {
      tipo: "desativado",
      mensagem: `${mensagem} — NVIDIA_API_KEY ausente, inválida ou sem acesso ao modelo.`,
    };
  }

  // Rate limit (~40 req/min) ou crédito esgotado. Aborta o lote: insistir só
  // gasta tempo de execução do Worker. O cron seguinte tenta de novo.
  if (status === 429 || status === 402) {
    return { tipo: "quota", mensagem };
  }

  // 5xx é a NVIDIA fora do ar. Transitório por definição.
  if (status >= 500) {
    return { tipo: "indisponivel", mensagem };
  }

  /**
   * 4xx restante (tipicamente 400) é requisição malformada — modelo que saiu do
   * catálogo, campo recusado, prompt maior que a janela. NÃO é `resposta_invalida`:
   * a culpa não é do artigo, e marcá-lo como reprovado queimaria conteúdo bom
   * por erro nosso. Fica transitório; três seguidos abortam o lote pelo
   * `MAX_FALHAS_CONSECUTIVAS` em `adapt.ts` e o log diz o motivo.
   */
  return { tipo: "indisponivel", mensagem };
}

/** Falhas antes da resposta: DNS, TLS, timeout, socket. */
export function classificarErroRede(e: unknown): ErroProvider {
  const mensagem = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return { tipo: "rede", mensagem };
}

// ---------------------------------------------------------------------------
// Resposta da API
// ---------------------------------------------------------------------------

/**
 * Recorte tipado do payload OpenAI-compatível.
 *
 * Declarado à mão em vez de `any` (CLAUDE.md §8) e conferido em runtime por
 * `lerConteudo`: a resposta vem da rede, então presumir formato é presumir que
 * um terceiro nunca muda nada.
 */
interface RespostaChatNvidia {
  choices?: Array<{
    message?: {
      content?: unknown;
      /**
       * Alguns NIM de raciocínio devolvem o pensamento em campo SEPARADO, o que
       * já deixa `content` limpo. Declarado para documentar o formato — o
       * conteúdo dele é deliberadamente ignorado.
       */
      reasoning_content?: unknown;
    };
    finish_reason?: unknown;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

/**
 * Descarta o raciocínio embutido na resposta.
 *
 * Modelos de raciocínio emitem o pensamento inline, entre `<think>` e
 * `</think>`, antes da resposta de verdade. Isso NÃO pode chegar aos parsers.
 *
 * O perigo é preciso, e vale entender qual é para não relaxar a regra achando
 * que é cosmética. Os marcadores são procurados com regex ancorada em `^` e
 * flag `m`, tolerando só `[*_\s>#-]` antes — então uma MENÇÃO no meio de uma
 * frase ("aí o TITULO: seria esse") é inofensiva, e o marcador de verdade
 * vence. O que estraga é o modelo RASCUNHAR a resposta completa dentro do
 * `<think>`, com o marcador em início de linha, que é exatamente o que modelos
 * de raciocínio fazem antes de responder. Aí o parser encontra o rascunho
 * PRIMEIRO e é ele que vai ao ar.
 *
 * Verificado nos dois caminhos: na adaptação o título de ensaio é publicado no
 * lugar do final; na verificação um `VEREDITO: DIVERGENTE` ensaiado (com lista
 * de divergências) reprova um artigo que o veredito final aprovava.
 *
 * Também trata o caso do bloco NÃO FECHADO: quando o teto de tokens corta o
 * modelo ainda pensando, sobra `<think>` sem par. Aí não há resposta nenhuma
 * para aproveitar, e devolver string vazia faz o parser retornar `null`, que
 * vira `resposta_invalida` — falha fechada, como deve ser.
 */
export function limparRaciocinio(texto: string): string {
  const semBlocosFechados = texto.replace(/<think>[\s\S]*?<\/think>/gi, "");

  const aberturaOrfa = semBlocosFechados.search(/<think>/i);
  if (aberturaOrfa >= 0) return semBlocosFechados.slice(0, aberturaOrfa).trim();

  return semBlocosFechados.trim();
}

function lerUso(resposta: RespostaChatNvidia): UsoModelo {
  const u = resposta.usage;
  return {
    tokensIn: typeof u?.prompt_tokens === "number" ? u.prompt_tokens : null,
    tokensOut:
      typeof u?.completion_tokens === "number" ? u.completion_tokens : null,
  };
}

// ---------------------------------------------------------------------------
// Chamada de baixo nível
// ---------------------------------------------------------------------------

interface RetornoBruto {
  texto: string;
  uso: UsoModelo;
  /**
   * Diagnóstico que acompanha a resposta até a mensagem de erro.
   *
   * Existe porque a causa de um `resposta_invalida` só é visível no log do
   * Worker, e chegar nele exige `wrangler tail` no momento exato da falha. Com
   * isto o motivo fica gravado em `articles.validation_errors` e uma consulta
   * ao D1 responde "por que reprovou?" dias depois. `finish_reason: "length"`
   * é a assinatura de truncamento por `max_tokens`.
   */
  finishReason: string;
  /** Tamanho do conteúdo ANTES de descartar o raciocínio. */
  charsBrutos: number;
}

async function chamar(
  chave: string,
  modelo: string,
  mensagens: readonly MensagemChat[],
  opcoes: OpcoesChamada,
): Promise<{ ok: true; valor: RetornoBruto } | { ok: false; erro: ErroProvider }> {
  const comExtras =
    precisaDesligarRaciocinio(modelo) && !SEM_SUPORTE_A_EXTRAS.has(modelo);

  const resultado = await chamarUmaVez(chave, modelo, mensagens, opcoes, comExtras);

  // A API recusou o campo extra. Aprende (para não repetir a cada artigo) e
  // refaz sem ele: melhor raciocínio ligado que lote inteiro parado.
  if (!resultado.ok && resultado.recusouExtras) {
    SEM_SUPORTE_A_EXTRAS.add(modelo);
    console.warn(
      JSON.stringify({
        escopo: "translation.nvidia",
        evento: "extras_recusados",
        modelo,
        detalhe:
          "chat_template_kwargs rejeitado; refazendo sem ele. O raciocínio fica LIGADO e volta o risco de truncamento — considere trocar de modelo.",
      }),
    );
    const semExtras = await chamarUmaVez(chave, modelo, mensagens, opcoes, false);
    return semExtras.ok ? semExtras : { ok: false, erro: semExtras.erro };
  }

  return resultado.ok ? resultado : { ok: false, erro: resultado.erro };
}

type ResultadoChamada =
  | { ok: true; valor: RetornoBruto }
  | { ok: false; erro: ErroProvider; recusouExtras?: boolean };

async function chamarUmaVez(
  chave: string,
  modelo: string,
  mensagens: readonly MensagemChat[],
  opcoes: OpcoesChamada,
  comExtras: boolean,
): Promise<ResultadoChamada> {
  let resposta: Response;

  try {
    resposta = await fetch(ENDPOINT_NVIDIA, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: modelo,
        messages: mensagens.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: opcoes.maxTokens,
        temperature: opcoes.temperatura,
        // `stream: false` explícito: alguns NIM assumem streaming por padrão, e
        // um corpo SSE quebraria o `resposta.json()` abaixo de forma obscura.
        stream: false,
        ...(comExtras ? EXTRAS_NEMOTRON : {}),
      }),
      /**
       * Aqui `AbortSignal` funciona, ao contrário do que acontece no
       * `env.AI.run()` do Workers AI (que estoura `DevalueError` porque o
       * binding serializa os argumentos). Isto é `fetch` puro para um host
       * externo — o sinal cancela a requisição de verdade, em vez de só
       * abandoná-la como fazia o `Promise.race` de lá.
       */
      signal: AbortSignal.timeout(opcoes.timeoutMs),
    });
  } catch (e) {
    return { ok: false, erro: classificarErroRede(e) };
  }

  if (!resposta.ok) {
    // O corpo é lido para o log dizer o motivo real, e não só o status.
    const corpo = await resposta.text().catch(() => "");
    return {
      ok: false,
      erro: classificarErroHttp(resposta.status, corpo),
      recusouExtras: comExtras && ehRecusaDeExtras(resposta.status, corpo),
    };
  }

  let payload: RespostaChatNvidia;
  try {
    payload = (await resposta.json()) as RespostaChatNvidia;
  } catch (e) {
    return {
      ok: false,
      erro: {
        tipo: "indisponivel",
        mensagem: `Resposta 200 que não era JSON: ${e instanceof Error ? e.message : String(e)}`,
      },
    };
  }

  const finishReason = String(payload.choices?.[0]?.finish_reason ?? "?");
  const bruto = payload.choices?.[0]?.message?.content;

  if (typeof bruto !== "string" || bruto.trim().length === 0) {
    return {
      ok: false,
      erro: {
        tipo: "resposta_invalida",
        mensagem: `Resposta da NVIDIA sem choices[0].message.content utilizável (finish_reason=${finishReason}).`,
      },
    };
  }

  const texto = limparRaciocinio(bruto);

  /**
   * Conteúdo que existia e sumiu inteiro na limpeza = `<think>` sem fechar =
   * o teto de `max_tokens` cortou o modelo enquanto ele ainda pensava. Vale um
   * erro próprio: "o modelo não sabe responder" e "o modelo não teve espaço
   * para responder" pedem ações opostas.
   */
  if (texto.length === 0) {
    return {
      ok: false,
      erro: {
        tipo: "resposta_invalida",
        mensagem:
          `Modelo truncado enquanto raciocinava: ${bruto.length} chars de <think> sem fechar, ` +
          `finish_reason=${finishReason}, max_tokens=${opcoes.maxTokens}. ` +
          "Raciocínio deveria estar desligado — confira se chat_template_kwargs foi aceito.",
      },
    };
  }

  return {
    ok: true,
    valor: {
      texto,
      uso: lerUso(payload),
      finishReason,
      charsBrutos: bruto.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Falha ALTA e CEDO se a chave não existir.
 *
 * Mesmo raciocínio do stub da Anthropic: pedir um provider sem a credencial que
 * ele exige é erro de OPERAÇÃO, e deve aparecer na subida do lote — não item a
 * item, depois de já ter mexido no status de metade da fila.
 */
export function criarProviderNvidia(env: EnvNvidia): TranslationProvider {
  const chave = env.NVIDIA_API_KEY?.trim();

  if (!chave) {
    throw new Error(
      "TRANSLATION_PROVIDER=nvidia exige NVIDIA_API_KEY. " +
        "Pegue uma chave gratuita em https://build.nvidia.com (NVIDIA Developer Program) " +
        "e cadastre com: wrangler secret put NVIDIA_API_KEY",
    );
  }

  const modeloAdaptacao = resolverModelo(env.NVIDIA_MODEL, MODELO_PADRAO);
  const modeloVerificacao = resolverModelo(
    env.NVIDIA_VERIFY_MODEL,
    MODELO_VERIFICACAO_PADRAO,
  );

  return {
    nome: "nvidia",
    // Gravado em `articles.modelUsed`: é o modelo que ESCREVEU a matéria.
    modelo: modeloAdaptacao,

    async adaptar(
      pedido: PedidoAdaptacao,
    ): Promise<ResultadoProvider<RespostaAdaptacao>> {
      const bruto = await chamar(
        chave,
        modeloAdaptacao,
        montarMensagensAdaptacao(pedido),
        OPCOES_ADAPTACAO,
      );
      if (!bruto.ok) return { ok: false, erro: bruto.erro };

      const resposta = parsearAdaptacao(bruto.valor.texto);
      if (resposta === null) {
        return {
          ok: false,
          erro: {
            tipo: "resposta_invalida",
            mensagem:
              "Adaptação: resposta não continha os blocos TITULO/DEK/CORPO nem JSON equivalente " +
              `(finish_reason=${bruto.valor.finishReason}, ${bruto.valor.charsBrutos} chars brutos, ` +
              `${bruto.valor.texto.length} após limpar raciocínio). Trecho: ` +
              JSON.stringify(bruto.valor.texto.slice(0, 180)),
          },
        };
      }
      return { ok: true, valor: resposta, uso: bruto.valor.uso };
    },

    async verificarFatos(
      pedido: PedidoVerificacao,
    ): Promise<ResultadoProvider<VerificacaoFactual>> {
      const bruto = await chamar(
        chave,
        modeloVerificacao,
        montarMensagensVerificacao(pedido),
        OPCOES_VERIFICACAO,
      );
      if (!bruto.ok) return { ok: false, erro: bruto.erro };

      const veredito = parsearVerificacao(bruto.valor.texto);
      if (veredito === null) {
        // Sem veredito legível não há como certificar o texto. Isto vira
        // reprovação lá em `adapt.ts` — nunca aprovação por omissão.
        return {
          ok: false,
          erro: {
            tipo: "resposta_invalida",
            mensagem:
              "Verificação factual: resposta não continha VEREDITO legível " +
              `(finish_reason=${bruto.valor.finishReason}). Trecho: ` +
              JSON.stringify(bruto.valor.texto.slice(0, 180)),
          },
        };
      }
      return { ok: true, valor: veredito, uso: bruto.valor.uso };
    },
  };
}

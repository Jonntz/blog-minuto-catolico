/**
 * Provider padrão: Cloudflare Workers AI (binding `env.AI`).
 *
 * Escolhido porque o alvo de deploy já é Cloudflare Workers e o usuário pediu
 * modelo gratuito: sem API key, sem egress, sem cartão — 10.000 Neurons/dia,
 * reset às 00:00 UTC (MEMORY.md §2.6).
 *
 * ---------------------------------------------------------------------------
 * MODELO ESCOLHIDO E POR QUÊ
 * ---------------------------------------------------------------------------
 * `@cf/meta/llama-3.1-8b-instruct-fp8`
 *
 * Foi o único modelo classe ~8B que satisfez os quatro critérios ao mesmo
 * tempo, verificados em 27/07/2026:
 *
 *   1. Consta como ATIVO no catálogo público
 *      (developers.cloudflare.com/workers-ai/models/?tasks=Text+Generation).
 *      `@cf/meta/llama-3-8b-instruct`, `@cf/meta/llama-3.1-8b-instruct` e
 *      `@cf/meta/llama-3.1-8b-instruct-awq` aparecem como DEPRECATED — foram
 *      descartados por isso, apesar de o primeiro estar na lista oficial de
 *      suporte a JSON mode.
 *   2. Consta em `AiModels` no `cloudflare-env.d.ts` gerado pelo wrangler
 *      4.114.0 — ou seja, `env.AI.run()` o resolve pela sobrecarga TIPADA, com
 *      input e output conferidos em tempo de compilação. O `satisfies` logo
 *      abaixo transforma um identificador errado em erro de build.
 *   3. Llama 3.1 lista português entre os idiomas oficialmente suportados;
 *      Llama 3 (sem o .1) não listava.
 *   4. Janela de 32.000 tokens — folgada para uma notícia e o glossário.
 *
 * DISCREPÂNCIA REGISTRADA: a documentação de JSON mode
 * (developers.cloudflare.com/workers-ai/features/json-mode/) lista
 * `@cf/meta/llama-3.1-8b-instruct-fast` e `@cf/meta/llama-3.1-8b-instruct`,
 * mas NÃO a variante `-fp8`. Já `-fast` não existe no `AiModels` gerado (cairia
 * na sobrecarga não-tipada) e `@cf/meta/llama-3.1-8b-instruct` está deprecado.
 * Não há opção que atenda a tudo.
 *
 * Como isso foi resolvido: `response_format` é enviado assim mesmo (o campo é
 * aceito pelo tipo de entrada), e o parsing NUNCA confia nele — `extrairJson()`
 * em `prompt.ts` também recupera JSON embrulhado em prosa ou em cerca de
 * código, e qualquer coisa que não vire objeto válido é `resposta_invalida`,
 * que reprova. A ausência de JSON mode garantido degrada a taxa de acerto, não
 * a segurança.
 *
 * Se a qualidade não sustentar o padrão editorial, troque a constante
 * `MODELO_WORKERS_AI` (`@cf/meta/llama-3.3-70b-instruct-fp8-fast` é o degrau
 * seguinte, ainda no free tier porém bem mais caro em Neurons) ou mude o
 * provider inteiro para `anthropic`.
 *
 * ---------------------------------------------------------------------------
 * CUSTO EM NEURONS (tabela pública, 27/07/2026)
 * ---------------------------------------------------------------------------
 * `-fp8`: 13.778 Neurons por milhão de tokens de entrada, 26.128 por milhão de
 * saída. Com 10.000 Neurons/dia de franquia, a cota diária inteira equivale a
 * grosso modo 700 mil tokens de entrada — e cada artigo consome DUAS chamadas
 * (adaptação + verificação), ambas carregando o glossário. Daí o limite de
 * lote por execução e o pré-voo que evita gastar chamada em item impossível.
 * O consumo real continua NÃO MEDIDO (MEMORY.md §3).
 */

import {
  ESQUEMA_JSON_ADAPTACAO,
  ESQUEMA_JSON_VERIFICACAO,
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
// Modelo
// ---------------------------------------------------------------------------

/**
 * `satisfies keyof AiModels` é proposital: se a Cloudflare remover o modelo do
 * catálogo, o próximo `wrangler types` regenera `AiModels` sem ele e o build
 * quebra aqui — em vez de o cron descobrir em produção, com os artigos
 * silenciosamente presos em `draft`.
 */
/**
 * Modelos avaliados para adaptação PT-BR com terminologia eclesiástica.
 *
 * `satisfies keyof AiModels` é proposital: se a Cloudflare remover algum do
 * catálogo, o próximo `wrangler types` regenera `AiModels` sem ele e o build
 * quebra aqui — em vez de o cron descobrir em produção, com os artigos
 * silenciosamente presos em `draft`.
 */
export const MODELOS_AVALIADOS = {
  /** 70B. O mais capaz do catálogo gratuito para instrução complexa. */
  llama70b: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  /** 24B. Mistral é francesa — costuma ir bem em línguas românicas. */
  mistral24b: "@cf/mistralai/mistral-small-3.1-24b-instruct",
  /** MoE 17B. Geração mais recente da Meta. */
  llama4scout: "@cf/meta/llama-4-scout-17b-16e-instruct",
  /** MoE 30B da Alibaba. */
  qwen30b: "@cf/qwen/qwen3-30b-a3b-fp8",
  /** 12B do Google. */
  gemma12b: "@cf/google/gemma-3-12b-it",
  /** O 8B original — reprovou em teste real, mantido só para comparação. */
  llama8b: "@cf/meta/llama-3.1-8b-instruct-fp8",
} as const satisfies Record<string, keyof AiModels>;

/**
 * Modelo em uso. Trocável por env var sem rebuild — foi assim que os
 * candidatos acima foram comparados no mesmo artigo.
 */
function resolver(bruto: string | undefined, padrao: keyof AiModels): keyof AiModels {
  const limpo = bruto?.trim();
  if (!limpo) return padrao;
  const porApelido = (MODELOS_AVALIADOS as Record<string, string>)[limpo];
  return (porApelido ?? limpo) as keyof AiModels;
}

/** Modelo da ADAPTAÇÃO — é onde a qualidade editorial se decide. */
export function getModeloWorkersAi(): keyof AiModels {
  return resolver(process.env.WORKERS_AI_MODEL, MODELO_PADRAO);
}

/**
 * Modelo da VERIFICAÇÃO — deliberadamente menor que o da adaptação.
 *
 * ## Por que assimétrico
 *
 * Cada artigo custa DUAS chamadas, e a cota gratuita é de 10.000 Neurons/dia —
 * medido: ~34 artigos/dia com o 70B nas duas pontas, contra ~75 itens/dia que
 * as fontes produzem. Rodar as duas no modelo caro é desperdício, porque as
 * tarefas são muito diferentes:
 *
 *   - Adaptar é escrever: exige reescrever sem decalcar, respeitar terminologia
 *     eclesiástica e não inventar. Aqui o modelo grande se paga.
 *   - Verificar é comparar: ler dois textos e dizer se um contradiz o outro,
 *     devolvendo veredito curto. Um modelo menor dá conta.
 *
 * Baixar só a verificação aumenta bastante a vazão diária sem tocar na
 * qualidade do texto publicado — que é o que o leitor vê.
 *
 * Se a taxa de falso positivo do checador subir com o modelo menor, o caminho é
 * `WORKERS_AI_VERIFY_MODEL=llama70b` para voltar à simetria.
 */
export function getModeloVerificacao(): keyof AiModels {
  return resolver(process.env.WORKERS_AI_VERIFY_MODEL, MODELO_VERIFICACAO_PADRAO);
}

const MODELO_PADRAO: keyof AiModels = MODELOS_AVALIADOS.llama70b;
const MODELO_VERIFICACAO_PADRAO: keyof AiModels = MODELOS_AVALIADOS.mistral24b;

/** @deprecated Use `getModeloWorkersAi()`. Mantido para compatibilidade. */
export const MODELO_WORKERS_AI = MODELO_PADRAO;

/** Só o binding de IA — não peça o env inteiro para quem só chama o modelo. */
export interface EnvComAi {
  AI: Ai;
}

interface OpcoesChamada {
  maxTokens: number;
  temperatura: number;
  timeoutMs: number;
}

const OPCOES_ADAPTACAO: OpcoesChamada = {
  /**
   * 1.500 era APERTADO DEMAIS e essa era a causa real das reprovações.
   *
   * O corpo alvo vai a 3.200 caracteres (`MAX_CHARS_CORPO` em guardrails.ts).
   * Em português são ~3,4 caracteres por token, ou seja ~950 tokens só de
   * corpo — mais título, linha fina, tags e a moldura JSON com escapes. O
   * modelo era cortado no meio do objeto, o JSON nunca fechava, e o erro
   * chegava como "resposta não continha um objeto JSON": parecia incapacidade
   * do modelo, era teto de saída.
   *
   * Diagnosticado comparando 8B e 70B: os dois falhavam no MESMO ponto, o que
   * descartou capacidade como causa.
   */
  maxTokens: 4000,
  // Alguma liberdade é necessária: o texto precisa ser reescrito, não
  // decalcado. Acima disto o modelo começa a floreá-lo e a inventar.
  temperatura: 0.4,
  // 38s foi a média medida no 8B; modelos maiores demoram mais.
  // O cron roda a cada 15 min com lote pequeno, então há folga.
  timeoutMs: 180_000,
};

const OPCOES_VERIFICACAO: OpcoesChamada = {
  maxTokens: 800,
  // Julgamento não é lugar para criatividade.
  temperatura: 0,
  timeoutMs: 120_000,
};

// ---------------------------------------------------------------------------
// Classificação de erro
// ---------------------------------------------------------------------------

const RE_QUOTA =
  /neuron|quota|rate.?limit|limit exceeded|too many requests|\b429\b|insufficient|out of capacity/i;
const RE_REDE = /timeout|timed out|abort|network|fetch failed|socket|ECONNRESET/i;

/**
 * A distinção decide o destino do artigo: transitório mantém `draft` para nova
 * tentativa, definitivo reprova. Na dúvida classificamos como `indisponivel`
 * (transitório) — errar para o lado de tentar de novo é barato; errar para o
 * lado de reprovar queima conteúdo bom por causa de um soluço de rede.
 */
export function classificarErro(e: unknown): ErroProvider {
  const mensagem =
    e instanceof Error ? `${e.name}: ${e.message}` : String(e);

  if (RE_QUOTA.test(mensagem)) {
    return { tipo: "quota", mensagem };
  }
  if (RE_REDE.test(mensagem)) {
    return { tipo: "rede", mensagem };
  }
  return { tipo: "indisponivel", mensagem };
}

// ---------------------------------------------------------------------------
// Chamada de baixo nível
// ---------------------------------------------------------------------------

interface RetornoBruto {
  texto: unknown;
  uso: UsoModelo;
}

function lerUso(saida: {
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}): UsoModelo {
  const u = saida.usage;
  return {
    tokensIn: typeof u?.prompt_tokens === "number" ? u.prompt_tokens : null,
    tokensOut: typeof u?.completion_tokens === "number" ? u.completion_tokens : null,
  };
}

async function chamar(
  env: EnvComAi,
  modelo: keyof AiModels,
  mensagens: readonly MensagemChat[],
  esquema: object,
  opcoes: OpcoesChamada,
): Promise<{ ok: true; valor: RetornoBruto } | { ok: false; erro: ErroProvider }> {
  try {
    /**
     * O timeout NÃO usa `AbortSignal` de propósito.
     *
     * Passar `{ signal: AbortSignal.timeout(...) }` como terceiro argumento de
     * `env.AI.run()` quebra com `DevalueError: Cannot stringify arbitrary
     * non-POJOs`: em desenvolvimento o binding é um proxy que serializa a
     * chamada até o Workers AI remoto, e `AbortSignal` não é objeto simples.
     * Só aparece quando se chama o modelo de verdade — o que torna o erro
     * especialmente traiçoeiro.
     *
     * `Promise.race` dá o mesmo teto de tempo e funciona nos dois caminhos
     * (proxy de desenvolvimento e Worker publicado). A contrapartida é que a
     * requisição não é cancelada de fato, só abandonada; num lote pequeno com
     * limite de Neurons isso é aceitável.
     */
    const saida = await Promise.race([
      env.AI.run(modelo, {
        messages: mensagens.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: opcoes.maxTokens,
        temperature: opcoes.temperatura,
        // `response_format` NÃO é enviado.
        //
        // Confirmado contra a API real: esta variante responde
        // `5025: This model doesn't support JSON Schema` e REJEITA a
        // requisição inteira — não ignora o campo, como se supunha. O
        // esquema segue descrito no prompt, e `extrairJson()` recupera o
        // objeto mesmo quando vem embrulhado em prosa ou cerca de código.
        // Resposta que não vira JSON válido reprova como `resposta_invalida`,
        // então a ausência da garantia estrutural não afrouxa a validação.
      }),
      new Promise<never>((_, rejeitar) =>
        setTimeout(
          () => rejeitar(new Error(`Timeout de ${opcoes.timeoutMs}ms`)),
          opcoes.timeoutMs,
        ),
      ),
    ]);

    // Com o identificador do modelo vindo de env var, o TypeScript não resolve
    // mais a sobrecarga tipada de `run()` — o retorno é a união de todos os
    // formatos de saída do Workers AI. Estreitar aqui é obrigatório, e o
    // formato é verificado em runtime em vez de presumido.
    if (!ehSaidaDeTexto(saida)) {
      return {
        ok: false,
        erro: {
          tipo: "resposta_invalida",
          mensagem: `Modelo devolveu formato inesperado (sem campo "response").`,
        },
      };
    }

    return { ok: true, valor: { texto: saida.response, uso: lerUso(saida) } };
  } catch (e) {
    return { ok: false, erro: classificarErro(e) };
  }
}

/** Confere em runtime que a saída é geração de texto, e não imagem/áudio/etc. */
function ehSaidaDeTexto(
  saida: unknown,
): saida is {
  response: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
} {
  return (
    typeof saida === "object" &&
    saida !== null &&
    "response" in saida &&
    typeof (saida as { response: unknown }).response === "string"
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function criarProviderWorkersAi(env: EnvComAi): TranslationProvider {
  return {
    nome: "workersAi",
    modelo: getModeloWorkersAi(),

    async adaptar(
      pedido: PedidoAdaptacao,
    ): Promise<ResultadoProvider<RespostaAdaptacao>> {
      const bruto = await chamar(
        env,
        getModeloWorkersAi(),
        montarMensagensAdaptacao(pedido),
        ESQUEMA_JSON_ADAPTACAO,
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
              "Adaptação: resposta do modelo não continha um objeto JSON com titulo, dek e corpo_md.",
          },
        };
      }
      return { ok: true, valor: resposta, uso: bruto.valor.uso };
    },

    async verificarFatos(
      pedido: PedidoVerificacao,
    ): Promise<ResultadoProvider<VerificacaoFactual>> {
      const bruto = await chamar(
        env,
        getModeloVerificacao(),
        montarMensagensVerificacao(pedido),
        ESQUEMA_JSON_VERIFICACAO,
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
              "Verificação factual: resposta do modelo não continha { consistente, divergencias } válidos.",
          },
        };
      }
      return { ok: true, valor: veredito, uso: bruto.valor.uso };
    },
  };
}

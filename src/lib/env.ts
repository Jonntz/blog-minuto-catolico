import { z } from "zod";
import { getEnv } from "@/db";

/**
 * Validação de ambiente (CLAUDE.md §8: validar com zod, nunca ler process.env cru).
 *
 * Num Worker as variáveis chegam pelo binding do env, não por process.env — por
 * isso a validação é assíncrona e acontece por requisição. O custo é irrisório
 * perto de descobrir em produção que um segredo veio vazio.
 */

const esquemaEnv = z.object({
  /**
   * URL pública canônica, sem barra final. Usada em metadata, OG, JSON-LD,
   * sitemaps e feed — se vier errada, o SEO inteiro aponta para o lugar errado.
   */
  SITE_URL: z
    .string()
    .url("SITE_URL precisa ser uma URL absoluta (ex.: https://exemplo.com.br)")
    .transform((v) => v.replace(/\/+$/, "")),

  /**
   * Segredo compartilhado entre o worker agendador e as rotas /api/cron/*.
   * Validado em proxy.ts antes da requisição chegar na rota.
   */
  CRON_SECRET: z
    .string()
    .min(32, "CRON_SECRET precisa ter ao menos 32 caracteres"),

  /**
   * Liga/desliga a fonte Sign of the Cross Media.
   *
   * Existe porque o robots.txt deles bloqueia crawlers de IA nominalmente
   * (ClaudeBot, GPTBot, anthropic-ai, ...). Nosso bot não é nenhum deles e a
   * regra `User-agent: *` nos permite, mas a intenção declarada é contrária.
   * Ver MEMORY.md §2.3 — risco aceito conscientemente, desligável aqui.
   */
  SOURCE_SOTC_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  /**
   * Provider de adaptação. `anthropic` existe como stub e falha alto se
   * escolhido sem implementação — é degrau de saída, não opção silenciosa.
   */
  TRANSLATION_PROVIDER: z.enum(["workersAi", "anthropic"]).default("workersAi"),

  /**
   * Modelo da adaptação. Aceita apelido (`llama70b`) ou id completo
   * (`@cf/...`). Vazio usa o padrão de `workers-ai.ts`.
   */
  WORKERS_AI_MODEL: z.string().optional(),

  /**
   * Modelo da verificação factual — separado de propósito.
   *
   * Cada artigo custa duas chamadas contra 10.000 Neurons/dia. Medido: ~34
   * artigos/dia com o modelo grande nas duas pontas, contra ~75 itens/dia que
   * as fontes produzem. Verificar é tarefa mais simples que adaptar, então usar
   * um modelo menor aqui aumenta a vazão sem mexer na qualidade do texto
   * publicado. Ver `getModeloVerificacao()`.
   */
  WORKERS_AI_VERIFY_MODEL: z.string().optional(),
});

export type Env = z.infer<typeof esquemaEnv>;

const esquemaSiteUrl = esquemaEnv.shape.SITE_URL;

/**
 * URL canônica do site, de forma SÍNCRONA a partir de `process.env`.
 *
 * Por que não usar `getValidatedEnv()` aqui: aquela função lê o binding do
 * Worker, e sob Cache Components isso conta como "dado não cacheado". Chamada
 * de dentro de `generateMetadata`, derruba o build com
 * *"Uncached data was accessed outside of <Suspense>"* — e com razão: a URL
 * canônica precisa ser conhecida no momento em que a casca é prerenderizada,
 * senão canônica, Open Graph e JSON-LD sairiam com valor de requisição.
 *
 * `SITE_URL` é variável pública (está em `vars` no wrangler.jsonc, não é
 * segredo), então `process.env` é a fonte correta: o ambiente de build a
 * fornece, e em runtime o OpenNext a popula a partir do env do Worker.
 */
export function getSiteUrlSync(): string {
  const bruto = process.env.SITE_URL;
  const analise = esquemaSiteUrl.safeParse(bruto);

  if (analise.success) return analise.data;

  // Sem SITE_URL definida o build ainda precisa produzir URLs bem formadas.
  // Falhar aqui impediria qualquer build local; o valor errado é visível e
  // corrigível, e a validação estrita continua valendo em runtime.
  if (process.env.NODE_ENV === "production") {
    console.warn(
      JSON.stringify({
        evento: "site_url_ausente",
        detalhe:
          "SITE_URL não definida ou inválida — canônicas, OG e sitemaps vão sair com localhost.",
      }),
    );
  }
  return "http://localhost:3000";
}

let cache: Env | null = null;

export async function getValidatedEnv(): Promise<Env> {
  if (cache) return cache;

  const bruto = await getEnv();
  const resultado = esquemaEnv.safeParse(bruto);

  if (!resultado.success) {
    // Lista todos os problemas de uma vez — corrigir um por deploy é tortura.
    const problemas = resultado.error.issues
      .map((i) => `  - ${i.path.join(".") || "(raiz)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${problemas}`);
  }

  cache = resultado.data;
  return cache;
}

/**
 * Identificação do nosso crawler. CLAUDE.md §6 exige User-Agent próprio e
 * identificável — um bot anônimo é indefensável se alguém reclamar.
 */
export async function getUserAgent(): Promise<string> {
  const { SITE_URL } = await getValidatedEnv();
  return `MinutoCatolicoBot/1.0 (+${SITE_URL}/bot)`;
}

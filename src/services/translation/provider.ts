/**
 * Contrato da camada de adaptação editorial.
 *
 * Existe para que trocar o modelo por trás custe uma variável de ambiente, e
 * não uma reescrita. E a aposta se pagou: a migração de Workers AI para NVIDIA
 * NIM não tocou uma vírgula de `guardrails.ts`, `glossary.ts`, `prompt.ts` nem
 * `adapt.ts` — só entrou um arquivo novo (`nvidia.ts`) e um nome nesta lista.
 *
 * Providers, em ordem de preferência:
 *   - `nvidia`    — PADRÃO. Catálogo gratuito da NVIDIA (~40 req/min por
 *                   modelo), sem orçamento diário de compute para estourar.
 *                   Ver `nvidia.ts` para o porquê da troca.
 *   - `workersAi` — reserva. Continua funcionando, mas a cota de 10.000
 *                   Neurons/dia comporta ~34 artigos contra ~75 que as fontes
 *                   produzem, então a fila nasce represada.
 *   - `anthropic` — stub desativado. Degrau de saída pago, nunca silencioso.
 *
 * Regra de ouro deste arquivo: NADA aqui devolve prosa livre. Toda saída do
 * modelo passa por um formato declarado e validado. Prosa livre é o que
 * transforma "o modelo errou" em "o modelo errou e ninguém percebeu".
 */

import type { StatusArtigo } from "@/db/schema";

// ---------------------------------------------------------------------------
// Identificação de provider
// ---------------------------------------------------------------------------

export const PROVIDERS = ["nvidia", "workersAi", "anthropic"] as const;
export type NomeProvider = (typeof PROVIDERS)[number];

export function ehNomeProvider(v: string): v is NomeProvider {
  return (PROVIDERS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

export interface PedidoAdaptacao {
  /** Título original, em inglês. */
  tituloOriginal: string;
  /**
   * Texto original em inglês do qual a matéria será adaptada.
   *
   * IMPORTANTE — de onde isto vem: o schema não tem coluna para o corpo
   * original (ver `src/db/schema.ts`); a maior porção de texto original que a
   * ingestão conseguiu obter legalmente vive em `articles.sourceExcerpt`, e o
   * tamanho dela em `articles.sourceLength`. `adapt.ts` isola essa leitura em
   * `resolverTextoOriginal()` — se um dia o texto passar a vir de outra coluna
   * ou do R2, muda só aquela função.
   */
  textoOriginal: string;
  /** Comprimento do original em caracteres (`articles.sourceLength`). */
  comprimentoOriginal: number;
  /** Nome de exibição da fonte, para contexto do modelo. */
  sourceName: string;
  /** Slug de categoria que a ingestão inferiu do feed. */
  categoriaAtual: string;
  /** Alvo de comprimento do corpo adaptado, em caracteres. */
  alvoCaracteres: { min: number; max: number };
}

/** Original + adaptado, para a checagem factual adversarial. */
export interface PedidoVerificacao {
  textoOriginal: string;
  tituloOriginal: string;
  tituloAdaptado: string;
  corpoAdaptado: string;
}

// ---------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------

export interface RespostaAdaptacao {
  titulo: string;
  /** Linha de apoio (subtítulo). Coluna `dek` no schema. */
  dek: string;
  /** Corpo em Markdown, parágrafos separados por linha em branco. */
  corpoMd: string;
  /**
   * Sugestão de categoria do modelo. Só é aplicada por `adapt.ts` se for um
   * slug válido de `src/lib/categories.ts` — jamais confiamos no valor cru.
   */
  categoriaSugerida: string;
  tags: string[];
}

/**
 * Veredito da checagem factual.
 *
 * ⚠️ LEIA ANTES DE CONFIAR NISTO ⚠️
 * A pergunta a fazer sempre é: quem julga é o mesmo que escreveu?
 *
 *   - Com `nvidia` (padrão): NÃO. A adaptação roda num Nemotron da NVIDIA e a
 *     verificação num Llama da Meta — famílias e dados de treino diferentes.
 *     Um verificador de outra família não herda os vícios de quem escreveu, que
 *     é exatamente o que se quer de uma checagem adversarial. Se alguém apontar
 *     `NVIDIA_VERIFY_MODEL` para um Nemotron, essa garantia some em silêncio.
 *   - Com `workersAi`: SIM, e é limitação estrutural — lá não havia um segundo
 *     modelo de qualidade equivalente disponível de graça.
 *
 * Em qualquer dos casos as mitigações abaixo continuam valendo:
 *
 *   1. O verificador recebe o original e o adaptado, e é instruído a assumir
 *      postura ADVERSARIAL ("procure o erro", não "confirme que está bom").
 *   2. Ele NÃO vê o prompt de adaptação nem o glossário — chega ao texto sem a
 *      justificativa que o levou a escrevê-lo.
 *   3. `temperature: 0` e saída estruturada obrigatória.
 *   4. Falha de parsing, campo faltando ou `consistente` ausente ⇒ REPROVA.
 *      Incerteza nunca vira aprovação.
 *   5. As checagens que NÃO dependem de julgamento (número inventado, idioma,
 *      proporção, atribuição, glossário) são determinísticas em
 *      `guardrails.ts` e não passam por modelo nenhum. Este veredito é uma
 *      camada A MAIS, nunca a única.
 *
 * Quem for mexer aqui depois: não relaxe o item 4. É ele que faz o sistema
 * falhar fechado.
 */
export interface VerificacaoFactual {
  /** `true` só quando o modelo afirma explicitamente que não achou divergência. */
  consistente: boolean;
  /** Divergências encontradas. Não-vazio força reprovação mesmo com `consistente: true`. */
  divergencias: string[];
}

/** Contagem de tokens da chamada, quando o provider informa. */
export interface UsoModelo {
  tokensIn: number | null;
  tokensOut: number | null;
}

// ---------------------------------------------------------------------------
// Resultado — union discriminada, sem exceção como fluxo de controle
// ---------------------------------------------------------------------------

/**
 * Categorias de falha do provider. A distinção não é cosmética: ela decide o
 * destino do artigo.
 *
 * - `quota` / `rede` / `indisponivel` ⇒ problema NOSSO, não do conteúdo.
 *   O artigo continua `draft` e o próximo cron tenta de novo.
 * - `resposta_invalida` ⇒ o modelo respondeu algo que não dá para certificar.
 *   Vira `failed_validation` (fail-closed), contável pelo health-check.
 * - `desativado` ⇒ provider stub. Nunca publica.
 */
export const TIPOS_ERRO_PROVIDER = [
  "quota",
  "rede",
  "indisponivel",
  "resposta_invalida",
  "desativado",
] as const;
export type TipoErroProvider = (typeof TIPOS_ERRO_PROVIDER)[number];

export interface ErroProvider {
  tipo: TipoErroProvider;
  mensagem: string;
}

export type ResultadoProvider<T> =
  | { ok: true; valor: T; uso: UsoModelo }
  | { ok: false; erro: ErroProvider };

/**
 * Erros que devem deixar o artigo em `draft` para nova tentativa, em vez de
 * queimá-lo como reprovado.
 */
export function ehErroTransitorio(erro: ErroProvider): boolean {
  return (
    erro.tipo === "quota" || erro.tipo === "rede" || erro.tipo === "indisponivel"
  );
}

/**
 * Erros que devem ABORTAR o lote inteiro em vez de seguir para o próximo item.
 * Insistir com a cota estourada só gasta tempo de execução do Worker.
 */
export function deveAbortarLote(erro: ErroProvider): boolean {
  return erro.tipo === "quota" || erro.tipo === "desativado";
}

/** Destino do artigo quando o provider falha. */
export function statusParaErro(erro: ErroProvider): StatusArtigo {
  return ehErroTransitorio(erro) || erro.tipo === "desativado"
    ? "draft"
    : "failed_validation";
}

// ---------------------------------------------------------------------------
// A interface
// ---------------------------------------------------------------------------

export interface TranslationProvider {
  readonly nome: NomeProvider;
  /** Identificador exato do modelo, gravado em `articles.modelUsed`. */
  readonly modelo: string;

  /** Escreve a matéria adaptada em PT-BR. */
  adaptar(pedido: PedidoAdaptacao): Promise<ResultadoProvider<RespostaAdaptacao>>;

  /** Confere o adaptado contra o original. Ver o aviso em `VerificacaoFactual`. */
  verificarFatos(
    pedido: PedidoVerificacao,
  ): Promise<ResultadoProvider<VerificacaoFactual>>;
}

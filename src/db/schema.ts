import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Schema do Minuto Católico.
 *
 * Este arquivo é o CONTRATO entre as camadas de ingestão, adaptação e SEO.
 * Alterar uma coluna aqui quebra as três — mudanças exigem migration e uma nota
 * no MEMORY.md.
 *
 * Datas são inteiros unix (segundos). SQLite não tem tipo de data nativo, e
 * inteiro ordena e compara sem surpresa de fuso — o que importa num portal que
 * ordena tudo por recência.
 */

// ---------------------------------------------------------------------------
// Enums (SQLite não tem ENUM — usamos text + union de tipo + CHECK na migration)
// ---------------------------------------------------------------------------

/**
 * Estados possíveis de um artigo.
 *
 * `failed_validation` é o estado que torna a automação sem revisor humano
 * defensável: quando um guard-rail reprova, o item PRECISA ter para onde ir que
 * não seja "publicado" nem "sumiu". Ele fica aqui, contável pelo health-check.
 */
export const STATUS_ARTIGO = [
  /** Ingerido, ainda não adaptado (ex.: quota de IA esgotada no dia). */
  "draft",
  /** Adaptado e aprovado por todos os guard-rails. Vai ao ar. */
  "published",
  /** Adaptado mas reprovado por algum guard-rail. NÃO vai ao ar. */
  "failed_validation",
] as const;
export type StatusArtigo = (typeof STATUS_ARTIGO)[number];

/** Fontes suportadas. Adicionar fonte = adicionar aqui + em src/lib/categories.ts. */
export const FONTES = ["ewtn", "sotc"] as const;
export type Fonte = (typeof FONTES)[number];

// ---------------------------------------------------------------------------
// articles
// ---------------------------------------------------------------------------

export const articles = sqliteTable(
  "articles",
  {
    id: text("id").primaryKey(),

    // --- Deduplicação -------------------------------------------------------
    /**
     * sha256 da URL canônica normalizada da fonte.
     *
     * O UNIQUE abaixo é a garantia REAL de idempotência — não a checagem prévia
     * em código. Duas execuções de cron podem se sobrepor, e aí só o banco
     * resolve. A ingestão usa INSERT ... ON CONFLICT DO NOTHING e conta o
     * conflito como duplicado.
     */
    dedupeHash: text("dedupe_hash").notNull(),
    /**
     * sha256 de (título + excerpt) da fonte. Serve para detectar que a origem
     * EDITOU a matéria depois de publicada — caso em que reprocessamos em vez
     * de ignorar como duplicata.
     */
    sourceContentHash: text("source_content_hash").notNull(),

    // --- Proveniência (CLAUDE.md §6: rastrear no schema) --------------------
    source: text("source").$type<Fonte>().notNull(),
    sourceName: text("source_name").notNull(),
    /** URL canônica do original. Exibida como "Fonte: X" e linkada de volta. */
    sourceUrl: text("source_url").notNull(),
    sourceGuid: text("source_guid"),
    sourceTitle: text("source_title").notNull(),
    sourceExcerpt: text("source_excerpt"),
    sourceAuthor: text("source_author"),
    /** Tamanho do original em caracteres — usado pelo guard-rail de proporção. */
    sourceLength: integer("source_length").notNull().default(0),

    // --- Conteúdo adaptado em PT-BR ----------------------------------------
    slug: text("slug").notNull(),
    title: text("title"),
    dek: text("dek"),
    bodyMd: text("body_md"),
    categorySlug: text("category_slug").notNull().default("vaticano"),
    tags: text("tags", { mode: "json" }).$type<string[]>(),

    // --- Mídia --------------------------------------------------------------
    imageUrl: text("image_url"),
    imageCredit: text("image_credit"),
    imageCaption: text("image_caption"),

    // --- Estado e auditoria -------------------------------------------------
    status: text("status").$type<StatusArtigo>().notNull().default("draft"),
    /** Lista de guard-rails reprovados. Vazio/ausente quando publicado. */
    validationErrors: text("validation_errors", { mode: "json" }).$type<
      string[]
    >(),
    providerUsed: text("provider_used"),
    modelUsed: text("model_used"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),

    // --- Tempo (unix segundos) ---------------------------------------------
    /** Data de publicação NA FONTE — é esta que ordena o feed e o sitemap. */
    publishedAt: integer("published_at").notNull(),
    fetchedAt: integer("fetched_at").notNull(),
    adaptedAt: integer("adapted_at"),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("articles_dedupe_hash_idx").on(t.dedupeHash),
    uniqueIndex("articles_slug_idx").on(t.slug),
    // Consulta mais quente do site: capa e listagens ordenadas por recência.
    index("articles_status_published_idx").on(t.status, t.publishedAt),
    index("articles_category_published_idx").on(
      t.categorySlug,
      t.status,
      t.publishedAt,
    ),
    // Fila de reprocessamento (drafts pendentes de adaptação).
    index("articles_status_fetched_idx").on(t.status, t.fetchedAt),
  ],
);

export type Article = typeof articles.$inferSelect;
export type NovoArticle = typeof articles.$inferInsert;

// ---------------------------------------------------------------------------
// liturgical_days — calendário TRADICIONAL de 1962 (missa tridentina)
// ---------------------------------------------------------------------------

/**
 * Atenção ao rito: este é o calendário de 1962, NÃO o Novus Ordo.
 *
 * Consequência concreta no schema: existem `epistle` e `gospel`, e NÃO existe
 * salmo responsorial — ele não faz parte da missa tridentina. O mockup do design
 * mostrava "1ª leitura / Salmo / Evangelho"; isso está errado para este rito e
 * foi corrigido aqui e na UI.
 *
 * Populado 1× por mês a partir de salvemaria.com.br/calendario/, não por
 * requisição. Se a fonte cair, a home não cai junto.
 */
export const liturgicalDays = sqliteTable(
  "liturgical_days",
  {
    /** 'YYYY-MM-DD' — chave natural, ordena lexicograficamente. */
    date: text("date").primaryKey(),
    /**
     * 'Quarta', 'Domingo', ... DERIVADO da data, não copiado da fonte.
     *
     * A fonte tem erro de digitação real (`Domigo` em 05/10/2025); confiar no
     * publicado custaria o dia inteiro. O valor da fonte serve só de conferência
     * no parser, e divergência gera aviso.
     */
    weekday: text("weekday").notNull(),

    /** Festa do dia. Ex.: 'Preciosíssimo Sangue de N. Senhor'. */
    feast: text("feast").notNull(),
    /** Comemoração secundária. Ex.: 'Com. de S. Processo e S. Martiniano'. */
    commemoration: text("commemoration"),
    /** Classe da festa: '1ª Classe' … '4ª classe'. */
    classis: text("classis"),
    /** Santo congregado mariano (coluna "Calendário Mariano" da fonte). */
    marianSaint: text("marian_saint"),

    /** Cor litúrgica: 'Vermelho', 'Branco', 'Verde', 'Roxo', 'Rosa', 'Preto'. */
    color: text("color"),
    gloria: integer("gloria", { mode: "boolean" }),
    credo: integer("credo", { mode: "boolean" }),
    preface: text("preface"),
    /** Nota extra da fonte. Ex.: 'Abstinência de carne', 'Primeiro Sábado'. */
    note: text("note"),

    /** Epístola. Ex.: 'Hb 9, 11-15'. */
    epistle: text("epistle"),
    /** Evangelho. Ex.: 'Jo 19, 30-35'. */
    gospel: text("gospel"),

    sourceUrl: text("source_url").notNull(),
    fetchedAt: integer("fetched_at").notNull(),
  },
  (t) => [index("liturgical_days_fetched_idx").on(t.fetchedAt)],
);

export type LiturgicalDay = typeof liturgicalDays.$inferSelect;
export type NovoLiturgicalDay = typeof liturgicalDays.$inferInsert;

// ---------------------------------------------------------------------------
// ingestion_runs — observabilidade
// ---------------------------------------------------------------------------

/**
 * Uma linha por execução de cron. CLAUDE.md §4: "falha silenciosa de ingestão é
 * o pior cenário para um portal de notícias". Sem painel admin, esta tabela É a
 * observabilidade — o health-check lê daqui.
 */
export const ingestionRuns = sqliteTable(
  "ingestion_runs",
  {
    id: text("id").primaryKey(),
    /** 'ewtn' | 'sotc' | 'liturgy' */
    source: text("source").notNull(),

    startedAt: integer("started_at").notNull(),
    finishedAt: integer("finished_at"),
    durationMs: integer("duration_ms"),

    itemsSeen: integer("items_seen").notNull().default(0),
    itemsNew: integer("items_new").notNull().default(0),
    itemsDuplicate: integer("items_duplicate").notNull().default(0),
    /** Itens já conhecidos cuja origem editou o conteúdo depois de publicado. */
    itemsUpdated: integer("items_updated").notNull().default(0),
    itemsPublished: integer("items_published").notNull().default(0),
    itemsFailed: integer("items_failed").notNull().default(0),

    /** Preenchido só quando a execução inteira falhou. */
    error: text("error"),
  },
  (t) => [index("ingestion_runs_source_started_idx").on(t.source, t.startedAt)],
);

export type IngestionRun = typeof ingestionRuns.$inferSelect;
export type NovoIngestionRun = typeof ingestionRuns.$inferInsert;

// ---------------------------------------------------------------------------
// subscribers — newsletter
// ---------------------------------------------------------------------------

/**
 * Inscritos da newsletter ("Receba o resumo da manhã" no design).
 *
 * `confirmedAt` existe desde já porque enviar e-mail para endereço não
 * confirmado é como se constrói reputação de spam — e um portal de notícias
 * vive de chegar na caixa de entrada. O envio em si ainda não está implementado.
 */
export const subscribers = sqliteTable(
  "subscribers",
  {
    id: text("id").primaryKey(),
    /** Guardado em minúsculas e sem espaços; o UNIQUE é a garantia real. */
    email: text("email").notNull(),
    createdAt: integer("created_at").notNull(),
    confirmedAt: integer("confirmed_at"),
    unsubscribedAt: integer("unsubscribed_at"),
    /** 'newsletter-home' etc. — para saber o que converte. */
    source: text("source").notNull().default("newsletter-home"),
  },
  (t) => [uniqueIndex("subscribers_email_idx").on(t.email)],
);

export type Subscriber = typeof subscribers.$inferSelect;
export type NovoSubscriber = typeof subscribers.$inferInsert;

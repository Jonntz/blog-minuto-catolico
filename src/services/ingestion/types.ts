/**
 * Contrato interno da ingestão.
 *
 * `ItemNormalizado` é o que cada adaptador de fonte produz e o que a camada de
 * gravação consome. Nenhum campo em PT-BR aparece aqui de propósito: a ingestão
 * grava o item como `draft` com a proveniência preenchida, e a adaptação
 * (fase C) é quem escreve `title`, `dek` e `bodyMd`.
 */

import type { Fonte } from "@/db/schema";

export interface ItemNormalizado {
  fonte: Fonte;
  /** Nome de exibição, para o bloco "Fonte: X" (CLAUDE.md §6). */
  nomeFonte: string;
  /** URL canônica do original — base do `dedupeHash` e do link de volta. */
  urlCanonica: string;
  guid?: string;
  titulo: string;
  /**
   * Material bruto para a adaptação.
   *
   * ATENÇÃO: não é texto de exibição. Quando a fonte publica o corpo no feed
   * (EWTN, via `content:encoded`), este campo carrega o texto do artigo em
   * limpo, truncado — é o insumo que a fase C precisa para reescrever em PT-BR
   * sem inventar fato. A UI NUNCA deve renderizar isto: republicar texto da
   * fonte é exatamente o que CLAUDE.md §6 proíbe. Ver MEMORY.md.
   */
  excerpt?: string;
  autor?: string;
  /** Tamanho do original em caracteres, ANTES do truncamento. */
  tamanhoOriginal: number;
  categoria: string;
  tags: string[];
  imagemUrl?: string;
  imagemCredito?: string;
  imagemLegenda?: string;
  publicadoEm: number;
}

/** Resultado da coleta de uma fonte, antes da gravação. */
export interface ColetaDaFonte {
  itens: ItemNormalizado[];
  /** Itens do feed que não puderam ser normalizados (sem link, sem título…). */
  descartados: number;
}

/** Tudo que um adaptador de fonte precisa receber de fora. */
export interface ContextoIngestao {
  userAgent: string;
  agora: number;
}

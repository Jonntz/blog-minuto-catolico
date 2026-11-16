"use server";

import { z } from "zod";
import { buscarPorSlugs, type ArtigoCard } from "@/lib/articles";

const esquemaSlugs = z.array(z.string().trim().min(1).max(160)).max(48);

/**
 * Busca os cartões das matérias que o leitor salvou no `localStorage` (`bn-salvos`).
 */
export async function obterArtigosSalvos(
  slugsBrutos: unknown,
): Promise<ArtigoCard[]> {
  const analise = esquemaSlugs.safeParse(slugsBrutos);
  if (!analise.success || analise.data.length === 0) return [];
  return buscarPorSlugs(analise.data);
}

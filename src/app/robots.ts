import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getSiteUrl } from "@/lib/seo";

/**
 * /robots.txt (CLAUDE.md §5).
 *
 * Libera o conteúdo, aponta os DOIS sitemaps (o geral e o do Google News, que
 * é um arquivo distinto) e fecha o que não deve ser rastreado.
 *
 * O que fica bloqueado e por quê:
 *   /api/     — rotas de cron e webhooks; não são páginas e já exigem segredo.
 *               Rastreá-las só gasta orçamento de crawl e polui o Search Console.
 *   /admin/   — painel de revisão editorial (route group `(admin)`).
 *
 * Bloquear no robots.txt NÃO é controle de acesso — quem garante isso é o
 * `src/proxy.ts`. Aqui é apenas higiene de rastreamento.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  // Marca a rota como dinâmica sob Cache Components: SITE_URL vem do binding do
  // Worker, que não existe em tempo de build.
  await connection();
  const base = await getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/"],
      },
    ],
    sitemap: [`${base}/sitemap.xml`, `${base}/news-sitemap.xml`],
    host: base,
  };
}

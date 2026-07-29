import {
  jsonLdNewsArticle,
  jsonLdTrilhaArtigo,
  jsonLdWebSite,
  jsonLdOrganizacao,
  type ArtigoSeo,
  type JsonLd as NoJsonLd,
} from "@/lib/seo";

/**
 * Injeção de JSON-LD (CLAUDE.md §5: "componentizar a injeção de schema").
 *
 * São Server Components: o schema sai pronto no HTML da primeira resposta. Se
 * fosse injetado por efeito no cliente, o Googlebot precisaria renderizar o JS
 * para enxergá-lo — o que ele faz em outra fila, com outro prazo. Para um
 * portal de notícias, que corre atrás do índice em minutos, isso é a diferença
 * entre aparecer e não aparecer.
 */

/**
 * Serializa com escape do que pode fechar a tag `<script>`.
 *
 * `JSON.stringify` sozinho NÃO é seguro dentro de `<script>`: um título
 * contendo `</script>` encerraria o bloco e o resto do JSON viraria HTML. Como
 * os títulos vêm de fontes externas, isso é entrada não confiável — daí escapar
 * `<`, `>` e `&` como escapes Unicode, que o JSON entende e o parser de HTML
 * não enxerga.
 */
function serializar(dados: NoJsonLd | readonly NoJsonLd[]): string {
  return JSON.stringify(dados)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export interface PropsJsonLd {
  dados: NoJsonLd | readonly NoJsonLd[];
  /** Distingue os blocos no DOM; útil para depurar no inspetor. */
  id?: string;
}

/** Bloco cru. Use os componentes específicos abaixo sempre que existir um. */
export function JsonLd({ dados, id }: PropsJsonLd) {
  return (
    <script
      id={id}
      type="application/ld+json"
      // Conteúdo serializado e escapado por `serializar` logo acima.
      dangerouslySetInnerHTML={{ __html: serializar(dados) }}
    />
  );
}

/**
 * Schema completo de uma página de artigo: `NewsArticle` + `BreadcrumbList`.
 *
 * Uso em `src/app/(site)/noticia/[slug]/page.tsx`:
 * ```tsx
 * <ArtigoJsonLd artigo={artigo} />
 * ```
 */
export async function ArtigoJsonLd({ artigo }: { artigo: ArtigoSeo }) {
  const [artigoLd, trilhaLd] = await Promise.all([
    jsonLdNewsArticle(artigo),
    jsonLdTrilhaArtigo(artigo),
  ]);
  return <JsonLd id="ld-artigo" dados={[artigoLd, trilhaLd]} />;
}

/**
 * Schema do site: `WebSite` + `NewsMediaOrganization` com logo.
 *
 * Vai uma vez só, na home (ou no layout do grupo `(site)`). Repetir em toda
 * página não acrescenta nada e ainda engorda o HTML de cada artigo.
 */
export async function SiteJsonLd() {
  const [siteLd, orgLd] = await Promise.all([
    jsonLdWebSite(),
    jsonLdOrganizacao(),
  ]);
  return <JsonLd id="ld-site" dados={[siteLd, orgLd]} />;
}

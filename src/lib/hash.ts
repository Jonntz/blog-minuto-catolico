/**
 * Hashing e canonicalização de URL — base da idempotência da ingestão.
 *
 * `crypto.subtle` é nativo no runtime dos Workers (e no Node 20+), então não
 * há dependência de `node:crypto` aqui. Isso importa: o alvo de deploy é
 * Cloudflare Workers e qualquer import de módulo Node encareceria o bundle ou
 * simplesmente não rodaria.
 */

/** Parâmetros de rastreamento que NÃO identificam o recurso. */
const PARAMETROS_DE_RASTREIO: readonly RegExp[] = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^gbraid$/i,
  /^wbraid$/i,
  /^msclkid$/i,
  /^yclid$/i,
  /^igshid$/i,
  /^mc_(cid|eid)$/i,
  /^_hs(enc|mi)$/i,
];

function ehRastreio(chave: string): boolean {
  return PARAMETROS_DE_RASTREIO.some((padrao) => padrao.test(chave));
}

/**
 * Forma canônica de uma URL, para que a MESMA notícia gere sempre o mesmo hash.
 *
 * Regras (todas necessárias na prática — feeds e redes sociais devolvem a mesma
 * matéria com adornos diferentes):
 *   - host em minúsculas e sem porta padrão (`URL` já resolve);
 *   - fragmento (`#...`) descartado — nunca identifica outro documento;
 *   - parâmetros de rastreio removidos;
 *   - parâmetros restantes ordenados, para que a ordem não afete o hash;
 *   - barra final removida (menos na raiz).
 *
 * Lança se a URL for inválida — o chamador decide se pula o item ou falha.
 */
export function canonicalizarUrl(bruta: string): string {
  const url = new URL(bruta.trim());

  url.hash = "";
  url.username = "";
  url.password = "";

  const parametros = [...url.searchParams.entries()]
    .filter(([chave]) => !ehRastreio(chave))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  url.search = "";
  for (const [chave, valor] of parametros) url.searchParams.append(chave, valor);

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

/** Igual a `canonicalizarUrl`, mas devolve `undefined` em vez de lançar. */
export function canonicalizarUrlSegura(bruta: string | undefined): string | undefined {
  if (!bruta) return undefined;
  try {
    return canonicalizarUrl(bruta);
  } catch {
    return undefined;
  }
}

const codificador = new TextEncoder();

/** sha256 em hexadecimal minúsculo. */
export async function sha256Hex(texto: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", codificador.encode(texto));
  const bytes = new Uint8Array(buffer);
  let saida = "";
  for (const byte of bytes) saida += byte.toString(16).padStart(2, "0");
  return saida;
}

/**
 * Hash de deduplicação: sha256 da URL canônica.
 *
 * A garantia real de não duplicar é o UNIQUE em `articles.dedupe_hash` — este
 * valor só existe para alimentá-lo. Ver `src/services/ingestion/dedupe.ts`.
 */
export async function hashDeduplicacao(urlCanonica: string): Promise<string> {
  return sha256Hex(urlCanonica);
}

/**
 * Hash do conteúdo na fonte: sha256(título + excerpt).
 *
 * Muda quando a origem EDITA a matéria depois de já termos ingerido — é o que
 * distingue "notícia repetida no feed" (ignorar) de "notícia corrigida na
 * origem" (atualizar).
 */
export async function hashConteudoFonte(
  titulo: string,
  excerpt: string | undefined,
): Promise<string> {
  return sha256Hex(`${titulo.trim()}\n${(excerpt ?? "").trim()}`);
}

/** Sufixo curto e estável derivado de um hash — usado para desambiguar slug. */
export function sufixoCurto(hash: string, tamanho = 6): string {
  return hash.slice(0, tamanho);
}

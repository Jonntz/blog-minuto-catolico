import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Adapter OpenNext → Cloudflare Workers.
 *
 * Roda com os padrões: cache incremental em assets estáticos e fila em memória.
 * Quando o volume justificar, trocar por R2 + Durable Objects aqui (o binding R2
 * já existe no wrangler.jsonc).
 */
export default defineCloudflareConfig();

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Db = DrizzleD1Database<typeof schema>;

/**
 * Cliente Drizzle sobre o D1.
 *
 * É assíncrono porque o binding vem do contexto do Worker, que em `next dev` só
 * fica disponível depois que o proxy do OpenNext sobe. Não guardar o retorno em
 * módulo (nada de singleton no topo do arquivo): num Worker o contexto é por
 * requisição, e cachear vaza estado entre requisições.
 */
export async function getDb(): Promise<Db> {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}

/** Acesso direto ao env do Worker (Workers AI, R2, secrets). */
export async function getEnv() {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}

export { schema };

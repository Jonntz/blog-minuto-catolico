import { defineConfig } from "drizzle-kit";

/**
 * As migrations são geradas aqui (`npm run db:generate`) mas aplicadas pelo
 * wrangler (`npm run db:migrate:local` / `:remote`), que é quem conhece o D1.
 * Por isso `out` aponta para o mesmo `migrations_dir` do wrangler.jsonc.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  verbose: true,
  strict: true,
});

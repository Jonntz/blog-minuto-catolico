/**
 * Patch obrigatório do Next 16 para rodar em workerd (Cloudflare Workers).
 *
 * ## O bug
 *
 * `createInlinedDataReadableStream()` — o trecho do Next que embute o payload
 * RSC no HTML como `<script>self.__next_f.push(...)</script>` — cria o stream
 * com `type: "bytes"`:
 *
 *     const readable = new ReadableStream({ type: 'bytes', start(controller) {…} })
 *
 * Cada `enqueue()` desse stream é UMA tag `<script>…</script>` inteira. Do outro
 * lado, `createFlightDataInjectionTransformStream()` consome esse stream com um
 * reader COMUM (`stream.getReader()`) e reemite cada leitura no mesmo controller
 * por onde passa o HTML do React — os dois se intercalam de propósito.
 *
 * Em Node isso é seguro: um reader comum devolve o chunk inteiro, então nunca
 * cai HTML no meio de um `<script>`. **No workerd não.** Um `ReadableStream`
 * com `type: "bytes"` lido por reader comum é auto-fatiado em pedaços de
 * 4096 bytes. Medido neste projeto, no mesmo workerd que serve o site:
 *
 *     type: undefined  → [10000]              (Node e workerd concordam)
 *     type: "bytes"    → [4096, 4096, 1808]   (só workerd)
 *
 * Como as tags de payload passam de 4 KB assim que a página tem conteúdo real,
 * o resultado em produção era: `<script>self.__next_f.push([1,"…` cortado
 * exatamente no byte 4096, um `<link rel="preload">` + `<div hidden id="S:n">`
 * do React enfiados na fenda, e o resto do payload vazando como texto puro no
 * topo da página. O `<script>` quebrado derruba a hidratação inteira:
 *
 *     Uncaught SyntaxError: Unexpected identifier 'preload'
 *     → "This page couldn't load" (error boundary padrão do Next)
 *
 * O site inteiro morria — capa e artigos. Ver MEMORY.md §5c.
 *
 * ## O conserto
 *
 * Remover `type: "bytes"`. Esse stream nunca é lido em modo BYOB — o único
 * consumidor é o transform acima, com reader comum —, então o `type` não
 * comprava nada e era só o gatilho do fatiamento. Sem ele, workerd passa a
 * entregar o chunk inteiro, igual ao Node.
 *
 * ## Onde o patch precisa cair
 *
 * O que roda em produção NÃO é `dist/server/app-render/use-flight-response.js`:
 * o Next embarca um servidor pré-compilado em
 * `dist/compiled/next-server/app-page*.runtime.*.js`, e é dele que o esbuild do
 * OpenNext monta o `handler.mjs`. Patchar só a fonte compila e não conserta
 * nada — foi o primeiro engano aqui. Os dois conjuntos são patchados: o
 * compilado porque é o que executa, a fonte para o dia em que o Next parar de
 * pré-compilar.
 *
 * Nos runtimes minificados só o stream do flight usa método abreviado
 * (`start(`); os do React usam `start:function(`. É isso que separa um do outro
 * sem depender de nome de variável, que muda a cada build.
 *
 * ## Por que um patch e não uma configuração
 *
 * Não há knob: nem `next.config.ts`, nem `open-next.config.ts`
 * (`defineCloudflareConfig` não expõe hook de patch de código). O bug é upstream
 * — Next 16.2.12 / @opennextjs/cloudflare 1.20.2, ambos os mais recentes em
 * 31/07/2026.
 *
 * Roda no `postinstall` (pega `npm ci` do CI e o dev local) e de novo no
 * `cf:build`, porque um CI com `--ignore-scripts` publicaria o site quebrado
 * sem avisar. É idempotente.
 *
 * ## Quando o Next for atualizado
 *
 * Se algum alvo sumir, este script **falha o build** de propósito, em vez de
 * virar no-op. Aí verifique se o upstream corrigiu: se `type:"bytes"` não
 * estiver mais no `createInlinedDataReadableStream`, apague este script e as
 * duas referências no package.json. Se estiver lá com outra forma, ajuste a
 * âncora.
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

/** Marca de idempotência — some junto com o patch se o Next for reinstalado. */
const MARCA = "/* patch-next-flight-stream (workerd) */";

/**
 * Fonte não-minificada. Não é o que executa hoje, mas é patchada junto.
 * Âncora tolerante a espaçamento e presa ao `start (controller)` seguinte, para
 * não pegar outro `ReadableStream` do mesmo arquivo.
 */
const ALVO_FONTE =
  /(new ReadableStream\(\{\s*)type:\s*'bytes',(\s*start\s*\(controller\))/g;

/**
 * Servidor pré-compilado — este é o que roda no Worker.
 * `start(` abreviado só existe no stream do flight; o React usa `start:function(`.
 */
const ALVO_COMPILADO = /(new ReadableStream\(\{)type:"bytes",(start\()/g;

/** Arquivos de fonte, relativos à raiz do pacote `next`. */
const FONTES = [
  "dist/esm/server/app-render/use-flight-response.js",
  "dist/server/app-render/use-flight-response.js",
];

/** Diretório dos runtimes pré-compilados. */
const DIR_COMPILADOS = "dist/compiled/next-server";

/** Só os runtimes de App Router renderizam páginas — `app-route`/`pages` não. */
const COMPILADOS = /^app-page.*\.runtime\.(dev|prod)\.js$/;

function raizDoNext() {
  // `next/package.json` está em `exports`, então resolve sem depender de layout
  // de node_modules (hoisting, workspaces, pnpm).
  return path.dirname(require.resolve("next/package.json"));
}

/**
 * Aplica uma âncora a um arquivo, exigindo exatamente uma ocorrência.
 *
 * @param {string} arquivo caminho absoluto
 * @param {RegExp} alvo âncora com flag `g`
 * @returns {Promise<"aplicado" | "ja-aplicado">}
 */
async function aplicar(arquivo, alvo) {
  const origem = await readFile(arquivo, "utf8");
  const ocorrencias = origem.match(alvo)?.length ?? 0;

  if (ocorrencias === 0) {
    if (origem.includes(MARCA)) return "ja-aplicado";
    throw new Error(
      `alvo não encontrado em ${path.basename(arquivo)}\n` +
        "O Next mudou createInlinedDataReadableStream(). Leia o cabeçalho de " +
        "scripts/patch-next-flight-stream.mjs antes de mexer.",
    );
  }

  if (ocorrencias > 1) {
    throw new Error(
      `esperava 1 ocorrência em ${path.basename(arquivo)}, achei ${ocorrencias}. ` +
        "Confira se a âncora ainda identifica só o stream de dados RSC.",
    );
  }

  await writeFile(arquivo, origem.replace(alvo, `$1${MARCA}$2`), "utf8");
  return "aplicado";
}

async function main() {
  const raiz = raizDoNext();
  const versao = require("next/package.json").version;

  const dirCompilados = path.join(raiz, DIR_COMPILADOS);
  const runtimes = (await readdir(dirCompilados)).filter((nome) =>
    COMPILADOS.test(nome),
  );

  if (runtimes.length === 0) {
    throw new Error(
      `nenhum runtime app-page em ${DIR_COMPILADOS}. ` +
        "O Next mudou o layout do servidor pré-compilado.",
    );
  }

  const estados = await Promise.all([
    ...FONTES.map((rel) => aplicar(path.join(raiz, rel), ALVO_FONTE)),
    ...runtimes.map((nome) =>
      aplicar(path.join(dirCompilados, nome), ALVO_COMPILADO),
    ),
  ]);

  const total = estados.length;
  const aplicados = estados.filter((e) => e === "aplicado").length;

  console.log(
    aplicados === 0
      ? `patch-next-flight-stream: já aplicado nos ${total} arquivos (next ${versao})`
      : `patch-next-flight-stream: aplicado em ${aplicados}/${total} arquivos (next ${versao})`,
  );
}

await main().catch((erro) => {
  console.error(`patch-next-flight-stream: ${erro.message}`);
  process.exit(1);
});

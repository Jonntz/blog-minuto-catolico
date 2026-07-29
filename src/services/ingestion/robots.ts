/**
 * `robots.txt` — verificação obrigatória antes de qualquer busca (CLAUDE.md §6).
 *
 * Implementa o essencial da RFC 9309:
 *   - agrupamento por `User-agent` (grupos repetidos com o mesmo agente são
 *     mesclados — o robots.txt do Sign of the Cross tem DOIS blocos `*`);
 *   - escolha do grupo mais específico que casa com o nosso token de produto,
 *     caindo em `*` quando nenhum cita o nosso nome;
 *   - `Allow`/`Disallow` com curinga `*` e âncora `$`, vencendo o padrão mais
 *     longo e, em empate, o `Allow`;
 *   - 4xx (sem robots.txt) libera tudo; 5xx/erro de rede PROÍBE tudo, como manda
 *     a RFC — é o comportamento defensável se a fonte reclamar depois.
 *
 * O resultado é cacheado por origem: uma execução de cron que busca 12 páginas
 * do mesmo site não pode baixar o robots.txt 12 vezes.
 */

import { ACCEPT_TEXTO, buscarTexto, ErroHttp } from "./http";

const TTL_SUCESSO_MS = 6 * 60 * 60 * 1000;
/** TTL curto no erro: um 500 transitório não pode calar a ingestão por 6 horas. */
const TTL_ERRO_MS = 5 * 60 * 1000;

export interface Regra {
  permite: boolean;
  padrao: string;
  regex: RegExp;
  /** Comprimento do padrão original — critério de desempate da RFC. */
  peso: number;
}

export interface Grupo {
  agentes: string[];
  regras: Regra[];
}

interface RobotsEmCache {
  grupos: Grupo[];
  /** `true` quando não conseguimos ler o arquivo: nega tudo. */
  negaTudo: boolean;
  expiraEm: number;
}

const cache = new Map<string, RobotsEmCache>();

/** `MinutoCatolicoBot/1.0 (+https://…)` → `minutocatolicobot`. */
export function tokenDoUserAgent(userAgent: string): string {
  const primeiro = userAgent.trim().split(/[\s/]/, 1)[0] ?? userAgent;
  return primeiro.toLowerCase();
}

function padraoParaRegex(padrao: string): RegExp {
  let fonte = "";
  for (const caractere of padrao) {
    if (caractere === "*") fonte += ".*";
    else if (caractere === "$") fonte += "$";
    else fonte += caractere.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${fonte}`);
}

export function analisarRobots(texto: string): Grupo[] {
  const grupos: Grupo[] = [];
  let atual: Grupo | null = null;
  // Depois de uma regra, um novo `User-agent` inicia OUTRO grupo.
  let aceitandoAgentes = false;

  for (const linhaBruta of texto.split(/\r?\n/)) {
    const linha = linhaBruta.split("#")[0]?.trim() ?? "";
    if (!linha) continue;

    const separador = linha.indexOf(":");
    if (separador < 0) continue;

    const campo = linha.slice(0, separador).trim().toLowerCase();
    const valor = linha.slice(separador + 1).trim();

    if (campo === "user-agent") {
      if (!atual || !aceitandoAgentes) {
        atual = { agentes: [], regras: [] };
        grupos.push(atual);
        aceitandoAgentes = true;
      }
      atual.agentes.push(valor.toLowerCase());
      continue;
    }

    if (campo !== "allow" && campo !== "disallow") continue;
    if (!atual) continue;

    aceitandoAgentes = false;

    // `Disallow:` vazio é a forma canônica de "libera tudo" — e NÃO é uma regra.
    // `Allow:` vazio é ruído. Ambos são descartados aqui.
    if (valor === "") continue;

    atual.regras.push({
      permite: campo === "allow",
      padrao: valor,
      regex: padraoParaRegex(valor),
      peso: valor.length,
    });
  }

  return grupos;
}

/**
 * Mescla todos os grupos que valem para o nosso agente.
 *
 * Precedência: grupo que cita o nosso token vence; se nenhum cita, valem os
 * grupos `*`. Grupos repetidos com o mesmo agente são somados, não substituídos.
 */
function regrasAplicaveis(grupos: Grupo[], token: string): Regra[] {
  const nominais = grupos.filter((g) => g.agentes.includes(token));
  const escolhidos = nominais.length > 0 ? nominais : grupos.filter((g) => g.agentes.includes("*"));
  return escolhidos.flatMap((g) => g.regras);
}

/** `true` se as regras permitem o caminho. Sem regra que case, permite. */
export function caminhoPermitido(regras: readonly Regra[], caminho: string): boolean {
  let melhor: Regra | null = null;

  for (const regra of regras) {
    if (!regra.regex.test(caminho)) continue;
    if (!melhor || regra.peso > melhor.peso || (regra.peso === melhor.peso && regra.permite)) {
      melhor = regra;
    }
  }

  return melhor ? melhor.permite : true;
}

async function obterRobots(origem: string, userAgent: string): Promise<RobotsEmCache> {
  const agora = Date.now();
  const emCache = cache.get(origem);
  if (emCache && emCache.expiraEm > agora) return emCache;

  try {
    const texto = await buscarTexto(`${origem}/robots.txt`, {
      userAgent,
      accept: ACCEPT_TEXTO,
      timeoutMs: 10_000,
    });
    const registro: RobotsEmCache = {
      grupos: analisarRobots(texto),
      negaTudo: false,
      expiraEm: agora + TTL_SUCESSO_MS,
    };
    cache.set(origem, registro);
    return registro;
  } catch (erro) {
    // Sem robots.txt (4xx) = sem restrição. Indisponível (5xx/rede) = proibido.
    const ausente = erro instanceof ErroHttp && erro.status >= 400 && erro.status < 500;
    const registro: RobotsEmCache = {
      grupos: [],
      negaTudo: !ausente,
      expiraEm: agora + (ausente ? TTL_SUCESSO_MS : TTL_ERRO_MS),
    };
    cache.set(origem, registro);

    if (!ausente) {
      console.warn(
        JSON.stringify({
          evento: "robots_indisponivel",
          origem,
          erro: erro instanceof Error ? erro.message : String(erro),
          consequencia: "ingestao_bloqueada_para_esta_origem",
        }),
      );
    }
    return registro;
  }
}

/** Podemos buscar esta URL? Consulta (e cacheia) o robots.txt da origem. */
export async function podeBuscar(url: string, userAgent: string): Promise<boolean> {
  const alvo = new URL(url);
  const registro = await obterRobots(alvo.origin, userAgent);
  if (registro.negaTudo) return false;

  const regras = regrasAplicaveis(registro.grupos, tokenDoUserAgent(userAgent));
  return caminhoPermitido(regras, `${alvo.pathname}${alvo.search}`);
}

/** Só para teste: zera o cache entre execuções. */
export function limparCacheRobots(): void {
  cache.clear();
}

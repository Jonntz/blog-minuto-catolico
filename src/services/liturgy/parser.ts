import { Parser } from "htmlparser2";

/**
 * Parser do Calendário Litúrgico Tradicional de 1962 (missa tridentina).
 *
 * Fonte: https://salvemaria.com.br/calendario/ — página WordPress
 * server-rendered, com uma <table> por mês (colada de uma planilha, daí os
 * atributos `data-sheets-*`). Verificado ao vivo em 2026-07-27.
 *
 * Layout real de uma linha (4 colunas):
 *
 *   | Dia            | Calendário Litúrgico          | Calendário Mariano   | Liturgia                    |
 *   | 1 de Julho     | Preciosíssimo Sangue de N.    | –                    | Vermelho                    |
 *   | Quarta         | Senhor                        |                      | Glória • Credo              |
 *   |                | 1ª Classe                     |                      | Prefácio da Santa Cruz      |
 *   |                                                                       | Hb 9, 11-15 • Jo 19, 30-35  |
 *
 * ATENÇÃO AO RITO: no missal de 1962 não existe salmo responsorial. A última
 * linha da coluna "Liturgia" é sempre `Epístola • Evangelho` — duas leituras,
 * nunca três.
 *
 * ------------------------------------------------------------------------
 * Filosofia deste parser: NADA é lido por posição fixa.
 * ------------------------------------------------------------------------
 * A fonte é editada à mão, e a inspeção dos 212 dias publicados de 2026 já
 * mostrou o layout escorregando em vários eixos:
 *
 *   - a classe nem sempre é a última linha  ('S. Antônio de Pádua' / '2ª classe'
 *     / '(no próprio do Brasil)');
 *   - o número de linhas de comemoração varia de 0 a 3;
 *   - a Sexta-feira Santa não tem prefácio, e a coluna fica com 3 linhas em vez
 *     de 4;
 *   - o mês vem grafado ora 'Julho', ora 'fevereiro';
 *   - o <h3> do mês ora tem <strong>, ora não.
 *
 * Por isso cada campo é reconhecido por PADRÃO, não por índice. Se um padrão
 * não casar, o campo vira `null` e a linha entra em `avisos` — nunca em lixo
 * gravado no banco. E se a linha inteira não for reconhecível como um dia,
 * ela é rejeitada com o contexto anexado, para o log dizer exatamente o que
 * mudou na fonte.
 */

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** Um dia do calendário, já normalizado e pronto para virar linha no D1. */
export interface DiaLiturgico {
  /** 'YYYY-MM-DD'. Chave primária em liturgical_days. */
  date: string;
  /**
   * 'Domingo', 'Segunda', ... Derivado da data, não copiado da fonte — ver
   * `interpretarColunaDia`. A fonte é conferida contra ele e a divergência vira
   * aviso.
   */
  weekday: string;
  /** Festa principal. Nunca vazia — linha sem festa é rejeitada. */
  feast: string;
  /** Comemorações e qualificadores ('(Próprio do Brasil)'), unidos por ' · '. */
  commemoration: string | null;
  /** Normalizada para 'Nª classe' (a fonte alterna 'Classe'/'classe'). */
  classis: string | null;
  marianSaint: string | null;
  color: string | null;
  gloria: boolean | null;
  credo: boolean | null;
  preface: string | null;
  /** 'Abstinência de carne', 'Primeiro Sábado', 'Jejum e abstinência'... */
  note: string | null;
  epistle: string | null;
  gospel: string | null;
}

/** Linha que parecia um dia mas não pôde ser convertida com segurança. */
export interface LinhaRejeitada {
  motivo: string;
  /** Primeiras células da linha, para o log apontar o que mudou na fonte. */
  contexto: string;
}

export interface ResultadoParse {
  /** Ano detectado na própria página (título/cabeçalhos) ou informado. */
  ano: number;
  dias: DiaLiturgico[];
  /** Linhas de 4 colunas encontradas, incluindo cabeçalhos e rejeitadas. */
  linhasVistas: number;
  rejeitadas: LinhaRejeitada[];
  /** Degradações não-fatais (campo faltando, cor desconhecida, ...). */
  avisos: string[];
  /** Meses (1–12) com ao menos um dia extraído. */
  mesesPresentes: number[];
}

/**
 * Falha dura de parsing.
 *
 * Lançada só quando o resultado seria inutilizável — página vazia, sem tabelas,
 * nenhum dia reconhecido ou taxa de rejeição alta demais. O contrato com o
 * chamador é: ou vem um resultado confiável, ou vem exceção. Nunca meio banco
 * de dados preenchido com lixo.
 */
export class LiturgyParseError extends Error {
  readonly detalhes: Readonly<Record<string, unknown>>;

  constructor(mensagem: string, detalhes: Record<string, unknown> = {}) {
    super(mensagem);
    this.name = "LiturgyParseError";
    this.detalhes = detalhes;
  }
}

export interface OpcoesParse {
  /**
   * Ano esperado. Se a página declarar outro, o da página vence (é a fonte da
   * verdade) mas a divergência entra em `avisos`. Se a página não declarar
   * nenhum, este valor é usado.
   */
  anoEsperado?: number;
  /** Usado só para extrair o ano de URLs como /calendario-2025. */
  url?: string;
}

// ---------------------------------------------------------------------------
// Vocabulário da fonte
// ---------------------------------------------------------------------------

const MESES: Readonly<Record<string, number>> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

/** Índice 0 = domingo, casando com Date#getUTCDay(). */
const DIAS_SEMANA: readonly string[] = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const DIAS_SEMANA_POR_CHAVE: Readonly<Record<string, string>> = {
  domingo: "Domingo",
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
};

/**
 * Cores litúrgicas do rito de 1962. A fonte publica compostos —
 * 'Roxo/Branco' na Vigília Pascal, 'Róseo ou Roxo' no Gaudete/Laetare — então a
 * validação é por token, depois de separar por '/', ',' ou ' ou '.
 */
const CORES: ReadonlySet<string> = new Set([
  "branco",
  "vermelho",
  "verde",
  "roxo",
  "preto",
  "rosa",
  "roseo",
  "rosaceo",
  "dourado",
  "ouro",
]);

/**
 * Linhas da coluna "Calendário Mariano" que são AVISO DE DISCIPLINA, não santo.
 * Vão para `note` (o card "Santo do dia" mostraria "Abstinência de carne" como
 * se fosse um santo, o que seria absurdo).
 */
const PADROES_NOTA: readonly RegExp[] = [
  /abstin[êe]ncia/i,
  /jejum/i,
  /^primeir[ao]\b/i,
  /^t[êe]mporas\b/i,
];

const RE_DIA = /^(\d{1,2})\s+de\s+(.+)$/i;
const RE_CLASSE = /(\d)\s*[ªa°º]?\s*classe/i;
const RE_PREFACIO = /^pref[áa]cio\b/i;
const RE_GLORIA_CREDO = /gl[óo]ria|credo|professio\s+fidei/i;
const RE_ANO = /\b(20\d{2})\b/;
const SEPARADOR_LEITURAS = "•"; // •

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Converte o HTML da página do calendário em dias normalizados.
 *
 * @throws {LiturgyParseError} quando o resultado não é confiável.
 */
export function parseCalendarioLiturgico(
  html: string,
  opcoes: OpcoesParse = {},
): ResultadoParse {
  if (!html || html.trim().length === 0) {
    throw new LiturgyParseError("HTML vazio recebido da fonte");
  }

  const { linhas, cabecalhos } = extrairTabelas(html);

  if (linhas.length === 0) {
    throw new LiturgyParseError(
      "Nenhuma linha de tabela de 4 colunas encontrada — o layout da fonte mudou",
      { tamanhoHtml: html.length },
    );
  }

  const avisos: string[] = [];
  const ano = resolverAno(cabecalhos, opcoes, avisos);

  const dias = new Map<string, DiaLiturgico>();
  const rejeitadas: LinhaRejeitada[] = [];

  for (const celulas of linhas) {
    if (ehCabecalho(celulas)) continue;

    const resultado = converterLinha(celulas, ano, avisos);
    if ("motivo" in resultado) {
      rejeitadas.push(resultado);
      continue;
    }

    if (dias.has(resultado.date)) {
      avisos.push(`Data duplicada na fonte: ${resultado.date} (última vence)`);
    }
    dias.set(resultado.date, resultado);
  }

  const lista = [...dias.values()].sort((a, b) => a.date.localeCompare(b.date));

  if (lista.length === 0) {
    throw new LiturgyParseError(
      "Nenhum dia reconhecido — a estrutura das linhas mudou",
      { linhasVistas: linhas.length, rejeitadas: rejeitadas.slice(0, 3) },
    );
  }

  // Rejeição pontual é normal (linha de cabeçalho exótica, nota solta no meio
  // da tabela). Rejeição em massa significa que a fonte foi remodelada — e aí
  // gravar o que sobrou seria pior do que não gravar nada.
  const taxaRejeicao = rejeitadas.length / (lista.length + rejeitadas.length);
  if (taxaRejeicao > 0.1) {
    throw new LiturgyParseError(
      `Taxa de rejeição alta demais (${(taxaRejeicao * 100).toFixed(1)}%) — o layout da fonte provavelmente mudou`,
      {
        reconhecidos: lista.length,
        rejeitados: rejeitadas.length,
        amostra: rejeitadas.slice(0, 5),
      },
    );
  }

  const mesesPresentes = [
    ...new Set(lista.map((d) => Number(d.date.slice(5, 7)))),
  ].sort((a, b) => a - b);

  for (const mes of mesesPresentes) {
    const esperado = diasNoMes(ano, mes);
    const obtidos = lista.filter(
      (d) => Number(d.date.slice(5, 7)) === mes,
    ).length;
    if (obtidos < esperado) {
      avisos.push(
        `Mês ${String(mes).padStart(2, "0")}/${ano} incompleto: ${obtidos} de ${esperado} dias`,
      );
    }
  }

  return {
    ano,
    dias: lista,
    linhasVistas: linhas.length,
    rejeitadas,
    avisos,
    mesesPresentes,
  };
}

// ---------------------------------------------------------------------------
// Extração do HTML (htmlparser2 — streaming, sem DOM)
// ---------------------------------------------------------------------------

interface TabelasExtraidas {
  /** Cada linha é um array de células; cada célula é um array de linhas de texto. */
  linhas: string[][][];
  /** Texto de <h1>–<h4>, usado para descobrir o ano da página. */
  cabecalhos: string[];
}

/**
 * Percorre o HTML uma única vez e recolhe as linhas de tabela.
 *
 * `cheerio`/`jsdom` estão fora de cogitação aqui: o alvo é Cloudflare Workers e
 * ambos dependem de APIs Node (CLAUDE.md §8). O htmlparser2 é streaming e roda
 * no runtime de Workers sem adaptação.
 *
 * Cada célula vira uma LISTA DE LINHAS, quebradas nos <br> — porque é
 * exatamente assim que a fonte codifica a estrutura interna da célula: festa,
 * comemoração e classe são um único <td> separado por <br>.
 */
function extrairTabelas(html: string): TabelasExtraidas {
  const linhas: string[][][] = [];
  const cabecalhos: string[] = [];

  let celulasDaLinha: string[][] | null = null;
  let linhasDaCelula: string[] | null = null;
  let bufferTexto = "";
  let profundidadeCelula = 0;
  let profundidadeCabecalho = 0;

  const fecharLinhaDeTexto = (): void => {
    const texto = normalizar(bufferTexto);
    bufferTexto = "";
    if (texto && linhasDaCelula) linhasDaCelula.push(texto);
  };

  const parser = new Parser(
    {
      onopentag(nome) {
        if (nome === "tr") {
          celulasDaLinha = [];
          return;
        }
        if (nome === "td" || nome === "th") {
          if (profundidadeCelula === 0) {
            linhasDaCelula = [];
            bufferTexto = "";
          }
          profundidadeCelula += 1;
          return;
        }
        if (profundidadeCelula > 0 && ehQuebraDeLinha(nome)) {
          fecharLinhaDeTexto();
          return;
        }
        if (/^h[1-4]$/.test(nome)) {
          profundidadeCabecalho += 1;
          if (profundidadeCabecalho === 1 && profundidadeCelula === 0) {
            bufferTexto = "";
          }
        }
      },

      ontext(texto) {
        if (profundidadeCelula > 0 || profundidadeCabecalho > 0) {
          bufferTexto += texto;
        }
      },

      onclosetag(nome) {
        if (nome === "td" || nome === "th") {
          profundidadeCelula = Math.max(0, profundidadeCelula - 1);
          if (profundidadeCelula === 0) {
            fecharLinhaDeTexto();
            if (celulasDaLinha && linhasDaCelula) {
              celulasDaLinha.push(linhasDaCelula);
            }
            linhasDaCelula = null;
          }
          return;
        }
        if (nome === "tr") {
          if (celulasDaLinha && celulasDaLinha.length > 0) {
            linhas.push(celulasDaLinha);
          }
          celulasDaLinha = null;
          return;
        }
        if (profundidadeCelula > 0 && ehQuebraDeLinha(nome)) {
          fecharLinhaDeTexto();
          return;
        }
        if (/^h[1-4]$/.test(nome)) {
          profundidadeCabecalho = Math.max(0, profundidadeCabecalho - 1);
          if (profundidadeCabecalho === 0 && profundidadeCelula === 0) {
            const texto = normalizar(bufferTexto);
            bufferTexto = "";
            if (texto) cabecalhos.push(texto);
          }
        }
      },
    },
    { decodeEntities: true, lowerCaseTags: true },
  );

  parser.write(html);
  parser.end();

  // Só as linhas com as 4 colunas do calendário interessam. Qualquer outra
  // tabela na página (rodapé, widget) é descartada sem drama.
  return { linhas: linhas.filter((l) => l.length === 4), cabecalhos };
}

/** Tags que, dentro de uma célula, encerram uma linha lógica de texto. */
function ehQuebraDeLinha(nome: string): boolean {
  return (
    nome === "br" ||
    nome === "p" ||
    nome === "div" ||
    nome === "li" ||
    nome === "tr"
  );
}

// ---------------------------------------------------------------------------
// Conversão de uma linha em um dia
// ---------------------------------------------------------------------------

function ehCabecalho(celulas: string[][]): boolean {
  const primeira = celulas[0]?.[0] ?? "";
  return /^dia$/i.test(primeira);
}

function converterLinha(
  celulas: string[][],
  ano: number,
  avisos: string[],
): DiaLiturgico | LinhaRejeitada {
  const [colDia = [], colLiturgico = [], colMariano = [], colLiturgia = []] =
    celulas;

  const data = interpretarColunaDia(colDia, ano, avisos);
  if (!data) {
    return {
      motivo: "coluna 'Dia' não reconhecida",
      contexto: resumir(colDia),
    };
  }

  const liturgico = interpretarColunaLiturgica(colLiturgico);
  if (!liturgico.feast) {
    // Regra dura do enunciado: NUNCA gravar uma data com festa vazia.
    return {
      motivo: `festa vazia em ${data.date}`,
      contexto: resumir(colLiturgico),
    };
  }

  const mariano = interpretarColunaMariana(colMariano);
  const liturgia = interpretarColunaLiturgia(colLiturgia, data.date, avisos);

  return {
    date: data.date,
    weekday: data.weekday,
    feast: liturgico.feast,
    commemoration: liturgico.commemoration,
    classis: liturgico.classis,
    marianSaint: mariano.marianSaint,
    note: mariano.note,
    color: liturgia.color,
    gloria: liturgia.gloria,
    credo: liturgia.credo,
    preface: liturgia.preface,
    epistle: liturgia.epistle,
    gospel: liturgia.gospel,
  };
}

/**
 * Coluna 1 — '1 de Julho' + 'Quarta'.
 *
 * O mês vem NA PRÓPRIA CÉLULA, o que é uma sorte: não precisamos amarrar a
 * tabela ao <h3> que a precede (que já mudou de markup entre meses). Só o ano
 * vem de fora.
 */
function interpretarColunaDia(
  linhas: string[],
  ano: number,
  avisos: string[],
): { date: string; weekday: string } | null {
  const casamento = RE_DIA.exec(linhas[0] ?? "");
  if (!casamento) return null;

  const dia = Number(casamento[1]);
  const mes = MESES[semAcento(casamento[2] ?? "")];
  if (!mes || !Number.isInteger(dia)) return null;
  // Rejeita '31 de fevereiro' e afins em vez de gravar uma data impossível.
  if (dia < 1 || dia > diasNoMes(ano, mes)) return null;

  const date = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  // O dia da semana publicado é conferência, não fonte da verdade: a data já
  // determina o dia da semana. A fonte é editada à mão e tem erros de digitação
  // reais ('Domigo' em 05/10/2025) — perder o dia inteiro por causa de um typo
  // seria a decisão errada. Deriva-se da data e registra-se a divergência.
  const derivado =
    DIAS_SEMANA[new Date(`${date}T12:00:00Z`).getUTCDay()] ?? "Domingo";
  const publicado =
    DIAS_SEMANA_POR_CHAVE[semAcento(linhas[1] ?? "").split(/[\s-]/)[0] ?? ""];

  if (!publicado) {
    avisos.push(
      `${date}: dia da semana ilegível na fonte ("${linhas[1] ?? ""}") — derivado da data: ${derivado}`,
    );
  } else if (publicado !== derivado) {
    avisos.push(
      `${date}: fonte diz "${publicado}", a data é ${derivado} — a data venceu`,
    );
  }

  return { date, weekday: derivado };
}

/**
 * Coluna 2 — festa, comemorações e classe.
 *
 * A classe é localizada por padrão porque nem sempre é a última linha. O que
 * sobra entre a festa e a classe são comemorações e qualificadores como
 * '(Próprio do Brasil)' — que fazem parte da identidade do dia e por isso são
 * preservados, unidos por ' · '.
 */
function interpretarColunaLiturgica(linhas: string[]): {
  feast: string;
  commemoration: string | null;
  classis: string | null;
} {
  const feast = linhas[0] ?? "";
  let classis: string | null = null;
  const resto: string[] = [];

  for (const linha of linhas.slice(1)) {
    const casamento = RE_CLASSE.exec(linha);
    // Só é a linha da classe se for ISSO e mais nada — 'Quarta-feira das
    // Têmporas' não pode ser confundida com uma classe.
    if (casamento && !classis && linha.replace(RE_CLASSE, "").trim().length === 0) {
      classis = `${casamento[1]}ª classe`;
      continue;
    }
    resto.push(linha);
  }

  return {
    feast,
    commemoration: resto.length > 0 ? resto.join(" · ") : null,
    classis,
  };
}

/**
 * Coluna 3 — santo congregado mariano + avisos de disciplina.
 *
 * '–' (travessão) é como a fonte escreve "nada aqui". Abstinência, jejum,
 * Primeira Sexta e Primeiro Sábado são disciplina, não santo: vão para `note`.
 */
function interpretarColunaMariana(linhas: string[]): {
  marianSaint: string | null;
  note: string | null;
} {
  const santos: string[] = [];
  const notas: string[] = [];

  for (const linha of linhas) {
    if (ehVazio(linha)) continue;
    if (PADROES_NOTA.some((re) => re.test(linha))) notas.push(linha);
    else santos.push(linha);
  }

  return {
    marianSaint: santos.length > 0 ? santos.join(" · ") : null,
    note: notas.length > 0 ? notas.join(" · ") : null,
  };
}

interface ColunaLiturgia {
  color: string | null;
  gloria: boolean | null;
  credo: boolean | null;
  preface: string | null;
  epistle: string | null;
  gospel: string | null;
}

/**
 * Coluna 4 — cor, Glória/Credo, prefácio e as duas leituras.
 *
 * Cada linha é classificada pelo que ELA É, não pela posição: a Sexta-feira
 * Santa, por exemplo, não tem prefácio e a célula vem com 3 linhas em vez de 4.
 * Ler por índice quebraria exatamente no dia mais importante do ano.
 */
function interpretarColunaLiturgia(
  linhas: string[],
  data: string,
  avisos: string[],
): ColunaLiturgia {
  const resultado: ColunaLiturgia = {
    color: null,
    gloria: null,
    credo: null,
    preface: null,
    epistle: null,
    gospel: null,
  };

  for (const linha of linhas) {
    if (ehVazio(linha)) continue;

    if (!resultado.preface && RE_PREFACIO.test(linha)) {
      resultado.preface = linha;
      continue;
    }

    // A linha de Glória/Credo também contém '•', então precisa ser testada
    // ANTES da linha de leituras.
    if (resultado.gloria === null && RE_GLORIA_CREDO.test(linha)) {
      resultado.gloria = /gl[óo]ria/i.test(linha)
        ? !/sem\s+gl[óo]ria/i.test(linha)
        : null;
      resultado.credo = /credo|professio\s+fidei/i.test(linha)
        ? !/sem\s+credo/i.test(linha)
        : null;
      continue;
    }

    if (!resultado.color && ehCor(linha)) {
      resultado.color = linha;
      continue;
    }

    if (!resultado.epistle && linha.includes(SEPARADOR_LEITURAS)) {
      const partes = linha
        .split(SEPARADOR_LEITURAS)
        .map((p) => p.trim())
        .filter(Boolean);
      if (partes.length === 2) {
        resultado.epistle = partes[0] ?? null;
        resultado.gospel = partes[1] ?? null;
      } else {
        avisos.push(
          `${data}: linha de leituras com ${partes.length} partes em vez de 2 ("${linha}")`,
        );
      }
      continue;
    }
  }

  if (!resultado.color) avisos.push(`${data}: cor litúrgica não reconhecida`);
  if (!resultado.epistle || !resultado.gospel) {
    avisos.push(`${data}: epístola/evangelho ausentes`);
  }

  return resultado;
}

/**
 * 'Vermelho', 'Roxo/Branco', 'Róseo ou Roxo' — todos os tokens têm de ser cores.
 *
 * A alternativa preguiçosa seria "a primeira linha é a cor". Ela grava
 * silenciosamente a linha errada no dia em que a fonte reordena a célula, e
 * ninguém percebe. Validar contra o vocabulário faz o campo virar `null` com
 * aviso — visível no log, inofensivo no banco.
 */
function ehCor(linha: string): boolean {
  const tokens = linha
    .split(/\s*(?:\/|,|\bou\b)\s*/i)
    .map((t) => semAcento(t))
    .filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => CORES.has(t));
}

// ---------------------------------------------------------------------------
// Ano da página
// ---------------------------------------------------------------------------

/**
 * Descobre o ano do calendário.
 *
 * Ordem: URL (/calendario-2025) → cabeçalhos da página ("Calendário Litúrgico
 * Tradicional 2026") → ano esperado informado pelo chamador. A URL vem primeiro
 * porque é a única fonte que o chamador controla explicitamente ao fazer
 * backfill de anos anteriores.
 */
function resolverAno(
  cabecalhos: string[],
  opcoes: OpcoesParse,
  avisos: string[],
): number {
  const daUrl = opcoes.url ? /calendario-(\d{4})/.exec(opcoes.url)?.[1] : null;
  const doCabecalho = cabecalhos
    .map((c) => RE_ANO.exec(c)?.[1])
    .find((a): a is string => Boolean(a));

  const candidato = daUrl ?? doCabecalho ?? null;

  if (!candidato) {
    if (opcoes.anoEsperado) {
      avisos.push(
        `Ano não encontrado na página; usando o esperado (${opcoes.anoEsperado})`,
      );
      return opcoes.anoEsperado;
    }
    throw new LiturgyParseError(
      "Não foi possível determinar o ano do calendário (nem na URL, nem nos cabeçalhos)",
      { cabecalhos: cabecalhos.slice(0, 5) },
    );
  }

  const ano = Number(candidato);
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    throw new LiturgyParseError(`Ano fora de faixa plausível: ${candidato}`);
  }

  if (opcoes.anoEsperado && opcoes.anoEsperado !== ano) {
    avisos.push(
      `Ano da página (${ano}) difere do esperado (${opcoes.anoEsperado}) — a página venceu`,
    );
  }

  return ano;
}

// ---------------------------------------------------------------------------
// Utilitários de texto
// ---------------------------------------------------------------------------

/**
 * Colapsa espaços. `\s` já cobre o NBSP (U+00A0), abundante em conteúdo colado
 * de planilha — que é exatamente a origem destas tabelas.
 */
function normalizar(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/**
 * Minúsculas sem diacríticos, para comparar 'Março'/'março'/'Marco'.
 * A faixa U+0300–U+036F é usada no lugar de \p{Diacritic} porque o alvo do
 * tsconfig é ES2017, que não tem escapes de propriedade Unicode.
 */
function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Célula "sem conteúdo": travessão, hífen, ponto solto. */
function ehVazio(texto: string): boolean {
  return texto.length === 0 || /^[-–—.\s]*$/.test(texto);
}

function resumir(celula: string[]): string {
  return celula.join(" | ").slice(0, 160);
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

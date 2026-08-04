import { z } from "zod";

/**
 * Contrato do consentimento de publicidade.
 *
 * ## Por que existe
 *
 * A publicidade do portal é carregada por uma rede de terceiro (Adcash), que
 * recebe endereço IP e dados do navegador de quem visita. Isso é
 * compartilhamento com terceiro e transferência internacional — LGPD art. 7º, I
 * (consentimento) e art. 33. Sem opt-in explícito, o script simplesmente não é
 * montado.
 *
 * ## Por que opt-in uniforme, e não por país
 *
 * A alternativa seria ler `cf-ipcountry` e exigir consentimento só na UE. Foi
 * descartada por um motivo TÉCNICO além do jurídico: ler o país no servidor
 * personaliza o HTML e inviabiliza cachear a página na borda da Cloudflare — a
 * maior alavanca de performance disponível para este site. Com opt-in uniforme
 * o HTML é idêntico para todo mundo e a decisão vive 100% no cliente.
 *
 * ## Por que zod aqui
 *
 * `localStorage` é entrada não confiável: o usuário edita, uma extensão
 * corrompe, uma versão antiga do site gravou outro formato. O CLAUDE.md §8
 * manda validar o que é desserializado, e não só variável de ambiente. Valor
 * ilegível ⇒ trata como "ainda não decidiu" ⇒ **não carrega anúncio**. Falha
 * fechada, como no resto do projeto.
 */

/** Chave no `localStorage`. Prefixo `bn-` como o resto do projeto. */
export const CHAVE_CONSENTIMENTO = "bn-consentimento";

/**
 * Versão da finalidade declarada.
 *
 * Incrementar quando MUDAR o que se faz com o dado — rede nova, finalidade
 * nova, categoria nova de cookie. Consentimento gravado com versão anterior
 * deixa de valer e o banner reaparece. Sem isso, um "aceito" dado hoje
 * autorizaria silenciosamente algo que nem existia quando foi dado.
 */
export const VERSAO_CONSENTIMENTO = 1;

export const esquemaConsentimento = z.object({
  versao: z.number().int().positive(),
  publicidade: z.boolean(),
  /** Unix em segundos. Só para auditoria e para saber quando repedir. */
  decididoEm: z.number().int().positive(),
});

export type Consentimento = z.infer<typeof esquemaConsentimento>;

/**
 * Estado de decisão.
 *
 * `"pendente"` cobre três casos que se comportam igual e não vale distinguir:
 * nunca decidiu, valor corrompido, e decisão de versão antiga.
 */
export type EstadoConsentimento = "pendente" | "aceito" | "recusado";

/** Lê e valida. Nunca lança — no navegador o `localStorage` pode até não existir. */
export function lerConsentimento(): Consentimento | null {
  if (typeof window === "undefined") return null;

  let bruto: string | null;
  try {
    bruto = window.localStorage.getItem(CHAVE_CONSENTIMENTO);
  } catch {
    // Modo privado de alguns navegadores lança só ao tocar no localStorage.
    return null;
  }
  if (!bruto) return null;

  try {
    const analise = esquemaConsentimento.safeParse(JSON.parse(bruto));
    if (!analise.success) return null;
    // Decisão de versão anterior não vale: a finalidade declarada mudou.
    if (analise.data.versao !== VERSAO_CONSENTIMENTO) return null;
    return analise.data;
  } catch {
    return null;
  }
}

export function estadoDe(valor: Consentimento | null): EstadoConsentimento {
  if (valor === null) return "pendente";
  return valor.publicidade ? "aceito" : "recusado";
}

/** Grava a decisão. Devolve o que ficou gravado, para o store publicar. */
export function gravarConsentimento(publicidade: boolean): Consentimento {
  const valor: Consentimento = {
    versao: VERSAO_CONSENTIMENTO,
    publicidade,
    decididoEm: Math.floor(Date.now() / 1000),
  };

  try {
    window.localStorage.setItem(CHAVE_CONSENTIMENTO, JSON.stringify(valor));
  } catch {
    // Sem persistência a decisão vale só nesta navegação. É degradação
    // aceitável: o pior caso é o banner reaparecer, nunca anúncio sem aceite.
  }

  return valor;
}

/** Apaga a decisão e faz o banner reaparecer. Usado por "mudar preferência". */
export function limparConsentimento(): void {
  try {
    window.localStorage.removeItem(CHAVE_CONSENTIMENTO);
  } catch {
    // idem
  }
}

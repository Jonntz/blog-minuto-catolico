import type { ReactNode } from "react";

/**
 * Renderizador do subconjunto de Markdown que a adaptação produz.
 *
 * Por que não uma biblioteca: `bodyMd` não é entrada de usuário nem HTML de
 * terceiro — é texto gerado pelo nosso próprio provedor de adaptação, num
 * formato que nós definimos (parágrafo, `##`, `>`, `-`, `**`, `*`). Trazer um
 * parser completo custaria dezenas de kB no bundle do servidor e abriria a
 * porta para HTML embutido, que é exatamente o que não queremos aqui. Este
 * módulo nunca produz `dangerouslySetInnerHTML`: tudo vira nó de React, então
 * qualquer marcação que escape do modelo aparece como texto e não executa.
 *
 * Fica intencionalmente restrito. Se a Fase 1.C precisar de tabela ou imagem no
 * meio do corpo, o lugar de decidir isso é o prompt de adaptação, não aqui.
 */

/**
 * Link primeiro na alternância, depois negrito e itálico.
 *
 * O link entrou porque o corpo SEMPRE termina com um: `montarCorpoFinal()`
 * anexa `Fonte: [Nome](URL)` a partir das colunas de proveniência. Sem tratar
 * link aqui, a página mostrava literalmente
 * `[EWTN News](https://www.ewtnnews.com/...)` no fim de toda matéria — em todas
 * as 28 publicadas, verificado em 03/08/2026.
 */
const LINK_NEGRITO_OU_ITALICO =
  /(\[[^\]\n]+\]\([^)\s]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g;

const RE_LINK = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/;

/**
 * Só `http`/`https` viram âncora.
 *
 * O corpo é gerado pelo nosso provedor de adaptação, mas o texto que ele
 * devolve é influenciado pelo artigo de terceiro que ele leu — então um
 * `javascript:` alucinado é possível, ainda que improvável. Esquema
 * inesperado cai no ramo de texto puro e aparece inerte, em vez de virar link
 * executável.
 */
function ehUrlSegura(url: string): boolean {
  try {
    const p = new URL(url);
    return p.protocol === "https:" || p.protocol === "http:";
  } catch {
    return false;
  }
}

/** Resolve `[texto](url)`, `**negrito**` e `*itálico*` dentro de uma linha. */
function inline(texto: string, chaveBase: string): ReactNode[] {
  return texto
    .split(LINK_NEGRITO_OU_ITALICO)
    .filter((parte) => parte.length > 0)
    .map((parte, i) => {
      const chave = `${chaveBase}-${i}`;

      const link = RE_LINK.exec(parte);
      if (link?.[1] && link[2]) {
        const [, rotulo, url] = link;
        if (!ehUrlSegura(url)) return <span key={chave}>{rotulo}</span>;
        return (
          <a
            key={chave}
            href={url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-blue-f underline decoration-from-font underline-offset-2 hover:no-underline"
          >
            {rotulo}
          </a>
        );
      }

      if (parte.startsWith("**") && parte.endsWith("**")) {
        return (
          <strong key={chave} className="font-semibold">
            {parte.slice(2, -2)}
          </strong>
        );
      }
      if (parte.startsWith("*") && parte.endsWith("*")) {
        return <em key={chave}>{parte.slice(1, -1)}</em>;
      }
      return <span key={chave}>{parte}</span>;
    });
}

function bloco(texto: string, chave: string): ReactNode {
  if (texto.startsWith("## ")) {
    return (
      <h2
        key={chave}
        className="mt-11 mb-4 font-display text-[24px] leading-[1.15] font-semibold tracking-[-0.025em] text-balance sm:text-[27px]"
      >
        {inline(texto.slice(3), chave)}
      </h2>
    );
  }

  if (texto.startsWith("> ")) {
    return (
      <blockquote
        key={chave}
        className="my-8 border-l-2 border-blue-f pl-5 font-serif text-[20px] leading-[1.5] text-ink italic sm:text-[22px]"
      >
        {inline(texto.slice(2), chave)}
      </blockquote>
    );
  }

  if (texto.startsWith("- ")) {
    const itens = texto.split("\n").map((linha) => linha.replace(/^-\s+/, ""));
    return (
      <ul key={chave} className="my-6 flex list-disc flex-col gap-2 pl-5">
        {itens.map((item, i) => (
          <li key={`${chave}-li-${i}`} className="pl-1">
            {inline(item, `${chave}-li-${i}`)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p key={chave} className="my-5">
      {inline(texto, chave)}
    </p>
  );
}

export function ArticleBody({ markdown }: { markdown: string }) {
  const blocos = markdown
    .trim()
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    // A serifada no corpo é a razão de a Newsreader estar carregada: título em
    // grotesca, texto longo em serifada — a divisão clássica de jornal, e a que
    // segura melhor 800 palavras seguidas.
    //
    // `break-words` NÃO é preciosismo: o corpo adaptado cita URL do vatican.va,
    // número de documento e nome composto sem espaço. Um único token desses tem
    // 600px e não cabe em tela de 360px — ele furava a largura da viewport e
    // dava rolagem lateral na página inteira. Medido: 288px de excesso a 360px.
    <div className="font-serif text-[18px] leading-[1.68] break-words text-ink sm:text-[19px]">
      {blocos.map((b, i) => bloco(b, `b${i}`))}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/institutional/legal-shell";
import { FONTES_DECLARADAS } from "@/lib/institucional";
import { metadataInstitucional } from "@/lib/seo";

const RESUMO =
  "Como o conteúdo é selecionado, adaptado e atribuído — e o que o portal se compromete a não fazer.";

export async function generateMetadata(): Promise<Metadata> {
  return metadataInstitucional({
    slug: "politica-editorial",
    titulo: "Política editorial",
    descricao: RESUMO,
  });
}

export default function PoliticaEditorialPage() {
  return (
    <LegalShell titulo="Política editorial" resumo={RESUMO}>
      <h2>Atribuição</h2>
      <p>
        Toda matéria publicada aqui é derivada de reportagem de terceiro. Em
        todas elas aparecem, sem exceção:
      </p>
      <ul>
        <li>o nome do veículo de origem;</li>
        <li>o link direto para a reportagem original;</li>
        <li>
          a afirmação explícita de que o texto foi reescrito em português, e não
          traduzido na íntegra.
        </li>
      </ul>
      <p>
        Essa atribuição está na página, nos dados estruturados que os buscadores
        leem e no feed RSS. Se alguma matéria aparecer sem ela, é defeito —
        avise pelo <Link href="/contato">contato</Link>.
      </p>

      <h2>O que não fazemos</h2>
      <ul>
        <li>
          <strong>Não republicamos texto integral.</strong> O conteúdo é
          reescrito, e há verificação automática que reprova material próximo
          demais do original.
        </li>
        <li>
          <strong>Não assinamos reportagem alheia.</strong> A autoria do texto
          adaptado é da redação deste portal; a autoria da apuração é de quem a
          fez, e está creditada.
        </li>
        <li>
          <strong>Não copiamos o resumo da fonte para os metadados.</strong> A
          descrição que aparece no Google e nas redes é escrita para este site.
        </li>
        <li>
          <strong>Não publicamos o que não passou nas verificações.</strong>{" "}
          Matéria reprovada fica retida, não vai ao ar em versão parcial.
        </li>
      </ul>

      <h2>Uso de modelo de linguagem</h2>
      <p>
        A adaptação para o português é feita por modelo de linguagem, e isso é
        declarado porque muda o que se pode esperar do texto. Duas verificações
        automáticas rodam antes da publicação:
      </p>
      <ul>
        <li>
          <strong>Proporção em relação ao original</strong> — texto que ficou
          perto demais da fonte é reprovado.
        </li>
        <li>
          <strong>Conferência factual</strong> — o texto em português é
          comparado com o material de origem, e divergências de fato reprovam a
          matéria.
        </li>
      </ul>
      <p>
        Nenhuma das duas é infalível. Elas erram nas duas direções: às vezes
        barram texto correto, às vezes deixam passar nuance perdida na
        reescrita. É por isso que o link para o original é obrigatório e não
        decorativo — <strong>em caso de dúvida, o texto que vale é o da
        fonte</strong>.
      </p>

      <h2>Assunto doutrinário</h2>
      <p>
        Notícia sobre doutrina, liturgia e magistério exige mais cuidado do que
        notícia comum, porque o erro não é só factual: ele pode induzir alguém a
        erro de fé. Nessas matérias, trate o texto daqui como indicação de
        leitura e vá ao documento original ou ao texto da fonte.
      </p>

      <h2>Correções e retificações</h2>
      <p>
        Erro identificado é corrigido na própria página. Correção relevante fica
        registrada, não é apagada em silêncio — uma alteração que muda o sentido
        do que foi publicado precisa ser visível para quem já leu a versão
        anterior.
      </p>

      <h2>Direitos sobre o conteúdo das fontes</h2>
      <p>
        O direito autoral sobre cada reportagem original permanece de quem a
        publicou:
      </p>
      <ul>
        {FONTES_DECLARADAS.map((fonte) => (
          <li key={fonte.nome}>
            <a href={fonte.url} target="_blank" rel="noopener noreferrer">
              {fonte.nome}
            </a>
          </li>
        ))}
      </ul>
      <p>
        Se você representa uma dessas fontes — ou outra — e quer que deixemos de
        adaptar seu material, escreva pelo{" "}
        <Link href="/contato">canal de contato</Link>. O pedido é atendido, e
        não há discussão a ter sobre isso.
      </p>

      <h2>Rastreamento das fontes</h2>
      <p>
        A coleta respeita o <code>robots.txt</code> de cada site, identifica-se
        com agente próprio e trabalha em intervalos espaçados, para não pesar
        sobre a infraestrutura de quem produziu a reportagem.
      </p>
    </LegalShell>
  );
}

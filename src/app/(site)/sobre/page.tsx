import type { Metadata } from "next";
import Link from "next/link";
import {
  AvisoPendente,
  LegalShell,
} from "@/components/institutional/legal-shell";
import { FONTES_DECLARADAS, SOBRE } from "@/lib/institucional";
import { metadataInstitucional, ROTA_ARQUIVO } from "@/lib/seo";

const RESUMO =
  "O Minuto Católico reúne, adapta para o português e organiza notícias da vida da Igreja, sempre com link para a reportagem original.";

export async function generateMetadata(): Promise<Metadata> {
  return metadataInstitucional({
    slug: "sobre",
    titulo: "Sobre",
    descricao: RESUMO,
  });
}

export default function SobrePage() {
  return (
    <LegalShell titulo="Sobre" resumo={RESUMO}>
      <h2>O que este site é</h2>
      <p>
        O Minuto Católico é um portal de notícias sobre a vida da Igreja. Ele
        acompanha veículos católicos de referência, seleciona o que tem
        interesse para o leitor de língua portuguesa e publica uma versão
        adaptada em português, com link para o texto original.
      </p>
      <p>
        <strong>Não somos agência de notícias e não fazemos apuração
        própria.</strong> O que existe aqui é seleção, adaptação e organização
        de material publicado por terceiros. Dizer isso em voz alta é parte do
        acordo com quem lê.
      </p>

      <h2>Como uma matéria chega aqui</h2>
      <ol>
        <li>
          O sistema acompanha os feeds das fontes declaradas abaixo em
          intervalos curtos e identifica o que é novo.
        </li>
        <li>
          Cada item recebe uma chave estável derivada da URL de origem, para que
          a mesma notícia não seja publicada duas vezes.
        </li>
        <li>
          O texto é reescrito em português — não traduzido na íntegra — por um
          modelo de linguagem, a partir do material da fonte.
        </li>
        <li>
          A versão em português passa por verificações automáticas antes de ir
          ao ar. Matéria que falha em alguma delas fica retida e não é
          publicada.
        </li>
        <li>
          O que é publicado carrega o nome da fonte e o link para o original em
          todas as páginas onde aparece.
        </li>
      </ol>

      <h2>O papel da automação — e os seus limites</h2>
      <p>
        A adaptação para o português é feita por modelo de linguagem. Isso é
        dito abertamente porque muda o que se pode esperar do texto: ele é
        rápido e cobre um volume que nenhuma redação pequena cobriria, mas{" "}
        <strong>não substitui a leitura do original</strong>, sobretudo em
        assunto doutrinário, citação de documento pontifício ou fala atribuída a
        alguém.
      </p>
      <p>
        Há verificações automáticas contra erro factual e contra o texto ficar
        próximo demais do original — a segunda existe tanto por direito autoral
        quanto porque republicar não é adaptar. Elas reprovam material de
        verdade, e material reprovado não vai ao ar. Ainda assim, nenhuma
        verificação automática é infalível: quando a precisão importa,{" "}
        <strong>o texto que vale é o da fonte</strong>, e o link para ele está
        ao pé de cada matéria.
      </p>

      <h2>Fontes</h2>
      <p>
        Estas são as fontes que o portal consome hoje. A lista muda quando o
        sistema muda, não antes:
      </p>
      <dl>
        {FONTES_DECLARADAS.map((fonte) => (
          <div key={fonte.nome}>
            <dt>
              <a href={fonte.url} target="_blank" rel="noopener noreferrer">
                {fonte.nome}
              </a>
            </dt>
            <dd>{fonte.descricao}</dd>
          </div>
        ))}
      </dl>
      <p>
        O direito sobre cada reportagem original é de quem a publicou. Nenhum
        texto é reproduzido integralmente aqui. Detalhes em{" "}
        <Link href="/politica-editorial">Política editorial</Link>.
      </p>

      <h2>A coluna litúrgica</h2>
      <p>
        A liturgia do dia e o santo exibidos na capa seguem o{" "}
        <strong>calendário tradicional de 1962</strong>, não o Novus Ordo. É por
        isso que aparecem Epístola e Evangelho, e não primeira leitura, salmo
        responsorial e Evangelho. Não é descuido: é o rito que este calendário
        descreve.
      </p>

      <h2>Responsabilidade editorial</h2>
      {SOBRE.responsavelEditorial ? (
        <p>{SOBRE.responsavelEditorial}</p>
      ) : (
        <AvisoPendente>
          A identificação do responsável editorial ainda não foi publicada. Ela
          será incluída aqui assim que definida — e é informação que um portal
          de notícias deve ao leitor.
        </AvisoPendente>
      )}

      <h2>Correções</h2>
      <p>
        Erro em matéria publicada aqui é corrigido na própria página, e não
        apagado sem registro. Se você encontrou um, fale pelo{" "}
        <Link href="/contato">canal de contato</Link>. Se o erro estiver no
        texto original da fonte, o caminho é falar com ela — o link está ao pé
        da matéria.
      </p>

      <h2>Por onde começar</h2>
      <p>
        A capa traz o dia; o <Link href={ROTA_ARQUIVO}>arquivo completo</Link>{" "}
        permite filtrar por editoria e navegar por todo o acervo publicado.
      </p>
    </LegalShell>
  );
}

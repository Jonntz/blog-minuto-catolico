import type { Metadata } from "next";
import Link from "next/link";
import {
  AvisoPendente,
  LegalShell,
} from "@/components/institutional/legal-shell";
import { PENDENTE } from "@/lib/institucional";
import { metadataInstitucional } from "@/lib/seo";

const RESUMO =
  "As condições de uso do site, o que você pode fazer com o conteúdo publicado e os limites de responsabilidade.";

export async function generateMetadata(): Promise<Metadata> {
  return metadataInstitucional({
    slug: "termos",
    titulo: "Termos de Uso",
    descricao: RESUMO,
  });
}

export default function TermosPage() {
  return (
    <LegalShell titulo="Termos de Uso" resumo={RESUMO}>
      <h2>1. Aceitação</h2>
      <p>
        Ao acessar o Minuto Católico você concorda com estes termos. Se não
        concordar com algum ponto, o caminho é não usar o site.
      </p>

      <h2>2. O que o site oferece</h2>
      <p>
        Acesso gratuito a notícias sobre a vida da Igreja, adaptadas para o
        português a partir de veículos de terceiros, e a uma coluna litúrgica
        baseada no calendário tradicional de 1962. Não há área restrita, venda
        de produto ou serviço pago.
      </p>

      <h2>3. Natureza do conteúdo</h2>
      <p>
        O conteúdo é informativo. <strong>Não é aconselhamento espiritual,
        jurídico, médico ou financeiro</strong>, e não substitui o magistério da
        Igreja, o texto de documento pontifício nem a orientação do seu pároco
        ou diretor espiritual.
      </p>
      <p>
        As matérias são versões adaptadas de reportagens de terceiros, produzidas
        com auxílio de modelo de linguagem. Em caso de divergência,{" "}
        <strong>o texto que prevalece é o da fonte original</strong>, cujo link
        está ao pé de cada matéria. Ver{" "}
        <Link href="/politica-editorial">Política editorial</Link>.
      </p>

      <h2>4. Uso do conteúdo deste site</h2>
      <p>Você pode, sem pedir autorização:</p>
      <ul>
        <li>ler, imprimir e compartilhar links das matérias;</li>
        <li>
          citar trechos curtos, desde que atribuídos ao Minuto Católico e com
          link para a página citada;
        </li>
        <li>assinar o feed RSS e usá-lo em leitores de notícia.</li>
      </ul>
      <p>Você não pode:</p>
      <ul>
        <li>
          republicar matérias na íntegra em outro site, app ou publicação;
        </li>
        <li>
          apresentar o conteúdo como próprio ou remover a atribuição às fontes;
        </li>
        <li>
          usar o conteúdo deste site como insumo para treinar modelos de
          linguagem sem autorização;
        </li>
        <li>
          coletar o site de forma automatizada em desacordo com o{" "}
          <code>robots.txt</code>, ou em volume que prejudique o serviço.
        </li>
      </ul>

      <h2>5. Direitos de terceiros</h2>
      <p>
        As reportagens originais e as imagens que as acompanham pertencem aos
        respectivos veículos e fotógrafos, creditados em cada página. Nada nestes
        termos transfere direito sobre esse material — para usá-lo, fale com
        quem o detém.
      </p>

      <h2>6. Disponibilidade</h2>
      <p>
        O site é oferecido no estado em que se encontra. Não há garantia de
        funcionamento ininterrupto: a publicação depende de fontes externas e de
        serviços de terceiros, e qualquer um deles pode falhar. Interrupções
        podem ocorrer também para manutenção.
      </p>

      <h2>7. Limitação de responsabilidade</h2>
      <p>
        Empregamos cuidado razoável na seleção e na adaptação do conteúdo,
        incluindo verificações automáticas antes da publicação. Ainda assim,
        não respondemos por:
      </p>
      <ul>
        <li>
          erro, omissão ou desatualização em matéria adaptada, sem prejuízo do
          nosso compromisso de corrigir o que for apontado;
        </li>
        <li>conteúdo de sites de terceiros acessados a partir dos links;</li>
        <li>
          decisão tomada por qualquer pessoa com base apenas no que leu aqui.
        </li>
      </ul>

      <h2>8. Links para outros sites</h2>
      <p>
        O portal linka para as fontes originais e para documentos citados.
        Esses sites têm políticas próprias, sobre as quais não temos controle.
      </p>

      <h2>9. Alterações destes termos</h2>
      <p>
        Estes termos podem mudar. A versão vigente é sempre a publicada nesta
        página, com a data de revisão no topo.
      </p>

      <h2>10. Legislação e foro</h2>
      <p>
        Aplica-se a legislação brasileira, incluindo o Marco Civil da Internet
        (Lei 12.965/2014) e a Lei Geral de Proteção de Dados (Lei 13.709/2018).
      </p>
      {PENDENTE.localidade ? (
        <p>Foro eleito: comarca de {PENDENTE.localidade}.</p>
      ) : (
        <AvisoPendente>
          A cláusula de foro depende da definição da entidade responsável pelo
          site e será publicada aqui em seguida.
        </AvisoPendente>
      )}

      <h2>11. Contato</h2>
      <p>
        Dúvidas sobre estes termos, pedidos de remoção de conteúdo e questões de
        direito autoral: veja a página de <Link href="/contato">Contato</Link>.
      </p>
    </LegalShell>
  );
}

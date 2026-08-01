import type { Metadata } from "next";
import Link from "next/link";
import {
  AvisoPendente,
  LegalShell,
} from "@/components/institutional/legal-shell";
import { PENDENTE } from "@/lib/institucional";
import { metadataInstitucional } from "@/lib/seo";

const RESUMO =
  "Como falar com o Minuto Católico: correções, direitos autorais, privacidade e imprensa.";

export async function generateMetadata(): Promise<Metadata> {
  return metadataInstitucional({
    slug: "contato",
    titulo: "Contato",
    descricao: RESUMO,
  });
}

export default function ContatoPage() {
  return (
    <LegalShell titulo="Contato" resumo={RESUMO}>
      {PENDENTE.email ? (
        <>
          <h2>E-mail</h2>
          <p>
            <a href={`mailto:${PENDENTE.email}`}>{PENDENTE.email}</a>
          </p>
        </>
      ) : (
        <AvisoPendente>
          <strong>O canal de contato ainda está sendo definido.</strong> Esta
          página existe desde já porque as políticas do site remetem a ela — e
          publicar um endereço que ninguém lê seria pior do que declarar a
          pendência. O e-mail aparecerá aqui assim que estiver ativo.
        </AvisoPendente>
      )}

      <h2>Para que serve cada assunto</h2>

      <h3>Correção de matéria</h3>
      <p>
        Indique o link da página e o ponto exato do erro. Erro nosso é corrigido
        na própria matéria. Se o erro estiver no texto original da fonte, o
        caminho é falar com ela — o link está ao pé de cada matéria, e ver{" "}
        <Link href="/politica-editorial">Política editorial</Link>.
      </p>

      <h3>Direito autoral e pedidos de remoção</h3>
      <p>
        Se você representa um veículo cujo material é adaptado aqui e quer que
        isso pare, escreva. O pedido é atendido — não há discussão a ter sobre
        isso. Informe qual veículo você representa e, se for o caso, os links
        específicos.
      </p>

      <h3>Privacidade e LGPD</h3>
      <p>
        Pedidos de acesso, correção ou remoção de dados pessoais — inclusive a
        remoção do seu e-mail da newsletter. O que tratamos e com que base legal
        está em <Link href="/privacidade">Política de Privacidade</Link>.
      </p>

      <h3>Imprensa e parcerias</h3>
      <p>
        Identifique o veículo ou a instituição e o que procura. Vale registrar
        que o portal não faz apuração própria — ver{" "}
        <Link href="/sobre">Sobre</Link>.
      </p>

      <h2>O que este canal não é</h2>
      <ul>
        <li>
          <strong>Não é aconselhamento espiritual.</strong> Para isso, procure
          seu pároco ou diretor espiritual.
        </li>
        <li>
          <strong>Não é canal de denúncia.</strong> Situações que exijam
          autoridade eclesiástica ou civil devem ser levadas a ela.
        </li>
        <li>
          <strong>Não recebemos pauta para publicação paga.</strong> O portal
          não publica conteúdo patrocinado.
        </li>
      </ul>

      <h2>Newsletter</h2>
      <p>
        A inscrição fica no rodapé da capa. Para sair da lista, basta pedir por
        este canal — sem justificativa e sem etapa intermediária.
      </p>
    </LegalShell>
  );
}

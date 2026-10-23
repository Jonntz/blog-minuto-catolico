import type { Metadata } from "next";
import Link from "next/link";
import {
  AvisoPendente,
  LegalShell,
} from "@/components/institutional/legal-shell";
import {
  ARMAZENAMENTO_LOCAL,
  PENDENTE,
  PRIVACIDADE,
  TRATAMENTOS,
} from "@/lib/institucional";
import { metadataInstitucional } from "@/lib/seo";

const RESUMO =
  "Que dados o site coleta, por quê, com quem são compartilhados e como exercer os direitos previstos na LGPD.";

export async function generateMetadata(): Promise<Metadata> {
  return metadataInstitucional({
    slug: "privacidade",
    titulo: "Política de Privacidade",
    descricao: RESUMO,
  });
}

export default function PrivacidadePage() {
  return (
    <LegalShell titulo="Política de Privacidade" resumo={RESUMO}>
      <h2>Resumo</h2>
      <p>
        O Minuto Católico é um site de leitura. Não há cadastro e não há login.
        Os únicos dados pessoais que o site recebe de forma deliberada são o
        e-mail de quem se inscreve na newsletter.
      </p>
      <p>
        O site <strong>não exibe publicidade</strong>: nenhum script de rede de
        anúncios é carregado e nenhum dado seu é repassado a anunciantes.
      </p>

      <h2>1. Dados que o site trata</h2>

      <h3>1.1 Dados técnicos de acesso</h3>
      <p>
        Como qualquer site, ao carregar uma página o servidor recebe endereço
        IP, tipo de navegador e a página solicitada. Esses dados são usados para
        entregar o conteúdo, proteger o site contra abuso e medir audiência de
        forma agregada. A base legal é o{" "}
        <strong>legítimo interesse</strong> (LGPD, art. 7º, IX).
      </p>

      <h3>1.2 E-mail da newsletter</h3>
      <p>
        Se você se inscrever na newsletter, guardamos o e-mail informado, a data
        da inscrição e de onde ela partiu. A base legal é o{" "}
        <strong>consentimento</strong> (LGPD, art. 7º, I), e ele pode ser
        retirado a qualquer momento. O e-mail é usado apenas para enviar o
        resumo editorial — <strong>não é vendido, alugado nem compartilhado
        com terceiros para fins de marketing</strong>.
      </p>

      <h3>1.3 O que fica no seu aparelho</h3>
      {/* Sem número por extenso: a lista vem de `ARMAZENAMENTO_LOCAL` e já
          mudou de tamanho uma vez. Texto que conta itens à mão vira mentira no
          commit seguinte. */}
      <p>
        Estas informações ficam gravadas no armazenamento local do seu navegador
        e <strong>nunca são enviadas ao servidor</strong>:
      </p>
      <dl>
        {ARMAZENAMENTO_LOCAL.map((item) => (
          <div key={item.chave}>
            <dt>
              <code>{item.chave}</code>
            </dt>
            <dd>{item.para}</dd>
          </div>
        ))}
      </dl>
      <p>
        Como não são cookies e não saem do aparelho, são preferências suas, sob
        seu controle. Limpar os dados do site no navegador apaga todas.
      </p>
      <p>
        O único cookie do site é o <code>cf_clearance</code>, gravado pela
        Cloudflare ao verificar que o acesso vem de uma pessoa e não de um robô
        automatizado. Ele guarda apenas o resultado dessa verificação, não
        identifica você e não serve para publicidade. É necessário para a
        segurança do site, com base no <strong>legítimo interesse</strong>{" "}
        (LGPD, art. 7º, IX).
      </p>

      <h2>2. Com quem os dados são compartilhados</h2>
      <p>
        O site funciona sobre infraestrutura de terceiros. Estes são os
        operadores envolvidos e o que cada um faz:
      </p>
      <dl>
        {TRATAMENTOS.map((t) => (
          <div key={t.nome}>
            <dt>{t.nome}</dt>
            <dd>
              {t.papel} <em>{t.local}</em>
            </dd>
          </div>
        ))}
      </dl>
      <p>
        <strong>Transferência internacional:</strong> a hospedagem é feita em
        servidores fora do Brasil. A LGPD permite essa transferência (art. 33), e
        ela é inerente ao uso de uma rede de distribuição global — que é o que
        entrega o site rapidamente onde quer que você esteja.
      </p>

      <h2>3. Publicidade</h2>
      <p>
        O site <strong>não exibe publicidade</strong>. Nenhum script de rede
        publicitária é carregado. Se isso mudar, esta seção será atualizada
        antes, e a exibição dependerá de autorização explícita sua — sem
        autorização, nenhum dado seu chegará à rede.
      </p>

      <h2>4. Medição de audiência</h2>
      <p>
        Não usamos Google Analytics, pixel de rede social nem qualquer
        ferramenta de medição que crie identificador persistente de visitante.
      </p>
      <p>
        A audiência é medida pelo <strong>Cloudflare Web Analytics</strong>: um
        pequeno script registra quais páginas são visitadas e quanto tempo levam
        para carregar. Segundo a Cloudflare, ele não usa cookies e não coleta
        dados pessoais de quem visita. Os números chegam até nós apenas{" "}
        <strong>de forma agregada</strong> — quantas visitas uma página teve,
        não quem a visitou.
      </p>
      <p>
        Se uma página falhar ao carregar, seu navegador pode avisar a Cloudflare
        sobre o erro de rede (recurso chamado <em>Network Error Logging</em>).
        O aviso serve só para detectarmos falhas de entrega e só é enviado
        quando algo dá errado.
      </p>

      <h2>5. Conteúdo carregado de outros domínios</h2>
      <p>
        As imagens das matérias vêm das fontes de origem, mas{" "}
        <strong>quem as busca é o nosso servidor</strong>, não o seu navegador:
        elas são redimensionadas pela Cloudflare e entregues a partir do próprio
        endereço do Minuto Católico. As fontes de origem não recebem o seu
        endereço IP quando você vê uma imagem aqui.
      </p>
      <p>
        Para acelerar a navegação, a Cloudflare pode carregar antecipadamente
        páginas do próprio site que você provavelmente vai abrir em seguida.
        Isso acontece dentro do Minuto Católico e não envolve outros domínios.
      </p>

      <h2>6. Menores de idade</h2>
      <p>
        O site não é dirigido a crianças e não coleta dados de forma consciente
        de menores de 18 anos. A newsletter não deve ser assinada por menor sem
        consentimento de quem é responsável por ele.
      </p>

      <h2>7. Por quanto tempo guardamos</h2>
      <ul>
        <li>
          <strong>Registros técnicos de acesso:</strong> pelo prazo de retenção
          da Cloudflare, para fins de segurança.
        </li>
        <li>
          <strong>E-mail da newsletter:</strong> até você pedir a remoção.
          Cancelou a inscrição, o registro é eliminado.
        </li>
      </ul>

      <h2>8. Seus direitos</h2>
      <p>
        A LGPD (art. 18) garante a você, sobre os seus dados: confirmação de que
        existe tratamento, acesso, correção, anonimização ou eliminação,
        portabilidade, informação sobre com quem foram compartilhados, e
        revogação do consentimento.
      </p>
      <p>
        Na prática, para este site, o pedido mais comum é a remoção do e-mail da
        newsletter — e ela é feita sem que você precise justificar.
      </p>

      <h2>9. Como falar sobre os seus dados</h2>
      {PENDENTE.email ? (
        <p>
          Escreva para <a href={`mailto:${PENDENTE.email}`}>{PENDENTE.email}</a>
          . Pedidos relativos à LGPD são respondidos no prazo legal.
        </p>
      ) : (
        <AvisoPendente>
          <strong>O canal para pedidos de titular ainda está sendo
          definido.</strong>{" "}
          Preferimos declarar isso a publicar um endereço que não seria
          atendido: um canal de LGPD que não funciona é pior do que um canal
          ausente. Enquanto isso, veja a página de{" "}
          <Link href="/contato">Contato</Link>.
        </AvisoPendente>
      )}

      <h3>Encarregado pelo tratamento de dados</h3>
      {PRIVACIDADE.encarregado ? (
        <p>{PRIVACIDADE.encarregado}</p>
      ) : (
        <AvisoPendente>
          A identificação do encarregado (LGPD, art. 41) será publicada aqui
          assim que definida.
        </AvisoPendente>
      )}

      <h2>10. Mudanças nesta política</h2>
      <p>
        Alterações são publicadas nesta página, com a data de revisão atualizada
        no topo. Mudança que amplie o tratamento de dados pessoais será
        anunciada também na capa do site.
      </p>
    </LegalShell>
  );
}

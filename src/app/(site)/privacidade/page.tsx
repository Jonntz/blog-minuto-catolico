import type { Metadata } from "next";
import Link from "next/link";
import { ReabrirConsentimento } from "@/components/consent/reabrir-consentimento";
import {
  AvisoPendente,
  LegalShell,
} from "@/components/institutional/legal-shell";
import {
  ARMAZENAMENTO_LOCAL,
  PENDENTE,
  PRIVACIDADE,
  PUBLICIDADE_ATIVA,
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
      {PUBLICIDADE_ATIVA ? (
        <p>
          O site <strong>exibe publicidade de terceiro</strong>, e ela só é
          carregada <strong>depois que você autoriza</strong>. Sem autorização,
          nenhum script de anúncio é executado e nenhum dado seu chega à rede
          publicitária. Você pode mudar essa escolha quando quiser — veja a
          seção 3.
        </p>
      ) : (
        <p>
          A publicidade do site está <strong>suspensa</strong> no momento:
          nenhum script de anúncio é carregado. Quando voltar, será mediante
          autorização explícita, conforme descrito na seção 3.
        </p>
      )}

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
        seu controle. Limpar os dados do site no navegador apaga todas —
        inclusive a sua escolha sobre publicidade, que voltará a ser perguntada.
      </p>

      <h2>2. Com quem os dados são compartilhados</h2>
      <p>
        O site funciona sobre infraestrutura de terceiros. Estes são os
        operadores envolvidos e o que cada um faz:
      </p>
      <dl>
        {TRATAMENTOS.map((t) => (
          <div key={t.nome}>
            <dt>
              {t.nome}
              {t.condicionadoAConsentimento ? (
                // Marcar na própria lista evita que o leitor tenha de cruzar
                // esta seção com a de publicidade para saber o que só roda
                // mediante autorização.
                <> — somente com a sua autorização</>
              ) : null}
            </dt>
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
      {PUBLICIDADE_ATIVA ? (
        <>
          <p>
            O site é mantido com publicidade da rede <strong>Adcash</strong>. A
            base legal é o <strong>consentimento</strong> (LGPD, art. 7º, I):
            enquanto você não autorizar, o script da rede{" "}
            <strong>não é carregado</strong> — seu navegador sequer chega a
            contatar o servidor dela.
          </p>
          <p>
            Autorizada a exibição, a Adcash passa a receber seu endereço IP e
            dados do navegador (tipo, idioma, tamanho de tela) e pode gravar
            cookies próprios para escolher os anúncios e medir os resultados.
            Isso caracteriza <strong>transferência internacional</strong> e{" "}
            <strong>compartilhamento com terceiro</strong>, e é justamente por
            isso que pedimos autorização antes.
          </p>
          <p>
            <strong>Para mudar de ideia</strong>, use o botão abaixo. Retirar a
            autorização interrompe o carregamento a partir da próxima página; o
            que a rede já recebeu deve ser solicitado diretamente a ela.
          </p>
          <ReabrirConsentimento />
        </>
      ) : (
        <p>
          A exibição de publicidade está <strong>suspensa</strong>. Nenhum
          script de rede publicitária é carregado neste site no momento. Quando
          for reativada, esta seção será atualizada antes, e a exibição
          dependerá de <strong>autorização explícita</strong> sua — sem
          autorização, nenhum dado seu chega à rede.
        </p>
      )}

      <h2>4. Medição de audiência</h2>
      <p>
        Não usamos Google Analytics, pixel de rede social nem qualquer
        ferramenta de medição que crie identificador persistente de visitante.
        As estatísticas de acesso vêm dos registros do próprio servidor,{" "}
        <strong>de forma agregada</strong>.
      </p>

      <h2>5. Conteúdo carregado de outros domínios</h2>
      <p>
        As imagens das matérias são servidas a partir da infraestrutura das
        fontes de origem. Ao carregar uma imagem, seu navegador faz uma
        requisição a esses domínios, que por sua vez recebem seu endereço IP.
        Não temos controle sobre o que essas empresas fazem com esse dado, e é
        por isso que isto está escrito aqui.
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

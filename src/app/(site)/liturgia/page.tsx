import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BookRecommendation } from "@/components/article/book-recommendation";
import { LiturgyCard } from "@/components/home/liturgy-card";
import { SaintCard } from "@/components/home/saint-card";
import { SectionHeading } from "@/components/home/section-heading";
import { LiturgyPanelSkeleton } from "@/components/home/today-line";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui/container";
import {
  buscarLiturgia,
  buscarUltimoDiaLiturgico,
  listarLiturgiaAPartirDe,
} from "@/lib/articles";
import { chaveDoDia, diaPorExtenso, FUSO } from "@/lib/format";
import {
  getSiteUrl,
  jsonLdTrilha,
  LOCALE,
  NOME_SITE,
  OG_PADRAO,
  ROTA_HOME,
  ROTA_LITURGIA,
  urlAbsoluta,
} from "@/lib/seo";

const TITULO = "Liturgia Diária · Missal Romano de 1962";
const DESCRICAO =
  "Calendário litúrgico tradicional (Missal de 1962 / Missa Tridentina): festa do dia, classe, cor litúrgica, Epístola, Evangelho e santo do Calendário Mariano.";

export async function generateMetadata(): Promise<Metadata> {
  const base = await getSiteUrl();
  const url = `${base}${ROTA_LITURGIA}`;
  const ogUrl = await urlAbsoluta(OG_PADRAO.caminho);

  return {
    metadataBase: new URL(base),
    title: TITULO,
    description: DESCRICAO,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: NOME_SITE,
      locale: LOCALE,
      title: `${TITULO} · ${NOME_SITE}`,
      description: DESCRICAO,
      images: [
        {
          url: ogUrl,
          width: OG_PADRAO.largura,
          height: OG_PADRAO.altura,
          alt: NOME_SITE,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${TITULO} · ${NOME_SITE}`,
      description: DESCRICAO,
      images: [ogUrl],
    },
  };
}

export default function LiturgiaPage() {
  return (
    <Container as="section" className="py-12 sm:py-16">
      <nav aria-label="Trilha de navegação" className="mb-6">
        <ol className="flex flex-wrap items-center gap-2 text-xs tracking-[0.08em] text-ink-3 uppercase">
          <li>
            <Link
              href={ROTA_HOME}
              className="transition-colors duration-200 ease-dc hover:text-blue-f"
            >
              Capa
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>Liturgia de 1962</li>
        </ol>
      </nav>

      <SectionHeading
        id="titulo-liturgia"
        nivel="h1"
        sobrancelha="Rito Romano Tradicional"
        titulo="Liturgia Diária · Missal de 1962"
        href={ROTA_HOME}
        rotuloDoLink="Voltar para a capa"
      />

      <p className="mt-4 max-w-[65ch] text-[16.5px] leading-[1.6] text-ink-2">
        O {NOME_SITE} acompanha o calendário litúrgico tradicional segundo o{" "}
        <strong className="font-semibold text-ink">Missal Romano de 1962</strong>{" "}
        (Missa Tridentina). Neste rito, as leituras da Missa compõem-se de{" "}
        <strong className="font-semibold text-ink">Epístola</strong> e{" "}
        <strong className="font-semibold text-ink">Evangelho</strong>, e os dias
        ordenam-se de 1ª a 4ª classe.
      </p>

      <div className="mt-8">
        <Suspense fallback={<LiturgyPanelSkeleton />}>
          <ConteudoLiturgia />
        </Suspense>
      </div>
    </Container>
  );
}

async function ConteudoLiturgia() {
  await connection();
  const agora = new Date();
  const hoje = chaveDoDia(agora);

  const [diaHoje, proximos, trilhaLd] = await Promise.all([
    buscarLiturgia(hoje),
    listarLiturgiaAPartirDe(hoje, 31),
    jsonLdTrilha([
      { nome: "Início", caminho: ROTA_HOME },
      { nome: "Liturgia de 1962", caminho: ROTA_LITURGIA },
    ]),
  ]);

  const ultimo = !diaHoje ? await buscarUltimoDiaLiturgico() : undefined;

  return (
    <>
      <JsonLd id="ld-liturgia" dados={trilhaLd} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {diaHoje ? (
          <>
            <LiturgyCard dia={diaHoje} ocultarLinkCalendario />
            <SaintCard dia={diaHoje} />
          </>
        ) : (
          <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card lg:col-span-2">
            <p className="text-xs tracking-[0.12em] text-ink-3 uppercase">
              {diaPorExtenso(agora)}
            </p>
            <p className="mt-3 text-[15px] leading-[1.6] text-ink-2">
              As leituras de hoje ainda não foram publicadas pela fonte que
              acompanhamos
              {ultimo ? ` (cobertura atual até ${formatarDataCurta(ultimo)})` : ""}.
              Nunca publicamos liturgia estimada a partir de outros anos.
            </p>
          </div>
        )}
      </div>

      {proximos.length > 1 ? (
        <section aria-labelledby="proximos-dias" className="mt-14">
          <h2
            id="proximos-dias"
            className="border-b border-line pb-3.5 font-display text-[22px] leading-[1.15] font-semibold tracking-[-0.025em]"
          >
            Próximos dias no calendário
          </h2>

          <div className="mt-5 overflow-x-auto rounded-[18px] border border-line bg-surface shadow-card">
            <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-[11px] tracking-[0.1em] text-ink-3 uppercase">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Data
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Festa e Comemoração
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Classe / Cor
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Epístola · Evangelho
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {proximos.map((d) => (
                  <tr
                    key={d.date}
                    className={
                      d.date === hoje ? "bg-surface-2/70 font-medium" : undefined
                    }
                  >
                    <td className="px-4 py-3.5 align-top whitespace-nowrap">
                      <time dateTime={d.date} className="font-medium text-ink">
                        {formatarDataCurta(d.date)}
                      </time>
                      <span className="block text-xs text-ink-3">
                        {d.weekday}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <span className="font-medium text-ink">{d.feast}</span>
                      {d.commemoration ? (
                        <span className="mt-0.5 block text-xs text-ink-2">
                          {d.commemoration}
                        </span>
                      ) : null}
                      {d.note ? (
                        <span className="mt-1 inline-block rounded bg-amber-b px-2 py-0.5 text-[11px] font-medium text-amber-f">
                          {d.note}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 align-top whitespace-nowrap text-ink-2">
                      {d.classis ?? "—"}
                      {d.color ? (
                        <span className="block text-xs text-ink-3">
                          {d.color}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 align-top text-xs text-ink-2">
                      {d.epistle ? (
                        <div>
                          <span className="text-ink-3">Ep.:</span> {d.epistle}
                        </div>
                      ) : null}
                      {d.gospel ? (
                        <div className="mt-0.5">
                          <span className="text-ink-3">Ev.:</span> {d.gospel}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-ink-3">
            Fonte do calendário:{" "}
            <a
              href="https://salvemaria.com.br/calendario/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-f underline underline-offset-2"
            >
              Salve Maria (Calendário Litúrgico Tradicional)
            </a>
            .
          </p>
        </section>
      ) : null}

      <BookRecommendation categoriaSlug="liturgia" />
    </>
  );
}

function formatarDataCurta(chaveIso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "short",
  }).format(new Date(`${chaveIso}T12:00:00Z`));
}

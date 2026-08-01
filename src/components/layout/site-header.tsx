import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { HeaderShell } from "./header-shell";
import { MobileMenu } from "./mobile-menu";
import { itensDaNavegacao, itensDoMenuDeCelular } from "./nav";
import { SiteSearch } from "./site-search";
import { ThemeToggle } from "./theme-toggle";

/**
 * Cabeçalho fixo de 54px do design.
 *
 * É um Server Component. Os únicos pedaços que cruzam para o cliente são a
 * casca de rolagem (`HeaderShell`), o menu de celular e o alternador de tema —
 * cada um pelo motivo mínimo que justifica o `"use client"`. A busca é um
 * `<form method="get">` sem JavaScript nenhum.
 *
 * Conferido contra o design: os únicos controles do header são busca, tema e
 * (no celular) o botão de menu. Não há alternador de fonte — `headlineFont`
 * existe no design apenas como prop do painel de edição (`section: "Aparência"`),
 * não como controle exposto ao leitor.
 */
export function SiteHeader() {
  return (
    <HeaderShell>
      <Container className="flex h-full items-center gap-3">
        {/* No design a marca é texto corrido, 16.5px / 600 / -0.025em —
            sem quebra de cor entre as duas palavras. */}
        <Link
          href="/"
          className="shrink-0 font-display text-[16.5px] font-semibold tracking-[-0.025em] whitespace-nowrap"
        >
          Minuto Católico
        </Link>

        {/* A lista de editorias sai do D1 (só entra quem tem conteúdo), e o
            binding não existe em tempo de build. Marca, busca e tema são
            prerenderizados; só os links chegam em streaming. */}
        <Suspense
          fallback={<div className="ml-4 hidden min-w-0 flex-1 md:block" />}
        >
          <NavPrincipal />
        </Suspense>

        <div className="ml-auto flex items-center gap-2.5">
          <SiteSearch className="hidden md:block" />
          {/* No celular o tema fica dentro do menu aberto, como no design. */}
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <Suspense fallback={null}>
            <MenuDeCelular />
          </Suspense>
        </div>
      </Container>
    </HeaderShell>
  );
}

async function NavPrincipal() {
  const itens = await itensDaNavegacao();

  return (
    <nav
      aria-label="Navegação principal"
      className="ml-4 hidden min-w-0 flex-1 md:block"
    >
      <ul className="flex items-center gap-5">
        {itens.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-[13px] font-medium whitespace-nowrap text-ink-2 transition-colors duration-200 ease-dc hover:text-blue-f"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

async function MenuDeCelular() {
  const itens = await itensDoMenuDeCelular();
  return <MobileMenu itens={itens} />;
}

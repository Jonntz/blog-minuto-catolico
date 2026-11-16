import Link from "next/link";
import { Container } from "@/components/ui/container";
import { HeaderShell } from "./header-shell";
import { MobileMenu } from "./mobile-menu";
import { itensDaNavegacao, itensDoMenuDeCelular } from "./nav";
import { SiteSearch } from "./site-search";
import { ThemeToggle } from "./theme-toggle";

/**
 * Cabeçalho fixo de 54px do design.
 *
 * 100% pré-renderizado no build (zero `<Suspense>`): marca, links de editoria,
 * busca, tema e gatilho do menu mobile já vêm prontos no primeiro pacote HTML.
 */
export function SiteHeader() {
  const itensDesktop = itensDaNavegacao();
  const itensMobile = itensDoMenuDeCelular();

  return (
    <HeaderShell>
      <Container className="flex h-full items-center gap-3">
        <Link
          href="/"
          className="shrink-0 font-display text-[16.5px] font-semibold tracking-[-0.025em] whitespace-nowrap"
        >
          Minuto Católico
        </Link>

        <nav
          aria-label="Navegação principal"
          className="ml-4 hidden min-w-0 flex-1 md:block"
        >
          <ul className="flex items-center gap-5">
            {itensDesktop.map((item) => (
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

        <div className="ml-auto flex items-center gap-2.5">
          <SiteSearch className="hidden md:block" />
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <MobileMenu itens={itensMobile} />
        </div>
      </Container>
    </HeaderShell>
  );
}

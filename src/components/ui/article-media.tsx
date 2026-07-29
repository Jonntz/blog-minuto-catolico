import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A hachura diagonal que o design usa como placeholder de imagem.
 *
 * Fica como classe utilitária arbitrária (e não como classe CSS nova) porque
 * `--ph` e `--ph-line` já trocam sozinhas com o tema em `globals.css`: no claro
 * é uma trama bege discreta, no escuro uma trama grafite. Uma imagem PNG faria
 * o inverso — ficaria errada em um dos dois temas.
 */
const HACHURA =
  "bg-[repeating-linear-gradient(45deg,var(--ph),var(--ph)_10px,var(--ph-line)_10px,var(--ph-line)_11px)]";

interface ArticleMediaProps {
  src: string | null;
  /** Descrição da foto. Cai para o título do artigo quando não há legenda. */
  alt: string;
  width: number;
  height: number;
  /** `true` apenas na imagem LCP — a de topo da página de artigo. */
  priority?: boolean;
  sizes?: string;
  /** Proporção do quadro. O wrapper reserva o espaço e evita CLS. */
  className?: string;
}

/**
 * Um único componente para os dois estados possíveis de mídia.
 *
 * A ausência de imagem NÃO é excepcional neste projeto: o feed do Sign of the
 * Cross não traz `media:content` (MEMORY.md §2.2), então metade do acervo cai
 * no fallback. Por isso o placeholder é tratado como um estado de primeira
 * classe — com a mesma proporção, a mesma borda e o mesmo raio da foto — e não
 * como um buraco na página.
 */
export function ArticleMedia({
  src,
  alt,
  width,
  height,
  priority = false,
  sizes,
  className,
}: ArticleMediaProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-[14px] border border-line bg-ph",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          priority={priority}
          className="h-full w-full object-cover"
        />
      ) : (
        // aria-hidden + role="presentation": a hachura não carrega informação
        // nenhuma, e anunciá-la a um leitor de tela só atrapalharia.
        <div
          role="presentation"
          aria-hidden="true"
          className={cn("h-full w-full", HACHURA)}
        />
      )}
    </div>
  );
}

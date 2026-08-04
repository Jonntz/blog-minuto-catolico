# Diretrizes do Agente - Portal de Notícias Católico Automatizado

## 1. Visão Geral do Projeto e Identidade

- **Objetivo:** Desenvolver um portal de notícias católico automatizado, com
  ingestão de conteúdo de fontes de referência, foco em altíssima performance,
  Core Web Vitals excelentes e indexação perfeita em motores de busca (SEO) e no
  Google News.
- **Metas técnicas de performance:** LCP < 2.5s, INP < 200ms, CLS < 0.1 em
  conexões móveis 4G. Toda decisão de arquitetura deve ser avaliada contra esse
  orçamento de performance.
- **Confiabilidade editorial:** por se tratar de conteúdo religioso/informativo,
  precisão factual e atribuição correta da fonte original são requisitos de
  produto, não só de SEO (relevante para E-E-A-T do Google e para credibilidade
  do portal).
- **Tom de Código:** Profissional, modular, limpo e documentado. Focado na
  escalabilidade de publicação diária/contínua.

## 2. Stack Tecnológico e Ecossistema Moderno

- **Framework:** Next.js **16.2 (Active LTS)**, com **App Router** obrigatório.
  - **Turbopack** é o bundler padrão (estável) — não force fallback para Webpack
    a menos que exista uma dependência explicitamente incompatível.
  - Requer **Node.js 20.9+** no ambiente de build/execução.
  - ⚠️ Next.js 16.2 ainda **rejeita TypeScript 7.x** (versão em preview) com
    erro de build — fixar a stack em **TypeScript 5.x** até suporte oficial.
- **Modelo de Cache — Cache Components:** habilitar `cacheComponents: true` em
  `next.config.ts`. Isso torna **tudo dinâmico por padrão** (mudança de
  paradigma em relação a versões anteriores) — cache passa a ser explícito via
  diretiva `"use cache"` + `cacheLife()`, combinado com Partial Prerendering
  (PPR) para servir o shell estático instantaneamente e streamar o conteúdo
  dinâmico.
- **Linguagem:** TypeScript (Strict mode ativado).
- **Estilização:** Tailwind CSS 4 (usando variáveis CSS para temas) +
  `tailwind-merge` e `clsx`.
- **UI Components:** Shadcn UI (Radix Primitives) como biblioteca primária.
  Origin UI pode ser usado pontualmente para componentes que o Shadcn não cobre
  — evite misturar as duas para os mesmos padrões de componente (botões, cards,
  inputs), para não gerar inconsistência visual e duplicação de bundle.
- **Persistência/Deploy (arquitetura já definida para o projeto):** Cloudflare
  Workers como alvo de deploy, via **OpenNext adapter**, aproveitando a **Build
  Adapters API** do Next.js 16 para hospedagem fora da Vercel. Banco de dados
  **D1** via **Drizzle ORM**, imagens em **R2**, busca via FTS5 nativo do D1. Se
  essa decisão mudou, ajuste esta seção e a de automação (o comportamento de
  cron muda bastante entre Vercel e Workers).
- **Data Fetching/Automação:** Fetch nativo do Next.js dentro do novo modelo de
  Cache Components (ver seção 4).

## 3. Arquitetura Next.js e Regras de Componentização

- **React Server Components (RSC) por Padrão:** priorizar processamento no
  servidor; usar React Compiler (estável no Next 16) para evitar memoização
  manual desnecessária em Client Components.
- **Client Components (`use client`):** utilizar estritamente nas "folhas" da
  árvore de componentes, apenas quando for necessária interatividade
  (`useState`, `useEffect`, `onClick`, hooks de navegação).
- **Server Actions:** para mutações internas (formulários, aprovação editorial
  manual, disparo manual de automação) usar Server Actions em `/actions`. Para
  endpoints de consumo externo (webhooks de ingestão, cron) usar Route Handlers
  em `/api`.
- **⚠️ `proxy.ts` NÃO é utilizável neste projeto.** No Next.js 16 a validação de
  fronteira de rede migrou de `middleware.ts` para `proxy.ts` — mas isso é
  **incompatível com o alvo de deploy**, e a incompatibilidade só aparece no
  build do adapter: o OpenNext recusa middleware Node, e `runtime = "edge"` é
  proibido em Proxy file (que no Next 16 é sempre Node). Não há configuração que
  concilie os dois. **Não tente de novo** — o diagnóstico completo está em
  `src/lib/cron-auth.ts`. A autorização vive no topo de cada Route Handler, e a
  fronteira de rede é uma regra de WAF no painel da Cloudflare, que funciona
  porque o agendador chama a app por service binding e não atravessa a borda.
- **Estrutura de Pastas:** Adotar o padrão `src/`:
  - `src/app/` (Rotas, Layouts, Pages, Server Actions, route group `(admin)`
    para o painel de revisão editorial)
  - `src/components/` (UI e fragmentos de layout, separados por domínio de
    negócio/ui)
  - `src/lib/` (Configurações, cliente Drizzle/D1, utilitários, validação de env
    com `zod`)
  - `src/services/` (Lógica pesada de negócios: parsers de RSS, scraping,
    deduplicação, normalização de conteúdo)
  - `src/types/` (Definições globais de TypeScript)

## 4. Estratégia de Automação, Cache e Gerenciamento de Dados

- **Realismo sobre "rodar sempre que os sites postarem":** a maioria dos sites
  de referência católicos não expõe webhook/WebSub, então "tempo real"
  verdadeiro normalmente não é viável sem custo. Trate isso como **polling
  frequente**, não como push:
  - Se o deploy for Cloudflare Workers: usar **Cron Triggers** (gratuitos e com
    cadência flexível, ex. a cada 15 min).
  - Se o deploy for Vercel: o **plano Hobby limita cron a 1 execução por dia** e
    sem precisão de horário — insuficiente para este caso de uso. Alternativas
    gratuitas: GitHub Actions com `schedule` (cron por push de commit vazio ou
    workflow agendado) ou um serviço externo como cron-job.org chamando uma
    Route Handler protegida por `CRON_SECRET`.
  - Só implementar ingestão via webhook/WebSub se a fonte específica suportar
    (raro); caso contrário, documentar o intervalo de polling escolhido como
    trade-off consciente entre "quase tempo real" e custo zero.
- **Autorização:** `exigirCronSecret()` na PRIMEIRA linha de toda rota
  `/api/cron/*` (não em `proxy.ts` — ver §3), somado à regra de WAF que bloqueia
  esse caminho vindo da internet pública.
- **Idempotência e deduplicação:** cada execução de ingestão deve gerar um hash
  estável (ex. URL canônica da fonte + título normalizado) para evitar publicar
  a mesma notícia duas vezes entre execuções de polling.
- **Cache (modelo Cache Components):**
  - Marcar funções de leitura de dados (home, listagem por categoria, artigo)
    com `"use cache"` + `cacheLife()` configurado por tipo de conteúdo (ex.
    perfil mais curto para a home, mais longo para artigos antigos).
  - Ao inserir uma notícia nova via cron, invalidar explicitamente as tags
    afetadas (`revalidateTag('home-feed')`, `revalidateTag('category-<slug>')`)
    — o antigo padrão de `revalidate` numérico em `fetch` está obsoleto sob
    Cache Components; não misturar os dois modelos.
  - Preferir `updateTag()` quando a própria Server Action/rota de ingestão
    precisa refletir o dado atualizado imediatamente na mesma requisição;
    `revalidateTag()` para marcar como stale e regenerar na próxima leitura.
- **Confiabilidade da automação:** cada execução de cron deve logar
  estruturadamente (quantidade de itens processados, novos, duplicados, falhas)
  e reportar erro para uma ferramenta de observabilidade (ver seção 8) — falha
  silenciosa de ingestão é o pior cenário para um portal de notícias.

## 5. Padrões de SEO e Metadados (Crucial para Portais de Notícias)

- **`generateMetadata`:** metadados dinâmicos rigorosos em
  `src/app/noticia/[slug]/page.tsx` (lembrando que `params` é `Promise` no Next
  16 — sempre `await`).
- **Open Graph e Twitter Cards:** título, descrição e imagem de destaque
  mapeados corretamente para compartilhamento em redes sociais.
- **Rich Snippets (JSON-LD):** componentizar a injeção de schema
  `NewsArticle`/`Article`, incluindo `datePublished`, `dateModified`, entidade
  `author` e `publisher` com logo — necessário para elegibilidade a rich
  results.
- **Sitemaps:**
  - `app/sitemap.ts` padrão para o site inteiro.
  - **Sitemap de Google News dedicado** (`<news:news>`), respeitando a janela de
    48h e o limite de até 1.000 URLs por arquivo exigidos pelo Google News
    Publisher Center — isso é distinto do sitemap geral.
  - `app/robots.ts` liberando os sitemaps e bloqueando rotas administrativas.
- **Feed próprio:** expor RSS/Atom (`app/feed.xml/route.ts`) para os leitores do
  portal — não confundir com os feeds das fontes que estão sendo consumidas.
- **Imagens:** sempre `next/image`, com `priority` na imagem LCP de cada página
  de artigo e dimensões explícitas para evitar CLS.

## 6. Ingestão de Conteúdo — Ética, Legal e Qualidade Editorial

- **Respeitar `robots.txt`** e limites de taxa das fontes; identificar-se com um
  `User-Agent` próprio e nunca sobrecarregar os sites de origem.
- **Nunca republicar o texto integral** de uma fonte — Traduzir,adaptar e sempre
  linkar de volta ao artigo original com atribuição clara. Isso protege contra
  risco legal de direitos autorais e contra penalização de conteúdo duplicado no
  Google - FAÇA DE FORMA A NÃO SER PUNIDO PELO GOOGLE E A LGPD E SEM QUE O
  CONTEÚDO FIQUER "SEM GRAÇA".
- **Rastrear proveniência no schema do banco:** `sourceUrl`, `sourceName`,
  `fetchedAt` em cada registro de notícia, para auditoria e para exibir "Fonte:
  X" no front-end.
- **Fila de revisão editorial (opcional, recomendado):** dado o tema religioso,
  considerar um passo de aprovação manual no painel `(admin)` antes da
  publicação automática, especialmente para conteúdo doutrinário sensível.

## 7. Observabilidade e Confiabilidade

- Logar cada execução de cron/ingestão (sucesso, falhas, duração, contagem de
  itens) de forma estruturada.
- Integrar rastreamento de erros (ex. Sentry) para falhas de scraping/parsing.
- Expor um health-check simples para monitorar se a automação está rodando no
  intervalo esperado; alertar em caso de falhas consecutivas.

## 8. Regras de Escrita de Código para o Claude

- Escreva código modular: funções longas devem ser divididas em utilitários
  menores.
- Evite `any` em TypeScript sob qualquer circunstância. Crie interfaces para as
  respostas de APIs (ex: parsers de RSS ou JSONs raspados).
- Valide variáveis de ambiente com `zod` (ou `@t3-oss/env-nextjs`) em vez de
  acessar `process.env` diretamente sem checagem de tipo/presença.
- Não crie classes CSS personalizadas a menos que seja estritamente impossível
  resolver com Tailwind.
- Ao sugerir pacotes npm para automação, priorize bibliotecas leves e
  **compatíveis com o runtime de destino**: se a ingestão rodar em Cloudflare
  Workers, bibliotecas como `cheerio` dependem de APIs Node que só funcionam com
  a flag `nodejs_compat` (ou não funcionam) — prefira alternativas compatíveis
  com Workers (ex. `linkedom`, `htmlparser2`) ou rode a ingestão como função
  Node dedicada, conforme o que o adapter OpenNext permitir.

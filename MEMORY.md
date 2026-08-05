# MEMORY.md — Minuto Eclesiástico

> Estado vivo do projeto. Atualizado ao fim de **cada tarefa concluída**.
> Se o contexto acabar no meio de algo, o "Próximo passo exato" no fim deste
> arquivo é onde retomar.

**Última atualização:** 2026-08-04 — SEO, segurança, performance e prontidão
Adcash (§2.9–2.10). Publicidade SUSPENSA até haver zonas de banner e consentimento
ligado.

---

## 1. Tarefas

| # | Tarefa | Status |
|---|---|---|
| 0.0 | Investigação de fontes (RSS, robots.txt, calendário litúrgico) | `done` |
| 0.1 | Plano escrito e aprovado pelo usuário | `done` |
| 0.2 | `MEMORY.md` inicial | `done` |
| 0.3 | Scaffold Next.js 16.2 (App Router, TS 5.x, Tailwind 4, `src/`) | `done` |
| 0.4 | `next.config.ts` (`cacheComponents`) + OpenNext/Wrangler (D1, R2, AI) | `done` |
| 0.5 | Schema Drizzle + primeira migration | `done` |
| 0.6 | `src/lib/env.ts` (zod) + autorização de cron | `done` (o `proxy.ts` foi descartado — ver §2b) |
| 0.7 | Tokens `oklch` do design → `globals.css` (`@theme`) | `done` |
| 1.A | Design importado → React/Next (dados mockados) | `done` (com débito de fidelidade — ver §2e) |
| 1.B | Ingestão + dedupe + `robots.txt` + logging | `pending` |
| 1.C | Adaptação PT-BR + glossário católico + guard-rails | `done` |
| 1.D | SEO (metadata, JSON-LD, sitemaps, feed) + parser do calendário 1962 | `done` |
| 2.0 | Integração: design + D1 real + SEO, cache tags, health-check | `pending` |

---

## 2. Decisões e por quê

### 2.1 Identidade
- **Nome = "Minuto Eclesiástico"** (com acento). Confirmado pelo próprio arquivo de
  design: aparece no header, no masthead `<h1>`, no footer e no `© 2026`. O projeto
  no Claude Design se chama "Boa Nova", mas isso é só o nome do arquivo lá — não é
  branding. Propagar para domínio, JSON-LD `publisher`, OG e README.

### 2.2 Fontes de conteúdo (verificado ao vivo em 2026-07-27)

| Fonte | Feed | O que traz | O que falta |
|---|---|---|---|
| **EWTN News** | `https://www.ewtnnews.com/rss` | RSS 2.0, 50 itens, `content:encoded` (texto integral), `media:content` (imagem + `media:credit` + `media:description`), `dc:creator`, `category` (`World`/`Vatican`), `pubDate`, `guid` permalink | — |
| **Sign of the Cross** | `https://www.signofthecrossmedia.com/feed/` | WordPress 6.9.5, 25 itens, `description` (excerpt 146–645 chars), `category`, `pubDate` | **Sem `content:encoded` e sem imagem.** WP REST API dá 401. Imagem/contexto exigem ler `og:image` / `og:description` da página do artigo |

- O EWTN **não** expõe `<link rel="alternate">` na home (é SPA) — o feed só foi
  encontrado sondando paths. Registrar para quem for revisitar: não adianta procurar
  no HTML.
- O EWTN declara `<ttl>15</ttl>`. **É a própria fonte sugerindo polling de 15 min** —
  usamos isso como justificativa da cadência escolhida.

### 2.3 `robots.txt` — risco aceito conscientemente

| Fonte | `User-agent: *` | Bloqueia por nome | Content-Signal |
|---|---|---|---|
| Sign of the Cross | só `/wp-admin/` | `ClaudeBot`, `Claude-Web`, `anthropic-ai`, `GPTBot`, `CCBot`, `Google-Extended`, `PerplexityBot`, `ChatGPT-User` | — |
| EWTN News | `Allow: /` | `ClaudeBot`, `GPTBot`, `CCBot`, `Google-Extended`, `Amazonbot` | `search=yes, ai-train=no, use=reference` |
| Salve Maria | `Disallow:` (vazio = libera tudo) | nenhum | — |

- **EWTN:** `use=reference` concede explicitamente o nosso caso de uso. Não treinamos
  modelo, então `ai-train=no` não nos atinge. Base sólida.
- **Sign of the Cross:** bloqueia crawlers de IA nominalmente, sem emitir content
  signal. Nosso bot não é nenhum dos bloqueados e a regra `*` nos permite — mas a
  **intenção declarada é contrária**. O usuário optou por prosseguir com UA próprio.
  → **Risco reputacional aceito conscientemente.** Mitigação: a fonte fica atrás da
  flag `SOURCE_SOTC_ENABLED`, desligável em um commit.
- UA a usar: `MinutoEclesiasticoBot/1.0 (+https://<domínio>/bot)`.

### 2.4 Formato do conteúdo publicado
**Matéria adaptada, ~40–50% do original.** 3–5 parágrafos originais em PT-BR,
reescritos — não traduzidos literalmente. Nunca texto integral (`CLAUDE.md` §6).
Bloco "Fonte: X" + link canônico obrigatórios. Protege de direito autoral e de
penalização por conteúdo duplicado.

### 2.9 🔴🔴 O SITE PUBLICAVA UMA DECLARAÇÃO FALSA (04/08)

`/privacidade` afirmava por escrito, em página indexável, que o site **não usava
cookies de rastreamento nem publicidade comportamental** e que **não havia
rastreador de terceiro** — enquanto o `aclib` da Adcash rodava no `<head>` de
TODAS as páginas, **inclusive na própria página de privacidade**.

A lista `TRATAMENTOS` errava nas **duas direções ao mesmo tempo**: declarava
`Cloudflare Web Analytics` (nunca instalado) e `Cloudflare Workers AI` (trocado
por NVIDIA em `c8a7c53`), e **omitia a Adcash**.

**Regra que passa a valer:** `TRATAMENTOS` é declaração jurídica, não
documentação. Mexeu em provider, analytics ou anúncio ⇒ mexe nela **no mesmo
commit**. O interruptor `PUBLICIDADE_ATIVA` existe para que texto legal e
comportamento não possam divergir.

### 2.9b `runAutoTag` é pop-under com anti-adblock — descartado (04/08)

Verificado na documentação da Adcash: `aclib.runAutoTag` é o pacote **4-em-1**
— Pop-Under, In-Page Push, Interstitial e Video Slider — **com anti-adblock**.
Havia DUAS zonas no mesmo documento (`pcewqvqovo`, `xlwsd0rw7w`), o que dispara
dois pop-unders por sessão: configuração errada, não estratégia.

Isso compete diretamente com a meta nº 1 do `CLAUDE.md` §1:
- pop-under e intersticial estão na lista de menos preferidos do **Coalition for
  Better Ads** — o Chrome filtra anúncios de sites reincidentes;
- intersticial intrusivo é fator de **rebaixamento no Google mobile**;
- as políticas do **Google News Publisher Center** restringem anúncio intrusivo.

**Decisão do usuário: banner/native com slot dimensionado.** Buscar aprovação no
Google News *e* rodar pop-under são objetivos mutuamente hostis.

⚠️ As zonas antigas não servem — banner exige zonas novas no painel da Adcash, e
a chamada passa a ser `aclib.runBanner`.

**Desfecho (04/08).** O painel da Adcash chama o formato de **Display**, não de
"Banner" — foi por isso que ele não foi encontrado de primeira, e no meio do
caminho chegou a ser criada uma zona Pop-Under (`11907602`) como substituto.
Ela e a AutoTag (`si5mdwejfc`) **não são usadas e devem ser apagadas**: AutoTag
já contém pop-under, então rodar as duas juntas serve dois pop-unders por
sessão sem capping compartilhado — o mesmo defeito das duas zonas originais, em
forma nova.

Zonas de display em uso: **`11907650` (728×90)** e **`11907658` (300×250)**.

### 2.9b′ 🐛 A publicidade quebraria em navegação client-side (04/08)

Encontrado ao ligar as zonas, antes de ir a produção. O `ConsentGate` mora em
`src/app/(site)/layout.tsx` e **não desmonta ao navegar** — em navegação
client-side o `<Script>` continua montado e o `onReady` não dispara de novo.
Com a lista de zonas centralizada no gate, `runBanner` rodaria **uma vez só**,
para os slots existentes na primeira página carregada; todo slot alcançado por
navegação ficaria vazio para sempre. Em SPA isso é a maioria das
visualizações.

Inversão adotada: o carregador (`ads/adcash.tsx`) só avisa que a biblioteca
chegou (`ads/aclib.ts`, `useSyncExternalStore` como no consent-store), e **cada
slot ativa a própria zona ao montar** (`ads/ad-zone.tsx`). O `AdSlot` continua
Server Component — só a folha que não desenha pixel é cliente (CLAUDE.md §3).

Três decisões que parecem detalhe e não são:

1. **`zoneId`, altura e breakpoint moram no mesmo objeto** (`ads/zonas.ts`).
   Separados, divergem: trocar o `zoneId` de um slot por zona de outro tamanho
   corta o criativo, e nenhum teste pega.
2. **A faixa 728×90 é `hidden md:flex`, e o JS repete a mesma media query.**
   Rodar `runBanner` dentro de contêiner `display:none` gera impressão não
   visível — tráfego inválido para a rede. CSS e JS não podem discordar.
3. **O espaço é reservado mesmo sem consentimento.** Mostrar o bloco só após o
   opt-in pareceria mais elegante e seria pior: quem já aceitou numa visita
   anterior veria o bloco surgir depois da hidratação, longe de qualquer
   clique, e isso conta inteiro no CLS.

### 2.9c Consentimento: opt-in uniforme, e o motivo é TÉCNICO (04/08)

Modelo escolhido: opt-in para todos, Brasil e exterior. A alternativa geo-aware
(opt-in só na UE) daria mais receita, mas exige ler `cf-ipcountry` no servidor —
o que **personaliza o HTML e inviabiliza cachear a página na borda**, a maior
alavanca de performance disponível. Com opt-in uniforme o HTML é idêntico para
todo mundo e a decisão vive 100% no cliente.

Implementação: `src/lib/consent.ts` (zod sobre o `localStorage` — CLAUDE.md §8
vale para tudo que é desserializado, não só env; valor ilegível ⇒ "pendente" ⇒
não carrega anúncio), `consent-store.ts` com `useSyncExternalStore` (Context
obrigaria a tornar o layout cliente e mataria o PPR), banner `fixed` (em fluxo
normal empurraria conteúdo = CLS) e `Adcash` por `next/script` com
`strategy="afterInteractive"` e `runBanner` no `onReady` — nunca `<script>`
inline, pela lição do §5c.

### 2.9d 🐛 PPR: `notFound()` dentro de `<Suspense>` não muda o status (04/08)

`/noticias?pagina=99`, num arquivo de 4 páginas, devolvia **200 + conteúdo da
última página + canônica auto-referente `?pagina=99`** — família infinita de
URLs indexáveis, armadilha de rastreamento clássica.

Pôr `notFound()` no corpo **não resolveu**, e a causa é o PPR: a casca sai com
status 200 **antes** de o `<Suspense>` resolver, então quando o `notFound()`
dispara o cabeçalho já foi enviado. Verificado em produção: o corpo mostrava o
404 e o status continuava 200.

**O sinal tem de sair em `generateMetadata`**, que roda antes do streaming.
`listarPaginado` é `"use cache"`, então consultar de lá não quebra o PPR nem
custa segunda ida ao banco — é a mesma chave de cache do corpo. Confirmado em
produção: `?pagina=99` → `noindex, follow`; `?pagina=2` → canônica normal.

**Vale para qualquer página com PPR:** decisão que precisa virar status HTTP ou
meta tag não pode morar dentro de `<Suspense>`.

### 2.9e Canônica `localhost` em produção — e por que o `warn` não bastou (04/08)

As cinco institucionais foram a produção com
`<link rel="canonical" href="http://localhost:3000/sobre">`. Canônica apontando
para localhost manda o Google **desindexar a URL real**.

Causa: são prerenderizadas no build, e `getSiteUrlSync()` lê
`process.env.SITE_URL`, que só existe em runtime (`vars` do `wrangler.jsonc`).

Conserto: `.env.production` versionado na raiz. **E `getSiteUrlSync` passou a
LANÇAR** quando `NODE_ENV === "production"` — já havia um `console.warn` ali, e
o defeito chegou ao ar assim mesmo. Aviso em log de build não é lido por
ninguém; build que produz canônica errada tem de quebrar.

### 2.9f 🐛 O Drizzle 0.45 esconde a causa em `cause` — desambiguação de slug morta (05/08)

`gravacao_falhou` a cada 15 min, na cadência exata do cron de ingestão. Matéria
da SOTC nunca entrava, e a origem continua publicando, então repetia para sempre.

Cadeia completa:

1. A fonte trocou a URL do artigo (`…tailor-returning…` → o `source_guid` ainda
   diz `…tailor-says-returning…`). URL canônica nova ⇒ **`dedupe_hash` novo**.
2. `ON CONFLICT (dedupe_hash) DO NOTHING` não dispara — o hash é outro.
3. Mas o **slug vem do título**, que não mudou ⇒ viola `articles_slug_idx`.
4. `ehColisaoDeSlug` deveria capturar e reinserir com sufixo (é o que o
   cabeçalho de `dedupe.ts` descreve). **Não capturava.**

O motivo do passo 4 é a armadilha que vale guardar: **o Drizzle 0.45 embrulha o
erro do driver num `DrizzleQueryError` cuja `.message` é `"Failed query: <SQL>
params: <…>"`.** O texto do SQLite (`UNIQUE constraint failed: articles.slug`)
existe **só em `.cause`**. O detector testava `.message` contra
`/unique constraint failed/` — sempre falso. E o segundo teste, `/slug/`, dava
**verdadeiro pelo motivo errado**: "slug" aparece na lista de colunas do SQL
embrulhado.

⚠️ Ao consertar, os dois termos têm de casar na **mesma** mensagem da cadeia, e
o nome da coluna tem de ser qualificado (`articles.slug`). Concatenar a cadeia
antes de testar reintroduz o bug ao contrário: violação de `dedupe_hash` seria
lida como colisão de slug e **duplicaria matéria já publicada**.

**⚠️ Consertar só o detector NÃO bastava, e por pouco não virou defeito pior.**
Com a desambiguação viva, o item entraria com slug sufixado — ou seja, **a mesma
notícia publicada duas vezes, em URLs diferentes**. Conteúdo duplicado é
justamente o que o CLAUDE.md §6 manda evitar. Confirmado no D1 remoto: existe
uma linha com a URL antiga (`…tailor-says-returning…`) e o mesmo slug que o item
novo (`…tailor-returning…`) tentava usar.

Desenho final: no `catch`, **antes** de desambiguar, `adotarUrlNova()` verifica
se a linha que ocupa o slug tem **a mesma fonte e o mesmo título**. Se tem, é a
mesma matéria com endereço novo ⇒ atualiza a proveniência da linha existente
(`dedupeHash`, `sourceUrl`, `sourceGuid`) e devolve `"atualizado"`. O `slug` não
muda: a matéria pode estar publicada nele, e trocá-lo quebraria links e a
canônica que o Google já conhece.

O teste de título não é redundante com a colisão de slug — `gerarSlug` remove
acento e pontuação, então dois títulos diferentes da mesma fonte podem normalizar
para o mesmo slug. Aí são matérias distintas e o sufixo é a resposta certa.

**Lição de observabilidade, que custou a investigação inteira:** o log gravava
`erro.message`, ou seja, o embrulho — SQL inteiro, parâmetros inteiros, zero
pista da falha real. Diagnosticar exigiu ler o código em vez do log. `gravarItens`
agora emite `causa` (fim da cadeia) além de `erro`, ambos com `slice(0, 300)`.
Ao capturar erro de banco neste projeto, **sempre percorra `cause`**.

### 2.9g ⚠️ ABERTO: 5xx intermitente sob carga, ainda sem causa (05/08)

Medido em produção: **7% a 17% das requisições** falham quando há rajada — 500,
503 e streams que entregam a casca e nunca fecham. Atinge `/privacidade` e
`/termos`, que são pré-renderizadas e **não tocam o D1**, na mesma proporção de
`/feed.xml`. Assets nunca falham (`5xx 0` no painel).

Já descartado: não é D1, não é user-agent (Googlebot, Bingbot e curl iguais),
não é rota específica, não é CPU (226 ms de CPU contra 15 s de wall time).
**Não são os erros de `level=error`** — em hora ociosa o filtro mostra só 4
eventos, todos do cron da §2.9f.

Hipótese não testada: contenção com o cron de adaptação, que gasta ~15 s de wall
time esperando a NVIDIA. Teste que decide: rajada atravessando os minutos
`:00/:15/:30/:45` e ver se as falhas se agrupam ali.

Reproduz com `for i in $(seq 1 40); do curl -s -o /dev/null -w "%{http_code} "
--max-time 10 https://minutocatolico.com.br/feed.xml; done`.

**Por que importa:** o Googlebot reduz taxa de rastreamento ao encontrar 5xx, e
rastrear um sitemap de 104 URLs é exatamente uma rajada.

### 2.5b 🔴 A CAPA FICOU SEM LITURGIA — causa raiz achada em 03/08/2026

**Sintoma:** os cartões "Liturgia de hoje" e "Santo do dia" sumiram da capa.
Parecia funcionalidade removida; não era. `/api/health` dizia `temHoje: false`.

**Causa:** a página `/calendario/` do Salve Maria **cresce mês a mês** e em 03/08
ainda tinha só 7 tabelas (Jan–Jul) — verificado ao vivo, a última linha é
`31 de Julho`. Sem linha para hoje, `LiturgyPanel` fazia `return null` e a coluna
inteira desaparecia.

**O que agravou (a parte que importa):** o cron da liturgia era **mensal**
(`0 7 1 * *`). Rodou em 1º de agosto, não achou agosto, e o próximo disparo só
viria em 1º de setembro — ou seja, **um mês inteiro sem liturgia por causa de um
atraso de publicação de poucos dias na fonte**.

**Consertos aplicados:**
1. Cron **diário** (`0 7 * * *`). Repõe o mês em até 24h de a fonte publicar. Um
   GET de ~170 KB/dia é ruído estatístico para um WordPress. Isso também torna
   desnecessária a antiga rede de segurança de 10/jan.
2. `ResultadoExecucao` ganhou `ultimoDiaCoberto` e `diasDeFolga`. **A métrica que
   faltava:** a execução só reportava "quantos dias vi e gravei" — números que
   ficaram ótimos no dia em que o site perdeu o painel, porque reraspar Jan–Jul
   com sucesso conta como 212 dias atualizados. Ninguém media **até quando o
   calendário vai**. Folga < 7 dias vira `liturgia_sem_folga` em `console.error`.
3. `/api/health` expõe `liturgia.folgaDias` e acusa **antes** de acabar.
4. `LiturgyPanel` não some mais: sem dado, mostra a data de hoje e diz até quando
   a fonte publicou. **Nada é deduzido** — ver a regra de não-invenção abaixo.

**Fontes alternativas testadas e DESCARTADAS (não repetir):**
- `divinumofficium.com`: robots.txt permite, mas o Cloudflare deles devolve **403
  ao nosso UA honesto** e só responde a UA de navegador. Forjar UA violaria
  `CLAUDE.md` §6. Descartado.
- API do Missale Meum: **continua 404** (`/api/v5/{en,pl,pt}/date/…`,
  `/calendar/…`). Confirma §2.5. As páginas HTML respondem, mas o conteúdo vem por
  RSC no cliente e **não há locale PT**. Descartado.
- `salvemaria.com.br/calendario-2026`: **404**. Só existe `/calendario/` para o ano
  corrente; anos passados têm URL própria. Não há páginas mensais.

**Regra que não muda:** liturgia não se inventa. Em especial, **não derivar agosto
de 2026 do calendário de 2025**: o santoral é fixo por data, mas o temporal não —
03/08/2025 caiu num domingo (propers do domingo, santo vira comemoração) e
03/08/2026 é segunda. Transferir ano parece plausível e produz liturgia falsa.

### 2.5 Liturgia — calendário tradicional de 1962
- **Decisão do usuário:** calendário e santoral segundo o **missal de 1962** (missa
  tridentina), não o Novus Ordo.
- **Fonte escolhida:** `https://salvemaria.com.br/calendario/` — página WordPress
  server-rendered com **tabelas HTML estáticas**, uma por mês, em PT-BR, com:
  data + dia da semana · festa + comemoração + classe · santo congregado mariano ·
  cor · Glória/Credo · prefácio · **Epístola • Evangelho**.
  URLs anuais estáveis: `/calendario/`, `/calendario-2025`, `/calendario-2024`, `/calendario-2023`.
- **Estratégia:** raspar **1× por ano** (não por requisição) → ~365 linhas em D1.
  Zero dependência em runtime; se a página cair, a home não cai junto.
- **Descartado: API do Missale Meum.** Testei 7 variações de path
  (`/api/v5/en/calendar`, `/api/v5/en/date/…`, `/api/v6/…`, etc.) — **todas 404**.
  A API pública parece ter saído do ar. Não perder tempo tentando de novo.

### 2.6 Modelo de linguagem — gratuito

**⚠️ SUPERSEDIDO EM 03/08/2026 — o padrão agora é NVIDIA NIM. Ver §2.6b.**

- **Não existe modelo gratuito na API da Anthropic.** O usuário pediu gratuito.
- **Escolha original: Cloudflare Workers AI** (binding `env.AI`). Coerente porque o
  alvo de deploy já é Cloudflare Workers: sem API key, sem egress, sem cartão.
  10.000 Neurons/dia grátis, reset 00:00 UTC, depois US$0,011/1k.
- **Trade-off registrado:** um modelo aberto classe 8B adaptando notícia doutrinária
  EN→PT-BR erra terminologia e inventa detalhe bem mais que um modelo de fronteira.
  Glossário + guard-rails reduzem, não eliminam. O `CLAUDE.md` §1 exige precisão
  factual como requisito de produto — **essa tensão é real e está sendo assumida
  com os olhos abertos.**
- **Mitigação de engenharia:** camada atrás da interface `TranslationProvider`.
  **Foi esta decisão que salvou a migração de §2.6b**: trocar o provider inteiro
  não tocou `guardrails.ts`, `glossary.ts`, `prompt.ts` nem `adapt.ts`.
- **Postura de falha:** quota do dia esgotada ⇒ item vira `draft`, **nunca** publica
  sem adaptação; o cron seguinte reprocessa a fila.

### 2.6b Migração para NVIDIA NIM (03/08/2026) — provider padrão atual

**Motivo:** não é preço (os dois são gratuitos), é **disponibilidade**. A cota do
Workers AI é de 10.000 Neurons/dia e cada artigo custa DUAS chamadas carregando o
glossário. Medido em §5a: ~34 artigos/dia contra ~75 que as fontes produzem — a
fila **nascia represada**, o lote abortava por `quota` e os artigos ficavam presos
em `draft` até o reset das 00:00 UTC. Era essa a causa do relato do usuário de que
"a automação às vezes não funciona": não era bug, era teto de cota batendo todo dia.

- **Endpoint:** `https://integrate.api.nvidia.com/v1/chat/completions`,
  OpenAI-compatível. Auth `Bearer nvapi-...`.
- **Free tier:** NVIDIA Developer Program, ~40 req/min **por modelo**, mais um
  saldo inicial de créditos. Limite por REQUISIÇÃO, não por orçamento de compute
  que o glossário consome desproporcionalmente. Com lote de 5 a cada 15 min são
  10 chamadas/execução — duas ordens de grandeza abaixo do teto.
- **Modelos (verificados em `GET /v1/models`, 03/08/2026):**
  adaptação `nvidia/nemotron-3-super-120b-a12b` (o modelo próprio da NVIDIA, MoE
  120B/12B ativos); verificação `meta/llama-3.3-70b-instruct`.
- **🔑 GANHO ESTRUTURAL — juiz ≠ réu.** O aviso de `VerificacaoFactual` dizia que a
  checagem factual era feita pelo MESMO modelo que escreveu o texto, "limitação
  estrutural" porque no Workers AI não havia segundo modelo de qualidade
  equivalente de graça. Com a NVIDIA **essa limitação deixou de existir**: escreve
  um Nemotron, audita um Llama — famílias e dados de treino diferentes. **Se alguém
  apontar `NVIDIA_VERIFY_MODEL` para um Nemotron, essa garantia some em silêncio.**
- **Não mandar campo fora do contrato OpenAI.** Nada de `response_format` nem
  `chat_template_kwargs`. A lição está em §5a/`workers-ai.ts`: mandar
  `response_format` para modelo que não suporta fez a API **rejeitar a requisição
  inteira** (erro 5025) e o sintoma chegou disfarçado de "incapacidade do modelo".
- **Modelos de raciocínio:** os Nemotron podem emitir `<think>…</think>` inline.
  `limparRaciocinio()` descarta antes do parsing — **obrigatório**. O perigo é
  específico: os marcadores são procurados com `^` + flag `m`, então menção no
  meio da frase é inofensiva; o que estraga é o modelo **rascunhar a resposta
  inteira dentro do `<think>` com o marcador em início de linha** (é o que
  modelos de raciocínio fazem antes de responder) — o parser acha o rascunho
  primeiro. **Verificado nos dois caminhos:** na adaptação o título de ensaio é
  publicado no lugar do final; na verificação um `VEREDITO: DIVERGENTE` ensaiado
  com lista de divergências reprova artigo que o veredito final aprovava.
  Bloco `<think>` sem fechar (teto de tokens estourado) ⇒ string vazia ⇒
  `resposta_invalida`, falha fechada. `max_tokens` da adaptação subiu para 8000
  porque o raciocínio sai do mesmo teto que a resposta.
- **Contrato do endpoint conferido ao vivo (03/08):** o payload exato que o
  provider envia é aceito; sem header → **401**, chave inválida → **403**. Os
  dois viram `desativado`, que aborta o lote com mensagem acionável em vez de
  queimar a fila item a item.
- **🔴 RACIOCÍNIO PRECISA FICAR DESLIGADO — medido em produção (03/08).**
  Primeiras 3 adaptações reais com o Nemotron 3 Super: 1 parseou com
  `tokens_out: 4629` (para um corpo de ~950 tokens — ~3.500 gastos pensando) e
  **2 vieram inparseáveis** (`resposta_invalida`, ~54s cada, tokens não
  contabilizados porque o caminho de erro não carrega `usage`). Raciocínio sai
  do MESMO teto de `max_tokens` que a resposta: se ele se estende, a resposta
  trunca, o `<think>` nunca fecha e sobra string vazia. Além disso, modelo
  raciocinando tende a "explicar" em vez de emitir o formato de blocos exato.
  **Nada neste pipeline exige raciocínio** — o trabalho é reescrever seguindo
  gabarito, não resolver problema.
  - **Mecanismo:** `"chat_template_kwargs": {"enable_thinking": false}` como
    campo de topo do corpo (é o `extra_body` do SDK OpenAI). Só é enviado para
    modelos cujo id casa `/nemotron/i` — o verificador é um Llama da Meta, cujo
    chat template não conhece o campo.
  - **Rede de proteção obrigatória:** campo fora do contrato OpenAI pode fazer a
    API rejeitar a requisição inteira (lição do erro 5025 do Workers AI). Se
    vier 400 citando o campo, `SEM_SUPORTE_A_EXTRAS` memoriza o modelo por
    isolate e refaz a chamada sem ele — em vez de perder uma requisição por
    artigo, para sempre.
  - **Bônus:** corta o token de saída, esticando os créditos gratuitos.
  - **✅ CONFIRMADO EM PRODUÇÃO (03/08).** `tokens_out` caiu de **4629** para
    **861 / 416 / 903** em três execuções — ~5x. O campo foi aceito (o latch de
    fallback não disparou) e **a primeira matéria foi publicada pelo Nemotron**:
    `/noticia/padre-catolico-e-morto-a-facadas-na-nigeria`. Qualidade boa —
    4 parágrafos, registro jornalístico sóbrio, terminologia correta
    ("sacerdote", "paróquia", "religiosos e leigos"), fatos atribuídos
    ("segundo o comunicado da diocese") e sem decalque do inglês.

### 2.6e 🔴🔴 BLOQUEIO DE CABEÇA DE FILA — o pior bug achado (03/08)

**Sintoma:** 4 execuções seguidas de `limite=1` processaram **o mesmo artigo**
(`tokensIn: 3791` idêntico nas quatro) e o adiaram todas as vezes. A fila tinha
96 itens e nenhum outro era tocado. Explica a fila parada em ~96 apesar do cron
rodar de 15 em 15 minutos.

**Causa — duas decisões que, isoladas, pareciam certas:**
1. A consulta de pendentes ordena por `published_at DESC` ("notícia nova vale
   mais").
2. O caminho de adiamento **não gravava nada**, com o comentário explícito de que
   escrever `adapted_at` "mentiria dizendo que houve adaptação".

Juntas: o item mais recente que sempre falha é reescolhido para sempre.

**A justificativa do item 2 não se sustentava** — o caminho de
`failed_validation` logo abaixo já gravava `adapted_at` sem adaptação
bem-sucedida. A coluna sempre significou "quando a adaptação rodou pela última
vez", não "quando deu certo".

**Conserto:** os dois caminhos de adiamento gravam `adapted_at`, e a consulta
pula quem tem `adapted_at` recente (`COOLDOWN_ADIAMENTO_S`, 30 min = 2 ciclos do
cron). Rascunho nunca processado tem `adapted_at` null e entra na hora, então
notícia nova não é atrasada.

**Lição:** todo item de fila que pode falhar precisa registrar a TENTATIVA, não
só o resultado. Sem isso, ordenação determinística + falha determinística = fila
travada em silêncio.

### 2.6f 🐛 VEREDITO BOM SENDO DESCARTADO — e por que o parser mentia (03/08)

O checador respondeu, textualmente:

```json
{ "VEREDITO": "CONSISTENTE", "DIVERGENCIAS": [] }
```

Veredito **perfeito** — e o artigo foi adiado assim mesmo, para sempre, porque a
falha era determinística. Duas barreiras ao mesmo tempo:

1. `parsearVeredito` ancora em `^` e só tolerava `[*_\s>#-]` antes do marcador.
   A linha do JSON começa com `"`.
2. O fallback de JSON exige as chaves minúsculas `consistente`/`divergencias`.
   O modelo usou o vocabulário do PRÓPRIO prompt (`VEREDITO`, `DIVERGENCIAS`),
   em caixa alta.

**Lição que vale para todo parser de saída de modelo aqui:** o modelo MISTURA os
formatos que você mostrou a ele. Se o prompt fala em `VEREDITO`, ele usa
`VEREDITO` — inclusive dentro de JSON que você não pediu. Tolerar a forma sem
afrouxar o conteúdo: valor não reconhecido continua reprovando.

**Como isto só apareceu:** o adiamento não gravava nada no banco, e a captura de
`wrangler tail` ao vivo não trouxe nada (tentada duas vezes). Foi preciso gravar
o motivo do adiamento em `validation_errors` com prefixo `adiado/` — os dois
caminhos de adiamento gravam, e a linha segue `draft`, invisível no site.

### 2.6g Adiamentos que SOBRAM são da NVIDIA, não nossos (03/08)

Com o parser consertado, as causas restantes de adiamento são todas de
infraestrutura da fonte:

```
adiado/indisponivel: HTTP 524: error code: 524                       (×4)
adiado/indisponivel: HTTP 503: ResourceExhausted:
                     Worker local total request limit reached (18/16) (×1)
```

O 503 é o NIM dizendo que a instância do modelo está saturada — congestão do
tier gratuito. **Atenção ao medir:** essa taxa foi observada disparando 8
execuções em sequência; o cron real faz 5 itens a cada 15 min. Parte da
saturação foi carga do próprio teste.

Classificação está certa: 524/503 ⇒ `indisponivel` ⇒ transitório ⇒ o artigo
continua `draft` e volta na fila depois do cooldown. **Não** acrescentar retry
imediato aqui — insistir em serviço saturado piora a saturação; recuar e deixar
o próximo cron pegar é o comportamento correto.

### 2.6c Rendimento da fila — medido em 03/08 (o gargalo NÃO é o modelo)

Consulta a `validation_errors` dos reprovados recentes. A distribuição importa
mais que o total, porque cada causa pede uma ação diferente:

| Causa | Ocorrências | Natureza |
|---|---|---|
| `pre_voo` (original curto demais) | 3 de 6 | **Dado**, não modelo |
| `proporcao` (adaptado passou de 60% do original) | 2 de 6 | Aderência do modelo |
| `verificacao_factual` (falso positivo) | 1 de 6 | Ruído do checador |

- **⚠️ CORREÇÃO: `pre_voo` NÃO é o gargalo.** A amostra de 6 acima enganou. Sobre
  a fila INTEIRA, **86 dos 93 rascunhos passam no pré-voo** (EWTN 62/66, SOTC
  24/27) — o EWTN traz `content:encoded` (corpo integral, média ~4.000 chars) e
  o SOTC já é enriquecido por `extrairCorpoArtigo()`. **Não há trabalho de
  ingestão a fazer aqui.** Lição de método: distribuição de amostra recente ≠
  distribuição da fila; conferir o agregado antes de propor obra.
- **`proporcao`:** o modelo escreve mais que o pedido. Medido: original de 1978
  chars → o prompt pediu 791–989 → o modelo entregou **1714** (86,7%, teto 60%).
  Outro: pedido ~770–962, entregue 1256 (65,3%). As janelas são viáveis; o
  modelo é que não obedece o alvo de comprimento.
- **`verificacao_factual`:** o checador apontou como divergência
  *"O Arcebispo Sample declarou que a SSPX está 'em cisma'" — o original dizia
  "Archbishop Sample has declared the SSPX 'in schism'"*. Isso é a tradução
  fazendo o trabalho dela. `ehRuidoDeTraducao`/`ehRuidoEstrutural` não pegaram
  porque "SSPX" vs "Society of Saint Pius X" conta como nome próprio diferente.

### 2.6d 🐛 Link de fonte aparece como Markdown CRU na página (PRÉ-EXISTENTE)

`montarCorpoFinal()` acrescenta `Fonte: [Nome](URL)` ao `body_md`, mas
`components/article/article-body.tsx` não renderiza link de Markdown — então a
página mostra literalmente `[EWTN News](https://...)`. **Não é regressão da
migração:** confirmado também em matéria publicada em 31/07, antes dela. Pior,
é redundante: `source-note.tsx` já exibe "Fonte:" logo abaixo, com link de
verdade. Conserto: ou renderizar link no corpo, ou parar de anexar o bloco (o
`source-note` já cumpre o requisito de atribuição visível do `CLAUDE.md` §6).
- **Diagnóstico de `resposta_invalida` agora vai para o banco.** As mensagens
  carregam `finish_reason`, chars brutos, chars após limpar raciocínio e um
  trecho de 180 chars — porque a causa só existia no log do Worker e chegar nela
  exigia `wrangler tail` no instante da falha. `finish_reason: "length"` é a
  assinatura de truncamento. Consulta útil:
  `SELECT slug, validation_errors FROM articles WHERE status='failed_validation' ORDER BY updated_at DESC LIMIT 5;`
- **Segredo:** `wrangler secret put NVIDIA_API_KEY`. Quem exige a chave é
  `criarProviderNvidia()`, que falha alto na subida do lote.
- **🔴 ARMADILHA JÁ PAGA (03/08) — não repetir:** a exigência da chave chegou a
  ser posta como checagem cruzada em `getValidatedEnv()` (`src/lib/env.ts`).
  **Derrubou `/api/cron/liturgy` com 500.** Motivo: `getValidatedEnv()` é usada
  por `getUserAgent()`, que a ingestão de notícias E a raspagem do calendário
  chamam — nenhuma das duas usa modelo. Um segredo do tradutor passou a derrubar
  o calendário de 1962, que é conteúdo próprio e não depende de IA. Regra:
  **validação global confere só o que é global**; exigência de credencial mora
  onde a credencial é usada. Pego testando a rota em produção, não pelo build.
- **Volta atrás:** `TRANSLATION_PROVIDER=workersAi` no `wrangler.jsonc`. O binding
  `AI` continua declarado exatamente por isso.

### 2.7 Automação — polling, não tempo real
Cron Triggers do Cloudflare a cada **15 min**, alinhado ao `<ttl>15</ttl>` do EWTN.
**Não é tempo real** — nenhuma das fontes expõe webhook/WebSub. Trade-off consciente
entre "quase tempo real" e custo zero.

### 2.8 Skills
`grill-me` tem `disable-model-invocation: true` e o corpo é só `Run a /grilling
session.` — é uma entrevista interativa para afiar um plano, **só invocável pelo
usuário** via slash command. Não se aplica a nenhuma etapa de implementação.
As outras quatro (`frontend-design`, `web-design-guidelines`,
`vercel-react-best-practices`, `ui-ux-pro-max`) valem para a Fase 1.A.

---

## 2b. Armadilhas encontradas na Fase 0 (não repetir)

Cada item abaixo custou uma investigação. Estão aqui para não custar de novo.

### `npm audit fix --force` DESTRÓI a stack — nunca rodar
São 13 vulnerabilidades reportadas, e **todos os 13 "fixes" são downgrades
semver-major**: `next 16.2.12 → 14.2.35`, `drizzle-kit 0.31.10 → 0.18.1`,
`@opennextjs/cloudflare 1.20.2 → 1.15.1`. Rebaixar o Next para a 14 destruiria
Cache Components, `proxy.ts` e a Build Adapters API — a arquitetura inteira que
o `CLAUDE.md` §2 exige. Todas são dependências de build/dev (postcss, sharp,
esbuild, glob) que não chegam ao runtime do Worker. **Decisão: conviver.**

### OpenNext não tem handler `scheduled` — por isso o worker agendador separado
O worker gerado (`node_modules/@opennextjs/cloudflare/dist/cli/templates/worker.js`)
exporta **apenas `fetch`**. Um Cron Trigger apontado para ele dispararia no vazio,
silenciosamente — o pior modo de falha possível para ingestão.
→ Solução: `workers/scheduler/`, Worker próprio com só `scheduled()`, que chama
`/api/cron/*` por HTTP com o `CRON_SECRET`. Desacoplado, sobrevive a upgrades do
OpenNext, e é exatamente o desenho do `CLAUDE.md` §4.

### `initOpenNextCloudflareForDev()` quebra o `next build`
O `next.config.ts` é avaliado também no build, e a chamada abre uma sessão de
proxy remoto. Pior: `remoteBindings` tem **default `true`**, exigindo
`CLOUDFLARE_API_TOKEN`. → Guardado por `NODE_ENV === "development"` e com
`remoteBindings: false`.

### Workers AI não tem inferência local
O wrangler avisa: *"AI bindings always access remote resources, and so may incur
usage charges even in local dev"*. Testar a adaptação PT-BR exige conta + token:
`CLOUDFLARE_API_TOKEN=... CF_REMOTE_BINDINGS=true npm run dev`.
**Consequência para a Fase 1.C:** não dá para validar a qualidade da tradução
sem credencial da Cloudflare. Planejar em torno disso.

### `process.env` não carrega os segredos no `proxy.ts`
Num Worker as vars chegam pelo binding do env. Em `next dev`, `process.env.CRON_SECRET`
vem `undefined` e o proxy falhava fechado (500 em tudo, inclusive token válido).
→ `proxy.ts` lê de `getCloudflareContext({async:true})` com `process.env` como reserva.
Verificado: 401 sem token, 401 com token errado, 404 com token certo (rota ainda não existe).

### `cacheComponents` é top-level no Next 16.2
`experimental.cacheComponents` está marcado `@deprecated` em
`node_modules/next/dist/server/config-shared.d.ts:728`. O válido é a chave
top-level (linha 1210). `cacheLife` também é top-level.

### Versões efetivamente instaladas
Next 16.2.12 · React 19.2.4 · TypeScript 5.9.3 · Tailwind 4.3.3 ·
drizzle-orm 0.45.2 · drizzle-kit 0.31.10 · @opennextjs/cloudflare 1.20.2 ·
wrangler 4.114.0 · zod 4.4.3 · fast-xml-parser 5.10.1 · htmlparser2 12.0.0.
Node do ambiente: v22.23.1 (requisito do Next 16 é 20.9+).

---

## 2c. Fase 1.C entregue — adaptação e guard-rails

**Modelo escolhido: `@cf/meta/llama-3.1-8b-instruct-fp8`.** Fonte: catálogo público
da Cloudflare cruzado com `AiModels` do `cloudflare-env.d.ts`. As variantes
`llama-3-8b-instruct`, `llama-3.1-8b-instruct` e `-awq` estão **DEPRECATED**.
Escolhida a `-fp8` por estar em `AiModels` (sobrecarga tipada — se a Cloudflare
remover o modelo, o **build quebra** em vez de o cron descobrir em produção).

> **Discrepância conhecida:** a doc de JSON mode lista `-fast` e
> `llama-3.1-8b-instruct`, **não** a `-fp8`. Nenhuma opção atende a tudo.
> O código manda `response_format` mesmo assim e **nunca confia nele**: há um
> `extrairJson()` que recupera JSON embrulhado em prosa ou cerca de código, e o
> que não virar objeto válido reprova como `resposta_invalida`.

**9 guard-rails**, todos executados (não param na primeira falha):
`comprimento` · `proporcao` · `atribuicao` · `numeros` · `verificacao_factual` ·
`idioma` · `recusa_do_modelo` · `rito_1962` · `glossario`.

Três decisões de projeto que merecem registro:
- **`numeros` checa a direção INVERSA da ingênua.** Não exige que todo número do
  original apareça no adaptado — a matéria tem 40–50% do tamanho e descarta
  detalhe legitimamente. Exige que **nenhum número surja do nada**. Normaliza
  separadores e numerais por extenso, senão "twelve bishops" → "12 bispos"
  reprovaria injustamente.
- **`rito_1962` é condicional, não lista de palavras proibidas.** "salmo
  responsorial" só reprova se o original **não** trouxer "responsorial psalm".
  Noticiar celebração no Novus Ordo é reportagem correta; "corrigir" uma Epístola
  de 1962 para "primeira leitura" é fabricação litúrgica.
- **`proporcao` mede contra `min(sourceLength, texto disponível)`** porque a
  ingestão trunca `sourceExcerpt` em 6.000 chars enquanto `sourceLength` guarda o
  tamanho anterior ao truncamento. Sem o `min`, todo artigo longo reprovaria no piso.

**Testes: 26 asserções, 0 falhas.** Cobrem tradução curta/longa, sem atribuição,
número inventado, texto que voltou em inglês, recusa do modelo, andaime vazando,
Novus Ordo indevido, glossário ignorado, e o caso legítimo que NÃO pode reprovar.
Orquestração testada com provider e banco falsos: cota estourada e queda de rede
deixam o item em `draft` sem gravar nada.

**NÃO VERIFICADO — a chamada real ao modelo.** Sem `CLOUDFLARE_API_TOKEN` não há
como saber se o Llama 3.1 8B honra `response_format` nesta variante, qual a taxa
real de reprovação, nem o consumo de Neurons. A qualidade editorial do texto
gerado segue sendo incógnita.

Interface para a Fase 2:
```ts
import { adaptarPendentes, paraIngestionRun } from "@/services/translation";
const resumo = await adaptarPendentes(db, env, { limite: 5 });
const linha  = paraIngestionRun(resumo);
```
Não cria rota e não escreve em `ingestion_runs` — quem abre e fecha a execução é a rota.

---

## 2d. Fase 1.D entregue — SEO e calendário de 1962

**Parser validado contra a fonte real:** 2026 → 219 linhas vistas, **212 dias, 0
rejeitadas, 0 avisos**. 2025 → 365/0/1. 2024 → 366/0/0. Total no D1 local: 577
linhas, nenhuma com festa vazia, sem epístola ou sem cor.

Nada é lido por posição — cada variação de layout virou uma regra por padrão:

- **A Sexta-feira Santa não tem prefácio** e vem com 3 linhas em vez de 4. Ler a
  coluna "Liturgia" por índice quebraria justamente no dia mais importante do ano.
  A classificação é por conteúdo, e a linha de Glória/Credo é testada **antes** da
  de leituras porque ambas contêm `•`.
- **Classe é localizada por regex**, não como última linha: `13 de Junho` publica
  `festa / 2ª classe / (no próprio do Brasil)`. Só conta como classe se a linha
  for isso e nada mais, senão `Quarta-feira das Têmporas` viraria classe.
- **Cor validada contra vocabulário**, com tokens separados por `/`, `,` ou ` ou `
  — pega `Roxo/Branco` (Vigília Pascal) e `Róseo ou Roxo` (Gaudete). Cor
  desconhecida vira `null` + aviso, nunca lixo.
- **`weekday` é DERIVADO da data, não copiado da fonte.** A fonte tem erro de
  digitação real: `Domigo` em 05/10/2025. Confiar no publicado custaria o dia
  inteiro. O valor publicado vira apenas conferência; divergência gera aviso.
  ⚠️ **Isto diverge do comentário em `src/db/schema.ts`** ("como publicado pela
  fonte") — ajustar o comentário na próxima migration.
- **Falha dura** (`LiturgyParseError`) se: HTML vazio, nenhuma tabela de 4 colunas,
  nenhum dia reconhecido, rejeição > 10%, ou ano indeterminável. Nunca grava lixo.

**Idempotência comprovada:** 1ª execução `diasNovos:212`; 2ª execução
`diasNovos:0 / diasAtualizados:212`. O upsert usa
`coalesce(excluded.x, liturgical_days.x)` nos campos opcionais — recarga
degradada não apaga dado bom. Lotes de 6 linhas (6×15=90 params; teto do D1 é 100).

**SEO:** sitemap geral, news-sitemap com janela de 48h e teto de 1.000 URLs,
`robots.ts`, `feed.xml` próprio, JSON-LD `NewsArticle` + `BreadcrumbList` +
`WebSite` + `NewsMediaOrganization`. Os três XML validados com `xmllint`.
O JSON-LD escapa `<`/`>`/`&` como `<`/`&` — um `</script>` vindo de
título de fonte externa não fecha a tag.

**Ajuste já aplicado por mim:** acrescentei o cron `0 7 10 1 *` ao agendador.
O disparo mensal cai em 1º de janeiro, quando a página do ano novo pode ainda não
existir — sem a repetição no dia 10, o site ficaria sem liturgia até fevereiro.

---

## 2e. Fase 1.A entregue — DÉBITO DE FIDELIDADE ABERTO

> **A ferramenta `DesignSync` não estava disponível para o subagente.** Ele não
> conseguiu ler `Blog Notícias Católicas.dc.html` e **reconstruiu a capa por
> inferência** a partir dos tokens do `globals.css`, do `categories.ts` e do
> placeholder da Fase 0. O usuário pediu implementação FIEL — o que existe hoje é
> reconstrução informada. A sessão principal TEM acesso ao `DesignSync`; a
> conferência é obrigatória na Fase 2.

### Auditado contra o design real — o que FALTA

| # | Seção do design | Situação |
|---|---|---|
| F1 | **Campo de busca** no header (desktop, com expansão no focus 124px→196px) e no menu mobile | ausente |
| F2 | **"Mais lidas da semana"** — `<ol>` de 4 itens numerados na sidebar | ausente |
| F3 | **Seção Editorial/Opinião** — blockquote serifado grande (`Newsreader` itálico, clamp 24–40px), foto 1:1, "Ler o texto completo", faixa com `bg-surface` e bordas | ausente |
| F4 | **Seção Newsletter** — "Receba o resumo da manhã", input de e-mail + botão "Assinar", `subscribeNote` | ausente |
| F5 | **Botões "Compartilhar" / "Salvar"** no cabeçalho da matéria | ausente |
| F6 | Título da seção de últimas: o design usa **"Últimas notícias"** com contador (`N matérias`) e link **"Limpar filtro"** quando há filtro ativo | virou "Em pauta"/"Editorias" |

### O que SOBRA (invenção que não existe no design)

| # | Item | Evidência |
|---|---|---|
| F7 | `src/components/layout/headline-font-toggle.tsx` | No design, `headlineFont` está em `data-props` como `editor:"enum"`, `section:"Aparência"` — é **prop de design-time do painel**, não controle no header. O header do design tem apenas: logo, nav, campo de busca e o toggle de tema. **Remover.** Isso também anula o pedido de anti-FOUC para `bn-headline`. |

### O que a reconstrução acertou (manter)

Estrutura destaque + 2 secundários + sidebar; chips derivados do conteúdo;
`Epístola`/`Evangelho` sem "Salmo" (verificado: `'Salmo' ausente: True`);
`brasil` fora da nav/chips e rota devolvendo 404; datas absolutas em vez de
relativas (relativa envenena cache sob Cache Components); `await connection()`
antes de `new Date()` — sem ele o build quebra com *"used `new Date()` before
accessing Request data"*; reveal respeitando `prefers-reduced-motion`;
acessibilidade acrescentada (skip link, `aria-expanded`/`aria-controls`, Escape,
devolução de foco, `aria-pressed`, `role="status"`, hierarquia h1→h2→h3).

Decisão de arquitetura que vale manter: **`TopicFilter` recebe os cards já
renderizados no servidor como `ReactNode`** e filtra via atributo `hidden` —
`ArticleCard`, `next/image` e `categories.ts` nunca entram no bundle do cliente,
e o HTML completo continua disponível para rastreadores.

### Verificação real da entrega
`typecheck` limpo, `build` OK com 34 páginas, `/` → 200 (120.926 bytes),
`/noticia/<slug>` → 200, `/categoria/liturgia` → 200, `/categoria/brasil` → 404,
`/noticia/inexistente` → 404. Capa saiu como `◐ Partial Prerender`.

---

## 2.10 Cache durável + tarefas de painel Cloudflare (04/08)

### O cache que não existia

`open-next.config.ts` era `defineCloudflareConfig()` **sem argumento**. Sob
`cacheComponents: true` isso significa **nenhum store durável para `"use
cache"`**: os quatro perfis de `cacheLife` e todo o `revalidate.ts` só valiam
dentro do isolate vivo, e cada isolate frio refazia as consultas no D1.

**KV + D1, não R2.** O R2 foi descartado no `wrangler.jsonc` por exigir método
de pagamento mesmo no tier gratuito; **KV e D1 não exigem**. Trade-off: KV é
eventualmente consistente (~60s), irrelevante para um portal cuja matéria já
espera minutos na fila.

Recursos criados: KV `9f8ec88137174d95ba4f85404ce750df`, D1
`minuto-eclesiastico-cache` (`47f55bb6-…`). A tabela `revalidations` **não é
criada em runtime** — o adapter só imprime o SQL; foi criada à mão.

**Verificado em produção:** 29 chaves no KV, 5 linhas em `revalidations`.

⚠️ Este deploy DEVERIA ter saído isolado (era o risco R1 do plano) e acabou
junto do conserto de paginação, porque um `git add -A` o varreu. Saiu bem, mas
a disciplina vale: mudança de camada de cache merece deploy próprio.

### Pendente no painel — nenhuma exige código

| # | Tarefa | Por quê |
|---|---|---|
| 1 | **WAF: bloquear `/api/cron/*`** da internet pública | Maior ganho de segurança do plano, zero linha de código. **Não quebra o cron**: `workers/scheduler` chama a app por *service binding*, que não atravessa a borda. |
| 2 | **Email Routing** → `contato@minutocatolico.com.br` | Destrava `PENDENTE.email`, as caixas de "pendente" e a aprovação Adcash. |
| 3 | SSL/TLS: Always Use HTTPS, TLS mín. 1.2, HSTS com `max-age` **curto** primeiro | HSTS no painel é reversível em segundos; em código gruda no navegador até expirar. |
| 4 | **Cache Rules** para HTML de `/`, `/noticia/*`, `/categoria/*`, `/noticias` | Viabilizado pelo opt-in uniforme. ⚠️ **Bypass obrigatório** para `/api/*`, os feeds e requisições com header `Next-Action` (Server Actions) — senão o POST da newsletter pode ser servido de cache. |
| 5 | **Tiered Cache** | Gratuito, reduz origin fetches. |
| 6 | **Rate Limiting**: `http.request.method eq "POST" and len(http.request.headers["next-action"]) > 0` | Server Action não tem path próprio; é assim que se protege a newsletter na borda. |
| 7 | **Bot Fight Mode** | ⚠️ Conferir Security Events por 24h que não bloqueia Googlebot, Bingbot nem o `MinutoCatolicoBot`. |

---

## 3. Bloqueios e pendências

| Item | Situação |
|---|---|
| Domínio definitivo | **Não definido.** Necessário para o UA do bot, `SITE_URL`, JSON-LD `publisher`, OG e sitemaps. Usando placeholder até o usuário decidir. |
| Categoria "Igreja no Brasil" | **Ficará vazia** — ambas as fontes são EUA/mundo. Decidir depois: esconder a aba, ou adicionar fonte brasileira. Candidato natural: o próprio Salve Maria (categorias `noticias` e `recortes` em PT-BR, WP REST API **aberta**). Fora do escopo desta entrega. |
| Orçamento de Neurons | **Não medido.** Bloqueante antes de ligar o cron em produção: processar ~20 artigos reais e ler o consumo no dashboard da Cloudflare. |
| Conta Cloudflare | ✅ **Criada e autenticada** (28/07/2026). Conta `95fa8e7d…`. |
| D1 remoto | ✅ **Criado e migrado.** `database_id: be66eecd-f2e1-48ac-9f47-19b0b0f6acb4`. As 4 tabelas existem em produção. |
| R2 | ❌ **Descartado de propósito.** `wrangler r2 bucket create` falha com *"Please enable R2 through the Cloudflare Dashboard"* (código 10042) — ativar exige método de pagamento mesmo no tier gratuito. Como **nada no código usa `env.MEDIA`** (verificado por grep) e o OpenNext roda com cache padrão, o binding foi removido do `wrangler.jsonc`. Reativar só quando formos re-hospedar imagens em vez de apontar para o CDN das fontes. |
| Binding D1 duplicado | Corrigido. Algum comando do wrangler acrescentou uma segunda entrada (`binding: "minuto_eclesiastico"`, `remote: true`) para o MESMO `database_id`. Removida: `remote: true` força ida à rede mesmo em dev local, e dois bindings para o mesmo banco criam ambiguidade. **Se reaparecer depois de rodar algum comando do wrangler, remover de novo.** |
| `CRON_SECRET` em produção | ⏳ Pendente do usuário: `wrangler secret put CRON_SECRET` na app E em `workers/scheduler/`, com o MESMO valor (está em `.dev.vars`). |

### Fila da integração (Fase 2)

| # | Pendência | Origem |
|---|---|---|
| I1 | `TRANSLATION_PROVIDER` precisa entrar no `wrangler.jsonc` e no zod de `src/lib/env.ts`. A camada C já lê como opcional com default `workersAi` — nada muda lá quando for adicionado. | 1.C |
| I2 | **`slug` é derivado do título em INGLÊS** (vem da ingestão, antes da adaptação). Para SEO em PT-BR isso está errado. A coluna é `notNull` com índice único, então mudar exige cuidado com colisão. Decisão de Fase 2. | 1.C |
| I3 | **`failed_validation` não tem caminho de volta.** Um artigo reprovado por um soluço de parsing fica lá para sempre. Falta um job de requeue (`failed_validation` → `draft`), idealmente só para as causas transitórias. | 1.C |
| I4 | **Substituir `public/logo.png` e `public/og-default.png`.** São placeholders gerados pelo subagente D só para o `publisher.logo` do JSON-LD e o fallback de OG não darem 404. Manter os mesmos caminhos e proporções (512×512 e 1200×630). | 1.D |
| I5 | **Queries de `src/lib/seo.ts` precisam de `"use cache"` + `cacheLife` + tags.** Hoje sitemap/feed/news-sitemap usam `connection()` e leem o D1 a cada requisição — desperdício e risco sob tráfego. Promover `listarArtigosPublicados` / `listarArtigosDesde` para a camada de dados compartilhada. | 1.D |
| I6 | **A página de artigo precisa exibir "Fonte: X" com link para `sourceUrl`.** O JSON-LD já declara `isBasedOn`/`citation`/`creditText`, mas a atribuição VISÍVEL é requisito de produto (`CLAUDE.md` §6). Conferir se a frente A implementou; se não, é obrigatório na Fase 2. | 1.D |
| I7 | Comentário de `weekday` em `src/db/schema.ts` diz "como publicado pela fonte", mas o parser passou a derivar da data (typo real `Domigo` na fonte). Ajustar na próxima migration. | 1.D |
| I8 | D1 **local** ficou com 2025 backfillado (365 linhas) além de 2026. Inofensivo; para estado limpo: `DELETE FROM liturgical_days WHERE date LIKE '2025-%'`. | 1.D |

---

## 4. Adaptações do design já identificadas

O mockup foi desenhado com liturgia do **Novus Ordo**; a decisão é **1962**:

1. Card "Liturgia de hoje": `1ª leitura / Salmo / Evangelho` → **`Epístola / Evangelho`**
   (no missal de 1962 não há salmo responsorial), mais `Classe` e `Cor`. Título vira
   ex. "VI Domingo depois de Pentecostes · 2ª classe".
2. Card "Santo do dia": alimentado por `feast` + `marianSaint`.
3. Data do masthead: dinâmica, `America/Sao_Paulo`.
4. Chips de tema: derivados das categorias realmente presentes no banco.
5. Placeholders de imagem hachurados → `next/image`, **mantendo a hachura como
   fallback real** quando não houver imagem (bonito e evita CLS).
6. O reveal por `IntersectionObserver` do design **não** checa `prefers-reduced-motion`
   — corrigir na implementação.

`support.js` é o runtime gerado do Claude Design (`dc-runtime`) — **interpretador,
não código para portar**. Mapeamento: `sc-if` → render condicional, `sc-for` → `.map()`,
`style-hover`/`style-focus` → variantes Tailwind, `{{ }}` → props/state,
`style` inline → Tailwind + tokens `oklch` no `@theme`.

---

## 5. Estado verificado da Fase 0

Comprovado, não presumido:

- `npm run typecheck` → limpo, zero `any`.
- `npm run build` → `Cache Components enabled`, `✓ Compiled successfully`,
  `ƒ Proxy (Middleware)` registrado.
- `npm run db:migrate:local` → 11 comandos aplicados no D1 local.
- `npm run dev` → pronto em 444ms, `Using secrets defined in .dev.vars`.
- `GET /` → 200, `lang="pt-BR"`, `<title>Minuto Eclesiástico</title>`,
  script anti-FOUC presente, tokens `oklch` compilados com fallback hex/lab.
- `POST /api/cron/ingest` → 401 sem token · 401 com token errado ·
  404 com token válido (passa o proxy; a rota é da Fase 1.B).

### Arquivos-chave criados
```
next.config.ts            cacheComponents + cacheLife + remotePatterns
open-next.config.ts       adapter Cloudflare
wrangler.jsonc            app (D1 DB, R2 MEDIA, AI) — SEM crons, de propósito
workers/scheduler/        Worker agendador (crons */15 e mensal)
drizzle.config.ts         gera em drizzle/migrations, wrangler aplica
src/db/schema.ts          CONTRATO entre as camadas — não alterar sem migration
src/db/index.ts           getDb() / getEnv()
src/lib/env.ts            validação zod + getUserAgent()
src/lib/utils.ts          cn()
src/lib/cron-auth.ts      autorização de cron (o proxy.ts foi descartado)
src/app/globals.css       tokens oklch do design + prefers-reduced-motion
src/app/layout.tsx        next/font auto-hospedado + anti-FOUC
cloudflare-env.d.ts       gerado (NÃO ignorado no git — CI precisa)
```

---

## 5a. ✅ BUILD CONSERTADO (28/07/2026) + primeira execução real do modelo

### Causa do build quebrado: `.wrangler/state` órfão
Quando o `database_id` mudou de `PLACEHOLDER…` para o ID real, o **Miniflare
passou a apontar para um banco local NOVO e vazio** — ele indexa o
armazenamento local por `database_id`. O erro críptico
`"Failed to parse body as JSON, got: Error: internal error"` era query contra
tabela inexistente.
**Solução:** `rm -rf .wrangler/state && npm run db:migrate:local`.
→ Sempre que trocar `database_id`, refazer as migrations locais.

Build hoje: **EXIT=0**, com os perfis de cache aplicados —
`/` 5m/15m (`homeFeed`), `/busca` 10m/30m (`category`), `/categoria/[slug]` e
`/noticia/[slug]` como `◐ Partial Prerender`.

### Autenticação: NÃO é preciso `CLOUDFLARE_API_TOKEN`
`wrangler login` (OAuth, em `~/.config/.wrangler/config/default.toml`) basta para
`CF_REMOTE_BINDINGS=true npm run dev`. O token só faria falta em ambiente
não-interativo (CI).

### Dois bugs reais encontrados ao chamar o modelo de verdade

1. **`AbortSignal` quebra o binding AI.** Passar
   `{ signal: AbortSignal.timeout(ms) }` a `env.AI.run()` dá
   `DevalueError: Cannot stringify arbitrary non-POJOs` — em dev o binding é um
   proxy que serializa a chamada, e `AbortSignal` não é POJO. Trocado por
   `Promise.race`. **Só aparece chamando o modelo de verdade.**
2. **`response_format` é REJEITADO, não ignorado.** A API responde
   `5025: This model doesn't support JSON Schema` e derruba a requisição
   inteira. A suposição de 1.C (mandar assim mesmo e deixar o `extrairJson()`
   cobrir) estava errada quanto ao comportamento da API. Campo removido.

### ✅ RESOLVIDO (28/07) — o pipeline publica. Três bugs, nenhum era o modelo.

Modelo em uso: **`@cf/meta/llama-3.3-70b-instruct-fp8-fast`** (gratuito).
Trocável por `WORKERS_AI_MODEL=<apelido|id>` sem rebuild; apelidos em
`MODELOS_AVALIADOS`.

**Bug 1 — `max_tokens: 1500` cortava a resposta.** O corpo alvo vai a 3.200
caracteres (~950 tokens em PT) + título + dek + tags + moldura. → 4.000.

**Bug 2 — JSON é o envelope errado para markdown longo.** O modelo escrevia
`"corpo_md":` e despejava markdown cru, com quebras de linha e aspas internas
sem escapar. **8B e 70B falhavam no MESMO ponto**, o que descartou capacidade
como causa. → Formato de blocos (`TITULO:` / `DEK:` / `CATEGORIA:` / `TAGS:` /
`CORPO:`), sem problema de escape. `parsearBlocos()` em `prompt.ts`; o JSON
segue como reserva para o provider Anthropic.

**Bug 3 — o checador reprovava OMISSÃO como divergência factual.** Das 5
"divergências" de um artigo, todas eram *"a versão em português não menciona a
data exata"*. Mas o formato é adaptação de 40–50% — descartar detalhe é o
objetivo. O prompt já mandava ignorar omissão e o modelo ignorou a instrução.
→ Filtro determinístico `ehQueixaDeOmissao()` em `parsearVerificacao`, estreito
o bastante para não engolir contradição real ("diz 5 bispos, o original diz 12"
tem forma afirmativa e continua reprovando).

Também corrigido: `AbortSignal` no `env.AI.run()` dava
`DevalueError: Cannot stringify arbitrary non-POJOs` (→ `Promise.race`), e
`response_format` é **rejeitado** com `5025: This model doesn't support JSON
Schema`, não ignorado (→ removido). Timeouts: 180s adaptação / 120s verificação.

**Resultado medido:** 3 artigos → **2 publicados, 1 reprovado**, ~25s/artigo.
Qualidade do PT-BR e da terminologia conferida à mão e aprovada
(diácono, capelão de hospício, sacramentos da iniciação, Diocese de Tucson,
arcebispo de Miami, cultura da morte, ensinamento da Igreja). Proporções: 26% e
57% do original.

### Lote maior (28/07) e Sign of the Cross resolvido

- **Teto de proporção subido de 55% para 60%** (`TETO_PROPORCAO` em
  `guardrails.ts`), a pedido do usuário.
- **SOTC: de 0/25 para 18/26 adaptáveis.** Criado
  `src/services/ingestion/article-body.ts`, que extrai os parágrafos do corpo da
  página com `htmlparser2` (contêiner `entry-content` do WordPress, com reserva
  por parágrafos longos). Medido numa página real: 14 parágrafos, 4.167 chars.
  A fila de enriquecimento passou a incluir `sourceLength < 1750`, senão artigos
  com imagem mas texto curto ficariam presos em `draft` para sempre.
  Material bruto agora equivale ao `content:encoded` do EWTN.
- **Lote de 10: 3 publicados, 7 reprovados, ~21s por artigo.**
  Todas as 7 reprovações em `verificacao_factual` (2 delas também `proporcao`).

⚠️ **Taxa de publicação de 30%.** O checador factual reprova 70%. Falha fechada,
que é a direção certa, mas provavelmente ainda há falso positivo além do filtro
de omissão. Próximo passo para melhorar: logar as divergências reprovadas e
classificá-las à mão — se forem majoritariamente omissão disfarçada ou
reformulação, ampliar o filtro; se forem invenção real, o modelo é o limite.

⚠️ **`tokensIn`/`tokensOut` voltam 0** — o Workers AI não reporta uso nesta
variante, então o consumo de Neurons **não é mensurável pela resposta**.

### 🔴 CONSUMO DE NEURONS — MEDIDO (28/07/2026)

A cota diária **esgotou** durante os testes:
```
4006: you have used up your daily free allocation of 10,000 neurons
```

Ordem de grandeza medida: **~34 tentativas de artigo consumiram os 10.000
Neurons/dia**, com `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Cada tentativa
são DUAS chamadas (adaptação + verificação), ambas carregando o glossário.

**Implicação direta:** as duas fontes produzem ~75 itens/dia (50 EWTN + 25
SOTC). A cota gratuita cobre menos da metade disso com o 70B. Caminhos:
1. Modelo menor (`mistral24b`, `gemma12b`) — mais artigos por Neuron, qualidade
   a verificar;
2. Reduzir para 1 chamada por artigo (dispensar a verificação factual);
3. Plano pago do Workers AI;
4. Aceitar publicar ~30/dia e deixar o resto na fila.

O erro de cota é classificado como `quota` e **adia** o item (continua `draft`),
nunca reprova — o fail-safe funcionou como projetado.

### ✅ Quatro pendências fechadas + estratégia de cota (28/07)

**Decisão do usuário sobre cota:** publicar ~30/dia e enfileirar o resto,
100% gratuito. Aceita ficar atrás das fontes, desde que não muito.

**Modelos assimétricos** — a ideia que faz essa escolha render mais:
`WORKERS_AI_MODEL=llama70b` (adaptação, onde a qualidade se decide) e
`WORKERS_AI_VERIFY_MODEL=mistral24b` (verificação, tarefa mais simples).
Cada artigo custa 2 chamadas; baixar só a segunda aumenta a vazão sem tocar no
texto que o leitor vê. Se o falso positivo do checador subir, voltar com
`WORKERS_AI_VERIFY_MODEL=llama70b`.
> A fila já processava do mais recente para o mais antigo (`publishedAt desc`),
> que é o que impede o portal de publicar notícia velha enquanto se atrasa.

**Slug em PT-BR** (`escolherSlugPtBr` em `adapt.ts`): refeito no momento da
publicação, a partir do título traduzido — antes a URL saía em inglês. Colisão
resolve com sufixo derivado do id (determinístico); se nem assim, mantém o slug
antigo. URL feia é melhor que falha de gravação com o artigo pronto.

**Requeue** (`src/services/translation/requeue.ts`): devolve à fila só o que
reprovou por causa de FORMA (`resposta_invalida`, checador sem veredito).
Causas de CONTEÚDO — número inventado, idioma, proporção, atribuição — nunca
voltam: reprocessar é apostar que o modelo não invente de novo. Máx. 2
tentativas, janela de 3 dias. Ligado ao início de `/api/cron/adapt`.
Testado: examinou 1, devolveu 0 (a causa era `proporcao`, definitiva). ✔

**Health-check** (`GET /api/health`, público, sem `CRON_SECRET` — um
health-check que exige segredo não serve para monitor externo). Devolve **503**
quando parado, para o monitor disparar alerta; 200 com `estado: "degradado"`
quando serve mas precisa de atenção. Expõe contagens e carimbos, nunca conteúdo
ou mensagem de erro crua. Testado: detectou as 3 execuções com erro por cota. ✔

**Env**: `TRANSLATION_PROVIDER`, `WORKERS_AI_MODEL`, `WORKERS_AI_VERIFY_MODEL`
declarados no `wrangler.jsonc` e validados por zod em `src/lib/env.ts`.

**Cron de adaptação ligado** no agendador (`5,20,35,50 * * * *`) — a rota
existia mas nunca era disparada. Fica 5 min após a ingestão.

⏳ **Pendente:** validar a vazão real com os modelos assimétricos. A cota do dia
esgotou durante os testes; reset às 00:00 UTC (21h BRT).

### 🔴 BUG DA CLOUDFLARE — cota não libera após o reset (29/07)

Testado em **01:58 UTC de 29/07**, quase 2h depois do reset documentado das
00:00 UTC: a API continua devolvendo

```
AiError: 4006: you have used up your daily free allocation of 10,000 neurons
```

**Não é o nosso código.** É problema conhecido e recorrente do Workers AI, com
vários relatos abertos na comunidade da Cloudflare — o 4006 persiste depois do
reset *enquanto o painel mostra 0/10k de uso*:
- community.cloudflare.com/t/workers-ai-daily-free-neuron-quota-did-not-reset-at-00-00-utc/941565
- community.cloudflare.com/t/workers-ai-free-daily-limit-stuck-4006-errors-while-todays-usage-is-0-neurons/942709
- community.cloudflare.com/t/workers-ai-returns-429-error-4006-after-daily-quota-reset-dashboard-shows-0-10k/941039

**Consequência para o projeto:** o free tier do Workers AI não é só *limitado*,
é *não confiável* — a cota pode não liberar por horas sem explicação. Isso
muda a premissa da escolha "100% gratuito": não é questão de publicar menos
por dia, é de poder não publicar nada em dias inteiros.

**O que funcionou:** a postura fail-closed segurou. Todos os artigos ficaram em
`draft`, nada foi publicado sem verificação, nada foi queimado. O erro é
classificado como `quota` e **adia**. O sistema se comportou exatamente como
projetado diante de uma falha de infraestrutura de terceiro.

**Ainda NÃO medido:** a vazão real com os modelos assimétricos
(`llama70b` adapta / `mistral24b` verifica). Depende da cota liberar.

### 🔴🔴 O CRON NUNCA DISPAROU — causa raiz achada em 29/07 (03:50 UTC)

Sintoma: nenhuma notícia no site, 75 artigos parados em `draft`, e a tabela
`ingestion_runs` com **8 linhas no total** — todas de disparo manual meu. Zero
execuções automáticas desde o deploy do agendador (28/07 21:30 UTC).

**Causa:** `workers/scheduler/index.ts` montava `${SITE_URL}/api/cron/...` e
chamava com o `fetch` global. Eu havia configurado `SITE_URL` como
`https://minutocatolico.com.br` — o domínio recém-comprado, que **ainda não
resolve** (sem registro `A`, delegação ainda em `auto.dns.br`). Todo disparo
morria no DNS: o cron rodava, o `fetch` estourava, e a requisição nunca chegava
na app. Nenhuma linha em `ingestion_runs` porque **não havia a quem reportar**.

Erro meu: apontei a configuração de produção para um domínio que não existia.

**A cota da Cloudflare mascarou isto.** Como os testes manuais batiam no 4006,
atribuí o site vazio à cota e não questionei por que não havia execução
automática nenhuma. A pista estava à vista: o 4006 explica `publicados=0`, mas
**não explica `ingestion_runs` vazia** — ingestão não gasta Neuron.

**Conserto (mais forte que só arrumar a URL):** service binding.
```jsonc
// workers/scheduler/wrangler.jsonc
"services": [{ "binding": "APP", "service": "minuto-catolico" }]
```
```ts
const resposta = await env.APP.fetch(url, { method: "POST", ... });
```
A chamada vai pela rede interna da Cloudflare: sem DNS, sem TLS, sem sair para a
internet. **A ingestão deixa de depender do estado do domínio** — que era a
classe de acoplamento que causou a pane. `SITE_URL` continua no agendador só
para o log ficar legível; com o binding o host é irrelevante para o roteamento.

**Não regredir:** nunca voltar a usar o `fetch` global no agendador.

**Lição de diagnóstico:** health-check `estado: "parado"` com
`segundosDesdeUltima: 6110` era o sinal, e estava correto desde sempre. Faltou
eu olhar para ele em vez de para a cota.

### 🔴 BUILD AUTOMÁTICO (Cloudflare Workers Builds) quebrou — 29/07

```
Error: Failed query: select distinct "category_slug" from "articles" ...
[cause]: D1_ERROR: no such table: articles: SQLITE_ERROR
   at bI (src/lib/articles.ts:100)   ← categoriasComConteudo()
```

**Causa: o build lê o D1 LOCAL.** Sob Cache Components, função com `"use cache"`
é avaliada em tempo de build para pré-render. O `<Suspense>` em volta de
`<NavPrincipal>`/`<ListaDeEditorias>` protege contra dado *dinâmico*, mas **não
impede o Next de resolver conteúdo cacheado no build**. Na máquina local passa
porque `.wrangler/state` tem o schema migrado; no CI esse diretório é
git-ignored e nasce vazio.

Clássico "funciona na minha máquina" — e já tinha nos mordido antes (§5a, o
`.wrangler/state` órfão). A diferença é que agora a divergência é permanente,
porque o CI sempre nasce limpo.

**❌ PRIMEIRA TENTATIVA, DESCARTADA — não repetir:** fazer o `cf:build` rodar
`db:migrate:local` antes de compilar. Passou uma vez (logo após
`rm -rf .wrangler/state`) e depois falhou de forma reprodutível:

```
SQLite failed; database is locked: SQLITE_BUSY
Error occurred prerendering page "/"
```

`wrangler d1 migrations apply --local` sobe um `workerd`, escreve no WAL e sai
sem checkpoint (`.sqlite` com 4 KB, `-wal` com 400 KB); o `workerd` seguinte não
recupera esse WAL. Apagar o `-shm` órfão **não** resolve — testado. O que tinha
"consertado" no teste isolado foi não ter rodado a migração, não o `rm`.

Lição: eu estava tratando sintoma. A pergunta certa era *por que o build precisa
de banco*.

**✅ CONSERTO REAL — `connection()` nas ilhas que leem D1.** O projeto já usava
esse padrão em `sitemap.ts`, `robots.ts`, `feed.xml`, `news-sitemap.xml`,
`today-line.tsx` e na página de categoria. Faltavam quatro pontos, agora
corrigidos:

- `src/components/layout/nav.ts` → `itensDaNavegacao()` e `itensDoRodape()`
- `src/app/(site)/page.tsx` → `Destaques()`, `Ultimas()`, `FaixaEditorial()`

`busca` e `noticia/[slug]` não precisaram: já consomem `searchParams`/`params`,
que são dado de requisição e já as tornam dinâmicas.

**O ganho é maior que destravar o CI.** O que era pré-renderizado vinha do D1
**local**, que não é o de produção — a casca do site nascia com a navegação e as
manchetes de outro banco. `connection()` elimina isso. O `"use cache"` do data
layer continua valendo: ele diz "não resolva no build", não "não cacheie".

Com isso o build **não toca em banco nenhum** e `cf:build` voltou a ser só
`opennextjs-cloudflare build`.

**Verificado nas duas pontas:**
- `rm -rf .wrangler && npm run cf:build` → `OpenNext build complete` (caso do CI)
- com o banco local migrado → idem, sem `SQLITE_BUSY`
- `tsc --noEmit` limpo

**Config no painel (Workers Builds):**
- Build command: `npm run cf:build`
- Deploy command: `npx wrangler deploy` (`main` já é `.open-next/worker.js`)

**Três armadilhas operacionais do CI — não esquecer:**
1. **O agendador NÃO é deployado por esse build.** `minuto-catolico-scheduler`
   é outro Worker; mudanças nele exigem
   `npx wrangler deploy --config workers/scheduler/wrangler.jsonc`.
2. **Migração REMOTA não roda no CI**, de propósito — CI não deve alterar
   schema de produção. Mudou o schema? `npm run db:migrate:remote` na mão,
   *antes* do deploy.
3. Secrets vivem no Worker, não no repo: `CRON_SECRET` sobrevive aos deploys.

**✅ RESOLVIDO junto:** eu havia registrado aqui a preocupação de o build
pré-renderizar `categoriasComConteudo()` contra um D1 local vazio, deixando a
nav sem editorias até a primeira publicação. Com `connection()` nas ilhas, isso
deixou de existir — a navegação passa a ser lida sempre em requisição, do banco
de produção.

### ✅ COTA LIBEROU — primeira medição real do pipeline completo (30/07)

O site está publicando. Domínio no ar, servindo a app:
`curl https://minutocatolico.com.br` → `<title>Minuto Católico</title>`, HTTP 200.
Delegação concluída (`lakas`/`mona.ns.cloudflare.com`), sem `dsrecord`.

```json
{"estado":"degradado","artigos":{"publicados":21,"naFila":71,"reprovados":34}}
```

**VAZÃO MEDIDA (fecha a pendência que estava aberta):** 21 publicados + 34
reprovados = **~55 tentativas por dia** de cota gratuita, contra **~34** medidas
com `llama70b` nas duas pontas. Os modelos assimétricos
(`llama70b` adapta / `mistral24b` verifica) **aumentaram a vazão em ~60%**.

A cota voltou a esgotar (4006 a partir de 23:50 UTC) — agora por consumo real,
não pelo bug. Comportamento esperado do free tier.

## 5d. Correções de frontend + arquivo paginado + institucionais (01/08)

Quatro pedidos do usuário. Um deles descobriu um bug de CSS que afetava o site
inteiro e ninguém tinha notado.

### 🔴 `globals.css` estava FORA DE CAMADA — utilitário de cor não pintava link

O achado mais importante do dia, e não estava na lista de pedidos. O chip ativo
do arquivo novo saiu **branco sobre branco**. Causa: as regras de elemento do
`globals.css` (`a`, `body`, `body *`, `html`…) estavam fora de qualquer
`@layer`. Em CSS, **declaração sem camada vence declaração em camada,
independentemente de especificidade** — e todo utilitário do Tailwind 4 vive em
`@layer utilities`.

Consequências que estavam no ar sem ninguém ver:

- `a { color: var(--ink) }` anulava **todo `text-*` em link do site**.
  `text-ink-2` no rodapé e na navegação e `text-blue-f` do "Ler o original" da
  matéria nunca pintaram nada — tudo saía na cor padrão do texto.
- `body * { transition: … 0.35s }` sobrescrevia **todos** os
  `transition-*`/`duration-*`/`ease-dc` do projeto.

Conserto: envolver as regras base em `@layer base`. Medido antes/depois no chip
ativo — `color` era idêntico ao `background-color` (lab 95.96 nos dois), passou
a lab 3.35 sobre lab 95.96.

**Efeito colateral desejado:** links pelo site passaram a respeitar as cores do
design. Não é regressão, é o design finalmente valendo.

### Rolagem lateral na matéria (celular)

Reproduzido a 360px: **288px de excesso**. Culpado medido: `<span>` de 632px no
corpo — URL do `vatican.va` e identificador sem espaço. `ArticleBody` não tinha
quebra de palavra.

- `break-words` no corpo, no dek, na legenda da foto e no bloco de fonte.
- `overflow-x: clip` no `<html>` como REDE (não como conserto), substituindo o
  `overflow-x-hidden` que estava no `<body>`.

⚠️ **A troca quebrou a trava de rolagem do menu.** `overflow` do `<body>` só
propaga para a viewport enquanto o `<html>` é `visible`; com `clip` no `<html>`,
travar o `<body>` deixou de travar coisa alguma. A trava do `MobileMenu` foi
para o `document.documentElement`.

### 🔴 Menu de celular não abria — `backdrop-filter` cria bloco contentor

O painel morava dentro do `<header>`, cujo filho tem `backdrop-blur-xl`.
`backdrop-filter` (como `transform`, `filter` e `perspective`) **faz do elemento
bloco contentor de descendentes `position: fixed`**. O `top-[57px] bottom-0` do
painel passava a ser relativo a uma faixa de 54px → altura negativa → painel com
zero pixel.

Conserto: `createPortal` para `document.body`. Medido depois: painel 390x787px,
recebendo clique. De quebra, o `-translate-y-full` que esconde o header ao rolar
não arrasta mais o menu junto.

Custo aceito: o painel deixou de sair no HTML do servidor. Não custa indexação —
os mesmos links já estão no `<nav>` de desktop e no rodapé.

### Capa deixou de carregar o acervo inteiro

A capa lia 30 matérias e mandava **todas** para o HTML, porque a régua de temas
filtra com `hidden` em vez de refazer a consulta. Agora lê 12
(`listarPaginado`), e o acervo vive em `/noticias`.

`/noticias` tem filtro por editoria e paginação **na URL**
(`?categoria=…&pagina=…`), com `<Link>` e não estado de cliente: endereçável,
volta com o botão do navegador, rastreável, e lê só uma página do banco.
`rotaArquivo()` omite `pagina=1` e categoria vazia para não gerar duas URLs
para a mesma listagem.

### Institucionais

`/sobre`, `/politica-editorial`, `/privacidade`, `/termos`, `/contato`.
Ligadas no rodapé e no sitemap.

⚠️ **`src/lib/institucional.ts` tem campos `PENDENTE` em `null`** — e-mail de
contato, entidade responsável, localidade. Enquanto forem `null`, as páginas
exibem um aviso em vez de um dado inventado. **Publicar e-mail falso numa
política de LGPD cria obrigação sobre um canal que não existe**, e o art. 18
exige que o canal do titular funcione. Preencher antes de divulgar o site.

### Verificado

Chrome headless via CDP, 390px (mobile) e 1280px, contra `next dev` com 43
artigos semeados — inclusive um adversarial com URL longa e token sem espaço:

- 8 rotas sem arrasto lateral (o teste **arrasta** com `scrollTo`, não só mede
  `scrollWidth` — com `overflow` clipado o `scrollWidth` mente)
- menu abre, fica em `<body>`, trava e destrava o fundo, leva ao arquivo
- arquivo: 12 cards/página, `rel="next"`/`prev`, `aria-current`, filtro por
  editoria devolvendo só a editoria pedida
- 5 institucionais renderizando com 300–760 palavras cada
- `tsc --noEmit` limpo, `cf:build` completo

**Armadilha do ambiente de teste (custou uma rodada):** `next dev` **bloqueia
recursos de dev vindos de `127.0.0.1`** ("Blocked cross-origin request to
Next.js dev resource"). Nada hidratava e o menu parecia quebrado. Usar
`localhost`. E `wrangler dev --local` trava depois de algumas dezenas de
requisições ("Worker's code had hung") — isso é anterior a estas mudanças.

## 5c. 🔴 SITE INTEIRO FORA DO AR — stream de RSC fatiado em 4096 bytes (31/07)

Sintoma reportado: toda página exibia lixo de texto no topo e, abaixo,
`"This page couldn't load"` — a error boundary padrão do Next. Capa e artigos,
igualmente. Começou no deploy de 30/07 à noite.

**Não era o `connection()` daquele commit, nem o D1, nem cache.** O servidor
respondia HTTP 200 com HTML completo. O que estava corrompido era a ORDEM DOS
BYTES.

### O que foi medido

Rodando a resposta de produção por um parser JS, três `<script>` da capa (e um
de cada artigo) não compilam:

```
Uncaught SyntaxError: Unexpected identifier 'preload'
```

O corte é sempre no mesmo lugar — **exatamente 4096 bytes depois do `<script>`**,
medido em 5 páginas:

```
<script>self.__next_f.push([1,"…font-display font-semi   ← corta aqui (byte 4096)
<link rel="preload" as="image" …><div hidden id="S:4">…</div>
<script>$RC("B:4","S:4")</script>
bold tracking-[-0.03em]…"])</script>                      ← resto vaza como TEXTO
```

`font-semi` + `bold tracking-…` = `font-semibold tracking-…`. O chunk continua
depois; alguém enfiou HTML no meio dele. O `<script>` quebrado derruba a
hidratação da árvore inteira — daí a página morrer por completo.

### Causa raiz

`createInlinedDataReadableStream()` (Next) cria o stream que embute o payload RSC
com `type: "bytes"`. Cada `enqueue()` é UMA tag `<script>…</script>` inteira.
`createFlightDataInjectionTransformStream()` consome esse stream com um reader
COMUM e reemite no mesmo controller por onde passa o HTML do React — os dois se
intercalam de propósito.

Em Node isso é seguro: reader comum devolve o chunk inteiro. **No workerd não.**
Medido no mesmo workerd que serve o site, em todos os regimes de temporização:

```
type: undefined  → [4500, 4500, 4500]        (Node e workerd concordam)
type: "bytes"    → [4096, 404, 4096, 404, …] (só workerd)
```

As tags de payload ficam em ~4400–4600 bytes assim que a página tem conteúdo
real — ou seja, **passam de 4096 e são fatiadas**. Antes de 30/07 o site tinha
poucos artigos e os chunks cabiam abaixo do limite; foi o volume de conteúdo que
revelou o bug, não o commit.

Bug upstream, sem knob de configuração: Next 16.2.12 + @opennextjs/cloudflare
1.20.2, ambos os mais recentes em 31/07/2026. `defineCloudflareConfig` não expõe
hook de patch de código.

### Conserto — `scripts/patch-next-flight-stream.mjs`

Remove `type: "bytes"` desse stream. Ele nunca é lido em modo BYOB, então o
`type` não comprava nada e era só o gatilho do fatiamento.

Roda no `postinstall` **e** no `cf:build` — um CI com `--ignore-scripts`
publicaria o site quebrado sem avisar. Idempotente. Se o alvo sumir numa
atualização do Next, o script **falha o build** de propósito, em vez de virar
no-op silencioso.

**Armadilha que custou um ciclo:** patchar
`dist/server/app-render/use-flight-response.js` compila e **não conserta nada**.
O que roda é o servidor pré-compilado em
`dist/compiled/next-server/app-page*.runtime.*.js` — é dele que o esbuild do
OpenNext monta o `handler.mjs`. O script patcha os dois conjuntos (10 arquivos).
Nos runtimes minificados, só o stream do flight usa método abreviado (`start(`);
os do React usam `start:function(` — é isso que os separa sem depender de nome
de variável.

### Verificado

- `handler.mjs` reconstruído: 2 streams de flight, 0 com `type:"bytes"`
- `wrangler dev` local com 14 artigos semeados, chunks de 4363–4644 bytes:
  49 scripts na capa, 35 no artigo, **0 quebrados**
- `tsc --noEmit` limpo

**`wrangler dev --local` NÃO reproduz o bug** (testado com `type:"bytes"`
reintroduzido no bundle: 0 quebras). A temporização local não fecha a janela.
Não confie em preview local para regressão disso — meça a resposta de produção.

### Como conferir se voltou

```bash
curl -s https://minutocatolico.com.br/ > /tmp/h.html
# todo <script> inline tem de compilar; qualquer erro = stream corrompido
```

Sinal barato no navegador: `Uncaught SyntaxError` vindo do próprio documento
(não de `/_next/static/*`).

### 🔴 O checador desperdiça mais da metade da cota em falso positivo

Das 34 reprovações, a esmagadora maioria é `verificacao_factual`, e a inspeção
das divergências mostra os dois tipos misturados:

**Reprovação CORRETA (manter barrando):**
- `"Desde a Guerra da Independência"` ← original `"From the battlefields of the
  Civil War"`. Guerra Civil → Guerra da Independência. Erro factual grave.
- 3 por `proporcao` (86.7%, 66.8%, 65.3% do original) — republicação disfarçada.

**FALSO POSITIVO (a tradução fazendo o trabalho dela):**
- `"Papa Francisco o declarou beato"` ← `"Pope Francis declared him blessed"`
- `"a freira Leticia Ugboaja"` ← `"Sister Leticia Ugboaja"` (37 "divergências")
- `"primeira gala"` ← `"inaugural gala"` · `"Papa Leo XIV"` ← `"Leo XIV"`

**Por que `RE_RUIDO_DE_TRADUCAO` não pega:** ele procura o checador *se
explicando* ("formato de data", "apenas tradução"). Estas divergências só
justapõem `"A" — o original dizia "B"`, sem palavra explicativa. Não há o que
casar lexicalmente.

**O custo é duplo, e é isto que torna urgente:** cada falso positivo gasta 2
chamadas de modelo (adaptar + verificar) da cota escassa **e** perde um artigo
bom. 34 das 55 tentativas do dia foram para o lixo. Corrigir isto é o caminho
mais barato para chegar aos ~30/dia que o usuário pediu — sem gastar 1 Neuron a
mais.

**Sinal discriminante identificado (ainda NÃO implementado — decisão do
usuário pendente):** comparar *tokens duros* entre os dois trechos citados —
números/anos e nomes próprios. Nos falsos positivos eles batem
(`Leticia Ugboaja` = `Leticia Ugboaja`, `Leo XIV` = `Leo XIV`,
`Francis`≈`Francisco`); no achado real não batem (`Civil` ≢ `Independência`).
É computável sem modelo e é exatamente o que o CLAUDE.md §1 protege.
Custo conhecido: `"in the fall of 2027"` → `"a partir de 2027"` passaria a
escapar (perda de nuance, não fato falso).

### Correção de afirmação anterior

Eu havia dito que a rota de ingestão precisava invalidar cache. **Errado.** Ela
insere tudo como `draft`, e o site só lê `published` — não há o que invalidar.
Quem publica é `/api/cron/adapt`, e essa **já chama** `invalidarAposPublicar`.

### Correções da rodada de guard-rails (28/07)

- **Verificação em formato de linhas** (`VEREDITO:` / `DIVERGENCIAS:`) em vez de
  JSON. Motivo: de 5 reprovações factuais, 4 eram "checagem não produzida".
- **Prompt do checador reescrito com REGRA ZERO** e exemplos reais do que NÃO é
  divergência. Ele estava apontando a própria tradução: *"Papa Leão XIV alerta
  jovens" — o original dizia "Pope Leo XIV: Use AI prudently"*. Um achado era
  real e legítimo: *"Papa Francisco" onde o original dizia "Pope Leo XIV"*.
- **Filtro `ehRuidoDeTraducao()`** para queixas de formato de data e tradução.
- **Filtro de omissão ampliado** (faltavam "não fornece", "não dá", "apenas
  menciona", "se limita a").
- **"Sem veredito" passou a ADIAR, não reprovar.** Tratar falha de formatação do
  checador como reprovação definitiva queimava o artigo — chegou a zerar um lote
  de 8. Agora o item continua `draft` e o próximo cron tenta de novo. Continua
  fail-closed: nada vai ao ar sem checagem.

---

### 🔴 Histórico — primeira execução (antes dos consertos acima)

```
vistos:2  publicados:0  reprovados:1  adiados:1  duracaoMs:76754
  reprovado → "resposta do modelo não continha um objeto JSON com
               titulo, dek e corpo_md"
  adiado    → "Timeout de 45000ms"
```

**Zero publicados. ~38s por artigo.** Sem JSON Schema, o Llama 3.1 8B não
devolve JSON parseável de forma confiável, e estoura o timeout de 45s.
Os guard-rails funcionaram: nada foi ao ar.

### 🔴 Sign of the Cross: 0 de 25 artigos são adaptáveis
O feed só traz excerpt (49–709 chars). O pré-voo reprova corretamente:
*"texto original com 96 caracteres; são necessários ao menos 1750 […]. Adaptar
a partir deste texto exigiria inventar."* EWTN: **47 de 50 adaptáveis**.
→ Decisão de produto pendente: buscar o corpo na página do artigo, rebaixar
SOTC a card de "título + link", ou remover a fonte.

### Distribuição de categorias após o conserto do mapeamento
`mundo 29 · vaticano 18 · doutrina 8 · patrimonio 5 · santos 5 · caridade 3 ·
juventude 2 · liturgia 2 · opiniao 2 · missoes 1` (antes: 74 em `vaticano`).

---

## 5b. Histórico — diagnóstico do build (resolvido em §5a)

`npm run typecheck` passa limpo. **`npm run build` falha** com
`Error occurred prerendering page "/categoria/[slug]"`.

### O que já foi eliminado como causa (não repetir os testes)

| Hipótese | Resultado |
|---|---|
| `params` consumido fora de `<Suspense>` | **Era causa real.** Corrigido: `params`/`searchParams` agora descem como promise para dentro da fronteira. O erro *"Uncached data was accessed outside of `<Suspense>`"* sumiu. |
| `getSiteUrl()` lendo o binding do Worker no `generateMetadata` | **Era causa real.** Corrigido com `getSiteUrlSync()` lendo `process.env` (`SITE_URL` é var pública, não segredo). |
| `initOpenNextCloudflareForDev` desligado no build | Reativado com `remoteBindings: false` → o Miniflare local passa a ser alcançado. |
| Binding `AI` forçar conexão remota | **Descartado.** Removi o binding e o erro continuou. |
| Contenção dos 7 workers de build no SQLite local | **Descartado.** `experimental.cpus: 1` não resolveu. |
| `await connection()` na ilha de dados | **Não resolveu.** |

### Erro real observado (com bindings locais ativos)

```
at async bI (src/lib/articles.ts:100:18)
  99 |   const db = await getDb();
> 100 |   const linhas = await db.selectDistinct({ slug: articles.categorySlug })
[cause]: Error: Failed to parse body as JSON, got: Error: internal error;
         reference = bpm09j08svn0l1sl2lp5nq9q
  at D1DatabaseObject.queryExecute (miniflare/.../d1/database.worker.js:196)
```

A query que quebra é `categoriasComConteudo()` — `SELECT DISTINCT category_slug`.
Chega ao Miniflare e volta erro interno do D1.

### Próximas hipóteses a testar, em ordem

1. **`selectDistinct` do Drizzle sobre D1.** Rodar a mesma query crua com
   `wrangler d1 execute --local --command "SELECT DISTINCT category_slug FROM articles WHERE status='published'"`.
   Se a crua funciona, o problema é o SQL que o Drizzle gera — trocar por
   `select({slug}).from(articles).where(...).groupBy(articles.categorySlug)`.
2. **`generateMetadata` de `/categoria/[slug]`**, que chama `metadataCategoria`
   → `listarArtigosPublicados` em `src/lib/seo.ts`. Metadata não está dentro de
   Suspense e pode ser o acesso remanescente.
3. Se nada resolver: aceitar que nenhuma rota toque o D1 em build e mover a
   navegação (header/rodapé) para lista estática de `CATEGORIAS`, perdendo o
   filtro "só editoria com conteúdo".

### Não desfazer

O trabalho de `<Suspense>`/PPR e `getSiteUrlSync` está **correto e deve ficar** —
ambos corrigiram erros reais e distintos. O que falta é só a query acima.

---

## 6. Próximo passo exato

> **ATUAL (04/08)** — SEO, segurança, performance e prontidão Adcash entregues
> (§2.9 a §2.9e, §2.10). **Publicidade SUSPENSA** (`PUBLICIDADE_ATIVA = false`).
>
> **Bloqueadores externos, que nenhuma engenharia resolve:**
> 1. `PENDENTE` em `src/lib/institucional.ts` (e-mail, entidade, localidade)
>    continua `null`. Caminho mais barato: **Cloudflare Email Routing**
>    (gratuito) para criar `contato@minutocatolico.com.br`. `entidade` aceita
>    pessoa física — nome completo basta, sem CNPJ.
> 2. `public/ads.txt` NÃO foi criado de propósito: um ads.txt que existe e não
>    lista vendedor nenhum significa "ninguém autorizado a vender este
>    inventário" e **bloquearia** a monetização. Precisa da linha real do painel
>    da Adcash.
> 3. Zonas de **banner** na Adcash (as antigas eram AutoTag) → preencher `ZONAS`
>    em `src/components/consent/consent-gate.tsx` e virar `PUBLICIDADE_ATIVA`.
> 4. Substituir `public/logo.png` e `public/og-default.png` (placeholders).
>
> **Tarefas de painel Cloudflare pendentes** (§2.10).
>
> **ATUAL (03/08, fim do dia)** — pipeline PUBLICANDO pela NVIDIA. Nada
> bloqueante. Deploy é automático por push na `main` (Workers Builds); o worker
> `workers/scheduler/` é separado e precisa de deploy próprio.
>
> Progresso do dia: 27 → **36 publicados**, fila 94 → 73. Dos itens já tocados
> pelo Nemotron: 9 publicados, 20 reprovados, 7 adiados.
>
> **Aberto, em ordem de valor:**
> 1. **`proporcao` ainda é a maior reprovação.** O orçamento em palavras (§2.6c)
>    e a 2ª tentativa reduziram, não zeraram — houve caso de 95% do original com
>    11 parágrafos. Próximo passo se incomodar: `NVIDIA_MODEL` para
>    `nemotronUltra`, ou pedir contagem de parágrafos explícita no formato.
> 2. **Falso positivo do checador** com sigla: `"SSPX"` vs
>    `"Society of Saint Pius X"` conta como nome próprio diferente em
>    `ehRuidoEstrutural`. Uma tabela de siglas ↔ extenso resolveria.
> 3. Liturgia de agosto: esperando o Salve Maria publicar. Cron diário pega
>    sozinho; `/api/health` mostra `folgaDias` negativo até lá.
> 4. Trocar os placeholders `public/logo.png` e `public/og-default.png`.

> **(29/07, 04:00 UTC)** — Fases 0–2 entregues e em produção. Aberto:
> 1. Confirmar que o cron dispara sozinho após o service binding (verificação
>    rodando; esperar linha nova em `ingestion_runs` sem disparo manual).
> 2. Medir vazão real dos modelos assimétricos — depende da cota liberar.
> 3. Ligar o Custom Domain quando o `.br` publicar a delegação para a Cloudflare
>    (DNSSEC já removido; NS da Cloudflare já respondem `aa`).
> 4. Trocar os placeholders `public/logo.png` e `public/og-default.png`.
>
> O histórico abaixo é da Fase 0 e ficou por registro.

Fase 0 concluída. Abrir a **Fase 1** com quatro frentes paralelas, todas
contra o schema já congelado em `src/db/schema.ts`:

- **A — Design:** portar `Blog Notícias Católicas.dc.html` para
  `src/components/` + `src/app/(site)/`, com dados mockados no formato do schema.
- **B — Ingestão:** `src/services/ingestion/` + `/api/cron/ingest`.
- **C — Adaptação:** `src/services/translation/` (provider, glossário, guard-rails).
- **D — SEO + Liturgia:** metadata/JSON-LD/sitemaps/feed + parser do calendário
  de 1962 do Salve Maria + `/api/cron/liturgy`.

Regra de não-colisão: **nenhuma frente edita `package.json`, `wrangler.jsonc`,
`src/db/schema.ts` ou `globals.css`.** Qualquer necessidade nesses arquivos vira
pedido para a integração (Fase 2), não edição direta.

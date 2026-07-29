/**
 * Dados MOCKADOS da Fase 1.A.
 *
 * Existem para a interface poder ser construída e revisada antes de a ingestão
 * (Fase 1.B) e o parser do calendário (Fase 1.D) estarem de pé. Tudo aqui é
 * tipado com `Article` e `LiturgicalDay` de `src/db/schema.ts` — o formato é o
 * mesmo que virá do D1, sem exceção e sem campo a menos. Trocar este módulo
 * pelas consultas reais não deve exigir mudança nenhuma nos componentes.
 *
 * Três decisões deliberadas:
 *
 * 1. **Timestamps são constantes fixas, não `Date.now() - n`.** Sob Cache
 *    Components, um valor que muda a cada avaliação do módulo tornaria a home
 *    impossível de prerenderizar e faria o HTML mudar entre dois builds
 *    idênticos.
 *
 * 2. **Nenhum artigo em `brasil`.** É o estado real do projeto (MEMORY.md §3):
 *    as duas fontes cobrem EUA/mundo. A UI precisa provar que esconde categoria
 *    vazia em vez de exibir seção morta — com um mock "gentil" isso nunca seria
 *    testado.
 *
 * 3. **Parte dos artigos sem `imageUrl`.** Exercita os dois caminhos do
 *    `ArticleMedia`: `next/image` quando há foto e a hachura do design quando
 *    não há. O Sign of the Cross não publica imagem no feed (MEMORY.md §2.2),
 *    então "sem imagem" é o caso comum, não a exceção.
 *
 * Os textos em português são fictícios, escritos para exercitar a tipografia.
 * As URLs de imagem apontam para o CDN da própria fonte, com o crédito que ela
 * declara no `media:credit` — é exatamente o que a ingestão vai gravar.
 */

import type { Article, Fonte, LiturgicalDay } from "@/db/schema";

/** 2026-07-27T00:00:00Z. Âncora de todos os timestamps abaixo. */
const HOJE = 1_785_110_400;
const HORA = 3_600;
const DIA = 86_400;

const NOME_DA_FONTE: Record<Fonte, string> = {
  ewtn: "EWTN News",
  sotc: "Sign of the Cross",
};

interface EntradaMock {
  slug: string;
  title: string;
  dek: string;
  bodyMd: string;
  categorySlug: string;
  tags: string[];
  source: Fonte;
  sourceTitle: string;
  sourceUrl: string;
  sourceAuthor: string | null;
  publishedAt: number;
  imageUrl?: string;
  imageCredit?: string;
  imageCaption?: string;
}

/**
 * Preenche os campos de auditoria que a UI não escolhe mas o tipo exige.
 * Manter isso numa função evita 13 objetos com 30 chaves cada — e garante que
 * um campo novo no schema quebre em UM lugar só.
 */
function artigo(e: EntradaMock): Article {
  const corpo = e.bodyMd.trim();
  return {
    id: `mock-${e.slug}`,
    dedupeHash: `dedupe-${e.slug}`,
    sourceContentHash: `content-${e.slug}`,

    source: e.source,
    sourceName: NOME_DA_FONTE[e.source],
    sourceUrl: e.sourceUrl,
    sourceGuid: e.sourceUrl,
    sourceTitle: e.sourceTitle,
    sourceExcerpt: null,
    sourceAuthor: e.sourceAuthor,
    sourceLength: corpo.length * 2,

    slug: e.slug,
    title: e.title,
    dek: e.dek,
    bodyMd: corpo,
    categorySlug: e.categorySlug,
    tags: e.tags,

    imageUrl: e.imageUrl ?? null,
    imageCredit: e.imageCredit ?? null,
    imageCaption: e.imageCaption ?? null,

    status: "published",
    validationErrors: null,
    providerUsed: "workersAi",
    modelUsed: "@cf/meta/llama-3.1-8b-instruct",
    tokensIn: 1_240,
    tokensOut: 480,

    publishedAt: e.publishedAt,
    fetchedAt: e.publishedAt + 11 * 60,
    adaptedAt: e.publishedAt + 13 * 60,
    updatedAt: e.publishedAt + 13 * 60,
  };
}

// ---------------------------------------------------------------------------
// articles
// ---------------------------------------------------------------------------

export const ARTIGOS_MOCK: readonly Article[] = [
  artigo({
    slug: "beatificacao-patriarca-elias-hoyek-libano",
    title:
      "Líbano beatifica o patriarca Elias Hoyek diante de multidão em Bkerké",
    dek: "Fundador do Estado libanês moderno e defensor dos cristãos do Oriente, o patriarca maronita foi elevado aos altares numa missa presidida pelo cardeal Bechara Boutros Rai.",
    categorySlug: "vaticano",
    tags: ["Líbano", "Igrejas orientais", "beatificação"],
    source: "ewtn",
    sourceTitle: "Lebanon beatifies Patriarch Elias Hoyek",
    sourceUrl:
      "https://www.ewtnnews.com/news/lebanon-beatifies-patriarch-elias-hoyek",
    sourceAuthor: "ACI MENA",
    publishedAt: HOJE + 9 * HORA,
    imageUrl:
      "https://res.cloudinary.com/ewtn/image/upload/v1785169101/ewtn-news/en/IMG_8844_qalyzn.jpg",
    imageCredit: "Patriarcado Maronita / ACI MENA",
    imageCaption:
      "Missa solene presidida pelo cardeal Bechara Boutros Rai pela beatificação do patriarca Elias Hoyek.",
    bodyMd: `
A sé patriarcal de Bkerké reuniu milhares de fiéis para a beatificação de Elias Hoyek, patriarca maronita entre 1899 e 1931. A celebração foi presidida pelo cardeal Bechara Boutros Rai, atual patriarca de Antioquia dos maronitas, com delegações das Igrejas orientais católicas e representantes do governo libanês.

Hoyek chefiou a delegação libanesa à Conferência de Paz de Paris, em 1919, e é reconhecido no país como uma das figuras centrais na formação das fronteiras do Líbano moderno. Para a Igreja maronita, porém, o argumento da causa foi outro: a caridade exercida durante a Grande Fome do Monte Líbano, quando cerca de um terço da população da região morreu.

## Uma causa de quase noventa anos

O processo diocesano foi aberto ainda na primeira metade do século XX e passou décadas parado. O decreto sobre as virtudes heroicas veio em 2019; o milagre atribuído à intercessão do patriarca foi reconhecido no ano passado.

> “Ele não separou o serviço ao país do serviço à Igreja, e é por isso que continua sendo lido de dois modos ao mesmo tempo”, afirmou o cardeal Rai na homilia.

A festa litúrgica do novo beato foi fixada para 24 de dezembro, data de sua morte. O Líbano decretou ponto facultativo, e as celebrações seguem ao longo da semana nas eparquias maronitas do país e da diáspora.
`,
  }),

  artigo({
    slug: "padre-jacques-hamel-dez-anos-martirio",
    title:
      "Dez anos depois, Rouen recorda o padre Jacques Hamel morto no altar",
    dek: "A diocese normanda reuniu fiéis e autoridades na igreja de Saint-Étienne-du-Rouvray, onde o sacerdote de 85 anos foi assassinado enquanto celebrava a missa.",
    categorySlug: "santos",
    tags: ["França", "martírio", "causa de canonização"],
    source: "ewtn",
    sourceTitle: "France remembers Father Jacques Hamel",
    sourceUrl:
      "https://www.ewtnnews.com/news/france-remembers-father-jacques-hamel",
    sourceAuthor: "EWTN News",
    publishedAt: HOJE + 6 * HORA,
    imageUrl:
      "https://res.cloudinary.com/ewtn/image/upload/v1785175600/ewtn-news/en/Jacques-Hamel-Diocesis-de-Rouen-26072026_qvqqvw_ej7eai.jpg",
    imageCredit: "Diocese de Rouen",
    imageCaption: "Padre Jacques Hamel.",
    bodyMd: `
A igreja de Saint-Étienne-du-Rouvray ficou pequena para a missa desta manhã. Dez anos depois do assassinato do padre Jacques Hamel, morto durante a celebração eucarística em 26 de julho de 2016, a diocese de Rouen reuniu fiéis, autoridades civis e representantes da comunidade muçulmana local no mesmo altar.

O arcebispo Dominique Lebrun lembrou que a causa de beatificação, aberta em 2017 com dispensa do prazo de cinco anos concedida pela Santa Sé, encerrou a fase diocesana e está em Roma. O reconhecimento formal do martírio — a morte aceita *in odium fidei* — é o que falta para a beatificação.

## O gesto que ficou

Testemunhas relataram que o sacerdote, já caído, teria repetido a fórmula do exorcismo. A frase entrou na memória popular francesa e é hoje citada com frequência em contextos que pouco têm a ver com a liturgia.

A paróquia mantém desde então um encontro mensal de oração entre católicos e muçulmanos do bairro. “Não foi uma resposta imediata ao crime”, explicou o pároco atual. “Levou anos, e ainda é difícil.”
`,
  }),

  artigo({
    slug: "santuario-sagrado-coracao-washington-restauracao",
    title:
      "Santuário do Sagrado Coração em Washington conclui restauro do mosaico da abside",
    dek: "Nove meses de trabalho recolocaram cerca de 40 mil tesselas soltas e devolveram à basílica o programa iconográfico projetado nos anos 1920.",
    categorySlug: "patrimonio",
    tags: ["Estados Unidos", "arte sacra", "restauro"],
    source: "ewtn",
    sourceTitle: "Shrine of the Sacred Heart completes mosaic restoration",
    sourceUrl:
      "https://www.ewtnnews.com/news/shrine-sacred-heart-mosaic-restoration",
    sourceAuthor: "Madalaine Elhabbal",
    publishedAt: HOJE - 1 * DIA + 15 * HORA,
    imageUrl:
      "https://res.cloudinary.com/ewtn/image/upload/v1755875080/images/shrine.sacred.heart.dc.jpg",
    imageCredit: "Madalaine Elhabbal / EWTN News",
    imageCaption:
      "Interior do Santuário do Sagrado Coração, em Washington, D.C.",
    bodyMd: `
O Santuário do Sagrado Coração, no bairro de Mount Pleasant, reabriu a nave principal depois de nove meses de obras. O foco foi o mosaico da abside, executado entre 1923 e 1927 e afetado por infiltrações que soltaram milhares de tesselas.

A equipe de restauro trabalhou com um levantamento fotográfico anterior às obras de climatização dos anos 1970 — sem ele, boa parte do desenho original teria sido reconstituída por hipótese. Cerca de 40 mil peças foram recolocadas, e a paleta dourada de fundo foi limpa sem substituição de material.

## Uma paróquia de imigrantes

Fundada por alemães no fim do século XIX, a comunidade celebra hoje em inglês, espanhol e vietnamita. O financiamento veio de doações da própria paróquia e de um fundo diocesano para edifícios históricos.

A basílica volta ao horário normal de missas neste domingo. Visitas guiadas ao programa iconográfico começam no mês que vem.
`,
  }),

  artigo({
    slug: "sinodo-sinodalidade-fase-de-implementacao",
    title:
      "Fase de implementação do Sínodo chega às conferências episcopais",
    dek: "As dioceses têm até março para enviar relatórios sobre como os grupos de estudo mudaram — ou não — a prática local de consulta.",
    categorySlug: "vaticano",
    tags: ["Sínodo", "Cúria Romana", "governo da Igreja"],
    source: "ewtn",
    sourceTitle: "Synod implementation phase reaches bishops' conferences",
    sourceUrl:
      "https://www.ewtnnews.com/news/synod-implementation-phase-bishops-conferences",
    sourceAuthor: "EWTN News",
    publishedAt: HOJE - 1 * DIA + 10 * HORA,
    imageUrl:
      "https://res.cloudinary.com/ewtn/image/upload/v1769207375/sinodo-sinodalidad-daniel-ibanez-ewtn-news-en-vivo-18102024_hm4hr4.webp",
    imageCredit: "Daniel Ibáñez / EWTN News",
    imageCaption:
      "Participantes do Sínodo sobre a sinodalidade na Sala Paulo VI.",
    bodyMd: `
A Secretaria Geral do Sínodo enviou às conferências episcopais o documento que orienta a fase de implementação. O texto pede relatórios até março sobre três pontos: composição dos conselhos pastorais, critérios de escolha de leigos para funções de governo e prestação de contas econômica nas dioceses.

Nenhum dos três é novidade canônica. O que muda é a exigência de resposta escrita e comparável entre países — algo que a Secretaria admite ter faltado nas etapas anteriores, quando as sínteses nacionais chegaram em formatos incompatíveis.

## Os grupos de estudo

Dos dez grupos criados para tratar de questões que o Sínodo não fechou, sete entregaram relatórios preliminares. Os temas mais sensíveis — formação para o ministério ordenado e critérios de seleção de bispos — ficaram para o segundo bloco.

A Secretaria insiste que a fase atual não reabre debates doutrinais. “É trabalho de aplicação, não de redação”, diz o documento.
`,
  }),

  artigo({
    slug: "missal-1962-paroquias-jovens-adultos",
    title: "Por que o missal de 1962 atrai tantos jovens adultos",
    dek: "Levantamento em 14 paróquias norte-americanas encontrou média de idade abaixo dos 35 anos nas comunidades que celebram no rito tradicional.",
    categorySlug: "liturgia",
    tags: ["rito tradicional", "juventude", "estudo"],
    source: "sotc",
    sourceTitle: "Why young adults are drawn to the 1962 missal",
    sourceUrl:
      "https://www.signofthecrossmedia.com/young-adults-1962-missal/",
    sourceAuthor: "Sign of the Cross",
    publishedAt: HOJE - 2 * DIA + 14 * HORA,
    bodyMd: `
Um levantamento conduzido em 14 paróquias dos Estados Unidos encontrou média de idade de 33 anos entre os que frequentam a missa no missal de 1962 — abaixo da média geral das mesmas dioceses, que fica perto dos 51.

Os autores evitam conclusões amplas: a amostra é pequena, voluntária e concentrada em áreas urbanas. Ainda assim, o padrão apareceu nas 14 comunidades, sem exceção.

## O que os entrevistados dizem

Silêncio e previsibilidade foram as duas palavras mais citadas. A terceira, menos esperada, foi *exigência*: os entrevistados descreveram o jejum eucarístico mais longo e a confissão frequente como razões de atração, não de afastamento.

> “Ninguém me pediu para achar bonito. Pediram para eu chegar de estômago vazio e de joelhos”, resumiu um dos participantes, de 29 anos.

O estudo será publicado integralmente no semestre que vem, com o questionário aberto para replicação em outros países.
`,
  }),

  artigo({
    slug: "arcebispo-wenski-quem-e-meu-proximo",
    title:
      "Arcebispo de Miami: “o próximo é aquele que precisa de mim”",
    dek: "Em conferência sobre acolhimento de migrantes, dom Thomas Wenski retomou a parábola do bom samaritano para responder a críticas ao trabalho da Cáritas local.",
    categorySlug: "caridade",
    tags: ["migrantes", "Estados Unidos", "doutrina social"],
    source: "ewtn",
    sourceTitle: "Archbishop Wenski on who is my neighbor",
    sourceUrl: "https://www.ewtnnews.com/news/archbishop-wenski-neighbor",
    sourceAuthor: "Emily Chaffins",
    publishedAt: HOJE - 2 * DIA + 9 * HORA,
    imageUrl:
      "https://res.cloudinary.com/ewtn/image/upload/v1760195143/images/wenski.9.oct.25.2.jpg",
    imageCredit: "Emily Chaffins / CNA",
    imageCaption:
      "Dom Thomas Wenski, arcebispo de Miami, durante conferência sobre migração.",
    bodyMd: `
O arcebispo de Miami, dom Thomas Wenski, defendeu o trabalho das agências católicas de acolhimento numa conferência realizada na arquidiocese. A fala respondia a críticas públicas ao financiamento federal recebido por essas agências.

“O cristão deve responder à pergunta ‘quem é o meu próximo?’, e a resposta é: aquele que precisa de mim”, disse. O arcebispo lembrou que a parábola do bom samaritano não pergunta pela origem do ferido nem por sua situação legal.

## O argumento canônico

Wenski citou o Catecismo e a tradição da doutrina social para separar duas coisas que, segundo ele, andam confundidas no debate: o dever de socorro imediato, que não admite condição, e a política migratória de um Estado, que admite critério e é assunto prudencial.

A arquidiocese mantém abrigos, atendimento jurídico e cursos de idioma. Segundo os dados apresentados, o trabalho alcançou pouco mais de 21 mil pessoas no último ano.
`,
  }),

  artigo({
    slug: "epiclese-liturgia-oriental-glossario",
    title: "Epiclese, anáfora, iconostasis: um glossário do Oriente católico",
    dek: "Vinte e três Igrejas orientais estão em plena comunhão com Roma. O vocabulário delas quase nunca chega ao noticiário em português — e isso empobrece a leitura.",
    categorySlug: "doutrina",
    tags: ["Igrejas orientais", "liturgia", "glossário"],
    source: "sotc",
    sourceTitle: "A glossary of the Catholic East",
    sourceUrl: "https://www.signofthecrossmedia.com/glossary-catholic-east/",
    sourceAuthor: null,
    publishedAt: HOJE - 3 * DIA + 16 * HORA,
    bodyMd: `
Quando uma notícia fala em “patriarca maronita” ou em “eparquia”, o leitor de língua portuguesa costuma encontrar termos sem tradução consolidada. Vale um mapa mínimo.

## Estrutura

**Eparquia** é o equivalente oriental de diocese; quem a governa é o **eparca**. Um conjunto de eparquias sob um patriarca forma uma **Igreja patriarcal** — há seis em comunhão com Roma. **Sui iuris** (“de direito próprio”) é a expressão canônica que descreve a autonomia de governo dessas Igrejas dentro da Igreja católica.

## Liturgia

A **anáfora** é a oração eucarística. Dentro dela, a **epiclese** é a invocação do Espírito Santo sobre os dons — nas tradições orientais, o momento é sublinhado com destaque maior do que no rito romano. O **iconostasis** é a parede de ícones que separa o santuário da nave, e não um mero elemento decorativo: ele organiza o que se vê e o que não se vê.

## Por que isso importa

Traduzir “eparquia” por “diocese” resolve a frase e apaga a distinção. Num portal que cobre a Igreja inteira, a precisão do vocabulário é parte da informação, não enfeite dela.
`,
  }),

  artigo({
    slug: "jmj-preparacao-catequese-paroquial",
    title: "Dioceses começam a montar a catequese preparatória da JMJ",
    dek: "O roteiro de oito encontros substitui o material improvisado das últimas edições e chega às paróquias antes do calendário de inscrições.",
    categorySlug: "juventude",
    tags: ["JMJ", "catequese", "pastoral juvenil"],
    source: "sotc",
    sourceTitle: "Dioceses begin WYD preparatory catechesis",
    sourceUrl:
      "https://www.signofthecrossmedia.com/wyd-preparatory-catechesis/",
    sourceAuthor: null,
    publishedAt: HOJE - 3 * DIA + 11 * HORA,
    bodyMd: `
O material de preparação para a próxima Jornada Mundial da Juventude começou a circular nas dioceses. São oito encontros, pensados para grupos de 10 a 25 jovens, com roteiro de leitura bíblica, questões de conversa e uma proposta de serviço concreto por encontro.

A mudança em relação às edições anteriores é o calendário: o material chega antes das inscrições, e não depois. A avaliação interna das últimas jornadas apontava que a catequese preparatória costumava começar tarde demais para formar grupo.

## O que muda no encontro

Cada sessão fecha com um compromisso verificável — visita, doação de tempo, acompanhamento de alguém da própria paróquia. A intenção declarada é evitar que a preparação vire apenas expectativa de viagem.

Os coordenadores diocesanos recebem formação em dois fins de semana antes do início dos grupos.
`,
  }),

  artigo({
    slug: "missionarios-leigos-amazonia-formacao",
    title: "Formação de missionários leigos volta a crescer depois da pandemia",
    dek: "Os programas de envio de longa duração recuperaram o número de candidatos de 2019, com mudança clara no perfil: mais gente acima dos 40.",
    categorySlug: "missoes",
    tags: ["missão", "leigos", "formação"],
    source: "sotc",
    sourceTitle: "Lay missionary formation recovers",
    sourceUrl:
      "https://www.signofthecrossmedia.com/lay-missionary-formation-recovers/",
    sourceAuthor: null,
    publishedAt: HOJE - 4 * DIA + 13 * HORA,
    bodyMd: `
Os programas católicos de envio de missionários leigos por dois anos ou mais voltaram ao patamar de candidatos de 2019. O dado consolida quatro anos de recuperação depois da interrupção quase total durante a pandemia.

O perfil, porém, mudou. Cresceu a faixa acima dos 40 anos, muitas vezes de pessoas em transição de carreira, e caiu a proporção de recém-formados. Os coordenadores dizem que isso reorganizou a formação: menos ênfase em primeira experiência de vida comunitária, mais em desligamento profissional e cuidado com dependentes.

## Onde estão indo

África subsaariana e Ásia central concentram os envios de longa duração. Programas urbanos em países de origem — trabalho com moradores de rua e migrantes — cresceram mais rápido, mas com duração média menor.

A taxa de retorno antecipado segue perto de 12%, número estável há uma década.
`,
  }),

  artigo({
    slug: "cardeal-cordileone-musica-sacra-formacao",
    title:
      "Cordileone quer música sacra como matéria obrigatória no seminário",
    dek: "A proposta enviada à conferência episcopal norte-americana pede um semestre de canto gregoriano e leitura de partitura para todos os seminaristas.",
    categorySlug: "liturgia",
    tags: ["música sacra", "seminários", "Estados Unidos"],
    source: "ewtn",
    sourceTitle: "Cordileone proposes mandatory sacred music formation",
    sourceUrl:
      "https://www.ewtnnews.com/news/cordileone-sacred-music-seminary",
    sourceAuthor: "Jim Graves",
    publishedAt: HOJE - 4 * DIA + 8 * HORA,
    imageUrl:
      "https://res.cloudinary.com/ewtn/image/upload/v1768336283/Archbishop_Cordileone_at_Walk_for_Life_WC2_64_ivomjh.jpg",
    imageCredit: "Jim Graves",
    imageCaption:
      "Dom Salvatore Cordileone, arcebispo de São Francisco.",
    bodyMd: `
O arcebispo de São Francisco, dom Salvatore Cordileone, apresentou à conferência episcopal uma proposta de inclusão obrigatória de música sacra na grade dos seminários: um semestre de canto gregoriano, leitura de partitura e história do repertório litúrgico.

O argumento é prático. Segundo o texto, a maior parte dos padres ordenados na última década nunca cantou o prefácio numa aula e aprende — quando aprende — na própria paróquia, por imitação.

## Resistências

A objeção mais ouvida é de espaço curricular: a grade já é apertada, e qualquer inclusão empurra outra disciplina. A proposta responde sugerindo integração com a cadeira de liturgia, em vez de matéria autônoma.

O tema entra na pauta da próxima assembleia. Uma decisão sobre diretriz nacional não deve sair antes do ano que vem.
`,
  }),

  artigo({
    slug: "the-chosen-temporada-seis-paixao",
    title: "“The Chosen” chega à Paixão e divide consultores",
    dek: "A sexta temporada encena a crucificação. Assessores históricos e teológicos da série discordam publicamente sobre o grau de licença dramática aceitável.",
    categorySlug: "opiniao",
    tags: ["cultura", "audiovisual", "Paixão"],
    source: "ewtn",
    sourceTitle: "The Chosen reaches the Passion",
    sourceUrl: "https://www.ewtnnews.com/news/the-chosen-season-six-passion",
    sourceAuthor: "EWTN News",
    publishedAt: HOJE - 5 * DIA + 17 * HORA,
    imageUrl:
      "https://res.cloudinary.com/ewtn/image/upload/v1775148907/thechosens6teaserpic_tszcdo.png",
    imageCredit: "5&2 Studios",
    imageCaption:
      "Primeira imagem divulgada da crucificação na sexta temporada de “The Chosen”.",
    bodyMd: `
A divulgação das primeiras imagens da sexta temporada de “The Chosen” reacendeu uma discussão que acompanha a série desde o início: até onde vai a licença dramática quando o material de origem é o Evangelho.

A produção sempre foi explícita quanto ao método — cenas inventadas para dar liga narrativa entre episódios que os textos registram sem conexão. O ponto de atrito agora é outro: a Paixão é narrada com detalhe pelos quatro evangelistas, e o espaço para invenção é proporcionalmente menor.

## Dois campos

Parte dos consultores defende que a fidelidade se mede pelo efeito, não pelo inventário de cenas. Outra parte sustenta que, aqui, acrescentar é subtrair — que qualquer diálogo novo compete com um texto que a maioria dos espectadores conhece de cor.

> “O problema não é inventar. É inventar exatamente onde o texto já é denso.”

A temporada estreia no fim do ano. A produção diz que o roteiro passou por revisão de consultores católicos, ortodoxos e protestantes, e que discordância entre eles era esperada desde o começo.
`,
  }),

  artigo({
    slug: "capuchinhos-reforma-formacao-noviciado",
    title:
      "Capuchinhos revisam formação inicial depois de auditoria interna",
    dek: "A ordem reduz o número de casas de noviciado e centraliza a avaliação psicológica dos candidatos em equipes regionais.",
    categorySlug: "vaticano",
    tags: ["vida religiosa", "formação", "governo da Igreja"],
    source: "ewtn",
    sourceTitle: "Capuchins revise initial formation",
    sourceUrl: "https://www.ewtnnews.com/news/capuchins-revise-formation",
    sourceAuthor: "EWTN News",
    publishedAt: HOJE - 5 * DIA + 12 * HORA,
    bodyMd: `
A ordem dos Frades Menores Capuchinhos aprovou uma revisão da formação inicial depois de uma auditoria interna sobre os processos de admissão. As duas mudanças principais são a redução do número de casas de noviciado e a centralização da avaliação psicológica em equipes regionais, fora da casa que recebe o candidato.

A separação entre quem avalia e quem acolhe é o ponto central. Segundo o relatório, formadores acumulavam papéis incompatíveis — acompanhamento espiritual e decisão sobre admissão — o que comprometia as duas funções.

## Cronograma

A implementação começa no próximo ciclo formativo. Províncias com menos de cinco noviços passam a enviar candidatos a casas interprovinciais.

O documento também fixa prazo mínimo entre o primeiro contato e a entrada no postulantado, algo que variava de semanas a anos entre províncias.
`,
  }),

  artigo({
    slug: "primeiros-sabados-devocao-fatima-parroquias",
    title:
      "A devoção dos Primeiros Sábados volta ao calendário de paróquias urbanas",
    dek: "Cinco sábados consecutivos, confissão, comunhão, terço e quinze minutos de meditação: a prática pedida em Fátima ganhou horários fixos em dioceses de grande porte.",
    categorySlug: "santos",
    tags: ["Fátima", "devoção mariana", "paróquias"],
    source: "sotc",
    sourceTitle: "First Saturdays devotion returns to urban parishes",
    sourceUrl:
      "https://www.signofthecrossmedia.com/first-saturdays-urban-parishes/",
    sourceAuthor: null,
    publishedAt: HOJE - 6 * DIA + 10 * HORA,
    bodyMd: `
A devoção dos cinco Primeiros Sábados, associada às aparições de Fátima, voltou a ter horário fixo em paróquias de grandes centros. O formato é o mesmo desde 1925: confissão, comunhão, terço e quinze minutos de meditação sobre os mistérios, em cinco sábados consecutivos.

O que mudou foi a logística. Paróquias urbanas passaram a concentrar confessores no primeiro sábado do mês, com escala combinada entre comunidades vizinhas — a queixa recorrente era encontrar confissão disponível no horário certo.

## O detalhe que mais se perde

Os quinze minutos de meditação são a parte mais esquecida da prática, segundo os coordenadores. Não é o terço, e não é leitura: é permanecer com um dos mistérios, em silêncio, pelo tempo indicado.

Várias paróquias passaram a reservar a igreja aberta e em silêncio depois da missa matinal, sem música e sem avisos, justamente para isso.
`,
  }),
] as const;

// ---------------------------------------------------------------------------
// liturgical_days — calendário TRADICIONAL de 1962
// ---------------------------------------------------------------------------

/**
 * Note a ausência de salmo responsorial: ele não existe na missa tridentina.
 * O par é `epistle` / `gospel`, e é assim que a UI apresenta.
 */
const FONTE_LITURGIA = "https://salvemaria.com.br/calendario/";

function dia(d: Omit<LiturgicalDay, "sourceUrl" | "fetchedAt">): LiturgicalDay {
  return { ...d, sourceUrl: FONTE_LITURGIA, fetchedAt: HOJE - 20 * DIA };
}

export const LITURGIA_MOCK: readonly LiturgicalDay[] = [
  dia({
    date: "2026-07-25",
    weekday: "Sábado",
    feast: "S. Tiago Maior, Apóstolo",
    commemoration: "Com. de S. Cristóvão, Mártir",
    classis: "2ª classe",
    marianSaint: "S. Tiago Maior",
    color: "Vermelho",
    gloria: true,
    credo: true,
    preface: "Prefácio dos Apóstolos",
    note: null,
    epistle: "1Cor 4, 9-15",
    gospel: "Mt 20, 20-23",
  }),
  dia({
    date: "2026-07-26",
    weekday: "Domingo",
    feast: "IX Domingo depois de Pentecostes",
    commemoration: "Com. de Sant’Ana, Mãe de N. Senhora",
    classis: "2ª classe",
    marianSaint: "Sant’Ana",
    color: "Verde",
    gloria: true,
    credo: true,
    preface: "Prefácio da Santíssima Trindade",
    note: null,
    epistle: "1Cor 10, 6-13",
    gospel: "Lc 19, 41-47",
  }),
  dia({
    date: "2026-07-27",
    weekday: "Segunda-feira",
    feast: "Féria",
    commemoration: "Com. de S. Pantaleão, Mártir",
    classis: "4ª classe",
    marianSaint: "S. Pantaleão",
    color: "Verde",
    gloria: false,
    credo: false,
    preface: "Prefácio da Santíssima Trindade",
    note: "Missa do domingo anterior",
    epistle: "1Cor 10, 6-13",
    gospel: "Lc 19, 41-47",
  }),
  dia({
    date: "2026-07-28",
    weekday: "Terça-feira",
    feast: "S. Nazário e S. Celso, Mártires, S. Vítor I, Papa e Mártir, e S. Inocêncio I, Papa e Confessor",
    commemoration: null,
    classis: "3ª classe",
    marianSaint: "S. Vítor I",
    color: "Vermelho",
    gloria: true,
    credo: false,
    preface: "Prefácio Comum",
    note: null,
    epistle: "Sb 3, 1-8",
    gospel: "Lc 21, 9-19",
  }),
  dia({
    date: "2026-07-29",
    weekday: "Quarta-feira",
    feast: "Santa Marta, Virgem",
    commemoration: "Com. de S. Félix, S. Simplício, S. Faustino e S. Beatriz",
    classis: "3ª classe",
    marianSaint: "Santa Marta",
    color: "Branco",
    gloria: true,
    credo: false,
    preface: "Prefácio Comum",
    note: null,
    epistle: "2Cor 10, 17-18; 11, 1-2",
    gospel: "Lc 10, 38-42",
  }),
  dia({
    date: "2026-07-30",
    weekday: "Quinta-feira",
    feast: "Féria",
    commemoration: "Com. de S. Abdon e S. Senen, Mártires",
    classis: "4ª classe",
    marianSaint: "S. Abdon",
    color: "Verde",
    gloria: false,
    credo: false,
    preface: "Prefácio da Santíssima Trindade",
    note: "Missa do domingo anterior",
    epistle: "1Cor 10, 6-13",
    gospel: "Lc 19, 41-47",
  }),
  dia({
    date: "2026-07-31",
    weekday: "Sexta-feira",
    feast: "S. Inácio de Loyola, Confessor",
    commemoration: null,
    classis: "3ª classe",
    marianSaint: "S. Inácio de Loyola",
    color: "Branco",
    gloria: true,
    credo: false,
    preface: "Prefácio Comum",
    note: "Abstinência de carne",
    epistle: "2Tm 2, 8-10; 3, 10-12",
    gospel: "Lc 10, 1-9",
  }),
  dia({
    date: "2026-08-01",
    weekday: "Sábado",
    feast: "Féria",
    commemoration: "Com. dos Santos Macabeus, Mártires",
    classis: "4ª classe",
    marianSaint: "Santos Macabeus",
    color: "Verde",
    gloria: false,
    credo: false,
    preface: "Prefácio da Santíssima Trindade",
    note: "Primeiro Sábado",
    epistle: "1Cor 10, 6-13",
    gospel: "Lc 19, 41-47",
  }),
  dia({
    date: "2026-08-02",
    weekday: "Domingo",
    feast: "X Domingo depois de Pentecostes",
    commemoration: "Com. de S. Afonso Maria de Ligório, Bispo e Doutor",
    classis: "2ª classe",
    marianSaint: "S. Afonso Maria de Ligório",
    color: "Verde",
    gloria: true,
    credo: true,
    preface: "Prefácio da Santíssima Trindade",
    note: null,
    epistle: "1Cor 12, 2-11",
    gospel: "Lc 18, 9-14",
  }),
] as const;

// ---------------------------------------------------------------------------
// Consultas — mesma assinatura que os services do D1 vão expor na Fase 2
// ---------------------------------------------------------------------------

const PUBLICADOS: readonly Article[] = [...ARTIGOS_MOCK]
  .filter((a) => a.status === "published")
  .sort((a, b) => b.publishedAt - a.publishedAt);

const POR_SLUG = new Map(PUBLICADOS.map((a) => [a.slug, a]));

/** Feed da capa, do mais recente para o mais antigo. */
export function listarPublicados(limite?: number): readonly Article[] {
  return limite === undefined ? PUBLICADOS : PUBLICADOS.slice(0, limite);
}

export function buscarPorSlug(slug: string): Article | undefined {
  return POR_SLUG.get(slug);
}

export function listarPorCategoria(
  categoria: string,
  limite?: number,
): readonly Article[] {
  const lista = PUBLICADOS.filter((a) => a.categorySlug === categoria);
  return limite === undefined ? lista : lista.slice(0, limite);
}

/** Categorias que realmente têm conteúdo. É o que impede seção morta na UI. */
export function categoriasComConteudo(): readonly string[] {
  const vistas = new Set<string>();
  for (const a of PUBLICADOS) vistas.add(a.categorySlug);
  return [...vistas];
}

/**
 * Relacionados: mesma categoria primeiro, completando com os mais recentes.
 * Nunca devolve o próprio artigo.
 */
export function listarRelacionados(
  artigo: Article,
  limite = 3,
): readonly Article[] {
  const mesmaCategoria = PUBLICADOS.filter(
    (a) => a.slug !== artigo.slug && a.categorySlug === artigo.categorySlug,
  );
  if (mesmaCategoria.length >= limite) return mesmaCategoria.slice(0, limite);

  const jaEscolhidos = new Set(mesmaCategoria.map((a) => a.slug));
  const complemento = PUBLICADOS.filter(
    (a) => a.slug !== artigo.slug && !jaEscolhidos.has(a.slug),
  );
  return [...mesmaCategoria, ...complemento].slice(0, limite);
}

const LITURGIA_POR_DATA = new Map(LITURGIA_MOCK.map((d) => [d.date, d]));

/**
 * Liturgia de uma data `YYYY-MM-DD`.
 *
 * O mock cobre uma janela curta de dias. Fora dela devolvemos `undefined` em
 * vez de um dia qualquer — a UI precisa saber lidar com a ausência, porque em
 * produção ela acontece de verdade (raspagem anual que falhou, ano virado).
 */
export function buscarLiturgia(data: string): LiturgicalDay | undefined {
  return LITURGIA_POR_DATA.get(data);
}

/**
 * Fallback de vitrine: o dia mais próximo disponível.
 * Só existe porque os dados são mockados e a data real de quem abre o site é
 * imprevisível. Na Fase 2 isto sai e vira consulta ao D1.
 */
export function buscarLiturgiaMaisProxima(data: string): LiturgicalDay {
  const exata = LITURGIA_POR_DATA.get(data);
  if (exata) return exata;

  let maisProxima = LITURGIA_MOCK[0];
  let menorDistancia = Number.POSITIVE_INFINITY;
  const alvo = Date.parse(`${data}T12:00:00Z`);

  for (const d of LITURGIA_MOCK) {
    const distancia = Math.abs(Date.parse(`${d.date}T12:00:00Z`) - alvo);
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      maisProxima = d;
    }
  }
  return maisProxima;
}

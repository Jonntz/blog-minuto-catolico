/**
 * Glossário católico EN → PT-BR.
 *
 * Isto é DADO VERSIONADO, não prompt ad-hoc. Está aqui — e não embutido numa
 * string de prompt — por três razões:
 *
 *   1. Um erro de terminologia doutrinária é revisável em code review e tem
 *      histórico no git. Um erro dentro de um template de prompt não tem.
 *   2. O glossário é usado em DOIS lugares: injetado no prompt do sistema e
 *      verificado deterministicamente pelos guard-rails (ver
 *      `TERMOS_QUE_EXIGEM_TRADUCAO`). Um modelo fraco ignora instrução; regex
 *      não ignora.
 *   3. Adicionar termo não exige tocar em lógica.
 *
 * ---------------------------------------------------------------------------
 * NOTA DE CUSTO (relevante se um dia trocarmos de provider)
 * ---------------------------------------------------------------------------
 * Com o provider `anthropic`, este bloco é o candidato natural a *prompt
 * caching*: é grande, é idêntico em toda chamada e vem antes do conteúdo
 * variável. Marcando-o com `cache_control: { type: "ephemeral" }` os tokens
 * dele passariam a custar uma fração na segunda chamada em diante.
 *
 * Com o provider `workersAi` (o padrão hoje) **não existe prompt caching**: o
 * glossário é reenviado e re-tokenizado a cada chamada, consumindo Neurons da
 * cota diária toda vez. É por isso que `montarBlocoGlossario()` aceita filtro
 * por tipo — mandar as ~180 entradas em toda requisição é desperdício de cota.
 * A adaptação manda o núcleo; o verificador factual não precisa de glossário
 * nenhum.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export const TIPOS_GLOSSARIO = [
  /** Órgãos, sedes, conferências, tribunais. */
  "instituicao",
  /** Tratamentos e títulos eclesiásticos. */
  "titulo",
  /** Vocabulário das causas dos santos. */
  "processo",
  /** Vocabulário do rito romano de 1962 (missa tridentina). */
  "rito1962",
  /** Hagiônimos com forma consagrada em PT-BR. */
  "santo",
  /** Documentos pontifícios e atos de magistério. */
  "documento",
  /** Doutrina, sacramentos, devoções, tempos litúrgicos. */
  "doutrina",
] as const;

export type TipoGlossario = (typeof TIPOS_GLOSSARIO)[number];

export interface EntradaGlossario {
  /** Forma em inglês, como aparece nas fontes. */
  en: string;
  /** Forma consagrada em português do Brasil. */
  pt: string;
  tipo: TipoGlossario;
  /**
   * Explicação que vai junto no prompt quando presente. Use para armadilhas —
   * não para repetir o óbvio, porque cada caractere aqui é token gasto.
   */
  nota?: string;
  /**
   * `true` quando encontrar a forma EN literal no texto adaptado é, por si só,
   * prova de falha de tradução. Só marque em termos multi-palavra e sem
   * ambiguidade: "Pope" pode aparecer legitimamente dentro do nome oficial em
   * inglês de uma instituição; "Holy See" no meio de um texto em português,
   * não.
   */
  exigirTraducao?: boolean;
}

// ---------------------------------------------------------------------------
// Instituições
// ---------------------------------------------------------------------------

const INSTITUICOES: readonly EntradaGlossario[] = [
  { en: "Holy See", pt: "Santa Sé", tipo: "instituicao", exigirTraducao: true },
  {
    en: "Apostolic See",
    pt: "Sé Apostólica",
    tipo: "instituicao",
    exigirTraducao: true,
  },
  {
    en: "Dicastery",
    pt: "Dicastério",
    tipo: "instituicao",
    exigirTraducao: true,
    nota: "Desde a Praedicate Evangelium (2022) substituiu 'Congregação' e 'Pontifício Conselho' na maioria dos casos.",
  },
  {
    en: "Roman Curia",
    pt: "Cúria Romana",
    tipo: "instituicao",
    exigirTraducao: true,
  },
  {
    en: "Episcopal Conference",
    pt: "Conferência Episcopal",
    tipo: "instituicao",
    exigirTraducao: true,
    nota: "A do Brasil é a CNBB — Conferência Nacional dos Bispos do Brasil.",
  },
  {
    en: "Bishops' Conference",
    pt: "Conferência Episcopal",
    tipo: "instituicao",
    exigirTraducao: true,
  },
  {
    en: "Secretariat of State",
    pt: "Secretaria de Estado",
    tipo: "instituicao",
  },
  {
    en: "Congregation",
    pt: "Congregação",
    tipo: "instituicao",
    nota: "Cuidado: também significa a assembleia dos fiéis. Pelo contexto.",
  },
  { en: "Pontifical Council", pt: "Pontifício Conselho", tipo: "instituicao" },
  {
    en: "Apostolic Nunciature",
    pt: "Nunciatura Apostólica",
    tipo: "instituicao",
  },
  { en: "Apostolic Nuncio", pt: "Núncio Apostólico", tipo: "instituicao" },
  {
    en: "College of Cardinals",
    pt: "Colégio Cardinalício",
    tipo: "instituicao",
    exigirTraducao: true,
  },
  { en: "Synod of Bishops", pt: "Sínodo dos Bispos", tipo: "instituicao" },
  { en: "Consistory", pt: "Consistório", tipo: "instituicao" },
  { en: "Conclave", pt: "Conclave", tipo: "instituicao" },
  { en: "Roman Rota", pt: "Rota Romana", tipo: "instituicao" },
  {
    en: "Apostolic Penitentiary",
    pt: "Penitenciaria Apostólica",
    tipo: "instituicao",
  },
  {
    en: "Holy Office",
    pt: "Santo Ofício",
    tipo: "instituicao",
    nota: "Hoje Dicastério para a Doutrina da Fé. Use a forma histórica só em contexto histórico.",
  },
  { en: "Archdiocese", pt: "Arquidiocese", tipo: "instituicao" },
  { en: "Diocese", pt: "Diocese", tipo: "instituicao" },
  { en: "Eparchy", pt: "Eparquia", tipo: "instituicao" },
  { en: "Prelature", pt: "Prelazia", tipo: "instituicao" },
  { en: "Vicariate", pt: "Vicariato", tipo: "instituicao" },
  { en: "parish", pt: "paróquia", tipo: "instituicao" },
  { en: "seminary", pt: "seminário", tipo: "instituicao" },
  { en: "Chair of St. Peter", pt: "Cátedra de São Pedro", tipo: "instituicao" },
  {
    en: "St. Peter's Basilica",
    pt: "Basílica de São Pedro",
    tipo: "instituicao",
  },
  { en: "St. Peter's Square", pt: "Praça de São Pedro", tipo: "instituicao" },
  {
    en: "Sistine Chapel",
    pt: "Capela Sistina",
    tipo: "instituicao",
  },
  {
    en: "Apostolic Palace",
    pt: "Palácio Apostólico",
    tipo: "instituicao",
  },
  {
    en: "Vatican City State",
    pt: "Estado da Cidade do Vaticano",
    tipo: "instituicao",
  },
];

// ---------------------------------------------------------------------------
// Títulos e tratamentos
// ---------------------------------------------------------------------------

const TITULOS: readonly EntradaGlossario[] = [
  {
    en: "His Holiness",
    pt: "Sua Santidade",
    tipo: "titulo",
    exigirTraducao: true,
  },
  {
    en: "His Eminence",
    pt: "Sua Eminência",
    tipo: "titulo",
    exigirTraducao: true,
    nota: "Tratamento de cardeal.",
  },
  {
    en: "His Excellency",
    pt: "Sua Excelência",
    tipo: "titulo",
    exigirTraducao: true,
    nota: "Tratamento de bispo e arcebispo.",
  },
  {
    en: "Msgr.",
    pt: "Mons.",
    tipo: "titulo",
    nota: "Abreviação de Monsenhor. Sempre abreviado antes de nome próprio.",
  },
  { en: "Monsignor", pt: "Monsenhor", tipo: "titulo" },
  {
    en: "Fr.",
    pt: "Pe.",
    tipo: "titulo",
    nota: "Padre. NUNCA 'Fr.' em português — 'Fr.' em PT é Frei, outra coisa.",
  },
  { en: "Father", pt: "Padre", tipo: "titulo" },
  { en: "Friar", pt: "Frei", tipo: "titulo" },
  { en: "Bishop", pt: "Bispo", tipo: "titulo" },
  { en: "Archbishop", pt: "Arcebispo", tipo: "titulo" },
  { en: "Cardinal", pt: "Cardeal", tipo: "titulo" },
  { en: "Pope", pt: "Papa", tipo: "titulo" },
  { en: "Pontiff", pt: "Pontífice", tipo: "titulo" },
  { en: "Roman Pontiff", pt: "Romano Pontífice", tipo: "titulo" },
  { en: "Supreme Pontiff", pt: "Sumo Pontífice", tipo: "titulo" },
  { en: "Holy Father", pt: "Santo Padre", tipo: "titulo", exigirTraducao: true },
  { en: "Patriarch", pt: "Patriarca", tipo: "titulo" },
  { en: "Primate", pt: "Primaz", tipo: "titulo" },
  { en: "Prelate", pt: "Prelado", tipo: "titulo" },
  { en: "Deacon", pt: "Diácono", tipo: "titulo" },
  { en: "Abbot", pt: "Abade", tipo: "titulo" },
  { en: "Abbess", pt: "Abadessa", tipo: "titulo" },
  { en: "Sister", pt: "Irmã", tipo: "titulo", nota: "Abreviação: Ir." },
  { en: "Brother", pt: "Irmão", tipo: "titulo", nota: "Abreviação: Ir." },
  { en: "Superior General", pt: "Superior-Geral", tipo: "titulo" },
  { en: "Vicar General", pt: "Vigário-Geral", tipo: "titulo" },
  { en: "Rector", pt: "Reitor", tipo: "titulo" },
  { en: "Provost", pt: "Preboste", tipo: "titulo" },
  {
    en: "Emeritus",
    pt: "Emérito",
    tipo: "titulo",
    nota: "Concorda em gênero e número: bispo emérito, arcebispa emérita não existe.",
  },
  {
    en: "Cardinal-elect",
    pt: "Cardeal nomeado",
    tipo: "titulo",
    nota: "Evite 'cardeal eleito' — cardeal não é eleito, é criado pelo Papa.",
  },
  { en: "the faithful", pt: "os fiéis", tipo: "titulo" },
  { en: "laity", pt: "leigos", tipo: "titulo" },
  { en: "clergy", pt: "clero", tipo: "titulo" },
];

// ---------------------------------------------------------------------------
// Causas dos santos
// ---------------------------------------------------------------------------

const PROCESSOS: readonly EntradaGlossario[] = [
  {
    en: "positio",
    pt: "positio",
    tipo: "processo",
    nota: "Latim. NÃO traduzir. É o dossiê submetido ao Dicastério. Em itálico.",
  },
  { en: "beatification", pt: "beatificação", tipo: "processo" },
  { en: "canonization", pt: "canonização", tipo: "processo" },
  {
    en: "cause for sainthood",
    pt: "causa de canonização",
    tipo: "processo",
    exigirTraducao: true,
    nota: "Também aceitável: 'processo de canonização'. Evite 'causa de santidade'.",
  },
  {
    en: "cause for beatification",
    pt: "causa de beatificação",
    tipo: "processo",
    exigirTraducao: true,
  },
  {
    en: "Servant of God",
    pt: "Servo de Deus",
    tipo: "processo",
    exigirTraducao: true,
    nota: "Primeiro grau. Feminino: Serva de Deus.",
  },
  {
    en: "Venerable",
    pt: "Venerável",
    tipo: "processo",
    nota: "Segundo grau, após o decreto de virtudes heroicas.",
  },
  {
    en: "Blessed",
    pt: "Beato",
    tipo: "processo",
    nota: "Terceiro grau. Feminino: Beata. Como adjetivo comum ('blessed are'), traduza por 'bem-aventurado'.",
  },
  {
    en: "heroic virtues",
    pt: "virtudes heroicas",
    tipo: "processo",
    exigirTraducao: true,
  },
  { en: "martyrdom", pt: "martírio", tipo: "processo" },
  {
    en: "decree of martyrdom",
    pt: "decreto de martírio",
    tipo: "processo",
    exigirTraducao: true,
  },
  {
    en: "in odium fidei",
    pt: "in odium fidei",
    tipo: "processo",
    nota: "Latim. NÃO traduzir. 'Por ódio à fé' pode vir entre parênteses.",
  },
  { en: "miracle", pt: "milagre", tipo: "processo" },
  {
    en: "approved miracle",
    pt: "milagre aprovado",
    tipo: "processo",
    exigirTraducao: true,
  },
  { en: "postulator", pt: "postulador", tipo: "processo" },
  { en: "relator", pt: "relator", tipo: "processo" },
  {
    en: "Promoter of the Faith",
    pt: "Promotor da Fé",
    tipo: "processo",
    nota: "O informal 'advogado do diabo' em inglês. Prefira o nome oficial.",
  },
  {
    en: "Dicastery for the Causes of Saints",
    pt: "Dicastério para as Causas dos Santos",
    tipo: "processo",
    exigirTraducao: true,
  },
  { en: "nihil obstat", pt: "nihil obstat", tipo: "processo", nota: "Latim." },
  {
    en: "equipollent canonization",
    pt: "canonização equipolente",
    tipo: "processo",
  },
  { en: "relics", pt: "relíquias", tipo: "processo" },
  { en: "incorrupt", pt: "incorrupto", tipo: "processo" },
];

// ---------------------------------------------------------------------------
// Rito romano de 1962 — o bloco mais sensível do glossário
// ---------------------------------------------------------------------------

/**
 * ATENÇÃO EDITORIAL: o Minuto Católico segue o calendário e o missal de
 * 1962 (ver MEMORY.md §2.5). Modelos de linguagem foram treinados
 * majoritariamente em texto do Novus Ordo e "corrigem" terminologia tridentina
 * para a moderna sem avisar. É por isso que existe `TERMOS_NOVUS_ORDO_VETADOS`
 * logo abaixo e um guard-rail dedicado.
 */
const RITO_1962: readonly EntradaGlossario[] = [
  {
    en: "Epistle",
    pt: "Epístola",
    tipo: "rito1962",
    exigirTraducao: true,
    nota: "No rito de 1962 é a PRIMEIRA e única leitura antes do Evangelho. Nunca 'primeira leitura'.",
  },
  {
    en: "Gospel",
    pt: "Evangelho",
    tipo: "rito1962",
  },
  {
    en: "Commemoration",
    pt: "Comemoração",
    tipo: "rito1962",
    nota: "Festa secundária comemorada dentro da missa do dia (orações próprias acrescentadas).",
  },
  {
    en: "Feria",
    pt: "Féria",
    tipo: "rito1962",
    nota: "Dia sem festa própria. Com acento em português.",
  },
  {
    en: "Class",
    pt: "Classe",
    tipo: "rito1962",
    nota: "Grau da festa: 1ª a 4ª classe. NÃO é 'solenidade/festa/memória' — essa é a escala do Novus Ordo.",
  },
  { en: "Preface", pt: "Prefácio", tipo: "rito1962" },
  {
    en: "Proper",
    pt: "Próprio",
    tipo: "rito1962",
    nota: "As partes variáveis da missa. Substantivo, com maiúscula quando 'o Próprio do dia'.",
  },
  {
    en: "Ordinary",
    pt: "Ordinário",
    tipo: "rito1962",
    nota: "As partes fixas da missa. Cuidado: 'the local Ordinary' é o bispo diocesano — aí é 'o Ordinário local'.",
  },
  { en: "Collect", pt: "Coleta", tipo: "rito1962" },
  { en: "Secret", pt: "Secreta", tipo: "rito1962" },
  { en: "Postcommunion", pt: "Pós-comunhão", tipo: "rito1962" },
  { en: "Introit", pt: "Intróito", tipo: "rito1962" },
  { en: "Gradual", pt: "Gradual", tipo: "rito1962" },
  { en: "Tract", pt: "Trato", tipo: "rito1962" },
  { en: "Sequence", pt: "Sequência", tipo: "rito1962" },
  { en: "Offertory", pt: "Ofertório", tipo: "rito1962" },
  { en: "Communion antiphon", pt: "Antífona da comunhão", tipo: "rito1962" },
  { en: "Last Gospel", pt: "Último Evangelho", tipo: "rito1962" },
  { en: "Asperges", pt: "Asperges", tipo: "rito1962", nota: "Latim." },
  { en: "Canon of the Mass", pt: "Cânon da Missa", tipo: "rito1962" },
  {
    en: "Traditional Latin Mass",
    pt: "Missa tridentina",
    tipo: "rito1962",
    exigirTraducao: true,
    nota: "Também: 'Missa em rito tridentino', 'Missa no rito de 1962'.",
  },
  {
    en: "Extraordinary Form",
    pt: "Forma extraordinária",
    tipo: "rito1962",
    exigirTraducao: true,
  },
  { en: "Solemn High Mass", pt: "Missa solene", tipo: "rito1962" },
  { en: "Missa cantata", pt: "Missa cantada", tipo: "rito1962" },
  { en: "Low Mass", pt: "Missa rezada", tipo: "rito1962" },
  { en: "Divine Office", pt: "Ofício Divino", tipo: "rito1962" },
  { en: "Breviary", pt: "Breviário", tipo: "rito1962" },
  { en: "Ember Days", pt: "Têmporas", tipo: "rito1962", exigirTraducao: true },
  { en: "Rogation Days", pt: "Rogações", tipo: "rito1962" },
  {
    en: "Septuagesima",
    pt: "Septuagésima",
    tipo: "rito1962",
    nota: "Tempo que só existe no calendário de 1962 — foi suprimido no Novus Ordo.",
  },
  { en: "Passiontide", pt: "Tempo da Paixão", tipo: "rito1962" },
  {
    en: "Sunday after Pentecost",
    pt: "Domingo depois de Pentecostes",
    tipo: "rito1962",
    exigirTraducao: true,
    nota: "A contagem de 1962. NÃO converter para 'Domingo do Tempo Comum'.",
  },
  { en: "Octave", pt: "Oitava", tipo: "rito1962" },
  { en: "Vigil", pt: "Vigília", tipo: "rito1962" },
  { en: "Vespers", pt: "Vésperas", tipo: "rito1962" },
  { en: "Compline", pt: "Completas", tipo: "rito1962" },
  { en: "Matins", pt: "Matinas", tipo: "rito1962" },
  { en: "Lauds", pt: "Laudes", tipo: "rito1962" },
  { en: "chasuble", pt: "casula", tipo: "rito1962" },
  { en: "maniple", pt: "manípulo", tipo: "rito1962" },
  { en: "cope", pt: "pluvial", tipo: "rito1962" },
  { en: "altar rail", pt: "balaustrada", tipo: "rito1962" },
  { en: "ad orientem", pt: "ad orientem", tipo: "rito1962", nota: "Latim." },
];

// ---------------------------------------------------------------------------
// Hagiônimos
// ---------------------------------------------------------------------------

const SANTOS: readonly EntradaGlossario[] = [
  {
    en: "St. Therese of Lisieux",
    pt: "Santa Teresinha do Menino Jesus",
    tipo: "santo",
    exigirTraducao: true,
    nota: "Em PT-BR a forma consagrada é 'Teresinha', não 'Teresa de Lisieux'.",
  },
  {
    en: "St. Teresa of Ávila",
    pt: "Santa Teresa d'Ávila",
    tipo: "santo",
    nota: "Distinta de Teresinha. Doutora da Igreja, carmelita.",
  },
  { en: "St. Thomas Aquinas", pt: "São Tomás de Aquino", tipo: "santo" },
  {
    en: "St. Augustine",
    pt: "Santo Agostinho",
    tipo: "santo",
    nota: "'Santo' antes de vogal ou H; 'São' antes de consoante.",
  },
  { en: "St. Francis of Assisi", pt: "São Francisco de Assis", tipo: "santo" },
  {
    en: "St. Anthony of Padua",
    pt: "Santo Antônio de Pádua",
    tipo: "santo",
    nota: "No Brasil também 'Santo Antônio de Lisboa'.",
  },
  { en: "St. Joseph", pt: "São José", tipo: "santo" },
  { en: "St. Jerome", pt: "São Jerônimo", tipo: "santo" },
  { en: "St. Ignatius of Loyola", pt: "Santo Inácio de Loyola", tipo: "santo" },
  {
    en: "St. Alphonsus Liguori",
    pt: "Santo Afonso Maria de Ligório",
    tipo: "santo",
  },
  { en: "St. Charles Borromeo", pt: "São Carlos Borromeu", tipo: "santo" },
  { en: "St. John Vianney", pt: "São João Maria Vianney", tipo: "santo" },
  { en: "St. Catherine of Siena", pt: "Santa Catarina de Sena", tipo: "santo" },
  {
    en: "St. Padre Pio",
    pt: "São Pio de Pietrelcina",
    tipo: "santo",
    nota: "Popularmente 'Padre Pio'; a forma canônica é 'São Pio de Pietrelcina'.",
  },
  { en: "St. Pius X", pt: "São Pio X", tipo: "santo" },
  { en: "St. John Paul II", pt: "São João Paulo II", tipo: "santo" },
  {
    en: "St. Maximilian Kolbe",
    pt: "São Maximiliano Maria Kolbe",
    tipo: "santo",
  },
  { en: "St. Faustina", pt: "Santa Faustina Kowalska", tipo: "santo" },
  { en: "St. Benedict", pt: "São Bento", tipo: "santo" },
  { en: "St. Dominic", pt: "São Domingos de Gusmão", tipo: "santo" },
  { en: "St. Michael the Archangel", pt: "São Miguel Arcanjo", tipo: "santo" },
  { en: "St. John the Baptist", pt: "São João Batista", tipo: "santo" },
  { en: "St. Stephen", pt: "Santo Estêvão", tipo: "santo" },
  {
    en: "Blessed Virgin Mary",
    pt: "Bem-aventurada Virgem Maria",
    tipo: "santo",
    exigirTraducao: true,
  },
  {
    en: "Our Lady of Guadalupe",
    pt: "Nossa Senhora de Guadalupe",
    tipo: "santo",
    exigirTraducao: true,
  },
  {
    en: "Our Lady of Fatima",
    pt: "Nossa Senhora de Fátima",
    tipo: "santo",
    exigirTraducao: true,
  },
  {
    en: "Our Lady of Aparecida",
    pt: "Nossa Senhora Aparecida",
    tipo: "santo",
    exigirTraducao: true,
    nota: "Padroeira do Brasil. Sem 'de'.",
  },
  {
    en: "Our Lady of Sorrows",
    pt: "Nossa Senhora das Dores",
    tipo: "santo",
    exigirTraducao: true,
  },
];

// ---------------------------------------------------------------------------
// Documentos e atos de magistério
// ---------------------------------------------------------------------------

const DOCUMENTOS: readonly EntradaGlossario[] = [
  { en: "encyclical", pt: "encíclica", tipo: "documento" },
  {
    en: "apostolic exhortation",
    pt: "exortação apostólica",
    tipo: "documento",
    exigirTraducao: true,
  },
  {
    en: "apostolic constitution",
    pt: "constituição apostólica",
    tipo: "documento",
    exigirTraducao: true,
  },
  {
    en: "apostolic letter",
    pt: "carta apostólica",
    tipo: "documento",
    exigirTraducao: true,
  },
  {
    en: "motu proprio",
    pt: "motu proprio",
    tipo: "documento",
    nota: "Latim. NÃO traduzir. Em itálico.",
  },
  { en: "papal bull", pt: "bula", tipo: "documento" },
  { en: "decree", pt: "decreto", tipo: "documento" },
  { en: "rescript", pt: "rescrito", tipo: "documento" },
  { en: "general audience", pt: "audiência geral", tipo: "documento" },
  {
    en: "Angelus",
    pt: "Angelus",
    tipo: "documento",
    nota: "Não traduzir. A oração e o discurso dominical.",
  },
  {
    en: "Urbi et Orbi",
    pt: "Urbi et Orbi",
    tipo: "documento",
    nota: "Latim. Não traduzir.",
  },
  { en: "homily", pt: "homilia", tipo: "documento" },
  { en: "Magisterium", pt: "Magistério", tipo: "documento" },
  { en: "Code of Canon Law", pt: "Código de Direito Canônico", tipo: "documento", exigirTraducao: true },
  {
    en: "Catechism of the Catholic Church",
    pt: "Catecismo da Igreja Católica",
    tipo: "documento",
    exigirTraducao: true,
  },
  { en: "Second Vatican Council", pt: "Concílio Vaticano II", tipo: "documento", exigirTraducao: true },
  { en: "Council of Trent", pt: "Concílio de Trento", tipo: "documento", exigirTraducao: true },
];

// ---------------------------------------------------------------------------
// Doutrina, sacramentos, devoções
// ---------------------------------------------------------------------------

const DOUTRINA: readonly EntradaGlossario[] = [
  { en: "Deposit of Faith", pt: "Depósito da Fé", tipo: "doutrina", exigirTraducao: true },
  { en: "Real Presence", pt: "Presença Real", tipo: "doutrina", exigirTraducao: true },
  { en: "transubstantiation", pt: "transubstanciação", tipo: "doutrina" },
  {
    en: "Blessed Sacrament",
    pt: "Santíssimo Sacramento",
    tipo: "doutrina",
    exigirTraducao: true,
  },
  { en: "Eucharistic adoration", pt: "adoração eucarística", tipo: "doutrina" },
  { en: "Benediction", pt: "Bênção do Santíssimo", tipo: "doutrina" },
  {
    en: "Confession",
    pt: "Confissão",
    tipo: "doutrina",
    nota: "O sacramento também é 'Penitência' ou 'Reconciliação'.",
  },
  {
    en: "Sacrament of Penance",
    pt: "Sacramento da Penitência",
    tipo: "doutrina",
    exigirTraducao: true,
  },
  { en: "Extreme Unction", pt: "Extrema-Unção", tipo: "doutrina", nota: "Termo do rito de 1962; no Novus Ordo, 'Unção dos Enfermos'." },
  { en: "plenary indulgence", pt: "indulgência plenária", tipo: "doutrina", exigirTraducao: true },
  { en: "partial indulgence", pt: "indulgência parcial", tipo: "doutrina" },
  { en: "Holy Year", pt: "Ano Santo", tipo: "doutrina", exigirTraducao: true },
  { en: "Jubilee", pt: "Jubileu", tipo: "doutrina" },
  {
    en: "Rosary",
    pt: "Rosário",
    tipo: "doutrina",
    nota: "No Brasil, 'terço' é a terça parte (5 dezenas); 'rosário' são as 15. O uso corrente confunde — prefira 'terço' para a devoção diária.",
  },
  { en: "Stations of the Cross", pt: "Via-Sacra", tipo: "doutrina", exigirTraducao: true },
  { en: "Lent", pt: "Quaresma", tipo: "doutrina" },
  { en: "Advent", pt: "Advento", tipo: "doutrina" },
  { en: "Holy Week", pt: "Semana Santa", tipo: "doutrina", exigirTraducao: true },
  { en: "Ash Wednesday", pt: "Quarta-feira de Cinzas", tipo: "doutrina", exigirTraducao: true },
  { en: "Good Friday", pt: "Sexta-feira Santa", tipo: "doutrina", exigirTraducao: true },
  { en: "Easter Vigil", pt: "Vigília Pascal", tipo: "doutrina", exigirTraducao: true },
  { en: "Corpus Christi", pt: "Corpus Christi", tipo: "doutrina", nota: "Latim. Não traduzir." },
  { en: "Sacred Heart", pt: "Sagrado Coração", tipo: "doutrina", exigirTraducao: true },
  { en: "Immaculate Heart", pt: "Imaculado Coração", tipo: "doutrina", exigirTraducao: true },
  { en: "Precious Blood", pt: "Preciosíssimo Sangue", tipo: "doutrina", exigirTraducao: true },
  { en: "Immaculate Conception", pt: "Imaculada Conceição", tipo: "doutrina", exigirTraducao: true },
  { en: "Assumption", pt: "Assunção", tipo: "doutrina" },
  { en: "Ascension", pt: "Ascensão", tipo: "doutrina" },
  { en: "Pentecost", pt: "Pentecostes", tipo: "doutrina" },
  { en: "Trinity", pt: "Trindade", tipo: "doutrina" },
  { en: "Incarnation", pt: "Encarnação", tipo: "doutrina" },
  { en: "Redemption", pt: "Redenção", tipo: "doutrina" },
  { en: "grace", pt: "graça", tipo: "doutrina" },
  { en: "mortal sin", pt: "pecado mortal", tipo: "doutrina" },
  { en: "venial sin", pt: "pecado venial", tipo: "doutrina" },
  { en: "purgatory", pt: "purgatório", tipo: "doutrina" },
  { en: "vocation", pt: "vocação", tipo: "doutrina" },
  { en: "religious order", pt: "ordem religiosa", tipo: "doutrina" },
  { en: "consecrated life", pt: "vida consagrada", tipo: "doutrina" },
  { en: "pilgrimage", pt: "peregrinação", tipo: "doutrina" },
  { en: "novena", pt: "novena", tipo: "doutrina" },
];

// ---------------------------------------------------------------------------
// Glossário consolidado
// ---------------------------------------------------------------------------

export const GLOSSARIO: readonly EntradaGlossario[] = [
  ...INSTITUICOES,
  ...TITULOS,
  ...PROCESSOS,
  ...RITO_1962,
  ...SANTOS,
  ...DOCUMENTOS,
  ...DOUTRINA,
];

/**
 * Termos do Novus Ordo que NÃO existem no rito de 1962.
 *
 * O guard-rail correspondente não barra o termo por existir — barra quando ele
 * aparece no texto adaptado SEM que o original em inglês trouxesse o termo
 * equivalente. Ou seja: noticiar uma celebração no Novus Ordo é legítimo;
 * "corrigir" uma Epístola de 1962 para "primeira leitura" é fabricação
 * litúrgica. A distinção está implementada em `guardrails.ts`.
 */
export const TERMOS_NOVUS_ORDO_VETADOS: readonly {
  /** Forma em PT-BR que dispara a suspeita. */
  pt: string;
  /** Formas em inglês que, se presentes no original, absolvem o uso. */
  origemLegitima: readonly string[];
  motivo: string;
}[] = [
  {
    pt: "salmo responsorial",
    origemLegitima: ["responsorial psalm"],
    motivo:
      "Não existe salmo responsorial no rito de 1962 — entre a Epístola e o Evangelho vêm o Gradual, o Aleluia ou o Trato.",
  },
  {
    pt: "primeira leitura",
    origemLegitima: ["first reading"],
    motivo:
      "No rito de 1962 a leitura anterior ao Evangelho é a Epístola. Não há 'primeira leitura'.",
  },
  {
    pt: "segunda leitura",
    origemLegitima: ["second reading"],
    motivo: "Não há segunda leitura no rito de 1962.",
  },
  {
    pt: "oração dos fiéis",
    origemLegitima: ["prayer of the faithful", "universal prayer"],
    motivo: "A oração dos fiéis foi introduzida pela reforma de 1969.",
  },
  {
    pt: "tempo comum",
    origemLegitima: ["ordinary time"],
    motivo:
      "O calendário de 1962 conta 'Domingos depois da Epifania' e 'depois de Pentecostes'. Não há Tempo Comum.",
  },
  {
    pt: "memória obrigatória",
    origemLegitima: ["obligatory memorial"],
    motivo:
      "A escala de 1962 é por classe (1ª a 4ª), não por solenidade/festa/memória.",
  },
  {
    pt: "memória facultativa",
    origemLegitima: ["optional memorial"],
    motivo: "Idem: a escala de 1962 é por classe.",
  },
  {
    pt: "unção dos enfermos",
    origemLegitima: ["anointing of the sick"],
    motivo:
      "No rito de 1962 o sacramento é a Extrema-Unção. Só use a forma moderna se a fonte usar.",
  },
];

// ---------------------------------------------------------------------------
// Índices e consultas
// ---------------------------------------------------------------------------

const porEn = new Map(GLOSSARIO.map((e) => [e.en.toLowerCase(), e]));

export function buscarEntrada(en: string): EntradaGlossario | undefined {
  return porEn.get(en.trim().toLowerCase());
}

export function entradasPorTipo(
  tipo: TipoGlossario,
): readonly EntradaGlossario[] {
  return GLOSSARIO.filter((e) => e.tipo === tipo);
}

/**
 * Entradas cuja presença literal em inglês no texto adaptado é prova de falha.
 * Consumido pelo guard-rail de glossário — ver `guardrails.ts`.
 */
export const TERMOS_QUE_EXIGEM_TRADUCAO: readonly EntradaGlossario[] =
  GLOSSARIO.filter((e) => e.exigirTraducao === true);

// ---------------------------------------------------------------------------
// Renderização para prompt
// ---------------------------------------------------------------------------

/**
 * Núcleo enviado em toda adaptação.
 *
 * Deliberadamente NÃO inclui `santo`, `documento` e `doutrina` inteiros: são os
 * blocos maiores e os de menor risco (errar "encíclica" é feio, errar
 * "Epístola → primeira leitura" é doutrinário). Cota de Neurons é finita — ver
 * a nota de custo no topo do arquivo.
 */
export const TIPOS_NUCLEO: readonly TipoGlossario[] = [
  "instituicao",
  "titulo",
  "processo",
  "rito1962",
];

function formatarEntrada(e: EntradaGlossario): string {
  return e.nota ? `${e.en} = ${e.pt}  (${e.nota})` : `${e.en} = ${e.pt}`;
}

/**
 * Bloco de texto do glossário para injetar no prompt do sistema.
 *
 * @param tipos Subconjunto a incluir. Por padrão, `TIPOS_NUCLEO`.
 */
export function montarBlocoGlossario(
  tipos: readonly TipoGlossario[] = TIPOS_NUCLEO,
): string {
  const selecionados = new Set(tipos);
  const linhas: string[] = [];

  for (const tipo of TIPOS_GLOSSARIO) {
    if (!selecionados.has(tipo)) continue;
    const doTipo = GLOSSARIO.filter((e) => e.tipo === tipo);
    if (doTipo.length === 0) continue;
    linhas.push(`[${tipo}]`);
    for (const e of doTipo) linhas.push(`  ${formatarEntrada(e)}`);
  }

  return linhas.join("\n");
}

/** Bloco de proibições do rito de 1962, para o prompt do sistema. */
export function montarBlocoVetosRito1962(): string {
  return TERMOS_NOVUS_ORDO_VETADOS.map(
    (t) => `  "${t.pt}" — ${t.motivo}`,
  ).join("\n");
}

/**
 * Dados de identidade e contato usados pelas páginas institucionais.
 *
 * ⚠️ ESTE ARQUIVO TEM CAMPOS QUE SÓ O RESPONSÁVEL PELO SITE PODE PREENCHER.
 * Os marcados com `PENDENTE` estão com texto honesto no lugar do dado real —
 * não são invenção plausível de e-mail, CNPJ ou endereço. Inventar isso numa
 * política de privacidade é pior do que deixar em branco: cria obrigação legal
 * sobre um canal que não existe, e a LGPD exige que o canal do titular
 * FUNCIONE.
 *
 * Enquanto `PENDENTE.email` for `null`, as páginas exibem um aviso em vez de um
 * endereço falso, e `/contato` explica que o canal está sendo definido.
 *
 * Ao preencher, verifique também:
 *  - `SOBRE.responsavelEditorial` — quem responde pelo conteúdo (E-E-A-T).
 *  - `PRIVACIDADE.encarregado` — o DPO/encarregado exigido pela LGPD art. 41.
 */

/** Data da última revisão das páginas institucionais (exibida ao leitor). */
export const ATUALIZADO_EM = "4 de agosto de 2026";

/**
 * ✅ PREENCHIDO EM 04/08/2026. O nome `PENDENTE` ficou por compatibilidade com
 * os pontos que já o importam; o que ele guarda é a identificação do
 * responsável, e o tipo segue `string | null` para que as caixas de aviso
 * voltem sozinhas se algum dia um campo for esvaziado.
 *
 * O e-mail é real e atendido: `contato@minutocatolico.com.br` roteia pelo
 * Cloudflare Email Routing (MX, SPF e DKIM verificados em 04/08). A LGPD
 * art. 18 exige que o canal do titular FUNCIONE — publicar endereço que
 * ninguém lê seria pior do que a caixa de "pendente" que havia antes.
 */
export const PENDENTE = {
  /** E-mail de contato público. */
  email: "contato@minutocatolico.com.br" as string | null,
  /**
   * Responsável. Pessoa física: a LGPD não exige CNPJ para que alguém seja
   * controlador de dados, e inventar razão social seria falso.
   */
  entidade: "Jonatas Sousa Monteiro" as string | null,
  /** Cidade/UF de operação — a LGPD pede a base territorial. */
  localidade: "São Paulo/SP" as string | null,
} as const;

export const SOBRE = {
  /**
   * Quem responde editorialmente. O Google trata isso como sinal de E-E-A-T,
   * e para conteúdo religioso é também questão de confiança do leitor.
   */
  responsavelEditorial: PENDENTE.entidade,
} as const;

export const PRIVACIDADE = {
  /** Encarregado de dados (LGPD art. 41). Pode ser a mesma pessoa do contato. */
  encarregado: PENDENTE.entidade,
} as const;

/**
 * Fontes de conteúdo declaradas publicamente.
 *
 * Sai daqui e não de texto solto nas páginas porque a lista precisa bater com o
 * que a ingestão realmente consome (`src/services/ingestion/sources/`). Fonte
 * declarada que não é usada — ou usada e não declarada — é falha de
 * transparência, não erro de cópia.
 */
export const FONTES_DECLARADAS = [
  {
    nome: "EWTN News",
    url: "https://www.ewtnnews.com/",
    descricao: "Agência católica de notícias, em inglês.",
  },
  {
    nome: "Sign of the Cross Media",
    url: "https://www.signofthecrossmedia.com/",
    descricao: "Portal católico de notícias e formação, em inglês.",
  },
  {
    nome: "Salve Maria",
    url: "https://salvemaria.com.br/calendario/",
    descricao:
      "Calendário litúrgico tradicional (missal de 1962), usado na coluna de liturgia.",
  },
] as const;

/**
 * Tecnologias que tocam dado de quem visita.
 *
 * A política de privacidade lista isto nominalmente porque é o que a LGPD
 * chama de transparência sobre compartilhamento — e porque um leitor tem
 * direito de saber que a hospedagem é estrangeira.
 *
 * ⚠️ ESTA LISTA É UMA DECLARAÇÃO JURÍDICA, NÃO DOCUMENTAÇÃO.
 * Ela precisa bater com o que o código realmente faz, nas DUAS direções. Em
 * 03/08/2026 ela errava nas duas ao mesmo tempo: declarava "Cloudflare Web
 * Analytics", que nunca foi instalado, e "Cloudflare Workers AI", trocado por
 * NVIDIA NIM em `c8a7c53` — e omitia a Adcash, que rodava em todas as páginas.
 * Ao mexer em provider, analytics ou anúncio, mexa AQUI no mesmo commit.
 */
export const TRATAMENTOS = [
  {
    nome: "Cloudflare",
    papel:
      "Hospedagem, CDN e proteção contra abuso. Processa o endereço IP de cada requisição para entregar as páginas e bloquear ataques.",
    local: "Servidores fora do Brasil.",
    condicionadoAConsentimento: false,
  },
  {
    nome: "NVIDIA NIM",
    papel:
      "Adaptação dos textos das matérias para português. Recebe apenas o conteúdo publicado pelas fontes — nunca endereço IP, e-mail ou qualquer dado de quem visita o site.",
    local: "Servidores fora do Brasil.",
    condicionadoAConsentimento: false,
  },
  {
    nome: "Adcash",
    papel:
      "Rede de publicidade. Quando você autoriza, ela carrega os anúncios e recebe seu endereço IP e dados do navegador para escolher o que exibir e medir os resultados.",
    local: "Servidores fora do Brasil.",
    condicionadoAConsentimento: true,
  },
] as const;

/**
 * Publicidade está ligada no site?
 *
 * Enquanto for `false`, a política declara a publicidade como SUSPENSA e o
 * carregador de anúncio não é montado. Existe como interruptor único para que
 * texto legal e comportamento nunca possam divergir — foi exatamente essa
 * divergência que criou o problema de 03/08/2026.
 */
export const PUBLICIDADE_ATIVA: boolean = true;

/**
 * O que fica gravado no aparelho do leitor.
 *
 * Nenhum destes é cookie: são chaves de `localStorage`, que não viajam para o
 * servidor. A distinção importa porque muda o que precisa de consentimento.
 */
export const ARMAZENAMENTO_LOCAL = [
  {
    chave: "bn-theme",
    para: "Lembrar se você escolheu o tema claro ou escuro.",
  },
  {
    chave: "bn-salvos",
    para: "Guardar a lista de matérias que você marcou para ler depois.",
  },
  {
    chave: "bn-consentimento",
    para: "Lembrar se você autorizou ou recusou a exibição de publicidade, para não perguntar de novo a cada página.",
  },
] as const;

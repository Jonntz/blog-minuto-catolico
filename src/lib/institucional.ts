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
export const ATUALIZADO_EM = "1 de agosto de 2026";

export const PENDENTE = {
  /** E-mail de contato público. Ex.: "contato@minutocatolico.com.br". */
  email: null as string | null,
  /** Razão social ou nome do responsável, e CNPJ/CPF se houver. */
  entidade: null as string | null,
  /** Cidade/UF de operação — a LGPD pede a base territorial. */
  localidade: null as string | null,
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
 */
export const TRATAMENTOS = [
  {
    nome: "Cloudflare",
    papel:
      "Hospedagem, CDN e proteção contra abuso. Processa o endereço IP de cada requisição para entregar as páginas e bloquear ataques.",
    local: "Servidores fora do Brasil.",
  },
  {
    nome: "Cloudflare Web Analytics",
    papel:
      "Medição de audiência agregada (páginas vistas, origem do acesso). Não usa cookie e não cria identificador persistente de visitante.",
    local: "Servidores fora do Brasil.",
  },
  {
    nome: "Cloudflare Workers AI",
    papel:
      "Adaptação dos textos para português. Processa apenas o conteúdo das matérias das fontes — nunca dado de quem visita o site.",
    local: "Servidores fora do Brasil.",
  },
] as const;

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
] as const;

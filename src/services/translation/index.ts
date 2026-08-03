/**
 * Camada de adaptação editorial — superfície pública.
 *
 * O resto do sistema deve importar daqui, não dos arquivos internos. Para a
 * integração (Fase 2) só duas coisas importam:
 *
 *   import { adaptarPendentes, LIMITE_PADRAO_LOTE } from "@/services/translation";
 *   const resumo = await adaptarPendentes(db, env, { limite: LIMITE_PADRAO_LOTE });
 *
 * `env` precisa ter o binding `AI`; `db` é o cliente Drizzle de `@/db`.
 * A função não cria rota e não escreve em `ingestion_runs` — use
 * `paraIngestionRun(resumo)` para montar a linha de observabilidade.
 */

export {
  adaptarPendentes,
  escolherProvider,
  paraIngestionRun,
  refinarCategoria,
  resolverTextoOriginal,
  LIMITE_MAXIMO_LOTE,
  LIMITE_PADRAO_LOTE,
  MAX_FALHAS_CONSECUTIVAS,
  MAX_TENTATIVAS_TAMANHO,
  type EnvAdaptacao,
  type EventoAdaptacao,
  type OpcoesAdaptacao,
  type ResumoAdaptacao,
} from "./adapt";

export {
  apenasExcessoDeTamanho,
  avaliarGuardRails,
  calcularAlvoCaracteres,
  calcularAlvoPalavras,
  contarParagrafos,
  medirIdioma,
  montarBlocoFonte,
  montarCorpoFinal,
  preVoo,
  removerAtribuicaoDoModelo,
  temBlocoFonte,
  HOSTS_POR_FONTE,
  IDS_REGRAS,
  LIMITES,
  MARCADOR_FONTE,
  MIN_CHARS_ORIGINAL,
  REGRAS_DE_COMPRIMENTO,
  type ContextoGuardRails,
  type MedidaIdioma,
  type ResultadoGuardRails,
  type ResultadoPreVoo,
} from "./guardrails";

export {
  buscarEntrada,
  entradasPorTipo,
  montarBlocoGlossario,
  montarBlocoVetosRito1962,
  GLOSSARIO,
  TERMOS_NOVUS_ORDO_VETADOS,
  TERMOS_QUE_EXIGEM_TRADUCAO,
  TIPOS_GLOSSARIO,
  TIPOS_NUCLEO,
  type EntradaGlossario,
  type TipoGlossario,
} from "./glossary";

export {
  deveAbortarLote,
  ehErroTransitorio,
  ehNomeProvider,
  statusParaErro,
  PROVIDERS,
  TIPOS_ERRO_PROVIDER,
  type ErroProvider,
  type NomeProvider,
  type PedidoAdaptacao,
  type PedidoVerificacao,
  type RespostaAdaptacao,
  type ResultadoProvider,
  type TipoErroProvider,
  type TranslationProvider,
  type UsoModelo,
  type VerificacaoFactual,
} from "./provider";

export {
  categoriaValida,
  extrairJson,
  montarMensagensAdaptacao,
  montarMensagensVerificacao,
  montarSistemaAdaptacao,
  montarSistemaVerificacao,
  normalizarTags,
  parsearAdaptacao,
  parsearVerificacao,
  ESQUEMA_JSON_ADAPTACAO,
  ESQUEMA_JSON_VERIFICACAO,
  type MensagemChat,
} from "./prompt";

export {
  criarProviderNvidia,
  classificarErroHttp,
  classificarErroRede,
  limparRaciocinio,
  ENDPOINT_NVIDIA,
  MODELOS_NVIDIA,
  type EnvNvidia,
} from "./nvidia";

export {
  criarProviderWorkersAi,
  classificarErro,
  MODELO_WORKERS_AI,
  type EnvComAi,
} from "./workers-ai";

export { criarProviderAnthropic, MODELO_ANTHROPIC } from "./anthropic";

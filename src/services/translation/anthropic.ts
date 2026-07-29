/**
 * Provider Anthropic — STUB DESATIVADO.
 *
 * Não há chamada real aqui, e é assim de propósito: o usuário pediu modelo
 * gratuito e a API da Anthropic não tem tier gratuito (MEMORY.md §2.6). Este
 * arquivo existe para que a troca custe uma variável de ambiente em vez de uma
 * reescrita — se um dia o modelo classe 8B do Workers AI não sustentar o padrão
 * editorial, o caminho de saída já está desenhado.
 *
 * ---------------------------------------------------------------------------
 * O QUE FALTA PARA LIGAR (checklist, na ordem)
 * ---------------------------------------------------------------------------
 * 1. `npm i @anthropic-ai/sdk` — NÃO instalado agora, de propósito: dependência
 *    que ninguém usa é peso morto no bundle do Worker.
 * 2. Acrescentar `ANTHROPIC_API_KEY` ao schema zod de `src/lib/env.ts` (como
 *    opcional) e cadastrar com `wrangler secret put`.
 * 3. Acrescentar `TRANSLATION_PROVIDER` ao mesmo schema, com default
 *    `"workersAi"`. `escolherProvider()` em `adapt.ts` já lê essa chave.
 * 4. Implementar `adaptar` e `verificarFatos` chamando a Messages API. O
 *    contrato de `TranslationProvider` não muda; `guardrails.ts`, `glossary.ts`
 *    e `prompt.ts` continuam intactos.
 *
 * ---------------------------------------------------------------------------
 * DUAS COISAS QUE MUDAM DE VERDADE COM ESTE PROVIDER
 * ---------------------------------------------------------------------------
 * a) PROMPT CACHING. O bloco do glossário (`montarBlocoGlossario()`) é grande,
 *    idêntico em toda chamada e vem antes do conteúdo variável — o caso de uso
 *    canônico de `cache_control: { type: "ephemeral" }`. Marcando-o, os tokens
 *    dele passam a custar uma fração a partir da segunda chamada. Com Workers
 *    AI isso não existe: o glossário é re-tokenizado e descontado da cota a
 *    cada requisição, e é por isso que hoje só o núcleo do glossário é enviado.
 *
 * b) SAÍDA ESTRUTURADA CONFIÁVEL. Com tool use / structured outputs o veredito
 *    da checagem factual deixa de depender de o modelo "lembrar" de responder
 *    JSON. Isso muda a taxa de acerto — mas NÃO a política: `parsear*` continua
 *    devolvendo `null` quando não entender, e `null` continua reprovando.
 *    Não relaxe o fail-closed só porque o modelo ficou melhor.
 */

import type {
  PedidoAdaptacao,
  PedidoVerificacao,
  RespostaAdaptacao,
  ResultadoProvider,
  TranslationProvider,
  VerificacaoFactual,
} from "./provider";

/** Placeholder. O identificador real só entra quando o provider for ligado. */
export const MODELO_ANTHROPIC = "(nao-configurado)";

const MOTIVO =
  "Provider 'anthropic' não está implementado: não há SDK instalado nem ANTHROPIC_API_KEY no ambiente. " +
  "O padrão do projeto é 'workersAi' (gratuito). Ver src/services/translation/anthropic.ts para o checklist de ativação.";

/**
 * Devolve sempre erro `desativado`.
 *
 * Repare que NÃO lança exceção: `desativado` é um `ErroProvider` como qualquer
 * outro, e `statusParaErro()` o mapeia para `draft`. Ou seja, selecionar este
 * provider por engano não publica nada errado nem perde artigo — a fila para,
 * os itens ficam intactos e o log diz exatamente o porquê. Um `throw` solto
 * derrubaria a execução do cron inteira e produziria um modo de falha bem pior
 * de diagnosticar.
 *
 * O `throw` fica reservado para o construtor: pedir explicitamente um provider
 * inexistente na configuração é erro de operação, e deve aparecer alto.
 */
export function criarProviderAnthropic(): TranslationProvider {
  return {
    nome: "anthropic",
    modelo: MODELO_ANTHROPIC,

    async adaptar(
      _pedido: PedidoAdaptacao,
    ): Promise<ResultadoProvider<RespostaAdaptacao>> {
      return { ok: false, erro: { tipo: "desativado", mensagem: MOTIVO } };
    },

    async verificarFatos(
      _pedido: PedidoVerificacao,
    ): Promise<ResultadoProvider<VerificacaoFactual>> {
      return { ok: false, erro: { tipo: "desativado", mensagem: MOTIVO } };
    },
  };
}

/**
 * Chamada por `escolherProvider()` quando `TRANSLATION_PROVIDER=anthropic` está
 * configurado. Falha alto e cedo, na subida do lote, em vez de deixar cada
 * artigo descobrir sozinho que o provider não existe.
 */
export function assertarAnthropicConfigurado(): never {
  throw new Error(MOTIVO);
}

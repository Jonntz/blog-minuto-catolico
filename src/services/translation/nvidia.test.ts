import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { criarProviderNvidia, MODELOS_NVIDIA } from "./nvidia";

describe("provider NVIDIA — fallback automático do verificador", () => {
  it("troca para família reserva quando NVIDIA_VERIFY_MODEL devolve 410 e memoriza no isolate", async () => {
    const modelosChamados: string[] = [];
    const fetchOriginal = globalThis.fetch;

    globalThis.fetch = (async (_input: URL | RequestInfo, init?: RequestInit) => {
      const corpo = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
      const modelo = corpo.model ?? "";
      modelosChamados.push(modelo);

      if (modelo === "openai/gpt-oss-20b") {
        return new Response(
          JSON.stringify({ detail: "model retired" }),
          { status: 410, headers: { "content-type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "VEREDITO: CONSISTENTE",
              },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const provider = criarProviderNvidia({
        NVIDIA_API_KEY: "nvapi-teste-local",
        NVIDIA_VERIFY_MODEL: "openai/gpt-oss-20b",
      });

      const pedido = {
        tituloOriginal: "Pope calls for prayer",
        textoOriginal: "Pope Leo XIV called for prayer at St. Peter's Square.",
        tituloAdaptado: "Papa convoca oração pela paz",
        corpoAdaptado: "O Papa Leão XIV convocou os fiéis para um momento de oração.",
      };

      const res1 = await provider.verificarFatos(pedido);
      assert.equal(res1.ok, true);
      if (res1.ok) assert.equal(res1.valor.consistente, true);
      assert.deepEqual(modelosChamados, [
        "openai/gpt-oss-20b",
        MODELOS_NVIDIA.mistralLarge4,
      ]);

      // Na segunda chamada no mesmo isolate, o modelo 410 não é mais tentado.
      const res2 = await provider.verificarFatos(pedido);
      assert.equal(res2.ok, true);
      assert.deepEqual(modelosChamados, [
        "openai/gpt-oss-20b",
        MODELOS_NVIDIA.mistralLarge4,
        MODELOS_NVIDIA.mistralLarge4,
      ]);
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });
});

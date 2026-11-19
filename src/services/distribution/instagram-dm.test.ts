import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db } from "@/db";
import {
  compararTextoSeguro,
  ehPedidoDeLink,
  montarTextoPrivateReply,
  montarUrlMateriaDirect,
  processarWebhookInstagram,
  validarAssinaturaWebhookMeta,
  type ArtigoLinkDirect,
  type PayloadWebhookMeta,
} from "./instagram-dm";

async function assinarMeta(corpo: string, segredo: string): Promise<string> {
  const enc = new TextEncoder();
  const chave = await crypto.subtle.importKey(
    "raw",
    enc.encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", chave, enc.encode(corpo));
  const hex = Array.from(new Uint8Array(sig), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return `sha256=${hex}`;
}

function criarDbMock(
  artigoEncontrado: ArtigoLinkDirect | null,
): Db {
  const linhas = artigoEncontrado ? [artigoEncontrado] : [];
  const cadeia = {
    from: () => cadeia,
    innerJoin: () => cadeia,
    where: () => cadeia,
    orderBy: () => cadeia,
    limit: async () => linhas,
  };
  return {
    select: () => cadeia,
  } as unknown as Db;
}

describe("instagram-dm — webhook oficial de link clicável no Direct", () => {
  it("valida assinatura HMAC-SHA256 X-Hub-Signature-256 em tempo constante", async () => {
    const corpo = JSON.stringify({ object: "instagram", entry: [] });
    const segredo = "segredo-super-forte-meta-app";
    const assinatura = await assinarMeta(corpo, segredo);

    assert.equal(await validarAssinaturaWebhookMeta(corpo, assinatura, segredo), true);
    assert.equal(await validarAssinaturaWebhookMeta(corpo + " ", assinatura, segredo), false);
    assert.equal(await validarAssinaturaWebhookMeta(corpo, "sha256=invalido", segredo), false);
    assert.equal(await validarAssinaturaWebhookMeta(corpo, null, segredo), false);
    assert.equal(compararTextoSeguro("abc", "abc"), true);
    assert.equal(compararTextoSeguro("abc", "abd"), false);
  });

  it("identifica palavras-chave de leitura sem disparar spam em comentários comuns", () => {
    assert.equal(ehPedidoDeLink("LER"), true);
    assert.equal(ehPedidoDeLink("quero o link da matéria!"), true);
    assert.equal(ehPedidoDeLink("Manda o artigo 🙏"), true);
    assert.equal(ehPedidoDeLink("🔗"), true);

    assert.equal(ehPedidoDeLink("Amém!"), false);
    assert.equal(ehPedidoDeLink("Deus abençoe o Papa"), false);
    assert.equal(ehPedidoDeLink("   "), false);
  });

  it("monta URL UTM e Private Reply para artigo encontrado ou fallback /bio", () => {
    const url = montarUrlMateriaDirect("https://minutocatolico.com.br/", "missa-em-roma");
    assert.equal(
      url,
      "https://minutocatolico.com.br/noticia/missa-em-roma?utm_source=instagram&utm_medium=dm",
    );

    const texto = montarTextoPrivateReply("https://minutocatolico.com.br", {
      slug: "missa-em-roma",
      title: "Papa celebra Missa em Roma",
      dek: "Resumo",
      imageUrl: null,
    });
    assert.ok(texto.includes("Papa celebra Missa em Roma"));
    assert.ok(texto.includes(url));

    const textoFallback = montarTextoPrivateReply("https://minutocatolico.com.br", null);
    assert.ok(textoFallback.includes("https://minutocatolico.com.br/bio?utm_source=instagram&utm_medium=dm"));
  });

  it("envia Private Reply em comentário com LER e Template Web URL em resposta a Story (com fallback)", async () => {
    const artigo: ArtigoLinkDirect = {
      slug: "bispos-de-gana-pedem-estado",
      title: "Bispos de Gana pedem estado de emergência",
      dek: "Comunicado da assembleia plenária aborda mineração ilegal.",
      imageUrl: "https://cdn.example.com/foto.jpg",
    };

    const chamadas: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchOriginal = globalThis.fetch;

    globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      chamadas.push({ url, body });

      // Simula rejeição apenas na 1ª tentativa com Generic Template para testar fallback texto
      const msg = body.message as Record<string, unknown> | undefined;
      if (msg?.attachment) {
        return new Response(
          JSON.stringify({ error: { code: 100, message: "template unavailable" } }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ message_id: "mid-ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const payload: PayloadWebhookMeta = {
        object: "instagram",
        entry: [
          {
            id: "17841471326224544",
            changes: [
              {
                field: "comments",
                value: {
                  id: "comment-ler-1",
                  text: "LER",
                  from: { id: "user-1", username: "leitor" },
                  media: { id: "media-feed-1" },
                },
              },
              {
                field: "comments",
                value: {
                  id: "comment-amem-2",
                  text: "Amém!",
                  from: { id: "user-2", username: "fiel" },
                  media: { id: "media-feed-1" },
                },
              },
            ],
            messaging: [
              {
                sender: { id: "igsid-story-1" },
                recipient: { id: "17841471326224544" },
                message: {
                  mid: "mid-story-1",
                  text: "LER",
                  reply_to: { story: { id: "media-story-1" } },
                },
              },
              {
                sender: { id: "17841471326224544" },
                recipient: { id: "igsid-story-1" },
                message: {
                  mid: "mid-echo",
                  text: "LER",
                  is_echo: true,
                },
              },
            ],
          },
        ],
      };

      const res = await processarWebhookInstagram(
        criarDbMock(artigo),
        {
          INSTAGRAM_ACCOUNT_ID: "17841471326224544",
          INSTAGRAM_ACCESS_TOKEN: "token-teste",
        },
        payload,
      );

      assert.equal(res.ok, true);
      assert.equal(res.recebidos, 4);
      assert.equal(res.respondidos, 2);
      assert.equal(res.ignorados, 2);
      assert.equal(res.falhas, 0);

      // 1ª chamada: Private Reply para comment-ler-1
      assert.equal(
        (chamadas[0]!.body.recipient as Record<string, string>).comment_id,
        "comment-ler-1",
      );
      assert.ok(
        ((chamadas[0]!.body.message as Record<string, string>).text).includes(
          "/noticia/bispos-de-gana-pedem-estado?utm_source=instagram&utm_medium=dm",
        ),
      );

      // 2ª chamada: tentativa com Generic Template para Story reply -> fallback 3ª chamada texto
      assert.equal(
        (chamadas[1]!.body.recipient as Record<string, string>).id,
        "igsid-story-1",
      );
      assert.ok((chamadas[1]!.body.message as Record<string, unknown>).attachment);
      assert.ok(
        ((chamadas[2]!.body.message as Record<string, string>).text).includes(
          "/noticia/bispos-de-gana-pedem-estado?utm_source=instagram&utm_medium=dm",
        ),
      );
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it("resolve Page Access Token via /me/accounts automaticamente quando /messages retorna erro 210", async () => {
    const fetchOriginal = globalThis.fetch;
    const requisicoes: Array<{ url: string; auth: string | null }> = [];

    globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      requisicoes.push({ url, auth: headers.get("authorization") });

      if (url.includes("/17841471326224544/messages")) {
        return new Response(
          JSON.stringify({
            error: {
              message: "(#210) A page access token is required to request this resource.",
              code: 210,
            },
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      }

      if (url.includes("/me/accounts")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "1487592844432960",
                access_token: "page-token-resolvido",
                instagram_business_account: { id: "17841471326224544" },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ message_id: "mid-page" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const res = await processarWebhookInstagram(
        criarDbMock({
          slug: "materia-teste",
          title: "Notícia Teste",
          dek: null,
          imageUrl: null,
        }),
        {
          INSTAGRAM_ACCOUNT_ID: "17841471326224544",
          INSTAGRAM_ACCESS_TOKEN: "system-token-inicial",
        },
        {
          object: "instagram",
          entry: [
            {
              changes: [
                {
                  field: "comments",
                  value: {
                    id: "comment-210",
                    text: "LINK",
                    from: { id: "user-9" },
                    media: { id: "media-9" },
                  },
                },
              ],
            },
          ],
        },
      );

      assert.equal(res.respondidos, 1);
      assert.equal(requisicoes.length, 3);
      assert.ok(requisicoes[2]!.url.includes("/1487592844432960/messages"));
      assert.equal(requisicoes[2]!.auth, "Bearer page-token-resolvido");
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });
});

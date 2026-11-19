import { NextResponse } from "next/server";
import { getDb, getEnv } from "@/db";
import {
  compararTextoSeguro,
  processarWebhookInstagram,
  validarAssinaturaWebhookMeta,
  type EnvWebhookInstagram,
  type PayloadWebhookMeta,
} from "@/services/distribution/instagram-dm";

/**
 * Webhook oficial da Meta para Instagram (`comments` e `messages` / Stories).
 *
 * - `GET`: handshake de verificação da Meta (`hub.verify_token` + `hub.challenge`).
 * - `POST`: valida `X-Hub-Signature-256` com `INSTAGRAM_APP_SECRET` e envia o
 *   link clicável da matéria por Private Reply ou Direct.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const env = (await getEnv()) as unknown as EnvWebhookInstagram;
  const esperado = env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN?.trim();

  if (
    mode !== "subscribe" ||
    !token ||
    !challenge ||
    !esperado ||
    !compararTextoSeguro(token, esperado)
  ) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const env = (await getEnv()) as unknown as EnvWebhookInstagram;
  const appSecret = env.INSTAGRAM_APP_SECRET?.trim();

  if (!appSecret) {
    return NextResponse.json(
      { ok: false, erro: "INSTAGRAM_APP_SECRET não configurado" },
      { status: 503 },
    );
  }

  const corpoBruto = await request.text();
  const assinatura = request.headers.get("x-hub-signature-256");
  const autentico = await validarAssinaturaWebhookMeta(
    corpoBruto,
    assinatura,
    appSecret,
  );

  if (!autentico) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: PayloadWebhookMeta;
  try {
    payload = JSON.parse(corpoBruto) as PayloadWebhookMeta;
  } catch {
    return NextResponse.json(
      { ok: false, erro: "JSON inválido" },
      { status: 400 },
    );
  }

  const db = await getDb();
  const resumo = await processarWebhookInstagram(db, env, payload);

  console.log(
    JSON.stringify({
      escopo: "webhooks.instagram",
      ...resumo,
    }),
  );

  return NextResponse.json(resumo);
}

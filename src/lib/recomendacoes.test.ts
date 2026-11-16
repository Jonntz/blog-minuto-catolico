import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATEGORIAS } from "./categories";
import {
  escolherObraPorCategoria,
  TAG_AFILIADO_AMAZON,
  urlBuscaAmazon,
} from "./recomendacoes";

describe("recomendações e links de afiliado Amazon", () => {
  it("possui tag de afiliado configurada no formato Amazon Associados BR", () => {
    assert.equal(TAG_AFILIADO_AMAZON, "minutocatolic-20");
    assert.match(TAG_AFILIADO_AMAZON, /^[a-z0-9-]+-20$/);
  });

  it("gera URL válida com tag=minutocatolic-20 e i=stripbooks para todas as 11 categorias", () => {
    for (const categoria of CATEGORIAS) {
      const obra = escolherObraPorCategoria(categoria.slug);
      assert.ok(
        obra.titulo.length > 0,
        `Categoria ${categoria.slug} sem título de obra`,
      );

      const urlStr = urlBuscaAmazon(obra);
      const url = new URL(urlStr);

      assert.equal(url.origin, "https://www.amazon.com.br");
      assert.equal(url.pathname, "/s");
      assert.equal(url.searchParams.get("tag"), "minutocatolic-20");
      assert.equal(url.searchParams.get("i"), "stripbooks");
      assert.equal(url.searchParams.get("k"), obra.termoBuscaAmazon);
    }
  });
});

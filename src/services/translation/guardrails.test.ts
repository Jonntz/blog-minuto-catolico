import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { avaliarGuardRails, type ContextoGuardRails } from "./guardrails";

/**
 * Só a regra `numeros` interessa aqui. O contexto mínimo reprova em outras
 * regras (comprimento, idioma…), então o teste olha apenas o que ela disse.
 */
function errosDeNumeros(original: string, corpoMd: string): string[] {
  const ctx: ContextoGuardRails = {
    fonte: "ewtn",
    sourceName: "EWTN News",
    sourceUrl: "https://www.ewtnnews.com/x",
    comprimentoOriginal: original.length,
    textoOriginal: original,
    corpoMd,
    titulo: "Título",
    dek: "Linha fina",
    tags: [],
    verificacao: null,
  };
  return avaliarGuardRails(ctx).erros.filter((e) => e.startsWith("numeros:"));
}

describe("regra numeros", () => {
  // Casos reais de 28/09/2026: traduções corretas reprovadas como "invenção".
  it("aceita versículo na convenção brasileira (19:14 → 19,14)", () => {
    const original = "He cited Matthew 19:14, Matthew 18:5 and John 11:35.";
    const adaptado = "Ele citou Mateus 19,14, Mateus 18,5 e João 11,35.";
    assert.deepEqual(errosDeNumeros(original, adaptado), []);
  });

  it("aceita milhar por extenso (35,000 → 35 mil)", () => {
    const original = "He celebrated Mass before 35,000 people.";
    const adaptado = "Celebrou missa diante de cerca de 35 mil pessoas.";
    assert.deepEqual(errosDeNumeros(original, adaptado), []);
  });

  it("aceita milhão com decimal (1.5 million → 1,5 milhão)", () => {
    const original = "About 1.5 million pilgrims attended.";
    const adaptado = "Cerca de 1,5 milhão de peregrinos participaram.";
    assert.deepEqual(errosDeNumeros(original, adaptado), []);
  });

  // O que a regra existe para pegar continua sendo pego.
  it("reprova número trocado", () => {
    const original = "The Pope received three bishops.";
    const adaptado = "O Papa recebeu 5 bispos.";
    assert.equal(errosDeNumeros(original, adaptado).length, 1);
  });

  it("reprova milhar inflado (35,000 → 50 mil)", () => {
    const original = "He celebrated Mass before 35,000 people.";
    const adaptado = "Celebrou missa diante de 50 mil pessoas.";
    assert.equal(errosDeNumeros(original, adaptado).length, 1);
  });

  it("reprova ano inventado", () => {
    const original = "The bishop will visit Brazil next year.";
    const adaptado = "O bispo visitará o Brasil em 2027.";
    assert.equal(errosDeNumeros(original, adaptado).length, 1);
  });
});

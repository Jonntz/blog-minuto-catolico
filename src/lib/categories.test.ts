import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapearCategoria } from "./categories";

const porTitulo = (titulo: string) => mapearCategoria({ titulo });

describe("mapearCategoria — léxico de título", () => {
  // Caso real (Diane Montagna, 23/10/2026): caía em "santos" por causa do "St.".
  it("Basílica de São Pedro é Vaticano, não santo", () => {
    assert.equal(
      porTitulo("Vatican Bars Annual TLM Pilgrimage from Entering St. Peter’s Basilica"),
      "vaticano",
    );
    assert.equal(porTitulo("Crowds Gather in St. Peter's Square"), "vaticano");
  });

  it("missa tradicional é liturgia", () => {
    assert.equal(porTitulo("Cardinal Sarah: Opposition to the TLM Will Die Out"), "liturgia");
    assert.equal(porTitulo("Bishops Respond to Traditionis Custodes"), "liturgia");
    assert.equal(porTitulo("A Defense of the Latin Mass"), "liturgia");
  });

  it("santo de verdade continua em santos", () => {
    assert.equal(porTitulo("St. John Henry Newman Declared Doctor of the Church"), "santos");
    assert.equal(porTitulo("Canonization of Blessed Carlo Acutis"), "santos");
  });
});

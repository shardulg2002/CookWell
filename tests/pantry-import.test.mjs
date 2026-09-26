import test from "node:test";
import assert from "node:assert/strict";
import { parsePantry } from "../public/pantry-import.js";
import { importPantry } from "../lib/pantry-import.mjs";
import { freshState, available } from "../lib/domain.mjs";
import { ingredients } from "../lib/catalog.mjs";
const row = {
  name: "Rice",
  ingredientId: "rice",
  quantity: 500,
  unit: "g",
  location: "cupboard",
  expires: "",
};
const data = (rows) => ({
  importId: "pantry-test-123456",
  confirmed: true,
  rows,
});
test("pantry parser converts units without inventing quantities or masala matches", () => {
  const rows = parsePantry(
    "Rice 1 kg\nGaram masala 80 g\nMaggi masala\nOlive oil 0.5 l",
    ingredients,
  );
  assert.equal(rows[0].quantity, 1000);
  assert.equal(rows[1].ingredientId, "");
  assert.equal(rows[2].quantity, "");
  assert.equal(rows[2].ingredientId, "");
  assert.equal(rows[3].quantity, 500);
  assert.equal(rows[3].unit, "ml");
  assert.deepEqual(
    parsePantry("Butter\nTomatoes\nCottage cheese spread", ingredients).map(
      (x) => x.ingredientId,
    ),
    ["", "", ""],
  );
  assert.throws(() => parsePantry("", ingredients));
  assert.throws(() =>
    parsePantry(Array(61).fill("Rice").join("\n"), ingredients),
  );
});
test("existing stock import changes neither spending nor prices; unmatched notes never cover spices", () => {
  const s = freshState();
  importPantry(
    s,
    data([
      row,
      { ...row, name: "Maggi masala", ingredientId: "", quantity: null },
    ]),
  );
  assert.equal(available(s, "rice"), 500);
  assert.equal(available(s, "spice"), 0);
  assert.equal(s.pantryNotes[0].name, "Maggi masala");
  assert.equal(s.pantryNotes[0].quantity, null);
  assert.deepEqual(s.purchases, []);
  assert.deepEqual(s.prices, {});
  assert.deepEqual(s.nutrition, {});
  assert.throws(() => importPantry(s, data([row])), /already saved/);
  assert.equal(s.inventory.length, 1);
});
test("every row validates before import with confirmed units, dates and amounts", () => {
  for (const bad of [
    { unit: "ml" },
    { quantity: "" },
    { quantity: -1 },
    { expires: "2026-02-30" },
    { ingredientId: "butter-unknown" },
    { location: "counter" },
  ]) {
    const s = freshState();
    assert.throws(() => importPantry(s, data([row, { ...row, ...bad }])));
    assert.deepEqual(s, freshState());
  }
  assert.throws(() =>
    importPantry(freshState(), { ...data([row]), confirmed: false }),
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { getRecipe, freshState, compatible } from "../lib/domain.mjs";
import { recipes, recipeMap, detailedSteps } from "../lib/catalog.mjs";
import { equipmentIds } from "../public/preferences.js";
import { nutritionEvidence } from "../public/nutrition-evidence.js";

const kitchen = {
  equipment: ["hob", "blender", "pressureCooker"],
  hobType: "induction",
  hobScale: "1-9",
  hobModel: "CDA",
  activeLimit: 90,
  allergens: [],
  avoid: [],
  diet: "omnivore",
};
test("induction adapts guidance without changing amounts, titles, timings or nutrition", () => {
  const s = { ...freshState(), profile: kitchen };
  for (const r of recipes) {
    const result = getRecipe(s, r.id, 2);
    const base = detailedSteps(r, 2);
    assert.deepEqual(
      result.steps.map((x) => [x.title, x.seconds]),
      base.map((x) => [x.title, x.seconds]),
    );
    for (let i = 0; i < base.length; i++) {
      for (const amount of base[i].text.match(/\d+(?:\.\d+)? (?:g|ml)\b/g) ||
        [])
        assert.ok(result.steps[i].text.includes(amount));
    }
    if (r.equipment.includes("hob"))
      assert.match(
        result.steps[0].text,
        /not temperatures or CDA model-specific/,
      );
    assert.deepEqual(detailedSteps(r, 2), base);
  }
});
test("blender supports cold shake but pressure cooker does not stand in for a hob", () => {
  assert.ok(equipmentIds.includes("pressureCooker"));
  assert.equal(compatible(recipeMap["whey-water"], kitchen), true);
  const s = { ...freshState(), profile: kitchen };
  const text = getRecipe(s, "whey-water")
    .steps.map((x) => x.text)
    .join(" ");
  assert.match(text, /blend briefly/);
  assert.doesNotMatch(text, /shaker|shake for/);
  assert.equal(
    compatible(
      recipes.find((r) => r.equipment.includes("hob")),
      { ...kitchen, equipment: ["pressureCooker"] },
    ),
    false,
  );
});
test("legacy profiles keep generic instructions and label evidence uses actual overrides", () => {
  const s = freshState();
  assert.deepEqual(
    getRecipe(s, "whey-water").steps,
    detailedSteps(recipeMap["whey-water"]),
  );
  s.nutrition.whey = {
    kcal: 300,
    protein: 70,
    carbs: 4,
    fat: 2,
    fibre: 0,
    salt: 0.1,
  };
  const r = getRecipe(s, "whey-water", 2);
  assert.equal(r.nutrition.kcal, 180);
  assert.equal(r.ingredients[0].nutrition.kcal, 300);
  assert.equal(r.ingredients[0].calculationQuantity, 60);
  const html = nutritionEvidence(r, true, String);
  assert.match(html, /Reference calculation only/);
  assert.match(html, /60 g × 300 kcal/);
  assert.match(html, /180 kcal/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { portionGuide, withPortionSteps } from "../public/portion-guide.js";
const recipe = {
  nutrition: { kcal: 1600 },
  ingredients: [
    { name: "Rice", quantity: 240, unit: "g" },
    { name: "Oil", quantity: 20, unit: "ml" },
  ],
  steps: [{ title: "Portion and store", text: "Cool promptly.", seconds: 0 }],
};
test("visible guide distinguishes raw ingredient shares from measured cooked portions", () => {
  const html = portionGuide(recipe, 4, String);
  assert.match(html, /1\/4/);
  assert.match(html, /400 kcal/);
  assert.match(html, /Rice: 60 g/);
  assert.match(html, /Oil: 5 ml/);
  assert.match(html, /not finished food weights/);
  assert.match(html, /cooked rice ÷ 4, curry ÷ 4/);
});
test("each guided dish gets its own serving divisor without changing timings or storage advice", () => {
  const before = structuredClone(recipe);
  const a = withPortionSteps({ recipe, portions: 3 }),
    b = withPortionSteps({ recipe, portions: 5 });
  assert.match(a.recipe.steps[0].text, /makes 3 equal portions/);
  assert.match(b.recipe.steps[0].text, /makes 5 equal portions/);
  assert.match(a.recipe.steps[0].text, /Cool promptly/);
  assert.equal(a.recipe.steps[0].seconds, 0);
  assert.deepEqual(recipe, before);
  const shake = { recipe: { ...recipe, freshAssembly: true }, portions: 1 };
  assert.equal(withPortionSteps(shake), shake);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  detailedSteps,
  ingredientMap,
  recipeMap,
  recipeNutrition,
} from "../lib/catalog.mjs";
import {
  latestRecipeRating,
  isRecipeAllowed,
  ratingButtons,
} from "../public/preferences.js";

test("the most recently saved verdict controls exclusion, not the number of earlier likes", () => {
  const s = {
    feedback: [
      { recipeId: "curry", rating: "love", date: "2026-09-12" },
      { recipeId: "curry", rating: "love", date: "2026-09-12" },
      // A review can refer to an earlier week while recording a newer decision.
      {
        recipeId: "curry",
        rating: "dislike",
        date: "2026-09-01",
        reviewId: "review",
      },
      { recipeId: "salad", rating: "love" },
    ],
  };
  assert.equal(latestRecipeRating(s, "curry"), "dislike");
  assert.equal(isRecipeAllowed(s, "curry"), false);
  assert.equal(isRecipeAllowed(s, "salad"), true);
  assert.equal(isRecipeAllowed(s, "untried"), true);
  s.feedback.push({ recipeId: "curry", rating: "okay" });
  assert.equal(isRecipeAllowed(s, "curry"), true);
  assert.equal(latestRecipeRating(s, "curry"), "okay");
  s.feedback.push({ recipeId: "curry", rating: "love" });
  assert.equal(latestRecipeRating(s, "curry"), "love");
});

test("invalid legacy feedback cannot undo a deliberate dislike", () => {
  const s = {
    feedback: [
      { recipeId: "curry", rating: "dislike" },
      null,
      { recipeId: "curry", rating: "unknown" },
    ],
  };
  assert.equal(isRecipeAllowed(s, "curry"), false);
  assert.equal(latestRecipeRating({}, "curry"), null);
});

test("direct rating controls show the saved verdict and a reversible preference without submitting their parent form", () => {
  const esc = (v) => String(v).replaceAll('"', "&quot;");
  const html = ratingButtons(
    { feedback: [{ recipeId: 'curry"', rating: "dislike" }] },
    'curry"',
    esc,
  );
  assert.equal((html.match(/type="button"/g) || []).length, 3);
  assert.match(html, /data-id="curry&quot;"/);
  assert.match(html, /data-rating="dislike" aria-pressed="true"/);
  assert.match(html, /data-rating="love" aria-pressed="false"/);
  assert.match(html, /data-rating="okay"/);
  assert.match(html, /excluded from future plans/);
});

test("optional whey shake accounts for measured powder, requires a shaker and is assembled fresh", () => {
  const r = recipeMap["whey-water"],
    n = recipeNutrition(r);
  assert.equal(r.supplement, true);
  assert.equal(r.freshAssembly, true);
  assert.deepEqual(r.equipment, ["shaker"]);
  assert.ok(ingredientMap.whey.allergens.includes("milk"));
  assert.equal(ingredientMap.whey.diet, "vegetarian");
  assert.equal(ingredientMap.whey.checkedAt, null);
  assert.match(ingredientMap.whey.source, /Estimate/);
  assert.equal(ingredientMap.whey.pack, 1000);
  assert.equal(n.protein, 24);
  assert.equal(n.kcal, 120);
  const steps = detailedSteps(r, 1.5)
    .map((s) => s.text)
    .join(" ");
  assert.match(steps, /45 g Whey/);
  assert.match(steps, /375 ml water/);
  assert.match(steps, /Do not mix several days/);
  assert.doesNotMatch(steps, /Reheat/);
});

test("new food recipes explicitly use every scaled ingredient in their cooking instructions", () => {
  for (const id of [
    "chicken-bean-rice",
    "tofu-lentil-bowl",
    "chicken-lentil-pot",
    "bean-eggs",
  ]) {
    const r = recipeMap[id],
      steps = detailedSteps(r, 1.5)
        .slice(1)
        .map((s) => s.text)
        .join(" ");
    for (const i of r.items) {
      const expected = `${Math.round(i.qty * 1.5 * 10) / 10} ${ingredientMap[i.id].unit} ${ingredientMap[i.id].name}`;
      assert.ok(
        steps.includes(expected),
        `${id} must instruct use of ${expected}`,
      );
    }
    assert.ok(recipeNutrition(r).protein >= 25, id);
    assert.ok(recipeNutrition(r).fibre >= 10, id);
  }
  assert.doesNotMatch(
    detailedSteps(recipeMap["bean-eggs"])
      .map((s) => s.text)
      .join(" "),
    /freshly cooked rice/,
  );
});

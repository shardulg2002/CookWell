import test from "node:test";
import assert from "node:assert/strict";
import { mealMixReport, hasMeatOrFish } from "../public/meal-mix.js";
import { recipeMap } from "../lib/catalog.mjs";
import { freshState, applyAction, viewState, today } from "../lib/domain.mjs";
test("mix counts main meals, not eggs as meat, and respects vegetarian diets", () => {
  assert.equal(hasMeatOrFish(recipeMap["eggs-toast"]), false);
  assert.equal(hasMeatOrFish(recipeMap["chicken-pasta"]), true);
  const meals = Array.from({ length: 14 }, (_, i) => ({
    slot: i % 2 ? "lunch" : "dinner",
    status: "planned",
    recipeId: i < 10 ? "chicken-pasta" : "eggs-toast",
  }));
  const report = mealMixReport(
    { diet: "omnivore", mainMealMix: "most" },
    meals,
    (id) => recipeMap[id],
  );
  assert.equal(report.count, 10);
  assert.equal(report.met, true);
  const failedMix = mealMixReport(
    { diet: "omnivore", mainMealMix: "most" },
    meals.map((m) => ({ ...m, recipeId: "eggs-toast" })),
    (id) => recipeMap[id],
  );
  assert.equal(failedMix.met, false);
  assert.equal(failedMix.count, 0);
  assert.equal(
    mealMixReport(
      { diet: "vegetarian", mainMealMix: "most" },
      meals,
      (id) => recipeMap[id],
    ).mode,
    "varied",
  );
});
test("explicit most-meat preference produces a majority with vegetarian variety, or an honest warning", () => {
  const s = freshState();
  applyAction(s, "profile", {
    name: "Synthetic",
    age: 24,
    height: 175,
    weight: 90,
    equationSex: "male",
    activity: 1.375,
    goal: "lose",
    budget: 35,
    equipment: ["hob", "microwave", "fridge", "freezer", "blender"],
    diet: "omnivore",
    cooking: "batch",
    activeLimit: 60,
    explore: 1,
    glucoseUnit: "mg/dL",
    startDate: today(),
    stepsTarget: 7000,
    calorieTarget: 1600,
    mainMealMix: "most",
  });
  const p = viewState(s).plans[0];
  assert.equal(p.nutritionReport.budget.within, true);
  assert.equal(p.nutritionReport.met, true);
  assert.ok(
    p.nutritionReport.mealMix.count >= 9,
    JSON.stringify(p.nutritionReport),
  );
  assert.ok(p.nutritionReport.mealMix.count <= 12);
  assert.ok(
    p.meals
      .filter((m) => ["lunch", "dinner"].includes(m.slot))
      .some((m) => !hasMeatOrFish(recipeMap[m.recipeId])),
  );
  const before = structuredClone(s.plans);
  applyAction(s, "mealMixSettings", { mainMealMix: "half" });
  assert.deepEqual(s.plans, before);
  s.profile.diet = "vegetarian";
  assert.throws(() =>
    applyAction(s, "mealMixSettings", { mainMealMix: "most" }),
  );
});

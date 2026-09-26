import test from "node:test";
import assert from "node:assert/strict";
import {
  freshState,
  applyAction,
  viewState,
  today,
  addDays,
  recipeAllowed,
} from "../lib/domain.mjs";
import { recipeMap, recipeNutrition } from "../lib/catalog.mjs";
import { mealNutrients, planNutrition } from "../lib/nutrition-planner.mjs";
import { nutritionTargets } from "../public/nutrition-targets.js";

const profile = {
  name: "Synthetic nutrition test",
  age: 24,
  height: 175,
  weight: 89.5,
  equationSex: "male",
  activity: 1.375,
  goal: "lose",
  budget: 40,
  equipment: ["hob", "oven", "microwave", "fridge", "freezer", "shaker"],
  hobCount: 2,
  cookEveryDays: 3,
  shopEveryDays: 7,
  allergens: [],
  avoid: [],
  diet: "omnivore",
  likes: "",
  cooking: "batch",
  activeLimit: 20,
  explore: 1,
  glucoseUnit: "mg/dL",
  startDate: today(),
  stepsTarget: 7000,
  calorieTarget: 1800,
  nutritionSettings: {
    mode: "moderate",
    proteinSafety: "none",
    shakes: "optional",
  },
};
function setup(overrides = {}) {
  const state = freshState();
  applyAction(state, "profile", { ...profile, ...overrides });
  return state;
}

test("a representative 1800 kcal week reaches daily targets inside the full-pack grocery budget", () => {
  const state = setup(),
    plan = viewState(state).plans[0],
    report = plan.nutritionReport;
  assert.equal(
    report.budget.within,
    true,
    `Full packs cost ${report.budget.total} pence`,
  );
  for (const day of report.days) {
    assert.equal(
      day.assessment.met,
      true,
      `${day.date}: ${JSON.stringify(day.assessment.issues)}`,
    );
    const independentlySummed = Object.fromEntries(
      Object.keys(day.totals).map((key) => [key, 0]),
    );
    for (const meal of plan.meals.filter((meal) => meal.date === day.date)) {
      const n = recipeNutrition(
        recipeMap[meal.recipeId],
        meal.multiplier,
        state.nutrition,
      );
      for (const key of Object.keys(independentlySummed))
        independentlySummed[key] += n[key];
    }
    for (const key of Object.keys(independentlySummed))
      assert.equal(
        day.totals[key],
        Math.round(independentlySummed[key] * 10) / 10,
      );
  }
  assert.equal(plan.sessions.length, 3);
  assert.equal(plan.shoppingTrips.length, 1);
  assert.ok(
    plan.meals.every((meal) => recipeAllowed(state, recipeMap[meal.recipeId])),
  );
});

test("future plans enforce dislikes and shake choices through optimisation", () => {
  const state = setup({
    nutritionSettings: { ...profile.nutritionSettings, shakes: "never" },
  });
  const disliked = state.plans[0].meals.find(
    (meal) => meal.slot === "lunch",
  ).recipeId;
  applyAction(state, "feedback", { recipeId: disliked, rating: "dislike" });
  applyAction(state, "generate", { start: addDays(today(), 7) });
  const plan = state.plans[1];
  assert.ok(plan.meals.every((meal) => meal.recipeId !== disliked));
  assert.ok(plan.meals.every((meal) => !recipeMap[meal.recipeId].supplement));
  assert.ok(
    plan.meals.every((meal) => recipeAllowed(state, recipeMap[meal.recipeId])),
  );
});

test("rebalancing preserves cooked and eaten snapshots, quantities and allocations", () => {
  const state = setup(),
    plan = state.plans[0],
    root = plan.meals.find((meal) => !meal.parentId);
  for (const item of recipeMap[root.recipeId].items)
    applyAction(state, "stock", {
      ingredientId: item.id,
      quantity: 10000,
      location: "cupboard",
    });
  applyAction(state, "cook", { id: root.id, cookedWeight: 1200 });
  applyAction(state, "eat", { id: root.id, portions: 0.5 });
  const fixedMeals = structuredClone(
    plan.meals.filter((meal) => meal.batchId || meal.status === "eaten"),
  );
  const batches = structuredClone(state.batches),
    stock = structuredClone(state.inventory);
  const cookedMeal = plan.meals.find(
    (meal) => meal.batchId && meal.status !== "eaten",
  );
  const oldNutrition = mealNutrients(state, cookedMeal);
  // A new packet label may change future meals, but must not rewrite cooked food.
  const ingredient = recipeMap[cookedMeal.recipeId].items[0].id;
  state.nutrition[ingredient] = {
    kcal: 50,
    protein: 1,
    carbs: 5,
    fat: 2,
    fibre: 1,
    salt: 0.1,
  };
  assert.deepEqual(mealNutrients(state, cookedMeal), oldNutrition);
  applyAction(state, "rebalancePlan", { planId: plan.id, confirmed: true });
  assert.deepEqual(
    plan.meals.filter((meal) => meal.batchId || meal.status === "eaten"),
    fixedMeals,
  );
  assert.deepEqual(state.batches, batches);
  assert.deepEqual(state.inventory, stock);
});

test("an impossible budget or unknown meal cannot be reported as targets achieved", () => {
  const state = setup({ budget: 5 }),
    plan = state.plans[0];
  let report = viewState(state).plans[0].nutritionReport;
  assert.equal(report.met, false);
  const meal = plan.meals.find((meal) => meal.date === today());
  applyAction(state, "mealStatus", { id: meal.id, status: "out" });
  report = planNutrition(state, plan, report.budget.total);
  assert.equal(report.days[0].assessment.complete, false);
  assert.equal(report.days[0].assessment.met, false);
  assert.equal(report.days[0].externalSlots, 1);
  assert.equal(nutritionTargets(state.profile).ready, true);
});

test("a daily shake preference uses compatible equipment and rejects incompatible exclusions", () => {
  const state = setup({
    nutritionSettings: { ...profile.nutritionSettings, shakes: "daily" },
  });
  assert.ok(
    state.plans[0].meals
      .filter((meal) => meal.slot === "snack")
      .every((meal) => recipeMap[meal.recipeId].supplement),
  );
  const plan = viewState(state).plans[0];
  assert.ok(
    plan.sessions.every((s) =>
      s.dishes.every((d) => d.recipeId !== "whey-water"),
    ),
  );
  assert.ok(plan.shopping.some((row) => row.id === "whey" && row.packs >= 1));
  const shake = state.plans[0].meals.find((m) => m.slot === "snack");
  assert.equal(shake.parentId, null);
  assert.equal(shake.cookDate, shake.date);
  assert.throws(
    () => applyAction(state, "batchSize", { id: shake.id, portions: 3 }),
    /one serving fresh/,
  );
  applyAction(state, "stock", {
    ingredientId: "whey",
    quantity: 1000,
    location: "cupboard",
  });
  const stockBefore = structuredClone(state.inventory);
  assert.throws(
    () => applyAction(state, "cook", { id: shake.id, freeze: true }),
    /one shake fresh/,
  );
  assert.deepEqual(state.inventory, stockBefore);
  applyAction(state, "cook", { id: shake.id });
  const batch = state.batches.find((b) => b.id === shake.batchId);
  assert.equal(batch.location, "eat now");
  assert.equal(batch.remaining, 1);
  assert.throws(
    () =>
      applyAction(state, "batch", {
        id: batch.id,
        operation: "freeze",
        portions: 1,
      }),
    /mixed fresh/,
  );
  applyAction(state, "eat", { id: shake.id, portions: 1 });
  assert.equal(batch.remaining, 0);
  assert.equal(shake.actualNutrition.protein, batch.nutrition.protein);
  assert.throws(
    () =>
      setup({
        equipment: ["hob", "oven", "fridge", "freezer"],
        nutritionSettings: { ...profile.nutritionSettings, shakes: "daily" },
      }),
    (error) => error.status === 400 && /shake|snack/i.test(error.message),
  );
});

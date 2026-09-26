import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  applyAction,
  freshState,
  profileInput,
  requirements,
  shopping,
  today,
  viewState,
} from "../lib/domain.mjs";
import { ingredients, recipeMap, recipeNutrition } from "../lib/catalog.mjs";
import { arrangeBatches } from "../lib/rhythm.mjs";
import { mealNutrients } from "../lib/nutrition-planner.mjs";
import { previewSwap } from "../lib/swap-preview.mjs";

const profile = {
  name: "Swap preview test",
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
  stepsTarget: 7000,
  calorieTarget: 1800,
  nutritionSettings: {
    mode: "moderate",
    proteinSafety: "none",
    shakes: "optional",
  },
};
function setup(start = today()) {
  const state = freshState();
  state.profile = profileInput({ ...profile, startDate: start });
  const choices = {
    breakfast: "banana-oats",
    lunch: "lentil-soup",
    snack: "apple-snack",
    dinner: "chicken-curry",
  };
  const plan = { id: "preview-week", start, status: "active", meals: [] };
  for (let offset = 0; offset < 7; offset++)
    for (const [slot, recipeId] of Object.entries(choices))
      plan.meals.push({
        id: `meal-${offset}-${slot}`,
        date: addDays(start, offset),
        slot,
        recipeId,
        multiplier: 1,
        parentId: null,
        status: "planned",
      });
  arrangeBatches(plan, state.profile);
  state.plans.push(plan);
  return state;
}
function fullKitchen(state) {
  state.inventory = ingredients.map((ingredient) => ({
    id: `stock-${ingredient.id}`,
    ingredientId: ingredient.id,
    quantity: 10000,
    location: "cupboard",
    expires: null,
  }));
}
function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

test("swap preview leaves state frozen and exposes portion, day and cooking changes", () => {
  const state = setup(),
    before = structuredClone(state);
  deepFreeze(state);
  const result = previewSwap(state, {
    id: "meal-0-breakfast",
    recipeId: "eggs-toast",
  });
  assert.deepEqual(state, before);
  assert.equal(result.revision, before.revision);
  assert.equal(result.before.meal.recipeId, "banana-oats");
  assert.equal(result.after.meal.recipeId, "eggs-toast");
  assert.deepEqual(
    result.after.meal.nutrition,
    recipeNutrition(recipeMap["eggs-toast"], result.after.meal.multiplier),
  );
  assert.equal(result.before.meal.batch.portions, 3);
  assert.equal(result.after.meal.batch.portions, 1);
  assert.equal(result.deltas.batchPortions, -2);
  assert.equal(result.after.meal.batch.cookDate, today());
  assert.ok(
    result.changedMeals.some(
      (meal) =>
        meal.id === "meal-1-breakfast" && meal.after.batch.portions === 2,
    ),
  );
  assert.ok(result.after.day.assessment.issues.length > 0);
  assert.ok(
    result.after.meal.ingredients.every(
      (ingredient) =>
        ingredient.quantity > 0 && ["g", "ml"].includes(ingredient.unit),
    ),
  );
});

test("preview uses full-pack thresholds, real stock and previous purchases in integer pence", () => {
  const state = setup();
  fullKitchen(state);
  state.prices.egg = { pack: 600, price: 321, source: "Test pack" };
  state.purchases.push(
    { id: "past-buy", planId: "preview-week", cost: 579 },
    { id: "other-week-buy", planId: "another-week", cost: 999 },
  );
  const final = structuredClone(state);
  applyAction(final, "swap", {
    id: "meal-0-breakfast",
    recipeId: "eggs-toast",
  });
  const quantity = requirements(final, final.plans[0]).egg;
  const stock = state.inventory.find((lot) => lot.ingredientId === "egg");
  stock.quantity = quantity;
  let preview = previewSwap(state, {
    id: "meal-0-breakfast",
    recipeId: "eggs-toast",
  });
  assert.equal(preview.before.budget.total, 579);
  assert.equal(preview.after.budget.total, 579);
  assert.equal(preview.deltas.cost, 0);
  stock.quantity = quantity - 1;
  preview = previewSwap(state, {
    id: "meal-0-breakfast",
    recipeId: "eggs-toast",
  });
  assert.equal(preview.after.shopping.find((row) => row.id === "egg").packs, 1);
  assert.equal(preview.after.budget.spent, 579);
  assert.equal(preview.after.budget.shopping, 321);
  assert.equal(preview.after.budget.total, 900);
  assert.equal(preview.deltas.cost, 321);
  assert.ok(Number.isInteger(preview.after.budget.total));
});

test("prepared swaps keep historical nutrition and leftover portions and match the final swap", () => {
  const state = setup();
  fullKitchen(state);
  applyAction(state, "cook", {
    id: "meal-0-breakfast",
    cookedWeight: 1200,
    plannedStorage: true,
  });
  applyAction(state, "eat", { id: "meal-0-breakfast" });
  const prepared = state.plans[0].meals.find(
    (meal) => meal.id === "meal-1-breakfast",
  );
  const oldNutrition = mealNutrients(state, prepared);
  const ingredientId = recipeMap[prepared.recipeId].items[0].id;
  state.nutrition[ingredientId] = {
    kcal: 50,
    protein: 1,
    carbs: 2,
    fat: 1,
    fibre: 0,
    salt: 0,
  };
  const before = structuredClone(state);
  const result = previewSwap(state, {
    id: prepared.id,
    recipeId: "eggs-toast",
  });
  assert.deepEqual(state, before);
  assert.deepEqual(result.before.meal.nutrition, oldNutrition);
  assert.equal(result.before.meal.prepared, true);
  assert.equal(result.before.meal.servingGrams, 400);
  assert.equal(result.after.meal.prepared, false);
  assert.equal(
    result.releasedPortions.reduce((sum, batch) => sum + batch.portions, 0),
    1,
  );
  applyAction(state, "swap", { id: prepared.id, recipeId: "eggs-toast" });
  assert.deepEqual(state.inventory, before.inventory);
  assert.deepEqual(state.batches, before.batches);
  assert.deepEqual(
    state.plans[0].meals.find((meal) => meal.id === "meal-0-breakfast"),
    before.plans[0].meals.find((meal) => meal.id === "meal-0-breakfast"),
  );
  const current = viewState(state).plans[0];
  assert.deepEqual(
    result.after.day.totals,
    current.nutritionReport.days.find((day) => day.date === prepared.date)
      .totals,
  );
  assert.deepEqual(result.after.shopping, current.shopping);
  assert.deepEqual(result.after.sessions, current.sessions);
  assert.deepEqual(result.after.shoppingTrips, current.shoppingTrips);
});

test("preview uses final swap exclusions and rejects eaten or wrong-slot meals without writing", () => {
  const modifications = [
    (state) =>
      state.feedback.push({ recipeId: "eggs-toast", rating: "dislike" }),
    (state) => (state.profile.equipment = ["fridge", "freezer"]),
    (state) => (state.profile.allergens = ["egg"]),
    (state) => (state.profile.avoid = ["egg"]),
    (state) => (state.plans[0].meals[0].status = "eaten"),
  ];
  for (const modify of modifications) {
    const state = setup();
    modify(state);
    const before = structuredClone(state);
    assert.throws(
      () =>
        previewSwap(state, { id: "meal-0-breakfast", recipeId: "eggs-toast" }),
      (error) => error.status === 400,
    );
    assert.deepEqual(state, before);
  }
  assert.throws(
    () =>
      previewSwap(setup(), {
        id: "meal-0-breakfast",
        recipeId: "chicken-curry",
      }),
    (error) => error.status === 400,
  );
  assert.throws(
    () => previewSwap(setup(), { id: "missing", recipeId: "eggs-toast" }),
    (error) => error.status === 400,
  );
});

test("near-rollover preview does not create another week or alter active-plan stock reservations", () => {
  const state = setup(addDays(today(), -6));
  fullKitchen(state);
  const before = structuredClone(state),
    plan = state.plans[0];
  const result = previewSwap(state, {
    id: "meal-6-breakfast",
    recipeId: "eggs-toast",
  });
  assert.deepEqual(state, before);
  assert.equal(state.plans.length, 1);
  assert.deepEqual(result.before.shopping, shopping(state, plan));
  assert.ok(
    result.changedMeals.every((change) =>
      plan.meals.some((meal) => meal.id === change.id),
    ),
  );
  assert.ok(
    result.affectedDays.every(
      (day) => day.date >= plan.start && day.date <= addDays(plan.start, 6),
    ),
  );
});

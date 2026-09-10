import test from "node:test";
import assert from "node:assert/strict";
import {
  freshState,
  applyAction,
  shopping,
  available,
  generatePlan,
  requirements,
  calorieEstimate,
  profileInput,
  viewState,
  today,
  addDays,
} from "../lib/domain.mjs";
import {
  recipes,
  recipeMap,
  recipeNutrition,
  ingredientMap,
  detailedSteps,
} from "../lib/catalog.mjs";
export const profile = {
  name: "Test cook",
  age: 24,
  height: 175,
  weight: 89.5,
  equationSex: "male",
  activity: 1.375,
  goal: "lose",
  budget: 40,
  equipment: ["hob", "oven", "fridge", "freezer", "scales"],
  allergens: [],
  avoid: [],
  diet: "omnivore",
  likes: "",
  cooking: "batch",
  activeLimit: 20,
  explore: 1,
  glucoseUnit: "mg/dL",
  targets: { before: { min: 80, max: 100 } },
  startDate: today(),
  stepsTarget: 7000,
};
function setup(overrides = {}) {
  const s = freshState();
  applyAction(s, "profile", { ...profile, ...overrides });
  return s;
}
test("onboarding creates 28 real meal slots without fabricated health/stock", () => {
  const s = setup();
  assert.equal(s.plans[0].meals.length, 28);
  assert.equal(s.inventory.length, 0);
  assert.equal(s.logs.length, 0);
  assert.ok(s.profile.calorieTarget >= 1500);
});
test("allergies, diet and equipment are hard recipe filters", () => {
  const s = setup({
    diet: "vegan",
    allergens: ["peanut"],
    equipment: ["hob"],
    avoid: ["coconut"],
  });
  for (const m of s.plans[0].meals) {
    const r = recipeMap[m.recipeId];
    assert.ok(!r.equipment.includes("oven"));
    for (const i of r.items) {
      assert.equal(ingredientMap[i.id].diet, "vegan");
      assert.ok(!ingredientMap[i.id].allergens.includes("peanut"));
      assert.notEqual(i.id, "coconut");
    }
  }
});
test("all four meal types can be swapped repeatedly; groceries follow", () => {
  const s = setup(),
    plan = s.plans[0];
  for (const slot of ["breakfast", "lunch", "snack", "dinner"]) {
    const m = plan.meals.find((m) => m.slot === slot);
    for (let i = 0; i < 2; i++) {
      const r = recipes.find(
        (r) => r.slots.includes(slot) && r.id !== m.recipeId,
      );
      applyAction(s, "swap", { id: m.id, recipeId: r.id });
      assert.equal(m.recipeId, r.id);
    }
  }
  const raw = requirements(s, plan);
  assert.ok(Object.values(raw).every((v) => v > 0));
  assert.ok(shopping(s, plan).some((r) => r.packs > 0));
});
test("shopping rounds to full edible packs and subtracts exact stock", () => {
  const s = setup();
  const plan = s.plans[0],
    row = shopping(s, plan).find((r) => r.id === "oats");
  assert.ok(row);
  applyAction(s, "stock", {
    ingredientId: "oats",
    quantity: row.need + 100,
    location: "cupboard",
  });
  assert.equal(shopping(s, plan).find((r) => r.id === "oats").packs, 0);
});
test("purchase -> stock -> prepare -> portions -> eat is consistent and prevents double deduction", () => {
  const s = setup(),
    plan = s.plans[0],
    meal = plan.meals.find((m) => m.slot === "lunch" && !m.parentId);
  for (const row of shopping(s, plan)) {
    applyAction(s, "purchase", {
      planId: plan.id,
      id: row.id,
      packs: row.packs,
      location: "fridge",
    });
  }
  const recipe = recipeMap[meal.recipeId],
    item = recipe.items[0],
    before = available(s, item.id);
  applyAction(s, "cook", { id: meal.id });
  assert.ok(available(s, item.id) < before);
  const batch = s.batches[0],
    remaining = batch.remaining;
  assert.throws(
    () => applyAction(s, "cook", { id: meal.id }),
    /already cooked/i,
  );
  applyAction(s, "eat", { id: meal.id });
  assert.equal(batch.remaining, remaining - 1);
  assert.equal(meal.status, "eaten");
  assert.ok(meal.actualNutrition.kcal > 0);
  assert.throws(
    () => applyAction(s, "eat", { id: meal.id }),
    /Already recorded/,
  );
});
test("stock shortages prevent cooking without changing inventory", () => {
  const s = setup();
  const before = JSON.stringify(s.inventory);
  assert.throws(
    () => applyAction(s, "cook", { id: s.plans[0].meals[0].id }),
    /purchased/,
  );
  assert.equal(JSON.stringify(s.inventory), before);
});
test("expired stock is excluded from shopping and cooking", () => {
  const s = setup();
  applyAction(s, "stock", {
    ingredientId: "oats",
    quantity: 9999,
    location: "cupboard",
    expires: addDays(today(), -1),
  });
  assert.equal(available(s, "oats"), 0);
  assert.ok(shopping(s, s.plans[0]).find((r) => r.id === "oats").packs > 0);
});
test("next week uses stock remaining after earlier outstanding plans", () => {
  const s = setup(),
    p = s.plans[0];
  applyAction(s, "stock", {
    ingredientId: "rice",
    quantity: 10000,
    location: "cupboard",
  });
  const next = generatePlan(s, addDays(p.start, 7), true);
  assert.equal(next.status, "draft");
  const row = shopping(s, next).find((r) => r.id === "rice");
  if (row) {
    assert.equal(row.packs, 0);
    assert.ok(row.have < 10000);
  }
  assert.equal(generatePlan(s, next.start).id, next.id);
});
test("nutrition derives from ingredient quantity and doubles when scaled", () => {
  for (const r of recipes) {
    const n = recipeNutrition(r);
    const double = recipeNutrition(r, 2);
    assert.ok(n.kcal > 0);
    assert.ok(Math.abs(double.kcal - 2 * n.kcal) < 0.2);
    const steps = detailedSteps(r, 2);
    assert.ok(steps.length >= 3);
    for (const i of r.items)
      assert.ok(
        steps.some((s) =>
          s.text.includes(
            Math.round(i.qty * 2) + " " + ingredientMap[i.id].unit,
          ),
        ),
      );
  }
});
test("editing a price immediately updates remaining grocery total", () => {
  const s = setup(),
    p = s.plans[0],
    row = shopping(s, p)[0];
  applyAction(s, "price", {
    id: row.id,
    price: 10,
    pack: 100,
    retailer: "Test shop",
  });
  const changed = shopping(s, p).find((r) => r.id === row.id);
  assert.equal(changed.cost, changed.packs * 1000);
});
test("health preserves original unit, timing, and measured nutrition", () => {
  const s = setup();
  applyAction(s, "log", {
    type: "glucose",
    value: 6.2,
    unit: "mmol/L",
    timing: "after",
    minutesAfter: 90,
  });
  assert.equal(s.logs[0].value, 6.2);
  assert.equal(s.logs[0].unit, "mmol/L");
  assert.equal(s.logs[0].minutesAfter, 90);
  assert.throws(() =>
    applyAction(s, "log", {
      type: "glucose",
      value: "NaN",
      unit: "mg/dL",
      timing: "after",
    }),
  );
});
test("calorie calculation is transparent and does not prescribe extreme restriction", () => {
  const p = profileInput(profile),
    n = calorieEstimate(p);
  assert.ok(n.maintenance > n.target);
  assert.equal(n.target, p.calorieTarget);
  assert.throws(() => profileInput({ ...profile, age: 10 }));
  assert.throws(() => profileInput({ ...profile, calorieTarget: 900 }));
});
test("automatic rollover creates one draft on return late in a week", () => {
  const s = setup({ startDate: addDays(today(), -6) });
  viewState(s);
  assert.equal(s.plans.filter((p) => p.status === "draft").length, 1);
  viewState(s);
  assert.equal(s.plans.length, 2);
});
test("one-sided glucose targets and invalid dates are handled explicitly", () => {
  const p = profileInput({
    ...profile,
    targets: { after: { min: "", max: 120 } },
  });
  assert.deepEqual(p.targets.after, { min: null, max: 120 });
  assert.throws(
    () => profileInput({ ...profile, startDate: "2026-99-99" }),
    (e) => e.status === 400,
  );
});
test("swapping a prepared meal preserves leftovers and allows safe reallocation", () => {
  const s = setup(),
    p = s.plans[0],
    m = p.meals.find((m) => m.slot === "lunch");
  for (const row of shopping(s, p))
    if (row.packs)
      applyAction(s, "purchase", {
        planId: p.id,
        id: row.id,
        packs: row.packs,
      });
  applyAction(s, "cook", { id: m.id });
  const batch = s.batches[0],
    qty = batch.remaining,
    oldRecipe = m.recipeId;
  const replacement = recipes.find(
    (r) => r.slots.includes("lunch") && r.id !== oldRecipe,
  );
  applyAction(s, "swap", { id: m.id, recipeId: replacement.id });
  assert.equal(batch.remaining, qty);
  assert.equal(m.batchId, undefined);
  applyAction(s, "useBatch", { id: m.id, batchId: batch.id });
  assert.equal(m.recipeId, oldRecipe);
  assert.equal(m.batchId, batch.id);
  applyAction(s, "eat", { id: m.id });
  assert.equal(batch.remaining, qty - 1);
});
test("waste releases allocated meals for recooking without negative portions", () => {
  const s = setup(),
    p = s.plans[0],
    m = p.meals.find((m) => m.slot === "lunch");
  for (const row of shopping(s, p))
    if (row.packs)
      applyAction(s, "purchase", {
        planId: p.id,
        id: row.id,
        packs: row.packs,
      });
  applyAction(s, "cook", { id: m.id });
  const b = s.batches[0];
  applyAction(s, "batch", {
    id: b.id,
    operation: "waste",
    portions: b.remaining,
  });
  assert.equal(b.remaining, 0);
  assert.ok(p.meals.every((m) => m.status !== "planned" || m.batchId !== b.id));
  assert.ok(Object.keys(requirements(s, p)).length);
});
test("an unallocated frozen batch is carried into the next weekly draft", () => {
  const s = setup(),
    p = s.plans[0],
    m = p.meals.find((m) => m.slot === "lunch");
  for (const row of shopping(s, p))
    if (row.packs)
      applyAction(s, "purchase", {
        planId: p.id,
        id: row.id,
        packs: row.packs,
      });
  applyAction(s, "cook", { id: m.id, freeze: true });
  const b = s.batches[0];
  for (const meal of p.meals.filter((m) => m.batchId === b.id))
    applyAction(s, "mealStatus", { id: meal.id, status: "out" });
  const next = generatePlan(s, addDays(p.start, 7), true);
  assert.equal(
    next.meals.filter((m) => m.batchId === b.id).length,
    b.remaining,
  );
  assert.throws(
    () =>
      applyAction(s, "eat", {
        id: next.meals.find((m) => m.batchId === b.id).id,
      }),
    /Defrost/,
  );
});

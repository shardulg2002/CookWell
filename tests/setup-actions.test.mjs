import test from "node:test";
import assert from "node:assert/strict";
import { freshState, applyAction, today, addDays } from "../lib/domain.mjs";
import { equipmentInput } from "../lib/setup-actions.mjs";
import { profileInput } from "../lib/domain.mjs";
import { createSetupUI } from "../public/setup-ui.js";
function state() {
  const s = freshState();
  s.profile = {
    startDate: today(),
    equipment: ["hob", "fridge", "freezer"],
    hobCount: 2,
    cooking: "batch",
    cookEveryDays: 3,
    name: "Test",
    calorieTarget: 1800,
    targets: { before: { max: 100 } },
    budget: 4000,
  };
  s.plans = [
    {
      id: "week",
      start: today(),
      status: "active",
      stockConfirmedAt: "old",
      meals: Array.from({ length: 7 }, (_, i) => ({
        id: "meal" + i,
        date: addDays(today(), i),
        slot: "dinner",
        status: "planned",
        recipeId: "eggs-toast",
        multiplier: 1,
      })),
    },
  ];
  return s;
}
test("new dated draft keeps existing meals and stock intact", () => {
  const s = state();
  s.profile = profileInput({
    name: "Test",
    age: 24,
    height: 175,
    weight: 80,
    equationSex: "male",
    activity: 1.375,
    goal: "maintain",
    budget: 40,
    equipment: ["hob", "oven", "fridge", "freezer"],
    diet: "omnivore",
    cooking: "batch",
    activeLimit: 30,
    explore: 1,
    glucoseUnit: "mg/dL",
    startDate: today(),
    stepsTarget: 7000,
  });
  const previous = structuredClone(s.plans[0]);
  s.inventory.push({
    id: "rice-stock",
    ingredientId: "rice",
    quantity: 500,
    location: "cupboard",
    expires: null,
  });
  const stock = structuredClone(s.inventory);
  const start = addDays(today(), 7);
  applyAction(s, "planDates", { mode: "new", start, confirmed: true });
  assert.deepEqual(
    s.plans.find((p) => p.id === "week"),
    previous,
  );
  const p = s.plans.find((p) => p.start === start);
  assert.equal(p.status, "draft");
  assert.equal(p.meals.length, 28);
  assert.equal(p.meals.at(-1).date, addDays(start, 6));
  assert.deepEqual(s.inventory, stock);
});
test("setup screens expose explicit actions and escape compatibility warnings", () => {
  let html = "";
  const s = state();
  s.catalog = [{ id: "eggs-toast", allowed: false, title: "<unsafe>" }];
  const ui = createSetupUI({
    getState: () => s,
    chosenPlan: () => s.plans[0],
    modal: (x) => (html = x),
    mutate: async () => true,
    esc: (x) => String(x).replaceAll("<", "&lt;"),
    field: () => "",
    select: () => "",
    btn: (label) => label,
    onPlan: () => {},
  });
  assert.match(ui.card(), /Edit equipment/);
  assert.equal(ui.click("plan-dates"), true);
  assert.match(html, /no purchases/);
  assert.match(html, /name="confirmed" required/);
  ui.click("equipment-settings");
  assert.match(html, /Save equipment/);
  assert.match(html, /Existing recipes will not be replaced/);
  assert.match(ui.warnings(), /&lt;unsafe>/);
  assert.doesNotMatch(ui.warnings(), /<unsafe>/);
});
test("moving an unused week shifts meals and cooking dates, keeps identities and requires stock reconfirmation", () => {
  const s = state(),
    start = addDays(today(), 4),
    ids = s.plans[0].meals.map((m) => m.id);
  applyAction(s, "planDates", {
    mode: "move",
    planId: "week",
    start,
    confirmed: true,
  });
  const p = s.plans[0];
  assert.equal(p.start, start);
  assert.equal(p.status, "draft");
  assert.equal(p.stockConfirmedAt, undefined);
  assert.deepEqual(
    p.meals.map((m) => m.id),
    ids,
  );
  assert.equal(p.meals.at(-1).date, addDays(start, 6));
  assert.ok(p.meals.every((m) => m.cookDate >= start && m.cookDate <= m.date));
  assert.equal(s.profile.startDate, start);
});
test("used, overlapping, unconfirmed and historical moves are rejected before any mutation", () => {
  const attempts = [
    (s) => s.purchases.push({ planId: "week", cost: 100 }),
    (s) => (s.plans[0].meals[0].batchId = "batch"),
    (s) => (s.plans[0].meals[0].status = "eaten"),
    (s) => (s.plans[0].meals[0].status = "skipped"),
    (s) => (s.reviews = [{ planId: "week" }]),
    (s) => s.plans.push({ id: "other", start: addDays(today(), 7), meals: [] }),
  ];
  for (const modify of attempts) {
    const s = state();
    modify(s);
    const before = structuredClone(s);
    assert.throws(() =>
      applyAction(s, "planDates", {
        mode: "move",
        planId: "week",
        start: addDays(today(), 7),
        confirmed: true,
      }),
    );
    assert.deepEqual(s, before);
  }
  assert.throws(() =>
    applyAction(state(), "planDates", {
      mode: "move",
      planId: "week",
      start: today(),
    }),
  );
  assert.throws(() =>
    applyAction(state(), "planDates", {
      mode: "move",
      planId: "week",
      start: addDays(today(), -1),
      confirmed: true,
    }),
  );
});
test("equipment updates preserve health, goals, stock and prepared meals", () => {
  const s = state();
  s.plans[0].meals[0].batchId = "cooked";
  s.batches = [{ id: "cooked", nutrition: { kcal: 400 }, remaining: 1 }];
  const p = structuredClone(s.profile),
    cooked = structuredClone(s.plans[0].meals[0]),
    batches = structuredClone(s.batches);
  applyAction(s, "equipmentSettings", {
    equipment: ["hob", "fridge", "blender"],
    hobCount: 1,
    hobType: "induction",
    hobScale: "1-9",
    hobModel: "CDA",
  });
  for (const key of ["calorieTarget", "targets", "budget", "name", "startDate"])
    assert.deepEqual(s.profile[key], p[key]);
  assert.deepEqual(s.batches, batches);
  assert.deepEqual(s.plans[0].meals[0], cooked);
  assert.equal(s.profile.hobCount, 1);
  assert.throws(() =>
    equipmentInput({ equipment: ["spaceship"], hobCount: 2 }),
  );
  assert.throws(() => equipmentInput({ equipment: [], hobCount: 1.5 }));
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  freshState,
  applyAction,
  viewState,
  today,
  addDays,
  getRecipe,
  shopping,
  priceOf,
  profileInput,
} from "../lib/domain.mjs";
import { recipes, recipeMap } from "../lib/catalog.mjs";
import {
  cadence,
  sessionsFor,
  arrangeBatches,
  shoppingTrips,
} from "../lib/rhythm.mjs";
import { yieldInfo, allocations } from "../public/portions.js";
import {
  createFlow,
  readyStages,
  beginStage,
  advanceStage,
  startStageTimer,
  checkStage,
  heldResources,
} from "../public/cook-flow.js";
const profile = {
  name: "Rhythm test",
  age: 24,
  height: 175,
  weight: 89.5,
  equationSex: "male",
  activity: 1.375,
  goal: "lose",
  budget: 40,
  equipment: ["hob", "oven", "fridge", "freezer"],
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
};
function setup(overrides = {}) {
  const s = freshState();
  applyAction(s, "profile", { ...profile, ...overrides });
  return s;
}
function finish(flow, stage) {
  beginStage(flow, stage.id);
  while (stage.cursor < stage.instructions.length - 1)
    advanceStage(flow, stage.id);
  if (stage.parallel && stage.seconds)
    startStageTimer(flow, stage.id, stage.seconds, 1000);
  else advanceStage(flow, stage.id);
}
function flowFor(ids, hobs = 2) {
  const s = freshState();
  s.profile = profileInput(profile);
  return createFlow(
    ids.map((id, i) => ({ mealId: "dish" + i, recipe: getRecipe(s, id, 3) })),
    { ...s.profile, hobCount: hobs },
  );
}
test("three-day plans cook on days 1/4/7, automatically count every recipe occurrence and shop weekly", () => {
  const s = setup(),
    p = viewState(s).plans[0];
  assert.deepEqual(
    p.sessions.map((x) => x.date),
    [today(), addDays(today(), 3), addDays(today(), 6)],
  );
  assert.equal(p.shoppingTrips.length, 1);
  assert.equal(
    p.sessions.flatMap((s) => s.dishes).reduce((n, d) => n + d.portions, 0),
    28,
  );
  for (const session of p.sessions)
    for (const dish of session.dishes) {
      const root = p.meals.find((m) => m.id === dish.mealId);
      assert.equal(dish.portions, yieldInfo(p, root).group.length);
      assert.equal(dish.fridge + dish.freeze, dish.portions);
      assert.ok(
        dish.uses.every(
          (m) => m.date >= session.date && m.date <= addDays(session.date, 2),
        ),
      );
    }
  assert.equal(
    p.shopping.reduce((n, r) => n + r.cost, 0),
    p.shoppingTrips[0].total,
  );
});
test("two-day/no-freezer and no-fridge plans respect storage capability", () => {
  const s = setup({ equipment: ["hob", "oven", "fridge"], cookEveryDays: 3 }),
    p = viewState(s).plans[0];
  assert.equal(cadence(s.profile), 2);
  assert.equal(p.sessions.length, 4);
  assert.ok(p.sessions.every((x) => x.dishes.every((d) => d.freeze === 0)));
  assert.ok(
    p.meals.every(
      (m) => !recipeMap[m.recipeId].items.some((i) => i.id === "rice"),
    ),
  );
  const daily = setup({ equipment: ["hob", "oven"] });
  assert.equal(sessionsFor(daily.plans[0], daily.profile).length, 7);
});
test("skips and swaps recalculate batches; cooked allocations stay untouched", () => {
  const s = setup(),
    p = s.plans[0],
    root = p.meals.find((m) => !m.parentId),
    child = p.meals.find((m) => m.parentId === root.id),
    before = yieldInfo(p, root).portions;
  applyAction(s, "mealStatus", { id: child.id, status: "out" });
  assert.equal(yieldInfo(p, root).portions, before - 1);
  const replacement = recipes.find(
    (r) =>
      r.id !== root.recipeId &&
      r.slots.includes(root.slot) &&
      r.equipment.every((e) => s.profile.equipment.includes(e)),
  );
  applyAction(s, "swap", { id: root.id, recipeId: replacement.id });
  assert.equal(root.recipeId, replacement.id);
  assert.equal(yieldInfo(p, root).portions, 1);
  for (const i of recipeMap[root.recipeId].items)
    applyAction(s, "stock", {
      ingredientId: i.id,
      quantity: 10000,
      location: "cupboard",
    });
  applyAction(s, "cook", { id: root.id, cookedWeight: 400 });
  const snapshot = structuredClone(root),
    batch = structuredClone(s.batches);
  applyAction(s, "rhythm", {
    planId: p.id,
    cooking: "batch",
    cookEveryDays: 2,
    shopEveryDays: 3,
    hobCount: 2,
  });
  assert.deepEqual(root, snapshot);
  assert.deepEqual(s.batches, batch);
});
test("planned storage confirmation freezes the later servings and links correct meals", () => {
  const s = setup(),
    p = s.plans[0],
    d = sessionsFor(p, s.profile)[0].dishes.find((d) => d.freeze > 0),
    root = p.meals.find((m) => m.id === d.mealId);
  for (const i of recipeMap[root.recipeId].items)
    applyAction(s, "stock", {
      ingredientId: i.id,
      quantity: 10000,
      location: "cupboard",
    });
  applyAction(s, "cook", {
    id: root.id,
    cookedWeight: d.portions * 400,
    plannedStorage: true,
  });
  const frozen = s.batches.find((b) => b.location === "freezer");
  assert.equal(frozen.remaining, d.freeze);
  assert.equal(frozen.gramsPerPortion, 400);
  for (const use of d.uses.filter((m) => m.storage === "freezer"))
    assert.ok(
      allocations(p.meals.find((m) => m.id === use.id)).some(
        (a) => a.batchId === frozen.id,
      ),
    );
});
test("shopping trips reuse purchased-pack leftovers but not raw stock expired before cooking day", () => {
  const s = setup({ shopEveryDays: 3 }),
    r = recipeMap["banana-oats"];
  const p = {
    id: "trip-test",
    start: today(),
    meals: [0, 3, 6].map((n, i) => ({
      id: "m" + i,
      date: addDays(today(), n),
      cookDate: addDays(today(), n),
      slot: "breakfast",
      status: "planned",
      recipeId: r.id,
      multiplier: 1,
      parentId: null,
    })),
  };
  const qty = r.items.find((i) => i.id === "oats").qty;
  s.inventory = [
    { ingredientId: "oats", quantity: qty * 3, expires: addDays(today(), 1) },
  ];
  const trips = shoppingTrips(s, p, priceOf, { oats: qty * 3 });
  assert.equal(trips.length, 3);
  assert.equal(trips[0].rows.find((r) => r.id === "oats").packs, 0);
  assert.equal(trips[1].rows.find((r) => r.id === "oats").packs, 1);
  assert.equal(trips[2].rows.find((r) => r.id === "oats").packs, 0);
  assert.ok(trips[2].rows.find((r) => r.id === "oats").have > 0);
});
test("two hob rings allow rice and sauce together, one ring does not", () => {
  for (const hobs of [1, 2]) {
    const flow = flowFor(["chicken-curry"], hobs);
    finish(flow, readyStages(flow)[0]);
    const rice = readyStages(flow).find(
      (s) => s.step.title === "Cook the rice",
    );
    assert.ok(rice);
    finish(flow, rice);
    assert.equal(
      readyStages(flow).some((s) => s.step.title === "Start the pan"),
      hobs === 2,
    );
    assert.equal(rice.status, "waiting");
    checkStage(flow, rice.id);
    assert.ok(readyStages(flow).some((s) => s.step.title === "Start the pan"));
  }
});
test("attended work blocks multitasking; oven stays reserved between roasting stages", () => {
  const flow = flowFor(["tray-chicken", "tray-chickpea"]);
  finish(
    flow,
    readyStages(flow).find((s) => s.mealId === "dish0"),
  );
  const oven = readyStages(flow).find(
    (s) => s.step.title === "Heat the oven and start vegetables",
  );
  beginStage(flow, oven.id);
  assert.equal(readyStages(flow).length, 0);
  while (oven.cursor < oven.instructions.length - 1)
    advanceStage(flow, oven.id);
  startStageTimer(flow, oven.id, 900);
  const prep = readyStages(flow).find((s) => s.mealId === "dish1");
  assert.ok(prep);
  finish(flow, prep);
  assert.ok(
    !readyStages(flow).some(
      (s) => s.mealId === "dish1" && s.resource === "oven",
    ),
  );
  checkStage(flow, oven.id);
  assert.equal(
    [...heldResources(flow).values()].filter((r) => r === "oven").length,
    1,
  );
  assert.ok(
    readyStages(flow).some(
      (s) => s.mealId === "dish0" && s.step.title === "Add protein",
    ),
  );
});
test("every recipe walkthrough completes without deadlock or equipment overbooking", () => {
  for (const hobs of [1, 2])
    for (let i = 0; i < recipes.length; i += 2) {
      const flow = flowFor(
        recipes.slice(i, i + 2).map((r) => r.id),
        hobs,
      );
      let turns = 0;
      while (flow.stages.some((s) => s.status !== "done")) {
        assert.ok(turns++ < 500, "flow must make progress");
        const ready = readyStages(flow);
        if (ready.length) finish(flow, ready[0]);
        else {
          const waiting = flow.stages.find((s) => s.status === "waiting");
          assert.ok(waiting, "no deadlock");
          checkStage(flow, waiting.id);
        }
        const held = [...heldResources(flow).values()];
        assert.ok(held.filter((x) => x === "hob").length <= hobs);
        assert.ok(held.filter((x) => x === "oven").length <= 1);
      }
    }
});
test("timers never complete a stage or consume ingredients without user confirmation", () => {
  const flow = flowFor(["chicken-curry"]);
  finish(flow, readyStages(flow)[0]);
  const rice = readyStages(flow).find((s) => s.step.title === "Cook the rice");
  finish(flow, rice);
  rice.deadline = 1;
  assert.equal(rice.status, "waiting");
  assert.ok(
    !readyStages(flow).some((s) => s.step.title === "Portion and store"),
  );
  assert.throws(() => advanceStage(flow, rice.id), /Open/);
  checkStage(flow, rice.id);
  assert.equal(rice.status, "done");
});

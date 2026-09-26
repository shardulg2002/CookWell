import test from "node:test";
import assert from "node:assert/strict";
import { createMealExperience } from "../public/meal-experience.js";
import { dayKey } from "../public/metrics.js";

const date = dayKey();
const addDays = (amount) =>
  new Date(Date.parse(date + "T12:00:00Z") + amount * 86400000)
    .toISOString()
    .slice(0, 10);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
function fixture() {
  const nutrition = {
    kcal: 500,
    protein: 30,
    carbs: 50,
    fat: 20,
    fibre: 9,
    salt: 1,
  };
  const state = {
    profile: { calorieTarget: 2000, budget: 4000 },
    nutritionTargets: {
      values: {
        kcal: 2000,
        protein: 100,
        carbs: 220,
        fat: 70,
        fibre: 30,
        salt: 6,
      },
    },
    catalog: [
      {
        id: "recipe",
        title: "Chicken <b>rice</b>",
        cuisine: "Mexican",
        active: 20,
        method: "stew",
        nutrition,
      },
    ],
    plans: [],
    batches: [],
    inventory: [],
    purchases: [],
    ingredients: [],
    logs: [],
    foodLogs: [],
    feedback: [],
  };
  const plan = {
    id: "week",
    start: date,
    status: "active",
    shopping: [],
    shoppingTrips: [{ date, total: 1500, rows: [{ packs: 1 }] }],
    sessions: [
      {
        id: "session",
        date,
        activeMinutes: 40,
        dishes: [{ title: "Chicken rice", portions: 3 }],
      },
    ],
    meals: Array.from({ length: 7 }, (_, i) =>
      ["breakfast", "lunch", "snack", "dinner"].map((slot) => ({
        id: `${i}-${slot}`,
        slot,
        date: addDays(i),
        recipeId: "recipe",
        multiplier: 1,
        status: "planned",
      })),
    ).flat(),
    nutritionReport: {
      days: [],
      budget: { total: 3500, limit: 4000, within: true },
      warnings: [],
    },
  };
  plan.nutritionReport.days = Array.from({ length: 7 }, (_, i) => ({
    date: addDays(i),
    totals: {
      kcal: 2000,
      protein: 120,
      carbs: 200,
      fat: 80,
      fibre: 36,
      salt: 4,
    },
    externalSlots: 0,
    assessment: { met: true, issues: [] },
    meals: plan.meals
      .filter((meal) => meal.date === addDays(i))
      .map((meal) => ({ id: meal.id, nutrition })),
  }));
  state.plans.push(plan);
  return { state, plan };
}
function uiFor(state, selected = () => state.plans[0]) {
  let renders = 0;
  return {
    get renders() {
      return renders;
    },
    ui: createMealExperience({
      getState: () => state,
      chosenPlan: selected,
      esc,
      btn: (label, action, data = "", style = "") =>
        `<button class="btn ${style}" data-action="${action}" ${data}>${label}</button>`,
      cash: (value) => `£${(value / 100).toFixed(2)}`,
      dateLabel: (value) => value,
      render: () => renders++,
      modal: () => {},
      nutritionCards: () => "<div>DETAILED_NUTRITION</div>",
      sessionCards: () => "<div>ALL_SESSIONS</div>",
    }),
  };
}

test("Today leads with shopping before cooking and renders four measured meals without counting them as eaten", () => {
  const { state } = fixture();
  const html = uiFor(state).ui.today();
  assert.ok(html.indexOf("SHOP TODAY") < html.indexOf("Your meals today"));
  assert.equal((html.match(/class="mx-meal /g) || []).length, 4);
  assert.ok(html.includes('data-action="shop-day"'));
  assert.ok(html.includes('data-plan-id="week"'));
  assert.ok(!html.includes("<b>rice</b>"));
  assert.ok(html.includes("Chicken &lt;b&gt;rice&lt;/b&gt;"));
  const recorded = html.match(
    /<section class="mx-recorded"[\s\S]+?<\/section>/,
  )[0];
  assert.ok(recorded.includes("— <small>/ 2,000 kcal"));
  assert.ok(recorded.includes("Nothing logged yet"));
  assert.ok(!recorded.includes("2,000 <small>/ 2,000 kcal"));
});

test("next action changes from a batch session to a prepared portion and respects freezer / expiry state", () => {
  const { state, plan } = fixture();
  plan.shoppingTrips[0].rows[0].packs = 0;
  const { ui } = uiFor(state);
  assert.ok(ui.today().includes("1 dish. 3 portions. One session."));
  assert.ok(ui.today().includes('data-action="cook-session"'));
  plan.sessions = [];
  plan.meals[0].batchId = "batch";
  state.batches.push({
    id: "batch",
    recipeId: "recipe",
    remaining: 1,
    location: "fridge",
    expires: addDays(1),
  });
  assert.ok(ui.today().includes("REHEAT &amp; ENJOY"));
  state.batches[0].location = "freezer";
  assert.ok(ui.today().includes("DEFROST BEFORE REHEATING"));
  state.batches[0].expires = addDays(-1);
  assert.ok(ui.today().includes("CHECK YOUR PREPARED FOOD"));
  assert.ok(!ui.today().includes("REHEAT &amp; ENJOY"));
});

test("fresh shakes are labelled to drink and recipe images appear only on exact matches", () => {
  const { state, plan } = fixture();
  plan.shoppingTrips = [];
  plan.sessions = [];
  state.catalog[0].method = "cold";
  state.catalog[0].freshAssembly = true;
  plan.meals[0].batchId = "shake";
  state.batches.push({
    id: "shake",
    recipeId: "recipe",
    location: "eat now",
    remaining: 1,
    expires: date,
  });
  const { ui } = uiFor(state);
  let html = ui.today();
  assert.ok(html.includes("DRINK FRESHLY MIXED"));
  assert.ok(!html.includes("REHEAT &amp; ENJOY"));
  assert.ok(!html.includes("/images/"));
  state.catalog[0].id = "eggs-toast";
  plan.meals.forEach((meal) => {
    meal.recipeId = "eggs-toast";
  });
  html = ui.today();
  assert.ok(html.includes("/images/eggs-toast.png"));
  assert.ok(html.includes("AI illustration"));
  for (const recipeId of ["dhal", "chicken-bean-rice"]) {
    state.catalog[0].id = recipeId;
    plan.meals.forEach((meal) => {
      meal.recipeId = recipeId;
    });
    assert.ok(ui.today().includes(`/images/${recipeId}.png`));
  }
  plan.meals.forEach((meal) => {
    meal.status = "out";
  });
  assert.ok(!ui.today().includes("/images/"));
});

test("Plan renders seven keyboard-selectable days and preserves four slots and backend workflow actions", () => {
  const { state, plan } = fixture();
  plan.status = "draft";
  const harness = uiFor(state),
    before = JSON.stringify(state);
  let html = harness.ui.plan();
  assert.equal((html.match(/data-action="mx-select-day"/g) || []).length, 7);
  for (const action of [
    "next-week",
    "activate",
    "swap",
    "meal",
    "shop-day",
    "rhythm-settings",
  ])
    assert.ok(html.includes(`data-action="${action}"`), action);
  assert.ok(html.includes('id="plan-select"'));
  assert.ok(html.includes("Shop · Cook"));
  assert.ok(
    html.includes('<details class="mx-disclosure"><summary>Detailed nutrition'),
  );
  assert.equal(
    harness.ui.click("mx-select-day", addDays(2), {
      dataset: { planId: plan.id },
    }),
    true,
  );
  assert.equal(harness.renders, 1);
  html = harness.ui.plan();
  assert.ok(
    html.includes(
      `data-id="${addDays(2)}" data-plan-id="week" aria-pressed="true"`,
    ),
  );
  assert.equal((html.match(/class="mx-meal /g) || []).length, 4);
  assert.ok(html.includes('data-id="2-breakfast"'));
  assert.ok(!html.includes('data-id="0-breakfast"'));
  assert.equal(JSON.stringify(state), before);
  assert.equal(harness.ui.click("swap", "0-breakfast"), false);
  assert.equal(harness.ui.click("mx-select-day", addDays(8)), true);
  assert.equal(
    harness.ui.click("mx-select-day", addDays(1), {
      dataset: { planId: "another-week" },
    }),
    true,
  );
  assert.equal(harness.renders, 1);
  assert.equal(JSON.stringify(state), before);
});

test("snapshot nutrition and unresolved budget and macro gaps remain visible before detailed reports", () => {
  const { state, plan } = fixture();
  plan.nutritionReport.budget = { total: 4500, limit: 4000, within: false };
  plan.nutritionReport.days[0].assessment = {
    met: false,
    issues: [{ key: "protein", gap: 10, status: "low" }],
  };
  plan.nutritionReport.days[0].meals[0].nutrition = {
    kcal: 321,
    protein: 22,
    carbs: 31,
  };
  const html = uiFor(state).ui.plan(),
    details = html.indexOf("Detailed nutrition & budget report");
  assert.ok(html.indexOf("£5.00 above your grocery budget") < details);
  assert.ok(html.indexOf("1 day outside targets or incomplete") < details);
  assert.ok(html.includes("321 kcal"));
  assert.ok(html.includes("Protein 10 g below range"));
  assert.ok(html.includes('data-action="rebalance-plan"'));
});

test("Today resolves the current week even after viewing another week, while partial diary stays partial", () => {
  const { state, plan } = fixture();
  const future = structuredClone(plan);
  future.id = "future";
  future.start = addDays(7);
  state.plans.push(future);
  state.foodLogs.push({
    id: "food",
    date,
    name: "Cafe meal",
    nutrition: {
      kcal: 400,
      protein: null,
      carbs: null,
      fat: null,
      fibre: null,
      salt: null,
    },
  });
  const html = uiFor(state, () => future).ui.today();
  assert.ok(html.includes('data-plan-id="week"'));
  assert.ok(!html.includes('data-plan-id="future"'));
  assert.match(html, /data-screen="plan" data-plan-id="week">Full week/);
  assert.match(
    html,
    /data-action="meal" data-id="0-breakfast" data-plan-id="week"/,
  );
  const recorded = html.match(
    /<section class="mx-recorded"[\s\S]+?<\/section>/,
  )[0];
  assert.ok(recorded.includes("400 <small>/ 2,000 kcal"));
  assert.ok(recorded.includes("these recorded totals are partial"));
  assert.ok(recorded.includes("— <small>/ 100 g"));
});

test("Today never renders a stale week's meals as today's and keeps all four empty slots", () => {
  const { state, plan } = fixture();
  plan.start = addDays(-14);
  plan.meals.forEach((meal) => {
    meal.date = addDays(-14);
  });
  const before = JSON.stringify(state);
  const html = uiFor(state).ui.today();
  assert.equal((html.match(/Not planned yet/g) || []).length, 4);
  assert.ok(html.includes("No plan for today yet."));
  assert.ok(!html.includes("Your first week starts here."));
  assert.match(
    html,
    /data-action="current-week-draft"[^>]*>Create a draft from today/,
  );
  assert.match(html, /data-screen="plan">Full week/);
  assert.ok(!html.includes("Chicken &lt;b&gt;rice&lt;/b&gt;"));
  assert.ok(!html.includes('data-action="shop-day"'));
  assert.equal(JSON.stringify(state), before);
});

test("recorded portions use actual nutrition, missing nutrients are not zero, and planned food is excluded from diary totals", () => {
  const { state, plan } = fixture();
  const meal = plan.meals[0];
  meal.status = "eaten";
  meal.eatenAt = `${date}T12:00:00Z`;
  meal.actualNutrition = {
    kcal: 321,
    protein: 22,
    carbs: 31,
    fat: 7,
    fibre: 5,
    salt: 0.3,
  };
  plan.nutritionReport.days[0].meals[0].nutrition = meal.actualNutrition;
  const { ui } = uiFor(state);
  let html = ui.today();
  let recorded = html.match(
    /<section class="mx-recorded"[\s\S]+?<\/section>/,
  )[0];
  assert.ok(recorded.includes("321 <small>/ 2,000 kcal"));
  assert.ok(recorded.includes("22 <small>/ 100 g"));
  assert.ok(html.includes("Recorded portion"));
  meal.actualNutrition.kcal = null;
  html = ui.today();
  recorded = html.match(/<section class="mx-recorded"[\s\S]+?<\/section>/)[0];
  assert.ok(html.includes('class="mx-meal-nutrition">— kcal'));
  assert.ok(recorded.includes("— <small>/ 2,000 kcal"));
  assert.ok(recorded.includes("these recorded totals are partial"));
});

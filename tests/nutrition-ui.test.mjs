import test from "node:test";
import assert from "node:assert/strict";
import { macroProgress, createNutritionUI } from "../public/nutrition-ui.js";
import { weeklySchedule } from "../public/rhythm-ui.js";
import { dailyCard } from "../public/wellbeing.js";
import {
  nutritionTargets,
  assessNutrition,
} from "../public/nutrition-targets.js";

const profile = {
  calorieTarget: 2000,
  weight: 80,
  goal: "lose",
  nutritionSettings: {
    mode: "balanced",
    proteinSafety: "none",
    shakes: "optional",
  },
};
const targets = nutritionTargets(profile);
const state = { profile, nutritionTargets: targets };
test("weekly overview links dated trips and distinguishes fresh assembly from cooking", () => {
  const html = weeklySchedule(
    { catalog: [{ id: "shake", freshAssembly: true }] },
    {
      shoppingTrips: [{ date: "2026-09-12", total: 3500 }],
      sessions: [
        { date: "2026-09-12", dishes: [{ portions: 6 }, { portions: 3 }] },
      ],
      meals: [{ date: "2026-09-13", status: "planned", recipeId: "shake" }],
    },
    {
      esc: String,
      cash: (n) => "£" + (n / 100).toFixed(2),
      btn: (label, action, attrs) =>
        `<button data-action="${action}" ${attrs}>${label}</button>`,
    },
  );
  assert.match(html, /data-action="shop-day" data-date="2026-09-12"/);
  assert.match(html, /Cook 2 dishes · 9 servings/);
  assert.match(html, /£35.00 remaining forecast/);
  assert.match(html, /1 quick fresh assemblies/);
  assert.match(html, /2026-09-13/);
});
test("full diary has only one macro summary and no fabricated zero totals", () => {
  const html = dailyCard(
    { ...state, plans: [], foodLogs: [], catalog: [] },
    "2026-09-12",
  );
  assert.equal(
    (html.match(/Recorded nutrients \/ daily targets/g) || []).length,
    1,
  );
  assert.ok(!html.includes('<div class="nutrition">'));
  assert.ok(!html.includes("<strong>0 g</strong>"));
});
const totals = {
  kcal: 2000,
  protein: 96,
  carbs: 250,
  fat: 68.4,
  fibre: 30,
  salt: 4,
};
const uiFor = (value, mutate = async () => {}) =>
  createNutritionUI({
    getState: () => value,
    chosenPlan: () => value.plans?.[0],
    modal() {},
    mutate,
    btn: (label, action) => `<button data-action="${action}">${label}</button>`,
    field: () => "",
    select: () => "",
    cash: (pence) => `£${(pence / 100).toFixed(2)}`,
  });

test("empty and calories-only diaries never present missing macros as zero eaten", () => {
  let html = macroProgress(state, "2026-09-12", { entries: [], total: {} });
  assert.equal((html.match(/Nothing recorded/g) || []).length, 5);
  assert.ok(html.includes("Your meal plan is not counted as food eaten"));
  html = macroProgress(state, "2026-09-12", {
    entries: [{ nutrition: { kcal: 450 } }],
    total: { kcal: 450, protein: 0, carbs: 0, fat: 0, fibre: 0, salt: 0 },
  });
  assert.equal((html.match(/Nutrient amounts not provided/g) || []).length, 5);
  assert.ok(!html.includes("<strong>0 <small>"));
  assert.ok(html.includes("Partial totals cannot confirm"));
});

test("partial entries keep known protein while salt excess remains visible", () => {
  const html = macroProgress(state, "2026-09-12", {
    entries: [
      { nutrition: { ...totals, salt: 7 } },
      { nutrition: { kcal: 100 } },
    ],
    total: { ...totals, kcal: 2100, salt: 7 },
  });
  assert.ok(html.includes("96 <small>/ 96 g"));
  assert.ok(html.includes("cw-nutrient-over"));
  assert.ok(html.includes("Partial · some entries lack this nutrient"));
  assert.ok(!html.includes("Within targets"));
});

test("week coverage counts each complete day, surfaces budget misses and external gaps", () => {
  const value = {
    ...state,
    plans: [
      {
        id: "week",
        nutritionReport: {
          days: [
            {
              date: "2026-09-12",
              totals,
              assessment: assessNutrition(totals, targets),
              externalSlots: 0,
            },
            {
              date: "2026-09-13",
              totals,
              assessment: assessNutrition(totals, targets),
              externalSlots: 1,
            },
            {
              date: "2026-09-14",
              totals: { ...totals, protein: 50 },
              assessment: assessNutrition({ ...totals, protein: 50 }, targets),
              externalSlots: 0,
            },
          ],
          budget: { total: 4200, limit: 4000, within: false },
          warnings: ["Recipe choices need review <script>alert(1)</script>"],
        },
      },
    ],
  };
  const html = uiFor(value).cards("plan");
  assert.ok(html.includes("1 of 3 days within targets"));
  assert.ok(html.includes("£42.00 / £40.00"));
  assert.ok(html.includes("over budget"));
  assert.ok(html.includes("Incomplete menu"));
  assert.ok(html.includes("Below range"));
  assert.ok(html.includes("rebalance-plan"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
});

test("settings validates before mutation and submits selected preferences", async () => {
  const calls = [];
  const ui = uiFor(state, async (...args) => calls.push(args));
  assert.equal(await ui.submit({ id: "other-form" }, {}), false);
  await assert.rejects(
    ui.submit(
      { id: "nutrition-settings-form" },
      { mode: "custom", protein: 90 },
    ),
    /Enter protein/,
  );
  assert.equal(calls.length, 0);
  assert.equal(
    await ui.submit(
      { id: "nutrition-settings-form" },
      { mode: "moderate", proteinSafety: "none", shakes: "never" },
    ),
    true,
  );
  assert.equal(calls[0][0], "nutritionSettings");
  assert.equal(calls[0][1].mode, "moderate");
  assert.equal(calls[0][1].shakes, "never");
});

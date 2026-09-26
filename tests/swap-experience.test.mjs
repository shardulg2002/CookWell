import test from "node:test";
import assert from "node:assert/strict";
import { renderSwapPreview } from "../public/swap-experience.js";
import {
  nutritionTargets,
  assessNutrition,
} from "../public/nutrition-targets.js";

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const ctx = {
  esc,
  btn: (label, action, attributes, style) =>
    `<button class="${style || ""}" data-action="${action}" ${attributes}>${label}</button>`,
  cash: (value) => `£${(value / 100).toFixed(2)}`,
  dateLabel: (value) => value,
};
function fixture() {
  const targets = nutritionTargets({
    weight: 80,
    calorieTarget: 2000,
    goal: "lose",
    nutritionSettings: {
      mode: "moderate",
      proteinSafety: "none",
      shakes: "optional",
    },
  });
  const oldTotals = { ...targets.values, protein: 70 },
    newTotals = { ...targets.values, protein: 86 };
  const day = (totals) => ({
    date: "2026-09-14",
    totals,
    externalSlots: 0,
    assessment: assessNutrition(totals, targets),
  });
  const meal = {
    id: "meal-1",
    title: "Lentil soup",
    recipeId: "lentil-soup",
    date: "2026-09-14",
    slot: "lunch",
    multiplier: 1,
    prepared: false,
    allocatedPortions: 0,
    batch: {
      portions: 3,
      cookDate: "2026-09-14",
      fridge: 2,
      freeze: 1,
      freshAssembly: false,
    },
    nutrition: {
      kcal: 450,
      protein: 20,
      carbs: 45,
      fat: 15,
      fibre: 10,
      salt: 1,
    },
    ingredients: [
      { id: "lentil", name: "Dry lentils", quantity: 80, unit: "g" },
    ],
  };
  return {
    revision: 3,
    planId: "week",
    mealId: "meal-1",
    recipeId: "chicken-curry",
    date: "2026-09-14",
    slot: "lunch",
    targets,
    before: {
      meal,
      day: day(oldTotals),
      budget: {
        total: 3600,
        spent: 1100,
        shopping: 2500,
        limit: 4000,
        within: true,
      },
    },
    after: {
      meal: {
        ...meal,
        recipeId: "chicken-curry",
        title: "Chicken curry",
        nutrition: { ...meal.nutrition, protein: 36 },
        batch: { ...meal.batch, portions: 1, fridge: 1, freeze: 0 },
      },
      day: day(newTotals),
      budget: {
        total: 3850,
        spent: 1100,
        shopping: 2750,
        limit: 4000,
        within: true,
      },
    },
    deltas: { cost: 250, shoppingCost: 250, batchPortions: -2 },
    changedMeals: [],
    affectedDays: [],
    releasedPortions: [],
    warnings: [],
  };
}

test("swap review shows measured serving, daily gaps, full-pack cost and explicit confirmation", () => {
  const preview = fixture(),
    html = renderSwapPreview(preview, ctx);
  assert.match(html, /Replaces Lentil soup/);
  assert.match(html, /Nothing changes until you confirm/);
  assert.match(html, /<strong>36<\/strong><small>Protein · g/);
  assert.match(html, /£36\.00 → £38\.50/);
  assert.match(html, /£2\.50 more · £40\.00 budget/);
  assert.match(html, /£11\.00 already purchased and £27\.50 still needed/);
  assert.match(html, /10 g below the minimum/);
  assert.match(html, /Before 70 g.*After 86 g/s);
  assert.match(html, /3 servings/);
  assert.match(html, /1 serving/);
  assert.match(html, /80 g/);
  assert.match(
    html,
    /data-action="confirm-swap" type="button" data-id="meal-1" data-recipe="chicken-curry"/,
  );
  assert.match(html, /data-action="swap" type="button" data-id="meal-1"/);
  assert.ok(!html.includes("<details open"));
  assert.ok(!html.includes("Planned day within ranges"));
});

test("unknown nutrition stays unknown and cost reductions keep the correct direction", () => {
  const preview = fixture();
  preview.after.meal.nutrition.protein = null;
  preview.after.day.externalSlots = 1;
  preview.after.day.assessment = assessNutrition(
    preview.targets.values,
    preview.targets,
    { incomplete: true },
  );
  preview.after.budget.total = 3500;
  preview.after.budget.shopping = 2400;
  preview.deltas.cost = -100;
  let html = renderSwapPreview(preview, ctx);
  assert.match(html, /<strong>Unknown<\/strong><small>Protein · g/);
  assert.match(html, /Day has unrecorded nutrition/);
  assert.match(html, /£1\.00 less/);
  assert.ok(!html.includes("Planned day within ranges"));
  preview.after.day.externalSlots = 0;
  preview.after.day.assessment = assessNutrition(
    preview.targets.values,
    preview.targets,
  );
  html = renderSwapPreview(preview, ctx);
  assert.match(html, /Planned day within ranges/);
  assert.match(html, /Nutrition is estimated/);
  preview.targets.ready = false;
  assert.match(renderSwapPreview(preview, ctx), /Review your targets/);
});

test("prepared food is retained and fresh assembly is distinct from another cooking day", () => {
  const preview = fixture();
  preview.before.meal.prepared = true;
  preview.before.meal.allocatedPortions = 0.5;
  preview.before.meal.servingGrams = 180;
  preview.before.meal.batch = null;
  preview.after.meal.batch.freshAssembly = true;
  preview.releasedPortions = [
    {
      batchId: "saved",
      title: "Lentil soup",
      portions: 0.5,
      location: "fridge",
      expires: "2026-09-15",
    },
  ];
  preview.affectedDays = [
    {
      date: "2026-09-15",
      before: preview.before.day,
      after: preview.after.day,
    },
  ];
  const html = renderSwapPreview(preview, ctx);
  assert.match(html, /Already prepared · 0\.5 allocated portions · 180 g/);
  assert.match(html, /Assemble fresh on 2026-09-14 · 1 serving/);
  assert.match(html, /Prepared food stays in your kitchen/);
  assert.match(html, /does not throw them away or refund their cost/);
  assert.match(html, /use by 2026-09-15/);
  assert.match(html, /Other affected days \(1\)/);
});

test("recipe text, IDs, warnings and ingredients are escaped in the confirmation markup", () => {
  const preview = fixture();
  const attack = '<img src=x onerror="alert(1)">';
  preview.mealId = 'meal" onclick="alert(1)';
  preview.recipeId = 'recipe" autofocus="true';
  preview.after.meal.title = attack;
  preview.after.meal.ingredients[0].name = attack;
  preview.warnings = [attack];
  const html = renderSwapPreview(preview, ctx);
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes(' onclick="'));
  assert.ok(!html.includes(' autofocus="'));
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /data-id="meal&quot; onclick=&quot;alert\(1\)"/);
  assert.match(html, /data-recipe="recipe&quot; autofocus=&quot;true"/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { weightReference, dayKey, dailyIntake } from "../public/metrics.js";
import { freshState, applyAction, viewState, today } from "../lib/domain.mjs";
import { instructionList } from "../public/cooking.js";
test("BMI reference and initial milestone derive from actual height and weight", () => {
  const r = weightReference(175, 89.5);
  assert.equal(r.bmi, 29.2);
  assert.equal(r.min, 56.7);
  assert.equal(r.max, 76.3);
  assert.equal(r.suggested, 85);
  assert.equal(weightReference(175, 65).suggested, 65);
});
test("UK diary date is consistent through summertime and midnight", () => {
  assert.equal(dayKey("2026-07-01T23:30:00Z"), "2026-07-02");
  assert.equal(dayKey("2026-12-01T23:30:00Z"), "2026-12-01");
});
test("food diary scales pack nutrition and keeps unknown nutrients unknown", () => {
  const s = freshState();
  s.profile = { calorieTarget: 2000 };
  applyAction(s, "food", {
    name: "Test yoghurt",
    date: today(),
    basis: "100g",
    quantity: 150,
    kcal: 100,
    protein: 4,
  });
  let v = { ...s, catalog: [] };
  let d = dailyIntake(v, today());
  assert.equal(d.total.kcal, 150);
  assert.equal(d.total.protein, 6);
  assert.equal(d.total.carbs, 0);
  assert.equal(d.incomplete, true);
  assert.equal(d.remaining, 1850);
  applyAction(s, "deleteFood", { id: s.foodLogs[0].id });
  assert.equal(s.foodLogs.length, 0);
});
test("planned meals never inflate eaten calories", () => {
  const s = {
    profile: { calorieTarget: 1800 },
    catalog: [{ id: "r", title: "Meal", nutrition: { kcal: 600 } }],
    plans: [
      {
        meals: [
          {
            id: "m",
            recipeId: "r",
            multiplier: 1,
            date: today(),
            status: "planned",
          },
        ],
      },
    ],
  };
  let d = dailyIntake(s, today());
  assert.equal(d.plannedKcal, 600);
  assert.equal(d.total.kcal, 0);
  s.plans[0].meals[0] = {
    ...s.plans[0].meals[0],
    status: "eaten",
    eatenAt: new Date().toISOString(),
    actualNutrition: {
      kcal: 550,
      protein: 20,
      carbs: 50,
      fat: 15,
      fibre: 8,
      salt: 1,
    },
  };
  d = dailyIntake(s, today());
  assert.equal(d.total.kcal, 550);
});
test("simple cooking instructions highlight exact amounts and escape content", () => {
  const html = instructionList(
    "Add 12.5 g oil. Stir for 2 minutes. <script>unsafe</script>",
  );
  assert.ok(html.includes("<strong>12.5 g</strong>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
});

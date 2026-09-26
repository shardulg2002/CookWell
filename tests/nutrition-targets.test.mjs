import test from "node:test";
import assert from "node:assert/strict";
import {
  nutritionTargets,
  validateNutritionSettings,
  assessNutrition,
  mealShares,
} from "../public/nutrition-targets.js";

const profile = { weight: 89.5, calorieTarget: 2000, goal: "lose" };

test("nutrition targets derive from profile and explicit preferences without assuming health answers", () => {
  const baseline = nutritionTargets(profile);
  assert.equal(baseline.settings.mode, "balanced");
  assert.equal(baseline.settings.proteinSafety, "unknown");
  assert.equal(baseline.values.protein, 67.1);
  assert.equal(baseline.values.carbs, 250);
  assert.ok(
    baseline.warnings.some((message) => message.includes("not been answered")),
  );
  const result = nutritionTargets({
    ...profile,
    nutritionSettings: {
      mode: "moderate",
      proteinSafety: "none",
      shakes: "optional",
    },
  });
  assert.equal(result.ready, true);
  assert.equal(result.values.protein, 107.4);
  assert.equal(result.values.carbs, 200);
  assert.equal(result.values.fat, 85.6);
  assert.equal(result.values.fibre, 30);
  assert.equal(result.values.salt, 6);
  assert.ok(Math.abs(result.energyFromMacros - 2000) < 1);
  assert.equal(
    Object.values(mealShares).reduce((sum, value) => sum + value, 0),
    1,
  );
  assert.equal(
    nutritionTargets({
      ...profile,
      weight: 100,
      nutritionSettings: result.settings,
    }).values.protein,
    120,
  );
});

test("custom targets reject absent, impossible and non-finite inputs and retain valid choices", () => {
  assert.throws(
    () => validateNutritionSettings(profile, { mode: "custom" }),
    (error) => error.status === 400 && /Enter protein/.test(error.message),
  );
  assert.throws(
    () =>
      validateNutritionSettings(profile, {
        mode: "custom",
        protein: "NaN",
        carbs: 200,
        fat: 80,
      }),
    /Protein target/,
  );
  assert.throws(
    () =>
      validateNutritionSettings(profile, {
        mode: "custom",
        protein: 20,
        carbs: 20,
        fat: 10,
      }),
    /does not match/,
  );
  assert.throws(
    () => validateNutritionSettings(profile, { mode: "keto" }),
    /valid mode/,
  );
  assert.throws(
    () => validateNutritionSettings(profile, { salt: 7 }),
    /Salt target/,
  );
  const saved = validateNutritionSettings(profile, {
    mode: "custom",
    proteinSafety: "none",
    custom: { protein: 110, carbs: 210, fat: 80, fibre: 32, salt: 5 },
  });
  assert.equal(saved.protein, 110);
  const updated = validateNutritionSettings(
    { ...profile, nutritionSettings: saved },
    { shakes: "never" },
  );
  assert.equal(updated.protein, 110);
  assert.equal(updated.shakes, "never");
  assert.equal(
    nutritionTargets({ ...profile, nutritionSettings: updated }).values.fibre,
    32,
  );
});

test("known protein restriction requires entered clinician target and does not invent one", () => {
  const blocked = nutritionTargets({
    ...profile,
    nutritionSettings: { proteinSafety: "restricted" },
  });
  assert.equal(blocked.ready, false);
  assert.equal(blocked.values.protein, null);
  assert.throws(
    () => validateNutritionSettings(profile, { proteinSafety: "restricted" }),
    /clinician/,
  );
  const settings = validateNutritionSettings(profile, {
    mode: "custom",
    proteinSafety: "restricted",
    protein: 60,
    carbs: 260,
    fat: 80,
  });
  const targets = nutritionTargets({ ...profile, nutritionSettings: settings });
  assert.equal(targets.ready, true);
  assert.equal(targets.ranges.protein.max, 60);
  assert.equal(
    assessNutrition({ ...targets.values, protein: 60.1 }, targets).checks
      .protein.status,
    "high",
  );
  assert.equal(
    assessNutrition({ ...targets.values, protein: 100 }, targets).checks.protein
      .status,
    "high",
  );
});

test("daily assessment requires every target, flags salt ceiling and never treats unknown food as success", () => {
  const targets = nutritionTargets({
    ...profile,
    nutritionSettings: { proteinSafety: "none", mode: "moderate" },
  });
  assert.equal(assessNutrition(targets.values, targets).met, true);
  const missed = assessNutrition(
    { ...targets.values, protein: 80, fibre: 20, salt: 7 },
    targets,
  );
  assert.equal(missed.met, false);
  assert.equal(missed.checks.protein.status, "low");
  assert.equal(missed.checks.salt.status, "high");
  assert.ok(missed.penalty > 0);
  assert.equal(
    assessNutrition({ ...targets.values, protein: 200 }, targets).checks.protein
      .status,
    "met",
  );
  assert.equal(
    assessNutrition({ ...targets.values, carbs: null }, targets).met,
    false,
  );
  assert.equal(
    assessNutrition(targets.values, targets, { incomplete: true }).met,
    false,
  );
  assert.equal(
    assessNutrition(targets.values, targets, { incomplete: true }).checks.salt
      .status,
    "unknown",
  );
  assert.equal(
    assessNutrition({ ...targets.values, salt: 7 }, targets, {
      incomplete: true,
    }).checks.salt.status,
    "high",
  );
  assert.equal(assessNutrition({}, nutritionTargets({})).ready, false);
});

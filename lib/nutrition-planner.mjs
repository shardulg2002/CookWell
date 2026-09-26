import {
  recipeMap,
  recipes,
  recipeNutrition,
  recipeNutritionBasis,
} from "./catalog.mjs";
import {
  nutritionTargets,
  assessNutrition,
  mealShares,
} from "../public/nutrition-targets.js";
import { allocations } from "../public/portions.js";
import { arrangeBatches, cadence, batchFriendly } from "./rhythm.mjs";
import { latestRecipeRating } from "../public/preferences.js";
import { nutritionSeeds } from "./nutrition-seeds.mjs";

const keys = ["kcal", "protein", "carbs", "fat", "fibre", "salt"];
const addDays = (d, n) =>
  new Date(Date.parse(d + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
const empty = () => Object.fromEntries(keys.map((k) => [k, 0]));
export function mealNutrients(state, meal) {
  if (["out", "skipped"].includes(meal.status)) return null;
  if (meal.status === "eaten") return meal.actualNutrition || null;
  if (meal.batchId) {
    const n = empty();
    for (const a of allocations(meal)) {
      const b = state.batches.find((b) => b.id === a.batchId);
      if (!b) return null;
      for (const k of keys) n[k] += b.nutrition[k] * a.portions;
    }
    return n;
  }
  return recipeNutrition(
    recipeMap[meal.recipeId],
    meal.multiplier,
    state.nutrition,
  );
}
export function planNutrition(state, plan, cost) {
  const targets = nutritionTargets(state.profile);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(plan.start, i),
      meals = plan.meals.filter((m) => m.date === date),
      totals = empty();
    let externalSlots = 0;
    for (const m of meals) {
      const n = mealNutrients(state, m);
      if (!n) {
        externalSlots++;
        continue;
      }
      for (const k of keys) totals[k] += n[k];
    }
    for (const k of keys) totals[k] = Math.round(totals[k] * 10) / 10;
    return {
      date,
      totals,
      externalSlots,
      assessment: assessNutrition(totals, targets, {
        incomplete: externalSlots > 0,
      }),
      meals: meals.map((m) => ({
        id: m.id,
        slot: m.slot,
        nutrition: mealNutrients(state, m),
        carbs: mealNutrients(state, m)?.carbs ?? null,
        carbGuide: Math.round(targets.values.carbs * mealShares[m.slot]),
      })),
    };
  });
  const budget = {
    total: cost,
    limit: state.profile.budget,
    within: cost <= state.profile.budget,
  };
  const warnings = [];
  if (!budget.within)
    warnings.push(
      `Full grocery packs exceed the budget by £${((cost - state.profile.budget) / 100).toFixed(2)}.`,
    );
  if (days.some((d) => d.externalSlots))
    warnings.push(
      "Eating-out, skipped or unrecorded meals leave some daily nutrition unknown. Log what you actually eat in the diary.",
    );
  const gaps = days.filter((d) => !d.assessment.met);
  if (gaps.length)
    warnings.push(
      `${gaps.length} of 7 days need a nutrition review. Check the daily figures; this plan does not meet every target.`,
    );
  return {
    days,
    budget,
    met: targets.ready && budget.within && gaps.length === 0,
    warnings,
  };
}

// A bounded search across whole cooking blocks. Full checkout packs and saved label nutrition
// are evaluated together; completed food and its historical nutrient snapshot never change.
export function optimiseNutrition(
  state,
  plan,
  { allowed, cost, from = plan.start } = {},
) {
  const target = nutritionTargets(state.profile);
  if (!target.ready) return;
  const p = state.profile,
    base = Object.fromEntries(
      recipes.map((r) => [r.id, recipeNutritionBasis(r, state.nutrition)]),
    );
  const groups = new Map();
  for (const m of plan.meals.filter(
    (m) => m.status === "planned" && !m.batchId && m.date >= from,
  )) {
    const block = Math.floor(
      (Date.parse(m.date) - Date.parse(plan.start)) / 86400000 / cadence(p),
    );
    const key = block + ":" + m.slot;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  const candidates = new Map();
  for (const group of groups.values()) {
    const slot = group[0].slot;
    if (!candidates.has(slot))
      candidates.set(
        slot,
        recipes.filter(
          (r) => r.slots.includes(slot) && allowed(r) && batchFriendly(r, p),
        ),
      );
  }
  const mutableIds = new Set([...groups.values()].flat().map((m) => m.id));
  const fixed = new Map(
    plan.meals
      .filter((m) => !mutableIds.has(m.id))
      .map((m) => [m.id, mealNutrients(state, m)]),
  );
  const evaluate = () => {
    arrangeBatches(plan, p, from);
    let loss = 0;
    for (let i = 0; i < 7; i++) {
      const date = addDays(plan.start, i);
      if (date < from) continue;
      const ms = plan.meals.filter((m) => m.date === date),
        n = empty();
      let share = 0;
      for (const m of ms) {
        if (["out", "skipped"].includes(m.status)) continue;
        const nutrients = mutableIds.has(m.id) ? null : fixed.get(m.id);
        share += mealShares[m.slot];
        for (const k of keys)
          n[k] += mutableIds.has(m.id)
            ? Math.round(base[m.recipeId][k] * m.multiplier * 10) / 10
            : nutrients?.[k] || 0;
        const carb = mutableIds.has(m.id)
          ? Math.round(base[m.recipeId].carbs * m.multiplier * 10) / 10
          : nutrients?.carbs || 0;
        const guide = target.values.carbs * mealShares[m.slot];
        loss +=
          12 * Math.max(0, (carb - guide * 1.2) / Math.max(1, guide)) ** 2;
      }
      if (!share) continue;
      for (const k of keys) {
        const t = target.values[k] * share,
          range = target.ranges[k];
        const lo = range.min == null ? 0 : range.min * share,
          hi = range.max == null ? Infinity : range.max * share;
        const below = Math.max(0, lo - n[k]) / Math.max(1, t),
          above = Math.max(0, n[k] - hi) / Math.max(1, t);
        loss +=
          {
            kcal: 180,
            protein: 140,
            carbs: 150,
            fat: 80,
            fibre: 100,
            salt: 160,
          }[k] *
          (below + above + below ** 2 + above ** 2);
        if (["kcal", "carbs", "fat"].includes(k))
          loss += 0.18 * ((n[k] - t) / Math.max(1, t)) ** 2;
      }
    }
    const bill = cost(plan),
      excess = Math.max(0, bill - p.budget) / p.budget;
    loss += 300 * excess ** 2 + 250 * excess + (0.08 * bill) / p.budget;
    const mains = new Set(),
      repeats = {};
    for (const group of groups.values()) {
      const r = recipeMap[group[0].recipeId];
      repeats[r.id] = (repeats[r.id] || 0) + 1;
      if (["lunch", "dinner"].includes(group[0].slot)) mains.add(r.cuisine);
      if (latestRecipeRating(state, r.id) === "love") loss -= 0.006;
      if (r.supplement && p.nutritionSettings?.shakes !== "daily") loss += 0.02;
    }
    loss += Math.max(0, Math.min(3, p.explore + 1) - mains.size) * 0.035;
    loss += Object.values(repeats).reduce(
      (n, count) => n + Math.max(0, count - 1) * 0.008,
      0,
    );
    return loss;
  };
  // The generator supplies a cost-aware seed. First restore any new hard exclusions.
  for (const group of groups.values()) {
    const choices = candidates.get(group[0].slot);
    const required =
      p.nutritionSettings?.shakes === "daily" && group[0].slot === "snack";
    const options = required ? choices.filter((r) => r.supplement) : choices;
    if (!options.length)
      throw Object.assign(
        new Error(
          `No compatible ${group[0].slot} recipes for these targets and preferences. Review exclusions or shake equipment.`,
        ),
        { status: 400 },
      );
    if (group.some((m) => !allowed(recipeMap[m.recipeId])) || required) {
      for (const m of group) {
        m.recipeId = options[0].id;
        m.multiplier = 1;
      }
    }
  }
  let current = evaluate();
  const editable = plan.meals.filter((m) => mutableIds.has(m.id));
  const capture = () => editable.map((m) => ({ ...m }));
  const restore = (saved) =>
    editable.forEach((m, i) => {
      for (const key of Object.keys(m)) delete m[key];
      Object.assign(m, saved[i]);
    });
  const seeds = nutritionSeeds(state, { allowed });
  const initial = capture();
  let bestSeed = initial;
  for (const menu of seeds) {
    restore(initial);
    for (const m of editable) Object.assign(m, menu[m.slot]);
    const score = evaluate();
    if (score < current) {
      current = score;
      bestSeed = capture();
    }
  }
  restore(bestSeed);
  // Whole-day proposals move protein, carbohydrate and fat together, avoiding
  // traps where changing a single meal would require another full grocery pack.
  const blocks = [...new Set([...groups.keys()].map((k) => k.split(":")[0]))];
  for (const block of blocks) {
    const original = capture();
    let best = original;
    for (const menu of seeds) {
      restore(original);
      for (const [key, group] of groups)
        if (key.startsWith(block + ":"))
          for (const m of group) Object.assign(m, menu[m.slot]);
      const score = evaluate();
      if (score < current) {
        current = score;
        best = capture();
      }
    }
    restore(best);
  }
  for (let pass = 0; pass < 12; pass++) {
    let improvements = 0;
    for (const group of groups.values()) {
      const slot = group[0].slot,
        original = capture(),
        root = { ...group[0] };
      let best = null,
        score = current;
      for (const r of candidates.get(slot)) {
        if (
          slot === "snack" &&
          p.nutritionSettings?.shakes === "daily" &&
          !r.supplement
        )
          continue;
        const ideal = (p.calorieTarget * mealShares[slot]) / base[r.id].kcal;
        const mults = new Set(
          [0.8, 0.9, 0.95, 1, 1.05, 1.1, 1.25].map(
            (f) =>
              Math.round(
                Math.max(0.5, Math.min(r.supplement ? 1.25 : 2, ideal * f)) *
                  100,
              ) / 100,
          ),
        );
        if (r.id === root.recipeId)
          for (const delta of [-0.04, -0.02, -0.01, 0, 0.01, 0.02, 0.04])
            mults.add(
              Math.round(
                Math.max(
                  0.5,
                  Math.min(r.supplement ? 1.25 : 2, root.multiplier + delta),
                ) * 100,
              ) / 100,
            );
        for (const mult of mults) {
          restore(original);
          for (const m of group) {
            m.recipeId = r.id;
            m.multiplier = mult;
          }
          const candidate = evaluate();
          if (candidate < score - 0.000001) {
            score = candidate;
            best = capture();
          }
        }
      }
      restore(best || original);
      if (best) {
        current = score;
        improvements++;
      }
    }
    if (!improvements) break;
  }
  arrangeBatches(plan, p, from);
  plan.nutritionVersion = 1;
}

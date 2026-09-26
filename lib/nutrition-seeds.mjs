import { ingredients, recipes, recipeNutritionBasis } from "./catalog.mjs";
import {
  nutritionTargets,
  macroKeys,
  mealShares,
} from "../public/nutrition-targets.js";
import { dayKey } from "../public/metrics.js";
import { batchFriendly } from "./rhythm.mjs";

const slots = ["breakfast", "lunch", "snack", "dinner"];
const clampMultiplier = (value, supplement) =>
  Math.round(Math.max(0.5, Math.min(supplement ? 1.25 : 2, value)) * 100) / 100;

// Seeds are proposals, never a budget or nutrition verdict. The main planner must
// arrange actual cooking blocks and assess dated stock, purchases and all seven days.
export function nutritionSeeds(state, { allowed } = {}) {
  const profile = state.profile,
    target = nutritionTargets(profile);
  if (!target.ready || !allowed) return [];
  const wantsDaily = profile.nutritionSettings?.shakes === "daily";
  const foodIndex = Object.fromEntries(
    ingredients.map((ingredient, index) => [ingredient.id, index]),
  );
  const stock = ingredients.map((ingredient) =>
    (state.inventory || [])
      .filter(
        (lot) =>
          lot.ingredientId === ingredient.id &&
          (!lot.expires || lot.expires >= dayKey()),
      )
      .reduce((sum, lot) => sum + Math.max(0, lot.quantity), 0),
  );
  const prices = ingredients.map(
    (ingredient) => state.prices?.[ingredient.id] || ingredient,
  );
  const options = slots.map((slot) =>
    recipes
      .filter(
        (recipe) =>
          recipe.slots.includes(slot) &&
          allowed(recipe) &&
          batchFriendly(recipe, profile) &&
          (!wantsDaily || slot !== "snack" || recipe.supplement),
      )
      .map((recipe) => ({
        id: recipe.id,
        supplement: !!recipe.supplement,
        nutrition: macroKeys.map(
          (key) => recipeNutritionBasis(recipe, state.nutrition)[key],
        ),
        ideal:
          (profile.calorieTarget * mealShares[slot]) /
          recipeNutritionBasis(recipe, state.nutrition).kcal,
        items: recipe.items.map((item) => [foodIndex[item.id], item.qty]),
      })),
  );
  if (options.some((group) => !group.length)) return [];
  const minimum = macroKeys.map((key) => target.ranges[key].min ?? 0);
  const maximum = macroKeys.map((key) => target.ranges[key].max ?? Infinity);
  const scale = macroKeys.map((key) => Math.max(1, target.values[key]));
  const weights = [180, 140, 150, 80, 100, 160];
  const bestByTuple = new Map();
  let seed = 142251;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const compare = (a, b) =>
    a.violations - b.violations ||
    a.penalty - b.penalty ||
    a.cost - b.cost ||
    a.carbPenalty - b.carbPenalty ||
    a.tuple.localeCompare(b.tuple);
  for (let iteration = 0; iteration < 120000; iteration++) {
    const chosen = options.map(
      (group) => group[Math.floor(random() * group.length)],
    );
    const multipliers = chosen.map((recipe) =>
      clampMultiplier(
        recipe.ideal * (0.65 + random() * 0.7),
        recipe.supplement,
      ),
    );
    // The cooking model creates equal servings when lunch and dinner share a dish.
    // Preserve that same invariant while considering a complete day's menu.
    if (chosen[1].id === chosen[3].id) {
      const average = Math.round((multipliers[1] + multipliers[3]) * 50) / 100;
      multipliers[1] = average;
      multipliers[3] = average;
    }
    const totals = macroKeys.map((_, nutrient) =>
      chosen.reduce(
        (sum, recipe, slot) =>
          sum +
          Math.round(recipe.nutrition[nutrient] * multipliers[slot] * 10) / 10,
        0,
      ),
    );
    let penalty = 0,
      violations = 0,
      carbPenalty = 0;
    for (let nutrient = 0; nutrient < macroKeys.length; nutrient++) {
      const gap = Math.max(
        0,
        minimum[nutrient] - totals[nutrient],
        totals[nutrient] - maximum[nutrient],
      );
      if (gap > 0.000001) violations++;
      const relative = gap / scale[nutrient];
      penalty += weights[nutrient] * (relative + relative * relative);
    }
    const tuple = chosen.map((recipe) => recipe.id).join("|");
    const previous = bestByTuple.get(tuple);
    if (
      previous &&
      (previous.violations < violations ||
        (previous.violations === violations && previous.penalty < penalty))
    )
      continue;
    const required = ingredients.map(() => 0);
    for (let slot = 0; slot < chosen.length; slot++) {
      for (const [index, quantity] of chosen[slot].items)
        required[index] += quantity * multipliers[slot] * 7;
      const guide = target.values.carbs * mealShares[slots[slot]];
      carbPenalty +=
        Math.max(
          0,
          (chosen[slot].nutrition[2] * multipliers[slot] - guide * 1.2) /
            Math.max(1, guide),
        ) ** 2;
    }
    const cost = required.reduce(
      (sum, quantity, index) =>
        sum +
        Math.ceil(Math.max(0, quantity - stock[index]) / prices[index].pack) *
          prices[index].price,
      0,
    );
    const candidate = {
      tuple,
      chosen,
      multipliers,
      violations,
      penalty,
      cost,
      carbPenalty,
    };
    if (!previous || compare(candidate, previous) < 0)
      bestByTuple.set(tuple, candidate);
  }
  return [...bestByTuple.values()]
    .sort(compare)
    .slice(0, 20)
    .map(({ chosen, multipliers }) =>
      Object.fromEntries(
        slots.map((slot, index) => [
          slot,
          { recipeId: chosen[index].id, multiplier: multipliers[index] },
        ]),
      ),
    );
}

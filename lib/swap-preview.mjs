import {
  addDays,
  applyAction,
  getRecipe,
  today,
  viewState,
} from "./domain.mjs";
import { recipeMap } from "./catalog.mjs";
import { mealNutrients } from "./nutrition-planner.mjs";
import { storageAllocation } from "./rhythm.mjs";
import { allocations, freePortions, yieldInfo } from "../public/portions.js";
import { macroKeys } from "../public/nutrition-targets.js";

const round = (value) => Math.round(value * 10) / 10;
const fail = (message) => {
  throw Object.assign(new Error(message), { status: 400 });
};

// viewState normally creates a next-week draft near rollover. A preview must only
// assess existing weeks. The clone-only empty draft prevents that unrelated work;
// keeping existing active statuses preserves stock reserved by earlier plans.
function previewView(state) {
  const projection = structuredClone(state);
  const active = projection.plans
    .filter((plan) => plan.status === "active")
    .sort((a, b) => b.start.localeCompare(a.start))[0];
  if (
    active &&
    today() >= addDays(active.start, 5) &&
    !projection.plans.some((plan) => plan.start === addDays(active.start, 7))
  )
    projection.plans.push({
      id: "swap-preview-rollover-hold",
      start: addDays(active.start, 7),
      status: "draft",
      meals: [],
    });
  return viewState(projection);
}

function mealSummary(state, plan, meal) {
  const recipe = recipeMap[meal.recipeId],
    saved = allocations(meal),
    prepared = !!meal.batchId;
  const lots = saved.map((allocation) => ({
    allocation,
    batch: state.batches.find((batch) => batch.id === allocation.batchId),
  }));
  const servingGrams =
    prepared &&
    lots.length &&
    lots.every(
      ({ batch }) =>
        Number.isFinite(batch?.gramsPerPortion) && batch.gramsPerPortion > 0,
    )
      ? round(
          lots.reduce(
            (sum, { allocation, batch }) =>
              sum + allocation.portions * batch.gramsPerPortion,
            0,
          ),
        )
      : null;
  let batch = null;
  if (meal.status === "planned" && !prepared) {
    const yieldData = yieldInfo(plan, meal),
      cookDate = yieldData.root.cookDate || yieldData.root.date;
    const storage = storageAllocation(plan, yieldData.root, cookDate);
    batch = {
      rootMealId: yieldData.root.id,
      portions: yieldData.portions,
      cookDate,
      fridge: storage.fridge,
      freeze: storage.freeze,
      mealIds: yieldData.group.map((entry) => entry.id),
      freshAssembly: !!recipe.freshAssembly,
    };
  }
  return {
    id: meal.id,
    date: meal.date,
    slot: meal.slot,
    status: meal.status,
    recipeId: meal.recipeId,
    title: recipe.title,
    multiplier: meal.multiplier,
    parentId: meal.parentId || null,
    prepared,
    allocatedPortions: saved.reduce(
      (sum, allocation) => sum + allocation.portions,
      0,
    ),
    servingGrams,
    nutrition: mealNutrients(state, meal),
    batch,
    ingredients: getRecipe(
      state,
      meal.recipeId,
      meal.multiplier,
    ).ingredients.map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      quantity: ingredient.quantity,
    })),
  };
}

const daySummary = (day) => ({
  date: day.date,
  totals: day.totals,
  externalSlots: day.externalSlots,
  assessment: day.assessment,
});
const difference = (before, after) =>
  Object.fromEntries(
    macroKeys.map((key) => [
      key,
      Number.isFinite(before?.[key]) && Number.isFinite(after?.[key])
        ? round(after[key] - before[key])
        : null,
    ]),
  );

function summary(state, plan, view, meal) {
  const projected = view.plans.find((entry) => entry.id === plan.id);
  const spent = Math.round(
    state.purchases
      .filter((purchase) => purchase.planId === plan.id)
      .reduce((sum, purchase) => sum + purchase.cost, 0),
  );
  const shopping = Math.round(
    projected.shopping.reduce((sum, row) => sum + row.cost, 0),
  );
  return {
    meal: mealSummary(state, plan, meal),
    day: daySummary(
      projected.nutritionReport.days.find((day) => day.date === meal.date),
    ),
    budget: {
      spent,
      shopping,
      total: spent + shopping,
      limit: state.profile.budget,
      within: spent + shopping <= state.profile.budget,
    },
    shopping: projected.shopping,
    sessions: projected.sessions,
    shoppingTrips: projected.shoppingTrips,
  };
}

export function previewSwap(state, { id, recipeId } = {}) {
  if (!state?.profile) fail("Complete onboarding first.");
  const plan = state.plans.find((entry) =>
    entry.meals.some((meal) => meal.id === id),
  );
  if (!plan) fail("Meal no longer exists. Refresh your plan.");
  const meal = plan.meals.find((entry) => entry.id === id);
  // Use the exact final mutation for validation, portion scaling, batch regrouping
  // and reservation release. Only its throwaway clone changes revision or events.
  const changed = structuredClone(state);
  applyAction(changed, "swap", { id, recipeId });
  const nextPlan = changed.plans.find((entry) => entry.id === plan.id);
  const nextMeal = nextPlan.meals.find((entry) => entry.id === id);
  const oldView = previewView(state),
    newView = previewView(changed);
  const before = summary(state, plan, oldView, meal),
    after = summary(changed, nextPlan, newView, nextMeal);
  const changedMeals = [];
  for (const entry of plan.meals) {
    const previous = mealSummary(state, plan, entry);
    const proposed = mealSummary(
      changed,
      nextPlan,
      nextPlan.meals.find((next) => next.id === entry.id),
    );
    if (JSON.stringify(previous) !== JSON.stringify(proposed))
      changedMeals.push({
        id: entry.id,
        date: entry.date,
        slot: entry.slot,
        before: previous,
        after: proposed,
      });
  }
  const affectedDays = [...new Set(changedMeals.map((entry) => entry.date))]
    .sort()
    .map((date) => ({
      date,
      before: daySummary(
        oldView.plans
          .find((entry) => entry.id === plan.id)
          .nutritionReport.days.find((day) => day.date === date),
      ),
      after: daySummary(
        newView.plans
          .find((entry) => entry.id === plan.id)
          .nutritionReport.days.find((day) => day.date === date),
      ),
    }));
  const releasedPortions = [
    ...new Set(allocations(meal).map((allocation) => allocation.batchId)),
  ].flatMap((batchId) => {
    const batch = state.batches.find((entry) => entry.id === batchId),
      proposed = changed.batches.find((entry) => entry.id === batchId);
    if (!batch || !proposed) return [];
    const portions =
      Math.round(
        Math.max(
          0,
          freePortions(changed, proposed) - freePortions(state, batch),
        ) * 1e6,
      ) / 1e6;
    return portions > 0
      ? [
          {
            batchId,
            recipeId: batch.recipeId,
            title: recipeMap[batch.recipeId].title,
            portions,
            expires: batch.expires,
            location: batch.location,
          },
        ]
      : [];
  });
  const warnings = [];
  if (!after.day.assessment.complete)
    warnings.push(
      "Some meals have unknown nutrition, so this day cannot yet be checked against every target.",
    );
  else if (!after.day.assessment.met)
    warnings.push(
      "This change leaves daily nutrition outside one or more planning targets. Review the amounts below.",
    );
  if (!after.budget.within)
    warnings.push(
      `Full grocery packs and purchases would exceed the weekly budget by £${((after.budget.total - after.budget.limit) / 100).toFixed(2)}.`,
    );
  if (releasedPortions.length)
    warnings.push(
      "Your prepared portions stay in Kitchen as unallocated leftovers. Check their use-by dates before planning them again.",
    );
  if (changedMeals.length > 1)
    warnings.push(
      `Batch servings or portion sizes for ${changedMeals.length - 1} other meal${changedMeals.length === 2 ? "" : "s"} would also change.`,
    );
  return {
    revision: state.revision,
    planId: plan.id,
    mealId: id,
    date: meal.date,
    slot: meal.slot,
    recipeId,
    targets: oldView.nutritionTargets,
    before,
    after,
    deltas: {
      nutrition: difference(before.meal.nutrition, after.meal.nutrition),
      day: difference(before.day.totals, after.day.totals),
      cost: after.budget.total - before.budget.total,
      shoppingCost: after.budget.shopping - before.budget.shopping,
      batchPortions:
        before.meal.batch && after.meal.batch
          ? after.meal.batch.portions - before.meal.batch.portions
          : null,
    },
    changedMeals,
    affectedDays,
    releasedPortions,
    warnings,
  };
}

import { randomUUID } from "node:crypto";
import { adaptRecipeForEquipment } from "./appliance-recipes.mjs";
import { dayKey, weightReference } from "../public/metrics.js";
import { freePortions, yieldInfo, originalYield } from "../public/portions.js";
import { storeBatch, eatPortion } from "./batch-actions.mjs";
import { learningBias, saveReview } from "./reviews.mjs";
import { importPurchases } from "./purchase-import.mjs";
import { importPantry } from "./pantry-import.mjs";
import { equipmentInput, unusedPlan } from "./setup-actions.mjs";
import { mealMixOptions } from "../public/meal-mix.js";
import {
  equipmentIds,
  isRecipeAllowed,
  latestRecipeRating,
} from "../public/preferences.js";
import {
  nutritionTargets,
  validateNutritionSettings,
} from "../public/nutrition-targets.js";
import { optimiseNutrition, planNutrition } from "./nutrition-planner.mjs";
import {
  cadence,
  batchFriendly,
  arrangeBatches,
  sessionsFor,
  shoppingTrips,
  storageAllocation,
} from "./rhythm.mjs";
import {
  ingredients,
  ingredientMap,
  recipes,
  recipeMap,
  recipeNutrition,
  detailedSteps,
} from "./catalog.mjs";
export const slots = ["breakfast", "lunch", "snack", "dinner"];
export const today = () => dayKey();
const pastUseBy = (b) =>
  b.expires < today() || (b.safeUntil && Date.parse(b.safeUntil) < Date.now());
export const addDays = (date, n) =>
  new Date(Date.parse(date + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
export const freshState = () => ({
  revision: 0,
  profile: null,
  plans: [],
  inventory: [],
  batches: [],
  logs: [],
  feedback: [],
  prices: {},
  nutrition: {},
  purchases: [],
  events: [],
});
const fail = (m) => {
  throw Object.assign(new Error(m), { status: 400 });
};
export const number = (v, min, max, label) => {
  const n = Number(v);
  if (v === "" || v == null || !Number.isFinite(n) || n < min || n > max)
    fail(`${label} must be between ${min} and ${max}.`);
  return n;
};
const text = (v, n = 200) =>
  String(v ?? "")
    .trim()
    .slice(0, n);
export function validDate(v) {
  const d = new Date(v);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v || "") ||
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== v
  )
    fail("Enter a valid date.");
  return v;
}
const enumValue = (v, options, label) =>
  options.includes(v) ? v : fail(`Choose ${label}.`);
export function calorieEstimate(p) {
  const bmr =
    10 * p.weight +
    6.25 * p.height -
    5 * p.age +
    (p.equationSex === "male" ? 5 : -161);
  const maintenance = Math.round(bmr * p.activity);
  const target = Math.max(
    1500,
    Math.round((maintenance - (p.goal === "lose" ? 300 : 0)) / 50) * 50,
  );
  return {
    bmr: Math.round(bmr),
    maintenance,
    target,
    method:
      "Mifflin–St Jeor × activity; a modest 300 kcal reduction for weight loss. Rounded to 50 kcal, minimum suggestion 1,500. An estimate, not a prescription.",
  };
}
export function profileInput(raw) {
  const p = {
    name: text(raw.name, 60),
    age: number(raw.age, 18, 100, "Age"),
    height: number(raw.height, 120, 230, "Height (cm)"),
    weight: number(raw.weight, 35, 300, "Weight (kg)"),
    equationSex: enumValue(
      raw.equationSex,
      ["male", "female"],
      "an equation input",
    ),
    activity: number(raw.activity, 1.2, 1.9, "Activity multiplier"),
    goal: enumValue(raw.goal, ["lose", "maintain"], "a goal"),
    budget: Math.round(number(raw.budget, 5, 500, "Weekly budget") * 100),
    equipment: (raw.equipment || []).filter((e) => equipmentIds.includes(e)),
    hobType: enumValue(
      raw.hobType || "unspecified",
      ["unspecified", "induction", "electric", "gas"],
      "hob type",
    ),
    hobScale: enumValue(
      raw.hobScale || "generic",
      ["generic", "1-9"],
      "hob scale",
    ),
    hobModel: text(raw.hobModel, 100),
    pressureCookerModel: text(raw.pressureCookerModel, 100),
    pressureCookerLitres:
      raw.pressureCookerLitres === "" || raw.pressureCookerLitres == null
        ? null
        : number(raw.pressureCookerLitres, 0.5, 30, "Cooker capacity (litres)"),
    allergens: (raw.allergens || []).filter((a) =>
      ["milk", "egg", "fish", "soy", "gluten", "peanut"].includes(a),
    ),
    avoid: (raw.avoid || []).filter((id) => ingredientMap[id]),
    diet: enumValue(
      raw.diet,
      ["omnivore", "pescatarian", "vegetarian", "vegan"],
      "a diet",
    ),
    likes: text(raw.likes),
    mainMealMix: enumValue(
      raw.mainMealMix || "varied",
      mealMixOptions.map((x) => x[0]),
      "a main-meal preference",
    ),
    cooking: enumValue(raw.cooking, ["batch", "daily"], "a cooking preference"),
    cookEveryDays: number(raw.cookEveryDays || 3, 2, 3, "Cooking interval"),
    shopEveryDays: number(raw.shopEveryDays || 7, 2, 7, "Shopping interval"),
    hobCount: number(raw.hobCount || 1, 1, 4, "Hob rings"),
    activeLimit: number(raw.activeLimit, 5, 90, "Active cooking time"),
    explore: number(raw.explore, 0, 3, "Discovery meals"),
    glucoseUnit: enumValue(
      raw.glucoseUnit,
      ["mg/dL", "mmol/L"],
      "a glucose unit",
    ),
    targets: {},
    startDate: validDate(raw.startDate || today()),
    stepsTarget: number(raw.stepsTarget || 7000, 100, 50000, "Steps target"),
    postcode: text(raw.postcode, 30),
  };
  if (!p.name) fail("Enter your name.");
  if (
    ![2, 3].includes(p.cookEveryDays) ||
    ![2, 3, 7].includes(p.shopEveryDays) ||
    !Number.isInteger(p.hobCount)
  )
    fail(
      "Choose a supported cooking/shopping rhythm and whole number of hob rings.",
    );
  for (const timing of ["before", "after"]) {
    const lo = raw.targets?.[timing]?.min,
      hi = raw.targets?.[timing]?.max;
    const min =
        lo !== "" && lo != null
          ? number(lo, 0.1, 1000, "Target minimum")
          : null,
      max =
        hi !== "" && hi != null
          ? number(hi, 0.1, 1000, "Target maximum")
          : null;
    if (min != null && max != null && min >= max)
      fail("Target maximum must exceed minimum.");
    if (min != null || max != null) p.targets[timing] = { min, max };
  }
  p.energy = calorieEstimate(p);
  p.calorieTarget = raw.calorieTarget
    ? number(raw.calorieTarget, 1500, 4500, "Calorie target")
    : p.energy.target;
  const reference = weightReference(p.height, p.weight, p.goal);
  if (p.goal === "lose" && p.weight / (p.height / 100) ** 2 < 18.5)
    fail(
      "Weight-loss plans are not offered below the general adult BMI reference range. Choose maintenance and discuss your needs with your clinician.",
    );
  p.targetWeight = raw.targetWeight
    ? number(
        raw.targetWeight,
        Math.ceil(18.5 * (p.height / 100) ** 2 * 10) / 10,
        300,
        "Target weight (kg)",
      )
    : reference.suggested;
  p.nutritionSettings = validateNutritionSettings(
    p,
    raw.nutritionSettings || {},
  );
  return p;
}
export function compatible(r, p) {
  const allowed = {
    vegan: ["vegan"],
    vegetarian: ["vegan", "vegetarian"],
    pescatarian: ["vegan", "vegetarian", "pescatarian"],
    omnivore: ["vegan", "vegetarian", "pescatarian", "omnivore"],
  }[p.diet];
  return (
    r.active <= p.activeLimit &&
    r.equipment.every(
      (e) =>
        p.equipment.includes(e) ||
        (e === "shaker" && p.equipment.includes("blender")),
    ) &&
    r.items.every(
      (i) =>
        !p.avoid.includes(i.id) &&
        !ingredientMap[i.id].allergens.some((a) => p.allergens.includes(a)) &&
        allowed.includes(ingredientMap[i.id].diet),
    )
  );
}
export function priceOf(s, id) {
  return s.prices[id] || { ...ingredientMap[id] };
}
export function recipeAllowed(s, r) {
  return (
    compatible(r, s.profile) &&
    isRecipeAllowed(s, r.id) &&
    (!r.supplement ||
      (s.profile.nutritionSettings?.proteinSafety === "none" &&
        ["optional", "daily"].includes(s.profile.nutritionSettings?.shakes)))
  );
}
const planCost = (s, p) =>
  shopping(s, p).reduce((n, r) => n + r.cost, 0) +
  s.purchases.filter((x) => x.planId === p.id).reduce((n, x) => n + x.cost, 0);
const balancePlan = (s, p, from = p.start) =>
  optimiseNutrition(s, p, {
    allowed: (r) => recipeAllowed(s, r),
    cost: (plan) => planCost(s, plan),
    from,
  });
export function available(s, id, date = today()) {
  return s.inventory
    .filter(
      (i) =>
        i.ingredientId === id &&
        i.quantity > 0 &&
        (!i.expires || i.expires >= date),
    )
    .reduce((n, i) => n + i.quantity, 0);
}
const multiplier = (r, slot, p) =>
  Math.round(
    Math.max(
      0.6,
      Math.min(
        1.8,
        (p.calorieTarget *
          { breakfast: 0.25, lunch: 0.3, snack: 0.1, dinner: 0.35 }[slot]) /
          recipeNutrition(r).kcal,
      ),
    ) * 100,
  ) / 100;
function forecastStock(s, date) {
  const stock = Object.fromEntries(
    ingredients.map((i) => [
      i.id,
      available(s, i.id, date < today() ? today() : date),
    ]),
  );
  for (const plan of s.plans.filter(
    (p) => p.start < date && p.status === "active",
  )) {
    for (const [id, qty] of Object.entries(requirements(s, plan))) {
      stock[id] = Math.max(0, stock[id] - qty);
    }
  }
  return stock;
}
export function generatePlan(s, start, draft = false) {
  validDate(start);
  if (!s.profile) fail("Complete onboarding first.");
  if (s.plans.some((p) => p.start === start))
    return s.plans.find((p) => p.start === start);
  const p = s.profile,
    stock = forecastStock(s, start),
    used = {},
    cuisines = {},
    plan = {
      id: randomUUID(),
      start,
      status: draft ? "draft" : "active",
      createdAt: new Date().toISOString(),
      meals: [],
    };
  const rhythmDays = cadence(p),
    carries = {};
  for (let day = 0; day < 7; day++)
    for (const slot of slots) {
      const date = addDays(start, day),
        main = slot === "lunch" || slot === "dinner";
      const carry = carries[slot];
      if (rhythmDays > 1 && day % rhythmDays !== 0 && carry) {
        plan.meals.push({
          id: randomUUID(),
          date,
          slot,
          recipeId: carry.recipeId,
          multiplier: carry.multiplier,
          parentId: carry.parentId,
          status: "planned",
        });
        continue;
      }
      let candidates = recipes.filter(
        (r) =>
          r.slots.includes(slot) &&
          recipeAllowed(s, r) &&
          batchFriendly(r, p) &&
          !(rhythmDays > 1 && r.id === "berry-oats"),
      );
      if (!candidates.length)
        fail(
          `No compatible ${slot} recipes for these constraints. Adjust cooking time or equipment, or add recipes; allergies will never be relaxed.`,
        );
      candidates = candidates
        .map((r) => {
          const mult = multiplier(r, slot, p);
          const cost = r.items.reduce((n, i) => {
            const pr = priceOf(s, i.id);
            return n + ((i.qty * mult) / pr.pack) * pr.price;
          }, 0);
          const reuse =
            r.items.reduce(
              (n, i) =>
                n + Math.min(stock[i.id] || 0, i.qty * mult) / (i.qty * mult),
              0,
            ) / r.items.length;
          const affinity = latestRecipeRating(s, r.id) === "love" ? 3 : 0;
          const tried = s.feedback.some((f) => f.recipeId === r.id);
          const score =
            learningBias(s, r, cost) +
            reuse * 6 +
            affinity -
            (used[r.id] || 0) * 3 -
            (cuisines[r.cuisine] || 0) * 0.4 -
            cost / 80 +
            (!tried && main ? p.explore : 0) +
            p.likes
              .toLowerCase()
              .split(/\W+/)
              .filter((t) => t.length > 2)
              .reduce(
                (n, t) =>
                  n +
                  Number(
                    (r.title + " " + r.cuisine).toLowerCase().includes(t),
                  ) *
                    0.5,
                0,
              );
          return { r, mult, score };
        })
        .sort((a, b) => b.score - a.score || a.r.id.localeCompare(b.r.id));
      const chosen = candidates[0],
        id = randomUUID(),
        count = Math.min(rhythmDays, 7 - day);
      plan.meals.push({
        id,
        date,
        slot,
        recipeId: chosen.r.id,
        multiplier: chosen.mult,
        parentId: null,
        status: "planned",
      });
      used[chosen.r.id] = (used[chosen.r.id] || 0) + 1;
      cuisines[chosen.r.cuisine] = (cuisines[chosen.r.cuisine] || 0) + 1;
      for (const i of chosen.r.items)
        stock[i.id] = Math.max(
          0,
          (stock[i.id] || 0) - i.qty * chosen.mult * count,
        );
      if (rhythmDays > 1)
        carries[slot] = {
          recipeId: chosen.r.id,
          multiplier: chosen.mult,
          parentId: id,
        };
    }
  reuseLeftovers(s, plan);
  optimiseBudget(s, plan);
  arrangeBatches(plan, p);
  balancePlan(s, plan);
  s.plans.push(plan);
  return plan;
}
export function requirements(s, plan) {
  const req = {};
  for (const meal of plan.meals) {
    if (["eaten", "skipped", "out"].includes(meal.status)) continue;
    const batch = s.batches.find((b) => b.id === meal.batchId);
    if (batch) continue;
    const r = recipeMap[meal.recipeId];
    for (const i of r.items)
      req[i.id] = (req[i.id] || 0) + i.qty * meal.multiplier;
    if (!meal.parentId && meal.batchYield) {
      const extra =
        yieldInfo(plan, meal).portions - yieldInfo(plan, meal).group.length;
      for (const i of r.items)
        req[i.id] = (req[i.id] || 0) + i.qty * meal.multiplier * extra;
    }
  }
  return req;
}
export function shopping(s, plan) {
  const rows = new Map();
  for (const trip of shoppingTrips(
    s,
    plan,
    priceOf,
    forecastStock(s, plan.start),
  ))
    for (const row of trip.rows) {
      if (!rows.has(row.id))
        rows.set(row.id, { ...row, need: 0, have: 0, packs: 0, cost: 0 });
      const target = rows.get(row.id);
      target.need += row.need;
      target.have += row.haveActual;
      target.packs += row.packs;
      target.cost += row.cost;
    }
  return [...rows.values()]
    .map((r) => ({
      ...r,
      need: Math.round(r.need * 10) / 10,
      have: Math.round(r.have * 10) / 10,
      missing: Math.max(0, r.need - r.have),
    }))
    .sort(
      (a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name),
    );
}
function optimiseBudget(s, plan) {
  const total = () => shopping(s, plan).reduce((n, r) => n + r.cost, 0);
  for (let pass = 0; pass < 20 && total() > s.profile.budget; pass++) {
    const cost = total();
    let best = null;
    for (const root of plan.meals.filter((m) => !m.parentId && !m.batchId)) {
      const group = plan.meals.filter(
        (m) => m.id === root.id || m.parentId === root.id,
      );
      const saved = group.map((m) => ({
        recipeId: m.recipeId,
        multiplier: m.multiplier,
      }));
      for (const recipe of recipes.filter(
        (r) =>
          r.slots.includes(root.slot) &&
          recipeAllowed(s, r) &&
          batchFriendly(r, s.profile) &&
          r.id !== saved[0].recipeId,
      )) {
        for (const m of group) {
          m.recipeId = recipe.id;
          m.multiplier = multiplier(recipe, root.slot, s.profile);
        }
        const cuisines = plan.meals
          .filter((m) => m.slot === "dinner")
          .map((m) => recipeMap[m.recipeId].cuisine);
        const saving = cost - total();
        if (
          saving > 0 &&
          new Set(cuisines).size >= 2 &&
          (!best || saving > best.saving)
        )
          best = {
            ids: group.map((m) => m.id),
            recipeId: recipe.id,
            mult: multiplier(recipe, root.slot, s.profile),
            saving,
          };
        group.forEach((m, i) => Object.assign(m, saved[i]));
      }
    }
    if (!best) break;
    for (const m of plan.meals.filter((m) => best.ids.includes(m.id))) {
      m.recipeId = best.recipeId;
      m.multiplier = best.mult;
    }
  }
}
function getMeal(s, id) {
  for (const plan of s.plans) {
    const meal = plan.meals.find((m) => m.id === id);
    if (meal) return { plan, meal };
  }
  fail("Meal no longer exists. Refresh your plan.");
}
function detach(plan, meal) {
  const children = plan.meals.filter((m) => m.parentId === meal.id);
  if (children.length) {
    children[0].parentId = null;
    for (const child of children.slice(1)) child.parentId = children[0].id;
  }
  meal.parentId = null;
  delete meal.batchId;
  delete meal.allocations;
  delete meal.batchYield;
}
function reuseLeftovers(s, plan) {
  for (const b of s.batches.filter(
    (b) => b.remaining > 0 && b.expires >= plan.start,
  )) {
    const r = recipeMap[b.recipeId];
    if (!r || !recipeAllowed(s, r)) continue;
    for (const meal of plan.meals) {
      if (freePortions(s, b, plan) <= 0.000001) break;
      if (meal.batchId || meal.date > b.expires || !r.slots.includes(meal.slot))
        continue;
      detach(plan, meal);
      Object.assign(meal, {
        batchId: b.id,
        allocations: [
          { batchId: b.id, portions: Math.min(1, freePortions(s, b, plan)) },
        ],
        recipeId: b.recipeId,
        multiplier: b.multiplier * Math.min(1, freePortions(s, b, plan)),
      });
    }
  }
}
function consume(s, id, qty, date) {
  const lots = s.inventory
    .filter(
      (i) =>
        i.ingredientId === id &&
        i.quantity > 0 &&
        (!i.expires || i.expires >= date),
    )
    .sort((a, b) => (a.expires || "9999").localeCompare(b.expires || "9999"));
  for (const lot of lots) {
    const used = Math.min(qty, lot.quantity);
    lot.quantity = Math.round((lot.quantity - used) * 100) / 100;
    qty -= used;
    if (qty < 0.001) break;
  }
}
export function applyAction(s, action, data = {}) {
  switch (action) {
    case "nutritionSettings": {
      if (!s.profile) fail("Complete onboarding first.");
      s.profile.nutritionSettings = validateNutritionSettings(s.profile, data);
      break;
    }
    case "rebalancePlan": {
      if (!s.profile) fail("Complete onboarding first.");
      const p = s.plans.find((p) => p.id === data.planId);
      if (!p) fail("Week not found.");
      if (!nutritionTargets(s.profile).ready)
        fail("Review nutrition targets before balancing the plan.");
      if (addDays(p.start, 6) < today())
        fail("Choose a current or future week.");
      if (data.confirmed !== true)
        fail("Review and confirm the changes first.");
      balancePlan(s, p, today() > p.start ? today() : p.start);
      break;
    }
    case "rhythm": {
      if (!s.profile) fail("Complete onboarding first.");
      const cooking = enumValue(
        data.cooking,
        ["batch", "daily"],
        "a cooking preference",
      );
      const cookEveryDays = Number(data.cookEveryDays),
        shopEveryDays = Number(data.shopEveryDays),
        hobCount = Number(data.hobCount);
      if (
        ![2, 3].includes(cookEveryDays) ||
        ![2, 3, 7].includes(shopEveryDays) ||
        !Number.isInteger(hobCount) ||
        hobCount < 1 ||
        hobCount > 4
      )
        fail("Choose a supported rhythm and hob count.");
      const plan = s.plans.find((p) => p.id === data.planId);
      if (!plan) fail("Week not found.");
      Object.assign(s.profile, {
        cooking,
        cookEveryDays,
        shopEveryDays,
        hobCount,
      });
      arrangeBatches(plan, s.profile);
      break;
    }
    case "importPurchases":
      importPurchases(s, data);
      break;
    case "importPantry":
      importPantry(s, data);
      break;
    case "profile": {
      const previous = s.profile;
      if (
        previous &&
        s.plans.length &&
        data.startDate &&
        data.startDate !== previous.startDate
      )
        fail(
          "Use Settings → Plan dates to move an unused week or create a new dated draft.",
        );
      s.profile = profileInput({
        mainMealMix: previous?.mainMealMix,
        hobType: previous?.hobType,
        hobScale: previous?.hobScale,
        hobModel: previous?.hobModel,
        pressureCookerModel: previous?.pressureCookerModel,
        pressureCookerLitres: previous?.pressureCookerLitres,
        ...data,
        nutritionSettings:
          data.nutritionSettings || previous?.nutritionSettings,
      });
      if (!s.plans.length) generatePlan(s, s.profile.startDate);
      else if (
        previous &&
        (previous.cooking !== s.profile.cooking ||
          previous.cookEveryDays !== s.profile.cookEveryDays ||
          previous.equipment.join(",") !== s.profile.equipment.join(","))
      )
        for (const plan of s.plans.filter(
          (p) => addDays(p.start, 6) >= today(),
        ))
          arrangeBatches(plan, s.profile);
      break;
    }
    case "generate":
      generatePlan(s, validDate(data.start), !!data.draft);
      break;
    case "equipmentSettings": {
      if (!s.profile) fail("Complete onboarding first.");
      const settings = equipmentInput(data);
      Object.assign(s.profile, settings);
      for (const plan of s.plans.filter((p) => addDays(p.start, 6) >= today()))
        arrangeBatches(plan, s.profile);
      break;
    }
    case "mealMixSettings": {
      if (!s.profile) fail("Complete onboarding first.");
      const mode = enumValue(
        data.mainMealMix,
        mealMixOptions.map((x) => x[0]),
        "a main-meal preference",
      );
      if (
        mode !== "varied" &&
        !["omnivore", "pescatarian"].includes(s.profile.diet)
      )
        fail(
          "Your diet excludes meat and fish. Update your dietary choice explicitly before selecting this preference.",
        );
      s.profile.mainMealMix = mode;
      break;
    }
    case "planDates": {
      if (data.confirmed !== true) fail("Confirm the date change first.");
      const start = validDate(data.start);
      if (start < today()) fail("Choose today or a future start date.");
      if (!["move", "new"].includes(data.mode))
        fail("Choose move or new draft.");
      const original = s.plans.find((p) => p.id === data.planId);
      if (data.mode === "move" && (!original || !unusedPlan(s, original)))
        fail(
          "This week is already in use. Create a new non-overlapping draft instead; history stays unchanged.",
        );
      if (
        s.plans.some(
          (p) =>
            !(data.mode === "move" && p.id === original.id) &&
            p.start <= addDays(start, 6) &&
            addDays(p.start, 6) >= start,
        )
      )
        fail(
          "These seven days overlap a saved week. Choose a non-overlapping start date.",
        );
      if (data.mode === "new") generatePlan(s, start, true);
      else {
        const moved = structuredClone(original);
        const offset = Math.round(
          (Date.parse(start) - Date.parse(original.start)) / 86400000,
        );
        moved.start = start;
        moved.status = "draft";
        delete moved.stockConfirmedAt;
        for (const meal of moved.meals) meal.date = addDays(meal.date, offset);
        arrangeBatches(moved, s.profile);
        s.plans[s.plans.indexOf(original)] = moved;
        if (s.profile.startDate === original.start) s.profile.startDate = start;
      }
      break;
    }
    case "review": {
      const plan = s.plans.find((p) => p.id === data.planId);
      if (!plan) fail("Week not found.");
      const next = s.plans.find((p) => p.start === addDays(plan.start, 7));
      if (
        data.refreshDraft &&
        next &&
        (next.status !== "draft" ||
          next.meals.some((m) => m.status === "eaten" || m.batchId) ||
          s.purchases.some((p) => p.planId === next.id))
      )
        fail("This next week is already in use. Save without rebuilding it.");
      saveReview(s, plan, data);
      if (data.refreshDraft) {
        if (next) s.plans = s.plans.filter((p) => p.id !== next.id);
        generatePlan(s, addDays(plan.start, 7), true);
      }
      break;
    }
    case "useBatch": {
      const { plan, meal } = getMeal(s, data.id),
        b = s.batches.find((b) => b.id === data.batchId);
      if (meal.status !== "planned") fail("Choose a planned meal.");
      if (
        !b ||
        pastUseBy(b) ||
        b.expires < meal.date ||
        freePortions(s, b) <= 0
      )
        fail("No unallocated, in-date portion is available.");
      const portions = number(
        data.portions ?? Math.min(1, freePortions(s, b)),
        0.01,
        freePortions(s, b),
        "Portions to allocate",
      );
      const r = recipeMap[b.recipeId];
      if (!r.slots.includes(meal.slot) || !recipeAllowed(s, r))
        fail("This leftover does not fit this meal or your exclusions.");
      detach(plan, meal);
      Object.assign(meal, {
        batchId: b.id,
        allocations: [{ batchId: b.id, portions }],
        recipeId: b.recipeId,
        multiplier: b.multiplier * portions,
      });
      if (plan.rhythmVersion) arrangeBatches(plan, s.profile);
      break;
    }
    case "activate": {
      const plan = s.plans.find((p) => p.id === data.id);
      if (!plan) fail("Plan not found.");
      plan.status = "active";
      plan.stockConfirmedAt = new Date().toISOString();
      break;
    }
    case "swap": {
      const { plan, meal } = getMeal(s, data.id);
      if (meal.status !== "planned")
        fail("Only unprepared meals can be changed.");
      const replacement = recipeMap[data.recipeId];
      if (
        !replacement ||
        !replacement.slots.includes(meal.slot) ||
        !recipeAllowed(s, replacement)
      )
        fail("This meal does not meet your preferences or equipment.");
      const group = plan.meals.filter((m) => m.parentId === meal.id);
      if (group.length) {
        const newParent = group[0];
        newParent.parentId = null;
        for (const child of group.slice(1)) child.parentId = newParent.id;
      }
      delete meal.batchId;
      delete meal.allocations;
      delete meal.batchYield;
      meal.parentId = null;
      meal.recipeId = replacement.id;
      meal.multiplier = multiplier(replacement, meal.slot, s.profile);
      if (plan.rhythmVersion) arrangeBatches(plan, s.profile);
      break;
    }
    case "mealStatus": {
      const { plan, meal } = getMeal(s, data.id);
      if (!["out", "skipped", "planned"].includes(data.status))
        fail("Invalid meal status.");
      if (meal.status === "eaten") fail("This meal has already been eaten.");
      const children = plan.meals.filter((m) => m.parentId === meal.id);
      if (children.length) {
        children[0].parentId = null;
        for (const child of children.slice(1)) child.parentId = children[0].id;
      }
      delete meal.batchId;
      delete meal.allocations;
      delete meal.batchYield;
      meal.parentId = null;
      meal.status = data.status;
      if (plan.rhythmVersion) arrangeBatches(plan, s.profile);
      break;
    }
    case "price": {
      const i = ingredientMap[data.id];
      if (!i) fail("Unknown ingredient.");
      const previous = s.prices[data.id];
      const pr = {
        pack: number(data.pack, 1, 100000, "Edible pack quantity"),
        price: Math.round(number(data.price, 0, 1000, "Price") * 100),
        source: text(data.retailer || "My purchase", 70),
        checkedAt: today(),
        url: null,
        nutrition: previous?.nutrition,
      };
      s.prices[data.id] = pr;
      break;
    }
    case "nutrition": {
      if (!ingredientMap[data.id]) fail("Unknown ingredient.");
      const n = {};
      for (const k of ["kcal", "protein", "carbs", "fat", "fibre", "salt"])
        n[k] = number(data[k], 0, k === "kcal" ? 1000 : 100, k);
      s.nutrition[data.id] = n;
      break;
    }
    case "purchase": {
      const plan = s.plans.find((p) => p.id === data.planId);
      if (!plan) fail("Plan not found.");
      const row = shopping(s, plan).find((i) => i.id === data.id);
      if (!row || row.packs <= 0)
        fail("This ingredient is already covered by your kitchen.");
      const packs = number(data.packs || row.packs, 1, 100, "Packs"),
        i = ingredientMap[row.id];
      if (!Number.isInteger(packs)) fail("Buy a whole number of packs.");
      const quantity = packs * row.price.pack;
      const expires = data.expires ? validDate(data.expires) : null;
      s.inventory.push({
        id: randomUUID(),
        ingredientId: i.id,
        quantity,
        location: enumValue(
          data.location || "cupboard",
          ["cupboard", "fridge", "freezer"],
          "a storage location",
        ),
        expires,
      });
      s.purchases.push({
        id: randomUUID(),
        date: today(),
        ingredientId: i.id,
        quantity,
        cost: Math.round(packs * row.price.price),
        planId: plan.id,
      });
      break;
    }
    case "stock": {
      if (!ingredientMap[data.ingredientId]) fail("Select an ingredient.");
      const quantity = number(data.quantity, 0, 100000, "Quantity"),
        expires = data.expires ? validDate(data.expires) : null,
        location = enumValue(
          data.location,
          ["cupboard", "fridge", "freezer"],
          "a storage location",
        );
      const lot = data.id ? s.inventory.find((i) => i.id === data.id) : null;
      if (data.id && !lot) fail("Stock item not found.");
      if (lot) {
        Object.assign(lot, {
          ingredientId: data.ingredientId,
          quantity,
          expires,
          location,
        });
      } else {
        s.inventory.push({
          id: randomUUID(),
          ingredientId: data.ingredientId,
          quantity,
          expires,
          location,
        });
      }
      break;
    }
    case "cook": {
      const { plan, meal } = getMeal(s, data.id);
      if (plan.status !== "active")
        fail("Confirm your draft and kitchen stock first.");
      if (meal.status !== "planned") fail("This meal cannot be cooked again.");
      const parentId = meal.parentId || meal.id;
      if (meal.parentId)
        fail("Cook the original batch first (shown in your plan).");
      if (meal.batchId) fail("Batch already cooked.");
      const members = plan.meals.filter(
          (m) =>
            (m.id === parentId || m.parentId === parentId) &&
            m.status === "planned" &&
            !m.batchId,
        ),
        recipe = recipeMap[meal.recipeId];
      if (!compatible(recipe, s.profile))
        fail(
          "This recipe conflicts with your current equipment, diet or exclusions. Swap it first.",
        );
      const yieldCount = yieldInfo(plan, meal).portions;
      const quantity = yieldCount * meal.multiplier;
      const cookedWeight = data.cookedWeight
        ? number(data.cookedWeight, 1, 50000, "Finished batch weight")
        : null;
      const missing = recipe.items.filter(
        (i) => available(s, i.id) < i.qty * quantity - 0.01,
      );
      if (missing.length)
        fail(
          "Add your purchased ingredients to Kitchen first: " +
            missing.map((i) => ingredientMap[i.id].name).join(", "),
        );
      const frozen = !!data.freeze;
      if (
        recipe.freshAssembly &&
        (frozen || data.plannedStorage || yieldCount !== 1)
      )
        fail(
          "Mix one shake fresh when you want it; keep the remaining powder dry.",
        );
      const splitPortions = data.plannedStorage
        ? storageAllocation(plan, meal, today()).freeze
        : 0;
      if (splitPortions && !s.profile.equipment.includes("freezer"))
        fail(
          "Later portions need a freezer. Cook fewer portions or change the plan.",
        );
      if (frozen && !s.profile.equipment.includes("freezer"))
        fail("Add a freezer to your equipment before freezing portions.");
      for (const i of recipe.items) consume(s, i.id, i.qty * quantity, today());
      const batchId = randomUUID();
      const hours = recipe.freshAssembly
        ? 2
        : frozen
          ? 720
          : !s.profile.equipment.includes("fridge")
            ? 2
            : recipe.items.some((i) => i.id === "rice")
              ? 24
              : 48;
      const safeUntil = new Date(Date.now() + hours * 3600000).toISOString();
      for (const member of members) {
        member.batchId = batchId;
        member.allocations = [{ batchId, portions: 1 }];
      }
      s.batches.push({
        id: batchId,
        parentId,
        recipeId: recipe.id,
        cookedAt: today(),
        safeUntil,
        remaining: yieldCount,
        yieldPortions: yieldCount,
        cookedWeight,
        gramsPerPortion: cookedWeight ? cookedWeight / yieldCount : null,
        multiplier: meal.multiplier,
        nutrition: recipeNutrition(recipe, meal.multiplier, s.nutrition),
        location: recipe.freshAssembly
          ? "eat now"
          : frozen
            ? "freezer"
            : s.profile.equipment.includes("fridge")
              ? "fridge"
              : "eat now",
        expires: dayKey(safeUntil),
      });
      if (!frozen && splitPortions)
        storeBatch(s, {
          id: batchId,
          operation: "freeze",
          portions: splitPortions,
        });
      break;
    }
    case "batch":
      if (
        data.operation !== "waste" &&
        recipeMap[s.batches.find((b) => b.id === data.id)?.recipeId]
          ?.freshAssembly
      )
        fail(
          "Shakes are mixed fresh; they are not stored as multi-day batches.",
        );
      storeBatch(s, data);
      break;
    case "eat": {
      const { meal } = getMeal(s, data.id);
      if (!compatible(recipeMap[meal.recipeId], s.profile))
        fail("This recipe conflicts with your current exclusions.");
      eatPortion(s, meal, data);
      break;
    }
    case "batchSize": {
      const { plan, meal } = getMeal(s, data.id);
      if (recipeMap[meal.recipeId].freshAssembly)
        fail("Mix one serving fresh. Extra dry powder stays in Kitchen.");
      if (meal.parentId || meal.batchId || meal.status !== "planned")
        fail("Adjust the original batch before preparing it.");
      const count = yieldInfo(plan, meal).group.length;
      const portions = number(data.portions, count, 20, "Batch portions");
      if (!Number.isInteger(portions))
        fail("Choose a whole number of batch portions.");
      meal.batchYield = portions;
      break;
    }
    case "batchWeight": {
      const b = s.batches.find((b) => b.id === data.id);
      if (!b) fail("Batch not found.");
      const weight = number(
        data.cookedWeight,
        1,
        50000,
        "Finished batch weight",
      );
      const origin = b.originBatchId || b.id;
      const yieldCount = originalYield(s, b);
      if (!yieldCount)
        fail("The original serving count is unknown for this old batch.");
      for (const lot of s.batches.filter(
        (x) => (x.originBatchId || x.id) === origin,
      )) {
        lot.cookedWeight = weight;
        lot.gramsPerPortion = weight / yieldCount;
        lot.yieldPortions = yieldCount;
      }
      break;
    }
    case "feedback": {
      if (!recipeMap[data.recipeId]) fail("Recipe not found.");
      s.feedback.push({
        id: randomUUID(),
        recipeId: data.recipeId,
        rating: enumValue(data.rating, ["love", "okay", "dislike"], "a rating"),
        effort: enumValue(
          data.effort || "right",
          ["easy", "right", "hard"],
          "effort",
        ),
        note: text(data.note),
        date: today(),
      });
      break;
    }
    case "log": {
      const type = enumValue(
        data.type,
        [
          "weight",
          "glucose",
          "steps",
          "workout",
          "waist",
          "sleep",
          "energy",
          "hba1c",
          "bloodPressure",
        ],
        "a measure",
      );
      const limits = {
        weight: [35, 300],
        glucose: [0.1, 1000],
        steps: [0, 100000],
        workout: [0, 5000],
        waist: [30, 300],
        sleep: [0, 24],
        energy: [1, 5],
        hba1c: [1, 200],
        bloodPressure: [40, 300],
      };
      const unit =
        type === "glucose"
          ? enumValue(data.unit, ["mg/dL", "mmol/L"], "a glucose unit")
          : type === "hba1c"
            ? enumValue(data.unit, ["%", "mmol/mol"], "an HbA1c unit")
            : {
                weight: "kg",
                steps: "steps",
                workout: "kcal",
                waist: "cm",
                sleep: "hours",
                energy: "/5",
                bloodPressure: "mmHg",
              }[type];
      const value = number(data.value, ...limits[type], "Reading");
      const log = {
        id: randomUUID(),
        date: validDate(data.date || today()),
        time: text(data.time || new Date().toISOString().slice(11, 16), 5),
        type,
        unit,
        value,
        note: text(data.note),
        timing:
          type === "glucose"
            ? enumValue(
                data.timing,
                ["before", "after", "fasting", "other"],
                "reading timing",
              )
            : null,
        minutesAfter:
          type === "glucose" && data.timing === "after"
            ? number(data.minutesAfter || 120, 1, 1440, "Minutes after eating")
            : null,
        diastolic:
          type === "bloodPressure"
            ? number(data.diastolic, 20, 200, "Diastolic reading")
            : null,
      };
      s.logs.push(log);
      break;
    }
    case "deleteLog":
      s.logs = s.logs.filter((l) => l.id !== data.id);
      break;
    case "food": {
      const name = text(data.name, 100);
      if (!name) fail("Enter a food or drink name.");
      const basis = enumValue(
          data.basis,
          ["100g", "portion"],
          "a nutrition basis",
        ),
        quantity = number(data.quantity, 0.1, 10000, "Amount eaten"),
        factor = basis === "100g" ? quantity / 100 : quantity,
        n = {};
      for (const key of ["kcal", "protein", "carbs", "fat", "fibre", "salt"]) {
        const value = data[key];
        n[key] =
          key !== "kcal" && (value === "" || value == null)
            ? null
            : number(value, 0, key === "kcal" ? 10000 : 1000, key) * factor;
      }
      s.foodLogs ??= [];
      s.foodLogs.push({
        id: randomUUID(),
        name,
        date: validDate(data.date || today()),
        quantity,
        basis,
        nutrition: n,
        source: text(data.source || "My estimate", 100),
      });
      break;
    }
    case "deleteFood":
      s.foodLogs = (s.foodLogs || []).filter((l) => l.id !== data.id);
      break;
    case "reset":
      Object.assign(s, freshState(), { revision: s.revision });
      break;
    default:
      fail("Unknown action.");
  }
  s.revision++;
  s.events.push({ action, at: new Date().toISOString() });
  s.events = s.events.slice(-100);
  return s;
}
export function viewState(s) {
  if (s.profile && s.plans.length) {
    const active = s.plans
      .filter((p) => p.status === "active")
      .sort((a, b) => b.start.localeCompare(a.start))[0];
    if (
      active &&
      today() >= addDays(active.start, 5) &&
      !s.plans.some((p) => p.start === addDays(active.start, 7))
    ) {
      try {
        generatePlan(s, addDays(active.start, 7), true);
      } catch {
        /* User can change constraints explicitly. */
      }
    }
  }
  return {
    ...s,
    catalog: recipes.map((r) => ({
      ...r,
      nutrition: recipeNutrition(r, 1, s.nutrition),
      allowed: s.profile ? recipeAllowed(s, r) : true,
    })),
    nutritionTargets: s.profile ? nutritionTargets(s.profile) : null,
    ingredients,
    plans: s.plans.map((p) => ({
      ...p,
      shopping: shopping(s, p),
      nutritionReport: s.profile ? planNutrition(s, p, planCost(s, p)) : null,
      sessions: sessionsFor(p, s.profile),
      shoppingTrips: s.profile
        ? shoppingTrips(s, p, priceOf, forecastStock(s, p.start))
        : [],
    })),
  };
}
export function getRecipe(s, id, m = 1) {
  const r = recipeMap[id];
  if (!r) fail("Recipe not found.");
  return adaptRecipeForEquipment(
    {
      ...r,
      multiplier: m,
      nutrition: recipeNutrition(r, m, s.nutrition),
      steps: detailedSteps(r, m),
      ingredients: r.items.map((i) => ({
        ...ingredientMap[i.id],
        quantity: Math.round(i.qty * m * 10) / 10,
        calculationQuantity: i.qty * m,
        nutrition: { ...(s.nutrition[i.id] || ingredientMap[i.id].nutrition) },
        nutritionSource: s.nutrition[i.id]
          ? "Your pack label"
          : ingredientMap[i.id].nutritionSource,
      })),
    },
    s.profile,
  );
}
export function recommend(s, query, slot = "dinner") {
  const terms = text(query)
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
  return recipes
    .filter((r) => r.slots.includes(slot) && recipeAllowed(s, r))
    .map((r) => ({
      id: r.id,
      title: r.title,
      score:
        terms.reduce(
          (n, t) =>
            n +
            Number(
              (
                r.title +
                " " +
                r.cuisine +
                " " +
                r.items.map((i) => ingredientMap[i.id].name).join(" ")
              )
                .toLowerCase()
                .includes(t),
            ) *
              3,
          0,
        ) + r.items.filter((i) => available(s, i.id) >= i.qty).length,
      uses: r.items
        .filter((i) => available(s, i.id) > 0)
        .map((i) => ingredientMap[i.id].name),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

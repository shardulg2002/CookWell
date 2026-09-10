import { randomUUID } from "node:crypto";
import {
  allocations,
  reserved,
  tidy,
  originalYield,
} from "../public/portions.js";
import { dayKey } from "../public/metrics.js";
const fail = (m) => {
  throw Object.assign(new Error(m), { status: 400 });
};
const amount = (v, max) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > max + 0.000001)
    fail("Enter a positive amount no larger than the portions available.");
  const result = tidy(Math.min(n, max));
  if (result <= 0) fail("The amount is too small to record.");
  return result;
};
export const expired = (b) =>
  b.expires < dayKey() || (b.safeUntil && Date.parse(b.safeUntil) < Date.now());
function setAllocations(m, list) {
  m.allocations = list.filter((a) => a.portions > 0.000001);
  if (m.allocations.length) m.batchId = m.allocations[0].batchId;
  else {
    delete m.batchId;
    delete m.allocations;
    delete m.batchYield;
    m.parentId = null;
  }
}
function split(state, b, portions) {
  b.yieldPortions ??= originalYield(state, b);
  if (Math.abs(portions - b.remaining) < 0.000001) return b;
  const moved = {
    ...b,
    id: randomUUID(),
    remaining: portions,
    originBatchId: b.originBatchId || b.id,
  };
  b.remaining = tidy(b.remaining - portions);
  let transfer = Math.max(0, reserved(state, b.id) - b.remaining);
  for (const m of state.plans
    .flatMap((p) => p.meals)
    .filter((m) => m.status === "planned")
    .reverse()) {
    const list = allocations(m).map((a) => ({ ...a }));
    const a = list.find((a) => a.batchId === b.id);
    if (!a || transfer <= 0.000001) continue;
    const n = Math.min(transfer, a.portions);
    a.portions = tidy(a.portions - n);
    list.push({ batchId: moved.id, portions: n });
    transfer = tidy(transfer - n);
    setAllocations(m, list);
  }
  state.batches.push(moved);
  return moved;
}
export function storeBatch(state, data) {
  let b = state.batches.find((b) => b.id === data.id);
  if (!b) fail("Batch not found.");
  const portions = amount(data.portions ?? b.remaining, b.remaining);
  if (data.operation === "waste") {
    b.yieldPortions ??= originalYield(state, b);
    b.remaining = tidy(b.remaining - portions);
    // Release future meal reservations until the physical stock covers them again.
    for (const m of state.plans
      .flatMap((p) => p.meals)
      .filter((m) => m.status === "planned")
      .reverse()) {
      if (reserved(state, b.id) <= b.remaining + 0.000001) break;
      if (allocations(m).some((a) => a.batchId === b.id)) setAllocations(m, []);
    }
    state.waste ??= [];
    state.waste.push({
      id: randomUUID(),
      date: dayKey(),
      batchId: b.id,
      recipeId: b.recipeId,
      portions,
      note: String(data.note || "").slice(0, 200),
    });
    return;
  }
  if (!["freeze", "thaw"].includes(data.operation))
    fail("Unknown storage operation.");
  if (expired(b))
    fail(
      "This food is past its recorded use-by. Do not extend it by changing storage.",
    );
  if (data.operation === "freeze") {
    if (b.location === "freezer") fail("These portions are already frozen.");
    if (b.thawedAt) fail("Do not refreeze this defrosted batch.");
    if (!state.profile.equipment.includes("freezer"))
      fail("Add a freezer in Settings first.");
  } else {
    if (b.location !== "freezer")
      fail("Only frozen portions can be defrosted.");
    if (!state.profile.equipment.includes("fridge"))
      fail("A fridge is required for this defrosting workflow.");
    if (!data.confirmed)
      fail("Confirm these portions are completely defrosted in the fridge.");
  }
  b = split(state, b, portions);
  b.location = data.operation === "freeze" ? "freezer" : "fridge";
  if (data.operation === "thaw") b.thawedAt = new Date().toISOString();
  b.safeUntil = new Date(
    Date.now() + (data.operation === "freeze" ? 720 : 24) * 3600000,
  ).toISOString();
  b.expires = dayKey(b.safeUntil);
}
export function eatPortion(state, meal, data) {
  if (meal.status !== "planned")
    fail("Already recorded as eaten, or not a planned meal.");
  const list = allocations(meal);
  if (!list.length) fail("Prepare the meal first.");
  const max = list.reduce((n, a) => n + a.portions, 0);
  const b = state.batches.find((b) => b.id === list[0].batchId);
  let portions;
  if (data.basis === "grams") {
    if (!b?.gramsPerPortion)
      fail("Record the cooked batch weight before logging grams.");
    portions = amount(Number(data.amount) / b.gramsPerPortion, max);
  } else portions = amount(data.amount ?? max, max);
  const ready = list
    .map((a) => ({ a, b: state.batches.find((b) => b.id === a.batchId) }))
    .filter(({ b }) => b && !expired(b) && b.location !== "freezer");
  if (
    ready.reduce((n, { a, b }) => n + Math.min(a.portions, b.remaining), 0) +
      0.000001 <
    portions
  )
    fail(
      "Not enough ready, in-date portions. Defrost the allocated food first, or record waste for expired food.",
    );
  const nutrition = {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fibre: 0,
    salt: 0,
  };
  let left = portions,
    grams = 0,
    known = true;
  for (const { a, b } of ready) {
    if (left <= 0.000001) break;
    const n = Math.min(left, a.portions, b.remaining);
    b.remaining = tidy(b.remaining - n);
    left = tidy(left - n);
    for (const k of Object.keys(nutrition)) nutrition[k] += b.nutrition[k] * n;
    if (b.gramsPerPortion) grams += b.gramsPerPortion * n;
    else known = false;
  }
  meal.status = "eaten";
  meal.eatenAt = new Date().toISOString();
  meal.eatenPortions = portions;
  meal.eatenGrams = known ? tidy(grams) : null;
  meal.actualNutrition = Object.fromEntries(
    Object.entries(nutrition).map(([k, v]) => [k, tidy(v)]),
  );
  // Any uneaten fraction remains real, unallocated kitchen stock.
}

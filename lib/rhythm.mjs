import { recipeMap, ingredientMap } from "./catalog.mjs";
import { yieldInfo } from "../public/portions.js";
import { dayKey } from "../public/metrics.js";
const addDays = (d, n) =>
  new Date(Date.parse(d + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
const distance = (a, b) =>
  Math.round(
    (Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000,
  );
export function cadence(profile) {
  if (profile.cooking !== "batch" || !profile.equipment.includes("fridge"))
    return 1;
  return Math.min(
    profile.cookEveryDays || 3,
    profile.equipment.includes("freezer") ? 3 : 2,
  );
}
export function batchFriendly(recipe, profile) {
  return !(
    cadence(profile) > 1 &&
    !profile.equipment.includes("freezer") &&
    recipe.items.some((i) => i.id === "rice")
  );
}
// Re-link only unprepared planned food. Cooked allocations and completed meals are immutable here.
export function arrangeBatches(plan, profile, from = plan.start) {
  plan.rhythmVersion = 1;
  const days = cadence(profile),
    groups = new Map();
  for (const m of plan.meals.filter(
    (m) => m.status === "planned" && !m.batchId && m.date >= from,
  )) {
    m.parentId = null;
    delete m.batchYield;
    const r = recipeMap[m.recipeId],
      offset = distance(plan.start, m.date);
    const block = Math.floor(offset / days) * days;
    // A user-requested rice swap without a freezer stays a same-day exception.
    const cookDate =
      !r.freshAssembly && batchFriendly(r, profile)
        ? addDays(plan.start, block)
        : m.date;
    m.cookDate = cookDate < from ? from : cookDate;
    const key = m.cookDate + ":" + m.recipeId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  for (const meals of groups.values()) {
    meals.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        ["breakfast", "lunch", "snack", "dinner"].indexOf(a.slot) -
          ["breakfast", "lunch", "snack", "dinner"].indexOf(b.slot),
    );
    const root = meals[0],
      mult =
        Math.round(
          (meals.reduce((n, m) => n + m.multiplier, 0) / meals.length) * 100,
        ) / 100;
    for (const m of meals) {
      m.parentId = m === root ? null : root.id;
      m.multiplier = mult;
    }
  }
}
export function storageAllocation(plan, meal, cookDate) {
  const y = yieldInfo(plan, meal),
    r = recipeMap[meal.recipeId],
    hasRice = r.items.some((i) => i.id === "rice");
  // Date-only plans conservatively freeze rice needed after cooking day, other dishes from day three.
  const limit = hasRice ? 0 : 1;
  const frozenMeals = y.group.filter((m) => distance(cookDate, m.date) > limit);
  return {
    portions: y.portions,
    fridge: y.group.length - frozenMeals.length,
    freeze: frozenMeals.length + (y.portions - y.group.length),
    uses: y.group.map((m) => ({
      id: m.id,
      date: m.date,
      slot: m.slot,
      storage: frozenMeals.includes(m) ? "freezer" : "fridge",
    })),
  };
}
export function sessionsFor(plan, profile, includeAssembly = false) {
  const sessions = new Map();
  for (const m of plan.meals.filter(
    (m) =>
      m.status === "planned" &&
      !m.batchId &&
      !m.parentId &&
      (includeAssembly || !recipeMap[m.recipeId].freshAssembly),
  )) {
    const date = m.cookDate || m.date;
    if (!sessions.has(date))
      sessions.set(date, {
        id: plan.id + ":" + date,
        date,
        dishes: [],
        activeMinutes: 0,
      });
    const s = sessions.get(date),
      r = recipeMap[m.recipeId],
      yieldData = yieldInfo(plan, m);
    s.dishes.push({
      mealId: m.id,
      recipeId: m.recipeId,
      title: r.title,
      method: r.method,
      multiplier: yieldData.multiplier,
      ...storageAllocation(plan, m, date),
    });
    s.activeMinutes += r.active;
  }
  return [...sessions.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function shoppingTrips(state, plan, priceOf, initialStock) {
  const interval = state.profile.shopEveryDays || 7,
    trips = new Map(),
    carry = {},
    lots = state.inventory.map((i) => ({ ...i }));
  // Reserve outstanding earlier plans from the earliest-expiring stock first.
  for (const id of new Set(lots.map((i) => i.ingredientId))) {
    const eligible = lots
      .filter(
        (i) => i.ingredientId === id && (!i.expires || i.expires >= dayKey()),
      )
      .sort((a, b) => (a.expires || "9999").localeCompare(b.expires || "9999"));
    let reserve = Math.max(
      0,
      eligible.reduce((n, i) => n + i.quantity, 0) - (initialStock[id] || 0),
    );
    for (const lot of eligible) {
      const qty = Math.min(reserve, lot.quantity);
      lot.quantity -= qty;
      reserve -= qty;
    }
  }
  for (const session of sessionsFor(plan, state.profile, true)) {
    const offset = Math.max(
        0,
        Math.floor(distance(plan.start, session.date) / interval) * interval,
      ),
      date = addDays(plan.start, offset);
    if (!trips.has(date))
      trips.set(date, {
        date,
        through: addDays(
          date,
          Math.min(interval - 1, 6 - distance(plan.start, date)),
        ),
        rows: new Map(),
      });
    const trip = trips.get(date),
      useDate = session.date < dayKey() ? dayKey() : session.date;
    for (const dish of session.dishes)
      for (const item of recipeMap[dish.recipeId].items) {
        const id = item.id,
          need = item.qty * dish.multiplier,
          p = priceOf(state, id);
        let remaining = need,
          actual = 0;
        for (const lot of lots
          .filter(
            (l) =>
              l.ingredientId === id && (!l.expires || l.expires >= useDate),
          )
          .sort((a, b) =>
            (a.expires || "9999").localeCompare(b.expires || "9999"),
          )) {
          const qty = Math.min(remaining, lot.quantity);
          lot.quantity -= qty;
          remaining -= qty;
          actual += qty;
        }
        const predicted = Math.min(remaining, carry[id] || 0);
        remaining -= predicted;
        const packs = Math.max(0, Math.ceil((remaining - 0.00001) / p.pack));
        carry[id] = Math.max(
          0,
          (carry[id] || 0) - predicted + packs * p.pack - remaining,
        );
        if (!trip.rows.has(id))
          trip.rows.set(id, {
            id,
            name: ingredientMap[id].name,
            unit: ingredientMap[id].unit,
            group: ingredientMap[id].group,
            need: 0,
            have: 0,
            haveActual: 0,
            packs: 0,
            cost: 0,
            price: p,
          });
        const row = trip.rows.get(id);
        row.need += need;
        row.have += actual + predicted;
        row.haveActual += actual;
        row.packs += packs;
        row.cost += packs * p.price;
      }
  }
  return [...trips.values()].map((t) => ({
    ...t,
    rows: [...t.rows.values()]
      .map((r) => ({
        ...r,
        need: Math.round(r.need * 10) / 10,
        have: Math.round(r.have * 10) / 10,
      }))
      .sort(
        (a, b) =>
          a.group.localeCompare(b.group) || a.name.localeCompare(b.name),
      ),
    total: [...t.rows.values()].reduce((n, r) => n + r.cost, 0),
  }));
}

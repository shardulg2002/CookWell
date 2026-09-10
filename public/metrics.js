// Pure calculations shared by the browser, server, and tests.
const ukDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" });
export const dayKey = (value = new Date()) => ukDate.format(new Date(value));
export function weightReference(height, weight, goal = "lose") {
  const area = (Number(height) / 100) ** 2;
  const round = (n) => Math.round(n * 10) / 10;
  const bmi = Number(weight) / area,
    min = 18.5 * area,
    max = 24.9 * area;
  return {
    bmi: round(bmi),
    min: round(min),
    max: round(max),
    suggested: round(
      goal === "lose" && bmi >= 25
        ? Math.max(Number(weight) * 0.95, max)
        : Number(weight),
    ),
  };
}
export function dailyIntake(state, date) {
  const keys = ["kcal", "protein", "carbs", "fat", "fibre", "salt"];
  const total = Object.fromEntries(keys.map((k) => [k, 0]));
  const planned = state.plans
    .flatMap((p) => p.meals)
    .filter((m) => m.date === date && !["skipped", "out"].includes(m.status));
  const eaten = state.plans
    .flatMap((p) => p.meals)
    .filter((m) => m.status === "eaten" && dayKey(m.eatenAt) === date);
  const extra = (state.foodLogs || []).filter((l) => l.date === date);
  const entries = [
    ...eaten.map((m) => ({
      id: m.id,
      name: state.catalog.find((r) => r.id === m.recipeId)?.title || "Meal",
      nutrition: m.actualNutrition,
      kind: "meal",
    })),
    ...extra.map((l) => ({ ...l, kind: "extra" })),
  ];
  let incomplete = false;
  for (const entry of entries)
    for (const k of keys) {
      if (entry.nutrition[k] == null) incomplete = true;
      else total[k] += entry.nutrition[k];
    }
  const plannedKcal = planned.reduce(
    (n, m) =>
      n +
      (state.catalog.find((r) => r.id === m.recipeId)?.nutrition.kcal || 0) *
        m.multiplier,
    0,
  );
  return {
    total,
    entries,
    incomplete,
    plannedKcal,
    eatenCount: eaten.length,
    extraCount: extra.length,
    remaining: state.profile.calorieTarget - total.kcal,
  };
}

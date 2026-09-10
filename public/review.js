import { dayKey } from "./metrics.js";
export function reviewSummary(state, plan) {
  const end = new Date(Date.parse(plan.start + "T12:00:00Z") + 6 * 86400000)
    .toISOString()
    .slice(0, 10);
  const within = (d) => d >= plan.start && d <= end;
  const eaten = plan.meals.filter((m) => m.status === "eaten");
  return {
    end,
    eaten: eaten.length,
    out: plan.meals.filter((m) => m.status === "out").length,
    spend: state.purchases
      .filter((p) => p.planId === plan.id)
      .reduce((n, p) => n + p.cost, 0),
    waste: (state.waste || [])
      .filter((w) => within(w.date))
      .reduce((n, w) => n + w.portions, 0),
    loggedDays: new Set([
      ...eaten.map((m) => dayKey(m.eatenAt)).filter(within),
      ...(state.foodLogs || [])
        .filter((f) => within(f.date))
        .map((f) => f.date),
    ]).size,
  };
}

export const tidy = (n) => Math.round(n * 1e6) / 1e6;
export function originalYield(state, batch) {
  if (batch.yieldPortions) return batch.yieldPortions;
  const origin = batch.originBatchId || batch.id;
  const lots = state.batches.filter(
    (b) => (b.originBatchId || b.id) === origin,
  );
  const ids = new Set(lots.map((b) => b.id));
  const eaten = state.plans
    .flatMap((p) => p.meals)
    .filter(
      (m) =>
        m.status === "eaten" && allocations(m).some((a) => ids.has(a.batchId)),
    )
    .reduce((n, m) => n + (m.eatenPortions ?? 1), 0);
  const waste = (state.waste || [])
    .filter((w) => ids.has(w.batchId))
    .reduce((n, w) => n + w.portions, 0);
  return tidy(lots.reduce((n, b) => n + b.remaining, 0) + eaten + waste);
}
export function allocations(meal) {
  return (
    meal.allocations ||
    (meal.batchId ? [{ batchId: meal.batchId, portions: 1 }] : [])
  );
}
export function reserved(state, batchId, extraPlan) {
  return [...state.plans, ...(extraPlan ? [extraPlan] : [])]
    .flatMap((p) => p.meals)
    .filter((m) => m.status === "planned")
    .reduce(
      (n, m) =>
        n +
        allocations(m)
          .filter((a) => a.batchId === batchId)
          .reduce((sum, a) => sum + a.portions, 0),
      0,
    );
}
export function freePortions(state, batch, extraPlan) {
  return tidy(batch.remaining - reserved(state, batch.id, extraPlan));
}
export function yieldInfo(plan, meal) {
  const root = plan.meals.find((m) => m.id === (meal.parentId || meal.id));
  const group = plan.meals.filter(
    (m) =>
      (m.id === root.id || m.parentId === root.id) &&
      m.status === "planned" &&
      !m.batchId,
  );
  const portions = Math.max(group.length, root.batchYield || 0, 1);
  return { root, group, portions, multiplier: root.multiplier * portions };
}
export function portionDescription(batch) {
  return batch.gramsPerPortion
    ? tidy(batch.gramsPerPortion) + " g per portion"
    : "Cooked weight not yet recorded";
}

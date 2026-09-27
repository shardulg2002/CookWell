import { equipmentIds } from "../public/preferences.js";
const fail = (message) => {
  throw Object.assign(new Error(message), { status: 400 });
};
export function equipmentInput(data) {
  if (
    !Array.isArray(data.equipment) ||
    data.equipment.some((x) => !equipmentIds.includes(x))
  )
    fail("Choose valid equipment.");
  const hobCount = Number(data.hobCount);
  if (!Number.isInteger(hobCount) || hobCount < 1 || hobCount > 4)
    fail("Choose 1–4 hob rings.");
  const hobType = data.hobType || "unspecified",
    hobScale = data.hobScale || "generic";
  if (
    !["unspecified", "induction", "electric", "gas"].includes(hobType) ||
    !["generic", "1-9"].includes(hobScale)
  )
    fail("Choose a supported hob type and scale.");
  const capacity =
    data.pressureCookerLitres === "" || data.pressureCookerLitres == null
      ? null
      : Number(data.pressureCookerLitres);
  if (
    capacity !== null &&
    (!Number.isFinite(capacity) || capacity < 0.5 || capacity > 30)
  )
    fail("Cooker capacity must be 0.5–30 litres.");
  return {
    equipment: [...new Set(data.equipment)],
    hobCount,
    hobType,
    hobScale,
    hobModel: String(data.hobModel || "")
      .trim()
      .slice(0, 100),
    pressureCookerModel: String(data.pressureCookerModel || "")
      .trim()
      .slice(0, 100),
    pressureCookerLitres: capacity,
  };
}
export function unusedPlan(state, plan) {
  return (
    !state.purchases.some((x) => x.planId === plan.id) &&
    !plan.meals.some((m) => m.status !== "planned" || m.batchId || m.eatenAt) &&
    !(state.reviews || []).some((r) => r.planId === plan.id)
  );
}

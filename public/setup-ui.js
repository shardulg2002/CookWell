import { equipmentOptions, equipmentNote } from "./preferences.js";
import { dayKey } from "./metrics.js";
import { mealMixOptions } from "./meal-mix.js";
export function createSetupUI({
  getState,
  chosenPlan,
  modal,
  mutate,
  esc,
  field,
  select,
  btn,
  onPlan,
}) {
  return {
    card() {
      return `<section class="card section"><h2>Kitchen & meal preferences</h2><p>Update appliances, main-meal variety or plan dates without changing your health goals.</p><div class="row">${btn("Edit equipment", "equipment-settings")}${btn("Meat & fish frequency", "meal-mix-settings", "", "outline")}${btn("Plan dates", "plan-dates", "", "outline")}</div></section>`;
    },
    click(action) {
      const s = getState(),
        p = s.profile;
      if (action === "meal-mix-settings") {
        modal(
          `<h2>What should your main meals look like?</h2><form id="meal-mix-form">${select("Meat / fish frequency", "mainMealMix", mealMixOptions, p.mainMealMix || "varied")}<p>Lunches and dinners count, including batch leftovers. “Most” aims for 9–12 of 14 main meals; “half” aims for 5–9. Eating-out/skipped slots reduce these counts. This is a preference, never an override of diet, allergens or dislikes. Your budget and nutrition gaps stay visible.</p><p>Saving changes future planning only. To update this week, use Plan → Preview a better-balanced week, then review and confirm. Cooked meals stay unchanged.</p><button class="btn">Save meal preference</button></form>`,
        );
        return true;
      }
      if (action === "equipment-settings") {
        modal(
          `<h2>Your kitchen equipment</h2><p>${esc(equipmentNote)}</p><form id="equipment-settings-form"><div class="checks">${equipmentOptions.map(([id, label]) => `<label class="check-label"><input type="checkbox" name="equipment" value="${esc(id)}" ${p.equipment.includes(id) ? "checked" : ""}>${esc(label)}</label>`).join("")}</div>${field("Available hob rings", "hobCount", "number", p.hobCount || 1, 'required min="1" max="4" step="1"')}${select(
            "Hob type",
            "hobType",
            [
              ["unspecified", "Not specified"],
              ["induction", "Induction"],
              ["electric", "Electric"],
              ["gas", "Gas"],
            ],
            p.hobType || "unspecified",
          )}${select(
            "Power scale",
            "hobScale",
            [
              ["generic", "Other / not sure"],
              ["1-9", "Levels 1–9"],
            ],
            p.hobScale || "generic",
          )}${field("Hob brand / model", "hobModel", "text", p.hobModel || "", 'maxlength="100"')}${field("Pressure cooker model", "pressureCookerModel", "text", p.pressureCookerModel || "", 'maxlength="100"')}${field("Pressure cooker litres", "pressureCookerLitres", "number", p.pressureCookerLitres || "", 'min="0.5" max="30" step="0.1"')}<p class="notice">Existing recipes will not be replaced. Check the compatibility warnings below after saving. Unprepared batches may be regrouped for storage; cooked food and health goals stay unchanged. Restart any open cooking walkthrough to use the new equipment guidance.</p><button class="btn">Save equipment</button></form>`,
        );
        return true;
      }
      if (action !== "plan-dates") return false;
      modal(
        `<h2>Choose your seven-day start</h2><p>Move only a week with no purchases, prepared/eaten meals, skipped meals or reviews. Otherwise create a new non-overlapping draft. Existing food, spending and health history are preserved.</p><form id="plan-dates-form">${select(
          "Action",
          "mode",
          [
            ["move", "Move an unused week"],
            ["new", "Create a new draft; keep existing weeks"],
          ],
          "move",
        )}${select(
          "Week to move (ignored for new draft)",
          "planId",
          s.plans.map((x) => [x.id, x.start + " · " + x.status]),
          chosenPlan()?.id,
        )}${field("New start date", "start", "date", dayKey(), `required min="${dayKey()}"`)}<label><input type="checkbox" name="confirmed" required>I understand this creates a draft requiring a stock check, and the seven days must not overlap another saved week</label><button class="btn">Apply plan dates</button></form>`,
      );
      return true;
    },
    async submit(form, data) {
      if (form.id === "meal-mix-form") {
        await mutate("mealMixSettings", { mainMealMix: data.mainMealMix });
        return true;
      }
      if (form.id === "equipment-settings-form") {
        await mutate("equipmentSettings", {
          ...data,
          equipment: new FormData(form).getAll("equipment"),
        });
        return true;
      }
      if (form.id !== "plan-dates-form") return false;
      if (
        await mutate("planDates", {
          ...data,
          confirmed: data.confirmed === "on",
        })
      )
        onPlan(getState().plans.find((p) => p.start === data.start)?.id);
      return true;
    },
    warnings() {
      const s = getState();
      const invalid = s.plans
        .flatMap((p) => p.meals)
        .filter(
          (m) =>
            m.date >= dayKey() &&
            m.status === "planned" &&
            !m.batchId &&
            s.catalog.find((r) => r.id === m.recipeId)?.allowed === false,
        );
      return invalid.length
        ? `<div class="notice warn"><strong>${invalid.length} unprepared meals no longer match your current preferences or equipment.</strong><p>Open Plan and swap these meals before cooking. Existing recipes were preserved.</p><ul>${invalid.map((m) => `<li>${esc(m.date)} · ${esc(m.slot)} · ${esc(s.catalog.find((r) => r.id === m.recipeId)?.title || m.recipeId)}</li>`).join("")}</ul></div>`
        : "";
    },
  };
}

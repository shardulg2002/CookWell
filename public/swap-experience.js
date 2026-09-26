import { macroKeys } from "./nutrition-targets.js";

const labels = {
  kcal: "Calories",
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fat",
  fibre: "Fibre",
  salt: "Salt",
};
const slotLabels = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snack",
  dinner: "Dinner",
};
const unit = (key) => (key === "kcal" ? "kcal" : "g");
const amount = (value) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value)
    : "Unknown";
const measured = (value, key) =>
  Number.isFinite(value) ? `${amount(value)} ${unit(key)}` : "Unknown";

function dayStatus(day, targets) {
  if (targets?.ready === false || day.assessment?.ready === false)
    return { style: "unknown", label: "Review your targets" };
  if (day.externalSlots || day.assessment?.complete === false)
    return { style: "unknown", label: "Day has unrecorded nutrition" };
  return day.assessment?.met
    ? { style: "met", label: "Planned day within ranges" }
    : { style: "attention", label: "Daily targets need attention" };
}

function targetLabel(key, target) {
  const range = target?.ranges?.[key];
  if (!range) return "Target not available";
  if (!Number.isFinite(range.max))
    return Number.isFinite(range.min)
      ? `Aim for at least ${measured(range.min, key)}`
      : "Target not available";
  if (!range.min) return `Limit ${measured(range.max, key)}`;
  return `Planning range ${amount(range.min)}–${measured(range.max, key)}`;
}

function checkLabel(key, check) {
  if (!check || check.status === "unknown") return "Incomplete amount";
  if (check.status === "unavailable") return "Target not available";
  if (check.status === "met")
    return key === "salt" ? "Within limit" : "Within planning range";
  if (check.status === "low")
    return check.gap > 0
      ? `${measured(check.gap, key)} below the minimum`
      : "Slightly below the minimum";
  if (check.status === "high")
    return check.gap > 0
      ? `${measured(check.gap, key)} above the limit`
      : "Slightly above the limit";
  return "Review amount";
}

/** Render only. Opening or dismissing this review never changes the plan. */
export function renderSwapPreview(preview, { esc, btn, cash, dateLabel }) {
  const { before, after, targets } = preview;
  const date = (value) => (value ? esc(dateLabel(value)) : "Not scheduled");
  const money = (value) =>
    Number.isFinite(value) ? esc(cash(value)) : "Not available";
  const difference = (value) =>
    !Number.isFinite(value)
      ? "Cost difference unavailable"
      : value > 0
        ? `${money(value)} more`
        : value < 0
          ? `${money(-value)} less`
          : "No grocery cost change";
  const status = dayStatus(after.day, targets);
  const gaps = macroKeys.filter((key) =>
    ["low", "high"].includes(after.day.assessment?.checks?.[key]?.status),
  );
  const compareDay = (oldDay, newDay) =>
    `<div class="stack">${macroKeys
      .map((key) => {
        const check = newDay.assessment?.checks?.[key];
        return `<div class="list-row row"><div><strong>${labels[key]}</strong><br><small>${esc(targetLabel(key, targets))}</small></div><div><span>Before ${esc(measured(oldDay.totals?.[key], key))}</span> → <strong>After ${esc(measured(newDay.totals?.[key], key))}</strong><br><small>${esc(checkLabel(key, check))}</small></div></div>`;
      })
      .join("")}</div>`;
  const batchDescription = (meal) => {
    if (meal.prepared)
      return `Already prepared · ${esc(amount(meal.allocatedPortions))} allocated portion${meal.allocatedPortions === 1 ? "" : "s"}${Number.isFinite(meal.servingGrams) ? ` · ${esc(amount(meal.servingGrams))} g` : ""}`;
    const batch = meal.batch;
    if (!batch) return "No cooking scheduled";
    return `${batch.freshAssembly ? "Assemble fresh" : "Cook"} on ${date(batch.cookDate)} · ${esc(amount(batch.portions))} serving${batch.portions === 1 ? "" : "s"}${batch.freshAssembly ? "" : `<br><small>${esc(amount(batch.fridge))} for the fridge · ${esc(amount(batch.freeze))} for the freezer</small>`}`;
  };
  const additionalDays = (preview.affectedDays || []).filter(
    (entry) => entry.date !== preview.date,
  );
  const warnings = [...new Set(preview.warnings || [])];
  const released = preview.releasedPortions || [];
  return `<div class="swap-preview">
    <p class="eyebrow">REVIEW CHANGE · ${esc(slotLabels[preview.slot] || preview.slot)} · ${date(preview.date)}</p>
    <h2>${esc(after.meal.title)}</h2>
    <p class="intro">Replaces ${esc(before.meal.title)}. Nothing changes until you confirm.</p>
    <h3>Your new serving</h3>
    <div class="nutrition" aria-label="Estimated nutrients in the new serving">${macroKeys.map((key) => `<div><strong>${esc(amount(after.meal.nutrition?.[key]))}</strong><small>${labels[key]} · ${unit(key)}</small></div>`).join("")}</div>
    <p class="hint">Nutrition is estimated for one planned serving, using its measured ingredients. This preview is not food logged as eaten.</p>
    <section class="cw-nutrition-budget ${after.budget.within ? "met" : "attention"}" aria-label="Weekly grocery cost impact"><div><span>Weekly groceries · full packs</span><strong>${money(before.budget.total)} → ${money(after.budget.total)}</strong><span>${difference(preview.deltas?.cost)} · ${money(after.budget.limit)} budget</span></div><p>Includes ${money(after.budget.spent)} already purchased and ${money(after.budget.shopping)} still needed after this change.</p></section>
    <div class="row between"><h3>${date(preview.date)} after this change</h3><span class="cw-nutrition-status ${status.style}">${status.label}</span></div>
    ${gaps.length ? `<ul class="cw-nutrition-warnings" aria-label="Daily target gaps">${gaps.map((key) => `<li><strong>${labels[key]}:</strong> ${esc(checkLabel(key, after.day.assessment.checks[key]))}.</li>`).join("")}</ul>` : ""}
    ${warnings.length ? `<ul class="cw-nutrition-warnings" aria-label="Things to review before changing">${warnings.map((message) => `<li>${esc(message)}</li>`).join("")}</ul>` : ""}
    <details><summary>Compare all daily nutrients</summary><p class="hint">Before → after for the planned day, including saved nutrition for prepared food. Unknown food cannot confirm target coverage.</p>${compareDay(before.day, after.day)}</details>
    <details><summary>Cooking dates and batch servings</summary><div class="stack"><div><p class="eyebrow">BEFORE · ${esc(before.meal.title)}</p><p>${batchDescription(before.meal)}</p></div><div><p class="eyebrow">AFTER · ${esc(after.meal.title)}</p><p>${batchDescription(after.meal)}</p></div></div>${
      (preview.changedMeals || []).filter((meal) => meal.id !== preview.mealId)
        .length
        ? `<p class="hint">Other meal allocations change with the batch:</p><div class="stack">${preview.changedMeals
            .filter((meal) => meal.id !== preview.mealId)
            .map(
              (meal) =>
                `<p>${date(meal.date)} · ${esc(slotLabels[meal.slot] || meal.slot)} · ${esc(meal.after.title)}<br><small>${batchDescription(meal.after)}</small></p>`,
            )
            .join("")}</div>`
        : ""
    }</details>
    ${released.length ? `<details><summary>Prepared food stays in your kitchen</summary><p>Changing the plan releases these portions for another meal; it does not throw them away or refund their cost.</p><div class="stack">${released.map((batch) => `<p><strong>${esc(batch.title)}</strong> · ${esc(amount(batch.portions))} portion${batch.portions === 1 ? "" : "s"}<br><small>${esc(batch.location || "Kitchen")} · use by ${date(batch.expires)}</small></p>`).join("")}</div></details>` : ""}
    ${
      additionalDays.length
        ? `<details><summary>Other affected days (${additionalDays.length})</summary>${additionalDays
            .map((entry) => {
              const daily = dayStatus(entry.after, targets);
              return `<section class="section"><div class="row between"><h3>${date(entry.date)}</h3><span class="cw-nutrition-status ${daily.style}">${daily.label}</span></div>${compareDay(entry.before, entry.after)}</section>`;
            })
            .join("")}</details>`
        : ""
    }
    <details><summary>Exact ingredients for your new serving</summary>${(after.meal.ingredients || []).map((ingredient) => `<div class="ingredient"><strong>${esc(amount(ingredient.quantity))} ${esc(ingredient.unit)}</strong><div>${esc(ingredient.name)}</div></div>`).join("")}</details>
    <div class="row section">${btn("Confirm meal change", "confirm-swap", `type="button" data-id="${esc(preview.mealId)}" data-recipe="${esc(preview.recipeId)}"`)}${btn("Choose another meal", "swap", `type="button" data-id="${esc(preview.mealId)}"`, "outline")}</div>
  </div>`;
}

import { dayKey } from "./metrics.js";
import {
  nutritionTargets,
  validateNutritionSettings,
  macroKeys,
} from "./nutrition-targets.js";

const labels = {
  kcal: "Calories",
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fat",
  fibre: "Fibre",
  salt: "Salt",
};
const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const number = (value) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value)
    : "—";
const unit = (key) => (key === "kcal" ? "kcal" : "g");
const targetsFor = (state) =>
  state.nutritionTargets || nutritionTargets(state.profile);
const shortDate = (date) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
const countExternal = (day) =>
  Array.isArray(day.externalSlots)
    ? day.externalSlots.length
    : Number(day.externalSlots) || 0;

function targetText(targets, key) {
  const value = targets.values?.[key];
  if (!Number.isFinite(value)) return "target needed";
  return `${key === "salt" ? "max " : ""}${number(value)} ${unit(key)}`;
}

function rangeText(targets, key) {
  const range = targets.ranges?.[key];
  if (!range) return "";
  if (!Number.isFinite(range.max))
    return Number.isFinite(range.min)
      ? `At least ${number(range.min)} ${unit(key)}`
      : "";
  if (!Number.isFinite(range.min) || range.min === 0)
    return `Up to ${number(range.max)} ${unit(key)}`;
  return `${number(range.min)}–${number(range.max)} ${unit(key)} planning range`;
}

function targetTiles(targets) {
  return `<div class="cw-nutrient-grid">${macroKeys
    .map(
      (key) =>
        `<div class="cw-nutrient-tile"><span>${labels[key]}</span><strong>${targetText(targets, key)}</strong><small>${rangeText(targets, key)}</small></div>`,
    )
    .join("")}</div>`;
}

function warningList(warnings = []) {
  return warnings.length
    ? `<ul class="cw-nutrition-warnings">${[...new Set(warnings)]
        .map((message) => `<li>${escapeHTML(message)}</li>`)
        .join("")}</ul>`
    : "";
}

function sourceLinks(sources = []) {
  return sources
    .filter((source) => /^https:\/\//.test(source.url || ""))
    .map(
      (source) =>
        `<a href="${escapeHTML(source.url)}" target="_blank" rel="noreferrer">${escapeHTML(source.title)} ↗</a>`,
    )
    .join("");
}

function methodology(targets) {
  return `<details class="cw-nutrition-method" data-nutrition-method><summary>How your targets are calculated</summary><ul>${(
    targets.methodology || []
  )
    .map((line) => `<li>${escapeHTML(line)}</li>`)
    .join(
      "",
    )}</ul><p>Planning ranges allow practical food portions. They do not mean every gram must match exactly. Recipe nutrition is an estimate; the label on your ingredients improves it.</p><div class="cw-nutrition-sources">${sourceLinks(targets.sources)}</div></details>`;
}

function dayStatus(day, targets) {
  if (!targets.ready || day.assessment?.ready === false)
    return { text: "Target setup needed", status: "unknown" };
  if (countExternal(day) || day.assessment?.complete === false)
    return { text: "Incomplete day", status: "unknown" };
  if (day.assessment?.met) return { text: "Within targets", status: "met" };
  return { text: "Needs adjustment", status: "attention" };
}

/** Actual food diary totals only. An empty/partial diary never reports success. */
export function macroProgress(state, date, dailyIntakeResult) {
  if (!state.profile) return "";
  const targets = targetsFor(state),
    diary = dailyIntakeResult,
    entries = diary.entries || [],
    empty = entries.length === 0;
  return `<section class="cw-macro-progress" aria-label="Recorded nutrients for ${escapeHTML(date)}"><div class="cw-nutrition-subhead"><h3>Recorded nutrients / daily targets</h3><button class="link" data-action="nutrition-settings">Edit targets</button></div><div class="cw-nutrient-grid">${macroKeys
    .filter((key) => key !== "kcal")
    .map((key) => {
      const actual = diary.total?.[key],
        target = targets.values?.[key],
        partial = entries.some((entry) => entry.nutrition?.[key] == null),
        hasKnown = entries.some((entry) =>
          Number.isFinite(entry.nutrition?.[key]),
        ),
        available = Number.isFinite(target) && target > 0,
        percent =
          available && !empty && Number.isFinite(actual)
            ? Math.min(100, Math.max(0, (actual / target) * 100))
            : 0,
        over = key === "salt" && available && actual > target;
      return `<div class="cw-nutrient-tile${over ? " cw-nutrient-over" : ""}"><span>${labels[key]}</span><strong>${empty || !hasKnown ? "—" : number(actual)} <small>/ ${targetText(targets, key)}</small></strong><div class="cw-nutrient-meter" aria-hidden="true"><i style="width:${percent}%"></i></div><small>${empty ? "Nothing recorded" : !hasKnown ? "Nutrient amounts not provided" : over ? "Above daily salt limit" + (partial ? " · partial total" : "") : partial ? "Partial · some entries lack this nutrient" : "Recorded so far"}</small></div>`;
    })
    .join(
      "",
    )}</div><p class="hint">${empty ? "Log what you eat to see progress. Your meal plan is not counted as food eaten." : "Only confirmed meals and your food diary entries count here. Unlogged food is missing, not zero intake."}</p>${entries.some((entry) => macroKeys.some((key) => entry.nutrition?.[key] == null)) ? '<p class="hint">Partial totals cannot confirm whether you have met your targets.</p>' : ""}</section>`;
}

export function createNutritionUI({
  getState,
  chosenPlan,
  modal,
  mutate,
  esc = escapeHTML,
  btn,
  field,
  select,
  cash,
}) {
  function cards(screen) {
    const state = getState();
    if (!state.profile) return "";
    const targets = targetsFor(state),
      chosen = chosenPlan();
    if (screen === "settings")
      return `<section class="card section cw-nutrition-card"><div class="section-head"><div><p class="eyebrow">YOUR DAILY NUTRITION BUDGET</p><h2>Targets your plan works towards.</h2><p>Calculated from your profile and selected approach. Your food diary tracks what you actually eat.</p></div>${btn("Edit nutrition targets", "nutrition-settings", "", "outline")}</div>${targetTiles(targets)}${warningList(targets.warnings)}${methodology(targets)}</section>`;
    if (screen === "today") {
      const date = dayKey(),
        plan = chosen?.nutritionReport?.days?.some((day) => day.date === date)
          ? chosen
          : state.plans?.find((item) =>
              item.nutritionReport?.days?.some((day) => day.date === date),
            ),
        day = plan?.nutritionReport?.days?.find((item) => item.date === date);
      if (!day) return "";
      const status = dayStatus(day, targets);
      return `<section class="card section cw-nutrition-card"><div class="section-head"><div><p class="eyebrow">TODAY'S PLANNED NUTRIENTS</p><h2>Your menu against your targets.</h2></div><span class="cw-nutrition-status ${status.status}">${status.text}</span></div><div class="cw-nutrient-grid">${macroKeys
        .map(
          (key) =>
            `<div class="cw-nutrient-tile"><span>${labels[key]}</span><strong>${number(day.totals?.[key])} <small>/ ${targetText(targets, key)}</small></strong><small>Planned${countExternal(day) ? " · partial day" : ""}</small></div>`,
        )
        .join(
          "",
        )}</div><p class="hint">${countExternal(day) ? "Eating-out or skipped slots are not included. The full day cannot be assessed until those meals are accounted for." : "These are the planned portions. Your food diary below shows what you actually ate."}</p><div class="row section">${btn("Check full week", "nav", 'data-screen="plan"', "outline")}${btn("Edit targets", "nutrition-settings", "", "soft")}</div></section>`;
    }
    if (screen !== "plan" || !chosen) return "";
    const report = chosen.nutritionReport;
    if (!report)
      return `<section class="notice section cw-nutrition-card"><strong>Review this week's nutrition targets.</strong><p>Set your targets, then preview an updated plan for the meals you have not prepared.</p>${btn("Edit targets", "nutrition-settings", "", "outline")}</section>`;
    const days = report.days || [],
      completeDays = days.filter(
        (day) => dayStatus(day, targets).status === "met",
      ).length,
      budget = report.budget;
    return `<section class="card section cw-nutrition-card"><div class="section-head"><div><p class="eyebrow">NUTRITION & BUDGET CHECK</p><h2>${completeDays} of ${days.length} days within targets.</h2><p>Each day is checked separately. A weekly average can hide a day that misses your needs.</p></div>${btn("Edit targets", "nutrition-settings", "", "outline")}</div>${budget ? `<div class="cw-nutrition-budget ${budget.within ? "met" : "attention"}"><div><strong>${cash(budget.total)} / ${cash(budget.limit)}</strong><span>Projected grocery spend · full packs${budget.within ? " · within budget" : " · over budget"}</span></div><p>Uses your recorded prices and available stock. Eating out is separate.</p></div>` : ""}<p class="hint cw-table-hint">Daily planned amounts. Scroll across on smaller screens to see every nutrient.</p><div class="cw-nutrition-table-wrap" tabindex="0" role="region" aria-label="Weekly planned nutrition comparison"><table class="cw-nutrition-table"><caption>Planned nutrients compared with your daily targets</caption><thead><tr><th scope="col">Day</th>${macroKeys.map((key) => `<th scope="col">${labels[key]}<small>${targetText(targets, key)}</small></th>`).join("")}<th scope="col">Day check</th></tr></thead><tbody>${days
      .map((day) => {
        const status = dayStatus(day, targets);
        return `<tr><th scope="row">${esc(shortDate(day.date))}${countExternal(day) ? "<small>Incomplete menu</small>" : ""}</th>${macroKeys
          .map((key) => {
            const check = day.assessment?.checks?.[key],
              marker =
                check?.status === "low"
                  ? "Below range"
                  : check?.status === "high"
                    ? "Above range"
                    : check?.status === "unavailable"
                      ? "Target needed"
                      : "";
            return `<td${marker ? ' class="cw-nutrient-attention"' : ""}>${number(day.totals?.[key])} ${unit(key)}${marker ? `<small>${marker}</small>` : ""}</td>`;
          })
          .join(
            "",
          )}<td><span class="cw-nutrition-status ${status.status}">${status.text}</span></td></tr>`;
      })
      .join(
        "",
      )}</tbody></table></div>${warningList(report.warnings)}<p class="hint">Eating-out and skipped slots leave gaps. Prepared food and recorded meals stay as they are when you rebalance; some days may therefore remain outside your targets. Values are estimates from measured ingredients.</p><div class="row section">${btn("Preview a better-balanced week", "rebalance-plan", `data-id="${esc(chosen.id)}"`)}${btn("Review shopping list", "nav", 'data-screen="kitchen"', "outline")}</div>${methodology(targets)}</section>`;
  }

  function settings() {
    const state = getState(),
      targets = targetsFor(state),
      saved = targets.settings,
      custom = saved.mode === "custom";
    modal(
      `<p class="eyebrow">PERSONAL NUTRITION TARGETS</p><h2>Build your daily nutrition budget.</h2><p class="intro">Your age, height, weight, activity and goal set the calorie estimate. Your nutrition approach divides that energy between protein, carbohydrates and fat.</p><form id="nutrition-settings-form">${select(
        "Nutrition approach",
        "mode",
        [
          ["balanced", "Balanced"],
          ["moderate", "Moderate carbohydrate"],
          ["custom", "Custom targets"],
        ],
        saved.mode,
      )}${select(
        "Kidney health / protein advice",
        "proteinSafety",
        [
          ["unknown", "Not answered / unsure"],
          ["none", "No known kidney disease or protein restriction"],
          ["restricted", "Kidney disease or advised to limit protein"],
        ],
        saved.proteinSafety,
      )}<p class="hint">This answer affects the protein calculation. If your protein is restricted, enter the target agreed with your clinician.</p>${select(
        "Protein shakes",
        "shakes",
        [
          ["never", "Do not include shakes"],
          ["optional", "Optional, only when useful"],
          ["daily", "Prefer a shake each day"],
        ],
        saved.shakes,
      )}<p class="hint">Shakes are optional foods. The planner also considers protein from ordinary meals, your preferences and the cost of a whole pack.</p><fieldset class="cw-custom-targets" data-custom-targets ${custom ? "" : "hidden disabled"}><legend>Custom daily targets</legend><p class="hint">Use grams per day. Protein and carbohydrate supply about 4 kcal per gram; fat supplies about 9. These targets should fit your calorie budget.</p><div class="fields">${["protein", "carbs", "fat", "fibre", "salt"].map((key) => field(`${labels[key]} (${key === "salt" ? "daily maximum, " : ""}g)`, key, "number", saved[key] ?? targets.values?.[key] ?? "", 'required min="0" max="1000" step="0.1"')).join("")}</div></fieldset><section class="cw-nutrition-preview" data-nutrition-preview aria-live="polite">${targetTiles(targets)}${warningList(targets.warnings)}</section><p class="error" data-nutrition-preview-error role="alert"></p><p class="hint">Saving targets updates future planning. Review the current week, then use its preview button to rebalance meals you have not prepared.</p><button class="btn">Save nutrition targets</button>${methodology(targets)}</form>`,
    );
  }

  function update(form) {
    if (form?.id !== "nutrition-settings-form") return false;
    const custom = form.elements.mode.value === "custom",
      fields = form.querySelector("[data-custom-targets]");
    fields.hidden = !custom;
    fields.disabled = !custom;
    const raw = Object.fromEntries(new FormData(form));
    try {
      const settings = validateNutritionSettings(getState().profile, raw),
        targets = nutritionTargets({
          ...getState().profile,
          nutritionSettings: settings,
        });
      form.querySelector("[data-nutrition-preview]").innerHTML =
        targetTiles(targets) + warningList(targets.warnings);
      form.querySelector("[data-nutrition-method]").outerHTML =
        methodology(targets);
      form.querySelector("[data-nutrition-preview-error]").textContent = "";
    } catch (error) {
      form.querySelector("[data-nutrition-preview]").innerHTML =
        '<p class="hint">Complete valid targets to see the updated calculation.</p>';
      form.querySelector("[data-nutrition-method]").hidden = true;
      form.querySelector("[data-nutrition-preview-error]").textContent =
        error.message;
    }
    return true;
  }

  function click(action) {
    if (action !== "nutrition-settings") return false;
    settings();
    return true;
  }

  async function submit(form, data) {
    if (form.id !== "nutrition-settings-form") return false;
    const settings = validateNutritionSettings(getState().profile, data);
    await mutate("nutritionSettings", settings);
    return true;
  }

  return { cards, click, submit, update };
}

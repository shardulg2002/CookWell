import { dailyIntake, dayKey, weightReference } from "./metrics.js";
import { macroProgress } from "./nutrition-ui.js";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const round = (n) => Math.round(n);
export function dailyCard(state, date = dayKey(), compact = false) {
  const d = dailyIntake(state, date),
    target = state.profile.calorieTarget;
  return `<section class="card section calorie-card"><div class="section-head"><div><p class="eyebrow">DAILY FOOD DIARY · UK TIME</p><h2>${compact ? "What you've eaten today." : "Every meal counts."}</h2></div>${compact ? "" : `<label class="diary-date">View day<input id="intake-date" type="date" value="${date}" aria-label="Food diary date"></label>`}</div>
 <div class="calorie-summary"><div><strong>${d.entries.length ? round(d.total.kcal) : "—"}</strong><span>kcal recorded</span></div><div><strong>${target}</strong><span>daily target</span></div><div><strong>${d.entries.length ? round(Math.abs(d.remaining)) : "—"}</strong><span>${d.remaining < 0 ? "above target" : "remaining"}</span></div></div>
 <div class="bar"><i style="width:${Math.min(100, (d.total.kcal / target) * 100)}%"></i></div><p class="hint">${round(d.plannedKcal)} kcal on the plan · ${d.eatenCount} planned meals eaten · ${d.extraCount} other entries. Unlogged food is missing, not zero intake. Exercise does not automatically increase this target.</p>
 <div class="row section"><button class="btn" data-action="food-log">+ Food or drink</button>${compact ? '<button class="link" data-action="nav" data-screen="progress">Open food diary →</button>' : ""}</div>
 ${macroProgress(state, date, d)}${
   compact
     ? ""
     : `<div class="section stack">${d.entries.map((e) => `<div class="list-row"><div><strong>${esc(e.name)}</strong><small class="source">${e.kind === "meal" ? "Measured recipe portion" : esc(e.quantity + " × " + (e.basis === "100g" ? "g" : "portion") + " · " + e.source)}</small></div><span>${round(e.nutrition.kcal)} kcal</span>${e.kind === "extra" ? `<button class="link" data-action="delete-food" data-id="${e.id}">Remove</button>` : ""}</div>`).join("") || '<p class="muted">Nothing recorded for this day yet.</p>'}</div>`
 }
 </section>`;
}
export function weightCard(state) {
  const p = state.profile,
    logs = state.logs
      .filter((l) => l.type === "weight")
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    latest = logs.at(-1),
    current = latest?.value || p.weight,
    r = weightReference(p.height, current, p.goal),
    target =
      p.targetWeight || weightReference(p.height, p.weight, p.goal).suggested,
    change = p.weight - current;
  return `<section class="card section"><div class="section-head"><div><p class="eyebrow">YOUR WEIGHT JOURNEY</p><h2>A milestone, not a finish line.</h2></div><button class="link" data-action="onboarding">Edit goal</button></div><div class="calorie-summary"><div><strong>${current} kg</strong><span>${latest ? "latest logged weight" : "onboarding weight"}</span></div><div><strong>${r.bmi}</strong><span>current BMI</span></div><div><strong>${target} kg</strong><span>your editable target</span></div></div><p class="section">${Math.abs(Math.round(change * 10) / 10)} kg ${change >= 0 ? "down" : "up"} from your starting weight · ${Math.max(0, Math.round((current - target) * 10) / 10)} kg above your target.</p><div class="notice section"><strong>General adult BMI reference: ${r.min}–${r.max} kg at ${p.height} cm.</strong><p>Calculated from BMI 18.5–24.9. This is not a personalised ideal-weight prescription. BMI does not distinguish muscle from fat; risk thresholds can be lower for some ethnic backgrounds. Pregnancy and some medical conditions need a different assessment.</p></div><p class="hint section">The suggested first milestone uses about 5% weight loss when BMI is at least 25, stopping at the top of the general reference range. It does not promise diabetes remission. Review your goal with your diabetes team.</p><div class="row section"><a class="link" href="https://www.nhs.uk/conditions/overweight-and-obesity/" target="_blank" rel="noreferrer">BMI context ↗</a><a class="link" href="https://www.diabetes.org.uk/living-with-diabetes/eating/whats-your-healthy-weight/lose-weight" target="_blank" rel="noreferrer">Weight & diabetes ↗</a></div></section>`;
}

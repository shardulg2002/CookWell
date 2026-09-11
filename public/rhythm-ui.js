import { dayKey } from "./metrics.js";
export function createRhythmUI({
  getState,
  chosenPlan,
  modal,
  mutate,
  esc,
  btn,
  field,
  select,
  cash,
}) {
  const days = (p) =>
    p.cooking === "daily" || !p.equipment.includes("fridge")
      ? 1
      : Math.min(p.cookEveryDays || 3, p.equipment.includes("freezer") ? 3 : 2);
  function cards(screen) {
    const s = getState(),
      p = chosenPlan();
    if (!p) return "";
    const sessions = p.sessions || [],
      count = days(s.profile);
    if (!["today", "plan", "kitchen"].includes(screen)) return "";
    if (screen === "kitchen")
      return `<section class="notice rhythm-notice"><strong>Shopping rhythm: ${s.profile.shopEveryDays === 7 || !s.profile.shopEveryDays ? "once a week" : "every " + s.profile.shopEveryDays + " days"}</strong><p>Choose the full weekly list or a planned trip below. Buy enough for each cooking session; check use-by dates and freeze suitable raw ingredients if needed. Later-trip quantities assume earlier planned purchases happen.</p>${btn("Change cooking & shopping rhythm", "rhythm-settings", "", "outline")}</section>`;
    const shown = screen === "today" ? sessions.slice(0, 1) : sessions;
    return `<section class="section cooking-sessions"><div class="section-head"><div><p class="eyebrow">COOK ONCE, EAT SEVERAL TIMES</p><h2>${screen === "today" ? "Your next cooking session" : "Your cooking days"}</h2><p>${count === 1 ? "Fresh preparation each day" : "Cook every " + count + " days; reheat / assemble between sessions"}. Batch sessions can take longer than a single meal's active time.</p></div>${btn("Set my rhythm", "rhythm-settings", "", "outline")}</div>${!p.rhythmVersion ? '<p class="notice">This week uses the earlier plan format. Choose “Set my rhythm” to group its uneaten meals into cooking sessions without replacing your recipes or cooked food.</p>' : ""}<div class="session-grid">${shown.map((session) => `<article class="card session-card"><p class="eyebrow">${session.date}${session.date < dayKey() ? " · overdue preparation" : ""}</p>${session.date < dayKey() ? '<p class="notice">These meals were planned earlier and are not marked prepared. Skip missed meals in Plan, or open a recipe if you still want to make it. Storage counts are recalculated when you confirm preparation today.</p>' : ""}<h3>${session.dishes.length} dishes · ${session.dishes.reduce((n, d) => n + d.portions, 0)} servings</h3><p class="hint">About ${session.activeMinutes} active minutes in total, before any overlap or batch-size adjustment. No promise that extra portions take the same time.</p><ul>${session.dishes.map((d) => `<li><strong>${esc(d.title)}</strong> — make ${d.portions}<small>${d.fridge} fridge / same-day · ${d.freeze} freeze for later</small></li>`).join("")}</ul>${btn("Start cooking session →", "cook-session", `data-id="${session.id}"`)}</article>`).join("") || '<div class="notice">No unprepared dishes left in this week. Use your cooked portions in Kitchen.</div>'}</div></section>`;
  }
  function settings() {
    const p = getState().profile;
    modal(
      `<p class="eyebrow">LESS DAILY COOKING</p><h2>A rhythm that fits your week.</h2><form id="rhythm-form">${select(
        "Cooking style",
        "cooking",
        [
          ["batch", "Cook in batches"],
          ["daily", "Cook fresh daily"],
        ],
        p.cooking,
      )}${select(
        "Batch cooking interval",
        "cookEveryDays",
        [
          [3, "Every 3 days"],
          [2, "Every 2 days"],
        ],
        p.cookEveryDays || 3,
      )}${select(
        "Shopping interval",
        "shopEveryDays",
        [
          [7, "Once a week"],
          [3, "Every 3 days"],
          [2, "Every 2 days"],
        ],
        p.shopEveryDays || 7,
      )}${field("Hob rings you can use at once", "hobCount", "number", p.hobCount || 1, 'required min="1" max="4" step="1"')}<p class="notice">With only a fridge, we use at most 2-day batches and avoid repeated rice batches in new plans. With no fridge, preparation stays daily. For 3-day batches, later portions are earmarked for the freezer. Tell us the hob count so multitasking does not overbook your kitchen.</p><p class="hint">Applies to this week's unprepared meals and future plans. Existing recipes, purchases and cooked portions stay intact. Changed / skipped meals automatically recalculate serving counts. A recipe swap without enough storage may require an extra cooking day.</p><button class="btn">Save rhythm & regroup this week</button></form>`,
    );
  }
  function click(a) {
    if (a !== "rhythm-settings") return false;
    settings();
    return true;
  }
  async function submit(f, d) {
    if (f.id !== "rhythm-form") return false;
    await mutate("rhythm", { ...d, planId: chosenPlan().id });
    return true;
  }
  return { cards, click, submit };
}

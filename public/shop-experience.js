import { dayKey } from "./metrics.js";
import { portionDescription } from "./portions.js";

const tidy = (n) => Math.round(Number(n || 0) * 10) / 10;
const amount = (v) =>
  v !== "" && v != null && Number.isFinite(Number(v)) && Number(v) >= 0;
export function shoppingPrice(row) {
  const known = amount(row.price?.price);
  return {
    known,
    total: known
      ? amount(row.cost)
        ? Number(row.cost)
        : Number(row.price.price) * row.packs
      : null,
    source: row.price?.source || "Price source not recorded",
    checkedAt: row.price?.checkedAt || null,
  };
}
export function shoppingCoverage(row) {
  const actual =
    row.haveActual == null ? Number(row.have || 0) : Number(row.haveActual);
  return {
    actual: tidy(actual),
    forecast: tidy(Math.max(0, Number(row.have || 0) - actual)),
  };
}

export function createShopExperience(ctx) {
  const { getState, chosenPlan, esc, btn, cash, dateLabel, modal, mutate } =
    ctx;
  let tab = "buy",
    selected = new Set(),
    draft = null,
    previousState,
    contextKey = "",
    saving = false;
  function current() {
    const state = getState(),
      plan = chosenPlan(),
      tripDate = ctx.getTripDate() || "";
    const key = `${state?.revision ?? ""}|${plan?.id || ""}|${tripDate}`;
    if (previousState !== state || key !== contextKey) {
      selected = new Set();
      draft = null;
      previousState = state;
      contextKey = key;
    }
    const trip = plan?.shoppingTrips?.find((t) => t.date === tripDate);
    return {
      state,
      plan,
      tripDate,
      rows: tripDate && trip ? trip.rows : plan?.shopping || [],
      key,
    };
  }
  const sourceText = (r) => {
    const p = shoppingPrice(r);
    return `${p.known ? p.source : "Price needed — check your pack or receipt"}${p.checkedAt ? " · " + p.checkedAt : ""}`;
  };
  function totalLabel(rows) {
    const prices = rows.map(shoppingPrice),
      missing = prices.filter((p) => !p.known).length;
    const known = prices.reduce((n, p) => n + (p.total || 0), 0);
    return missing
      ? `${cash(known)} known + ${missing} unpriced item${missing === 1 ? "" : "s"}`
      : `${cash(known)} estimated`;
  }
  const option = (value, label, chosen) =>
    `<option value="${esc(value)}" ${value === chosen ? "selected" : ""}>${esc(label)}</option>`;
  function line(row) {
    const coverage = shoppingCoverage(row),
      price = shoppingPrice(row),
      selectable = row.packs > 0,
      packLabel =
        row.price?.pack > 0
          ? `${tidy(row.packs)} × ${tidy(row.price.pack)} ${esc(row.unit)} packs`
          : `${tidy(row.packs)} packs · check pack size`;
    return `<article class="buy-row ${selected.has(row.id) ? "is-selected" : ""}">${selectable ? `<input type="checkbox" class="buy-check" data-shop-select="${esc(row.id)}" aria-label="Select ${esc(row.name)} for purchase review" ${selected.has(row.id) ? "checked" : ""}>` : '<span class="buy-covered" aria-hidden="true">✓</span>'}<div class="buy-row-main"><h3>${esc(row.name)}</h3><p>${selectable ? packLabel : coverage.forecast ? "Covered if earlier planned purchases happen" : "Covered by your kitchen"}</p><small>${tidy(row.need)} ${esc(row.unit)} needed · ${coverage.actual} ${esc(row.unit)} in stock${coverage.forecast ? ` · ${coverage.forecast} ${esc(row.unit)} forecast from earlier trips` : ""}</small><details class="buy-detail"><summary>${esc(sourceText(row))}</summary><div class="row">${btn("Edit pack price", "price", `data-id="${esc(row.id)}"`, "outline")}${btn("Pack nutrition", "nutrition-edit", `data-id="${esc(row.id)}"`, "outline")}${selectable ? btn("Record this purchase", "purchase", `data-id="${esc(row.id)}"`, "outline") : ""}</div></details></div><strong class="buy-price">${!selectable ? "In plan" : price.known ? cash(price.total) : "Price needed"}</strong></article>`;
  }
  function buyView({ state, plan, rows, tripDate }) {
    const needed = rows.filter((r) => r.packs > 0),
      covered = rows.filter((r) => !r.packs),
      groups = new Map();
    for (const r of needed) {
      const group = r.group || "Other";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(r);
    }
    const picked = needed.filter((r) => selected.has(r.id)),
      trips = plan?.shoppingTrips || [];
    const next = trips.find((t) => t.date >= dayKey()) || trips.at(-1);
    return `<section class="buy-summary"><div><p class="eyebrow">${next ? (next.date < dayKey() ? "OUTSTANDING SHOP · " : "NEXT SHOP · ") + esc(dateLabel(next.date)) : "YOUR SHOPPING LIST"}</p><h2>${needed.length ? `${needed.length} ingredient${needed.length === 1 ? "" : "s"} to pick up` : plan ? "Your planned ingredients are covered" : "Plan a week to build your list"}</h2><p>${needed.length ? esc(totalLabel(needed)) + " · full packs counted" : "Check quantities and use-by dates before cooking."}</p></div>${next ? btn(next.date < dayKey() ? "View planned trip" : "View next trip", "shop-trip", `data-id="${esc(next.date)}"`, "outline") : ""}</section><div class="buy-toolbar"><label>Shopping trip<select id="shopping-trip">${option("", "Whole week", tripDate)}${trips.map((t) => option(t.date, `${dateLabel(t.date)} · through ${dateLabel(t.through)}`, tripDate)).join("")}</select></label>${btn("Cooking & shopping days", "rhythm-settings", "", "outline")}</div>${tripDate ? '<p class="hint">Later trips may include stock forecast from earlier purchases. Only confirmed purchases are in My kitchen.</p>' : ""}<p class="hint buy-intro">Tick what you bought, then review the actual pack sizes and amount paid. Ticking a box does not add stock.</p>${[...groups].map(([group, items]) => `<section class="buy-aisle"><h3 class="eyebrow">${esc(group)}</h3>${items.map(line).join("")}</section>`).join("")}${covered.length ? `<details class="buy-covered-list"><summary>${covered.length} ingredient${covered.length === 1 ? "" : "s"} covered by stock or earlier planned trips</summary>${covered.map(line).join("")}</details>` : ""}${!plan ? `<div class="shop-empty">${btn("Open weekly plan", "nav", 'data-screen="plan"')}</div>` : ""}<div class="buy-review-bar"><div><strong>${picked.length} selected</strong><small>${picked.length ? esc(totalLabel(picked)) : "Select purchased items above"}</small></div><button type="button" class="btn" data-action="shop-review" ${picked.length ? "" : "disabled"}>Review purchases${picked.length ? " (" + picked.length + ")" : ""}</button></div><p class="hint">Prices are estimates, dated snapshots or your recorded purchases. The amount paid is recorded only after your confirmation.</p>`;
  }
  function kitchenView({ state }) {
    const stock = (state?.inventory || []).filter((i) => i.quantity > 0),
      batches = (state?.batches || []).filter((b) => b.remaining > 0);
    return `<div class="section-head"><div><p class="eyebrow">MY KITCHEN</p><h2>What you actually have</h2><p>Ingredients and prepared portions, ready for your next meal.</p></div>${btn("+ Add stock", "stock")}</div><section class="kitchen-section"><h3>Ingredients <span class="hint">${stock.length}</span></h3><div class="kitchen-stock-grid">${
      stock
        .map((i) => {
          const ing = state.ingredients.find((x) => x.id === i.ingredientId),
            expired = i.expires && i.expires < dayKey();
          return `<article class="kitchen-stock-card"><div class="row between"><h4>${esc(ing?.name || "Ingredient")}</h4><span class="badge ${expired ? "warn" : ""}">${esc(i.location)}</span></div><p class="stock-quantity">${tidy(i.quantity)} <span>${esc(ing?.unit || "")}</span></p><p class="hint">${i.expires ? (expired ? "Past use-by · " : "Use by ") + esc(dateLabel(i.expires)) : "No expiry recorded — check your pack"}</p>${btn("Adjust quantity / storage", "stock", `data-id="${esc(i.id)}"`, "outline")}</article>`;
        })
        .join("") ||
      '<div class="shop-empty"><h4>Start with your cupboards</h4><p>Add ingredients you already own, or confirm a purchase in Buy.</p></div>'
    }</div></section><section class="kitchen-section"><h3>Cooked portions <span class="hint">${batches.length}</span></h3><div class="kitchen-stock-grid">${
      batches
        .map((b) => {
          const r = state.catalog.find((r) => r.id === b.recipeId),
            expiry =
              b.safeUntil && Number.isFinite(Date.parse(b.safeUntil))
                ? new Date(b.safeUntil).toLocaleString("en-GB", {
                    timeZone: "Europe/London",
                    dateStyle: "short",
                    timeStyle: "short",
                  }) + " UK"
                : b.expires || "Check storage date";
          return `<article class="kitchen-stock-card"><div class="row between"><h4>${esc(r?.title || "Prepared meal")}</h4><span class="badge">${esc(b.location)}</span></div><p class="stock-quantity">${tidy(b.remaining)} <span>portions</span></p><p class="hint">${esc(portionDescription(b))}</p><p class="hint">Use by ${esc(expiry)}</p>${btn("Use in plan", "use-batch-dialog", `data-id="${esc(b.id)}"`, "soft")}<details class="buy-detail"><summary>Storage, weight & waste</summary><div class="row">${btn("Record batch weight", "batch-weight", `data-id="${esc(b.id)}"`, "outline")}${r?.freshAssembly ? '<p class="hint">Freshly mixed shakes are not stored as freezer batches.</p>' : btn(b.location === "freezer" ? "Confirm defrosted" : "Freeze", "batch", `data-id="${esc(b.id)}" data-op="${b.location === "freezer" ? "thaw" : "freeze"}"`, "outline")}${btn("Record waste", "batch", `data-id="${esc(b.id)}" data-op="waste"`, "outline")}</div></details></article>`;
        })
        .join("") ||
      '<div class="shop-empty"><h4>Room for your next batch</h4><p>Prepared meals appear here after you confirm cooking and storage.</p></div>'
    }</div></section>`;
  }
  function render() {
    const c = current();
    const pantry = `<section class="card section"><h3>Already own groceries?</h3><p>Import a list without recording a purchase. Matched ingredients reduce shopping needs; unmatched masalas stay separate until their recipe use is checked.</p>${btn("Import cupboard list", "pantry-import", "", "outline")}${c.state?.pantryNotes?.length ? `<details class="section"><summary>Unmatched pantry items (${c.state.pantryNotes.length})</summary><p>Reference notes only: not used in meal plans, calorie totals or shopping coverage yet. Check labels before choosing a substitute.</p><ul>${c.state.pantryNotes.map((i) => `<li><strong>${esc(i.name)}</strong> · ${i.quantity == null ? "quantity unknown" : tidy(i.quantity) + " " + esc(i.unit)} · ${esc(i.location)}${i.expires ? " · use by " + esc(i.expires) : " · check pack date"}</li>`).join("")}</ul></details>` : ""}</section>`;
    return `<div class="shop-experience"><div class="shop-tabs" role="group" aria-label="Shopping and inventory">${[
      ["buy", "Buy"],
      ["kitchen", "My kitchen"],
    ]
      .map(
        ([id, label]) =>
          `<button type="button" data-action="shop-tab" data-id="${id}" aria-pressed="${tab === id}" class="${tab === id ? "active" : ""}">${label}</button>`,
      )
      .join(
        "",
      )}</div>${tab === "buy" ? buyView(c) : pantry + kitchenView(c)}</div>`;
  }
  const field = (label, name, type, value, attrs = "") =>
    `<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
  function review() {
    const c = current(),
      rows = c.rows.filter((r) => r.packs > 0 && selected.has(r.id));
    if (!c.plan || !rows.length)
      throw new Error(
        "Select the items you bought before reviewing purchases.",
      );
    draft = {
      id: crypto.randomUUID(),
      context: c.key,
      state: c.state,
      planId: c.plan.id,
      rows,
    };
    modal(
      `<p class="eyebrow">REVIEW YOUR SHOP</p><h2>${rows.length} purchased ingredient${rows.length === 1 ? "" : "s"}</h2><p class="intro">Check your receipt and packs. Add only what you actually bought; these quantities will be added to your kitchen.</p><form id="shop-purchase-form"><div class="shop-review-meta">${field("Retailer / shop", "retailer", "text", "", 'required maxlength="80" placeholder="For example, Tesco"')}${field("Purchase date", "date", "date", dayKey(), `required max="${dayKey()}"`)}</div>${rows
        .map(
          (r, i) =>
            `<fieldset class="shop-purchase-row"><legend>${esc(r.name)}</legend><label class="check-label"><input type="checkbox" name="include-${i}" checked>Include this purchase</label><p class="hint">Planning price: ${esc(sourceText(r))}${shoppingPrice(r).known ? " · " + cash(shoppingPrice(r).total) + " estimated for the suggested packs" : ""}.</p><div class="shop-purchase-fields">${field("Packs bought", "packs-" + i, "number", r.packs, 'required min="1" max="100" step="1"')}${field("Edible quantity per pack (" + r.unit + ")", "pack-" + i, "number", r.price?.pack || "", 'required min="0.1" max="100000" step="0.1"')}${field("Total paid for this item (£)", "total-" + i, "number", "", 'required min="0" max="10000" step="0.01" placeholder="Actual receipt line total"')}<label>Storage<select name="location-${i}" required>${[
              ["cupboard", "Cupboard"],
              ["fridge", "Fridge"],
              ["freezer", "Freezer"],
            ]
              .map(([id, name]) =>
                option(
                  id,
                  name,
                  r.group === "Frozen"
                    ? "freezer"
                    : ["Protein", "Produce", "Chilled"].includes(r.group) &&
                        r.id !== "whey"
                      ? "fridge"
                      : "cupboard",
                ),
              )
              .join(
                "",
              )}</select></label>${field("Use-by date (optional)", "expires-" + i, "date", "")}</div><p class="hint">Use drained edible weight for tins. The paid total covers all packs in this row.</p></fieldset>`,
        )
        .join(
          "",
        )}<label class="check-label shop-confirm"><input type="checkbox" name="confirmed" required>I checked the quantities, storage and actual amounts paid.</label><button class="btn" type="submit">Confirm purchases & add to kitchen</button></form>`,
    );
  }
  async function click(action, id) {
    current();
    if (action === "shop-tab") {
      if (!["buy", "kitchen"].includes(id)) return false;
      tab = id;
      ctx.render();
    } else if (action === "shop-trip") {
      ctx.setTripDate(id);
      ctx.render();
    } else if (action === "shop-review") review();
    else return false;
    return true;
  }
  async function submit(form, data) {
    if (form.id !== "shop-purchase-form") return false;
    const c = current();
    if (!draft || draft.context !== c.key || draft.state !== c.state)
      throw new Error(
        "Your list changed. Close this review and select your purchases again.",
      );
    if (saving) return true;
    if (data.confirmed !== "on")
      throw new Error(
        "Check the purchase details and confirm before adding stock.",
      );
    const rows = draft.rows.flatMap((r, i) =>
      data["include-" + i]
        ? [
            {
              ingredientId: r.id,
              packs: data["packs-" + i],
              pack: data["pack-" + i],
              total: data["total-" + i],
              location: data["location-" + i],
              expires: data["expires-" + i],
            },
          ]
        : [],
    );
    if (!rows.length) throw new Error("Include at least one purchased item.");
    if (rows.some((r) => !amount(r.total)))
      throw new Error("Enter the actual amount paid for every included item.");
    if (!String(data.retailer || "").trim())
      throw new Error("Enter the retailer or shop for this purchase.");
    saving = true;
    try {
      if (
        await mutate("importPurchases", {
          importId: draft.id,
          planId: draft.planId,
          rows,
          retailer: data.retailer,
          date: data.date,
          confirmed: true,
        })
      ) {
        selected.clear();
        draft = null;
        ctx.render();
      }
    } finally {
      saving = false;
    }
    return true;
  }
  function input(target) {
    const c = current(),
      id = target.dataset?.shopSelect;
    if (id) {
      if (!c.rows.some((r) => r.id === id && r.packs > 0)) return false;
      if (target.checked) selected.add(id);
      else selected.delete(id);
      ctx.render();
      if (typeof document !== "undefined")
        [...document.querySelectorAll("[data-shop-select]")]
          .find((el) => el.dataset.shopSelect === id)
          ?.focus();
      return true;
    }
    const form = target.closest?.("form");
    if (
      form?.id === "shop-purchase-form" &&
      target.name.startsWith("include-")
    ) {
      const index = target.name.slice(8);
      for (const key of ["packs", "pack", "total", "location", "expires"])
        if (form.elements[`${key}-${index}`])
          form.elements[`${key}-${index}`].disabled = !target.checked;
      return true;
    }
    return false;
  }
  return { render, click, submit, input };
}

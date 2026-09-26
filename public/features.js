import {
  allocations,
  freePortions,
  yieldInfo,
  portionDescription,
  tidy,
} from "./portions.js";
import { reviewSummary } from "./review.js";
import { parseReceipt, validBarcode } from "./imports.js";
import { dayKey } from "./metrics.js";
import { createPantryImport } from "./pantry-import.js";

export function createFeatures(ctx) {
  const pantryImport = createPantryImport(ctx);
  const {
    getState,
    chosenPlan,
    mealInfo,
    modal,
    mutate,
    api,
    esc,
    field,
    select,
    btn,
    cash,
    toast,
    openMeal,
  } = ctx;
  let draft = null,
    captureBusy = false;
  const locations = [
    ["cupboard", "Cupboard"],
    ["fridge", "Fridge"],
    ["freezer", "Freezer"],
  ];
  const recipe = (id) => getState().catalog.find((r) => r.id === id);
  const amountField = (label, name, value, max) =>
    field(
      label,
      name,
      "number",
      value,
      `required min="0.001" max="${max}" step="any"`,
    );
  function tools(screen) {
    if (screen === "plan" || screen === "progress")
      return `<div class="row section">${btn("Review this week", "weekly-review", "", "outline")}</div>`;
    if (screen === "kitchen")
      return `<div class="row section">${btn("Receipt / barcode entry", "purchase-import", "", "outline")}</div>`;
    return "";
  }
  function batchSummary(meal) {
    const { p, batch } = mealInfo(meal.id);
    if (batch)
      return `<div class="notice"><strong>${portionDescription(batch)}</strong><p>Allocated to this meal: ${allocations(
        meal,
      )
        .map(
          (a) =>
            `${tidy(a.portions)} portion(s) in the ${getState().batches.find((b) => b.id === a.batchId)?.location || "unknown storage"}`,
        )
        .join(
          " + ",
        )}.</p>${btn("Record / correct finished batch weight", "batch-weight", `data-id="${batch.id}"`, "outline")}</div>`;
    if (meal.status !== "planned") return "";
    if (recipe(meal.recipeId).freshAssembly)
      return '<p class="notice">Mix one measured serving when you want it. Powder stays in your cupboard; shakes are prepared fresh rather than with the multi-day cooking batch.</p>';
    const y = yieldInfo(p, meal),
      cal = recipe(meal.recipeId).nutrition.kcal * meal.multiplier;
    return `<div class="notice"><strong>1 cooking batch → ${y.portions} portion${y.portions === 1 ? "" : "s"}</strong><p>Cook once. Divide every component equally into ${y.portions} serving${y.portions === 1 ? "" : "s"}. One serving ≈ ${Math.round(cal)} kcal. ${y.group.length} serving(s) are in this plan; ${y.portions - y.group.length} extra serving(s) go into your kitchen.</p><p>Record the net finished food weight after cooking to calculate grams per serving. Water loss means raw weight is not finished serving weight.</p><p><strong>Automatically counted from your plan:</strong> ${y.group.map((m) => m.date + " " + m.slot).join(" · ")}. Swaps and skipped meals recalculate this batch.</p><details><summary>Optional: make extra freezer portions</summary><form id="batch-size-form" data-id="${meal.id}">${field("Total portions to make", "portions", "number", y.portions, `required min="${y.group.length}" max="20" step="1"`)}<button class="btn outline">Update batch & shopping quantities</button></form></details></div>`;
  }
  function prepare(id) {
    const { m, p, batch } = mealInfo(id);
    if (batch) {
      eat(id);
      return;
    }
    if (m.parentId) {
      openMeal(m.parentId);
      return;
    }
    if (recipe(m.recipeId).freshAssembly) {
      modal(
        `<h2>Confirm your freshly mixed shake</h2><p class="intro">Use the measured powder and water shown in the recipe. Confirm mixing to deduct the powder from Kitchen, then record the amount you drank.</p><form id="prepare-form" data-id="${id}"><button class="btn">Confirm mixed</button></form>`,
      );
      return;
    }
    const y = yieldInfo(p, m);
    const rice = recipe(m.recipeId).items.some((i) => i.id === "rice"),
      cutoff = new Date(
        Date.parse(dayKey() + "T12:00:00Z") + (rice ? 0 : 1) * 86400000,
      )
        .toISOString()
        .slice(0, 10);
    const freezeCount =
      y.group.filter((x) => x.date > cutoff).length +
      y.portions -
      y.group.length;
    modal(
      `<p class="eyebrow">FINISH COOKING</p><h2>1 batch · ${y.portions} portion${y.portions === 1 ? "" : "s"}</h2><p>Weigh all finished food without its containers. Divide each component equally (for example, rice and curry separately). Nutrition assumes the exact recipe ingredients were used and mixed evenly.</p><form id="prepare-form" data-id="${id}" data-portions="${y.portions}">${field("Net finished weight of the whole batch (g, optional)", "cookedWeight", "number", "", 'min="1" max="50000" step="any"')}<p id="yield-preview" class="notice">${y.portions} equal serving${y.portions === 1 ? "" : "s"}. Add the weight to see grams per serving.</p><p class="hint">Cool and refrigerate promptly. Rice: use within 24 hours; other refrigerated leftovers: 48 hours. Freeze later portions promptly. You can split fridge/freezer portions in Kitchen after saving.</p>${freezeCount && getState().profile.equipment.includes("freezer") ? `<label class="check-label"><input type="checkbox" name="plannedStorage" checked>I have stored ${y.portions - freezeCount} portion(s) for the fridge / today and frozen ${freezeCount} for later meals</label>` : ""}<label class="check-label"><input type="checkbox" name="freeze" ${getState().profile.equipment.includes("freezer") ? "" : "disabled"}>Freeze the whole batch</label><button class="btn">Confirm prepared</button></form>`,
    );
  }
  function eat(id) {
    const { m } = mealInfo(id),
      s = getState(),
      list = allocations(m),
      max = list.reduce((n, a) => n + a.portions, 0),
      b = s.batches.find((b) => b.id === list[0]?.batchId);
    if (!b) throw new Error("Prepare this meal first.");
    modal(
      `<h2>How much did you eat?</h2><p>${esc(recipe(m.recipeId).title)} · ${portionDescription(b)}.</p><p>${list.map((a) => `${a.portions} portion(s) allocated in the ${s.batches.find((b) => b.id === a.batchId)?.location}`).join(" + ")}. Frozen food must be fully defrosted first.</p><form id="eat-form" data-id="${id}" data-calories="${b.nutrition.kcal}" data-grams="${b.gramsPerPortion || 0}" data-max="${max}">${select("Measure eaten amount in", "basis", [["portions", "Portions"], ...(b.gramsPerPortion ? [["grams", "Grams"]] : [])], "portions")}${amountField("Amount eaten", "amount", max, max)}<p id="eat-preview" class="notice">${Math.round(b.nutrition.kcal * max)} kcal estimated</p><p class="hint">This completes this meal entry. Any uneaten fraction stays available in Kitchen for another meal. Grams assume an evenly mixed or equally divided recipe.</p><button class="btn">Save amount eaten</button></form>`,
    );
  }
  function storage(id, operation) {
    const b = getState().batches.find((b) => b.id === id);
    modal(
      `<h2>${operation === "waste" ? "Record unused food" : operation === "freeze" ? "Freeze some or all portions" : "Confirm defrosted portions"}</h2><p>${b.remaining} portions currently in the ${b.location}. ${portionDescription(b)}.</p><form id="storage-form" data-id="${id}" data-op="${operation}">${amountField("Number of portions", "portions", b.remaining, b.remaining)}${operation === "thaw" ? '<p>Defrost in the fridge. Only confirm once completely thawed; use within 24 hours and reheat only once until steaming hot throughout.</p><label class="check-label"><input type="checkbox" name="confirmed" required>These portions are completely defrosted</label>' : ""}${operation === "waste" ? field("Reason (optional)", "note", "text", "", 'maxlength="200"') : ""}<button class="btn">${operation === "waste" ? "Record waste" : "Update storage"}</button></form>`,
    );
  }
  function review() {
    const s = getState(),
      p = chosenPlan(),
      r = s.reviews?.find((r) => r.planId === p.id) || {},
      summary = reviewSummary(s, p);
    modal(
      `<p class="eyebrow">WEEK STARTING ${p.start}</p><h2>What should next week feel like?</h2><div class="notice">${summary.eaten} planned meals recorded eaten · ${summary.loggedDays}/7 days with food entries · ${cash(summary.spend)} grocery spending · ${tidy(summary.waste)} cooked portions wasted.<br>Unlogged food is unknown, not zero.</div><form id="review-form" data-id="${p.id}">${select(
        "Hunger between meals",
        "hunger",
        [
          [1, "1 · Rarely hungry"],
          [2, "2"],
          [3, "3 · Sometimes"],
          [4, "4"],
          [5, "5 · Often hungry"],
        ],
        r.hunger || 3,
      )}${select(
        "Enjoyment",
        "enjoyment",
        [
          [1, "1 · Not enjoyable"],
          [2, "2"],
          [3, "3 · Okay"],
          [4, "4"],
          [5, "5 · Loved it"],
        ],
        r.enjoyment || 3,
      )}${select(
        "Cooking effort",
        "effort",
        [
          [1, "1 · Very easy"],
          [2, "2"],
          [3, "3 · Manageable"],
          [4, "4"],
          [5, "5 · Too much work"],
        ],
        r.effort || 3,
      )}${select(
        "Next-week priority",
        "priority",
        [
          ["same", "Keep the balance"],
          ["easier", "Less cooking effort"],
          ["variety", "More discovery"],
          ["budget", "Lower ingredient costs"],
        ],
        r.priority || "same",
      )}<details><summary>Rate meals from this week</summary>${[
        ...new Set(p.meals.map((m) => m.recipeId)),
      ]
        .map((id) =>
          select(
            esc(recipe(id).title),
            "rating-" + id,
            [
              ["", "Not rated"],
              ["love", "Loved it"],
              ["okay", "Okay"],
              ["dislike", "Not for me"],
            ],
            r.ratings?.find((x) => x.recipeId === id)?.rating || "",
          ),
        )
        .join(
          "",
        )}</details>${field("Notes for your own review", "note", "text", r.note || "", 'maxlength="1000"')}<label class="check-label"><input type="checkbox" name="refreshDraft">Create / rebuild next week's unused draft with these answers (replaces its manual swaps)</label><p class="hint">Recipe ratings, effort, hunger and priority influence future recipe choices within your equipment and dietary exclusions. Notes and enjoyment are recorded for reflection. Your calorie target does not change automatically.</p><button class="btn">Save weekly review</button></form>`,
    );
  }
  function importStart() {
    draft = null;
    modal(
      `<p class="eyebrow">REVIEW BEFORE SAVING</p><h2>Add a shopping trip.</h2><p>Receipt photos are read on this device and are not uploaded. Photo reading needs a clear image and may take a moment. Nothing is added until you check and confirm the rows.</p><form id="receipt-form"><label>Receipt photo<input type="file" id="receipt-photo" accept="image/*"></label><label>Or paste / correct receipt text<textarea name="text" rows="7" maxlength="20000" placeholder="OATS  1.25"></textarea></label><button class="btn">Review receipt rows</button></form><hr><h3>Find a product by barcode</h3><form id="barcode-form"><label>Barcode photo (optional)<input id="barcode-photo" type="file" accept="image/*"></label>${field("EAN / UPC barcode", "code", "text", "", 'required inputmode="numeric" maxlength="14"')}<label class="check-label"><input name="consent" type="checkbox" required>Send only this barcode to Open Food Facts for product lookup</label><p class="hint">Community product data, not live supermarket prices. Check the pack, allergens, edible quantity and receipt price yourself.</p><button class="btn">Look up & review product</button></form><p id="capture-status" role="status"></p>`,
    );
  }
  function importReview() {
    const s = getState();
    modal(
      `<h2>Check every selected item.</h2><p>${esc(draft.warning || "Match the product to an ingredient. Enter what you paid; product lookup does not supply prices.")}</p>${draft.source ? `<p>Product data: <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a> (ODbL). ${esc(draft.source)}</p>` : ""}<form id="import-form">${field("Retailer", "retailer", "text", "", 'required maxlength="80"')}${field("Purchase date", "date", "date", dayKey(), `required max="${dayKey()}"`)}${select(
        "Charge this shopping week",
        "planId",
        s.plans.map((p) => [p.id, p.start + " · " + p.status]),
        chosenPlan().id,
      )}<div class="stack">${draft.rows.map((r, i) => `<fieldset class="import-row" data-index="${i}"><legend>${esc(r.name)}</legend><label class="check-label"><input type="checkbox" name="include-${i}">Include this item</label>${select("Kitchen ingredient (confirm the match)", `ingredient-${i}`, [["", "Choose ingredient"], ...s.ingredients.map((x) => [x.id, esc(x.name) + " · " + x.unit])], r.ingredientId)}<div class="fields">${field("Number of packs", `packs-${i}`, "number", r.packs, 'min="1" max="100" step="1"')}${field("Edible quantity per pack (unit shown above)", `pack-${i}`, "number", r.pack, 'min="0.1" max="100000" step="any"')}${field("Line total paid (£, all these packs)", `total-${i}`, "number", r.total, 'min="0" max="10000" step="0.01"')}${select("Storage", `location-${i}`, locations, r.location)}${field("Use-by date (optional)", `expires-${i}`, "date", r.expires)}</div>${r.quantityLabel ? `<p class="hint">Product label quantity: ${esc(r.quantityLabel)}. For tins enter drained edible weight, not total weight.</p>` : ""}${r.allergens ? `<p>Reported allergens: ${esc(r.allergens)}. Always check your actual pack.</p>` : ""}${r.nutrition ? `<details><summary>Verify and optionally use label nutrition</summary><p>Only use values for this ingredient as measured in the recipe (raw, dry or drained), per 100 g/ml. Missing values must be filled if applying.</p><label class="check-label"><input type="checkbox" name="nutrition-${i}">I checked these values and measurement basis against my pack</label><div class="fields">${["kcal", "protein", "carbs", "fat", "fibre", "salt"].map((k) => field(k + (k === "kcal" ? "" : " (g)"), `${k}-${i}`, "number", r.nutrition[k] ?? "", 'min="0" step="any"')).join("")}</div></details>` : ""}</fieldset>`).join("")}</div><label class="check-label"><input name="confirmed" type="checkbox" required>I checked selected items, edible quantities, units, discounts and line totals</label><p class="hint">Saving adds stock and grocery spending, and updates your pack prices. Unticked rows are ignored. Items not in the recipe ingredient library cannot be imported yet.</p><button class="btn">Confirm purchases</button></form>`,
    );
  }
  async function click(a, id, b) {
    if (pantryImport.click(a)) return true;
    if (a === "eat") eat(id);
    else if (a === "prepare") prepare(id);
    else if (a === "batch") storage(id, b.dataset.op);
    else if (a === "weekly-review") review();
    else if (a === "purchase-import") importStart();
    else if (a === "batch-weight") {
      const lot = getState().batches.find((b) => b.id === id);
      modal(
        `<h2>Finished weight of the original batch</h2><p>Enter the original total before any servings were eaten or split. This changes grams per portion, not recipe calories.</p><form id="batch-weight-form" data-id="${id}">${field("Original cooked batch weight (g)", "cookedWeight", "number", lot.cookedWeight || "", 'required min="1" max="50000" step="any"')}<button class="btn">Save weight</button></form>`,
      );
    } else if (a === "use-batch-dialog") {
      const s = getState(),
        lot = s.batches.find((x) => x.id === id),
        free = freePortions(s, lot);
      if (free <= 0)
        throw new Error(
          "All remaining portions are already allocated. Change a planned meal first to release its portion.",
        );
      modal(
        `<h2>Use a cooked portion.</h2><p>${tidy(free)} unallocated portions. Frozen food must be defrosted before eating.</p><form id="use-batch-form" data-id="${id}">${select(
          "Replace a planned meal",
          "id",
          chosenPlan()
            .meals.filter(
              (m) =>
                m.status === "planned" &&
                recipe(lot.recipeId).slots.includes(m.slot),
            )
            .map((m) => [m.id, m.date + " · " + m.slot]),
        )}${amountField("Portions to allocate", "portions", Math.min(1, free), free)}<button class="btn">Use in plan</button></form>`,
      );
    } else return false;
    return true;
  }
  async function submit(f, d) {
    if (await pantryImport.submit(f, d)) return true;
    const id = f.dataset.id;
    if (f.id === "eat-form") await mutate("eat", { id, ...d });
    else if (f.id === "storage-form")
      await mutate("batch", {
        id,
        operation: f.dataset.op,
        ...d,
        confirmed: d.confirmed === "on",
      });
    else if (f.id === "batch-size-form") {
      if (await mutate("batchSize", { id, portions: d.portions }))
        await openMeal(id);
    } else if (f.id === "batch-weight-form")
      await mutate("batchWeight", { id, ...d });
    else if (f.id === "use-batch-form")
      await mutate("useBatch", { ...d, batchId: id });
    else if (f.id === "review-form")
      await mutate("review", {
        ...d,
        planId: id,
        refreshDraft: d.refreshDraft === "on",
        ratings: Object.entries(d)
          .filter(([k, v]) => k.startsWith("rating-") && v)
          .map(([k, v]) => ({ recipeId: k.slice(7), rating: v })),
      });
    else if (f.id === "receipt-form") {
      if (captureBusy) throw new Error("Wait for the photo to finish reading.");
      const parsed = parseReceipt(d.text, getState().ingredients);
      if (!parsed.rows.length)
        throw new Error(
          "No priced item lines found. Correct the text or use manual stock / purchase entry.",
        );
      draft = { ...parsed, id: crypto.randomUUID() };
      importReview();
    } else if (f.id === "barcode-form") {
      const code = d.code.replace(/\s/g, "");
      if (!validBarcode(code))
        throw new Error(
          "Check the barcode digits, including the final check digit.",
        );
      let result;
      try {
        result = await api("barcode", { code, consent: d.consent === "on" });
      } catch (error) {
        if (!getState()) throw error;
        result = {
          found: false,
          source: error.message + " Manual entry — no product data retrieved.",
        };
      }
      const p = result.product || result;
      const saved = getState().barcodes?.[code];
      draft = {
        id: crypto.randomUUID(),
        source: p.source || "Product not found; fill in all details manually.",
        rows: [
          {
            name: p.name || "Product " + code,
            barcode: code,
            ingredientId: saved?.ingredientId || p.ingredientId || "",
            packs: 1,
            pack:
              saved?.pack ||
              (p.unit &&
              p.unit ===
                getState().ingredients.find((i) => i.id === p.ingredientId)
                  ?.unit
                ? p.pack
                : "") ||
              "",
            total: "",
            location: "cupboard",
            expires: "",
            quantityLabel: p.quantityLabel,
            allergens: p.allergens,
            nutrition: p.nutrition,
          },
        ],
      };
      importReview();
    } else if (f.id === "import-form") {
      const rows = draft.rows.flatMap((r, i) =>
        d["include-" + i]
          ? [
              {
                ...r,
                ingredientId: d["ingredient-" + i],
                packs: d["packs-" + i],
                pack: d["pack-" + i],
                total: d["total-" + i],
                location: d["location-" + i],
                expires: d["expires-" + i],
                useNutrition: d["nutrition-" + i] === "on",
                nutrition: Object.fromEntries(
                  ["kcal", "protein", "carbs", "fat", "fibre", "salt"].map(
                    (k) => [k, d[k + "-" + i]],
                  ),
                ),
              },
            ]
          : [],
      );
      if (
        await mutate("importPurchases", {
          importId: draft.id,
          rows,
          retailer: d.retailer,
          date: d.date,
          planId: d.planId,
          confirmed: d.confirmed === "on",
        })
      ) {
        draft = null;
        toast("Purchases confirmed. Stock, prices and spending updated.");
      }
    } else return false;
    return true;
  }
  function input(target) {
    const f = target.closest("form");
    if (!f) return;
    if (f.id === "prepare-form") {
      const weight = Number(f.elements.cookedWeight.value),
        count = Number(f.dataset.portions);
      f.querySelector("#yield-preview").textContent = weight
        ? `${weight} g ÷ ${count} = ${Math.round((weight / count) * 10) / 10} g per serving`
        : `${count} equal servings. Add the weight to see grams per serving.`;
    }
    if (f.id === "eat-form") {
      const grams = f.elements.basis.value === "grams",
        per = Number(f.dataset.grams),
        max = Number(f.dataset.max) * (grams ? per : 1);
      if (target.name === "basis") f.elements.amount.value = max;
      f.elements.amount.max = max;
      const portions = Number(f.elements.amount.value) / (grams ? per : 1);
      f.querySelector("#eat-preview").textContent =
        `${Math.round(portions * Number(f.dataset.calories))} kcal estimated · ${tidy(portions)} portion(s)`;
    }
  }
  async function capture(target) {
    if (
      !["receipt-photo", "barcode-photo"].includes(target.id) ||
      !target.files?.[0]
    )
      return;
    if (captureBusy) throw new Error("One photo is already being read.");
    captureBusy = true;
    const status = document.querySelector("#capture-status"),
      form = target.closest("form");
    const buttons = [...form.querySelectorAll("button")];
    buttons.forEach((b) => (b.disabled = true));
    const update = (m) => {
      if (status?.isConnected) status.textContent = m;
    };
    try {
      update("Loading on-device reader…");
      const reader = await import("/vendor/capture.js");
      if (target.id === "receipt-photo") {
        const text = await reader.receiptText(target.files[0], update);
        if (form.isConnected) form.elements.text.value = text;
        update("Text ready. Correct it if needed, then review the rows.");
      } else {
        const code = await reader.barcodeFromImage(target.files[0]);
        if (form.isConnected) form.elements.code.value = code;
        update(
          "Barcode read. Check the digits and choose whether to look it up.",
        );
      }
    } catch (error) {
      update(
        "Could not read this photo. Try another image or use manual entry.",
      );
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      captureBusy = false;
      buttons.forEach((b) => (b.disabled = false));
    }
  }
  return { tools, batchSummary, click, submit, input, capture, prepare };
}

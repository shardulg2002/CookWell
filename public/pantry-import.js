function exactIngredient(name, ingredients) {
  const normalized = name.toLowerCase().trim();
  const aliases = {
    "bell peppers": "pepper",
    "bell pepper": "pepper",
    "frozen veggies": "veg",
    "frozen vegetables": "veg",
    "olive oil": "oil",
  };
  const id = aliases[normalized];
  return (
    ingredients.find((i) => i.id === id || i.name.toLowerCase() === normalized)
      ?.id || ""
  );
}
export function parsePantry(text, ingredients) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!lines.length || lines.length > 60 || String(text).length > 12000)
    throw new Error(
      "Enter 1–60 items, one per line (up to 12,000 characters).",
    );
  return lines.map((line) => {
    const match = line.match(
      /^(.*?)\s*[-,:]?\s+(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\s*$/i,
    );
    const name = (match ? match[1] : line).replace(/[-,:]\s*$/, "").trim();
    const unit = match?.[3].toLowerCase();
    return {
      name,
      quantity: match
        ? Number(match[2]) * (["kg", "l"].includes(unit) ? 1000 : 1)
        : "",
      unit: unit === "l" ? "ml" : unit === "kg" ? "g" : unit || "g",
      ingredientId: /masala|seasoning|spice|curry powder/i.test(name)
        ? ""
        : exactIngredient(name, ingredients),
    };
  });
}
export function createPantryImport({
  getState,
  modal,
  mutate,
  esc,
  field,
  select,
}) {
  let draft;
  return {
    click(action) {
      if (action !== "pantry-import") return false;
      draft = null;
      modal(
        '<h2>Already in my kitchen</h2><p>Paste one item per line, with remaining quantities if known: Rice 1 kg, Olive oil 250 ml, Garam masala 80 g. No purchase or spending will be recorded. Review every match before saving.</p><form id="pantry-list-form"><label>Your grocery list<textarea name="list" rows="10" maxlength="12000" required></textarea></label><button class="btn">Review list</button></form>',
      );
      return true;
    },
    async submit(form, data) {
      if (form.id === "pantry-list-form") {
        draft = {
          id: crypto.randomUUID(),
          rows: parsePantry(data.list, getState().ingredients),
        };
        modal(
          `<h2>Check your cupboard list</h2><p>Only tick items you want to add. Confirm the exact ingredient and measurement basis, especially raw/dry/drained quantities. Do not map masalas to the generic spice blend unless their ingredients and allergens actually match. Unmatched items are saved as reference notes, not counted in recipes, calories or shopping coverage.</p><form id="pantry-review-form">${draft.rows
            .map(
              (r, i) =>
                `<fieldset><legend>${esc(r.name)}</legend><label><input type="checkbox" name="include-${i}">Add this item</label>${select("Recipe ingredient", `ingredient-${i}`, [["", "Unmatched — keep as a pantry note"], ...getState().ingredients.map((x) => [x.id, esc(x.name) + " · " + x.unit])], r.ingredientId)}${field("Quantity remaining (required for matched ingredients)", `quantity-${i}`, "number", r.quantity, 'min="0.1" max="100000" step="any"')}${select(
                  "Unit (must match recipe ingredient)",
                  `unit-${i}`,
                  [
                    ["g", "g"],
                    ["ml", "ml"],
                  ],
                  r.unit,
                )}${select(
                  "Storage",
                  `location-${i}`,
                  [
                    ["cupboard", "Cupboard"],
                    ["fridge", "Fridge"],
                    ["freezer", "Freezer"],
                  ],
                  "cupboard",
                )}${field("Use-by date, if applicable", `expires-${i}`, "date", "")}</fieldset>`,
            )
            .join(
              "",
            )}<label><input type="checkbox" name="confirmed" required>I checked the selected items, quantities, units and ingredient/allergen matches</label><p>This adds to existing stock; do not include items already recorded. No prices or spending are changed.</p><button class="btn">Add to my kitchen</button></form>`,
        );
        return true;
      }
      if (form.id !== "pantry-review-form") return false;
      if (!draft)
        throw new Error("Paste your list again to start a new import.");
      const rows = draft.rows.flatMap((r, i) =>
        data[`include-${i}`] === "on"
          ? [
              {
                name: r.name,
                ingredientId: data[`ingredient-${i}`],
                quantity: data[`quantity-${i}`],
                unit: data[`unit-${i}`],
                location: data[`location-${i}`],
                expires: data[`expires-${i}`],
              },
            ]
          : [],
      );
      if (
        await mutate("importPantry", {
          importId: draft.id,
          confirmed: data.confirmed === "on",
          rows,
        })
      )
        draft = null;
      return true;
    },
  };
}

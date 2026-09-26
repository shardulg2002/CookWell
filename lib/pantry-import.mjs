import { randomUUID } from "node:crypto";
import { ingredientMap } from "./catalog.mjs";
export function importPantry(state, data) {
  const fail = (message) => {
    throw Object.assign(new Error(message), { status: 400 });
  };
  if (data.confirmed !== true)
    fail("Review and confirm the pantry items first.");
  if (!/^[a-zA-Z0-9-]{12,80}$/.test(data.importId || ""))
    fail("Invalid import reference.");
  if ((state.pantryImports || []).includes(data.importId))
    fail("This pantry list was already saved.");
  if (!Array.isArray(data.rows) || !data.rows.length || data.rows.length > 60)
    fail("Select 1–60 items.");
  const rows = data.rows.map((row) => {
    const name = String(row.name || "").trim();
    if (!name || name.length > 200)
      fail("Item names must be 1–200 characters.");
    const ingredient = row.ingredientId
      ? ingredientMap[row.ingredientId]
      : null;
    if (row.ingredientId && !ingredient) fail("Unknown recipe ingredient.");
    if (
      !["g", "ml"].includes(row.unit) ||
      (ingredient && ingredient.unit !== row.unit)
    )
      fail(
        "Check ingredient units. Grams and millilitres cannot be interchanged.",
      );
    const quantity =
      row.quantity === "" || row.quantity == null ? null : Number(row.quantity);
    if (
      (ingredient && quantity == null) ||
      (quantity != null &&
        (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000))
    )
      fail("Enter a positive remaining quantity up to 100,000.");
    if (!["cupboard", "fridge", "freezer"].includes(row.location))
      fail("Choose a storage location.");
    const expires = row.expires || null;
    if (
      expires &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(expires) ||
        !Number.isFinite(Date.parse(expires)) ||
        new Date(expires).toISOString().slice(0, 10) !== expires)
    )
      fail("Check the use-by date.");
    return {
      id: randomUUID(),
      ingredientId: ingredient?.id || null,
      name,
      quantity,
      unit: row.unit,
      location: row.location,
      expires,
    };
  });
  // All rows validate before mutating. Unmatched blends must never cover recipe stock.
  for (const row of rows) {
    if (row.ingredientId) state.inventory.push(row);
    else (state.pantryNotes ??= []).push(row);
  }
  (state.pantryImports ??= []).push(data.importId);
}

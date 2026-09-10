import { randomUUID } from "node:crypto";
import { ingredientMap } from "./catalog.mjs";
import { dayKey } from "../public/metrics.js";
const fail = (m) => {
  throw Object.assign(new Error(m), { status: 400 });
};
const num = (v, min, max, label) => {
  const n = Number(v);
  if (v === "" || v == null || !Number.isFinite(n) || n < min || n > max)
    fail("Check " + label + ".");
  return n;
};
const date = (v) => {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    fail("Check the date.");
  return v;
};
export function importPurchases(s, data) {
  if (!data.confirmed)
    fail("Review the extracted rows and confirm before saving.");
  if (!/^[a-zA-Z0-9-]{12,80}$/.test(data.importId || ""))
    fail("Invalid import reference.");
  if ((s.imports || []).some((i) => i.id === data.importId))
    fail("This import was already saved.");
  const plan = s.plans.find((p) => p.id === data.planId);
  if (!plan) fail("Choose a shopping week.");
  const purchased = date(data.date || dayKey());
  if (purchased > dayKey()) fail("A purchase cannot be in the future.");
  const retailer = String(data.retailer || "My purchase")
    .trim()
    .slice(0, 80);
  if (!Array.isArray(data.rows) || !data.rows.length || data.rows.length > 60)
    fail("Select between 1 and 60 purchase rows.");
  const rows = data.rows.map((row) => {
    const ingredient = ingredientMap[row.ingredientId];
    if (!ingredient) fail("Match every selected row to a kitchen ingredient.");
    const packs = num(row.packs, 1, 100, "number of packs");
    if (!Number.isInteger(packs)) fail("Packs must be a whole number.");
    const pack = num(row.pack, 0.1, 100000, "edible pack quantity"),
      cost = Math.round(num(row.total, 0, 10000, "line total") * 100);
    if (!["cupboard", "fridge", "freezer"].includes(row.location))
      fail("Choose a storage location.");
    const expires = row.expires ? date(row.expires) : null;
    let nutrition;
    if (row.useNutrition) {
      nutrition = {};
      for (const k of ["kcal", "protein", "carbs", "fat", "fibre", "salt"])
        nutrition[k] = num(
          row.nutrition?.[k],
          0,
          k === "kcal" ? 1000 : 100,
          k + " per 100 " + ingredient.unit,
        );
    }
    return {
      ingredient,
      packs,
      pack,
      cost,
      expires,
      location: row.location,
      nutrition,
      barcode: /^\d{8,14}$/.test(row.barcode || "") ? row.barcode : null,
    };
  });
  // Validate all rows before creating any stock or spending records.
  for (const row of rows) {
    s.inventory.push({
      id: randomUUID(),
      ingredientId: row.ingredient.id,
      quantity: row.pack * row.packs,
      location: row.location,
      expires: row.expires,
    });
    s.purchases.push({
      id: randomUUID(),
      date: purchased,
      ingredientId: row.ingredient.id,
      quantity: row.pack * row.packs,
      cost: row.cost,
      planId: plan.id,
      importId: data.importId,
    });
    s.prices[row.ingredient.id] = {
      pack: row.pack,
      price: Math.round(row.cost / row.packs),
      source: retailer + " · confirmed purchase",
      checkedAt: purchased,
      url: null,
    };
    if (row.nutrition) s.nutrition[row.ingredient.id] = row.nutrition;
    if (row.barcode) {
      s.barcodes ??= {};
      s.barcodes[row.barcode] = {
        ingredientId: row.ingredient.id,
        pack: row.pack,
      };
    }
  }
  s.imports ??= [];
  s.imports.push({
    id: data.importId,
    date: purchased,
    retailer,
    count: rows.length,
    total: rows.reduce((n, r) => n + r.cost, 0),
  });
}

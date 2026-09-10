import { validBarcode, suggestIngredient } from "../public/imports.js";
import { ingredients } from "./catalog.mjs";
const fail = (m, status = 400) => {
  throw Object.assign(new Error(m), { status });
};
export async function lookupProduct(code, fetcher = fetch) {
  const barcode = String(code || "").replace(/\s/g, "");
  if (!validBarcode(barcode))
    fail("Enter a valid EAN/UPC barcode, including its check digit.");
  const fields =
    "code,product_name,brands,quantity,product_quantity,product_quantity_unit,nutriments,allergens,ingredients_text";
  let response;
  try {
    response = await fetcher(
      "https://world.openfoodfacts.org/api/v2/product/" +
        barcode +
        ".json?fields=" +
        fields,
      {
        headers: {
          "User-Agent":
            "CookWell/1.1 (personal cooking app; https://github.com/shardulg2002/CookWell)",
        },
        signal: AbortSignal.timeout(12000),
      },
    );
  } catch {
    fail(
      "Product lookup is unavailable. You can still enter the pack details yourself.",
      503,
    );
  }
  if (response.status === 404) return { found: false, barcode };
  if (!response.ok)
    fail(
      "Product lookup is temporarily unavailable. Enter details manually.",
      503,
    );
  const data = await response.json();
  if (data.status === 0 || !data.product) return { found: false, barcode };
  const p = data.product,
    n = p.nutriments || {};
  const val = (k) =>
    Number.isFinite(Number(n[k])) && n[k] != null ? Number(n[k]) : null;
  return {
    found: true,
    barcode,
    name: String(p.product_name || "Unnamed product").slice(0, 200),
    brand: String(p.brands || "").slice(0, 200),
    quantityLabel: String(p.quantity || "").slice(0, 100),
    pack: Number(p.product_quantity) || null,
    unit: ["g", "ml"].includes(p.product_quantity_unit)
      ? p.product_quantity_unit
      : null,
    ingredientId: suggestIngredient(p.product_name, ingredients),
    nutrition: {
      kcal: val("energy-kcal_100g"),
      protein: val("proteins_100g"),
      carbs: val("carbohydrates_100g"),
      fat: val("fat_100g"),
      fibre: val("fiber_100g"),
      salt: val("salt_100g"),
    },
    allergens: String(p.allergens || "").slice(0, 1000),
    ingredientsText: String(p.ingredients_text || "").slice(0, 2000),
    source: "Open Food Facts (community data; verify pack)",
    url: "https://world.openfoodfacts.org/product/" + barcode,
    checkedAt: new Date().toISOString().slice(0, 10),
  };
}

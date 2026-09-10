export function validBarcode(code) {
  const s = String(code).replace(/\s/g, "");
  if (!/^\d{8}$|^\d{12,14}$/.test(s)) return false;
  const digits = s.slice(0, -1).split("").reverse().map(Number);
  const check =
    (10 - (digits.reduce((n, d, i) => n + d * (i % 2 === 0 ? 3 : 1), 0) % 10)) %
    10;
  return check === Number(s.at(-1));
}
export function suggestIngredient(name, ingredients) {
  const words = String(name)
    .toLowerCase()
    .replace(/yogurt/g, "yoghurt")
    .split(/\W+/)
    .filter(
      (w) =>
        w.length > 2 &&
        ![
          "tesco",
          "lidl",
          "food",
          "the",
          "and",
          "with",
          "pack",
          "fresh",
        ].includes(w),
    );
  const scores = ingredients
    .map((i) => ({
      id: i.id,
      n: words.reduce(
        (n, w) => n + Number(i.name.toLowerCase().includes(w)),
        0,
      ),
    }))
    .sort((a, b) => b.n - a.n);
  return scores[0]?.n > 0 && scores[0].n > (scores[1]?.n || 0)
    ? scores[0].id
    : "";
}
export function parseReceipt(text, ingredients = []) {
  const rows = [];
  let ignored = 0;
  for (const raw of String(text).slice(0, 20000).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (
      /\b(total|subtotal|saving|discount|change|cash|visa|mastercard|card|clubcard|points|vat|balance|payment|receipt|thank|refund)\b/i.test(
        line,
      ) ||
      /[-−]\s*£?\d+[.,]\d{2}/.test(line)
    ) {
      ignored++;
      continue;
    }
    const match = line.match(/^(.+?)\s+£?\s*(\d{1,4}[.,]\d{2})\s*[A-Z]?$/);
    if (!match || !/[A-Za-z]/.test(match[1])) {
      ignored++;
      continue;
    }
    const name = match[1].trim(),
      count = name.match(/^(\d+)\s*[xX]\s+/),
      packs = count ? Number(count[1]) : 1;
    const cost = Number(match[2].replace(",", "."));
    rows.push({
      name: name.replace(/^\d+\s*[xX]\s+/, ""),
      packs,
      total: cost,
      ingredientId: suggestIngredient(name, ingredients),
      pack: "",
      location: "cupboard",
      expires: "",
      include: false,
    });
  }
  return {
    rows: rows.slice(0, 60),
    ignored,
    warning:
      "Prices are read as line totals. Discounts, multi-buy lines, weighed items and pack sizes need manual checking.",
  };
}

export function nutritionEvidence(recipe, historical, esc) {
  const round = (value) => Math.round(value * 10) / 10;
  const rows = recipe.ingredients
    .map((i) => {
      const quantity = i.calculationQuantity ?? i.quantity;
      const kcal = i.nutrition?.kcal;
      return `<li>${esc(i.name)}: ${esc(round(quantity))} ${esc(i.unit)} × ${Number.isFinite(kcal) ? esc(kcal) : "unknown"} kcal / 100 ${esc(i.unit)} = ${Number.isFinite(kcal) ? esc(round((quantity * kcal) / 100)) : "unknown"} kcal <small>(${esc(i.nutritionSource)})</small></li>`;
    })
    .join("");
  return `<details class="section"><summary>How reliable are these calories?</summary><p>Calculated estimates, not a measurement of what you ate. There is no validated accuracy percentage. We sum each weighed ingredient’s quantity × its per-100 g/ml nutrition, then allocate the batch to portions. Displayed values are rounded.</p>${historical ? "<p><strong>Reference calculation only:</strong> this uses current ingredient labels. Your recorded meal or cooked batch keeps its saved nutrition; new labels do not rewrite it.</p>" : ""}<ul>${rows}</ul><p>Current reference batch: ${esc(recipe.nutrition.kcal)} kcal. Use your actual pack labels and weigh ingredients raw, dry or drained as named, including oils and sauces. Record substitutions separately. Weigh the finished batch and your serving; divide all components evenly. Water changes weight, while discarded oil, sauce or food can also change the calories eaten. Log the amount actually eaten, not just the planned serving.</p></details>`;
}

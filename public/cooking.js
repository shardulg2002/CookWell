const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function instructionList(text) {
  return (
    '<ol class="instruction-list">' +
    text
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean)
      .map(
        (s) =>
          "<li>" +
          esc(s).replace(
            /(\d+(?:\.\d+)?\s*(?:g|ml|°C|minutes?|hours?)\b)/g,
            "<strong>$1</strong>",
          ) +
          "</li>",
      )
      .join("") +
    "</ol>"
  );
}
export function stepAmounts(recipe, step) {
  const items = (recipe.ingredients || []).filter(
    (i) => step.title === "Weigh and prepare" || step.text.includes(i.name),
  );
  return items.length
    ? '<div class="step-amounts"><p class="eyebrow">FOR THIS STEP</p>' +
        items
          .map(
            (i) =>
              '<div class="ingredient"><strong>' +
              i.quantity +
              " " +
              esc(i.unit) +
              "</strong><span>" +
              esc(i.name) +
              "</span></div>",
          )
          .join("") +
        "</div>"
    : "";
}
export function techniqueVisual(recipe, step) {
  const prep = step.title === "Weigh and prepare",
    store = step.title === "Portion and store",
    cold = ["cold", "mash"].includes(recipe.method);
  const picture = prep
    ? '<rect x="65" y="50" width="110" height="55" rx="12"/><path d="M50 35h140l-15 20H65Z"/><rect x="94" y="70" width="52" height="20" rx="4" fill="#fffef9"/><text x="120" y="85" text-anchor="middle" font-size="12" stroke="none" fill="#193f33">0 g</text>'
    : store
      ? '<rect x="28" y="45" width="80" height="54" rx="9"/><rect x="132" y="45" width="80" height="54" rx="9"/><path d="M25 43h86M129 43h86M53 60v25M79 60v25M157 60v25M183 60v25"/>'
      : cold
        ? '<path d="M50 52h140q-10 54-70 54T50 52Z"/><path d="M156 20l-25 61"/><circle cx="89" cy="69" r="7"/><circle cx="112" cy="81" r="6"/>'
        : '<path d="M45 48h138v48H45Z"/><path d="M185 60h40M56 38h117M83 25q-10-10 0-20M112 25q-10-10 0-20M141 25q-10-10 0-20"/>';
  const caption = prep
    ? "Put your bowl on the scales, then press tare to reset to zero."
    : store
      ? "Divide into separate containers so each portion can be stored safely."
      : cold
        ? "Measure, combine and portion."
        : "Check the food as you cook. A timer is a reminder, not a doneness test.";
  const link =
    prep && recipe.items.some((i) => i.id === "onion")
      ? '<a class="link" href="https://www.bbcgoodfood.com/howto/guide/how-cut-onion" target="_blank" rel="noreferrer">Watch: chopping an onion · Good Food ↗</a>'
      : step.title === "Check doneness"
        ? '<a class="link" href="https://www.food.gov.uk/safety-hygiene/cooking-your-food" target="_blank" rel="noreferrer">See the food-temperature guide · FSA ↗</a>'
        : "";
  return (
    '<div class="cook-visual"><svg viewBox="0 0 240 120" role="img" aria-label="' +
    esc(caption) +
    '"><g fill="#dce6b0" stroke="#41684c" stroke-width="3" stroke-linejoin="round">' +
    picture +
    '</g></svg><p class="hint">' +
    esc(caption) +
    "</p>" +
    link +
    "</div>"
  );
}

// Shared by onboarding and server validation so saved appliances never silently disappear.
export const equipmentOptions = [
  ["hob", "Hob / induction"],
  ["oven", "Oven"],
  ["microwave", "Microwave"],
  ["airFryer", "Air fryer"],
  ["riceCooker", "Rice cooker"],
  ["pressureCooker", "Electric pressure cooker / multicooker"],
  ["slowCooker", "Slow cooker"],
  ["kettle", "Kettle"],
  ["toaster", "Toaster"],
  ["blender", "Blender"],
  ["shaker", "Shaker bottle"],
  ["fridge", "Fridge"],
  ["freezer", "Freezer"],
  ["scales", "Kitchen scales"],
  ["thermometer", "Food thermometer"],
];
export const equipmentIds = equipmentOptions.map(([id]) => id);
export const equipmentGroups = [
  {
    label: "Cooking appliances",
    ids: [
      "hob",
      "oven",
      "microwave",
      "airFryer",
      "riceCooker",
      "pressureCooker",
      "slowCooker",
      "kettle",
      "toaster",
    ],
  },
  { label: "Cold storage", ids: ["fridge", "freezer"] },
  {
    label: "Preparation and measuring",
    ids: ["blender", "shaker", "scales", "thermometer"],
  },
];
export const equipmentNote =
  "Choose the appliances you own. A blender can replace a shaker for cold protein drinks. Pressure cooker, air fryer, rice cooker and slow cooker methods are not available yet; selecting one will not replace a hob or oven. Pressure methods need a verified model, capacity and manual.";
export function equipmentLabel(id) {
  return equipmentOptions.find(([value]) => value === id)?.[1] || id;
}

// Feedback is an append-only history. A new choice replaces the old verdict,
// including when a weekly review has a historical meal date.
export function latestRecipeRating(state, recipeId) {
  const feedback = state?.feedback || [];
  for (let i = feedback.length - 1; i >= 0; i--) {
    const entry = feedback[i];
    if (
      entry?.recipeId === recipeId &&
      ["love", "okay", "dislike"].includes(entry.rating)
    )
      return entry.rating;
  }
  return null;
}

export function isRecipeAllowed(state, recipeId) {
  return latestRecipeRating(state, recipeId) !== "dislike";
}

export function ratingButtons(state, recipeId, esc) {
  const rating = latestRecipeRating(state, recipeId),
    id = esc(recipeId),
    button = (value, label) =>
      `<button type="button" class="btn ${rating === value ? "soft" : "outline"}" data-action="recipe-rate" data-id="${id}" data-rating="${value}" aria-pressed="${rating === value}">${label}</button>`;
  const message =
    rating === "love"
      ? "Liked — prioritised in future plans, with room for variety."
      : rating === "dislike"
        ? "Disliked — excluded from future plans. Your current meals are unchanged."
        : "Your choice helps plan meals you enjoy.";
  return `<div class="recipe-rating"><div class="row" role="group" aria-label="Recipe preference">${button("love", "Like")}${button("dislike", "Dislike")}${rating && rating !== "okay" ? button("okay", "Clear preference") : ""}</div><p class="hint">${message}</p></div>`;
}

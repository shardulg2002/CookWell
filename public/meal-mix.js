export const mealMixOptions = [
  ["varied", "No fixed meat/fish frequency"],
  ["half", "About half of main meals"],
  ["most", "Most main meals, with some vegetarian variety"],
];
export const hasMeatOrFish = (recipe) =>
  !!recipe?.items?.some((i) => ["chicken", "tuna", "salmon"].includes(i.id));
export function mealMixReport(profile, meals, lookup) {
  const mains = meals.filter(
    (m) =>
      ["lunch", "dinner"].includes(m.slot) &&
      !["out", "skipped"].includes(m.status),
  );
  const mode = ["omnivore", "pescatarian"].includes(profile.diet)
    ? profile.mainMealMix || "varied"
    : "varied";
  const count = mains.filter((m) => hasMeatOrFish(lookup(m.recipeId))).length;
  const min =
    mode === "most"
      ? Math.ceil(mains.length * 0.6)
      : mode === "half"
        ? Math.floor(mains.length * 0.4)
        : 0;
  const max =
    mode === "most"
      ? Math.ceil(mains.length * 0.8)
      : mode === "half"
        ? Math.ceil(mains.length * 0.6)
        : mains.length;
  return {
    mode,
    total: mains.length,
    count,
    min,
    max,
    met: count >= min && count <= max,
  };
}

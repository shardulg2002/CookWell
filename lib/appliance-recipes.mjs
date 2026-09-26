// Starting points, not manufacturer-calibrated temperature settings.
export function adaptRecipeForEquipment(recipe, profile = {}) {
  const induction =
    profile?.equipment?.includes("hob") &&
    profile.hobType === "induction" &&
    profile.hobScale === "1-9";
  const blender =
    profile?.equipment?.includes("blender") &&
    !profile.equipment.includes("shaker");
  const cookingNotes = [];
  if (induction && recipe.equipment.includes("hob"))
    cookingNotes.push(
      "Induction levels are starting suggestions, not temperatures or CDA model-specific settings. Adjust to the simmer or sizzle described. Do not use boost for oil or preheat an empty pan. Follow your hob and pan manuals.",
    );
  return {
    ...recipe,
    cookingNotes,
    steps: recipe.steps.map((step, index) => {
      let text = step.text;
      if (index === 0 && cookingNotes.length)
        text += " " + cookingNotes.join(" ");
      if (induction && recipe.equipment.includes("hob")) {
        text = text
          .replace(
            /medium heat/gi,
            "medium heat (start at level 4–5 of 9; reduce if smoking or browning too fast)",
          )
          .replace(
            /cook on low/gi,
            "cook on low (start at level 2–3 of 9; maintain gentle bubbles)",
          )
          .replace(
            /simmer gently/gi,
            "simmer gently (start at level 2–3 of 9; lower if bubbling vigorously)",
          );
        if (/bring.*boil/i.test(text))
          text +=
            " To bring water to the boil, try level 7–8 of 9, watch continuously, then reduce as directed; avoid boiling over.";
      }
      if (blender && recipe.equipment.includes("shaker")) {
        text = text
          .replace(/shaker bottle/gi, "blender jug")
          .replace(/shaker/gi, "blender jug")
          .replace(
            /shake for 20–30 seconds until mixed/gi,
            "blend briefly until mixed, following your blender manual and maximum fill mark",
          );
        text +=
          " Use cold ingredients only. Fit the lid before blending and switch off before opening.";
      }
      if (
        profile?.equipment?.includes("blender") &&
        recipe.method === "mash" &&
        step.title === "Mash and serve"
      ) {
        text +=
          " Optional: blend only the measured chickpeas, oil and spice in a suitable cold-food blender, using short pulses according to its manual. Add 5 ml drinking water at a time only if needed; water adds no calories. Keep carrot sticks separate. Switch off before opening or scraping; do not add unmeasured oil.";
      }
      return { ...step, text };
    }),
  };
}

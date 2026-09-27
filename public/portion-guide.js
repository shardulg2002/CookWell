export function portionGuide(recipe, portions, esc) {
  if (!Number.isFinite(portions) || portions < 1) return "";
  const round = (n) => Math.round(n * 10) / 10;
  return `<section class="notice section" aria-label="Batch portion size"><h3>Make ${portions} equal portion${portions === 1 ? "" : "s"}</h3><p><strong>One portion = 1/${portions} of this recipe batch${Number.isFinite(recipe.nutrition?.kcal) ? ` · approximately ${round(recipe.nutrition.kcal / portions)} kcal` : ""}.</strong> Use ${portions} containers, or serve one now and store the remaining portions.</p><details><summary>Ingredient amounts in one equal portion</summary><ul>${recipe.ingredients.map((i) => `<li>${esc(i.name)}: ${round(i.quantity / portions)} ${esc(i.unit)}</li>`).join("")}</ul><p>These are recipe ingredient amounts (raw, dry or drained as named), not finished food weights.</p></details><p><strong>After cooking:</strong> weigh the finished food without its container, then divide by ${portions}. Enter that total at “Confirm prepared” to calculate grams per portion and save it in Kitchen.</p><p>For separate components, weigh and divide each separately: cooked rice ÷ ${portions}, curry ÷ ${portions}. Put one share of each in every container. Do not use total weight alone to divide an uneven mixture.</p></section>`;
}
export function withPortionSteps(dish) {
  const count = dish.portions;
  if (!Number.isFinite(count) || count < 1 || dish.recipe.freshAssembly)
    return dish;
  return {
    ...dish,
    recipe: {
      ...dish.recipe,
      steps: dish.recipe.steps.map((step) =>
        step.title !== "Portion and store"
          ? step
          : {
              ...step,
              text: `This recipe batch makes ${count} equal portions. Each portion is 1/${count} of the batch. Weigh the finished food without its container and divide that weight by ${count} to get grams per portion. For separate rice and sauce, weigh each component and divide each by ${count}; give every container one share of each. Enter the whole batch weight when confirming preparation to save grams per portion. ${step.text}`,
            },
      ),
    },
  };
}

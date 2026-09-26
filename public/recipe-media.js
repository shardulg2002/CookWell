// Only exact recipe matches receive an image; others retain the neutral dish mark.
const assets = {
  "eggs-toast": "eggs-toast",
  dhal: "dhal",
  "chicken-bean-rice": "chicken-bean-rice",
};
export const hasRecipeImage = (recipe) => !!assets[recipe?.id];
export function recipeMedia(recipe, { hero = false } = {}) {
  const name = assets[recipe?.id];
  return name
    ? `<figure class="recipe-media ${hero ? "recipe-media-hero" : ""}"><img src="/images/${name}.png" alt="" loading="${hero ? "eager" : "lazy"}" width="1024" height="1024"><figcaption>AI illustration</figcaption></figure>`
    : `<div class="recipe-media recipe-media-fallback ${hero ? "recipe-media-hero" : ""}" aria-hidden="true"><span>◒</span></div>`;
}

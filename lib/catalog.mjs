// All quantities refer to edible raw/dry/drained weight. Generic values are estimates.
const nutrientKeys = ["kcal", "protein", "carbs", "fat", "fibre", "salt"];
function ingredient(
  id,
  name,
  unit,
  pack,
  price,
  values,
  allergens = [],
  group = "Cupboard",
  diet = "vegan",
) {
  return {
    id,
    name,
    unit,
    pack,
    price,
    allergens,
    group,
    diet,
    nutrition: Object.fromEntries(
      nutrientKeys.map((k, i) => [k, values[i] || 0]),
    ),
    nutritionSource: "Generic ingredient estimate per 100 " + unit,
    source: "Estimate — check your pack",
    checkedAt: null,
    url: null,
  };
}
export const ingredients = [
  ingredient(
    "oats",
    "Rolled oats (dry)",
    "g",
    1000,
    135,
    [370, 12, 60, 8, 9, 0.01],
    ["gluten"],
  ),
  ingredient(
    "rice",
    "Brown rice (dry)",
    "g",
    1000,
    160,
    [360, 7.5, 76, 2.8, 3.5, 0.01],
  ),
  ingredient(
    "pasta",
    "Wholewheat pasta (dry)",
    "g",
    500,
    85,
    [348, 13, 65, 2.5, 8, 0.01],
    ["gluten"],
  ),
  ingredient(
    "bread",
    "Wholemeal bread",
    "g",
    800,
    85,
    [235, 10, 39, 3, 6, 0.9],
    ["gluten"],
  ),
  ingredient(
    "chicken",
    "Skinless chicken breast (raw)",
    "g",
    1000,
    650,
    [106, 24, 0, 1.1, 0, 0.15],
    [],
    "Protein",
    "omnivore",
  ),
  ingredient(
    "tuna",
    "Tuna in spring water (drained)",
    "g",
    102,
    95,
    [110, 25, 0, 1, 0, 0.8],
    ["fish"],
    "Protein",
    "pescatarian",
  ),
  ingredient(
    "salmon",
    "Salmon fillet (raw)",
    "g",
    240,
    375,
    [208, 20, 0, 13, 0, 0.1],
    ["fish"],
    "Protein",
    "pescatarian",
  ),
  ingredient(
    "egg",
    "Egg (without shell; ~50 g each)",
    "g",
    600,
    265,
    [143, 13, 0.7, 10, 0, 0.35],
    ["egg"],
    "Protein",
    "vegetarian",
  ),
  ingredient(
    "tofu",
    "Firm tofu (drained)",
    "g",
    300,
    180,
    [120, 13, 2, 7, 1, 0.1],
    ["soy"],
    "Protein",
  ),
  ingredient(
    "yoghurt",
    "Greek style natural yoghurt",
    "g",
    500,
    115,
    [99, 3.7, 4.2, 7.5, 0, 0.1],
    ["milk"],
    "Chilled",
    "vegetarian",
  ),
  ingredient(
    "milk",
    "Semi-skimmed milk (recipe ingredient)",
    "ml",
    1000,
    110,
    [47, 3.6, 4.8, 1.7, 0, 0.1],
    ["milk"],
    "Chilled",
    "vegetarian",
  ),
  ingredient(
    "cheese",
    "Cheddar",
    "g",
    400,
    250,
    [416, 25, 0.1, 35, 0, 1.8],
    ["milk"],
    "Chilled",
    "vegetarian",
  ),
  ingredient(
    "chickpea",
    "Chickpeas (drained)",
    "g",
    240,
    41,
    [125, 7.8, 15.6, 2.4, 5.2, 0.01],
  ),
  ingredient(
    "beans",
    "Kidney beans (drained)",
    "g",
    240,
    50,
    [100, 7, 14, 0.5, 6, 0.1],
  ),
  ingredient(
    "lentil",
    "Red lentils (dry)",
    "g",
    500,
    150,
    [320, 24, 49, 1.5, 11, 0.01],
  ),
  ingredient(
    "tomato",
    "Chopped tinned tomatoes",
    "g",
    400,
    45,
    [22, 1.1, 3.6, 0.2, 1, 0.1],
  ),
  ingredient(
    "onion",
    "Onion",
    "g",
    1000,
    100,
    [40, 1.1, 8, 0.1, 1.7, 0.01],
    [],
    "Produce",
  ),
  ingredient(
    "pepper",
    "Bell pepper",
    "g",
    450,
    165,
    [26, 1, 5, 0.3, 2, 0.01],
    [],
    "Produce",
  ),
  ingredient(
    "spinach",
    "Spinach",
    "g",
    200,
    125,
    [23, 2.9, 1.4, 0.4, 2.2, 0.2],
    [],
    "Produce",
  ),
  ingredient(
    "carrot",
    "Carrot",
    "g",
    1000,
    69,
    [41, 0.9, 7, 0.2, 2.8, 0.1],
    [],
    "Produce",
  ),
  ingredient(
    "potato",
    "Potato",
    "g",
    2000,
    150,
    [77, 2, 17, 0.1, 2.2, 0.01],
    [],
    "Produce",
  ),
  ingredient(
    "apple",
    "Apple (edible part)",
    "g",
    650,
    150,
    [52, 0.3, 12, 0.2, 2.4, 0.01],
    [],
    "Produce",
  ),
  ingredient(
    "banana",
    "Banana (peeled)",
    "g",
    600,
    100,
    [89, 1.1, 20, 0.3, 2.6, 0.01],
    [],
    "Produce",
  ),
  ingredient(
    "berries",
    "Frozen berries",
    "g",
    500,
    230,
    [45, 0.8, 7, 0.3, 4, 0.01],
    [],
    "Frozen",
  ),
  ingredient(
    "veg",
    "Frozen mixed vegetables",
    "g",
    1000,
    110,
    [49, 3, 6, 0.5, 4, 0.1],
    [],
    "Frozen",
  ),
  ingredient("oil", "Olive oil", "ml", 500, 350, [824, 0, 0, 91.6, 0, 0]),
  ingredient(
    "coconut",
    "Light coconut milk",
    "ml",
    400,
    100,
    [75, 0.5, 2, 7, 0, 0.1],
  ),
  ingredient(
    "peanut",
    "Peanut butter",
    "g",
    340,
    130,
    [600, 25, 12, 49, 7, 0.5],
    ["peanut"],
  ),
  ingredient(
    "spice",
    "Paprika / cumin spice blend (check allergens)",
    "g",
    40,
    100,
    [300, 10, 30, 10, 20, 0.1],
  ),
  ingredient(
    "herbs",
    "Dried mixed herbs",
    "g",
    15,
    80,
    [250, 10, 25, 4, 25, 0.1],
  ),
  ingredient(
    "soy",
    "Soy sauce",
    "ml",
    150,
    90,
    [53, 8, 5, 0, 0, 14],
    ["soy", "gluten"],
  ),
];
Object.assign(
  ingredients.find((i) => i.id === "yoghurt"),
  {
    source: "Tesco online snapshot",
    checkedAt: "2026-09-09",
    url: "https://www.tesco.com/shop/en-GB/products/258170229",
    nutritionSource: "Tesco product label, per 100 g (snapshot 2026-09-09)",
  },
);
Object.assign(
  ingredients.find((i) => i.id === "chickpea"),
  {
    source: "Tesco online snapshot",
    checkedAt: "2026-09-09",
    url: "https://www.tesco.com/shop/en-GB/products/262490576",
    nutritionSource:
      "Tesco product label, per 100 g drained (snapshot 2026-09-09)",
  },
);
Object.assign(
  ingredients.find((i) => i.id === "oats"),
  {
    source: "Tesco online snapshot (availability not guaranteed)",
    checkedAt: "2026-09-09",
    url: "https://www.tesco.com/shop/en-GB/products/267449498",
  },
);
export const ingredientMap = Object.fromEntries(
  ingredients.map((i) => [i.id, i]),
);
const r = (id, title, slots, cuisine, method, items, active = 15) => ({
  id,
  title,
  slots,
  cuisine,
  method,
  active,
  total: method === "stew" ? 40 : method === "oven" ? 40 : active + 5,
  equipment:
    id === "berry-oats"
      ? ["fridge"]
      : ["cold", "mash"].includes(method)
        ? []
        : method === "oven"
          ? ["oven"]
          : ["hob"],
  items: Object.entries(items).map(([id, qty]) => ({ id, qty })),
  spicy: ["Indian", "Mexican", "Thai-inspired"].includes(cuisine),
});
export const recipes = [
  r(
    "berry-oats",
    "Berry overnight oats",
    ["breakfast"],
    "Everyday",
    "cold",
    { oats: 65, yoghurt: 150, berries: 100, peanut: 15 },
    5,
  ),
  r(
    "banana-oats",
    "Banana & peanut oats",
    ["breakfast"],
    "Everyday",
    "cold",
    { oats: 65, milk: 180, banana: 100, peanut: 15 },
    5,
  ),
  r(
    "apple-bowl",
    "Apple yoghurt crunch",
    ["breakfast"],
    "Mediterranean",
    "cold",
    { apple: 150, yoghurt: 200, oats: 50, peanut: 15 },
    5,
  ),
  r(
    "eggs-toast",
    "Spinach eggs on toast",
    ["breakfast"],
    "British",
    "eggs",
    { egg: 100, bread: 100, spinach: 60, oil: 5 },
    12,
  ),
  r(
    "beans-toast",
    "Smoky beans on toast",
    ["breakfast"],
    "British",
    "beans",
    { beans: 150, bread: 100, tomato: 100, spice: 2, oil: 5 },
    12,
  ),
  r(
    "tofu-breakfast",
    "Pepper tofu scramble",
    ["breakfast"],
    "International",
    "stir",
    { tofu: 150, bread: 80, pepper: 70, spice: 2, oil: 5 },
    15,
  ),
  r(
    "banana-snack",
    "Banana & peanut butter",
    ["snack"],
    "Everyday",
    "cold",
    { banana: 120, peanut: 20 },
    2,
  ),
  r(
    "berry-snack",
    "Yoghurt & berries",
    ["snack"],
    "Everyday",
    "cold",
    { yoghurt: 150, berries: 100, oats: 20 },
    2,
  ),
  r(
    "apple-snack",
    "Apple & peanut dip",
    ["snack"],
    "Everyday",
    "cold",
    { apple: 180, peanut: 25 },
    2,
  ),
  r(
    "carrot-dip",
    "Carrots & chickpea mash",
    ["snack"],
    "Middle Eastern",
    "mash",
    { carrot: 150, chickpea: 100, oil: 5, spice: 1 },
    8,
  ),
  r(
    "cheese-toast",
    "Cheddar open sandwich",
    ["snack"],
    "British",
    "cold",
    { bread: 50, cheese: 25, pepper: 60 },
    4,
  ),
  r(
    "tuna-sandwich",
    "Tuna & spinach sandwich",
    ["lunch"],
    "British",
    "cold",
    { tuna: 100, bread: 120, yoghurt: 35, spinach: 50, apple: 100 },
    8,
  ),
  r(
    "bean-salad",
    "Crunchy bean & pepper bowl",
    ["lunch"],
    "Mediterranean",
    "cold",
    {
      beans: 160,
      chickpea: 120,
      pepper: 100,
      spinach: 40,
      bread: 60,
      oil: 8,
      herbs: 1,
    },
    10,
  ),
  r(
    "chicken-curry",
    "Coconut chicken & vegetable rice",
    ["lunch", "dinner"],
    "Thai-inspired",
    "stew",
    {
      chicken: 150,
      rice: 70,
      coconut: 80,
      veg: 150,
      onion: 60,
      oil: 5,
      spice: 3,
    },
    20,
  ),
  r(
    "chickpea-curry",
    "Coconut chickpea curry",
    ["lunch", "dinner"],
    "Thai-inspired",
    "stew",
    {
      chickpea: 180,
      rice: 60,
      coconut: 70,
      spinach: 60,
      onion: 50,
      oil: 5,
      spice: 3,
    },
    18,
  ),
  r(
    "dhal",
    "Red lentil & spinach dhal",
    ["lunch", "dinner"],
    "Indian",
    "stew",
    {
      lentil: 80,
      rice: 65,
      tomato: 150,
      spinach: 70,
      onion: 60,
      oil: 5,
      spice: 3,
    },
    15,
  ),
  r(
    "chicken-pasta",
    "Chicken tomato pasta",
    ["lunch", "dinner"],
    "Italian",
    "pasta",
    {
      chicken: 150,
      pasta: 85,
      tomato: 180,
      spinach: 70,
      onion: 50,
      oil: 5,
      herbs: 2,
    },
    20,
  ),
  r(
    "tuna-pasta",
    "Tuna & tomato wholewheat pasta",
    ["lunch", "dinner"],
    "Italian",
    "pasta",
    { tuna: 120, pasta: 90, tomato: 180, spinach: 60, oil: 7, herbs: 2 },
    15,
  ),
  r(
    "bean-pasta",
    "Tuscan-style bean pasta",
    ["lunch", "dinner"],
    "Italian",
    "pasta",
    { beans: 160, pasta: 85, tomato: 160, onion: 60, oil: 8, herbs: 2 },
    15,
  ),
  r(
    "chilli",
    "Smoky bean & lentil chilli",
    ["lunch", "dinner"],
    "Mexican",
    "stew",
    {
      beans: 160,
      lentil: 40,
      rice: 50,
      tomato: 150,
      pepper: 100,
      onion: 60,
      oil: 5,
      spice: 3,
    },
    20,
  ),
  r(
    "chicken-chilli",
    "Smoky chicken & bean rice",
    ["lunch", "dinner"],
    "Mexican",
    "stew",
    {
      chicken: 130,
      beans: 100,
      rice: 65,
      tomato: 140,
      pepper: 100,
      oil: 5,
      spice: 3,
    },
    20,
  ),
  r(
    "tofu-stir",
    "Spiced tofu vegetable rice",
    ["lunch", "dinner"],
    "East Asian",
    "stir",
    { tofu: 200, rice: 75, veg: 200, oil: 7, soy: 10 },
    20,
  ),
  r(
    "egg-rice",
    "Fresh-cooked egg & vegetable rice",
    ["lunch", "dinner"],
    "East Asian",
    "stir",
    { egg: 100, rice: 80, veg: 200, oil: 7, soy: 10 },
    20,
  ),
  r(
    "chicken-stir",
    "Chicken & colourful vegetable rice",
    ["lunch", "dinner"],
    "East Asian",
    "stir",
    { chicken: 150, rice: 80, veg: 200, oil: 7, soy: 10 },
    20,
  ),
  r(
    "tray-chicken",
    "Herby chicken & potato traybake",
    ["lunch", "dinner"],
    "Mediterranean",
    "oven",
    { chicken: 160, potato: 300, pepper: 120, carrot: 100, oil: 10, herbs: 2 },
    15,
  ),
  r(
    "tray-chickpea",
    "Roasted chickpea & vegetable tray",
    ["lunch", "dinner"],
    "Middle Eastern",
    "oven",
    { chickpea: 180, potato: 250, carrot: 120, onion: 70, oil: 10, spice: 3 },
    15,
  ),
  r(
    "salmon-tray",
    "Salmon, potatoes & greens",
    ["lunch", "dinner"],
    "Mediterranean",
    "oven",
    { salmon: 120, potato: 300, veg: 180, oil: 8, herbs: 2 },
    15,
  ),
  r(
    "lentil-soup",
    "Hearty lentil & carrot soup",
    ["lunch", "dinner"],
    "British",
    "stew",
    {
      lentil: 80,
      carrot: 150,
      tomato: 150,
      onion: 60,
      bread: 80,
      oil: 5,
      herbs: 2,
    },
    15,
  ),
];
export const recipeMap = Object.fromEntries(recipes.map((r) => [r.id, r]));
export function recipeNutrition(recipe, multiplier = 1, overrides = {}) {
  const totals = Object.fromEntries(nutrientKeys.map((k) => [k, 0]));
  for (const { id, qty } of recipe.items)
    for (const k of nutrientKeys)
      totals[k] +=
        ((qty * multiplier) / 100) *
        (overrides[id] || ingredientMap[id].nutrition)[k];
  return Object.fromEntries(
    Object.entries(totals).map(([k, v]) => [k, Math.round(v * 10) / 10]),
  );
}
export function detailedSteps(recipe, multiplier = 1) {
  const q = (id) =>
    `${Math.round((recipe.items.find((i) => i.id === id)?.qty || 0) * multiplier * 10) / 10} ${ingredientMap[id]?.unit} ${ingredientMap[id]?.name}`;
  const list = (ids) =>
    ids
      .filter((id) => recipe.items.some((i) => i.id === id))
      .map(q)
      .join(" + ");
  const has = (id) => recipe.items.some((i) => i.id === id);
  const steps = [];
  const step = (title, text, seconds = 0) =>
    steps.push({ title, text, seconds });
  step(
    "Weigh and prepare",
    `Weigh these ingredients in grams or millilitres.${has("rice") || has("lentil") || has("pasta") ? " Weigh rice, lentils or pasta dry." : ""}${has("beans") || has("chickpea") || has("tuna") ? " Drain canned foods before weighing." : ""} Wash fresh produce.${has("onion") || has("pepper") ? " Cut onion or peppers into roughly 1 cm pieces." : ""}${has("chicken") ? " Weigh chicken raw. Fully defrost frozen chicken in the fridge before cooking. Keep its utensils separate; do not wash raw chicken." : ""}${has("salmon") ? " Fully defrost frozen fish in the fridge before cooking." : ""}${has("berries") ? " Follow the berry pack instructions; cook first if the label requires it." : ""}`,
  );
  if (recipe.method === "cold" || recipe.method === "mash") {
    if (recipe.method === "mash")
      step(
        "Mash and serve",
        `Mash ${list(["chickpea"])} with ${list(["oil", "spice"])} using a fork. Cut ${list(["carrot"])} into sticks and serve with the mash.`,
      );
    else if (has("bread")) {
      step(
        "Make your sandwich or bowl",
        `Combine ${recipe.items
          .filter((i) => !["bread", "apple"].includes(i.id))
          .map((i) => q(i.id))
          .join(
            " + ",
          )}. Serve with ${q("bread")}.${has("apple") ? " Slice " + q("apple") + " and serve on the side." : ""}`,
      );
    } else {
      step(
        "Mix your bowl",
        `Slice any fruit into bite-size pieces. Combine ${recipe.items.map((i) => q(i.id)).join(" + ")} and stir.${recipe.id === "berry-oats" ? " Cover and refrigerate overnight before eating." : ""}`,
      );
    }
  } else {
    if (has("rice"))
      step(
        "Cook the rice",
        `Put ${q("rice")} in a saucepan. Add ${Math.round(recipe.items.find((i) => i.id === "rice").qty * multiplier * 2.5)} ml water initially; use the rice pack's water ratio if different. Bring to a boil, cover, and cook on low for the pack's stated time (typically 25–30 minutes). Check water halfway and add measured water if drying out. Water adds no calories.`,
        1500,
      );
    if (has("pasta"))
      step(
        "Cook the pasta",
        `Bring ${Math.round(recipe.items.find((i) => i.id === "pasta").qty * multiplier * 10)} ml water to a boil. Add ${q("pasta")} and stir. Cook for the time on the pack (usually 10–12 minutes), then drain carefully.`,
        600,
      );
    if (recipe.method === "oven") {
      step(
        "Heat the oven and start vegetables",
        `Preheat to 200°C fan / 220°C conventional. Cut potatoes and carrots into 2 cm pieces. Toss ${list(["potato", "carrot", "pepper", "onion"])} with ${list(["oil", "herbs", "spice"])} on a baking tray. Roast for 15 minutes.`,
        900,
      );
      step(
        "Add protein",
        `${has("chicken") ? "Cut the raw chicken into even 2 cm pieces on its separate board. " : ""}Add ${list(["chicken", "salmon", "chickpea", "veg"])} to the tray. Roast for another ${has("salmon") ? "15–20" : "20–25"} minutes, turning vegetables halfway. Check doneness before serving; timings are only a guide.`,
        has("salmon") ? 900 : 1200,
      );
    } else if (recipe.method === "eggs") {
      step(
        "Wilt the greens",
        `Heat ${list(["oil"])} over medium heat. Add ${list(["spinach"])} and stir for 1–2 minutes.`,
        120,
      );
      step(
        "Scramble",
        `Beat ${list(["egg"])}, pour into the pan and gently stir for 3–5 minutes until fully set. Serve over ${list(["bread"])}.`,
        240,
      );
    } else {
      step(
        "Start the pan",
        `Warm ${list(["oil"])} in a large saucepan on medium heat. ${has("onion") ? `Add ${q("onion")}; stir for 5 minutes until softened.` : "Warm for about 1 minute."}`,
        has("onion") ? 300 : 60,
      );
      if (has("chicken"))
        step(
          "Sear the chicken",
          `Add ${q("chicken")} cut into 2 cm pieces. Cook, stirring, for 6–8 minutes. Browning is only an intermediate step; check doneness after the final simmer.`,
          420,
        );
      const rest = recipe.items.filter(
        (i) =>
          ![
            "rice",
            "pasta",
            "bread",
            "oil",
            "onion",
            "chicken",
            "spinach",
            "egg",
          ].includes(i.id),
      );
      step(
        "Add the measured ingredients",
        `${has("lentil") ? "Rinse the weighed lentils before adding them to the pan. " : ""}Add ${rest.map((i) => q(i.id)).join(" + ")}. ${has("lentil") ? `Add ${Math.round(recipe.items.find((i) => i.id === "lentil").qty * multiplier * 4)} ml water; simmer gently 20–25 minutes until lentils are soft, stirring and adding measured water if needed.` : recipe.method === "stir" ? "Stir-fry 8–10 minutes until vegetables and tofu are hot throughout." : "Simmer gently for 10–15 minutes, stirring occasionally, until vegetables soften."}`,
        has("lentil") ? 1500 : 600,
      );
      if (has("egg"))
        step(
          "Add the eggs",
          `Push vegetables to the side. Pour in ${q("egg")} beaten, and stir over medium heat for 3–5 minutes until completely set. Fold in the freshly cooked rice.`,
          240,
        );
      if (has("spinach"))
        step(
          "Finish the greens",
          `Stir in ${q("spinach")} and cook for 2 minutes until wilted.`,
          120,
        );
      if (has("bread")) step("Add the bread", `Serve alongside ${q("bread")}.`);
    }
    if (has("chicken") || has("salmon"))
      step(
        "Check doneness",
        `Check the thickest part with a clean food thermometer: 70°C for 2 minutes (or an equivalent safe time/temperature). Chicken must be steaming hot with no pink meat and clear juices; fish should be opaque and flake easily. Continue cooking if not ready. Timings alone do not confirm safety.`,
      );
  }
  step(
    "Portion and store",
    `Stir well and divide each component evenly between the planned portions. Weigh the cooked batch (subtract container weight) to divide accurately. ${has("rice") ? "Cool rice quickly, ideally within 1 hour. Refrigerated rice must be eaten within 24 hours; freeze later portions promptly." : "Cool cooked food and refrigerate within 2 hours; use refrigerated leftovers within 48 hours or freeze promptly."} Reheat only once until steaming hot throughout. Defrost in the fridge and use within 24 hours. Record the storage location in the app.`,
  );
  return steps;
}

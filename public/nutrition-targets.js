// The same transparent calculations power planning and the actual food diary.
// These are editable planning estimates, not a glucose-treatment algorithm.
export const macroKeys = Object.freeze([
  "kcal",
  "protein",
  "carbs",
  "fat",
  "fibre",
  "salt",
]);
export const mealShares = Object.freeze({
  breakfast: 0.25,
  lunch: 0.3,
  snack: 0.1,
  dinner: 0.35,
});
const round = (value) => Math.round(value * 10) / 10;
const validNumber = (value) =>
  value !== null &&
  value !== "" &&
  value !== undefined &&
  Number.isFinite(Number(value));
const defaults = Object.freeze({
  mode: "balanced",
  proteinSafety: "unknown",
  shakes: "optional",
});
const choices = {
  mode: ["balanced", "moderate", "custom"],
  proteinSafety: ["unknown", "none", "restricted"],
  shakes: ["never", "optional", "daily"],
};
const limits = {
  protein: [1, 350],
  carbs: [20, 800],
  fat: [5, 300],
  fibre: [1, 100],
  salt: [0.1, 6],
};
const labels = {
  kcal: "Calories",
  protein: "Protein",
  carbs: "Carbohydrates",
  fat: "Fat",
  fibre: "Fibre",
  salt: "Salt",
};
export const nutritionSources = Object.freeze([
  {
    title: "NHS: protein and food sources",
    url: "https://www.merseycare.nhs.uk/protein-packing",
  },
  {
    title: "NHS: daily fibre",
    url: "https://www.nhs.uk/live-well/eat-well/digestive-health/how-to-get-more-fibre-into-your-diet/",
  },
  {
    title: "NHS: daily salt limit",
    url: "https://www.nhs.uk/live-well/eat-well/food-types/salt-in-your-diet/",
  },
  {
    title: "Diabetes UK: individual carbohydrate needs",
    url: "https://www.diabetes.org.uk/living-with-diabetes/eating/carbohydrates-and-diabetes",
  },
  {
    title: "Whey trial: benefits were limited in the studied population",
    url: "https://pubmed.ncbi.nlm.nih.gov/29687650/",
  },
]);

function readSettings(raw = {}, previous = {}) {
  const source = { ...defaults, ...previous, ...raw, ...raw.custom };
  const settings = {};
  for (const [key, allowed] of Object.entries(choices)) {
    if (!allowed.includes(source[key]))
      throw new Error(
        `Choose a valid ${key === "proteinSafety" ? "protein health answer" : key}.`,
      );
    settings[key] = source[key];
  }
  for (const [key, [min, max]] of Object.entries(limits)) {
    if (source[key] === undefined || source[key] === null || source[key] === "")
      continue;
    if (
      !validNumber(source[key]) ||
      Number(source[key]) < min ||
      Number(source[key]) > max
    )
      throw new Error(
        `${labels[key]} target must be between ${min} and ${max} g per day.`,
      );
    settings[key] = round(Number(source[key]));
  }
  return settings;
}

export function validateNutritionSettings(profile, raw = {}) {
  try {
    return validateSettings(profile, raw);
  } catch (error) {
    error.status = 400;
    throw error;
  }
}

function validateSettings(profile, raw) {
  const settings = readSettings(raw, profile?.nutritionSettings);
  if (
    settings.mode === "custom" &&
    ["protein", "carbs", "fat"].some((key) => !validNumber(settings[key]))
  )
    throw new Error(
      "Enter protein, carbohydrate and fat targets for a custom plan.",
    );
  if (
    settings.proteinSafety === "restricted" &&
    (settings.mode !== "custom" || !validNumber(settings.protein))
  )
    throw new Error(
      "Enter your clinician's protein target using custom nutrition targets.",
    );
  const targets = nutritionTargets({ ...profile, nutritionSettings: settings });
  if (!targets.ready)
    throw new Error(
      targets.warnings[targets.warnings.length - 1] ||
        "Check your nutrition targets.",
    );
  return settings;
}

export function nutritionTargets(profile = {}) {
  const warnings = [];
  let settings;
  let ready = true;
  try {
    settings = readSettings(profile.nutritionSettings);
  } catch (error) {
    settings = { ...defaults };
    ready = false;
    warnings.push(error.message);
  }
  const kcal =
    validNumber(profile.calorieTarget) && Number(profile.calorieTarget) > 0
      ? Number(profile.calorieTarget)
      : null;
  const weight =
    validNumber(profile.weight) && Number(profile.weight) > 0
      ? Number(profile.weight)
      : null;
  const coefficient =
    settings.proteinSafety === "none" && profile.goal === "lose" ? 1.2 : 0.75;
  let protein = weight ? round(weight * coefficient) : null;
  let carbs = kcal
    ? round((kcal * (settings.mode === "moderate" ? 0.4 : 0.5)) / 4)
    : null;
  let fat =
    kcal && protein !== null
      ? round((kcal - protein * 4 - carbs * 4) / 9)
      : null;
  let fibre = 30;
  let salt = 6;
  const methodology = [
    "Calories use your saved energy target, which reflects your profile and goal unless you entered a manual target.",
  ];
  if (settings.mode === "custom") {
    protein = settings.protein ?? null;
    carbs = settings.carbs ?? null;
    fat = settings.fat ?? null;
    fibre = settings.fibre ?? 30;
    salt = settings.salt ?? 6;
    methodology.push(
      "Protein, carbohydrates and fat use your entered daily gram targets.",
    );
  } else {
    methodology.push(
      `Protein: ${coefficient} g × your saved weight in kg${coefficient === 1.2 ? "; an editable weight-loss planning suggestion after you reported no known protein restriction" : "; the general UK adult reference"}.`,
    );
    methodology.push(
      `Carbohydrates: ${settings.mode === "moderate" ? "40%" : "50%"} of your calorie target ÷ 4. Fat uses the remaining calories ÷ 9. These are planning choices, not a diabetes prescription.`,
    );
  }
  methodology.push(
    "The 4 kcal/g protein, 4 kcal/g carbohydrate and 9 kcal/g fat calculation is approximate. Fibre, product-label rounding and ingredient estimates can make food calories differ.",
  );
  if (coefficient === 1.2 && settings.mode !== "custom")
    methodology.push(
      "The higher-protein figure is an editable starting estimate, not a proven ideal for you or a promise of better glucose control. Review it with your diabetes team. Protein shakes are not required.",
    );
  methodology.push(
    "Daily planning bands: calories ±5%, carbohydrates ±10%, fat ±15%; aim to reach the protein and fibre targets and stay within the salt limit. These are app tolerances, not clinical thresholds.",
  );
  if (settings.proteinSafety === "unknown")
    warnings.push(
      "Protein restrictions have not been answered. The automatic protein estimate uses the general adult reference; enter personalised advice if it applies to you.",
    );
  if (settings.proteinSafety === "restricted") {
    if (settings.mode !== "custom" || protein === null) {
      protein = null;
      ready = false;
      warnings.push(
        "A protein restriction needs your clinician's custom target before macro planning can be checked.",
      );
    } else {
      methodology.push(
        "For restricted protein, the planning band is 95–100% of your entered amount, with no allowance above it. Enter the amount agreed with your clinician; other clinical dietary restrictions need specialist advice.",
      );
    }
  }
  if (!kcal || (!weight && settings.mode !== "custom")) {
    ready = false;
    warnings.push(
      "Save your weight and calorie target to calculate nutrition targets.",
    );
  }
  if ([protein, carbs, fat].some((value) => value === null || value <= 0)) {
    ready = false;
    warnings.push(
      "These targets do not leave a complete energy allocation. Review the profile or enter custom targets.",
    );
  }
  const energyFromMacros = [protein, carbs, fat].every(
    (value) => value !== null,
  )
    ? round(protein * 4 + carbs * 4 + fat * 9)
    : null;
  if (
    ready &&
    settings.mode === "custom" &&
    Math.abs(energyFromMacros - kcal) > Math.max(100, kcal * 0.1)
  ) {
    ready = false;
    warnings.push(
      `Your entered macros total about ${energyFromMacros} kcal, which does not match your ${kcal} kcal target. Adjust the macros or calorie target.`,
    );
  }
  if (ready && protein * 4 > kcal * 0.3)
    warnings.push(
      "The protein target takes over 30% of your calorie budget. Review it before using this as your regular plan.",
    );
  if (ready && fat * 9 < kcal * 0.15) {
    ready = false;
    warnings.push(
      "This allocation leaves less than 15% of calories for fat. Review the target balance before generating a plan.",
    );
  }
  const values = { kcal, protein, carbs, fat, fibre, salt };
  const ranges = {};
  for (const key of macroKeys) {
    const target = values[key];
    if (target === null) ranges[key] = { min: null, max: null, kind: "range" };
    else if (key === "salt")
      ranges[key] = { min: 0, max: target, kind: "maximum" };
    else if (key === "protein" && settings.proteinSafety === "restricted")
      ranges[key] = { min: round(target * 0.95), max: target, kind: "range" };
    else if (
      key === "fibre" ||
      (key === "protein" && settings.proteinSafety !== "restricted")
    )
      ranges[key] = { min: target, max: null, kind: "minimum" };
    else {
      const tolerance = key === "carbs" ? 0.1 : key === "fat" ? 0.15 : 0.05;
      ranges[key] = {
        min: round(target * (1 - tolerance)),
        max: round(target * (1 + tolerance)),
        kind: "range",
      };
    }
  }
  return {
    values,
    ranges,
    ready,
    settings,
    methodology,
    warnings,
    sources: nutritionSources,
    energyFromMacros,
  };
}

export function assessNutrition(
  totals = {},
  targets,
  { incomplete = false } = {},
) {
  const checks = {};
  const issues = [];
  let penalty = 0;
  let complete = !incomplete;
  for (const key of macroKeys) {
    const target = targets?.values?.[key] ?? null;
    const { min = null, max = null } = targets?.ranges?.[key] || {};
    const actual =
      validNumber(totals[key]) && Number(totals[key]) >= 0
        ? Number(totals[key])
        : null;
    if (actual === null) complete = false;
    let status = "met";
    if (!targets?.ready || target === null) status = "unavailable";
    else if (actual === null) status = "unknown";
    else if (max !== null && actual > max + 0.000001) status = "high";
    else if (incomplete) status = "unknown";
    else if (min !== null && actual < min - 0.000001) status = "low";
    const gap =
      status === "low"
        ? round(min - actual)
        : status === "high"
          ? round(actual - max)
          : 0;
    checks[key] = { actual, target, min, max, status, gap };
    if (status !== "met") issues.push({ key, status, actual, target, gap });
    if (status === "low" || status === "high") {
      const weight =
        key === "kcal"
          ? 4
          : key === "protein" || key === "fibre" || key === "salt"
            ? 3
            : 2;
      // A dimensionless distance makes a gram of salt and a calorie comparable.
      const distance = gap / Math.max(target, 0.1);
      penalty += weight * (distance + distance * distance);
    }
  }
  return {
    met: !!targets?.ready && complete && issues.length === 0,
    complete,
    ready: !!targets?.ready,
    checks,
    issues,
    penalty,
  };
}

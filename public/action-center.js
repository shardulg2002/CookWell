const addDays = (date, amount) =>
  new Date(Date.parse(date + "T12:00:00Z") + amount * 86400000)
    .toISOString()
    .slice(0, 10);

const distance = (from, to) =>
  Math.round(
    (Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) /
      86400000,
  );

export function actionItems(state, plan, today) {
  if (!plan) return [];
  const actions = [];
  const push = (item) => actions.push(item);

  for (const session of plan.sessions || []) {
    if (session.date > today) continue;
    const overdue = session.date < today;
    push({
      id: "cook:" + session.id,
      kind: "cook",
      priority: overdue ? 0 : 1,
      title: overdue ? "Cooking session overdue" : "Cooking session today",
      detail: `${session.dishes.length} dish${session.dishes.length === 1 ? "" : "es"} · ${session.dishes.reduce((n, dish) => n + dish.portions, 0)} servings`,
      label: "Start cooking",
      action: "cook-session",
      target: session.id,
    });
  }

  const trip = (plan.shoppingTrips || []).find((item) => item.date <= today);
  if (trip?.rows?.some((row) => row.packs > 0))
    push({
      id: "shop:" + trip.date,
      kind: "shop",
      priority: trip.date < today ? 0 : 1,
      title:
        trip.date < today ? "Shopping trip overdue" : "Shopping trip today",
      detail: `${trip.rows.filter((row) => row.packs > 0).length} items to check`,
      label: "Open shopping list",
      action: "nav",
      screen: "kitchen",
    });

  for (const item of state.inventory || []) {
    if (!(
      item.quantity > 0 &&
      item.expires &&
      item.expires <= addDays(today, 2)
    ))
      continue;
    const ingredient = state.ingredients?.find(
      (candidate) => candidate.id === item.ingredientId,
    );
    const days = distance(today, item.expires);
    push({
      id: "stock:" + item.id,
      kind: "stock",
      priority: days < 0 ? 0 : days === 0 ? 1 : 2,
      title:
        days < 0
          ? `${ingredient?.name || "Ingredient"} is past its recorded use-by`
          : days === 0
            ? `${ingredient?.name || "Ingredient"} is due today`
            : `${ingredient?.name || "Ingredient"} is due in ${days} days`,
      detail: `${Math.round(item.quantity * 10) / 10} ${ingredient?.unit || ""} in ${item.location}`,
      label: "Check stock",
      action: "stock",
      target: item.id,
    });
  }

  for (const batch of state.batches || []) {
    if (!(
      batch.remaining > 0 &&
      batch.expires &&
      batch.expires <= addDays(today, 1)
    ))
      continue;
    const recipe = state.catalog?.find((item) => item.id === batch.recipeId);
    const days = distance(today, batch.expires);
    push({
      id: "batch:" + batch.id,
      kind: "batch",
      priority: days < 0 ? 0 : 1,
      title:
        days < 0
          ? `${recipe?.title || "Cooked food"} is past its recorded use-by`
          : `${recipe?.title || "Cooked food"} should be used today`,
      detail: `${batch.remaining} portion${batch.remaining === 1 ? "" : "s"} in ${batch.location}`,
      label: "Open kitchen",
      action: "nav",
      screen: "kitchen",
    });
  }

  const end = addDays(plan.start, 6);
  if (
    end <= today &&
    !(state.reviews || []).some((review) => review.planId === plan.id)
  )
    push({
      id: "review:" + plan.id,
      kind: "review",
      priority: end < today ? 1 : 2,
      title: "Weekly review ready",
      detail: "Tell CookWell what worked so the next plan can learn.",
      label: "Review week",
      action: "weekly-review",
    });

  const loggedToday = (state.logs || []).some((log) => log.date === today);
  if (!loggedToday)
    push({
      id: "checkin:" + today,
      kind: "checkin",
      priority: 3,
      title: "Optional health check-in",
      detail: "Record only the measures you chose to track today.",
      label: "Open progress",
      action: "nav",
      screen: "progress",
    });

  return actions
    .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title))
    .slice(0, 6);
}

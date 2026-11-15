export function mergeConfirmedDeals(current, incoming) {
  const updates = new Map();
  for (const deal of incoming) {
    if (!updates.has(deal.id) || deal.version > updates.get(deal.id).version)
      updates.set(deal.id, deal);
  }
  let changed = false;
  const next = current.map((deal) => {
    const update = updates.get(deal.id);
    if (!update || update.version <= deal.version) return deal;
    changed = true;
    return update;
  });
  return changed ? next : current;
}

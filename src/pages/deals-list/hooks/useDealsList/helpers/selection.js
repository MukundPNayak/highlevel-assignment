export function toggleDealSelection(current, deal) {
  const next = new Map(current);
  if (next.has(deal.id)) next.delete(deal.id);
  else next.set(deal.id, { id: deal.id, expectedVersion: deal.version });
  return next;
}

export function togglePageSelection(current, deals) {
  const next = new Map(current);
  const allSelected = deals.every(({ id }) => current.has(id));

  for (const deal of deals) {
    if (allSelected) next.delete(deal.id);
    else if (!next.has(deal.id)) {
      next.set(deal.id, { id: deal.id, expectedVersion: deal.version });
    }
  }

  return next;
}

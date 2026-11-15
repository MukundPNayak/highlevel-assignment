import { CLOSED_STAGES } from '../constants/stages.js';

/** Activity sorts group open deals first; other sorts apply across all records.
 * Never mutate the input. Always break ties by ID.
 */
export function orderDeals(deals, sort = 'activity-asc') {
  return [...deals].sort((a, b) => {
    let comparison;
    switch (sort) {
      case 'value-desc':
        comparison = b.value - a.value;
        break;
      case 'value-asc':
        comparison = a.value - b.value;
        break;
      case 'company-asc':
        comparison = a.companyName.localeCompare(b.companyName, 'en');
        break;
      case 'company-desc':
        comparison = b.companyName.localeCompare(a.companyName, 'en');
        break;
      default:
        comparison =
          Number(CLOSED_STAGES.has(a.stage)) - Number(CLOSED_STAGES.has(b.stage)) ||
          (sort === 'activity-desc'
            ? b.lastActivityAt - a.lastActivityAt
            : a.lastActivityAt - b.lastActivityAt);
    }
    return comparison || a.id.localeCompare(b.id);
  });
}

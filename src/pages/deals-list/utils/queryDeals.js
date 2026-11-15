import { CLOSED_STAGES } from '../constants/stages.js';
import { DAY_MS } from '../constants/time.js';
import { orderDeals } from './orderDeals.js';

/** Filter the complete dataset before ordering and pagination.
 * @param {number} [now] Current time for this calculation; injectable for deterministic tests.
 */
export function queryDeals(deals, query, now = Date.now()) {
  const search = query.search.trim().toLowerCase();
  const stages = new Set(query.stages);
  const ownerId = query.ownerId;
  const cutoff = query.inactiveDays === '' ? null : now - query.inactiveDays * DAY_MS;

  const matches = deals.filter((deal) => {
    if (ownerId && deal.ownerId !== ownerId) return false;
    if (
      search &&
      !deal.companyName.toLowerCase().includes(search) &&
      !deal.id.toLowerCase().includes(search)
    )
      return false;
    if (stages.size && !stages.has(deal.stage)) return false;
    if (cutoff !== null && (CLOSED_STAGES.has(deal.stage) || deal.lastActivityAt > cutoff))
      return false;
    return true;
  });
  return orderDeals(matches, query.sort);
}

import { DAY_MS } from '../constants/time.js';
import {
  DEAL_COUNT,
  STAGE_DISTRIBUTION,
  OWNERS,
  COMPANY_NAMES,
  INDUSTRIES,
} from '../constants/mockData.js';

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Generate the milestone's fixed-volume dataset. Same seed/time gives the same data.
 * @param {{ seed?: number, referenceTime?: number }} [options]
 */
export function generateDeals({ seed = 42, referenceTime = Date.now() } = {}) {
  const random = createRandom(seed);
  const stagePool = Object.entries(STAGE_DISTRIBUTION).flatMap(([id, count]) =>
    Array(count).fill(id),
  );
  // Shuffle so stage and deal ID do not encode the same ordering.
  for (let i = stagePool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [stagePool[i], stagePool[j]] = [stagePool[j], stagePool[i]];
  }
  const deals = Array.from({ length: DEAL_COUNT }, (_, index) => {
    const company = COMPANY_NAMES[Math.floor(random() * COMPANY_NAMES.length)];
    const industry = INDUSTRIES[Math.floor(random() * INDUSTRIES.length)];
    const lastActivityAt = referenceTime - Math.floor(random() * 180 * DAY_MS);
    return {
      id: `deal-${String(index + 1).padStart(5, '0')}`,
      companyName: `${company} ${industry} ${String(index + 1).padStart(5, '0')}`,
      ownerId: OWNERS[Math.floor(random() * OWNERS.length)].id,
      stage: stagePool[index],
      value: (10 + Math.floor(random() * 4991)) * 1000,
      lastActivityAt,
      updatedAt: lastActivityAt + Math.floor(random() * (referenceTime - lastActivityAt)),
      version: 1,
    };
  });
  return deals;
}

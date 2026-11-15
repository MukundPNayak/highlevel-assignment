import { STAGE_LABELS } from '../constants/stages.js';
import { DEFAULT_SIMULATION_SETTINGS } from '../constants/simulation.js';
import { INITIAL_QUERY } from '../constants/filters.js';
import { PAGE_SIZE } from '../constants/pagination.js';
import { generateDeals } from '../data/generateDeals.js';
import { queryDeals } from '../utils/queryDeals.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Authoritative in-memory store. Reads and successful writes return complete copies. */
export function createDealsApi(
  deals = generateDeals(),
  { random = Math.random, now = Date.now, wait = delay, settings: overrides = {} } = {},
) {
  const store = new Map(deals.map((deal) => [deal.id, { ...deal }]));
  let settings = { ...DEFAULT_SIMULATION_SETTINGS };

  function setSettings(changes) {
    const next = { ...settings, ...changes };
    if (
      !Number.isFinite(next.minLatencyMs) ||
      !Number.isFinite(next.maxLatencyMs) ||
      next.minLatencyMs < 0 ||
      next.maxLatencyMs < next.minLatencyMs ||
      next.maxLatencyMs > 10_000 ||
      !Number.isFinite(next.failureRate) ||
      next.failureRate < 0 ||
      next.failureRate > 1
    ) {
      throw new Error(
        'Use delays from 0–10,000 ms, minimum no greater than maximum, and failure rate from 0–100%.',
      );
    }
    settings = next;
  }
  setSettings(overrides);

  async function pause(config) {
    await wait(config.minLatencyMs + random() * (config.maxLatencyMs - config.minLatencyMs));
  }

  function applyStageChange({ id, targetStage, expectedVersion }, config) {
    const current = store.get(id);
    if (
      !current ||
      !Object.hasOwn(STAGE_LABELS, targetStage) ||
      !Number.isInteger(expectedVersion)
    ) {
      return { kind: 'invalid', message: 'The deal or requested stage is invalid.' };
    }
    // No await between version validation and commit, for both single and bulk writes.
    if (current.version !== expectedVersion) {
      return {
        kind: 'conflict',
        latest: { ...current },
        message:
          'This deal changed after you loaded or selected it. Review the latest stage before saving again.',
      };
    }
    if (current.stage === targetStage) return { kind: 'noop', deal: { ...current } };
    if (random() < config.failureRate) {
      return {
        kind: 'network-error',
        message: 'The stage could not be saved. Nothing was changed. You can retry.',
      };
    }
    const updated = {
      ...current,
      stage: targetStage,
      version: current.version + 1,
      updatedAt: now(),
    };
    store.set(id, updated);
    return { kind: 'success', deal: { ...updated } };
  }

  return {
    getSettings: () => ({ ...settings }),
    setSettings,
    async listDeals({ query = INITIAL_QUERY, page = 0, pageSize = PAGE_SIZE } = {}) {
      if (
        !Number.isInteger(page) ||
        page < 0 ||
        !Number.isInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 100
      ) {
        throw new Error(
          'Invalid pagination. Use a nonnegative page and a page size from 1 to 100.',
        );
      }
      const requestQuery = { ...INITIAL_QUERY, ...query, stages: [...(query.stages || [])] };
      await pause({ ...settings });
      const matching = queryDeals([...store.values()], requestQuery, now());
      const total = matching.length;
      const currentPage = Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1));
      return {
        items: matching
          .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
          .map((deal) => ({ ...deal })),
        total,
        page: currentPage,
        pageSize,
      };
    },
    async getDeal(id) {
      await pause({ ...settings });
      const deal = store.get(id);
      if (!deal) throw new Error('This deal could not be found.');
      return { ...deal };
    },
    async updateDealStage({ id, targetStage, expectedVersion }) {
      const config = { ...settings };
      await pause(config);
      return applyStageChange({ id, targetStage, expectedVersion }, config);
    },
    async bulkUpdateDealStage({ deals: entries, targetStage }) {
      if (
        !Array.isArray(entries) ||
        !entries.length ||
        new Set(entries.map(({ id }) => id)).size !== entries.length
      ) {
        throw new Error('Select at least one deal, with no duplicate IDs.');
      }
      const inputs = entries.map(({ id, expectedVersion }) => ({
        id,
        expectedVersion,
        targetStage,
      }));
      const config = { ...settings };
      // One logical request and one simulated delay for the explicitly selected IDs.
      await pause(config);
      return inputs.map((input) => ({
        id: input.id,
        companyName: store.get(input.id)?.companyName,
        ...applyStageChange(input, config),
      }));
    },
  };
}

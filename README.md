# Deals List

A React implementation of the HighLevel frontend assignment for managing 50,000 deals. It provides search, filtering, sorting, single-deal stage changes, and bulk stage changes through an in-app fake API.

Built with JavaScript, React 19, Vite, and plain CSS. Tests use Vitest and JSDOM.

## Run locally

Use Node.js 24+ and npm. From the repository directory:

```sh
npm ci && npm run dev
```

For Windows PowerShell:

```powershell
npm.cmd ci; if ($LASTEXITCODE -eq 0) { npm.cmd run dev }
```

Open the address printed by Vite, normally **http://127.0.0.1:5173**. No environment variables, external services, login, or backend setup are required.

To build and serve the production bundle:

```sh
npm run build
npm run preview
```

All data is generated in memory. Reloading the browser resets changes. Each browser tab has an independent fake API instance.

## Features

- **Deal discovery:** search by company or deal ID, filter by owner and multiple stages, and find open deals inactive for 7+, 30+, 60+, or 90+ days.
- **Applied filters:** filter choices remain drafts until Apply. Search is debounced by 250 ms; sorting and removing applied-filter chips take effect immediately.
- **Sorting:** oldest/newest activity, highest/lowest value, and company A-Z/Z-A, with stable ID tie-breaking. Activity sorting places open deals before Won/Lost.
- **Pagination:** 25, 50, or 100 rows per page, defaulting to 50. The API filters and sorts before returning the requested page and matching count.
- **Single stage changes:** a horizontal three-dot row menu opens a modal that fetches the latest deal before showing its current stage. Any stage transition is allowed.
- **Bulk stage changes:** select rows individually or use the current-page header checkbox. Manually selected IDs remain selected across page navigation. One API request attempts every selected deal, including selections on other pages.
- **Failure recovery:** pending controls are disabled, failed saves can be retried, and bulk results distinguish saved, already-in-stage, failed, conflicting, and invalid records. Bulk retry resends only failed records.
- **Explicit refresh:** refresh from the table heading or the updated-results banner. Refresh reapplies the current query and preserves the page where possible.
- **Keyboard support:** native controls, labelled checkboxes, visible focus styles, arrow navigation between row checkboxes, keyboard-operated action menus, and native modal dialogs.

## Key decisions

### A table with API pagination

A table makes it easy to compare company, stage, owner, value, and last activity. Pagination bounds the rendered rows without requiring a board, virtualization, or a table library.

The fake API privately owns all 50,000 records. React stores only the current page of complete deals, the matching count, query/pagination state, and selection metadata. Navigation fetches again and replaces the previous page.

The sample data includes all seven stages, with 12,000 New Lead deals and 10,000 Contacted deals. There are 30 sample owners to exercise the owner filter.

### Confirmed updates and stable rows

The table changes a deal's stage only after the API confirms it. Confirmed updates replace visible records without immediately changing row membership, ordering, or the matching count. A banner offers Refresh to reconcile those results.

Bulk updates attempt all selected records in the API; only currently displayed records need updating in React. Other pages fetch their updated records when visited. Older list responses cannot overwrite newer requests.

### Selection and conflicts

Selection stores only `{ id, expectedVersion }` per deal. The header checkbox affects the current page; there is no Select all matching option. Query and page-size changes clear selection. Explicit refresh clears it after a successful response.

Single and bulk saves validate the expected version before committing. A stale save returns a conflict with the latest deal instead of overwriting newer data. Single-deal conflicts require explicit review before another save. Bulk conflicts require review or a new selection; they are not automatically retried.

A bulk operation retains outcome metadata for the summary and failed-only retries. Successful records remain committed when other records fail.

## Fake API

The service is created once in `src/main.jsx` and passed into the page.

| Method                                                  | Contract                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `listDeals({ query, page, pageSize })`                  | Returns `{ items, total, page, pageSize }`; pages are zero based and out-of-range pages are clamped. |
| `getDeal(id)`                                           | Returns the latest complete deal.                                                                    |
| `updateDealStage({ id, targetStage, expectedVersion })` | Returns a confirmed deal or a structured failure/conflict.                                           |
| `bulkUpdateDealStage({ deals, targetStage })`           | Accepts ID/version entries and returns an independent outcome for each selected deal.                |

Reads and writes simulate 300-1,500 ms latency. Eligible saves independently fail about 10% of the time, before committing. A bulk operation has one simulated request delay. Deals already in the target stage are skipped after version validation.

To adjust simulation defaults, edit [simulation.js](src/pages/deals-list/constants/simulation.js) and reload:

```js
export const DEFAULT_SIMULATION_SETTINGS = {
  minLatencyMs: 300,
  maxLatencyMs: 1500,
  failureRate: 0.1,
};
```

For repeatable save testing, use `failureRate: 0` for successful saves or `failureRate: 1` for failures. Reads do not randomly fail. Tests can inject delays, randomness, and a clock when constructing the API.

## Project structure

```text
src/
  main.jsx
  App.jsx
  pages/deals-list/
    DealsListPage.jsx
    deals-list.css
    api/                  # Authoritative fake API and version checks
    components/
      table/
      filters/
      deal-actions/
      bulk-actions/
    constants/            # Stages, filters, pagination, mock data, simulation
    data/                 # Seeded deal generator
    hooks/
      useDealsList/       # Page requests, selection, confirmed visible updates
        helpers/
      useBulkStageChange.js
    utils/                # Query and ordering helpers used by the fake API
```

Components are grouped by responsibility. Hooks use ordinary React state with focused helpers; no reducer or external state-management library is required. Tests are colocated with the code they exercise.

## Checks

```sh
npm run lint
npm run format:check
npm test
npm run build
```

Use `npm.cmd` in PowerShell if script execution policy blocks `npm.ps1`. Run `npm run format` to format the project.

Tests cover data generation, filtering/sorting, API pagination, version conflicts, failed saves, out-of-order responses, selection across pages, partial bulk failures, retries, and component interactions. JSDOM uses a dialog shim; these tests do not measure rendering performance or prove native browser focus containment.

## Limitations and next steps

- **Teammate-change simulation, automatic live updates, and runtime simulation controls are deferred.** The assignment's live-update demonstration is therefore incomplete. Version-conflict handling is implemented and tested, but background teammate changes are not generated.
- Data is not persisted or shared between browser tabs. There is no real network transport.
- Bulk selection is manual across visited pages. Selecting thousands of deals requires visiting those pages; there is no query-wide selection.
- Bulk feedback shows a pending state followed by per-record results, without incremental progress.
- Undo is not implemented. Confirmation precedes saves, and failed saves support retry.
- Simulated failures happen before commit. Offline recovery, interrupted requests with an unknown commit outcome, and idempotency are not modeled.

With more time, the next priorities would be reviewer-adjustable teammate simulation, safe live-update reconciliation, a more efficient large-selection workflow, and measured browser performance/accessibility checks.

[Design notes](docs/deals-list-design.md) contain planning history and superseded proposals. This README describes the current implementation.

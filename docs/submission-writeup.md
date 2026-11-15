# Deals List: Design and Engineering Decisions

## What I built and why

I built a React screen for finding and updating deals in a shared dataset of 50,000 records. It supports search, owner and stage filters, inactivity thresholds, sorting, pagination, single-deal stage changes, and bulk changes across manually selected pages.

I chose a table because the main workflow is comparing deals and deciding which ones need attention. Company, stage, owner, value, and last activity remain visible together. Activity sorting places open deals first, and inactivity filtering excludes Won and Lost. These choices help users identify work without navigating a large board.

The fake API owns the complete dataset and performs filtering, sorting, and pagination. React retains only the current page of deals, the total matching count, query settings, and selection metadata. Moving between pages makes a fresh request. This keeps the UI's data boundary similar to an application with a real backend, although the fake service still runs inside the browser.

## Key UX decisions and alternatives

Filters open in a single panel. Users can choose an owner, multiple stages, and an inactivity threshold before pressing Apply. Search and sorting remain directly accessible. I chose explicit filter application to avoid fetching intermediate combinations while someone is still making choices.

Stage changes use a row menu and confirmation modal. The modal fetches the latest deal before presenting its current stage. I chose this over inline editing to make the change deliberate and provide a clear place for loading, failure, and conflict feedback. All stage transitions are allowed; the prototype does not invent additional business rules.

The header checkbox selects the current page only. Individual selections persist across page navigation as ID/version pairs. There is no implicit selection of every matching record. This makes the action's scope explicit, at the cost of a slower workflow when selecting thousands of deals.

After a confirmed update, visible cells change while row membership, ordering, and the count remain stable. A banner offers Refresh to fetch the correct results for the active query. I chose explicit reconciliation over immediately moving or removing rows while the user is working. Refresh preserves the page where possible and clears selection only after success.

## Failed saves and concurrent changes

Updates are pessimistic: the table retains its confirmed stage until the API succeeds. Pending controls are disabled, with immediate request guards preventing duplicate submissions. The fake API simulates 300-1,500 ms delays and approximately 10% save failures before committing. Defaults can be changed in a constants file.

Each update includes the deal's expected version. The API checks that version before committing and returns the complete saved deal. A mismatch returns a conflict and the latest record rather than overwriting newer data. Single-deal conflicts require explicit review before another save. Bulk conflicts are reported and require review or a new selection. Version checks protect against competing writes; they do not provide background synchronization by themselves.

Bulk changes use one request containing every selected ID and version. Outcomes are independent: successful records remain committed when others fail. The summary reports saved, already-in-stage, failed, conflicting, and invalid records. Retry resends only failed records with their original versions. Confirmed responses update visible rows; other pages fetch their updated records when visited. Request IDs prevent older list responses from replacing newer query results.

## Limitations and further work

Automatic teammate changes, live updates, and runtime simulation controls remain unimplemented, so that part of the assignment is incomplete. Data is isolated to each browser tab and resets on reload. Conflict handling is covered by tests, but the UI does not demonstrate background teammate activity. Undo, incremental bulk progress, and recovery from uncertain network outcomes are also excluded.

My next priorities would be adjustable teammate simulation and safe live-update reconciliation, followed by a more efficient large-selection workflow. I would also measure browser performance and extend accessibility checks. Existing automated tests cover query behavior, page requests, conflicts, selection, retries, and partial failures; they do not establish browser rendering performance.

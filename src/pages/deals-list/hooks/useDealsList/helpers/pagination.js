export function clampPage(page, resultCount, pageSize) {
  return Math.max(0, Math.min(page, Math.max(0, Math.ceil(resultCount / pageSize) - 1)));
}

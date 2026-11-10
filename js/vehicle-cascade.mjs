export const levels = ['types', 'manufacturers', 'models', 'generations', 'engines'];

export function createCascade({ loadCatalog, onState = () => {} }) {
  let revision = 0;
  let controller;
  const state = { rows: Object.fromEntries(levels.map(level => [level, []])),
    selected: Object.fromEntries(levels.map(level => [level, ''])), loading: null, error: null, details: null, empty: null };
  const notify = () => onState(structuredClone(state));
  async function load(level, parentId, version) {
    controller = new AbortController();
    state.loading = level; state.error = null; state.empty = null; notify();
    try {
      const data = await loadCatalog(level, parentId, controller.signal);
      if (version !== revision) return;
      if (level === 'details') state.details = data;
      else { state.rows[level] = data; if (!data.length) state.empty = level; }
    } catch (error) {
      if (version !== revision) return;
      if (error?.name !== 'AbortError') state.error = error?.code || 'upstream-unavailable';
    } finally {
      if (version === revision) { state.loading = null; notify(); }
    }
  }
  async function start() { controller?.abort(); revision++; return load('types', null, revision); }
  async function change(level, value) {
    const index = levels.indexOf(level);
    if (index < 0) return;
    controller?.abort(); revision++;
    state.details = null; state.error = null; state.empty = null; state.loading = null;
    for (const child of levels.slice(index + 1)) { state.rows[child] = []; state.selected[child] = ''; }
    const selected = state.rows[level].some(row => String(row.id) === String(value)) ? String(value) : '';
    state.selected[level] = selected; notify();
    if (!selected) return;
    if (index < levels.length - 1) return load(levels[index + 1], selected, revision);
  }
  async function confirm() {
    if (!state.selected.engines) return;
    controller?.abort(); revision++;
    state.details = null;
    return load('details', state.selected.engines, revision);
  }
  async function applySelections(selections, isCurrent = () => true) {
    if (!isCurrent()) return;
    // A lookup may finish before the page's initial type request. Seed the rows first.
    await start();
    for (const level of levels) {
      if (!isCurrent() || state.error) return;
      if (selections[level]) await change(level, selections[level]);
    }
  }
  function clear() {
    controller?.abort(); revision++;
    for (const level of levels) { state.selected[level] = ''; if (level !== 'types') state.rows[level] = []; }
    state.loading = null; state.error = null; state.empty = null; state.details = null; notify();
  }
  return { start, change, confirm, applySelections, clear, snapshot: () => structuredClone(state) };
}

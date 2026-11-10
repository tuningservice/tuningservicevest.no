export const KW_TO_HK = 1.35962;
export function kwToHk(kw) {
  return typeof kw === 'number' && Number.isFinite(kw) && kw >= 0 ? Math.round(kw * KW_TO_HK) : null;
}
export function effectChange(original, tuned) {
  return typeof original === 'number' && Number.isFinite(original) && typeof tuned === 'number' && Number.isFinite(tuned)
    ? Math.round(tuned - original) : null;
}
export function defaultStageIndex(stages) {
  const stageOne = stages.findIndex(stage => stage.stage === 1);
  return stageOne >= 0 ? stageOne : stages.length ? 0 : -1;
}
export function customerEngineName(value) {
  return String(value || '').replace(/(\d+(?:[.,]\d+)?)\s*kW\b/gi, (_match, kw) => `${kwToHk(Number(kw.replace(',', '.')))} HK`)
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:hp|bhp|hk)\b/gi, '$1 HK')
    .replace(/(\d+(?:[.,]\d+)?)\s*nm\b/gi, '$1 Nm');
}

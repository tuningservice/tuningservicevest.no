// SVV distinguishes first registration from first registration in Norway.
// Never substitute the Norwegian date (or a bare year hint) for the former.
export function isoDate(value) {
  if (typeof value !== 'string' || !/^(19|20)\d{2}-\d{2}-\d{2}$/.test(value)) return null;
  const stamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? value : null;
}
export function registrationDates(first, norway) {
  const firstRegistered = isoDate(first), firstRegisteredNorway = isoDate(norway), registrationDateIssues = [];
  if (first != null && first !== '' && !firstRegistered) registrationDateIssues.push('invalid-first-registration');
  if (norway != null && norway !== '' && !firstRegisteredNorway) registrationDateIssues.push('invalid-norway-registration');
  if (firstRegistered && firstRegisteredNorway && firstRegisteredNorway < firstRegistered) registrationDateIssues.push('conflicting-registration-dates');
  const registrationDateStatus = registrationDateIssues.length ? 'conflicting' : firstRegistered ? 'reliable' : 'missing';
  return {firstRegistered, firstRegisteredNorway, registrationDateStatus, registrationDateIssues,
    registrationYearHint:firstRegistered ? Number(firstRegistered.slice(0,4)) : null};
}
export function catalogYear(value) {
  if (value === null || value === undefined || value === '') return null;
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 2099 ? year : null;
}
export function generationPeriod(generation) {
  const start = catalogYear(generation.year), end = catalogYear(generation.yearend);
  return start === null ? '' : ` (${start}–${end ?? ''})`;
}
// Catalog years are approximate: retain the adjacent start year at a changeover.
// Only a start more than one year after reliable first registration is excluded.
// No upper registration limit: stock vehicles and imports can register later.
export const GENERATION_START_YEAR_ALLOWANCE = 1;
export function generationChronology(generation, vehicle) {
  const dates = registrationDates(vehicle?.firstRegistered, vehicle?.firstRegisteredNorway);
  if (dates.registrationDateIssues.length || vehicle?.registrationDateStatus === 'conflicting') return {status:'conflict', reason:'conflicting-registration-dates'};
  const start = catalogYear(generation.year), end = catalogYear(generation.yearend);
  if (start !== null && end !== null && end < start) return {status:'conflict', reason:'invalid-generation-period'};
  if (!dates.firstRegistered || vehicle?.registrationDateStatus === 'missing' || start === null) return {status:'unknown', reason:'missing-registration-or-start'};
  return start > dates.registrationYearHint + GENERATION_START_YEAR_ALLOWANCE
    ? {status:'excluded', reason:'generation-starts-after-registration'}
    : {status:'possible', reason:'chronology-does-not-identify-generation'};
}

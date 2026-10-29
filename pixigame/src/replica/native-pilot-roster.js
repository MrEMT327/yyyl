// Formal roster: the user retained the first ten native entries and removed
// 41000 / 41100. These are skin associations, never cloud stat/skill mappings.
export const NATIVE_PILOT_SKINS = Object.freeze({
  40100: 'pilot-01',
  40101: 'pilot-02',
  40200: 'pilot-03',
  40300: 'pilot-04',
  40400: 'pilot-05',
  40500: 'pilot-06',
  40600: 'pilot-07',
  40700: 'pilot-08',
  40800: 'pilot-09',
  40900: 'pilot-10',
});
export const isRosterPilot = id => Object.hasOwn(NATIVE_PILOT_SKINS, id);

import {buildDeckFocusedMachine} from './deck-focused-machines.js';

// All bosses use the same top-focused construction budget, with unique forms.
export function buildBossModel(theme,b,bake) {
  return buildDeckFocusedMachine(theme,'boss','boss',b,bake);
}

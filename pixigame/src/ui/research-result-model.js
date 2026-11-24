import { researchEffectLines } from '../peripheral/research.js';

// Format both sides from the same domain formatter used by the talent list.
export function researchResultChanges(card, previousLevel, level) {
  return Object.entries(card.perLevel).map(([key, amount]) => {
    const valueAt = lv => key === 'earlyHitHalves' && lv ? 2 + lv : amount * lv;
    const afterLine = researchEffectLines({[key]:valueAt(level)})[0];
    const split = afterLine.lastIndexOf(' ');
    const beforeLine = researchEffectLines({[key]:valueAt(previousLevel)})[0];
    return {label:afterLine.slice(0,split),before:beforeLine?.split(' ').at(-1) || `+0${afterLine.endsWith('%')?'%':''}`,after:afterLine.slice(split+1)};
  });
}

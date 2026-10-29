import './psd-empty-slot.css';
export const EMPTY_SLOT_ART = 'art/psd-main-v1/resources/diamonds-plus.png';

// Shared equipment/skill affordance from the user's main PSD, without changing
// the resource-bar glyph or borrowing the dimensional resource-icon treatment.
export function emptySlotMark(className='') {
  return `<span class="psd-empty-mark ${className}" aria-hidden="true"></span>`;
}

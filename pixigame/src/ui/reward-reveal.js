import { createDrawPresentation } from './draw-presentation.js';
import {activeModalHost} from './reward-modal-stack.js';
// Receipts are already committed. This controller owns presentation only.
export function createRewardReveal(root,sound = () => {}) {
  const shown = new WeakSet();
  const draw = createDrawPresentation(root,sound);
  let cleanup = () => {};
  function show(receipt, snapshot) {
    const host = activeModalHost(root);
    // Ordinary receipts are final views, not showcases. Do not enter the draw
    // controller or add transient header controls while refreshing rewards.
    if (host?.querySelector('[data-modal-kind="commonRewards"]')) {
      draw.clear();
      cleanup();
      cleanup = () => {};
      return;
    }
    if (draw.show(receipt, snapshot)) return;
    draw.clear();
    cleanup();
    if (!host || !receipt) return;
    const cards = [...host.querySelectorAll('.pl-reward-item,.pl-card-result,.research-detail-card,.research-core-reward')];
    // One animation owner; a thumbnail refresh must not replay CSS reveals.
    host.querySelectorAll('.phc-reveal,.pl-card-result').forEach(node => { node.style.animation = 'none'; });
    if (shown.has(receipt)) return;
    shown.add(receipt);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const motions = [];
    const animate = (node, frames, options) => {
      const motion = node.animate(frames, options);
      motions.push(motion);
      return motion;
    };
    const rankOf = node => {
      const rarity = node.querySelector('[data-holo-rarity]')?.dataset.holoRarity;
      if (rarity) return { R:1, SR:2, SSR:3, UR:3 }[rarity] || 0;
      if (node.classList.contains('research-detail-card')) {
        const card = snapshot?.research?.cards.find(c => c.id === receipt.result?.cardId);
        return { 5:3, 6:4 }[card?.quality] ?? (card?.pool === 'ace' ? 3 : 1);
      }
      return Number(node.dataset.rewardRank) || 0;
    };
    cards.forEach((node, i) => {
      const rank = rankOf(node), rare = rank >= 3;
      const color = rank >= 4 ? '#ffdb74' : '#c3a1ff';
      animate(node, rare ? [
        { opacity:.15, boxShadow:`inset 0 0 0 1px ${color}00` },
        { opacity:.55, boxShadow:`inset 0 0 24px ${color}55`, offset:.38 },
        { opacity:1, boxShadow:`inset 0 0 0 2px ${color}`, offset:.65 },
        { opacity:1, boxShadow:`inset 0 0 0 0 ${color}00` },
      ] : [
        { opacity:.2 },
        { opacity:1 },
      ], { duration:rare ? 650 : 230, delay:Math.min(i, 9)*45, fill:'backwards', easing:'ease-out' });
    });
    host.querySelectorAll('.research-effect').forEach((node, i) => animate(node, [
      { opacity:.4 },
      { opacity:1 },
    ], { duration:240, delay:250+i*45, fill:'backwards' }));
    if (!motions.length) return;
    // These brief reveals finish on their own; keep the result header quiet.
    cleanup = () => { motions.forEach(m => m.cancel()); };
    Promise.all(motions.map(m => m.finished.catch(() => {})));
  }
  return { show, clear:() => {draw.clear();cleanup();} };
}

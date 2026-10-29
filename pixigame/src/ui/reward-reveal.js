import { createDrawPresentation } from './draw-presentation.js';
// Receipts are already committed. This controller owns presentation only.
export function createRewardReveal(root,sound = () => {}) {
  const shown = new WeakSet();
  const draw = createDrawPresentation(root,sound);
  let cleanup = () => {};
  function show(receipt, snapshot) {
    if (draw.show(receipt, snapshot)) return;
    draw.clear();
    cleanup();
    const host = root.querySelector('.pl-modal-host');
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
      if (rarity) return { R:1, SR:2, SSR:3, UR:4 }[rarity] || 0;
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
    const skip = document.createElement('button');
    skip.type = 'button'; skip.className = 'reward-reveal-skip';
    skip.textContent = '跳过'; skip.setAttribute('aria-label','跳过奖励揭晓动效');
    const heading = host.querySelector('.pl-modal-heading');
    heading?.insertBefore(skip, heading.querySelector('.pl-close'));
    const removeSkip = () => {
      // Keep keyboard focus in the dialog when its skip button disappears.
      if (document.activeElement === skip) host.querySelector('[data-action="close"]')?.focus({preventScroll:true});
      skip.remove();
    };
    const finish = () => {
      motions.forEach(motion => { if (motion.playState !== 'idle') motion.finish(); });
      removeSkip();
    };
    skip.addEventListener('click', finish);
    cleanup = () => { motions.forEach(m => m.cancel()); skip.remove(); };
    Promise.all(motions.map(m => m.finished.catch(() => {}))).then(removeSkip);
  }
  return { show, clear:() => {draw.clear();cleanup();} };
}

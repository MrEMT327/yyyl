import './lobby-growth-feedback.css';

const actions = new Set(['upgradeAircraft', 'upgradeWeapon', 'synthesizeWeapon', 'synthesizeAll']);
export const hasLobbyGrowthFeedback = action => actions.has(action);

export function showLobbyGrowthFeedback(root, before, after, action, payload) {
  if (!actions.has(action) || !root.isConnected) return;
  const aircraft = action === 'upgradeAircraft';
  const previous = aircraft ? before.aircraft : before.weapons;
  const current = aircraft ? after.aircraft : after.weapons;
  const changed = current.filter(item => {
    const old = previous.find(p => p.id === item.id);
    return old && (item.level > old.level || item.qualityRank > old.qualityRank);
  });
  if (!changed.length) return;
  const merging = action === 'synthesizeWeapon' || action === 'synthesizeAll';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const delay = merging && !reduced ? 480 : 0;
  // Emphasize actual changed fields, never the next-upgrade preview values.
  root.querySelectorAll('[data-growth-id][data-growth-stat]').forEach(node => {
    const next = changed.find(entry => entry.id === node.dataset.growthId);
    const prev = previous.find(entry => entry.id === node.dataset.growthId);
    const key = node.dataset.growthStat;
    if (!next || !prev || !(next[key] > prev[key]) || reduced) return;
    node.animate([
      {color:'inherit',backgroundColor:'transparent'},
      {color:'#fff2aa',backgroundColor:'#ffd66333',offset:.35},
      {color:'inherit',backgroundColor:'transparent'},
    ], {duration:650,delay});
  });
  const power = after.power - before.power;
  const flash = node => {
    if (!node || reduced) return;
    node.animate([{filter:'brightness(1)'},{filter:'brightness(1.45)'},{filter:'brightness(1)'}], {duration:450});
  };
  // Avoid bleaching the whole hero/card: level and changed attributes own it.
  if (!merging) flash(root.querySelector('.workshop-scene-slot:not(.is-result) img'));
  if (power > 0) flash(root.querySelector('.lobby-power'));
}

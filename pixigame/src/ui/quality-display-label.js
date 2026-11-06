// Placeholder quality values stay in data/style keys, not player-facing text.
export function qualityDisplayLabel(value,known=true) {
  const label=String(value??'').trim();
  return known===false||label==='未标注'?'':label;
}

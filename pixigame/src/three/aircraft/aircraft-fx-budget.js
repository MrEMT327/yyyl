// Battle renders the player into 256 px; a normal hangar hero is ~430 CSS px.
// Budget ray marching by displayed size, not DPR or the author's full-screen
// showroom. Keep the high-resolution option for actual large inspections.
export function aircraftFxBudget(displayWidth) {
  const width = Number.isFinite(displayWidth) ? Math.max(1, displayWidth) : 256;
  return {
    jetSteps: width <= 256 ? 12 : width <= 640 ? 16 : 20,
    bloomWidth: Math.min(256, Math.max(1, Math.round(width))),
    bloomMips: 2,
  };
}

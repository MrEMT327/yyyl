// One generated closed pair, split at its exact center in CSS. Both leaves
// retain the same light, scale and mating edge instead of separate AI variants.
export const DRAW_GATE_ART = `${import.meta.env?.BASE_URL ?? '/'}art/project-draw-gate-v1/closed-doors.png`;
export const DRAW_GATE_DURATION_MS = 1500;
const readiness = new WeakMap();
export function prepareDrawGate(document) {
  if (!readiness.has(document)) {
    readiness.set(document,new Promise(resolve=>{
      const image=document.createElement('img');
      image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=DRAW_GATE_ART;
    }));
  }
  return readiness.get(document);
}
export function createDrawGate(document) {
  const gate=document.createElement('div');gate.className='draw-receiver';gate.setAttribute('aria-hidden','true');
  for(const side of ['left','right']){
    const leaf=document.createElement('div');leaf.className=`draw-door draw-door-${side}`;
    leaf.style.backgroundImage=`url("${DRAW_GATE_ART}")`;gate.append(leaf);
  }
  return gate;
}

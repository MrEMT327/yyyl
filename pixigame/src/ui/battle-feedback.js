export function counterFrame(state, value, now, immediate = false) {
  value = Math.max(0, Math.floor(Number(value) || 0));
  if (!state || value < state.target || immediate) return {target:value,from:value,value,at:now};
  const t = Math.min(1, Math.max(0,(now-state.at)/260));
  const current = state.from+(state.target-state.from)*(1-(1-t)**3);
  if (value !== state.target) return {target:value,from:current,value:current,at:now};
  return {...state,value:current};
}

export function healthFrame(state, hp, maxHp, now, quiet = false) {
  const ratio = Math.max(0,Math.min(1,hp/Math.max(1,maxHp)));
  if (!state || state.maxHp !== maxHp) return {hp,maxHp,ratio,from:ratio,at:-Infinity,kind:null};
  if (hp !== state.hp) state = {hp,maxHp,ratio,from:state.ratio,at:now,kind:hp>state.hp?'heal':'damage'};
  const t = Math.max(0,Math.min(1,(now-state.at)/600));
  return {...state,trail:quiet?ratio:state.from+(ratio-state.from)*t,fade:1-t};
}

export function healingReceived(before, after) { return Math.max(0,Math.round((after-before)*10)/10); }

// This small visual state uses battle seconds, not wall time. It survives HUD
// reconstruction, but resets at level boundaries instead of draining backwards.
export function experienceFrame(state, game, quiet = false) {
  const now = Math.max(0, Number(game.elapsed) || 0);
  const xp = Math.max(0, Number(game.xp) || 0);
  const xpNext = Math.max(1, Number(game.xpNext) || 1);
  const level = Math.max(1, Number(game.level) || 1);
  const runId = game.fixedGrowth?.state?.runId ?? game.peripheralSnapshot?.id ?? null;
  const target = Math.min(1, xp / xpNext);
  const reset = !state || runId !== state.runId || now < state.at
    || level !== state.level || xpNext !== state.xpNext || xp < state.xp;
  if (reset || quiet) {
    return {runId,level,xp,xpNext,target,value:target,at:now,
      lastGainAt:-Infinity,pulseAt:-Infinity,quietUntil:now + .8,light:0};
  }
  const dt = game.state === 'playing' ? Math.max(0, Math.min(.1, now - state.at)) : 0;
  let value = state.value + (target - state.value) * (1 - Math.exp(-14 * dt));
  if (target - value < .0005) value = target;
  let pulseAt = state.pulseAt;
  // Continuous pickups extend one gain batch; they never restart its pulse.
  if (xp > state.xp && now - state.lastGainAt > .45 && now >= state.quietUntil) pulseAt = now;
  const age = now - pulseAt;
  const light = age >= 0 && age < .38 ? Math.min(1, age / .08) * (1 - age / .38) : 0;
  return {runId,level,xp,xpNext,target,value,at:now,
    lastGainAt:xp > state.xp ? now : state.lastGainAt,pulseAt,quietUntil:state.quietUntil,light};
}

export const SOURCE_FREEZE_COLOR = Object.freeze([0.658, 0.809, 1.441]);
export const SOURCE_FREEZE_HIT_VALUE = 0.5;
export const SOURCE_FREEZE_EXIT_SECONDS = 0.3;
export function newSourceFreezeTintState() { return { wasActive: false, fadeStart: null, lastTime: -Infinity }; }
/** time/endTime are simulation seconds, so pause does not consume fade duration.
 * A supplied endTime preserves exact expiry when it falls between rendered frames.
 */
export function advanceSourceFreezeTint(state, active, time, endTime) {
    if (!Number.isFinite(time) || endTime !== undefined && !Number.isFinite(endTime))
        throw new Error('Non-finite source status time');
    if (time < state.lastTime) {
        state.wasActive = false;
        state.fadeStart = null;
    }
    if (active)
        state.fadeStart = null;
    else if (state.wasActive)
        state.fadeStart = endTime ?? time;
    state.wasActive = active;
    state.lastTime = time;
    const elapsed = state.fadeStart === null ? Infinity : Math.max(0, time - state.fadeStart);
    const suppressHitFlash = active || elapsed < SOURCE_FREEZE_EXIT_SECONDS;
    const hitValue = active ? SOURCE_FREEZE_HIT_VALUE : elapsed < SOURCE_FREEZE_EXIT_SECONDS ?
        SOURCE_FREEZE_HIT_VALUE * Math.pow(1 - elapsed / SOURCE_FREEZE_EXIT_SECONDS, 3) : 0;
    if (!suppressHitFlash)
        state.fadeStart = null;
    return { hitValue, hitColor: SOURCE_FREEZE_COLOR, suppressHitFlash };
}
/** CPU reference for numeric verification, with no 8-bit packing or RGB clamp. */
export function sourceFreezeColorMix(color, hitValue) {
    return color.map((c, i) => i < 3 ? c + (SOURCE_FREEZE_COLOR[i] - c) * hitValue : c);
}

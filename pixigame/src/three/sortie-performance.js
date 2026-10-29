// Bounded local diagnostics: no HUD, logging, persistence or network traffic.
export function createSortieTrace(startedAt) {
  const trace = { phasesMs: {}, frameCount: 0, longestFrameMs: 0, slowFrames: [], complete: false };
  globalThis.__sortiePerformance = trace;
  let previous = startedAt;
  const mark = name => {
    const now = performance.now();
    trace.phasesMs[name] = Math.round((now - previous) * 10) / 10;
    previous = now;
  };
  return {
    mark,
    finish() {
      trace.startupMs = Math.round((performance.now() - startedAt) * 10) / 10;
      let last = performance.now();
      const deadline = last + 4000;
      const sample = () => {
        if (globalThis.__sortiePerformance !== trace) return;
        const now = performance.now(), gap = Math.round((now - last) * 10) / 10;
        trace.frameCount++;
        trace.longestFrameMs = Math.max(trace.longestFrameMs, gap);
        if(gap > 50 && trace.slowFrames.length < 12) trace.slowFrames.push({ frame: trace.frameCount, ms: gap });
        last = now;
        if(now < deadline && trace.frameCount < 180 && !document.hidden) requestAnimationFrame(sample);
        else trace.complete = true;
      };
      requestAnimationFrame(sample);
    },
  };
}

export function installNativeClock(api, root, canvas) {
  const performance = root.performance;
  const hasWebClock = typeof performance?.now === 'function' && Number.isFinite(performance.timeOrigin);
  if (!hasWebClock) {
    // wx.getPerformance().now() reports microseconds. Browser animation and
    // engine timestamps use elapsed milliseconds.
    const native = api.getDeviceInfo?.()?.platform === 'devtools' ? null : api.getPerformance?.();
    const readMs = typeof native?.now === 'function' ? () => native.now() / 1000 : Date.now;
    const origin = readMs();
    let elapsed = 0;
    root.performance = { now() {
      elapsed = Math.max(elapsed, readMs() - origin);
      return elapsed;
    } };
  }

  const scheduler = typeof root.requestAnimationFrame === 'function' ? root : canvas;
  if (!hasWebClock || scheduler === canvas) {
    const request = scheduler.requestAnimationFrame.bind(scheduler);
    const now = root.performance.now.bind(root.performance);
    root.requestAnimationFrame = callback => request(() => callback(now()));
  }
  if (scheduler === canvas || typeof root.cancelAnimationFrame !== 'function') {
    root.cancelAnimationFrame = canvas.cancelAnimationFrame.bind(canvas);
  }
}

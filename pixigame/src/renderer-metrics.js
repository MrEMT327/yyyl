// Combine only renderers that submitted a new frame since the last sample.
// A parked preview must not keep reporting its last image as live GPU work.
export function summarizeRendererMetrics(renderers, previousFrames = new Map()) {
  let calls = 0, triangles = 0, geometries = 0, textures = 0;
  const active = [];
  for (const renderer of renderers) {
    geometries += renderer.geometries || 0;
    textures += renderer.textures || 0;
    if (renderer.active && (renderer.frame === undefined || previousFrames.get(renderer.name) !== renderer.frame)) {
      calls += renderer.calls || 0;
      triangles += renderer.triangles || 0;
      active.push(renderer.name);
    }
    previousFrames.set(renderer.name, renderer.frame);
  }
  return {calls, triangles, geometries, textures, active};
}

// Cubism draws directly through WebGL, so Three.js renderer.info cannot see it.
// Install on this context only, count real submissions (including masks), and
// restore the original methods when the portrait is released.
export function trackWebGLRenderer(gl, monitor, name, isActive) {
  const stats = {frame: 0, calls: 0, triangles: 0};
  const originals = new Map();
  for (const method of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
    if (typeof gl[method] !== 'function') continue;
    const original = gl[method], own = Object.getOwnPropertyDescriptor(gl, method);
    const wrapped = function(...args) {
      if (monitor.enabled) {
        const mode = args[0], count = args[method.startsWith('drawElements') ? 1 : 2];
        const instances = method.endsWith('Instanced') ? args[method.startsWith('drawElements') ? 4 : 3] : 1;
        stats.calls++;
        stats.triangles += (mode === gl.TRIANGLES ? Math.floor(count / 3)
          : mode === gl.TRIANGLE_STRIP || mode === gl.TRIANGLE_FAN ? Math.max(0, count - 2) : 0) * instances;
      }
      return original.apply(this, args);
    };
    gl[method] = wrapped;
    originals.set(method, {own, wrapped});
  }
  const release = monitor.registerRenderer(name, () => ({...stats, active: isActive()}));
  return {
    beginFrame() { stats.frame++; stats.calls = stats.triangles = 0; },
    destroy() {
      release();
      for (const [method, {own, wrapped}] of originals) if (gl[method] === wrapped) {
        if (own) Object.defineProperty(gl, method, own); else delete gl[method];
      }
    },
  };
}

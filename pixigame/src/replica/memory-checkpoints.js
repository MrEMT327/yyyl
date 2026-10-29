// Bounded diagnostic metadata only: no saves, identifiers or gameplay records.
const key = 'shnh-memory-checkpoints-v1';
export function memoryCheckpoint(stage) {
  const memory = globalThis.performance?.memory;
  const mib = bytes => Number.isFinite(bytes) ? Math.round(bytes / 1048576) : null;
  const record = {stage, at:Date.now(), page:location.pathname,
    heapMiB:mib(memory?.usedJSHeapSize), heapLimitMiB:mib(memory?.jsHeapSizeLimit),
    canvases:document.querySelectorAll('canvas').length};
  try {
    const previous=JSON.parse(localStorage.getItem(key)||'[]');
    localStorage.setItem(key,JSON.stringify([...(Array.isArray(previous)?previous:[]).slice(-15),record]));
  } catch { /* Storage may be unavailable. */ }
  console.info('[memory-stage]', JSON.stringify(record));
}

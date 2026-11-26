import { recordDiagnostic } from '../diagnostic-log.js';

// Bounded diagnostic metadata only: no saves, identifiers or gameplay records.
const key = 'shnh-memory-checkpoints-v1';
export function memoryMiB(bytes) {
  return Number.isFinite(bytes) && bytes >= 0 ? Math.round(bytes / 1048576 * 10) / 10 : null;
}

export function readJsHeapMemory() {
  const memory = globalThis.performance?.memory;
  return {heapMiB:memoryMiB(memory?.usedJSHeapSize), heapLimitMiB:memoryMiB(memory?.jsHeapSizeLimit)};
}

export function memoryCheckpoint(stage, context) {
  const record = {stage, at:Date.now(), page:context?.page ?? globalThis.location?.pathname ?? '',
    chapter:context?.chapter, ...readJsHeapMemory(),
    canvases:context?.canvases ?? globalThis.document?.querySelectorAll?.('canvas')?.length ?? null,
    resources:context?.readResources?.()};
  try {
    const storage=context?.storage ?? globalThis.localStorage;
    const previous=JSON.parse(storage?.getItem(key)||'[]');
    storage?.setItem(key,JSON.stringify([...(Array.isArray(previous)?previous:[]).slice(-15),record]));
  } catch { /* Storage may be unavailable. */ }
  recordDiagnostic('加载阶段', `${stage}${record.heapMiB === null ? '' : ' · 堆内存 ' + record.heapMiB + ' MiB'}`);
  console.info('[memory-stage]', JSON.stringify(record));
}

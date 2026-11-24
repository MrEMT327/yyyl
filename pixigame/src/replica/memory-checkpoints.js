import { recordDiagnostic } from '../diagnostic-log.js';

// Bounded diagnostic metadata only: no saves, identifiers or gameplay records.
const key = 'shnh-memory-checkpoints-v1';
export function memoryCheckpoint(stage, context) {
  const memory = globalThis.performance?.memory;
  const mib = bytes => Number.isFinite(bytes) ? Math.round(bytes / 1048576) : null;
  const record = {stage, at:Date.now(), page:context?.page ?? globalThis.location?.pathname ?? '',
    heapMiB:mib(memory?.usedJSHeapSize), heapLimitMiB:mib(memory?.jsHeapSizeLimit),
    canvases:context?.canvases ?? globalThis.document?.querySelectorAll?.('canvas')?.length ?? null};
  try {
    const storage=context?.storage ?? globalThis.localStorage;
    const previous=JSON.parse(storage?.getItem(key)||'[]');
    storage?.setItem(key,JSON.stringify([...(Array.isArray(previous)?previous:[]).slice(-15),record]));
  } catch { /* Storage may be unavailable. */ }
  recordDiagnostic('加载阶段', `${stage}${record.heapMiB === null ? '' : ' · 堆内存 ' + record.heapMiB + ' MiB'}`);
  console.info('[memory-stage]', JSON.stringify(record));
}

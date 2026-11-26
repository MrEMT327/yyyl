export function memoryMiB(bytes?: number | null): number | null;
export function readJsHeapMemory(): {heapMiB: number | null; heapLimitMiB: number | null};
export function memoryCheckpoint(stage: string, context?: {
  page: string;
  chapter?: number;
  canvases: number;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  readResources?: () => object;
}): void;

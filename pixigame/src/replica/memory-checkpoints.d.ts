export function memoryCheckpoint(stage: string, context?: {
  page: string;
  canvases: number;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
}): void;

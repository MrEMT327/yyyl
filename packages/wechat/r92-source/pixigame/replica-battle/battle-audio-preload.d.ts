export function preloadBattleAudio(options: {
  manifest: Record<string, any>;
  context: AudioContext;
  fetchResource?: typeof fetch;
  baseURL?: string;
  signal?: AbortSignal;
  onBuffer(key: string, buffer: AudioBuffer): void;
  onError?(key: string, error: unknown): void;
}): Promise<void>;

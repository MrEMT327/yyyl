import type Phaser from 'phaser';

export function installReleaseSlowMotion(options: {
  scene: Phaser.Scene;
  controls: { held: boolean; clear(): void };
  isPlaying: () => boolean;
  host?: Window;
  signal?: AbortSignal;
}): { readonly scale: number; destroy(): void };

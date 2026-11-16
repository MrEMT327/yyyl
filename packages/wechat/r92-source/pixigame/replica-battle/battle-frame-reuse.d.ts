import type Phaser from 'phaser';

export function createBattleFrameReuse(options: {
  getRunId: () => string;
  canFreeze: () => boolean;
  capture: () => boolean;
  updateOverlay: (delta: number) => void;
}): {
  install: (game: Phaser.Game) => void;
  presented: () => void;
  invalidate: () => void;
};

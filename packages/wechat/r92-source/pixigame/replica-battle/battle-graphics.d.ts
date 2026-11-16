export function createBattleGraphics(options?: {onChange?: () => void; signal?: AbortSignal}): {
  watch: (canvas: HTMLCanvasElement, context: WebGLRenderingContext | WebGL2RenderingContext) => void;
  blocked: () => boolean; destroy: () => void;
};

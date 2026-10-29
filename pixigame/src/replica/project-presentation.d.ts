import type { GameContent } from '../../replica-battle/kernel/model';
import type { BattleAppearance } from '../../replica-battle/appearance-types';
export function createProjectPresentation(options: {
  content: GameContent;
  appearance: Record<string, any>;
  onError: (error: Error) => void;
  onFlightRoll?: () => void;
  onProgress?: (completed: number, total: number) => void;
  onGraphicsContext?: (canvas: HTMLCanvasElement, context: WebGLRenderingContext | WebGL2RenderingContext) => void;
}): Promise<BattleAppearance & {
  dispose(): void;
  setLaunchPresentation(value:{time:number;thrust:number}|null):void;
}>;

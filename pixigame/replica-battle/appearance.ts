import type { GameContent, RecordData } from './kernel/model';
import { createProjectPresentation } from '../src/replica/project-presentation.js';

export function createAppearance(content: GameContent, appearance: RecordData, onError: (error: Error) => void, onGraphicsContext?: (canvas: HTMLCanvasElement, context: WebGLRenderingContext | WebGL2RenderingContext) => void, onProgress?: (completed: number, total: number) => void, onFlightRoll?: () => void) {
  return createProjectPresentation({ content, appearance, onError, onGraphicsContext, onProgress, onFlightRoll });
}

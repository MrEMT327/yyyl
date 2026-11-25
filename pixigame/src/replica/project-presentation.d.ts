import type { GameContent } from '../../replica-battle/kernel/model';
import type { BattleAppearance } from '../../replica-battle/appearance-types';
import type { BattleLaunchVisual } from '../../replica-battle/battle-launch.js';
export function createProjectPresentation(options: {
  content: GameContent;
  appearance: Record<string, any>;
  onError: (error: Error) => void;
  onFlightRoll?: () => void;
  aircraftReady?: Promise<unknown>;
  onProgress?: (completed: number, total: number) => void;
  onGraphicsContext?: (canvas: HTMLCanvasElement, context: WebGLRenderingContext | WebGL2RenderingContext) => void;
  host?: {
    baseURL?: string;
    viewport?: { width: number; height: number; pixelRatio: number };
    stage?: { dataset: Record<string, string> };
    events?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
    createCanvas?(type: '2d' | 'webgl2'): HTMLCanvasElement;
    textureLoader?: Pick<import('three').TextureLoader, 'load'>;
    objectLoader?: import('three').ObjectLoader;
    readFighterFile?(slug: string, name: string): Promise<ArrayBuffer>;
    assetBytes?: {
      createAssetBytesUrl(bytes: ArrayBuffer, mimeType: string): string;
      createVerifiedAssetBytesUrl?(bytes: ArrayBuffer, mimeType: string, sha256: string): string;
      revokeAssetBytesUrl(url: string): void;
    };
    measureTransfer?<T>(name:string,pixels:number,run:()=>T):T;
    aircraftCapture?: {
      write(gl:WebGL2RenderingContext,target:CanvasRenderingContext2D,width:number,height:number,
        wake:{x:number;y:number;width:number;height:number}|null,paintWake:(context:CanvasRenderingContext2D)=>void,defer?:boolean):boolean;
      poll():boolean|null;
      reset():void;
    };
  };
}): Promise<BattleAppearance & {
  dispose(): void;
  setLaunchPresentation(value:BattleLaunchVisual|null):void;
}>;

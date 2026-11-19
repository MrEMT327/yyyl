export function prepareBreakthroughAtlas(): void;
export function disposeNativeGeometrySprites(): void;
interface ParticleTexture {
  kind: string; width: number; height: number;
  sheet?: {columns:number; rows:number}; settings?: {m_FilterMode:number};
}
interface OpticalSprite {
  key: string; x: number; z: number; width: number; height: number; rotation: number;
  originX: number; originY: number; tint: number; alpha: number; blend: string; tintGain?: number;
  crop?: {x:number; y:number; width:number; height:number};
}
export function drawNativeGeometrySprite(
  ctx: CanvasRenderingContext2D, draw: {sprite:OpticalSprite; material:object},
  textures: Record<string,ParticleTexture>, time:number,
): void;

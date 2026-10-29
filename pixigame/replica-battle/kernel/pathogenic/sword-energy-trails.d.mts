export const SWORD_SPARK_MATERIAL: string;
export const SWORD_SPARK_LIMIT: number;
export class SwordEnergyTrails {
  constructor(view: { drawMeshes(id: string, meshes: any[]): void });
  beginFrame(clock: number, camera?: number[]): void;
  effect(fx: Record<string, any>, meshes: any[]): void;
  endFrame(): void;
  reset(): void;
}

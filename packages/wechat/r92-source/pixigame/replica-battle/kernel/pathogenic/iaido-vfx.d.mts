export const IAIDO_PARTICLE_LIMIT: number;
export function isIaidoProjectile(b: Record<string, any>): boolean;
export function iaidoScreenMeshes(b: Record<string, any>, screen: (x: number, z: number) => {x: number; y: number}): any[];
export function withIaidoResources(graph: Record<string, any>): Record<string, any>;
export class IaidoVfx {
  constructor(view: {drawMeshes(id: string, meshes: any[]): void});
  beginFrame(clock: number, camera?: number[]): void;
  projectile(b: Record<string, any>, screen: (x: number, z: number) => {x: number; y: number}): boolean;
  endFrame(): void;
  reset(): void;
}

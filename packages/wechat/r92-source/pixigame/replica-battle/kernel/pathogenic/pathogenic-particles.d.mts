export function godotHash(x: any): number;
export function godotRandom(seed: any): {
    (): number;
    state: number;
};
/** Stored Curve._data: position,left tangent,right tangent,left mode,right mode. */
export function curveSample(g: any, ref: any, t: any): any;
export function gradientSample(g: any, ref: any, t: any): any;
export function noise4(v: any): any;
export function particleCoverage(g: any, node: any): string[];
/**
 * `age`, `stopAge`, and history ages are seconds on the effect's clock.
 * `emitting:true` explicitly restarts a serialized initially-off one-shot.
 * History matrices must include the particle node's complete emitter transform.
 * World-space output is marked space=world; do not transform it a second time.
 */
export function sampleParticles(g: any, node: any, age: any, seed?: number, options?: {}): {
    instances: any[];
    trails: any[];
    unsupported: string[];
};
export const PARTICLE_FIDELITY_LIMITS: readonly string[];
/** One player belongs to one effect instance; reset on new run/owner reuse. */
export class ParticlePlayer {
    /** Read-only render snapshots; emitter history must carry a revision. */
    sampleReadOnly(graph:any,node:any,age:any,seed?:number,options?:{}):ReturnType<ParticlePlayer["sample"]>;
    nodes: Map<any, any>;
    age: number;
    seed: number;
    reset(): void;
    sample(graph: any, node: any, age: any, seed?: number, options?: {}): {
        instances: any[];
        trails: any[];
        unsupported: string[];
    };
}
export { gradientSample as sampleGradient, curveSample as sampleCurve };

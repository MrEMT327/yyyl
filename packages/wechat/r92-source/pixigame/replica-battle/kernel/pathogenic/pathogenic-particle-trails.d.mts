/** Source topology, including intentionally zero Y rest coordinates and identity binds. */
export function particleTrailLayout(width: any, sections?: number, subdivisions?: number): {
    vertices: {
        position: number[];
        uv: number[];
        bones: number[];
        weights: number[];
    }[];
    indices: number[];
    bindPoses: number[][];
    sections: number;
    subdivisions: number;
};
/** A caller may provide exact per-bone states in trail.bones to bypass history interpolation. */
export function particleTrailBones(node: any, trail: any): any;
/** Input: sampled node, particle sampler's trails, complete emitter matrix.
 * Output vertices are world positions with normalized UV and HDR color, directly
 * compatible with PathogenicSceneView.mesh(..., geometry, time, true).
 * Render these meshes INSTEAD OF particle sprite quads when trails are enabled.
 */
export function particleTrailGeometry(graph: any, node: any, trails: any, emitterMatrix?: any, options?: {}): {
    meshes: any[];
    unsupported: any[];
    limits: string[];
    enabled?: undefined;
    fallbackToSprites?: undefined;
} | {
    meshes: any[];
    unsupported: any[];
    limits: string[];
    enabled: boolean;
    fallbackToSprites?: undefined;
} | {
    meshes: any[];
    unsupported: any[];
    limits: string[];
    enabled: boolean;
    fallbackToSprites: boolean;
};
export const TRAIL_LIMITS: readonly string[];

export function inverseMatrix(m: any): number[];
export function spriteGeometry(sprite: any): {
    vertices: {
        position: any[];
        uv: any[];
        color: any;
    }[];
    indices: number[];
};
/** Godot Curve::sample_baked, including the stored bake resolution and domain. */
export function sampleLineWidthCurve(graph: any, ref: any, t: any): any;
/** Original local-unit tessellation. sourceUV is Godot UV, not atlas pixel UV.
 * Curve baking, caps, miter fallback, round joins and closed-seam fake walk are
 * retained. JS doubles are not bit-identical to Godot real_t float operations.
 */
export function lineGeometry(graph: any, line: any): {
    vertices: any[];
    indices: any[];
    unsupported: any[];
};
export function matrix3(m: any): any[];
export function matrix4(m: any): any[];

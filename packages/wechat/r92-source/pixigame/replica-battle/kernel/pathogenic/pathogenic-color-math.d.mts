export function glowFilter(rgb: any, threshold: any, hdrScale: any, bloom: any, cap: any): any;
export function glowResolve(scene: any, glow: any, intensity: any): any;
export function glowLevelSizes(width: any, height: any): number[][];
/** CPU shader-number reference, not a substitute for binary16 pass rounding/GPU QA. */
export function bilinearClamp(image: any, uv: any): number[];
/** Reproduce pass ordering; caller can supply quantize to model binary16 writes. */
export function referenceGlowPasses(image: any, parameters: any, { quantize }?: {
    quantize?: (x: any) => any;
}): {
    width: any;
    height: any;
    data: Float64Array<any>;
    glow: {
        width: any;
        height: any;
        data: Float64Array<ArrayBuffer>;
    };
    trace: {
        width: any;
        height: any;
        data: Float64Array<ArrayBuffer>;
        kind: string;
    }[];
};
/**
 * Godot 4.7 Compatibility/GLES3 equations, commit 5b4e0cb0fd279832bbdd69fed5354d4e5ad26f88.
 * Ported from drivers/gles3/shaders/effects/{glow,post,copy}.glsl and tonemap_inc.glsl.
 * Copyright (c) 2014-present Godot Engine contributors; (c) 2007-2014 Juan Linietsky,
 * Ariel Manzur. MIT: permission is granted free of charge to use, copy, modify,
 * merge, publish, distribute, sublicense and/or sell copies, provided this notice
 * and permission notice are included. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT
 * WARRANTY OF ANY KIND; AUTHORS ARE NOT LIABLE FOR ANY CLAIM, DAMAGES OR LIABILITY.
 *
 * Profile boundaries: nonlinear sRGB-encoded accumulation, RGBA16F M=1,
 * source Screen blend white=1, Linear tonemapper, no BCS/LUT/SSAO. Not RD glow.
 * The caller must include sampler precision declarations suitable for its GPU.
 * All pass reads use bilinear filtering and CLAMP_TO_EDGE.
 */
export const GODOT_COLOR_SOURCE: Readonly<{
    commit: "5b4e0cb0fd279832bbdd69fed5354d4e5ad26f88";
    renderer: "gl_compatibility";
    base: "https://github.com/godotengine/godot/blob/5b4e0cb0fd279832bbdd69fed5354d4e5ad26f88/";
    files: string[];
}>;
export const GLES_PROFILE_EVIDENCE: Readonly<{
    intensity: {
        value: number;
        status: string;
        source: string;
    };
    threshold: {
        value: number;
        status: string;
        source: string;
    };
    tonemapper: {
        value: number;
        status: string;
        source: string;
    };
    hdrScale: {
        value: number;
        status: string;
        source: string;
    };
    bloom: {
        value: number;
        status: string;
        source: string;
    };
    cap: {
        value: number;
        status: string;
        source: string;
    };
    exposure: {
        value: number;
        status: string;
        source: string;
    };
    srgbWhite: {
        value: number;
        status: string;
        source: string;
    };
    luminanceMultiplier: {
        value: number;
        status: string;
        source: string;
    };
}>;
export const GLES_GLOW_GLSL: "\nvec3 godotSrgbToLinearApprox(vec3 c) {\n  return c * (c * (c * 0.305306011 + 0.682171111) + 0.012522878);\n}\nvec3 godotLinearToSrgbApprox(vec3 c) {\n  return max(vec3(1.055) * pow(c, vec3(0.416666667)) - vec3(0.055), vec3(0.0));\n}\nvec3 godotCanvasExposure(vec3 c, float exposure) {\n  return godotLinearToSrgbApprox(godotSrgbToLinearApprox(c) * exposure);\n}\nvec4 godotGlowDownsample(sampler2D sourceColor, vec2 uv, vec2 pixelSize) {\n  vec2 h = pixelSize * 0.5;\n  vec4 c = texture2D(sourceColor, uv) * 4.0;\n  c += texture2D(sourceColor, uv - h);\n  c += texture2D(sourceColor, uv + h);\n  c += texture2D(sourceColor, uv - vec2(h.x, -h.y));\n  c += texture2D(sourceColor, uv + vec2(h.x, -h.y));\n  return c / 8.0;\n}\nvec4 godotGlowUpsample(sampler2D sourceColor, vec2 uv, vec2 pixelSize) {\n  vec2 h = pixelSize * 0.5;\n  vec4 c = texture2D(sourceColor, uv + vec2(-h.x * 2.0, 0.0));\n  c += texture2D(sourceColor, uv + vec2(-h.x, h.y)) * 2.0;\n  c += texture2D(sourceColor, uv + vec2(0.0, h.y * 2.0));\n  c += texture2D(sourceColor, uv + vec2(h.x, h.y)) * 2.0;\n  c += texture2D(sourceColor, uv + vec2(h.x * 2.0, 0.0));\n  c += texture2D(sourceColor, uv + vec2(h.x, -h.y)) * 2.0;\n  c += texture2D(sourceColor, uv + vec2(0.0, -h.y * 2.0));\n  c += texture2D(sourceColor, uv + vec2(-h.x, -h.y)) * 2.0;\n  return c / 12.0;\n}\nvec3 godotGlowFilter(vec3 c, float threshold, float hdrScale, float bloom, float cap) {\n  float luminance = max(c.r, max(c.g, c.b));\n  float feedback = max(smoothstep(threshold, threshold + hdrScale, luminance), bloom);\n  return min(c * feedback, vec3(cap));\n}\nvec3 godotGlowResolve(vec3 sceneColor, vec3 upsampledGlow, float intensity) {\n  vec3 g = clamp(upsampledGlow * intensity, vec3(0.0), vec3(1.0));\n  vec3 c = sceneColor + g - sceneColor * g;\n  // Source LINEAR tonemapper is identity, but these approximate transfers aren't.\n  return godotLinearToSrgbApprox(godotSrgbToLinearApprox(c));\n}\n";
export function srgbToLinearApprox(x: any): number;
export function linearToSrgbApprox(x: any): number;
export function canvasExposure(rgb: any, exposure: any): any;
export function glowDownsample(sample: any, uv: any, pixelSize: any): any;
export function glowUpsample(sample: any, uv: any, pixelSize: any): any;

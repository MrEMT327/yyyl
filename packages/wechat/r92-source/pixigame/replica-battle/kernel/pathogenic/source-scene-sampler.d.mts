export function resource(graph: any, ref: any): any;
export function multiplyMatrix(a: any, b: any): any[];
export function transformPoint(m: any, p: any): any[];
export function godotEase(x: any, c: any): number;
export function animationTime(time: any, length?: number, loop?: number): number;
export function sampleTrack(keys: any, time: any, { length, loop, loopWrap, interpolation, captureValue, captureDuration }?: {
    length?: number;
    loop?: number;
    loopWrap?: boolean;
    interpolation?: number;
}): any;
export function resolveTexture(graph: any, ref: any, seen?: Set<any>): any;
export function sampleScene(graph: any, scenePath: any, ctx?: {}): {
    sprites: any[];
    lines: any[];
    particles: any[];
    methods: any[];
    unsupported: any[];
    nodes: any[];
    finished: boolean;
};
export const IDENTITY: readonly number[];

/** Internal read-only render sample; unanimated defaults can share source arrays. */
export const sampleSceneForRender: typeof sampleScene;

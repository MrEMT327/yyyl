export function gradientCoordinate(properties: any, u: any, v: any): number;
export function gradientPixels(graph: any, descriptor: any): {
    width: any;
    height: any;
    data: Float32Array<ArrayBuffer>;
    hdr: boolean;
};
/** Store source HDR gradient values as floats. An 8-bit canvas silently clips them. */
export function installGradientTexture(scene: any, graph: any, descriptor: any): any;

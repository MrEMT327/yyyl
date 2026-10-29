export function projectileScene(b: any, extraModels?: {}): any;
export function effectScene(fx: any): any;
export function statusScene(modelId: any): any;
export function warningScene(id: any): any;
export function validateSceneBindings(graph: any, extraModels?: {}): {
    type: string;
    path: any;
}[];
export const SOURCE_FAMILIES: Readonly<{
    200151: {
        name: string;
        body: string;
        impact: string;
    };
    200001: {
        name: string;
        body: string;
        impact: string;
    };
    200011: {
        name: string;
        body: string;
        impact: string;
    };
    200031: {
        name: string;
        body: string;
        impact: string;
    };
    200041: {
        name: string;
        body: string;
        impact: string;
    };
    200061: {
        name: string;
        body: string;
        impact: string;
    };
    200091: {
        name: string;
        body: string;
        impact: string;
    };
    200101: {
        name: string;
        body: string;
        impact: string;
    };
    200121: {
        name: string;
        body: string;
        impact: string;
    };
    200141: {
        name: string;
        body: string;
        impact: string;
    };
    200171: {
        name: string;
        body: string;
        impact: string;
    };
}>;
export const SOURCE_MODELS: Readonly<{
    [k: string]: any;
}>;
export const SOURCE_EFFECTS: Readonly<{
    [k: string]: any;
}>;
export const SOURCE_WARNINGS: Readonly<{
    150003: string;
    220010: string;
    220014: string;
    220016: string;
    'beam-warmup': string;
}>;
export const SOURCE_STATUSES: Readonly<{
    160006: string;
    170000: string;
    170001: string;
    170002: string;
    170004: string;
    170012: string;
    170013: string;
    210021: string;
    210031: string;
    220022: string;
}>;
export class MissingSourceEffect extends Error {
    constructor(kind: any, id: any);
}

export const ENEMY_ROUND_BULLET_SCENE: string;

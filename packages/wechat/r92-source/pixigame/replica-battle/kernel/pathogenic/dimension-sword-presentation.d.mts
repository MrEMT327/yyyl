export type DimensionSwordCut = {uid: number; line: number[]; shape: number[]; style: number[]};
export const DIMENSION_CUT_LIMIT: number;
export function isDimensionSword(b: Record<string,any>): boolean;
export function dimensionSwordEnvelope(progress: number): number[];
export function dimensionSwordScreenCut(b: Record<string,any>, screen: (x:number,z:number)=>{x:number;y:number}): DimensionSwordCut|null;

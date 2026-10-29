export const LOCAL_ECONOMY_POLICY: Readonly<Record<string, any>>;
export const LOCAL_INCOME_BANDS: readonly {chapter:number;gold:number;gear:number;research:number}[];
export function localIncomeRates(chapter:number): {gold:number;gear:number;research:number};
export function localPatrolVoucherRates(chapter:number): {basic:number;advanced:number};
export function economyTime(value:number): number;
export function economyDay(value:number): string;
export function localRandomMaterials(groupId:number,count:number,rng?:()=>number): [number,number][];
export function localRewardPairs(pairs:[number,number][],rng?:()=>number): [number,number][];

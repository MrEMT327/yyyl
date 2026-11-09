import type {Effect} from './model';
type Point={x:number;z:number};
type Owner={runId:number;clock:number;phase?:string;player?:{hp:number}};
export const SPECIAL_FEEDBACK_LIMIT:number;
export function recordTransportFeedback(owner:Owner,from:Point,to:Point,radius:number,familyId:number,weaponId:number):void;
export function recordInterceptionFeedback(owner:Owner,source:Point&{familyId:number;weaponId:number},target:Point):void;
export function sampleSpecialWeaponFeedback(owner:Owner):(Effect&{specialFeedback:string})[];

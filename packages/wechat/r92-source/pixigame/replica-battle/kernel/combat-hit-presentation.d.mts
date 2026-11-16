import type {Effect,Enemy,Projectile,Point} from './model';
export function markDamageText(effect:Effect,element:number):Effect;
export function damageTextPresentation(effect:Effect,age?:number):{x:number;y:number;alpha:number;scale:number;fontSize:number;color:string;depth:number};
export function recordEnemyHit(enemy:Enemy,time:number,critical:boolean,projectile:Projectile|undefined,player:Point):void;
export function sampleEnemyHitMotion(enemy:Enemy,time:number,frozen?:boolean):{x:number;y:number;scaleX:number;scaleY:number;rotation:number};
export function recordCombatResult(sim:any,target:Point,result:'immune'|'blocked'|'miss'):void;
export function sampleCombatResults(sim:any,time?:number):Effect[];

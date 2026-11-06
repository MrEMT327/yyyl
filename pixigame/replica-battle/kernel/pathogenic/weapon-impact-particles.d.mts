export const WEAPON_IMPACT_LIMITS:Readonly<{total:number;perStyle:number}>;
export function withWeaponImpactResources(graph:any):any;
export class WeaponImpactParticles {
 count:number;counts:Record<string,number>;buffers:Map<string,any>;
 beginFrame(viewport?:any):void;matches(effect:any):boolean;
 effect(effect:any,screen:(x:number,z:number)=>{x:number;y:number},visualScale?:number,age?:number):boolean;
 draw(view:any,depth?:number):void;reset():void;
}

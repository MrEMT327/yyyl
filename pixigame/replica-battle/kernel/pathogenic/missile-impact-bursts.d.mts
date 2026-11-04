export function withMissileImpactResources(graph:any):any;
export function isMissileImpact(effect:any):boolean;
export class MissileImpactBursts{
 buffers:Map<string,any>;
 beginFrame(viewport?:any):void;
 effect(effect:any,screen:(x:number,z:number)=>{x:number;y:number},visualScale?:number,age?:number):boolean;
 draw(view:any,depth?:number):void;
 reset():void;
}

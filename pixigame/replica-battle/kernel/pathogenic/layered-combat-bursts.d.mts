export function withLayeredBurstResources(graph:any):any;
export class LayeredCombatBursts {
 counts:Record<string,number>;meshes:Map<string,any>;
 beginFrame(viewport?:any):void;
 effect(effect:any,screen:(x:number,z:number)=>{x:number;y:number},visualScale?:number,age?:number):boolean;
 draw(view:any):void;reset():void;
}

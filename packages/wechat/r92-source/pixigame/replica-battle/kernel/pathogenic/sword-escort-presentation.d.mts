export const ESCORT_SWORD_LIMIT:number;
export const ESCORT_SWORD_ART:{width:number;height:number;region:readonly number[];url:string};
export function isStoredEscortSword(projectile:any):boolean;
export function withSwordEscortResources(graph:any):any;
export class SwordEscortPresentation{
 records:Map<number,any>;buffers:Map<string,any>;anchor:{x:number;z:number}|null;
 beginFrame(clock:number,run:number,projectiles:any,player:any,visualClock?:number,viewport?:any):void;
 handles(projectile:any):boolean;pose(record:any):any;draw(view:any,screen:any):void;reset():void;
}

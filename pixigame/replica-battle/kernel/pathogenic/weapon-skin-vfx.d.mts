type Row=Record<string,any>;
export const WEAPON_SKIN_VFX_LIMITS:Readonly<{projectiles:number;effects:number;vertices:number;indices:number;trails:number;trailPoints:number}>;
export function withWeaponSkinResources(graph:Row):Row;
export class WeaponSkinVfx{
  skinId:number;time:number;projectiles:number;effects:number;brush:any;trails:Map<number,Row>;
  constructor();reset():void;beginFrame(skinId:number|number[],time:number,viewport?:Row):void;
  readonly active:boolean;valid(b:Row):boolean;effectMatches(f:Row):boolean;
  projectile(b:Row,screen:(x:number,z:number)=>{x:number;y:number}):boolean;
  effect(f:Row,screen:(x:number,z:number)=>{x:number;y:number},scale?:number):boolean;
  sword(f:Row,meshes:Row[]):boolean;draw(source:any,depth:number):void;
}

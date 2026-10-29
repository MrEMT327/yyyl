type Row=Record<string,any>;
export const PROJECTILE_MOTION_LIMIT:number;
export function withProjectileMotionResources(graph:Row):Row;
export class ProjectileMotionAccents{
  batches:Record<string,Row>;
  beginFrame():void;
  reset():void;
  projectile(b:Row,screen:(x:number,z:number)=>{x:number;y:number},element?:number,sprite?:Row):void;
  draw(view:{drawMeshes:(id:string,meshes:Row[],palette:undefined,presentation:Row)=>void},depths:{player:number;enemy:number}):void;
}

type Row=Record<string,any>;
export class VfxMeshCache{entries:Map<string,any>;revision:number;beginFrame():void;get(id:string):Map<string,any>;endFrame():void;reset():void;}
export class VfxMeshBuffer{constructor(key:string,material:string,z?:number,retain?:number);mesh:Row;records:any[];createdVertices:number;reset():void;vertex(x:number,y:number,u:number,v:number,r:number,g:number,b:number,a:number):number;quad(points:any[],r:number,g:number,b:number,a:number):void;}
export function boundsVisible(left:number,top:number,right:number,bottom:number,viewport?:Row):boolean;
export function quadVisible(points:any[],viewport?:Row):boolean;
export function packedScalar(value:number,range:number,out:number[]):number[];

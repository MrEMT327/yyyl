type Row=Record<string,any>;
type Screen=(x:number,z:number)=>{x:number;y:number};
export class BeamFootprints{
 constructor(material:string,flowMaterial?:string);
 segments:number;buffer:any;flow:any;
 beginFrame(viewport?:{width:number;height:number;padding?:number}):void;
 projectile(projectile:Row,screen:Screen):void;
 draw(view:any):void;
 reset():void;
}

export function withMagneticDischargeResources(graph:any):any;
export function isMagneticDischarge(projectile:any):boolean;
export function isMagneticFan(projectile:any):boolean;
export class MagneticDischarges {
 shots:Map<number,any>;
 beginFrame(clock:number,viewport?:any):void;
 projectile(projectile:any,screen:(x:number,z:number)=>{x:number;y:number}):boolean;
 draw(view:any,depth:number):void;
 reset():void;
}

type Row=Record<string,any>;type Screen=(x:number,z:number)=>{x:number;y:number};
export function feedbackKind(effect:Row):string|null;
export function isOrdinaryContact(effect:Row):boolean;
export function withCombatFeedbackResources(graph:Row):Row;
export function isRefinedBasicStatus(status:Row):boolean;
export function refinedBasicStatusMeshes(status:Row,screen:Screen):any[];
export class CombatFeedback{constructor();count:number;contactCount:number;pickups:number;batches:Map<string,any>;statuses:number;culled:number;pool:Map<string,any>;beginFrame(viewport?:{width:number;height:number;padding?:number}):void;status(status:Row,screen:Screen):boolean;flushStatuses(view:any):void;beam(projectile:Row,screen:Screen):void;effect(effect:Row,screen:Screen,visualScale?:number):boolean;pickup(item:Row,screen:Screen):void;draw(view:any):void;reset():void;}

type Row=Record<string,any>;
type Screen=(x:number,z:number)=>{x:number;y:number};
export function isCounterRay(b:Row):boolean;
export function withSpecialWeaponResources(graph:Row):Row;
export function counterRayScreenMeshes(b:Row,screen:Screen,buffers?:Map<string,any>):Row[];
export function specialWeaponFeedbackMeshes(f:Row,screen:Screen,buffers?:Map<string,any>):Row[];

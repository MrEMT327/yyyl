export function isLayeredCorrosion(buff: Record<string, any>): boolean;
export function isLayeredIceCyclone(projectile: Record<string, any>): boolean;
export function withElementalVolumeResources(graph: Record<string, any>): Record<string, any>;
export function corrosionStatusMeshes(buff: Record<string, any>, screen: (x:number,z:number)=>{x:number;y:number}, viewport?:{width:number;height:number;padding?:number}, cache?:Map<string,any>): any[];
export function iceCycloneMeshes(projectile: Record<string, any>, screen: (x:number,z:number)=>{x:number;y:number}, viewport?:{width:number;height:number;padding?:number}, cache?:Map<string,any>): any[];

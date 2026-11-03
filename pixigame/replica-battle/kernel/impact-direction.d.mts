type Point={x:number;z:number};
export function markImpactDirection<T extends {kind:string;impactDirection?:Point}>(effect:T,source:{owner:string;vx?:number;vz?:number},segment?:{from:Point;to:Point}):T;
export function impactDirectionYaw(effect:{impactDirection?:Point}):number|undefined;

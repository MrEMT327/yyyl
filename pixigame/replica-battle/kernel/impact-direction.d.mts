type Point={x:number;z:number};
export function markImpactDirection<T extends {kind:string;impactDirection?:Point}>(effect:T,source:{owner:string;vx?:number;vz?:number;familyId?:number;weaponId?:number;modelId?:number},segment?:{from:Point;to:Point},defaultFamilyId?:number):T;
export function impactDirectionYaw(effect:{impactDirection?:Point}):number|undefined;

export function impactWeaponSource(effect:object):Readonly<{familyId:number;weaponId:number;modelId:number}>|undefined;

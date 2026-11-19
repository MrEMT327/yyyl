export interface AircraftPassiveShot { readonly uid:number; readonly bornAt:number }
export function aircraftPassiveShot(projectiles:readonly {readonly uid:number;readonly owner:string;readonly weaponId?:number;readonly age:number}[],clock:number):AircraftPassiveShot|undefined;

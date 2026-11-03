export function validateWeaponSkillSlots(raw:unknown,guns:Array<{id:number;active:boolean;equipped?:boolean}>,typeOf:(id:number)=>number,weaponType:number):number[];

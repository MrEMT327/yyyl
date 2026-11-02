export const PILOT_SKILL_SLOT_COUNT: number;
export function validatePilotSkillSlots(raw: unknown, pilots: Array<{id:number;star:number;active:boolean;equipped?:boolean}>, hasSkill:(id:number,star:number)=>boolean): number[];

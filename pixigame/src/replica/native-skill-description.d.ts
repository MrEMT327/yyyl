export type NativeSkillDescriptionRow = {
  id?: number | string;
  description?: unknown;
  descriptionSource?: unknown;
};
export type NativeSkillDescriptionRuntime = {
  skillRows?: Record<string | number, any>;
  triggers?: Record<string | number, any>;
  weapons?: Record<string | number, any>;
  bullets?: Record<string | number, any>;
  buffs?: Record<string | number, any>;
};
export function nativeSkillDescription(skill?: NativeSkillDescriptionRow, runtime?: NativeSkillDescriptionRuntime): string;

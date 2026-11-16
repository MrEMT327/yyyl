export interface WeaponChapterProgress { clearedChapterIds: number[] }
export function normalizeWeaponChapterProgress(value: unknown): WeaponChapterProgress;
export function chapterWeaponBanSkillIds(progress: WeaponChapterProgress, labs: readonly { id: number; active: boolean }[]): number[];

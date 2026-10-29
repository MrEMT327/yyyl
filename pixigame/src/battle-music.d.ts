export const PATHOGENIC_BATTLE_TRACKS: readonly string[];
export const PATHOGENIC_BOSS_TRACK: string;
export function pathogenicBattleMusic(chapterId: number, manifest: Record<string, unknown>, mainKey?: string, bossKey?: string): Record<string, {url: string; music: true}>;

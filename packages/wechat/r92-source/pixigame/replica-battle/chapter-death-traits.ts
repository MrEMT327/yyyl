import type { GameContent, Point, RecordData, Spawn } from './kernel/model';

const handler = 'AITraitCallMonsterOnDeadHandler;';

/** Narrow admission for the recovered 320068 -> 320069 branch.
 * Numeric skills and dropReward variants remain unsupported. */
export function chapterDeathCallParameters(trait: unknown): RecordData | undefined {
  if (typeof trait !== 'string' || !trait.startsWith(handler)) return;
  let p: RecordData;
  try { p = JSON.parse(trait.slice(handler.length)); } catch { return; }
  if (!p || Object.keys(p).some(key => !['callEntityID', 'perAngle', 'originAngle', 'callCount'].includes(key))) return;
  if (p.callEntityID !== 320069 || p.perAngle !== 30 || p.originAngle !== 195 || p.callCount !== 2) return;
  return p;
}

/** CreateMonsterOnDead 0x6926548..0x6926638 uses offsets 0,-1,+1,-2,+2.
 * CreateBaby 0x68d3598 passes mission=0, then assigns ParentEntity and
 * IgnoreDrop (dropReward defaults false). */
export function chapterDeathChildren(content: GameContent, trait: unknown, owner: Point & { uid: number },
  waveNumber: number, currentMission: RecordData | undefined, now: number): { spawn: Spawn; angle: number }[] {
  const p = chapterDeathCallParameters(trait);
  if (!p) return [];
  const chapter = content.chapter.chapter.parameters, wave = content.chapter.waves[waveNumber - 1];
  const child = content.chapter.entities[p.callEntityID];
  if (!child || child.raw.Type !== 2 || child.ai.type !== 'AIMoveForward' || child.ai.bornType !== 0)
    throw new Error('死亡分裂子怪的原生配置不受支持');
  const mission = currentMission?.parameters || {};
  return Array.from({ length: p.callCount }, (_, index) => ({
    angle: (p.originAngle + (index % 2 ? -1 : 1) * Math.floor((index + 1) / 2) * p.perAngle) * Math.PI / 180,
    spawn: {
      x: owner.x, z: owner.z, time: now, eventId: 0, entityId: p.callEntityID, wave: waveNumber,
      hpMultiplier: Number(chapter.hpUpgrade) * Number(wave.hpMultiplier) * (Number(mission.hpUpgrade) || 1),
      attackMultiplier: Number(chapter.attackUp) * Number(wave.attackMultiplier) * (Number(mission.attackUp) || 1),
      hpDropMultiplierRaw: 65536, exp: 0, gold: 0, loopZ: 0, loopRestartZOffset: 0,
      ignoreDrop: true, parentUid: owner.uid,
    },
  }));
}

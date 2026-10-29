import type { GameContent, RecordData, Spawn } from './model';
import type { CameraRect } from './enemy-ai';
import { advanceNativeRandomInterval, createNativeRandomInterval, nativeCallCooldownReady, nativeStraightFallSummonPosition, type NativeRandomIntervalState } from './enemy-behavior-extensions';

/** The first authored example is chapter 19's 340014 -> 330008. Its verified
 * StraightFall contract also permits other IDs/counts/timings in the same branch.
 * Positive-duration streams start .5s after the cooldown timestamp; include that
 * setup in the non-overlap gate. Child AI/assets are checked separately. */
export function nativeStraightFallSummonSupported(entity: RecordData, chapterParameters: RecordData): boolean {
  const ai = entity.ai?.parameters || {}, calls = ai.CallMonsters;
  if (entity.ai?.type !== 'AICommonBoss' || !Array.isArray(calls) || calls.length !== 1) return false;
  const allowedAI = ['CallMonsterWeight', 'CallCDTime', 'CallHoldTime', 'CallMonsters', 'MinZs', 'MaxZs', 'WeaponMoveTypes', 'WeaponWeights', 'fireCDs'];
  if (Object.keys(ai).some(key => !allowedAI.includes(key))) return false;
  const call = calls[0];
  if (!call || Object.keys(call).some(key => !['CallMonsterId', 'Count', 'TotalDuration', 'MinInterval', 'MaxInterval', 'CallAIType'].includes(key))) return false;
  const count = Number(call.Count ?? 1), duration = Number(call.TotalDuration ?? 0);
  const min = Number(call.MinInterval ?? 0), max = Number(call.MaxInterval ?? 0), cooldown = Number(ai.CallCDTime ?? 12);
  return Number.isInteger(Number(call.CallMonsterId)) && Number(call.CallMonsterId) > 0
    && Number(call.CallAIType ?? 0) === 0 && Number(ai.CallHoldTime || 0) === 0
    && Number.isFinite(Number(ai.CallMonsterWeight)) && Number(ai.CallMonsterWeight) >= 0 && Number(ai.CallMonsterWeight) <= 100
    && Number.isInteger(count) && count >= 0 && Number.isFinite(duration) && duration >= 0
    && Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max >= min
    && Number.isFinite(cooldown) && cooldown >= duration + (duration > 0 ? 0.5 : 0)
    // CreateEnemy also applies protection and chapter features. Those variants
    // must acquire their own evidence before this factory can claim fidelity.
    && Number(chapterParameters.ProtectTemplate || 0) === 0
    && !(chapterParameters.NewPlayerProtect || []).length
    && !(chapterParameters.ChapterMonsterFeature || []).length;
}

export interface NativeSummonState {
  lastCall: number;
  setupRemaining: number;
  stream?: NativeRandomIntervalState;
}
export function createNativeSummons(): NativeSummonState { return { lastCall: 0, setupRemaining: 0 }; }

/** InitAttackLoop 0x690a810 draws AIWeights before WeaponWeights. A rejected
 * cooldown returns an empty task; it does not turn into an ordinary attack. */
export function beginNativeSummonChoice(state: NativeSummonState, ai: RecordData, now: number, random: () => number, spawn: () => void): boolean {
  if (random() * 100 < 100 - ai.CallMonsterWeight) return false;
  if (nativeCallCooldownReady(now, state.lastCall, ai)) {
    state.lastCall = now;
    // getCallMonsterTask uniformly chooses the entry even with one candidate.
    random();
    if (Number(ai.CallMonsters[0].TotalDuration || 0) === 0) spawn();
    else state.setupRemaining = 0.5;
  }
  return true;
}

/** The manager runs beside ordinary attack tasks. Only the .5s setup task
 * holds the Boss. Owner deinitialization discards this state, not its babies.
 * OnStart's first callback must precede the random interval draw. */
export function advanceNativeSummons(state: NativeSummonState, ai: RecordData, dt: number, random: () => number, spawn: () => void): boolean {
  if (state.stream) {
    advanceNativeRandomInterval(state.stream, dt, random, spawn);
    if (state.stream.finished) state.stream = undefined;
  }
  if (state.setupRemaining > 0) {
    state.setupRemaining = Math.max(0, state.setupRemaining - dt);
    if (state.setupRemaining === 0) {
      spawn();
      state.stream = createNativeRandomInterval(ai.CallMonsters[0], random);
    }
  }
  return state.setupRemaining > 0;
}

/** CreateBaby passes MissionId=0 and null custom AI to CreateEnemy. That means
 * the CURRENT world mission attributes, current wave and chapter multipliers,
 * not the summoner's HP/attack and not its original creation-mission snapshot.
 * Zero mission factors are skipped by AddExBattleAttr, hence identity 1.
 * The currentMission argument must denote the last actual attribute refresh. */
export function nativeStraightFallChildSpawn(
  content: GameContent, call: RecordData, ownerUid: number, waveNumber: number, currentMission: RecordData | undefined,
  now: number, bounds: CameraRect, random: () => number,
): Spawn {
  const chapter = content.chapter.chapter.parameters;
  const wave = content.chapter.waves[waveNumber - 1];
  const entityId = Number(call.CallMonsterId), child = content.chapter.entities[entityId];
  if (!child || Number(child.raw.Type) !== 2) throw new Error(`召唤子怪 ${entityId} 尚未确认普通怪物的计数合同`);
  const pathId = Number(child.ai.parameters?.PathId) || undefined;
  if (pathId && !content.assets.geometry.paths[pathId]) throw new Error(`召唤子怪 ${entityId} 缺少原生路径 ${pathId}`);
  const mission = currentMission?.parameters || {};
  return {
    ...nativeStraightFallSummonPosition(bounds, random),
    time: now, eventId: 0, entityId, wave: waveNumber,
    hpMultiplier: Number(chapter.hpUpgrade) * Number(wave.hpMultiplier) * (Number(mission.hpUpgrade) || 1),
    attackMultiplier: Number(chapter.attackUp) * Number(wave.attackMultiplier) * (Number(mission.attackUp) || 1),
    hpDropMultiplierRaw: 65536, exp: 0, gold: 0,
    pathId, loopZ: 0, loopRestartZOffset: 0, ignoreDrop: true, parentUid: ownerUid,
  };
}

import type { RecordData } from './model';
import presentation from '../public/data/wave-presentation.json';

/** World/creator clocks remain external: states 9/10 wait only for mission
 * progression, while previously queued creators continue to become due. */
export const nativeRefreshState = Object.freeze({
  none: 0, notice: 1, refresh: 2, first: 4, waveStart: 7, waveEnd: 8,
  waitingStartUI: 9, waitingEndUI: 10,
});

export interface NativeWaveFlowPlan {
  startMissionId?: number;
  endMissionId?: number;
  startTasks: number[];
  endTasks: number[];
}

/** InitNewWaveData 0x6983d38 chooses the first missionType 0 or 2,
 * independently of which entity is a boss. End UI belongs to the final mission. */
export function nativeWaveFlowPlan(wave: RecordData): NativeWaveFlowPlan {
  const events = [...(wave.events || [])].sort((a, b) => a.id - b.id);
  return {
    startMissionId: events.find(event => event.type === 0 || event.type === 2)?.id,
    endMissionId: events[events.length - 1]?.id,
    startTasks: [...(wave.raw?.WaveStartSpecialUIType || [])],
    endTasks: [...(wave.raw?.WaveEndSpecialUIType || [])],
  };
}

export interface NativeWaveUISequence { phase: 'start' | 'end'; tasks: number[]; index: number }
export type NativeWaveUIAction =
  | { kind: 'hud-progress'; type: 1; completion: 'command22'; duration: null }
  | { kind: 'warning'; type: 2 | 5; completion: 'command22'; duration: number }
  | { kind: 'collect-and-level'; type: 4; completion: 'drops-and-upgrades-drained' }
  | { kind: 'unsupported'; type: number }
  | { kind: 'complete'; nextRefreshState: 1 | 2 };

export function createNativeWaveUISequence(plan: NativeWaveFlowPlan, phase: 'start' | 'end'): NativeWaveUISequence {
  return { phase, tasks: [...(phase === 'start' ? plan.startTasks : plan.endTasks)], index: 0 };
}

/** Caller must finish the current action explicitly. Type 4 never grants an
 * extra card: collect existing drops and drain the resulting upgrade queue.
 * Type 1 completes on the MoveIn clip's early MoveBackEnd event. The later
 * fill/shake/move-back visual chain does not hold the mission scheduler. */
export function nativeWaveUIAction(sequence: NativeWaveUISequence): NativeWaveUIAction {
  const type = sequence.tasks[sequence.index];
  if (type == null) return { kind: 'complete', nextRefreshState: sequence.phase === 'start' ? 1 : 2 };
  if (type === 1) return { kind: 'hud-progress', type, completion: 'command22', duration: null };
  if (type === 2 || type === 5) return { kind: 'warning', type, completion: 'command22', duration: presentation.finishEvent.time };
  if (type === 4) return { kind: 'collect-and-level', type, completion: 'drops-and-upgrades-drained' };
  return { kind: 'unsupported', type };
}

export function completeNativeWaveUIAction(sequence: NativeWaveUISequence): void {
  if (sequence.index < sequence.tasks.length) sequence.index += 1;
}

/** CreateTileMonster 0x6987018: interval + layout point + mission.delayTime.
 * Bind the delay to world clock WHEN RefreshMonsters queues this creator.
 * Do not shift it when a subsequent mission enters a UI wait. */
export function nativeCreatorDueClock(refreshWorldClock: number, missionDelay: number,
  layoutDelay: number, repeatDelay: number): number {
  return refreshWorldClock + missionDelay + layoutDelay + repeatDelay;
}

/** UIBattleWaterfallCtrl.RefreshUI and Consts_Const 123/124. */
export function nativeWaveHudPreDelay(previousMissionType?: number): number {
  return previousMissionType === 2 ? 0.5 : 0.2;
}

export function nativeWaveHudCompletionDelay(previousMissionType?: number): number {
  return nativeWaveHudPreDelay(previousMissionType) + presentation.hudProgress.finishEvent.time;
}

/** WaveShowStartUIHandle returns the wave number; RefreshWaveStartUIState
 * bypasses the wait on wave 1. Every shipped ordinary first wave is [1]. */
export function nativeFirstWaveSkipsHudWait(waveNumber: number, plan: NativeWaveFlowPlan): boolean {
  return waveNumber === 1 && plan.startTasks.length === 1 && plan.startTasks[0] === 1;
}

export interface NativeWaveClearState {
  /** Remaining CreateMonsterData entries, NOT future unrefreshed missions. */
  queuedCount: number;
  /** Original cumulative BattleData counters, including non-reward deaths. */
  enemyCount: number;
  killCount: number;
  hasNpc: boolean;
  heroDead: boolean;
}

export type NativeWaveFlowAction =
  | { kind: 'mission-selected'; wave: RecordData; event: RecordData }
  | { kind: 'mission'; wave: RecordData; event: RecordData; refreshWorldClock: number }
  | { kind: 'ui'; id: number; type: 1 | 2 | 4 | 5; previousMissionType?: number }
  | { kind: 'wave-finish'; wave: RecordData }
  | { kind: 'cancel-wave-creators'; wave: RecordData }
  | { kind: 'mission-event'; id: 8; missionId: number; wave: RecordData; delay: 0; limitTime: 0 }
  | { kind: 'collect-exp' }
  | { kind: 'chapter-complete' };

/** Ordinary Waterfall RefreshStateMachine. Call step once per native fixed
 * frame; do not drain zero-duration states in a while loop. Call checkClear
 * from native death COMPLETION callbacks, not every frame or at death start.
 * NPC removal has a separate next-mission path. UI completion is an explicit
 * command, not a battle pause.
 *
 * Evidence: RefreshFirstState 0x6976798; Notice 0x6977530/0x6977858;
 * Timer 0x69788c8/0x69789bc; RefreshBattleData 0x6983418;
 * CheckEnemyAllDie 0x6931924; WaterfallProgressFinishGoNext 0x692e870.
 */
export class NativeWaveFlow {
  state: number = nativeRefreshState.first;
  private readonly missions: { wave: RecordData; event: RecordData; plan: NativeWaveFlowPlan }[];
  private cursor = 0;
  private selectedIndex = -1;
  private elapsed = 0;
  private noticeElapsed = 0;
  private noticeTime = 0;
  private nextGap = -1;
  private sequence?: NativeWaveUISequence;
  private requestId = 0;
  private pendingRequest = 0;
  private finalRefreshed = false;
  private completed = false;

  constructor(waves: RecordData[], private readonly options: { chestType?: number } = {}) {
    this.missions = [...waves].sort((a, b) => a.number - b.number).flatMap(wave => {
      const plan = nativeWaveFlowPlan(wave);
      return [...wave.events].sort((a, b) => a.id - b.id).map(event => ({ wave, event, plan }));
    });
    if (!this.missions.length) throw new Error('Waterfall 缺少 mission');
  }

  get currentMissionId(): number { return this.missions[this.cursor]?.event.id || 0; }
  get currentWave(): number { return this.missions[this.cursor]?.wave.number || 1; }
  get waitingUI(): boolean { return this.state === 9 || this.state === 10; }
  get nextMissionEnemyThreshold(): number {
    return Number(this.missions[this.selectedIndex + 1]?.event.raw?.refreshCount || 0);
  }

  private selectCurrent(out: NativeWaveFlowAction[]): void {
    const item = this.missions[this.cursor];
    if (!item) throw new Error('Waterfall 超出原始 mission 队列');
    this.selectedIndex = this.cursor;
    this.finalRefreshed = false;
    const next = this.missions[this.cursor + 1]?.event;
    // Wave.refreshType is fixed-point but only zero/nonzero is tested here.
    this.nextGap = !next || (item.event.id === item.plan.endMissionId && Number(item.wave.raw?.refreshType) !== 0)
      ? -1 : Number(next.baseTime ?? next.time) - Number(item.event.baseTime ?? item.event.time);
    out.push({ kind: 'mission-selected', wave: item.wave, event: item.event });
  }

  private enterNotice(out: NativeWaveFlowAction[], resumeStart = false): void {
    this.state = 1;
    if (resumeStart) return; // Native previous state 7/9 preserves notice timer.
    this.noticeElapsed = 0;
    this.noticeTime = 0.5; // BaseSurvival.FixNoticeTime 0x6930640.
    // BattleData.IncreaseMission 0x6937c64 caps the cursor at MissionCount-1.
    this.cursor = Math.min(this.cursor + 1, this.missions.length - 1);
    this.selectCurrent(out);
    if (this.missions[this.cursor].event.id === this.missions[this.cursor].plan.startMissionId) this.state = 7;
  }

  private enterTimer(force = false): void {
    this.elapsed = 0;
    const type = Number(this.missions[this.selectedIndex].event.type);
    const pauses = type === 2 || type === 3 || (type === 9 && this.options.chestType === 1);
    this.state = !force && pauses ? 0 : 2;
  }

  private refresh(worldClock: number, out: NativeWaveFlowAction[]): void {
    const item = this.missions[this.selectedIndex];
    this.finalRefreshed = this.selectedIndex === this.missions.length - 1;
    out.push({ kind: 'mission', wave: item.wave, event: item.event, refreshWorldClock: worldClock });
    if (this.nextGap < 0) this.state = 0;
    else this.enterTimer();
  }

  private nextUI(out: NativeWaveFlowAction[]): void {
    if (!this.sequence) return;
    const action = nativeWaveUIAction(this.sequence);
    if (action.kind === 'complete') {
      const phase = this.sequence.phase;
      this.sequence = undefined;
      this.pendingRequest = 0;
      if (phase === 'start') this.enterNotice(out, true);
      else this.enterTimer(true); // Even -1: next Timer update enters Notice.
      return;
    }
    if (action.kind === 'unsupported') throw new Error(`未支持原版波次 UI 任务 ${action.type}`);
    this.pendingRequest = ++this.requestId;
    out.push({ kind: 'ui', id: this.pendingRequest, type: action.type,
      previousMissionType: this.missions[this.selectedIndex - 1]?.event.type });
  }

  step(dt: number, worldClock: number): NativeWaveFlowAction[] {
    const out: NativeWaveFlowAction[] = [];
    if (this.completed) return out;
    switch (this.state) {
      case 4:
        this.elapsed += dt;
        if (this.elapsed < 1) break;
        this.selectCurrent(out);
        if (this.missions[this.cursor].event.id === this.missions[this.cursor].plan.startMissionId) this.state = 7;
        else this.refresh(worldClock, out);
        break;
      case 1:
        this.noticeElapsed += dt;
        if (this.noticeElapsed >= this.noticeTime || this.nextGap === 0) this.refresh(worldClock, out);
        break;
      case 2:
        this.elapsed += dt;
        if (this.elapsed >= this.nextGap) this.enterNotice(out);
        break;
      case 7: {
        const item = this.missions[this.cursor];
        if (!item.plan.startTasks.length) { this.enterNotice(out, true); break; }
        this.state = 9;
        this.sequence = createNativeWaveUISequence(item.plan, 'start');
        if (nativeFirstWaveSkipsHudWait(item.wave.number, item.plan)) {
          this.sequence = undefined;
          this.enterNotice(out, true);
        } else this.nextUI(out);
        break;
      }
      case 8: {
        const item = this.missions[this.cursor];
        out.push({ kind: 'wave-finish', wave: item.wave });
        // CheckWaveShowEndUI checks the cached mission, not the cursor moved
        // by EnemyDieSpecialLogic, and requires a non-empty array.
        if (!item.plan.endTasks.length || this.missions[this.selectedIndex].event.id !== item.plan.endMissionId) {
          this.enterNotice(out);
          break;
        }
        this.state = 10;
        this.sequence = createNativeWaveUISequence(item.plan, 'end');
        this.nextUI(out);
        break;
      }
      // None and UI waits have no timer update. Existing creators still run.
    }
    return out;
  }

  completeUI(id: number): NativeWaveFlowAction[] {
    const out: NativeWaveFlowAction[] = [];
    if (!this.waitingUI || !this.sequence || id !== this.pendingRequest) return out;
    completeNativeWaveUIAction(this.sequence);
    this.nextUI(out);
    return out;
  }

  checkClear(counts: NativeWaveClearState): NativeWaveFlowAction[] {
    const out: NativeWaveFlowAction[] = [];
    if (this.completed || (this.state !== 0 && this.state !== 2) || counts.queuedCount > 0 || counts.heroDead) return out;
    const final = this.selectedIndex === this.missions.length - 1;
    if (final) {
      if (!this.finalRefreshed || counts.killCount < counts.enemyCount) return out;
      this.completed = true;
      this.state = 0;
      out.push({ kind: 'chapter-complete' });
      return out;
    }
    if (counts.enemyCount > counts.killCount + this.nextMissionEnemyThreshold) return out;
    const item = this.missions[this.cursor];
    const selected = this.missions[this.selectedIndex];
    if ((selected.event.type === 3 || (selected.event.type === 9 && this.options.chestType === 1)) && counts.hasNpc) return out;
    // Waterfall.CheckContractDevil 0x698c130: Main WorldType=1, current
    // boss mission and a next mission => event 8, then return false. This is
    // an additional Punchboard source, independent of missionType 9.
    if (selected.event.type === 2 && this.cursor + 1 < this.missions.length)
      out.push({ kind: 'mission-event', id: 8, missionId: item.event.id, wave: item.wave, delay: 0, limitTime: 0 });
    this.goNext(out);
    return out;
  }

  /** OnRemoveNpc@0x6931fe0 calls CheckGoNextMission directly after its NPC
   * gates. It does not recheck EnemyCount, nor emulate an enemy death. */
  npcRemoved(npcType: number, hasNpc: boolean): NativeWaveFlowAction[] {
    if (this.completed || this.selectedIndex < 0 || hasNpc || (npcType === 8 && this.options.chestType !== 1)) return [];
    const out: NativeWaveFlowAction[] = [];
    this.goNext(out);
    return out;
  }

  private goNext(out: NativeWaveFlowAction[]): void {
    const item = this.missions[this.cursor];
    out.push({ kind: 'collect-exp' });
    if (item.event.id === item.plan.endMissionId) this.state = 8;
    else this.enterNotice(out);
  }

  /** EnemyDieSpecialLogic: the caller first decrements the wave's native
   * special count. At <=0, cancel creators and jump the mission cursor to the
   * wave's last ID; surviving ordinary enemies still count in checkClear. */
  finishSpecialWave(): NativeWaveFlowAction[] {
    if (this.completed || this.selectedIndex < 0) return [];
    const item = this.missions[this.cursor];
    this.state = 0;
    const last = this.missions.findIndex(value => value.event.id === item.plan.endMissionId);
    if (last >= 0) this.cursor = last;
    return [{ kind: 'cancel-wave-creators', wave: item.wave }];
  }
}

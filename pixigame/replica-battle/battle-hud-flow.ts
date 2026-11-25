import { nativeWeaponDisplayText } from '../src/replica/native-weapon-display.js';
import { UPGRADE_SELECTION_TIMING } from '../src/ui/upgrade-selection-timing.js';
export interface ChoiceBurst {
  prepare(): void | Promise<boolean>;
  remove(owner:object):void;clear():void;
  draw(owner:object,stage:HTMLElement|undefined,tier:string,seconds:number):boolean;
}
import { WaveUIPresentation } from './kernel/wave-ui';
import wavePresentation from './public/data/wave-presentation.json';
import type { GameAudio } from './kernel/audio';
import type { Choice, RecordData } from './kernel/model';
import type { Simulation } from './kernel/simulation';

const breakthroughAtlasWait = 3000;

type SupplyIcon = Pick<Choice, 'icon' | 'name'>;
type Warning = { type: 2 | 5; started: number; clock: () => number; finish?: () => void };

class BattleEffects {
  private warning: Warning | null = null;
  private readonly bursts = new Set<{ tier: string; revealAt: number }>();

  constructor(private readonly stage:HTMLElement|undefined,private readonly burst:ChoiceBurst,private readonly active:()=>boolean) {}

  showWarning(_root: HTMLElement|undefined, type: 2 | 5 = 2, finish?: () => void, clock = () => performance.now() / 1000) {
    this.warning = { type, started: clock(), clock, finish };
  }

  clearWarning() { this.warning = null; }

  get warningPresentation() {
    const warning = this.warning;
    return warning ? { type: warning.type, elapsed: warning.clock() - warning.started, duration: wavePresentation.duration } : null;
  }

  showBreakthrough(tier: string, revealAt: number) {
    const owner = { tier, revealAt };
    this.bursts.add(owner);
    return () => this.removeBurst(owner);
  }

  private removeBurst(owner: {tier: string; revealAt: number}) {
    this.bursts.delete(owner);
    this.burst.remove(owner);
  }

  update() {
    for (const owner of this.bursts) {
      const elapsed = (performance.now() - owner.revealAt) / 1000;
      if (!this.active() || (elapsed >= 0 && !this.burst.draw(owner, this.stage, owner.tier, elapsed))) {
        this.removeBurst(owner);
      }
    }
    const warning = this.warning;
    if (!warning) return;
    const elapsed = warning.clock() - warning.started;
    if (elapsed >= wavePresentation.finishEvent.time && warning.finish) {
      const finish = warning.finish;
      warning.finish = undefined;
      finish();
    }
    if (this.warning === warning && elapsed >= wavePresentation.duration) this.clearWarning();
  }

  dispose() { this.clearWarning(); this.bursts.clear(); this.burst.clear(); }
}

/** Supply timing and rewards for the combat HUD. Each roll uses the earned rewards. */
class BattleSupplyRoll {
  private active = false;
  private stage: 'idle' | 'rolling' | 'result' = 'idle';
  private started = 0;
  private phaseStarted = 0;
  private rewardCount = 0;
  private slots: SupplyIcon[] = [];
  private stops: number[] = [];
  private steps: { at: number; slot: number }[] = [];
  private soundStep = -1;

  constructor(private readonly feedback: (cue: 'wheelTick' | 'wheelResult') => void) {}

  open(rewards: Choice[], pool: SupplyIcon[]) {
    this.active = true; this.steps = [];
    this.rewardCount = rewards.length;
    this.stage = rewards.length ? 'idle' : 'result';
    this.started = this.phaseStarted = performance.now();
    const available = pool.length ? pool : rewards;
    this.slots = Array.from({ length: 16 }, (_, i) => available[i % Math.max(1, available.length)] || { icon: '10000101', name: '速射机炮' });
    this.stops = rewards.map((_, i) => Math.floor((i + .5) * 16 / rewards.length));
    this.stops.forEach((slot, i) => { this.slots[slot] = rewards[i]; });
  }

  stop() {
    if (!this.active) return;
    this.active = false; this.steps = []; this.slots = []; this.stops = [];
  }

  private disabled(now: number, elapsed: number) {
    return (this.stage === 'idle' && (now - this.started) / 1000 < .617) ||
      (this.stage === 'rolling' && elapsed < .5) ||
      (this.stage === 'result' && elapsed < 1 + this.rewardCount * .2);
  }

  private stepIndex(elapsed: number) {
    let low = 0, high = this.steps.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.steps[middle].at <= elapsed) low = middle + 1;
      else high = middle;
    }
    return low - 1;
  }

  get presentation() {
    if (!this.active) return null;
    const now = performance.now(), elapsed = (now - this.phaseStarted) / 1000;
    const step = this.stepIndex(elapsed);
    return {
      started: this.started, phaseStarted: this.phaseStarted, stage: this.stage, slots: this.slots,
      motion: { index: this.stage === 'result' ? (this.stops[0] ?? -1) : (this.steps[step]?.slot ?? -1), step },
      disabled: this.disabled(now, elapsed),
    };
  }

  activate() {
    if (!this.active) return false;
    const now = performance.now();
    if (this.disabled(now, (now - this.phaseStarted) / 1000)) return false;
    if (this.stage === 'result') return true;
    if (this.stage === 'rolling') { this.showResult(now); return false; }
    this.stage = 'rolling'; this.phaseStarted = now; this.steps = []; this.soundStep = -1;
    let at = 0, slot = -1;
    const step = (interval: number) => {
      at += interval;
      slot = (slot + 1) % 16;
      this.steps.push({ at, slot });
    };
    if (this.rewardCount > 1) for (let i = 0; i < 16; i++) step(.07);
    for (let i = 0; i < 96; i++) step(.03);
    for (const stop of this.stops) {
      const distance = (stop - slot + 16) % 16 || 16;
      for (let i = 0; i < distance; i++) step(.05 + .02 * i);
      at += .6;
    }
    this.steps.push({ at: at + .1, slot });
    return false;
  }

  private showResult(now: number) {
    this.stage = 'result'; this.phaseStarted = now;
    if (this.rewardCount) this.feedback('wheelResult');
  }

  update() {
    if (!this.active || this.stage !== 'rolling') return;
    const now = performance.now(), elapsed = (now - this.phaseStarted) / 1000;
    if (elapsed >= (this.steps.at(-1)?.at ?? Infinity)) { this.showResult(now); return; }
    const step = this.stepIndex(elapsed);
    if (step >= 0 && step !== this.soundStep) { this.soundStep = step; this.feedback('wheelTick'); }
  }
}

/** Drives the single combat HUD's input, motion cues and audio. */
export class BattleHudFlow {
  private readonly effects: BattleEffects;
  private readonly wave: WaveUIPresentation;
  private readonly supply: BattleSupplyRoll;
  private readonly completeWave = (id: number) => this.sim.completeWaveUI(id);
  private lastPhase: Simulation['phase'] | undefined;
  private lastRun = -1;
  private resultAudioKey = '';
  private choiceTimer?: number;
  private choiceGeneration = 0;
  private resultTimer?: number;
  private cancelChoiceBurst?: () => void;
  private disposed = false;
  selectionStartedAt = 0;
  selecting = false;

  constructor(stage: HTMLElement|undefined, private readonly sim: Simulation, private readonly audio: GameAudio,
    private readonly onHome: () => void, private readonly weaponIcon: (familyId: number, choice?: Choice) => string | undefined,
    private readonly prepareChoiceArt: ((choice: Choice) => Promise<void> | undefined)|undefined,private readonly burst:ChoiceBurst,private readonly lifecycle={active:()=>Boolean(stage?.isConnected),visible:()=>!document.hidden}) {
    this.effects = new BattleEffects(stage,burst,lifecycle.active);
    this.wave = new WaveUIPresentation(this.effects, stage);
    this.supply = new BattleSupplyRoll(cue => { this.audio.feedback(cue); });
  }

  get battleSupplyPresentation() { return this.supply.presentation; }
  get bossWarningPresentation() { return this.effects.warningPresentation; }

  leaveBattle() {
    if (this.sim.phase === 'paused' || this.sim.phase === 'won' || this.sim.phase === 'lost') {
      this.onHome();
      this.update();
    }
  }

  togglePause() {
    if (this.sim.phase === 'playing') { this.sim.pause(); this.audio.pause(); }
    else if (this.sim.phase === 'paused') { this.sim.resume(); this.audio.resume(); }
    this.update();
  }

  advanceBattleSupply() {
    if (this.sim.phase !== 'treasure') return;
    if (this.supply.activate()) { this.sim.closeTreasure(); this.audio.resume(); }
    this.update();
  }

  chooseFromHud(id: number, onStart?: (startedAt: number) => void) {
    if (this.disposed || this.selecting || this.sim.phase !== 'upgrade') return false;
    const card = this.sim.choices.find(choice => choice.id === id);
    if (!card) return false;
    const run = this.sim.runId;
    const generation = ++this.choiceGeneration;
    const art = this.prepareChoiceArt?.(card)?.catch(() => undefined);
    this.selecting = true;
    this.audio.feedback('choice');
    const currentChoice = () => {
      if (this.disposed || generation !== this.choiceGeneration) return false;
      if (this.sim.runId === run && this.sim.phase === 'upgrade' && this.sim.choices.includes(card)) return true;
      this.cancelChoice();
      this.update();
      return false;
    };
    const commit = () => {
      if (!currentChoice()) return;
      this.sim.sounds = this.sim.sounds.filter(id => id !== 410001);
      this.cancelChoiceBurst = undefined;
      this.sim.choose(card.id);
      this.selecting = false;
      this.resumeAfterChoice();
      this.update();
    };
    const begin = (playEffect: boolean) => {
      if (!currentChoice()) return;
      this.selectionStartedAt = performance.now();
      if (card.opensBreakthrough && playEffect) {
        const tier = ['y', 'r', 'c'][Math.min(2, Math.floor((Math.max(1, card.star || 1) - 1) / 3))];
        this.cancelChoiceBurst = this.effects.showBreakthrough(tier, this.selectionStartedAt + UPGRADE_SELECTION_TIMING.reveal);
      }
      this.choiceTimer = setTimeout(() => {
        this.choiceTimer = undefined;
        if (art) void art.then(commit);
        else commit();
      }, card.opensBreakthrough ? UPGRADE_SELECTION_TIMING.breakthroughCommit : UPGRADE_SELECTION_TIMING.normalCommit);
      onStart?.(this.selectionStartedAt);
    };
    const loading = card.opensBreakthrough ? this.burst.prepare() : undefined;
    if (loading) {
      let settled = false;
      const ready = (loaded: boolean) => {
        if (settled || generation !== this.choiceGeneration) return;
        settled = true;
        clearTimeout(this.choiceTimer);
        this.choiceTimer = undefined;
        begin(loaded);
      };
      this.choiceTimer = setTimeout(() => ready(false), breakthroughAtlasWait);
      void loading.then(ready, () => ready(false));
    } else begin(true);
    return true;
  }

  private resumeAfterChoice() { if (this.sim.phase === 'playing') this.audio.resume(); }

  private cancelChoice() {
    this.choiceGeneration++;
    if (this.choiceTimer !== undefined) clearTimeout(this.choiceTimer);
    this.choiceTimer = undefined;
    this.cancelChoiceBurst?.(); this.cancelChoiceBurst = undefined;
    this.selecting = false;
  }

  private iconKey(familyId: number, choice?: Choice) {
    return this.weaponIcon(familyId, choice) || this.sim.content.combat.families[familyId]?.icon || String(familyId);
  }

  equippedWeapons() {
    const s = this.sim, families = Object.values(s.content.combat.families || {}) as RecordData[];
    const weapons = [...s.secondary];
    if (s.mainWeaponEquipped) weapons.unshift([s.content.chapter.player.weaponEntityId, s.cannon]);
    return weapons.map(([entityId, state]) => {
      const family = families.find(row => row.entityId === entityId);
      const stage = family?.stages.find((row: RecordData) => row.skillId === state.stageId);
      return { entityId, icon: family ? this.iconKey(family.id) : '10000101', name: nativeWeaponDisplayText(family?.name || '速射机炮'), star: stage?.star || 1 };
    });
  }

  private openSupply() {
    const s = this.sim;
    const rewards = s.treasureRewards.map(card => {
      if (!s.content.combat.families[card.group]) return card;
      return { ...card, name: nativeWeaponDisplayText(card.name), description: battleSkillDescription(card), icon: this.iconKey(card.group, card) };
    });
    const pool = [...this.equippedWeapons(), ...s.learned.filter(card => card.id >= 11000000), ...rewards];
    this.supply.open(rewards, [...new Map(pool.map(card => [card.icon, card])).values()]);
  }

  update() {
    if (this.disposed) return;
    const s = this.sim;
    if (s.phase === 'upgrade' && s.sounds.includes(410001)) {
      this.audio.pause(false, true);
      if (this.audio.feedback('upgrade')) s.sounds = s.sounds.filter(id => id !== 410001);
    }
    this.wave.update(s.waveUIRequest, s.runId, s.phase === 'playing', this.completeWave);
    if (s.phase === 'ready' || s.phase === 'won' || s.phase === 'lost' || s.player.hp <= 0) this.effects.clearWarning();
    if (s.phase !== 'upgrade' && this.selecting) this.cancelChoice();
    this.effects.update();
    if (s.phase === 'treasure') this.supply.update();
    else this.supply.stop();
    if (s.phase === this.lastPhase && s.runId === this.lastRun) return;
    this.lastPhase = s.phase; this.lastRun = s.runId;
    if (s.phase === 'ready' || s.phase === 'playing' || s.phase === 'paused') return;
    if (s.phase === 'upgrade' || s.phase === 'treasure') {
      this.audio.pause(false, true);
      if (s.phase === 'treasure') this.openSupply();
      return;
    }
    this.audio.pause();
    const resultKey = `${s.runId}:${s.phase}`;
    if ((s.phase === 'won' || s.phase === 'lost') && this.resultAudioKey !== resultKey) {
      this.resultAudioKey = resultKey;
      const phase = s.phase, run = s.runId;
      if (this.resultTimer !== undefined) clearTimeout(this.resultTimer);
      this.resultTimer = setTimeout(() => {
        this.resultTimer = undefined;
        if (s.runId === run && s.phase === phase && this.lifecycle.visible() && this.lifecycle.active()) {
          this.audio.effect(phase === 'won' ? 'mixkit:victory' : 'mixkit:defeat', phase === 'won' ? .24 : .19, 1);
        }
      }, phase === 'won' ? 1700 : 0);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelChoice();
    if (this.resultTimer !== undefined) clearTimeout(this.resultTimer);
    this.effects.dispose();
    this.supply.stop();
  }
}

export function battleSkillDescription(card: RecordData) {
  if (card.description) return nativeWeaponDisplayText(card.description);
  const original = String(card.descriptionSource || '').replace(/\{(\d+)\}/g,
    (match, index) => card.descriptionArgsSource?.[Number(index)] ?? match);
  return nativeWeaponDisplayText(original || effectDescription(card.effects || []));
}

function effectDescription(effects: RecordData[]) {
  return effects.map(e => {
    const value = Number(e.value ?? 0);
    const n = Number.isInteger(value) ? value : +value.toFixed(1);
    const labels: Record<string, string> = {
      addDamagePercent: `武器伤害 ${n >= 0 ? '+' : ''}${n}%`, reduceCooldownPercent: `射击间隔减少 ${n}%`,
      addCritRatePercent: `暴击率 +${n}%`, addParallelProjectiles: `正向子弹 +${n}`, addPierce: `穿透次数 +${n}`,
      addFireCount: `连续发射 +${n}`, addMaxHpPercent: `最大生命 +${n}%`, addGlobalAttackPercent: `攻击力 +${n}%`,
      addSecondary: '解锁新的自动攻击武器', addReflectionCount: `弹射次数 +${n}`, addReboundCount: `反弹次数 +${n}`,
      addSkillDamagePercent: `技能伤害 ${n >= 0 ? '+' : ''}${n}%`, addCritDamagePercent: `暴击伤害 +${n}%`,
      addBulletSpeedPercent: `弹速 ${n >= 0 ? '+' : ''}${n}%`, addBulletScalePercent: `子弹尺寸 +${n}%`,
      addSideProjectiles: `斜向子弹 +${n}`, addParallelCountPercent: `正向弹数 +${n}%`, addSideCountPercent: `斜向弹数 +${n}%`,
      addExplosionRadiusPercent: `爆炸范围 +${n}%`, enableExplosion: e.onCrit ? '暴击触发范围爆炸' : '命中触发范围爆炸',
      addHitBuff: `${Number((e.probability * 100).toFixed(1))}% 概率附加${e.buffId === 200000 ? '破甲' : e.buffId === 200001 ? '灼烧' : '冰冻减速'}`,
      addBounce: `敌人间弹跳 +${n} 次`, disablePierce: '取消穿透', disablePierceDamageReduction: '穿透伤害不再衰减',
      addBeamLengthPercent: `射线长度 ${n >= 0 ? '+' : ''}${n}%`, addBeamWidthPercent: `射线宽度 ${n >= 0 ? '+' : ''}${n}%`,
      reduceHitIntervalPercent: `伤害间隔减少 ${n}%`, reduceGlobalCooldownPercent: `全部武器间隔减少 ${n}%`,
      addSalvoCount: `齐射弹数 +${n}`, addSalvoAngle: `齐射角度 +${n}°`, addHomingTurnRate: `追踪转速 +${n}°/秒`,
      addLifetimeSeconds: `持续时间 +${n} 秒`, addLifetimePercent: `持续时间 ${n >= 0 ? '+' : ''}${n}%`, addRange: `索敌距离 +${n}`,
    };
    return labels[e.type] || '';
  }).filter(Boolean).join('；');
}

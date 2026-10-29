import type { Enemy, RecordData } from './model';

export interface NativeUrgencyWarning { startedAt: number; duration: number; posType: number }

/** UrgencyTipData and AIMoveOnPathLoopBorn.<InitAttackLoop>b__7_0:
 * hover 113, scale 1, showTime=TipTime, positioning=PosType. */
export function nativeUrgencyParameters(data: RecordData): { duration: number; posType: number; onCreate: boolean } {
  let parameters: RecordData = {};
  try { parameters = JSON.parse(data.raw?.UrgencyTipParameters || '{}'); } catch { /* No configured warning. */ }
  return { duration: Math.max(0, Number(parameters.TipTime || 0)), posType: Number(parameters.PosType || 0), onCreate: parameters.CreateTime === 1 };
}

export function startNativeUrgencyWarning(enemy: Enemy, data: RecordData): void {
  const p = nativeUrgencyParameters(data);
  if (p.duration > 0) enemy.urgencyWarning = { startedAt: enemy.age, duration: p.duration, posType: p.posType };
}

/** Sprite dimensions are UI units, not world units or enemy model scale.
 * GameHoverUrgencyTip.PlayFadeAni 0x74e7120 fades 1 -> 0 -> 1 in .15s
 * legs forever; DOTween's shipped defaultEaseType=6 is OutQuad. */
export function sampleNativeUrgencyWarning(enemy: Enemy): { alpha: number; posType: number } | undefined {
  const warning = enemy.urgencyWarning;
  if (!warning || enemy.dead) return;
  const age = enemy.age - warning.startedAt;
  if (age < 0 || age >= warning.duration) return;
  const leg = age % .3, t = (leg < .15 ? leg : leg - .15) / .15;
  const eased = t * (2 - t);
  return { alpha: leg < .15 ? 1 - eased : eased, posType: warning.posType };
}

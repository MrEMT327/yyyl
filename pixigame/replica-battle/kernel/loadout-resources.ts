import type { RecordData } from './model';
import { withNativeResearchRuntime } from '../../src/replica/native-research-runtime.js';

let runtimeRequest: Promise<RecordData> | undefined;
let appearanceRequest: Promise<RecordData> | undefined;
/** Shared by content and the study screen: only one normalized dependency pack
 * is read, and original FP timings never flow straight out of the raw catalog. */
export function loadLoadoutRuntime(): Promise<RecordData> {
  return runtimeRequest ||= fetch('data/loadout-runtime.json', { cache: 'no-store' }).then(async response => {
    if (!response.ok) throw new Error('缺少装备技能战斗依赖包');
    return withNativeResearchRuntime(await response.json());
  }).catch(error => { runtimeRequest = undefined; throw error; });
}

export function loadPlayerAppearances(): Promise<RecordData> {
  return appearanceRequest ||= fetch('data/player-appearances.json', { cache: 'no-store' }).then(async response => {
    if (!response.ok) throw new Error('缺少原版战机与人物战斗模型');
    return await response.json();
  }).catch(error => { appearanceRequest = undefined; throw error; });
}

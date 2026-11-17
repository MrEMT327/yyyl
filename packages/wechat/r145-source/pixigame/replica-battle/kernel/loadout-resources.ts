import type { RecordData } from './model';
import { withNativeResearchRuntime } from '../../src/replica/native-research-runtime.js';

const runtimeRequests = new WeakMap<typeof fetch, Promise<RecordData>>();
const appearanceRequests = new WeakMap<typeof fetch, Promise<RecordData>>();
export type ReadSharedLoadoutJSON = (name: 'loadout-catalog' | 'loadout-runtime' | 'player-appearances') => Promise<RecordData>;
/** Shared by content and the study screen: only one normalized dependency pack
 * is read, and original FP timings never flow straight out of the raw catalog. */
export function loadLoadoutRuntime(fetchResource: typeof fetch = fetch, readShared?: ReadSharedLoadoutJSON): Promise<RecordData> {
  let request = runtimeRequests.get(fetchResource);
  if (!request) {
    request = (readShared ? readShared('loadout-runtime').then(withNativeResearchRuntime) : readRuntime(fetchResource))
      .catch(error => { runtimeRequests.delete(fetchResource); throw error; });
    runtimeRequests.set(fetchResource, request);
  }
  return request;
}

function readRuntime(fetchResource: typeof fetch): Promise<RecordData> {
  return fetchResource('data/loadout-runtime.json', { cache: 'no-store' }).then(async response => {
    if (!response.ok) throw new Error('缺少装备技能战斗依赖包');
    return withNativeResearchRuntime(await response.json());
  });
}

export function loadPlayerAppearances(fetchResource: typeof fetch = fetch, readShared?: ReadSharedLoadoutJSON): Promise<RecordData> {
  let request = appearanceRequests.get(fetchResource);
  if (!request) {
    request = (readShared ? readShared('player-appearances') : readAppearances(fetchResource))
      .catch(error => { appearanceRequests.delete(fetchResource); throw error; });
    appearanceRequests.set(fetchResource, request);
  }
  return request;
}

function readAppearances(fetchResource: typeof fetch): Promise<RecordData> {
  return fetchResource('data/player-appearances.json', { cache: 'no-store' }).then(async response => {
    if (!response.ok) throw new Error('缺少原版战机与人物战斗模型');
    return await response.json();
  });
}

import {createReplicaBattleBridge as createSession} from './battle-session-bridge.js';
import {showSortieLoading} from '../ui/sortie-loading.js';
export {appearanceOf} from './battle-session-bridge.js';
export function createReplicaBattleBridge(options){return createSession({showSortieLoading,...options});}

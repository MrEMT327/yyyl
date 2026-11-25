import { startLobbySession } from '../../../../../../../pixigame/src/lobby-runtime/host-session.js';
import { backpackUseRule } from '../../../../../../../pixigame/src/replica/native-backpack-use.js';
import { prepareWechatRandom } from './platform-builtins.js';

const randomSupply=new Set(['draw','open','task','activity','weekly','ad','devAd']);
function drawsRandomReward(action,payload){
  if(action==='gearSupply'||action==='recruit')return true;
  if(action==='pilotSupply')return randomSupply.has(payload.action);
  if(action==='backpackUse'){
    const kind=backpackUseRule(payload.id)?.kind;
    return kind==='pilotBox'||kind==='equipmentKey';
  }
  return false;
}

function persistentStorage(api) {
  const keys=()=>api.getStorageInfoSync().keys;
  return {
    get length() { return keys().length; },
    key(index) { return keys()[index] ?? null; },
    getItem(key) {
      const value=api.getStorageSync(key);
      return value === '' && !keys().includes(key) || value == null ? null : String(value);
    },
    setItem(key,value) { api.setStorageSync(key,String(value)); },
    removeItem(key) { api.removeStorageSync(key); },
  };
}

function temporaryStorage() {
  const data=new Map();
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.get(key) ?? null; },
    setItem(key,value) { data.set(key,String(value)); },
    removeItem(key) { data.delete(key); },
  };
}

export function startWechatLobbySession(api,platform,{ device, mountLobby, createBattle, createAudio, restart,
  playAd, readSharedLoadoutJSON, loadDetails, showFirstSortieRetry }) {
  let current=true;
  prepareWechatRandom(api)?.catch(error=>console.warn('[Three 随机数准备]',error?.message||error));
  const sessionHost={
    isCurrent:()=>current,
    storage:persistentStorage(api),
    sessionStorage:temporaryStorage(),
    audio:{platform},
    frames:{
      isVisible:()=>platform.visible,
      requestFrame:platform.requestFrame,
      cancelFrame:platform.cancelFrame,
      watchVisibility(change){
        let visible=platform.visible;
        return platform.onViewport((_bounds, foreground)=>{
          if (foreground===visible) return;
          visible=foreground;
          change();
        });
      },
    },
    setTimeout:(callback,delay)=>setTimeout(callback,delay),
    clearTimeout:handle=>clearTimeout(handle),
    readSharedLoadoutJSON,
    prepareAction(action,payload){if(drawsRandomReward(action,payload))return prepareWechatRandom(api);},
    playAd,
    restart,showFirstSortieRetry,
    dispose(){current=false;},
  };
  return startLobbySession({sessionHost,platformKind:'wechat',app:{renderer:device},
    mountLobby,createBattle,createAudio,loadDetails});
}

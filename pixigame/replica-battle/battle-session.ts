import '../src/ui/scroll-surfaces.css';
import './battle-launch.css';
import '../src/ui/psd-titles.css';
import '../src/ui/combat-ui.css';
import '../src/ui/psd-popup.css';
import '../src/ui/guide-presentation.css';
import '../src/ui/project-battle-interface-art.css';
import { mountDomButtonPress } from '../src/ui/dom-button-press.js';
import {createBattlePerformanceReporter} from '../src/replica/battle-performance.js';
import {createBattleLaunch} from './battle-launch.js';
import {createMovementGuide} from './battle-onboarding';
import { createBattleLifetime, disposeNativeAudio } from './battle-lifetime.js';
import { createBattleActivity } from './battle-activity.js';
import { installBattleCheckpoint } from '../src/replica/battle-checkpoint.js';
import { GameAudio } from './kernel/audio';
import { Controls } from './kernel/input';
import type {BattleRendering} from './battle-rendering';
import {mountSharedBattleSession,type BattleBindings,type BattlePlatform} from './battle-session-core';
export type {BattlePlatform} from './battle-session-core';

export function mountBattleSession(platform:BattlePlatform,engine:BattleRendering) {
  const {window,document,location,parent}=platform;
  const stage=document.getElementById('stage')!;
  const params=new URLSearchParams(location.search);
  const id=params.get('session');
  const makeAbort=()=>new AbortController();
  const bindings:BattleBindings={
    stage,id,chapterId:Number(params.get('chapter')),baseURL:document.baseURI,battleURL:location.href,
    hidden:()=>document.hidden,now:()=>performance.now(),reducedMotion:()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    emit:platform.emit??(message=>parent.postMessage(message,location.origin)),
    playable:Boolean(platform.emit||parent!==window),
    createLifetime(){
      const lifetime=createBattleLifetime(window,makeAbort);
      lifetime.add(mountDomButtonPress());
      return lifetime;
    },
    bind(receive,fail,signal){
      if(!platform.emit)window.addEventListener('message',event=>{
        if(event.origin===location.origin&&event.source===parent)receive(event.data);
      },{signal});
      window.addEventListener('error',event=>fail(event.error||event.message),{signal});
      window.addEventListener('unhandledrejection',event=>fail(event.reason),{signal});
    },
    createPerformance:()=>createBattlePerformanceReporter({session:id}),
    createGuide:()=>platform.movementGuide??createMovementGuide(stage),
    createAudio:manifest=>new GameAudio(manifest),
    disposeAudio:disposeNativeAudio,
    createLaunch:options=>createBattleLaunch({...options,stage} as Parameters<typeof createBattleLaunch>[0]),
    createControls:(canMove,pause,signal)=>new Controls(stage,canMove,pause,signal),
    onActivity:options=>createBattleActivity({...options,page:document,host:window,allowParentFocus:true}),
    unlockOnPointer(unlock,signal){stage.addEventListener('pointerdown',unlock,{passive:true,signal});},
    watchVisibility(change,signal){
      document.addEventListener('visibilitychange',change,{signal});return ()=>document.removeEventListener('visibilitychange',change);
    },
    registerCheckpoint:read=>installBattleCheckpoint(read,platform.checkpointTarget??window),
    markStarted(){stage.removeAttribute('data-awaiting-start');},
  };
  return mountSharedBattleSession({...platform,bindings},engine);
}

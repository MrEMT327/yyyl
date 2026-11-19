import type {GameContent,Choice} from './kernel/model';
import type {Simulation} from './kernel/simulation';
import type {BattlePlatform} from './battle-session';
import type {createAppearance} from './appearance';
export interface BattleRendering {
  mountCombatHud(options:any):Promise<any>|any;
  mountDeveloperSkills(stage:HTMLElement,sim:Simulation,audio:import('./kernel/audio').GameAudio,ui:import('./battle-hud-flow').BattleHudFlow):{destroy():void};
  createChoiceBurst():import('./battle-hud-flow').ChoiceBurst;
  createAppearance: (...args:Parameters<typeof createAppearance>)=>Promise<any>;
  createView(content:GameContent,sim:Simulation,ready:()=>void,skin:any,render?:unknown,plan?:any,optimize?:boolean,native?:boolean):any;
  ready?(view:any,skin:any,watch:(canvas:HTMLCanvasElement,gl:WebGLRenderingContext|WebGL2RenderingContext)=>void):void;
  rawDelta(view:any):number;
  installPace(options:{scene:any;controls:any;signal:AbortSignal;isPlaying:()=>boolean}):{destroy:()=>void};
  preparePlayer(view:any,layers:any,signal:AbortSignal):Promise<void>|void;
  start(options:{scene:any;platform:BattlePlatform;lifetime:any;frameReuse:any;graphics:any;battlePerformance:any;
    reportLoading:(phase:string,p:number)=>void;renderedFrame:()=>void;fail:(error:unknown)=>void}):void;
}

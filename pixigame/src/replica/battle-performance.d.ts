export const BATTLE_PERFORMANCE_CHANNEL:string;
export function createBattlePerformanceReporter(options:{windowRef?:Window;documentRef?:Document;session:string|null;now?:()=>number;post?:(payload:any)=>void}):{
  watch(canvas:HTMLCanvasElement,gl:WebGLRenderingContext|WebGL2RenderingContext):void;
  attach(game:any):void;
  destroy():void;
};
export function createBattlePerformanceSource(options?:any):any;

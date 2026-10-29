export const BATTLE_LAUNCH_SECONDS:number;
export function launchProgress(seconds:number):number;
export function createBattleLaunch(options:{
  stage:HTMLElement;
  player:()=>{x:number;z:number;oldX:number;oldZ:number};
  bounds:()=>{left:number;right:number;bottom:number;top:number};
  clearInput:()=>void;
  onVisual:(value:{time:number;thrust:number}|null)=>void;
  onComplete:()=>void;
  reducedMotion?:()=>boolean;
}):{readonly active:boolean;begin():void;reveal():void;update(delta:number):void;destroy():void};

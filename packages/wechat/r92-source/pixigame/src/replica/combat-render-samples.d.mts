type Row=Record<string,any>;
export class CombatRenderSamples {
  clock:number;time:number;alpha:number;revision:number;
  beginFrame(clock:number,run:number,phase:string,delta:number):number;
  age(value:number):number;
  projectile<T extends Row>(source:T,defaultFamily?:number):T;
  pickup<T extends Row>(source:T):T;
}
export class CombatStatusIndex {
  frozen:Set<number>;targets:Map<number,Row>;visuals:Row[];
  update(sim:{readonly activeBuffVisuals:Row[];enemies:Row[]}):this;
}

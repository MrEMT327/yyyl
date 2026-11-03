type Row=Record<string,any>;
export class MissileWingMounts {
  beginFrame(clock:number,run:number,projectiles:readonly Row[],mounts?:readonly {x:number;z:number}[]):void;
  projectile<T extends Row>(source:T):T;
}

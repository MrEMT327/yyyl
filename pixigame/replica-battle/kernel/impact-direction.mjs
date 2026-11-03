// Cosmetic hit metadata follows the actual collision segment, including a
// reflected beam. It never edits a projectile, combat angle or random stream.
export function markImpactDirection(effect, source, segment) {
 if(effect.kind!=='hit'||source?.owner!=='player')return effect;
 let dx=segment?.to?.x-segment?.from?.x,dz=segment?.to?.z-segment?.from?.z;
 let length=Math.hypot(dx,dz);
 if(!Number.isFinite(length)||length<1e-7){dx=source.vx;dz=source.vz;length=Math.hypot(dx,dz);}
 if(Number.isFinite(length)&&length>=1e-7)effect.impactDirection={x:dx/length,z:dz/length};
 return effect;
}
export function impactDirectionYaw(effect) {
 const d=effect.impactDirection;
 return d&&Number.isFinite(d.x)&&Number.isFinite(d.z)&&Math.hypot(d.x,d.z)>=1e-7?Math.atan2(d.x,d.z):undefined;
}

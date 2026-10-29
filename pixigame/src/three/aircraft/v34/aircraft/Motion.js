import {Euler} from 'three';
const euler=new Euler(0,0,0,'YXZ');
/** Absolute time; the complete trajectory constants live in effects.json. */
export function poseAt(t,c,m,pos,quat){
 const moving=c.cruise?1:0,a=t*m.speed;
 pos.set(Math.sin(a*m.swayRate[0])*m.sway[0]*moving,c.altitude+Math.sin(t*m.bobRate)*m.bobAmplitude+Math.sin(a*m.swayRate[1])*m.sway[1]*moving,Math.sin(a*m.swayRate[2])*m.sway[2]*moving);
 euler.set(Math.sin(a*m.pitchRate)*m.pitchAmplitude*moving,m.yawBase+Math.sin(a*m.yawRate)*m.yawAmplitude*moving,Math.cos(a)*m.rollAmplitude*moving);
 quat.setFromEuler(euler);
}

// Cosmetic sidecars: never consume simulation serials, RNG, HP or collision state.
const hits=new WeakMap(),texts=new WeakMap(),receipts=new WeakMap();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ELEMENT_COLORS={2:'#ffad78',3:'#b1ed83',4:'#94dfff',5:'#8cead8',6:'#c7b0ff'};
const RESULT_COLORS={immune:'#c5dae7',blocked:'#ffe0a1',miss:'#a0e7e6'};
const RESULT_LABELS={immune:'免疫',blocked:'抵挡',miss:'闪避'};

export function markDamageText(effect,element){texts.set(effect,{element:Number(element)||0});return effect;}
export function damageTextPresentation(fx,age=fx.age){
 const t=clamp(fx.duration>0?age/fx.duration:1,0,1),meta=texts.get(fx)||fx.presentation||{};
 const result=meta.result,hurt=String(fx.value??'').startsWith('−'),strong=Boolean(result||hurt||fx.critical);
 const id=Math.abs(fx.uid||0),lane=id%5-2,spacing=clamp(String(fx.value??'').length*9+10,44,72);
 // A fast impact expansion settles before the readable drifting phase.
 const settle=fx.critical?.19:result?.16:.14;
 const scale=t<settle?.72+(fx.critical?.66:.40)*Math.sin(t/settle*Math.PI/2)
   :1+(fx.critical?.38:result?.12:.12)*Math.exp(-(t-settle)*12);
 const lift=strong?10*Math.sin(Math.min(1,t/.34)*Math.PI):4*Math.sin(Math.min(1,t/.30)*Math.PI);
 return {x:result?0:lane*spacing,y:-8-(result?0:Math.floor(id/5)%3*24)-t*(result?28:36)-lift,
  alpha:(strong?1:.92)*Math.pow(1-t,strong?.7:.85),scale,
  fontSize:result?18:hurt?21:fx.critical?22:18,
  color:result?RESULT_COLORS[result]:hurt?'#ff7277':fx.critical?'#ffed91':ELEMENT_COLORS[meta.element]||'#f3f5ed',depth:42};
}

export function recordEnemyHit(enemy,time,critical,projectile,player){
 if(!enemy||!Number.isFinite(time))return;
 const previous=hits.get(enemy);
 if(previous&&time>=previous.at&&time-previous.at<(critical?.065:.085))return;
 let x=projectile?.vx,z=projectile?.vz;
 if(!Number.isFinite(x)||!Number.isFinite(z)||Math.hypot(x,z)<1e-5){const from=projectile||player||enemy;x=enemy.x-from.x;z=enemy.z-from.z;}
 const length=Math.hypot(x,z)||1;hits.set(enemy,{at:time,x:x/length,z:z/length,critical:Boolean(critical)});
}
// Different impulse envelopes make light wings snap back and heavy bodies
// settle with inertia. These are pixel offsets on the view, never knockback.
const HIT_MOTION={
 light:{duration:.20,decay:3.8,frequency:9.5,kick:2.2,squash:.022,roll:.020},
 standard:{duration:.25,decay:4.0,frequency:8.0,kick:1.65,squash:.014,roll:.010},
 wing:{duration:.27,decay:3.6,frequency:7.0,kick:1.65,squash:.010,roll:.024},
 heavy:{duration:.34,decay:4.2,frequency:5.6,kick:.80,squash:.004,roll:.004},
 boss:{duration:.28,decay:5.2,frequency:8.0,kick:.38,squash:0,roll:.002},
};
export function sampleEnemyHitMotion(enemy,time,frozen=false){
 const rest={x:0,y:0,scaleX:1,scaleY:1,rotation:0},hit=hits.get(enemy);
 if(!hit||enemy.dead||!Number.isFinite(time)||time<hit.at)return rest;
 const rx=Number.isFinite(enemy.radiusX)&&enemy.radiusX>0?enemy.radiusX:.8;
 const rz=Number.isFinite(enemy.radiusZ)&&enemy.radiusZ>0?enemy.radiusZ:rx;
 const size=Math.sqrt(rx*rz),wide=rx/rz>1.45;
 const p=enemy.boss?HIT_MOTION.boss:size>=2.1?HIT_MOTION.heavy:wide?HIT_MOTION.wing:size<.8?HIT_MOTION.light:HIT_MOTION.standard;
 const age=time-hit.at;if(age>=p.duration)return rest;
 const t=age/p.duration,fade=clamp((1-t)/.25,0,1),tail=fade*fade*(3-2*fade);
 const envelope=Math.exp(-t*p.decay)*Math.sin(t*p.frequency)*tail;
 const amount=(hit.critical?1.22:1)*(enemy.elite?.85:1)*(frozen?.28:1);
 const angle=Number.isFinite(enemy.angle)?enemy.angle:0;
 const lateral=hit.x*Math.cos(angle)-hit.z*Math.sin(angle);
 const squash=frozen?0:Math.sin(Math.PI*Math.min(1,t/.65))*Math.exp(-t*4)*p.squash*amount;
 return {x:hit.x*envelope*p.kick*amount,y:-hit.z*envelope*p.kick*amount,
  scaleX:1+squash,scaleY:1-squash*.75,rotation:envelope*p.roll*lateral*amount};
}

function receiptState(sim){
 let state=receipts.get(sim);
 if(!state||state.run!==sim.runId||sim.clock<state.clock){state={run:sim.runId,clock:sim.clock,next:-1,items:[],last:new WeakMap()};receipts.set(sim,state);}
 state.clock=sim.clock;return state;
}
export function recordCombatResult(sim,target,result){
 if(!target||!RESULT_LABELS[result]||!Number.isFinite(sim.clock))return;
 const state=receiptState(sim),last=state.last.get(target);
 if(last&&last.result===result&&sim.clock-last.at<.38)return;
 state.last.set(target,{at:sim.clock,result});
 state.items=state.items.filter(item=>sim.clock-item.at<item.effect.duration);
 if(state.items.length>=16)state.items.shift();
 const effect={uid:state.next--,kind:'text',x:target.x,z:target.z,age:0,duration:.65,size:1,value:RESULT_LABELS[result]};
 texts.set(effect,{result});state.items.push({at:sim.clock,effect});
}
export function sampleCombatResults(sim,time=sim.clock){
 const state=receiptState(sim);state.items=state.items.filter(item=>sim.clock-item.at<item.effect.duration);
 for(const item of state.items)item.effect.age=Math.max(0,time-item.at);
 return state.items.map(item=>item.effect);
}

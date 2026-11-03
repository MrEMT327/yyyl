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
  alpha:(strong?1:.82)*Math.pow(1-t,strong?.7:.85),scale,
  fontSize:result?18:hurt?21:fx.critical?22:16,
  color:result?RESULT_COLORS[result]:hurt?'#ff7277':fx.critical?'#ffed91':ELEMENT_COLORS[meta.element]||'#d9e4e8',depth:42};
}

export function recordEnemyHit(enemy,time,critical,projectile,player){
 if(!enemy||!Number.isFinite(time))return;
 const previous=hits.get(enemy);
 if(previous&&time>=previous.at&&time-previous.at<(critical?.065:.085))return;
 let x=projectile?.vx,z=projectile?.vz;
 if(!Number.isFinite(x)||!Number.isFinite(z)||Math.hypot(x,z)<1e-5){const from=projectile||player||enemy;x=enemy.x-from.x;z=enemy.z-from.z;}
 const length=Math.hypot(x,z)||1;hits.set(enemy,{at:time,x:x/length,z:z/length,critical:Boolean(critical)});
}
export function sampleEnemyHitMotion(enemy,time,frozen=false){
 const rest={x:0,y:0,scaleX:1,scaleY:1,rotation:0},hit=hits.get(enemy);
 if(!hit||enemy.dead||!Number.isFinite(time)||time<hit.at)return rest;
 const age=time-hit.at;if(age>=.22)return rest;
 const envelope=Math.exp(-age*17)*Math.sin(age*44),squash=Math.sin(Math.min(1,age/.16)*Math.PI)*Math.exp(-age*7);
 const amount=(hit.critical?1.25:1)*(enemy.boss?.24:enemy.elite?.72:1)*(frozen?.40:1);
 const size=clamp(Math.sqrt(Math.max(.01,(enemy.radiusX||.5)*(enemy.radiusZ||.5))),.3,1.8);
 const kick=(1.4+size*.35)*amount;
 return {x:hit.x*envelope*kick,y:-hit.z*envelope*kick,
  scaleX:1+squash*.045*amount,scaleY:1-squash*.035*amount,
  rotation:envelope*.014*amount*(hit.x<0?-1:1)};
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

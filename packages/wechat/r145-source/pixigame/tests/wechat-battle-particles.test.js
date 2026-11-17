import test from 'node:test';
import assert from 'node:assert/strict';
import {ParticlePlayer,sampleParticles} from '../replica-battle/kernel/pathogenic/pathogenic-particles.mjs';
import {IceWeaponTrails} from '../replica-battle/kernel/pathogenic/ice-weapon-trails.mjs';

const graph={resources:{frost:{type:'ParticleProcessMaterial',properties:{
  particle_flag_disable_z:true,gravity:[0,-12,0],initial_velocity_min:3,initial_velocity_max:18,
  scale_min:.3,scale_max:1.4,damping_min:1,damping_max:2,
}}}};
const emitter={path:'frost',properties:{process_material:{$ref:'frost'},amount:40,lifetime:2,fixed_fps:30,
  one_shot:true,explosiveness:.8,local_coords:true}};

test('phone particle budgets keep the original seed, birth and motion of surviving slots',()=>{
  const full=new ParticlePlayer(),compact=new ParticlePlayer();
  for(const age of [0,.031,.1,.167,.42,1.033,1.91,.35,.86,2.16]){
    const normal=full.sample(graph,emitter,71+age,22,{startAge:71});
    const budget=compact.sample(graph,emitter,71+age,22,{startAge:71,particleLimit:8,maxInstances:5});
    assert.deepEqual(normal,sampleParticles(graph,emitter,71+age,22,{startAge:71}));
    const slots=normal.instances.filter(p=>p.number%5===2).slice(0,5);
    assert.deepEqual(budget.instances,slots);
  }
});

test('a previously sampled particle age still honors a changed frame budget',()=>{
  const player=new ParticlePlayer();
  const full=player.sampleReadOnly(graph,emitter,.8,9,{historyRevision:0,particleLimit:8,maxInstances:8});
  const limited=player.sampleReadOnly(graph,emitter,.8,9,{historyRevision:0,particleLimit:8,maxInstances:2});
  const restored=player.sampleReadOnly(graph,emitter,.8,9,{historyRevision:0,particleLimit:8,maxInstances:8});
  assert.equal(full.instances.length,8);
  assert.deepEqual(limited.instances,full.instances.slice(0,2));
  assert.deepEqual(restored.instances,full.instances);
});

test('a crowded ice build uses bounded texture batches and frees their old render data',()=>{
  const rendered=[];
  const trails=new IceWeaponTrails({},.25,{drawMeshes(key,[mesh]){
    rendered.push({key,quads:mesh.indices.length/6});
  }});
  const viewport={width:540,height:960,padding:0},screen=(x,z)=>({x,y:z});
  for(const clock of [0,.033,.083,.16,.24,.32,.41]){
    trails.beginFrame(clock,[0,0],viewport);
    for(let uid=0;uid<24;uid++){
      const blade=uid%2===0;
      trails.projectile({uid,owner:'player',familyId:blade?200031:200141,modelId:blade?1000032:1000009,
        scale:1,age:clock,lifetime:2,x:70+uid*12,z:400-clock*15,vz:-90},screen);
    }
    rendered.length=0;
    trails.endFrame();
    assert(rendered.length<=3);
    assert(rendered.reduce((sum,row)=>sum+row.quads,0)<=72);
  }
  assert(rendered.length>=2);
  assert.equal(trails.created,0);
  trails.beginFrame(3,[0,0],viewport);
  rendered.length=0;
  trails.endFrame();
  assert.deepEqual(rendered,[]);
  trails.reset();
  assert.equal(trails.batches.size,0);
});

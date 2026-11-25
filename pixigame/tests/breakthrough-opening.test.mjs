import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import atlas from '../src/three/game-screen/breakthrough-art.json' with {type:'json'};
import {UPGRADE_SELECTION_TIMING as timing} from '../src/ui/upgrade-selection-timing.js';

const bundle=await build({entryPoints:['src/ui/breakthrough-backdrop.js'],bundle:true,write:false,format:'esm',platform:'node'});
const {sampleBreakthroughFrame}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const release=(timing.burst-timing.reveal)/1000;
const end=(timing.finish-timing.reveal)/1000;
const accents=frame=>frame.surfaces.flatMap(surface=>surface.draws.filter(d=>d.material.name==='breakthrough-starlight').map(d=>d.sprite));

test('all breakthrough tiers draw their gathering trails and release on the existing front atlas batch',()=>{
  for(const [tier,axes] of [['y',1],['r',2],['c',3]]){
    const charging=sampleBreakthroughFrame(.55,tier);
    const withTrails=charging.surfaces.filter(s=>s.draws.some(d=>d.sprite.crop&&d.material.name==='breakthrough-starlight'));
    assert.equal(withTrails.length,1);
    assert.equal(withTrails[0].side,'front');
    assert.equal(withTrails[0].blend,'add');
    const burst=accents(sampleBreakthroughFrame(release,tier));
    assert.equal(new Set(burst.filter(s=>s.x===0&&s.z===0).map(s=>s.rotation)).size,axes);
    for(const s of [...accents(charging),...burst]){
      assert.ok(atlas.tiles[s.key]);
      assert.ok(s.alpha>0&&s.alpha<=1&&s.width>0&&s.height>0);
      assert.ok(Number.isFinite(s.x+s.z+s.rotation));
    }
    const sparks=t=>accents(sampleBreakthroughFrame(t,tier)).filter(s=>s.x||s.z);
    const first=sparks(release+.025),last=sparks(end-.02);
    assert.ok(first.length>0&&first.length===last.length);
    first.forEach((s,i)=>assert.ok(Math.hypot(last[i].x,last[i].z)>Math.hypot(s.x,s.z)&&last[i].alpha<s.alpha));
  }
});

test('replays use deterministic accents, reduce-motion omits them and no light survives the handoff',()=>{
  for(const tier of ['y','r','c']){
    const first=sampleBreakthroughFrame(.55,tier);
    sampleBreakthroughFrame(.98,tier);
    assert.deepEqual(accents(sampleBreakthroughFrame(.55,tier)),accents(first));
    for(const time of [-.01,0,.55,release,end-.01,end,end+.1]){
      const frame=sampleBreakthroughFrame(time,tier,true);
      assert.equal(accents(frame).length,0);
      assert.equal(frame.surfaces.filter(s=>s.side==='front').flatMap(s=>s.draws).length,0);
      assert.equal(frame.flashAlpha,0);
    }
    for(const time of [-.01,end,end+.1])assert.equal(sampleBreakthroughFrame(time,tier).particleCount,0);
  }
});


test('the combat HUD opens the matching tier from each breakthrough card and commits once on its original cue',async t=>{
  const hud=await build({entryPoints:['replica-battle/battle-hud-flow.ts'],bundle:true,write:false,format:'esm',platform:'node'});
  const {BattleHudFlow}=await import('data:text/javascript;base64,'+Buffer.from(hud.outputFiles[0].text).toString('base64'));
  let now=0,scheduled;
  t.mock.method(performance,'now',()=>now);
  t.mock.method(globalThis,'setTimeout',(run,delay)=>{scheduled={run,at:now+delay};return 1;});
  t.mock.method(globalThis,'clearTimeout',()=>{scheduled=undefined;});
  for(const [star,tier] of [[3,'y'],[6,'r'],[9,'c']]){
    const card={id:star,star,opensBreakthrough:true},applied=[],seen=[];
    const sim={runId:star,phase:'upgrade',choices:[card],sounds:[],player:{hp:100},
      choose(id){applied.push(id);this.phase='playing';}};
    const burst={prepare(){},clear(){},remove(){},draw(owner,stage,color,seconds){
      const frame=sampleBreakthroughFrame(seconds,color);
      seen.push({tier:color,accents:accents(frame).length});
      return frame.visible;
    }};
    const audio={pause(){},resume(){},feedback(){return true;}};
    const flow=new BattleHudFlow(undefined,sim,audio,()=>{},()=>undefined,undefined,burst,{active:()=>true,visible:()=>true});
    const start=now;
    flow.update();
    assert.ok(flow.chooseFromHud(card.id));
    assert.equal(flow.chooseFromHud(card.id),false);
    now=start+timing.reveal-1;
    flow.update();
    assert.deepEqual(seen,[]);
    now=start+timing.reveal+500;
    flow.update();
    assert.equal(seen.at(-1).tier,tier);
    assert.ok(seen.at(-1).accents>0);
    assert.deepEqual(applied,[]);
    assert.equal(scheduled.at,start+timing.breakthroughCommit);
    now=scheduled.at;
    scheduled.run();
    now=start+timing.finish+1;
    flow.update();
    assert.deepEqual(applied,[card.id]);
    assert.equal(seen.at(-1).accents,0);
    flow.dispose();
  }
});

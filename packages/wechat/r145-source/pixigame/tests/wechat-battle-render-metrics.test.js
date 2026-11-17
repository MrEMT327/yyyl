import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {BATTLE_PERFORMANCE_CHANNEL,createBattlePerformanceReporter} from '../src/replica/battle-performance.js';

test('draw samples average the submitted frames by context, including frames with no draws', () => {
  const windowRef = Object.assign(new EventTarget(), {location:{origin:'https://game.test'},parent:{}});
  const documentRef = Object.assign(new EventTarget(), {hidden:false});
  const context = () => ({TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6,
    isContextLost:()=>false,drawArrays(){},drawElements(){},drawElementsInstanced(){}});
  const phaser = context(), scene = context(), ui = context();
  const original = phaser.drawArrays;
  const game = {canvas:{},events:new EventEmitter(),renderer:{gl:phaser}};
  const snapshots = [];
  let clock = 0;
  const reporter=createBattlePerformanceReporter({windowRef,documentRef,session:'chapter',now:()=>clock,post:row=>snapshots.push(row)});
  reporter.watch({},scene);
  reporter.watch({classList:{contains:name=>name==='cloud-combat-canvas'}},ui);
  reporter.attach(game);
  try {
    windowRef.dispatchEvent(Object.assign(new Event('message'), {
      origin:windowRef.location.origin,source:windowRef.parent,
      data:{channel:BATTLE_PERFORMANCE_CHANNEL,type:'sampling',session:'chapter',epoch:1,enabled:true},
    }));
    clock=16;
    game.events.emit('prestep');
    scene.drawArrays(scene.TRIANGLES,0,9);
    game.events.emit('poststep');
    phaser.drawElements(phaser.TRIANGLES,6,0,0);
    phaser.drawArrays(phaser.TRIANGLE_STRIP,0,5);
    game.events.emit('postrender');

    // A frozen upgrade animates while the Phaser step is bypassed. Those
    // submissions belong to the overlay, not the next completed battle frame.
    for(let frame=0;frame<4;frame++){
      for(let draw=0;draw<50;draw++)ui.drawArrays(ui.TRIANGLES,0,6);
      reporter.finishOverlayFrame();
    }
    clock=416;
    game.events.emit('prestep');
    ui.drawElementsInstanced(ui.TRIANGLES,6,0,0,3);
    game.events.emit('poststep');
    phaser.drawArrays(phaser.TRIANGLES,0,3);
    game.events.emit('postrender');

    const {rendering,contexts}=snapshots.at(-1).metrics;
    assert.deepEqual(rendering,{available:true,frame:2,calls:2.5,triangles:7.5});
    assert.deepEqual(contexts,[{name:'场景3D',available:true,calls:.5,triangles:1.5},
      {name:'界面3D',available:true,calls:.5,triangles:3},{name:'Phaser',available:true,calls:1.5,triangles:3}]);

    reporter.resetPhase();
    clock=500;game.events.emit('prestep');
    clock=503;game.events.emit('poststep');
    clock=507;reporter.measure('screenPresent',()=>{clock=512;});
    game.events.emit('postrender');
    const metrics=snapshots.at(-1).metrics;
    assert.equal(metrics.rendering.calls,0);
    assert.equal(metrics.costs.render.mean,4);
    assert.equal(metrics.costs.screenPresent.mean,5);

    clock=950;game.events.emit('prestep');
    const enemyDone=reporter.beginMeasure('enemyVisual',28);
    clock=963;enemyDone();
    const projectileDone=reporter.beginMeasure('projectileVisual',96);
    clock=991;projectileDone();
    clock=995;game.events.emit('poststep');
    clock=1000;reporter.measure('screenPresent',()=>{clock=1004;});
    game.events.emit('postrender');
    assert.deepEqual(snapshots.at(-1).metrics.peakFrame,{
      gapMs:492,waitMs:438,updateMs:45,renderMs:5,presentMs:4,enemies:28,projectiles:96,
      work:{enemyVisual:13,projectileVisual:28,screenPresent:4},
    });
  } finally {
    reporter.destroy();
  }
  assert.equal(phaser.drawArrays,original);
});

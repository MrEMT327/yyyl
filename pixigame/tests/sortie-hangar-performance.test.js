import test from 'node:test';
import assert from 'node:assert/strict';
import {createHangarLift} from '../src/ui/sortie-hangar-lift.js';
import {hangarPose} from '../src/ui/sortie-hangar-motion.js';
function node(animated=true){const a=[],style={removeProperty(k){delete this[k];}};return{a,style,...(animated?{animate(keys,timing){const v={keys,timing,currentTime:0,plays:0,pauses:0,canceled:false,pause(){this.pauses++;},play(){this.plays++;},cancel(){this.canceled=true;}};a.push(v);return v;}}:{})};}
test('lift moves model and deck by the same compositor transform and keeps the original timing',()=>{
 const host=node(),deck=node(),lift=createHangarLift(host,deck);lift.resize(400);lift.start();
 assert.deepEqual(host.a[0].keys,deck.a[0].keys);assert.equal(host.a[0].keys[1].transform,'translate3d(0,-130px,0)');
 assert.equal(host.a[0].timing.duration,3200);assert.equal(host.a[0].timing.easing,'cubic-bezier(0.333333333333,0,0.666666666667,1)');lift.dispose();
});
test('resize preserves elapsed lift time instead of jumping to the beginning',()=>{
 const host=node(),deck=node(),lift=createHangarLift(host,deck);lift.resize(400);lift.start();host.a[0].currentTime=1200;deck.a[0].currentTime=1200;
 lift.resize(600);assert.equal(host.a[1].currentTime,1200);assert.equal(deck.a[1].currentTime,1200);assert.equal(host.a[1].keys[1].transform,'translate3d(0,-195px,0)');assert(host.a[0].canceled);lift.dispose();
});
test('returning from background resumes unfinished lift and never replays a finished one',()=>{
 const host=node(),deck=node(),lift=createHangarLift(host,deck);lift.resize(400);lift.start();host.a[0].currentTime=800;deck.a[0].currentTime=800;
 lift.pause();lift.resume();assert.equal(host.a[0].plays,1);assert.equal(deck.a[0].plays,1);
 host.a[0].currentTime=3200;deck.a[0].currentTime=3200;lift.pause();lift.resume();assert.equal(host.a[0].plays,1);assert.equal(deck.a[0].plays,1);lift.dispose();
});
test('legacy WebView lift uses the same exact pose as the original animation',()=>{
 const host=node(false),deck=node(false),lift=createHangarLift(host,deck);lift.resize(400);lift.start();lift.update(1.2);
 assert.equal(host.style.transform,`translate3d(0,${-130*hangarPose(1.2).lift}px,0)`);assert.equal(host.style.transform,deck.style.transform);lift.dispose();
});
test('reduced motion stops travel at the final deck position and dispose cancels all animations',()=>{
 const host=node(),deck=node(),lift=createHangarLift(host,deck);lift.resize(400);lift.start();lift.reduce(true);
 assert(host.a[0].canceled);assert.equal(host.style.transform,'translate3d(0,-130px,0)');lift.dispose();assert.equal(host.style.transform,undefined);assert.equal(deck.style.transform,undefined);
});

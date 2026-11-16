import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {setUiMarkup,clearUiMarkupCache} from '../src/ui/ui-markup.js';
const fixture=()=>parseHTML('<html><body><main></main></body></html>').document.querySelector('main');
const html=(name,price=100)=>`<section><button>${name} ${price}</button><div><input value="original"><canvas></canvas></div></section>`;
const show=(host,key,price)=>setUiMarkup(host,html(key,price),{pageKey:key});

test('returning to an unchanged tab restores its live canvas, input, scroll and listeners',()=>{
  const host=fixture();show(host,'equipment');const page=host.firstChild,button=page.querySelector('button'),canvas=page.querySelector('canvas');
  const scroller=page.querySelector('div');scroller.scrollTop=92;page.querySelector('input').value='draft';
  let clicks=0;button.addEventListener('click',()=>clicks++);
  show(host,'shop');assert.equal(page.isConnected,false);show(host,'equipment');
  assert.equal(host.firstChild,page);assert.equal(host.querySelector('canvas'),canvas);assert.equal(scroller.scrollTop,92);
  assert.equal(host.querySelector('input').value,'draft');host.querySelector('button').click();assert.equal(clicks,1);
});
test('a changed price invalidates a cached page and shows current data',()=>{
  const host=fixture();show(host,'shop');const old=host.firstChild;show(host,'equipment');show(host,'shop',250);
  assert.notEqual(host.firstChild,old);assert.equal(host.querySelector('button').textContent,'shop 250');
});
test('only two inactive pages are retained and clearing releases all cache entries',()=>{
  const host=fixture();show(host,'a');const a=host.firstChild;show(host,'b');const b=host.firstChild;show(host,'c');show(host,'d');
  show(host,'b');assert.equal(host.firstChild,b);show(host,'a');assert.notEqual(host.firstChild,a);
  show(host,'b');const before=host.firstChild;show(host,'a');clearUiMarkupCache(host);show(host,'b');assert.notEqual(host.firstChild,before);
});
test('subpages do not grow the tab cache and oversized markup is not retained',()=>{
  const host=fixture();show(host,'home');const home=host.firstChild;
  setUiMarkup(host,html('detail'));setUiMarkup(host,html('another detail'));show(host,'home');assert.equal(host.firstChild,home);
  const big='<section>'+ 'x'.repeat(250001)+'</section>';setUiMarkup(host,big,{pageKey:'large'});const large=host.firstChild;
  show(host,'home');setUiMarkup(host,big,{pageKey:'large'});assert.notEqual(host.firstChild,large);
});
test('the five-tab lobby can retain all of its inactive tab roots',()=>{
  const host=fixture(),tabs=['shop','assembly','battle','research','supply'];
  const render=tab=>setUiMarkup(host,html(tab),{pageKey:tab,maxCachedPages:tabs.length-1});
  const nodes=tabs.map(tab=>{render(tab);return host.firstChild;});
  for(const [index,tab] of tabs.entries()){
    render(tab);assert.equal(host.firstChild,nodes[index]);
  }
});
test('releasing inactive tabs preserves the live page through the next render',()=>{
  const host=fixture();show(host,'assembly');const assembly=host.firstChild;
  show(host,'battle');const battle=host.firstChild;
  clearUiMarkupCache(host,{keepCurrent:true});show(host,'battle');assert.equal(host.firstChild,battle);
  show(host,'assembly');assert.notEqual(host.firstChild,assembly);
});

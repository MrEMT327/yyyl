import assert from 'node:assert/strict';
import test from 'node:test';
import {useArtworkLoader} from '../../../../../pixigame/src/three/game-screen/image-loading.js';
import {battleChoiceProgress} from '../../../../../pixigame/src/ui/battle-choice-progress.js';
import {bindCombatButtonArt} from '../../../../../pixigame/src/ui/combat-art.js';
import {Texture} from 'three';
import {createUpgradeArtwork,paintPsdChoiceArt,preloadPsdChoiceFrames} from '../../../../../pixigame/src/ui/psd-choice-art.js';

test('choice frames preload and a cold prismatic card stays visible until its skin is ready',async t=>{
  const requests=new Map(),warmed=[];
  t.after(useArtworkLoader((url,priority)=>{
    const name=url.split('/').at(-1);
    assert.equal(requests.has(name),false);
    const image=Promise.withResolvers();
    requests.set(name,{...image,priority});
    return image.promise;
  }));
  preloadPsdChoiceFrames(texture=>warmed.push(texture));
  assert.deepEqual([...requests].map(([name,request])=>[name,request.priority]),
    ['banner','card-red','card-blue','card-prismatic','reroll'].map(name=>[name+'.png',-2]));
  const image={width:224,height:562};
  requests.get('card-red.png').resolve(image);
  await Promise.resolve();

  const cards=[2,5,8].map(star=>{
    const {frameArt,palette}=battleChoiceProgress({star},true);
    const surface={image:()=>({material:{}})};
    const frame=paintPsdChoiceArt(surface,frameArt,0,0,180,480,{accent:palette});
    const fallback={visible:true},skin={renderable:true},button={children:[fallback,skin]};
    bindCombatButtonArt(button,skin,frame,{showWhileLoading:true});
    return {button,fallback,skin,frame};
  });
  const [gold,red,prismatic]=cards;
  assert.equal(gold.frame,red.frame);
  assert.equal(gold.button.prepareButtonArt(),true);
  assert.equal(red.button.prepareButtonArt(),true);
  assert.equal(prismatic.button.prepareButtonArt(),false);
  assert.ok(cards.every(card=>card.button.renderable));
  assert.equal(prismatic.fallback.visible,true);
  assert.equal(prismatic.skin.renderable,false);
  assert.deepEqual(warmed,[gold.frame]);

  requests.get('card-prismatic.png').resolve(image);
  await Promise.resolve();
  assert.deepEqual(warmed,[gold.frame,prismatic.frame]);
  assert.equal(prismatic.button.prepareButtonArt(),true);
  assert.equal(prismatic.button.prepareButtonArt,null);
  assert.equal(prismatic.button.renderable,true);
  assert.equal(prismatic.fallback.visible,false);
  assert.equal(prismatic.skin.renderable,true);
  for(const key of ['banner','card-blue','reroll'])requests.get(key+'.png').resolve(image);
  await Promise.resolve();
});

test('the upgrade offer waits for the complete icon group and its upload',()=>{
  const image={width:128,height:128};
  const first=new Texture(image), last=new Texture();
  const choices=['first','last'].map((itemId,index)=>({model:{itemId,progress:battleChoiceProgress({star:index+2},true)}}));
  let uploaded=false;
  const prepare=createUpgradeArtwork({presentation:{choices},preparePanelTextures:()=>uploaded},
    new Map([['first',first],['last',last]]));
  assert.equal(prepare(0),null);
  assert.equal(prepare(250),null);
  last.image=image;
  assert.equal(prepare(270),null);
  uploaded=true;
  assert.deepEqual(prepare(286),{framesReady:true,iconsReady:true});
});

import * as T from 'three';

export function makeBattleGroup(host,x=0,y=0){
  const group=new T.Group();group.userData.host=host;group.position.set(x,y,0);return group;
}

export function selectBattleRegion(node,key,frame){
  const host=node.userData.host,b=host.art.get(key);
  if(!b)throw Error('缺少局内图集 '+key);
  const crop=frame===undefined?null:b.frames.get(frame);
  const [x,y,w,h]=crop||[0,0,b.width,b.height];
  const u=node.material.uniforms;
  u.art.value=b.texture;u.size.value.set(w,h);
  u.region.value.set(x/b.width,y/b.height,w/b.width,h/b.height);
  node.userData.partWidth=w;node.userData.partHeight=h;
}

export function makeBattlePart(host,x,y,key,frame){
  const node=host.stage.makeSprite(host.art.get(key),20);
  node.userData.host=host;selectBattleRegion(node,key,frame);
  node.position.set(x,y,0);return node;
}


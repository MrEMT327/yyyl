import './combat-ui.css';
import './psd-popup.css';

const summaries = {
  cannon:['伤害 +12% · 直线弹链\n连续射击 2 秒进入过载','过载子弹额外穿透 1 个敌人','过载时双副炮同步开火'],
  rail:['伤害 +15% · 贯穿 +1\n贯穿敌人后逐步增伤','击杀后加速并延长飞行','弹道留下电磁裂痕'],
  rocket:['伤害 +12% · 爆炸范围扩大\n爆炸后分裂 3 枚微型火箭','微型火箭优先追击未命中敌人','每第三轮发射 3 枚主火箭'],
  laser:['伤害 +12% · 光束加宽\n延迟追加一次脉冲','两次脉冲命中同敌时追加伤害','追加脉冲变为三路激光'],
  scatter:['伤害 +12% · 弹丸 +2\n近距离命中触发电磁冲击','外侧弹丸命中后向前反弹','每第三轮追加收束散射'],
  sidegun:['伤害 +12% · 射程与弹速提升\n子弹命中或到边界后向前折射','折射子弹自动修正方向','侧射后追加斜后方齐射'],
  grenade:['伤害 +12% · 弹跳 +1\n每次弹跳触发小爆炸','最终爆炸分裂 3 枚小炸弹','每第三枚变为重型榴弹'],
  mine:['伤害 +12% · 感应与爆炸范围扩大\n触发附近地雷连锁引爆','爆炸后分裂 2 枚小地雷','每第五枚核心雷释放电弧'],
  beam:['伤害 +12% · 光束加宽\n持续命中同敌逐步增伤','击杀转火时短暂保留增伤','增伤满层后分裂第二道光束'],
  lightning:['伤害 +12% · 连锁距离增加\n每次连锁额外分叉','击杀敌人触发范围放电','每第五次攻击召唤雷暴'],
  freeze:['伤害 +12% · 冻结积累加快\n冻结敌人受到伤害 +15%','冻结敌人死亡触发寒冰破碎','寒冰破碎传递冻结进度'],
  orb:['伤害 +12% · 体积与持续时间增加\n敌群密集时减速膨胀','连续命中同敌逐步增伤','消失时分裂 2 枚小球'],
  toxin:['伤害 +12% · 毒区扩大延长\n毒区最多叠加 3 层','中毒敌人死亡留下毒区','尾迹定期生成扩张毒云'],
  blades:['伤害 +12% · 斩击范围扩大\n每第三击触发三倍伤害交叉斩','交叉斩可消除或反弹敌弹','交叉斩命中 5 个以上敌人追加环斩'],
  gravity:['伤害 +15% · 范围与击退增强\n越靠近中心伤害越高','击退敌人可造成碰撞伤害','主冲击后追加环形冲击'],
  lightmine:['伤害 +12% · 激光持续延长\n四路激光缓慢旋转','命中后产生横向折射光束','结束前展开八向旋转光阵'],
  pyro:['伤害 +12% · 燃烧持续延长\n弹跳逐步扩大最终爆炸','每次弹跳甩出燃烧碎片','最终爆炸留下燃烧区域'],
  shield:['伤害 +12% · 耐撞次数增加\n盾盘往返均可伤敌挡弹','阻挡普通敌弹并反射回去','同时发射两面弧形盾盘'],
  tail:['伤害 +12% · 每轮子弹 +3\n快速移动或转向触发追加射击','命中后短暂提升移动速度','追加尾流变为三向扇形弹流'],
  drone:['伤害 +12% · 持续与耐久增加\n标记死亡裂殖 · 小无人机上限12架','裂殖无人机可再裂殖一次\n满额召唤转增伤，每次+5%，最高+50%','满12架后召唤母机，全场最多1架'],
};

export function upgradeSummary(skill,model) {
  if (!model.evolving) return [];
  const stage=Number(skill.key.split('-').at(-1))-1;
  return (summaries[skill.itemId.replace(/^aux_/,'')]?.[stage] || '解锁新的武器机制').split('\n');
}

// Native modal isolates input from the canvas. Reading never consumes a choice.
export function showUpgradeDetails(skill,model) {
  const dialog=document.createElement('dialog');
  dialog.className='combat-detail-dialog';
  dialog.dataset.psdPopup='secondary';
  dialog.dataset.upgradeKind=model.evolving?'evolution':'numeric';
  dialog.setAttribute('aria-labelledby','combat-detail-title');
  const header=document.createElement('header');header.className='combat-detail-heading';
  const eyebrow=document.createElement('span');eyebrow.className='combat-detail-eyebrow';eyebrow.textContent=model.evolving?'形态强化':'数值强化';
  const title=document.createElement('h3');title.textContent=model.name;
  title.id='combat-detail-title';
  const kind=document.createElement('span');kind.className='combat-detail-kind';kind.textContent=model.label;
  header.append(eyebrow,title,kind);
  const body=document.createElement('div');body.className='combat-detail-body';
  const owner=document.createElement('p');owner.className='combat-detail-owner';owner.textContent=model.owner;
  const level=document.createElement('div');level.className='combat-detail-level';
  const levelLabel=document.createElement('span');levelLabel.textContent=model.evolving?'形态变化':model.stat.label;
  const levelValue=document.createElement('strong');levelValue.textContent=`${model.stat.before} → ${model.stat.after}${model.stat.unit}`;
  level.append(levelLabel,levelValue);
  const effects=document.createElement('section');effects.className='combat-detail-effects';
  const effectsTitle=document.createElement('h4');effectsTitle.textContent='强化效果';
  const copy=document.createElement('p');copy.id='combat-detail-effects';
  copy.textContent=model.descriptions.join('\n\n');
  effects.append(effectsTitle,copy);
  const note=document.createElement('p');note.className='combat-detail-note';note.textContent=skill.restriction||'仅本局有效';
  body.append(owner,level,effects,note);
  const close=document.createElement('button');close.textContent='返回选择';
  // The canvas opens this modal on pointer-up. Its following synthetic click
  // can land on this newly mounted button; only accept a gesture begun here.
  let closePressed=false;
  close.addEventListener('pointerdown',()=>{closePressed=true;});
  close.addEventListener('pointercancel',()=>{closePressed=false;});
  close.onclick=event=>{if(event.detail===0||closePressed)dialog.close();closePressed=false;};
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  const topClose=document.createElement('button');topClose.className='psd-popup-close';topClose.setAttribute('aria-label','关闭强化详情');
  let topPressed=false;topClose.onpointerdown=()=>{topPressed=true;};topClose.onpointercancel=()=>{topPressed=false;};
  topClose.onclick=event=>{if(event.detail===0||topPressed)dialog.close();topPressed=false;};
  dialog.append(header,body,close,topClose);document.body.append(dialog);dialog.showModal();
}

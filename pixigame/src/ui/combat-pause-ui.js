import { Container, Rectangle } from '../three/display.js';
import { combatPauseModel } from './combat-pause-model.js';
import { paintCombatArt } from './combat-art.js';
import { paintPsdPopup } from './psd-popup-art.js';
import { drawUiSymbol } from './ui-symbols.js';
import { upgradeIconLayout, fitUpgradeIcon } from './upgrade-icon-layout.js';
import iconCrops from './psd-choice-icon-crops.json' with {type:'json'};

function weaponImage(surface,texture,id,box) {
  if(!texture)return;
  const source=iconCrops[id],crop=source&&{x:source.crop[0],y:source.crop[1],width:source.crop[2],height:source.crop[3]};
  const fit=crop?{...fitUpgradeIcon(...source.size,crop,box),crop}:upgradeIconLayout(texture,box);
  surface.image(texture,fit.x,fit.y,fit.width,fit.height,fit.crop).material.toneMapped=!texture.userData.inventoryIcon;
}

// Reference composition in the existing 600 × 1300 combat coordinate system.
export function renderCombatPause(root,bridge,art,{surface,button,backdrop}) {
  const model=combatPauseModel(bridge),game=bridge.game;
  backdrop(root,0x030b13,.64);
  const panel=new Container();panel.label='combat-pause';root.addChild(panel);
  panel.pauseSnapshot=model;
  const label=(value,x,y,size=24,color='#f2f7ff',align='left')=>surface(panel,s=>s.text(value,x,y,{size,color,align,weight:800}));
  const control=(id,x,y,w,h,title,action,primary=false)=>{
    const node=button({x,y,width:w,height:h,text:title,fontSize:29,variant:primary?'primary':'secondary',
      art:primary?'primary':'secondary',onPress:action});
    // Preserve the reference's small utility artwork while keeping mobile hit areas usable.
    if(!id.startsWith('weapons-')&&!id.startsWith('upgrades-')) {
      const hitWidth=Math.max(112,w),hitHeight=Math.max(112,h);
      node.hitArea=new Rectangle((w-hitWidth)/2,(h-hitHeight)/2,hitWidth,hitHeight);
    }
    node.label='pause-'+id;panel.addChild(node);return node;
  };
  const navigate=mode=>{game.pauseMode=mode;bridge.pixiCombatUi?.render();};
  const refresh=()=>bridge.pixiCombatUi?.render();
  const mode=game.pauseMode||'pause';
  if(mode==='settings'||mode==='stats'||mode==='detail') {
    surface(panel,s=>paintPsdPopup(s,'primary',42,325,516,630));
    label(mode==='settings'?'设置':mode==='stats'?(Array.isArray(model.damage)?'伤害统计':'本局统计'):game.pauseDetail?.name||'强化详情',86,390,32,'#f5faff');
    if(mode==='stats'&&Array.isArray(model.damage)) {
      const total=model.damage.reduce((sum,w)=>sum+w.damage,0);
      const pages=Math.max(1,Math.ceil(model.damage.length/6)),page=Math.min(pages-1,Math.max(0,game.pauseDamagePage||0));
      model.damage.slice(page*6,page*6+6).forEach((weapon,i)=>surface(panel,s=>{
        const y=464+i*54;
        weaponImage(s,art?.get(weapon.itemId),weapon.itemId,{x:83,y:y-22,width:42,height:42});
        s.text(weapon.name,136,y,{size:22,color:'#173449',maxWidth:215,weight:800});
        s.text(Math.round(weapon.damage)+' · '+Math.round(total?weapon.damage/total*100:0)+'%',507,y,{size:21,color:'#173449',align:'right',weight:800});
      }));
      if(pages>1){
        control('damage-prev',90,779,100,54,'‹',()=>{game.pauseDamagePage=(page+pages-1)%pages;refresh();});
        label((page+1)+'/'+pages,300,811,21,'#173449','center');
        control('damage-next',410,779,100,54,'›',()=>{game.pauseDamagePage=(page+1)%pages;refresh();});
      }
    }
    if(mode==='stats'&&!Array.isArray(model.damage)) model.stats.forEach(([name,value],i)=>{
      label(name,88,478+i*56,23,'#29465c');label(value,509,478+i*56,25,'#173449','right');
    });
    if(mode==='settings') {
      const settings=bridge.getCombatAudioSettings?.()||{};
      [['sound','声音'],['music','音乐'],['effects','音效']].filter(([key])=>typeof settings[key]==='boolean'&&typeof bridge.setCombatAudioSetting==='function').forEach(([key,name],i)=>{
        label(name,90,510+i*120,28,'#173449');
        control(key,330,475+i*120,174,76,settings[key]?'开启':'关闭',()=>{
          bridge.setCombatAudioSetting?.(key,!settings[key]);refresh();
        },settings[key]);
      });
    }
    if(mode==='detail') {
      const item=game.pauseDetail;
      label(item?.owner||'本局武器',90,493,24,'#29465c');
      label('Lv.'+(item?.level||1),90,551,32,'#173449');
      if(item?.itemId)surface(panel,s=>{
        weaponImage(s,art?.get(item.itemId),item.itemId,{x:326,y:472,width:160,height:155});
      });
      if(item?.description)surface(panel,s=>{
        s.text('本级增益',90,590,{size:20,color:'#29465c',weight:700});
        item.description.split('\n').slice(0,4).forEach((line,i)=>s.text(line,90,625+i*35,{size:23,color:'#173449',maxWidth:420,weight:700}));
      });
      if(item?.canFocus) control('focus',150,686,300,80,item.selected?'已优先强化':'优先强化',()=>{
        if(bridge.focusFixedWeapon?.(item.id)!==false) {
          bridge.saveFixedGrowthCheckpoint?.();game.pauseDetail={...item,selected:true};
        }
        refresh();
      },true);
    }
    control('back',170,839,260,80,'返回',()=>navigate('pause'));
    return;
  }
  label('暂停',300,155,42,'#fff','center');
  function section(kind,title,items,y,tint) {
    const count=Math.max(1,Math.ceil(items.length/5));
    const key=kind==='weapons'?'pauseWeaponPage':'pauseUpgradePage';
    const page=Math.min(count-1,Math.max(0,game[key]||0));
    surface(panel,s=>{
      paintCombatArt(s,'card',32,y,536,222).material.color.set('#344957');
      // Colored section ribbons are labels; the housing and slots retain PSD corners.
      s.polygon([[48,y],[563,y],[568,y+5],[568,y+54],[32,y+54],[32,y+16]],tint);
      s.text(title,320,y+29,{size:29,color:'#183041',align:'center',weight:900});
      drawUiSymbol(s,kind==='weapons'?'cadence':'up',242,y+14,27,'#294457');
    });
    for(let i=0;i<5;i++) {
      const item=items[page*5+i],x=46+i*103,sy=y+72;
      const node=item?control(kind+'-'+item.id,x,sy,96,126,'',()=>{
        game.pauseDetail={...item};navigate('detail');
      }):new Container();
      if(!item){node.position.set(x,sy);panel.addChild(node);}
      surface(node,s=>{
        paintCombatArt(s,'slot',0,0,96,96);
        if(!item)return;
        if(kind==='weapons'||(item.icon&&art?.get(item.itemId))) {
          weaponImage(s,art?.get(item.itemId),item.itemId,{x:5,y:12,width:86,height:74});
        }else drawUiSymbol(s,item.symbol,23,21,50,tint);
        s.text('Lv.'+item.level,48,115,{size:18,color:'#e4f2fa',align:'center',weight:800});
        if(item.innate)s.text('主',8,20,{size:16,color:'#ffe6a0',weight:800});
      });
    }
    if(count>1) {
      control(kind+'-prev',354,y+228,82,65,'‹',()=>{game[key]=(page+count-1)%count;refresh();});
      control(kind+'-next',486,y+228,82,65,'›',()=>{game[key]=(page+1)%count;refresh();});
      label((page+1)+'/'+count,461,y+267,21,'#c7dde8','center');
    }
  }
  section('weapons','武器',model.weapons,280,'#ffe291');
  section('upgrades','强化',model.upgrades,610,'#7ed8ec');
  const utility=(id,x,y,symbol,caption,action,tint='#d0f2ff')=>{
    const node=control(id,x,y,86,86,'',action);
    surface(node,s=>{
      drawUiSymbol(s,symbol,22,10,43,tint);
      s.text(caption,43,73,{size:18,color:'#e8f4fb',align:'center',weight:800});
    });
  };
  utility('stats',32,1000,'stats','统计',()=>navigate('stats'));
  if(typeof bridge.getCombatAudioSettings==='function'&&typeof bridge.setCombatAudioSetting==='function')
    utility('settings',32,1120,'settings','设置',()=>navigate('settings'));
  control('resume',170,1110,260,100,'继续',()=>bridge.resumeGame(),true);
  utility('home',482,1120,'home','退出',()=>bridge.showExitConfirm(),'#ffc5cc');
}

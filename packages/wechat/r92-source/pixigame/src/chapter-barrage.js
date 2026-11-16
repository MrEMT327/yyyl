import { advancedChapter } from './advanced-chapters.js';
import { barrageResourcePlan, regularResourceId, ELITE_RESOURCE_DECKS, BARRAGE_GAP_HALF_ANGLE } from './barrage-resources.js';
// Touhou-inspired rhythms at mobile-friendly density. Aim locks at windup;
// rings leave a fixed 72-degree opening. Six moves per boss, independent of HP.
export const BOSS_MOVE_COUNT=6;
export const ELITE_MOVE_COUNT=4;
const RESOURCE_BOSS_MOVES = [
  [null,['B01','航线错拍'],null,['B02','双舷往返'],['B06','潮汐轮射'],['B07','舰首展翼']],
  [null,null,null,['B03','发条螺旋'],null,['B05','重炮束阵']],
  [null,['B07','钳口渐扩'],null,null,['B05','双钳束阵'],null],
  [null,null,['B06','排水轮射'],['B02','双泵往返'],null,['B12','回流椭环']],
  [['B12','缺月椭环'],null,null,['B04','错速月环'],null,null],
];
const TAU=Math.PI*2,down=Math.PI/2;
const distance=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
const clampChapter=chapter=>Math.max(0,Math.min(4,Math.floor(Number(chapter)||0)));

function planner({x,y,chapter=0,volley=0,targetX=x,targetY=y+300},elite=false) {
  chapter=clampChapter(chapter);
  const resource=RESOURCE_BOSS_MOVES[chapter][volley%BOSS_MOVE_COUNT];
  if(resource) return {...barrageResourcePlan(resource[0],{x,y,targetX,targetY,volley}),name:resource[1]};
  const shots=[],hazards=[],aim=Math.atan2(targetY-y,targetX-x);
  const speed=(elite?115:120)+chapter*3;
  const add=(ox,oy,angle,velocity=speed,delay=0)=>shots.push({x:ox,y:oy,angle,speed:velocity,delay});
  const fan=(ox,oy,angle,count,step,delay=0,velocity=speed)=>{
    for(let i=0;i<count;i++)add(ox,oy,angle+(i-(count-1)/2)*step,velocity,delay);
  };
  const ring=(ox,oy,count,gap,spin=0,delay=0)=>{
    for(let i=0;i<count;i++){const a=i*TAU/count+spin;if(distance(a,gap)>=BARRAGE_GAP_HALF_ANGLE)add(ox,oy,a,speed-15,delay);}
  };
  const zone=(px,py,radius,delay=0)=>hazards.push({type:'zone',x:px,y:py,radius,delay,duration:1.25});
  const beam=(ox,oy,tx,ty,delay=0)=>hazards.push({type:'beam',x:ox,y:oy,targetX:tx,targetY:ty,delay,duration:1.2,width:12,lifetime:.55});
  const mode=volley%(elite?2:BOSS_MOVE_COUNT),spread=elite?24:54;
  let name;
  if(mode>=3) {
    // More rhythms and emission geometry, not faster bullets or denser screens.
    // New hazards are visible zone markers; no extra untelegraphed beam attacks.
    if(chapter===0) {
      if(mode===3) {
        name='甲板列阵';
        for(let beat=0;beat<3;beat++)for(const side of [-1,1])for(const offset of [62,94])
          add(x+side*offset,y+22,down,speed-10,beat*.55);
      } else if(mode===4) {
        name='交错剪影';
        for(let beat=0;beat<3;beat++) {
          const side=beat%2?1:-1;
          fan(x+side*spread,y+20,down-side*(.24+beat*.08),4,.16,beat*.55,speed-5);
        }
      } else {
        name='舰首雁阵';
        for(let beat=0;beat<2;beat++)for(let i=-4;i<=4;i++)
          add(x+i*22,y+28-Math.abs(i)*12,down,speed-15,beat*.8);
      }
    } else if(chapter===1) {
      if(mode===3) {
        name='发条轮射';
        for(let beat=0;beat<4;beat++)for(let arm=0;arm<4;arm++)
          add(x,y+16,Math.PI/4+arm*TAU/4+beat*.22,speed-15,beat*.45);
      } else if(mode===4) {
        name='双点轰击';zone(targetX-52,targetY,30);zone(targetX+52,targetY,30,.7);
        fan(x,y+24,down,5,.3,1.5,speed-15);
      } else {
        name='重炮接力';
        for(let beat=0;beat<4;beat++) {
          const ox=x+(beat%2?1:-1)*spread;
          fan(ox,y+20,Math.atan2(targetY-y-20,targetX-ox),3,.22,beat*.5,speed+5);
        }
      }
    } else if(chapter===2) {
      if(mode===3) {
        name='炉环释火';ring(x,y+16,22,down,Math.PI/22);
      } else if(mode===4) {
        name='双钳扇焰';
        for(let beat=0;beat<2;beat++)for(const side of [-1,1])
          fan(x+side*spread,y+20,down+side*(.3+beat*.25),5,.12,beat*.75,speed-15);
      } else {
        name='余烬落点';zone(targetX,targetY,38);
        // Follow the warning with an outward fan, leaving the central exit open.
        for(let beat=0;beat<2;beat++)for(const side of [-1,1])
          fan(x+side*spread,y+20,down+side*.55,3,.13,1.4+beat*.6,speed-20);
      }
    } else if(chapter===3) {
      if(mode===3) {
        name='双泵脉冲';
        for(let beat=0;beat<3;beat++) {
          const side=beat%2?1:-1;
          fan(x+side*spread,y+20,down+side*(.45-beat*.12),5,.16,beat*.6,speed-20);
        }
      } else if(mode===4) {
        name='泄洪闸列';
        for(let beat=0;beat<2;beat++)for(const side of [-1,1])for(let i=0;i<4;i++)
          add(x+side*(48+i*18),y+24,down,speed-22,beat*.75);
      } else {
        name='回流双环';
        for(let beat=0;beat<2;beat++)ring(x,y+16,14,down,beat*.12,beat*.8);
      }
    } else {
      if(mode===3) {
        name='错拍月环';
        for(let beat=0;beat<2;beat++)ring(x,y+12,16,down,beat*.14,beat*.8);
      } else if(mode===4) {
        name='卫星交叉';
        for(let i=0;i<3;i++) {
          const ox=x+(i-1)*66,oy=y+20+(i===1?10:0);
          fan(ox,oy,Math.atan2(targetY-oy,targetX-ox),3,.24,i*.55,speed-12);
        }
      } else {
        name='六芒旋轮';
        for(let beat=0;beat<4;beat++)for(let arm=0;arm<6;arm++) {
          const a=arm*TAU/6+beat*.12;
          if(distance(a,down)>=BARRAGE_GAP_HALF_ANGLE)add(x,y+12,a,speed-18,beat*.45);
        }
      }
    }
  } else if(chapter===0) {
    if(mode===0) {
      name='双舷开花';
      for(const side of [-1,1])fan(x+side*spread,y+18,down+side*.43,elite?3:4,.18);
    } else if(mode===1) {
      name='航线点射';
      for(let beat=0;beat<(elite?2:3);beat++)fan(x,y+25,aim,elite?1:3,.3,beat*.45,speed+25);
    } else {
      name='潮汐弧阵';
      for(let beat=0;beat<2;beat++)for(let i=0;i<9;i++) {
        const a=.3+i*.32;if(distance(a,down)>=BARRAGE_GAP_HALF_ANGLE)add(x,y+24,a,speed-10,beat*.6);
      }
    }
  } else if(chapter===1) {
    if(mode===0) {
      name='双塔校射';
      for(const side of [-1,1])for(let beat=0;beat<2;beat++)
        fan(x+side*spread,y+20,Math.atan2(targetY-y-20,targetX-x-side*spread),elite?2:3,.19,beat*.5);
    } else if(mode===1) {
      name='攻城落点';zone(targetX,targetY,elite?32:42);
      fan(x,y+22,down,elite?3:5,.32,0,speed-15);
    } else {
      name='街巷栅栏';
      for(let beat=0;beat<2;beat++)for(const side of [-1,1])for(let i=0;i<3;i++)
        add(x+side*(38+i*24),y+24,down,speed-5,beat*.6);
    }
  } else if(chapter===2) {
    if(mode===0) {
      name='熔核五瓣';
      for(let petal=0;petal<5;petal++)for(let i=-1;i<=1;i++){
        const angle=down+petal*TAU/5+i*.085;
        if(distance(angle,down)>=BARRAGE_GAP_HALF_ANGLE)add(x,y+12,angle,speed-12);
      }
    } else if(mode===1) {
      name='钳口释压';
      for(let beat=0;beat<(elite?2:3);beat++)for(const side of [-1,1])
        fan(x+side*spread,y+20,down+side*(.32+beat*.15),2,.12,beat*.45);
    } else {
      name='炉心热流';beam(x,y+30,targetX,targetY);
    }
  } else if(chapter===3) {
    if(mode===0) {
      name='环向泄压';ring(x,y+10,elite?10:16,down,volley*.12);
    } else if(mode===1) {
      name='高压喷流';zone(targetX,targetY,elite?34:44);
      for(const side of [-1,1])fan(x+side*spread,y+20,down+side*.38,elite?2:3,.16,0,speed-25);
    } else {
      name='排水波纹';
      for(let beat=0;beat<2;beat++)for(const side of [-1,1])
        fan(x+side*spread,y+20,down+side*(.5-beat*.1),3,.13,beat*.55,speed-20);
    }
  } else {
    if(mode===0) {
      name='缺月星环';ring(x,y+8,elite?12:18,down+Math.sin(volley*.4)*.28,volley*.16);
    } else if(mode===1) {
      name='离子星芒';
      for(let beat=0;beat<(elite?2:3);beat++)for(let arm=0;arm<4;arm++)
        {
          const angle=Math.PI/4+arm*Math.PI/2+beat*.16;
          if(distance(angle,down)>=BARRAGE_GAP_HALF_ANGLE)add(x,y+8,angle,speed-10,beat*.5);
        }
    } else {
      name='母舰光束';beam(x,y+20,targetX,targetY);
    }
  }
  const last=Math.max(0,...shots.map(s=>s.delay),...hazards.map(h=>h.delay+h.duration));
  return {name,shots,hazards,targetX,targetY,duration:elite ? .85 : .95,cooldown:last+(elite?2.7:2.45),
    warning:mode===1&&chapter===0,color:0xff795e,
    ...([[0,2],[2,0],[2,3],[3,0],[4,1],[4,5]].some(([c,m])=>chapter===c&&mode===m)
      ? {escapeAngle:down,escapeHalfAngle:BARRAGE_GAP_HALF_ANGLE} : {})};
}

// New chapters reuse existing attack decks; no chapter-specific rules.
const existingDeck = options => ({...options, chapter: advancedChapter(options.chapter)?.attackDeck ?? (options.chapter >= 5 ? (options.chapter - 5) % 5 : options.chapter)});
export function bossBarragePlan(options) {return planner(existingDeck(options),false);}
export function eliteBarragePlan(options) {
  const args=existingDeck(options),chapter=clampChapter(args.chapter);
  const volley=Math.max(0,Math.floor(Number(args.volley)||0));
  const id=ELITE_RESOURCE_DECKS[chapter][volley%ELITE_MOVE_COUNT];
  return barrageResourcePlan(id,{...args,volley});
}

export function regularBarragePlan(options) {
  const args=existingDeck(options);
  const id=args.resourceId||regularResourceId(args);
  return barrageResourcePlan(id,args);
}

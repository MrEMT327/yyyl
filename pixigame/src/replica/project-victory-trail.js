import {BATTLE_LAUNCH_SECONDS} from '../../replica-battle/battle-launch.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function sampleBattleFlightTrail({victoryDeparture,flight,projectPoint},pose,launch){
  const motion=victoryDeparture??launch;
  if(!motion||!flight||!projectPoint)return null;
  const from=projectPoint(flight.x,motion.fromZ);
  return victoryDeparture
    ?sampleVictoryTrail({departure:victoryDeparture,pose,from})
    :sampleFlightTrail(launch.time,BATTLE_LAUNCH_SECONDS,pose,from);
}

export function sampleVictoryTrail({departure,pose,from}){
  return sampleFlightTrail(departure?.elapsed,1.3,pose,from);
}

// Project the scripted flight into the current camera on each frame.
function sampleFlightTrail(elapsed,duration,pose,from){
  if(!pose?.visible||!from||!Number.isFinite(elapsed)||elapsed<=0||elapsed>=duration)return null;
  if(![pose.x,pose.y,pose.height,pose.scaleY,from.x,from.y].every(Number.isFinite))return null;
  const size=Math.abs(pose.height*pose.scaleY),offset=size*.17;
  const head={x:pose.x,y:pose.y+offset};
  const tail={x:from.x,y:from.y+offset+size*.5*clamp(1-elapsed/.45,0,1)};
  const fade=clamp((duration-elapsed)/.3,0,1),power=clamp(elapsed/.045,0,1)*fade;
  const length=Math.hypot(head.x-tail.x,head.y-tail.y);
  const width=clamp(size/70,.65,1.5)*2,separation=clamp(size*.085,3.5,10),segments=[],sparks=[];
  for(const side of [-1,1]){
    for(let i=0;i<24&&length>.1;i++){
      const a=i/24,b=(i+1)/24,t=(a+b)/2,bias=side*separation;
      const flow=.65+.35*(.5+.5*Math.sin(elapsed*34-t*18+side*.7));
      const tip=clamp(t/.18,0,1),tailFade=tip*tip*(3-2*tip);
      segments.push({x1:tail.x+(head.x-tail.x)*a+bias,y1:tail.y+(head.y-tail.y)*a,
        x2:tail.x+(head.x-tail.x)*b+bias,y2:tail.y+(head.y-tail.y)*b,
        width:width*(.08+.92*t**.35),alpha:power*(.65+.35*t)*tailFade,flow});
    }
    // Bounded, repeatable burst; no new gameplay RNG or continuously growing pool.
    for(let i=0;i<7;i++){
      const born=i*.018,life=.3+((i*37+11)%17)/17*.4,u=(elapsed-born)/life;
      if(u<0||u>=1)continue;
      const t=clamp(.12+i*.105+u*.1,0,.95),spread=(2+i*1.7)*Math.sin(Math.PI*u);
      sparks.push({x:tail.x+(head.x-tail.x)*t+side*(separation+spread*width),
        y:tail.y+(head.y-tail.y)*t,radius:width*(.32+.45*Math.sin(Math.PI*u)),
        alpha:power*Math.sqrt(1-u)});
    }
  }
  return {head,tail,width,power,separation,segments,sparks,flash:Math.sin(Math.PI*clamp(elapsed/.28,0,1))**2};
}

export function drawVictoryTrail(graphics,sample,bodyGraphics){
  graphics.clear();bodyGraphics?.clear();
  if(!sample)return;
  // The source effect has paired bright/dark lines and a short point burst.
  // Recreate that layering procedurally; retain a blue body on bright scenery.
  if(bodyGraphics)for(const s of sample.segments){
    bodyGraphics.lineStyle(s.width*3.2,0x245bdb,s.alpha*.24*s.flow).beginPath();
    bodyGraphics.moveTo(s.x1,s.y1).lineTo(s.x2,s.y2).strokePath();
  }
  for(const [scale,color,opacity]of [[12,0x246dff,.07],[6.5,0x278fff,.15],[2.4,0x55caff,.72],[.85,0xe5faff,1]]){
    for(const s of sample.segments){
      graphics.lineStyle(s.width*scale,color,s.alpha*opacity*(scale<3?s.flow:1)).beginPath();
      graphics.moveTo(s.x1,s.y1).lineTo(s.x2,s.y2).strokePath();
    }
  }
  const {head,width,power,separation,flash}=sample;
  for(const side of [-1,1]){
    const x=head.x+side*separation;
    for(let ring=8;ring>=1;ring--){
      const t=ring/8;
      graphics.fillStyle(0x41afff,power*.2*Math.exp(-3*t*t)).fillCircle(x,head.y,width*7*t);
    }
    graphics.fillStyle(0xe5fbff,power*.95).fillCircle(x,head.y,width*1.1);
  }
  if(flash>.001){
    for(let ring=8;ring>=1;ring--){
      const t=ring/8;
      graphics.fillStyle(0x4abfff,power*flash*.12*Math.exp(-3*t*t)).fillEllipse(head.x,head.y,width*34*t,width*6*t);
    }
    graphics.lineStyle(width*.8,0xefffff,power*flash*.95).beginPath().moveTo(head.x-width*11,head.y).lineTo(head.x+width*11,head.y).strokePath();
  }
  for(const spark of sample.sparks){
    graphics.fillStyle(0x329fff,spark.alpha*.15).fillCircle(spark.x,spark.y,spark.radius*3.3);
    graphics.fillStyle(0xa1e9ff,spark.alpha*.9).fillCircle(spark.x,spark.y,spark.radius);
    graphics.fillStyle(0xf0fdff,spark.alpha).fillCircle(spark.x,spark.y,spark.radius*.4);
  }
}

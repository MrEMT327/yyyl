import {weatherNoise} from './battle-weather.js';

const wrap=(value,period)=>(value%period+period)%period;
const DEFAULT_CLOUD_LAYOUT=Object.freeze([
  [.14,.14,1.6],[.97,.35,1.5],[-.15,.69,1.3],[.86,1.02,1.65],
].map(([baseX,baseY,scale])=>Object.freeze({baseX,baseY,scale})));

const STORM_CLOUD_ZONES=[
  {edge:-.10,edgeRange:.34,top:-.14,height:.46},
  {edge:-.07,edgeRange:.29,top:.23,height:.53},
  {edge:-.21,edgeRange:.33,top:.66,height:.50},
  {edge:-.16,edgeRange:.30,top:-.53,height:.46},
];

export function weatherCloudLayout(profileId,seed){
  if(profileId!=='storm')return DEFAULT_CLOUD_LAYOUT;

  // The dense banks can follow the same edge or pass along opposite edges.
  const leadOnLeft=weatherNoise(seed+1021)<.5;
  const groupMainBanks=weatherNoise(seed+1031)<1/3;
  return DEFAULT_CLOUD_LAYOUT.map(({scale},index)=>{
    const {edge,edgeRange,top,height}=STORM_CLOUD_ZONES[index];
    const cloudSeed=seed+1049+index*17;
    const onLeadSide=index===0||index===(groupMainBanks?1:2);
    const inset=edge+edgeRange*weatherNoise(cloudSeed);
    return {
      baseX:onLeadSide===leadOnLeft?inset:1-inset,
      baseY:top+height*weatherNoise(cloudSeed+1),
      scale:scale*(.92+.16*weatherNoise(cloudSeed+2)),
    };
  });
}

// A cloud travels across the view instead of oscillating around a screen
// anchor. Reset only after its entire square, including the veil, has exited.
export function sampleWeatherCloudPose(cloud,index,state,width,height){
  const time=Number.isFinite(state.time)?Math.max(0,state.time):0;
  const storm=state.profile.id==='storm'||state.profile.lightning===true;
  const size=width*cloud.scale,margin=size/2+24,period=height+2*margin;
  const speed=(height/960)*(storm?30+index*4.5:18+index*3)*(state.reducedMotion?.65:1);
  const y=wrap(height*cloud.baseY+speed*time+margin,period)-margin;
  const slope=Math.max(-.4,Math.min(.4,(state.profile.wind??0)/650*.32));
  const weave=state.reducedMotion?0:Math.sin(time*.16+index*1.7)*width*.018;
  return {x:width*cloud.baseX+(y-height*cloud.baseY)*slope+weave,y};
}

export function selectLightningCloud(clouds,preferred,width,height){
  const visible=c=>c&&c.x>-width*.18&&c.x<width*1.18&&c.y>height*.04&&c.y<height*.96;
  if(visible(clouds[preferred]))return preferred;
  let selected=-1,best=Infinity;
  for(let i=0;i<clouds.length;i++){
    const c=clouds[i],score=Math.abs(c.y/height-.45)+Math.abs(c.x/width-.5)*.25+(visible(c)?0:10);
    if(score<best){best=score;selected=i;}
  }
  return selected;
}

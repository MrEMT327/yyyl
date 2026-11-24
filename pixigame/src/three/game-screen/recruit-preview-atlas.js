const pilotIds=Array.from({length:10},(_,index)=>'pilot-'+String(index+1).padStart(2,'0'));
const hero=288,card=106,heroColumns=5;
const cardTop=Math.ceil(pilotIds.length/heroColumns)*hero;

export const recruitPreview={
  path:'art/recruit-portraits-v2/wechat-preview.webp',padding:2,
  width:Math.max(heroColumns*hero,pilotIds.length*card),height:cardTop+2*card,
  tiles:new Map(pilotIds.map((id,index)=>[id,{
    portrait:{x:(index%heroColumns)*hero,y:Math.floor(index/heroColumns)*hero,size:hero},
    card:{x:index*card,y:cardTop,size:card},
    selected:{x:index*card,y:cardTop+card,size:card},
  }])),
};

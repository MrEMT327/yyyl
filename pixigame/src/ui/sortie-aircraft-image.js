import frames from './sortie-aircraft-images.json' with {type:'json'};

const preloaded=new Map();
export const sortieAircraftFrame=id=>frames.entries[id]||frames.entries['pilot-01'];
export function sortieAircraftImageUrl(id){
  const frame=sortieAircraftFrame(id),base=new URL(import.meta.env?.BASE_URL||'/',document.baseURI);
  const url=new URL(`art/sortie-aircraft-front-v1/${frame.file}`,base);url.searchParams.set('v',frame.sha256.slice(0,16));return url.href;
}
export function preloadSortieAircraftImage(id){
  if(typeof Image==='undefined')return Promise.resolve(false);
  const url=sortieAircraftImageUrl(id);
  if(!preloaded.has(url)){
    const image=new Image();image.decoding='async';image.fetchPriority='low';
    const ready=new Promise(resolve=>{image.onload=()=>resolve(true);image.onerror=()=>resolve(false);});
    image.src=url;preloaded.set(url,{image,ready});
  }
  return preloaded.get(url).ready;
}
export function sortieAircraftImageLayout(id,{width,height,deckHeight}){
  const frame=sortieAircraftFrame(id),gap=Math.max(2,Math.min(5,width*.009));
  return {width:frame.widthRatio*height,height:frame.heightRatio*height,
    left:width*.5+frame.offsetXRatio*height,bottom:deckHeight*(1-.445)+gap+frame.bottomRatio*height};
}
export function positionSortieAircraftImage(image,id,size){
  if(!image)return;
  for(const [property,value]of Object.entries(sortieAircraftImageLayout(id,size)))image.style[property]=`${value}px`;
}

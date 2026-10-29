const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
export const COMMANDER_BODY_MESHES=[2,4,5,6,7,8];
export const commanderLeftCoatAttachment=(x,y)=>smooth((x-100)/220)*(1-smooth((y-688)/340));
// The source reference has anatomical torso/waist/hip/leg meshes. The supplied
// retarget instead cuts the painting into rectangles (including a vertical cut
// through the legs). Fit broad anatomical frames, then evaluate one field in
// rest material space on every rectangle, so shared painted edges stay joined.
const REGIONS=[
  [2,360,660,250,410], [4,415,575,425,520], [5,390,600,570,660],
  [6,350,520,700,870], [7,520,640,700,870],
  [6,390,520,930,1070], [7,520,640,930,1070],
  [8,480,650,1310,1440], [8,570,650,1150,1250],
];
function fitRegion(rest,definition){
  const [mesh,x0,x1,y0,y1]=definition,p=rest[mesh],vertices=[];
  let rx=0,ry=0;
  for(let j=0;j<p.length;j+=2){const x=p[j]*512+512,y=768-p[j+1]*512;if(x>=x0&&x<=x1&&y>=y0&&y<=y1){vertices.push([j,x,y]);rx+=x;ry+=y;}}
  if(vertices.length<3)throw Error('Commander body frame has insufficient vertices');
  rx/=vertices.length;ry/=vertices.length;
  const variance=vertices.reduce((v,[,x,y])=>v+(x-rx)**2+(y-ry)**2,0);
  const result={rx,ry,x:rx,y:ry,c:1,s:0,scale:1};
  return {result,update(source){
    const current=source(mesh);let x=0,y=0;
    for(const [j]of vertices){x+=current[j]*512+512;y+=768-current[j+1]*512;}
    x/=vertices.length;y/=vertices.length;let c=0,s=0;
    for(const [j,u,v]of vertices){const X=current[j]*512+512-x,Y=768-current[j+1]*512-y;c+=(u-rx)*X+(v-ry)*Y;s+=(u-rx)*Y-(v-ry)*X;}
    const length=Math.hypot(c,s);
    Object.assign(result,{x,y,c:c/length,s:s/length,scale:clamp(length/variance,.985,1.015)});
  }};
}

function interpolate(points,y){for(let i=1;i<points.length;i++)if(y<=points[i][0]){const [a,x]=points[i-1],[b,z]=points[i];return x+(z-x)*clamp((y-a)/(b-a));}return points.at(-1)[1];}
function skinWeights(x,y){
  const w=new Float64Array(9);
  const frontX=interpolate([[660,430],[800,460],[940,480],[1080,510],[1240,548],[1400,574]],y);
  const backX=interpolate([[660,570],[800,545],[940,550],[1080,587],[1240,611]],y);
  const back=smooth((x-(frontX+backX)/2+24)/48),front=1-back;
  if(y<490){const t=smooth((y-350)/140);w[0]=1-t;w[1]=t;}
  else if(y<650){const t=smooth((y-490)/160);w[1]=1-t;w[2]=t;}
  else if(y<820){const t=smooth((y-650)/170);w[2]=1-t;w[3]=front*t;w[4]=back*t;}
  else{
    const shin=smooth((y-820)/240),frontFoot=smooth((y-1080)/260),backFoot=smooth((y-1070)/140);
    w[3]=front*(1-shin);w[4]=back*(1-shin);
    w[5]=front*shin*(1-frontFoot);w[6]=back*shin*(1-backFoot);
    w[7]=front*shin*frontFoot;w[8]=back*shin*backFoot;
  }
  return w;
}

function boundSample(rest,indices,x,y,extrapolate=false){
  let nearest=null,distance=Infinity;
  for(let t=0;t<indices.length;t+=3){
    const a=indices[t]*2,b=indices[t+1]*2,c=indices[t+2]*2;
    const ax=rest[a]*512+512,ay=768-rest[a+1]*512;
    const ux=(rest[b]-rest[a])*512,uy=(rest[a+1]-rest[b+1])*512,vx=(rest[c]-rest[a])*512,vy=(rest[a+1]-rest[c+1])*512,det=ux*vy-uy*vx;
    const u=((x-ax)*vy-(y-ay)*vx)/det,v=(ux*(y-ay)-uy*(x-ax))/det;
    const sample=current=>[512+(current[a]*(1-u-v)+current[b]*u+current[c]*v)*512,768-(current[a+1]*(1-u-v)+current[b+1]*u+current[c+1]*v)*512];
    if(u>=-1e-5&&v>=-1e-5&&u+v<=1.00001)return sample;
    if(extrapolate){const U=clamp(u),V=clamp(v,0,1-U),d=(ax+ux*U+vx*V-x)**2+(ay+uy*U+vy*V-y)**2;if(d<distance){distance=d;nearest=sample;}}
  }
  if(nearest)return nearest;
  throw Error(`Commander body anchor outside mesh: ${x},${y}`);
}

export function createCommanderBodyField(rest,source,indices,displayRest={}){
  const regions=REGIONS.map(r=>fitRegion(rest,r)),bones=regions.map(r=>r.result);
  const points=COMMANDER_BODY_MESHES.map(i=>({i,vertices:Array.from({length:(displayRest[i]||rest[i]).length/2},(_,j)=>{
    const p=displayRest[i]||rest[i],x=p[j*2]*512+512,y=768-p[j*2+1]*512;
    return {j:j*2,x,y,w:skinWeights(x,y),gate:smooth((y-320)/80)};
  })}));
  const raised=Array.from({length:rest[9].length/2},(_,j)=>{
    const y=768-rest[9][j*2+1]*512,gate=smooth((y-300)/130);
    return gate?{j:j*2,gate}:null;
  }).filter(Boolean);
  const leftAnchor=[350,410],sampleLeft=boundSample(rest[2],indices(2),...leftAnchor,true);
  const leftJoin=Array.from({length:rest[3].length/2},(_,j)=>{
    const x=rest[3][j*2]*512+512,y=768-rest[3][j*2+1]*512,weight=commanderLeftCoatAttachment(x,y),gate=smooth((y-320)/80);
    return weight?{j:j*2,x,y,weight,gate,sample:gate<1?boundSample(rest[2],indices(2),x,y,true):null}:null;
  }).filter(Boolean);
  const waistAnchors=[[560,462],[580,464]],nativeAnchors=waistAnchors.map(([x,y])=>boundSample(rest[4],indices(4),x,y));
  const field=(x,y,w=skinWeights(x,y))=>{
    let rx=0,ry=0,X=0,Y=0,c=0,s=0,scale=0;
    for(let i=0;i<bones.length;i++){const b=bones[i],weight=w[i];rx+=b.rx*weight;ry+=b.ry*weight;X+=b.x*weight;Y+=b.y*weight;c+=b.c*weight;s+=b.s*weight;scale+=b.scale*weight;}
    // Normalize the blended rotation rather than linearly shrinking rotations.
    const length=Math.hypot(c,s);c=c/length*scale;s=s/length*scale;
    return [X+c*(x-rx)-s*(y-ry),Y+s*(x-rx)+c*(y-ry)];
  };
  return {update(buffers){
    for(const region of regions)region.update(source);
    if(bones.every(b=>Math.abs(b.x-b.rx)+Math.abs(b.y-b.ry)+Math.abs(b.c-1)+Math.abs(b.s)+Math.abs(b.scale-1)<1e-8))return;
    for(const {i,vertices}of points){
      const output=buffers[i],native=source(i);
      for(const {j,x,y,w,gate}of vertices){
        const p=field(x,y,w);
        // Leave the neck/raised-hand contact on the native upper torso. The
        // overlap with the waist starts below this shared transition band.
        output[j]=gate===1?(p[0]-512)/512:native[j]*(1-gate)+(p[0]-512)/512*gate;
        output[j+1]=gate===1?(768-p[1])/512:native[j+1]*(1-gate)+(768-p[1])/512*gate;
      }
    }
    // The lifted forearm keeps its whistle/face contact. Only its lower sleeve
    // follows the corrected torso, preventing a second painted cuff showing.
    const oldLeft=sampleLeft(source(2)),newLeft=field(...leftAnchor),dx=(newLeft[0]-oldLeft[0])/512,dy=(oldLeft[1]-newLeft[1])/512;
    for(const {j,gate}of raised){buffers[9][j]+=dx*gate;buffers[9][j+1]+=dy*gate;}
    for(let j=0;j<buffers[3].length;j+=2){buffers[3][j]+=dx;buffers[3][j+1]+=dy;}
    for(const {j,x,y,weight,gate,sample}of leftJoin){const p=field(x,y),native=sample?sample(source(2)):p,X=native[0]*(1-gate)+p[0]*gate,Y=native[1]*(1-gate)+p[1]*gate;buffers[3][j]=buffers[3][j]*(1-weight)+(X-512)/512*weight;buffers[3][j+1]=buffers[3][j+1]*(1-weight)+(768-Y)/512*weight;}
    const old= nativeAnchors.map(sample=>sample(source(4))),next=waistAnchors.map(([x,y])=>field(x,y));
    const angle=Math.atan2(next[1][1]-next[0][1],next[1][0]-next[0][0])-Math.atan2(old[1][1]-old[0][1],old[1][0]-old[0][0]),c=Math.cos(angle),s=Math.sin(angle);
    for(const i of [10,14,11]){
      const input=source(i),out=buffers[i],base=rest[i];
      for(let j=0;j<input.length;j+=2){
        const x=input[j]*512+512-old[0][0],y=768-input[j+1]*512-old[0][1];
        const gate=i===11?smooth((768-base[j+1]*512-350)/80)*(1-smooth((base[j]*512+512-720)/160)):1;
        out[j]=input[j]*(1-gate)+(next[0][0]+c*x-s*y-512)/512*gate;
        out[j+1]=input[j+1]*(1-gate)+(768-next[0][1]-s*x-c*y)/512*gate;
      }
    }
  },frames:()=>bones.map(b=>({...b}))};
}

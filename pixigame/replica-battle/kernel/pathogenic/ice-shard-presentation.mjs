// Only the two legendary ice-shard attacks. Shared model 1000064 is also
// used by non-ice weapons, so never replace that model globally.
const MATERIAL='host://legendary-ice-shard-v1/material';
export const isLegendaryIceShard=b=>b.owner==='player'&&[400023,400026].includes(b.weaponId)&&b.modelId===1000064;
export function withLegendaryIceShardResources(graph){
 const shader='host://legendary-ice-shard-v1/shader';
 return {...graph,resources:{...graph.resources,[MATERIAL]:{type:'ShaderMaterial',properties:{shader:{$external:shader}}}},
  shaders:{...graph.shaders,[shader]:{code:'shader_type canvas_item;\nrender_mode unshaded, blend_mix;\nvoid fragment(){ COLOR=COLOR; }'}}};
}
export function legendaryIceShardMeshes(b,screen){
 if(!isLegendaryIceShard(b)||b.dead||b.visualHidden||!(b.scale>0)||b.age<0||b.age>=b.lifetime||b.age<(b.warmup??0))return [];
 const moving=Math.hypot(b.vx??0,b.vz??0)>.001;
 const p=screen(b.x,b.z),q=screen(b.x+(moving?b.vx:Math.sin(b.angle||0)),b.z+(moving?b.vz:Math.cos(b.angle||0)));
 const distance=Math.hypot(q.x-p.x,q.y-p.y);if(!Number.isFinite(distance)||distance<.001)return [];
 const dx=(q.x-p.x)/distance,dy=(q.y-p.y)/distance;
 const span=screen(b.x+b.radiusX,b.z),length=screen(b.x,b.z+b.radiusZ);
 const w=Math.max(3,Math.hypot(span.x-p.x,span.y-p.y)*.7),h=Math.max(9,Math.hypot(length.x-p.x,length.y-p.y)*1.2);
 const alpha=Math.min(1,(b.lifetime-b.age)/.08),result=[];
 const mesh=(key,points,colors,indices)=>({key,material:{$ref:MATERIAL},vertices:points.map(([x,y],i)=>({position:[p.x-dy*x*w+dx*y*h,p.y+dx*x*w+dy*y*h],uv:[0,0],color:colors[i]})),indices});
 // Translucent wake and separate crystal facets keep the forward tip readable.
 result.push(mesh('wake',[[-.4,-.35],[.4,-.35],[.12,-2.7],[-.12,-2.7]],[[.12,.65,1,.32*alpha],[.12,.65,1,.32*alpha],[.1,.4,1,0],[.1,.4,1,0]],[0,1,2,0,2,3]));
 result.push(mesh('ice',[[0,1.5],[-.85,0],[0,-.8],[.85,0],[0,-.05]],[[.8,1,1,alpha],[.025,.2,.55,alpha],[.08,.46,.8,alpha],[.28,.7,.96,alpha],[.58,.91,1,alpha]],[0,1,4,1,2,4,2,3,4,3,0,4]));
 result.push(mesh('ridge',[[-.07,-.6],[.07,-.6],[.035,1.24],[-.035,1.24]],Array(4).fill([.7,1,1,.8*alpha]),[0,1,2,0,2,3]));
 for(let i=0;i<2;i++){const phase=(b.age*4+i*.5)%1,side=(i?1:-1)*(.5+phase*.8),back=-.7-phase*1.7,a=(1-phase)*.65*alpha;
  result.push(mesh('chip'+i,[[side,back+.13],[side-.14,back],[side,back-.13],[side+.14,back]],Array(4).fill([.3,.8,1.2,a]),[0,1,2,0,2,3]));}
 return result;
}

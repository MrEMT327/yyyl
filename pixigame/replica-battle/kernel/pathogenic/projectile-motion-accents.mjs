import {ENEMY_SPRITE_CORES} from './enemy-sprite-footprint.mjs';
import {projectilePalette} from './projectile-palette.mjs';

// A render-only overlay: the existing sprite silhouette and all simulation
// fields remain authoritative. Two bounded batches, no persistent emitters.
const MATERIAL='host://projectile-motion-v1/glow';
const ENEMY=new Set([1100001,1100002,1100004,1100005,1100007,1100008,1100012,1100016,1100017,1100018,1100023]);
const PLAYER=new Set([1000000,1000023,1000031,1000036,1000049,1000050,1000052,1000063,1000064]);
const ROUND=new Set([1100001,1100002,1100005,1100016,1100023]);
export const PROJECTILE_MOTION_LIMIT=72;
export function withProjectileMotionResources(graph){
  return {...graph,resources:{...graph.resources,[MATERIAL]:{type:'CanvasItemMaterial',properties:{blend_mode:1,light_mode:1}}}};
}
const fresh=owner=>({key:owner,z:4,material:{$ref:MATERIAL},vertices:[],indices:[],count:0});
const fract=n=>n-Math.floor(n);
export class ProjectileMotionAccents{
  constructor(){this.reset();}
  reset(){this.batches={player:fresh('player'),enemy:fresh('enemy')};}
  beginFrame(){this.reset();}
  projectile(b,screen,element=0,sprite){
    const batch=this.batches[b.owner],allowed=b.owner==='enemy'?ENEMY:PLAYER;
    if(!batch||!allowed.has(b.modelId)||batch.count>=PROJECTILE_MOTION_LIMIT||b.dead||b.visualHidden||b.beam||b.held
      ||![b.uid,b.x,b.z,b.age,b.lifetime,b.scale,b.radiusX,b.radiusZ,b.angle??0,b.offsetX??0,b.offsetZ??0].every(Number.isFinite)
      ||b.scale<=0||b.radiusX<=0||b.radiusZ<=0||b.age<0||b.age>=b.lifetime||b.age<(b.warmup??0))return;
    const origin=screen(b.x,b.z),unit=screen(b.x+1,b.z);let px=Math.hypot(unit.x-origin.x,unit.y-origin.y);const worldPx=px;
    if(![origin.x,origin.y,px].every(Number.isFinite)||px<=0)return;
    const yaw=b.angle??0,dx=Math.sin(yaw),dz=Math.cos(yaw);
    const x=b.x+dz*(b.offsetX??0)+dx*(b.offsetZ??0),z=b.z-dx*(b.offsetX??0)+dz*(b.offsetZ??0);
    const dims=b.owner==='enemy'&&ENEMY_SPRITE_CORES[b.modelId]?.world;
    let rx=dims?dims[0]*b.scale/2:b.radiusX,rz=dims?dims[1]*b.scale/2:b.radiusZ;
    if(b.owner==='enemy'&&b.modelId===1100005)rx=rz=.6*b.scale;
    // Accents stay compact even on oversized shots; never enlarge the body.
    rx=Math.min(rx,18/px);rz=Math.min(rz,26/px);
    let point=(a,l)=>screen(x+dz*a+dx*l,z-dx*a+dz*l);
    if(b.owner==='player'&&sprite){
      const m=sprite.matrix,r=sprite.localRect;
      if(!m||!r||![...m,...r].every(Number.isFinite)||(sprite.color?.[3]??1)<=0)return;
      const sx=Math.hypot(m[0],m[1]),sy=Math.hypot(m[2],m[3]);if(sx<1e-8||sy<1e-8)return;
      const cx=r[0]+r[2]/2,cy=r[1]+r[3]/2,ox=m[0]*cx+m[2]*cy+m[4],oy=m[1]*cx+m[3]*cy+m[5];
      rx=Math.min(r[2]*sx*.5,18);rz=Math.min(r[3]*sy*.5,26);px=1;
      // Match the rendered body, including texture offsets, animation scale,
      // curved flight and visualAngle. Collision radii never position this wake.
      point=(a,l)=>({x:ox+m[0]/sx*a-m[2]/sy*l,y:oy+m[1]/sx*a-m[3]/sy*l});
    }
    const palette=projectilePalette(b,element),rgb=palette[3]>0?palette.slice(0,3):element===3?[.22,1,.3]:[.12,.68,1];
    const light=rgb.map(v=>v*.5+.5),phase=b.age*7+b.uid*2.399963;
    const fade=Math.min(1,b.age/.08,(b.lifetime-b.age)/.08),pulse=(.78+.22*Math.sin(phase))*fade;
    const polygon=(points,color,alpha)=>{
      const start=batch.vertices.length;
      for(let i=0;i<points.length;i++){
        const p=point(...points[i]);
        batch.vertices.push({position:[p.x,p.y],uv:[.5,.5],color:[...color,Array.isArray(alpha)?alpha[i]:alpha]});
      }
      for(let i=1;i<points.length-1;i++)batch.indices.push(start,start+i,start+i+1);
    };
    const player=b.owner==='player';
    if(ROUND.has(b.modelId)||(player&&[1000050,1000031].includes(b.modelId))){
      // A small moving highlight within the round core, not a larger halo.
      for(let i=0;i<5;i++){
        const a=phase*.55+i*.19,c=a+.19;
        polygon([[Math.cos(a)*rx*.82,Math.sin(a)*rz*.82],[Math.cos(c)*rx*.82,Math.sin(c)*rz*.82],
          [Math.cos(c)*rx*.68,Math.sin(c)*rz*.68],[Math.cos(a)*rx*.68,Math.sin(a)*rz*.68]],light,.35*pulse);
      }
    }else{
      const sweep=(fract(b.age*2.3+b.uid*.173)-.5)*rz*.9;
      polygon([[-rx*.38,sweep],[0,sweep+rz*(player?.3:.12)],[rx*.38,sweep],[0,sweep-rz*.12]],light,(player?.48:.36)*pulse);
    }
    // No synthetic trail for stopped/held bodies or the native tailless model.
    const speed=Math.hypot(b.vx??0,b.vz??0);
    if(Number.isFinite(speed)&&speed>.05&&b.modelId!==1100016){
      const tail=Math.min(rz*(player?1.25:.85),(player?22:12)/px,speed*(player?.055:.035)*(player&&sprite?worldPx:1)),width=Math.min(rx*(player?.48:.35),(player?4:3)/px);
      polygon([[-width,-rz*.5],[width,-rz*.5],[0,-rz-tail]],rgb,[(player?.28:.24)*fade,(player?.28:.24)*fade,0]);
      if(player)polygon([[-width*.28,-rz*.42],[width*.28,-rz*.42],[0,-rz-tail*.7]],light,[.4*fade,.4*fade,0]);
      for(let i=0;i<2;i++){
        const t=fract(b.age*3.2+b.uid*.317+i*.5),side=(i?1:-1)*rx*(.2+t*.35),along=-rz*.5-tail*t;
        const size=Math.min(rx*.16,1.2/px)*(1-t*.55),alpha=.35*Math.sin(Math.PI*t)*fade;
        polygon([[side-size,along],[side,along+size*1.5],[side+size,along],[side,along-size*1.5]],light,alpha);
      }
    }
    batch.count++;
  }
  draw(view,depths){
    for(const owner of ['player','enemy']){
      const mesh=this.batches[owner];
      if(mesh.indices.length)view.drawMeshes('projectile-motion:'+owner,[mesh],undefined,{presentationDepth:depths[owner]});
    }
  }
}

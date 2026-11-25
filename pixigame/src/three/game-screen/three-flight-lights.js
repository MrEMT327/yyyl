import {BattleGeometry} from './three-battle-geometry.js';

export function flightLights(stage){
  const {scene,hull}=stage;
  const wake=new BattleGeometry(scene,24.92,true),trail=new BattleGeometry(scene,24.6,true);
  const tips=new BattleGeometry(scene,25.05,true);
  let body,exit;
  const ghosts=[24.8,24.85].map(depth=>stage.makeSprite(hull.userData.binding,depth));
  ghosts.forEach(node=>node.visible=false);
  return {
    engineWake(rows){
      wake.clear();
      for(const r of rows){
        const color=Number.parseInt(r.color,16),perpX=r.dy,perpY=-r.dx;
        for(const [w,l,alpha,c] of [[r.width,r.length,.30,color],[r.width*.48,r.length*.76,.48,color],[r.width*.20,r.length*.45,.76,0xe5fbff]]){
          let x=r.x,y=r.y,side=w,fade=alpha;
          for(let step=1;step<=9;step++){
            const t=step/9,z=t*t+1.2*(1-t)*t;
            const nx=r.x+r.dx*l*z,ny=r.y+r.dy*l*z,ns=w*((1-t)**2+1.1*(1-t)*t),nf=alpha*(1-z);
            wake.quad(x-perpX*side,y-perpY*side,x+perpX*side,y+perpY*side,nx+perpX*ns,ny+perpY*ns,nx-perpX*ns,ny-perpY*ns,c,fade,fade,nf,nf);
            x=nx;y=ny;side=ns;fade=nf;
          }
        }
        for(let k=0;k<2;k++){
          const t=((r.phase+k*.5)%1+1)%1,side=(k?1:-1)*r.width*.62,forward=r.length*(.2+t*.7);
          wake.ellipse(r.x+perpX*side+r.dx*forward,r.y+perpY*side+r.dy*forward,r.pixels*.36*(1-t*.5),r.pixels*.65,0xd8f7ff,.48*Math.sin(t*Math.PI),Math.atan2(r.dy,r.dx)-Math.PI/2);
        }
      }
      wake.flush();
    },
    placeWake(){
      const size=hull.material.uniforms.size.value;
      wake.scale.set(size.x/256,size.y/256,1);
      wake.position.set(hull.position.x-size.x/2,hull.position.y-size.y/2,0);
      wake.visible=hull.visible&&wake.count>0;wake.material.opacity=hull.material.uniforms.opacity.value;
    },
    ghosts(rows){
      for(const [i,node] of ghosts.entries()){
        const g=rows[i];node.visible=!!g;if(!g)continue;
        node.position.set(g.x,g.y,0);node.material.uniforms.size.value.set(g.width,g.height);
        node.material.uniforms.opacity.value=g.alpha;stage.tint(node,g.tint,true);
      }
    },
    wings(segments,points,{visible,clock,width,thrust,rollActive}){
      trail.clear();tips.clear();
      for(const s of segments){
        for(const [w,c,a] of [[4.5,0x47baff,.12],[2.1,0x64ddff,.4],[.85,0xd4f0fb,.7+(s.glint||0)*.1]]){
          trail.line(s.x1,s.y1,s.x2,s.y2,w*s.width,c,a*s.alpha);
        }
      }
      trail.flush();
      if(visible&&points?.length===2){
        const scale=Math.min(3.5,Math.max(.65,Math.abs(width)/80)),power=rollActive?.95:Math.min(.9,.65+Math.max(0,Math.min(1,thrust))*.4);
        for(const [side,p] of points.entries()){
          const intensity=power*(.92+.08*Math.sin(clock*5+side*1.7));
          for(let ring=8;ring>0;ring--){const t=ring/8,r=4.6*t*scale;tips.ellipse(p.x,p.y,r,r,0x5bc3ec,intensity*.12*Math.exp(-3*t*t));}
          tips.ellipse(p.x,p.y,.55*scale,.55*scale,0xbcebf5,intensity*.18);tips.ellipse(p.x,p.y,.25*scale,.25*scale,0xe2f8ff,intensity*.14);
        }
      }
      tips.flush();
    },
    victory(s){
      if(!s){
        if(body?.visible)body.clear();
        if(exit?.visible)exit.clear();
        return;
      }
      body??=new BattleGeometry(scene,24.65);
      exit??=new BattleGeometry(scene,24.7,true);
      body.clear();exit.clear();
      for(const a of s.segments)body.line(a.x1,a.y1,a.x2,a.y2,a.width*3.2,0x245bdb,a.alpha*.24*a.flow);
      for(const [w,c,opacity] of [[12,0x246dff,.07],[6.5,0x278fff,.15],[2.4,0x55caff,.72],[.85,0xe5faff,1]]){
        for(const a of s.segments)exit.line(a.x1,a.y1,a.x2,a.y2,a.width*w,c,a.alpha*opacity*(w<3?a.flow:1));
      }
      const {head,width,power,separation,flash}=s;
      for(const side of [-1,1]){
        const x=head.x+side*separation;
        for(let i=8;i>=1;i--){const t=i/8,r=width*7*t;exit.ellipse(x,head.y,r,r,0x41afff,power*.2*Math.exp(-3*t*t));}
        exit.ellipse(x,head.y,width*1.1,width*1.1,0xe5fbff,power*.95);
      }
      if(flash>.001){
        for(let i=8;i>=1;i--){const t=i/8;exit.ellipse(head.x,head.y,width*17*t,width*3*t,0x4abfff,power*flash*.12*Math.exp(-3*t*t));}
        exit.line(head.x-width*11,head.y,head.x+width*11,head.y,width*.8,0xefffff,power*flash*.95);
      }
      for(const p of s.sparks)for(const [size,c,a] of [[3.3,0x329fff,.15],[1,0xa1e9ff,.9],[.4,0xf0fdff,1]]){
        exit.ellipse(p.x,p.y,p.radius*size,p.radius*size,c,p.alpha*a);
      }
      body.flush();exit.flush();
    },
    disposeLights(){for(const n of [wake,trail,tips,body,exit,...ghosts])if(n)stage.remove(n);},
  };
}


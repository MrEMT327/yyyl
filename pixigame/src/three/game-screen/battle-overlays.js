import {Camera,Scene,PlaneGeometry,Mesh,ShaderMaterial,OrthographicCamera} from 'three';
import {createThreeSurface} from '../../ui/three-surface.js';

const modes={paused:1,upgrade:1,revive:1,treasure:2,lost:3,won:4};
const vertex='varying vec2 coords;void main(){coords=vec2(uv.x,1.-uv.y);gl_Position=vec4(position.xy,0.,1.);}';
// Colours are the authored CSS sRGB values. Interpolate premultiplied stops before normal alpha blending.
const fragment=`varying vec2 coords;uniform float mode;uniform float fade;
void main(){
  if(mode<1.5){gl_FragColor=vec4(vec3(18.,22.,28.)/255.,.68);return;}
  if(mode<2.5){gl_FragColor=vec4(0.,0.,0.,192./255.);return;}
  bool won=mode>3.5;
  float cy=won ? .24 : .29;
  float d=length((coords-vec2(.5,cy))/vec2(.5,1.-cy))*.70710678;
  float p=clamp(d/(won ? .65 : 1.),0.,1.);
  vec4 a=won?vec4(88.,73.,39.,.32):vec4(40.,48.,86.,.62);
  vec4 b=won?vec4(11.,27.,49.,.76):vec4(7.,14.,29.,.84);
  float alpha=mix(a.a,b.a,p);
  gl_FragColor=vec4(mix(a.rgb*a.a,b.rgb*b.a,p)/(255.*alpha),alpha*fade);
}`;

export function createBattleOverlays(renderer,{region=renderer.domElement,noticeHost=region,launching=()=>false,
  bounds=()=>region.getBoundingClientRect(),density=()=>globalThis.devicePixelRatio||1,now=()=>performance.now(),reducedMotion}={}){
  const scene=new Scene(),camera=new Camera(),reduced=reducedMotion?{get matches(){return reducedMotion();}}:matchMedia('(prefers-reduced-motion: reduce)');
  let mesh=null,phase='',mode=0,entered=0,notice='',labelArt=null,nw=0,nh=0;
  const labels=new Scene(),textCamera=new OrthographicCamera(0,1,0,1,-2,2);
  function phaseChange(next){
    if(next===phase)return;phase=next;mode=modes[next]||0;entered=now();
  }
  function drawBackdrop(){
    if(!mode||launching())return;
    if(!mesh){
      const material=new ShaderMaterial({uniforms:{mode:{value:0},fade:{value:1}},vertexShader:vertex,fragmentShader:fragment,
        transparent:true,depthWrite:false,depthTest:false,toneMapped:false});
      mesh=new Mesh(new PlaneGeometry(2,2),material);mesh.frustumCulled=false;scene.add(mesh);
    }
    const u=mesh.material.uniforms;u.mode.value=mode;u.fade.value=1;
    if(mode>=3&&!reduced.matches){
      const t=Math.min(1,(now()-entered)/(phase==='won'?550:600));
      if(t<1)u.fade.value=.35+.65*easeOut(t);
    }
    renderer.render(scene,camera);
  }
  function setNotice(text){
    text=String(text||'');if(text===notice)return;
    if(notice&&noticeHost?.getAttribute?.('aria-description')===notice)noticeHost.removeAttribute('aria-description');
    notice=text;labelArt?.destroy();labels.clear();labelArt=null;
    if(text)noticeHost?.setAttribute?.('aria-description',text);
  }
  function drawNotice(){
    if(!notice)return;
    const {width:w,height:h}=bounds();if(!w||!h)return;
    if(!labelArt||w!==nw||h!==nh){
      labelArt?.destroy();labels.clear();labelArt=createThreeSurface();labels.add(labelArt.group);
      nw=w;nh=h;textCamera.right=w;textCamera.bottom=h;textCamera.updateProjectionMatrix();
      const ratio=density(),snap=n=>Math.round(n*ratio)/ratio;
      const x=snap(w*.08),y=snap(h*.4),pw=w-2*x;
      const label=labelArt.text(notice,w/2,0,{size:16,weight:400,align:'center',family:'"Microsoft YaHei","PingFang SC",sans-serif',
        color:'#fff',wrap:true,lineHeight:'normal',maxWidth:Math.max(1,w*.84-42)});
      const ph=42+label.userData.uiTextLines.length*label.userData.uiLineHeight;
      const paper=labelArt.quad(x+1,y+1,pw-2,ph-2,'#122334',238/255);paper.renderOrder=-2;
      const edges=[[x,y,pw,1],[x,y+ph-1,pw,1],[x,y+1,1,ph-2],[x+pw-1,y+1,1,ph-2]];
      for(const [left,top,width,height] of edges)labelArt.quad(left,top,width,height,'#ffd331').renderOrder=-1;
      label.position.y=y+ph/2;
    }
    renderer.render(labels,textCamera);
  }
  return {phaseChange,drawBackdrop,drawNotice,notice:setNotice,destroy(){
    if(notice&&noticeHost?.getAttribute?.('aria-description')===notice)noticeHost.removeAttribute('aria-description');
    mesh?.geometry.dispose();mesh?.material.dispose();labelArt?.destroy();labels.clear();scene.clear();
  }};
}

// CSS ease-out, cubic-bezier(0,0,.58,1).
function easeOut(p){
  let lo=0,hi=1;
  for(let i=0;i<12;i++){const t=(lo+hi)/2,x=3*(1-t)*t*t*.58+t*t*t;if(x<p)lo=t;else hi=t;}
  const t=(lo+hi)/2;return t*t*(3-2*t);
}

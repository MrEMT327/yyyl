import {Color,DoubleSide,ShaderMaterial,Vector2} from 'three';
import {pilotCardQuality} from '../../ui/pilot-card-quality.js';

export function recruitCardLight(art,tools,roster,origin,size,gap){
  const mesh=art.quad(0,origin.y+3,size,size);
  const uniforms={metal:{value:new Color()},light:{value:new Color()},strength:{value:0},pointer:{value:new Vector2()},seconds:{value:0}};
  mesh.material.dispose();
  mesh.material=new ShaderMaterial({uniforms,transparent:true,toneMapped:false,depthTest:false,depthWrite:false,side:DoubleSide,forceSinglePass:true,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec2 vUv;
      uniform vec3 metal,light;uniform vec2 pointer;uniform float strength,seconds;
      void main(){
        vec2 p=vec2(vUv.x,1.-vUv.y);
        vec2 edge=min(p-vec2(.03,.018),vec2(.97,.982)-p);
        float frame=min(edge.x,edge.y);
        if(frame<0.||p.x+p.y<.078||p.x+p.y>1.91)discard;
        float rim=1.-smoothstep(.008,.024,frame);
        float rimBeam=pow(max(0.,cos((p.x*.9+p.y*.45-(seconds+1.5)/5.)*6.283)),4.);
        float phase=fract((seconds+2.)/7.6);
        float pass=smoothstep(.18,.25,phase)*(1.-smoothstep(.52,.6,phase));
        float sweep=exp(-pow((p.x+p.y*.4-mix(-.65,2.1,smoothstep(.18,.52,phase)))*8.,2.))*pass*.09;
        float foil=exp(-pow((p.x+(p.y-.5)*.52-(.25+pointer.x*.5+(pointer.y-.5)*.21))*3.4,2.));
        float face=foil*strength*.45*smoothstep(.58,.65,p.y)*(1.-smoothstep(.95,.98,p.y));
        float shine=exp(-pow((p.x+p.y*.47-.28)*8.,2.))*.021;
        float coverage=clamp(rim*rimBeam*.48+sweep+face+shine,0.,1.);
        gl_FragColor=vec4(mix(metal,light,clamp(rimBeam+face+.25,0.,1.)),coverage);
        #include <colorspace_fragment>
      }`});
  mesh.visible=false;
  const byId=new Map(roster.map((pilot,index)=>['pilot-'+pilot.id,{index,grade:pilotCardQuality(pilot.rarity,pilot.qualityRank,pilot.qualityKnown)}]));
  tools.pressEffect((pressed,time)=>{
    const entry=pressed&&byId.get(pressed.id);
    mesh.visible=Boolean(entry);if(!entry)return;
    mesh.position.x=origin.x+entry.index*(size+gap)+size/2;
    uniforms.metal.value.set(entry.grade.color);uniforms.light.value.set(entry.grade.light);
    uniforms.strength.value=entry.grade.foilActive;uniforms.pointer.value.set(pressed.x,pressed.y);
    uniforms.seconds.value=time-pressed.start;
  });
}


// Source resources stay immutable. Existing HDR highlights roll off unchanged;
// only mid-bright material detail gets a restrained local emission lift.
const ROOT='host://battle-vfx-finish-v1/';
export function finishShader(code,gain){
 let text=code.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 const tail=`
 float vfxPeak=max(COLOR.r,max(COLOR.g,COLOR.b));
 float vfxLift=smoothstep(0.78,1.18,vfxPeak)*(1.0-smoothstep(1.55,2.45,vfxPeak))*smoothstep(0.16,0.76,COLOR.a);
 COLOR.rgb*=1.0+${Number(gain).toFixed(3)}*vfxLift;
`;
 const match=/\bvoid\s+fragment\s*\(\s*\)\s*\{/.exec(text);
 if(!match)return text+'\nvoid fragment(){'+tail+'}\n';
 let i=match.index+match[0].length,depth=1;
 for(;i<text.length&&depth;i++){if(text[i]==='{')depth++;else if(text[i]==='}')depth--;}
 if(depth)throw Error('Unclosed effect fragment');
 return text.slice(0,i-1)+tail+text.slice(i-1);
}
export function withBattleVfxFinish(graph){
 const resources={...graph.resources},shaders={...graph.shaders},audit={finished:0,preserved:0};let serial=0;const cache=new Map();
 for(const [key,material]of Object.entries(graph.resources)){
  if(!['ShaderMaterial','CanvasItemMaterial'].includes(material.type))continue;
  const p=material.properties||{};let code,gain;
  if(material.type==='ShaderMaterial'){
   const source=graph.shaders[p.shader?.$external];
   if(!source||key.startsWith('host://combat-feedback-v1/')||/hint_screen_texture|prefire_dim|blend_sub|blend_mul/.test(source.code)){audit.preserved++;continue;}
   code=source.code;gain=/blend_add/.test(code)?.24:.14;
  }else{
   if(![0,1,undefined].includes(p.blend_mode)){audit.preserved++;continue;}
   code=`shader_type canvas_item;render_mode unshaded,blend_${p.blend_mode===1?'add':'mix'};void fragment(){}`;
   gain=p.blend_mode===1?.28:.10;
  }
  const identity=code+'\0'+gain;let shader=cache.get(identity);
  if(!shader){shader=ROOT+serial++;shaders[shader]={code:finishShader(code,gain)};cache.set(identity,shader);}
  resources[key]={...material,type:'ShaderMaterial',properties:{...p,shader:{$external:shader}}};audit.finished++;
 }
 return {...graph,resources,shaders,battleVfxFinish:audit};
}

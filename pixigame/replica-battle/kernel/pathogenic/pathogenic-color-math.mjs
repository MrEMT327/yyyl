/**
 * Godot 4.7 Compatibility/GLES3 equations, commit 5b4e0cb0fd279832bbdd69fed5354d4e5ad26f88.
 * Ported from drivers/gles3/shaders/effects/{glow,post,copy}.glsl and tonemap_inc.glsl.
 * Copyright (c) 2014-present Godot Engine contributors; (c) 2007-2014 Juan Linietsky,
 * Ariel Manzur. MIT: permission is granted free of charge to use, copy, modify,
 * merge, publish, distribute, sublicense and/or sell copies, provided this notice
 * and permission notice are included. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT
 * WARRANTY OF ANY KIND; AUTHORS ARE NOT LIABLE FOR ANY CLAIM, DAMAGES OR LIABILITY.
 *
 * Profile boundaries: nonlinear sRGB-encoded accumulation, RGBA16F M=1,
 * source Screen blend white=1, Linear tonemapper, no BCS/LUT/SSAO. Not RD glow.
 * The caller must include sampler precision declarations suitable for its GPU.
 * All pass reads use bilinear filtering and CLAMP_TO_EDGE.
 */
export const GODOT_COLOR_SOURCE = Object.freeze({
  commit:'5b4e0cb0fd279832bbdd69fed5354d4e5ad26f88',renderer:'gl_compatibility',
  base:'https://github.com/godotengine/godot/blob/5b4e0cb0fd279832bbdd69fed5354d4e5ad26f88/',
  files:['drivers/gles3/shaders/effects/glow.glsl','drivers/gles3/shaders/effects/post.glsl','drivers/gles3/shaders/tonemap_inc.glsl','drivers/gles3/shaders/effects/copy.glsl','drivers/gles3/effects/glow.cpp','drivers/gles3/effects/post_effects.cpp','scene/resources/environment.h'],
});
export const GLES_PROFILE_EVIDENCE = Object.freeze({
  intensity:{value:1.7,status:'game-script-verified',source:'main.gd compatibility_setup (parent source audit)'},
  threshold:{value:.9,status:'game-script-verified',source:'main.gd compatibility_setup (parent source audit)'},
  tonemapper:{value:0,status:'game-script-verified',source:'main.gd compatibility_setup: LINEAR'},
  hdrScale:{value:2,status:'engine-default-only-game-environment-unverified',source:'scene/resources/environment.h:175'},
  bloom:{value:0,status:'engine-default-only-game-environment-unverified',source:'scene/resources/environment.h:172'},
  cap:{value:12,status:'engine-default-only-game-environment-unverified',source:'scene/resources/environment.h:176'},
  exposure:{value:1,status:'engine-default-only-game-environment-unverified',source:'scene/resources/environment.h:117'},
  srgbWhite:{value:1,status:'engine-LINEAR-resolves-white-to-output-max',source:'servers/rendering/storage/environment_storage.cpp environment_get_white'},
  luminanceMultiplier:{value:1,status:'RGBA16F-engine-path',source:'drivers/gles3/rasterizer_scene_gles3.cpp:2465-2470'},
});

// No uniforms/varyings/main/version are declared. Inject once into each program.
// pixelSize = 1 / DESTINATION dimensions for filter/down/up. The final resolve
// upsample uses 1 / scene internal dimensions (post_effects.cpp PIXEL_SIZE).
// Hardware bilinear sampling supplies the source-resolution part of the kernel.
export const GLES_GLOW_GLSL = `
vec3 godotSrgbToLinearApprox(vec3 c) {
  return c * (c * (c * 0.305306011 + 0.682171111) + 0.012522878);
}
vec3 godotLinearToSrgbApprox(vec3 c) {
  return max(vec3(1.055) * pow(c, vec3(0.416666667)) - vec3(0.055), vec3(0.0));
}
vec3 godotCanvasExposure(vec3 c, float exposure) {
  return godotLinearToSrgbApprox(godotSrgbToLinearApprox(c) * exposure);
}
vec4 godotGlowDownsample(sampler2D sourceColor, vec2 uv, vec2 pixelSize) {
  vec2 h = pixelSize * 0.5;
  vec4 c = texture2D(sourceColor, uv) * 4.0;
  c += texture2D(sourceColor, uv - h);
  c += texture2D(sourceColor, uv + h);
  c += texture2D(sourceColor, uv - vec2(h.x, -h.y));
  c += texture2D(sourceColor, uv + vec2(h.x, -h.y));
  return c / 8.0;
}
vec4 godotGlowUpsample(sampler2D sourceColor, vec2 uv, vec2 pixelSize) {
  vec2 h = pixelSize * 0.5;
  vec4 c = texture2D(sourceColor, uv + vec2(-h.x * 2.0, 0.0));
  c += texture2D(sourceColor, uv + vec2(-h.x, h.y)) * 2.0;
  c += texture2D(sourceColor, uv + vec2(0.0, h.y * 2.0));
  c += texture2D(sourceColor, uv + vec2(h.x, h.y)) * 2.0;
  c += texture2D(sourceColor, uv + vec2(h.x * 2.0, 0.0));
  c += texture2D(sourceColor, uv + vec2(h.x, -h.y)) * 2.0;
  c += texture2D(sourceColor, uv + vec2(0.0, -h.y * 2.0));
  c += texture2D(sourceColor, uv + vec2(-h.x, -h.y)) * 2.0;
  return c / 12.0;
}
vec3 godotGlowFilter(vec3 c, float threshold, float hdrScale, float bloom, float cap) {
  float luminance = max(c.r, max(c.g, c.b));
  float feedback = max(smoothstep(threshold, threshold + hdrScale, luminance), bloom);
  return min(c * feedback, vec3(cap));
}
vec3 godotGlowResolve(vec3 sceneColor, vec3 upsampledGlow, float intensity) {
  vec3 g = clamp(upsampledGlow * intensity, vec3(0.0), vec3(1.0));
  vec3 c = sceneColor + g - sceneColor * g;
  // Source LINEAR tonemapper is identity, but these approximate transfers aren't.
  return godotLinearToSrgbApprox(godotSrgbToLinearApprox(c));
}
`;

const vector=(v,f)=>v.map(f);
export const srgbToLinearApprox=x=>x*(x*(x*.305306011+.682171111)+.012522878);
export const linearToSrgbApprox=x=>Math.max(1.055*Math.pow(x,.416666667)-.055,0);
/** Only call this before glow filtering when the engine would enable exposure copy. */
export const canvasExposure=(rgb,exposure)=>vector(rgb,x=>linearToSrgbApprox(srgbToLinearApprox(x)*exposure));
export function glowFilter(rgb,threshold,hdrScale,bloom,cap){
  // GLSL smoothstep with edge1 <= edge0 is undefined. Fail rather than inventing it.
  if(!(hdrScale>0))throw new RangeError('Source smoothstep requires positive hdrScale');
  const u=Math.max(0,Math.min(1,(Math.max(...rgb)-threshold)/hdrScale));
  const f=Math.max(u*u*(3-2*u),bloom);
  return vector(rgb,x=>Math.min(x*f,cap));
}
export function glowResolve(scene,glow,intensity){
  return scene.map((c,i)=>{const g=Math.max(0,Math.min(1,glow[i]*intensity));return linearToSrgbApprox(srgbToLinearApprox(c+g-c*g));});
}
function weighted(sample,uv,pixelSize,taps,divisor){
  const values=taps.map(([x,y,w])=>[sample([uv[0]+x*pixelSize[0]*.5,uv[1]+y*pixelSize[1]*.5]),w]);
  return values[0][0].map((_,i)=>values.reduce((sum,[v,w])=>sum+v[i]*w,0)/divisor);
}
export const glowDownsample=(sample,uv,pixelSize)=>weighted(sample,uv,pixelSize,[[0,0,4],[-1,-1,1],[1,1,1],[-1,1,1],[1,-1,1]],8);
export const glowUpsample=(sample,uv,pixelSize)=>weighted(sample,uv,pixelSize,[[-2,0,1],[-1,1,2],[0,2,1],[1,1,2],[2,0,1],[1,-1,2],[0,-2,1],[-1,-1,2]],12);
export function glowLevelSizes(width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw new RangeError('Positive integer viewport dimensions required');
  return Array.from({length:4},()=>[width=Math.max(4,Math.floor(width/2)),height=Math.max(4,Math.floor(height/2))]);
}

/** CPU shader-number reference, not a substitute for binary16 pass rounding/GPU QA. */
export function bilinearClamp(image,uv){
  const {width,height,data}=image,px=uv[0]*width-.5,py=uv[1]*height-.5,x0=Math.floor(px),y0=Math.floor(py),fx=px-x0,fy=py-y0;
  const p=(x,y,c)=>data[(Math.max(0,Math.min(height-1,y))*width+Math.max(0,Math.min(width-1,x)))*4+c];
  return [0,1,2,3].map(c=>(p(x0,y0,c)*(1-fx)+p(x0+1,y0,c)*fx)*(1-fy)+(p(x0,y0+1,c)*(1-fx)+p(x0+1,y0+1,c)*fx)*fy);
}
/** Reproduce pass ordering; caller can supply quantize to model binary16 writes. */
export function referenceGlowPasses(image,parameters,{quantize=x=>x}={}){
  const {threshold,hdrScale,bloom,cap,intensity}=parameters;
  if(![threshold,hdrScale,bloom,cap,intensity].every(Number.isFinite))throw new TypeError('All profile parameters must be supplied explicitly');
  const sizes=glowLevelSizes(image.width,image.height),trace=[];
  const pass=(source,size,kernel,filter=false)=>{
    const [width,height]=size,data=new Float64Array(width*height*4),pixelSize=[1/width,1/height];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      let c=kernel(uv=>bilinearClamp(source,uv),[(x+.5)/width,(y+.5)/height],pixelSize);
      if(filter)c=[...glowFilter(c.slice(0,3),threshold,hdrScale,bloom,cap),1];
      c.forEach((v,i)=>data[(y*width+x)*4+i]=quantize(v));
    }
    return {width,height,data};
  };
  let current=pass(image,sizes[0],glowDownsample,true);trace.push({kind:'filter',...current});
  for(let i=1;i<4;i++){current=pass(current,sizes[i],glowDownsample);trace.push({kind:'down',...current});}
  for(let i=2;i>=0;i--){current=pass(current,sizes[i],glowUpsample);trace.push({kind:'up',...current});}
  const glow=pass(current,[image.width,image.height],glowUpsample),data=new Float64Array(image.data.length);
  for(let i=0;i<data.length;i+=4){glowResolve(Array.from(image.data.slice(i,i+3)),Array.from(glow.data.slice(i,i+3)),intensity).forEach((x,j)=>data[i+j]=quantize(x));data[i+3]=image.data[i+3];}
  return {width:image.width,height:image.height,data,glow,trace};
}

// Only the first chapter uses this pass. Sample the rigid painted ground in
// place: no displacement of islands, architecture, coast or submerged rocks.
export const coastalWaterShader = `
#if COASTAL_WATER == 1
float seaMask(vec3 c){
  return (1.-smoothstep(.20,.36,c.r/max(c.g,.0001)))
    *smoothstep(.006,.025,c.b-c.r)
    *(1.-smoothstep(.24,.40,c.g));
}
vec3 animateCoastalWater(vec3 color,vec3 original,vec2 uv,float t){
  float water=seaMask(original);
  float shallow=water*smoothstep(.57,.83,original.g/max(original.b,.0001));
  // Broad slow currents give open water depth without turning it into fog.
  float flow=sin(uv.x*15.+uv.y*12.566371-t*.19
    +sin(uv.x*8.-uv.y*6.283185+t*.11)*1.1);
  color*=1.+water*flow*.055;
  // Broken elongated surface reflections, moving independently of the ground.
  float crest=sin(uv.y*75.398224+sin(uv.x*12.+uv.y*6.283185)*1.5-t*.65);
  float ripplePatch=smoothstep(.65,.95,sin(uv.x*24.-uv.y*12.566371+t*.17))
    *(.35+.65*smoothstep(-.2,.8,sin(uv.x*7.+uv.y*6.283185)));
  float ripple=smoothstep(.93,.998,crest)*ripplePatch*water;
  color=mix(color,vec3(.15,.36,.42),ripple*.12);
  // Shallow-water light: two crossing curves, confined to painted teal shelves.
  float a=sin(uv.x*110.+sin(uv.y*62.831853-t*.31)*1.6+t*.38);
  float b=sin(uv.y*113.097336+sin(uv.x*61.+t*.27)*1.4-t*.33);
  float caustic=smoothstep(.92,.995,max(a,b));
  color=mix(color,vec3(.18,.43,.43),shallow*caustic*.20);
  // A narrow tidal ribbon follows actual water/land boundaries, including the
  // offshore reefs. Land pixels themselves never receive this effect.
  vec2 dx=vec2(.003,0.),dy=vec2(0.,.002);
  float neighbor=min(min(seaMask(sampleArtwork(uv+dx).rgb),seaMask(sampleArtwork(uv-dx).rgb)),
                     min(seaMask(sampleArtwork(uv+dy).rgb),seaMask(sampleArtwork(uv-dy).rgb)));
  float shore=water*(1.-neighbor);
  float tide=.35+.65*smoothstep(-.4,.8,sin(uv.y*37.699112+uv.x*35.-t*1.3));
  color=mix(color,vec3(.36,.58,.60),shore*tide*.30);
  return color;
}
#endif
`;

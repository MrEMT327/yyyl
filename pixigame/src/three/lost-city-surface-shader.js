// Project art only. Follow painted maintenance lights without displacing
// buildings, streets, supports or the quiet central flight corridor.
export const lostCitySurfaceShader=`
#if LOST_CITY_SURFACE == 1
vec3 animateLostCitySurface(vec3 color,vec3 original,vec2 uv,float t){
  float lamp=smoothstep(.055,.16,original.g-original.r)
    *smoothstep(.075,.20,original.b-original.r)
    *smoothstep(.25,.55,original.g);
  float pulse=.55+.45*sin(t*.85+uv.y*12.566371+uv.x*5.);
  return color+vec3(.016,.031,.036)*lamp*pulse;
}
#endif
`;

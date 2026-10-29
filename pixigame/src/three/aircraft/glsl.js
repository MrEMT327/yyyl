// Compact, texture-free noise; the cell boundary is F2-F1 (not a thresholded sine).
export const NOISE = /* glsl */`
float h12(vec2 p) { vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 h22(vec2 p) { vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float n2(vec2 p) { vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+1.),f.x),f.y); }
float fbm(vec2 p) { return n2(p)*.57+n2(p*2.13+17.3)*.28+n2(p*4.31+8.4)*.15; }
vec2 cell(vec2 p) {
 vec2 i=floor(p),f=fract(p); float a=8.,b=8.;
 for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) {vec2 g=vec2(float(x),float(y)); vec2 d=g+h22(i+g)-f; float q=dot(d,d); if(q<a){b=a;a=q;} else b=min(b,q); }
 return vec2(sqrt(a),sqrt(b)-sqrt(a));
}
`;
export const FLAT_VERTEX=/*glsl*/`
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;

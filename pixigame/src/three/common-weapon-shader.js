// Weapon energy is shaded on instanced GPU surfaces. The three tint channels
// stay palette-driven so stronger highlights do not erase each weapon's color.
export const commonWeaponFragmentShader=`
varying vec2 vUv;varying vec4 vColor;varying vec3 vHot;varying vec4 vMeta;varying vec4 vFlags;varying vec2 vSize;uniform float clock;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.57+noise(p*2.07)*.28+noise(p*4.13)*.15;}
float band(float d,float w){return exp(-d*d/max(.000001,w*w));}
float shell(float r,float radius,float w){return band(r-radius,w);}
float hexagon(vec2 p){p=abs(p);return max(dot(p,vec2(.866025,.5)),p.y);}
float rays(float angle,float count,float offset,float sharpness){return pow(max(0.,sin(angle*count+offset)),sharpness);}
void main(){
 vec2 p=vUv*2.-1.;float r=length(p),angle=atan(p.x,-p.y);
 // Enumerations arrive through interpolated varyings, so compare rounded IDs.
 float id=floor(vMeta.x+.5),rank=floor(vMeta.y+.5),t=clamp(vMeta.z,0.,1.),extra=vMeta.w,flag=floor(vFlags.x+.5);
 float quality=rank*.2,a=0.,hot=0.;vec3 col=vColor.rgb;
 float n=fbm(p*5.+vec2(clock*.3,-clock*.6));
 if(id<.5||id==3.||id==29.||id==28.||id==14.){
   // A dense core, moving sheath and broad falloff keep rays readable in motion.
   float w=id==29.?.145:id==28.?.065:id==14.?.11:.23+quality*.025;
   float center=id==29.?sin(p.y*34.+clock*13.)*.1:id==28.?sin(vUv.y*3.14159)*.22:0.;
   float d=p.x-center,flow=noise(vec2(p.x*9.,p.y*26.-clock*13.));
   a=band(d,w)*.95+band(d,w*2.8)*(.3+flow*.18);hot=band(d,w*.43)*.8;
   a+=band(abs(d)-w*1.45,w*.24)*(.1+quality*.12)*(.5+flow*.5);
   if(id==14.){a*=.4+.6*step(.42,fract(vUv.y*vSize.y/16.-clock*3.));hot*=.6;}
   if(id==28.){a*=.62;hot*=.5;}
   if(id==3.){a*=.82+.18*noise(vec2(p.y*50.,clock*25.));hot+=band(p.x,.65)*pow(max(0.,1.-vUv.y),10.)*extra*.08;}
   if(id==0.&&flag==1.){
     // The quad is twice the physical pulse width: |p.x|=.5 is its hit edge.
     a=(1.-smoothstep(.44,.5,abs(p.x)))*.88+band(p.x,.75)*.1;
     hot=band(p.x,.09)*.65;
   }
   a*=smoothstep(0.,.015,vUv.y)*smoothstep(0.,.015,1.-vUv.y);
 }else if(id==1.){
   float zig=(noise(vec2(floor(vUv.y*28.),floor(clock*24.)))-.5)*.8*sin(vUv.y*3.14159);
   float d=p.x-zig,flicker=.84+.16*sin(clock*73.+p.y*17.);
   a=(band(d,.06)*1.1+band(d,.19)*.48+band(d,.43)*.12)*flicker;hot=band(d,.027)*.9;
   if(rank>=3.){
     float branch=band(p.x-zig-sin(vUv.y*17.+extra)*.34,.027)*step(.2,vUv.y)*step(vUv.y,.85);
     a+=branch*.8+band(p.x-zig+sin(vUv.y*21.-clock*9.)*.3,.045)*.26;
     hot+=branch*.4;
   }
   a*=smoothstep(0.,.02,vUv.y)*smoothstep(0.,.02,1.-vUv.y);
 }else if(id==2.){
   float flow=fbm(vec2(p.x*7.,p.y*10.+clock*8.)),plume=band(p.x,.5+flow*.21);
   float ice=pow(noise(vec2(p.x*19.,p.y*65.+clock*21.)),14.);
   a=plume*(.3+flow*.62)+band(p.x,.16)*.38;hot=ice*plume*4.+band(p.x,.14)*.42;
   a+=band(abs(p.x)-.5,.1)*flow*.24;a*=smoothstep(0.,.025,vUv.y)*smoothstep(0.,.04,1.-vUv.y);
 }else if(id==4.){
   float taper=(1.-vUv.y)*.65+.035,flow=fbm(vec2(p.x*7.,p.y*13.-clock*15.));
   float jet=band(p.x+sin(p.y*16.+clock*25.)*.035,taper);
   a=jet*pow(1.-vUv.y,.85)*(.58+flow*.38);hot=band(p.x,taper*.28)*(1.-vUv.y)*.6;
   a+=band(p.x,taper*1.5)*pow(1.-vUv.y,1.8)*.12;
 }else if(id==5.||id==21.){
   float cloud=(1.-smoothstep(.16,1.,r))*smoothstep(.12,.72,n);
   a=cloud*(id==21.?.42:.46);col*=.48+n*.8;
   hot=cloud*pow(n,3.)*.18;
 }else if(id==6.||id==31.){
   // Each field owns its noise offset and lobe phase. Smooth time drift keeps
   // silhouettes organic without frame-to-frame random flicker or extra quads.
   float seed=vFlags.y,phase=seed*6.28318;
   vec2 offset=vec2(seed*37.,fract(seed*17.13)*41.);
   vec2 drift=offset+vec2(clock*(.1+seed*.06),-clock*.09);
   float billow=fbm(p*(2.3+seed*.6)+drift);
   float lobes=sin(angle*3.+phase+clock*.18)*.055+sin(angle*5.-phase*2.-clock*.12)*.035;
   float edge=clamp(.84+(billow-.5)*.38+lobes,.68,.96);
   float dissolve=smoothstep(0.,.65,vColor.a);
   float rr=id==31.?r/max(.25,1.-t*.75):r;
   float body=1.-smoothstep(edge-.2*dissolve,edge,rr);
   float folds=noise(p*3.5+offset+vec2(sin(clock*.3+phase),-clock*.15));
   float rim=shell(rr,edge-.1,.07)*(.4+folds*.6);
   a=(body*(.18+folds*.16)+rim*.13)*dissolve;
   col=mix(vec3(.075,.18,.045),vColor.rgb,.38+billow*.38);
   hot=0.;
   if(flag>0.)a*=.8;
   if(id==31.){a*=1.-t;col=mix(col,vHot,.15);}
 }else if(id==7.){
   float flame=fbm(vec2(p.x*5.+sin(p.y*4.-clock*4.)*.35,p.y*3.+clock*5.));
   float crown=.7+(flame-.5)*.45,body=1.-smoothstep(crown-.32,crown+.16,r);
   float density=body*smoothstep(.12,.7,flame-p.y*.17);
   a=body*.34+density*.25;
   col=mix(vec3(.12,.018,.005),vec3(.9,.16,.015),smoothstep(.22,.72,flame));
   hot=pow(flame,5.)*body*.5;
 }else if(id==8.){
   float sector=extra>.5?1.:1.-smoothstep(1.08,1.18,abs(angle));
   float front=extra>.5?(.22+t*.65):(.85-t*.32),distort=sin(r*30.+clock*5.+n*3.);
   float lens=band(r,.58)*(.25+.2*step(3.,rank)),rim=shell(r,front,extra>.5?.027:.042);
   float inward=shell(r,front*.63,.05)*(.35+.65*distort*distort);
   a=sector*(rim*.95+lens*(.35+.65*distort*distort)+inward*.25);
   hot=sector*(shell(r,front-.025,.016)*.7+inward*.22);
   if(rank>=1.)hot+=band(length(p-vec2(0.,-.22)),.19)*max(0.,1.-t*6.)*.75;
   if(rank>=3.)a+=sector*rays(angle,6.,-clock*3.+r*11.,5.)*band(r,.6)*.14;
 }else if(id==9.||id==10.||id==36.){
   float rr=hexagon(p),edge=id==10.?.15+t*.68:.72,freeze=id==36.?1.:id==10.?1.:extra;
   float facets=pow(abs(sin(angle*3.)),14.),rim=shell(rr,edge,.029+freeze*.016);
   float inside=(1.-smoothstep(edge-.23,edge,rr));
   a=rim*(.62+freeze*.5)+inside*n*.28*freeze;
   hot=facets*shell(rr,edge,.13)*.78*freeze+rim*.3;
   a+=inside*facets*.2*freeze;
   if(id==36.){hot+=band(r,.43)*.6;a+=band(r,.65)*.35;}
 }else if(id==11.||id==32.||id==40.){
   // Explosions have a pressure front, turbulent body and a brief dense core.
   float wave=.1+t*.82,shock=shell(r,wave,.034+.014*(1.-t))*(1.-t);
   float cloud=(1.-smoothstep(.13,.88,r))*smoothstep(.16,.7,n)*pow(1.-t,1.65);
   float burst=rays(angle,rank>=3.?11.:8.,extra+n*.7,22.)*band(r-(.2+t*.45),.29)*(1.-t);
   float flash=band(r,.18+.1*t)*max(0.,1.-t*4.);
   a=shock*1.05+cloud*.96+burst*.7+flash*.6;hot=flash*.9+shock*.45+burst*.4;
   if(flag==1.){
     float splash=1.-smoothstep(.1+t*.55,.16+t*.64,r+(n-.5)*.2);
     a=splash*pow(1.-t,1.2)+burst*.24;
     col=mix(vec3(.19,.025,.005),vec3(1.,.28,.015),n);
     hot=flash*.35+pow(n,5.)*splash*.5;
   }
   if(flag==2.){a=shell(r,.85-t*.65,.035)*.95+band(r,.38)*max(0.,1.-t)*.22;hot=a*.5;}
   if(flag==3.&&t<.22){a+=band(r,.24*(1.-t*3.));hot+=band(r,.13)*.7;}
   if(rank>=2.||flag>0.)a+=shell(r,wave*.8,.022)*.6*(1.-t);
   if(id==32.)a*=.82;
   if(id==32.&&flag==4.){
     a=(shock*.45+burst*.45)*pow(1.-t,1.5);hot=burst*.12;
   }
   if(id==40.){a+=rays(angle,7.,n*4.,14.)*band(r,.7)*.82;hot+=shock*.15;}
 }else if(id==12.||id==37.||id==35.||id==34.||id==38.){
   float life=1.-t,spark=rays(angle,rank>=1.?9.:6.,extra,28.)*band(r-(.15+t*.6),.32);
   float core=band(r,.24)*max(0.,1.-t*2.),halo=band(r,.55)*max(0.,1.-t*1.4);
   a=spark*life*1.25+core*.95+halo*.35;hot=spark*life*.67+core*.85;
   a+=shell(r,.15+t*.7,.024)*life*.3;
   if(id==35.)col=mix(vec3(.9,.13,.23),vColor.rgb,smoothstep(0.,.3,t));
 }else if(id==13.){
   float segments=step(.34,fract((angle+3.14159)/6.28318*28.));
   float edge=shell(r,.86,.014)*segments,scan=shell(r,fract(clock*.65)*.84,.026)*step(2.,rank);
   a=(edge*.42+scan*.7)*(.8+.2*sin(clock*(extra>.5?28.:7.)));
   if(rank>=1.){float pulse=shell(r,.12,.025);a+=pulse*.75;hot=pulse*.6+scan*.25;}
   if(flag>0.)a+=shell(r,.3,.028)*step(.4,fract(angle/6.28318*4.))*.82;
 }else if(id==15.||id==16.){
   float sector=id==16.?1.:smoothstep(-1.25,-.9,angle)*(1.-smoothstep(.8,1.2,angle));
   float taper=id==16.?1.:pow(max(0.,cos(angle*1.15)),.7);
   float life=smoothstep(0.,.08,t)*(1.-smoothstep(.28,1.,t));
   float edge=shell(r,.76,.018+.018*taper),wake=shell(r,.69,.07)*.28;
   a=(edge+wake)*sector*life;
   hot=shell(r,.77,.012)*sector*life*.8;
   a+=shell(r,.62,.035)*sector*life*.12;
 }else if(id==17.){
   float gap=mix(.65,.25,clamp(extra-1.,0.,1.)),ends=1.-smoothstep(.58,1.,abs(p.y));
   float core=band(p.x-gap,.063)+band(p.x+gap,.063);
   a=(core*.95+(band(p.x-gap,.19)+band(p.x+gap,.19))*.32)*ends;
   hot=core*ends*(.45+vFlags.x*.35);
   if(flag>0.)a+=band(p.x,.65)*ends*(.12+.1*sin(clock*32.-p.y*12.));
 }else if(id==18.||id==19.){
   float side=id==18.?smoothstep(.28,.7,p.y):1.;
   float bend=id==19.?abs(p.x)-(.64+.12*sin(p.y*3.)):r/(1.-t*.3);
   float core=id==19.?band(bend,.039):shell(bend,.55,.034)+shell(bend,.75,.026)+shell(bend,.95,.024);
   a=core*side*.72;hot=core*side*.38;
   if(id==19.)a+=band(bend,.14)*.2*(.7+.3*sin(p.y*15.-clock*16.));
 }else if(id==20.||id==42.){
   float count=id==42.?8.:4.,cell=floor(vUv.y*count),segment=step(cell,extra-.5)*step(.52,fract(vUv.y*count));
   float body=1.-smoothstep(.5,.7,abs(p.x));a=segment*body*.92;hot=segment*band(p.x,.28)*.55;
 }else if(id==22.||id==23.||id==24.||id==30.||id==33.||id==41.){
   float radius=id==24.?.85-t*.55:id==30.?.75:.2+t*.65;
   float rim=shell(r,radius,.024),halo=shell(r,radius,.087);
   a=rim*.92+halo*.24;hot=rim*.52;
   if(id==22.)a+=shell(r,radius*.8,.019)*.5*step(2.,extra);
   if(id==23.)a*=.35+.65*step(.3,fract(angle*2.));
   if(id==24.){a+=shell(r,radius*.78,.03)*.26;hot+=band(r,.25)*max(0.,1.-t*3.)*.35;}
   if(id==30.)a*=.65+.35*step(.18,fract(angle/6.28318*6.+clock*.12));
 }else if(id==25.){
   float diamond=abs(p.x)+abs(p.y)-.65;
   a=band(diamond,.06)*.98+band(diamond,.17)*.22;hot=band(diamond,.024)*.75;
 }else if(id==26.){
   float core=band(p.x,.26)*band(p.y,.72),flare=band(p.x,.58)*band(p.y,.26);
   a=(core+flare*.42)*(rank>=1.?1.15:1.);hot=band(p.x,.1)*band(p.y,.55)*.88;
   if(floor(extra+.5)==1.){
     float rectangle=max(abs(p.x),abs(p.y)*.65);a=(1.-smoothstep(.33,.58,rectangle))*.8+band(rectangle-.43,.07)*.3;hot=band(rectangle,.23)*.75;
   }
   if(floor(extra+.5)==2.){a*=1.-smoothstep(.3,.95,abs(angle));hot*=1.-smoothstep(.15,.7,abs(angle));}
 }else if(id==27.){
   a=band(length(vec2(p.x,p.y*2.4)),.72)*.28;col*=.4;
 }else if(id==39.){
   float arm=band(p.x,.08)*(1.-smoothstep(.65,.9,abs(p.y)))+band(p.y,.08)*step(0.,p.x);
   a=arm*.9+band(length(p),.2)*.3;hot=arm*.62;
 }else if(id==43.){
   // A cool spherical plasma volume sits inside the separate glass GLB shell.
   // Elliptical circulation changes direction and depth instead of burning upward.
   float sphere=1.-smoothstep(.53,.7,r),z=sqrt(max(0.,1.-r*r/.49));
   float swirl=fbm(p*6.+vec2(sin(clock*.8+p.y*3.),cos(clock*.7+p.x*3.))*1.2);
   float nucleus=band(r,.22)*(.94+.06*sin(clock*3.)),halo=band(r,.75)*.11;
   float spin=clock*.7,c=cos(spin),s=sin(spin);vec2 q=mat2(c,s,-s,c)*p;
   float orbit=shell(length(vec2(q.x,q.y*1.85)),.57,.024)*(.32+.68*smoothstep(-.3,.3,q.y));
   float filament=shell(r,.43+sin(angle*3.-clock*2.+swirl*3.)*.08,.022)*sphere;
   if(rank>=1.)filament+=shell(r,.3+sin(angle*5.+clock*2.2)*.045,.015)*sphere*.4;
   if(rank>=2.)orbit+=shell(length(vec2(q.x*1.8,q.y)),.57,.021)*(.3+.4*(1.-smoothstep(-.25,.25,q.x)));
   if(rank>=3.)filament+=pow(noise(vec2(angle*4.+clock*1.4,r*18.-clock*2.)),12.)*sphere*3.;
   if(rank>=4.){
     vec2 crossing=mat2(.707107,.707107,-.707107,.707107)*q;
     orbit+=shell(length(vec2(crossing.x,crossing.y*2.3)),.63,.016)*.48;
   }
   if(rank>=5.){
     vec2 node=vec2(cos(clock*1.8),sin(clock*1.8))*.48;
     filament+=band(length(p-node),.065)*.75+band(length(p+node*.8),.052)*.55;
   }
   a=sphere*(.27+z*.18+swirl*.17)+nucleus*.42+orbit*.58+filament*.38+halo;
   col=mix(vec3(.018,.075,.24),vColor.rgb,.5)*(.72+z*.33+swirl*.16);
   hot=nucleus*.42+orbit*.4+filament*.35;
 }
 if(id==45.){
   float core=1.-smoothstep(.2,.36,abs(p.x)),body=band(p.x,.48),halo=band(p.x,.78);
   float flow=pow(.5+.5*sin(vUv.y*vSize.y*.055-clock*8.),10.);
   a=min(.99,body*.8+core*.5+halo*.1)*smoothstep(0.,.012,vUv.y)*smoothstep(0.,.012,1.-vUv.y);
   col=mix(vColor.rgb,vHot,clamp(core*.95+flow*body*.18,0.,1.));hot=0.;
 }
 if(id==44.){
   // Dense lava: advected folds and dark cooling crust, no glass or radial star.
   vec2 q=p+vec2(sin(p.y*5.+clock*2.1),cos(p.x*4.-clock*1.7))*.055;
   float flow=fbm(q*4.+vec2(clock*.65,-clock*1.4));
   float edge=.68+(fbm(q*3.+clock*.4)-.5)*.16;
   float body=1.-smoothstep(edge-.035,edge,length(q));
   float folds=fbm(q*7.+vec2(flow*2.,-clock*1.9));
   float heat=smoothstep(.28,.72,folds);
   float crust=smoothstep(.55,.7,flow)*.78;
   col=mix(vec3(.19,.018,.004),vec3(.94,.16,.009),heat);
   col=mix(col,vec3(1.,.58,.055),pow(heat,5.)*.85);
   col=mix(col,vec3(.075,.014,.009),crust);
   col*=.76+.24*(1.-p.y);
   a=body;hot=0.;
 }
 // Surface-local falloff prevents rectangular fringes when bright layers stack.
 float edgeFade=1.-smoothstep(.94,1.,max(abs(p.x),abs(p.y)));
 a=clamp(a*vColor.a*edgeFade,0.,1.);col=mix(col,vHot,clamp(hot,0.,.82));
 if(a<.002)discard;gl_FragColor=vec4(col,a);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 // This narrow white energy core is display-referred: scene tone mapping
 // must not turn it grey. The soft sheath and every other effect stay mapped.
 if(id==45.)gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(1.),1.-smoothstep(.2,.36,abs(p.x)));
}`;

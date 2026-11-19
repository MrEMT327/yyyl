import * as T from 'three';

// Triangles in the same orthographic coordinates as the combat sprites.
export class BattleGeometry extends T.Mesh {
  constructor(parent,depth,additive=false){
    const geometry=new T.BufferGeometry(),material=new T.RawShaderMaterial({
      vertexShader:'precision highp float;attribute vec3 position;attribute vec4 color;uniform mat4 projectionMatrix,modelViewMatrix;varying vec4 ink;void main(){ink=vec4(color.rgb*color.a,color.a);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'precision highp float;varying vec4 ink;void main(){gl_FragColor=ink;}',
      transparent:true,depthWrite:false,depthTest:false,side:T.DoubleSide,forceSinglePass:true,
      blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:additive?T.OneFactor:T.OneMinusSrcAlphaFactor,
    });
    super(geometry,material);this.frustumCulled=false;this.renderOrder=depth;
    this.userData.ownsGeometry=true;this.capacity=0;this.count=0;this.visible=false;this.reserve(128);this.clear();parent.add(this);
  }
  reserve(n){
    if(n<=this.capacity)return;
    const size=Math.max(n,this.capacity*2,128),pos=new Float32Array(size*3),col=new Float32Array(size*4);
    if(this.capacity){
      pos.set(this.positions.subarray(0,this.count*3));col.set(this.colors.subarray(0,this.count*4));this.geometry.dispose();
    }
    this.capacity=size;this.positions=pos;this.colors=col;
    this.geometry.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));
    this.geometry.setAttribute('color',new T.BufferAttribute(col,4).setUsage(T.DynamicDrawUsage));
  }
  clear(){this.count=0;this.geometry.setDrawRange(0,0);this.visible=false;return this;}
  vertex(x,y,c,a){
    const i=this.count++;this.positions[i*3]=x;this.positions[i*3+1]=y;
    this.colors[i*4]=(c>>16&255)/255;this.colors[i*4+1]=(c>>8&255)/255;this.colors[i*4+2]=(c&255)/255;this.colors[i*4+3]=a;
  }
  quad(ax,ay,bx,by,cx,cy,dx,dy,color,a,b=a,c=a,d=a){
    this.reserve(this.count+6);
    this.vertex(ax,ay,color,a);this.vertex(bx,by,color,b);this.vertex(cx,cy,color,c);
    this.vertex(ax,ay,color,a);this.vertex(cx,cy,color,c);this.vertex(dx,dy,color,d);
  }
  line(x1,y1,x2,y2,w,color,a){
    const dx=x2-x1,dy=y2-y1,r=w*.5/Math.hypot(dx,dy);if(!Number.isFinite(r)||a<=0)return;
    this.quad(x1-dy*r,y1+dx*r,x2-dy*r,y2+dx*r,x2+dy*r,y2-dx*r,x1+dy*r,y1-dx*r,color,a);
  }
  ellipse(x,y,rx,ry,color,alpha,angle=0){
    if(alpha<=0||rx<=0||ry<=0)return;
    const n=Math.min(48,Math.max(12,Math.ceil(Math.max(rx,ry)*1.5))),cos=Math.cos(angle),sin=Math.sin(angle);
    this.reserve(this.count+n*3);
    let ax=rx*cos,ay=rx*sin;
    for(let i=1;i<=n;i++){
      const a=Math.PI*2*i/n,px=Math.cos(a)*rx,py=Math.sin(a)*ry,bx=px*cos-py*sin,by=px*sin+py*cos;
      this.vertex(x,y,color,alpha);this.vertex(x+ax,y+ay,color,alpha);this.vertex(x+bx,y+by,color,alpha);ax=bx;ay=by;
    }
  }
  flush(){
    this.visible=this.count>0;this.geometry.setDrawRange(0,this.count);
    if(this.count)for(const a of Object.values(this.geometry.attributes)){
      a.clearUpdateRanges();a.addUpdateRange(0,this.count*a.itemSize);a.needsUpdate=true;
    }
  }
}


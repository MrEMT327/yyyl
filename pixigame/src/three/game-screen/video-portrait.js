import {Mesh,Scene,Camera,PlaneGeometry,RawShaderMaterial,VideoTexture,Vector2,NoBlending,LinearFilter,NoColorSpace} from 'three';
import {mountPortraitSurface} from './h5-portrait.js';

export function mountVideoPortrait(canvas,manifest,vertexShader,fragmentShader,monitor,screen){
  return mountPortraitSurface(canvas,monitor,screen,renderer=>{
    const scene=new Scene(),camera=new Camera(),geometry=new PlaneGeometry(2,2);
    const uniforms={frame:{value:null},fit:{value:new Vector2(1,1)},packedSize:{value:new Vector2()},
      repairShirtHoles:{value:manifest.interiorHoleRepair==='blouse-v1'?1:0}};
    const material=new RawShaderMaterial({vertexShader,fragmentShader,uniforms,depthTest:false,depthWrite:false,
      toneMapped:false,blending:NoBlending});
    const mesh=new Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
    let texture=null;
    return {
      draw(video,width,height){
        if(video.readyState<2)return;
        if(texture?.image!==video){
          texture?.dispose();
          texture=new VideoTexture(video);
          texture.flipY=false;texture.colorSpace=NoColorSpace;
          texture.minFilter=texture.magFilter=LinearFilter;
          uniforms.frame.value=texture;
        }
        const fit=Math.min(width/manifest.width,height/manifest.height);
        uniforms.fit.value.set(manifest.width*fit/width,manifest.height*fit/height);
        uniforms.packedSize.value.set(video.videoWidth,video.videoHeight);
        texture.needsUpdate=true;
        renderer.render(scene,camera);
      },
      dispose(){texture?.dispose();geometry.dispose();material.dispose();}
    };
  });
}


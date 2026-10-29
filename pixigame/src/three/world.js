import * as T from 'three';
import { PERIPHERAL_SCENES, PERIPHERAL_LAYERS, FIVE_LAYER_SCENES, FIVE_LAYER_DEFINITIONS, peripheralSceneForStage, layerLateralOffset, layerScrollOffset } from './peripheral-scenes.js';

const vertexShader = `varying vec2 terrainUv;void main(){terrainUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
// The middle plane has a real transparent opening. Through it the distant
// floor remains visible and moves independently; there is no opaque map stack.
const fragmentShader = `
varying vec2 terrainUv;
uniform sampler2D artwork;uniform float hasArt;uniform float repeatY;uniform float scroll;
uniform float sourceWidth;uniform vec2 opening;uniform float opacity;uniform float completeScene;
uniform vec3 base;uniform vec3 edge;uniform vec3 accent;uniform vec3 mist;uniform vec3 chapterTint;uniform vec3 layerTint;
// Overlap only the narrow ends of directional strips. Both samples keep their
// authored orientation, while premultiplied interpolation preserves cutout edges.
vec4 sampleArtwork(vec2 uv){
  #if DIRECTIONAL_SEAM == 1
    const float overlap=.045;
    vec2 gradientX=dFdx(uv)*vec2(1.,1.-overlap);
    vec2 gradientY=dFdy(uv)*vec2(1.,1.-overlap);
    float y=fract(uv.y)*(1.-overlap);
    vec4 current=textureGrad(artwork,vec2(uv.x,y),gradientX,gradientY);
    if(y<overlap){
      vec4 previous=textureGrad(artwork,vec2(uv.x,y+1.-overlap),gradientX,gradientY);
      float blend=smoothstep(0.,overlap,y);
      vec4 color=mix(vec4(previous.rgb*previous.a,previous.a),vec4(current.rgb*current.a,current.a),blend);
      current=vec4(color.rgb/max(color.a,.00001),color.a);
    }
    return current;
  #else
    return texture2D(artwork,uv);
  #endif
}
void main(){
  vec2 uv=vec2(.5+(terrainUv.x-.5)*sourceWidth,terrainUv.y*repeatY+scroll);
  float cloudDensity=1.;
  #if CLOUD_LAYER == 1
    // Empty tile ends allow per-strip variation without a visible seam.
    float cloudSeed=fract(sin(mod(floor(uv.y),2.)*127.1+31.7)*43758.5453);
    if(cloudSeed>.5)uv.x=1.-uv.x;
    cloudDensity=mix(.45,1.,cloudSeed);
  #endif
  vec4 picture=vec4(base,1.);
  if(hasArt>.5)picture=sampleArtwork(uv);
  picture.rgb*=chapterTint*layerTint;
  float border=abs(terrainUv.x-.5);
  float edgeMask=mix(smoothstep(opening.x,opening.y,border),1.,completeScene);
  #if LAYER_KIND == 0
    if(hasArt<.5){float ripple=sin(uv.y*48.+sin(uv.x*26.)*.7)*.5+.5;picture.rgb=mix(base,accent,ripple*.045);}
    // Haze lowers distant contrast without turning the floor into an empty slab.
    vec3 distant=mix(picture.rgb*.72,base,.16);
    gl_FragColor=vec4(mix(distant,mist,.035),1.);
  #elif LAYER_KIND == 1
    if(hasArt<.5){float islands=smoothstep(.15,.8,sin(uv.y*18.)*.5+.5);picture.rgb=mix(base,edge,islands);}
    // Preserve the painted vertical faces. Only the quiet inner bottom opens
    // onto the independently scrolling distant texture.
    gl_FragColor=vec4(picture.rgb*vec3(.82,.86,.9),edgeMask);
  #elif LAYER_KIND == 3
    #if EFFECT_STYLE > 0
    // Low contrast atmospheric flecks, never solid gameplay projectiles.
    vec2 cellUv=vec2(uv.x*12.,uv.y*24.);
    vec2 cell=floor(cellUv);
    float seed=fract(sin(dot(vec2(cell.x,mod(cell.y,48.)),vec2(127.1,311.7)))*43758.5453);
    vec2 center=vec2(.25+seed*.5,.25+fract(seed*7.3)*.5);
    float fleck=(1.-smoothstep(.02,.10,length(fract(cellUv)-center)))*step(.82,seed);
    float side=smoothstep(.10,.36,border);
    #if EFFECT_STYLE == 2
      gl_FragColor=vec4(vec3(.65,.25,.08),fleck*side*opacity);
    #elif EFFECT_STYLE == 3
      gl_FragColor=vec4(vec3(.45,.48,.7),fleck*opacity);
    #else
      gl_FragColor=vec4(mist,fleck*side*opacity);
    #endif
    #else
    // Optional chapter atmosphere, below gameplay. Quiet irregular water
    // highlights; never collision geometry, a warning ring, or a bright flash.
    float wave=sin(uv.y*81.681409+sin(uv.x*39.+uv.y*9.424778)*2.);
    float glint=smoothstep(.82,1.,wave);
    float ripplePatch=smoothstep(.15,.85,sin(uv.x*24.-uv.y*15.707963)*.5+.5);
    float water=1.-smoothstep(.18,.32,border);
    gl_FragColor=vec4(accent,glint*ripplePatch*water*opacity);
    #endif
  #else
    if(hasArt<.5){float clouds=pow(.5+.5*sin(uv.y*14.+sin(terrainUv.x*20.)*2.),4.);picture=vec4(mist,clouds*.4);}
    gl_FragColor=vec4(picture.rgb,picture.a*edgeMask*opacity);
  #endif
  #if CLOUD_LAYER == 1
    // Protect the central 60% even while native lateral parallax is active.
    gl_FragColor.a*=cloudDensity*smoothstep(.30,.43,border);
  #endif
  if(gl_FragColor.a<.002)discard;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createWorldEnvironment(scene, { shadowsEnabled = true, textureLoader = new T.TextureLoader(), renderer = null, preloadInitial = true, initialStage = 0, sceneIds = null, layerMotion = null } = {}) {
  const group = new T.Group();
  group.name = 'peripheral-chapter-world';
  scene.add(group);
  let disposed = false, elapsed = 0, lateral = 0, lastTime = null;
  let current = peripheralSceneForStage(initialStage);
  const textures = new Map();
  const status = new Map();
  // Upload one decoded chapter texture per idle turn, not a stack on the
  // first combat draw. Ordinary rendering remains the fallback if started early.
  const uploads = [];
  let uploadJob = null;
  const view = globalThis.window || globalThis;
  const idle = typeof view.requestIdleCallback === 'function';
  function scheduleUpload() {
    if (disposed || uploadJob !== null || !uploads.length || !renderer) return;
    const upload = () => {
      uploadJob = null;
      if (disposed) return;
      const texture = uploads.shift();
      try { renderer.initTexture(texture); }
      catch (error) { console.warn('章节纹理预上传失败，将在绘制时重试', error); }
      scheduleUpload();
    };
    uploadJob = idle ? view.requestIdleCallback(upload) : view.setTimeout(upload, 80);
  }
  const layers = [...PERIPHERAL_LAYERS, ...FIVE_LAYER_DEFINITIONS].map((definition, index) => {
    const kind = definition.kind ?? index;
    const material = new T.ShaderMaterial({
      defines: { DIRECTIONAL_SEAM: definition.source === 'ground' || definition.source === 'depth' ? 1 : 0, LAYER_KIND: kind, CLOUD_LAYER: definition.role === 'cloud' ? 1 : 0, EFFECT_STYLE: definition.effectStyle || 0 }, vertexShader, fragmentShader,
      uniforms: {
        artwork: { value: null }, hasArt: { value: 0 }, repeatY: { value: definition.length / (definition.width * 1.5) }, scroll: { value: 0 },
        sourceWidth: { value: definition.sourceWidth }, opening: { value: new T.Vector2(...(definition.opening || [0, 1])) }, opacity: { value: definition.opacity }, completeScene: { value: 0 },
        base: { value: new T.Color() }, edge: { value: new T.Color() }, accent: { value: new T.Color() }, mist: { value: new T.Color() }, layerTint: { value: new T.Color(definition.tint ?? 0xffffff) },
      },
      transparent: kind > 0, depthWrite: kind === 0, toneMapped: false,
    });
    const mesh = new T.Mesh(new T.PlaneGeometry(definition.width, definition.length).rotateX(-Math.PI / 2), material);
    mesh.name = `chapter-${definition.id}-layer`;
    mesh.position.set(300, definition.depth, 650);
    mesh.renderOrder = -1000 + index * 10;
    mesh.userData.layer = definition.id;
    group.add(mesh);
    return { definition, mesh, material };
  });
  const shadow = new T.Mesh(
    new T.PlaneGeometry(1100, 6000).rotateX(-Math.PI / 2),
    new T.ShadowMaterial({ color: 0x14283b, opacity: .035, depthWrite: false }),
  );
  shadow.name = 'chapter-aircraft-shadows';
  // A close shadow across the opening implies a flat runway. Receive it only
  // on the distant floor, with almost no contrast at this altitude.
  shadow.position.set(300, -999.8, 650);
  shadow.receiveShadow = true;
  shadow.visible = shadowsEnabled;
  shadow.renderOrder = -995;
  group.add(shadow);

  function syncLayers() {
    for (const { definition, mesh, material } of layers) {
      mesh.visible = FIVE_LAYER_SCENES[current.id] ? definition.sceneId === current.id : !definition.sceneId && (!current.singleLayer || definition.id === 'middle');
      if (!mesh.visible) continue;
      const key = `${current.textureId||current.id}/${definition.source}`;
      const texture = textures.get(key);
      const aspect = texture ? texture.image.height / texture.image.width : 1.5;
      const u = material.uniforms;
      if (mesh.userData.scene !== current || u.artwork.value !== (texture || null)) {
        u.completeScene.value = current.singleLayer || definition.fullAlpha ? 1 : 0;
        u.chapterTint ??= {value:new T.Color(0xffffff)};
        u.chapterTint.value.set(current.tint||0xffffff).lerp(white,current.tint ? .55 : 0);
        u.opacity.value = definition.source === 'foreground' ? (current.foregroundOpacity ?? definition.opacity) : definition.opacity;
        u.artwork.value = texture || null; u.hasArt.value = texture ? 1 : 0;
        u.repeatY.value = definition.length / (definition.width * aspect);
        for (const color of ['base', 'edge', 'accent', 'mist']) u[color].value.set(current[color === 'base' ? 'ground' : color]);
        mesh.userData.scene = current;
      }
      const motion = layerMotion?.(definition, elapsed, aspect);
      u.scroll.value = motion?.scroll ?? layerScrollOffset(definition, elapsed, aspect);
      mesh.position.x = 300 + (motion?.lateralOffset ?? layerLateralOffset(definition, lateral));
      Object.assign(mesh.userData.terrain ||= {}, { id: definition.id, role: definition.role, name: definition.name, depth: definition.depth, speed: definition.speed, scroll: u.scroll.value,
        x: mesh.position.x, source: key, status: texture ? 'ready' : status.get(key), opening: definition.opening || null });
    }
    Object.assign(group.userData.terrain ||= {}, {
      layers: layers.filter(layer => layer.mesh.visible).map(layer => layer.mesh.userData.terrain),
      id: current.id, name: current.name, status: status.get(`${current.textureId || current.id}/ground`), artUrl: current.artUrl,
      depthUrl: current.depthUrl, foregroundUrl: current.foregroundUrl, elapsed, lateral });
  }
  const white = new T.Color(0xffffff), sceneCache = new Map();
  function requestScene(definition) {
    if (sceneIds && !sceneIds.includes(definition.id)) return Promise.resolve();
    const id = definition.textureId || definition.id;
    if (sceneCache.has(id)) {
      const record = sceneCache.get(id); sceneCache.delete(id); sceneCache.set(id, record); return record.promise;
    }
    const record = {}; sceneCache.set(id, record);
    // Keep the active scene and two recently visited scenes. Late downloads
    // from an evicted chapter are disposed rather than reviving its GPU cache.
    while (sceneCache.size > 3) {
      const oldest = [...sceneCache.keys()].find(key => key !== id && key !== (current.textureId || current.id));
      sceneCache.delete(oldest);
      for (const type of ['depth', 'ground', 'foreground', 'islands', 'effects', 'cloud']) {
        const key = `${oldest}/${type}`, texture = textures.get(key);
        if (texture) { const at = uploads.indexOf(texture); if (at >= 0) uploads.splice(at, 1); texture.dispose(); textures.delete(key); }
        status.delete(key);
      }
    }
    const types = FIVE_LAYER_SCENES[definition.id] ? ['depth', 'ground', 'islands', 'effects', 'cloud'] : ['depth', 'ground', 'foreground'];
    record.promise = Promise.all(types.map(type => new Promise(resolve => {
    const key = `${id}/${type}`;
    status.set(key, 'loading');
    const url = type === 'depth' ? definition.depthUrl : type === 'ground' ? definition.artUrl : type === 'foreground' ? definition.foregroundUrl : FIVE_LAYER_SCENES[definition.id]?.urls[type];
    if (!url) { status.set(key, 'procedural'); resolve(); return; }
    textureLoader.load(url, texture => {
      if (disposed || sceneCache.get(id) !== record) { texture.dispose(); resolve(); return; }
      if (!texture.image?.width || !texture.image?.height) {
        status.set(key, 'fallback'); texture.dispose(); syncLayers(); resolve(); return;
      }
      texture.colorSpace = T.SRGBColorSpace;
      texture.wrapS = T.ClampToEdgeWrapping;
      // Banks, distant architecture and bridges share the painted camera direction.
      // A mirrored next tile reverses roofs, walls and support faces. Only the
      // directionless atmosphere layers may alternate vertically.
      const atmosphere = type === 'cloud' || type === 'foreground';
      texture.wrapT = atmosphere ? T.MirroredRepeatWrapping : T.RepeatWrapping;
      texture.anisotropy = 2;
      texture.needsUpdate = true;
      textures.set(key, texture); status.set(key, 'ready'); syncLayers(); resolve();
      if (renderer) {
        Promise.resolve().then(() => texture.image.decode?.()).catch(() => {}).then(() => {
          if (!disposed && textures.get(key) === texture) { uploads.push(texture); scheduleUpload(); }
        });
      }
    }, undefined, () => {
      if (!disposed && sceneCache.get(id) === record) { status.set(key, 'fallback'); syncLayers(); }
      resolve();
    });
    })));
    return record.promise;
  }

  function update(time, stage = 0, options = {}) {
    if (disposed) return;
    const nextTime = Number.isFinite(time) ? Math.max(0, time) : 0;
    const nextScene = peripheralSceneForStage(stage);
    if (nextTime === lastTime && nextScene.id === current.id) return;
    // Pausing freezes all three layers, including input-driven parallax. On a
    // new chapter or a new run, apply its initial lateral position immediately.
    if (nextTime !== lastTime || nextScene.id !== current.id) lateral = Number.isFinite(options.lateral) ? Math.max(-1, Math.min(1, options.lateral)) : 0;
    elapsed = nextTime; lastTime = nextTime; current = nextScene;
    requestScene(current);
    syncLayers();
  }
  if (preloadInitial) update(0, initialStage);
  else syncLayers();
  return {
    update,
    preload(stage) { return disposed ? Promise.resolve() : requestScene(peripheralSceneForStage(stage)); },
    setTextures() {},
    snapshot() { return structuredClone({ ...group.userData.terrain, loading: Object.fromEntries(status) }); },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (uploadJob !== null) {
        if (idle) view.cancelIdleCallback(uploadJob);
        else view.clearTimeout(uploadJob);
      }
      uploads.length = 0;
      group.removeFromParent();
      for (const layer of layers) { layer.mesh.geometry.dispose(); layer.material.dispose(); }
      shadow.geometry.dispose(); shadow.material.dispose();
      textures.forEach(texture => texture.dispose()); textures.clear();
      sceneCache.clear(); status.clear();
    },
  };
}

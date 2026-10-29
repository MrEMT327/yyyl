import * as THREE from 'three';
import { RESOURCE_ICONS, resourceIconType } from './resource-icons.js';

const resourceTextures=new Map();
function sharedResourceTexture(type){
  if(!resourceTextures.has(type)){
    const texture=new THREE.TextureLoader().load(RESOURCE_ICONS[type].url);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.generateMipmaps=false;
    texture.minFilter=THREE.LinearFilter;
    resourceTextures.set(type,texture);
  }
  return resourceTextures.get(type);
}

// Screen-space Three.js primitives. Canvas is used only to rasterize text;
// controls remain individual meshes with independent hit regions.
export function createThreeSurface({ documentRef = globalThis.document, textResolution = 2 } = {}) {
  // Group.renderOrder also changes Three's groupOrder sorting bucket. A plain
  // Object3D lets individual meshes keep painter order across nested overlays
  // and the existing lobby modals.
  const group = new THREE.Object3D();
  const textures = new Set();
  const controls = [];
  function material(color, opacity = 1, map = null) {
    return new THREE.MeshBasicMaterial({ color, opacity, map, transparent: true,
      depthTest: false, depthWrite: false, toneMapped: false,
      side: THREE.DoubleSide, forceSinglePass: true });
  }
  function quad(x, y, w, h, color = '#ffffff', opacity = 1, map = null) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material(color, opacity, map));
    mesh.position.set(x + w / 2, y + h / 2, 0);
    mesh.scale.set(w, -h, 1);
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  }
  function line(points, color = '#43627b', opacity = 1, width = 1) {
    const positions = [];
    for (let i = 1; i < points.length; i++) {
      const [x, y] = points[i - 1], [u, v] = points[i];
      const length = Math.hypot(u - x, v - y) || 1;
      const a = -(v - y) / length * width / 2, b = (u - x) / length * width / 2;
      positions.push(x+a,y+b,0,x-a,y-b,0,u+a,v+b,0, x-a,y-b,0,u-a,v-b,0,u+a,v+b,0);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mesh = new THREE.Mesh(geometry, material(color, opacity));
    group.add(mesh); return mesh;
  }
  function panel(x, y, w, h, { fill = '#091826', stroke = '#304a5c', opacity = .92, cut = 10, radius = 0, bottomColor = null } = {}) {
    const points = [[x+cut,y],[x+w,y],[x+w,y+h-cut],[x+w-cut,y+h],[x,y+h],[x,y+cut],[x+cut,y]];
    let shape = new THREE.Shape(points.map(p => new THREE.Vector2(...p)));
    if (radius) {
      const r = Math.min(radius,w/2,h/2); shape = new THREE.Shape();
      shape.moveTo(x+r,y); shape.lineTo(x+w-r,y); shape.quadraticCurveTo(x+w,y,x+w,y+r);
      shape.lineTo(x+w,y+h-r); shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
      shape.lineTo(x+r,y+h); shape.quadraticCurveTo(x,y+h,x,y+h-r);
      shape.lineTo(x,y+r); shape.quadraticCurveTo(x,y,x+r,y);
    }
    const geometry = new THREE.ShapeGeometry(shape);
    const mat = material(bottomColor ? '#ffffff' : fill, opacity);
    if (bottomColor) {
      const top = new THREE.Color(fill), bottom = new THREE.Color(bottomColor), shade = new THREE.Color();
      const positions = geometry.attributes.position, colors = [];
      for(let i=0;i<positions.count;i++) { shade.copy(top).lerp(bottom,(positions.getY(i)-y)/h); colors.push(shade.r,shade.g,shade.b); }
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3)); mat.vertexColors=true;
    }
    const mesh = new THREE.Mesh(geometry, mat);
    group.add(mesh);
    if (stroke) line(radius ? shape.getPoints(8).map(p=>[p.x,p.y]) : points, stroke, .8);
    return mesh;
  }
  function polygon(points, color, opacity = 1) {
    const shape = new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape),material(color,opacity)); group.add(mesh); return mesh;
  }
  function image(texture, x,y,w,h, crop = null) {
    const mesh = quad(x,y,w,h,'#ffffff',1,texture);
    if(crop) {
      const uv=mesh.geometry.attributes.uv;
      for(let i=0;i<uv.count;i++)uv.setXY(i,crop.x+uv.getX(i)*crop.width,1-crop.y-(1-uv.getY(i))*crop.height);
    }
    return mesh;
  }
  function resourceIcon(name,x,y,size=24){
    const type=resourceIconType(name), asset=RESOURCE_ICONS[type];
    if(!asset)return null;
    const width=size*asset.width/asset.height;
    return image(sharedResourceTexture(type),x+(size-width)/2,y,width,size);
  }

  function text(value, x, y, { size = 20, color = '#edf6fb', weight = 500, align = 'left', maxWidth = 560, tracking = 0 } = {}) {
    const canvas = documentRef?.createElement('canvas') || globalThis.wx?.createCanvas?.();
    const ctx = canvas.getContext('2d');
    const font = `${weight} ${size}px "Bahnschrift", "DIN Alternate", "Microsoft YaHei", sans-serif`;
    ctx.font = font;
    const naturalWidth = ctx.measureText(String(value)).width + Math.max(0, String(value).length - 1) * tracking;
    const width = Math.ceil(Math.min(maxWidth, naturalWidth) + 4), height = Math.ceil(size * 1.65);
    const resolution = textResolution;
    canvas.width = width * resolution; canvas.height = height * resolution;
    ctx.scale(resolution, resolution); ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'middle';
    if (tracking && naturalWidth <= maxWidth) {
      let cursor = 2;
      for (const char of String(value)) { ctx.fillText(char, cursor, height / 2); cursor += ctx.measureText(char).width + tracking; }
    } else ctx.fillText(String(value), 2, height / 2, maxWidth);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter; textures.add(texture);
    const mesh=quad(x - (align === 'center' ? width / 2 : align === 'right' ? width : 0), y - height / 2, width, height, '#ffffff', 1, texture);
    mesh.userData.uiText=String(value);
    return mesh;
  }
  function button(id, label, x, y, w, h, onPress, { disabled = false, ...style } = {}) {
    const mesh = panel(x, y, w, h, style);
    const control = { id, label, x, y, width: w, height: h, disabled, onPress, mesh };
    controls.push(control); return control;
  }
  function clear() {
    group.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
    group.clear(); textures.forEach(t => t.dispose()); textures.clear(); controls.length = 0;
  }
  return { group, controls, quad, panel, polygon, image, resourceIcon, line, text, button, clear, destroy: clear };
}

export function createSurfaceInput(controls) {
  let press = null;
  const hit = (x, y) => [...controls].reverse().find(c => !c.disabled && x >= c.x && y >= c.y && x <= c.x+c.width && y <= c.y+c.height);
  const restore = () => {
    if (press) {
      const material = press.control.mesh.material;
      material.opacity = material.userData.baseOpacity = press.opacity;
    }
    press = null;
  };
  return {
    hit,
    cancel: restore,
    handle({ x, y, phase, pointerId = 1 }) {
      if (phase === 'start') {
        if (press) return true;
        const control = hit(x, y);
        if (control) {
          const material = control.mesh.material;
          press = { control, x, y, pointerId, dragged: false, opacity: material.userData.baseOpacity ?? material.opacity };
          material.opacity = material.userData.baseOpacity = press.opacity * .64;
        }
        return true;
      }
      if (!press || press.pointerId !== pointerId) return true;
      if (Math.hypot(x - press.x, y - press.y) > 12) press.dragged = true;
      if (phase === 'end' || phase === 'cancel') {
        const control = press.control;
        const activate = phase === 'end' && !press.dragged && hit(x,y) === control;
        restore();
        if (activate) control.onPress?.();
      }
      return true;
    },
  };
}

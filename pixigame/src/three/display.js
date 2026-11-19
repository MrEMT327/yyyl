import * as THREE from "three";
import { createFrameLoop } from '../frame-loop.js';
import { FlatBatcher } from "./flat-batcher.js";
import { NativeBatcher } from "./native-batcher.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { CombatBloomPass } from './combat-bloom-pass.js';
import { combatBloomSize, createCombatBloomComposite } from "./combat-bloom.js";
import {
  createBattleCamera,
  battleToScreen,
  screenToBattle,
} from "./battle-camera.js";
import { loadYoga } from "yoga-layout/load";

// Project-owned display tree. All drawing is performed by Three.js; these
// small primitives keep gameplay and UI independent of a rendering library.
let nextId = 1;
let revision = 0;
let yoga;
let yogaPromise;
export async function initializeDisplay() {
  yoga ||= await (yogaPromise ||= loadYoga());
}
export class Point {
  constructor(x = 0, y = x) {
    this.set(x, y);
  }
  set(x = 0, y = x) {
    this.x = x;
    this.y = y;
    return this;
  }
  copyFrom(p) {
    return this.set(p.x, p.y);
  }
  clone() {
    return new Point(this.x, this.y);
  }
}
export class Rectangle {
  constructor(x = 0, y = 0, width = 0, height = 0) {
    Object.assign(this, { x, y, width, height });
  }
  contains(x, y) {
    return (
      x >= this.x &&
      y >= this.y &&
      x <= this.x + this.width &&
      y <= this.y + this.height
    );
  }
  get minX() {
    return this.x;
  }
  get minY() {
    return this.y;
  }
  get maxX() {
    return this.x + this.width;
  }
  get maxY() {
    return this.y + this.height;
  }
}
export class Container {
  constructor(options = {}) {
    this.uid = nextId++;
    this.children = [];
    this.parent = null;
    this.position = new Point();
    this.scale = new Point(1);
    // Opt in for uniformly scaled 3D content; flat UI keeps independent depth.
    this.scaleDepth = false;
    this.pivot = new Point();
    this.skew = new Point();
    this.rotation = 0;
    this.alpha = 1;
    this.tint = 0xffffff;
    this.visible = true;
    this.renderable = true;
    this.eventMode = "auto";
    this.interactiveChildren = true;
    this.zIndex = 0;
    this.destroyed = false;
    this._events = new Map();
    this.object3D = new THREE.Group();
    this.object3D.userData.display = this;
    Object.assign(this, options);
  }
  get x() {
    return this.position.x;
  }
  set x(v) {
    this.position.x = v;
  }
  get y() {
    return this.position.y;
  }
  set y(v) {
    this.position.y = v;
  }
  get angle() {
    return (this.rotation * 180) / Math.PI;
  }
  set angle(v) {
    this.rotation = (v * Math.PI) / 180;
  }
  get layout() {
    return this._layout;
  }
  set layout(value) {
    this._layout = value ? { ...value } : null;
    revision++;
  }
  get width() {
    return this.getLocalBounds().width * Math.abs(this.scale.x);
  }
  set width(v) {
    this.scale.x = v / (this.getLocalBounds().width || 1);
  }
  get height() {
    return this.getLocalBounds().height * Math.abs(this.scale.y);
  }
  set height(v) {
    this.scale.y = v / (this.getLocalBounds().height || 1);
  }
  get worldVisible() {
    return this.visible && (!this.parent || this.parent.worldVisible);
  }
  get worldAlpha() {
    return this.alpha * (this.parent?.worldAlpha ?? 1);
  }
  addChild(...nodes) {
    for (const n of nodes.filter(Boolean)) {
      n.removeFromParent();
      this.children.push(n);
      n.parent = this;
      this.object3D.add(n.object3D);
    }
    revision++;
    return nodes[0];
  }
  addChildAt(n, i) {
    this.addChild(n);
    this.children.splice(this.children.indexOf(n), 1);
    this.children.splice(i, 0, n);
    return n;
  }
  getChildIndex(n) {
    return this.children.indexOf(n);
  }
  setChildIndex(n, i) {
    this.children.splice(this.children.indexOf(n), 1);
    this.children.splice(i, 0, n);
  }
  getChildByLabel(label, deep = false) {
    for (const n of this.children) {
      if (n.label === label) return n;
      if (deep) {
        const r = n.getChildByLabel(label, true);
        if (r) return r;
      }
    }
    return null;
  }
  removeChild(...nodes) {
    for (const n of nodes) {
      const i = this.children.indexOf(n);
      if (i < 0) continue;
      this.children.splice(i, 1);
      this.object3D.remove(n.object3D);
      n.parent = null;
    }
    revision++;
    return nodes[0];
  }
  removeChildren(begin = 0, end = this.children.length) {
    const nodes = this.children.slice(begin, end);
    this.removeChild(...nodes);
    return nodes;
  }
  removeFromParent() {
    this.parent?.removeChild(this);
    return this;
  }
  on(name, fn, context) {
    if (!this._events.has(name)) this._events.set(name, []);
    this._events.get(name).push({ fn, context });
    return this;
  }
  once(name, fn) {
    const cb = (...args) => {
      this.off(name, cb);
      fn(...args);
    };
    return this.on(name, cb);
  }
  off(name, fn) {
    this._events.set(
      name,
      (this._events.get(name) || []).filter((e) => e.fn !== fn),
    );
    return this;
  }
  emit(name, ...args) {
    for (const e of this._events.get(name) || [])
      e.fn.apply(e.context || this, args);
    return this;
  }
  removeAllListeners() {
    this._events.clear();
  }
  _matrix() {
    const c = Math.cos(this.rotation),
      s = Math.sin(this.rotation),
      sx = this.scale.x,
      sy = this.scale.y;
    const a = c * sx,
      b = s * sx,
      cc = -s * sy,
      d = c * sy;
    return [
      a,
      b,
      cc,
      d,
      this.x - this.pivot.x * a - this.pivot.y * cc,
      this.y - this.pivot.x * b - this.pivot.y * d,
    ];
  }
  toGlobal(p = new Point()) {
    const m = this._matrix();
    const out = new Point(
      m[0] * p.x + m[2] * p.y + m[4],
      m[1] * p.x + m[3] * p.y + m[5],
    );
    return this.parent ? this.parent.toGlobal(out) : out;
  }
  toLocal(p, from = null) {
    if (from) p = from.toGlobal(p);
    if (this.parent) p = this.parent.toLocal(p);
    const [a, b, c, d, x, y] = this._matrix(),
      det = a * d - b * c || 1e-12;
    return new Point(
      (d * (p.x - x) - c * (p.y - y)) / det,
      (-b * (p.x - x) + a * (p.y - y)) / det,
    );
  }
  getGlobalPosition(out = new Point()) {
    return out.copyFrom(this.toGlobal(new Point()));
  }
  getLocalBounds() {
    this._prepare?.();
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const include = (x, y) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };
    if (this._bounds) {
      const b = this._bounds;
      include(b.x, b.y);
      include(b.x + b.width, b.y + b.height);
    }
    for (const n of this.children) {
      if (!n.visible) continue;
      const b = n.getLocalBounds(),
        m = n._matrix();
      for (const [x, y] of [
        [b.x, b.y],
        [b.x + b.width, b.y],
        [b.x, b.y + b.height],
        [b.x + b.width, b.y + b.height],
      ])
        include(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]);
    }
    return minX === Infinity
      ? new Rectangle()
      : new Rectangle(minX, minY, maxX - minX, maxY - minY);
  }
  getBounds() {
    const b = this.getLocalBounds(),
      points = [
        [b.x, b.y],
        [b.x + b.width, b.y],
        [b.x, b.y + b.height],
        [b.x + b.width, b.y + b.height],
      ].map(([x, y]) => this.toGlobal(new Point(x, y)));
    const xs = points.map((p) => p.x),
      ys = points.map((p) => p.y);
    return new Rectangle(
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    );
  }
  destroy(options = {}) {
    if (this.destroyed) return;
    this.removeFromParent();
    for (const n of this.removeChildren())
      if (options === true || options.children) n.destroy(options);
    this._disposeVisuals?.();
    this.removeAllListeners();
    this.destroyed = true;
  }
}

const numericColor = (v) =>
  typeof v === "number"
    ? v
    : Number.parseInt(String(v || "ffffff").replace("#", ""), 16);
export class ImageSource {
  constructor(options = {}) {
    Object.assign(this, options);
    this.width ||= this.resource?.width || 1;
    this.height ||= this.resource?.height || 1;
    this._texture = new THREE.Texture(this.resource);
    this._texture.colorSpace = THREE.SRGBColorSpace;
    this._texture.generateMipmaps = false;
    this._texture.minFilter = THREE.LinearFilter;
    this._texture.needsUpdate = !!this.resource;
  }
  update() {
    this._texture.needsUpdate = true;
  }
  destroy() {
    this._texture.dispose();
  }
}
export class Texture {
  constructor({ source, frame } = {}) {
    this.source = source || new ImageSource();
    this.frame =
      frame || new Rectangle(0, 0, this.source.width, this.source.height);
    this.width = this.frame.width;
    this.height = this.frame.height;
  }
  static from(image) {
    return new Texture({ source: new ImageSource({ resource: image }) });
  }
  destroy(source = false) {
    if (source) this.source.destroy();
  }
}
Texture.EMPTY = new Texture();
Texture.WHITE = Texture.EMPTY;
// These display primitives are flat. Render both windings in one pass;
// separate transparent front/back passes only duplicate draw submissions.
const quad = new THREE.PlaneGeometry(1, 1);
export class Sprite extends Container {
  constructor(options = Texture.EMPTY) {
    super();
    this.anchor = new Point();
    this.texture =
      options instanceof Texture ? options : options.texture || Texture.EMPTY;
  }
  static from(source) {
    return new Sprite(
      source instanceof Texture ? source : Texture.from(source),
    );
  }
  _prepare() {
    const t = this.texture || Texture.EMPTY,
      f = t.frame,
      key = [t.source._texture.uuid, f.x, f.y, f.width, f.height].join(":");
    if (this._key !== key) {
      this._disposeVisuals();
      const geo = quad.clone(),
        uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++)
        uv.setXY(
          i,
          (f.x + uv.getX(i) * f.width) / t.source.width,
          1 - (f.y + (1 - uv.getY(i)) * f.height) / t.source.height,
        );
      const mat = new THREE.MeshBasicMaterial({
        map: t === Texture.EMPTY ? null : t.source._texture,
        toneMapped: false,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide, forceSinglePass: true,
      });
      this._mesh = new THREE.Mesh(geo, mat);
      this._mesh.frustumCulled = false;
      this.object3D.add(this._mesh);
      this._key = key;
    }
    this._mesh.position.set(
      (0.5 - this.anchor.x) * t.width,
      (0.5 - this.anchor.y) * t.height,
      0,
    );
    this._mesh.scale.set(t.width, -t.height, 1);
    this._bounds = new Rectangle(
      -this.anchor.x * t.width,
      -this.anchor.y * t.height,
      t.width,
      t.height,
    );
  }
  _disposeVisuals() {
    if (this._mesh) {
      this.object3D.remove(this._mesh);
      this._mesh.geometry.dispose();
      this._mesh.material.dispose();
      this._mesh = null;
    }
  }
}

// Atlas quads that share one texture and tint can be submitted as one draw.
// Used by native bitmap text; layout coordinates and glyph UVs stay unchanged.
export class SpriteBatch extends Container {
  constructor(source) {
    super();
    this.source = source;
    this._quads = [];
    this._batchDirty = true;
  }
  setQuads(quads) {
    this._quads = quads;
    this._batchDirty = true;
  }
  _prepare() {
    if (!this._batchDirty) return;
    this._batchDirty = false;
    const count = this._quads.length * 6;
    let mesh = this._mesh;
    if (count && !mesh) {
      mesh = this._mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
        map: this.source._texture, toneMapped: false, transparent: true,
        depthTest: false, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
      }));
      mesh.frustumCulled = false;
      this.object3D.add(mesh);
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (mesh) {
      let geo = mesh.geometry;
      if (count > (geo.attributes.position?.count || 0)) {
        geo.dispose();
        geo = mesh.geometry = new THREE.BufferGeometry();
        const capacity = Math.max(64, 2 ** Math.ceil(Math.log2(count)));
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(capacity * 2), 2).setUsage(THREE.DynamicDrawUsage));
      }
      let vertex = 0;
      for (const q of this._quads) {
        const {x, y, width, height, frame} = q;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width); maxY = Math.max(maxY, y + height);
        const left = frame.x / this.source.width, right = (frame.x + frame.width) / this.source.width;
        const top = 1 - frame.y / this.source.height, bottom = 1 - (frame.y + frame.height) / this.source.height;
        for (const [dx, dy] of [[0,0],[0,1],[1,0],[0,1],[1,1],[1,0]]) {
          geo.attributes.position.setXYZ(vertex, x + dx * width, y + dy * height, 0);
          geo.attributes.uv.setXY(vertex, dx ? right : left, dy ? bottom : top);
          vertex++;
        }
      }
      if (count) for (const name of ['position', 'uv']) {
        const attribute = geo.attributes[name];
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, count * attribute.itemSize);
        attribute.needsUpdate = true;
      }
      geo.setDrawRange(0, count);
      mesh.visible = count > 0;
    }
    this._bounds = minX === Infinity ? new Rectangle() : new Rectangle(minX, minY, maxX-minX, maxY-minY);
  }
  _disposeVisuals() {
    if (this._mesh) {
      this.object3D.remove(this._mesh);
      this._mesh.geometry.dispose();
      this._mesh.material.dispose();
      this._mesh = null;
    }
    this._batchDirty = true;
  }
}

export class Text extends Sprite {
  constructor(options = {}) {
    super();
    if (typeof options === "string") options = { text: options };
    if (globalThis.__THREE_TEXT_FACTORY__)
      return globalThis.__THREE_TEXT_FACTORY__(options);
    this._text = String(options.text ?? "");
    this.style = options.style || {};
    this.resolution = options.resolution || 2;
  }
  get text() {
    return this._text;
  }
  set text(v) {
    const n = String(v ?? "");
    if (n !== this._text) {
      this._text = n;
      revision++;
    }
  }
  _prepare() {
    const s = this.style,
      key = JSON.stringify([this._text, s, this.resolution]);
    if (this._textKey !== key) {
      const canvas =
        globalThis.wx?.createCanvas?.() ||
        globalThis.document?.createElement("canvas");
      if (!canvas) {
        this._bounds = new Rectangle(
          0,
          0,
          this._text.length * (s.fontSize || 24),
          s.fontSize || 24,
        );
        return;
      }
      const ctx = canvas.getContext("2d"),
        size = Number(s.fontSize) || 24,
        lineHeight = s.lineHeight || size * 1.25;
      const font = `${s.fontWeight || "normal"} ${size}px ${s.fontFamily || "sans-serif"}`;
      ctx.font = font;
      const lines = [];
      for (const source of this._text.split("\n")) {
        let line = "";
        for (const char of source) {
          if (
            s.wordWrap &&
            line &&
            ctx.measureText(line + char).width > s.wordWrapWidth
          ) {
            lines.push(line);
            line = "";
          }
          line += char;
        }
        lines.push(line);
      }
      const width = Math.max(
          1,
          ...lines.map(
            (l) =>
              ctx.measureText(l).width +
              Math.max(0, l.length - 1) * (s.letterSpacing || 0),
          ),
        ),
        height = Math.max(size, lines.length * lineHeight);
      const res = this.resolution;
      canvas.width = Math.ceil((width + 4) * res);
      canvas.height = Math.ceil((height + 4) * res);
      ctx.scale(res, res);
      ctx.font = font;
      ctx.textBaseline = "top";
      ctx.fillStyle =
        "#" +
        numericColor(s.fill ?? 0xffffff)
          .toString(16)
          .padStart(6, "0");
      lines.forEach((l, i) => {
        let x =
          s.align === "center"
            ? (width - ctx.measureText(l).width) / 2
            : s.align === "right"
              ? width - ctx.measureText(l).width
              : 0;
        if (s.letterSpacing) {
          for (const char of l) {
            ctx.fillText(char, x + 2, i * lineHeight + 2);
            x += ctx.measureText(char).width + s.letterSpacing;
          }
        } else ctx.fillText(l, x + 2, i * lineHeight + 2);
      });
      if (this.texture !== Texture.EMPTY) this.texture?.source?.destroy?.();
      this.texture = Texture.from(canvas);
      this.texture.width = width + 4;
      this.texture.height = height + 4;
      this._textKey = key;
    }
    super._prepare();
  }
  _disposeVisuals() {
    super._disposeVisuals();
  }
  destroy(o) {
    if (this.texture !== Texture.EMPTY) this.texture.source.destroy();
    super.destroy(o);
  }
}

// Paint commands own immutable path snapshots. Compare values only after edits;
// unchanged static graphics never serialize or rebuild their geometry.
function samePaintCommands(a, b) {
  if (!b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x.kind !== y.kind || x.style.color !== y.style.color
      || x.style.alpha !== y.style.alpha || x.style.width !== y.style.width
      || x.paths.length !== y.paths.length) return false;
    for (let j = 0; j < x.paths.length; j++) {
      if (x.paths[j].length !== y.paths[j].length) return false;
      for (let k = 0; k < x.paths[j].length; k++) {
        if (x.paths[j][k][0] !== y.paths[j][k][0]
          || x.paths[j][k][1] !== y.paths[j][k][1]) return false;
      }
    }
  }
  return true;
}

export class Graphics extends Container {
  constructor() {
    super();
    this.isFlatGraphics = true;
    this._commands = [];
    this._paths = [];
    this._active = null;
    this._lastPaths = [];
    this._meshes = [];
    this._paintDirty = true;
  }
  clear() {
    this._paintDirty = true;
    this._commands = [];
    this._paths = [];
    this._active = null;
    this._lastPaths = [];
    return this;
  }
  _path(path) {
    this._paths.push(path);
    this._active = path;
    return this;
  }
  rect(x, y, w, h) {
    return this._path([
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x, y],
    ]);
  }
  roundRect(x, y, w, h, r = 0) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    const p = [];
    for (const [cx, cy, start] of [
      [x + w - r, y + r, -Math.PI / 2],
      [x + w - r, y + h - r, 0],
      [x + r, y + h - r, Math.PI / 2],
      [x + r, y + r, Math.PI],
    ])
      for (let i = 0; i <= 5; i++) {
        const a = start + (i * Math.PI) / 10;
        p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    p.push(p[0]);
    return this._path(p);
  }
  circle(x, y, r) {
    return this.ellipse(x, y, r, r);
  }
  star(x, y, points, radius, inner = radius / 2, rotation = -Math.PI / 2) {
    const p = [];
    for (let i = 0; i < points * 2; i++) {
      const a = rotation + (i * Math.PI) / points,
        r = i % 2 ? inner : radius;
      p.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    return this.poly(p);
  }
  ellipse(x, y, rx, ry) {
    const p = [];
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      p.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]);
    }
    return this._path(p);
  }
  poly(points, close = true) {
    const p =
      typeof points[0] === "number"
        ? Array.from({ length: points.length / 2 }, (_, i) => [
            points[i * 2],
            points[i * 2 + 1],
          ])
        : points.map((p) => (Array.isArray(p) ? p : [p.x, p.y]));
    if (close && p.length) p.push(p[0]);
    return this._path(p);
  }
  moveTo(x, y) {
    return this._path([[x, y]]);
  }
  lineTo(x, y) {
    if (!this._active) this.moveTo(0, 0);
    this._active.push([x, y]);
    return this;
  }
  closePath() {
    if (this._active?.length) this._active.push(this._active[0]);
    return this;
  }
  quadraticCurveTo(cx, cy, x, y) {
    const p = this._active?.at(-1) || [0, 0];
    for (let i = 1; i <= 12; i++) {
      const t = i / 12,
        u = 1 - t;
      this.lineTo(
        u * u * p[0] + 2 * u * t * cx + t * t * x,
        u * u * p[1] + 2 * u * t * cy + t * t * y,
      );
    }
    return this;
  }
  bezierCurveTo(a, b, c, d, x, y) {
    const p = this._active?.at(-1) || [0, 0];
    for (let i = 1; i <= 16; i++) {
      const t = i / 16,
        u = 1 - t;
      this.lineTo(
        u ** 3 * p[0] + 3 * u * u * t * a + 3 * u * t * t * c + t ** 3 * x,
        u ** 3 * p[1] + 3 * u * u * t * b + 3 * u * t * t * d + t ** 3 * y,
      );
    }
    return this;
  }
  arc(x, y, r, start, end, ccw = false) {
    if (!this._active) this.moveTo(x + r * Math.cos(start), y + r * Math.sin(start));
    let delta = end - start;
    if (ccw && delta > 0) delta -= Math.PI * 2;
    if (!ccw && delta < 0) delta += Math.PI * 2;
    const count = Math.max(2, Math.ceil(Math.abs(delta) * 10));
    for (let i = 0; i <= count; i++) {
      const a = start + (delta * i) / count;
      this.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
    }
    return this;
  }
  fill(style = 0xffffff) {
    return this._paint("fill", style);
  }
  stroke(style = 0xffffff) {
    return this._paint("stroke", style);
  }
  _paint(kind, style) {
    this._paintDirty = true;
    const paths = this._paths.length ? this._paths : this._lastPaths;
    this._commands.push({
      kind,
      style:
        typeof style === "number" || typeof style === "string"
          ? { color: numericColor(style) }
          : { ...style },
      paths: paths.map((p) => p.map((v) => [...v])),
    });
    this._lastPaths = paths;
    this._paths = [];
    this._active = null;
    return this;
  }
  _prepare() {
    if (!this._paintDirty) return;
    this._paintDirty = false;
    if (samePaintCommands(this._commands, this._preparedCommands)) return;
    this._preparedCommands = this._commands.slice();
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    // One draw per Graphics, preserving paint order and per-vertex alpha.
    const positions = [],
      colors = [];
    for (const cmd of this._commands) {
      const vertices = [];
      for (const path of cmd.paths) {
        for (const [x, y] of path) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
        if (cmd.kind === "fill" && path.length >= 3) {
          const contour = path.map(([x, y]) => new THREE.Vector2(x, y));
          if (contour[0].equals(contour.at(-1))) contour.pop();
          for (const tri of THREE.ShapeUtils.triangulateShape(contour, []))
            for (const i of tri) vertices.push(contour[i].x, contour[i].y, 0);
        } else if (cmd.kind === "stroke") {
          const width = (cmd.style.width ?? 1) / 2;
          for (let i = 1; i < path.length; i++) {
            const [a, b] = path[i - 1],
              [c, d] = path[i],
              len = Math.hypot(c - a, d - b) || 1,
              nx = (-(d - b) / len) * width,
              ny = ((c - a) / len) * width;
            vertices.push(
              a + nx,
              b + ny,
              0,
              a - nx,
              b - ny,
              0,
              c + nx,
              d + ny,
              0,
              c + nx,
              d + ny,
              0,
              a - nx,
              b - ny,
              0,
              c - nx,
              d - ny,
              0,
            );
          }
        }
      }
      if (!vertices.length) continue;
      const color = new THREE.Color(cmd.style.color ?? 0xffffff);
      positions.push(...vertices);
      for (let i = 0; i < vertices.length / 3; i++)
        colors.push(color.r, color.g, color.b, cmd.style.alpha ?? 1);
    }
    const count = positions.length / 3;
    let mesh = this._meshes[0];
    if (count && !mesh) {
      mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
        vertexColors: true, toneMapped: false, transparent: true,
        depthTest: false, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
      }));
      mesh.frustumCulled = false;
      this.object3D.add(mesh);
      this._meshes.push(mesh);
    }
    if (mesh) {
      let geo = mesh.geometry;
      if (count > (geo.attributes.position?.count || 0)) {
        // Geometric growth amortizes buffer allocations. Keep the Mesh and
        // material stable, and explicitly release old GPU buffers on growth.
        const capacity = Math.max(64, 2 ** Math.ceil(Math.log2(count)));
        geo.dispose();
        geo = mesh.geometry = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage));
      }
      if (count) {
        for (const [name, values] of [['position', positions], ['color', colors]]) {
          const attribute = geo.attributes[name];
          attribute.array.set(values);
          attribute.clearUpdateRanges();
          attribute.addUpdateRange(0, values.length);
          attribute.needsUpdate = true;
        }
      }
      geo.setDrawRange(0, count);
      mesh.visible = count > 0;
    }
    this._bounds =
      minX === Infinity
        ? new Rectangle()
        : new Rectangle(minX, minY, maxX - minX, maxY - minY);
  }
  _disposeVisuals() {
    for (const m of this._meshes) {
      this.object3D.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    this._meshes = [];
    this._preparedCommands = null;
    this._paintDirty = true;
  }
}

const identityColor = () => [
  1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
];
export function composeColor(after, before) {
  const out = Array(20).fill(0);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 5; c++) {
      for (let k = 0; k < 4; k++)
        out[r * 5 + c] += after[r * 5 + k] * before[k * 5 + c];
      if (c === 4) out[r * 5 + c] += after[r * 5 + 4];
    }
  return out;
}
export class ColorMatrixFilter {
  constructor() {
    this.matrix = identityColor();
  }
  _apply(m, multiply) {
    this.matrix = multiply ? composeColor(m, this.matrix) : m;
    return this;
  }
  brightness(v, multiply = false) {
    const m = identityColor();
    m[0] = m[6] = m[12] = v;
    return this._apply(m, multiply);
  }
  contrast(v, multiply = false) {
    const m = identityColor();
    m[0] = m[6] = m[12] = 1 + v;
    m[4] = m[9] = m[14] = -v / 2;
    return this._apply(m, multiply);
  }
  saturate(v, multiply = false) {
    const m = identityColor(),
      l = [0.2126, 0.7152, 0.0722];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        m[r * 5 + c] = -v * l[c] + (r === c ? 1 + v : 0);
    return this._apply(m, multiply);
  }
}
function materialColorTransform(mat, filters) {
  if (mat.isShaderMaterial) {
    if (mat.uniforms.uOpacity && !mat.userData.preserveShaderOpacity) mat.uniforms.uOpacity.value = mat.opacity;
    return;
  }
  if (!filters.length && !mat.userData.colorTransform) return;
  let uniforms = mat.userData.colorTransform;
  if (!uniforms) {
    uniforms = {
      displayColorMatrix: { value: new THREE.Matrix4() },
      displayColorOffset: { value: new THREE.Vector4() },
    };
    mat.userData.colorTransform = uniforms;
    const originalCompile = mat.onBeforeCompile;
    const originalCacheKey = mat.customProgramCacheKey();
    mat.onBeforeCompile = (shader) => {
      originalCompile.call(mat, shader);
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader =
        "uniform mat4 displayColorMatrix;\nuniform vec4 displayColorOffset;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          "#include <color_fragment>\ndiffuseColor = clamp(displayColorMatrix * diffuseColor + displayColorOffset, 0.0, 1.0);",
        );
    };
    mat.customProgramCacheKey = () => `${originalCacheKey}:display-color-transform-v1`;
    mat.needsUpdate = true;
  }
  const m = filters.reduce(
    (value, f) => composeColor(f.matrix, value),
    identityColor(),
  );
  uniforms.displayColorMatrix.value.set(
    m[0],
    m[1],
    m[2],
    m[3],
    m[5],
    m[6],
    m[7],
    m[8],
    m[10],
    m[11],
    m[12],
    m[13],
    m[15],
    m[16],
    m[17],
    m[18],
  );
  uniforms.displayColorOffset.value.set(m[4], m[9], m[14], m[19]);
}
export class Ticker {
  constructor({ documentRef = globalThis.document } = {}) {
    this._listeners = [];
    this.started = false;
    this.deltaMS = 16.667;
    this.deltaTime = 1;
    this.lastTime = 0;
    this._frames = createFrameLoop(t => this.update(t), { documentRef, onResume: () => { this.lastTime = 0; } });
  }
  add(fn, context, priority = 0) {
    this._listeners = [...this._listeners, { fn, context, priority }].sort((a, b) => b.priority - a.priority);
    return this;
  }
  remove(fn) {
    this._listeners = this._listeners.filter((e) => e.fn !== fn);
    return this;
  }
  update(t = performance.now()) {
    this.deltaMS = this.lastTime ? Math.max(0, t - this.lastTime) : 16.667;
    this.deltaTime = this.deltaMS / 16.667;
    this.lastTime = t;
    for (const e of this._listeners) e.fn.call(e.context, this);
  }
  start() {
    if (this.started) return;
    this.started = true;
    this.lastTime = 0;
    this._frames.start();
  }
  stop() {
    this.started = false;
    this._frames.stop();
  }
  destroy() {
    this.stop();
    this._frames.destroy();
    this._listeners = [];
  }
}

const enumName = (value) => String(value).replace(/-/g, "_").toUpperCase();
function applyLayoutStyle(node, style) {
  node.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN);
  // Legacy UI uses CSS/Pixi flex defaults. Yoga's native default of zero
  // prevents a 100%-height page from shrinking between the header and tabs.
  node.setFlexShrink(1);
  for (const [key, value] of Object.entries(style)) {
    if (value == null) continue;
    let fn = "set" + key[0].toUpperCase() + key.slice(1);
    if (
      [
        "flexDirection",
        "justifyContent",
        "alignItems",
        "alignSelf",
        "alignContent",
        "flexWrap",
        "position",
        "display",
        "overflow",
      ].includes(key)
    ) {
      const prefix = {
        flexDirection: "FLEX_DIRECTION",
        justifyContent: "JUSTIFY",
        alignItems: "ALIGN",
        alignSelf: "ALIGN",
        alignContent: "ALIGN",
        flexWrap: "WRAP",
        position: "POSITION_TYPE",
        display: "DISPLAY",
        overflow: "OVERFLOW",
      }[key];
      fn = key === "position" ? "setPositionType" : fn;
      node[fn]?.(yoga[prefix + "_" + enumName(value)]);
      continue;
    }
    const edge = key.match(
      /^(padding|margin)(Top|Right|Bottom|Left|Horizontal|Vertical)?$/,
    );
    if (edge) {
      const e = yoga["EDGE_" + (edge[2]?.toUpperCase() || "ALL")];
      node["set" + edge[1][0].toUpperCase() + edge[1].slice(1)](e, value);
      continue;
    }
    if (["top", "left", "right", "bottom"].includes(key)) {
      node.setPosition(yoga["EDGE_" + key.toUpperCase()], value);
      continue;
    }
    if (["gap", "rowGap", "columnGap"].includes(key)) {
      node.setGap(
        yoga[
          "GUTTER_" +
            (key === "rowGap" ? "ROW" : key === "columnGap" ? "COLUMN" : "ALL")
        ],
        value,
      );
      continue;
    }
    if (
      typeof node[fn] === "function" &&
      [
        "width",
        "height",
        "minWidth",
        "minHeight",
        "maxWidth",
        "maxHeight",
        "flexGrow",
        "flexShrink",
        "flexBasis",
        "aspectRatio",
      ].includes(key)
    )
      node[fn](value);
  }
}
export function layoutTree(root) {
  if (!yoga) return;
  const walk = (n) => {
    if (!n.visible) return;
    if (n.layout) {
      build(n);
      return;
    }
    for (const c of n.children) walk(c);
  };
  const build = (root) => {
    const pairs = [];
    const make = (n) => {
      const yn = yoga.Node.create();
      applyLayoutStyle(yn, n.layout);
      pairs.push([n, yn]);
      for (const c of n.children)
        if (c.layout && c.visible) yn.insertChild(make(c), yn.getChildCount());
      return yn;
    };
    const yn = make(root);
    yn.calculateLayout(undefined, undefined, yoga.DIRECTION_LTR);
    for (const [n, y] of pairs) {
      const box = y.getComputedLayout();
      n.layout.computedLayout = box;
      if (n !== root) n.position.set(box.left, box.top);
      const key = [box.left, box.top, box.width, box.height].join();
      if (n._layoutKey !== key) {
        n._layoutKey = key;
        n.emit("layout", n.layout);
      }
    }
    yn.freeRecursive();
    for (const [n] of pairs) for (const c of n.children) if (!c.layout) walk(c);
  };
  walk(root);
}

export class WebGLRenderer {
  bloomEnabled = true;
  graphicsBatchingEnabled = true;
  graphicsBatcher = new FlatBatcher();
  recursiveFlatBatchingEnabled = true;
  nativeBatchingEnabled = true;
  nativeBatcher = new NativeBatcher();
  // Native screen components may prepare render textures on this context.
  // Each pass restores its render target, viewport, scissor and clear color.
  screenPasses = new Set();
  screenOverlays = new Set();
  setBloomEnabled(enabled) {
    this.bloomEnabled = Boolean(enabled) && !this.uiOnly;
    return this.bloomEnabled;
  }
  async init(options = {}) {
    await initializeDisplay();
    this.uiOnly = options.uiOnly === true;
    if (this.uiOnly) this.bloomEnabled = false;
    this.resolution = options.resolution || 1;
    this.screen = new Rectangle(0, 0, options.width || 1, options.height || 1);
    this.canvas =
      options.canvas ||
      globalThis.wx?.createCanvas?.() ||
      document.createElement("canvas");
    this.three = new THREE.WebGLRenderer({
      canvas: this.canvas,
      context: options.context,
      antialias: options.antialias ?? true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.three.outputColorSpace = THREE.SRGBColorSpace;
    this.three.toneMapping = THREE.ACESFilmicToneMapping;
    this.three.toneMappingExposure = 0.9;
    this.three.autoClear = false;
    this.three.localClippingEnabled = true;
    this.three.info.autoReset = false;
    this.three.setClearColor(options.backgroundColor ?? 0x061820);
    this.three.setPixelRatio(this.resolution);
    this.context = { webGLVersion: 2 };
    this.type = "three";
    this.name = "Three.js";
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 10000);
    this.camera.position.z = 5000;
    this.scene.add(new THREE.HemisphereLight(0xd9efff, 0x263247, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(-400, -600, 1500);
    this.scene.add(key);
    this.worldScene = new THREE.Scene();
    this.worldRoot = new THREE.Group();
    this.worldRoot.rotation.x = Math.PI / 2;
    this.worldRoot.scale.set(1, 1, -1);
    this.worldScene.add(this.worldRoot);
    this.worldCamera = createBattleCamera();
    // Flat HUDs never sample a world environment or bloom render targets.
    if (!this.uiOnly) {
    const studio = new RoomEnvironment(),
      pmrem = new THREE.PMREMGenerator(this.three);
    this._environment = pmrem.fromScene(studio, 0.04);
    studio.dispose();
    pmrem.dispose();
    this.worldScene.environment = this.scene.environment =
      this._environment.texture;
    this.worldScene.environmentIntensity = 0.85;
    this.scene.environmentIntensity = 0.75;
    }
    this.worldScene.add(new THREE.HemisphereLight(0xd5f0ff, 0x162a3b, 0.75));
    const sunlight = new THREE.DirectionalLight(0xfff1db, 3.2);
    sunlight.position.set(-600, 1200, 200);
    sunlight.target.position.set(300, 0, 650);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(1024, 1024);
    Object.assign(sunlight.shadow.camera, {
      left: -1000,
      right: 1000,
      top: 1100,
      bottom: -1100,
      near: 10,
      far: 3500,
    });
    sunlight.shadow.bias = -0.0002;
    sunlight.shadow.camera.updateProjectionMatrix();
    sunlight.shadow.normalBias = 1;
    this.worldScene.add(sunlight, sunlight.target);
    const rim = new THREE.DirectionalLight(0x80caff, 1.4);
    rim.position.set(1000, 500, 1500);
    rim.target.position.set(300, 0, 650);
    this.worldScene.add(rim, rim.target);
    // Combat glow is rendered from a dedicated object layer. The regular
    // world camera sees both layers; the bloom composer temporarily sees only
    // layer 1, keeping terrain and UI crisp while projectiles can glow hard.
    this.worldCamera.layers.enable(1);
    if (!this.uiOnly) {
    this._bloomRenderPass = new RenderPass(this.worldScene, this.worldCamera);
    this._bloomRenderPass.clearColor = new THREE.Color(0x000000);
    this._bloomRenderPass.clearAlpha = 1;
    this._bloomPass = new CombatBloomPass(
      new THREE.Vector2(1, 1),
      1.25,
      0,
      0.16,
    );
    // Keep most energy near the projectile. Broad low-frequency mips turn a
    // dense pulse volley into a screen-wide veil instead of distinct halos.
    this._bloomPass.compositeMaterial.uniforms.bloomFactors.value = [1, 0.45, 0.1, 0.015, 0];
    this._bloomComposer = new EffectComposer(this.three);
    this._bloomComposer.renderToScreen = false;
    // Resolution is bounded in combatBloomSize, independently of canvas DPR.
    this._bloomComposer.setPixelRatio(1);
    this._bloomComposer.addPass(this._bloomRenderPass);
    this._bloomComposer.addPass(this._bloomPass);
    this._bloomScene = new THREE.Scene();
    this._bloomCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const bloomGeometry = new THREE.PlaneGeometry(2, 2);
    this._bloomQuad = new THREE.Mesh(
      bloomGeometry,
      // Composite only the blurred light, with a soft limit on dense volleys.
      createCombatBloomComposite(this._bloomPass.renderTargetsHorizontal[0].texture),
    );
    this._bloomQuad.frustumCulled = false;
    this._bloomScene.add(this._bloomQuad);
    }
    this.three.shadowMap.enabled = true;
    this.three.shadowMap.type = THREE.PCFShadowMap;
    this.resize(this.screen.width, this.screen.height);
    this._lastRevision = -1;
    this._pointer = (e) => this.handlePointer(e);
    if (globalThis.__THUNDER_RUNTIME_GLOBALS__?.platformKind !== "wechat")
      for (const type of [
        "pointerdown",
        "pointermove",
        "pointerup",
        "pointercancel",
      ])
        this.canvas.addEventListener?.(type, this._pointer);
  }
  handlePointer(e) {
    if (!this._root) return;
    const b = this.canvas.getBoundingClientRect?.() || {
      left: 0,
      top: 0,
      width: this.screen.width,
      height: this.screen.height,
    };
    const global = new Point(
      ((e.clientX - b.left) * this.screen.width) / b.width,
      ((e.clientY - b.top) * this.screen.height) / b.height,
    );
    const target = this._hit(this._root, global) || this._root;
    const evt = {
      global,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      button: e.button,
      nativeEvent: e,
      target,
      currentTarget: target,
      stopped: false,
      stopPropagation() {
        this.stopped = true;
      },
      preventDefault() {
        e.preventDefault?.();
      },
    };
    const bubble = (type, node = target) => {
      evt.stopped = false;
      const chain = [];
      for (let n = node; n; n = n.parent) chain.push(n);
      for (const n of chain) {
        evt.currentTarget = n;
        n.emit(type, evt);
        if (evt.stopped) break;
      }
    };
    if (e.type === "pointerdown") {
      this._press = {
        target,
        global: global.clone(),
        pointerId: e.pointerId,
        dragged: false,
      };
      this.canvas.setPointerCapture?.(e.pointerId);
    }
    if (e.type === "pointermove") {
      if (
        this._press &&
        Math.hypot(
          global.x - this._press.global.x,
          global.y - this._press.global.y,
        ) > 12
      )
        this._press.dragged = true;
      const broadcast = (n) => {
        if (!n.visible) return;
        n.emit("globalpointermove", evt);
        for (const c of [...n.children]) broadcast(c);
      };
      broadcast(this._root);
    }
    bubble(e.type);
    if (e.type === "pointerup" || e.type === "pointercancel") {
      const press = this._press;
      this._press = null;
      if (press && !press.target.destroyed) {
        if (e.type === "pointerup" && !press.dragged && press.target === target)
          bubble("pointertap");
        else if (press.target !== target || e.type === "pointercancel")
          bubble("pointerupoutside", press.target);
      }
      try {
        this.canvas.releasePointerCapture?.(e.pointerId);
      } catch {}
    }
  }
  resize(w, h) {
    this.screen.width = Math.max(1, w);
    this.screen.height = Math.max(1, h);
    this.three.setSize(this.screen.width, this.screen.height, false);
    this.camera.right = w;
    this.camera.bottom = h;
    this.camera.updateProjectionMatrix();
  }
  _hit(node, p) {
    if (!node.visible || !node.renderable || node.eventMode === "none")
      return null;
    if (node.mask) {
      const q = node.mask.toLocal(p);
      if (!node.mask.getLocalBounds().contains(q.x, q.y)) return null;
    }
    if (node.interactiveChildren)
      for (const n of [...node.children].reverse()) {
        const hit = this._hit(n, p);
        if (hit) return hit;
      }
    if (node.eventMode === "static") {
      const q = node.toLocal(p);
      if ((node.hitArea || node.getLocalBounds()).contains(q.x, q.y))
        return node;
    }
    return null;
  }
  configureWorld({ layers, frame }) {
    this.worldLayers = layers;
    this.worldFrame = frame;
  }
  projectBattle(x, y, altitude = 0) {
    return battleToScreen(this.worldCamera, x, y, altitude);
  }
  unprojectBattle(x, y) {
    return screenToBattle(this.worldCamera, x, y);
  }
  render({ container }) {
    if (!container || container.destroyed) return;
    // A native menu owns the entire screen while visible. Its cached canvas
    // and inspection pass replace the obscured world, including its bloom and
    // shadow passes. Returning false restores the original combat path.
    if (this.menuPass?.()) return;
    this.graphicsBatcher.restore();
    this.nativeBatcher.restore();
    this._root = container;
    if (this._lastRevision !== revision) {
      layoutTree(container);
      this._lastRevision = revision;
    }
    if (container.object3D.parent !== this.scene)
      this.scene.add(container.object3D);
    const masks = new Set(),
      seen = new Set();
    const gather = (n) => {
      seen.add(n);
      if (n.mask) masks.add(n.mask);
      for (const c of n.children) gather(c);
    };
    gather(container);
    let order = 0;
    const sync = (
      n,
      opacity = 1,
      tint = new THREE.Color(0xffffff),
      clips = [],
      world = false,
      filters = [],
      bloom = false,
      additive = false,
    ) => {
      world ||= this.worldLayers?.includes(n);
      bloom ||= n.bloom === true;
      additive ||= n.additive === true;
      n.object3D.visible = n.visible && n.renderable && !masks.has(n);
      if (!n.object3D.visible) return;
      if (bloom) this._hasBloomSource = true;
      n._prepare?.();
      const m = n._matrix();
      n.object3D.matrixAutoUpdate = false;
      n.object3D.matrix.set(
        m[0],
        m[2],
        0,
        m[4],
        m[1],
        m[3],
        0,
        m[5],
        0,
        0,
        n.scaleDepth ? Math.abs(n.scale.x) : 1,
        n.depth || 0,
        0,
        0,
        0,
        1,
      );
      // Three r185 only propagates manually assigned matrices when marked
      // dirty. Rebuilt menus and moved bullets must reach both batchers.
      n.object3D.matrixWorldNeedsUpdate = true;
      opacity *= n.alpha;
      if (n._syncTintValue !== n.tint || !n._syncLocalTint) {
        n._syncLocalTint ||= new THREE.Color();
        n._syncLocalTint.set(n.tint ?? 0xffffff);
        n._syncTintValue = n.tint;
      }
      n._syncWorldTint ||= new THREE.Color();
      tint = n._syncWorldTint.copy(tint).multiply(n._syncLocalTint);
      filters = n.filters?.length ? [...filters, ...n.filters] : filters;
      if (n.mask && !world) {
        const b = n.mask.getBounds();
        clips = [
          ...clips,
          new THREE.Plane(new THREE.Vector3(1, 0, 0), -b.x),
          new THREE.Plane(new THREE.Vector3(-1, 0, 0), b.x + b.width),
          new THREE.Plane(new THREE.Vector3(0, 1, 0), -b.y),
          new THREE.Plane(new THREE.Vector3(0, -1, 0), b.y + b.height),
        ];
      }
      const visual = (c) => {
        if (c.userData.display || c.userData.graphicsBatch || c.userData.nativeBatch) return;
        c.renderOrder = order++;
        if (c.material) {
          for (const mat of Array.isArray(c.material)
            ? c.material
            : [c.material]) {
            if (mat.userData.baseOpacity == null)
              mat.userData.baseOpacity = mat.opacity;
            mat.opacity = mat.userData.baseOpacity * opacity;
            if (!mat.userData.baseColor && mat.color)
              mat.userData.baseColor = mat.color.clone();
            if (mat.color)
              mat.color.copy(mat.userData.baseColor).multiply(tint);
            if (mat.userData.baseBlending == null)
              mat.userData.baseBlending = mat.blending;
            mat.blending = additive
              ? THREE.AdditiveBlending
              : mat.userData.baseBlending;
            const nativeBloom = bloom || (world && c.userData.bloom === true);
            c.layers.set(nativeBloom ? 1 : 0);
            if (nativeBloom && world && n.visible) this._hasBloomSource = true;
            materialColorTransform(mat, filters);
            const count = mat.clippingPlanes?.length || 0;
            mat.clippingPlanes = clips;
            if (count !== clips.length) mat.needsUpdate = true;
          }
        }
        for (const cc of c.children) visual(cc);
      };
      for (const c of n.object3D.children) visual(c);
      const children = n.sortableChildren
        ? [...n.children].sort((a, b) => a.zIndex - b.zIndex)
        : n.children;
      for (const c of children)
        sync(c, opacity, tint, clips, world, filters, bloom, additive);
    };
    this._hasBloomSource = false;
    sync(container);
    for (const n of this._previousNodes || []) {
      if (seen.has(n) || n.destroyed) continue;
      let ancestor = n;
      while (ancestor.parent) ancestor = ancestor.parent;
      if (ancestor === container) continue;
      n._disposeVisuals?.();
      n._geometryKey = null;
      n._key = null;
      if (n instanceof Text && n.texture !== Texture.EMPTY)
        n.texture.source.destroy();
    }
    this._previousNodes = seen;
    for (const layer of this.worldLayers || []) {
      if (layer.object3D.parent !== this.worldRoot) this.worldRoot.add(layer.object3D);
    }
    // Both batchers consume the same synchronized source transforms. Prepare
    // them once, instead of updating every subtree for each batcher.
    if (this.graphicsBatchingEnabled || this.nativeBatchingEnabled) {
      this.worldRoot.updateWorldMatrix(true, true);
      container.object3D.updateWorldMatrix(true, true);
    }
    if (this.graphicsBatchingEnabled) this.graphicsBatcher.update(
      this.recursiveFlatBatchingEnabled ? [...(this.worldLayers || []), container] : (this.worldLayers || []),
      this.bloomEnabled, this.recursiveFlatBatchingEnabled, true,
    );
    if (this.nativeBatchingEnabled) this.nativeBatcher.update(this.worldLayers || [], true);
    this.three.info.reset();
    this.three.setViewport(0, 0, this.screen.width, this.screen.height);
    this.three.setScissorTest(false);
    this.three.clear();
    if (this.worldLayers?.length) {
      for (const layer of this.worldLayers) {
        if (layer.object3D.parent !== this.worldRoot) this.worldRoot.add(layer.object3D);
      }
      const f = this.worldFrame,
        scale = f.scale.x;
      this.three.setViewport(
        f.x,
        this.screen.height - f.y - 1300 * scale,
        600 * scale,
        1300 * scale,
      );
      this.three.setScissor(
        f.x,
        this.screen.height - f.y - 1300 * scale,
        600 * scale,
        1300 * scale,
      );
      this.three.setScissorTest(true);
      this.three.render(this.worldScene, this.worldCamera);
      if (this.bloomEnabled && this._hasBloomSource) {
        const viewportWidth = Math.max(1, Math.round(600 * scale));
        const viewportHeight = Math.max(1, Math.round(1300 * scale));
        const bloomKey = `${viewportWidth}x${viewportHeight}`;
        if (this._bloomSizeKey !== bloomKey) {
          const size = combatBloomSize(viewportWidth, viewportHeight);
          this._bloomComposer.setSize(
            size.width,
            size.height,
          );
          this._bloomSizeKey = bloomKey;
        }
        const cameraMask = this.worldCamera.layers.mask;
        this.worldCamera.layers.set(1);
        const shadowAutoUpdate = this.three.shadowMap.autoUpdate;
        this.three.shadowMap.autoUpdate = false;
        this._bloomComposer.render();
        this.three.shadowMap.autoUpdate = shadowAutoUpdate;
        this.worldCamera.layers.mask = cameraMask;
        this._bloomQuad.material.uniforms.bloomTexture.value = this._bloomPass.renderTargetsHorizontal[0].texture;
        this.three.setRenderTarget(null);
        this.three.setViewport(
          f.x,
          this.screen.height - f.y - 1300 * scale,
          600 * scale,
          1300 * scale,
        );
        this.three.setScissor(
          f.x,
          this.screen.height - f.y - 1300 * scale,
          600 * scale,
          1300 * scale,
        );
        this.three.setScissorTest(true);
        this.three.render(this._bloomScene, this._bloomCamera);
      }
      this.three.setScissorTest(false);
      this.three.setViewport(0, 0, this.screen.width, this.screen.height);
      this.three.clearDepth();
    }
    for (const pass of this.screenPasses) pass(this.three);
    this.three.render(this.scene, this.camera);
    for (const overlay of this.screenOverlays || []) overlay(this.three);
  }
  get stats() {
    return this.three.info;
  }
  destroy(remove = false) {
    for (const t of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
    ])
      this.canvas.removeEventListener?.(t, this._pointer);
    this.graphicsBatcher.destroy();
    this.nativeBatcher.destroy();
    this.screenPasses.clear();
    this.screenOverlays.clear();
    this.three.dispose();
    this._bloomComposer?.dispose();
    this._bloomPass?.dispose();
    this._bloomQuad?.geometry.dispose();
    this._bloomQuad?.material.dispose();
    this._environment?.dispose();
    if (remove) this.canvas.remove?.();
  }
}

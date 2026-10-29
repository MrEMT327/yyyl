/** Local TRS composition for original enabled nested Animator controllers.
 * Inputs are exported APK curves. This never chooses a gameplay attack state.
 */
type Vec3 = [number, number, number];
type Quat = [number, number, number, number];
type Matrix = number[];
interface RigNode { path: string; parent: number; position: Vec3; rotation: Quat; scale: Vec3; active: boolean }
interface Binding { node: number; attribute: string; index: number; count: number; spritePathIds?: string[] }
interface Clip {
  duration: number; fps: number; stateSpeed: number; loop: boolean;
  bindings: Binding[]; frames: number[][];
}
interface Animator { root: string; primary: boolean; defaultState: string; clips: Record<string, Clip> }
export interface NativeEnemyAnimationRig {
  nodes: RigNode[];
  renderers: { path: string; node: number; alpha: number; enabled: boolean; spritePathId: string }[];
  animators: Animator[];
}
export interface NativeEnemyAnimationSource {
  models: Record<string, NativeEnemyAnimationRig>;
  entities: Record<string, string>;
  animatedRendererPaths?: Record<string, string[]>;
  spriteReferences?: { pathId: string; file: string }[];
}
export interface NativeEnemyAnimationTime {
  /** Entity lifetime in visual seconds, without combat AttackSpeed. */
  age: number;
  /** Explicit primary Animator state supplied by the battle state machine. */
  mainState?: string;
  /** State age with the original global Animator speed already applied once. */
  mainTime?: number;
}
export interface NativeEnemyRendererPose { path: string; matrix: Matrix; alpha: number; spritePathId?: string }

const identity: Matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

function multiply(a: Matrix, b: Matrix): Matrix {
  const out = new Array<number>(12);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) out[r * 4 + c] = a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c];
    out[r * 4 + 3] = a[r * 4] * b[3] + a[r * 4 + 1] * b[7] + a[r * 4 + 2] * b[11] + a[r * 4 + 3];
  }
  return out;
}

function trs(position: Vec3, rotation: Quat, scale: Vec3): Matrix {
  const [x, y, z, w] = rotation, [sx, sy, sz] = scale;
  return [(1-2*y*y-2*z*z)*sx, (2*x*y-2*z*w)*sy, (2*x*z+2*y*w)*sz, position[0],
    (2*x*y+2*z*w)*sx, (1-2*x*x-2*z*z)*sy, (2*y*z-2*x*w)*sz, position[1],
    (2*x*z-2*y*w)*sx, (2*y*z+2*x*w)*sy, (1-2*x*x-2*y*y)*sz, position[2]];
}

function quaternion(euler: Vec3): Quat {
  const [x,y,z]=euler.map(n=>n*Math.PI/360), sx=Math.sin(x), cx=Math.cos(x), sy=Math.sin(y), cy=Math.cos(y), sz=Math.sin(z), cz=Math.cos(z);
  return [sx*cy*cz+cx*sy*sz, cx*sy*cz-sx*cy*sz, cx*cy*sz-sx*sy*cz, cx*cy*cz+sx*sy*sz];
}

/** Returned matrices replace primary world-matrix animation for this entity.
 * Local idle tracks run on age; they are not driven by attack-state resets.
 * Undefined means there is no exported local rig and the caller should use its
 * existing primary Animator renderer. Match poses to original sourcePath.
 */
export function sampleNativeEnemyAnimation(
  source: NativeEnemyAnimationSource | undefined, entityId: number, time: NativeEnemyAnimationTime,
): NativeEnemyRendererPose[] | undefined {
  const model = source?.entities[entityId], rig = model ? source?.models[model] : undefined;
  if (!rig) return undefined;
  const positions = rig.nodes.map(n => [...n.position] as Vec3);
  const rotations = rig.nodes.map(n => [...n.rotation] as Quat);
  const scales = rig.nodes.map(n => [...n.scale] as Vec3);
  const active = rig.nodes.map(n => n.active), enabled = new Map<number, boolean>(), alpha = new Map<number, number>(), sprites = new Map<number, string>();
  for (const animator of rig.animators) {
    const state = animator.primary ? time.mainState : animator.defaultState;
    if (!state) continue;
    const clip = animator.clips[state];
    if (!clip?.frames.length) continue;
    const age = Math.max(0, (animator.primary ? time.mainTime ?? 0 : time.age) * clip.stateSpeed);
    const seconds = clip.loop && clip.duration > 0 ? age % clip.duration : Math.min(age, clip.duration);
    const values = clip.frames[Math.min(clip.frames.length - 1, Math.floor(seconds * clip.fps))];
    for (const binding of clip.bindings) {
      const n = binding.node, v = values.slice(binding.index, binding.index + binding.count);
      switch (binding.attribute) {
        case 'position': positions[n] = v as Vec3; break;
        case 'scale': scales[n] = v as Vec3; break;
        case 'quaternion': rotations[n] = v as Quat; break;
        case 'euler': rotations[n] = quaternion(v as Vec3); break;
        case 'm_IsActive': active[n] = v[0] >= .5; break;
        case 'm_Enabled': enabled.set(n, v[0] >= .5); break;
        case 'm_Color.a': alpha.set(n, v[0]); break;
        case 'sprite': {
          const id = binding.spritePathIds?.[Math.round(v[0])];
          if (id) sprites.set(n, id);
          break;
        }
      }
    }
  }
  const nodes = rig.nodes;
  const matrices: (Matrix | undefined)[] = new Array(nodes.length), visible: boolean[] = [];
  function world(i: number): Matrix {
    if (matrices[i]) return matrices[i]!;
    const parent = nodes[i].parent;
    const parentMatrix = parent >= 0 ? world(parent) : identity;
    visible[i] = active[i] && (parent < 0 || visible[parent]);
    return matrices[i] = multiply(parentMatrix, trs(positions[i], rotations[i], scales[i]));
  }
  return rig.renderers.map(r => ({ path: r.path, matrix: world(r.node),
    alpha: visible[r.node] && (enabled.get(r.node) ?? r.enabled) ? alpha.get(r.node) ?? r.alpha : 0,
    spritePathId: sprites.get(r.node) }));
}

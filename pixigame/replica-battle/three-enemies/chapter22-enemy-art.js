import {makeBattlePart,makeBattleGroup,selectBattleRegion} from "../../src/three/game-screen/three-battle-parts.js";
import nativeMotion from '../chapter22-enemy-motion.json';
import { sampleNativeEnemyAnimation } from '../kernel/native-enemy-animation';
import { nativeLogicDelta } from '../kernel/native-time';
import { createEnemyFlightMotion } from '../scatter-gunboat-flight';
const skins = {
    120180: {
        name: 'marsh-seedrunner', model: 'Plane38', tier: '普通', regions: { "p1": [161, 63, 316, 300], "p2": [668, 44, 202, 335], "p3": [971, 109, 522, 266], "p4": [58, 426, 522, 538], "p5": [687, 424, 189, 535], "p6": [1013, 480, 445, 429] },
        parts: r => {
            const part = { "planne38_1": "p1", "planne38_2": "p2", "planne38_3": "p3", "planne38_4": "p4", "planne38_5": "p5", "planne38_6": "p6" }[r.sprite];
            // Keep original node transforms and clocks; facial layers become sealed armor.
            return part ? [{ part, pinned: true }] : [];
        },
    },
};
const states = new WeakMap();
const keyFor = (s) => `owned-enemy:chapter22-${s.name}-v1`;
export function preloadChapter22Enemies(scene, models) {
    for (const id of new Set(models)) {
        const skin = skins[id];
        if (skin && !scene.art.get(keyFor(skin)))
            scene.queue(keyFor(skin),`assets/owned-enemies/chapter22-${skin.name}-v1/parts.png`);
    }
}
export function createChapter22Enemy(scene, id, px, prefab, assets) {
    const skin = skins[id];
    if (!skin || !prefab || !scene.art.get(keyFor(skin)))
        return undefined;
    const animation = assets.bossAnimations?.models?.[skin.model];
    const local = nativeMotion;
    const selected = prefab.renderers.flatMap(r => r.active && r.enabled && assets.sprites[r.sprite]
        ? skin.parts(r).map(spec => ({ r, spec, path: r.hierarchy.join('/') })) : []);
    if (!selected.length || selected.some(({ r, path }) => !r.matrix || (animation && !animation.renderers.some((v) => v.path === path))
        || (local?.models[skin.model] && !local.models[skin.model].renderers.some(v => v.path === path))))
        return undefined;
    const key = keyFor(skin), texture = scene.art.get(key);
    for (const [name, rect] of Object.entries(skin.regions))
        if (!texture.frames.has(name))
            texture.frames.set(name,[...rect]);
    const view = makeBattleGroup(scene,0,0), state = { layers: [], px, animation, local,
        flight: createEnemyFlightMotion({ id: skin.name, tier: skin.tier }, id) };
    for (const { r, spec, path } of selected) {
        const s = assets.sprites[r.sprite], pivot = s.renderPivot || s.pivot || { x: .5, y: .5 };
        const index = animation?.renderers.findIndex((v) => v.path === path) ?? -1;
        const rest = r.matrix.slice(0, 3).flat();
        rest.push(r.color?.a ?? 1);
        state.layers.push({ image: makeBattlePart(scene,0,0,key,spec.part), path, index, rest, spec,
            width: s.width / s.ppu, height: s.height / s.ppu, pivotX: pivot.x, pivotY: 1 - pivot.y,
            order: spec.order ?? animation?.renderers[index]?.sortingOrder ?? r.sortingOrder });
    }
    state.layers.sort((a, b) => a.order - b.order);
    for (const layer of state.layers)
        view.add(layer.image);
    states.set(view, state);
    poseLayers(state, animation?.clips?.Idle?.frames?.[0], state.flight.update(0));
    return view;
}
function poseLayers(state, frame, pose, local) {
    const byPath = local ? new Map(local.map(v => [v.path, v])) : undefined;
    for (const layer of state.layers) {
        const native = byPath?.get(layer.path), m = native?.matrix || frame?.[layer.index] || layer.rest;
        const a = m[0], b = -m[8], c = -m[1], d = m[9], sx = Math.hypot(a, b), sy = sx ? (a * d - b * c) / sx : 0;
        const ox = (layer.spec.x || 0) * layer.width, oy = (layer.spec.y || 0) * layer.height;
        let x = (m[3] + a * ox + c * oy) * state.px, y = (-m[11] + b * ox + d * oy) * state.px;
        let angle = Math.atan2(b, a), width = layer.width * (layer.spec.w ?? 1) * state.px * sx;
        if (!layer.spec.pinned) {
            x += pose.bank * state.px * .4;
            y += x * pose.bank * .08;
            angle += pose.angle * .25 + (['horn', 'wing', 'fin', 'petal', 'leg', 'tail'].includes(layer.spec.part) ? pose.lag * .3 : 0);
            width *= 1 - Math.abs(pose.bank) * .1;
        }
        ((node)=>{node.material.uniforms.pivot.value.set(layer.pivotX,layer.pivotY);node.position.set(x,y,0);node.scale.set(width / layer.image.userData.partWidth * (layer.spec.flip ? -1 : 1),layer.height * (layer.spec.h ?? 1) * state.px * sy / layer.image.userData.partHeight,1);node.rotation.z=angle;node.material.uniforms.opacity.value=(native?.spritePathId === '0' ? 0 : native?.alpha ?? m[12] ?? layer.rest[12]) * (layer.spec.opacity ?? 1);return node})(layer.image);
    }
}
export function updateChapter22Enemy(view, enemy, position, dt) {
    const state = states.get(view);
    if (!state)
        return false;
    if (dt <= 0)
        return true;
    const reset = state.revision !== (enemy.viewPositionRevision ?? 0);
    const vx = !reset && state.position ? (position.x - state.position.x) * state.px / dt : 0;
    const vy = !reset && state.position ? -(position.z - state.position.z) * state.px / dt : 0;
    state.position = { ...position };
    state.revision = enemy.viewPositionRevision ?? 0;
    const name = enemy.dead ? 'Death' : enemy.animationClip || 'Idle';
    const age = enemy.dead ? enemy.deathAge ?? (4 * nativeLogicDelta - (enemy.deathRemaining || 0)) : enemy.animationTime ?? enemy.age;
    const clip = state.animation?.clips[name];
    let frame;
    if (clip?.frames?.length) {
        const t = age * Number(clip.stateSpeed ?? 1), loop = name === 'Idle' || name.startsWith('SkillFireHold') || name.startsWith('SkillHold');
        const seconds = loop && clip.duration > 0 ? t % clip.duration : Math.min(t, clip.duration);
        frame = clip.frames[Math.min(clip.frames.length - 1, Math.max(0, Math.floor(seconds * clip.fps)))];
    }
    const local = sampleNativeEnemyAnimation(state.local, enemy.entityId, { age: enemy.age, mainState: name, mainTime: age });
    poseLayers(state, frame, state.flight.update(dt, vx, vy, !!enemy.laserWarning), local);
    return true;
}

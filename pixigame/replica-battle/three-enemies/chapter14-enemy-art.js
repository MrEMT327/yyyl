import {makeBattlePart,makeBattleGroup,selectBattleRegion} from "../../src/three/game-screen/three-battle-parts.js";
import { sampleNativeEnemyAnimation } from '../kernel/native-enemy-animation';
import { nativeLogicDelta } from '../kernel/native-time';
import { createEnemyFlightMotion } from '../scatter-gunboat-flight';
const skins = {
    122010: {
        name: 'salt-ring-sentinel', model: 'Plane50_elite1', tier: '精英', regions: { "lid": [36, 123, 349, 353], "lower": [425, 100, 355, 386], "inner": [830, 159, 316, 307], "cap": [1253, 203, 190, 222], "platform": [21, 540, 389, 364], "nose": [497, 574, 188, 314], "hood": [750, 562, 401, 335], "deck": [1170, 584, 351, 311] },
        parts: r => {
            const part = { "plane50_elite2": "lid", "plane50_elite5": "lower", "plane50_elite8": "inner", "plane50_elite4": "cap", "plane50_elite7": "platform", "plane50_elite1": "nose", "plane50_elite3": "hood", "plane50_elite6": "deck" }[r.sprite];
            // Preserve every original node, matrix, reflection and animation clock.
            // Static original-sized art only; never send attack events or move mounts.
            return part ? [{ part, pinned: true }] : [];
        },
    },
    120175: {
        name: 'salt-crystal-skimmer', model: 'Plane2_1', tier: '普通', regions: { "hull": [131, 81, 504, 586], "fin": [776, 220, 496, 323], "tail": [120, 783, 521, 254], "cap": [834, 741, 422, 313] },
        parts: r => {
            const part = { "monster2_1_1": "hull", "monster2_1_2": "cap", "monster2_1_3": "tail", "monster2_1_4": "fin" }[r.sprite];
            // Preserve every original node, matrix, reflection and animation clock.
            // Static original-sized art only; never send attack events or move mounts.
            return part ? [{ part, pinned: true }] : [];
        },
    },
    121013: {
        name: 'salt-mirror-carrier', model: 'Plane_boss_13', tier: 'Boss', regions: { "hull": [184, 19, 106, 254], "bridge": [424, 80, 728, 129], "exhaust": [1264, 18, 113, 255], "cannon": [207, 291, 60, 243], "grille": [521, 324, 502, 186], "brace": [1169, 332, 290, 168], "wing": [28, 549, 420, 237], "deck": [556, 559, 448, 228], "turret": [1188, 560, 241, 227], "cap": [171, 807, 133, 193], "trim": [510, 846, 534, 130], "stern": [1097, 829, 396, 147] },
        parts: r => {
            const part = { "plane_boss2_1_b": "bridge", "plane_boss2_2": "exhaust", "plane_boss2_3": "cannon", "plane_boss2_4": "grille", "plane_boss2_5": "brace", "plane_boss2_7": "stern", "plane_boss2_8": "hull", "plane_boss2_13": "hull", "plane_boss2_9": "wing", "plane_boss2_12": "wing", "plane_boss2_11": "deck", "plane_boss2_14": "deck", "plane_boss2_10_b": "turret", "plane_boss2_15_b": "turret", "plane_boss2_17": "cap", "plane_boss2_16_b": "trim" }[r.sprite];
            // Preserve every original node, matrix, reflection and animation clock.
            // Static original-sized art only; never send attack events or move mounts.
            return part ? [{ part, pinned: true }] : [];
        },
    },
};
const states = new WeakMap();
const keyFor = (s) => `owned-enemy:chapter14-${s.name}-v1`;
export function preloadChapter14Enemies(scene, models) {
    for (const id of new Set(models)) {
        const skin = skins[id];
        if (skin && !scene.art.get(keyFor(skin)))
            scene.queue(keyFor(skin),`assets/owned-enemies/chapter14-${skin.name}-v1/parts.png`);
    }
}
export function createChapter14Enemy(scene, id, px, prefab, assets) {
    const skin = skins[id];
    if (!skin || !prefab || !scene.art.get(keyFor(skin)))
        return undefined;
    const animation = assets.bossAnimations?.models?.[skin.model];
    const local = assets.enemyLocalAnimation;
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
        ((node)=>{node.material.uniforms.pivot.value.set(layer.pivotX,layer.pivotY);node.position.set(x,y,0);node.scale.set(width / layer.image.userData.partWidth * (layer.spec.flip ? -1 : 1),layer.height * (layer.spec.h ?? 1) * state.px * sy / layer.image.userData.partHeight,1);node.rotation.z=angle;node.material.uniforms.opacity.value=native?.spritePathId === '0' ? 0 : native?.alpha ?? m[12] ?? layer.rest[12];return node})(layer.image);
    }
}
export function updateChapter14Enemy(view, enemy, position, dt) {
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

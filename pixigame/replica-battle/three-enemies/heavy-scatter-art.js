import {makeBattlePart,makeBattleGroup,selectBattleRegion} from "../../src/three/game-screen/three-battle-parts.js";
import { createEnemyFlightMotion } from '../scatter-gunboat-flight';
// This adapter owns pixels only. Never write back into the simulation or mounts.
import {HEAVY_SCATTER_MODEL} from '../kernel/enemy-recoil-models.ts';
export {HEAVY_SCATTER_MODEL};
const textureKey = 'owned-enemy:heavy-scatter-v1';
const atlasUrl = 'assets/owned-enemies/heavy-scatter-v1/parts.png';
const regions = {
    body: [48, 100, 792, 630], pod: [875, 150, 335, 565],
    gun: [220, 810, 425, 360], sensor: [875, 960, 235, 130],
};
const states = new WeakMap();
export function preloadHeavyScatter(scene, models) {
    if (Array.from(models).includes(HEAVY_SCATTER_MODEL) && !scene.art.get(textureKey))
        scene.queue(textureKey,atlasUrl);
}
export function createHeavyScatter(scene, modelId, px, prefab, sprites) {
    if (modelId !== HEAVY_SCATTER_MODEL || !scene.art.get(textureKey))
        return undefined;
    const renderer = prefab?.renderers?.find((r) => r.active && r.enabled && r.sprite === 'monster11_1');
    const sprite = renderer && sprites?.[renderer.sprite];
    if (!renderer || !sprite)
        return undefined;
    const texture = scene.art.get(textureKey);
    for (const [name, rect] of Object.entries(regions))
        if (!texture.frames.has(name))
            texture.frames.set(name,[rect[0],rect[1],rect[2],rect[3]]);
    const matrix = renderer.matrix;
    const a = matrix ? matrix[0][0] : renderer.scaleX;
    const b = matrix ? -matrix[2][0] : 0;
    const bounds = nativeBounds(prefab, sprites);
    const state = {
        layers: [], fitX: bounds.width * px / 350,
        fitY: bounds.height * px / 230, px,
        angle: matrix ? Math.atan2(b, a) : -(renderer.rotation || 0) * Math.PI / 180,
        originX: bounds.x * px,
        originY: bounds.y * px + 1.75 * bounds.height * px / 230,
        flight: createEnemyFlightMotion({ id: 'heavy-scatter', tier: '小怪' }, 120143),
    };
    const view = makeBattleGroup(scene,0,0);
    const add = (key, x, y, width, height, flip = false) => {
        const image = makeBattlePart(scene,0,0,textureKey,key);
        view.add(image);
        state.layers.push({ image, key, x, y, width, height, flip });
    };
    add('pod', -137.5, 0, 75, 180, true);
    add('pod', 137.5, 0, 75, 180);
    add('gun', 0, 65, 125, 103);
    add('body', 0, -10, 260, 206);
    add('sensor', 0, -26, 40, 22);
    states.set(view, state);
    poseLayers(state, state.flight.update(0), 0);
    return view;
}
function poseLayers(state, pose, recoil) {
    const angle = state.angle + pose.angle, co = Math.cos(angle), si = Math.sin(angle);
    for (const layer of state.layers) {
        const x = (layer.x + (layer.key === 'sensor' ? pose.bank * 6 : 0)) * state.fitX;
        const y = (layer.y - (layer.key === 'gun' ? recoil * 8 : 0)) * state.fitY;
        const leanX = x * (1 - Math.abs(pose.bank) * .12);
        const leanY = y + x * pose.bank * .12;
        ((node)=>{node.position.set(state.originX + leanX * co - leanY * si + pose.x * state.fitX,state.originY + leanX * si + leanY * co + pose.y * state.fitY,0);node.scale.set(layer.width * state.fitX / layer.image.userData.partWidth * (layer.flip ? -1 : 1) * (1 - Math.abs(pose.bank) * .12),layer.height * state.fitY / layer.image.userData.partHeight,1);node.rotation.z=angle + (layer.key === 'pod' ? pose.lag * .45 : 0);return node})(layer.image);
    }
}
export function updateHeavyScatter(view, enemy, position, dt, clock, lastShot) {
    const state = states.get(view);
    if (!state)
        return false;
    if (dt <= 0)
        return true; // Freeze cosmetics during pause, upgrade and revive.
    const reset = state.revision !== (enemy.viewPositionRevision ?? 0);
    const vx = !reset && state.position ? (position.x - state.position.x) * state.px / dt : 0;
    const vy = !reset && state.position ? -(position.z - state.position.z) * state.px / dt : 0;
    state.position = { ...position };
    state.revision = enemy.viewPositionRevision ?? 0;
    const pose = state.flight.update(dt, vx, vy, false);
    if (lastShot !== undefined && lastShot > (state.lastShot ?? -Infinity))
        state.lastShot = lastShot;
    const age = state.lastShot === undefined ? Infinity : Math.max(0, clock - state.lastShot);
    const recoil = !enemy.dead && age < .4 ? Math.sin(Math.min(1, age / .055) * Math.PI / 2) * Math.exp(-Math.max(0, age - .055) * 15) : 0;
    poseLayers(state, pose, recoil);
    return true;
}
function nativeBounds(prefab, sprites) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const r of prefab.renderers || []) {
        if (!r.active || !r.enabled || !sprites[r.sprite])
            continue;
        const s = sprites[r.sprite], p = s.renderPivot || s.pivot || { x: .5, y: .5 }, m = r.matrix;
        const a = m ? m[0][0] : r.scaleX, b = m ? -m[2][0] : 0;
        const c = m ? -m[0][1] : 0, d = m ? m[2][1] : r.scaleY;
        const tx = m ? m[0][3] : r.x || 0, ty = -(m ? m[2][3] : r.y || 0);
        for (const u of [0, 1])
            for (const v of [0, 1]) {
                const x = (u - p.x) * s.width / s.ppu, y = (v - (1 - p.y)) * s.height / s.ppu;
                const px = a * x + c * y + tx, py = b * x + d * y + ty;
                minX = Math.min(minX, px);
                maxX = Math.max(maxX, px);
                minY = Math.min(minY, py);
                maxY = Math.max(maxY, py);
            }
    }
    return { width: maxX - minX, height: maxY - minY, x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

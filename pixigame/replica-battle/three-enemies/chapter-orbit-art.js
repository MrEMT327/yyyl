import {makeBattlePart,makeBattleGroup,selectBattleRegion} from "../../src/three/game-screen/three-battle-parts.js";
// Presentation replacement only, not a native sprite reactivation.
// stg_ciqiu_1/FlySword uses an enabled billboard particle (renderMode=0),
// identity hierarchy transform and constant startSizeXYZ=1. Its old
// weapon_feilun_5 SpriteRenderer is disabled and must remain so.
export const ENEMY_ORBIT_ART_MODEL = 120187;
const key = 'chapter-original-projectile:enemy-orbit-disc';
const url = 'assets/original-projectiles/enemy-orbit-disc-v1.png';
export function preloadChapterOrbitArt(scene, modelIds) {
    if (Array.from(modelIds).includes(ENEMY_ORBIT_ART_MODEL) && !scene.art.get(key)) {
        scene.queue(key,url);
    }
}
export function createChapterOrbitArt(scene, modelId, pixelsPerWorldUnit) {
    if (modelId !== ENEMY_ORBIT_ART_MODEL)
        return undefined;
    if (!scene.art.get(key))
        throw new Error('Original enemy orbit artwork was not preloaded');
    const view = makeBattleGroup(scene,0,0);
    // Preserve the source particle's 1x1 world-unit canvas, independently of PNG
    // pixel dimensions. The renderer applies projectile.scale exactly once.
    view.add(((node)=>{node.material.uniforms.size.value.set(pixelsPerWorldUnit,pixelsPerWorldUnit);return node})(makeBattlePart(scene,0,0,key)));
    return view;
}

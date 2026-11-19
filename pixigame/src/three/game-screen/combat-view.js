import {NativeBattleView} from './three-battle-view.js';
import {CombatEffectsView, CombatIceTrail} from './combat-effect-art.js';
import {newSourceFreezeTintState,advanceSourceFreezeTint} from './freeze-tint.js';
import {CombatRenderSamples,CombatStatusIndex} from '../../replica/combat-render-samples.mjs';
import {MissileWingMounts} from '../../replica/missile-wing-mounts.mjs';
import {aircraftPassiveShot} from '../../replica/project-passive-deployment.js';
import {NativeViewPosition} from '../../../replica-battle/kernel/native-view-position';
import {NativeMapCameraOffsets} from '../../../replica-battle/kernel/native-map-layers';
import {selectPlayerAppearance} from '../../../replica-battle/kernel/player-appearance';
import {warningEndPoint} from './warning-endpoint.js';
import {thunderBeam} from '../../../replica-battle/kernel/thunder-presentation';
import {pickupExpiryAlpha} from '../../../replica-battle/kernel/pickup-expiry-presentation';
import {sampleEnemyHitMotion,damageTextPresentation,sampleCombatResults} from '../../../replica-battle/kernel/combat-hit-presentation.mjs';
import {captureEnemyDeathBody,enemyDeathVisualScale} from '../../../replica-battle/small-death-visual.js';
import {sampleNativeUrgencyWarning} from '../../../replica-battle/kernel/enemy-warning';
import {projectCoinPose} from '../../../replica-battle/kernel/pickup-presentation';
import {sampleCoinPickupReceipt} from '../../../replica-battle/kernel/coin-pickup-feedback.mjs';
import {sampleSpecialWeaponFeedback} from '../../../replica-battle/kernel/special-weapon-feedback.mjs';
import {sampleHealingReceipt} from '../../../replica-battle/kernel/healing-receipt.mjs';
import {CombatEffectDirector} from '../../../replica-battle/kernel/pathogenic/combat-effect-director';
import {sweep} from '../../../replica-battle/kernel/model';
import graph from '../../../replica-battle/kernel/pathogenic/scene-graph.json';
import urgency from '../../../replica-battle/public/data/enemy-warning.json';
import chests from '../../../replica-battle/public/data/chest-animation.json';

const WIDTH=540,HEIGHT=960;
const sources={
  ViewPosition:NativeViewPosition,MapOffsets:NativeMapCameraOffsets,Samples:CombatRenderSamples,StatusIndex:CombatStatusIndex,MissileMounts:MissileWingMounts,
  player:selectPlayerAppearance,passiveShot:aircraftPassiveShot,warningEnd:warningEndPoint,thunder:thunderBeam,pickupAlpha:pickupExpiryAlpha,
  freezeState:newSourceFreezeTintState,freeze:advanceSourceFreezeTint,hitMotion:sampleEnemyHitMotion,textLayout:damageTextPresentation,
  deathBody:captureEnemyDeathBody,deathScale:enemyDeathVisualScale,coinPose:projectCoinPose,supplyDuration:t=>chests.clips[t.animation].duration,
  urgency:sampleNativeUrgencyWarning,urgencyNodes:urgency.nodes,
  feedback:s=>[...sampleCombatResults(s),...sampleSpecialWeaponFeedback(s),sampleHealingReceipt(s),sampleCoinPickupReceipt(s)].filter(Boolean),
  effects:host=>new CombatEffectDirector(host,graph,.25,{},(view,graph)=>new CombatEffectsView(view,graph),(view,scale)=>new CombatIceTrail(view,scale)),
};


export class CombatView extends NativeBattleView {
    constructor(content, sim, ready, skin) { super(content, sim, ready, skin, sources); }
    advanceCameraView(delta) {
        const s = this.sim;
        if (this.cameraRunId !== s.runId) {
            this.cameraView.setPosition({ x: 0, z: 0 });
            this.mapCameraOffsets.reset();
            this.cameraRunId = s.runId;
            this.cameraTargetRevision = -1;
        }
        if (this.cameraTargetRevision !== s.cameraRevision) {
            // Reduce lateral presentation sway; all entities and drag input share this camera.
            this.cameraView.setTargetPosition({ x: s.cameraPosition.x * .75, z: s.cameraPosition.z });
            this.cameraTargetRevision = s.cameraRevision;
        }
        const previous = this.cameraView.position;
        const position = this.cameraView.update(s.phase === 'playing' ? Math.min(Math.max(delta / 1000, 0), .1) : 0);
        const map = this.content.assets.map.nativeLayers;
        if (map)
            this.mapCameraOffsets.update(map.layers, { x: position.x - previous.x, z: position.z - previous.z }, map.simulationViewMoveDenominator);
    }
    sourceRaycast(q) {
        const zero = this.screen(0, 0), from = { x: (q.origin.x - zero.x) / this.px, z: -(q.origin.y - zero.y) / this.px };
        let distance = q.maxDistance;
        let hit = false;
        let normal = { x: -q.direction.x, y: -q.direction.y };
        for (const edge of [0, WIDTH])
            if (Math.abs(q.direction.x) > 1e-9) {
                const d = (edge - q.origin.x) / q.direction.x, y = q.origin.y + q.direction.y * d;
                if (d >= 0 && d < distance && y >= 0 && y <= HEIGHT) {
                    distance = d;
                    hit = true;
                    normal = { x: edge === 0 ? 1 : -1, y: 0 };
                }
            }
        for (const edge of [0, HEIGHT])
            if (Math.abs(q.direction.y) > 1e-9) {
                const d = (edge - q.origin.y) / q.direction.y, x = q.origin.x + q.direction.x * d;
                if (d >= 0 && d < distance && x >= 0 && x <= WIDTH) {
                    distance = d;
                    hit = true;
                    normal = { x: 0, y: edge === 0 ? 1 : -1 };
                }
            }
        const end = { x: from.x + q.direction.x * distance / this.px, z: from.z - q.direction.y * distance / this.px };
        const ray = { ...end, oldX: from.x, oldZ: from.z, radiusX: 0, radiusZ: 0, box: false, angle: 0 };
        let nearest = 1;
        for (const enemy of this.sim.enemies) {
            if (enemy.dead)
                continue;
            const t = sweep(ray, { ...enemy, oldX: enemy.x, oldZ: enemy.z });
            if (t !== null && t < nearest) {
                nearest = t;
                hit = true;
                const center = this.screen(enemy.x, enemy.z), x = q.origin.x + q.direction.x * distance * t - center.x, y = q.origin.y + q.direction.y * distance * t - center.y, length = Math.hypot(x, y);
                normal = length ? { x: x / length, y: y / length } : { x: -q.direction.x, y: -q.direction.y };
            }
        }
        return { endpoint: { x: q.origin.x + q.direction.x * distance * nearest, y: q.origin.y + q.direction.y * distance * nearest }, hit, normal };
    }
}

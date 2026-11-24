import { resolveTexture, sampleSceneForRender, resource } from '../../../replica-battle/kernel/pathogenic/source-scene-sampler.mjs';
import { trimEmitterHistory } from '../../../replica-battle/kernel/combat-readability.mjs';
import { spriteGeometry, lineGeometry } from '../../../replica-battle/kernel/pathogenic/pathogenic-geometry.mjs';
import { ParticlePlayer } from '../../../replica-battle/kernel/pathogenic/pathogenic-particles.mjs';
import { particleTrailGeometry } from '../../../replica-battle/kernel/pathogenic/pathogenic-particle-trails.mjs';
import { createSourceMeshShaderData, updateSourceMeshShaderData } from '../../../replica-battle/kernel/pathogenic/source-mesh-shader-data.mjs';
import { PathogenicShaderCoverageError } from './battle-material-compiler.ts';
import { BattleEffectsView } from './three-battle-effects-view.js';
import { NativeIceTrail } from './three-ice-trail.js';
export class SourceCoverageError extends Error {
    details;
    constructor(details) {
        super('Pathogenic source features require implementation: ' + JSON.stringify(details));
        this.details = details;
    }
}
function getResource(graph, ref) {
    if (!ref)
        return null;
    if (ref.type && ref.properties)
        return ref;
    const id = typeof ref === 'string' ? ref : ref.$ref;
    if (id && graph.resources[id])
        return graph.resources[id];
    if (ref.$external) {
        const found = Object.values(graph.resources).find((r) => r.source === ref.$external && r.localId === ref.$external);
        if (found)
            return found;
    }
    throw new PathogenicShaderCoverageError(String(id ?? ref.$external), 'unresolved material/texture resource');
}
export function resolveCanvasTexture(graph, ref) {
    const descriptor = ref?.key ? ref : resolveTexture(graph, ref);
    if (ref && !descriptor)
        throw new PathogenicShaderCoverageError(JSON.stringify(ref), 'unresolved source texture');
    if (descriptor?.resource !== 'CanvasTexture')
        return { diffuse: descriptor, normal: null, specular: null, specularColor: [1, 1, 1, 1], shininess: 1, filter: 0, repeat: 0 };
    const p = descriptor.properties ?? graph.resources[descriptor.key]?.properties;
    if (!p)
        throw new PathogenicShaderCoverageError(descriptor.key, 'CanvasTexture properties absent');
    const channel = (name) => { if (!p[name])
        return null; const d = resolveTexture(graph, p[name]); if (!d)
        throw new PathogenicShaderCoverageError(descriptor.key, `unresolved ${name}`); return d; };
    return { diffuse: channel('diffuse_texture'), normal: channel('normal_texture'), specular: channel('specular_texture'), specularColor: p.specular_color ?? [1, 1, 1, 1], shininess: p.specular_shininess ?? 1, filter: p.texture_filter ?? 0, repeat: p.texture_repeat ?? 0 };
}
export class CombatEffectsView extends BattleEffectsView {
    constructor(host, graph) { super(host, graph, { channels: resolveCanvasTexture, resource: getResource, createData: createSourceMeshShaderData, updateData: updateSourceMeshShaderData }); }
    draw(id, path, ctx = {}) {
        const result = sampleSceneForRender(this.graph, path, ctx);
        const unsupported = result.unsupported.filter((x) => x.code !== 'procedural-sprite-texture');
        if (unsupported.length)
            throw new SourceCoverageError(unsupported.map((x) => ({ ...x, scene: path })));
        for (const sprite of result.sprites)
            this.mesh(`${id}:${sprite.nodePath}`, sprite, spriteGeometry(sprite, this.views.get(`${id}:${sprite.nodePath}`)?.spriteShape), this.clock, false, ctx.projectilePalette, ctx);
        for (const line of result.lines) {
            const geometry = lineGeometry(this.graph, line);
            if (geometry.unsupported?.length)
                throw new SourceCoverageError(geometry.unsupported.map((code) => ({ code, scene: path, node: line.nodePath })));
            this.mesh(`${id}:${line.nodePath}`, line, geometry, this.clock, true, ctx.projectilePalette, ctx);
        }
        let player = this.players.get(id);
        if (result.particles.length) {
            if (!player) {
                player = new ParticlePlayer();
                this.players.set(id, player);
            }
            this.livePlayers.add(id);
        }
        for (const node of result.particles) {
            // Store world-space particle history before the camera translation. Camera
            // scrolling must move existing particles, never become emitter motion.
            const [cameraX, cameraY] = this.cameraOffset;
            const worldNode = { ...node, matrix: [...node.matrix] };
            worldNode.matrix[4] -= cameraX;
            worldNode.matrix[5] -= cameraY;
            const key = `${id}:${node.nodePath}`, stored = this.histories.get(key) ?? { samples: [], revision: 0 }, history = stored.samples;
            if (!history.length || history.at(-1).age !== ctx.time) {
                history.push({ age: ctx.time, matrix: worldNode.matrix });
                stored.revision++;
            }
            const historyLength = history.length;
            trimEmitterHistory(history, ctx.time, node.properties);
            if (history.length !== historyLength)
                stored.revision++;
            this.histories.set(key, stored);
            this.liveHistories.add(key);
            const particles = player.sampleReadOnly(this.graph, worldNode, ctx.time, ctx.seed ?? 1, { history, historyRevision: stored.revision,
                stopAge: ctx.stopAge, emitting: ctx.emit ?? node.properties.emitting });
            const ribbons = particleTrailGeometry(this.graph, worldNode, particles.trails, worldNode.matrix, { strict: true });
            if (ribbons.unsupported.length)
                throw new SourceCoverageError(ribbons.unsupported);
            for (const ribbon of ribbons.meshes) {
                ribbon.matrix = [...ribbon.matrix];
                ribbon.matrix[4] += cameraX;
                ribbon.matrix[5] += cameraY;
                for (const vertex of ribbon.vertices) {
                    vertex.position[0] += cameraX;
                    vertex.position[1] += cameraY;
                }
                this.mesh(`${key}:trail:${ribbon.id}`, ribbon, ribbon, this.clock, true, ctx.projectilePalette, ctx);
            }
            const baseTexture = resolveTexture(this.graph, node.properties.texture);
            if (!baseTexture)
                throw new SourceCoverageError([{ code: 'particle-texture', scene: path, node: node.nodePath }]);
            // A node's particles share read-only material parameters for this draw.
            // Resolve lazily after visibility/geometry guards, and keep per-particle
            // texture frames, transforms, color and every GPU upload independent.
            const sharedMaterial = particles.instances.length > 1 ? {} : undefined;
            const material = resource(this.graph, node.material);
            for (const p of ribbons.enabled ? [] : particles.instances) {
                const c = Math.cos(p.rotation), s = Math.sin(p.rotation);
                const particleKey = `${key}:particle:${p.id}`, previous = this.views.get(particleKey);
                // Every retained mesh owns its scratch arrays. GPU draw data and
                // geometry are copied synchronously; source samples remain untouched.
                const draw = previous?.particleDraw ?? { item: {}, matrix: Array(6).fill(0), local: Array(6).fill(0), color: Array(4).fill(0), rect: Array(4).fill(0) };
                const local = draw.local, matrix = draw.matrix;
                local[0] = c * p.scale[0];
                local[1] = s * p.scale[0];
                local[2] = -s * p.scale[1];
                local[3] = c * p.scale[1];
                local[4] = p.position[0];
                local[5] = p.position[1];
                if (p.space === 'world') {
                    for (let i = 0; i < 6; i++)
                        matrix[i] = local[i];
                    matrix[4] += cameraX;
                    matrix[5] += cameraY;
                }
                else {
                    const m = node.matrix;
                    matrix[0] = m[0] * local[0] + m[2] * local[1];
                    matrix[1] = m[1] * local[0] + m[3] * local[1];
                    matrix[2] = m[0] * local[2] + m[2] * local[3];
                    matrix[3] = m[1] * local[2] + m[3] * local[3];
                    matrix[4] = m[0] * local[4] + m[2] * local[5] + m[4];
                    matrix[5] = m[1] * local[4] + m[3] * local[5] + m[5];
                }
                let texture = baseTexture;
                if (material?.type === 'CanvasItemMaterial' && material.properties.particles_animation) {
                    const m = material.properties, h = m.particles_anim_h_frames ?? 1, v = m.particles_anim_v_frames ?? 1;
                    let frame = Math.floor(p.custom[2] * h * v);
                    frame = m.particles_anim_loop ? ((frame % (h * v)) + h * v) % (h * v) : Math.max(0, Math.min(h * v - 1, frame));
                    const crop = baseTexture.crop ?? [0, 0, baseTexture.width, baseTexture.height], w = crop[2] / h, ht = crop[3] / v;
                    texture = { ...baseTexture, width: w, height: ht, crop: [crop[0] + frame % h * w, crop[1] + Math.floor(frame / h) * ht, w, ht] };
                }
                const sprite = Object.assign(draw.item, node);
                draw.rect[0] = -texture.width / 2;
                draw.rect[1] = -texture.height / 2;
                draw.rect[2] = texture.width;
                draw.rect[3] = texture.height;
                for (let i = 0; i < 4; i++)
                    draw.color[i] = p.color[i] * node.color[i];
                sprite.texture = texture;
                sprite.matrix = matrix;
                sprite.localRect = draw.rect;
                sprite.color = draw.color;
                this.mesh(particleKey, sprite, spriteGeometry(sprite, previous?.spriteShape), this.clock, false, ctx.projectilePalette, ctx, sharedMaterial);
                const rendered = previous ?? this.views.get(particleKey);
                if (rendered)
                    rendered.particleDraw = draw;
            }
        }
        return result;
    }
}
export class CombatIceTrail extends NativeIceTrail {
    projectile(b, screen) {
        const saw = b.familyId === 200141 && b.modelId === 1000009;
        const blade = b.familyId === 200031 && [1000032, 1000006].includes(b.modelId);
        if (b.owner !== 'player' || b.dead || b.visualHidden || !(b.scale > 0) || (!saw && !blade) || b.age < (b.warmup ?? 0) || b.age < 0 || b.age >= b.lifetime)
            return;
        const p = screen(b.x, b.z), x = p.x - this.camera[0], y = p.y - this.camera[1];
        const target = screen(b.x + (b.vx ?? 0), b.z + (b.vz ?? 0));
        let dx = target.x - p.x, dy = target.y - p.y;
        const length = Math.hypot(dx, dy);
        if (![x, y, length].every(Number.isFinite) || blade && length <= .001)
            return;
        if (length > .001) {
            dx /= length;
            dy /= length;
        }
        else {
            dx = 0;
            dy = -1;
        }
        let e = this.emitters.get(b.uid);
        if (!e || this.clock - e.at > .2 || Math.hypot(x - e.x, y - e.y) > 180) {
            e = { x, y, at: this.clock, next: this.clock, seq: 0, hits: new Map() };
            this.emitters.set(b.uid, e);
        }
        const fragment = blade && b.weaponId === 200038;
        const factor = Math.min(1.8, Math.max(.7, b.scale ?? 1)), interval = saw ? .04 : fragment ? .10 : .05;
        // Match the existing view-only body transform, not the combat radius.
        const bladeHalf = 1254 * .16 * this.sourcePixelScale * 1.15 * (b.scale ?? 1) / 2;
        // Match the displayed 1254px saw sprite, outside its opaque serrated rim.
        const sawRadius = 1254 * .12 * this.sourcePixelScale * .8 * (b.scale ?? 1) / 2;
        const visible = p.x > -80 && p.y > -80 && p.x < (this.scene.stage.width ?? 540) + 80 && p.y < (this.scene.stage.height ?? 960) + 80;
        if (visible) {
            for (let count = 0; e.next <= this.clock + 1e-8 && count < 6; count++, e.next += interval) {
                const t = this.clock === e.at ? 1 : Math.max(0, Math.min(1, (e.next - e.at) / (this.clock - e.at))), px = e.x + (x - e.x) * t, py = e.y + (y - e.y) * t;
                const r = this.random(b.uid, e.seq++);
                if (saw) {
                    // Emit around the rotating edge instead of hiding the entire wake
                    // underneath the disc. Detached shards stay in world space.
                    for (let i = 0; i < 2; i++) {
                        const a = e.next * Math.PI * 4 + r * Math.PI + i * Math.PI, nx = Math.cos(a), ny = Math.sin(a), rim = sawRadius + 5 * factor;
                        this.add('chips', px + nx * rim, py + ny * rim, nx * 30 - ny * 18, ny * 30 + nx * 18, [21 * factor, 21 * factor], a, e.next, .42, .95);
                    }
                    const side = (r - .5) * sawRadius, back = sawRadius + 10 * factor;
                    this.add('trace', px - dx * back - dy * side, py - dy * back + dx * side, -dx * 20, -dy * 20, [23 * factor, 42 * factor], Math.atan2(dy, dx) + Math.PI / 2, e.next, .34, .65);
                    continue;
                }
                // Alternate the two tips. Short detached frost replaces the long bright
                // central threads; secondary split blades carry a lighter particle load.
                const sign = e.seq % 2 ? 1 : -1, side = sign * bladeHalf * .92, back = bladeHalf * .16 + 3 * factor;
                const sx = px - dx * back - dy * side, sy = py - dy * back + dx * side, rotation = Math.atan2(dy, dx) + Math.PI / 2;
                const stretch = Math.min(1.2, Math.max(.8, length / 600));
                if (!fragment || e.seq % 2 === 0)
                    this.add('mist', sx - dx * 4, sy - dy * 4, -dx * 12 - dy * sign * 5, -dy * 12 + dx * sign * 5, [36 * factor, 50 * factor * stretch], rotation, e.next, .24, fragment ? .24 : .46);
                if (!fragment)
                    this.add('streak', sx, sy, -dx * 14, -dy * 14, [13 * factor, 34 * factor * stretch], rotation, e.next, .16, .70);
                const spread = sign * (8 + r * 9);
                this.add('spark', sx, sy, -dx * 10 - dy * spread, -dy * 10 + dx * spread, [8 * factor, (11 + r * 5) * factor], rotation + (r - .5) * .4, e.next, .20 + r * .04, fragment ? .52 : .85);
                // Tiny solid ice flecks peel outward from the tips. Their short lives
                // share the same bounded pool; split children emit only every other tick.
                if (!fragment || e.seq % 2 === 0) {
                    const outward = sign * (12 + r * 14), jitter = (r - .5) * 5 * factor;
                    this.add('flake', sx - dy * jitter, sy + dx * jitter, -dx * 12 - dy * outward, -dy * 12 + dx * outward, [(5 + r * 2) * factor, (7 + r * 2) * factor], rotation + r * 2, e.next, .24 + r * .06, fragment ? .58 : .86);
                }
                // A quiet central frost wake starts at the inner rear edge, behind the
                // already-approved body. It is diffuse rather than another bright thread.
                if (!fragment && e.seq % 2 === 0) {
                    const tail = bladeHalf * .16;
                    this.add('mist', px + dx * tail, py + dy * tail, -dx * 18, -dy * 18, [52 * factor, 64 * factor * stretch], rotation, e.next, .22, .24);
                }
            }
            if (b.hitTimes instanceof Map)
                for (const [id, at] of b.hitTimes) {
                    if (e.hits.get(id) === at)
                        continue;
                    e.hits.set(id, at);
                    // Ignore historical contacts first observed long after they happened.
                    if (b.age - at > .12)
                        continue;
                    const count = fragment ? 2 : 4;
                    for (let i = 0; i < count; i++) {
                        const angle = i * Math.PI * 2 / count + this.random(b.uid, i), vx = Math.cos(angle) * 30, vy = Math.sin(angle) * 30;
                        this.add('chips', x, y, vx, vy, [11 * factor, 11 * factor], angle, this.clock, .17, fragment ? .45 : .72);
                    }
                }
        }
        else
            e.next = this.clock + interval;
        e.x = x;
        e.y = y;
        e.at = this.clock;
    }
}

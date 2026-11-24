import {clamp,smooth,supplyChestPose,supplyCanopyTransform,traceSupplyCords} from "../../../replica-battle/kernel/supply-chest-pose";
const SIZE=76;
const canopyCordAnchors = [[0.08,0.7586],[0.2743,0.7816],[0.7257,0.7701],[0.92,0.7586]];

export function updateSupplyChestVisual(view, chest, duration, animationAge) {
    const pose = supplyChestPose(chest, duration, animationAge), image = view.userData['supplyChestBody'];
    const bodyHeight = view.userData['supplyChestHeight'] || SIZE;
    ((node)=>{node.position.set(pose.x,pose.y,0);node.material.uniforms.size.value.set(SIZE * pose.scale,bodyHeight * pose.scale);node.rotation.z=pose.rotation;node.material.uniforms.opacity.value=pose.alpha;return node})(image);
    const fx = view.userData['supplyChestLights'];
    if (!fx)
        return;
    const tip = 18 - (1 - pose.fall) * fx.height;
    ((node)=>{node.position.set(0,tip,0);node.material.uniforms.size.value.set(70,fx.height);node.material.uniforms.opacity.value=pose.beam * .04;return node})(fx.halo);
    ((node)=>{node.position.set(0,tip,0);node.material.uniforms.size.value.set(12,fx.height);node.material.uniforms.opacity.value=pose.beam * .08;return node})(fx.beam);
    ((node)=>{node.material.uniforms.size.value.set(110 + pose.flash * 70,42 + pose.flash * 24);node.material.uniforms.opacity.value=pose.flash * .35;return node})(fx.impact);
    ((node)=>{node.material.uniforms.opacity.value=pose.idle * (.15 + Math.sin(pose.age * 2.4) * .025);return node})(fx.idle);
    for (const [i, ring] of fx.rings.entries()) {
        const p = i === 0 ? pose.ringA : pose.ringB, size = 34 + p * (i === 0 ? 160 : 215);
        const ready = pose.active && pose.time > (i === 0 ? .98 : 1.05) && p < 1;
        ((node)=>{node.position.set(0,19,0);node.material.uniforms.size.value.set(size,size * .30);node.material.uniforms.opacity.value=ready ? Math.sin(p * Math.PI) * (i === 0 ? .32 : .22) : 0;return node})(ring);
    }
    for (const [i, streak] of fx.streaks.entries()) {
        const p = (pose.time - .018 - i * .032) / (.21 + (i % 3) * .025), visible = pose.active && p > 0 && p < 1;
        ((node)=>{node.position.set(Math.sin(i * 7.31) * 27,18 - (1 - clamp(p)) * fx.height,0);node.material.uniforms.size.value.set(2 + i % 3,80 + i % 4 * 28);node.material.uniforms.opacity.value=visible ? Math.sin(p * Math.PI) * .22 : 0;return node})(streak);
    }
    fx.sparks.clear();
    for (let i = 0; i < 18; i++) {
        const p = (pose.time - 1.01 - (i % 4) * .018) / (.28 + (i % 5) * .025);
        if (!pose.active || p <= 0 || p >= 1)
            continue;
        const angle = i * 2.399963, radius = 12 + p * (28 + (i % 4) * 12);
        const x = Math.cos(angle) * radius, y = 17 + Math.sin(angle) * radius * .32 - Math.sin(p * Math.PI) * (16 + i % 3 * 14);
        const size = 1 + (1 - p) * 2, alpha = Math.sin(p * Math.PI) * (1 - p) * .9;
        ((pen)=>{pen.line(x,y - size,x,y + size,...pen.userData.stroke);return pen})(((pen)=>{pen.line(x - size,y,x + size,y,...pen.userData.stroke);return pen})(((pen)=>{pen.userData.stroke=[1,0xffecc2,alpha];return pen})(fx.sparks)));
    }
    for (const [i, dust] of fx.dust.entries()) {
        const p = (pose.time - 1.01 - i * .025) / .42, visible = pose.active && p > 0 && p < 1, t = clamp(p);
        const side = i % 2 ? -1 : 1;
        ((node)=>{node.position.set(side * (8 + t * (22 + i * 5)),20 - t * (15 + i * 2),0);node.material.uniforms.size.value.set(18 + t * 48,10 + t * 24);node.material.uniforms.opacity.value=visible ? Math.sin(p * Math.PI) * .28 : 0;return node})(dust);
    }
    const canopy = supplyCanopyTransform(pose, bodyHeight);
    fx.canopy.position.set(canopy.x, canopy.y, 0);
    fx.canopy.material.uniforms.size.value.set(canopy.width, canopy.height);
    fx.canopy.rotation.z = canopy.rotation;
    fx.canopy.material.uniforms.opacity.value = pose.canopyAlpha;

    fx.cords.clear();
    if (fx.canopy.visible && canopy.cordAlpha > 0) {
        traceSupplyCords(pose, bodyHeight, canopy, canopyCordAnchors, (x, y, endX, endY) => {
            fx.cords.line(x, y, endX, endY, 2.6, 0x243b3b, canopy.cordAlpha * .65);
            fx.cords.line(x, y, endX, endY, 1.1, 0xe6dec5, canopy.cordAlpha * .9);
        });
    }
    // Fixed-size pool, analytic simulation-age sampling. Pausing cannot emit
    // extra smoke; an early pickup hides all puffs in this same frame.
    const smokeAge = Math.max(0, pose.smokeTime - 1.01), cycle = 2.6;
    for (let i = 0; i < fx.smoke.length; i++) {
        const elapsed = smokeAge - i * cycle / fx.smoke.length;
        const p = ((elapsed % cycle) + cycle) % cycle / cycle;
        const visible = elapsed >= 0 && pose.smokeStrength > 0;
        const size = 17 + p * 62;
        ((node)=>{node.position.set(-28 - p * 28 + Math.sin(p * 7 + i * .9) * 10 * p,14 - p * 142,0);node.material.uniforms.size.value.set(size,size * 1.12);node.rotation.z=i * 2.399963 + p * .7;node.material.uniforms.opacity.value=visible ? smooth(0, .08, p) * (1 - smooth(.52, 1, p)) * .55 : 0;return node})(fx.smoke[i]);
    }
}

import { BackSide, Color, EdgesGeometry, LineBasicMaterial, LineSegments, Mesh, ShaderMaterial, Vector3 } from 'three';

// Each lobby instance owns these materials. Restore every override when the
// shared preview canvas moves to a catalog, workshop, patrol or battle page.
export function createEquipmentAircraftStyle(root) {
  const materials = new Map(), meshes = [], outlines = [];
  const inkMaterial = new LineBasicMaterial({ color: '#243d53', transparent: true, opacity: .34, depthWrite: false, toneMapped: false });
  const silhouetteMaterial = new ShaderMaterial({
    side: BackSide, depthWrite: false, toneMapped: false,
    vertexShader: `void main() {
      vec4 p = modelViewMatrix * vec4(position, 1.);
      p.xyz += normalize(normalMatrix * normal) * .028;
      gl_Position = projectionMatrix * p;
    }`,
    fragmentShader: `void main() { gl_FragColor = vec4(.09, .15, .21, 1.); }`,
  });
  root.traverse(object => {
    if (!object.isMesh) return;
    meshes.push([object, object.castShadow, object.receiveShadow]);
    for (const material of [].concat(object.material || [])) {
      if (!material.isMeshStandardMaterial || materials.has(material)) continue;
      const state = {};
      for (const key of ['metalness','roughness','envMapIntensity','transmission','clearcoat','clearcoatRoughness']) {
        if (key in material) state[key] = material[key];
      }
      materials.set(material, { state, color: material.color.clone(), detail: material.userData.finishDetail?.value });
      // A's illustrated finish has dark grazing edges. Keep the actual mesh,
      // lighting and equipped parts; fade this shader treatment out on other pages.
      const compile = material.onBeforeCompile, cacheKey = material.customProgramCacheKey();
      const ink = { value: 0 }, glass = { value: 0 };
      material.userData.equipmentInk = ink;
      material.userData.equipmentGlass = glass;
      material.onBeforeCompile = function(shader, renderer) {
        compile.call(this, shader, renderer);
        shader.uniforms.uEquipmentInk = ink;
        shader.uniforms.uEquipmentGlass = glass;
        shader.fragmentShader = 'uniform float uEquipmentInk;\nuniform float uEquipmentGlass;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
          // Broad, softly stepped value groups keep armor readable at UI size.
          // The original physical response still contributes highlights/shadows.
          vec3 equipmentKey = normalize((viewMatrix * vec4(-.42, .82, -.38, 0.)).xyz);
          float equipmentLambert = dot(normal, equipmentKey) * .5 + .5;
          float equipmentValue = .48
            + .25 * smoothstep(.25, .45, equipmentLambert)
            + .27 * smoothstep(.58, .80, equipmentLambert);
          vec3 equipmentTint = mix(vec3(.68, .82, 1.), vec3(1.), equipmentLambert);
          vec3 equipmentPaint = diffuseColor.rgb * equipmentTint * equipmentValue * 1.28;
          outgoingLight = mix(outgoingLight, equipmentPaint, .56 * uEquipmentInk);
          float equipmentFacing = abs(dot(normal, normalize(vViewPosition)));
          float equipmentEdge = (1. - smoothstep(.06, .18, equipmentFacing)) * .30 * uEquipmentInk;
          outgoingLight = mix(outgoingLight, vec3(.028, .055, .09), equipmentEdge);
          // A broad cool reflection replaces the tiny warm studio glints on the canopy.
          float glassSweep = normal.x + normal.y * .45;
          float glassReflection = smoothstep(-.30, -.17, glassSweep) * (1. - smoothstep(-.02, .10, glassSweep));
          vec3 glassPaint = mix(vec3(.006, .018, .045), vec3(.015, .065, .15), equipmentFacing);
          glassPaint += vec3(.10, .22, .34) * glassReflection;
          outgoingLight = mix(outgoingLight, glassPaint, .85 * uEquipmentGlass);
          #include <opaque_fragment>
        `);
      };
      material.customProgramCacheKey = () => `${cacheKey}/equipment-ink-v4`;
      material.needsUpdate = true;
    }
  });
  // Trace authored hard edges, not triangle wireframes. Parent each overlay to
  // its source so articulated parts and equipped weapons keep their transforms.
  root.updateWorldMatrix(true, true);
  for (const [mesh] of meshes) {
    if (mesh.isInstancedMesh || mesh.isSkinnedMesh || Array.isArray(mesh.material)) continue;
    const material = mesh.material;
    if (!material?.isMeshStandardMaterial || material.transparent || material.opacity < 1) continue;
    if (/Detail|light|glow|emissive/i.test(material.name)) continue;
    mesh.geometry.computeBoundingBox();
    const size = mesh.geometry.boundingBox.getSize(new Vector3());
    const scale = mesh.getWorldScale(new Vector3());
    if (size.multiply(scale).length() < .65) continue;
    const silhouette = new Mesh(mesh.geometry, silhouetteMaterial);
    silhouette.name = 'equipment-silhouette'; silhouette.visible = false;
    silhouette.raycast = () => {};
    mesh.add(silhouette); outlines.push(silhouette);
    // Restrict crease lines to armor. Thin weapon barrels only need a silhouette.
    if (!/\/(shell|white|bright|accent)$|pearl ceramic/.test(material.name)) continue;
    const geometry = new EdgesGeometry(mesh.geometry, 38);
    if (!geometry.attributes.position.count) { geometry.dispose(); continue; }
    const outline = new LineSegments(geometry, inkMaterial);
    outline.name = 'equipment-structure-ink'; outline.visible = false;
    outline.renderOrder = mesh.renderOrder + 1;
    outline.raycast = () => {};
    mesh.add(outline); outlines.push(outline);
  }
  let active = false;
  return {
    setEnabled(enabled) {
      if (active === enabled) return;
      active = enabled;
      for (const outline of outlines) outline.visible = enabled;
      for (const [material, {state, color, detail}] of materials) {
        Object.assign(material, state); material.color.copy(color);
        material.userData.equipmentInk.value = enabled && !/\/glass$/.test(material.name) ? 1 : 0;
        material.userData.equipmentGlass.value = enabled && /\/glass$/.test(material.name) ? 1 : 0;
        if (detail !== undefined) material.userData.finishDetail.value = enabled ? .18 : detail;
        if (enabled) {
          const name = material.name || '', role = name.split('/').at(-1);
          if (['shell','white','bright','accent'].includes(role) || /pearl ceramic/.test(name)) {
            material.metalness = .05; material.roughness = .65; material.envMapIntensity = .32;
            if (['white','bright'].includes(role) || /pearl ceramic/.test(name)) material.color.lerp(new Color('#f3f5f6'), .40);
          } else if (['dark','black'].includes(role) || /deep graphite/.test(name)) {
            material.metalness = .12; material.roughness = .6; material.envMapIntensity = .4;
          } else if (role === 'glass') {
            material.color.lerp(new Color('#124e78'), .55);
            material.metalness = .05; material.roughness = .20; material.envMapIntensity = 1.15;
            if ('transmission' in material) material.transmission = 0;
            if ('clearcoat' in material) { material.clearcoat = 1; material.clearcoatRoughness = .18; }
          } else {
            material.roughness = Math.max(.32, material.roughness);
            material.envMapIntensity = Math.min(.9, material.envMapIntensity);
          }
        }
        // Physical material transmission can change shader defines.
        material.needsUpdate = true;
      }
      for (const [mesh, cast, receive] of meshes) {
        const opaque = [].concat(mesh.material || []).some(m => m.isMeshStandardMaterial && !m.transparent);
        mesh.castShadow = enabled ? opaque : cast;
        mesh.receiveShadow = enabled ? opaque : receive;
      }
    },
    dispose() {
      this.setEnabled(false);
      for (const outline of outlines) {
        outline.removeFromParent();
        // Silhouettes borrow their parent's immutable geometry.
        if (outline.isLineSegments) outline.geometry.dispose();
      }
      outlines.length = 0; inkMaterial.dispose(); silhouetteMaterial.dispose();
    },
  };
}

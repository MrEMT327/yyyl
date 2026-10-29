import * as T from 'three';

// Preview-only materials; no textures or cached combat materials are mutated.
export function createBlueprintSurface(asset) {
  const material=new T.MeshBasicMaterial({color:0x103654,side:T.DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 blueprintPosition;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nblueprintPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader='varying vec3 blueprintPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 gridUV = blueprintPosition.xz * 1.5;
      vec2 grid = abs(fract(gridUV - 0.5) - 0.5) / max(fwidth(gridUV), vec2(0.001));
      float fine = 1.0 - min(min(grid.x, grid.y), 1.0);
      vec2 majorUV = gridUV / 5.0;
      vec2 majorGrid = abs(fract(majorUV - 0.5) - 0.5) / max(fwidth(majorUV), vec2(0.001));
      float major = 1.0 - min(min(majorGrid.x, majorGrid.y), 1.0);
      diffuseColor.rgb = mix(vec3(0.018, 0.065, 0.12), vec3(0.09, 0.24, 0.34), fine * 0.48 + major * 0.4);
    `);
  };
  const ink=new T.LineBasicMaterial({color:0x70bdd4,transparent:true,opacity:.38,depthWrite:false});
  const original=[],lines=[];let edgeBudget=35000;
  asset.solid.traverse(node=>{
    if(!node.isMesh)return;
    original.push([node,node.material]);node.material=material;
    const count=node.geometry?.attributes.position?.count||0;
    if(count>0&&count<5000&&count<edgeBudget){edgeBudget-=count;const line=new T.LineSegments(new T.EdgesGeometry(node.geometry,30),ink);lines.push([node,line]);}
  });
  for(const [node,line] of lines)node.add(line);
  asset.fx.visible=false;
  return {dispose(){for(const [node,old] of original)node.material=old;for(const [,line] of lines){line.removeFromParent();line.geometry.dispose();}material.dispose();ink.dispose();}};
}

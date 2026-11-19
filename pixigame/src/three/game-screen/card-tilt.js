export function tiltMaterial(mesh,shared,center,distance=950){
  const previous=mesh.material.onBeforeCompile,key=mesh.material.customProgramCacheKey();
  mesh.material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    shader.uniforms.cardPlane=shared;shader.uniforms.cardCenter=center;shader.uniforms.cardDistance={value:distance};
    shader.vertexShader='uniform vec3 cardPlane;uniform vec2 cardCenter;uniform float cardDistance;\n'+shader.vertexShader.replace('#include <project_vertex>',[
      '#include <project_vertex>',
      'vec2 d=mvPosition.xy-cardCenter;float ax=cardPlane.x,ay=cardPlane.y;',
      'vec2 moved=vec2(d.x*cos(ay),d.y*cos(ax)+d.x*sin(ax)*sin(ay));',
      'float z=d.y*sin(ax)-d.x*sin(ay)*cos(ax);',
      'mvPosition.xy=cardCenter+moved*(cardDistance/(cardDistance-z));gl_Position=projectionMatrix*mvPosition;'
    ].join('\n'));
  };
  mesh.material.customProgramCacheKey=()=>key+'|card-tilt';
}

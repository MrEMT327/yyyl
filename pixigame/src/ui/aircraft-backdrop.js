import * as T from 'three';

// The near hangar opening and distant scenery are independent layers. For this
// art pass the distance stays empty; the actual alpha opening reveals the quiet
// field below it. Nine-slice sizing keeps the machinery close to phone edges.
export function renderAircraftBackdrop(surface, texture, { studio = false } = {}) {
  surface.quad(-600, 0, 1800, 1300, '#0c131d');
  const field = surface.quad(-600, 0, 1800, 1300, '#ffffff');
  field.name = studio ? 'clean-assembly-backdrop' : 'quiet-aircraft-backdrop';
  field.material.dispose();
  field.material = new T.ShaderMaterial({
    uniforms: {
      centre: { value: new T.Color(studio ? '#26313b' : '#212d38') },
      edge: { value: new T.Color('#0c131d') },
      opacity: { value: 1 },
    },
    vertexShader: 'varying vec2 uvPosition; void main(){uvPosition=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 uvPosition;
      uniform vec3 centre; uniform vec3 edge; uniform float opacity;
      void main(){
        vec2 p=(uvPosition-vec2(.5,.57))*vec2(3.0,1.5);
        float light=exp(-dot(p,p)*2.7);
        gl_FragColor=vec4(mix(edge,centre,light),opacity);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: T.DoubleSide,
  });
  if (texture) {
    const sourceX = [0, .16, .84, 1], sourceY = [0, .08, .85, 1];
    const x = [0, 40, 560, 600], y = [0, 64, 1186, 1300];
    for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
      const frame = surface.image(texture, x[column], y[row], x[column + 1] - x[column], y[row + 1] - y[row], {
        x: sourceX[column], y: sourceY[row], width: sourceX[column + 1] - sourceX[column], height: sourceY[row + 1] - sourceY[row],
      });
      frame.name = 'hangar-opening-frame';
    }
  }
}

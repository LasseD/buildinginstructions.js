'use strict';

LDR.TriangleVertexShader = `
  precision mediump float;

  uniform vec4 color;
  uniform mat4 projectionMatrix;
  uniform mat4 modelViewMatrix;

  attribute vec3 position;

  varying vec4 vColor;

  void main() {
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

LDR.LineVertexShader = `
  precision mediump float;

  uniform vec4 color;
  uniform mat4 projectionMatrix;
  uniform mat4 modelViewMatrix;

  attribute vec3 position;

  varying vec4 vColor;

  void main() {
    vColor = color;
    vec4 xPosition = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    xPosition.w -= 0.000001;
    gl_Position = xPosition;
  }
`;

// See 'http://www.ldraw.org/article/218.html' for specification of optional/conditional lines.
// A conditional line is drawn when the camera sees p3 and p4 on same side of line p1 p2.
LDR.ConditionalLineVertexShader = `
  precision mediump float;

  uniform vec4 color;
  uniform mat4 projectionMatrix;
  uniform mat4 modelViewMatrix;

  attribute vec3 position;
  attribute vec3 p2;
  attribute vec3 p3;
  attribute vec3 p4;

  varying vec4 vColor;

  void main() {
      mat4 m = projectionMatrix * modelViewMatrix;
      vec4 p1 = m * vec4(position, 1.0);
      vec2 xp1 = p1.xy;
      vec2 d12 = vec4(m * vec4(p2, 1.0)).xy - xp1;
      vec2 d13 = vec4(m * vec4(p3, 1.0)).xy - xp1;
      vec2 d14 = vec4(m * vec4(p4, 1.0)).xy - xp1;
      
      vColor = color;
      if((d12.x*d13.y - d12.y*d13.x)*(d12.x*d14.y - d12.y*d14.x) < 0.0) {
	  vColor.a = 0.0;
      }

      gl_Position = p1;
  }
`;

LDR.SimpleFragmentShader = `
  precision lowp float;

  varying vec4 vColor;

  void main() {
      gl_FragColor = vColor;
  }
`;

LDR.AlphaTestFragmentShader = `
  precision lowp float;

  varying vec4 vColor;

  void main() {
      if(vColor.a <= 0.001)
	  discard;
      gl_FragColor = vColor;
  }
`;

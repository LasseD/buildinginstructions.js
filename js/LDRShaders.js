'use strict';

LDR.TriangleVertexShader = `
  precision highp float;
  precision mediump int;

  uniform vec4 colors[2480];
  uniform int old; // 0=no, 1=old
  uniform int type; // 0=oldIsNormal, 1=oldIsDefaultColor, 2=oldIsDimmed

  uniform mat4 projectionMatrix;
  uniform mat4 modelViewMatrix;

  attribute vec4 position;

  varying vec4 vColor;

  void main() {
      vColor = colors[5*int(position.w)+old*type];

      gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1.0);
      gl_Position.w -= 0.000001;
  }
`;

LDR.LineVertexShader = `
  precision highp float;
  precision mediump int;

  uniform vec4 colors[2480];
  uniform int highContrast; // 3=no, 4=yes
  uniform int old; // 0=no, 1=old
  uniform int type; // 0=oldIsNormal, 1=oldIsDefaultColor, 2=oldIsDimmed

  uniform mat4 projectionMatrix;
  uniform mat4 modelViewMatrix;

  attribute vec4 position;

  varying vec4 vColor;

  void main() {
      float colorIndex = position.w;
      if(colorIndex < 0.0) // Edge:
	  vColor = colors[-5*int(colorIndex)+highContrast];
      else
	  vColor = colors[5*int(colorIndex)+old*type];

      gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1.0);
      gl_Position.w -= 0.000002;
  }
`;

// See 'http://www.ldraw.org/article/218.html' for specification of optional/conditional lines.
// A conditional line is drawn when the camera sees p3 and p4 on same side of line p1 p2.
LDR.ConditionalLineVertexShader = `
  precision highp float;
  precision mediump int;

  uniform vec4 colors[2480];
  uniform int highContrast; // 3=no, 4=yes
  uniform int old; // 0=no, 1=old
  uniform int type; // 0=oldIsNormal, 1=oldIsDefaultColor, 2=oldIsDimmed

  uniform mat4 projectionMatrix;
  uniform mat4 modelViewMatrix;

  attribute vec3 position;
  attribute vec3 p2;
  attribute vec3 p3;
  attribute vec3 p4;
  attribute float colorIndex; // Should have been an int... but GLSL doesn't support that.

  varying vec4 vColor;

  void main() {
      mat4 m = projectionMatrix * modelViewMatrix;

      gl_Position = m * vec4(position, 1.0);

      vec2 xp1 = gl_Position.xy;
      vec2 d12 = vec4(m * vec4(p2, 1.0)).yx - xp1.yx;
      d12.y = -d12.y;
      vec2 d13 = vec4(m * vec4(p3, 1.0)).xy - xp1;
      vec2 d14 = vec4(m * vec4(p4, 1.0)).xy - xp1;
      
      // Compute color:
      if(colorIndex < 0.0) // Edge:
	  vColor = colors[-5*int(colorIndex)+highContrast];
      else
	  vColor = colors[5*int(colorIndex)+old*type];
      vColor.a *= sign(dot(d12, d13)*dot(d12, d14));
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

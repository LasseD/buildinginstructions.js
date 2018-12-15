'use strict';

LDR.Shader = {};

LDR.Shader.createShaderHeader = function(defaultColorId, defaultIsEdge) {
    var ret = "precision highp float;precision mediump int;uniform bool old;";

    var colorObject = LDR.Colors[defaultColorId];
    var color = new THREE.Color(defaultIsEdge ? colorObject.edge : colorObject.value);
    var alpha = colorObject.alpha ? colorObject.alpha/256.0 : 1.0;
    ret += "const vec4 defaultColor = vec4(" + color.r + "," + color.g + "," + color.b + "," + alpha + ");";

    return ret;
}

LDR.Shader.shaderBody = `
  uniform mat4 projectionMatrix;
  uniform mat4 modelViewMatrix;
  attribute vec4 position;
  varying vec4 vColor;
  void main() {
      vColor = old ? defaultColor : colors[int(position.w)];
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1.0);
`;

LDR.Shader.createSimpleVertexShader = function(numberOfColors, push, defaultColorId, defaultIsEdge) {
    var ret = LDR.Shader.createShaderHeader(defaultColorId, defaultIsEdge);
    ret += "  uniform vec4 colors[" + numberOfColors + "];";
    ret += LDR.Shader.shaderBody;
    if(push)
	ret += "gl_Position.w -= 0.000002;";
    ret += "  }";
    return ret;
}

LDR.Shader.conditionalShaderBody = `
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
      vColor = colors[int(colorIndex)];
      vColor.a *= sign(dot(d12, d13)*dot(d12, d14));
`;

// See 'http://www.ldraw.org/article/218.html' for specification of optional/conditional lines.
// A conditional line is drawn when the camera sees p3 and p4 on same side of line p1 p2.
LDR.Shader.createConditionalVertexShader = function(numberOfColors, push, defaultColorId, defaultIsEdge) {
    var ret = LDR.Shader.createShaderHeader(defaultColorId, defaultIsEdge);
    ret += "  uniform vec4 colors[" + numberOfColors + "];";
    ret += LDR.Shader.conditionalShaderBody;
    if(push)
	ret += "gl_Position.w -= 0.000002;";
    ret += "  }";
    return ret;
}

LDR.Shader.SimpleFragmentShader = `
  precision lowp float;

  varying vec4 vColor;

  void main() {
      gl_FragColor = vColor;
  }
`;

LDR.Shader.AlphaTestFragmentShader = `
  precision lowp float;

  varying vec4 vColor;

  void main() {
      if(vColor.a <= 0.001)
	  discard;
      gl_FragColor = vColor;
  }
`;

'use strict';

LDR.Shader = {};

LDR.Shader.createSimpleVertexShader = function(defaultIsEdge, hasTexmap) {
    const KEY = 'SIMPLE' + (defaultIsEdge ? 2 : 0) + (hasTexmap ? 4 : 0);
    if(LDR.Shader.hasOwnProperty(KEY)) {
        return LDR.Shader[KEY];
    }
    
    const canBeOld = LDR.Colors.canBeOld;
    let ret = 'precision highp float;precision mediump int;';

    if(canBeOld) {
	ret += "  uniform bool old;\n";
	let oldColor = new THREE.Color(defaultIsEdge ? LDR.Colors[16].edge : LDR.Colors[16].value);
	ret += "  const vec4 oldColor = vec4(" + oldColor.r + "," + oldColor.g + "," + oldColor.b + ",1);\n";
    }

    ret += "  uniform vec4 color;uniform mat4 projectionMatrix;uniform mat4 modelViewMatrix;\n";
    if(hasTexmap) {
        ret += "  attribute vec2 uv;\n";
        ret += "  varying vec2 vuv;\n";
    }

    ret += '  attribute vec3 position;varying vec4 vColor;void main(){';
    ret += "    vColor = ";
    if(canBeOld)
	ret += "old ? oldColor : ";
    ret += "color;\n";
    ret += "    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);";

    if(hasTexmap) {
        ret += "  vuv=uv;\n";
    }    
    ret += "  }";

    LDR.Shader[KEY] = ret;
    return ret;
}

// See 'http://www.ldraw.org/article/218.html' for specification of optional/conditional lines.
// A conditional line is drawn when the camera sees p3 and p4 on same side of line p1 p2.
LDR.Shader.createConditionalVertexShader = function() {
    const canBeOld = LDR.Colors.canBeOld;

    const KEY = 'COND';
    if(LDR.Shader.hasOwnProperty(KEY)) {
        return LDR.Shader[KEY];
    }

    let ret = 'precision highp float;precision mediump int;';

    if(canBeOld) {
	ret += "  uniform bool old;\n";
	let oldColor = new THREE.Color(LDR.Colors[16].edge);
	ret += "  const vec4 oldColor = vec4(" + oldColor.r + "," + oldColor.g + "," + oldColor.b + ",1);\n";
    }

    ret += 'uniform mat4 projectionMatrix;uniform mat4 modelViewMatrix;attribute vec3 position;attribute vec3 p2;attribute vec3 p3;attribute vec3 p4;';    
    ret += "  uniform vec4 color;\n";
    ret += 'varying vec4 vColor;void main(){mat4 m=projectionMatrix*modelViewMatrix;gl_Position=m*vec4(position,1.0);vec2 xp1=gl_Position.xy;vec2 d12=vec4(m*vec4(p2,1.0)).yx-xp1.yx;d12.y=-d12.y;vec2 d13=vec4(m*vec4(p3,1.0)).xy-xp1;vec2 d14=vec4(m*vec4(p4,1.0)).xy-xp1;vColor=';
    // Compute color:
    if(canBeOld)
	ret += "old ? oldColor : ";

    ret += "color;";
    ret += "\n        vColor.a *= sign(dot(d12, d13)*dot(d12, d14));";
    ret += "\n      }";

    LDR.Shader[KEY] = ret;
    return ret;
}

LDR.Shader.SimpleFragmentShader = 'precision lowp float;varying vec4 vColor;void main(){gl_FragColor=vColor;}';

LDR.Shader.AlphaTestFragmentShader = 'precision lowp float;varying vec4 vColor;void main(){if(vColor.a <= 0.001)discard;gl_FragColor = vColor;}';

LDR.Shader.TextureFragmentShader = 'precision lowp float;varying vec4 vColor;varying vec2 vuv;uniform sampler2D map;void main(){if(vuv.x >= 0.0 && vuv.x <= 1.0 && vuv.y >= 0.0 && vuv.y <= 1.0){gl_FragColor = texture2D(map,vuv);if(gl_FragColor.a < 1.0){gl_FragColor=mix(gl_FragColor,vColor,1.0-gl_FragColor.a);}}else{gl_FragColor=vColor;}}';

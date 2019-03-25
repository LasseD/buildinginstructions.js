'use strict';

LDR.Colors.getHighContrastColor4 = function(colorID) {
    if(colorID === 0 || colorID === 256 || colorID === 64 || colorID === 32 || colorID === 83) {
	return new THREE.Vector4(1, 1, 1, 1);
    }
    else if(colorID === 272 || colorID === 70) {
        return new THREE.Vector4(1, 0, 0, 1);
    } 
    else {
        return new THREE.Vector4(0, 0, 0, 1);
    }
}

LDR.Colors.getColor4 = function(colorID) {
    var colorObject = LDR.Colors[colorID < 10000 ? colorID : colorID - 10000];
    if(!colorObject)
	throw "Unknown color: " + colorID;
    var color = new THREE.Color(colorID < 10000 ? colorObject.value : 
				(colorObject.edge ? colorObject.edge : 0x333333));
    var alpha = colorObject.alpha ? colorObject.alpha/256.0 : 1;
    return new THREE.Vector4(color.r, color.g, color.b, alpha);
}

LDR.Colors.getDesaturatedColor4 = function(colorID) {
    var colorObject = LDR.Colors[colorID < 10000 ? colorID : colorID - 10000];
    if(!colorObject)
	throw "Unknown color: " + colorID;
    var color = LDR.Colors.desaturateThreeColor(colorID < 10000 ? colorObject.value : 
				(colorObject.edge ? colorObject.edge : 0x333333));
    var alpha = colorObject.alpha ? colorObject.alpha/256.0 : 1;
    return new THREE.Vector4(color.r, color.g, color.b, alpha);
}

LDR.Colors.int2RGB = function(i) {
    var b = (i & 0xff);
    i = i >> 8;
    var g = (i & 0xff);
    i = i >> 8;
    var r = i;
    return [r, g, b];
}

LDR.Colors.int2Hex = function(i) {
    var rgb = LDR.Colors.int2RGB(i);
    var ret = '#';
    for(var j = 0; j < 3; j++) {
	rgb[j] = Number(rgb[j]).toString(16);
	if(rgb[j].length == 1)
	    ret += '0';
	ret += rgb[j];
    }
    return ret;
}

LDR.Colors.desaturateThreeColor = function(hex) {
    var threeColor = new THREE.Color(hex);
    var hsl = {};
    threeColor.getHSL(hsl);

    if(hsl.l == 0)
	hsl.l = 0.3;
    else
	hsl.l *= 0.7;

    threeColor.setHSL(hsl.h, hsl.s, hsl.l);
    return threeColor;
}

LDR.Colors.desaturateColor = function(hex) {
    return LDR.Colors.desaturateThreeColor(hex).getHex();
}

LDR.Colors.isTrans = function(colorID) {
    return colorID == 16 || LDR.Colors[colorID >= 10000 ? colorID-10000 : colorID].alpha > 0;
}

LDR.Colors.canBeOld = false;

LDR.Colors.buildLineMaterial = function(colorManager, color, conditional) {
    colorManager = colorManager.clone();
    colorManager.overWrite(color);

    var colors = ldrOptions.lineContrast == 0 ? colorManager.highContrastShaderColors : 
	                                        colorManager.shaderColors;
    var len = colors.length;

    var uniforms = {};
    if(LDR.Colors.canBeOld)
	uniforms['old'] = {value: false};
    if(len > 1) {
	uniforms['colors'] = {type: 'v4v', value: colors};
    }
    else {
	uniforms['color'] = {type: 'v4', value: colors[0]};
    }
    var ret = new THREE.RawShaderMaterial( {
	uniforms: uniforms,
	vertexShader: (conditional ? 
	    LDR.Shader.createConditionalVertexShader(LDR.Colors.canBeOld, colors, true) : 
            LDR.Shader.createSimpleVertexShader(LDR.Colors.canBeOld, colors, true, true)),
	fragmentShader: (conditional ? 
	    LDR.Shader.AlphaTestFragmentShader :
	    LDR.Shader.SimpleFragmentShader),
	transparent: false,
	visible: ldrOptions.lineContrast < 2
    });
    ret.colorManager = colorManager;
    return ret;
}

LDR.Colors.buildTriangleMaterial = function(colorManager, color, isTrans) {
    colorManager = colorManager.clone();
    colorManager.overWrite(color);
    var colors = colorManager.shaderColors;
    var len = colors.length;

    var uniforms = {};
    if(LDR.Colors.canBeOld)
	uniforms['old'] = {value: false};
    if(len > 1) {
	uniforms['colors'] = {type: 'v4v', value: colors};
    }
    else {
	uniforms['color'] = {type: 'v4', value: colors[0]};
    }
    var ret = new THREE.RawShaderMaterial( {
	uniforms: uniforms,
	vertexShader: LDR.Shader.createSimpleVertexShader(LDR.Colors.canBeOld, colors, false, false),
	fragmentShader: LDR.Shader.SimpleFragmentShader,
	transparent: isTrans
    });
    ret.colorManager = colorManager;
    return ret;
}


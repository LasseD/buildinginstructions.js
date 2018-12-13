'use strict';

/*
  ColorAttribute: 
    color: [r,g,b,a] (4)
    color + edge color + dimmed (12)
    x 496    
 */
LDR.Colors.buildGLSLColors = function(defaultColorIdx) {
    var v = [];
    var black = new THREE.Vector4();
    var white = new THREE.Vector4(1,1,1,1);
    var color16 = new THREE.Color(LDR.Colors[16].value);
    var old = new THREE.Vector4(color16.r, color16.g, color16.b, 1);

    for(var i = 0; i < 496; i++) {
	var colorObject = LDR.Colors[i];
	if(i == 16 && defaultColorIdx != undefined) {
	    colorObject = LDR.Colors[defaultColorIdx];
	}
	if(!colorObject) {
	    v.push(old, old, old, old, old);
	    continue;
	}

	var color = new THREE.Color(colorObject.value);
	var edge = new THREE.Color(colorObject.edge ? colorObject.edge : 0x333333);
	var dim = LDR.Colors.desaturateThreeColor(colorObject.value);
	var alpha = colorObject.alpha ? colorObject.alpha/256.0 : 1;
	v.push(new THREE.Vector4(color.r, color.g, color.b, alpha),
	       old,
	       new THREE.Vector4(dim.r, dim.g, dim.b, alpha),
	       new THREE.Vector4(edge.r, edge.g, edge.b, alpha),
	       LDR.Colors.isBlack(i) ? white : black);
    }
    return v;
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

LDR.Colors.isBlack = function(colorID) {
    return colorID == 0 || colorID == 256 || colorID == 64 || colorID == 32 || colorID == 83;
}

LDR.Colors.getHighContrastColor4 = function(colorID) {
    if(colorID < 10000)
	return LDR.Colors.getColor4(colorID); // No contrast for normal colors.
    if(LDR.Colors.isBlack(colorID-10000))
	return new THREE.Vector4(1, 1, 1, 1);
    return new THREE.Vector4(0, 0, 0, 1);
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

LDR.Colors.defaultGLSLColors = LDR.Colors.buildGLSLColors();
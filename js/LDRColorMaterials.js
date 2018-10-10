'use strict';

/*
  Functions for creating Three.js materials:
 */
LDR.Colors.getTriangleMaterial = function(colorID) {
    var colorObject = LDR.Colors[colorID];
    if(!colorObject)
	throw "Unknown color: " + colorID;
    if(!colorObject.triangleMaterial) {
	colorObject.triangleMaterial = new THREE.MeshBasicMaterial( { 
	    color: colorObject.value,
	    transparent: colorObject.alpha ? true : false,
	    opacity: colorObject.alpha ? colorObject.alpha/256.0 : 1,
	} );
    }
    return colorObject.triangleMaterial;
}
LDR.Colors.getDesaturatedTriangleMaterial = function(colorID) {
    var colorObject = LDR.Colors[colorID];
    if(!colorObject)
	throw "Unknown color: " + colorID;
    if(!colorObject.desaturatedTriangleMaterial) {
	colorObject.desaturatedTriangleMaterial = new THREE.MeshBasicMaterial( { 
	    color: LDR.Colors.desaturateColor(colorObject.value),
	    transparent: colorObject.alpha ? true : false,
	    opacity: colorObject.alpha ? colorObject.alpha/256.0 : 1,
	} );
    }
    return colorObject.desaturatedTriangleMaterial;
}
LDR.Colors.getLineMaterial = function(colorID) {
    var colorObject = LDR.Colors[colorID];
    if(!colorObject)
	throw "Unknown color: " + colorID;
    if(!colorObject.lineMaterial) {
	colorObject.lineMaterial = new THREE.LineBasicMaterial( { 
	    color: colorObject.value,
	} );
    }
    return colorObject.lineMaterial;
}
LDR.Colors.getEdgeLineMaterial = function(colorID) {
    var colorObject = LDR.Colors[colorID];
    if(!colorObject)
	throw "Unknown color: " + colorID;
    if(!colorObject.lineMaterial) {
	colorObject.lineMaterial = new THREE.LineBasicMaterial( { 
	    color: colorObject.edge ? colorObject.edge : 0x333333,
	} );
    }
    return colorObject.lineMaterial;
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

LDR.Colors.desaturateColor = function(hex) {
    var threeColor = new THREE.Color(hex);
    var hsl = {};
    threeColor.getHSL(hsl);

    if(hsl.l == 0)
	hsl.l = 0.3;
    else
	hsl.l *= 0.7;

    threeColor.setHSL(hsl.h, hsl.s, hsl.l);
    return threeColor.getHex();
}

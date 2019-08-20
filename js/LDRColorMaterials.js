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
    let colorObject = LDR.Colors[colorID >= 0 ? colorID : -colorID - 1];
    if(!colorObject) {
	throw "Unknown color: " + colorID;
    }
    let color = new THREE.Color(colorID >= 0 ? colorObject.value : 
				(colorObject.edge ? colorObject.edge : 0x333333));
    let alpha = colorObject.alpha ? colorObject.alpha/256.0 : 1;
    return new THREE.Vector4(color.r, color.g, color.b, alpha);
}

LDR.Colors.getDesaturatedColor4 = function(colorID) {
    let colorObject = LDR.Colors[colorID >= 0 ? colorID : -colorID - 1];
    if(!colorObject) {
	throw "Unknown color: " + colorID;
    }
    let color = LDR.Colors.desaturateThreeColor(colorID >= 0 ? colorObject.value : 
				(colorObject.edge ? colorObject.edge : 0x333333));
    let alpha = colorObject.alpha ? colorObject.alpha/256.0 : 1;
    return new THREE.Vector4(color.r, color.g, color.b, alpha);
}

LDR.Colors.getColorHex = function(colorID) {
    let colorObject = LDR.Colors[colorID >= 0 ? colorID : -colorID - 1];
    if(!colorObject) {
	throw "Unknown color: " + colorID;
    }
    return colorID >= 0 ? colorObject.value : (colorObject.edge ? colorObject.edge : 0x333333);
}

LDR.Colors.int2RGB = function(i) {
    let b = (i & 0xff);
    i = i >> 8;
    let g = (i & 0xff);
    i = i >> 8;
    let r = i;
    return [r, g, b];
}

LDR.Colors.int2Hex = function(i) {
    let rgb = LDR.Colors.int2RGB(i);
    let ret = '#';
    for(let j = 0; j < 3; j++) {
	rgb[j] = Number(rgb[j]).toString(16);
	if(rgb[j].length == 1) {
	    ret += '0';
	}
	ret += rgb[j];
    }
    return ret;
}

LDR.Colors.desaturateThreeColor = function(hex) {
    let threeColor = new THREE.Color(hex);
    let hsl = {};
    threeColor.getHSL(hsl);

    if(hsl.l == 0) {
	hsl.l = 0.3;
    }
    else {
	hsl.l *= 0.7;
    }

    threeColor.setHSL(hsl.h, hsl.s, hsl.l);
    return threeColor;
}

LDR.Colors.desaturateColor = function(hex) {
    return LDR.Colors.desaturateThreeColor(hex).getHex();
}

LDR.Colors.isTrans = function(colorID) {
    return colorID == 16 || LDR.Colors[colorID < 0 ? -colorID-1 : colorID].alpha > 0;
}

LDR.Colors.canBeOld = false;

LDR.ColorMaterialIdx = 0;
LDR.Colors.buildLineMaterial = function(colorManager, color, conditional) {
    colorManager = colorManager.clone();
    colorManager.overWrite(color);
    colorManager.idMaterial = LDR.ColorMaterialIdx++;

    let colors = (ldrOptions.lineContrast === 0) ? colorManager.highContrastShaderColors : 
	                                           colorManager.shaderColors;
    let len = colors.length;

    let uniforms = {};
    if(LDR.Colors.canBeOld) {
	uniforms['old'] = {value: false};
    }
    if(len > 1) {
	uniforms['colors'] = {type: 'v4v', value: colors};
    }
    else {
	uniforms['color'] = {type: 'v4', value: colors[0]};
    }
    let ret = new THREE.RawShaderMaterial( {
	uniforms: uniforms,
	vertexShader: (conditional ? 
	    LDR.Shader.createConditionalVertexShader(LDR.Colors.canBeOld, colors, true) : 
            LDR.Shader.createSimpleVertexShader(LDR.Colors.canBeOld, colors, true, true)),
	fragmentShader: (conditional ? 
	    LDR.Shader.AlphaTestFragmentShader :
	    LDR.Shader.SimpleFragmentShader),
	transparent: false,
	visible: true
    });
    ret.colorManager = colorManager;
    return ret;
}

LDR.Colors.buildTriangleMaterial = function(colorManager, color) {
    colorManager = colorManager.clone();
    colorManager.overWrite(color);
    let colors = colorManager.shaderColors;
    let len = colors.length;

    let uniforms = {};
    if(LDR.Colors.canBeOld) {
	uniforms['old'] = {value: false};
    }
    if(len > 1) {
	uniforms['colors'] = {type: 'v4v', value: colors};
    }
    else {
	uniforms['color'] = {type: 'v4', value: colors[0]};
    }
    let ret = new THREE.RawShaderMaterial({
	uniforms: uniforms,
	vertexShader: LDR.Shader.createSimpleVertexShader(LDR.Colors.canBeOld, colors, false, false),
	fragmentShader: LDR.Shader.SimpleFragmentShader,
	transparent: colorManager.containsTransparentColors()
    });
    ret.colorManager = colorManager;
    return ret;
}

LDR.Colors.absTextures = {};
LDR.Colors.createAbsTexture = function(size) {
    if(LDR.Colors.absTextures.hasOwnProperty(size)) {
        return LDR.Colors.absTextures[size];
    }

    let canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    let ctx = canvas.getContext("2d");              

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    ctx.filter = 'blur(' + Math.round(size/10) + 'px)';

    ctx.fillStyle = '#7F8281';
    ctx.fillRect(size/10, size/10, size-size/10, size-size/10);

    var texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    document.body.appendChild(canvas);
    return LDR.Colors.absTextures[size] = texture;
}

LDR.Colors.metalTextures = {};
LDR.Colors.createMetalTexture = function(size) {
    if(LDR.Colors.metalTextures.hasOwnProperty(size)) {
        return LDR.Colors.metalTextures[size];
    }

    let canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    let ctx = canvas.getContext("2d");              

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    ctx.filter = 'blur(' + Math.round(size/10) + 'px)';

    ctx.fillStyle = '#7D8284';
    ctx.fillRect(size/10, size/10, size-size/10, size-size/10);

    var texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    document.body.appendChild(canvas);
    return LDR.Colors.metalTextures[size] = texture;
}

LDR.Colors.loadTextures = function() {
    if(LDR.Colors.textures) {
        return;
    }
    var textureLoader = new THREE.TextureLoader();
    textureLoader.setPath('textures/');

    // env map
    var sides = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    
    // textures
    let normalMap = textureLoader.load("metal/normal.jpg"); // blue/purple/red map of the mask - colors show dents.
    normalMap.wrapS = normalMap.wrapT = THREE.MirroredRepeatWrapping;
    normalMap.repeat.set(0.2, 0.2);
    normalMap.offset.set(0.5, 0.5);
    //normalMap.rotation = 1; // Does not work

    LDR.Colors.textures = {
        reflectionCube: new THREE.CubeTextureLoader().load(sides.map(x => 'textures/cube/' + x + '.jpg')),
        normalMap: normalMap,
        aoMap: textureLoader.load("metal/ao.jpg"), // grayscale looking like a print of the mask
        displacementMap: textureLoader.load("metal/displacement.jpg"), // grayscale looks like a negative print.
    };
}

LDR.Colors.buildStandardMaterial = function(colorID) {
    let color = LDR.Colors[colorID < 0 ? (-colorID-1) : colorID]; // Assume non-negative color.
    if(!color.m) {
        let params = {
            color: colorID < 0 ? (color.edge ? color.edge : 0x333333) : color.value,
            name: 'Standard material for color ' + color.name + ' (' + colorID + ')',
            
            roughness: 0.1, // Smooth ABS
            metalness: 0.0,
            
            //bumpMap: LDR.Colors.textures.normalMap,
            //bumpScale: 1,

            /*aoMap: LDR.Colors.textures.aoMap,
            aoMapIntensity: 1.0,//*/
            
            /*displacementMap: LDR.Colors.textures.displacementMap,
            displacementScale: 2.436143,
              displacementBias: -0.428408,//*/
            
            envMap: LDR.Colors.textures.reflectionCube,
            envMapIntensity: 1.0
        };

        if(color.material) { // Special materials:
            if(color.material === 'CHROME') {
                console.log('CHROME ' + colorID + ' -> ' + color.value);
                params.metalness = 1.0;
                params.roughness = 0.05;
                params.normalMap = LDR.Colors.createMetalTexture(8);
                params.normalScale = new THREE.Vector2(1, -1);
            }
            else if(color.material === 'RUBBER') {
                console.log('RUBBER ' + colorID + ' -> ' + color.value);
                params.roughness = 0.9;
            }
            else if(color.material === 'METAL') {
                console.log('METAL ' + colorID + ' -> ' + color.value);
                params.metalness = 1.0;
                params.roughness = 0.2;
                params.normalMap = LDR.Colors.createMetalTexture(8);
                params.normalScale = new THREE.Vector2(1, -1);
            }
            else if(color.material === 'PEARLESCENT') {
                console.log('PEARL ' + colorID + ' -> ' + color.value);
                params.roughness = 0.05; // Smooth
            }
            else {
                console.log('COMPLICATED! ' + colorID + ' -> ' + color.value);
                // TODO: Stuff like 'MATERIAL GLITTER FRACTION 0.17 VFRACTION 0.2 SIZE 1' or
                // 'MATERIAL SPECKLE FRACTION 0.4 MINSIZE 1 MAXSIZE 3'
            }
        }
        else {
            params.normalMap = LDR.Colors.createAbsTexture(8);
            params.normalScale = new THREE.Vector2(0.1, -0.1);

            //params.normalMap = LDR.Colors.textures.normalMap;
            //params.normalScale = new THREE.Vector2(1, -1);
        }

        let m = new THREE.MeshStandardMaterial(params);
        if(color.alpha > 0) {
            m.transparent = true;
            m.opacity = color.alpha/255;
        }
        if(color.luminance > 0) {
            console.log('EMISSIVE ' + colorID + ' -> ' + color.value);
            m.emissive = color.value;
            m.emissiveIntensity = color.luminance/15;
        }
        color.m = m;
    }
    return color.m;
}

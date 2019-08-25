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

LDR.Colors.createRandomCanvas = function(size, damage, waves, waveSize) {
    let canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    let ctx = canvas.getContext("2d");

    ctx.fillStyle = 'rgb(0,0,0)';
    ctx.fillRect(0, 0, size, size);

    size--; // -2*1 pixel for outer edges, +1 for having right/down calculations available when writing back.
    var d = [];
    for(let i = 0; i < size*size; i++) {
        d.push(128);
    }

    // Some randomness:
    let r = [];
    for(let i = 0; i < 8; i++) {
        r.push(0.6+0.8*Math.random());
    }
    //console.dir(r);

    // Apply waves:
    let pos = 0;
    for(let y = 0; y < size; y++) {
        let Y = y;//Math.cos(r[0] + r[1]*rows*y/size);
        for (let x = 0; x < size; x++) {
            let X = x + x*Math.sin(x*5*r[0]/size);
            let V = r[1]*X+r[2]*Y;
            d[pos] += Math.round(Math.cos(Math.PI*waves*V/size)*waveSize);
            pos++;
        }
    }

    // Apply damage:
    for(let i = 0; i < damage; i++) {
        let x0 = Math.floor(size*Math.random()), y0 = Math.floor(size*Math.random());
        let angle = Math.PI*2*Math.random();
        let len = size/10*Math.random();
        let debth = Math.round((Math.random()-0.5)*10);
        if(debth === 0) {
            continue; // No damage!
        }
        //console.log('Damage from ' + x0 + ', ' + y0 + ' of length ' + len + ' and debth ' + debth);
        for(let j = 0; j < len; j++) {
            let x = Math.floor(x0 + Math.cos(angle)*j);
            let y = Math.floor(y0 + Math.sin(angle)*j);
            d[x*size+y] += debth;
        }
    }

    // Write data back:
    pos = 0;
    for(let y = 1; y < size; y++) {
        for (let x = 1; x < size; x++) {
            let here = d[pos];
            let right = here - Math.abs(here - d[pos+1]);
            let down = here - Math.abs(here - d[pos+size+1]);
            ctx.fillStyle = 'rgb(' + right + ',' + down + ',' + (255-here*0.2) + ')';
            ctx.fillRect(x, y, 1, 1);
            pos++;
        }
        pos++;
    }
    
    // Edges:
    let edgeDiff = 120, low = 128-edgeDiff, high = 128+edgeDiff, low2 = (128+low)/2, high2 = (128+high)/2;
    let cornerB = ',180)';
    ctx.fillStyle = 'rgb('+low+',128,255)';
    ctx.fillRect(0, 1, 1, size-1); // LEFT

    ctx.fillStyle = 'rgb('+low2+','+high2+cornerB;
    ctx.fillRect(0, 0, 1, 1);

    ctx.fillStyle = 'rgb(128,'+high+',255)';
    ctx.fillRect(1, 0, size-1, 1); // TOP

    ctx.fillStyle = 'rgb('+high2+','+high2+cornerB;
    ctx.fillRect(0, size, 1, 1);

    ctx.fillStyle = 'rgb('+high+',128,255)';
    ctx.fillRect(size, 0, 1, size-1); // RIGHT

    ctx.fillStyle = 'rgb('+high2+','+low2+cornerB;
    ctx.fillRect(size, size, 1, 1);

    ctx.fillStyle = 'rgb(128,'+low+',255)';
    ctx.fillRect(0, size, size-1, 1); // BOTTOM

    ctx.fillStyle = 'rgb('+low2+','+low2+cornerB;
    ctx.fillRect(size, 0, 1, 1);

    return [canvas, ctx];
}

LDR.Colors.absTextures = {};
LDR.Colors.createAbsTexture = function(size) {
    if(LDR.Colors.absTextures.hasOwnProperty(size)) {
        return LDR.Colors.absTextures[size];
    }

    let [canvas, ctx] = LDR.Colors.createRandomCanvas(size, 50, 2, 3);

    var texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    document.body.appendChild(canvas);
    return LDR.Colors.absTextures[size] = texture;
}

LDR.Colors.pearlTextures = {};
LDR.Colors.createPearlTexture = function(size) {
    if(LDR.Colors.pearlTextures.hasOwnProperty(size)) {
        return LDR.Colors.pearlTextures[size];
    }

    let [canvas, ctx] = LDR.Colors.createRandomCanvas(size, 20, 4, 10);

    var texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    document.body.appendChild(canvas);
    return LDR.Colors.pearlTextures[size] = texture;
}

LDR.Colors.metalTextures = {};
LDR.Colors.createMetalTexture = function(size) {
    if(LDR.Colors.metalTextures.hasOwnProperty(size)) {
        return LDR.Colors.metalTextures[size];
    }

    let [canvas, ctx] = LDR.Colors.createRandomCanvas(size, size*2, 1, 20);

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
    /*let normalMap = textureLoader.load("metal/normal.jpg"); // blue/purple/red map of the mask - colors show dents.
    normalMap.wrapS = normalMap.wrapT = THREE.MirroredRepeatWrapping;
    normalMap.repeat.set(0.2, 0.2);
    normalMap.offset.set(0.5, 0.5);//*/
    //normalMap.rotation = 1; // Does not work

    LDR.Colors.textures = {
        reflectionCube: new THREE.CubeTextureLoader().load(sides.map(x => 'textures/cube/' + x + '.jpg')),
        //normalMap: normalMap,
        //aoMap: textureLoader.load("metal/ao.jpg"), // grayscale looking like a print of the mask / red channel = how much ambient light affects material.
        //displacementMap: textureLoader.load("metal/displacement.jpg"), // grayscale looks like a negative print.
    };
}

LDR.Colors.buildStandardMaterial = function(colorID) {
    let color = LDR.Colors[colorID < 0 ? (-colorID-1) : colorID]; // Assume non-negative color.
    if(!color.m) {
        let params = {
            color: colorID < 0 ? (color.edge ? color.edge : 0x333333) : color.value,
            name: 'Material for color ' + color.name + ' (' + colorID + ')',
            
            roughness: 0.1, // Smooth ABS
            metalness: 0.0,
            
            normalMapType: THREE.TangentSpaceNormalMap,
            /*aoMap: LDR.Colors.textures.aoMap,
            aoMapIntensity: 1.0,//*/
            
            // Displacement map will not be used as it affects vertices of the mesh, not pixels,
            
            envMap: LDR.Colors.textures.reflectionCube, // TODO: Make own map!
            envMapIntensity: 1.0
        };

        if(color.material) { // Special materials:
            if(color.material === 'CHROME') {
                console.log('CHROME ' + colorID + ' -> ' + color.value);
                params.metalness = 1.0;
                params.roughness = 0.25;
                params.normalMap = LDR.Colors.createMetalTexture(64);
            }
            else if(color.material === 'RUBBER') {
                console.log('RUBBER ' + colorID + ' -> ' + color.value);
                params.roughness = 0.9;
            }
            else if(color.material === 'METAL') {
                console.log('METAL ' + colorID + ' -> ' + color.value);
                params.metalness = 1.0;
                params.roughness = 0.3;
                params.normalMap = LDR.Colors.createMetalTexture(64);
            }
            else if(color.material === 'PEARLESCENT') {
                console.log('PEARL ' + colorID + ' -> ' + color.value);
                params.normalMap = LDR.Colors.createPearlTexture(128);
                params.roughness = 0.01; // Smooth
            }
            else {
                console.log('COMPLICATED! ' + colorID + ' -> ' + color.value);
                // TODO: Stuff like 'MATERIAL GLITTER FRACTION 0.17 VFRACTION 0.2 SIZE 1' or
                // 'MATERIAL SPECKLE FRACTION 0.4 MINSIZE 1 MAXSIZE 3'
            }
        }
        else {
            params.normalMap = LDR.Colors.createAbsTexture(128);

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

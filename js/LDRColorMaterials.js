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

LDR.Colors.createRandomTexture = function(size, damage, waves, waveSize, speckle) {
    let canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    let ctx = canvas.getContext("2d");

    ctx.fillStyle = 'rgba(0,0,0,0)';
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

    let pos = 0;

    // Apply waves:
    if(waveSize > 0) {
        for(let y = 0; y < size; y++) {
            let Y = y;//Math.cos(r[0] + r[1]*rows*y/size);
            for (let x = 0; x < size; x++) {
                let X = x + x*Math.sin(x*5*r[0]/size);
                let V = r[1]*X+r[2]*Y;
                d[pos] += Math.round(Math.cos(Math.PI*waves*V/size)*waveSize);
                pos++;
            }
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
    
    // Apply speckle:
    if(speckle) {
        ctx.fillStyle = 'rgb(0,0,0)';
        const SPECKLE_MULT = 0.9;
        let speckleSize = (speckle.minSize + speckle.maxSize)*SPECKLE_MULT*SPECKLE_MULT; // Magic number used since this can be stretched onto parts of arbitrary sizes.
        let numSpeckles = Math.floor(size*size*speckle.fraction / speckleSize);
        console.log('Applying ' + numSpeckles + ' speckles of average size ' + speckleSize);
        for(let i = 0; i < numSpeckles; i++) {
            ctx.rotate(1);
            let x = size*Math.random();
            let y = size*Math.random();
            let diam = SPECKLE_MULT*(speckle.minSize + Math.random()*(speckle.maxSize-speckle.minSize));
            ctx.fillRect(x, y, diam, diam);
        }
        ctx.rotate(-numSpeckles);
    }

    // Edges (and corners):
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

    let texture = new THREE.Texture(canvas);
    texture.needsUpdate = true; // Otherwise canvas will not be applied.
    //document.body.appendChild(canvas);
    return texture;
}

LDR.Colors.createTransTexture = () => LDR.Colors.createRandomTexture(128, 20, 1, 12);
LDR.Colors.createOpaqueAbsTexture = () => LDR.Colors.createRandomTexture(128, 50, 2, 3);
LDR.Colors.createPearlTexture = () => LDR.Colors.createRandomTexture(128, 20, 4, 8);
LDR.Colors.createRubberTexture = () => LDR.Colors.createRandomTexture(64, 100, 1, 1);
LDR.Colors.createMetalTexture = () => LDR.Colors.createRandomTexture(64, 100, 1, 12);
LDR.Colors.speckleTs = [];
LDR.Colors.createSpeckleTexture = (size, fraction, minSize, maxSize) => LDR.Colors.createRandomTexture(size, 0, 2, 3, {fraction:fraction, minSize:minSize, maxSize:maxSize}); // Same as for ABS, but without damage.

LDR.Colors.loadTextures = function() {
    if(LDR.Colors.textures) {
        return;
    }

    var textureLoader = new THREE.TextureLoader();
    textureLoader.setPath('textures/');
    var sides = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    
    // textures
    LDR.Colors.textures = {
        reflectionCube: new THREE.CubeTextureLoader().load(sides.map(x => 'textures/cube/' + x + '.jpg')), // Environment map.
        //aoMap: textureLoader.load("ao.jpg"), // Red channel => ambient light affecting the material.
    };
}

LDR.Colors.buildStandardMaterial = function(colorID) {
    let color = LDR.Colors[colorID < 0 ? (-colorID-1) : colorID]; // Assume non-negative color.
    if(color.m) {
        return color.m;
    }

    let params = {
        color: colorID < 0 ? (color.edge ? color.edge : 0x333333) : color.value,
        name: 'Material for color ' + color.name + ' (' + colorID + ')',
        
        roughness: 0.1, // Smooth ABS
        metalness: 0.0,
        
        normalMapType: THREE.TangentSpaceNormalMap,
        
        /*aoMap: TODO: Can this even be computed on the fly and be any good?
          aoMapIntensity: 1.0,//*/
        
        // Displacement map will not be used as it affects vertices of the mesh, not pixels,
        
        envMap: LDR.Colors.textures.reflectionCube,
        envMapIntensity: 0.35
    };
    
    if(color.material) { // Special materials:
        if(color.material === 'CHROME' || color.material === 'METAL') {
            params.metalness = 1.0;
            params.roughness = 0.25;
            params.normalMap = LDR.Colors.metalT || (LDR.Colors.metalT = LDR.Colors.createMetalTexture());
            params.envMapIntensity = 1.0;
        }
        else if(color.material === 'RUBBER') {
            params.roughness = 0.9;
            params.normalMap = LDR.Colors.rubberT || (LDR.Colors.rubberT = LDR.Colors.createRubberTexture());
        }
        else if(color.material === 'PEARLESCENT') {
            params.normalMap = LDR.Colors.pearlT || (LDR.Colors.pearlT = LDR.Colors.createPearlTexture());
            params.roughness = 0.01; // Smooth
        }
        else if(color.material.startsWith('MATERIAL ')) {
            params.roughness = 0.0;
            params.envMapIntensity = 1.0;
            
            let m = color.material.substring('MATERIAL '.length);
            if(m.startsWith('SPECKLE FRACTION ')) {
                m = m.substring('SPECKLE FRACTION '.length).split(' ');
                if(m.length === 5) {
                    let fraction = parseFloat(m[0]);
                    let minSize = parseInt(m[2]);
                    let maxSize = parseInt(m[4]);
                    params.normalMap = LDR.Colors.speckleTs[colorID] || (LDR.Colors.speckleTs[colorID] = LDR.Colors.createSpeckleTexture(256, fraction, minSize, maxSize));
                }
                else {
                    console.warn('Failed to parse speckle definition for color ' + colorID + ': ' + m.join('/'));
                }
            }
            else if(m.startsWith('GLITTER FRACTION ')) {
                m = m.substring('GLITTER FRACTION '.length).split(' ');
                if(m.length === 5) {
                    let fraction = parseFloat(m[0]);
                    //let vFraction = parseFloat(m[2]); // Volume fraction is ignored as the material only has an affect on the surface, not the interior.
                    let size = parseInt(m[4]);
                    params.normalMap = LDR.Colors.speckleTs[colorID] || (LDR.Colors.speckleTs[colorID] = LDR.Colors.createSpeckleTexture(128, fraction, size, size));
                }
                else {
                    console.warn('Failed to parse glitter definition for color ' + colorID + ': ' + m.join('/'));
                }
            }
            else {
                console.warn('Unknown material for color ' + colorID + ': ' + m);
            }
        }
        else {
            console.warn('Unknown material composition for color ' + colorID + ' -> ' + color.material);
        }
    }
    else if(color.alpha > 0) {
        params.normalMap = LDR.Colors.transT  || (LDR.Colors.transT  = LDR.Colors.createTransTexture());
    }
    else {
        params.normalMap = LDR.Colors.opaqueT || (LDR.Colors.opaqueT = LDR.Colors.createOpaqueAbsTexture());
    }
    
    let m = new THREE.MeshStandardMaterial(params);
    if(color.alpha > 0) {
        m.transparent = true;
        m.opacity = color.alpha/255;
        // TODO: Use volume shader instead. https://stackoverflow.com/questions/26588568/volume-rendering-in-webgl and https://threejs.org/examples/webgl2_materials_texture3d.html
    }

    if(color.luminance > 0) {
        console.warn('Emissive materials not yet supported. Color: ' + colorID);
        // TODO: Make emissive.
    }

    return color.m = m;
}

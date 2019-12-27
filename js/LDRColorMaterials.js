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
            LDR.Shader.createSimpleVertexShader(LDR.Colors.canBeOld, colors, true, true, false)),
	fragmentShader: (conditional ? 
	    LDR.Shader.AlphaTestFragmentShader :
	    LDR.Shader.SimpleFragmentShader),
	transparent: false,
	visible: true
    });
    ret.colorManager = colorManager;
    return ret;
}

LDR.Colors.buildTriangleMaterial = function(colorManager, color, texmap) {
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
    if(texmap && texmap !== true) {
        uniforms['map'] = {type: 't', value: texmap};
    }
    let ret = new THREE.RawShaderMaterial({
	uniforms: uniforms,
	vertexShader: LDR.Shader.createSimpleVertexShader(LDR.Colors.canBeOld, colors, false, false, texmap),
	fragmentShader: texmap ? LDR.Shader.TextureFragmentShader : LDR.Shader.SimpleFragmentShader,
	transparent: colorManager.containsTransparentColors() || texmap !== false
    });
    ret.colorManager = colorManager;
    return ret;
}

LDR.Colors.logoPositions = [[-2,-4,2,-5,2,-3.5] // L
                            ,
                            [0,-1,0,-2.5], // E (Divided due to middle line)
                            [-2,0,-2,-2,2,-3,2,-1],
                            ,
                            [-1.5,2.25,
                             -2,1.5,-1.5,0.5,1.5,-0.25,
                             2,0.5,1.5,1.5,0,2,0,1] //G
                            ,
                            [-1.5,4.75,
                             -2,4,-1.5,3,1.5,2.25,
                             2,3,1.5,4,-1.5,4.75] // O
                            ];
LDR.Colors.logoCurves = [[-1.5, 0.5 , -2,1.5, -1.5,2.25],
                         [ 1.5,-0.25,  2,0.5,  1.5,1.5 ], // G
                         [-1.5, 3   , -2,  4, -1.5,4.75],
                         [ 1.5, 2.25,  2,  3,  1.5,4   ]]; // O

LDR.Colors.createRandomTexture = function(damage, waves, waveSize, speckle) {
    let size = 512;
    let canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;

    size--; // -2*1 pixel for outer edges, +1 for having right/down calculations available when writing back.
    var d = [];
    for(let i = size*size; i > 0; i--) {
        d.push(128);
    }

    // Some randomness:
    let random = [];
    for(let i = 0; i < 3; i++) {
        random.push(0.6+0.8*Math.random());
    }
    
    let pos = 0;
    // Apply waves:
    if(waveSize > 0) {
        for(let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                let X = x + x*Math.sin(x*5*random[0]/size);
                let V = random[1]*X+random[2]*y;
                d[pos++] += Math.cos(Math.PI*waves*V/size)*waveSize;
            }
        }
    }

    // Apply damage:
    for(let i = 0; i < damage; i++) {
        let x0 = Math.floor(size*Math.random()), y0 = Math.floor(size*Math.random());
        let angle = Math.PI*2*Math.random();
        let len = size*0.05*Math.random();
        let debth = 0.01*Math.random();
        for(let j = 0; j < len; j++) {
            let x = Math.floor(x0 + Math.cos(angle)*j);
            let y = Math.floor(y0 + Math.sin(angle)*j);
            d[x*size+y-size-1] -= debth;
            d[x*size+y-size] -= debth;
            d[x*size+y-size+1] -= debth;
            d[x*size+y-1] -= debth;
            d[x*size+y+1] -= debth;
            d[x*size+y+size-1] -= debth;
            d[x*size+y+size] -= debth;
            d[x*size+y+size+1] -= debth;
        }
        debth *= 2;
        for(let j = 0; j < len; j++) {
            let x = Math.floor(x0 + Math.cos(angle)*j);
            let y = Math.floor(y0 + Math.sin(angle)*j);
            d[x*size+y] -= debth;
        }
    }

    // Write data back:
    let ctx = canvas.getContext("2d");
    pos = 0;
    for(let y = 1; y < size; y++) {
        for (let x = 1; x < size; x++) {
            let a = [-size-1, -size, -size+1,   -1, 0, 1,   size-1, size, size+1].map(v => d[pos+v]);
            let v = new THREE.Vector3(-(a[2]+a[8]-a[6]-a[0]+2*(a[5]-a[3])),
                                      (a[6]+a[8]-a[2]-a[0]+2*(a[7]-a[1])),
                                      1); // Sample left/right neighbours and weight direct neighbours the most.
            v.normalize().multiplyScalar(128).addScalar(128);
            ctx.fillStyle = 'rgb(' + Math.round(v.x) + ',' + Math.round(v.y) + ',' + Math.round(v.z) + ')';

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

    // Apply logo:
    const LETTER_DX = 2; // of 20
    const LETTER_DZ = 5; // of 20 (full 1x1 plate width)
    const M = size/40; // Scale letter -> texture.
    const r = size/400, R = r*2.5; // 400
    const rr = r*r, RR = R*R;
    let damper = 1;
    let clamp = (x,min,max) => x < min ? min : (x > max ? max : x);
    let toRG = x => Math.round(128 + 127 * x / R * damper);
    let toB = x => Math.round(128 + 127 * x / R);
    const SIZE4 = size/4;

    LDR.Colors.logoPositions.forEach(letter => { // For each letter:
            for(let i = 0; i < letter.length; i+=2) { // Apply dots:
                let X0 = Math.round(SIZE4 + letter[i+1]*M);
                let Y0 = Math.round(SIZE4 + letter[i]*M);

                for(let dx = -Math.ceil(R); dx <= R; dx++) {
                    let dxdx = dx*dx;
                    let maxDY = Math.floor(Math.sqrt(RR-dxdx));
                    for(let dy = -maxDY; dy <= maxDY; dy++) {
                        let distSq = dxdx+dy*dy;
                        damper = distSq < rr ? 1 : (RR-distSq)/(RR-rr);
                        let dz = R - Math.sqrt(distSq)*damper;
                        ctx.fillStyle = 'rgb(' + toRG(dx) + ',' + toRG(-dy) + ',' + toB(dz) + ')';
                        ctx.fillRect(X0+dx, Y0+dy, 1, 1);
                    }
                }
            } // Apply dots

            // Apply lines:
            for(let i = 2; i < letter.length; i+=2) {
                let x1 = letter[i-1], y1 = letter[i-2], x2 = letter[i+1], y2 = letter[i];

                if(y1 === y2) { // Horizontal lines -_-
                    if(x1 > x2) { // Swap so x1 <= x2:
                        let tmp = x1; x1 = x2; x2 = tmp;
                        tmp = y1; y1 = y2; y2 = tmp;
                    }
                    let X1 = Math.ceil(SIZE4 + x1*M), Y1 = Math.round(SIZE4 + y1*M);
                    let DX = Math.ceil(SIZE4 + x2*M - X1);

                    for(let dy = -Math.floor(R); dy <= R; dy++) {
                        let dydy = dy*dy;
                        damper = dydy < rr ? 1 : (RR-dydy)/(RR-rr);
                        let dz = R + (dy < 0 ? dy : -dy)*damper;
                        ctx.fillStyle = 'rgb(128,' + toRG(-dy) + ',' + toB(dz) + ')';
                        ctx.fillRect(X1, Y1+dy, DX, 1);
                    }
                } // Horizontal lines -_-
                else { // All other lines:
                    if(y1 > y2) { // Swap so y1 < y2:
                        let tmp = x1; x1 = x2; x2 = tmp;
                        tmp = y1; y1 = y2; y2 = tmp;
                    }

                    let X1 = Math.round(SIZE4 + x1*M), Y1 = Math.round(SIZE4 + y1*M);
                    let X2 = Math.round(SIZE4 + x2*M), Y2 = Math.round(SIZE4 + y2*M);
                    let DX = X2-X1, DY = Y2-Y1;
                    let X1X2 = Math.sqrt(DY*DY + DX*DX);
                    let normalizedDX = DX / X1X2;
                    let normalizedDY = -DY / X1X2;
                    
                    // Move (X,Y) from Y1 up to Y2: Color X-R to X+R
                    let distance = (x,y) => (DY*x - DX*y + X2*Y1 - Y2*X1) / X1X2;

                    const SLOPE = (x2-x1)/(y2-y1);
                    for(let Y = Y1; Y < Y2; Y++) {
                        let X = X1 + SLOPE*(Y-Y1);
                        for(let x = Math.floor(X-R)-1; x < X+R+1; x++) {
                            let apy = X1-x;
                            let apx = Y1-Y;
                            let scalar = apx*normalizedDX + apy*normalizedDY;
                            let dx = normalizedDX * scalar;
                            let dy = normalizedDY * scalar;
                            let distSq = dx*dx + dy*dy;
                            if(distSq <= RR) {
                                damper = distSq < rr ? 1 : (RR-distSq)/(RR-rr);
                                let dz = R - Math.sqrt(distSq)*damper;
                                ctx.fillStyle = 'rgb(' + toRG(-dy) + ',' + toRG(dx) + ',' + toB(dz) + ')';
                                ctx.fillRect(x, Y, 1, 1);
                            }
                        }
                    }
                } // All other lines:
                } // Apply lines 
        });// For each letter
    LDR.Colors.logoCurves.forEach(curve => {
            let [y1, x1, y2, x2, y3, x3] = curve.map(x => SIZE4 + x*M);

            let [yMin,yMax] = y1 < y2 ? [y1,y2+R] : [y2-R,y1];
            let [xMin,xMax] = x1 < x3 ? [x1-R,x3+R] : [x3-R,x1+R];
            let [xMid,yMid] = [(x1+x3)/2, y1];
            let rX = 1.1*Math.abs(x1-x3)*0.5; // Horizontal radius
            let rY = Math.abs(y2-y1); // Vertical radius

            let sigma = y2 > y1 ? -1 : 1;
            for(let y = Math.floor(yMin); y <= yMax; y++) {                
                for(let x = Math.floor(xMin); x <= xMax; x++) {
                    let [dx,dy] = [x-xMid,y-yMid];

                    let DX = dx + Math.abs(x2-xMid)*(y-y1)/(yMax-yMin);
                    let DY = dy - sigma*(rX-rY);

                    let dxdy = Math.sqrt(DX*DX + DY*DY);
                    let dR = rX - dxdy;
                    let distSq = dR*dR;
                    if(distSq > 2*RR) {
                        continue; // Outside of curve.
                    }

                    dx = (DX / dxdy) * dR;
                    dy = (DY / dxdy) * dR;
                    damper = distSq < rr ? 1 : clamp((RR-distSq)/(RR-rr), 0, 1);
                    let dz = R - Math.sqrt(distSq)*damper;
                    
                    ctx.fillStyle = 'rgb(' + toRG(-dx) + ',' + toRG(dy) + ',' + toB(dz) + ')';
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }); // For each curve

    // Edges (and corners):
    size = (size+1)/2-1;
    let sides = [[1,0],[0,1],[-1,0],[0,-1]];

    sides.forEach(side => {
            ctx.translate((size+1)*side[0], (size+1)*side[1]);

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
            ctx.fillRect(size, 0, 1, size); // RIGHT
            
            ctx.fillStyle = 'rgb('+high2+','+low2+cornerB;
            ctx.fillRect(size, size, 1, 1);
            
            ctx.fillStyle = 'rgb(128,'+low+',255)';
            ctx.fillRect(0, size, size, 1); // BOTTOM
            
            ctx.fillStyle = 'rgb('+low2+','+low2+cornerB;
            ctx.fillRect(size, 0, 1, 1);
        });

    let texture = new THREE.Texture(canvas);
    texture.needsUpdate = true; // Otherwise canvas will not be applied.
    //document.body.appendChild(canvas);
    return texture;
}

LDR.Colors.envMapPrefix = 'textures/cube/';
LDR.Colors.listeningMaterials = {trans:[], // Only one trans material.
                                 opaque:[], // -||-
                                 pearl:[],
                                 rubber:[],
                                 metal:[],
                                 speckle:{} }; // Speckle materials ordered by colorID: colorID->[]
LDR.Colors.speckleInfo = {};

LDR.Colors.loadEnvMapTextures = function(render) {    
    function updateEnvMapsForList(reflectionCube, list) {
        list.forEach(material => {material.envMap = reflectionCube; material.needsUpdate = true;});
    }
    function updateEnvMaps(reflectionCube) {
        updateEnvMapsForList(reflectionCube, LDR.Colors.listeningMaterials.trans);
        updateEnvMapsForList(reflectionCube, LDR.Colors.listeningMaterials.opaque);
        updateEnvMapsForList(reflectionCube, LDR.Colors.listeningMaterials.pearl);
        updateEnvMapsForList(reflectionCube, LDR.Colors.listeningMaterials.rubber);
        updateEnvMapsForList(reflectionCube, LDR.Colors.listeningMaterials.metal);
        for(let colorID in LDR.Colors.listeningMaterials.speckle) {
            if(LDR.Colors.listeningMaterials.speckle.hasOwnProperty(colorID)) {
                updateEnvMapsForList(reflectionCube, LDR.Colors.listeningMaterials.speckle[colorID]);
            }
        }
        LDR.Colors.reflectionCube = reflectionCube;
        render();
    }

    if(LDR.Colors.reflectionCube) {
        updateEnvMaps(LDR.Colors.reflectionCube);
    }
    else {
        var textureLoader = new THREE.TextureLoader();
        textureLoader.setPath('textures/');
        var sides = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

        new THREE.CubeTextureLoader().load(sides.map(x => LDR.Colors.envMapPrefix + x + '.jpg'), updateEnvMaps);
    }
}

LDR.Colors.loadTextures = function(render) {
    // Environment map:
    LDR.Colors.loadEnvMapTextures(render);

    // Normal maps:
    var textureLoader = new THREE.TextureLoader();
    textureLoader.setPath('textures/materials/');

    function updateNormalMapsForList(t, list) {
        list.forEach(material => {material.normalMap = t; material.needsUpdate = true; render()});
    }
    function setNormalMapsForList(l, textureName) {
        if(l.length === 0) {
            return; // Nothing to build.
        }
	if(l.t) {
            updateNormalMapsForList(t, l);
	}
	else {
	    textureLoader.load(textureName, t => updateNormalMapsForList(t, l));
	}
    }

    setNormalMapsForList(LDR.Colors.listeningMaterials.trans, 'abs.png');
    setNormalMapsForList(LDR.Colors.listeningMaterials.opaque, 'abs.png');
    setNormalMapsForList(LDR.Colors.listeningMaterials.pearl, 'pearl.png');
    setNormalMapsForList(LDR.Colors.listeningMaterials.rubber, 'rubber.png');
    setNormalMapsForList(LDR.Colors.listeningMaterials.metal, 'metal.png');
    for(let colorID in LDR.Colors.listeningMaterials.speckle) {
        if(LDR.Colors.listeningMaterials.speckle.hasOwnProperty(colorID)) {            
            let s = LDR.Colors.speckleInfo[colorID];
            setNormalMapsForList(LDR.Colors.listeningMaterials.speckle[colorID], 'speckle.png');
        }
    }
}

LDR.Colors.generateTextures = function(render) {
    // Environment map:
    LDR.Colors.loadEnvMapTextures(render);

    // Normal maps:
    function updateNormalMapsForList(t, list) {
        list.forEach(material => {material.normalMap = t; material.needsUpdate = true;});
    }
    function setNormalMapsForList(l, createTexture) {
        if(l.length === 0) {
            return; // Nothing to build.
        }
        let t = l.t || createTexture();
        l.t = t;
        updateNormalMapsForList(t, l);        
    }

    setNormalMapsForList(LDR.Colors.listeningMaterials.trans, 
                         () => LDR.Colors.createRandomTexture(5, 1.4, 0.1));
    setNormalMapsForList(LDR.Colors.listeningMaterials.opaque,
                         () => LDR.Colors.createRandomTexture(10, 1, 0.2));
    setNormalMapsForList(LDR.Colors.listeningMaterials.pearl,
                         () => LDR.Colors.createRandomTexture(20, 2.5, 0.05));
    setNormalMapsForList(LDR.Colors.listeningMaterials.rubber,
                         () => LDR.Colors.createRandomTexture(10, 0.3, 0.1));
    setNormalMapsForList(LDR.Colors.listeningMaterials.metal,
                         () => LDR.Colors.createRandomTexture(100, 0.6, 1.6));
    for(let colorID in LDR.Colors.listeningMaterials.speckle) {
        if(LDR.Colors.listeningMaterials.speckle.hasOwnProperty(colorID)) {            
            let s = LDR.Colors.speckleInfo[colorID];
            setNormalMapsForList(LDR.Colors.listeningMaterials.speckle[colorID],
                                 () => LDR.Colors.createRandomTexture(5, 1.4, 0.1, s));
        }
    }

    render();
}

LDR.Colors.buildStandardMaterial = function(colorID, texmap) {
    let color = LDR.Colors[colorID < 0 ? (-colorID-1) : colorID]; // Assume non-negative color.
    if(color.m && !texmap) {
        return color.m;
    }

    let registerTextureListener = () => {};
    let createMaterial = p => new THREE.MeshPhongMaterial(p);

    let params = {
        color: colorID < 0 ? (color.edge ? color.edge : 0x333333) : color.value,
        name: 'Material for color ' + color.name + ' (' + colorID + ')' + (texmap?' with texmap':''),
    };
    if(texmap) {
        params.color = 0xFFFFFF; // TODO: Right now color is forced to white when textures are applied in order to avoid color modulation on texture. Ideally a custom material should be used.
        if(texmap !== true) {
            params.map = texmap; // Map set now!
        }
    }
    
    if(color.material) { // Special materials:
        createMaterial = p => new THREE.MeshStandardMaterial(p);
        params.metalness = 0.0;
        params.roughness = 0.1;
        params.envMapIntensity = 0.35;

        if(color.material === 'CHROME' || color.material === 'METAL') {
            params.metalness = 1.0;
            params.roughness = 0.25;
            registerTextureListener = m => LDR.Colors.listeningMaterials.metal.push(m);
            params.envMapIntensity = 1.0;
        }
        else if(color.material === 'RUBBER') {
            params.roughness = 0.9;
            registerTextureListener = m => LDR.Colors.listeningMaterials.rubber.push(m);
        }
        else if(color.material === 'PEARLESCENT') {
            registerTextureListener = m => LDR.Colors.listeningMaterials.pearl.push(m);
            params.roughness = 0.01; // Smooth
        }
        else if(color.material.startsWith('MATERIAL ')) {
            params.roughness = 0.0;
            params.envMapIntensity = 1.0;
            
            let m = color.material.substring('MATERIAL '.length);
            if(m.startsWith('SPECKLE FRACTION ')) {
                m = m.substring('SPECKLE FRACTION '.length).split(' ');
                if(m.length === 5) {
                    if(!LDR.Colors.speckleInfo.hasOwnProperty(colorID)) {
                        let fraction = parseFloat(m[0]);
                        let minSize = parseInt(m[2]);
                        let maxSize = parseInt(m[4]);
                        LDR.Colors.speckleInfo[colorID] = {fraction:fraction, minSize:minSize, maxSize:maxSize};
                        LDR.Colors.listeningMaterials.speckle[colorID] = [];
                    }
                    registerTextureListener = m => LDR.Colors.listeningMaterials.speckle[colorID].push(m);
                }
                else {
                    console.warn('Failed to parse speckle definition for color ' + colorID + ': ' + m.join('/'));
                }
            }
            else if(m.startsWith('GLITTER FRACTION ')) {
                m = m.substring('GLITTER FRACTION '.length).split(' ');
                if(m.length === 5) {
                    if(!LDR.Colors.speckleInfo.hasOwnProperty(colorID)) {
                        let fraction = parseFloat(m[0]);
                        //let vFraction = parseFloat(m[2]); // Volume fraction is ignored as the material only has an affect on the surface, not the interior.
                        let size = parseInt(m[4]);
                        LDR.Colors.speckleInfo[colorID] = {fraction:fraction, minSize:size, maxSize:size};
                        LDR.Colors.listeningMaterials.speckle[colorID] = [];
                    }
                    registerTextureListener = m => LDR.Colors.listeningMaterials.speckle[colorID].push(m);
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
    else if(colorID === 0) {
        registerTextureListener = m => LDR.Colors.listeningMaterials.opaque.push(m);
        params.specular = 0xFFFFFF; // Increase glare
        params.shininess = 82;
        params.reflectivity = 0.9;
    }
    else if(color.alpha > 0) {
        registerTextureListener = m => LDR.Colors.listeningMaterials.trans.push(m);
        params.shininess = 100;
        params.reflectivity = 0.8;
    }
    else {
        registerTextureListener = m => LDR.Colors.listeningMaterials.opaque.push(m);
        params.shininess = 100;
        params.reflectivity = 0.1;
    }
    
    let m = createMaterial(params);
    if(texmap) {
        m.transparent = true; // We do not know if texture is transparent.
    }
    else {
        registerTextureListener(m); // Texture does not work with map since they both use UV's, but for different purposes!
    }

    if(color.alpha > 0) {
        m.transparent = true;
        m.opacity = color.alpha/255;
        // TODO: Use alphaMap or volume shader instead. 
        // https://stackoverflow.com/questions/26588568/volume-rendering-in-webgl and https://threejs.org/examples/webgl2_materials_texture3d.html
    }

    if(color.luminance > 0) {
        console.warn('Emissive materials not yet supported. Color: ' + colorID);
        // TODO: Make emissive.
    }

    if(!texmap) {
        color.m = m;
    }
    return m;
}

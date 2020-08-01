THREE.LDRGeometryLoader = function(onLoad) {
    let self = this;

    this.partTypes = {}; // id => true or part. id is typically something like "parts/3001.dat", and "model.mpd".

    this.onLoad = onLoad;
    this.onProgress = ()=>{};
    this.onWarning = console.dir;
    this.onError = console.dir;
    this.loader = new THREE.FileLoader(THREE.DefaultLoadingManager);
    this.loader.setResponseType('arraybuffer');

    this.substituteReplacementParts = () => {};
    this.getPartType = id => self.partTypes[id];
    this.physicalRenderingAge = 0;
}

/*
 * id is the file name to load. 
 */
THREE.LDRGeometryLoader.prototype.load = function(id) {
    let self = this;

    let url = id.toLowerCase().replace('\\', '/'); // Sanitize id. 

    let onFileLoaded = function(buffer) {
	self.parse(buffer);
	self.onLoad(id);
    }
    let onError = function(event) {
        self.onError({message:event.currentTarget?event.currentTarget.statusText:'Error during loading', subModel:id});
    }

    this.loader.load(url, onFileLoaded, undefined, onError);
};

THREE.LDRLoader.prototype.geoPack = function() {
    let self = this;

    let ia = [], fa = [];
    
    let mainModel = this.getMainModel();

    // First find all parts mentioned in those that will be packed:
    let nameMap = {};
    nameMap[mainModel.ID] = 0;
    let names = [mainModel.ID];
    function scanName(id) {
	if(nameMap.hasOwnProperty(id)) {
	    return; // Already handled.
	}
	let pt = self.getPartType(id);
        if(!pt || pt.isPart) {
            return; // Not a sub model.
        }
	nameMap[id] = names.length;
	names.push(id);
        scanNamesForPT(pt);
    }
    function scanNamesForSM(sm) {
        scanName(sm.ID);
        if(sm.REPLACEMENT_PLI && sm.REPLACEMENT_PLI !== true) {
            scanName(sm.REPLACEMENT_PLI);
        }
    }
    let scanNamesForStep = step => step.subModels.forEach(scanNamesForSM);
    let scanNamesForPT = pt => pt.steps.forEach(scanNamesForStep);

    scanNamesForPT(mainModel);

    // Pack all parts:
    ia.push(names.length);
    names.forEach(id => {
	let pt = self.getPartType(id);

	// Pack steps:
	ia.push(pt.steps.length);
	pt.steps.forEach(step => {
            step.geoPackInto(self, ia, fa, nameMap);

	    // Also handle rotation:
	    if(step.rotation) {
		let r = step.rotation;;
		ia.push(r.type === 'ABS' ? 1 : 2);
		fa.push(r.x, r.y, r.z);
	    }
	    else {
		ia.push(0);
	    }
	});
    });

    let header = [1, ia.length, fa.length]; // Version, |ints|, |floats|
    //header.forEach(x => console.log(x.toString(16), x));
    return new Blob([new Int32Array(header), new Int32Array(ia), new Float32Array(fa)], {type: 'application/x-ldraw'});
}

THREE.LDRGeometryLoader.prototype.parse = function(buffer) {
    let self = this;

    // Unpack data:
    let dv = new DataView(buffer);

    let version = dv.getInt32(0, true);
    let sizeI = dv.getInt32(4, true);
    let sizeF = dv.getInt32(8, true);

    if(version !== 1) {
        throw 'Only support for file version 1. Found: ' + version + ', ints:' + sizeI + ', floats: ' + sizeF;
    }

    let idx = 12;
    var ia = new Int32Array(sizeI);
    for(let i = 0; i < sizeI; i++, idx+=4) {
        ia[i] = dv.getInt32(idx, true);
    }

    var fa = new Float32Array(sizeF);
    for(let i = 0; i < sizeF; i++, idx+=4) {
        fa[i] = dv.getFloat32(idx, true);
    }

    // Parse data:
    this.mainModel = 'p0.ldr';
    let idxI = 0, idxF = 0;

    let numPartTypes = ia[idxI++];
    //console.log('Unpacking', sizeI, 'integers and', sizeF, 'floats for', numPartTypes, 'part types');
    for(let i = 0; i < numPartTypes; i++) {
	let numSteps = ia[idxI++];

	let pt = new THREE.LDRPartType();
	pt.ID = pt.name = 'p' + i + '.ldr';
        //console.log(pt.ID, 'with', numSteps, 'steps');
	pt.cleanSteps = true;

	// Unpack steps:
	for(let j = 0; j < numSteps; j++) {
	    let step = new THREE.LDRStep();
	    [idxI, idxF] = step.geoUnpackFrom(ia, fa, idxI, idxF);

	    // Handle rotation:
	    let r = ia[idxI++];
	    if(r !== 0) {
		step.rotation = new THREE.LDRStepRotation(fa[idxF++], fa[idxF++], fa[idxF++], r === 1 ? 'ABS' : 'REL');
	    }

	    pt.steps.push(step);	    
	}

	self.partTypes[pt.ID] = pt;
    }
}

LDR.PACK_TAG = -373035547;

THREE.LDRStep.prototype.geoPackInto = function(loader, ia, fa, subModelMap) {
    if(this.containsPartSubModels(loader)) { // Pack step geometry:
        ia.push(LDR.PACK_TAG); // Indicate a step with parts.
        let g = new LDR.LDRGeometry();
        g.fromStep(loader, this);
        
        ia.push(g.vertices.length);
        g.vertices.forEach(v => fa.push(v.x, v.y, v.z)); // No logos.

        function pack(source, numPoints) {
            let cs = [];
            for(let c in source) {
                if(source.hasOwnProperty(c)) {
                    cs.push(c);
                }
            }
            ia.push(cs.length);
            //console.log('Packing',cs.length,'colors of primitives with',numPoints,'points');

            cs.forEach(c => {
                    ia.push(parseInt(c));
                    let x = source[c];
                    ia.push(x.length);
                    //console.log(' For color',c,'packing',x.length);
                    
                    switch(numPoints) {
                    case 2:
                        x.forEach(p => ia.push(p.p1, p.p2));
                        break;
                    case 3:
                        x.forEach(p => ia.push(p.p1, p.p2, p.p3));
                        break;
                    case 4:
                        x.forEach(p => ia.push(p.p1, p.p2, p.p3, p.p4));
                        break;
                    }
                });
        }

        pack(g.lines, 2);
        pack(g.conditionalLines, 4);
        pack(g.triangles, 3);
        pack(g.triangles2, 3);
        pack(g.quads, 4);
        pack(g.quads2, 4);

        let min = g.boundingBox.min;
        let max = g.boundingBox.max;
        fa.push(min.x, min.y, min.z, max.x, max.y, max.z);
    }
    else { // Contains no parts, just sub models:
        ia.push(this.subModels.length);    
        function handleSubModel(sm) {
            if(!subModelMap.hasOwnProperty(sm.ID)) {
                console.dir(subModelMap);
                throw "Unknown sub model " + sm.ID + ' not in map!';
            }
            ia.push(sm.c);
            ia.push(subModelMap[sm.ID]);
            
            fa.push(sm.p.x, sm.p.y, sm.p.z);
            let e = sm.r.elements;
            for(let x = 0; x < 3; x++) {
                for(let y = 0; y < 3; y++) {
                    fa.push(e[x+y*3]);
                }
            }
        }
        this.subModels.forEach(handleSubModel);
    }
}

THREE.LDRStep.prototype.geoUnpackFrom = function(ia, fa, idxI, idxF) {
    let self = this;
    
    let numSubModels = ia[idxI++];
    if(numSubModels === LDR.PACK_TAG) { // Unpack geometry:
        this.containsNonPartSubModels = () => false;
        // Ensure bounds and

        let g = new LDR.LDRGeometry();
        let numVertices = ia[idxI++];
        //console.log('Number of vertices:',numVertices);
        for(let i = 0; i < numVertices; i++) {
            g.vertices.push({x:fa[idxF++], y:fa[idxF++], z:fa[idxF++]});
        }

        function unpack(numPoints, store) {
            let numColors = ia[idxI++];
            if(numColors < 0) {
                throw 'Number of colors error: ' + numColors;
            }
            //console.log('Number of colors for size',numPoints,'primitives:',numColors);

            for(let j = 0; j < numColors; j++) {
                let c = ia[idxI++];
                if(c === undefined) {
                    throw 'Color error: ' + c;
                }
                let x = [];
                let cnt = ia[idxI++];
                if(cnt <= 0) {
                    throw 'Size error: ' + cnt;
                }
                //console.log('Number of primitives in size',numPoints,'and color',c,':',cnt);
                for(let i = 0; i < cnt; i++) {
                    let obj = {p1:ia[idxI++], p2:ia[idxI++]};
                    if(numPoints > 2)
                        obj.p3 = ia[idxI++];
                    if(numPoints === 4)
                        obj.p4 = ia[idxI++];
                    x.push(obj);
                }
                store(c, x);
            }
        }
        unpack(2, (c, x) => g.lines[c] = x);
        unpack(4, (c, x) => g.conditionalLines[c] = x);
        unpack(3, (c, x) => g.triangles[c] = x);
        unpack(3, (c, x) => g.triangles2[c] = x);
        unpack(4, (c, x) => g.quads[c] = x);
        unpack(4, (c, x) => g.quads2[c] = x);

        g.boundingBox = new THREE.Box3();
        g.boundingBox.min.set(fa[idxF++], fa[idxF++], fa[idxF++]);
        g.boundingBox.max.set(fa[idxF++], fa[idxF++], fa[idxF++]);

        // Rewrite generateThreePart:
        this.generateThreePart = function(loader, c, p, r, ignore, ignore, mc) {
            if(loader.physicalRenderingAge === 0) {
                g.buildGeometriesAndColors();
            }
            else {
                g.buildPhysicalGeometriesAndColors();
            }
    
            let m4 = new THREE.Matrix4();
            let m3e = r.elements;
            m4.set(m3e[0], m3e[3], m3e[6], p.x,
                   m3e[1], m3e[4], m3e[7], p.y,
                   m3e[2], m3e[5], m3e[8], p.z,
                   0, 0, 0, 1);
    
            if(g.lineGeometry) {
                let material = new LDR.Colors.buildLineMaterial(g.lineColorManager, c, false);
                let normalLines = new THREE.LineSegments(g.lineGeometry, material);
                normalLines.applyMatrix4(m4);
                mc.addLines(normalLines, null, false);
            }
    
            if(g.conditionalLineGeometry) {
                let material = new LDR.Colors.buildLineMaterial(g.lineColorManager, c, true);
                let conditionalLines = new THREE.LineSegments(g.conditionalLineGeometry, material);
                conditionalLines.applyMatrix4(m4);
                mc.addLines(conditionalLines, null, true);
            }
    
            // Normal triangle geometries:
            for(let tc in g.triangleGeometries) {
                if(!g.triangleGeometries.hasOwnProperty(tc)) {
                    continue;
                }
                let threeGeometry = g.triangleGeometries[tc];

                let material;
                if(loader.physicalRenderingAge === 0) { // Simple rendering:
                    let triangleColorManager = new LDR.ColorManager();
                    triangleColorManager.get(tc); // Ensure color is present.
                    tc = parseInt((tc === '16') ? c : tc);
                    material = new LDR.Colors.buildTriangleMaterial(triangleColorManager, c, false);
                }
                else { // Physical rendering:
                    tc = parseInt((tc === '16') ? c : tc);
                    material = LDR.Colors.buildStandardMaterial(tc);
                }
                let mesh = new THREE.Mesh(threeGeometry.clone(), material); // Using clone to ensure matrix in next line doesn't affect other usages of the geometry.
                mesh.receiveShadow = mesh.castShadow = loader.physicalRenderingAge !== 0;
                mesh.geometry.applyMatrix4(m4);
                //mesh.applyMatrix4(m4); // Doesn't work for all LDraw parts as the matrix needs to be decomposable to position, quaternion and scale. Some rotation matrices in LDraw parts are not decomposable.
                mc.addMesh(tc, mesh, null);
            }
            
            let b = g.boundingBox;
            mc.expandBoundingBox(b, m4);
        }

        return [idxI,idxF]; // Special step load done.
    }

    function ensureColor(c) {
	if(!LDR.Colors.hasOwnProperty(c)) { // Direct color:
	    let hex = c.toString(16);
	    LDR.Colors[c] = {name:'Direct color 0x2'+hex, value:c, edge:c, direct:hex};
	}
    }

    // Sub Models:
    //console.log('Unpacking step with',numSubModels,'sub models');
    for(let i = 0; i < numSubModels; i++) {
        let c = ia[idxI++];
	ensureColor(c);
        let ID = ia[idxI++];
        ID = 'p' + ID + '.ldr';

        let position = new THREE.Vector3(fa[idxF++], fa[idxF++], fa[idxF++]);
        let rotation = new THREE.Matrix3();
        rotation.set(fa[idxF++], fa[idxF++], fa[idxF++], 
                     fa[idxF++], fa[idxF++], fa[idxF++],
                     fa[idxF++], fa[idxF++], fa[idxF++]);
        let subModel = new THREE.LDRPartDescription(c, position, rotation, ID, true, false, null);
        this.addSubModel(subModel);
    }
    return [idxI,idxF];
}

THREE.LDRStep.prototype.cloneColored = function(colorID) {
    return this; // TODO to enable sub models of the same type, but of various colors in the model.
}

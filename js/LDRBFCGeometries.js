'use strict';

LDR.EPS = 1e-5;

/*
  Binary merge of the geometry streams.
 */
LDR.mergeGeometries = function(geometries) {
    if(geometries.length === 0) {
        return new LDR.LDRGeometry();
    }
    while(geometries.length > 1) { // Repeat rounds until only 1 left:
	let nextGeometries = []; // Result of round.

	if(geometries.length % 2 === 1) {
	    nextGeometries.push(geometries[geometries.length-1]); // Take last geometry without merging it.
	}

	for(let i = 0; i < geometries.length-1; i+=2) {
	    geometries[i].merge(geometries[i+1]);
	    nextGeometries.push(geometries[i]);
	}
	geometries = nextGeometries;
    }
    return geometries[0];
}

/*
  A vertex is sorted by {x,y,z,c}.
 */
LDR.vertexSorter = function(a, b) {
    if(a.x !== b.x) {
	return a.x - b.x;
    }
    if(a.y !== b.y) {
	return a.y - b.y;
    }
    return a.z - b.z;
}

LDR.vertexLessThan = function(a, b) {
    if(a.x !== b.x) {
	return a.x < b.x;
    }
    if(a.y !== b.y) {
	return a.y < b.y;
    }
    return a.z < b.z;
}

LDR.vertexEqual = function(a, b) {
    return Math.abs(a.x-b.x) < LDR.EPS && 
           Math.abs(a.y-b.y) < LDR.EPS && 
           Math.abs(a.z-b.z) < LDR.EPS;
}

LDR.BFCGeometry = function() {
    this.vertices = []; // sorted (x,y,z)
    this.lines = []; // [{p1,p2},...] (indices)
    this.conditionalLines = []; // [{p1,p2,p3,p4},...]
    this.triangles = []; // [{p1,p2,p3},...]
    this.triangles2 = []; // [{p1,p2,p3},...]
    // geometries:
    this.lineColorManager;
    this.lineGeometry;
    this.triangleColorManager;
    this.triangleGeometries = {};
    this.conditionalLineGeometry;
    this.geometriesBuilt = false;
    this.boundingBox = new THREE.Box3();
}

LDR.BFCGeometry.prototype.buildVertexAttribute = function(rotation) {
    let vertices = [];
    this.vertices.forEach(v => {
            let position = new THREE.Vector3(v.x, v.y, v.z);
            position.applyMatrix3(rotation);
            vertices.push(position.x, position.y, position.z);
        });
    return new THREE.Float32BufferAttribute(vertices, 3);
}

/*
  Three.js geometries and color managers.
 */
LDR.BFCGeometry.prototype.buildGeometriesAndColors = function() {
    if(this.geometriesBuilt) {
	return;
    }
    var self = this;

    this.triangleColorManager = new LDR.ColorManager();
    this.triangleColorManager.get(2); // Green
    this.triangleColorManager.get(4); // Red
    this.triangleColorManager.get(1); // Blue
    this.lineColorManager = new LDR.ColorManager();
    this.lineColorManager.get(0); // Black lines

    // Lines:
    let lineVertices = [], lineIndices = [];
    this.vertices.forEach(v => lineVertices.push(v.x, v.y, v.z));
    let lineVertexAttribute = new THREE.Float32BufferAttribute(lineVertices, 3);
    this.lines.forEach(line => lineIndices.push(line.p1, line.p2));
    this.lineGeometry = this.buildGeometry(lineIndices, lineVertexAttribute);

    // Conditional lines:
    this.buildGeometryForConditionalLines();

    // Now handle triangle colors and vertices:
    let triangleVertexAttribute, triangleVertices = [], rgb = {'4':[], '2':[], '1':[]};
    this.vertices.forEach(v => triangleVertices.push(v.x, v.y, v.z, 0.1, 
                                                     v.x, v.y, v.z, 1.1,
                                                     v.x, v.y, v.z, 2.1)); // Green, red, blue
    
    this.triangles.forEach(triangle => {
            rgb['2'].push(3*triangle.p1, 3*triangle.p2, 3*triangle.p3); // Green
            rgb['4'].push(1+3*triangle.p3, 1+3*triangle.p2, 1+3*triangle.p1); // Red
        });
    this.triangles2.forEach(triangle => {
            rgb['1'].push(2+3*triangle.p1, 2+3*triangle.p2, 2+3*triangle.p3); // Blue
            rgb['1'].push(2+3*triangle.p3, 2+3*triangle.p2, 2+3*triangle.p1); // Blue
        });

    triangleVertexAttribute = new THREE.Float32BufferAttribute(triangleVertices, 4);

    [1,2,4].forEach(c => {
	let geom = this.buildGeometry(rgb[c], triangleVertexAttribute);
	if(geom) {
            this.triangleGeometries[c] = geom;
	}
    });

    this.geometriesBuilt = true;
}

LDR.BFCGeometry.prototype.buildGeometry = function(indices, vertexAttribute) {
    if(indices.length === 0) {
	return null;
    }
    let g = new THREE.BufferGeometry();
    g.setIndex(indices);
    g.setAttribute('position', vertexAttribute);
    return g;
}

LDR.BFCGeometry.prototype.buildGeometryForConditionalLines = function() {
    if(this.conditionalLines.length === 0) {
	return;
    }

    let conditionalLines = [];
    this.conditionalLines.forEach(p => {
            let p1 = this.vertices[p.p1];
            let p2 = this.vertices[p.p2];
            let p3 = this.vertices[p.p3];
            let p4 = this.vertices[p.p4];
            conditionalLines.push({p1:p1, p2:p2, p3:p3, p4:p4});
        });

    this.conditionalLineGeometry = new THREE.BufferGeometry();
    let p1s = [], p2s = [], p3s = [], p4s = [];

    // Now handle conditional lines:
    conditionalLines.forEach(line => {
            let p1 = line.p1, p2 = line.p2, p3 = line.p3, p4 = line.p4;
            p1s.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z); // 2 points => 1 line in shader.
            p2s.push(p2.x, p2.y, p2.z, p1.x, p1.y, p1.z); // Counter points for calculations
            p3s.push(p3.x, p3.y, p3.z, p3.x, p3.y, p3.z); // p3's
            p4s.push(p4.x, p4.y, p4.z, p4.x, p4.y, p4.z); // p4's
        });
    this.conditionalLineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p1s), 3));
    this.conditionalLineGeometry.setAttribute('p2', new THREE.BufferAttribute(new Float32Array(p2s), 3));
    this.conditionalLineGeometry.setAttribute('p3', new THREE.BufferAttribute(new Float32Array(p3s), 3));
    this.conditionalLineGeometry.setAttribute('p4', new THREE.BufferAttribute(new Float32Array(p4s), 3));
}

LDR.BFCGeometry.prototype.replaceWith = function(g) {
    this.vertices = g.vertices;
    this.lines = g.lines;
    this.conditionalLines = g.conditionalLines;
    this.triangles = g.triangles;
    this.triangles2 = g.triangles2;
    this.boundingBox = g.boundingBox;
}

LDR.BFCGeometry.prototype.replaceWithDeep = function(g) {
    let self = this;

    g.vertices.forEach(v => self.vertices.push({x:v.x, y:v.y, z:v.z}))
    g.lines.forEach(p => self.lines.push({p1:p.p1, p2:p.p2}));
    g.conditionalLines.forEach(p => self.conditionalLines.push({p1:p.p1, p2:p.p2, p3:p.p3, p4:p.p4}));
    g.triangles.forEach(p => self.triangles.push({p1:p.p1, p2:p.p2, p3:p.p3}));
    g.triangles2.forEach(p => self.triangles2.push({p1:p.p1, p2:p.p2, p3:p.p3}));

    this.boundingBox.copy(g.boundingBox);
}

/*
  Build this from the 4 types of primitives.
*/
LDR.BFCGeometry.prototype.fromPrimitives = function(lines, conditionalLines, triangles, quads) {
    let geometries = [];

    if(lines.length > 0) {
	let g = new LDR.BFCGeometry(); 
	g.fromLines(lines);
	geometries.push(g);
    }
    if(conditionalLines.length > 0) {
	let g = new LDR.BFCGeometry(); 
	g.fromConditionalLines(conditionalLines);
	geometries.push(g);
    }
    let culledTriangles = triangles.filter(t => t.cull);
    if(culledTriangles.length > 0) {
	let g = new LDR.BFCGeometry(); 
	g.fromTriangles(true, culledTriangles);
	geometries.push(g);
    }
    let unculledTriangles = triangles.filter(t => !t.cull);
    if(unculledTriangles.length > 0) {
	let g = new LDR.BFCGeometry(); 
	g.fromTriangles(false, unculledTriangles);
	geometries.push(g);
    }
    let culledQuads = quads.filter(q => q.cull);
    if(culledQuads.length > 0) {
	let g = new LDR.BFCGeometry(); 
	g.fromQuads(true, culledQuads);
	geometries.push(g);
    }
    let unculledQuads = quads.filter(q => !q.cull);
    if(unculledQuads.length > 0) {
	let g = new LDR.BFCGeometry(); 
	g.fromQuads(false, unculledQuads);
	geometries.push(g);
    }
    this.replaceWith(LDR.mergeGeometries(geometries));
}

/*
  Assumes unsorted vertices that reference the primitives.
  This function sort the vertices and updates the primitives to reference the vertices.
 */
LDR.BFCGeometry.prototype.sortAndBurnVertices = function(vertices, primitives) {
    vertices.sort(LDR.vertexSorter);
    let prev;
    for(let i = 0; i < vertices.length; i++) {
	let v = vertices[i];
	if(!(prev && prev.x === v.x && prev.y === v.y && prev.z === v.z)) {
	    this.vertices.push({x:v.x, y:v.y, z:v.z});
	}

        let p = primitives[v.idx];
	if(v.p === 1) {
	    p.p1 = this.vertices.length-1;
        }
	else if(v.p === 2) {
	    p.p2 = this.vertices.length-1;
        }
	else if(v.p === 3) {
	    p.p3 = this.vertices.length-1;
        }
	else {
	    p.p4 = this.vertices.length-1;
        }
	prev = v;
    }
}

/*
  Build a geometry from normal {p1,p2,c} lines.
 */
LDR.BFCGeometry.prototype.fromLines = function(ps) {
    let vertices = [];
    for(let i = 0; i < ps.length; i++) {
	let p = ps[i];
        this.lines.push({});
	vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, idx:i, p:1},
		      {x:p.p2.x, y:p.p2.y, z:p.p2.z, idx:i, p:2});
        this.boundingBox.expandByPoint(p.p1);
        this.boundingBox.expandByPoint(p.p2);
    }
    this.sortAndBurnVertices(vertices, this.lines);
}

LDR.BFCGeometry.prototype.fromConditionalLines = function(ps) {
    let vertices = [];
    for(let i = 0; i < ps.length; i++) {
	let p = ps[i];
        this.conditionalLines.push({});
	vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, idx:i, p:1},
		      {x:p.p2.x, y:p.p2.y, z:p.p2.z, idx:i, p:2},
		      {x:p.p3.x, y:p.p3.y, z:p.p3.z, idx:i, p:3},
		      {x:p.p4.x, y:p.p4.y, z:p.p4.z, idx:i, p:4});
        this.boundingBox.expandByPoint(p.p1);
        this.boundingBox.expandByPoint(p.p2);
    }
    this.sortAndBurnVertices(vertices, this.conditionalLines);
}

LDR.BFCGeometry.prototype.fromTriangles = function(cull, ps) {
    let vertices = [];
    let t = cull ? this.triangles : this.triangles2;
    for(let i = 0; i < ps.length; i++) {
	let p = ps[i];
        let idx = t.length;
        t.push({});
	vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, idx:idx, p:1},
		      {x:p.p2.x, y:p.p2.y, z:p.p2.z, idx:idx, p:2},
		      {x:p.p3.x, y:p.p3.y, z:p.p3.z, idx:idx, p:3});
        this.boundingBox.expandByPoint(p.p1);
        this.boundingBox.expandByPoint(p.p2);
        this.boundingBox.expandByPoint(p.p3);
    }
    this.sortAndBurnVertices(vertices, t);
}

LDR.BFCGeometry.prototype.fromQuads = function(cull, ps) {
    let vertices = [];
    let t = cull ? this.triangles : this.triangles2;
    for(let i = 0; i < ps.length; i++) {
	let p = ps[i];
        let idx = t.length;
        t.push({}, {});
	vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, idx:idx, p:1},
		      {x:p.p2.x, y:p.p2.y, z:p.p2.z, idx:idx, p:2},
		      {x:p.p3.x, y:p.p3.y, z:p.p3.z, idx:idx, p:3});
	vertices.push({x:p.p3.x, y:p.p3.y, z:p.p3.z, idx:idx+1, p:1},
                      {x:p.p4.x, y:p.p4.y, z:p.p4.z, idx:idx+1, p:2},
                      {x:p.p1.x, y:p.p1.y, z:p.p1.z, idx:idx+1, p:3});
        this.boundingBox.expandByPoint(p.p1);
        this.boundingBox.expandByPoint(p.p2);
        this.boundingBox.expandByPoint(p.p3);
        this.boundingBox.expandByPoint(p.p4);
    }
    this.sortAndBurnVertices(vertices, t);
}

/*
  Consolidate the primitives and sub-parts of the step.
*/
LDR.BFCGeometry.prototype.fromStep = function(loader, step) {
    let geometries = [];
    if(step.hasPrimitives) {
        let g = new LDR.BFCGeometry();
	g.fromPrimitives(step.lines, step.conditionalLines, step.triangles, step.quads);
        geometries.push(g);
    }

    function handleSubModel(subModel) {
        let g = new LDR.BFCGeometry(); 
	g.fromPartDescription(loader, subModel);
        geometries.push(g);
    }
    step.subModels.forEach(handleSubModel);

    this.replaceWith(LDR.mergeGeometries(geometries));
}

LDR.BFCGeometry.prototype.fromPartType = function(loader, pt) {
    if(pt.steps.length === 1) {
        this.fromStep(loader, pt.steps[0]);
    }
    else {
        console.log('Expected 1 step. Skipping geometry for ' + pt.ID);
    }
}

LDR.BFCGeometry.prototype.fromPartDescription = function(loader, pd) {
    let pt = loader.getPartType(pd.ID);
    if(!pt) {
        throw "Part not loaded: " + pd.ID;
    }
    pt.ensureGeometry(loader);

    this.replaceWithDeep(pt.geometry);

    let m4 = new THREE.Matrix4();
    let m3e = pd.r.elements;
    m4.set(
	m3e[0], m3e[3], m3e[6], pd.p.x,
	m3e[1], m3e[4], m3e[7], pd.p.y,
	m3e[2], m3e[5], m3e[8], pd.p.z,
	0, 0, 0, 1
    );
    this.boundingBox.applyMatrix4(m4);

    let invert = pd.invertCCW !== (pd.r.determinant() < 0);
    
    // Update and re-sort the vertices:
    // First decorate with initial index and update position:
    for(let i = 0; i < this.vertices.length; i++) {
	let v = this.vertices[i];
	v.oldIndex = i;
	
	let position = new THREE.Vector3(v.x, v.y, v.z);
	position.applyMatrix3(pd.r);
	position.add(pd.p);
	v.x = position.x;
	v.y = position.y;
	v.z = position.z;
    }
    let newIndices = [];
    this.vertices.sort(LDR.vertexSorter);
    for(let i = 0; i < this.vertices.length; i++) {
	let v = this.vertices[i];
	newIndices[v.oldIndex] = i;
    }
    // Clean up vertices:
    this.vertices.forEach(v => delete v.oldIndex);    
    
    // Update the indices on the primitives:
    this.lines = this.lines.map(p => {return {p1:newIndices[p.p1],p2:newIndices[p.p2]};});
    this.conditionalLines = this.conditionalLines.map(p => {return {p1:newIndices[p.p1],p2:newIndices[p.p2],p3:newIndices[p.p3],p4:newIndices[p.p4]};});
    if(invert) {
        this.triangles = this.triangles.map(p => {return {p1:newIndices[p.p3],p2:newIndices[p.p2],p3:newIndices[p.p1]};});
    }
    else {
        this.triangles = this.triangles.map(p => {return {p1:newIndices[p.p1],p2:newIndices[p.p2],p3:newIndices[p.p3]};});
    }
    this.triangles2 = this.triangles2.map(p => {return {p1:newIndices[p.p1],p2:newIndices[p.p2],p3:newIndices[p.p3]};});

    // If no cull, move all triangles to not be culled:
    if(!pd.cull) {
        this.triangles2.push(...this.triangles);
        this.triangles = [];
    }
}

LDR.BFCGeometry.prototype.mapIndices = function(map) {
    let map2 = function(p, map) {
        p.p1 = map[p.p1];
        p.p2 = map[p.p2];
    }
    let map3 = function(p, map) {
        p.p1 = map[p.p1];
        p.p2 = map[p.p2];
        p.p3 = map[p.p3];
    }
    let map4 = function(p, map) {
        p.p1 = map[p.p1];
        p.p2 = map[p.p2];
        p.p3 = map[p.p3];
        p.p4 = map[p.p4];
    }
    this.lines.forEach(x => map2(x, map));
    this.conditionalLines.forEach(x => map4(x, map));
    this.triangles.forEach(x => map3(x, map));
    this.triangles2.forEach(x => map3(x, map));
}

LDR.BFCGeometry.prototype.merge = function(other) {
    // Merge bounding box:
    this.boundingBox.min.min(other.boundingBox.min);
    this.boundingBox.max.max(other.boundingBox.max);

    // Merge vertices:
    let mergedVertices = []; // Assume both vertex streams are sorted, so duplicates are removed.
    let indexMapThis = []; // original index -> merged vertex index.
    let indexMapOther = []; // Same for other.
    let idxThis = 0, idxOther = 0;

    // Perform merging:
    while(idxThis < this.vertices.length && idxOther < other.vertices.length) {
	let pThis = this.vertices[idxThis];
	let pOther = other.vertices[idxOther];
	if(pThis.x === pOther.x && pThis.y === pOther.y && pThis.z === pOther.z) {
	    indexMapThis.push(mergedVertices.length);
	    indexMapOther.push(mergedVertices.length);
	    mergedVertices.push(pThis);
	    ++idxThis;
	    ++idxOther;
	}
	else if(LDR.vertexLessThan(pThis, pOther)) {
	    indexMapThis.push(mergedVertices.length);
	    mergedVertices.push(pThis);
	    ++idxThis;
	}
	else {
	    indexMapOther.push(mergedVertices.length);
	    mergedVertices.push(pOther);
	    ++idxOther;
	}
    }
    while(idxThis < this.vertices.length) {
	let pThis = this.vertices[idxThis];
	indexMapThis.push(mergedVertices.length);
	mergedVertices.push(pThis);
	++idxThis;
    }
    while(idxOther < other.vertices.length) {
	let pOther = other.vertices[idxOther];
	indexMapOther.push(mergedVertices.length);
	mergedVertices.push(pOther);
	++idxOther;
    }
    
    // Merge the lines, conditional lines, triangles and quads:
    this.vertices = mergedVertices;
    this.mapIndices(indexMapThis);
    other.mapIndices(indexMapOther);

    this.lines.push(...other.lines);
    this.conditionalLines.push(...other.conditionalLines);
    this.triangles.push(...other.triangles);
    this.triangles2.push(...other.triangles2);
}

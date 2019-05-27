'use strict';

/*
  Binary merge of the geometry streams.
 */
LDR.mergeGeometries = function(geometries) {
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

LDR.LDRGeometry = function() {
    this.vertices = []; // sorted (x,y,z).
    this.lines = {}; // c -> [{p1,p2},...] (color -> indices)
    this.conditionalLines = {}; // c -> [{p1,p2,p3,p4},...]
    this.triangles = {}; // c -> [{p1,p2,p3},...]
    this.quads = {}; // c -> [{p1,p2,p3},...]
    this.cull = true;
    // geometries:
    this.lineColorManager;
    this.lineGeometry;
    this.triangleColorManager;
    this.triangleGeometry;
    this.conditionalLineGeometry;
    this.geometriesBuilt = false;
    this.boundingBox = new THREE.Box3();
}

LDR.LDRGeometry.prototype.serialize = function() {
    let c = this.pack();
    let ret = '1'; // version

    function format(x) {
	if(x == Math.round(x)) {
	    return x;
        }
	return x.toFixed(3);
    }

    let fArray = c.f;
    ret += ',' + fArray.length;
    for(let i = 0; i < fArray.length; i++) {
	ret += ',' + format(fArray[i]);
    }
    let iArray = c.i;
    ret += ',' + iArray.length;
    for(let i = 0; i < iArray.length; i++) {
	ret += ',' + iArray[i];
    }
    return ret;
}

LDR.LDRGeometry.prototype.pack = function() {
    let arrayF = [];
    let arrayI = [];

    // Add vertices:
    let x = this.vertices[0].x;
    let buf = [];
    let bufSize = 0;
    for(let i = 0; i < this.vertices.length; i++) {
	let v = this.vertices[i];
	if(v.x !== x) {
	    arrayI.push(bufSize);
	    arrayF.push(x);
	    arrayF.push(...buf);
	    bufSize = 0;
	    buf = [];
	}
	bufSize++;
	x = v.x;
	buf.push(v.y, v.z);
    }
    arrayI.push(bufSize, -1);
    arrayF.push(x);
    arrayF.push(...buf);

    // Lines:
    function handle(x, size) {
	for(let c in x) {
	    if(!x.hasOwnProperty(c)) {
		continue; // Not a part.
            }
	    let primitives = x[c];
	    arrayI.push(c, primitives.length);
	    for(let i = 0; i < primitives.length; i++) {
		let p = primitives[i];
		arrayI.push(p.p1,p.p2);
		if(size === 3) {
		    arrayI.push(p.p3);
		}
		else if(size === 4) {
		    arrayI.push(p.p3, p.p4);
		}
	    }
	}
	arrayI.push(-1);
    }
    handle(this.lines, 2);
    handle(this.conditionalLines, 4);
    handle(this.triangles, 3);
    handle(this.quads, 4);

    let i = this.vertices.length > 32767 ? new Int32Array(arrayI) : new Int16Array(arrayI);
    return {f:new Float32Array(arrayF), i:i};
}

LDR.LDRGeometry.prototype.deserialize = function(txt) {
    let a = Float32Array.from(txt.split(/\,/));
    if(a[0] !== 1) {
	throw 'version error!';
    }

    let sizeF = a[1];
    let arrayF = [], arrayI = [];
    let idx = 2;
    for(let i = 0; i < sizeF; i++) {
	arrayF.push(a[idx++]);
    }
    let sizeI = a[idx++];
    for(let i = 0; i < sizeI; i++) {
	arrayI.push(a[idx++]);
    }

    let packed = {f:arrayF, i:arrayI};
    this.unpack(packed);
}

LDR.LDRGeometry.prototype.unpack = function(packed) {
    let arrayF = packed.f;
    let arrayI = packed.i;
    let idxI = 0, idxF = 0;

    while(true) {
	if(idxI >= arrayI.length) {
	    throw 'Deserialization error 1!';
        }
	let numVertices = arrayI[idxI++];
	if(numVertices < 0) {
	    break;
        }
	let x = arrayF[idxF++];
	for(let i = 0; i < numVertices; i++) {
	    let v = {x:x, y:arrayF[idxF++], z:arrayF[idxF++]};
	    this.vertices.push(v);
	}
    }
    //console.log('Geometry from storage. Vertices: ' + numVertices + " x " + a.length + " from " + txt.substring(0, 500));

    var self = this;
    function extract(size, into, pointsForBoundingBox) {
	while(true) {
	    if(idxI >= arrayI.length) {
		throw 'Deserialization error!';
            }
	    let ret = [];
	    let c = arrayI[idxI++];
	    if(c < 0) {
		return;
	    }
	    let len = arrayI[idxI++];
	    for(let i = 0; i < len; i++) {
                for(var j = 0; j < pointsForBoundingBox; j++) {
                    self.vertices[arrayI[idxI+j]].forBoundingBox = true;
                }
		let p = {p1:arrayI[idxI++], p2:arrayI[idxI++]};
		if(size === 3) {
		    p.p3 = arrayI[idxI++];
		}
		else if(size === 4) {
		    p.p3 = arrayI[idxI++];
		    p.p4 = arrayI[idxI++];
		}
		ret.push(p);
	    }
	    into[c] = ret;
	}
    }
    extract(2, this.lines, 2);
    extract(4, this.conditionalLines, 2);
    extract(3, this.triangles, 3);
    extract(4, this.quads, 4);

    // Build bounding box:
    var self = this;
    this.vertices.forEach(v => {
            if(v.forBoundingBox) {
                self.boundingBox.expandByPoint(v);
                delete v.forBoundingBox;
            }
        });
}

LDR.LDRGeometry.prototype.buildVertexAttribute = function(rotation) {
    let vertices = [];
    for(let i = 0; i < this.vertices.length; i++) {
	let v = this.vertices[i];
	let position = new THREE.Vector3(v.x, v.y, v.z);
	position.applyMatrix3(rotation);

	vertices.push(position.x, position.y, position.z);
    }
    return new THREE.Float32BufferAttribute(vertices, 3);
}

/*
  Three.js geometries and color managers.
 */
LDR.LDRGeometry.prototype.buildGeometriesAndColors = function() {
    if(this.geometriesBuilt) {
	return;
    }
    this.ensureCull();

    this.triangleColorManager = new LDR.ColorManager();
    this.lineColorManager = new LDR.ColorManager();

    // Vertices for the geometries have size 3 for single color geometries and size 4 for multi-colored (they include color indices as fourth component):
    // First handle line vertices:
    let allLineColors = [];
    for(let c in this.lines) {
	if(!this.lines.hasOwnProperty(c)) {
	    continue; // Not a color.
        }
	allLineColors.push(c);
    }
    for(let c in this.conditionalLines) {
	if(!this.conditionalLines.hasOwnProperty(c) || this.lines.hasOwnProperty(c)) {
	    continue; // Not a color.
        }
	allLineColors.push(c);
    }

    let colorIdx = 0;
    let self = this;
    let handleVertex = function(vertices, idx, fc) {
	let v = self.vertices[idx];
	if(v.c !== colorIdx) {
	    v.c = colorIdx;
	    v.idx = vertices.length/4;
	    vertices.push(v.x, v.y, v.z, fc);
	}
	return v.idx;
    }

    let lineVertexAttribute, lineVertices = [], lineIndices = [];
    if(allLineColors.length === 1) {
	let c = allLineColors[0];
	this.lineColorManager.get(c); // Ensure color is present.
	for(let i = 0; i < this.vertices.length; i++) {
	    let v = this.vertices[i];
	    lineVertices.push(v.x, v.y, v.z);
	}
	lineVertexAttribute = new THREE.Float32BufferAttribute(lineVertices, 3);
	// No need to update indices of lines.
	if(this.lines.hasOwnProperty(c)) {
	    let lines = this.lines[c];
	    for(let i = 0; i < lines.length; i++) {
		let line = lines[i];
		lineIndices.push(line.p1, line.p2);
	    }
	}
    }
    else if(allLineColors.length > 1) {
	/*
	  Duplicate vertices for each color.
	 */
	colorIdx++;
	for(let c in this.lines) {
	    if(!this.lines.hasOwnProperty(c)) {
		continue;
	    }
	    let fc = this.lineColorManager.get(c);

	    let lines = this.lines[c];
	    for(let i = 0; i < lines.length; i++) {
		let line = lines[i];
		lineIndices.push(handleVertex(lineVertices, line.p1, fc)); // Update index
		lineIndices.push(handleVertex(lineVertices, line.p2, fc));
	    }
	}
	lineVertexAttribute = new THREE.Float32BufferAttribute(lineVertices, 4);
    }
    this.lineGeometry = this.buildGeometry(lineIndices, lineVertexAttribute);

    // Conditional lines:
    let conditionalLines = [];
    for(let c in this.conditionalLines) {
	if(!this.conditionalLines.hasOwnProperty(c)) {
	    continue;
	}
	colorIdx++;
	let fc = this.lineColorManager.get(c);
	let primitives = this.conditionalLines[c];
	for(let i = 0; i < primitives.length; i++) {
            let p = primitives[i];

	    let p1 = this.vertices[p.p1];
	    let p2 = this.vertices[p.p2];
	    let p3 = this.vertices[p.p3];
	    let p4 = this.vertices[p.p4];
	    conditionalLines.push({p1:p1, p2:p2, p3:p3, p4:p4, fc:fc});
	}
    }
    this.buildGeometryForConditionalLines(allLineColors.length > 1, conditionalLines);

    // Now handle triangle colors and vertices:

    let allTriangleColors = [];
    for(let c in this.triangles) {
	if(this.triangles.hasOwnProperty(c)) {
	    allTriangleColors.push(c);
        }
    }
    for(let c in this.quads) {
	if(this.quads.hasOwnProperty(c) && !this.triangles.hasOwnProperty(c)) {
	    allTriangleColors.push(c);
        }
    }

    let triangleVertexAttribute, triangleVertices = [], triangleIndices = [];
    if(allTriangleColors.length === 1) {
	let c = allTriangleColors[0];
	this.triangleColorManager.get(c); // Ensure color is present.

	for(let i = 0; i < this.vertices.length; i++) {
	    let v = this.vertices[i];
	    triangleVertices.push(v.x, v.y, v.z);
	}
	triangleVertexAttribute = new THREE.Float32BufferAttribute(triangleVertices, 3);

	// No need to update indices for triangles and quads:
	if(this.triangles.hasOwnProperty(c)) {
	    let triangles = this.triangles[c];
	    for(let i = 0; i < triangles.length; i++) {
		let triangle = triangles[i];
		triangleIndices.push(triangle.p1, triangle.p2, triangle.p3);
	    }
	}
	if(this.quads.hasOwnProperty(c)) {
	    let quads = this.quads[c];
	    for(let i = 0; i < quads.length; i++) {
		let q = quads[i];
		triangleIndices.push(q.p1, q.p2, q.p4, q.p2, q.p3, q.p4);
	    }
	}
    }
    else if(allTriangleColors.length > 1) {
	/*
	  Duplicate vertices for each color.
	 */
	for(let j = 0; j < allTriangleColors.length; j++) {
	    let c = allTriangleColors[j];
	    colorIdx++;
	    let fc = this.triangleColorManager.get(c);

	    if(this.triangles.hasOwnProperty(c)) {
		let triangles = this.triangles[c];
		for(let i = 0; i < triangles.length; i++) {
		    let triangle = triangles[i];
		    triangleIndices.push(handleVertex(triangleVertices, triangle.p1, fc));
		    triangleIndices.push(handleVertex(triangleVertices, triangle.p2, fc));
		    triangleIndices.push(handleVertex(triangleVertices, triangle.p3, fc));
		}
	    }
	    if(this.quads.hasOwnProperty(c)) {
		let quads = this.quads[c];
		for(let i = 0; i < quads.length; i++) {
		    let quad = quads[i];
		    let i1 = handleVertex(triangleVertices, quad.p1, fc);
		    let i2 = handleVertex(triangleVertices, quad.p2, fc);
		    let i3 = handleVertex(triangleVertices, quad.p3, fc);
		    let i4 = handleVertex(triangleVertices, quad.p4, fc);
		    triangleIndices.push(i1, i2, i4, i2, i3, i4);
		}
	    }
	}
	triangleVertexAttribute = new THREE.Float32BufferAttribute(triangleVertices, 4);
    }
    this.triangleGeometry = this.buildGeometry(triangleIndices, triangleVertexAttribute);

    this.geometriesBuilt = true;
}

LDR.LDRGeometry.prototype.buildGeometry = function(indices, vertexAttribute) {
    if(indices.length === 0) {
	return null;
    }
    let g = new THREE.BufferGeometry();
    g.setIndex(indices);
    g.addAttribute('position', vertexAttribute);
    return g;
}

LDR.LDRGeometry.prototype.buildGeometryForConditionalLines = function(multiColored, conditionalLines) {
    if(conditionalLines.length === 0) {
	return;
    }
    this.conditionalLineGeometry = new THREE.BufferGeometry();
    let p1s = [], p2s = [], p3s = [], p4s = [], colorIndices = [];

    // Now handle conditional lines:
    for(let i = 0; i < conditionalLines.length; i++) {
	let line = conditionalLines[i]; // {p1, p2, p3, p4, fc}
        let p1 = line.p1, p2 = line.p2, p3 = line.p3, p4 = line.p4;

	p1s.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z); // 2 points => 1 line in shader.
	p2s.push(p2.x, p2.y, p2.z, p1.x, p1.y, p1.z); // Counter points for calculations
	p3s.push(p3.x, p3.y, p3.z, p3.x, p3.y, p3.z); // p3's
	p4s.push(p4.x, p4.y, p4.z, p4.x, p4.y, p4.z); // p4's
	if(multiColored) {
	    colorIndices.push(line.fc, line.fc); // 2 points.
        }
    }
    this.conditionalLineGeometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(p1s), 3));
    this.conditionalLineGeometry.addAttribute('p2', new THREE.BufferAttribute(new Float32Array(p2s), 3));
    this.conditionalLineGeometry.addAttribute('p3', new THREE.BufferAttribute(new Float32Array(p3s), 3));
    this.conditionalLineGeometry.addAttribute('p4', new THREE.BufferAttribute(new Float32Array(p4s), 3));
    if(multiColored) {
	this.conditionalLineGeometry.addAttribute('colorIndex', new THREE.BufferAttribute(new Float32Array(colorIndices), 1));
    }
}

LDR.LDRGeometry.prototype.replaceWith = function(g) {
    this.vertices = g.vertices;
    this.lines = g.lines;
    this.conditionalLines = g.conditionalLines;
    this.triangles = g.triangles;
    this.quads = g.quads;
    this.cull = g.cull;
    this.boundingBox = g.boundingBox;
}

LDR.LDRGeometry.prototype.replaceWithDeep = function(g) {
    for(let i = 0; i < g.vertices.length; i++) {
	let v = g.vertices[i];
	this.vertices.push({x:v.x, y:v.y, z:v.z});
    }

    for(let c in g.lines) {
	if(!g.lines.hasOwnProperty(c)) {
	    continue;
        }
	let primitives = g.lines[c];
	let ps = [];
	for(let i = 0; i < primitives.length; i++) {
            let p = primitives[i];
            ps.push({p1:p.p1, p2:p.p2});
	}
	this.lines[c] = ps;
    }
    for(let c in g.conditionalLines) {
	if(!g.conditionalLines.hasOwnProperty(c)) {
	    continue;
        }
	let primitives = g.conditionalLines[c];
	let ps = [];
	for(let i = 0; i < primitives.length; i++) {
            let p = primitives[i];
            ps.push({p1:p.p1, p2:p.p2, p3:p.p3, p4:p.p4});
	}
	this.conditionalLines[c] = ps;
    }
    for(let c in g.triangles) {
	if(!g.triangles.hasOwnProperty(c)) {
	    continue;
        }
	let primitives = g.triangles[c];
	let ps = [];
	for(let i = 0; i < primitives.length; i++) {
            let p = primitives[i];
            ps.push({p1:p.p1, p2:p.p2, p3:p.p3});
	}
	this.triangles[c] = ps;
    }
    for(let c in g.quads) {
	if(!g.quads.hasOwnProperty(c)) {
	    continue;
        }
	let primitives = g.quads[c];
	let ps = [];
	for(let i = 0; i < primitives.length; i++) {
            let p = primitives[i];
            ps.push({p1:p.p1, p2:p.p2, p3:p.p3, p4:p.p4});
	}
	this.quads[c] = ps;
    }

    this.cull = g.cull;
    this.boundingBox.copy(g.boundingBox);
}

/*
  Build this from the 4 types of primitives.
*/
LDR.LDRGeometry.prototype.fromPrimitives = function(lines, conditionalLines, triangles, quads, parent) {
    let geometries = [];

    if(lines.length > 0) {
	let g = new LDR.LDRGeometry(); 
	g.fromLines(lines);
	geometries.push(g);
    }
    if(conditionalLines.length > 0) {
	let g = new LDR.LDRGeometry(); 
	g.fromConditionalLines(conditionalLines);
	geometries.push(g);
    }
    if(triangles.length > 0) {
	let g = new LDR.LDRGeometry(); 
	g.fromTriangles(triangles);
	geometries.push(g);
    }
    if(quads.length > 0) {
	let g = new LDR.LDRGeometry(); 
	g.fromQuads(quads);
	geometries.push(g);
    }
    this.replaceWith(LDR.mergeGeometries(geometries));
}

/*
  Assumes unsorted vertices that reference the primitives.
  This function sort the vertices and updates the primitives to reference the vertices.
 */
LDR.LDRGeometry.prototype.sortAndBurnVertices = function(vertices, primitives, type) {
    vertices.sort(LDR.vertexSorter);
    let prev;
    for(let i = 0; i < vertices.length; i++) {
	let v = vertices[i];
	if(!(prev && prev.x === v.x && prev.y === v.y && prev.z === v.z)) {
	    this.vertices.push(v);
	}

        let p = primitives[v.c][v.idx];
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
	delete v.idx;
	delete v.p;
	delete v.c;
	prev = v;
    }
}

/*
  Build a geometry from normal {p1,p2,colorID} lines.
 */
LDR.LDRGeometry.prototype.fromLines = function(ps) {
    let vertices = [];
    for(let i = 0; i < ps.length; i++) {
	let p = ps[i], idx;
	if(this.lines.hasOwnProperty(p.colorID)) {
	    let t = this.lines[p.colorID];
	    idx = t.length;
	    t.push({});
	}
	else {
	    this.lines[p.colorID] = [{}];
	    idx = 0;
	}
	vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, c:p.colorID, idx:idx, p:1},
		      {x:p.p2.x, y:p.p2.y, z:p.p2.z, c:p.colorID, idx:idx, p:2});
        this.boundingBox.expandByPoint(p.p1);
        this.boundingBox.expandByPoint(p.p2);
    }
    this.sortAndBurnVertices(vertices, this.lines);
}

LDR.LDRGeometry.prototype.fromConditionalLines = function(ps) {
    let vertices = [];
    for(let i = 0; i < ps.length; i++) {
	let p = ps[i], idx;
	if(this.conditionalLines.hasOwnProperty(p.colorID)) {
	    let t = this.conditionalLines[p.colorID];
	    idx = t.length;
	    t.push({});
	}
	else {
	    this.conditionalLines[p.colorID] = [{}];
	    idx = 0;
	}
	vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, c:p.colorID, idx:idx, p:1},
		      {x:p.p2.x, y:p.p2.y, z:p.p2.z, c:p.colorID, idx:idx, p:2},
		      {x:p.p3.x, y:p.p3.y, z:p.p3.z, c:p.colorID, idx:idx, p:3},
		      {x:p.p4.x, y:p.p4.y, z:p.p4.z, c:p.colorID, idx:idx, p:4});
        this.boundingBox.expandByPoint(p.p1);
        this.boundingBox.expandByPoint(p.p2);
    }
    this.sortAndBurnVertices(vertices, this.conditionalLines);
}

LDR.LDRGeometry.prototype.fromTriangles = function(ps) {
    let vertices = [];
    for(let i = 0; i < ps.length; i++) {
	let p = ps[i], idx;
	if(this.triangles.hasOwnProperty(p.colorID)) {
	    let t = this.triangles[p.colorID];
	    idx = t.length;
	    t.push({});
	}
	else {
	    this.triangles[p.colorID] = [{}];
	    idx = 0;
	}
	vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, c:p.colorID, idx:idx, p:1},
		      {x:p.p2.x, y:p.p2.y, z:p.p2.z, c:p.colorID, idx:idx, p:2},
		      {x:p.p3.x, y:p.p3.y, z:p.p3.z, c:p.colorID, idx:idx, p:3});
        this.boundingBox.expandByPoint(p.p1);
        this.boundingBox.expandByPoint(p.p2);
        this.boundingBox.expandByPoint(p.p3);
    }
    this.sortAndBurnVertices(vertices, this.triangles);
}

LDR.LDRGeometry.prototype.fromQuads = function(ps) {
    let vertices = [];
    for(let i = 0; i < ps.length; i++) {
	let p = ps[i], idx;
	if(this.quads.hasOwnProperty(p.colorID)) {
	    let t = this.quads[p.colorID];
	    idx = t.length;
	    t.push({});
	}
	else {
	    this.quads[p.colorID] = [{}];
	    idx = 0;
	}
	vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, c:p.colorID, idx:idx, p:1},
		      {x:p.p2.x, y:p.p2.y, z:p.p2.z, c:p.colorID, idx:idx, p:2},
		      {x:p.p3.x, y:p.p3.y, z:p.p3.z, c:p.colorID, idx:idx, p:3},
		      {x:p.p4.x, y:p.p4.y, z:p.p4.z, c:p.colorID, idx:idx, p:4});
        this.boundingBox.expandByPoint(p.p1);
        this.boundingBox.expandByPoint(p.p2);
        this.boundingBox.expandByPoint(p.p3);
        this.boundingBox.expandByPoint(p.p4);
    }
    this.sortAndBurnVertices(vertices, this.quads);
}

/*
  Consolidate the primitives and sub-parts of the step.
*/
LDR.LDRGeometry.prototype.fromStep = function(loader, step, parent) {
    let geometries = [];
    if(step.hasPrimitives) {
        let g = new LDR.LDRGeometry();
	g.fromPrimitives(step.lines, step.conditionalLines, step.triangles, step.quads, parent);
        geometries.push(g);
    }
    function handleSubModel(subModel) {
        let g = new LDR.LDRGeometry(); 
	g.fromPartDescription(loader, subModel);
        geometries.push(g);
    }
    step.subModels.forEach(handleSubModel);
    this.replaceWith(LDR.mergeGeometries(geometries));
    this.cull = step.cull;
}

LDR.LDRGeometry.prototype.fromPartType = function(loader, pt) {
    let geometries = [];
    if(pt.steps.length === 0) {
	console.warn("No steps in " + pt.ID);
	return; // Empty - just make empty.
    }
    for(let i = 0; i < pt.steps.length; i++) {
	let step = pt.steps[i];
        let g = new LDR.LDRGeometry();
	g.fromStep(loader, step, pt.ID);
        geometries.push(g);
    }
    this.replaceWith(LDR.mergeGeometries(geometries));
}

LDR.LDRGeometry.prototype.fromPartDescription = function(loader, pd) {
    if(!loader.partTypes[pd.ID].geometry) {
	console.dir(loader.partTypes[pd.ID]);
	throw "Missing geometry on " + pd.ID;
    }
    this.replaceWithDeep(loader.partTypes[pd.ID].geometry); // Assume pd.ID has prepared geometry.
    this.cull = this.cull && pd.cull;

    let m4 = new THREE.Matrix4();
    let m3e = pd.rotation.elements;
    m4.set(
	m3e[0], m3e[3], m3e[6], pd.position.x,
	m3e[1], m3e[4], m3e[7], pd.position.y,
	m3e[2], m3e[5], m3e[8], pd.position.z,
	0, 0, 0, 1
    );
    this.boundingBox.applyMatrix4(m4);

    let invert = pd.invertCCW !== (pd.rotation.determinant() < 0);

    // Function to update color:
    let replaceColor;
    if(pd.colorID === 16) {
	replaceColor = function(x){return x;}; // Do nothing.
    }
    else if(pd.colorID === 24) {	    
	replaceColor = function(x) {
	    x = parseInt(x);
	    if(x === 16) {
		return 24;
            }
	    else {
		return x;
            }
	};
    }
    else {
	replaceColor = function(x) {
	    x = parseInt(x);
	    if(x === 16) {
		return pd.colorID;
            }
	    else if(x === 24) {
		return pd.colorID + 10000;
            }
	    else {
		return x;
            }
	};
    }

    // TODO: Optimize rotation matrices for I-matrix (1,0,0,0,1,0,0,0,1), \-matrices, etc.
    
    // Update and re-sort the vertices:
    // First decorate with initial index and update position:
    for(let i = 0; i < this.vertices.length; i++) {
	let v = this.vertices[i];
	v.idx = i;
	
	let position = new THREE.Vector3(v.x, v.y, v.z);
	position.applyMatrix3(pd.rotation);
	position.add(pd.position);
	v.x = position.x;
	v.y = position.y;
	v.z = position.z;
    }
    this.vertices.sort(LDR.vertexSorter);
    for(let i = 0; i < this.vertices.length; i++) {
	let v = this.vertices[i];
	this.vertices[v.idx].newIndex = i;
    }
    
    // Update the indices and colors on the primitives:

    for(let c in this.lines) {
	if(!this.lines.hasOwnProperty(c)) {
	    continue;
        }
	let lines = this.lines[c];
	for(let i = 0; i < lines.length; i++) {
            let p = lines[i];
	    let v1 = this.vertices[p.p1];
	    let v2 = this.vertices[p.p2];
	    p.p1 = v1.newIndex;
	    p.p2 = v2.newIndex;
	}
	let toColor = replaceColor(c);
	if(toColor !== c) {
	    if(this.lines.hasOwnProperty(toColor)) {
		this.lines[toColor].push(...lines);
	    }
	    else {
		this.lines[toColor] = lines;
	    }
	    delete this.lines[c];
	}
    }
    for(let c in this.conditionalLines) {
	if(!this.conditionalLines.hasOwnProperty(c)) {
	    continue;
        }
	let conditionalLines = this.conditionalLines[c];
	for(let i = 0; i < conditionalLines.length; i++) {
            let p = conditionalLines[i];
	    let v1 = this.vertices[p.p1];
	    let v2 = this.vertices[p.p2];
	    let v3 = this.vertices[p.p3];
	    let v4 = this.vertices[p.p4];
	    p.p1 = v1.newIndex;
	    p.p2 = v2.newIndex;
	    p.p3 = v3.newIndex;
	    p.p4 = v4.newIndex;
	}
	let toColor = replaceColor(c);
	if(toColor !== c) {
	    if(this.conditionalLines.hasOwnProperty(toColor)) {
		this.conditionalLines[toColor].push(...conditionalLines);
	    }
	    else {
		this.conditionalLines[toColor] = conditionalLines;
	    }
	    delete this.conditionalLines[c];
	}
    }

    if(invert) {
	for(let c in this.triangles) {
	    if(!this.triangles.hasOwnProperty(c)) {
		continue;
            }
	    let triangles = this.triangles[c];
	    for(let i = 0; i < triangles.length; i++) {
		let p = triangles[i];
		let v1 = this.vertices[p.p1];
		let v2 = this.vertices[p.p2];
		let v3 = this.vertices[p.p3];
		p.p1 = v3.newIndex;
		p.p2 = v2.newIndex;
		p.p3 = v1.newIndex;
	    }
	    let toColor = replaceColor(c);
	    if(toColor !== c) {
		if(this.triangles.hasOwnProperty(toColor)) {
		    this.triangles[toColor].push(...triangles);
		}
		else {
		    this.triangles[toColor] = triangles;
		}
		delete this.triangles[c];
	    }
	}
	for(let c in this.quads) {
	    if(!this.quads.hasOwnProperty(c)) {
		continue;
            }
	    let quads = this.quads[c];
	    for(let i = 0; i < quads.length; i++) {
		let p = quads[i];
		let v1 = this.vertices[p.p1];
		let v2 = this.vertices[p.p2];
		let v3 = this.vertices[p.p3];
		let v4 = this.vertices[p.p4];
		p.p1 = v4.newIndex;
		p.p2 = v3.newIndex;
		p.p3 = v2.newIndex;
		p.p4 = v1.newIndex;
	    }	    
	    let toColor = replaceColor(c);
	    if(toColor !== c) {
		if(this.quads.hasOwnProperty(toColor)) {
		    this.quads[toColor].push(...quads);
		}
		else {
		    this.quads[toColor] = quads;
		}
		delete this.quads[c];
	    }
	}
    }
    else {
	for(let c in this.triangles) {
	    if(!this.triangles.hasOwnProperty(c)) {
		continue;
            }
	    let triangles = this.triangles[c];
	    for(let i = 0; i < triangles.length; i++) {
		let p = triangles[i];
		let v1 = this.vertices[p.p1];
		let v2 = this.vertices[p.p2];
		let v3 = this.vertices[p.p3];
		p.p1 = v1.newIndex;
		p.p2 = v2.newIndex;
		p.p3 = v3.newIndex;
	    }
	    let toColor = replaceColor(c);
	    if(toColor !== c) {
		if(this.triangles.hasOwnProperty(toColor)) {
		    this.triangles[toColor].push(...triangles);
		}
		else {
		    this.triangles[toColor] = triangles;
		}
		delete this.triangles[c];
	    }
	}
	for(let c in this.quads) {
	    if(!this.quads.hasOwnProperty(c)) {
		continue;
            }
	    let quads = this.quads[c];
	    for(let i = 0; i < quads.length; i++) {
		let p = quads[i];
		let v1 = this.vertices[p.p1];
		let v2 = this.vertices[p.p2];
		let v3 = this.vertices[p.p3];
		let v4 = this.vertices[p.p4];
		p.p1 = v1.newIndex;
		p.p2 = v2.newIndex;
		p.p3 = v3.newIndex;
		p.p4 = v4.newIndex;
	    }	    
	    let toColor = replaceColor(c);
	    if(toColor !== c) {
		if(this.quads.hasOwnProperty(toColor)) {
		    this.quads[toColor].push(...quads);
		}
		else {
		    this.quads[toColor] = quads;
		}
		delete this.quads[c];
	    }
	}
    }

    // Clean up:
    for(let i = 0; i < this.vertices.length; i++) {
	let v = this.vertices[i];
	delete v.idx;
	delete v.newIndex;
    }
}

LDR.map2 = function(p, map) {
    p.p1 = map[p.p1];
    p.p2 = map[p.p2];
}
LDR.map3 = function(p, map) {
    p.p1 = map[p.p1];
    p.p2 = map[p.p2];
    p.p3 = map[p.p3];
}
LDR.map4 = function(p, map) {
    p.p1 = map[p.p1];
    p.p2 = map[p.p2];
    p.p3 = map[p.p3];
    p.p4 = map[p.p4];
}
LDR.LDRGeometry.prototype.mapIndices = function(map) {
    for(let c in this.lines) {
	if(this.lines.hasOwnProperty(c)) {
	    this.lines[c].forEach(function(x){LDR.map2(x, map);});
        }
    }
    for(let c in this.conditionalLines) {
	if(this.conditionalLines.hasOwnProperty(c)) {
	    this.conditionalLines[c].forEach(function(x){LDR.map4(x, map);});
        }
    }
    for(let c in this.triangles) {
	if(this.triangles.hasOwnProperty(c)) {
	    this.triangles[c].forEach(function(x){LDR.map3(x, map);});
        }
    }
    for(let c in this.quads) {
	if(this.quads.hasOwnProperty(c)) {
	    this.quads[c].forEach(function(x){LDR.map4(x, map);});
        }
    }
}

LDR.LDRGeometry.prototype.ensureCull = function() {
    if(this.cull) {
	return;
    }
    for(let c in this.triangles) {
	if(!this.triangles.hasOwnProperty(c)) {
	    continue;
        }
	let triangles = this.triangles[c];
	let T = triangles.length;
	for(let i = 0; i < T; i++) {
	    let t = triangles[i];
	    triangles.push({p1:t.p3, p2:t.p2, p3:t.p1});
	}
    }
    for(let c in this.quads) {
	if(!this.quads.hasOwnProperty(c)) {
	    continue;
        }
	let quads = this.quads[c];
	let Q = quads.length;
	for(let i = 0; i < Q; i++) {
	    let q = quads[i];
	    quads.push({p1:q.p4, p2:q.p3, p3:q.p2, p4:q.p1});
	}
    }
    this.cull = true;
}

LDR.LDRGeometry.prototype.merge = function(other) {
    this.ensureCull();
    other.ensureCull();

    // Merge bounding box:
    this.boundingBox.expandByPoint(other.boundingBox.min);
    this.boundingBox.expandByPoint(other.boundingBox.max);

    // Merge vertices:
    let mergedVertices = []; // Assume both vertex streams are sorted, so duplicates are removed.
    let indexMapThis = []; // original index -> merged vertex index.
    let indexMapOther = []; // Same for other.
    let idxThis = 0, idxOther = 0;

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

    for(let c in other.lines) {
	if(!other.lines.hasOwnProperty(c)) {
	    continue;
        }
	if(this.lines.hasOwnProperty(c)) {
	    this.lines[c].push(...other.lines[c]);
        }
	else {
	    this.lines[c] = other.lines[c];
        }
    }
    for(let c in other.conditionalLines) {
	if(!other.conditionalLines.hasOwnProperty(c)) {
	    continue;
        }
	if(this.conditionalLines.hasOwnProperty(c)) {
	    this.conditionalLines[c].push(...other.conditionalLines[c]);
        }
	else {
	    this.conditionalLines[c] = other.conditionalLines[c];
        }
    }
    for(let c in other.triangles) {
	if(!other.triangles.hasOwnProperty(c)) {
	    continue;
        }
	if(this.triangles.hasOwnProperty(c)) {
	    this.triangles[c].push(...other.triangles[c]);
        }
	else {
	    this.triangles[c] = other.triangles[c];
        }
    }
    for(let c in other.quads) {
	if(!other.quads.hasOwnProperty(c)) {
	    continue;
        }
	if(this.quads.hasOwnProperty(c)) {
	    this.quads[c].push(...other.quads[c]);
        }
	else {
	    this.quads[c] = other.quads[c];
        }
    }
}

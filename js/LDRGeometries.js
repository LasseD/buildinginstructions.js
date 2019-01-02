/*
  Binary merge of the geometry streams.
 */
LDR.mergeGeometries = function(geometries) {
    while(geometries.length > 1) {
	var nextGeometries = [];
	if(geometries.length % 2 == 1) {
	    nextGeometries.push(geometries[geometries.length-1]);
	}
	for(var i = 0; i < geometries.length-1; i+=2) {
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
    if(a.x != b.x)
	return a.x-b.x;
    if(a.y != b.y)
	return a.y-b.y;
    if(a.z != b.z)
	return a.z-b.z;
    return a.c-b.c;
}

LDR.vertexLessThan = function(a, b) {
    if(a.x != b.x)
	return a.x < b.x;
    if(a.y != b.y)
	return a.y < b.y;
    if(a.z != b.z)
	return a.z < b.z;
    return a.c < b.c;
}

LDR.LDRGeometry = function() {
    this.vertices = []; // sorted (x,y,z,c).
    this.lines = []; // {p1,p2}
    this.conditionalLines = []; // {p1,p2,p3,p4}
    this.triangles = [];
    this.quads = [];
    this.cull = true;
}

LDR.LDRGeometry.prototype.replaceWith = function(g) {
    this.vertices = g.vertices;
    this.lines = g.lines;
    this.conditionalLines = g.conditionalLines;
    this.triangles = g.triangles;
    this.quads = g.quads;
    this.cull = g.cull;
}

LDR.LDRGeometry.prototype.replaceWithDeep = function(g) {
    for(var i = 0; i < g.vertices.length; i++) {
	var v = g.vertices[i];
	this.vertices.push({x:v.x, y:v.y, z:v.z, c:v.c});
    }

    for(var i = 0; i < g.lines.length; i++) {
        var p = g.lines[i];
        this.lines.push({p1:p.p1, p2:p.p2});
    }
    for(var i = 0; i < g.conditionalLines.length; i++) {
        var p = g.conditionalLines[i];
        this.conditionalLines.push({p1:p.p1, p2:p.p2, p3:p.p3, p4:p.p4});
    }
    for(var i = 0; i < g.triangles.length; i++) {
        var p = g.triangles[i];
        this.triangles.push({p1:p.p1, p2:p.p2, p3:p.p3});
    }
    for(var i = 0; i < g.quads.length; i++) {
        var p = g.quads[i];
        this.quads.push({p1:p.p1, p2:p.p2, p3:p.p3, p4:p.p4});
    }
    this.cull = g.cull;
}

/*
  Build this from the 4 types of primitives.
*/
LDR.LDRGeometry.prototype.fromPrimitives = function(lines, conditionalLines, triangles, quads, parent) { // TODO: Remove all parents, types and other debugging strings
    var geometries = [];

    if(lines.length > 0) {
	var g = new LDR.LDRGeometry(); 
	g.fromLines(lines);
	geometries.push(g);
    }
    if(conditionalLines.length > 0) {
	var g = new LDR.LDRGeometry(); 
	g.fromConditionalLines(conditionalLines);
	geometries.push(g);
    }
    if(triangles.length > 0) {
	var g = new LDR.LDRGeometry(); 
	g.fromTriangles(triangles);
	geometries.push(g);
    }
    if(quads.length > 0) {
	var g = new LDR.LDRGeometry(); 
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
    var prev;
    for(var i = 0; i < vertices.length; i++) {
	var v = vertices[i];
	if(!(prev && prev.x == v.x && prev.y == v.y && prev.z == v.z && prev.c == v.c)) {
	    this.vertices.push(v);
	}
	if(v.p == 1)
	    primitives[v.idx].p1 = this.vertices.length-1;
	else if(v.p == 2)
	    primitives[v.idx].p2 = this.vertices.length-1;
	else if(v.p == 3)
	    primitives[v.idx].p3 = this.vertices.length-1;
	else
	    primitives[v.idx].p4 = this.vertices.length-1;
	delete v.idx;
	delete v.p;
	prev = v;
    }
}

/*
  Build a geometry from normal {p1,p2,colorID} lines.
 */
LDR.LDRGeometry.prototype.fromLines = function(ps) {
    var vertices = [];
    for(var i = 0; i < ps.length; i++) {
	var p = ps[i];
	vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, c:p.colorID, idx:i, p:1},
		      {x:p.p2.x, y:p.p2.y, z:p.p2.z, c:p.colorID, idx:i, p:2});
	this.lines.push({});
    }
    this.sortAndBurnVertices(vertices, this.lines, "lines");
}

LDR.LDRGeometry.prototype.fromConditionalLines = function(ps) {
    var vertices = [];
    for(var i = 0; i < ps.length; i++) {
	var p = ps[i];
	vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, c:p.colorID, idx:i, p:1},
		      {x:p.p2.x, y:p.p2.y, z:p.p2.z, c:p.colorID, idx:i, p:2},
		      {x:p.p3.x, y:p.p3.y, z:p.p3.z, c:p.colorID, idx:i, p:3},
		      {x:p.p4.x, y:p.p4.y, z:p.p4.z, c:p.colorID, idx:i, p:4});
	this.conditionalLines.push({});
    }
    this.sortAndBurnVertices(vertices, this.conditionalLines, " conditional lines");
}

LDR.LDRGeometry.prototype.fromTriangles = function(ps) {
    var vertices = [];
    for(var i = 0; i < ps.length; i++) {
	var p = ps[i];
	vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, c:p.colorID, idx:i, p:1},
		      {x:p.p2.x, y:p.p2.y, z:p.p2.z, c:p.colorID, idx:i, p:2},
		      {x:p.p3.x, y:p.p3.y, z:p.p3.z, c:p.colorID, idx:i, p:3});
	this.triangles.push({});
    }
    this.sortAndBurnVertices(vertices, this.triangles, "triangles");
}

LDR.LDRGeometry.prototype.fromQuads = function(ps) {
    var vertices = [];
    for(var i = 0; i < ps.length; i++) {
	var p = ps[i];
	vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, c:p.colorID, idx:i, p:1},
		      {x:p.p2.x, y:p.p2.y, z:p.p2.z, c:p.colorID, idx:i, p:2},
		      {x:p.p3.x, y:p.p3.y, z:p.p3.z, c:p.colorID, idx:i, p:3},
		      {x:p.p4.x, y:p.p4.y, z:p.p4.z, c:p.colorID, idx:i, p:4});
	this.quads.push({});
    }
    this.sortAndBurnVertices(vertices, this.quads, "quads");
}

/*
  Consolidate the primitives and sub-parts of the step.
*/
LDR.LDRGeometry.prototype.fromStep = function(loader, step, parent) {
    var geometries = [];
    if(step.hasPrimitives) {
        var g = new LDR.LDRGeometry();
	g.fromPrimitives(step.lines, step.conditionalLines, step.triangles, step.quads, parent);
        geometries.push(g);
    }
    for(var i = 0; i < step.ldrs.length; i++) {
        var g = new LDR.LDRGeometry(); 
	g.fromPartDescription(loader, step.ldrs[i]);
        geometries.push(g);
    }
    for(var i = 0; i < step.dats.length; i++) {
        var g = new LDR.LDRGeometry(); 
	g.fromPartDescription(loader, step.dats[i]);
        geometries.push(g);
    }
    this.replaceWith(LDR.mergeGeometries(geometries));
    this.cull = step.cull;
}

LDR.LDRGeometry.prototype.fromPartType = function(loader, pt) {
    var geometries = [];
    if(pt.steps.length == 0) {
	return; // Empty - just make empty.
    }
    for(var i = 0; i < pt.steps.length; i++) {
	var step = pt.steps[i];
        var g = new LDR.LDRGeometry();
	g.fromStep(loader, step, pt.ID);
        geometries.push(g);
    }
    this.replaceWith(LDR.mergeGeometries(geometries));
}

LDR.LDRGeometry.prototype.fromPartDescription = function(loader, pd) {
    this.replaceWithDeep(loader.ldrPartTypes[pd.ID].geometry); // Assume pd.ID has prepared geometry.
    this.cull = this.cull && pd.cull;
    var invert = pd.invertCCW != (pd.rotation.determinant() < 0);

    // Function to update color:
    var updateColor;
    if(pd.colorID == 16) {
	updateColor = function(){}; // Do nothing.
    }
    else if(pd.colorID == 24) {	    
	updateColor = function(p) {
	    if(p.c == 16)
		p.c = 24; // Replace base colors with edge colors.
	};
    }
    else {
	updateColor = function(p) {
	    if(p.c == 16)
		p.c = pd.colorID;
	    else if(p.c == 24)
		p.c = pd.colorID+10000;
	};
    }

    // TODO: Optimize rotation matrices for I-matrix (1,0,0,0,1,0,0,0,1), \-matrices, etc.
    
    // Update and re-sort the vertices:
    // First decorate with initial index and update position:
    for(var i = 0; i < this.vertices.length; i++) {
	var v = this.vertices[i];
	v.idx = i;
	
	var position = new THREE.Vector3(v.x, v.y, v.z);
	position.applyMatrix3(pd.rotation);
	position.add(pd.position);
	v.x = position.x;
	v.y = position.y;
	v.z = position.z;
	updateColor(v);
    }
    this.vertices.sort(LDR.vertexSorter);
    for(var i = 0; i < this.vertices.length; i++) {
	var v = this.vertices[i];
	this.vertices[v.idx].newIndex = i;
    }
    
    // Update the indices and colors on the primitives:
    for(var i = 0; i < this.lines.length; i++) {
        var p = this.lines[i];
	var v1 = this.vertices[p.p1];
	var v2 = this.vertices[p.p2];
	p.p1 = v1.newIndex;
	p.p2 = v2.newIndex;
    }
    for(var i = 0; i < this.conditionalLines.length; i++) {
        var p = this.conditionalLines[i];
	var v1 = this.vertices[p.p1];
	var v2 = this.vertices[p.p2];
	var v3 = this.vertices[p.p3];
	var v4 = this.vertices[p.p4];
	p.p1 = v1.newIndex;
	p.p2 = v2.newIndex;
	p.p3 = v3.newIndex;
	p.p4 = v4.newIndex;
    }
    if(invert) {
	for(var i = 0; i < this.triangles.length; i++) {
            var p = this.triangles[i];
	    var v1 = this.vertices[p.p1];
	    var v2 = this.vertices[p.p2];
	    var v3 = this.vertices[p.p3];
	    p.p1 = v3.newIndex;
	    p.p2 = v2.newIndex;
	    p.p3 = v1.newIndex;
	}
	for(var i = 0; i < this.quads.length; i++) {
            var p = this.quads[i];
	    var v1 = this.vertices[p.p1];
	    var v2 = this.vertices[p.p2];
	    var v3 = this.vertices[p.p3];
	    var v4 = this.vertices[p.p4];
	    p.p1 = v4.newIndex;
	    p.p2 = v3.newIndex;
	    p.p3 = v2.newIndex;
	    p.p4 = v1.newIndex;
	}
    }
    else {
	for(var i = 0; i < this.triangles.length; i++) {
            var p = this.triangles[i];
	    var v1 = this.vertices[p.p1];
	    var v2 = this.vertices[p.p2];
	    var v3 = this.vertices[p.p3];
	    p.p1 = v1.newIndex;
	    p.p2 = v2.newIndex;
	    p.p3 = v3.newIndex;
	}
	for(var i = 0; i < this.quads.length; i++) {
            var p = this.quads[i];
	    var v1 = this.vertices[p.p1];
	    var v2 = this.vertices[p.p2];
	    var v3 = this.vertices[p.p3];
	    var v4 = this.vertices[p.p4];
	    p.p1 = v1.newIndex;
	    p.p2 = v2.newIndex;
	    p.p3 = v3.newIndex;
	    p.p4 = v4.newIndex;
	}
    }
    for(var i = 0; i < this.vertices.length; i++) {
	var v = this.vertices[i];
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
    this.lines.forEach(function(x){LDR.map2(x, map);});
    this.conditionalLines.forEach(function(x){LDR.map4(x, map);});
    this.triangles.forEach(function(x){LDR.map3(x, map);});
    this.quads.forEach(function(x){LDR.map4(x, map);});
}

LDR.LDRGeometry.prototype.ensureCull = function() {
    if(this.cull)
	return;
    var T = this.triangles.length;
    for(var i = 0; i < T; i++) {
	var t = this.triangles[i];
	this.triangles.push({p1:t.p3, p2:t.p2, p3:t.p1});
    }
    var Q = this.quads.length;
    for(var i = 0; i < Q; i++) {
	var q = this.quads[i];
	this.quads.push({p1:q.p4, p2:q.p3, p3:q.p2, p4:q.p1});
    }
    this.cull = true;
}

LDR.LDRGeometry.prototype.merge = function(other) {
    this.ensureCull();
    other.ensureCull();
    // First merge vertices:
    var mergedVertices = []; // Assume both vertex streams are sorted, so duplicates are removed.
    var indexMapThis = []; // original index -> merged vertex.
    var indexMapOther = []; // Same.
    var idxThis = 0, idxOther = 0;

    while(idxThis < this.vertices.length && idxOther < other.vertices.length) {
	var pThis = this.vertices[idxThis];
	var pOther = other.vertices[idxOther];
	if(pThis.x == pOther.x && pThis.y == pOther.y && pThis.z == pOther.z && pThis.c == pOther.c) {
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
	var pThis = this.vertices[idxThis];
	indexMapThis.push(mergedVertices.length);
	mergedVertices.push(pThis);
	++idxThis;
    }
    while(idxOther < other.vertices.length) {
	var pOther = other.vertices[idxOther];
	indexMapOther.push(mergedVertices.length);
	mergedVertices.push(pOther);
	++idxOther;
    }
    
    // Merge the lines, conditional lines, triangles and quads:
    this.vertices = mergedVertices;
    this.mapIndices(indexMapThis);
    other.mapIndices(indexMapOther);

    if(this.ccw != other.ccw) {
	// Flip whichever is not ccw:
	if(this.ccw)
	    other.flipCCW();
	else
	    this.flipCCW();
    }

    this.lines.push(...other.lines);
    this.conditionalLines.push(...other.conditionalLines);
    this.triangles.push(...other.triangles);
    this.quads.push(...other.quads);
}

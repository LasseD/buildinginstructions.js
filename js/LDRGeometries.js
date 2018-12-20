/*
  Binary merge of the geometry streams.
 */
LDR.mergeGeometries = function(geometries) {
    do {
	var nextGeometries = [];
	if(geometries.length % 2 == 1)
	    nextGeometries.push(geometries[geometries.length-1]);
	for(var i = 0; i < geometries.length-1; i+=2) {
	    geometries[i].merge(geometries[i+1]);
	    nextGeometries.push(geometries[i]);
	}
	geometries = nextGeometries;
    } while(geometries.length > 1);
    return geometries[0];
}

LDR.vertexSorter = function(a, b) {
    if(a.x != b.x)
	return a.x-b.x;
    if(a.y != b.y)
	return a.y-b.y;
    return a.z-b.z;
}

THREE.LDRGeometry = function() {
    this.vertices = []; // sorted THREE.Vector3 (x,y,z).
    this.lines = []; // {p1,p2,c}
    this.conditionalLines = [];
    this.triangles = [];
    this.quads = [];

    this.clone = function() {
        var g = new THREE.LDRGeometry();
        for(var i = 0; i < this.vertices.length; i++) {
            g.vertices.push(this.vertices[i]);
        }
        for(var i = 0; i < this.lines.length; i++) {
            var p = this.lines[i];
            g.lines.push({p1:p.p1, p2:p.p2, c:p.c});
        }
        for(var i = 0; i < this.conditionalLines.length; i++) {
            var p = this.conditionalLines[i];
            g.conditionalLines.push({p1:p.p1, p2:p.p2, p3:p.p3, p4:p.p4, c:p.c});
        }
        for(var i = 0; i < this.triangles.length; i++) {
            var p = this.triangles[i];
            g.triangles.push({p1:p.p1, p2:p.p2, p3:p.p3, c:p.c});
        }
        for(var i = 0; i < this.quads.length; i++) {
            var p = this.quads[i];
            g.quads.push({p1:p.p1, p2:p.p2, c3:p.p3, p4:p.p4, c:p.c});
        }
    }

    /*
      Replace vertices on primitives with 
     */
    this.fromPrimitives = function(lines, conditionalLines, triangles, quads) {
        var g1 = new THREE.LDRGeometry(); g1.fromLines(lines);
        var g2 = new THREE.LDRGeometry(); g2.fromConditionalLines(conditionalLines);
        var g3 = new THREE.LDRGeometry(); g3.fromTriangles(triangles);
        var g4 = new THREE.LDRGeometry(); g4.fromQuads(quads);
	var geometries = [g1, g2, g3, g4];
	this.replaceWith(LDR.mergeGeometries(geometries));
    }

    this.sortAndBurnVertices = function(primitives) {
	this.vertices.sort(LDR.vertexSorter);
	for(var i = 0; i < this.vertices.length; i++) {
	    var v = this.vertices[i];
	    if(v.p == 1)
		primitives[v.idx].p1 = i;
	    else if(v.p == 2)
		primitives[v.idx].p2 = i;
	    else if(v.p == 3)
		primitives[v.idx].p3 = i;
	    else
		primitives[v.idx].p4 = i;
	    v.idx = v.p = undefined;
	}
    }

    this.fromLines = function(ps) {
	for(var i = 0; i < ps.length; i++) {
	    var p = ps[i];
	    this.vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, idx:i, p:1},
			       {x:p.p2.x, y:p.p2.y, z:p.p2.z, idx:i, p:2});
	    this.lines.push({c:p.c});
	}
	this.sortAndBurnVertices(this.lines);
    }
    this.fromConditionalLines = function(ps) {
	for(var i = 0; i < ps.length; i++) {
	    var p = ps[i];
	    this.vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, idx:i, p:1},
			       {x:p.p2.x, y:p.p2.y, z:p.p2.z, idx:i, p:2},
			       {x:p.p3.x, y:p.p3.y, z:p.p3.z, idx:i, p:3},
			       {x:p.p4.x, y:p.p4.y, z:p.p4.z, idx:i, p:4});
	    this.conditionalLines.push({c:p.c});
	}
	this.sortAndBurnVertices(this.conditionalLines);
    }
    this.fromTriangles = function(ps) {
	for(var i = 0; i < ps.length; i++) {
	    var p = ps[i];
	    this.vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, idx:i, p:1},
			       {x:p.p2.x, y:p.p2.y, z:p.p2.z, idx:i, p:2},
			       {x:p.p3.x, y:p.p3.y, z:p.p3.z, idx:i, p:3});
	    this.triangles.push({c:p.c});
	}
	this.sortAndBurnVertices(this.triangles);
    }
    this.fromQuads = function(ps) {
	for(var i = 0; i < ps.length; i++) {
	    var p = ps[i];
	    this.vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, idx:i, p:1},
			       {x:p.p2.x, y:p.p2.y, z:p.p2.z, idx:i, p:2},
			       {x:p.p3.x, y:p.p3.y, z:p.p3.z, idx:i, p:3},
			       {x:p.p4.x, y:p.p4.y, z:p.p4.z, idx:i, p:4});
	    this.quads.push({c:p.c});
	}
	this.sortAndBurnVertices(this.quads);
    }

    this.replaceWith = function(g) {
	this.vertices = g.vertices;
	this.lines = g.lines;
	this.conditionalLines = g.conditionalLines;
	this.triangles = g.triangles;
	this.quads = g.quads;
    }

    /*
      Consolidate the primitives and sub-parts of the step.
     */
    this.fromStep = function(loader, step) {
	var geometries = [];
        if(step.hasPrimitives) {
            var g = new THREE.LDRGeometry(); 
	    g.fromPrimitives(step.lines, step.conditionalLines, step.triangles, step.quads);
            geometries.push(g);
	}
        for(var i = 0; i < step.ldrs.length; i++) {
            var g = new THREE.LDRGeometry(); 
	    g.fromPartDescription(loader, step.ldrs[i]);
            geometries.push(g);
	}
        for(var i = 0; i < step.dats.length; i++) {
            var g = new THREE.LDRGeometry(); 
	    g.fromPartDescription(loader, step.dats[i]);
            geometries.push(g);
	}
	this.replaceWith(THREE.mergeGeometries(geometries));
    }

    this.fromPartType = function(loader, pt) {
	var geometries = [];
        for(var i = 0; i < pt.steps.length; i++) {
            var g = new THREE.LDRGeometry();
            geometries.push(g.fromStep(loader, pt.steps[i]));
        }
	this.replaceWith(THREE.mergeGeometries(geometries));
    }

    this.fromPartDescription = function(loader, pd) {
        this.replaceWith(loader.ldrPartTypes[pd.ID].geometry); // Assume pd.ID has prepared geometry.
        // TODO: Optimize rotation matrices for I-matrx (1,0,0,0,1,0,0,0,1), \-matrices, etc.
        
        // Update and re-sort the vertices:
	// First decorate with initial index and update position:
	for(var i = 0; i < this.vertices.length; i++) {
	    var v = this.vertices[i].idx = i;
	    
	    var position = new THREE.Vector3(v.x, v.y, v.z);
	    position.applyMatrix3(pd.rotation);
	    position.add(pd.position);
	    v.x = position.x;
	    v.y = position.y;
	    v.z = position.z;
	}
	this.vertices.sort(LDR.vertexSorter);
	for(var i = 0; i < this.vertices.length; i++) {
	    var v = this.vertices[i].idx = i;
	    this.vertices[v.idx].newIndex = i;
	}

        // Update the indices and colors on the primitives:
	// TODO: Walk through all points on primitives and update.
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
		    p.c = p.colorID;
		else if(p.c == 24)
		    p.c = p.colorID+10000;
	    };
	}
        for(var i = 0; i < this.lines.length; i++) {
            var p = this.lines[i];
	    updateColor(p);
	    p.p1 = this.vertices[p.p1].newIndex;
	    p.p2 = this.vertices[p.p2].newIndex;
        }
        for(var i = 0; i < this.conditionalLines.length; i++) {
            var p = this.conditionalLines[i];
	    updateColor(p);
	    p.p1 = this.vertices[p.p1].newIndex;
	    p.p2 = this.vertices[p.p2].newIndex;
	    p.p3 = this.vertices[p.p3].newIndex;
	    p.p4 = this.vertices[p.p4].newIndex;
        }
        for(var i = 0; i < this.triangles.length; i++) {
            var p = this.triangles[i];
	    updateColor(p);
	    p.p1 = this.vertices[p.p1].newIndex;
	    p.p2 = this.vertices[p.p2].newIndex;
	    p.p3 = this.vertices[p.p3].newIndex;
        }
        for(var i = 0; i < this.quads.length; i++) {
            var p = this.quads[i];
	    updateColor(p);
	    p.p1 = this.vertices[p.p1].newIndex;
	    p.p2 = this.vertices[p.p2].newIndex;
	    p.p3 = this.vertices[p.p3].newIndex;
	    p.p4 = this.vertices[p.p4].newIndex;
        }
    }

    this.merge = function(other) {
	// First merge vertices:
	var mergedVertices = [];
	var indexMapThis = [];
	var indexMapOther = [];
	var idxThis = 0, idxOther = 0;
	while(idxThis < this.vertices.length && idxOther < other.vertices.length) {
	    var pThis = this.vertices[idxThis];
	    var pOther = other.vertices[idxOther];
	    if(pThis.x == pOther.x && pThis.y == pOther.y && pThis.z == pOther.z) {
		indexMapThis.push(mergedVertices.length);
		indexMapOther.push(mergedVertices.length);
		mergedVertices.push(pThis);
		++idxThis;
		++idxOther;
	    }
	    else if(pThis.x < pOther.x ||
		    (pThis.x == pOther.x && (pThis.y < pOther.y || 
					     (pThis.y == pOther.y && pThis.z < pOther.z)))) {
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
	while(idxOther < this.vertices.length) {
	    var pOther = this.vertices[idxOther];
	    indexMapOther.push(mergedVertices.length);
	    mergedVertices.push(pOther);
	    ++idxOther;
	}

	// Merge the lines, conditional lines, triangles and quads:
	for(var i = 0; i < this.lines.length; i++)
	    this.lines[i] = indexMapThis[this.lines[i]];
	for(var i = 0; i < this.conditionalLines.length; i++)
	    this.conditionalLines[i] = indexMapThis[this.conditionalLines[i]];
	for(var i = 0; i < this.triangles.length; i++)
	    this.triangles[i] = indexMapThis[this.triangles[i]];
	for(var i = 0; i < this.quads.length; i++)
	    this.quads[i] = indexMapThis[this.quads[i]];
	for(var i = 0; i < other.lines.length; i++)
	    this.lines.push(indexMapOther[other.lines[i]]);
	for(var i = 0; i < other.conditionalLines.length; i++)
	    this.conditionalLines.push(indexMapOther[other.conditionalLines[i]]);
	for(var i = 0; i < other.triangles.length; i++)
	    this.triangles.push(indexMapOther[other.triangles[i]]);
	for(var i = 0; i < other.quads.length; i++)
	    this.quads.push(indexMapOther[other.quads[i]]);
    }
}


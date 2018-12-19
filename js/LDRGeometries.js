/*
  Binary merge of the geometry streams.
 */
THREE.mergeGeometries = function(geometries) {
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
        var g1 = new THREE.LDRGeometry();
    }

    /*
      Consolidate the primitives and sub-parts of the step.
     */
    this.fromStep = function(loader, step) {
	var geometries = [];
        if(step.hasPrimitives)
            geometries.push(this.fromPrimitives(step.lines, step.conditionalLines, step.triangles, step.quads));
        for(var i = 0; i < step.ldrs.length; i++)
            geometries.push(this.fromPartDescription(step.ldrs[i]));
        for(var i = 0; i < step.dats.length; i++)
            geometries.push(this.fromPartDescription(step.dats[i]));
	this.copy(THREE.mergeGeometries(geometries));
    }

    this.replaceWith = function(g) {
	this.vertices = g.vertices;
	this.lineIndices = g.lineIndices;
	this.conditionalLineIndices = g.conditionalLineIndices;
	this.triangleIndices = g.triangleIndices;
	this.quadIndices = g.quadIndices;
    }

    this.fromPartType = function(loader, pt) {
	var geometries = [];
        for(var i = 0; i < pt.steps.length; i++) {
            var g = new THREE.LDRGeometry();
            geometries.push(g.fromStep(pt.steps[i]));
        }
	this.replaceWith(THREE.mergeGeometries(geometries));
    }

    this.fromPartDescription = function(loader, desc) {
        var g = this.fromPartType(loader, loader.ldrPartTypes[desc.ID]).geometry; // Assume desc.ID has prepared geometry.
        // TODO: Optimize rotation matrices for I-matrx (1,0,0,0,1,0,0,0,1), \-matrices, etc.
        
        // Update and re-sort the vertices:
        // TODO

        // Update indices:
        // TODO

        /* From PD:
THREE.LDRPartDescription.prototype.placeAt = function(pd) {
    // Compute augmented colorID, position, rotation, ID
    var colorID = this.placedColor(pd.colorID);
    
    var position = new THREE.Vector3();
    position.copy(this.position);
    position.applyMatrix3(pd.rotation);
    position.add(pd.position);

    var rotation = new THREE.Matrix3();
    rotation.multiplyMatrices(pd.rotation, this.rotation);

    var invert = this.invertCCW == pd.invertCCW;

    return new THREE.LDRPartDescription(colorID, position, rotation, this.ID, this.cull, invert);
}
         */


	THREE.LDRGeometry();
    }

    // TODO: make faster when geometries, such as lines, are empty:
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
	for(var i = 0; i < this.lineIndices.length; i++)
	    this.lineIndices[i] = indexMapThis[this.lineIndices[i]];
	for(var i = 0; i < this.conditionalLineIndices.length; i++)
	    this.conditionalLineIndices[i] = indexMapThis[this.conditionalLineIndices[i]];
	for(var i = 0; i < this.triangleIndices.length; i++)
	    this.triangleIndices[i] = indexMapThis[this.triangleIndices[i]];
	for(var i = 0; i < this.quadIndices.length; i++)
	    this.quadIndices[i] = indexMapThis[this.quadIndices[i]];
	for(var i = 0; i < other.lineIndices.length; i++)
	    this.lineIndices.oush(indexMapThis[other.lineIndices[i]]);
	for(var i = 0; i < other.conditionalLineIndices.length; i++)
	    this.conditionalLineIndices.push(indexMapThis[other.conditionalLineIndices[i]]);
	for(var i = 0; i < other.triangleIndices.length; i++)
	    this.triangleIndices.push(indexMapThis[other.triangleIndices[i]]);
	for(var i = 0; i < other.quadIndices.length; i++)
	    this.quadIndices.push(indexMapThis[other.quadIndices[i]]);
    }
}


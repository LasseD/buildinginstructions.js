'use strict';

LDR.LDRGeometry.prototype.buildStandardGeometries = LDR.LDRGeometry.prototype.buildGeometries;

LDR.LDRGeometry.prototype.buildBFCGeometries = function() {
    if(this.geometriesBuilt) {
	return; // Already built.
    }
    let self = this;
    
    let vertices = [];
    for(let i = 0; i < this.vertices.length; i++) {
        let v = this.vertices[i];
        vertices.push(v.x, v.y, v.z);
    }
    let vertexAttribute = new THREE.Float32BufferAttribute(vertices, 3);

    // Handle lines:
    this.buildLineGeometries(vertexAttribute);
    this.buildConditionalLineGeometries(vertexAttribute);

    // Handle triangle colors and vertices:
    let allTriangleColors = [];
    let seen = {};
    function getColorsFrom(p) {
        for(let c in p) {
            if(!seen.hasOwnProperty(c) && p.hasOwnProperty(c)) {
                allTriangleColors.push(c);
                seen[c] = true;
            }
        }
    }
    getColorsFrom(this.triangles);
    getColorsFrom(this.triangles2);
    getColorsFrom(this.quads);
    getColorsFrom(this.quads2);

    let indices = [[], [], []]; // RGB
    allTriangleColors.forEach(c => {
        function h(ps, f) {
            if(ps.hasOwnProperty(c)) {
                ps[c].forEach(f);
            }
        }
        h(self.triangles, t => indices[1].push(t.p1, t.p2, t.p3)); // G
        h(self.triangles, t => indices[0].push(t.p3, t.p2, t.p1)); // R

        h(self.triangles2, t => {let i1=t.p1, i2=t.p2, i3=t.p3; indices[2].push(i1, i2, i3, i3, i2, i1);}); // B

        h(self.quads, q => {let i1=q.p1, i2=q.p2, i3=q.p3, i4=q.p4; indices[1].push(i1, i2, i4, i2, i3, i4);});
        h(self.quads, q => {let i1=q.p4, i2=q.p3, i3=q.p2, i4=q.p1; indices[0].push(i1, i2, i4, i2, i3, i4);});

        h(self.quads2, q => {let i1=q.p1, i2=q.p2, i3=q.p3, i4=q.p4; indices[2].push(i1, i2, i4, i2, i3, i4, i4, i3, i2, i4, i2, i1);});
	
    });

    if(indices[0].length > 0) {
	this.triangleGeometries[4] = this.buildGeometry(indices[0], vertexAttribute);
    }
    if(indices[1].length > 0) {
	this.triangleGeometries[2] = this.buildGeometry(indices[1], vertexAttribute);
    }
    if(indices[2].length > 0) {
	this.triangleGeometries[1] = this.buildGeometry(indices[2], vertexAttribute);
    }

    this.geometriesBuilt = true;
}

LDR.acceptedHarlequinColors = [1, 2, 4, 5, 13, 14, 19, 22, 25, 27, 69, 71, 72, 73, 74, 77, 288, 308, 484];

LDR.LDRGeometry.prototype.fromStandardPartType = function(loader, pt) {
    loader.getMainModel().IS_MAIN_MODEL = true;
    let geometries = [];
    if(pt.steps.length === 0) {
        return; // Empty - just make empty.
    }
    if(pt.IS_MAIN_MODEL) { // Harlequin the triangles and quads:
        pt.steps.forEach(step => {
            let setOldColor = x => {if(x.hasOwnProperty('oldC')){x.c = x.oldC;}};
            step.quads.forEach(setOldColor);
            step.triangles.forEach(setOldColor);
            step.subModels.forEach(setOldColor);
        });
    }
    pt.steps.forEach(step => {
        let g = new LDR.LDRGeometry();
        g.fromStep(loader, step);
        geometries.push(g);
    });
    this.replaceWith(LDR.mergeGeometries(geometries));
}

LDR.LDRGeometry.prototype.fromHarlequinPartType = function(loader, pt) {
    loader.getMainModel().IS_MAIN_MODEL = true;
    let geometries = [];
    if(pt.steps.length === 0) {
        return; // Empty - just make empty.
    }
    if(pt.IS_MAIN_MODEL) { // Harlequin the triangles and quads:
        pt.steps.forEach(step => {
            let setNewColor = x => {x.oldC = x.c; x.c = LDR.acceptedHarlequinColors[Math.floor(Math.random() * LDR.acceptedHarlequinColors.length)]};
            step.quads.forEach(setNewColor);
            step.triangles.forEach(setNewColor);
            step.subModels.forEach(setNewColor);
        });
    }
    pt.steps.forEach(step => {
        let g = new LDR.LDRGeometry();
        g.fromStep(loader, step);
        geometries.push(g);
    });
    this.replaceWith(LDR.mergeGeometries(geometries));
}

// Mode: 0 = normal, 1 = bfc, 2 = harlequin
LDR.setMode = function(mode) {
    console.log('Setting mode', mode);
    switch(mode) {
    case 0:
        LDR.LDRGeometry.prototype.fromPartType = LDR.LDRGeometry.prototype.fromStandardPartType;
	LDR.LDRGeometry.prototype.buildGeometries = function() {
	    this.buildPhysicalGeometries(true);
	}
        break;
    case 1:
        LDR.LDRGeometry.prototype.fromPartType = LDR.LDRGeometry.prototype.fromStandardPartType;
        LDR.LDRGeometry.prototype.buildGeometries = LDR.LDRGeometry.prototype.buildBFCGeometries;
        break;
    case 2:
        LDR.LDRGeometry.prototype.fromPartType = LDR.LDRGeometry.prototype.fromHarlequinPartType;
        LDR.LDRGeometry.prototype.buildGeometries = LDR.LDRGeometry.prototype.buildStandardGeometries;
        break;
    }
}

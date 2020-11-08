'use strict';

LDR.LDRGeometry.prototype.buildGeometries = function() {
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

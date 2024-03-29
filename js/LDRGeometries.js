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

LDR.LDRGeometry = function() {
    // Temp data for geometry construction:
    this.vertices = []; // Sorted {x,y,z,o}, where 'o' is a LEGO-logo indicator.
    this.lines = {}; // c -> [{p1,p2},...] (color -> indices)
    this.conditionalLines = {}; // c -> [{p1,p2,p3,p4},...]
    this.triangles = {}; // c -> [{p1,p2,p3},...]
    this.triangles2 = {}; // Triangles without culling
    this.quads = {}; // c -> [{p1,p2,p3,p4},...]
    this.quads2 = {}; // Quads without culling.
    
    // Built geometries:
    this.lineGeometries = {}; // c -> geometry
    this.conditionalLineGeometries = {}; // c -> geometry
    this.triangleGeometries = {}; // c -> geometry
    this.texmapGeometries = {}; // texmapID -> [{c,g}] Populated with one geometry pr TEXMAP START command.

    this.geometriesBuilt = false;
    this.boundingBox = new THREE.Box3();
}

LDR.LDRGeometry.prototype.buildLineGeometries = function(vertexAttribute) {
    for(let c in this.lines) {
	if(!this.lines.hasOwnProperty(c)) {
            continue;            
        }

        let lineIndices = [];
        let lines = this.lines[c];
        for(let i = 0; i < lines.length; i++) {
	    let line = lines[i];
            lineIndices.push(line.p1, line.p2);
        }
        this.lineGeometries[c] = this.buildGeometry(lineIndices, vertexAttribute);
    }
}

LDR.LDRGeometry.prototype.buildConditionalLineGeometries = function(vertexAttribute) {
    for(let c in this.conditionalLines) {
	if(!this.conditionalLines.hasOwnProperty(c)) {
            continue;
        }
        let conditionalLines = this.conditionalLines[c];

        let g = new THREE.BufferGeometry();
        let p1s = [], p2s = [], p3s = [], p4s = [];

        // Now handle conditional lines:
        for(let i = 0; i < conditionalLines.length; i++) {
	    let p = conditionalLines[i]; // {p1, p2, p3, p4}
            let p1 = this.vertices[p.p1];
            let p2 = this.vertices[p.p2];
            let p3 = this.vertices[p.p3];
            let p4 = this.vertices[p.p4];
            
	    p1s.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z); // 2 points => 1 line in shader.
	    p2s.push(p2.x, p2.y, p2.z, p1.x, p1.y, p1.z); // Counter points for calculations
	    p3s.push(p3.x, p3.y, p3.z, p3.x, p3.y, p3.z); // p3's
	    p4s.push(p4.x, p4.y, p4.z, p4.x, p4.y, p4.z); // p4's
        }
        g.setAttribute('position', new THREE.Float32BufferAttribute(p1s, 3));
        g.setAttribute('p2', new THREE.Float32BufferAttribute(p2s, 3));
        g.setAttribute('p3', new THREE.Float32BufferAttribute(p3s, 3));
        g.setAttribute('p4', new THREE.Float32BufferAttribute(p4s, 3));
        this.conditionalLineGeometries[c] = g;
    }
}

LDR.LDRGeometry.prototype.buildBothLineGeometries = function() {
    let lineVertices = [];
    for(let i = 0; i < this.vertices.length; i++) {
        let v = this.vertices[i];
        lineVertices.push(v.x, v.y, v.z);
    }
    let vertexAttribute = new THREE.Float32BufferAttribute(lineVertices, 3);

    // Handle lines:
    this.buildLineGeometries(vertexAttribute);
    this.buildConditionalLineGeometries(vertexAttribute);
}

/*
  Build geometries and color managers for standard (quick draw) drawing (seen in building instructions and parts lists)
 */
LDR.LDRGeometry.prototype.buildGeometries = function() {
    if(this.geometriesBuilt) {
	return; // Already built.
    }
    let self = this;

    this.buildBothLineGeometries();
    
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

    let colorIdx = -1;
    allTriangleColors.forEach(c => {
	let triangleVertices = [], triangleIndices = [];
        colorIdx--;
        let tvIdx = 0;
	    
        let hv = function(idx) { // Handle vertex:
            let v = self.vertices[idx];
            if(v.c !== colorIdx) { // Not already seen for this color.
                v.c = colorIdx;
                v.idx = tvIdx++;
                triangleVertices.push(v.x, v.y, v.z);
            }
            return v.idx;
        }
	    
        function handlePrimitives(ps, f) {
            if(ps.hasOwnProperty(c)) {
                ps[c].filter(p => !p.t).forEach(f);
            }
        }
        handlePrimitives(self.triangles, t => triangleIndices.push(hv(t.p1), hv(t.p2), hv(t.p3)));
        handlePrimitives(self.triangles2, t => {let i1=hv(t.p1), i2=hv(t.p2), i3=hv(t.p3); triangleIndices.push(i1, i2, i3, i3, i2, i1);});
        handlePrimitives(self.quads, q => {let i1=hv(q.p1), i2=hv(q.p2), i3=hv(q.p3), i4=hv(q.p4); triangleIndices.push(i1, i2, i4, i2, i3, i4);});
        handlePrimitives(self.quads2, q => {let i1=hv(q.p1), i2=hv(q.p2), i3=hv(q.p3), i4=hv(q.p4); triangleIndices.push(i1, i2, i4, i2, i3, i4, i4, i3, i2, i4, i2, i1);});
	
	let triangleVertexAttribute = new THREE.Float32BufferAttribute(triangleVertices, 3);
	let triangleGeometry = this.buildGeometry(triangleIndices, triangleVertexAttribute);
	if(triangleGeometry) {
	    this.triangleGeometries[c] = triangleGeometry;
	}
    });

    // Handle texmap geometries:
    allTriangleColors.forEach(c => self.buildTexmapGeometriesForColor(c));

    this.geometriesBuilt = true;
    this.cleanTempData();
}

LDR.LDRGeometry.prototype.buildTexmapGeometriesForColor = function(c) {
    let self = this;

    let texmapped = {}; // idx => [{p,size,noBFC}]
    function check(ps, q, noBFC) {
        if(!ps.hasOwnProperty(c)) {
            return;
        }
        ps[c].filter(p => p.t).forEach(p => {
                if(!texmapped.hasOwnProperty(p.t.idx)) {
                    texmapped[p.t.idx] = [];
                }
                texmapped[p.t.idx].push({p:p, q:q, noBFC:noBFC});
            });
    }
    check(self.triangles, false, false);
    check(self.triangles2, false, true);
    check(self.quads, true, false);
    check(self.quads2, true, true);

    for(let idx in texmapped) {
        if(!texmapped.hasOwnProperty(idx)) {
            return;
        }
        let primitiveList = texmapped[idx];

        // Build indexed geometry for the texture:
        let vertices = []; // x 3
        let indices = []; // x 1
        let uvs = []; // x 2
        let indexMap = {}; // original index -> new index

        // Compute ps and uvs:
        let texmapPlacement;
        function set(a, b, c) {
            let vertex = self.vertices[a];
            let [u,v] = texmapPlacement.getUV(vertex, self.vertices[b], self.vertices[c]);

            let idx = indices.length;
            indexMap[a] = idx;
            vertices.push(vertex.x, vertex.y, vertex.z);
            indices.push(idx);
            uvs.push(u, v);
        }
        function setAll(a, b, c) {
            set(a, b, c);
            set(b, a, c);
            set(c, a, b);
        }
        primitiveList.forEach(ele => {
                let p = ele.p, q = ele.q, noBFC = ele.noBFC;
                texmapPlacement = p.t;

                setAll(p.p1, p.p2, p.p3);
                if(noBFC) {
                    setAll(p.p3, p.p2, p.p1);
                }
                if(q) { // Quad:
                    setAll(p.p1, p.p3, p.p4);
                    if(noBFC) {
                        setAll(p.p4, p.p3, p.p1);
                    }
                }
            });
        
        let g = self.buildGeometry(indices, new THREE.Float32BufferAttribute(vertices, 3));
        g.computeVertexNormals(); // Also normalizes.

        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        if(!self.texmapGeometries.hasOwnProperty(texmapPlacement.idx)) {
            self.texmapGeometries[texmapPlacement.idx] = [];
        }
        self.texmapGeometries[texmapPlacement.idx].push({c:c, g:g});
    }
}

// Optimized version of the one found in https://github.com/mrdoob/three.js/blob/master/src/core/BufferGeometry.js
THREE.BufferGeometry.prototype.computeVertexNormals = function() {
    var attributes = this.attributes;
    var positions = attributes.position.array;

    this.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(positions.length), 3));
    var normals = attributes.normal.array;

    var vA, vB, vC;
    var pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3();
    var cb = new THREE.Vector3(), ab = new THREE.Vector3();
    
    var index = this.index;
    var indices = index.array;
    for(var i = 0, il = index.count; i < il; i += 3) {            
        vA = indices[i] * 3;
        vB = indices[i+1] * 3;
        vC = indices[i+2] * 3;
        
        pA.fromArray(positions, vA);
        pB.fromArray(positions, vB);
        pC.fromArray(positions, vC);
        
        cb.subVectors(pC, pB);
        ab.subVectors(pA, pB);
        cb.cross(ab);
        
        normals[vA] += cb.x;
        normals[vA + 1] += cb.y;
        normals[vA + 2] += cb.z;
        
        normals[vB] += cb.x;
        normals[vB + 1] += cb.y;
        normals[vB + 2] += cb.z;
        
        normals[vC] += cb.x;
        normals[vC + 1] += cb.y;
        normals[vC + 2] += cb.z;            
    }
    this.normalizeNormals();
    attributes.normal.needsUpdate = true;
}

/**
   This function also computes normals and UV's to be used by standard materials.
 */
LDR.LDRGeometry.UV_WarningWritten = false;
LDR.LDRGeometry.prototype.buildPhysicalGeometries = function(withLines = false) {
    if(this.geometriesBuilt) {
	return;
    }

    if(withLines) {
	this.buildBothLineGeometries();
    }

    var self = this;
    let vertices = this.vertices;
    let vLen = vertices.length;
    const VLEN = vLen;
    let key = (a,b) => (a < b) ? (a*VLEN + b) : (b*VLEN + a);

    // Find bounds:
    let b = new THREE.Box3();
    vertices.forEach(v => b.expandByPoint(v));
    let size = new THREE.Vector3();
    b.getSize(size);

    // Mark lines shared by lines and conditional lines:
    let softEdges = [];
    for(let c in this.conditionalLines) {
	if(this.conditionalLines.hasOwnProperty(c)) {
            let lines = this.conditionalLines[c];
            lines.forEach(line => softEdges[key(line.p1, line.p2)] = true);
        }
    }
    for(let c in this.lines) {
	if(this.lines.hasOwnProperty(c)) {
            let lines = this.lines[c];
            lines.forEach(line => vertices[line.p1].hard = vertices[line.p2].hard = true);
            lines.forEach(line => softEdges[key(line.p1, line.p2)] = false); // Some elements have overlappind lines and conditional lines. This reduces the impact of such issues.
        }
    }
    
    // Now handle triangle colors and vertices:
    let allTriangleColors = [];
    let seenColors = {};
    function getColorsFrom(p) {
        for(let c in p) {
            if(!seenColors.hasOwnProperty(c) && p.hasOwnProperty(c)) {
                allTriangleColors.push(c);
                seenColors[c] = true;
            }
        }
    }
    getColorsFrom(this.triangles);
    getColorsFrom(this.triangles2);
    getColorsFrom(this.quads);
    getColorsFrom(this.quads2);

    function renew(i) {
        let v = vertices[i];
        vertices.push({x:v.x, y:v.y, z:v.z}); // No hard/soft marks, as it is new and will not be visited again.
        vLen++;
        return vLen-1;
    }

    function updateTriangleIndices(t) {
        let p1 = t.p1, p2 = t.p2, p3 = t.p3;
        let h1 = vertices[p1].hard, h2 = vertices[p2].hard, h3 = vertices[p3].hard;
        let soft12 = softEdges[key(p1, p2)], soft23 = softEdges[key(p2, p3)], soft31 = softEdges[key(p3, p1)];
        
        if(h1 && !soft12 && !soft31) {
            t.p1 = renew(t.p1);
        }
        if(h2 && !soft12 && !soft23) {
            t.p2 = renew(t.p2);
        }
        if(h3 && !soft23 && !soft31) {
            t.p3 = renew(t.p3);
        }
    }

    function updateQuadIndices(t) {
        let p1 = t.p1, p2 = t.p2, p3 = t.p3, p4 = t.p4;
        let h1 = vertices[p1].hard, h2 = vertices[p2].hard, h3 = vertices[p3].hard, h4 = vertices[p4].hard;
        let soft12 = softEdges[key(p1, p2)], soft23 = softEdges[key(p2, p3)], soft34 = softEdges[key(p3, p4)], soft41 = softEdges[key(p4, p1)];
        
        if(h1 && !soft12 && !soft41) {
            t.p1 = renew(t.p1);
        }
        if(h2 && !soft12 && !soft23) {
            t.p2 = renew(t.p2);
        }
        if(h3 && !soft23 && !soft34) {
            t.p3 = renew(t.p3);
        }
        if(h4 && !soft41 && !soft34) {
            t.p4 = renew(t.p4);
        }
    }

    allTriangleColors.forEach(c => {
            if(self.triangles.hasOwnProperty(c)) {
                self.triangles[c].forEach(updateTriangleIndices);
            }
            if(self.triangles2.hasOwnProperty(c)) {
                self.triangles2[c].forEach(updateTriangleIndices);
            }
            if(self.quads.hasOwnProperty(c)) {
                self.quads[c].forEach(updateQuadIndices);
            }
            if(self.quads2.hasOwnProperty(c)) {
                self.quads2[c].forEach(updateQuadIndices);
            }
        });

    let triangleVertices = [];
    vertices.forEach(v => triangleVertices.push(v.x, v.y, v.z));
    let triangleVertexAttribute = new THREE.Float32BufferAttribute(triangleVertices, 3);

    allTriangleColors.forEach(c => {
            let triangleIndices = [];

            function pushT(a, b, c) {
                triangleIndices.push(a, b, c);
            }
            function pushQ(a, b, c, d) {
                triangleIndices.push(a, b, d);
                triangleIndices.push(b, c, d);
            }

            let triangles = self.triangles.hasOwnProperty(c) ? self.triangles[c].filter(p => !p.t) : [];
            let triangles2 = self.triangles2.hasOwnProperty(c) ? self.triangles2[c].filter(p => !p.t) : [];
            let quads = self.quads.hasOwnProperty(c) ? self.quads[c].filter(p => !p.t) : [];
            let quads2 = self.quads2.hasOwnProperty(c) ? self.quads2[c].filter(p => !p.t) : [];

            triangles.forEach(t => pushT(t.p1, t.p2, t.p3));
            triangles2.forEach(t => {pushT(t.p1, t.p2, t.p3); pushT(t.p3, t.p2, t.p1);});
            quads.forEach(q => pushQ(q.p1, q.p2, q.p3, q.p4));
            quads2.forEach(q => {pushQ(q.p1, q.p2, q.p3, q.p4); pushQ(q.p4, q.p3, q.p2, q.p1);});

            if(triangleIndices.length === 0) {
                return; // None in color.
            }

            let g = self.buildGeometry(triangleIndices, triangleVertexAttribute); // TODO: Split vertexattribute by color! - compare performance!
            g.computeVertexNormals(); // Also normalizes.

            /* 
               Compute UV's:
               The heuristic for computing UV's has to translate from
               3D space x 3D space (Positions and normals) to 2D (UV's)

               The heuristic performs this reduction as follows:
               0) If 3 or more normals point the same way, then project to one of the rectilinear planes and return.
               1) The sum of normals N is computed.
               2) Let v and n denote the position and normal of a point. UV is computed:
                  U = v.x + planar_angle_of(n.x, n.z)
                  V = v.z + acos(n.y)
               *) If |N.y| >= MAX(|N.x|, |N.z|) then perform UV calculation using XY instead of XZ above.
             */
            let normals = g.getAttribute('normal').array;
            let uvs = [];
            for(let i = 0; i < vLen; i++) {
                uvs.push(0, 0);
            }
            let dx = v => (v.x-b.min.x)/size.x;
            let dy = v => (v.y-b.min.y)/size.y;
            let dz = v => (v.z-b.min.z)/size.z;
            let [UVU, UVV] = [[0.5,0.5],[0,0],[0.5,0]][Math.floor(Math.random()*3)]; // Which of the 3 cells to use for the UV mapping (not 1,1 with the LEGO logo)

            function setUVs(indices) {
                const len = indices.length;
                let maxDiff = xs => xs.map((x,idx,a) => Math.abs(x - a[idx === 0 ? len-1 : idx-1])).reduce((a,b) => a > b ? a : b, 0);
                let vs = indices.map(i => vertices[i]);
                let ns = indices.map(i => 3*i).map(idx => new THREE.Vector3(normals[idx], normals[1+idx], normals[2+idx]));
                let N = ns.reduce((a, b) => new THREE.Vector3(a.x+b.x, a.y+b.y, a.z+b.z), new THREE.Vector3());
                let NX = N.x*N.x, NY = N.y*N.y, NZ = N.z*N.z;

                function setUV(fu, fv, force) {
                    let ret = vs.map((v,i) => {return {u:fu(v, i), v:fv(v, i)};});

                    if(!force) {
                        let prevprev = ret[ret.length-2];
                        let prev = ret[ret.length-1];
                        let turn = uv => (prev.u-prevprev.u)*(uv.v-prevprev.v) - (prev.v-prevprev.v)*(uv.u-prevprev.u);
                        for(let i = 0; i < ret.length; i++) {
                            let uv = ret[i];
                            if(Math.abs(prev.u-uv.u) < LDR.EPS && Math.abs(prev.v-uv.v) < LDR.EPS ||
                               Math.abs(prevprev.u-uv.u) < LDR.EPS && Math.abs(prevprev.v-uv.v) < LDR.EPS ||
                               Math.abs(turn(uv)) < 1e-7) {
                                if(!LDR.LDRGeometry.UV_WarningWritten) {
                                    console.log('UV issue insights for debugging. Underlying data points (vertices and normals):');
                                    console.dir(vs);
                                    console.dir(ns);
                                    console.dir('Computed U`s:');
                                    console.dir(ret);
                                    console.dir('Turn angle check at failure: ' + turn(uv));
                                    console.warn("Degenerate UV! " + uv.u + ', ' + uv.v);
                                    LDR.LDRGeometry.UV_WarningWritten = true;
                                }
                                return false;
                            }
                            prevprev = prev;
                            prev = uv;
                        }
                    }
                    
                    ret.forEach((uv, i) => {
                            let idx = 2*indices[i];
                            uvs[idx] = 0.5*uv.u + UVU;
                            uvs[idx+1] = 0.5*uv.v + UVV;
                        });

                    return true;
                }

                // Check if at least 3 normals point the same direction:
                let equalVector3 = (a, b) => Math.abs(a.x-b.x) < LDR.EPS && Math.abs(a.y-b.y) < LDR.EPS && Math.abs(a.z-b.z) < LDR.EPS;
                function atLeast3EqualNormals() {
                    let a = [...ns]; // Shallow copy.
                    a.sort(LDR.vertexSorter);
                    if(equalVector3(a[0], a[a.length-1])) {
                        return true; // All equal!
                    }
                    if(a.length !== 4) {
                        return false;
                    }
                    return equalVector3(a[0], a[2]) || equalVector3(a[1], a[3]);
                }
                if(atLeast3EqualNormals()) { // Just project onto the plane where the normals point the most:
                    // First check if this is a simple rectilinear face:
                    let DX, DY, DZ;
                    if(vs.some(v => v.o === true)) { // Logo position: Overwrite setUV():
                        let origo = vs.find(v => v.o === true);
                        let anyOther = vs.find(v => v.o !== true);
                        DX = origo.x - anyOther.x;
                        DY = origo.y - anyOther.y;
                        DZ = origo.z - anyOther.z;
                        let radius = 3*Math.sqrt(DX*DX + DY*DY + DZ*DZ);

                        DX = v => 0.5+(v.x-origo.x)/radius;
                        DY = v => 0.5+(v.y-origo.y)/radius;
                        DZ = v => 0.5+(v.z-origo.z)/radius;
                        setUV = function(fu, fv) {
                            let ret = vs.map((v,i) => {return {u:fu(v, i), v:fv(v, i)};});
                            ret.forEach((uv, i) => {
                                    let idx = 2*indices[i];
                                    uvs[idx] = 0.5*uv.u;
                                    uvs[idx+1] = 0.5*uv.v + 0.5;
                                });
                        }
                    }
                    else {
                        DX = dx;
                        DY = dy;
                        DZ = dz;
                    }

                    if(maxDiff(vs.map(v => v.x)) < LDR.EPS) { // y/z projection:
                        setUV(DY, DZ, true);
                    }
                    else if(maxDiff(vs.map(v => v.y)) < LDR.EPS) {
                        setUV(DX, DZ, true);
                    }
                    else if(maxDiff(vs.map(v => v.z)) < LDR.EPS) {
                        setUV(DX, DY, true);
                    }
                    else if(NX >= NY && NX >= NZ) {
                        setUV(DY, DZ, true);
                    }
                    else if(NY >= NX && NY >= NZ) {
                        setUV(DX, DZ, true);
                    }
                    else { // NZ >= both NX and NY
                        setUV(DX, DY, true);
                    }
                    return;
                }

                // Math.atan2 -> [-PI;PI], and Math.acos => [0;PI]
                const CONST1 = 0.7 / Math.PI;
                let toCircle = (y, x) => {
                    let ret = Math.abs(Math.atan2(y, x)) * CONST1; // Circle direction => 70%
                    return ret;
                }
                const CONST3 = 0.3 / (size.x + size.y + size.z);
                let dxyz = v => 0.1 + (v.x + v.y + v.z)*CONST3; // Scramble 30% offset by vertex position.
                
                if(NX < 1e-7 && setUV((v,i) => dxyz(v) + toCircle(ns[i].y, ns[i].z), dx, false) ||
                   NY < 1e-7 && setUV((v,i) => dxyz(v) + toCircle(ns[i].x, ns[i].z), dy, false) ||
                   NZ < 1e-7 && setUV((v,i) => dxyz(v) + toCircle(ns[i].x, ns[i].y), dz, false)) {
                    return;
                }

                const CONST2 = 0.7 / Math.PI;
                let toHeight = x => Math.acos(x)*CONST2; // Height caused by normal turn => 70%

                if(NY <= Math.min(NX, NZ)) {
                    if(!setUV((v,i) => dxyz(v) + toCircle(ns[i].x, ns[i].z),
                              (v,i) => dxyz(v) + toHeight(ns[i].y), false)) {
                        setUV(dx, dz, true);
                    }
                }
                else {
                    if(!setUV((v,i) => dxyz(v) + toCircle(ns[i].x, ns[i].y),
                              (v,i) => dxyz(v) + toHeight(ns[i].z), false)) {
                        setUV(dx, dy, true);
                    }
                }
            }

            triangles.forEach(t => setUVs([t.p1, t.p2, t.p3]));
            triangles2.forEach(t => setUVs([t.p1, t.p2, t.p3]));
            quads.forEach(q => setUVs([q.p1, q.p2, q.p3, q.p4]));
            quads2.forEach(q => setUVs([q.p1, q.p2, q.p3, q.p4]));

            g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            //g.attributes.uv2 = g.attributes.uv; // Used by aoMap (not in use yet)

            self.triangleGeometries[c] = g;
        });

    // Handle texmap geometries:
    allTriangleColors.forEach(c => self.buildTexmapGeometriesForColor(c));

    this.geometriesBuilt = true;    
    this.cleanTempData();
}

LDR.LDRGeometry.prototype.cleanTempData = function() {
    delete this.vertices;
    delete this.lines;
    delete this.conditionalLines;
    delete this.quads;
    delete this.quads2;
    delete this.triangles;
    delete this.triangles2;
}

LDR.LDRGeometry.prototype.buildGeometry = function(indices, vertexAttribute) {
    if(indices.length === 0) {
	return null;
    }
    let g = new THREE.BufferGeometry();
    g.setIndex(indices);
    g.setAttribute('position', vertexAttribute);

    return g;
}

LDR.LDRGeometry.prototype.replaceWith = function(g) {
    if(!g.vertices) {
	throw 'Copied geometry is already cleaned up!';
    }
    this.vertices = g.vertices;
    this.lines = g.lines;
    this.conditionalLines = g.conditionalLines;
    this.triangles = g.triangles;
    this.triangles2 = g.triangles2;
    this.quads = g.quads;
    this.quads2 = g.quads2;
    this.boundingBox = g.boundingBox;
}

LDR.LDRGeometry.prototype.replaceWithDeep = function(g) {
    if(!g.vertices) {
	g.rebuild();
    }
    let self = this;
    g.vertices.forEach(v => self.vertices.push({x:v.x, y:v.y, z:v.z, o:v.o}));

    for(let c in g.lines) {
	if(!g.lines.hasOwnProperty(c)) {
	    continue;
        }
	let ps = [];
	g.lines[c].forEach(p => ps.push({p1:p.p1, p2:p.p2}));
	this.lines[c] = ps;
    }
    for(let c in g.conditionalLines) {
	if(!g.conditionalLines.hasOwnProperty(c)) {
	    continue;
        }
	let ps = [];
	g.conditionalLines[c].forEach(p => ps.push({p1:p.p1, p2:p.p2, p3:p.p3, p4:p.p4}));
	this.conditionalLines[c] = ps;
    }
    for(let c in g.triangles) {
	if(!g.triangles.hasOwnProperty(c)) {
	    continue;
        }
	let ps = [];
	g.triangles[c].forEach(p => ps.push({p1:p.p1, p2:p.p2, p3:p.p3, t:p.t}));
	this.triangles[c] = ps;
    }
    for(let c in g.triangles2) {
	if(!g.triangles2.hasOwnProperty(c)) {
	    continue;
        }
	let ps = [];
	g.triangles2[c].forEach(p => ps.push({p1:p.p1, p2:p.p2, p3:p.p3, t:p.t}));
	this.triangles2[c] = ps;
    }
    for(let c in g.quads) {
	if(!g.quads.hasOwnProperty(c)) {
	    continue;
        }
	let ps = [];
	g.quads[c].forEach(p => ps.push({p1:p.p1, p2:p.p2, p3:p.p3, p4:p.p4, t:p.t}));
	this.quads[c] = ps;
    }
    for(let c in g.quads2) {
	if(!g.quads2.hasOwnProperty(c)) {
	    continue;
        }
	let ps = [];
	g.quads2[c].forEach(p => ps.push({p1:p.p1, p2:p.p2, p3:p.p3, p4:p.p4, t:p.t}));
	this.quads2[c] = ps;
    }
    this.boundingBox.copy(g.boundingBox);
}

/*
  Build this from the 4 types of primitives.
*/
LDR.LDRGeometry.prototype.fromPrimitives = function(lines, conditionalLines, triangles, quads) {
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
    let culledTriangles = triangles.filter(t => t.cull);
    if(culledTriangles.length > 0) {
	let g = new LDR.LDRGeometry(); 
	g.fromTriangles(true, culledTriangles);
	geometries.push(g);
    }
    let unculledTriangles = triangles.filter(t => !t.cull);
    if(unculledTriangles.length > 0) {
	let g = new LDR.LDRGeometry(); 
	g.fromTriangles(false, unculledTriangles);
	geometries.push(g);
    }
    let culledQuads = quads.filter(q => q.cull);
    if(culledQuads.length > 0) {
	let g = new LDR.LDRGeometry(); 
	g.fromQuads(true, culledQuads);
	geometries.push(g);
    }
    let unculledQuads = quads.filter(q => !q.cull);
    if(unculledQuads.length > 0) {
	let g = new LDR.LDRGeometry(); 
	g.fromQuads(false, unculledQuads);
	geometries.push(g);
    }
    this.replaceWith(LDR.mergeGeometries(geometries));
}

/*
  Assumes unsorted vertices that reference the primitives.
  This function sort the vertices and updates the primitives to reference the vertices.
 */
LDR.LDRGeometry.prototype.sortAndBurnVertices = function(vertices, primitives) {
    vertices.sort(LDR.vertexSorter);
    let idx = this.vertices.length-1;
    let prev;
    for(let i = 0; i < vertices.length; i++) {
	let v = vertices[i];
	if(!(prev && LDR.vertexEqual(prev, v))) {
            this.vertices.push({x:v.x, y:v.y, z:v.z, o:false});
            idx++;
	}

        let p = primitives[v.c][v.idx];
        p.t = v.t; // texmapPlacement stored on primitives - not on vertices.
	p['p'+v.p] = idx;
	prev = v;
    }
}

/*
  Build a geometry from {p1,p2,c} lines.
 */
LDR.LDRGeometry.prototype.fromLines = function(ps) {
    let vertices = [];
    for(let i = 0; i < ps.length; i++) {
	let p = ps[i], idx;
	if(this.lines.hasOwnProperty(p.c)) {
	    let t = this.lines[p.c];
	    idx = t.length;
	    t.push({});
	}
	else {
	    this.lines[p.c] = [{}];
	    idx = 0;
	}
	vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, c:p.c, idx:idx, p:1},
		      {x:p.p2.x, y:p.p2.y, z:p.p2.z, c:p.c, idx:idx, p:2});
        this.boundingBox.expandByPoint(p.p1);
        this.boundingBox.expandByPoint(p.p2);
    }
    this.sortAndBurnVertices(vertices, this.lines);
}

LDR.LDRGeometry.prototype.fromConditionalLines = function(ps) {
    let vertices = [];
    for(let i = 0; i < ps.length; i++) {
	let p = ps[i], idx;
	if(this.conditionalLines.hasOwnProperty(p.c)) {
	    let t = this.conditionalLines[p.c];
	    idx = t.length;
	    t.push({});
	}
	else {
	    this.conditionalLines[p.c] = [{}];
	    idx = 0;
	}
	vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, c:p.c, idx:idx, p:1},
		      {x:p.p2.x, y:p.p2.y, z:p.p2.z, c:p.c, idx:idx, p:2},
		      {x:p.p3.x, y:p.p3.y, z:p.p3.z, c:p.c, idx:idx, p:3},
		      {x:p.p4.x, y:p.p4.y, z:p.p4.z, c:p.c, idx:idx, p:4});
        this.boundingBox.expandByPoint(p.p1);
        this.boundingBox.expandByPoint(p.p2);
    }
    this.sortAndBurnVertices(vertices, this.conditionalLines);
}

LDR.LDRGeometry.prototype.fromTriangles = function(cull, ps) {
    let vertices = [];
    let triangles = cull ? this.triangles : this.triangles2;
    let self = this;
    ps.forEach(p => {
            let idx;
            if(triangles.hasOwnProperty(p.c)) {
                let t = triangles[p.c];
                idx = t.length;
                t.push({});
            }
            else {
                triangles[p.c] = [{}];
                idx = 0;
            }
            vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, c:p.c, idx:idx, p:1, t:p.tmp},
                          {x:p.p2.x, y:p.p2.y, z:p.p2.z, c:p.c, idx:idx, p:2, t:p.tmp},
                          {x:p.p3.x, y:p.p3.y, z:p.p3.z, c:p.c, idx:idx, p:3, t:p.tmp});
            self.boundingBox.expandByPoint(p.p1);
            self.boundingBox.expandByPoint(p.p2);
            self.boundingBox.expandByPoint(p.p3);
        });
    this.sortAndBurnVertices(vertices, triangles);
}

LDR.LDRGeometry.prototype.fromQuads = function(cull, ps) {
    let vertices = [];
    let quads = cull ? this.quads : this.quads2;
    let self = this;
    ps.forEach(p => {
            let idx;
            if(quads.hasOwnProperty(p.c)) {
                let t = quads[p.c];
                idx = t.length;
                t.push({});
            }
            else {
                quads[p.c] = [{}];
                idx = 0;
            }
            vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, c:p.c, idx:idx, p:1, t:p.tmp},
                          {x:p.p2.x, y:p.p2.y, z:p.p2.z, c:p.c, idx:idx, p:2, t:p.tmp},
                          {x:p.p3.x, y:p.p3.y, z:p.p3.z, c:p.c, idx:idx, p:3, t:p.tmp},
                          {x:p.p4.x, y:p.p4.y, z:p.p4.z, c:p.c, idx:idx, p:4, t:p.tmp});
            self.boundingBox.expandByPoint(p.p1);
            self.boundingBox.expandByPoint(p.p2);
            self.boundingBox.expandByPoint(p.p3);
            self.boundingBox.expandByPoint(p.p4);
        });
    this.sortAndBurnVertices(vertices, quads);
}

/*
  Consolidate the primitives and sub-parts of the step.
*/
LDR.LDRGeometry.prototype.fromStep = function(loader, step) {
    let self = this;
    this.rebuild = () => self.fromStep(loader, step);
    let geometries = [];
    if(step.hasPrimitives()) {
        let g = new LDR.LDRGeometry();
	g.fromPrimitives(step.lines, step.conditionalLines, step.triangles, step.quads);
        geometries.push(g);
    }

    function handleSubModel(subModel) {
        let g = new LDR.LDRGeometry(); 
	g.fromPartDescription(loader, subModel);
        geometries.push(g);
    }
    step.subModels.forEach(handleSubModel);

    this.replaceWith(LDR.mergeGeometries(geometries));
}

LDR.LDRGeometry.prototype.fromPartType = function(loader, pt) {
    let self = this;
    this.rebuild = () => self.fromPartType(loader, pt);
    let geometries = [];
    for(let i = 0; i < pt.steps.length; i++) {
        let g = new LDR.LDRGeometry();
        g.fromStep(loader, pt.steps[i]);
        geometries.push(g);
    }
    this.replaceWith(LDR.mergeGeometries(geometries));
}

LDR.LDRGeometry.prototype.fromPartDescription = function(loader, pd) {
    let self = this;
    this.rebuild = () => self.fromPartDescription(loader, pd);
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

    // Function to update color (notice that input and output are strings):
    let replaceColor;
    if(pd.c === 16) {
	replaceColor = x => ''+x; // Do nothing.
    }
    else if(pd.c === 24) {	    
	replaceColor = x => x === '16' ? '24' : ''+x;
    }
    else if(pd.c < 0) { // Edge color
	replaceColor = x => ''+((x === '16' || x === '24') ? pd.c : x);
    }
    else { // Standard color
        let pos = ''+pd.c;
        let neg = ''+(-pd.c-1);
	replaceColor = x => x === '16' ? pos : (x === '24' ? neg : ''+x);
    }

    // TODO: Optimize rotation matrices for I-matrix (1,0,0,0,1,0,0,0,1), \-matrices, etc.
    
    // Update and re-sort the vertices:
    // First decorate with initial index and update position:
    let p = new THREE.Vector3();
    let lp = pd.logoPosition;
    for(let i = 0; i < this.vertices.length; i++) {
	let v = this.vertices[i];
	v.oldIndex = i;
	
	p.set(v.x, v.y, v.z);
	p.applyMatrix3(pd.r);
	p.add(pd.p);
	v.x = p.x;
	v.y = p.y;
	v.z = p.z;
        v.o = v.o || (lp && lp.x === v.x && lp.y === v.y && lp.z === v.z);
    }
    let newIndices = [];
    this.vertices.sort(LDR.vertexSorter);
    for(let i = 0; i < this.vertices.length; i++) {
	let v = this.vertices[i];
	newIndices[v.oldIndex] = i;
    }
    // Clean up vertices:
    this.vertices.forEach(v => delete v.oldIndex);    
    
    // Update the indices, colors and texmap placements on the primitives:
    let tmpMap = {}; // Texmap placement map idx => idx.
    function t(withColors, transform) {
        let ret = {};
        for(let c in withColors) {
            if(!withColors.hasOwnProperty(c)) {
                continue;
            }
	    
	    let wc = withColors[c];
            let primitives = [];
	    for(let i = 0; i < wc.length; i++) {
		let primitive = transform(wc[i]);
		primitives.push(primitive);

		// Collect and update texmap placements. See https://forums.ldraw.org/thread-23755-post-39970.html#pid39970
		if(!primitive.t) {
		    continue;
		}
		let tmp = primitive.t;
		if(tmpMap.hasOwnProperty(tmp.idx)) {
		    primitive.t = LDR.TexmapPlacements[tmpMap[tmp.idx]];
		}
		else {
		    let clone = primitive.t = tmp.clone();

		    // Apply transformation to clone:
		    clone.placeAt(pd);

		    tmpMap[tmp.idx] = clone.idx;
		}
	    }

	    // Place primitives in ret:
            let toColor = replaceColor(c);
            if(ret.hasOwnProperty(toColor)) {
                ret[toColor].push(...primitives);
            }
            else {
                ret[toColor] = primitives;
            }
        }
        return ret;
    }
    this.lines = t(this.lines, p => {return {p1:newIndices[p.p1],p2:newIndices[p.p2]};});
    this.conditionalLines = t(this.conditionalLines, p => {return {p1:newIndices[p.p1],p2:newIndices[p.p2],p3:newIndices[p.p3],p4:newIndices[p.p4]};});
    if(invert) {
        this.triangles = t(this.triangles, p => {return {p1:newIndices[p.p3],p2:newIndices[p.p2],p3:newIndices[p.p1],t:p.t};});
        this.quads = t(this.quads, p => {return {p1:newIndices[p.p4],p2:newIndices[p.p3],p3:newIndices[p.p2],p4:newIndices[p.p1],t:p.t};});
    }
    else {
        this.triangles = t(this.triangles, p => {return {p1:newIndices[p.p1],p2:newIndices[p.p2],p3:newIndices[p.p3],t:p.t};});
        this.quads = t(this.quads, p => {return {p1:newIndices[p.p1],p2:newIndices[p.p2],p3:newIndices[p.p3],p4:newIndices[p.p4],t:p.t};});
    }
    this.triangles2 = t(this.triangles2, p => {return {p1:newIndices[p.p3],p2:newIndices[p.p2],p3:newIndices[p.p1],t:p.t};});
    this.quads2 = t(this.quads2, p => {return {p1:newIndices[p.p4],p2:newIndices[p.p3],p3:newIndices[p.p2],p4:newIndices[p.p1],t:p.t};});

    // No culling in PD: Move all culled triangles and quads to non-culled:
    if(!pd.cull) {
        function mv(from, to) {
            for(let c in from) {
                if(!from.hasOwnProperty(c)) {
                    continue;
                }
                if(!to.hasOwnProperty(c)) {
                    to[c] = [];
                }
                to[c].push(...from[c]);
            }
        }
        mv(this.triangles, this.triangles2);
        this.triangles = [];
        mv(this.quads, this.quads2);
        this.quads = [];
    }

    // Overwrite texmap placement on primitives:
    if(pd.tmp) {
        function copyDown(ps) {
            for(let c in ps) {
                if(ps.hasOwnProperty(c)) {
                    ps[c].forEach(t => t.t = pd.tmp);
                }
            }
        }
        copyDown(this.triangles);
        copyDown(this.triangle2);
        copyDown(this.quads);
        copyDown(this.quads2);
    }
}

LDR.LDRGeometry.prototype.mapIndices = function(map) {
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

    for(let c in this.lines) {
	if(this.lines.hasOwnProperty(c)) {
	    this.lines[c].forEach(x => map2(x, map));
        }
    }
    for(let c in this.conditionalLines) {
	if(this.conditionalLines.hasOwnProperty(c)) {
	    this.conditionalLines[c].forEach(x => map4(x, map));
        }
    }
    for(let c in this.triangles) {
	if(this.triangles.hasOwnProperty(c)) {
	    this.triangles[c].forEach(x => map3(x, map));
        }
    }
    for(let c in this.triangles2) {
	if(this.triangles2.hasOwnProperty(c)) {
	    this.triangles2[c].forEach(x => map3(x, map));
        }
    }
    for(let c in this.quads) {
	if(this.quads.hasOwnProperty(c)) {
	    this.quads[c].forEach(x => map4(x, map));
        }
    }
    for(let c in this.quads2) {
	if(this.quads2.hasOwnProperty(c)) {
	    this.quads2[c].forEach(x => map4(x, map));
        }
    }
}

LDR.LDRGeometry.prototype.merge = function(other) {
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
	if(LDR.vertexEqual(pThis, pOther)) {
	    indexMapThis.push(mergedVertices.length);
	    indexMapOther.push(mergedVertices.length);
            pThis.o = pThis.o || pOther.o;
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

    function mergePrimitives(thisPrim, otherPrim) {
        for(let c in otherPrim) {
            if(!otherPrim.hasOwnProperty(c)) {
                continue;
            }
            if(thisPrim.hasOwnProperty(c)) {
                thisPrim[c].push(...otherPrim[c]);
            }
            else {
                thisPrim[c] = otherPrim[c];
            }
        }
    }

    mergePrimitives(this.lines, other.lines);
    mergePrimitives(this.conditionalLines, other.conditionalLines);
    mergePrimitives(this.triangles, other.triangles);
    mergePrimitives(this.triangles2, other.triangles2);
    mergePrimitives(this.quads, other.quads);
    mergePrimitives(this.quads2, other.quads2);
}

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
    this.triangles2 = {}; // Triangles without culling
    this.quads = {}; // c -> [{p1,p2,p3,p4},...]
    this.quads2 = {}; // Quads without culling
    // geometries:
    this.lineColorManager;
    this.lineGeometry;
    this.triangleColorManager;
    this.triangleGeometry;
    this.conditionalLineGeometry;
    this.geometriesBuilt = false;
    this.boundingBox = new THREE.Box3();
}

/*
  Used for showing points where all vertices are.
 */
LDR.LDRGeometry.prototype.buildVertexAttribute = function(rotation) {
    let vertices = [];
    this.vertices.forEach(v => {
            let position = new THREE.Vector3(v.x, v.y, v.z);
            position.applyMatrix3(rotation);
            vertices.push(position.x, position.y, position.z);
        });
    return new THREE.Float32BufferAttribute(vertices, 3);
}

LDR.LDRGeometry.prototype.buildGeometriesAndColorsForLines = function() {
    this.lineColorManager = new LDR.ColorManager();

    // Vertices for the geometries have size 3 for single color geometries and size 4 for multi-colored (they include color indices as fourth component):
    // First handle line vertices:
    let allLineColors = [];
    for(let c in this.lines) {
	if(this.lines.hasOwnProperty(c)) {
            allLineColors.push(c);
        }
    }
    for(let c in this.conditionalLines) {
	if(!this.lines.hasOwnProperty(c) && this.conditionalLines.hasOwnProperty(c)) {
            allLineColors.push(c);
        }
    }

    var self = this;
    let colorIdx = 0;
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
	this.vertices.forEach(v => lineVertices.push(v.x, v.y, v.z));
	lineVertexAttribute = new THREE.Float32BufferAttribute(lineVertices, 3);
	// No need to update indices of lines.
	if(this.lines.hasOwnProperty(c)) {
	    this.lines[c].forEach(line => lineIndices.push(line.p1, line.p2));
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

	    this.lines[c].forEach(line => {
                    lineIndices.push(handleVertex(lineVertices, line.p1, fc)); // Update indices
                    lineIndices.push(handleVertex(lineVertices, line.p2, fc));
                });
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
	this.conditionalLines[c].forEach(p => {
                let p1 = this.vertices[p.p1];
                let p2 = this.vertices[p.p2];
                let p3 = this.vertices[p.p3];
                let p4 = this.vertices[p.p4];
                conditionalLines.push({p1:p1, p2:p2, p3:p3, p4:p4, fc:fc});
            });
    }
    this.buildGeometryForConditionalLines(allLineColors.length > 1, conditionalLines);
}

LDR.LDRGeometry.prototype.buildGeometriesAndColors = function() {
    if(this.geometriesBuilt) {
	return;
    }
    this.buildGeometriesAndColorsForLines();

    this.triangleColorManager = new LDR.ColorManager();

    var self = this;
    let colorIdx = 0;
    let handleVertex = function(vertices, idx, fc) {
	let v = self.vertices[idx];
	if(v.c !== colorIdx) {
	    v.c = colorIdx;
	    v.idx = vertices.length/4;
	    vertices.push(v.x, v.y, v.z, fc);
	}
	return v.idx;
    }

    // Now handle triangle colors and vertices:
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

    let triangleVertexAttribute, triangleVertices = [], triangleIndices = [];
    if(allTriangleColors.length === 1) {
	let c = allTriangleColors[0];
	this.triangleColorManager.get(c); // Ensure color is present.

        this.vertices.forEach(v => triangleVertices.push(v.x, v.y, v.z));
	triangleVertexAttribute = new THREE.Float32BufferAttribute(triangleVertices, 3);

	// No need to update indices for triangles and quads:
	if(this.triangles.hasOwnProperty(c)) {
	    this.triangles[c].forEach(t => triangleIndices.push(t.p1, t.p2, t.p3));
	}
	if(this.triangles2.hasOwnProperty(c)) {
	    this.triangles2[c].forEach(t => triangleIndices.push(t.p1, t.p2, t.p3,
                                                                 t.p3, t.p2, t.p1));
	}
	if(this.quads.hasOwnProperty(c)) {
	    this.quads[c].forEach(q => triangleIndices.push(q.p1, q.p2, q.p4, q.p2, q.p3, q.p4));
	}
	if(this.quads2.hasOwnProperty(c)) {
	    this.quads2[c].forEach(q => triangleIndices.push(q.p1, q.p2, q.p4, q.p2, q.p3, q.p4,
                                                             q.p4, q.p3, q.p2, q.p4, q.p2, q.p1));
	}
    }
    else if(allTriangleColors.length > 1) {
	/*
	  Duplicate vertices for each color.
	 */
        allTriangleColors.forEach(c => {
                colorIdx++;
                let fc = this.triangleColorManager.get(c);

                if(this.triangles.hasOwnProperty(c)) {
                    this.triangles[c].forEach(triangle => {
                            let i1 = handleVertex(triangleVertices, triangle.p1, fc);
                            let i2 = handleVertex(triangleVertices, triangle.p2, fc);
                            let i3 = handleVertex(triangleVertices, triangle.p3, fc);
                            triangleIndices.push(i1, i2, i3);
                        });
		}
                if(this.triangles2.hasOwnProperty(c)) {
                    this.triangles2[c].forEach(triangle => {
                            let i1 = handleVertex(triangleVertices, triangle.p1, fc);
                            let i2 = handleVertex(triangleVertices, triangle.p2, fc);
                            let i3 = handleVertex(triangleVertices, triangle.p3, fc);
                            triangleIndices.push(i1, i2, i3, i3, i2, i1);
                        });
		}
                if(this.quads.hasOwnProperty(c)) {
                    this.quads[c].forEach(quad => {
                            let i1 = handleVertex(triangleVertices, quad.p1, fc);
                            let i2 = handleVertex(triangleVertices, quad.p2, fc);
                            let i3 = handleVertex(triangleVertices, quad.p3, fc);
                            let i4 = handleVertex(triangleVertices, quad.p4, fc);
                            triangleIndices.push(i1, i2, i4, i2, i3, i4);
                        });
                }
                if(this.quads2.hasOwnProperty(c)) {
                    this.quads2[c].forEach(quad => {
                            let i1 = handleVertex(triangleVertices, quad.p1, fc);
                            let i2 = handleVertex(triangleVertices, quad.p2, fc);
                            let i3 = handleVertex(triangleVertices, quad.p3, fc);
                            let i4 = handleVertex(triangleVertices, quad.p4, fc);
                            triangleIndices.push(i1, i2, i4, i2, i3, i4,
                                                 i4, i3, i2, i4, i2, i1);
                        });
                }
            });
	triangleVertexAttribute = new THREE.Float32BufferAttribute(triangleVertices, 4);
    }
    this.triangleGeometry = this.buildGeometry(triangleIndices, triangleVertexAttribute);

    this.geometriesBuilt = true;
}

// Optimized version of the one found in https://github.com/mrdoob/three.js/blob/master/src/core/BufferGeometry.js
THREE.BufferGeometry.prototype.computeVertexNormals = function() {
    var attributes = this.attributes;
    var positions = attributes.position.array;

    this.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(positions.length), 3));
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
   This function also computes normals to be used by standard materials.
 */
LDR.LDRGeometry.prototype.buildPhysicalGeometriesAndColors = function() {
    if(this.geometriesBuilt) {
	return;
    }
    this.buildGeometriesAndColorsForLines();
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
    let edges = []; // 0/1 => soft, 2 => hard
    for(let c in this.conditionalLines) {
	if(this.conditionalLines.hasOwnProperty(c)) {
            let lines = this.conditionalLines[c];
            lines.forEach(line => edges[key(line.p1, line.p2)] = true);
        }
    }
    for(let c in this.lines) {
	if(this.lines.hasOwnProperty(c)) {
            let lines = this.lines[c];
            lines.forEach(line => vertices[line.p1].hard = vertices[line.p2].hard = true);
            lines.forEach(line => edges[key(line.p1, line.p2)] = false); // This fixes duplicate soft and hard edges.
        }
    }
    //console.log('EDGES of the ' + vLen + ' vertices:');
    //console.dir(edges);
    
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

    this.triangleGeometry = {}; // c -> geometry

    function renew(i) {
        let v = vertices[i];
        //console.log('Renewing ' + i + ': ' + v.x + ', ' + v.y + ', ' + v.z);
        vertices.push({x:v.x, y:v.y, z:v.z}); // No mark as it is new and will not be visited again.
        vLen++;
        return vLen-1;
    }

    function updateTriangleIndices(t) {
        let p1 = t.p1, p2 = t.p2, p3 = t.p3;
        let h1 = vertices[p1].hard, h2 = vertices[p2].hard, h3 = vertices[p3].hard;
        let k12 = edges[key(p1, p2)], k23 = edges[key(p2, p3)], k31 = edges[key(p3, p1)];
        //console.log('Checking triangle ' + p1 + ', ' + p2 + ', ' + p3 + ': ' + k12 + ', ' + k23 + ', ' + k31);
        
        if(h1 && !k12 && !k31) {
            t.p1 = renew(t.p1);
        }
        if(h2 && !k12 && !k23) {
            t.p2 = renew(t.p2);
        }
        if(h3 && !k23 && !k31) {
            t.p3 = renew(t.p3);
        }
    }

    function updateQuadIndices(t) {
        let p1 = t.p1, p2 = t.p2, p3 = t.p3, p4 = t.p4;
        let h1 = vertices[p1].hard, h2 = vertices[p2].hard, h3 = vertices[p3].hard, h4 = vertices[p4].hard;
        let k12 = edges[key(p1, p2)], k23 = edges[key(p2, p3)], k34 = edges[key(p3, p4)], k41 = edges[key(p4, p1)];
        //console.log('Checking quad ' + p1 + ', ' + p2 + ', ' + p3 + ', ' + p4);
        
        if(h1 && !k12 && !k41) {
            t.p1 = renew(t.p1);
        }
        if(h2 && !k12 && !k23) {
            t.p2 = renew(t.p2);
        }
        if(h3 && !k23 && !k34) {
            t.p3 = renew(t.p3);
        }
        if(h4 && !k41 && !k34) {
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

            if(self.triangles.hasOwnProperty(c)) {
                self.triangles[c].forEach(t => pushT(t.p1, t.p2, t.p3));
            }
            if(self.triangles2.hasOwnProperty(c)) {
                self.triangles2[c].forEach(t => {pushT(t.p1, t.p2, t.p3);
                                                 pushT(t.p3, t.p2, t.p1);});
            }
            if(self.quads.hasOwnProperty(c)) {
                self.quads[c].forEach(q => pushQ(q.p1, q.p2, q.p3, q.p4));
            }
            if(self.quads2.hasOwnProperty(c)) {
                self.quads2[c].forEach(q => {pushQ(q.p1, q.p2, q.p3, q.p4);
                                             pushQ(q.p4, q.p3, q.p2, q.p1);});
            }

            if(triangleIndices.length === 0) {
                return;
            }

            let g = self.buildGeometry(triangleIndices, triangleVertexAttribute);
            g.computeVertexNormals(); // Also normalizes.

            // Compute UV's using normals and project from bounding box 'b' of size 'size' onto [0;1]:
            let normals = g.getAttribute('normal').array;
            let uvs = [];
            for(let i = 0; i < vLen; i++) {
                uvs.push(0, 0);
            }
            let dx = v => (v.x-b.min.x)/size.x;
            let dy = v => (v.y-b.min.y)/size.y;
            let dz = v => (v.z-b.min.z)/size.z;

            function setUVs(indices) {
                const len = indices.length;

                function setUV(vs, fu, fv) {
                    let ret = vs.map((v,i) => {return {u:fu(v, i), v:fv(v, i)};});
                    
                    let prevprev = ret[ret.length-2];
                    let prev = ret[ret.length-1];
                    let turn = uv => (prev.u-prevprev.u)*(uv.v-prevprev.v) -
                                     (prev.v-prevprev.v)*(uv.u-prevprev.u);
                    for(let i = 0; i < ret.length; i++) {
                        let uv = ret[i];
                        if(Math.abs(prev.u-uv.u) < 1e-5 && Math.abs(prev.v-uv.v) < 1e-5 ||
                           Math.abs(prevprev.u-uv.u) < 1e-5 && Math.abs(prevprev.v-uv.v) < 1e-5 ||
                           Math.abs(turn(uv)) < 1e-7) {
                            /*console.log(' Underlying data points:');
                            console.dir(vs);
                            console.dir('Outputting:');
                            console.dir(ret);
                            console.dir('Turn: ' + turn(uv));
                            console.warn("Degenerate UV! " + uv.u + ', ' + uv.v);//*/
                            return false;
                        }
                        prevprev = prev;
                        prev = uv;
                    }
                    
                    // Output:
                    ret.forEach((uv, i) => {
                            let idx = 2*indices[i];
                            uvs[idx] = uv.u;
                            uvs[idx+1] = uv.v;
                        });
                    return true;
                }

                let maxDiff = xs => xs.map((x,idx,a) => Math.abs(x - a[idx === 0 ? len-1 : idx-1])).reduce((a,b) => a > b ? a : b, 0);
                let vs = indices.map(i => vertices[i]);

                // First check if this is a simple rectilinear face:
                let DX = maxDiff(vs.map(v => v.x));
                if(DX < 1e-5) { // y/z projection:
                    //console.log('DX');
                    setUV(vs, dy, dz); // Ignore false returns as that indicates highly-degenerate polygons.
                    return;
                }
                let DY = maxDiff(vs.map(v => v.y));
                if(DY < 1e-5) {
                    //console.log('DY');
                    setUV(vs, dz, dx); // Ignore false returns as that indicates highly-degenerate polygons.
                    return;
                }
                let DZ = maxDiff(vs.map(v => v.z));
                if(DZ < 1e-5) {
                    //console.log('DZ');
                    setUV(vs, dx, dy); // Ignore false returns as that indicates highly-degenerate polygons.
                    return;
                }

                // Face is not rectilinear! Project onto cylinders or globe using normals:
                let ns = indices.map(i => 3*i).map(idx => new THREE.Vector3(normals[idx], normals[1+idx], normals[2+idx]));

                // Check if at least 3 normals point the same direction:
                let equalVector3 = (a, b) => Math.abs(a.x-b.x) < 1e-5 && Math.abs(a.y-b.y) < 1e-5 && Math.abs(a.z-b.z) < 1e-5;
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
                    //console.log('At least 3 normals are the same!');
                    let nSum = ns.reduce((a, b) => new THREE.Vector3(a.x+b.x, a.y+b.y, a.z+b.z), new THREE.Vector3());
                    let nx = nSum.x*nSum.x, ny = nSum.y*nSum.y, nz = nSum.z*nSum.z;
                    if(nx > ny && nx > nz) {
                        setUV(vs, dy, dz);
                    }
                    else if(ny > nx && ny > nz) {
                        setUV(vs, dx, dz);
                    }
                    else {
                        setUV(vs, dx, dy);
                    }
                    return;
                }

                // Check if coordinates are degenerate in any axis:
                const PI2 = 1/(2.1*Math.PI);
                if(maxDiff(ns.map(v => v.x)) < 1e-5) {
                    //console.log('dx=0 for NORMALS!');
                    if(setUV(ns, v => 0.5+Math.atan2(v.y, v.z)*PI2, (v,i) => dx(vs[i]))) {
                        return;
                    }
                }
                else if(maxDiff(ns.map(v => v.y)) < 1e-5) {
                    //console.log('dy=0 for NORMALS!');
                    if(setUV(ns, v => 0.5+Math.atan2(v.x, v.z)*PI2, (v,i) => dy(vs[i]))) {
                        return;
                    }
                }
                else if(maxDiff(ns.map(v => v.z)) < 1e-5) {
                    //console.log('dz=0 for NORMALS!');
                    if(setUV(ns, v => 0.5+Math.atan2(v.x, v.y)*PI2, (v,i) => dz(vs[i]))) {
                        return;
                    }
                }
                
                /*console.log('Lat/Lon projection. vertices:');
                console.dir(vs);
                console.log('normals:');
                console.dir(ns);//*/

                if(!setUV(ns, v => 0.5 + Math.atan2(v.z, v.x)*PI2, v => 0.5 + Math.asin(v.y)*PI2)) {
                    setUV(vs, dx, dz);
                }
            }

            if(self.triangles.hasOwnProperty(c)) {
                self.triangles[c].forEach(t => setUVs([t.p1, t.p2, t.p3]));
            }
            if(self.triangles2.hasOwnProperty(c)) {
                self.triangles2[c].forEach(t => setUVs([t.p1, t.p2, t.p3]));
            }
            if(self.quads.hasOwnProperty(c)) {
                self.quads[c].forEach(q => setUVs([q.p1, q.p2, q.p3, q.p4]));
            }
            if(self.quads2.hasOwnProperty(c)) {
                self.quads2[c].forEach(q => setUVs([q.p1, q.p2, q.p3, q.p4]));
            }

            /*console.log('All done! vertices, indices, uvs');
            console.dir(vertices);
            console.dir(self);
            console.dir(uvs);//*/

            g.addAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            //g.attributes.uv2 = g.attributes.uv; // Used by aoMap

            self.triangleGeometry[c] = g;
        });

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
    this.triangles2 = g.triangles2;
    this.quads = g.quads;
    this.quads2 = g.quads2;
    this.boundingBox = g.boundingBox;
}

LDR.LDRGeometry.prototype.replaceWithDeep = function(g) {
    let self = this;
    g.vertices.forEach(v => self.vertices.push({x:v.x, y:v.y, z:v.z}));

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
	g.triangles[c].forEach(p => ps.push({p1:p.p1, p2:p.p2, p3:p.p3}));
	this.triangles[c] = ps;
    }
    for(let c in g.triangles2) {
	if(!g.triangles2.hasOwnProperty(c)) {
	    continue;
        }
	let ps = [];
	g.triangles2[c].forEach(p => ps.push({p1:p.p1, p2:p.p2, p3:p.p3}));
	this.triangles2[c] = ps;
    }
    for(let c in g.quads) {
	if(!g.quads.hasOwnProperty(c)) {
	    continue;
        }
	let ps = [];
	g.quads[c].forEach(p => ps.push({p1:p.p1, p2:p.p2, p3:p.p3, p4:p.p4}));
	this.quads[c] = ps;
    }
    for(let c in g.quads2) {
	if(!g.quads2.hasOwnProperty(c)) {
	    continue;
        }
	let ps = [];
	g.quads2[c].forEach(p => ps.push({p1:p.p1, p2:p.p2, p3:p.p3, p4:p.p4}));
	this.quads2[c] = ps;
    }
    this.boundingBox.copy(g.boundingBox);
}

/*
  Build this from the 4 types of primitives.
*/
LDR.LDRGeometry.prototype.fromPrimitives = function(cull, lines, conditionalLines, triangles, quads) {
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
	g.fromTriangles(cull, triangles);
	geometries.push(g);
    }
    if(quads.length > 0) {
	let g = new LDR.LDRGeometry(); 
	g.fromQuads(cull, quads);
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
    let prev;
    for(let i = 0; i < vertices.length; i++) {
	let v = vertices[i];
	if(!(prev && prev.x === v.x && prev.y === v.y && prev.z === v.z)) {
	    this.vertices.push({x:v.x, y:v.y, z:v.z});
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
	prev = v;
    }
}

/*
  Build a geometry from {p1,p2,colorID} lines.
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

LDR.LDRGeometry.prototype.fromTriangles = function(cull, ps) {
    let vertices = [];
    let triangles = cull ? this.triangles : this.triangles2;
    let self = this;
    ps.forEach(p => {
            let idx;
            if(triangles.hasOwnProperty(p.colorID)) {
                let t = triangles[p.colorID];
                idx = t.length;
                t.push({});
            }
            else {
                triangles[p.colorID] = [{}];
                idx = 0;
            }
            vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, c:p.colorID, idx:idx, p:1},
                          {x:p.p2.x, y:p.p2.y, z:p.p2.z, c:p.colorID, idx:idx, p:2},
                          {x:p.p3.x, y:p.p3.y, z:p.p3.z, c:p.colorID, idx:idx, p:3});
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
            if(quads.hasOwnProperty(p.colorID)) {
                let t = quads[p.colorID];
                idx = t.length;
                t.push({});
            }
            else {
                quads[p.colorID] = [{}];
                idx = 0;
            }
            vertices.push({x:p.p1.x, y:p.p1.y, z:p.p1.z, c:p.colorID, idx:idx, p:1},
		          {x:p.p2.x, y:p.p2.y, z:p.p2.z, c:p.colorID, idx:idx, p:2},
		          {x:p.p3.x, y:p.p3.y, z:p.p3.z, c:p.colorID, idx:idx, p:3},
		          {x:p.p4.x, y:p.p4.y, z:p.p4.z, c:p.colorID, idx:idx, p:4});
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
    let geometries = [];
    if(step.hasPrimitives) {
        let g = new LDR.LDRGeometry();
	g.fromPrimitives(step.cull, step.lines, step.conditionalLines, step.triangles, step.quads);
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
    let geometries = [];
    if(pt.steps.length === 0) {
	console.warn("No steps in " + pt.ID);
	return; // Empty - just make empty.
    }

    pt.steps.forEach(step => {
            let g = new LDR.LDRGeometry();
            g.fromStep(loader, step);
            geometries.push(g);
        }); // Only one step expected, but we do not know if someone suddenly gets the bright idea to have stes in part files..

    this.replaceWith(LDR.mergeGeometries(geometries));
}

LDR.LDRGeometry.prototype.fromPartDescription = function(loader, pd) {
    let pt = loader.getPartType(pd.ID);
    if(!pt) {
        throw "Part not loaded: " + pd.ID;
    }
    pt.ensureGeometry(loader);

    this.replaceWithDeep(pt.geometry);

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

    // Function to update color (notice that input and output are strings):
    let replaceColor;
    if(pd.colorID === 16) {
	replaceColor = x => ''+x; // Do nothing.
    }
    else if(pd.colorID === 24) {	    
	replaceColor = x => x === '16' ? '24' : ''+x;
    }
    else if(pd.colorID < 0) { // Edge color
        let pos = ''+pd.colorID;
	replaceColor = function(x) {
	    if(x === '16' || x === '24') {
		return pos;
            }
	    else {
		return ''+x;
            }
	};
    }
    else { // Standard color
        let pos = ''+pd.colorID;
        let neg = ''+(-pd.colorID-1);
	replaceColor = function(x) {
	    if(x === '16') {
		return pos;
            }
	    else if(x === '24') {
		return neg;
            }
	    else {
		return ''+x;
            }
	};
    }

    // TODO: Optimize rotation matrices for I-matrix (1,0,0,0,1,0,0,0,1), \-matrices, etc.
    
    // Update and re-sort the vertices:
    // First decorate with initial index and update position:
    for(let i = 0; i < this.vertices.length; i++) {
	let v = this.vertices[i];
	v.oldIndex = i;
	
	let position = new THREE.Vector3(v.x, v.y, v.z);
	position.applyMatrix3(pd.rotation);
	position.add(pd.position);
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
    
    // Update the indices and colors on the primitives:

    function t(withColors, transform) {
        let ret = {};
        for(let c in withColors) {
            if(!withColors.hasOwnProperty(c)) {
                continue;
            }
            let primitives = withColors[c].map(transform);
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
        this.triangles = t(this.triangles, p => {return {p1:newIndices[p.p3],p2:newIndices[p.p2],p3:newIndices[p.p1]};});
        this.quads = t(this.quads, p => {return {p1:newIndices[p.p4],p2:newIndices[p.p3],p3:newIndices[p.p2],p4:newIndices[p.p1]};});
    }
    else {
        this.triangles = t(this.triangles, p => {return {p1:newIndices[p.p1],p2:newIndices[p.p2],p3:newIndices[p.p3]};});
        this.quads = t(this.quads, p => {return {p1:newIndices[p.p1],p2:newIndices[p.p2],p3:newIndices[p.p3],p4:newIndices[p.p4]};});
    }
    this.triangles2 = t(this.triangles2, p => {return {p1:newIndices[p.p3],p2:newIndices[p.p2],p3:newIndices[p.p1]};});
    this.quads2 = t(this.quads2, p => {return {p1:newIndices[p.p4],p2:newIndices[p.p3],p3:newIndices[p.p2],p4:newIndices[p.p1]};});
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

LDR.LDRGeometry.prototype.print = function() {
    console.log(this.vertices.length);
    this.vertices.forEach((v,idx) => console.log(idx + ': ' + v.x + ' ' + v.y + ' ' + v.z));
    for(let c in this.lines) {
        if(this.lines.hasOwnProperty(c)) {
            let lines = this.lines[c];
            let s = 'Color ' + c + ': ' + lines.length + ' lines: ';
            lines.forEach(p => s += ' ' + p.p1 + '->' + p.p2);
            console.log(s);
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

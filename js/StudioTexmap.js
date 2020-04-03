'use strict';

LDR.STUDIO = {};

LDR.STUDIO.handleCommentLine = function(part, parts) {
    if(parts.length < 3) {
	return false; // Not Studio 2.0 line - too short.
    }
    if(parts[1] === 'PE_TEX_PATH') {
	return true; // Ignoring line as it always reads "0 PE_TEX_PATH -1"
    }
    if(parts[1] !== "PE_TEX_INFO") {
	return false;
    }

    // store texmap:
    part.studioTexmap = parts[2];
    //console.log(part.ID,part.studioTexmap.substring(part.studioTexmap.length-50));
    return true;
}

/*
  Compute LDraw texmaps and texmap placements from Studio 2.0 / Part Designer
 */
LDR.STUDIO.handlePart = function(loader, pt) {
    if(!pt.studioTexmap || pt.steps.length !== 1) {
	return; // Not relevant for Studio 2.0 texmaps or not with a single step.
    }
    let step = pt.steps[0];
    if(step.triangles.length === 0) {
	return; // Quads not supported.
    }

    // Fix positioning issue:
    // Studio 2.0 custom LDraw parts are misaligned when they contain a single sub part!
    if(step.subModels.length > 0 && step.triangles.length > 0 && step.lines.length === 0) {
	let misalignment = step.subModels[0].p;

        // Check that all misalignments are... aligned:
        let ok = true;
        step.subModels.forEach(sm => ok = ok && sm.p.equals(misalignment));
        if(ok) {
            step.triangles.forEach(t => {t.p1.sub(misalignment); t.p2.sub(misalignment); t.p3.sub(misalignment);});

            let tmps = {};
            step.triangles.forEach(t => tmps[t.tmp.idx] = t.tmp);
            for(let idx in tmps) {
                if(!tmps.hasOwnProperty(idx)) {
                    continue;
                }
                let tmp = tmps[idx];
                tmp.p.forEach(p => p.sub(misalignment));
                tmp.setPlanar();
            }

            // Finally set the position of the single sub model:
            step.subModels.forEach(sm => sm.p.set(0, 0, 0));
        }
    }

    // Set up dataurl:
    let pid = pt.ID + '.png';
    //console.log(pt.ID, 'PID',pid);
    let dataurl = 'data:image/png;base64,' + pt.studioTexmap;
    loader.texmapDataurls.push({id:pid, mimetype:'png', content:pt.studioTexmap});
    delete pt.studioTexmap; // Ensure this is only called once.

    loader.texmaps[pid] = true;
    if(!loader.texmapListeners.hasOwnProperty(pid)) {
        loader.texmapListeners[pid] = [];
    }
    let image = new Image();
    image.onload = function(e) {
        let texture = new THREE.Texture(this);
        texture.needsUpdate = true;
        loader.texmaps[pid] = texture;
        loader.texmapListeners[pid].forEach(l => l(texture));
        loader.onProgress(pid);
	//document.body.append(image);
    };
    image.src = dataurl;
}

/*
Distances from P1 to q1,q2,q3:
|P1q2|/U2 = |q1q2|/(U2-U1) => |P1q2| = |q1q2|/(U2-U1)*U2
|P1q1| = d1, ... d3

Use the solution by 'Mark' from: https://groups.google.com/forum/#!topic/sci.math/fABwsXJJrFw
Let r, s, t be the points (instead of q1, q2, and q3) and R, S, T be radii (instead of d1, d2, d3):
 */
LDR.STUDIO.handleTriangleLine = function(pt, parts) {
    let q1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
    let q2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
    let q3 = new THREE.Vector3(parseFloat(parts[8]), parseFloat(parts[9]), parseFloat(parts[10]));
    let U1  = parseFloat(parts[11]), V1 = 1-parseFloat(parts[12]);
    let U2 = parseFloat(parts[13]), V2 = 1-parseFloat(parts[14]);
    let U3 = parseFloat(parts[15]), V3 = 1-parseFloat(parts[16]);

    let isZero = x => -1e-6 <= x && x <= 1e-6;

    // See if we can reuse the previous TMP:
    if(LDR.TexmapPlacements.length > 0) {
        let lastTmp = LDR.TexmapPlacements[LDR.TexmapPlacements.length-1];
        let [u1,v1] = lastTmp.getUV(q1);
        let [u2,v2] = lastTmp.getUV(q2);
        let [u3,v3] = lastTmp.getUV(q3);
        //console.log(U1,U2,U3,V1,V2,V3);
        //console.log(u1,u2,u3,v1,v2,v3);
        if(lastTmp.file === (pt.ID + '.png') && isZero(u1-U1) && isZero(u2-U2) && isZero(u3-U3) && isZero(1-v1-V1) && isZero(1-v2-V2) && isZero(1-v3-V3)) {
            lastTmp.used = false;
            return lastTmp;
        }
    }
    
    function getPlanes(r, s, t, R, S, T) { // Centers r, s, t. Radii R, S, T
        let u = new THREE.Vector3(); u.crossVectors(s, t);
        let v = new THREE.Vector3(); v.crossVectors(t, r);
        let w = new THREE.Vector3(); w.crossVectors(r, s);

        // Compute D = <r x s, t>
        let D = w.dot(t);
        if(isZero(D)) {
            D = 1; // No need to scale by D. "r, s, t colinear" is incorrect.
        }

        // Calculate u = (s x t)/D, v = (t x r)/D, w = (r x s)/D
        u.divideScalar(D);
        v.divideScalar(D);
        w.divideScalar(D);

        // L = u + v + w
        let L = new THREE.Vector3(); L.addVectors(u,v); L.add(w);
        let LL = L.lengthSq();

        // for each R' = +R or -R, S' = +S or -S, T' = +T or -T:
        let solutions = [];
        let s_t = new THREE.Vector3(); s_t.subVectors(s, t);
        let t_r = new THREE.Vector3(); t_r.subVectors(t, r);
        let r_s = new THREE.Vector3(); r_s.subVectors(r, s);
        [-R,R].forEach(_R => {
                [-S,S].forEach(_S => {
                        [-T,T].forEach(_T => {
                                // L x M = R'(s - t) + S'(t - r) + T'(r - s)
                                let LxM = new THREE.Vector3(); LxM.addScaledVector(s_t, _R); LxM.addScaledVector(t_r, _S); LxM.addScaledVector(r_s, _T); LxM.divideScalar(D);
                                let LxMLxM = LxM.lengthSq();
                                // if |L x M| > |L| then this combination is not a solution.
                                if(LxMLxM > LL) {
                                    return; // Not a solution
                                }
                                // M = R'u + S'v + T'w
                                let M = new THREE.Vector3(); M.addScaledVector(u, _R); M.addScaledVector(v, _S); M.addScaledVector(w, _T);
                                // for each e = +1, -1: calculate solution <x, n> = A:
                                [-1,1].forEach(e => {
                                        // A = (<L,M> + e sqrt(|L|^2 - |L x M|^2) ) / |L|^2
                                        let esqrt = e * Math.sqrt(LL-LxMLxM);
                                        let A = (L.dot(M) + esqrt) / LL;
                                        // n = ( Lx(LxM) + e L sqrt(|L|^2 - |L x M|^2) ) / |L|^2
                                        let n = new THREE.Vector3(); n.crossVectors(L, LxM); n.addScaledVector(L, esqrt); n.divideScalar(LL);
                                        solutions.push({n:n, A:A});
                                    });
                            });
                    });
            });
        return solutions;
    }

    let d12 = q1.distanceTo(q2);
    let d23 = q2.distanceTo(q3);
    let d31 = q3.distanceTo(q1);
    let toPlane = (n, A, p) => n.x*p.x + n.y*p.y + n.z*p.z + A;

    function getPlaneFromUVs(q1, q2, q3, U1, U2, U3) {
        let p1p2 = 1e12;

        if(!isZero(U2-U1)) {
            p1p2 = Math.min(p1p2, d12/Math.abs(U2-U1));
        }
        if(!isZero(U2-U3)) {
            p1p2 = Math.min(p1p2, d23/Math.abs(U2-U3));
        }
        if(!isZero(U3-U1)) {
            p1p2 = Math.min(p1p2, d31/Math.abs(U3-U1));
        }

        // Binary search for p1p2:
        let ret = [false,0];
        while(p1p2 > 1e-3) {
            let d1 = p1p2*U1;
            let d2 = p1p2*U2;
            let d3 = p1p2*U3;
            let solutions = getPlanes(q1, q2, q3, d1, d2, d3);

            function checkSolution(solution) {
                let u1 = toPlane(solution.n, -solution.A, q1)/p1p2;
                let u2 = toPlane(solution.n, -solution.A, q2)/p1p2;
                let u3 = toPlane(solution.n, -solution.A, q3)/p1p2;
                if(u1 < 0 || u2 < 0 || u3 < 0) {
                    return false; // Bad solution.
                }
                //console.log('p1p2',p1p2,'U1',u1,U1,'U2',u2,U2,'U3',u3,U3,'|n|',solution.n.length(),'A',solution.A); console.dir(solution.n);
                ret = [solution,p1p2];
                return true;
            }
            if(solutions.some(checkSolution)) {
                return ret;
            }
            p1p2 *= 0.5;
        }
        return ret;
    }
    
    // Now move to local space (above is all in UV space):
    let [P1,p1p2] = getPlaneFromUVs(q1, q2, q3, U1, U2, U3);
    if(!P1) {
        return; // No solution for U
    }
    let [P2,p1p3] = getPlaneFromUVs(q1, q2, q3, V1, V2, V3);
    if(!P2) {
        return; // No solution for V
    }

    // p1=(x,y,z) is selected as a point that intersects both P1 and P2.
    let p1 = new THREE.Vector3();
    {
        let A1 = P1.A, A2 = P2.A;
        let n1 = P1.n, n2 = P2.n;

        let u = new THREE.Vector3(); u.crossVectors(P1.n, P2.n);
        if(!isZero(u.z) && !((isZero(n2.x) && isZero(n1.x)) || (isZero(n2.y) && isZero(n1.y)))) { // Lock z=0 and find p1:
            /* n1.p1 = A1, n2.p1 = A2, so:
               
               n1x*x + n1y*y = A1 AND
               n2x*x + n2y*y = A2 =>
               
               (n1x-n2x(n1y/n2y))x = A1 - (n1y/n2y)A2 = 0 AND
               (n1y-n2y(n1x/n2x))y = A1 - (n1x/n2x)A2 = 0 =>
               
               x = (A1 - (n1y/n2y)A2) / (n1x-n2x(n1y/n2y)) AND
               y = (A1 - (n1x/n2x)A2) / (n1y-n2y(n1x/n2x))
            */
            let x = isZero(n2.y) ? (A2 - (n2.y/n1.y)*A1) / (n2.x-n1.x*(n2.y/n1.y)) : (A1 - (n1.y/n2.y)*A2) / (n1.x-n2.x*(n1.y/n2.y));
            let y = isZero(n2.x) ? (A2 - (n2.x/n1.x)*A1) / (n2.y-n1.y*(n2.x/n1.x)) : (A1 - (n1.x/n2.x)*A2) / (n1.y-n2.y*(n1.x/n2.x));
            p1.set(x, y, 0);
        }
        else if(!isZero(u.y) && !((isZero(n2.x) && isZero(n1.x)) || (isZero(n2.z) && isZero(n1.z)))) { // Same for y, so substitude z for y:
            let x = isZero(n2.z) ? (A2 - (n2.z/n1.z)*A1) / (n2.x-n1.x*(n2.z/n1.z)) : (A1 - (n1.z/n2.z)*A2) / (n1.x-n2.x*(n1.z/n2.z));
            let z = isZero(n2.x) ? (A2 - (n2.x/n1.x)*A1) / (n2.z-n1.z*(n2.x/n1.x)) : (A1 - (n1.x/n2.x)*A2) / (n1.z-n2.z*(n1.x/n2.x));
            p1.set(x, 0, z);
        }
        else if(!isZero(u.x) && !((isZero(n2.y) && isZero(n1.y)) || (isZero(n2.z) && isZero(n1.z)))) { // Same for x:
            let y = isZero(n2.z) ? (A2 - (n2.z/n1.z)*A1) / (n2.y-n1.y*(n2.z/n1.z)) : (A1 - (n1.z/n2.z)*A2) / (n1.y-n2.y*(n1.z/n2.z));
            let z = isZero(n2.y) ? (A2 - (n2.y/n1.y)*A1) / (n2.z-n1.z*(n2.y/n1.y)) : (A1 - (n1.y/n2.y)*A2) / (n1.z-n2.z*(n1.y/n2.y));
            p1.set(0, y, z);
        }
        else {
            return; // Bail!
        }
    }
    let p2 = new THREE.Vector3(); p2.copy(p1); p2.addScaledVector(P1.n, p1p2);
    let p3 = new THREE.Vector3(); p3.copy(p1); p3.addScaledVector(P2.n, p1p3);

    // Construct TMP:
    let tmp = new LDR.TexmapPlacement();
    tmp.nextOnly = true;
    tmp.p = [p1, p2, p3];
    tmp.setPlanar();
    tmp.file = pt.ID + '.png';
    tmp.idx = LDR.TexmapPlacements.length;
    LDR.TexmapPlacements.push(tmp);

    return tmp;
}

THREE.LDRLoader.prototype.toLDRStudio = function(c) {
    let self = this;

    // Mark all parts that have texmaps, as these should be downloaded separately:
    function setTexmap(pt) {
	if(!pt.isPart) {
	    return; // Not a part.
	}
        let step = pt.steps[0];
	
	function find(list) {
	    let x = list.find(y => y.texmapPlacement);
	    if(x) {
		pt.texmapFile = x.texmapPlacement.file;
		return true;
	    }
	    return false;
	}
	find(step.triangles) || find(step.quads) || find(step.subModels);
    }
    this.applyOnPartTypes(setTexmap);

    let seenColors = {}; // id => {colors}
    function findColorsFor(id, c) {
	let pt = self.getPartType(id);	
	if(pt.isPart) {
	    return; // Don't include parts.
	}
	if(!seenColors.hasOwnProperty(id)) {
	    seenColors[id] = {};
	}
	sc = seenColors[id];
	if(sc.hasOwnProperty(c)) {
	    return; // Already handled.
	}
	sc[c] = true;
	pt.steps.forEach(step => step.subModels.forEach(sm => findColorsFor(sm.ID, sm.c === 16 ? c : sm.c)));
    }
    findColorsFor(this.mainModel, c);

    let ret = this.getMainModel().toLDRColored(this, c);
    for(let id in seenColors) {
	if(!seenColors.hasOwnProperty(id) || id === self.mainModel) {
	    continue;
	}
	let obj = seenColors[id];
	for(let c in obj) {
	    if(obj.hasOwnProperty(c)) {
		ret += self.getPartType(id).toLDRColored(self, c);
	    }
	}
    }

    return ret;
}

THREE.LDRPartType.prototype.toLDRColored = function(loader, c) {
    let ret = '0 FILE ' + c + '__' + this.ID + '\r\n';
    if(this.modelDescription) {
        ret += '0 ' + this.modelDescription + '\r\n';
    }
    if(this.name) {
	ret += '0 Name: ' + this.name + '\r\n';
    }
    if(this.author) {
        ret += '0 Author: ' + this.author + '\r\n';
    }
    if(this.ldraw_org) {
        ret += '0 !LDRAW_ORG ' + this.ldraw_org + '\r\n';
    }
    if(this.license) {
        ret += '0 !LICENSE ' + this.license + '\r\n';
    }
    if(this.isPart) { // BFC Statement:
        if(!this.certifiedBFC) {
            ret += '0 BFC NOCERTIFY\r\n';            
        }
        else {
            ret += '0 BFC CERTIFY ' + (this.CCW ? 'CCW' : 'CW') + '\r\n';
        }
    }
    if(this.headerLines.length > 0) {
        ret += '\r\n'; // Empty line before additional header lines, such as 'THEME' and 'KEYWORDS'
        this.headerLines.forEach(line => ret += line.toLDR(loader));
    }
    if(this.hasOwnProperty('preferredColor')) {
        ret += '\r\n0 !CMDLINE -c' + this.preferredColor + '\r\n';
    }
    if(this.historyLines.length > 0) {
        ret += '\r\n';
        this.historyLines.forEach(hl => ret += '0 !HISTORY ' + hl + '\r\n');
    }
    if(this.steps.length > 0) {
        ret += '\r\n';
        this.steps.forEach((step, idx, a) => ret += step.toLDRColored(loader, idx === 0 ? null : a[idx-1].r, idx === a.length-1, c));
    }
    ret += '\r\n';
    return ret;
}

THREE.LDRPartDescription.prototype.toLDRColored = function(loader, c) {
    let pt = loader.getPartType(this.ID);
    let c2 = this.c == 16 ? c : this.c;
    let id = pt.isPart ? pt.ID : c2 + '__' + this.ID;
    return '1 ' + c2 + ' ' + this.p.toLDR() + ' ' + this.r.toLDR() + ' ' + id + '\r\n';
}

THREE.LDRStep.prototype.toLDRColored = function(loader, prevStepRotation, isLastStep, c) {
    let ret = '';

    function handle(line) {
	if(line.line1) {
            ret += line.toLDRColored(loader, c);
	}
	else {
            ret += line.toLDR(loader);
	}
    }
    this.subModels.forEach(handle);
    this.triangles.forEach(handle);
    this.quads.forEach(handle);

    // End with STEP or ROTSTEP:
    if(!this.r) {
        if(prevStepRotation) {
            ret += '0 ROTSTEP END\r\n';
        }
        else if(!isLastStep) {
            ret += '0 STEP\r\n';
        }
    }
    else { // We have a rotation. Check against prev:
        if(THREE.LDRStepRotation.equals(this.r, prevStepRotation)) {
            ret += '0 STEP\r\n';            
        }
        else {
            ret += this.r.toLDR();
        }
    }
    return ret;
}

THREE.LDRPartType.prototype.toStudioFile = function(ldrLoader) {
    if(!this.isPart) {
	throw 'The part type ' + this.ID + ' cannot be converted to a Studio 2.0 file since it is not a part';
    }
    // We now know there is exactly 1 step:
    let step = this.steps[0];

    // Find all textured triangles:
    let tt = []; // Textured triangles
    let tmp;
    step.triangles.filter(x => x.tmp).forEach(x => {
	tmp = x.tmp.file;
        tt.push(x);
    });
    step.quads.filter(x => x.tmp).forEach(x => {
	tmp = x.tmp.file;
        tt.push({c:x.c, p1:x.p1, p2:x.p2, p3:x.p3, texmapPlacement:x.tmp});
        tt.push({c:x.c, p1:x.p1, p2:x.p3, p3:x.p4, texmapPlacement:x.tmp});
    });

    // Find dataurl:
    let dataurl = ldrLoader.texmapDataurls.find(obj => obj.id === tmp);

    let ret = '';
    if(dataurl) {
	ret = '0 FILE ' + this.ID + '\r\n';
    }
    ret += '0 ' + (this.modelDescription ? this.modelDescription : '') +
	'\r\n0 Name: ' + this.ID +
	'\r\n0 Author: ' + (this.author ? this.author : '') + 
	'\r\n0 !LICENSE ' + (this.license ? this.license : '') + 
	'\r\n0 BFC ' + (this.certifiedBFC?'':'NO') + 'CERTIFY ' + (this.CCW ? '' : 'CW') + 
        '\r\n';

    if(dataurl) {
	ret += '0 PE_TEX_PATH -1\r\n0 PE_TEX_INFO ' + dataurl.content + '\r\n';
    }

    step.subModels.forEach(x => ret += x.toLDR(ldrLoader));
    step.lines.forEach(x => ret += new LDR.Line2(x.c, x.p1, x.p2).toLDR());
    step.conditionalLines.forEach(x => ret += new LDR.Line5(x.c, x.p1, x.p2, x.p3, x.p4).toLDR());

    // Convert all texture triangles:
    tt.forEach(x => { // Studio 2.0 triangle lines:
        ret += '3 ' + x.c + ' ' + x.p1.toLDR() + ' ' + x.p2.toLDR() + ' ' + x.p3.toLDR();
        let [U1, V1]=x.tmp.getUV(x.p1, x.p2, x.p3);
        let [U2, V2]=x.tmp.getUV(x.p2, x.p3, x.p1);
        let [U3, V3]=x.tmp.getUV(x.p3, x.p1, x.p2);
        [U1,V1,U2,V2,U3,V3].map(LDR.convertFloat).forEach(x => ret += ' ' + x);
        ret += '\r\n';
    });

    step.triangles.filter(x => !x.tmp).forEach(x => {
        ret += new LDR.Line3(x.c, x.p1, x.p2, x.p3).toLDR();
    });
    step.quads.filter(x => !x.tmp).forEach(x => {
        ret += new LDR.Line4(x.c, x.p1, x.p2, x.p3, x.p4).toLDR();
        });

    return ret;
}
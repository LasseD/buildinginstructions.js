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
    if(step.quads.length > 0 || step.triangles.length === 0) {
	return; // Quads not supported.
    }

    // Fix positioning issue:
    // Studio 2.0 custom LDraw parts are misaligned when they contain a single sub part!
    if(step.subModels.length === 1 && step.triangles.length > 0 && step.lines.length === 0) {
	let sm = step.subModels[0];
    
	let misalignment = sm.position;
	step.triangles.forEach(t => {t.p1.sub(misalignment); t.p2.sub(misalignment); t.p3.sub(misalignment);});

        let tmps = {};
        step.triangles.forEach(t => tmps[t.texmapPlacement.idx] = t.texmapPlacement);
        for(let idx in tmps) {
            if(!tmps.hasOwnProperty(idx)) {
                continue;
            }
            let tmp = tmps[idx];
            tmp.p.forEach(p => p.sub(misalignment));
            tmp.setPlanar();
        }

        // Finally set the position of the single sub model:
	sm.position.set(0, 0, 0);
    }

    // Set up dataurl:
    let pid = pt.ID + '.png';
    let dataurl = 'data:image/png;base64,' + pt.studioTexmap;
    loader.texmapDataurls.push({id:pid, mimetype:'png', content:pt.studioTexmap});

    loader.texmaps[pid] = true;
    loader.texmapListeners[pid] = [];
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

    delete pt.studioTexmap;
}

/*
  Create texmap placement by finding (0,0), (0,1), and (1,0) in UV space:
  g=(UV2-UV1), h=(UV3-UV2), i=gu/gv
  (0,0) = UV1 + ag + bh
  (1,0) = UV1 + cg + dh
  (0,1) = UV1 + eg + fh
*/
LDR.STUDIO.handleTriangleLine = function(pt, parts) {
    let U  = parseFloat(parts[11]), V = 1-parseFloat(parts[12]);
    let U2 = parseFloat(parts[13]), V2 = 1-parseFloat(parts[14]);
    let U3 = parseFloat(parts[15]), V3 = 1-parseFloat(parts[16]);
    let gu = U2-U, gv = V2-V;
    let hu = U3-U, hv = V3-V;

    let a, b, c, d, e, f;
    let isZero = x => -1e-7 <= x && x <= 1e-7;
    if(isZero(gv)) {
        console.log('gv=0');
        /*
          0 = U + agu + bhu, 0 = V + bhv =>
          b = -V / hv
          a = (-U - bhu) / gu
          1 = U + cgu + dhu, 0 = V + dhv =>
          d = b
          c = (1-U-dhu) / gu
          0 = U + egu + fhu, 1 = V + fhv =>
          f = (1-V) / hv
          e = -U / gu
         */
        b = d = -V / hv;
        a = (-U - b*hu) / gu;
        c = (1-U-d*hu) / gu;
        f = (1-V) / hv;
        e = -U / gu;
    }
    else {
        let i = gu / gv; // Well-defined as gv != 0

        /*
          0 = U + agu + bhu, 0 = i(V + agv + bhv) =>
          0 = U-i*V + bhu-i*bhv => 
          -U+i*V = b(hu-i*hv) =>
          b = (-U+i*V) / (hu-i*hv)
          a = (-bhv-V) / gv
        */
        b = (-U + i*V) / (hu - i*hv);
        a = (-b*hv - V) / gv;
        /*
          1 = U + cgu + dhu & 0 = i(V + cgv + dhv) =>
          1 = U-iV + d(hu-ihv) =>
          d = (1-U+iV) / (hu-ihv)
          0 = V + cgv + dhv => c = (-V-dhv) / gv
        */
        d = (1 - U + i*V) / (hu - i*hv);
        c = (-V - d*hv) / gv;
        /*
          0 = U + egu + fhu & 1 = V + egv + fhv =>
          -i = U-iV + f(hu-ihv) =>
          f = (-i-U+iV) / (hu-ihv)
          e = (1-V-fhv) / gv
        */
        f = (-i - U + i*V) / (hu - i*hv);
        e = (1 - V - f*hv) / gv;
    }
    
    // Now move to local space (above is all in UV space):
    let p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
    let p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
    let p3 = new THREE.Vector3(parseFloat(parts[8]), parseFloat(parts[9]), parseFloat(parts[10]));
    let PG = new THREE.Vector3(); PG.subVectors(p2, p1);
    let PH = new THREE.Vector3(); PH.subVectors(p3, p1);
    let P1 = new THREE.Vector3(p1.x + a*PG.x + b*PH.x, p1.y + a*PG.y + b*PH.y, p1.z + a*PG.z + b*PH.z);
    let P2 = new THREE.Vector3(p1.x + c*PG.x + d*PH.x, p1.y + c*PG.y + d*PH.y, p1.z + c*PG.z + d*PH.z);
    let P3 = new THREE.Vector3(p1.x + e*PG.x + f*PH.x, p1.y + e*PG.y + f*PH.y, p1.z + e*PG.z + f*PH.z);

    // See if we can reuse the previous TMP:
    if(LDR.TexmapPlacements.length > 0) {
        let lastTmp = LDR.TexmapPlacements[LDR.TexmapPlacements.length-1];
        let lastP1 = lastTmp.p[0], lastP2 = lastTmp.p[1], lastP3 = lastTmp.p[2];
        let eq = (a,b) => isZero(a.x-b.x) && isZero(a.y-b.y) && isZero(a.z-b.z);
        if(eq(P1, lastP1) && eq(P2, lastP2) && eq(P3, lastP3)) {
            lastTmp.used = false;
            return lastTmp;
        }
    }

    // Construct TMP:
    let tmp = new LDR.TexmapPlacement();
    tmp.nextOnly = true;
    tmp.p = [P1, P2, P3];
    tmp.setPlanar();
    tmp.file = pt.ID + '.png';
    tmp.idx = LDR.TexmapPlacements.length;
    LDR.TexmapPlacements.push(tmp);
    return tmp;
}

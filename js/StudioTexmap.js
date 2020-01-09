'use strict';

LDR.STUDIO = {};

LDR.STUDIO.handleLine = function(part, parts) {
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
    if(!step.subModels.length === 1 || step.quads.length > 0 || step.triangles.length === 0) {
	return; // Only a single sub model, no quads and some triangles supported.
    }

    // Fix the y-positioning issue: All Custom LDraw parts seem to be placed too high:
    if(step.subModels.length === 1) {
	let sm = step.subModels[0];
    
	let misalignment = sm.position;
	step.triangles.forEach(t => {t.p1.sub(misalignment); t.p2.sub(misalignment); t.p3.sub(misalignment);});
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

    // Set up points based on primitives:
    function getSize(triangles) {
	let b = new THREE.Box3();
	function expand(t) {
	    b.expandByPoint(t.p1);
	    b.expandByPoint(t.p2);
	    b.expandByPoint(t.p3);
	}
	triangles.forEach(expand);
	let c = new THREE.Vector3(); b.getCenter(c);
	let size = new THREE.Vector3(); b.getSize(size);
	size.multiplyScalar(0.555); // This hack seems necessary, as Part Designer creates a transparent border on inlined textures.
	return [c, size];
    }
    let [c, size] = getSize(step.triangles);

    if(step.triangles.length === 4 && step.subModels.find(sm => sm.ID === 's/3678bs01.dat')) { // Dual-texture for 'Slope Brick 65 2 x 2 x 2':
	[c, size] = getSize([step.triangles[0], step.triangles[1]]);
	let x1 = c.x-size.x*1.085, x2 = c.x+2.95*size.x;
	// Slope side:
	let p1 = new THREE.Vector3(x1, c.y-size.y, c.z);
	let p2 = new THREE.Vector3(x2, c.y-size.y, c.z);
	let p3 = new THREE.Vector3(x1, c.y+size.y, c.z);
	LDR.STUDIO.buildPlanarTmp(p1, p2, p3, [step.triangles[0], step.triangles[1]], pid);

	// Flat side:
	[c, size] = getSize([step.triangles[2], step.triangles[3]]);
	x1 = c.x-size.x*1.085; x2 = c.x+2.95*size.x;
	p1 = new THREE.Vector3(x2, c.y-size.y, c.z);
	p2 = new THREE.Vector3(x1, c.y-size.y, c.z);
	p3 = new THREE.Vector3(x2, c.y+size.y, c.z);
	LDR.STUDIO.buildPlanarTmp(p1, p2, p3, [step.triangles[2], step.triangles[3]], pid);
    }
    else if(step.triangles.length === 4 && step.subModels.find(sm => sm.ID === 's/3001s01.dat')) { // Dual-texture for 'Brick 2 x 4':
	let y1 = c.y-size.y*1.085, y2 = c.y+2.95*size.y;
	// Slope side:
	let p1 = new THREE.Vector3(c.x-size.x, y1, c.z);
	let p2 = new THREE.Vector3(c.x+size.x, y1, c.z);
	let p3 = new THREE.Vector3(c.x-size.x, y2, c.z);
	LDR.STUDIO.buildPlanarTmp(p1, p2, p3, [step.triangles[0], step.triangles[1]], pid);

	// Flat side:
	y2 = c.y+size.y*1.085, y1 = c.y-2.95*size.y;
	p1 = new THREE.Vector3(c.x+size.x, y1, c.z);
	p2 = new THREE.Vector3(c.x-size.x, y1, c.z);
	p3 = new THREE.Vector3(c.x+size.x, y2, c.z);
	LDR.STUDIO.buildPlanarTmp(p1, p2, p3, [step.triangles[2], step.triangles[3]], pid);
    }
    else if(step.triangles.length > 1000 && step.subModels.find(sm => sm.ID === 's/3626texpole.dat')) { // Minifig
	LDR.STUDIO.handleMinifig(step, pid);
    }
    else if(2*size.y < size.x && 2*size.y < size.z) { // Decorate top:
	let p1 = new THREE.Vector3(c.x-size.x, c.y, c.z+size.z);
	let p2 = new THREE.Vector3(c.x+size.x, c.y, c.z+size.z);
	let p3 = new THREE.Vector3(c.x-size.x, c.y, c.z-size.z);
	LDR.STUDIO.buildPlanarTmp(p1, p2, p3, step.triangles, pid);
    }
    else { // Decorate sides:
	let p1 = new THREE.Vector3(c.x-size.x, c.y-size.y, c.z);
	let p2 = new THREE.Vector3(c.x+size.x, c.y-size.y, c.z);
	let p3 = new THREE.Vector3(c.x-size.x, c.y+size.y, c.z);	
	LDR.STUDIO.buildPlanarTmp(p1, p2, p3, step.triangles, pid);
    }

    delete pt.studioTexmap;
}

LDR.STUDIO.handleMinifig = function(step, pid) {
    const triangles = step.triangles;

    let idx = 0;
    let getTriangles = num => triangles.slice(idx, idx+=num);

    // Front on hips:
    let frontHipTriangles = getTriangles(32);
    //LDR.STUDIO.buildPlanarTmp(p1, p2, p3, frontHipTriangles, pid);
}

LDR.STUDIO.buildPlanarTmp = function(p1, p2, p3, triangles, pid) {
    let tmp = new LDR.TexmapPlacement();
    tmp.type = 0; // Always planar.
    tmp.file = pid;

    tmp.p = [p1, p2, p3];
    console.dir(tmp.p);
    // Compute tmp.p from first triangle:
    let t = triangles[0];
    
    
    triangles.forEach(t => t.texmapPlacement=tmp);
    
    tmp.setPlanar();
    tmp.idx = LDR.TexmapPlacements.length;
    LDR.TexmapPlacements.push(tmp);
    
    return tmp;
}

// Overwriting how triangles are handled:
LDR.STUDIO.handleTriangleLine = function(parts) {
    LDR.STUDIO.U1 = parseFloat(parts[11]);
    LDR.STUDIO.V1 = parseFloat(parts[12]);
    LDR.STUDIO.U2 = parseFloat(parts[13]);
    LDR.STUDIO.V2 = parseFloat(parts[14]);
    LDR.STUDIO.U3 = parseFloat(parts[15]);
    LDR.STUDIO.V3 = parseFloat(parts[16]);
}
THREE.LDRStep.prototype.addTrianglePoints = function(c, p1, p2, p3, cull, texmapPlacement) {
    this.hasPrimitives = true;
    let uv1 = {u:LDR.STUDIO.U1, v:LDR.STUDIO.V1};
    let uv2 = {u:LDR.STUDIO.U2, v:LDR.STUDIO.V2};
    let uv3 = {u:LDR.STUDIO.U3, v:LDR.STUDIO.V3};
    this.triangles.push({colorID:c, p1:p1, p2:p2, p3:p3, uv1:uv1, uv2:uv2, uv3:uv3, cull:cull, texmapPlacement:texmapPlacement});
    texmapPlacement && texmapPlacement.use();
}

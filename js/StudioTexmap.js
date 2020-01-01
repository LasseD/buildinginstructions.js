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
    };
    image.src = dataurl;

    // Set up texmap placements:
    function buildTmp(p1, p2, p3, primitives) {
	let tmp = new LDR.TexmapPlacement();
	tmp.type = 0; // Always planar.
	tmp.file = pid;
	tmp.p = [p1, p2, p3];

	primitives.forEach(prim => prim.texmapPlacement=tmp);

	tmp.setPlanar();
	tmp.idx = LDR.TexmapPlacements.length;
	LDR.TexmapPlacements.push(tmp);

	return tmp;
    }

    // Set up points based on primitives:
    let step = pt.steps[0];

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
	buildTmp(p1, p2, p3, [step.triangles[0], step.triangles[1]]);

	// Flat side:
	[c, size] = getSize([step.triangles[2], step.triangles[3]]);
	x1 = c.x-size.x*1.085; x2 = c.x+2.95*size.x;
	p1 = new THREE.Vector3(x2, c.y-size.y, c.z);
	p2 = new THREE.Vector3(x1, c.y-size.y, c.z);
	p3 = new THREE.Vector3(x2, c.y+size.y, c.z);
	buildTmp(p1, p2, p3, [step.triangles[2], step.triangles[3]]);
    }
    else if(step.triangles.length === 4 && step.subModels.find(sm => sm.ID === 's/3001s01.dat')) { // Dual-texture for 'Brick 2 x 4':
	let y1 = c.y-size.y*1.085, y2 = c.y+2.95*size.y;
	// Slope side:
	let p1 = new THREE.Vector3(c.x-size.x, y1, c.z);
	let p2 = new THREE.Vector3(c.x+size.x, y1, c.z);
	let p3 = new THREE.Vector3(c.x-size.x, y2, c.z);
	buildTmp(p1, p2, p3, [step.triangles[0], step.triangles[1]]);

	// Flat side:
	y2 = c.y+size.y*1.085, y1 = c.y-2.95*size.y;
	p1 = new THREE.Vector3(c.x+size.x, y1, c.z);
	p2 = new THREE.Vector3(c.x-size.x, y1, c.z);
	p3 = new THREE.Vector3(c.x+size.x, y2, c.z);
	buildTmp(p1, p2, p3, [step.triangles[2], step.triangles[3]]);
    }
    else if(2*size.y < size.x && 2*size.y < size.z) { // Decorate top:
	let p1 = new THREE.Vector3(c.x-size.x, c.y, c.z+size.z);
	let p2 = new THREE.Vector3(c.x+size.x, c.y, c.z+size.z);
	let p3 = new THREE.Vector3(c.x-size.x, c.y, c.z-size.z);
	buildTmp(p1, p2, p3, step.triangles);
    }
    else { // Decorate sides:
	let p1 = new THREE.Vector3(c.x-size.x, c.y-size.y, c.z);
	let p2 = new THREE.Vector3(c.x+size.x, c.y-size.y, c.z);
	let p3 = new THREE.Vector3(c.x-size.x, c.y+size.y, c.z);
	buildTmp(p1, p2, p3, step.triangles);
    }

    delete pt.studioTexmap;
}
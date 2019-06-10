'use strict';

LDR = LDR || {};

LDR.PLIBuilder = function(loader, canEdit, mainModelID, mainModelColor, pliElement, pliRenderElement) {
    this.loader = loader;
    this.canEdit = canEdit;
    this.pliElement = pliElement;
    this.pliRenderElement = pliRenderElement;
    //this.partsBuilder = new LDR.PartsBuilder(loader, mainModelID, mainModelColor);
    this.fillHeight = false;
    this.groupParts = true;
    this.clickMap;

    // Register for options changes:
    let self = this;
    ldrOptions.listeners.push(function() {
	if(self.lastStep) {
	    self.drawPLIForStep(self.fillHeight, self.lastStep,
				self.lastMaxWidth, self.lastMaxHeight, 0, true);
	}
    });

    // Set up rendering elements:
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000000);
    this.camera.position.set(10000, 7000, 10000);
    this.camera.lookAt(new THREE.Vector3());
    this.measurer = new LDR.Measurer(this.camera);

    this.scene = new THREE.Scene(); // Will only contain one element at a time.
    this.scene.background = new THREE.Color(0xFFFFFF);

    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.renderer.setPixelRatio(window.devicePixelRatio);
    pliRenderElement.appendChild(this.renderer.domElement);
}

LDR.PLIBuilder.prototype.getPartType = function(id) {
    let pt = this.loader.partTypes[id];
    if(!pt.mesh) { // Ensure size is computed.
	pt.mesh = new THREE.Group();

        // Set up mesh collector:
	pt.pliMC = new LDR.MeshCollector(pt.mesh, pt.mesh);
	let p = new THREE.Vector3();
	let r = new THREE.Matrix3(); r.set(1,0,0, 0,-1,0, 0,0,-1);
	pt.generateThreePart(this.loader, 40, p, r, true, false, pt.pliMC); // Color 40 ensures transparent parts work.

        // Draw to ensure bounding box:
        pt.pliMC.draw(false);
	let elementCenter = new THREE.Vector3();
	let b = pt.pliMC.boundingBox;
	b.getCenter(elementCenter);
	pt.mesh.position.sub(elementCenter);
	let [dx,dy] = this.measurer.measure(b, pt.mesh.matrixWorld);
	pt.dx = dx;
	pt.dy = dy;
    }
    return pt;
}

LDR.PLIBuilder.prototype.updateCamera = function(w, h) {
    this.camera.left = -w*0.51;
    this.camera.right = w*0.51;
    this.camera.top = h*0.51;
    this.camera.bottom = -h*0.51;
    this.camera.updateProjectionMatrix();
}

 LDR.PLIBuilder.prototype.renderIcon = function(partID, colorID, w, h) {
    let pt = this.getPartType(partID);

    pt.pliMC.overwriteColor(colorID);
    pt.pliMC.draw(false);

    this.scene.add(pt.mesh);
    this.renderer.setSize(w+1, h+1); // +1 to ensure edges are in frame in case of rounding down.
    this.updateCamera(pt.dx, pt.dy);
    this.renderer.render(this.scene, this.camera);
    this.scene.remove(pt.mesh);
}

LDR.PLIBuilder.prototype.createClickMap = function(step) {
    let icons = {}; // key -> {key, partID, colorID, mult, desc}, key='part_id'_'color_id'
    this.clickMap = [];
    for(let i = 0; i < step.subModels.length; i++) {
	let dat = step.subModels[i];
        if(!this.loader.partTypes[dat.ID].isPart()) {
            continue; // Do not show sub models.
        }
	let partID = dat.ID;
	let colorID = dat.colorID;
	let key = partID.endsWith('.dat') ? partID.substring(0, partID.length-4) : partID;
	let pliID = 'pli_' + key;
	key += '_' + colorID;

	let icon = icons[key];
        if(this.groupParts && icon) {
            icon.mult++;
	}
	else {
	    let pt = this.getPartType(partID);
	    let b = pt.pliMC.boundingBox;
	    icon = {key: key,
		    partID: partID,
		    colorID: colorID,
                    mult: 1,
		    desc: pt.modelDescription,
		    annotation: LDR.Annotations ? LDR.Annotations[pliID] : null,
		    dx: pt.dx,
		    dy: pt.dy,
		    size: b.min.distanceTo(b.max),
		    inlined: pt.inlined,
                    part: dat, // Used by editor.
		   };
	    icons[key] = icon;
	    this.clickMap.push(icon);
	}
    }

    let sorter = function(a, b) {
	let ca = a.desc;
	let cb = b.desc;
	if(ca !== cb) {
	    return ca < cb ? -1 : 1;
	}
	return a.colorID - b.colorID;
    }
    this.clickMap.sort(sorter);
}

LDR.PLIBuilder.prototype.drawPLIForStep = function(fillHeight, step, maxWidth, maxHeight, maxSizePerPixel, force) {
    let groupParts = !(this.canEdit && ldrOptions.showEditor);
    // Ensure no re-draw if not necessary:
    if(!force && 
       this.lastStep && this.lastStep.idx === step.idx && this.groupParts === groupParts &&
       this.lastMaxWidth === maxWidth && this.lastMaxHeight === maxHeight &&
       this.fillHeight === fillHeight) {
	return;
    }
    this.groupParts = groupParts;
    this.fillHeight = fillHeight;
    this.lastStep = step;
    this.lastMaxWidth = maxWidth;
    this.lastMaxHeight = maxHeight;

    // Find, sort and set up icons to show:
    this.createClickMap(step);
    let [W,H] = Algorithm.PackRectangles(fillHeight, maxWidth, maxHeight, this.clickMap, maxSizePerPixel); // Previously max size window.innerWidth/5
    this.pliElement.width = (12+W)*window.devicePixelRatio;
    this.pliElement.height = (28+H)*window.devicePixelRatio;
    this.pliElement.style.width = (W+12)+"px";
    this.pliElement.style.height = (H+21)+"px";

    let context = this.pliElement.getContext('2d');

    context.font = parseInt(25*window.devicePixelRatio) + "px sans-serif";
    context.fillStyle = "black";
    let scaleDown = 0.95; // To make icons not fill out the complete allocated cells.
    let self = this;
    let delay = function() {
	context.clearRect(0, 0, self.pliElement.width, self.pliElement.height);
	// Draw icon:
	for(let i = 0; i < self.clickMap.length; i++) {
	    let icon = self.clickMap[i];
	    let w = parseInt(icon.width*scaleDown);
	    let h = parseInt(icon.height*scaleDown);
            self.renderIcon(icon.partID, icon.colorID, w, h);
	    context.drawImage(self.renderer.domElement, (icon.x+8)*window.devicePixelRatio, (icon.y+5)*window.devicePixelRatio);
	}
	// Draw multipliers:
	context.fillStyle = "#000";
	context.lineWidth = "1";
	context.font = parseInt(18*window.devicePixelRatio) + "px Lucida Console";
        if(self.groupParts) {
            self.clickMap.forEach(icon => context.fillText(icon.mult + "x", (icon.x + 5)*window.devicePixelRatio,
                                                           (icon.y+icon.height+24)*window.devicePixelRatio));
        }
	// Draw Annotation:
	for(let i = 0; i < self.clickMap.length; i++) {
	    let icon = self.clickMap[i];
	    if(!icon.annotation) {
		continue;
            }
	    let len = icon.annotation.length;
	    let x = (icon.x + icon.width - len*10 - 9)*window.devicePixelRatio;
	    let y = (icon.y + icon.height + 4)*window.devicePixelRatio;
	    let w = (len*10 + 9)*window.devicePixelRatio;
	    let h = 19*window.devicePixelRatio;
	    context.beginPath();
	    context.fillStyle = "#CFF";
	    if(icon.desc.startsWith('Technic Axle')) {
		context.arc(x+w*0.45, y+h*0.5, w/2, 0, 2*Math.PI, false);
            }
	    else {
		context.rect(x, y, w, h);
            }
	    context.fill();
	    context.stroke();
	    context.fillStyle = "#25E";
	    x += 3.5*window.devicePixelRatio;
	    y += 16*window.devicePixelRatio;
	    context.fillText(icon.annotation, x, y);
	}
        // Draw highlight:
        if(ldrOptions.showEditor) {
            self.clickMap.forEach(icon => {
                    if(!icon.part.original.ghost) {
                        return; // Do not draw highlight.
                    }
                    const x = parseInt((icon.x+8)*window.devicePixelRatio);
                    const y = parseInt((icon.y+5)*window.devicePixelRatio);
                    const w = parseInt((icon.width)*window.devicePixelRatio);
                    const h = parseInt((icon.height)*window.devicePixelRatio);
                    context.strokeStyle = "#5DD";
                    context.lineWidth = '4';
                    context.strokeRect(x, y, w, h);
                });
        }
    }
    setTimeout(delay, 10); // Ensure not blocking
}

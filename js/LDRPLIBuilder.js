'use strict';

LDR = LDR || {};

LDR.PLIBuilder = function(loader, canEdit, mainModelID, pliElement, pliRenderElement) {
    this.loader = loader;
    this.canEdit = canEdit;
    this.pliElement = pliElement;
    this.pliRenderElement = pliRenderElement;
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

    this.renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
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
        b.translate(elementCenter.negate()); // TODO: RM
	let [width,height,linesBelow,linesAbove] = this.measurer.measureConvexHull(b, pt.mesh.matrixWorld);
	pt.dx = width;
	pt.dy = height;
        pt.linesBelow = linesBelow;
        pt.linesAbove = linesAbove;
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
    //var helper = new THREE.Box3Helper(pt.pliMC.boundingBox, 0xFF0000);
    //this.scene.add(helper);

    this.renderer.setSize(w+1, h+1); // +1 to ensure edges are in frame in case of rounding down.
    this.updateCamera(pt.dx, pt.dy);
    this.renderer.render(this.scene, this.camera);
    this.scene.remove(pt.mesh);
    //this.scene.remove(helper);
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
                    linesBelow: pt.linesBelow,
                    linesAbove: pt.linesAbove,
		    size: b.min.distanceTo(b.max),
		    inlined: pt.inlined,
                    part: dat, // Used by editor.
		   };
	    icons[key] = icon;
	    this.clickMap.push(icon);
	}
    }

    let sorter = function(a, b) {
        if(a.dx != b.dx) {
            return a.dx < b.dx ? -1 : 1; // Sort by width.
        }

	let ca = a.desc;
	let cb = b.desc;
	if(ca !== cb) {
	    return ca < cb ? -1 : 1; // Group plates, bricks, etc. (Only works well when not also sorting by width above)
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
    let textHeight = (!fillHeight ? maxHeight : maxWidth) / Math.sqrt(this.clickMap.length) * 0.19;
    let [W,H] = Algorithm.PackPlis(fillHeight, maxWidth, maxHeight, this.clickMap, textHeight);
    const DPR = window.devicePixelRatio;
    this.pliElement.width = (12+W)*DPR;
    this.pliElement.height = (12+H)*DPR;
    this.pliElement.style.width = (W+12)+"px";
    this.pliElement.style.height = (H+12)+"px";

    let context = this.pliElement.getContext('2d');

    const scaleDown = 0.98; // To make icons not fill out the complete allocated cells.
    let self = this;
    let delay = function() {
	context.clearRect(0, 0, self.pliElement.width, self.pliElement.height);
        context.translate(6, 6);
	// Draw icon:
	for(let i = 0; i < self.clickMap.length; i++) {
	    let icon = self.clickMap[i];
            let x = icon.x*DPR;
            let y = icon.y*DPR;
	    let w = parseInt(icon.DX*scaleDown);
	    let h = parseInt(icon.DY*scaleDown);
            self.renderIcon(icon.partID, icon.colorID, w, h);
	    context.drawImage(self.renderer.domElement, x, y);

            // Code below is to highlight PLI boundary lines:
            /*let W = icon.DX*DPR, H = icon.DY*DPR;
            context.lineWidth = "3";
            let highlight = function(line) {
                line.scaleY(DPR);
                context.moveTo(x, y + line.eval(0));
                context.lineTo(x+W, y + line.eval(W));
            }
            context.strokeStyle = "blue";
            icon.LINES_ABOVE.forEach(highlight);
            icon.LINES_BELOW.forEach(highlight);
            context.stroke();*/
	}
	// Draw multipliers:
	context.fillStyle = "#000";
	context.lineWidth = "1";
        if(self.groupParts) {
            context.font = parseInt(textHeight*1.1*DPR) + "px sans-serif";
            context.fillStyle = "black";
            function drawMultiplier(icon) {
                let x = icon.x * DPR;
                let y = (icon.y + icon.MULT_Y) * DPR;
                let w = icon.MULT_DX * DPR;
                let h = textHeight * DPR;
                //context.beginPath(); context.rect(x, y, w, h); context.stroke();
                context.fillText(icon.mult + "x", x, y + h*0.9); // *0.9 to move a bit up from lower line.
            }
            self.clickMap.forEach(drawMultiplier);
        }
	// Draw Annotation:
	context.font = parseInt(textHeight*0.9*DPR) + "px monospace";
        self.clickMap.filter(icon => icon.annotation).forEach(icon => {
	    let len = icon.annotation.length;
	    let x = (icon.x+icon.FULL_DX+1)*DPR;
	    let y = (icon.y+icon.ANNO_Y)*DPR;
	    let w = (len*textHeight*0.54)*DPR;
	    let h = textHeight*DPR;
	    context.beginPath();
	    context.fillStyle = "#CFF";
	    if(icon.desc.startsWith('Technic Axle')) {
		context.arc(x+w*0.5, y+h*0.5, w*0.55, 0, 2*Math.PI, false);
            }
	    else {
		context.rect(x, y, w, h);
            }
	    context.fill();
	    context.stroke();
	    context.fillStyle = "#25E";
	    y += textHeight*DPR*0.79;
	    context.fillText(icon.annotation, x, y);
        });
        // Draw highlight for ghosted parts:
        if(ldrOptions.showEditor) {
            self.clickMap.forEach(icon => {
                    if(!icon.part.original.ghost) {
                        return; // Do not draw highlight.
                    }
                    const x = parseInt((icon.x+8)*DPR);
                    const y = parseInt((icon.y+5)*DPR);
                    const w = parseInt((icon.DX)*DPR);
                    const h = parseInt((icon.DY)*DPR);
                    context.strokeStyle = "#5DD";
                    context.lineWidth = '4';
                    context.strokeRect(x, y, w, h);
                });
        }
    }
    setTimeout(delay, 10); // Ensure not blocking
}

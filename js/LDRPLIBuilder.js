'use strict';

LDR = LDR || {};

LDR.PLIBuilder = function(loader, mainModelID, mainModelColor, pliElement, pliRenderElement) {
    this.loader = loader;
    this.pliElement = pliElement;
    this.pliRenderElement = pliRenderElement;
    this.partsBuilder = new LDR.PartsBulder(loader, mainModelID, mainModelColor);
    this.fillHeight = false;
    this.groupParts = true;
    this.clickMap;

    // Register for options changes:
    let self = this;
    ldrOptions.listeners.push(function() {
	if(self.lastStep) {
	    self.drawPLIForStep(self.groupParts, self.fillHeight, self.lastStep, self.lastColorID,
				self.lastMaxWidth, self.lastMaxHeight, true);
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

LDR.PLIBuilder.prototype.getPC = function(key) {
    let pc = this.partsBuilder.pcs[key];
    if(!pc.mesh) {
	pc.mesh = new THREE.Group();
	pc.draw(pc.mesh);
	let elementCenter = new THREE.Vector3();
	let b = pc.getBounds();
	b.getCenter(elementCenter);
	pc.mesh.position.sub(elementCenter);
	let [dx,dy] = this.measurer.measure(b, pc.mesh.matrixWorld);
	pc.dx = dx;
	pc.dy = dy;
    }
    return pc;
}

LDR.PLIBuilder.prototype.updateCamera = function(w, h) {
    this.camera.left = -w*0.51;
    this.camera.right = w*0.51;
    this.camera.top = h*0.51;
    this.camera.bottom = -h*0.51;
    this.camera.updateProjectionMatrix();
}

LDR.PLIBuilder.prototype.render = function(key, w, h) {
    let pc = this.getPC(key);
    pc.meshCollector.draw(false);
    
    this.scene.add(pc.mesh);
    this.renderer.setSize(w+1, h+1); // +1 to ensure edges are in frame in case of rounding down.
    this.updateCamera(pc.dx, pc.dy);
    this.renderer.render(this.scene, this.camera);
    this.scene.remove(pc.mesh);
}

LDR.PLIBuilder.prototype.createClickMap = function(step, stepColorID) {
    let icons = {}; // key -> {key, partID, colorID, mult, desc}, key='part_id'_'color_id'
    this.clickMap = [];
    for(let i = 0; i < step.subModels.length; i++) {
	let dat = step.subModels[i];
        if(!this.loader.partTypes[dat.ID].isPart()) {
            continue; // Do not show sub models.
        }
	let partID = dat.ID;
	let colorID = dat.colorID == 16 ? stepColorID : dat.colorID;
	let key = partID.endsWith('.dat') ? partID.substring(0, partID.length-4) : partID;
	key += '_' + colorID;

	let icon = icons[key];
	if(!this.groupParts && icon) {
	    icon.mult++;
	}
	else {
	    let pc = this.getPC(key);
	    let b = pc.getBounds();
	    let type = this.loader.partTypes[partID];
	    icon = {key: key,
		    partID: partID, 
		    colorID: colorID, 
		    mult: 1, 
		    desc: type.modelDescription,
		    annotation: pc.annotation,
		    dx: pc.dx,
		    dy: pc.dy,
		    size: b.min.distanceTo(b.max),
		    inlined: pc.inlined,
                    part: dat, // Used by editor.
		   };
	    icons[key] = icon;
	    this.clickMap.push(icon);
	}
    }

    let sorter = function(a, b){
	let ca = a.desc;
	let cb = b.desc;
	if(ca != cb) {
	    return ca < cb ? -1 : 1;
	}
	let ia = a.colorID;
	let ib = b.colorID;
	return ia < ib ? -1 : (ib < ia ? 1 : 0);
    }
    this.clickMap.sort(sorter);
}

LDR.PLIBuilder.prototype.drawPLIForStep = function(fillHeight, step, colorID, maxWidth, maxHeight, maxSizePerPixel, force) {
    let groupParts = ldrOptions.showEditor;
    // Ensure no re-draw if not necessary:
    if(!force && 
       this.lastStep && this.lastStep.idx === step.idx && 
       this.lastColorID === colorID && this.lastGroupParts === groupParts &&
       this.lastMaxWidth === maxWidth && this.lastMaxHeight === maxHeight &&
       this.fillHeight === fillHeight) {
	return;
    }
    this.groupParts = groupParts;
    this.fillHeight = fillHeight;
    this.lastStep = step;
    this.lastColorID = colorID;
    this.lastMaxWidth = maxWidth;
    this.lastMaxHeight = maxHeight;

    // Find, sort and set up icons to show:
    this.createClickMap(step, colorID);
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
            self.render(icon.key, w, h);
	    context.drawImage(self.renderer.domElement, (icon.x+8)*window.devicePixelRatio, (icon.y+5)*window.devicePixelRatio);
	}
	// Draw multipliers:
	context.fillStyle = "#000";
        if(!self.groupParts) {
            self.clickMap.forEach(icon => context.fillText(icon.mult + "x", (icon.x + 5)*window.devicePixelRatio, 
                                                           (icon.y+icon.height+24)*window.devicePixelRatio));
        }
	// Draw Annotation:
	context.lineWidth = "1";
	context.font = parseInt(18*window.devicePixelRatio) + "px Lucida Console";
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
	    if(icon.desc.startsWith('Technic Axle'))
		context.arc(x+w*0.45, y+h*0.5, w/2, 0, 2*Math.PI, false);
	    else
		context.rect(x, y, w, h);
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
                    if(!icon.part.ghost) {
                        return; // Do not draw highlight.
                    }
                    const lineWidth = 8;
                    const x = parseInt(icon.x*window.devicePixelRatio+lineWidth);
                    const y = parseInt(icon.y*window.devicePixelRatio+lineWidth);
                    const w = parseInt(icon.width*window.devicePixelRatio-2*lineWidth);
                    const h = parseInt(icon.height*window.devicePixelRatio-2*lineWidth);
                    context.strokeStyle = "#5DD";
                    context.lineWidth = ''+lineWidth;
                    context.strokeRect(x, y, w, h);
                });
        }
    }
    setTimeout(delay, 10); // Ensure not blocking
}

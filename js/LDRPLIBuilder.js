'use strict';

LDR = LDR || {};

LDR.PLIBuilder = function(ldrLoader, mainModelID, mainModelColor, pliElement, pliRenderElement) {
    this.ldrLoader = ldrLoader;
    this.pliElement = pliElement;
    this.pliRenderElement = pliRenderElement;
    this.partsBuilder = new LDR.PartsBulder(ldrLoader, mainModelID, mainModelColor);
    this.fillHeight = false;

    // Register for options changes:
    var self = this;
    ldrOptions.listeners.push(function() {
	if(self.lastStep) {
	    self.drawPLIForStep(self.fillHeight, self.lastStep, self.lastColorID,
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
    var pc = this.partsBuilder.pcs[key];
    if(!pc.mesh) {
	pc.mesh = new THREE.Group();
	pc.draw(pc.mesh);
	var elementCenter = new THREE.Vector3();
	var b = pc.getBounds();
	b.getCenter(elementCenter);
	pc.mesh.position.sub(elementCenter);
	var [dx,dy] = this.measurer.measure(b, pc.mesh.matrixWorld);
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
    var pc = this.getPC(key);
    pc.meshCollector.draw(false);
    
    this.scene.add(pc.mesh);
    this.renderer.setSize(w+1, h+1); // +1 to ensure edges are in frame in case of rounding down.
    this.updateCamera(pc.dx, pc.dy);
    this.renderer.render(this.scene, this.camera);
    this.scene.remove(pc.mesh);
}

LDR.PLIBuilder.prototype.createSortedIcons = function(step, stepColorID) {
    var icons = {}; // key -> {key, partID, colorID, mult, desc}, key='part_id'_'color_id'
    var sortedIcons = [];
    for(var i = 0; i < step.dats.length; i++) {
	var dat = step.dats[i];
	var partID = dat.ID;
	var colorID = dat.colorID == 16 ? stepColorID : dat.colorID;
	var key = partID.endsWith('.dat') ? partID.substring(0, partID.length-4) : partID;
	key += '_' + colorID;
	var icon = icons[key];
	if(icon) {
	    icon.mult++;
	}
	else {
	    var pc = this.getPC(key);
	    var b = pc.getBounds();
	    var type = this.ldrLoader.ldrPartTypes[partID];
	    icon = {key: key,
		    partID: partID, 
		    colorID: colorID, 
		    mult: 1, 
		    desc: type.modelDescription,
		    annotation: pc.annotation,
		    dx: pc.dx,
		    dy: pc.dy,
		    size: b.min.distanceTo(b.max),
		    inlined: pc.inlined
		   };
	    icons[key] = icon;
	    sortedIcons.push(icon);
	}
    }
    var sorter = function(a, b){
	var ca = a.desc;
	var cb = b.desc;
	if(ca != cb) {
	    return ca < cb ? -1 : 1;
	}
	var ia = a.colorID;
	var ib = b.colorID;
	return ia < ib ? -1 : (ib < ia ? 1 : 0);
    }
    sortedIcons.sort(sorter);
    return sortedIcons;
}

LDR.PLIBuilder.prototype.drawPLIForStep = function(fillHeight, step, colorID, maxWidth, maxHeight, maxSizePerPixel, force) {
    if(!force && this.lastStep && 
       this.lastStep.idx === step.idx && 
       this.lastColorID === colorID &&
       this.lastMaxWidth == maxWidth && this.lastMaxHeight == maxHeight &&
       this.fillHeight == fillHeight) {
	return this.sortedIcons;
    }
    this.lastStep = step;
    this.lastColorID = colorID;
    this.lastMaxWidth = maxWidth;
    this.lastMaxHeight = maxHeight;
    this.fillHeight = fillHeight;

    // Find, sort and set up icons to show:
    this.sortedIcons = this.createSortedIcons(step, colorID);
    var [W,H] = Algorithm.PackRectangles(fillHeight, maxWidth, maxHeight, this.sortedIcons, maxSizePerPixel); // Previously max size window.innerWidth/5
    this.pliElement.width = (12+W)*window.devicePixelRatio;
    this.pliElement.height = (28+H)*window.devicePixelRatio;
    this.pliElement.style.width = (W+12)+"px";
    this.pliElement.style.height = (H+21)+"px";
    //console.log("Packed " + this.sortedIcons.length + ", W=" + W + ", H=" + H);

    var context = this.pliElement.getContext('2d');

    context.font = parseInt(25*window.devicePixelRatio) + "px sans-serif";
    context.fillStyle = "black";
    var scaleDown = 0.95; // To make icons not fill out the complete allocated cells.
    var self = this;
    function delay() {
	context.clearRect(0, 0, this.pliElement.width, this.pliElement.height);
	// Draw icon:
	for(var i = 0; i < self.sortedIcons.length; i++) {
	    var icon = self.sortedIcons[i];
	    var w = parseInt(icon.width*scaleDown);
	    var h = parseInt(icon.height*scaleDown);
            self.render(icon.key, w, h);
	    context.drawImage(self.renderer.domElement, (icon.x+8)*window.devicePixelRatio, (icon.y+5)*window.devicePixelRatio);
	}
	// Draw multiplier:
	context.fillStyle = "#000";
	for(var i = 0; i < self.sortedIcons.length; i++) {
	    var icon = self.sortedIcons[i];
	    context.fillText(icon.mult + "x", 
			     (icon.x + 5)*window.devicePixelRatio, (icon.y+icon.height+24)*window.devicePixelRatio);
	}
	// Draw Annotation:
	context.lineWidth = "1";
	context.font = parseInt(18*window.devicePixelRatio) + "px Lucida Console";
	for(var i = 0; i < self.sortedIcons.length; i++) {
	    var icon = self.sortedIcons[i];
	    if(!icon.annotation)
		continue;
	    var len = icon.annotation.length;
	    var x = (icon.x + icon.width - len*10 - 9)*window.devicePixelRatio;
	    var y = (icon.y + icon.height + 4)*window.devicePixelRatio;
	    var w = (len*10 + 9)*window.devicePixelRatio;
	    var h = 19*window.devicePixelRatio;
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
    }
    setTimeout(delay, 10); // Ensure not blocking
    return this.sortedIcons;
}

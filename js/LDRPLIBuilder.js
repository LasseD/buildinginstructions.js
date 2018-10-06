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
	self.partsBuilder.onOptionsChanged();
	if(self.lastStep) {
	    self.drawPLIForStep(self.fillHeight, self.lastStep, 
				self.lastMaxWidth, self.lastMaxHeight, true);
	}
    });

    // Set up rendering elements:
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000000);
    this.camera.position.x = 10000;
    this.camera.position.y = 15000;//7000;
    this.camera.position.z = 10000;
    this.camera.lookAt(new THREE.Vector3());

    this.scene = new THREE.Scene(); // Will only contain one element at a time.
    this.scene.background = new THREE.Color( 0xffffff );

    this.renderer = new THREE.WebGLRenderer({antialias: true});
    pliRenderElement.appendChild(this.renderer.domElement);
}

LDR.PLIBuilder.prototype.updateCamera = function(w, h, zoom) {
    this.camera.left = -w;
    this.camera.right = w;
    this.camera.top = h;
    this.camera.bottom = -h;
    this.camera.zoom = zoom;
    this.camera.updateProjectionMatrix();
}

LDR.PLIBuilder.prototype.render = function(key, w, h) {
    var pc = this.partsBuilder.pcs[key];
    var b;
    if(!pc.mesh) {
	pc.mesh = new THREE.Group();
	pc.draw(pc.mesh);
	b = pc.getBounds();
	var elementCenter = new THREE.Vector3();
	b.getCenter(elementCenter);
	pc.mesh.position.x = -elementCenter.x;
	pc.mesh.position.y = -elementCenter.y;
	pc.mesh.position.z = -elementCenter.z;
    }
    else {
	b = pc.getBounds();
    }
    
    this.scene.add(pc.mesh);
    
    var size = b.min.distanceTo(b.max) * 0.6;
    var zoom = Math.min(w, h) / size;
    this.renderer.setSize(w, h);
    this.updateCamera(w, h, zoom);
    this.renderer.render(this.scene, this.camera);
    pc.meshCollector.updateConditionalLines(this.camera);
    this.renderer.render(this.scene, this.camera);
    this.scene.remove(pc.mesh);
}

LDR.PLIBuilder.prototype.createSortedIcons = function(step) {
    var icons = {}; // key -> {key, partID, colorID, mult, desc}, key='part_id'_'color_id'
    var sortedIcons = [];
    for(var i = 0; i < step.dats.length; i++) {
	var dat = step.dats[i];
	var partID = dat.ID;
	var colorID = dat.colorID;
	var key = partID + '_' + colorID;
	var icon = icons[key];
	if(icon) {
	    icon.mult++;
	}
	else {
	    icon = {key: key, 
		    partID: partID, 
		    colorID: colorID, 
		    mult: 1, 
		    desc: this.ldrLoader.ldrPartTypes[partID].modelDescription
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

LDR.PLIBuilder.prototype.drawPLIForStep = function(fillHeight, step, maxWidth, maxHeight, force) {
    if(!force && this.lastStep && this.lastStep.idx === step.idx && 
       this.lastMaxWidth == maxWidth && this.lastMaxHeight == maxHeight &&
       this.fillHeight == fillHeight) {
	return;
    }
    this.lastStep = step;
    this.lastMaxWidth = maxWidth;
    this.lastMaxHeight = maxHeight;
    this.fillHeight = fillHeight;

    // Find, sort and set up icons to show:
    var sortedIcons = this.createSortedIcons(step);
    var [W,H] = Algorithm.PackSquares(fillHeight, maxWidth, maxHeight, sortedIcons, 200);
    var iconSize = sortedIcons[0].width;

    this.pliElement.width = W+4;
    this.pliElement.height = H+4;

    var context = this.pliElement.getContext('2d');

    var fontSize = parseInt(18*iconSize/100);
    context.font = fontSize + "px sans-serif";
    context.fillStyle = "black";
    context.clearRect(0, 0, this.pliElement.width, this.pliElement.height);
    var self = this;
    function delay() {
	for(var i = 0; i < sortedIcons.length; i++) {
	    var icon = sortedIcons[i];
            self.render(icon.key, iconSize, iconSize);
	    context.drawImage(self.renderer.domElement, 
			      icon.x, icon.y);
	}
	for(var i = 0; i < sortedIcons.length; i++) {
	    var icon = sortedIcons[i];
	    context.fillText(icon.mult + "x", 
			     icon.x + 2, (icon.y+iconSize) - 8);
	}
    }
    setTimeout(delay, 10); // Ensure not blocking
}

LDR.PLIBuilder = function(ldrLoader, mainModelID, mainModelColor, pliElement, pliRenderElement) {
    this.ldrLoader = ldrLoader;
    this.pliElement = pliElement;
    this.pliRenderElement = pliRenderElement;

    this.partsBuilder = new LDR.PartsBulder(ldrLoader, mainModelID, mainModelColor);

    // Register for options changes:
    var self = this;
    ldrOptions.listeners.push(function() {
	self.partsBuilder.onOptionsChanged();
	if(self.lastStep) {
	    self.drawPLIForStepLeft(self.lastStep, self.lastMaxWidth, self.lastMaxHeight, true);
	}
    });

    // Set up rendering elements:
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000000);
    this.camera.position.x = 10000;
    this.camera.position.y = 7000;
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

LDR.PLIBuilder.prototype.drawPLIForStepLeft = function(step, maxWidth, maxHeight, force) {
    if(!force && this.lastStep && this.lastStep.idx === step.idx)
	return;
    this.lastStep = step;
    this.lastMaxWidth = maxWidth;
    this.lastMaxHeight = maxHeight;

    // Find and sort icons to show:
    var sortedIcons = this.createSortedIcons(step);
    var len = sortedIcons.length;

    // Scale icons and compute actual size:
    var w = 120;
    var h = 120;

    // Compute actual size:
    // Size to fill up:
    var iconsHigh = Math.min(len, parseInt((maxHeight-4) / h));
    var H = iconsHigh * h;
    var iconsWide = parseInt((len + iconsHigh - 1)/iconsHigh)
    var W = iconsWide * w;
    
    this.pliElement.width = W+4;
    this.pliElement.height = H+4;

    var context = this.pliElement.getContext('2d');
    this.render(sortedIcons[0].key, w, h);

    context.font = "18px sans-serif";
    context.fillStyle = "black";
    context.clearRect(0, 0, this.pliElement.width, this.pliElement.height);
    var self = this;
    function delay() {
      var idx = len-1;
      for(var x = iconsWide-1; idx >= 0; x--) {
	for(var y = iconsHigh-1; y >= 0 && idx >= 0; y--) {
	    var icon = sortedIcons[idx];
	    idx--;
            self.render(icon.key, w, h);
	    context.drawImage(self.renderer.domElement, x*w, y*h);
	}
      }
      idx = len-1;
      for(var x = iconsWide-1; idx >= 0; x--) {
	for(var y = iconsHigh-1; y >= 0 && idx >= 0; y--) {
	    var icon = sortedIcons[idx];
	    idx--;
	    context.fillText(icon.mult + "x", x*w + 2, (y+1)*h - 8);
	}
      }
    }
    setTimeout(delay, 10); // Ensure not blocking
}

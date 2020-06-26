/*
  Icon: {x, y, width, height, mult, key, part, c, desc}
 */
LDR.PliPreviewer = function(modelID, canvas, renderer) {
    if(!renderer) {
	throw "Missing renderer";
    }
    this.modelID = modelID;
    this.canvas = canvas;
    this.renderer = renderer;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000000);
    this.scene = new THREE.Scene(); // To add stuff to
    this.scene.background = new THREE.Color(0xFFFFFF);
    this.pliHighlighted = null; // Indicates highlighted part for preview.
    this.composer = null; // Set when there are parts that glow in the dark.

    this.resetCameraPosition();
    this.subjectSize = 1;    
    this.controls;
}

LDR.PliPreviewer.prototype.enableControls = function() { 
    let self = this;
    this.controls = new THREE.OrbitControls(this.camera, this.canvas);
    this.controls.addEventListener('change',()=>self.render());
}

LDR.PliPreviewer.prototype.render = function() {
    if(this.composer !== null) {
        this.composer.render();
    }
    else {
        this.renderer.render(this.scene, this.camera);
    }
}

LDR.PliPreviewer.prototype.onResize = function() {
    let w = window.innerWidth*0.80;
    let h = window.innerHeight-180;

    this.renderer.setSize(w, h);
    this.renderer.domElement.parentElement.style.width = w + "px";
    this.renderer.domElement.parentElement.style.height = h + "px";
    this.camera.left   = -w;
    this.camera.right  =  w;
    this.camera.top    =  h;
    this.camera.bottom = -h;

    if(this.showsSomething()) {
        this.composer = new THREE.EffectComposer(this.renderer);
        this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));
        if(!this.pliHighlighted.pliMC.attachGlowPasses(w, h, this.scene, this.camera, this.composer)) {
            this.composer = null;
        }
    }

    this.resetCameraZoom();
    this.render();
}

LDR.PliPreviewer.prototype.resetCameraZoom = function() {
    let sizeMin = Math.min(this.canvas.clientWidth, this.canvas.clientHeight);
    this.camera.zoom = sizeMin / this.subjectSize;
    this.camera.updateProjectionMatrix();
}

LDR.PliPreviewer.prototype.resetCameraPosition = function() {
    this.camera.position.set(10000, 7000, 10000);
    this.camera.lookAt(new THREE.Vector3());
    this.resetCameraZoom();
    this.render();
}

LDR.PliPreviewer.prototype.zoomIn = function() {
    if(!this.controls) {
	return;
    }
    this.controls.dollyIn(1.2);
    this.render();
}

LDR.PliPreviewer.prototype.zoomOut = function() {
    if(!this.controls) {
	return;
    }
    this.controls.dollyOut(1.2);
    this.render();    
}

LDR.PliPreviewer.prototype.setPart = function(pt, c) {
    this.clear();

    this.pliHighlighted = pt;
    this.scene.add(pt.mesh);
        
    pt.pliMC.overwriteColor(c);

    let b = pt.pliMC.boundingBox;
    let size = b.min.distanceTo(b.max) * 0.6;
    this.subjectSize = size;
    this.onResize();    
}
 
LDR.PliPreviewer.prototype.clear = function() {
    if(this.showsSomething()) {
        this.scene.remove(this.pliHighlighted.mesh);        
        this.pliHighlighted = null;
    }
}

LDR.PliPreviewer.prototype.showsSomething = function() {
    return this.pliHighlighted !== null;
}
 
LDR.PliPreviewer.prototype.showPliPreview = function(icon) {
    if(icon) {
        let c = icon.c;
        let color = LDR.Colors[c];

        // Update description:
        let nameEle = document.getElementById('preview_info_name');
        let partIdNoDat = icon.partID.slice(0, -4);
        if(partIdNoDat.startsWith('pli_')) {
            partIdNoDat = partIdNoDat.substring(4);
        }
        let partIdBricklink;
        let blVisibility = 'hidden';
        if(LDR.BL && LDR.BL.hasOwnProperty(partIdNoDat)) {
            partIdBricklink = LDR.BL[partIdNoDat];
            blVisibility = 'visible';
        }
        else {
            partIdBricklink = partIdNoDat;
        }
        let desc = icon.desc || partIdNoDat;
        nameEle.innerHTML = desc + " (" + partIdNoDat + ")";
        let blA = document.getElementById('preview_info_bl_link');
        if(color.bricklink_name) {
            blA.setAttribute('href', 'https://www.bricklink.com/catalogItemIn.asp?P=' + partIdBricklink + '&c=' + color.bricklink_id + '&in=A');
        }
        else {
            blA.setAttribute('href', 'https://www.bricklink.com/catalogItem.asp?P=' + partIdBricklink);
        }
        
        let bhA = document.getElementById('preview_info_bh_link');
        
        if(icon.inlined && !isNaN(icon.inlined)) {
            bhA.setAttribute('href', "../p/part.php?user_id=" + icon.inlined + "&id=" + encodeURI(partIdNoDat));
            blA.style.visibility = blVisibility;
        }
        else if(!(icon.ldraw_org && !icon.ldraw_org.startsWith('Unofficial_')) && (icon.inlined === undefined || icon.inlined === 'undefined')) {
            bhA.setAttribute('href', "../p/part.php?from=" + this.modelID + "&id=" + encodeURI(partIdNoDat));
            blA.style.visibility = blVisibility;
        }
        else {
            bhA.setAttribute('href', '../p/' + partIdNoDat);
            blA.style.visibility = "visible";
        }
        
        document.getElementById('preview_info_color_ldraw').innerHTML = color.name + " (" + c + ")";
        document.getElementById('preview_info_color_lego').innerHTML = color.lego_name ? (color.lego_name + " (" + color.lego_id + ")") : 'Unknown official LEGO color';
        document.getElementById('preview_info_id_bricklink').innerHTML = partIdBricklink;
        document.getElementById('preview_info_color_bricklink').innerHTML = color.bricklink_name ? (color.bricklink_name + " (" + color.bricklink_id + ")") : 'Unknown Bricklink color';
    }
    
    let fadeInTime = 400;
    $('#preview_holder, #preview_background, #preview').fadeIn(fadeInTime);
}

LDR.PliPreviewer.prototype.hidePliPreview = function() {
    this.clear();
    let fadeOutTime = 400;
    $('#preview_holder, #preview_background, #preview').fadeOut(fadeOutTime);
}

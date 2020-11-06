'use strict';

/*
  options is used in internal ldrLoader initialization. Additional parameters are:
  - w: Width of displayed icons. Default '200 / window.devicePixelRatio'.
  - h: Height of displayed icons. Default '200 / window.devicePixelRatio'.
  optionsEle is the html element onto which LDR options are appended.
 */
LDR.Previews = function(options, optionsEle) {
    let self = this;

    this.options = options || {};
    this.options.cleanUpPrimitivesAndSubParts = false;

    this.optionsEle = optionsEle;

    this.w = this.options.w || 200 / window.devicePixelRatio;
    this.h = this.options.h || 200 / window.devicePixelRatio;

    let originalOnProgress = this.options.onProgress || function(){};
    this.options.onProgress = function(id) {
        if('string' === typeof(id) && id.endsWith('.png')) {
            for(let id in self.rendered) {
                if(self.rendered.hasOwnProperty(id)) {
                    self.draw(id);
                }
            }
        }
        originalOnProgress();
    }

    this.canvas = document.createElement('canvas');

    this.renderer = new THREE.WebGLRenderer({canvas:this.canvas, antialias:true});
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.w, this.h);

    this.camera = new THREE.OrthographicCamera(-this.w, this.w, this.h, -this.h, 0.1, 1000000);
    this.camera.position.set(10000, 7000, 10000);
    this.camera.lookAt(new THREE.Vector3());

    this.measurer = new LDR.Measurer(this.camera);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xFFFFFF);

    this.elements = document.getElementsByClassName('part_icon');

    // Resize immediately:
    for(var i = 0; i < this.elements.length; i++) {
        let e = this.elements[i];
        e.style.width = this.w + 'px';
        e.style.height = this.h + 'px';
        e.parentElement.style['background-color'] = 'white';
    }

    this.ldrLoader;
    this.storage;

    this.requested = {};
    this.rendered = {};
}

LDR.Previews.prototype.render = function() {
    this.renderer.render(this.scene, this.camera);
}

LDR.Previews.prototype.draw = function(id) {
    let self = this;

    let pt = this.ldrLoader.getPartType(id+'.dat');
    if(!pt) {
        console.warn(id + ' not yet loaded');
        return;
    }
    let canvas = document.getElementById(id);

    // Not shown before - Set up:
    if(!pt.baseObject) {
        // Check that pt is fully loaded:
        let ok = true;
        function check(obj) {
	    let id = obj.ID;
	    if(!id) {
	        ok = false;
		return;
	    }
            let pt = self.ldrLoader.getPartType(id);
            if(!pt || !pt.steps) {
	        ok = false;
		return;
            }
            pt.steps.forEach(step => step.subModels.forEach(sm => check(sm)));
        }
        check(pt);
        if(!ok) {
            return; // Not ready.
        }
        
        canvas.width = this.w*window.devicePixelRatio;
        canvas.height = this.h*window.devicePixelRatio;
        canvas.style.width = this.w+'px';
        canvas.style.height = this.h+'px';

        let baseObject = new THREE.Group();
        let opaqueObject = new THREE.Group();
        let sixteenObject = new THREE.Group();
        let transObject = new THREE.Group();
        baseObject.add(opaqueObject);
        baseObject.add(sixteenObject);
        baseObject.add(transObject);
        let mc = pt.pliMC = new LDR.MeshCollector(opaqueObject, sixteenObject, transObject);
        let p = new THREE.Vector3();
        let r = new THREE.Matrix3();
        r.set(1,0,0, 0,-1,0, 0,0,-1);

	let backupAge = this.ldrLoader.physicalRenderingAge;
	this.ldrLoader.physicalRenderingAge = 0; // Ensure non-physical renderer is used.
	if(LDR.Options) {
            LDR.Options.lineContrast = 1; // Ensure lines are rendered.
        }
        pt.generateThreePart(this.ldrLoader, 16, p, r, true, false, mc);
	this.ldrLoader.physicalRenderingAge = backupAge;

        let elementCenter = new THREE.Vector3();
        mc.boundingBox.getCenter(elementCenter);
        baseObject.position.sub(elementCenter);
        baseObject.updateMatrixWorld(true);

        let [dx,dy] = this.measurer.measure(mc.boundingBox, baseObject.matrixWorld);
        let size = 120*Math.max(dx,dy);

        baseObject.subjectSize = size;
        pt.baseObject = baseObject;
        this.rendered[id] = true;
    }
    pt.pliMC.draw(false);

    this.camera.zoom = this.w * window.devicePixelRatio / pt.baseObject.subjectSize;
    this.camera.updateProjectionMatrix();

    this.scene.add(pt.baseObject);
    this.render();
    this.scene.remove(pt.baseObject);

    canvas.getContext('2d').drawImage(this.renderer.domElement, 0, 0);
}

LDR.Previews.prototype.initiate = function() {
    let self = this;

    let onLoad = function() {
        self.ldrLoader.loadTexmaps();

        let ids = [];
        for(let id in self.requested) {
            if(self.requested.hasOwnProperty(id)) {
                ids.push(id);
            }
	}
        ids.forEach(id => {self.draw(id); delete self.requested[id];});
    };

    let load = function(id) {
        if(self.rendered.hasOwnProperty(id)) {
            return;
	}
	if(self.ldrLoader.getPartType(id + '.dat')) {
            self.draw(id);	  
	}
	else {
            self.requested[id] = true;
            self.ldrLoader.load(id + '.dat');
	}
    };

    let inWindow = x => (0 <= x && x <= window.innerHeight);

    let lazy_load = function() {
        for(var i = 0; i < self.elements.length; i++) {
            var b = self.elements[i].getBoundingClientRect();
            if(inWindow(b.top) || inWindow(b.bottom)) {
                load(self.elements[i].id);
            }
        }
    };

    let onStorageReady = function() {
        if(LDR.Options) {
            LDR.Studs.makeGenerators('', LDR.Options.studHighContrast, LDR.Options.studLogo);
        }
        
        self.ldrLoader = new THREE.LDRLoader(onLoad, self.storage, self.options);

        window.addEventListener('scroll', lazy_load);
        window.addEventListener('resize', lazy_load);    
	lazy_load();
    };
    this.storage = new LDR.STORAGE(onStorageReady);

    this.createBigPreview();

    this.createOptions();
}

LDR.Previews.prototype.redrawAll = function(force) {
    if(force) { // Update all studs:
        location.reload(); // Geometries have been deleted due to optimizations, so reload the page.
    }

    for(let id in this.rendered) {
        if(this.rendered.hasOwnProperty(id)) {
            this.draw(id);
        }
    }
}

LDR.Previews.prototype.createBigPreview = function() {
    let self = this;
    
    // Set up HTML elements:
    let bg = document.createElement('div');
    bg.setAttribute('class','background');
    bg.id = 'preview_background';
    document.body.appendChild(bg);

    let holder = document.createElement('div');
    holder.setAttribute('class','holder');
    holder.id = 'preview_holder';
    document.body.appendChild(holder);

    let canvas = document.createElement('canvas');
    canvas.id = 'preview';
    holder.appendChild(canvas);

    // Set up renderer:
    let renderer = new THREE.WebGLRenderer({antialias:true, canvas:canvas});
    renderer.setPixelRatio(window.devicePixelRatio);

    let shownBaseObject;
    this.pliPreviewer = new LDR.PliPreviewer('no_model', canvas, renderer); // Has own renderer, camera, and scene.

    function showPreview(id) {
        let pt = self.ldrLoader.getPartType(id+'.dat');
        if(!pt) {
            console.warn('Part type not yet loaded',id);
            return;
        }
        let baseObject = pt.baseObject;
        if(!baseObject) {
            console.warn('Part type not yet built',id);
            return;
        }

        if(shownBaseObject) {
            self.pliPreviewer.scene.remove(shownBaseObject);
        }
        self.pliPreviewer.scene.add(baseObject);
        self.pliPreviewer.subjectSize = baseObject.subjectSize;
        self.pliPreviewer.showPliPreview();
        self.pliPreviewer.subjectSize = baseObject.subjectSize;
        self.pliPreviewer.onResize();

        shownBaseObject = baseObject;
    }

    // Register listeners:
    bg.addEventListener('click', ()=>self.pliPreviewer.hidePliPreview());
    for(var i = 0; i < this.elements.length; i++) {
        let e = this.elements[i];
        e.parentElement.addEventListener('click', ()=>showPreview(e.id));
        e.parentElement.style.cursor = 'pointer';
    }

    var actions = {
        zoomIn: () => self.pliPreviewer.zoomIn(),
        zoomOut: () => self.pliPreviewer.zoomOut(),
        resetCameraPosition: () => self.pliPreviewer.resetCameraPosition(),
    };
    this.ldrButtons = new LDR.Buttons(actions, canvas.parentNode, false);

    this.pliPreviewer.enableControls();

    window.addEventListener('resize', this.pliPreviewer.onResize, false);

    document.onkeydown = function(e) {
        e = e || window.event;
        if(e.keyCode == '27') { // ESC
            self.pliPreviewer.hidePliPreview();
        }
    }
}

LDR.Previews.prototype.createOptions = function() {
    let self = this;
    if(this.optionsEle && LDR.Options) {
        LDR.Options.appendHeader(this.optionsEle);
        LDR.Options.appendContrastOptions(this.optionsEle);
        LDR.Options.appendStudHighContrastOptions(this.optionsEle);
        LDR.Options.appendStudLogoOptions(this.optionsEle);
        LDR.Options.appendFooter(this.optionsEle);
        LDR.Options.listeners.push(force => self.redrawAll(force));
    }
}

LDR.LDRGeometry.prototype.cleanTempData = () => {} // Ensure we can reuse geometries.
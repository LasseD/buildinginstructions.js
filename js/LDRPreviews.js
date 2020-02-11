'use strict';

/*
  options is used in internal ldrLoader initialization. Additional parameters are:
  - w: Width of displayed icons. Default '200 / window.devicePixelRatio'.
  - h: Height of displayed icons. Default '200 / window.devicePixelRatio'.
 */
LDR.Previews = function(options) {
    let self = this;

    this.options = options || {};
    this.options.removePrimitivesAndSubParts = false;

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
        function check(id) {
            let pt = self.ldrLoader.getPartType(id);
            if(!pt) {
	        ok = false;
		return;
            }
            pt.steps.forEach(step => step.subModels.forEach(sm => check(sm.ID)));
        }
        check(pt.ID);
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

        pt.generateThreePart(this.ldrLoader, 16, p, r, true, false, mc);

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
        LDR.Studs.makeGenerators('', ldrOptions.studHighContrast, ldrOptions.studLogo);
        
        self.ldrLoader = new THREE.LDRLoader(onLoad, self.storage, self.options);

        window.addEventListener('scroll', lazy_load);
        window.addEventListener('resize', lazy_load);    
	lazy_load();
    };
    this.storage = new LDR.STORAGE(onStorageReady);
}

LDR.Previews.prototype.redrawAll = function(force) {
    if(force) { // Update all studs:
        for(let id in this.ldrLoader.partTypes) {
            if(this.ldrLoader.partTypes.hasOwnProperty(id)) {
                let pt = this.ldrLoader.partTypes[id];
                pt.baseObject = pt.pliMC = pt.geometry = null;
            }
        }
        LDR.Studs.setStuds(this.ldrLoader, ldrOptions.studHighContrast, 
                           ldrOptions.studLogo, () => {}); // Studs.
    }

    for(let id in rendered) {
        if(this.rendered.hasOwnProperty(id)) {
            this.draw(id);
        }
    }
}
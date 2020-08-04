'use strict';

LDR.InstructionsManager = function(modelUrl, modelID, modelColor, mainImage, refreshCache, baseURL, stepFromParameters, options) {
    let startTime = new Date();
    let self = this;
    options = options || {};
    this.stepEditor;
    this.canEdit = options.canEdit === true; // Only set if LDRStepEditor.js is loaded.
    this.modelID = modelID;
    this.modelColor = modelColor;
    this.refreshCache = refreshCache;
    this.baseURL = baseURL;
    this.pliMaxWidthPercentage = options.hasOwnProperty('pliMaxWidthPercentage') ? options.pliMaxWidthPercentage : 40;
    this.pliMaxHeightPercentage = options.hasOwnProperty('pliMaxHeightPercentage') ? options.pliMaxHeightPercentage : 35;
    this.animateUIElements = options.hasOwnProperty('animateUIElements') ? options.animateUIElements : false;

    LDR.Colors.canBeOld = true;

    this.scene = new THREE.Scene(); // To add stuff to
    //this.scene.add(new THREE.AxesHelper(50));

    this.defaultZoom = 1; // Will be overwritten.
    this.currentStep = 1; // Shown current step.
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000000); // Orthographics for LEGO

    let pixelRatio = window.devicePixelRatio;
    this.canvas = document.getElementById('main_canvas');
    this.renderer = new THREE.WebGLRenderer({antialias:true, canvas:this.canvas});
    this.renderer.setPixelRatio(pixelRatio);
    this.secondaryCanvas = document.getElementById('secondary_canvas');
    if(this.secondaryCanvas) {
        this.secondaryRenderer = new THREE.WebGLRenderer({antialias:true, canvas:this.secondaryCanvas, alpha:true});
        this.secondaryRenderer.setPixelRatio(pixelRatio);
    }

    let canvasHolder = document.getElementById('main_canvas_holder');
    let actions = {
        prevStep: () => self.prevStep(),
        nextStep: () => self.nextStep(),
        zoomIn: () => self.zoomIn(),
        zoomOut: () => self.zoomOut(),
        resetCameraPosition: () => self.resetCameraPosition(),
        clickDone: () => self.clickDone(),
        toggleEditor: () => self.stepEditor && self.stepEditor.toggleEnabled(),
    };
    this.ldrButtons = new LDR.Buttons(actions, canvasHolder, true, modelID, mainImage, options);
    this.controls = new THREE.OrbitControls(this.camera, this.canvas);
    this.controls.noTriggerSize = 0.1;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('change', () => self.render());

    this.topButtonsHeight = 100; // px
    this.resetCameraPosition();

    window.addEventListener('resize', () => self.onWindowResize(), false);

    this.adPeek = options.hasOwnProperty('adPeek') ? options.adPeek : 0;

    // PLIW either from storage or params:
    let [allW, allH] = LDR.getScreenSize();
    let storagePLIW = localStorage.getItem('pliW');
    if(storagePLIW !== null && storagePLIW >= 0) {
        this.pliW = storagePLIW;
    }
    else {
        this.pliW = allW * this.pliMaxWidthPercentage/100;
    }
    let clampW = () => self.pliW = Math.min(Math.max(self.pliW, 0), allW-70);
    clampW();

    let storagePLIH = localStorage.getItem('pliH');
    if(storagePLIH !== null && storagePLIH >= 0) {
        console.log('storage',storagePLIH);
        this.pliH = storagePLIH;
    }
    else {
        this.pliH = (allH-this.adPeek) * this.pliMaxHeightPercentage/100;
    }
    let clampH = () => self.pliH = Math.min(Math.max(self.pliH, 0), allH-self.adPeek-50);
    clampH();

    this.lastRefresh = new Date();
      
    this.currentRotationMatrix = new THREE.Matrix4(); 
    this.currentRotationMatrix.set(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1);
    this.defaultMatrix = new THREE.Matrix4();
    this.defaultMatrix.set(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1);

    this.ldrLoader; // To be set once model is loaded.
    this.stepHandler; // Set in 'onPartsRetrieved'
    this.pliElement = document.getElementById('pli');
    this.emptyElement = document.getElementById('empty_step');
    this.pliBuilder; // Set in 'onPartsRetrieved'
    this.outlinePass = null; // Set in onWindowResize
    this.glowPasses = []; // Set in onWindowResize
    this.composer = null; // Set in onWindowResize
    this.resetSelectedObjects();

    this.baseObject = new THREE.Group();
    this.opaqueObject = new THREE.Group();
    this.sixteenObject = new THREE.Group();
    this.transObject = new THREE.Group();
    this.baseObject.add(this.opaqueObject); // Draw non-trans before trans.
    this.baseObject.add(this.sixteenObject);
    this.baseObject.add(this.transObject);
    this.scene.add(this.baseObject);
    if(this.secondaryCanvas) {
        this.pliPreviewer = new LDR.PliPreviewer(modelID, this.secondaryCanvas, this.secondaryRenderer);
    }

    this.showPLI = false;
    this.hovered = false;
    
    // Variables for realignModel:
    this.oldMultiplier = 1;
    this.currentMultiplier = 1;
    this.currentRotation = false;
    this.initialConfiguration = true;

    this.doneShown = false;

    this.accHelper;
    this.helper;

    // Make ldrButtons catch arrow keys left/right:
    function handleKeyDown(e) {
        e = e || window.event;
        if(e.altKey) {
	    // Don't handle key events when ALT is pressed, as they indicate page shift overwrite!
	    return;
        }
        if(e.keyCode === 13) { // ENTER
	    let stepToGoTo = parseInt(self.ldrButtons.stepInput.value);
	    self.goToStep(stepToGoTo);
        }
        else if(e.keyCode === 37) { // Left:
	    self.prevStep();
        }
        else if (e.keyCode === 39) { // Right:
            self.nextStep();
        }
        else if(e.keyCode === 27) { // ESC closes preview.
	    self.hidePliPreview();
            self.hideDone();
        }
	else if(self.stepEditor && LDR.Options && LDR.Options.showEditor && self.canEdit) { // Send rest to editor if available:
	    self.stepEditor.handleKeyDown(e);
	}
    }
    document.onkeydown = handleKeyDown;

    let onPartsLoadedCalled = true; // Default: Assume parser calls onPartsLoaded
      
    let onLoad = function() {
        if(!onPartsLoadedCalled) {
            self.ldrLoader.onPartsLoaded();
	    onPartsLoadedCalled = true;
        }

        console.log("Done loading at " + (new Date()-startTime) + "ms.");

	// Ensure replaced parts are substituted:
	self.ldrLoader.substituteReplacementParts();

        // Find what should be built for first step:
        let mainModel = self.ldrLoader.mainModel;
        let origo = new THREE.Vector3();
        let inv = new THREE.Matrix3(); inv.set(1,0,0, 0,1,0, 0,0,1); // Invert Y-axis
        
        let pd = new THREE.LDRPartDescription(self.modelColor, origo, inv, mainModel, false);
        
        if(self.secondaryCanvas) {
            self.pliBuilder = new LDR.PLIBuilder(self.ldrLoader, self.canEdit, mainModel,
                                                 document.getElementById('pli'), self.secondaryRenderer);
        }
        self.stepHandler = new LDR.StepHandler(self, [pd], true);
        self.stepHandler.nextStep(false);

	self.realignModel(0);
	self.updateUIComponents(false);
	self.render(); // Updates background color.

        console.log("Render done after " + (new Date()-startTime) + "ms.");

	// Number of steps:
	if(options.showNumberOfSteps) {
	    document.getElementById('numberOfSteps').innerHTML = '/ ' + self.stepHandler.totalNumberOfSteps;
	}

	// Go to step indicated by parameter:
	if(stepFromParameters > 1) {
            self.stepHandler.moveTo(stepFromParameters);
	    self.handleStepsWalked();
        }

	// Enable pli preview:
        if(self.pliPreviewer) {
            self.pliPreviewer.enableControls();
        }

        // Enable editor:
        if(self.canEdit) {
            function removeGeometries() {
                self.ldrLoader.applyOnPartTypes(pt => {
                        if(!pt.isPart) {
                            pt.geometry = null;
                        }
                    });
            }
	    function onEditDone() {
		self.ignoreViewPortUpdate = true;
		self.handleStepsWalked();
		self.ignoreViewPortUpdate = false;
	    }
	    
            self.stepEditor = new LDR.StepEditor(self.ldrLoader, self.stepHandler,
						 self.pliBuilder, removeGeometries,
						 onEditDone, self.modelID);
            self.stepEditor.createGuiComponents(document.getElementById('editor'));
            if(LDR.Options && LDR.Options.showEditor === 1) {
                $("#editor").show();
            }
        }
    }

    let onInstructionsLoaded = function(ok, parts) {
	if(ok) {
            onPartsLoadedCalled = false; // Because instructions could be fetched from storage
	    if(parts.length === 0) {
		onLoad(); // Done!
	    }
	    else {
		self.ldrLoader.loadMultiple(parts);
	    }
	}
	else { // Not loaded from storage. Proceed with normal loading:
            self.ldrLoader.load(modelUrl);
	}
    }
    let onStorageReady = function() {
        if(LDR.Options && LDR.Studs) {
            LDR.Studs.makeGenerators('', LDR.Options.studHighContrast, LDR.Options.studLogo);
        }
        self.ldrLoader = new THREE.LDRLoader(onLoad, self.storage, options);
        if(self.storage) {
            self.storage.retrieveInstructionsFromStorage(self.ldrLoader, onInstructionsLoaded);
        }
        else {
            onInstructionsLoaded(false);
        }
    }

    // Set up PLI interactions:
    let pli = document.getElementById("pli");
    if(pli) {
        pli.addEventListener('click', e => self.onPLIClick(e));
        pli.addEventListener('mousemove', e => self.onPLIMove(e));
        pli.addEventListener('mouseover', e => self.onPLIMove(e));
        pli.addEventListener('mouseout', () => self.onPLIMove(false));
    }

    if(options.setUpOptions && LDR.Options) {
	this.setUpOptions(options);
    }
    this.onWindowResize();
    if(LDR.STORAGE) {
        this.storage = new LDR.STORAGE(onStorageReady);
    }
    else {
        onStorageReady();
    }

    if(pli) {
        // Set up PLI size drag:
        this.dh = document.getElementById('pli_drag_horizontal');
        this.dv = document.getElementById('pli_drag_vertical');
        let p = document.getElementById('instructions_decorations');
        let resizingV = false, resizingH = false;
        let x, y, pliW, pliH;
        let mouseStart = e => {x = e.clientX; y = e.clientY; pliH = self.pliH; pliW = self.pliW};
        let touchStart = e => {if(e.touches.length > 0) {x = e.touches[0].pageX; y = e.touches[0].pageY; pliH = self.pliH; pliW = self.pliW}};
        let stop = e => {resizingV = resizingH = false; self.onWindowResize()};
        
        // Start:
        this.dv.addEventListener('mousedown', () => resizingV = true);
        this.dv.addEventListener('touchstart', () => resizingV = true);
        this.dh.addEventListener('mousedown', () => resizingH = true);
        this.dh.addEventListener('touchstart', () => resizingH = true);
        p.addEventListener('mousedown', mouseStart);
        p.addEventListener('touchstart', touchStart);
        
        // Stop:
        p.addEventListener('mouseup', stop);
        p.addEventListener('touchend', stop);
        
        // Move:
        function resize(x2, y2) {
            if(resizingH) {
                let newW = pliW + (x2-x);
                if(self.pliW != newW) {
                    self.pliW = newW;
                    clampW();
                    localStorage.setItem('pliW', self.pliW);
                    self.updatePLI(false, true);
                }
                return true;
            }
            if(resizingV) {
                let newH = pliH + (y2-y);
                if(self.pliH != newH) {
                    self.pliH = newH;
                    clampH();
                    localStorage.setItem('pliH', self.pliH);
                    self.updatePLI(false, true);
                }
                return true;
            }
            return false;
        }
        p.addEventListener('mousemove', e => resize(e.clientX, e.clientY));
        p.addEventListener('touchmove', e => {
                if(e.touches.length > 0 && resize(e.touches[0].pageX, e.touches[0].pageY)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
    }
}
    
LDR.InstructionsManager.prototype.updateRotator = function(zoom) {
    let rotator = document.getElementById("rotator");
    let showRotator = this.stepHandler.getShowRotatorForCurrentStep();
    if(showRotator) {
        rotator.style.visibility = "visible";
        let rotatorAnimation = document.getElementById("rotator_animation");
	if(this.animateUIElements) {
            rotatorAnimation.beginElement();
	}
    }
    else {
        rotator.style.visibility = "hidden";
    }
}

LDR.InstructionsManager.prototype.updateMultiplier = function(zoom) {
    let changes = this.oldMultiplier !== this.currentMultiplier;
    if(!changes) {
        return;
    }
    let multiplier = $('#multiplier');
    if(this.currentMultiplier === 1) {
        multiplier[0].style.visibility = "hidden";
        multiplier[0].innerHTML = '';
    }
    else {
        multiplier[0].style.visibility = "visible";
        multiplier[0].innerHTML = "x" + this.currentMultiplier;
	if(this.animateUIElements) {
            multiplier[0].style['font-size'] = "20vw";
            setTimeout(() => multiplier.animate({fontSize: "8vw"}, 200), 100);
	}
	else {
            multiplier[0].style['font-size'] = "8vw";
	}
    }
    this.oldMultiplier = this.currentMultiplier;
}

LDR.InstructionsManager.prototype.updateCameraZoom = function(zoom) {
    zoom = zoom || this.defaultZoom;
    this.camera.zoom = zoom;
    this.camera.updateProjectionMatrix();
}

LDR.InstructionsManager.prototype.resetSelectedObjects = function() {
    this.selectedObjects = [];
    this.inSelectedObjects = {};
}

LDR.InstructionsManager.prototype.addSelectedObject = function(idx, a) {
    this.selectedObjects.push(...a);
    this.inSelectedObjects[idx] = true;
}

LDR.InstructionsManager.prototype.hasSelectedObject = function(idx) {
    return this.inSelectedObjects.hasOwnProperty(idx);
}

LDR.InstructionsManager.prototype.render = function() {
    if(this.composer) {
        if(this.outlinePass !== null) {
            this.outlinePass.selectedObjects = this.selectedObjects;
        }
        this.composer.render();
    }
    else {
        this.renderer.render(this.scene, this.camera);
    }
}

LDR.InstructionsManager.prototype.setBackgroundColor = function(c) {
    this.scene.background = new THREE.Color(parseInt("0x" + c));
    document.body.style.backgroundColor = '#' + c;
}

LDR.InstructionsManager.prototype.buildOutlinePass = function(w, h){
    this.outlinePass = new OutlinePass(new THREE.Vector2(w, h),
                                       this.scene, this.camera, this.selectedObjects);
    this.outlinePass.hiddenEdgeColor.set('#000000');
    this.outlinePass.edgeStrength = 20;

    if(LDR.Options && LDR.Options.showOldColors === 0) {
        this.outlinePass.visibleEdgeColor.set('#200000');
    }
    else {
        this.outlinePass.visibleEdgeColor.set('#20F000');
    }
}

LDR.InstructionsManager.prototype.onWindowResize = function(force){
    this.topButtonsHeight = document.getElementById('top_buttons').offsetHeight;

    let [w, h] = LDR.getScreenSize();
    h -= this.adPeek;
    if(force || this.canvas.width !== w || this.canvas.height !== h) {
        this.renderer.setSize(w, h, true);
        this.composer = new THREE.EffectComposer(this.renderer);
        this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));
        let any = false;
        if(LDR.Options && LDR.Options.showOldColors <= 1) {
            any = true;
            this.buildOutlinePass(w, h);
            this.composer.addPass(this.outlinePass);            
        }
        else {
            this.outlinePass = null;
        }

        if(this.stepHandler) { // Attach glow for all mesh collectors up until this step:
            let map = {};
            this.stepHandler.getGlowObjects(map);
            
            if(LDR.attachGlowPassesForObjects(map, w, h, this.scene, this.camera, this.composer)) {
                any = true;
            }
        }

        if(!any) {
            this.composer = null;
        }
    }
    this.camera.left   = -this.canvas.clientWidth*0.95;
    this.camera.right  =  this.canvas.clientWidth*0.95;
    this.camera.top    =  this.canvas.clientHeight*0.95;
    this.camera.bottom = -this.canvas.clientHeight*0.95;
    
    this.updateViewPort();
    this.updateCameraZoom();
    if(this.stepHandler) {
        this.realignModel(0);
        this.updateUIComponents(false);
    }
}

LDR.InstructionsManager.prototype.resetCameraPosition = function() {
    this.controls.reset();
    this.updateCameraZoom();
    this.updateViewPort();
    this.camera.lookAt(new THREE.Vector3());
    this.camera.updateProjectionMatrix();
    this.updateViewPort();
    this.render();
}

LDR.InstructionsManager.prototype.zoomIn = function() {
    this.controls.dollyIn(1.2);
    this.render();
}

LDR.InstructionsManager.prototype.zoomOut = function() {
    this.controls.dollyOut(1.2);
    this.render();
}

LDR.InstructionsManager.prototype.updateUIComponents = function(force) {
    if(!this.stepHandler) {
	return; // Not ready.
    }
    this.currentMultiplier = this.stepHandler.getMultiplierOfCurrentStep();
    this.updateMultiplier();
    this.updateRotator();
    this.setBackgroundColor(this.stepHandler.getBackgroundColorOfCurrentStep());
    if(this.stepHandler.isAtLastStep()) {
        this.ldrButtons.atLastStep();
    }
    else if(this.stepHandler.isAtFirstStep()) {
        this.ldrButtons.atFirstStep();
    }
    else {
        this.ldrButtons.atAnyOtherStep();
    }
    this.ldrButtons.setShownStep(this.currentStep);
    this.updatePLI(force);
    this.updateViewPort();
    this.updateCameraZoom();

    this.render();
    this.stepEditor && this.stepEditor.updateCurrentStep();
}

LDR.InstructionsManager.prototype.updatePLI = function(force = false, quick = false) {
    let step = this.stepHandler.getCurrentStep();
    let edit = LDR.Options && LDR.Options.showEditor && this.canEdit;

    this.showPLI = this.secondaryCanvas && (edit || step.containsPartSubModels(this.ldrLoader));
    let e = this.pliElement;
    if(this.emptyElement) {
        this.emptyElement.style.display = (!edit || this.showPLI || step.containsNonPartSubModels(this.ldrLoader)) ? 'none' : 'inline-block';
    }

    if(!this.showPLI) {
        if(e && this.dh && this.dv) {
            e.style.display = this.dh.style.display = this.dv.style.display = 'none';
            this.dh.setAttribute('class', '');
            this.dv.setAttribute('class', '');
        }
        return;
    }
    e.style.display = 'inline-block';
    
    let [maxWidth,maxHeight] = LDR.getScreenSize();
    maxWidth *= 0.95;//e.offsetLeft + 20;
    maxHeight -= 130 + this.adPeek; // 130 for the top buttons + margins
    
    if(this.fillHeight()) {
        let w = this.pliW;
        let h = maxHeight;
        if(quick) {
            this.pliBuilder.canvas.width = w*window.devicePixelRatio;
            this.pliBuilder.canvas.style.width = w+"px";
        }
        else {
            this.pliBuilder.drawPLIForStep(true, step, w, h, force);
        }
        this.dh.style.display = 'inline-block';
	this.dh.setAttribute('class', 'ui_control');
        this.dh.style.height = this.pliBuilder.canvas.style.height || '40vh';
        this.dv.style.display = 'none';
	this.dv.setAttribute('class', '');
        this.dv.style.width = '0px';
    }
    else {
        let w = maxWidth;
        let h = this.pliH;
        if(quick) {
            this.pliBuilder.canvas.height = h*window.devicePixelRatio;
            this.pliBuilder.canvas.style.height = h+"px";
        }
        else {
            this.pliBuilder.drawPLIForStep(false, step, w, h, force);
        }
        this.dv.style.display = 'block';
	this.dv.setAttribute('class', 'ui_control');
        this.dv.style.width = this.pliBuilder.canvas.style.width || '40vw';
        this.dh.style.display = 'none';
	this.dh.setAttribute('class', '');
        this.dh.style.height = '0px';
    }
}

LDR.InstructionsManager.prototype.fillHeight = function() {
    let [w, h] = LDR.getScreenSize();
    return w > h;
}

LDR.InstructionsManager.prototype.updateViewPort = function(overwriteSize) {
    if(this.ignoreViewPortUpdate) {
	return; // Editor change
    }

    let c = this.camera;
    let W = this.canvas.clientWidth*0.95; // c.right-c.left
    let H = this.canvas.clientHeight*0.95; // c.top-c.bottom

    c.position.set(10000, 7000, 10000);

    let dx = 0;
    let dy = this.topButtonsHeight;

    if(!overwriteSize && !this.showPLI) {
        // No move
    }
    else if(this.fillHeight()) {
        dx += overwriteSize ? overwriteSize[0] : this.pliW;
    }
    else {
        dy += overwriteSize ? overwriteSize[1] : this.pliH;
    }

    c.clearViewOffset();
    c.setViewOffset(W, H, -dx/2, -dy/2, W, H);
    c.updateProjectionMatrix();
    this.controls.update();
}

LDR.InstructionsManager.prototype.realignModel = function(stepDiff, onRotated, onDone) {
    let self = this;
    let oldRotationMatrix = this.currentRotationMatrix;
    let oldPosition = new THREE.Vector3();
    oldPosition.copy(this.baseObject.position);
    let oldPLIW = this.showPLI ? this.pliW : 0;
    let oldPLIH = this.showPLI ? this.pliH : 0;

    let oldLevel = this.stepHandler.getLevelOfCurrentStep();
    let newLevel = oldLevel;
    let goBack = function(){}; // Used for single steps
    if(stepDiff === 1 && this.stepHandler.nextStep(true)) {
        goBack = function() {
            newLevel = self.stepHandler.getLevelOfCurrentStep();
            self.stepHandler.prevStep(true);
        };
    }
    else if(stepDiff === -1 && this.stepHandler.prevStep(true)) {
        goBack = function() {
            newLevel = self.stepHandler.getLevelOfCurrentStep();
            self.stepHandler.nextStep(true);
        };
    }
    
    let [viewPortWidth, viewPortHeight] = LDR.getScreenSize();
    viewPortHeight -= this.adPeek;
    if(this.pliH > 0) { // Adjust for pli.
        if(this.fillHeight()) {
            viewPortWidth -= this.pliW;
        }
        else {
            viewPortHeight -= this.pliH;
        }
    }
    
    let useAccumulatedBounds = true;
    let b = this.stepHandler.getAccumulatedBounds();

    let size = b.min.distanceTo(b.max);
    let viewPortSize = 0.75*Math.sqrt(viewPortWidth*viewPortWidth + viewPortHeight*viewPortHeight);

    if(size > viewPortSize) {
        useAccumulatedBounds = false;
        b = this.stepHandler.getBounds();
        size = b.min.distanceTo(b.max);
        if(size < viewPortSize) { // Zoom a bit out as just the step is a bit too small.
            let bDiff = new THREE.Vector3();
	    bDiff.subVectors(b.max, b.min); // b.max-b.min
            bDiff.multiplyScalar(0.10*(viewPortSize/size-1));
            b.max.add(bDiff);
            b.min.sub(bDiff);
            size = viewPortSize;
        }
    }
    let newPosition;
    [newPosition, this.currentRotationMatrix] = this.stepHandler.computeCameraPositionRotation(this.defaultMatrix, this.currentRotationMatrix, useAccumulatedBounds);
    
    // Find actual screen bounds:
    this.baseObject.setRotationFromMatrix(this.currentRotationMatrix);
    this.baseObject.updateMatrixWorld(true);
    let measurer = new LDR.Measurer(this.camera);
    let [dx,dy] = measurer.measure(b, this.baseObject.matrixWorld);
    
    this.updatePLI(false);
    let newPLIW = this.showPLI ? this.pliW : 0;
    let newPLIH = this.showPLI ? this.pliH : 0;
    
    goBack();

    let rotationChanges = !this.currentRotationMatrix.equals(oldRotationMatrix);
    let ignorePos = new THREE.Vector3(); // Ignore
    let newRot = new THREE.Quaternion();
    let ignoreScale = new THREE.Vector3(); // Ignore
    this.currentRotationMatrix.decompose(ignorePos, newRot, ignoreScale);
    
    let positionChanges = !oldPosition.equals(newPosition) || oldPLIW !== newPLIW || oldPLIH !== newPLIH;
    
    let oldDefaultZoom = this.defaultZoom;
    [viewPortWidth, viewPortHeight] = LDR.getScreenSize();
    viewPortHeight -= this.adPeek + this.topButtonsHeight;
    if(this.fillHeight()) {
        viewPortWidth -= newPLIW;
    }
    else {
        viewPortHeight -= newPLIH;
    }
    let [allW, allH] = LDR.getScreenSize();
    let scaleX = allW / viewPortWidth * 1.1; // 1.1 to scale down a bit
    let scaleY = (allH - this.adPeek) / viewPortHeight * 1.1;
    if(dx*scaleX > dy*scaleY) {
        this.defaultZoom = 2*this.camera.zoom/(dx*scaleX);
    }
    else {
        this.defaultZoom = 2*this.camera.zoom/(dy*scaleY);
    }
    let newDefaultZoom = this.defaultZoom;
    let zoomChanges = oldDefaultZoom !== newDefaultZoom;
    
    function finalize() {
        self.initialConfiguration = false;
        onRotated && onRotated(); onRotated = false;
    	
        self.baseObject.setRotationFromMatrix(self.currentRotationMatrix);
        self.baseObject.position.x = newPosition.x;
        self.baseObject.position.y = newPosition.y;
        self.baseObject.position.z = newPosition.z;
	
        self.defaultZoom = newDefaultZoom;
        self.updateViewPort();
        self.updateCameraZoom();
        self.render();
        onDone && onDone(); onDone = false;
        if(new Date() - self.lastRefresh > 1000*60) {
            self.refreshCache();
            self.lastRefresh = new Date();
        }
    }
    
    let animationID;
    let startTime = new Date();
    let showAnimations = LDR.Options ? LDR.Options.showStepRotationAnimations : 2;
    let animationTimeRotationMS = rotationChanges ? (2-showAnimations)*300 : 0; // First rotate, 
    let animationTimePositionMS = positionChanges ? (2-showAnimations)*150 : 0; // then move and zoom
    if(stepDiff != 0 && newLevel !== oldLevel && newLevel-oldLevel === stepDiff) {
        animationTimeRotationMS = 0; // Don't rotate when stepping in.
        animationTimePositionMS = 0;
    }
    let animationTimeMS = animationTimePositionMS+animationTimeRotationMS;
    let lastPosition = oldPosition;

    function animate() {
        animationID = requestAnimationFrame(animate);
        
        let diffMS = new Date() - startTime;
        if(diffMS >= animationTimeMS) {
            cancelAnimationFrame(animationID); 
            finalize();
            return; // Done.
        }
        
        let progress = diffMS / animationTimeMS;
        self.defaultZoom = oldDefaultZoom + (newDefaultZoom-oldDefaultZoom)*progress;
        let pw = oldPLIW + (newPLIW-oldPLIW)*progress;
        let ph = oldPLIH + (newPLIH-oldPLIH)*progress;
        self.updateViewPort([pw, ph]);
        self.updateCameraZoom();
        
        if(diffMS < animationTimeRotationMS) { // Rotate first.
            progress = diffMS/animationTimeRotationMS;
            
            let oldPos = new THREE.Vector3();
            let oldRot = new THREE.Quaternion();
            let oldScale = new THREE.Vector3();
            oldRotationMatrix.decompose(oldPos, oldRot, oldScale);
            let angleToTurn = oldRot.angleTo(newRot);
            oldRot.rotateTowards(newRot, angleToTurn*progress*1.1); // *1.1 Ensure it is fully turned.
            
            let invOldM4 = new THREE.Matrix4();
            invOldM4.getInverse(oldRotationMatrix);
            let tmpM4 = new THREE.Matrix4();
            tmpM4.compose(oldPos, oldRot, oldScale);
            
            oldPos.copy(oldPosition);
            oldPos.negate();
            oldPos.applyMatrix4(invOldM4);
            oldPos.applyMatrix4(tmpM4);
            oldPos.negate();
            lastPosition = oldPos;
            
            self.baseObject.setRotationFromMatrix(tmpM4);
            self.baseObject.position.x = oldPos.x;
            self.baseObject.position.y = oldPos.y;
            self.baseObject.position.z = oldPos.z;
        }
        else { // Move and zoom:
            onRotated && onRotated(); onRotated = false;
            progress = (diffMS-animationTimeRotationMS)/animationTimePositionMS;
            
            let tmpPosition = new THREE.Vector3();
            tmpPosition.subVectors(newPosition, lastPosition).multiplyScalar(progress).add(lastPosition);
            
            // Update camera and baseObject:
            self.baseObject.position.x = tmpPosition.x;
            self.baseObject.position.y = tmpPosition.y;
            self.baseObject.position.z = tmpPosition.z;
        }
        
        self.render();
        self.stats && self.stats.update();
    }
    
    // Only animate if:
    if(showAnimations < 2 && // show animations
       Math.abs(stepDiff) === 1 && // Only stepping a single step &&
       !this.initialConfiguration && // This is not the initial step &&
       (zoomChanges || rotationChanges || positionChanges)) {
        animate();
    }
    else {
        finalize();
    }
}

LDR.InstructionsManager.prototype.handleStepsWalked = function() {
    // Helper. Uncomment next lines for step bounding boxes:
    /*if(this.helper) {
        this.baseObject.remove(this.helper);
    }
    if(this.accHelper) {
        this.baseObject.remove(this.accHelper);
    }
    this.accHelper = new THREE.Box3Helper(this.stepHandler.getAccumulatedBounds(), 0x00FF00)
    this.helper = new THREE.Box3Helper(this.stepHandler.getBounds(), 0xFFCC00)
    this.baseObject.add(this.accHelper);
    this.baseObject.add(this.helper);*/
    this.currentStep = this.stepHandler.getCurrentStepIndex();
    window.history.replaceState(this.currentStep, null, this.baseURL + this.currentStep);

    this.onWindowResize(true); // Ensure composer and passes are set up correctly.
    this.realignModel(0);
    this.onPLIMove(true);
    this.updateUIComponents(false);

    // Update local storage:
    localStorage.setItem('last_step_' + this.modelID, this.currentStep);
};

LDR.InstructionsManager.prototype.goToStep = function(step) {
    if(this.pliPreviewer && this.pliPreviewer.showsSomething()) {
        return; // Don't walk when showing preview.
    }

    console.log("Going to " + step + " from " + this.currentStep);
    let self = this;
    this.stepHandler.moveTo(step);
    this.handleStepsWalked();
}

LDR.InstructionsManager.prototype.nextStep = function() {
    if(this.pliPreviewer && this.pliPreviewer.showsSomething()) {
        return; // Don't walk when showing preview.
    }
    if(this.stepHandler.isAtLastStep()) {
        return;
    }

    let self = this;
    this.realignModel(1, () => self.stepHandler.nextStep(false), () => self.handleStepsWalked());
}

LDR.InstructionsManager.prototype.prevStep = function() {
    if(this.pliPreviewer && this.pliPreviewer.showsSomething()) {
        return; // Don't walk when showing preview.
    }

    let self = this;
    this.realignModel(-1, () => self.stepHandler.prevStep(false), () => self.handleStepsWalked());
}

LDR.InstructionsManager.prototype.clickDone = function() {
    let fadeInTime = 400;
    $('#done_holder, #done_background').fadeIn(fadeInTime);
    if(this.doneShown) {
        return;
    }
    this.doneShown = true;
    $('#done_holder').load('ajax/done.php', {model:'' + this.modelID});
}

/*
  Icon: {x, y, width, height, mult, key, partID, c, desc, inlined}
*/
LDR.InstructionsManager.prototype.onPLIClick = function(e) {
    let x = e.layerX || e.clientX;
    let y = e.layerY || e.clientY;
    if(!this.pliBuilder || !this.pliBuilder.clickMap) {
        return;
    }

    // Find clicked icon:
    let hits = this.pliBuilder.clickMap.filter(icon => x >= icon.x && y >= icon.y && x <= icon.x+icon.DX && y <= icon.y+icon.DY);
    if(hits.length === 0) {
        console.log('No icon was hit at ' + x + ', ' + y);
        return; // no hits.
    }
    let distSq = (x1,y1) => (x1-x)*(x1-x) + (y1-y)*(y1-y);
    let icon, bestDist;
    hits.forEach(candidate => {
            if(!icon) {
                icon = candidate;
            }
            else {
                let d = distSq(icon.x + candidate.DX*0.5, icon.y + candidate.DY*0.5);
                if(d < bestDist) {
                    bestDist = d;
                    icon = candidate;
                }
            }
        });

    if(this.canEdit && LDR.Options && LDR.Options.showEditor) {
        icon.part.original.ghost = !icon.part.original.ghost;
        this.stepHandler.updateMeshCollectors();
        this.updateUIComponents(true);
    }
    else { // Show preview if no editor:
        this.pliPreviewer.showPliPreview(icon);
        let pt = this.pliBuilder.getPartType(icon.partID);
        this.pliPreviewer.setPart(pt, icon.c);
    }
}

LDR.InstructionsManager.prototype.onPLIMove = function(e) {
    if(!(this.canEdit && LDR.Options && LDR.Options.showEditor && 
	 this.pliBuilder && this.pliBuilder.clickMap)) {
        return; // Not applicable.
    }

    let self = this;

    function update() {
	self.stepHandler && self.stepHandler.updateMeshCollectors();
	self.updatePLI(true);
	self.stepEditor && self.stepEditor.updateCurrentStep();
	self.render();
    }

    function unset() {
	if(self.hovered) {
	    self.hovered.hover = false;
	    self.hovered = false;
	}
	update();
    }

    if(!e) {
	this.lastPLIMoveX = this.lastPLIMoveY = -1e6;
	unset();
	return;
    }

    let x, y;
    if(e === true) {
	x = this.lastPLIMoveX;
	y = this.lastPLIMoveY;
    }
    else {
	x = this.lastPLIMoveX = e.layerX || e.clientX;
	y = this.lastPLIMoveY = e.layerY || e.clientY;	
    }

    // Find highlighted icon:
    let hits = this.pliBuilder.clickMap.filter(icon => x >= icon.x && y >= icon.y && x <= icon.x+icon.DX && y <= icon.y+icon.DY);
    if(hits.length === 0) {
	unset();
        return; // no hits.
    }
    let distSq = (x1,y1) => (x1-x)*(x1-x) + (y1-y)*(y1-y);
    let icon, bestDist;
    hits.forEach(candidate => {
            if(!icon) {
                icon = candidate;
            }
            else {
                let d = distSq(icon.x + candidate.DX*0.5, icon.y + candidate.DY*0.5);
                if(d < bestDist) {
                    bestDist = d;
                    icon = candidate;
                }
            }
        });

    if(icon.part.original !== self.hovered || e === true) {
        if(self.hovered) {
            self.hovered.hover = false; // Unhover old part.
        }
	self.hovered = icon.part.original;
	self.hovered.hover = true; // Hover new part.
	update();
    }
}

LDR.InstructionsManager.prototype.hidePliPreview = function() {
    this.pliPreviewer.hidePliPreview();
}

LDR.InstructionsManager.prototype.hideDone = function() {
    let fadeOutTime = 400;
    $('#done_holder, #done_background').fadeOut(fadeOutTime);
}

/*
  Assumes LDR.Options in global scope.
 */
LDR.InstructionsManager.prototype.setUpOptions = function(options) {
    let self = this;
    let optionsDiv = document.getElementById('options');

    LDR.Options.appendHeader(optionsDiv);    

    // Toggles:
    LDR.Options.appendContrastOptions(optionsDiv);
    if(!(options.hasOwnProperty('showStudsOptions') && !options.showStudsOptions)) {
        LDR.Options.appendStudHighContrastOptions(optionsDiv);
        LDR.Options.appendStudLogoOptions(optionsDiv);
    }

    // Other options:
    LDR.Options.appendOldBrickColorOptions(optionsDiv);
    LDR.Options.appendAnimationOptions(optionsDiv);

    LDR.Options.appendFooter(optionsDiv);
    LDR.Options.listeners.push(function(partGeometriesChanged) {
            if(partGeometriesChanged) { // Update all studs:
                self.ldrLoader.applyOnPartTypes(pt => {
                        if(pt.isPart) {
                            pt.geometry = pt.mesh = null;
                        }
                    });

                function callBack() {
                    self.stepHandler.rebuild();
                    self.stepHandler.moveTo(self.currentStep);
                    self.handleStepsWalked();
                    
                    self.stepHandler.updateMeshCollectors();
                    self.updateUIComponents(true);
                }
                LDR.Studs.setStuds(self.ldrLoader, LDR.Options.studHighContrast, 
                                   LDR.Options.studLogo, callBack); // Studs.
            }
            else {
                self.stepHandler.updateMeshCollectors();
                self.updateUIComponents(true);
            }
            self.ldrButtons.hideElementsAccordingToOptions();
            self.onWindowResize(true);
        });
}
'use strict';

LDR.InstructionsManager = function(modelUrl, modelID, mainImage, refreshCache, baseURL, stepFromParameters, options) {
    let startTime = new Date();
    let self = this;
    this.stepEditor;
    this.canEdit = options && options.canEdit; // Only set if LDRStepEditor.js is loaded.
    this.modelID = modelID;
    this.refreshCache = refreshCache;
    this.baseURL = baseURL;
    LDR.Colors.canBeOld = true;

    this.scene = new THREE.Scene(); // To add stuff to
    this.scene.background = new THREE.Color( 0xFFFFFF );

    //this.scene.add( new THREE.AxesHelper( 5 ) );

    this.defaultZoom = 1; // Will be overwritten.
    this.currentStep = 1; // Shown current step.
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000000 ); // Orthographics for LEGO
    this.pliW = 0;
    this.pliH = 0;
    // TODO: THIS DOES NOT WORKthis.maxSizePerPixel = 100000; // TODO: Update when clicking zoom and save using options.
    this.canvas = document.getElementById('main_canvas');
    this.renderer = new THREE.WebGLRenderer({antialias:true, canvas:this.canvas});

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
    this.ldrButtons = new LDR.Buttons(actions, canvasHolder, true, modelID, mainImage, this.canEdit);
    this.controls = new THREE.OrbitControls(this.camera, this.canvas);
    this.controls.noTriggerSize = 0.1;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('change', () => self.render());

    this.topButtonsHeight = 100; // px
    this.resetCameraPosition();

    window.addEventListener('resize', () => self.onWindowResize(), false);

    this.adPeek = 120;
    this.lastRefresh = new Date();
      
    this.currentRotationMatrix = new THREE.Matrix4(); 
    this.currentRotationMatrix.set(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1);
    this.defaultMatrix = new THREE.Matrix4();
    this.defaultMatrix.set(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1);

    this.ldrLoader; // To be set once model is loaded.
    this.stepHandler; // Set in 'onPartsRetrieved'
    this.pliElement = document.getElementById('pli');
    this.pliBuilder; // Set in 'onPartsRetrieved'
    this.pliHighlighted; // Set in onPLIClick. Indicates highlighted part for preview.

    this.baseObject = new THREE.Group();
    this.opaqueObject = new THREE.Group();
    this.transObject = new THREE.Group();
    this.baseObject.add(this.opaqueObject); // Draw non-trans before trans.
    this.baseObject.add(this.transObject);
    this.scene.add(this.baseObject);
    this.pliPreviewer = new LDR.PliPreviewer(modelID);

    this.showPLI = false;
    
    // Variables for realignModel:
    this.oldMultiplier = 1;
    this.currentMultiplier = 1;
    this.currentRotation = false;
    this.initialConfiguration = true;

    this.windowStepCauseByHistoryManipulation = false;
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
        if(e.keyCode == '13') { // ENTER
	    let stepToGoTo = parseInt(self.ldrButtons.stepInput.value);
	    self.goToStep(stepToGoTo);
        }
        else if(e.keyCode == '37') { // Left:
	    self.prevStep();
        }
        else if (e.keyCode == '39') { // Right:
            self.nextStep();
        }
        else if(e.keyCode == '27') { // ESC closes preview.
	    self.hidePliPreview();
            self.hideDone();
        }
    }
    document.onkeydown = handleKeyDown;
      
    let onLoad = function() {
        console.log("Done loading at " + (new Date()-startTime) + "ms.");

	// Ensure replaced parts are substituted:
	self.ldrLoader.substituteReplacementParts();

        // Find what should be built for first step:
        let mainModel = self.ldrLoader.mainModel;
        let origo = new THREE.Vector3();
        let inv = new THREE.Matrix3(); inv.set(1,0,0, 0,1,0, 0,0,1); // Invert Y-axis
        
        let pd = new THREE.LDRPartDescription(0, origo, inv, mainModel, false);
        
        self.pliBuilder = new LDR.PLIBuilder(self.ldrLoader,
                                             self.canEdit,
                                             mainModel,
                                             self.pliElement,
                                             document.getElementById('pli_render_canvas'));
        self.stepHandler = new LDR.StepHandler(self.opaqueObject, self.transObject, self.ldrLoader, [pd], true, self.storage);
        self.stepHandler.nextStep(false);

	self.realignModel(0);
	self.updateUIComponents(false);
	self.render(); // Updates background color.

        console.log("Render done after " + (new Date()-startTime) + "ms.");

	// Go to step indicated by parameter:
	if(stepFromParameters > 1) {
            self.stepHandler.moveSteps(stepFromParameters-1, () => self.handleStepsWalked());
        }
	else {
            self.ensureSwipeForwardWorks();
        }

	// Register location changes:
	window.addEventListener('popstate', function(e) {
                let step = e.state;
                if(self.windowStepCauseByHistoryManipulation || step === null) {
                    //console.log("Ignoring history manipulating step to: " + step);
                    self.windowStepCauseByHistoryManipulation = false;
                    return;
                }
                let diff = step - self.currentStep;
                //console.log("Step from window: " + step + ", diff: " + diff);
                if(diff === 1) {
                    self.nextStep();
                }
                else if(diff === -1) {
                    self.prevStep();
                }
                else {
                    self.stepHandler.moveSteps(diff, () => self.handleStepsWalked());
                }
            });

	// Enable pli preview:
        self.pliPreviewer.attachRenderer(document.getElementById('preview'));

        // Enable editor:
        if(self.canEdit) {
            function removeGeometries() {
                self.ldrLoader.applyOnPartTypes(pt => {
                        if(!pt.isPart()) {
                            pt.geometry = null;
                        }
                    });
            }
	    
            self.stepEditor = new LDR.StepEditor(self.ldrLoader, self.stepHandler,
                                                 removeGeometries, () => self.handleStepsWalked(),
                                                 self.modelID);
            self.stepEditor.createGuiComponents(document.getElementById('editor'));
            if(ldrOptions.showEditor === 1) {
                $("#editor").show();
            }
        }
    }

    let onStorageReady = function() {
        self.ldrLoader = new THREE.LDRLoader(onLoad, self.storage, options);
        LDR.Studs.setStuds(self.ldrLoader, ldrOptions.studHighContrast, 
                           ldrOptions.studLogo, () => self.ldrLoader.load(modelUrl));
    }

    document.getElementById("pli").addEventListener('click', e => self.onPLIClick(e));

    this.setUpOptions();
    this.onWindowResize();
    this.storage = new LDR.STORAGE(onStorageReady);
}

LDR.InstructionsManager.prototype.updateRotator = function(zoom) {
    let rotator = document.getElementById("rotator");
    let showRotator = this.stepHandler.getShowRotatorForCurrentStep();
    if(showRotator) {
        rotator.style.visibility = "visible";
        let rotatorAnimation = document.getElementById("rotator_animation");
        rotatorAnimation.beginElement();
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
        multiplier[0].style['font-size'] = "20vw";
        setTimeout(() => multiplier.animate({fontSize: "8vw"}, 200), 100);
    }
    this.oldMultiplier = this.currentMultiplier;
}

LDR.InstructionsManager.prototype.updateCameraZoom = function(zoom) {
    zoom = zoom || this.defaultZoom;
    this.camera.zoom = zoom;
    this.camera.updateProjectionMatrix();
}

LDR.InstructionsManager.prototype.render = function() {
    this.renderer.render(this.scene, this.camera);
}

LDR.InstructionsManager.prototype.setBackgroundColor = function(c) {
    this.scene.background = new THREE.Color(parseInt("0x" + c));
    document.body.style.backgroundColor = '#' + c;
}

LDR.InstructionsManager.prototype.onWindowResize = function(){
    this.topButtonsHeight = document.getElementById('top_buttons').offsetHeight;

    console.log("Resizing to " + window.innerWidth + ", " + window.innerHeight + " top height: " + this.topButtonsHeight + " and device pixel ratio: " + window.devicePixelRatio);
    let pixelRatio = window.devicePixelRatio;
    let w = (window.innerWidth-20);
    let h = (window.innerHeight-this.adPeek);
    this.renderer.setPixelRatio(pixelRatio);
    if(this.canvas.width !== w || this.canvas.height !== h) {
        this.renderer.setSize(w, h, true);
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
    this.updateCameraZoom();
    this.updateViewPort();
    this.camera.lookAt(new THREE.Vector3());
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

LDR.InstructionsManager.prototype.updatePLI = function(force) {
    let step = this.stepHandler.getCurrentStep();
    this.showPLI = ((ldrOptions.showEditor && this.canEdit) || ldrOptions.showPLI) && step.containsPartSubModels(this.ldrLoader);
    if(!this.showPLI) {
        this.pliBuilder.pliElement.style.display = 'none';
        this.pliW = this.pliH = 0;
        return;
    }
    this.pliBuilder.pliElement.style.display = 'inline';
    
    let maxWidth = window.innerWidth - this.pliElement.offsetLeft - 18;
    let maxHeight = (window.innerHeight - 130 - this.adPeek);
    
    if(window.innerWidth > window.innerHeight) {
        this.pliBuilder.drawPLIForStep(true, step, maxWidth*0.4, maxHeight, this.maxSizePerPixel, force);
    }
    else {
        this.pliBuilder.drawPLIForStep(false, step, maxWidth, maxHeight*0.35, this.maxSizePerPixel, force);
    }
    this.pliW = parseInt(this.pliElement.offsetWidth + this.pliElement.offsetLeft)+6; // 6 for border.
    this.pliH = parseInt(this.pliElement.offsetHeight);
    //console.log("Setting PLI size " + this.pliW + ", " + this.pliH + " from " + maxWidth + "/" + maxHeight + ", maxSizePerPixel=" + this.maxSizePerPixel + ', step=' + step);
}

LDR.InstructionsManager.prototype.updateViewPort = function() {
    this.camera.position.set(10000, 7000, 10000);

    let dx = 0;
    let dy = this.topButtonsHeight/2;

    if(!this.pliBuilder || this.pliW == 0) {
        // No move
    }
    else if(this.pliBuilder.fillHeight) {
        dx += this.pliW/2;
    }
    else {
        dy += this.pliH/2;
    }
    this.controls.panTo(dx, dy);
}

LDR.InstructionsManager.prototype.realignModel = function(stepDiff, onRotated, onDone) {
    let self = this;
    let oldRotationMatrix = this.currentRotationMatrix;
    let oldPosition = new THREE.Vector3();
    oldPosition.copy(this.baseObject.position);

    // PLI:
    let oldPLIW = this.pliW;
    let oldPLIH = this.pliH;
    let newPLIW, newPLIH;
    
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
    
    let viewPortWidth = window.innerWidth;
    let viewPortHeight = window.innerHeight - this.adPeek;// - 100;
    if(this.pliH > 0) { // Adjust for pli.
        if(this.pliBuilder.fillHeight) {
            viewPortWidth *= 0.6;
        }
        else {
            viewPortHeight *= 0.6;
        }
    }
    
    let useAccumulatedBounds = true;
    let b = this.stepHandler.getAccumulatedBounds();

    let size = b.min.distanceTo(b.max);
    let viewPortSize = Math.sqrt(this.viewPortWidth*this.viewPortWidth + this.viewPortHeight*this.viewPortHeight);
    //console.log("size=" + size + ", screen size=" + viewPortSize + ", size/screen=" + (size/viewPortSize));
    if(size > viewPortSize) {
        useAccumulatedBounds = false;
        b = this.stepHandler.getBounds();
        size = b.min.distanceTo(b.max);
        if(size < viewPortSize) {
            let b2 = new THREE.Box3(); b2.copy(b); b = b2;
            let bDiff = new THREE.Vector3(); bDiff.subVectors(b.max, b.min); // b.max-b.min
            // Move min and max: max = min + bDiff -> min + bDiff/2 + (bDiff/2*X) = min + bDiff - bDiff/2 + (bDiff/2*X) = max + (X-1)*bDiff/2
            bDiff.multiplyScalar(0.5*(viewPortSize/size-1));
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
    
    this.updatePLI(false); newPLIW = this.pliW, newPLIH = this.pliH;
    
    goBack();
    let rotationChanges = !this.currentRotationMatrix.equals(oldRotationMatrix);
    let ignorePos = new THREE.Vector3(); // Ignore
    let newRot = new THREE.Quaternion();
    let ignoreScale = new THREE.Vector3(); // Ignore
    this.currentRotationMatrix.decompose(ignorePos, newRot, ignoreScale);
    
    let positionChanges = !oldPosition.equals(newPosition) || 
    oldPLIW !== newPLIW || oldPLIH !== newPLIH;
    
    let oldDefaultZoom = this.defaultZoom;
    viewPortWidth = window.innerWidth;
    viewPortHeight = window.innerHeight - this.adPeek - this.topButtonsHeight;
    if(this.pliBuilder.fillHeight) {
        viewPortWidth -= newPLIW;
    }
    else {
        viewPortHeight -= newPLIH;
    }
    let scaleX = (window.innerWidth) / viewPortWidth * 1.1; // 1.1 to scale down a bit
    let scaleY = (window.innerHeight - this.adPeek) / viewPortHeight * 1.1;
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
        self.pliW = newPLIW;
        self.pliH = newPLIH;
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
    let animationTimeRotationMS = rotationChanges ? (2-ldrOptions.showStepRotationAnimations)*300 : 0; // First rotate, 
    let animationTimePositionMS = positionChanges ? (2-ldrOptions.showStepRotationAnimations)*150 : 0; // then move and zoom
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
        self.pliW = oldPLIW + (newPLIW-oldPLIW)*progress;
        self.pliH = oldPLIH + (newPLIH-oldPLIH)*progress;
        self.updateViewPort();
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
    if(ldrOptions.showStepRotationAnimations < 2 && // show animations
       Math.abs(stepDiff) === 1 && // Only stepping a single step &&
       !this.initialConfiguration && // This is not the initial step &&
       (zoomChanges || rotationChanges || positionChanges)) {
        animate();
    }
    else {
        finalize();
    }
}

    // Ensure mobile users can swipe right for next step:
LDR.InstructionsManager.prototype.ensureSwipeForwardWorks = function() {
    window.history.replaceState(this.currentStep, null, this.baseURL + this.currentStep);
    if(!this.stepHandler.isAtLastStep()) {
        window.history.pushState(this.currentStep+1, null, this.baseURL + (this.currentStep+1));
        this.windowStepCauseByHistoryManipulation = true;
        window.history.go(-1); // Go back again.
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
    this.ensureSwipeForwardWorks();
    this.realignModel(0);
    this.updateUIComponents(false);
    this.render();
};

LDR.InstructionsManager.prototype.goToStep = function(step) {
    if(this.pliHighlighted) {
        return; // Don't walk when showing preview.
    }

    let diff = step - this.currentStep;
    console.log("Going to " + step + " from " + this.currentStep);
    let self = this;
    this.stepHandler.moveSteps(step - self.currentStep, () => self.handleStepsWalked());
}

LDR.InstructionsManager.prototype.nextStep = function() {
    if(this.pliHighlighted) {
        return; // Don't walk when showing preview.
    }
    if(this.stepHandler.isAtLastStep()) {
        return;
    }

    let self = this;
    this.realignModel(1, () => self.stepHandler.nextStep(false), () => self.handleStepsWalked());
}

LDR.InstructionsManager.prototype.prevStep = function() {
    if(this.pliHighlighted) {
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
  Icon: {x, y, width, height, mult, key, partID, colorID, desc, inlined}
*/
LDR.InstructionsManager.prototype.onPLIClick = function(e) {
    let x = e.layerX || e.clientX;
    let y = e.layerY || e.clientY;
    //console.warn("Click " + x +","+y); console.dir(this.pliBuilder); console.dir(this);
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

    if(this.canEdit && ldrOptions.showEditor) {
        //console.log('Clicked icon:'); console.dir(icon);
        icon.part.original.ghost = !icon.part.original.ghost;
        this.stepHandler.updateMeshCollectors();
        this.updateUIComponents(true);
    }
    else { // Show preview if no editor:
        this.pliPreviewer.scene.remove(this.pliHighlighted);
        
        let pt = this.pliBuilder.getPartType(icon.partID);
        this.pliHighlighted = pt.mesh;
        this.pliPreviewer.scene.add(this.pliHighlighted);
        
        pt.pliMC.overwriteColor(icon.part.colorID);
        this.pliPreviewer.showPliPreview(icon);
        let b = pt.pliMC.boundingBox;
        let size = b.min.distanceTo(b.max) * 0.6;
        this.pliPreviewer.subjectSize = size;
        this.pliPreviewer.onResize();
    }
}

LDR.InstructionsManager.prototype.hidePliPreview = function() {
    this.pliPreviewer.hidePliPreview();
    this.pliPreviewer.scene.remove(this.pliHighlighted);
    this.pliHighlighted = null;
}

LDR.InstructionsManager.prototype.hideDone = function() {
    let fadeOutTime = 400;
    $('#done_holder, #done_background').fadeOut(fadeOutTime);
}

/*
  Assumes ldrOptions in global scope.
 */
LDR.InstructionsManager.prototype.setUpOptions = function() {
    let self = this;
    let optionsDiv = document.getElementById('options');

    ldrOptions.appendHeader(optionsDiv);    
    ldrOptions.appendOldBrickColorOptions(optionsDiv);
    ldrOptions.appendContrastOptions(optionsDiv);
    ldrOptions.appendStudHighContrastOptions(optionsDiv);
    ldrOptions.appendStudLogoOptions(optionsDiv);
    ldrOptions.appendAnimationOptions(optionsDiv);
    ldrOptions.appendShowPLIOptions(optionsDiv);
    ldrOptions.appendLROptions(optionsDiv, this.ldrButtons);
    ldrOptions.appendCameraOptions(optionsDiv, this.ldrButtons);

    ldrOptions.appendFooter(optionsDiv);
    ldrOptions.listeners.push(function(partGeometriesChanged) {
            if(partGeometriesChanged) { // Update all studs:
                self.ldrLoader.applyOnPartTypes(pt => {
                        if(pt.isPart()) {
                            pt.geometry = pt.mesh = null;
                        }
                    });

                function callBack() {
                    let stepIndex = self.stepHandler.getCurrentStepIndex();
                    self.stepHandler.rebuild();
                    self.stepHandler.moveSteps(stepIndex, () => {});
                    self.handleStepsWalked();
                    
                    self.stepHandler.updateMeshCollectors();
                    self.updateUIComponents(true);
                }
                LDR.Studs.setStuds(self.ldrLoader, ldrOptions.studHighContrast, 
                                   ldrOptions.studLogo, callBack); // Studs.
            }
            else {
                self.stepHandler.updateMeshCollectors();
                self.updateUIComponents(true);
            }
            self.ldrButtons.hideElementsAccordingToOptions();
        });
}
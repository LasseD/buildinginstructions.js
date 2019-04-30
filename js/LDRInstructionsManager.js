'use strict';

LDR.InstructionsManager = function(modelUrl, modelID, mainImage, refreshCache, baseURL, stepFromParameters, options) {
    var startTime = new Date();
    var self = this;
    this.stepEditor;
    this.canEdit = options && options.canEdit; // Only set if LDRStepEditor.js is loaded.
    this.modelID = modelID;
    this.refreshCache = refreshCache;
    this.baseURL = baseURL;
    LDR.Colors.canBeOld = true;

    this.scene = new THREE.Scene(); // To add stuff to
    this.scene.background = new THREE.Color( 0xFFFFFF );
    this.storage; // Will be set in onLoad()

    //this.scene.add( new THREE.AxesHelper( 5 ) );

    this.defaultZoom = 1; // Will be overwritten.
    this.currentStep = 1; // TODO: Fix stepping into void.
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000000 ); // Orthographics for LEGO
    this.pliW = 0;
    this.pliH = 0;
    // TODO: THIS DOES NOT WORKthis.maxSizePerPixel = 100000; // TODO: Update when clicking zoom and save using options.
    this.canvas = document.getElementById('main_canvas');
    this.renderer = new THREE.WebGLRenderer({antialias:true, canvas:this.canvas});

    var canvasHolder = document.getElementById('main_canvas_holder');
    var actions = {
        prevStep: () => self.prevStep(),
        nextStep: () => self.nextStep(),
        zoomIn: () => self.zoomIn(),
        zoomOut: () => self.zoomOut(),
        resetCameraPosition: () => self.resetCameraPosition(),
        clickDone: () => self.clickDone(),
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
    this.builder; // Set in 'onPartsRetrieved'
    this.pliElement = document.getElementById('pli');
    this.pliBuilder; // Set in 'onPartsRetrieved'
    this.pliShownPreview; // Set in onPLIClick

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
	    var stepToGoTo = parseInt(self.ldrButtons.stepInput.value);
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
      
    var onPartsRetrieved = function(ignoreWhatIsStillToBeBuilt) {
        console.log("Done loading at " + (new Date()-startTime) + "ms.");
	var mainModel = self.ldrLoader.mainModel;
	var origo = new THREE.Vector3();
	var inv = new THREE.Matrix3(); inv.set(1,0,0, 0,1,0, 0,0,1); // Invert Y-axis

	var pd = new THREE.LDRPartDescription(0, origo, inv, mainModel, false);

	self.pliBuilder = new LDR.PLIBuilder(self.ldrLoader,
                                             mainModel,
                                             0,
                                             self.pliElement,
                                             document.getElementById('pli_render_canvas'));
        self.builder = new LDR.StepBuilder(self.opaqueObject, self.transObject, self.ldrLoader, [pd], true, self.storage);
	self.builder.nextStep(false);
	self.realignModel(0);
	self.updateUIComponents(false);
	self.render(); // Updates background color.

        console.log("Render done after " + (new Date()-startTime) + "ms.");

	// Go to step indicated by parameter:
	stepFromParameters = self.clampStep(stepFromParameters);
	if(stepFromParameters > 1) {
            self.builder.moveSteps(stepFromParameters-1, walked => self.handleStepsWalked(walked));
        }
	else {
            self.ensureSwipeForwardWorks();
        }

	// Register location changes:
	window.addEventListener('popstate', function(e) {
                var step = e.state;
                if(self.windowStepCauseByHistoryManipulation || step === null) {
                    //console.log("Ignoring history manipulating step to: " + step);
                    self.windowStepCauseByHistoryManipulation = false;
                    return;
                }
                var diff = step - self.currentStep;
                //console.log("Step from window: " + step + ", diff: " + diff);
                if(diff === 1) {
                    self.nextStep();
                }
                else if(diff === -1) {
                    self.prevStep();
                }
                else {
                    self.builder.moveSteps(diff, walked => self.handleStepsWalked(walked));
                }
            });

	// Enable pli preview:
        self.pliPreviewer.attachRenderer(document.getElementById('preview'));

        // Enable editor:
        if(self.canEdit) {
            function onStepChange() {
                self.handleStepsWalked(0);
            }
            self.stepEditor = new LDR.StepEditor(self.ldrLoader, self.builder, onStepChange, self.modelID);
            self.stepEditor.createGuiComponents(document.getElementById('green'));
        }
    }

    var onLoad = function() {
	function onStorageReady() {
            var geometryBuilder = new LDR.GeometryBuilder(self.ldrLoader, self.storage);
            var toBeBuilt = geometryBuilder.getAllTopLevelToBeBuilt();

            if(self.storage.db) {
                self.storage.retrievePartsFromStorage(toBeBuilt, onPartsRetrieved);
            }
            else {
                onAllToBeBuiltIdentified(toBeBuilt);
            }
	}
 	self.storage = new LDR.STORAGE(onStorageReady);
    }

    document.getElementById("pli").addEventListener('click', e => self.onPLIClick(e));

    this.setUpOptions();
    this.onWindowResize();
    this.ldrLoader = new THREE.LDRLoader(onLoad, options);
    this.ldrLoader.load(modelUrl);
}

LDR.InstructionsManager.prototype.updateRotator = function(zoom) {
    var rotator = document.getElementById("rotator");
    if(this.currentRotation) {
        rotator.style.visibility = "visible";
        var rotatorAnimation = document.getElementById("rotator_animation");
        rotatorAnimation.beginElement();
    }
    else {
        rotator.style.visibility = "hidden";
    }
}

LDR.InstructionsManager.prototype.updateMultiplier = function(zoom) {
    var changes = this.oldMultiplier !== this.currentMultiplier;
    if(!changes) {
        return;
    }
    var multiplier = $('#multiplier');
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
    this.scene.background = new THREE.Color( parseInt("0x" + c) );
    document.body.style.backgroundColor = '#' + c;
}

LDR.InstructionsManager.prototype.onWindowResize = function(){
    this.topButtonsHeight = document.getElementById('top_buttons').offsetHeight;

    console.log("Resizing to " + window.innerWidth + ", " + window.innerHeight + " top height: " + this.topButtonsHeight + " and device pixel ratio: " + window.devicePixelRatio);
    var pixelRatio = window.devicePixelRatio;
    var w = (window.innerWidth-20);
    var h = (window.innerHeight-this.adPeek);
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
    if(this.builder) {
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
    this.currentMultiplier = this.builder.getMultiplierOfCurrentStep();
    this.currentRotation = this.builder.getRotationOfCurrentStep();
    this.updateMultiplier();
    this.updateRotator();
    this.setBackgroundColor(this.builder.getBackgroundColorOfCurrentStep());
    if(this.builder.isAtVeryLastStep()) {
        this.ldrButtons.atLastStep();
    }
    else if(this.builder.isAtFirstStep()) {
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
    var [step,stepColorID] = this.builder.getCurrentStepAndColor();
    this.showPLI = ldrOptions.showPLI && step.containsPartSubModels(this.ldrLoader);
    if(!this.showPLI) {
        this.pliBuilder.pliElement.style.display = 'none';
        this.pliW = this.pliH = 0;
        return;
    }
    this.pliBuilder.pliElement.style.display = 'inline';
    
    var maxWidth = window.innerWidth - this.pliElement.offsetLeft - 18;
    var maxHeight = (window.innerHeight - 130 - this.adPeek);
    
    if(window.innerWidth > window.innerHeight) {
        this.pliBuilder.drawPLIForStep(true, step, stepColorID, maxWidth*0.4, maxHeight, this.maxSizePerPixel, force);
    }
    else {
        this.pliBuilder.drawPLIForStep(false, step, stepColorID, maxWidth, maxHeight*0.35, this.maxSizePerPixel, force);
    }
    this.pliW = parseInt(this.pliElement.offsetWidth + this.pliElement.offsetLeft)+6; // 6 for border.
    this.pliH = parseInt(this.pliElement.offsetHeight);
    //console.log("Setting PLI size " + this.pliW + ", " + this.pliH + " from " + maxWidth + "/" + maxHeight + ", maxSizePerPixel=" + this.maxSizePerPixel + ', step=' + step);
}

LDR.InstructionsManager.prototype.updateViewPort = function() {
    //var size = this.renderer.getSize(); console.log('Updating viewport. PLI=' + this.pliW + 'x' + this.pliH + ' canvas: ' + size.width + 'x' + size.height + ' top ' + this.topButtonsHeight + ', pixel ratio: ' + window.devicePixelRatio);
    this.camera.position.set(10000, 7000, 10000);

    var dx = 0;
    var dy = this.topButtonsHeight/2;// * window.devicePixelRatio;

    if(!this.pliBuilder || this.pliW == 0) {
        // No move
    }
    else if(this.pliBuilder.fillHeight) {
        dx += this.pliW/2;
    }
    else {
        dy += this.pliH/2;
    }
    //console.log('Pans to ' + dx + ', ' + dy);
    this.controls.panTo(dx, dy);
}

LDR.InstructionsManager.prototype.realignModel = function(stepDiff, onRotated, onDone) {
    var self = this;
    var oldRotationMatrix = this.currentRotationMatrix;
    var oldPosition = new THREE.Vector3();
    oldPosition.copy(this.baseObject.position);

    // PLI:
    var oldPLIW = this.pliW;
    var oldPLIH = this.pliH;
    var newPLIW, newPLIH;
    
    var oldLevel = this.builder.getLevelOfCurrentStep();
    var newLevel = oldLevel;
    var goBack = function(){}; // Used for single steps
    if(stepDiff === 1 && this.builder.nextStep(true)) {
        goBack = function() {
            newLevel = self.builder.getLevelOfCurrentStep();
            self.builder.prevStep(true);
        };
    }
    else if(stepDiff === -1 && this.builder.prevStep(true)) {
        goBack = function() {
            newLevel = self.builder.getLevelOfCurrentStep();
            self.builder.nextStep(true);
        };
    }
    
    var viewPortWidth = window.innerWidth;
    var viewPortHeight = window.innerHeight - this.adPeek;// - 100;
    if(this.pliH > 0) { // Adjust for pli.
        if(this.pliBuilder.fillHeight) {
            viewPortWidth *= 0.6;
        }
        else {
            viewPortHeight *= 0.6;
        }
    }
    
    var useAccumulatedBounds = true;
    var b = this.builder.getAccumulatedBounds();
    var size = b.min.distanceTo(b.max);
    var viewPortSize = Math.sqrt(this.viewPortWidth*this.viewPortWidth + this.viewPortHeight*this.viewPortHeight);
    //console.log("size=" + size + ", screen size=" + viewPortSize + ", size/screen=" + (size/viewPortSize));
    if(size > viewPortSize) {
        useAccumulatedBounds = false;
        b = this.builder.getBounds();
        size = b.min.distanceTo(b.max);
        if(size < viewPortSize) {
            var b2 = new THREE.Box3(); b2.copy(b); b = b2;
            var bDiff = new THREE.Vector3(); bDiff.subVectors(b.max, b.min); // b.max-b.min
            // Move min and max: max = min + bDiff -> min + bDiff/2 + (bDiff/2*X) = min + bDiff - bDiff/2 + (bDiff/2*X) = max + (X-1)*bDiff/2
            bDiff.multiplyScalar(0.5*(viewPortSize/size-1));
            b.max.add(bDiff);
            b.min.sub(bDiff);
            size = viewPortSize;
        }
    }
    var newPosition;
    [newPosition, this.currentRotationMatrix] = this.builder.computeCameraPositionRotation(this.defaultMatrix, this.currentRotationMatrix, useAccumulatedBounds);
    
    // Find actual screen bounds:
    this.baseObject.setRotationFromMatrix(this.currentRotationMatrix);
    this.baseObject.updateMatrixWorld(true);
    var measurer = new LDR.Measurer(this.camera);
    var [dx,dy] = measurer.measure(b, this.baseObject.matrixWorld);
    
    // Update maxSizePerPixel:
    /*if(dx*window.innerWidth/viewPortWidth > dy*window.innerHeight/viewPortHeight) {
        this.maxSizePerPixel = size/viewPortWidth;//*window.devicePixelRatio;
    }
    else {
        this.maxSizePerPixel = size/viewPortHeight;//*window.devicePixelRatio;
    }*/
    this.updatePLI(false); newPLIW = this.pliW, newPLIH = this.pliH;
    
    goBack();
    var rotationChanges = !this.currentRotationMatrix.equals(oldRotationMatrix);
    var ignorePos = new THREE.Vector3(); // Ignore
    var newRot = new THREE.Quaternion();
    var ignoreScale = new THREE.Vector3(); // Ignore
    this.currentRotationMatrix.decompose(ignorePos, newRot, ignoreScale);
    
    var positionChanges = !oldPosition.equals(newPosition) || 
    oldPLIW !== newPLIW || oldPLIH !== newPLIH;
    
    var oldDefaultZoom = this.defaultZoom;
    viewPortWidth = window.innerWidth;
    viewPortHeight = window.innerHeight - this.adPeek - this.topButtonsHeight;
    if(this.pliBuilder.fillHeight) {
        viewPortWidth -= newPLIW;
    }
    else {
        viewPortHeight -= newPLIH;
    }
    var scaleX = (window.innerWidth) / viewPortWidth * 1.1; // 1.1 to scale down a bit
    var scaleY = (window.innerHeight - this.adPeek) / viewPortHeight * 1.1;
    if(dx*scaleX > dy*scaleY) {
        this.defaultZoom = 2*this.camera.zoom/(dx*scaleX);
    }
    else {
        this.defaultZoom = 2*this.camera.zoom/(dy*scaleY);
    }
    var newDefaultZoom = this.defaultZoom;
    var zoomChanges = oldDefaultZoom !== newDefaultZoom;
    
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
    
    var animationID;
    var startTime = new Date();
    var animationTimeRotationMS = rotationChanges ? (2-ldrOptions.showStepRotationAnimations)*300 : 0; // First rotate, 
    var animationTimePositionMS = positionChanges ? (2-ldrOptions.showStepRotationAnimations)*150 : 0; // then move and zoom
    if(stepDiff != 0 && newLevel !== oldLevel && newLevel-oldLevel === stepDiff) {
        animationTimeRotationMS = 0; // Don't rotate when stepping in.
        animationTimePositionMS = 0;
    }
    var animationTimeMS = animationTimePositionMS+animationTimeRotationMS;
    var lastPosition = oldPosition;
    function animate() {
        animationID = requestAnimationFrame(animate);
        
        var diffMS = new Date() - startTime;
        if(diffMS >= animationTimeMS) {
            cancelAnimationFrame(animationID); 
            finalize();
            return; // Done.
        }
        
        var progress = diffMS / animationTimeMS;
        self.defaultZoom = oldDefaultZoom + (newDefaultZoom-oldDefaultZoom)*progress;
        self.pliW = oldPLIW + (newPLIW-oldPLIW)*progress;
        self.pliH = oldPLIH + (newPLIH-oldPLIH)*progress;
        self.updateViewPort();
        self.updateCameraZoom();
        
        if(diffMS < animationTimeRotationMS) { // Rotate first.
            progress = diffMS/animationTimeRotationMS;
            
            var oldPos = new THREE.Vector3();
            var oldRot = new THREE.Quaternion();
            var oldScale = new THREE.Vector3();
            oldRotationMatrix.decompose(oldPos, oldRot, oldScale);
            var angleToTurn = oldRot.angleTo(newRot);
            oldRot.rotateTowards(newRot, angleToTurn*progress*1.1); // *1.1 Ensure it is fully turned.
            
            var invOldM4 = new THREE.Matrix4();
            invOldM4.getInverse(oldRotationMatrix);
            var tmpM4 = new THREE.Matrix4();
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
            
            var tmpPosition = new THREE.Vector3();
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
    if(this.currentStep != this.builder.totalNumberOfSteps) {
        window.history.pushState(this.currentStep+1, null, this.baseURL + (this.currentStep+1));
        this.windowStepCauseByHistoryManipulation = true;
        window.history.go(-1); // Go back again.
    }
}

LDR.InstructionsManager.prototype.clampStep = function(s) {
    if(s < 1) {
        return 1;
    }
    if(s > this.builder.totalNumberOfSteps) {
        return this.builder.totalNumberOfSteps;
    }
    return s;
}

LDR.InstructionsManager.prototype.handleStepsWalked = function(walkedSteps){
    // Helper. Uncomment next lines for step bounding boxes:
    /*if(this.helper) {
        this.baseObject.remove(this.helper);
    }
    if(this.accHelper) {
        this.baseObject.remove(this.accHelper);
    }
    this.accHelper = new THREE.Box3Helper(this.builder.getAccumulatedBounds(), 0x00FF00)
    this.helper = new THREE.Box3Helper(this.builder.getBounds(), 0xFFCC00)
    this.baseObject.add(this.accHelper);
    this.baseObject.add(this.helper);//*/
    this.currentStep = this.clampStep(this.currentStep + walkedSteps);
    this.ensureSwipeForwardWorks();
    //if(walkedSteps != 1 && walkedSteps != -1) {
        this.realignModel(0);
    //}
    this.updateUIComponents(false);
    this.render();
    // TODO: 
};

LDR.InstructionsManager.prototype.goToStep = function(step) {
    if(this.pliShownPreview) {
        return; // Don't walk when showing stuff.
    }

    step = this.clampStep(step);
    var diff = step - this.currentStep;
    console.log("Going to " + step + " from " + this.currentStep);
    this.builder.moveSteps(step - this.currentStep, walked => this.handleStepsWalked(walked));
}

LDR.InstructionsManager.prototype.nextStep = function() {
    if(this.pliShownPreview) {
        return; // Don't walk when showing stuff.
    }
    if(this.builder.isAtVeryLastStep()) {
        return;
    }

    var self = this;
    this.realignModel(1, function(){
            self.builder.nextStep(false);	      
	}, function() {
	    self.handleStepsWalked(1);
	});
}

LDR.InstructionsManager.prototype.prevStep = function() {
    if(this.pliShownPreview) {
        return; // Don't walk when showing stuff.
    }
    if(this.builder.isAtFirstStep()) {
        return;
    }

    var self = this;
    this.realignModel(-1, function(){
            self.builder.prevStep(false);
	}, function() {
            self.handleStepsWalked(-1);
	});
}

LDR.InstructionsManager.prototype.clickDone = function() {
    var fadeInTime = 400;
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
    var x = e.layerX || e.clientX;
    var y = e.layerY || e.clientY;
    //console.warn("Click " + x +","+y); console.dir(this.pliBuilder); console.dir(this);
    if(!this.pliBuilder || !this.pliBuilder.clickMap) {
        return;
    }

    // Find clicked icon:
    for(var i = 0; i < this.pliBuilder.clickMap.length; i++) {
        var icon = this.pliBuilder.clickMap[i];
        if(x >= icon.x && y >= icon.y && 
           x <= icon.x+icon.width+5 &&
           y <= icon.y+icon.height+12) {
            // Correct icon found! Now show preview:
            this.pliPreviewer.scene.remove(this.pliShownPreview);
            var pc = this.pliBuilder.getPC(icon.key);
            this.pliShownPreview = pc.mesh;
            this.pliPreviewer.scene.add(this.pliShownPreview);
            this.pliPreviewer.showPliPreview(icon);
            var b = pc.getBounds();
            var size = b.min.distanceTo(b.max) * 0.6;
            this.pliPreviewer.subjectSize = size;
            this.pliPreviewer.onResize();
            
            return;
        }
    }
}

LDR.InstructionsManager.prototype.hidePliPreview = function() {
    this.pliPreviewer.hidePliPreview();
    this.pliPreviewer.scene.remove(this.pliShownPreview);
    this.pliShownPreview = null;
}

LDR.InstructionsManager.prototype.hideDone = function() {
    var fadeOutTime = 400;
    $('#done_holder, #done_background').fadeOut(fadeOutTime);
}
	

/*
  Assumes ldrOptions in global scope.
 */
LDR.InstructionsManager.prototype.setUpOptions = function() {
    var self = this;
    var optionsDiv = document.getElementById('options');

    ldrOptions.appendHeader(optionsDiv);    
    ldrOptions.appendOldBrickColorOptions(optionsDiv);
    ldrOptions.appendContrastOptions(optionsDiv);
    ldrOptions.appendAnimationOptions(optionsDiv);
    ldrOptions.appendShowPLIOptions(optionsDiv);
    ldrOptions.appendLROptions(optionsDiv, this.ldrButtons);
    ldrOptions.appendCameraOptions(optionsDiv, this.ldrButtons);

    ldrOptions.appendFooter(optionsDiv);
    ldrOptions.listeners.push(function() {
      self.builder.updateMeshCollectors();
      self.updateUIComponents(true);
    });
}
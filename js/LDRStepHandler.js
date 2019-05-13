'use strict';

/*
The StepHandler is used for displaying step-by-step building instructions.

If a StepHandler more than one placed part, the color and ID are assumed to be the same as it represents a step where more than once submodel is placed onto a model. Only the first placed part is shown being built, while the rest are added in a "placement step". In this step all placed parts are place onto their parent model.

"current" is used to keep track of the currently shown step. If a model has X steps, then "current" can take the values:
- -1 to indicate that the model is not yet being being built (at the "pre step")
- 0 to X-1 to show the step at these positions
- X to show the placement step.

The builder supports the operations:
- nextStep: Single step forward (if possible)
- prevStep: Single step back (if possible)
- moveSteps: Go forward/back a specific number of steps.
- Various methods for trieving information regarding the current step (depth, quantities, etc.)
*/
var LDR = LDR || {};

LDR.StepHandler = function(opaqueObject, transObject, loader, partDescs, isForMainModel, storage) {
    this.opaqueObject = opaqueObject;
    this.transObject = transObject;
    this.loader = loader;
    this.partDescs = partDescs;
    this.isForMainModel = isForMainModel; // If true, then prevent stepping to current === -1.
    this.geometryBuilder = new LDR.GeometryBuilder(loader, storage);

    this.meshCollectors = []; // One for each step. null to represent non-built obejcts
    this.subStepHandlers = []; // One for each step. null to represent no step builder.
    this.current = -1; // �ndex of currently-shown step (call nextStep() to initialize)
    this.extraParts = partDescs.length > 1; // Replace with actual mesh builder once loaded.
    this.bounds = []; // Bounds for each step
    this.accumulatedBounds = []; // Accumulated bounds for each step
    
    var partDesc = partDescs[0];
    this.part = loader.partTypes[partDesc.ID];

    for(var i = 0; i < this.part.steps.length; i++) {
	var step = this.part.steps[i];
        if(step.containsNonPartSubModels(loader)) { // All are sub models (not parts):
            var subDescs = step.subModels.map(subModel => subModel.placeAt(partDesc));
            var subStepHandler = new LDR.StepHandler(opaqueObject, transObject, loader, subDescs, false, storage);
            this.subStepHandlers.push(subStepHandler);
        }
        else {
            this.subStepHandlers.push(null);
        }
	this.meshCollectors.push(null);
	this.bounds.push(null);
	this.accumulatedBounds.push(null);
    }
    this.bounds.push(null); // One more for placement step.
    this.accumulatedBounds.push(null); // One more for placement step.
    //console.log("Builder for " + partDesc.ID + " with " + this.part.steps.length + " normal steps.");
    if(isForMainModel) {
        this.recomputeStepIndices(1);
    }
}

LDR.StepHandler.prototype.recomputeStepIndices = function(firstShownIndex) {
    this.totalNumberOfSteps = this.part.steps.length;
    this.firstShownIndex = firstShownIndex;
    var shownIndex = firstShownIndex;
    for(var i = 0; i < this.subStepHandlers.length; i++) {
        let subHandler = this.subStepHandlers[i];
        if(subHandler) {
            subHandler.recomputeStepIndices(shownIndex);
            this.totalNumberOfSteps += subHandler.totalNumberOfSteps;
            shownIndex += subHandler.totalNumberOfSteps+1;
        }
        else {
            shownIndex++;
        }
    }
}

LDR.StepHandler.prototype.getCurrentStepIndex = function() {    
    var subStepHandler = this.subStepHandlers[this.current];
    if(subStepHandler) {
        return subStepHandler.getCurrentStepIndex();
    }
    var ret = this.firstShownIndex;
    for(var i = 0; i < this.current; i++) {
        let subStepHandler = this.subStepHandlers[i];
        if(subStepHandler) {
            ret += subStepHandler.totalNumberOfSteps+1;
        }
        else {
            ret++;
        }
    }
    return ret;
}

LDR.StepHandler.prototype.computeCameraPositionRotation = function(defaultMatrix, currentRotationMatrix, useAccumulatedBounds) {
    if(this.current === -1 || this.current === this.subStepHandlers.length)
	throw "Can't reposition in void for step " + this.current + " in " + this.part.ID;

    var subStepHandler = this.subStepHandlers[this.current];
    if((subStepHandler !== null) && !subStepHandler.isAtPlacementStep()) {
	return subStepHandler.computeCameraPositionRotation(defaultMatrix, currentRotationMatrix, useAccumulatedBounds); // Delegate to subStepHandler.
    }

    var stepRotation = this.part.steps[this.current].rotation;

    // Get the current model rotation matrix and model center:
    var pr = this.partDescs[0].rotation.elements;
    var modelCenter = new THREE.Vector3(); 
    if(useAccumulatedBounds) {
	this.accumulatedBounds[this.current].getCenter(modelCenter);
    }
    else {
	this.bounds[this.current].getCenter(modelCenter);
    }

    var partM4 = new THREE.Matrix4();
    partM4.set(pr[0], pr[3], pr[6], 0,
	       pr[1], pr[4], pr[7], 0,
	       pr[2], pr[5], pr[8], 0,
	       0,     0,     0,     1);
    var invM4 = new THREE.Matrix4();
    invM4.getInverse(partM4, true);

    var invY = new THREE.Matrix4();
    invY.set(1,0,0,0, 0,-1,0,0, 0,0,-1,0, 0,0,0,1);

    currentRotationMatrix = new THREE.Matrix4();
    currentRotationMatrix.set(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1);

    if(stepRotation !== null) {
	var rotationMatrix = stepRotation.getRotationMatrix(defaultMatrix);
	currentRotationMatrix.multiply(rotationMatrix);
    }

    currentRotationMatrix.multiply(invY);
    currentRotationMatrix.multiply(invM4);

    modelCenter.applyMatrix4(invM4);
    modelCenter.applyMatrix4(invY);
    if(rotationMatrix)
	modelCenter.applyMatrix4(rotationMatrix);

    modelCenter.negate();

    return [modelCenter, currentRotationMatrix];
}

/*
 Adds a step to the model. 

 If stepping into a sub model: 
  - Ghost everything earlier (show again once sub-model is done)
*/
LDR.StepHandler.prototype.nextStep = function(doNotEraseForSubModels) {
    if(this.isAtPlacementStep()) {
	return false; // Dont walk past placement step.
    }
    var subStepHandler = this.current === -1 ? null : this.subStepHandlers[this.current];
    var meshCollector = this.current === -1 ? null : this.meshCollectors[this.current];
    var willStep = (subStepHandler === null) || subStepHandler.isAtPlacementStep();

    // Special case: Step to placement step.
    if((this.current === this.subStepHandlers.length-1) && willStep) { 
	this.updateMeshCollectors(false); // Make whole subStepHandler new (for placement):
	this.drawExtras();
	this.current++;
	return true;
    }

    // Step to next:
    if(willStep) {
	if(subStepHandler)
	    subStepHandler.updateMeshCollectors(true); // Make previous step 'old'.
	else if(meshCollector)
	    meshCollector.draw(true); // Make previous step 'old'.
	this.current++; // Point to next step.
	subStepHandler = this.subStepHandlers[this.current];
    }

    // Build what is new:
    if(subStepHandler === null) { // Only build DAT-parts:
	var meshCollector = this.meshCollectors[this.current];
	if(meshCollector === null) {
	    var pd = this.partDescs[0];
            meshCollector = new LDR.MeshCollector(this.opaqueObject, this.transObject);
	    var step = this.part.steps[this.current];

	    this.geometryBuilder.buildStep(step); // Ensure geometries
	    step.generateThreePart(this.loader, pd.colorID, pd.position, pd.rotation, true, false, meshCollector);
	    this.meshCollectors[this.current] = meshCollector;
	    this.setCurrentBounds(meshCollector.boundingBox);

	    // Helper. Uncomment next line for bounding boxes:
	    //this.opaqueObject.add(new THREE.Box3Helper(meshCollector.boundingBox, 0xff0000));
	}
	else {
	    meshCollector.draw(false); // New part is not 'old'.
	    meshCollector.setVisible(true);
	}
    }
    else { // LDR sub-models:
	if(subStepHandler.current === -1) {
	    // We have just stepped into this sub-model: Set all previous steps to invisible (they are already marked as old):
	    if(!doNotEraseForSubModels)
		this.setVisibleUpTo(false, this.current);
	}
	subStepHandler.nextStep(doNotEraseForSubModels);
	if(subStepHandler.isAtPlacementStep()) {
	    // Add bounds:
	    if(this.bounds[this.current] === null) {
		var b = subStepHandler.accumulatedBounds[subStepHandler.subStepHandlers.length];
		this.setCurrentBounds(b);
	    }

	    if(!doNotEraseForSubModels) {
		this.setVisibleUpTo(true, this.current); // Show the invisible steps again.
	    }
	}
    }
    return true;
}

/*
This function is for setting correct visibility after having stepped without updating visibilities:
*/
LDR.StepHandler.prototype.cleanUpAfterWalking = function() {
    var subStepHandler = this.current === -1 ? null : this.subStepHandlers[this.current];
    if(subStepHandler) {
	subStepHandler.cleanUpAfterWalking();
    }

    if(subStepHandler && !subStepHandler.isAtPlacementStep()) {
	// Currently showing a subStepHandler not at its placement step: Clear everything else!
	for(var i = 0; i < this.subStepHandlers.length; i++) {
	    var t = this.meshCollectors[i];
	    if(t !== null && t.isVisible()) {
		t.setVisible(false);
	    }
	    var s = this.subStepHandlers[i];
	    if(s && i != this.current) {
		s.setVisible(false);
	    }
	}
	if(this.extraParts && this.extraParts.isMeshCollector) {
	    this.extraParts.setVisible(false);
	}
    }
    else {
	// Currently in a non-subStepHandler step, or placement step: Clear all after this step:
	for(var i = 0; i < this.subStepHandlers.length; i++) {
	    var t = this.meshCollectors[i];
	    var v = i <= this.current; // Make everything up to current step visible.
	    if(t !== null && t.isVisible() !== v) {
		t.setVisible(v);
	    }
	    var s = this.subStepHandlers[i];
	    if(s) {
		s.setVisible(v);
	    }
	}
	if(this.extraParts && this.extraParts.isMeshCollector) {
	    this.extraParts.setVisible(this.isAtPlacementStep());
	}
    }
}

LDR.StepHandler.prototype.getAccumulatedBounds = function() {
    if(this.current === -1) {
        throw "Can't get bounds for pre step!";
    }
    var subStepHandler = this.subStepHandlers[this.current];
    if(subStepHandler && !subStepHandler.isAtPlacementStep()) {
	var ret = subStepHandler.getAccumulatedBounds();
	if(ret)
	    return ret;
    }
    return this.accumulatedBounds[this.current];
}

LDR.StepHandler.prototype.getBounds = function() {
    var subStepHandler = this.subStepHandlers[this.current];
    if(subStepHandler && !subStepHandler.isAtPlacementStep()) {
	var ret = subStepHandler.getBounds();
	if(ret)
	    return ret;
    }
    return this.bounds[this.current];
}

LDR.StepHandler.prototype.setCurrentBounds = function(b) {
    if(this.current === 0) {
	if(!b)
	    throw "Illegal state: Empty first step!";
	this.accumulatedBounds[this.current] = this.bounds[this.current] = b;
	return;
    }
    this.bounds[this.current] = b;

    var prevAccumulatedBounds = new THREE.Box3();
    prevAccumulatedBounds.copy(this.accumulatedBounds[this.current-1]);
    this.accumulatedBounds[this.current] = prevAccumulatedBounds;
    if(b) {
	this.accumulatedBounds[this.current].expandByPoint(b.min);
	this.accumulatedBounds[this.current].expandByPoint(b.max);
    }
}

LDR.StepHandler.prototype.getCurrentStepAndColor = function() {
    var subStepHandler = this.subStepHandlers[this.current];
    if(!subStepHandler || subStepHandler.isAtPlacementStep())
	return [this.part.steps[this.current], this.partDescs[0].colorID];
    return subStepHandler.getCurrentStepAndColor();
}

LDR.StepHandler.prototype.getCurrentPartAndStepIndex = function() {
    var subStepHandler = this.subStepHandlers[this.current];
    if(!subStepHandler || subStepHandler.isAtPlacementStep())
	return [this.part, this.current];
    return subStepHandler.getCurrentPartAndStepIndex();
}

LDR.StepHandler.prototype.getMultiplierOfCurrentStep = function() {
    var subStepHandler = this.subStepHandlers[this.current];
    var ret = this.partDescs.length;
    if(!subStepHandler || subStepHandler.isAtPlacementStep())
	return ret; // If a subStepHandler is not active (or at placement step), then return the number of parts this subStepHandler returns. 
    return ret * subStepHandler.getMultiplierOfCurrentStep();
}

LDR.StepHandler.prototype.getRotationOfCurrentStep = function() {
    var subStepHandler = this.subStepHandlers[this.current];
    if(!subStepHandler || subStepHandler.isAtPlacementStep()) {
	if(this.current === 0 || 
           THREE.LDRStepRotation.equals(this.part.steps[this.current].rotation,
                                        this.part.steps[this.current-1].rotation)) {
	    return false;
        }
	return this.part.steps[this.current].rotation || 
	       this.part.steps[this.current-1].rotation;
    }
    return subStepHandler.getRotationOfCurrentStep();
}

LDR.BackgroundColors = Array("ffffff", "FFFF88", "CCFFCC", "FFBB99", "99AAFF", "FF99FF", "D9FF99", "FFC299");
LDR.StepHandler.prototype.getBackgroundColorOfCurrentStep = function() {
    var level = this.getLevelOfCurrentStep();
    return LDR.BackgroundColors[level%LDR.BackgroundColors.length];
}

LDR.StepHandler.prototype.getLevelOfCurrentStep = function() {
    var subStepHandler = this.subStepHandlers[this.current];
    if(!subStepHandler || subStepHandler.isAtPlacementStep())
	return 0;
    return 1+subStepHandler.getLevelOfCurrentStep();
}

LDR.StepHandler.prototype.drawExtras = function() {
    var len = this.subStepHandlers.length;
    if(!this.extraParts) { // No extra parts to draw: Copy from previous step:
	if(!this.bounds[len]) {
	    this.accumulatedBounds[len] = this.accumulatedBounds[len-1];
	    this.bounds[len] = this.bounds[len-1];
	}
	return; // Done.
    }

    if(this.extraParts === true) { // Not already loaded
	this.extraParts = new LDR.MeshCollector(this.opaqueObject, this.transObject);

	var prevAccumulatedBounds = new THREE.Box3();
	prevAccumulatedBounds.copy(this.accumulatedBounds[len-1]);
	this.bounds[len] = this.accumulatedBounds[len] = prevAccumulatedBounds;

	// Add all extra parts to mesh collector:
	for(var i = 1; i < this.partDescs.length; i++) {
	    var pd = this.partDescs[i];
	    // Here it is not necessary to run any "geometryBuilder.buildPart..." due to all parts having already been loaded when the first submodel was built.
	    this.part.generateThreePart(this.loader, pd.colorID, pd.position, pd.rotation, true, false, this.extraParts);
	}

	var b = this.extraParts.boundingBox;
	this.accumulatedBounds[len].expandByPoint(b.min);
	this.accumulatedBounds[len].expandByPoint(b.max);
    }
    else {
	this.extraParts.setVisible(true);
    }
}

/*
 takes a step back in the building instructions (see nextStep()).
*/
LDR.StepHandler.prototype.prevStep = function(doNotEraseForSubModels) {
    if(this.isAtPreStep() || (this.isForMainModel && this.current === 0)) {
	return false; // Can't move further. Fallback.
    }

    // Step down from placement step:
    if(this.isAtPlacementStep()) {
	if(this.extraParts) {
	    this.extraParts.setVisible(false);
	}
	// Update all previous steps to be old:
	for(var i = 0; i < this.subStepHandlers.length-1; i++) {
	    var t = this.meshCollectors[i];
	    if(t !== null) {
		t.draw(true);
	    }
	    var s = this.subStepHandlers[i];
	    if(s) {
		s.updateMeshCollectors(true);
	    }
	}
	
	this.current--;
	return true;
    }

    var subStepHandler = this.subStepHandlers[this.current];
    if(subStepHandler === null) { // Remove standard step:
    	var meshCollector = this.meshCollectors[this.current];
	meshCollector.setVisible(false);
	this.stepBack();
    }
    else { // There is a subStepHandler, so we have to step inside of it:
	if(subStepHandler.isAtPlacementStep() && !doNotEraseForSubModels) {
	    this.setVisibleUpTo(false, this.current);
	}
	subStepHandler.prevStep(doNotEraseForSubModels);
	if(subStepHandler.isAtPreStep()) {
	    if(!doNotEraseForSubModels)
		this.setVisibleUpTo(true, this.current);
	    this.stepBack();
	}
    }
    return true;
}

LDR.StepHandler.prototype.stepBack = function() {    
    this.current--;
    if(this.current === -1) {
	return;
    }
    var t = this.meshCollectors[this.current];
    if(t) {
	t.draw(false);
    }
    var s = this.subStepHandlers[this.current];
    if(s) {
	s.updateMeshCollectors(false);
    }
}

LDR.StepHandler.prototype.moveSteps = function(steps, onDone) {
    var walked = 0;
    while(true) {
	if(steps === 0 || !(steps > 0 ? this.nextStep(true) : this.prevStep(true))) {
	    this.cleanUpAfterWalking();
	    onDone(walked);
	    return;
	}
	if(steps > 0) {
	    walked++;
	    steps--;
	}
	else {
	    walked--;
	    steps++;
	}
    }
}

LDR.StepHandler.prototype.isAtPreStep = function() {
    return this.current === -1;
}

LDR.StepHandler.prototype.isAtFirstStep = function() {
    var subStepHandler = this.subStepHandlers[0];
    return this.current === 0 && ((subStepHandler === null) || subStepHandler.isAtFirstStep());
}

LDR.StepHandler.prototype.isAtPlacementStep = function() {
    return this.current === this.subStepHandlers.length;
}

LDR.StepHandler.prototype.isAtLastStep = function() {
    if(this.isAtPlacementStep())
	return true;
    if(this.current < this.subStepHandlers.length-1)
	return false;
    var subStepHandler = this.subStepHandlers[this.current];
    return (subStepHandler === null) || subStepHandler.isAtPlacementStep();    
}

LDR.StepHandler.prototype.setVisibleUpTo = function(v, idx) {
    for(var i = 0; i < idx; i++) {
	var t = this.meshCollectors[i];
	if(t) {
	    t.setVisible(v);
	    continue;
	}
	var s = this.subStepHandlers[i];
	if(s) {
	    s.setVisible(v);
	}
    }
}

LDR.StepHandler.prototype.setVisible = function(v) {
    this.setVisibleUpTo(v, this.subStepHandlers.length);
    if(this.extraParts && this.extraParts.isMeshCollector) {
	this.extraParts.setVisible(v);
    }
}

LDR.StepHandler.prototype.updateMeshCollectors = function(old) {
    for(var i = 0; i < this.subStepHandlers.length; i++) {
	var t = this.meshCollectors[i];
	if(t !== null) {
	    var tOld = old;
	    if(tOld === undefined) {
		tOld = t.old;
            }
	    t.draw(tOld);
	}
	var s = this.subStepHandlers[i];
	if(s) {
	    s.updateMeshCollectors(old);
	}
    }
    if(this.extraParts && this.extraParts.isMeshCollector) {
	var tOld = old;
	if(tOld === undefined) {
	    tOld = this.extraParts.old;
        }
	this.extraParts.draw(tOld);
    }
}

LDR.StepHandler.prototype.destroy = function() {
    for(var i = 0; i < this.subStepHandlers.length; i++) {
	var t = this.meshCollectors[i];
	if(t !== null) {
	    t.destroy();
	}
	var s = this.subStepHandlers[i];
	if(s) {
	    s.destroy();
	}
    }  
}

//
// Editor operations:
//
LDR.StepHandler.prototype.removeGhosted = function() {
    var step = this.part.steps[this.current];
    var mc = this.meshCollectors[this.current];
    if(!step || !mc) {
        console.warn('Not at a step where parts can be removed.');
        return [[], [], []]; // Empty result set
    }
    // Remove ghosted parts from both step and mc:
    var removedPartDescriptions = step.subModels.filter(pd => pd.ghost);
    step.subModels = step.subModels.filter(pd => !pd.ghost); // Update step.
    var [lineObjects, triangleObjects] = mc.removeGhostedParts();
    return [removedPartDescriptions, lineObjects, triangleObjects];
}

LDR.StepHandler.prototype.colorGhosted = function(colorID) {
    // Set new materials on ghosted parts:
    // TODO!
}
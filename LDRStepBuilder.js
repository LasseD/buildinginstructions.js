/*
The LDRStepBulder is used for displaying step-by-step building instructions.

An LDRStepBulder object represents one or more a placed parts (LDRPartDescription).

If more than one placed part, the color and ID are assumed to be the same as it represents a step where more than once submodel is placed onto a model. Only the first placed part is shown being built, while the rest are added in a "placement step". In this step all placed parts are place onto their parent model.

"current" is used to keep track of the currently shown step. If a model has X steps, then "current" can take the values:
- -1 to indicate that the model is not yet being being built (at the "pre step")
- 0 to X-1 to show the step at these positions
- X to show the placement step.

The builder supports the operations:
- nextStep: Single step forward (if possible)
- prevStep: Single step back (if possible)
- fastForward: Go to last step of currently-active model. Unless at placement-step, then do it for next model.
- fastReverse: Go to first step of currently-active model. Unless at placement-step, then do it for next model.
- goToStep: Go to a specific step. TODO
*/
THREE.LDRStepBuilder = function(ldrLoader, partDescs) {
    this.ldrLoader = ldrLoader;
    this.partDescs = partDescs;

    this.threeParts = []; // One for each step. null to represent non-built obejcts
    this.subBuilders = []; // One for each step. null to represent no step builder.
    this.current = -1; // Índex of currently-shown step (call nextStep() to initialize)
    this.extraThreeParts = partDescs.length > 1; // Replace with actual three parts once loaded.
    this.bounds = []; // Bounds for each step
    
    var partDesc = partDescs[0];
    //console.log("Builder for " + partDesc.ID);
    this.part = ldrLoader.ldrPartTypes[partDesc.ID];
    for(var i = 0; i < this.part.steps.length; i++) {
	var step = this.part.steps[i];
	if(step.ldrs.length > 0) {
	    var subDescs = [];
	    for(var j = 0; j < step.ldrs.length; j++) {
		var placed = step.ldrs[j].placeAt(partDesc);
		subDescs.push(placed);
	    }
	    var subStepBuilder = new THREE.LDRStepBuilder(ldrLoader, subDescs);
	    this.subBuilders.push(subStepBuilder);	    
	}
	else {
	    this.subBuilders.push(null);
	}
	this.threeParts.push(null);
	this.bounds.push(null);
    }
    this.bounds.push(null); // One more for placement step.
}

// TODO: Zoom.
THREE.LDRStepBuilder.prototype.repositionForCamera = function(world, defaultMatrix, currentRotationMatrix) {
    if(this.current == -1 || this.current == this.subBuilders.length)
	throw "Can't reposition in void! " + this.current;
    var subBuilder = this.subBuilders[this.current];
    if((subBuilder !== null) && !subBuilder.isAtPlacementStep()) {
	return subBuilder.repositionForCamera(world, defaultMatrix, currentRotationMatrix); // Delegate to subBuilder.
    }

    var stepRotation = this.part.steps[this.current].rotation;

    // Get the current model rotation matrix:
    var pr = this.partDescs[0].rotation.elements;
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
	var rotationMatrix = stepRotation.getRotationMatrix(defaultMatrix, currentRotationMatrix);
	currentRotationMatrix.multiply(rotationMatrix);
    }

    currentRotationMatrix.multiply(invY);
    currentRotationMatrix.multiply(invM4);

    world.setRotationFromMatrix(currentRotationMatrix);

    var modelCenter = new THREE.Vector3(); 
    modelCenter.copy(this.bounds[this.current].getCenter());
    modelCenter.applyMatrix4(invM4);
    modelCenter.applyMatrix4(invY);
    if(rotationMatrix)
	modelCenter.applyMatrix4(rotationMatrix);
    world.position.x = -modelCenter.x;
    world.position.y = -modelCenter.y;
    world.position.z = -modelCenter.z;

    return currentRotationMatrix;
}

/*
 Adds a step to the model. 

 If stepping into a sub model: 
  - Ghost everything earlier (show again once sub-model is done)
*/
THREE.LDRStepBuilder.prototype.nextStep = function(scene) {
    if(this.isAtPlacementStep()) {
	return; // Dont walk past placement step.
    }
    var subBuilder = this.current == -1 ? null : this.subBuilders[this.current];
    var willStep = (subBuilder === null) || subBuilder.isAtPlacementStep();

    // Special case: Step to placement step.
    if((this.current === this.subBuilders.length-1) && willStep) { 
	this.drawExtras(scene);
	this.current++;
	return;
    }

    // Step to next:
    if(willStep) {
	this.current++; // Point to next step.
	subBuilder = this.subBuilders[this.current];
    }

    // Build what is new:
    if(subBuilder === null) { // Only build DAT-parts:
	var threePart = this.threeParts[this.current];
	if(threePart === null) {
	    var pd = this.partDescs[0];
            threePart = new THREE.Group();
	    var step = this.part.steps[this.current];
	    var b = step.generateThreePart(this.ldrLoader, pd.colorID, pd.position, pd.rotation, false, threePart);
	    //threePart.add(new THREE.Box3Helper(b, 0xffff00));

	    this.setCurrentBounds(b);
	    this.threeParts[this.current] = threePart;
	    scene.add(threePart);
	}
	else {
	    threePart.visible = true;
	}
    }
    else { // LDR sub-models:
	if(subBuilder.current == -1) {
	    // We have just stepped into this sub-model: Set all previous steps to invisible:
	    this.setVisibleUpTo(false, this.current);
	}
	subBuilder.nextStep(scene);
	if(subBuilder.isAtPlacementStep()) {
	    // Add bounds:
	    if(this.bounds[this.current] === null) {
		var b = subBuilder.bounds[subBuilder.subBuilders.length];
		this.setCurrentBounds(b);
	    }

	    this.setVisibleUpTo(true, this.current); // Show the invisible steps again.
	}
    }
}

THREE.LDRStepBuilder.prototype.getBounds = function() {
    var subBuilder = this.subBuilders[this.current];
    if(subBuilder && !subBuilder.isAtPlacementStep()) {
	var ret = subBuilder.getBounds();
	if(ret)
	    return ret;
    }
    return this.bounds[this.current];
}

THREE.LDRStepBuilder.prototype.setCurrentBounds = function(b) {
    if(this.current === 0) {
	if(!b)
	    throw "Illegal state: Empty first step!";
	this.bounds[this.current] = new THREE.Box3(b.min, b.max);
	return;
    }

    var prevBounds = new THREE.Box3();
    prevBounds.copy(this.bounds[this.current-1]);
    this.bounds[this.current] = prevBounds;
    if(b) {
	this.bounds[this.current].expandByPoint(b.min);
	this.bounds[this.current].expandByPoint(b.max);
    }
}

THREE.LDRStepBuilder.prototype.drawExtras = function(scene) {
    if(!this.extraThreeParts) {
	if(this.bounds[this.subBuilders.length] === null) {
	    var b = this.bounds[this.subBuilders.length-1];
	    this.bounds[this.subBuilders.length] = new THREE.Box3(b.min, b.max);
	}
	return;
    }

    if(this.extraThreeParts === true) { // Not already loaded
	this.extraThreeParts = new THREE.Group();
	var prevBounds = new THREE.Box3();
	prevBounds.copy(this.bounds[this.subBuilders.length-1]);
	this.bounds[this.subBuilders.length] = prevBounds;
	for(var i = 1; i < this.partDescs.length; i++) {
	    var pd = this.partDescs[i];
	    var b = this.part.generateThreePart(this.ldrLoader, pd.colorID, pd.position, pd.rotation, false, this.extraThreeParts);
	    if(this.subBuilders.length >= 2) {
		this.bounds[this.subBuilders.length].expandByPoint(b.min);
		this.bounds[this.subBuilders.length].expandByPoint(b.max);
	    }
	}
	scene.add(this.extraThreeParts);
    }
    else {
	this.extraThreeParts.visible = true;
    }
}

/*
 takes a step back in the building instructions (see nextStep()).
*/
THREE.LDRStepBuilder.prototype.prevStep = function(scene) {
    if(this.isAtPreStep()) {
	return; // Can't move further. Fallback.
    }

    // Step down from placement step:
    if(this.isAtPlacementStep()) {
	if(this.extraThreeParts)
	    this.extraThreeParts.visible = false;
	this.current--;
	return;
    }

    var subBuilder = this.subBuilders[this.current];
    if(subBuilder === null) { // Remove standard step:
    	var threePart = this.threeParts[this.current];
	threePart.visible = false;
	this.current--;
    }
    else { // There is a subBuilder, so we have to step inside of it:
	if(subBuilder.isAtPlacementStep()) {
	    this.setVisibleUpTo(false, this.current);
	}
	subBuilder.prevStep(scene);
	if(subBuilder.isAtPreStep()) {
	    this.setVisibleUpTo(true, this.current);
	    this.current--;
	}
    }
}

THREE.LDRStepBuilder.prototype.fastForward = function(scene) {
    // Find active builder:
    var b = this;
    while(b.current < b.subBuilders.length && b.subBuilders[b.current] !== null) {
	b = b.subBuilders[b.current];
    }
    // Step if at last step of builder:
    if(b.isAtLastStep()) {
	this.nextStep(scene);
	// Find active builder now:
	b = this;
	while(b.current < b.subBuilders.length && b.subBuilders[b.current] !== null) {
	    b = b.subBuilders[b.current];
	}
    }
    while(!b.isAtLastStep())
	this.nextStep(scene);
}
THREE.LDRStepBuilder.prototype.fastReverse = function(scene) {
    // Find active builder:
    var b = this;
    while(b.current < b.subBuilders.length && 
       b.subBuilders[b.current] !== null) {
	b = b.subBuilders[b.current];
    }
    // Step if at last step of builder:
    if(b.isAtFirstStep()) {
	this.prevStep(scene);
	b = this;
	while(b.current < b.subBuilders.length && b.subBuilders[b.current] !== null) {
	    b = b.subBuilders[b.current];
	}
    }
    while(!b.isAtFirstStep())
	this.prevStep(scene);
}

THREE.LDRStepBuilder.prototype.isAtPreStep = function() {
    return this.current === -1;
}
THREE.LDRStepBuilder.prototype.isAtFirstStep = function() {
    var subBuilder = this.subBuilders[0];
    return this.current === 0 && ((subBuilder === null) || subBuilder.isAtFirstStep());
}
THREE.LDRStepBuilder.prototype.isAtPlacementStep = function() {
    return this.current == this.subBuilders.length;
}
THREE.LDRStepBuilder.prototype.isAtLastStep = function() {
    if(this.isAtPlacementStep())
	return true;
    if(this.current < this.subBuilders.length-1)
	return false;
    var subBuilder = this.subBuilders[this.current];
    return (subBuilder === null) || subBuilder.isAtPlacementStep();    
}
THREE.LDRStepBuilder.prototype.isAtVeryLastStep = function() {
    return this.isAtLastStep() && !this.extraThreeParts;
}

THREE.LDRStepBuilder.prototype.setVisibleUpTo = function(v, idx) {
    for(var i = 0; i < idx; i++) {
	var t = this.threeParts[i];
	if(t !== null)
	    t.visible = v;
	var s = this.subBuilders[i];
	if(s)
	    s.setVisible(v);
    }
}
THREE.LDRStepBuilder.prototype.setVisible = function(v) {
    this.setVisibleUpTo(v, this.subBuilders.length);
    if(this.extraThreeParts)
	this.extraThreeParts.visible = v;
}
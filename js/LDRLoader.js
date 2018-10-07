'use strict';

/**
 * @author Lasse Deleuran | c-mt.dk and brickhub.org
 * LDR Specification: http://www.ldraw.org/documentation/ldraw-org-file-format-standards.html
 *
 * Special note about colors. 
 * LDraw ID's are used for identifying colors efficiently. However. An LDraw color has both an ordinary value and an 'edge' value which can be used for rendering. In order to simplify the data model for storing geometries by colors, geometries colored in edge colors have '10.000' added to their ID's. An 'edge' color is thus identified by ID's being >= 10000 and the LDraw ID can be obtained by subtracting 10000.
 * This choice is internal to the loader and transparent to code that uses LDRLoader.
 *
 * Parameters manager, onLoad, onProgress and onError are standard for Three.js loaders.
 * onWarning and loadRelatedFilesImmediately are optional:
 * onWarning(warningObj) is called when non-breaking errors are encountered, such as unknown colors and unsupported META commands.
 * loadRelatedFilesImmediately can be set to true in order to start loading dat files as soon as they are encountered. This options makes the loader handle these related files automatically.
 */
THREE.LDRLoader = function(manager, onLoad, onProgress, onError, onWarning, loadRelatedFilesImmediately) {
    this.manager = manager;
    this.ldrPartTypes = []; // id => part. id can be "parts/3001.dat", "model.mpd", etc.
    this.unloadedFiles = 0;
    this.onLoad = onLoad;
    this.onProgress = onProgress;
    this.onError = onError;

    var nop = function(){};
    this.onWarning = onWarning || nop;
    this.loader = new THREE.FileLoader(manager);
    this.mainModel;
    this.loadRelatedFilesImmediately = loadRelatedFilesImmediately || false;
}

/*
 * Load a ldr/mpd/dat file.
 * For BFC parameters, see: http://www.ldraw.org/article/415.html
 * This function follows the procedure from there to handle BFC.
 *
 * id is the file name to load.
 * top should be set to 'true' for top level model files, such as .ldr and .mpd files.
 */
THREE.LDRLoader.prototype.load = function(id, top) {
    if(!top)
	id = id.toLowerCase(); // Sanitize id. 

    if(this.ldrPartTypes[id]) { // Already loaded
	this.reportProgress(id);
	return;
    }
    var self = this;
    self.ldrPartTypes[id] = true;

    var onFileLoaded = function(text) {
	self.parse(text);
	self.unloadedFiles--; // Warning - might have concurrency issue when two threads simultaneously update this!
	self.reportProgress(id);
    }
    this.unloadedFiles++;
    var url = this.idToUrl(id, top);
    this.loader.load(url, onFileLoaded, self.onProgress, self.onError);
};

/*
 * This function is called when a (sub)file has been loaded. Also. It will be called every time a subfile is encountered if this.loadRelatedFilesImmediately is set to true. In this case it can thus not be used to ensure completion of a loded (sub)file!
 * This function always invokes onProgress(id)
 * Also. It checks if all subModels have loaded. If so, it invokes onLoad().
 *
 * id is the id/name of the (sub)file.
 */
THREE.LDRLoader.prototype.reportProgress = function(id) {
    this.onProgress(id);
    if(this.unloadedFiles == 0) {
	this.onLoad();
    }
};

/*
 * .mpd and .ldr files are considered to be 'top level'.
 *
 * id is the id/name of the (sub)file.
 */
THREE.LDRLoader.prototype.isTopLevelModel = function(id) {
    return id.endsWith("ldr") || id.endsWith("mpd");
}

/*
 * This function is used to translate an id into a file location.
 * TODO FIXME: Remember to change this function to fit your own directory structure!
 * A normal LDraw directory has files both under /parts and /p and requires you to search for dat files. You can choose to combine the directories, but this is not considered good practice. 
 * 
 * id is the part id to be translated.
 * top is true for top-level ids, such as .ldr and .mpd.
 */
THREE.LDRLoader.prototype.idToUrl = function(id, top) {
    if(this.isTopLevelModel(id))
    	return id;
    return "parts/" + id.toLowerCase();
}

/*
 * Primary parser for LDraw files.
 * 
 * data is the plain text file content.
 */
THREE.LDRLoader.prototype.parse = function(data) {
    var parseStartTime = new Date();

    // BFC Parameters:
    var CCW = true; // Assume CCW as default
    var invertNext = false; // Don't assume that first line needs inverted.
    var localCull = true;

    // Start parsing:
    var part = new THREE.LDRPartType();
    var step = new THREE.LDRStep();
    var extraSteps = {}; // sub models are handled in additional, separate, steps. This is to support the limitation of only showing a single model on screen at any time.
    function closeStep(keepRotation) {
	part.addStep(step);
	var rot = step.rotation;
	step = new THREE.LDRStep();
	if(keepRotation)
	    step.rotation = rot;

	for (var key in extraSteps) {
	    var extraStep = extraSteps[key];
	    extraStep.rotation = rot;
	    part.addStep(extraStep);
	}
	extraSteps = {};
    }

    // State information:
    var previousComment = "";
    var firstModel = true;

    var dataLines = data.split("\r\n");
    for(var i = 0; i < dataLines.length; i++) {
	var line = dataLines[i];
	var parts = line.split(" ").filter(x => x !== ''); // Remove empty strings.
	if(parts.length <= 1)
	    continue; // Empty/ empty comment line
	var lineType = parseInt(parts[0]);
	if(lineType != 0) {
	    var colorID = parseInt(parts[1]);
	    if(LDR.Colors[colorID] == undefined) {
		this.onWarning({message:'Unknown color "' + colorID + '". Black (0) will be shown instead.', line:i, subModel:part});
		colorID = 0;
	    }
	}
	//console.log("Parsing line " + i + " of type " + lineType + ": " + line); // Useful if you encounter parse errors.

	var l3 = parts.length >= 3;
	function is(type) {
	    return l3 && type === parts[1];
	}

	var self = this;
	function setModelDescription() {
	    if(part.modelDescription) 
		return;
	    part.modelDescription = previousComment;
	    //console.log(previousComment);
	    if(previousComment.startsWith("~Moved to ")) {
		var newID = previousComment.substring("~Moved to ".length).toLowerCase();
		if(!newID.endsWith(".dat"))
		    newID += ".dat";
		self.onWarning({message:'The part "' + part.ID + '" has been moved to "' + newID + '". Instructions and parts lists will show "' + newID + '".', line:i, subModel:part});
		part.replacement = newID;
	    }
	    else if(previousComment.startsWith("~Unknown part ")) {
		self.onError({message:'Unknown part "' + part.ID + '" will be shown as a cube.', line:i, subModel:part});
	    }
	}

	switch(lineType) {
	case 0: // TODO: Many commands from LDraw and various vendors.
	    if(is("FILE")) { // NOFILE command is not supported.
		// MPD FILE Block found. Set name and start new part if not the first
		if(!firstModel) {
		    // Close model and start new:
		    closeStep(false);
		    this.ldrPartTypes[part.ID] = part;
		    this.onProgress(part.ID);
		    part = new THREE.LDRPartType();
		}
		var fileName = parts.slice(2).join(" "); // Trim "0 FILE ".
		part.setID(fileName);
		if(firstModel) {
		    if(!this.mainModel)
			this.mainModel = part.ID;
		    firstModel = false;		
		}
	    }
	    else if(is("Name:")) {
		// LDR Name: line found. Set name and update data in case this is an ldr file (do not use file suffix to determine).
		// Set name and model description:
		part.setID(parts.slice(2).join(" "));
		setModelDescription();
		if(firstModel) {
		    if(!this.mainModel)
			this.mainModel = part.ID;
		    firstModel = false;
		}
	    }
	    else if(is("Author:")) {
		part.author = parts.slice(2).join(" ");
		setModelDescription();
	    }
	    else if(is("!LICENSE")) {
		part.license = parts.slice(2).join(" ");
	    }
	    else if(parts[1] === "BFC") {
		// BFC documentation: http://www.ldraw.org/article/415
		var option = parts[2];
		switch(option) {
		case "CERTIFY":
                    CCW = true;
		    break;
		case "INVERTNEXT":
                    invertNext = true;
		    break;
		case "CLIP":
                    localCull = true;
		    break;
		case "NOCLIP":
                    localCull = false;
		    break;
		}
		
		// Handle CW/CCW:
		if(parts[parts.length-1] == "CCW")
                    CCW = true;
		else if(parts[parts.length-1] == "CW")
                    CCW = false;
	    }
	    else if(parts[1] === "STEP") {
		closeStep(true);
	    }
	    else if(parts[1] === "ROTSTEP") {
		if(parts.length >= 5) {
		    if(parts.length == 6 && parts[5] === "ABS") {
			this.onWarning({message:'Rotation type "ABS" is not yet supported. This will appear as a normal step.', line:i, subModel:part});
		    }
		    //console.log("Rotation! " + parts[2] + " " + parts[3] + " " + parts[4] + " " + parts[5]);
		    step.rotation = new THREE.LDRStepRotation(parts[2], parts[3], parts[4], (parts.length == 5 ? "REL" : parts[5]));
		}
		else if(parts.length == 3 && parts[2] === "END") {
		    step.rotation = null;
		}
		closeStep(true);
	    }
	    else {
		invertNext = false;
		previousComment = line.substring(2);
	    }
	    
	    // TODO: MLCad commands:
	    // TODO: LSynth commands:
	    break;
	case 1: // 1 <colour> x y z a b c d e f g h i <file>
	    for(var j = 2; j < 14; j++)
		parts[j] = parseFloat(parts[j]);
	    var position = new THREE.Vector3(parts[2], parts[3], parts[4]);
	    var rotation = new THREE.Matrix3();
	    rotation.set(parts[5],  parts[6],  parts[7], 
			 parts[8],  parts[9],  parts[10], 
			 parts[11], parts[12], parts[13]);
	    var subModelID = parts.slice(14).join(" ").toLowerCase();
	    var subModel = new THREE.LDRPartDescription(colorID, 
							position, 
							rotation, 
							subModelID,
							localCull,
						        invertNext);
	    var isLDR = subModelID.endsWith('.ldr');
	    if(isLDR) {
		var prevStep = extraSteps['' + colorID + subModelID];
		if(prevStep) {
		    prevStep.addLDR(subModel); // Same color and type => add there.
		}
		else {
		    var extraStep = new THREE.LDRStep();
		    extraStep.addLDR(subModel);
		    extraSteps['' + colorID + subModelID] = extraStep;
		}
	    }
	    else {
		step.addDAT(subModel); // DAT part - no step.
	    }
	    if(!isLDR) {
		if(this.loadRelatedFilesImmediately) {
		    this.load(subModelID, false); // Start loading the separate file immediately!
		}
	    }
	    invertNext = false;
	    break;
	case 2: // Line "2 <colour> x1 y1 z1 x2 y2 z2"
	    var p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    var p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    step.addLine(colorID, p1, p2);
	    invertNext = false;
	    break;
	case 3: // 3 <colour> x1 y1 z1 x2 y2 z2 x3 y3 z3
	    var idx = 2;
	    var p1 = new THREE.Vector3(parseFloat(parts[idx++]), 
		 		       parseFloat(parts[idx++]),
		 		       parseFloat(parts[idx++]));
	    var p2 = new THREE.Vector3(parseFloat(parts[idx++]), 
				       parseFloat(parts[idx++]),
				       parseFloat(parts[idx++]));
	    var p3 = new THREE.Vector3(parseFloat(parts[idx++]), 
				       parseFloat(parts[idx++]),
				       parseFloat(parts[idx++]));
	    if(CCW == invertNext) {
		step.addTrianglePoints(colorID, p3, p2, p1);
	    }
	    else {
		step.addTrianglePoints(colorID, p1, p2, p3);
	    }

	    if(!localCull)
		step.cull = false; // Ensure no culling when step is handled.

	    invertNext = false;
	    break;
	case 4: // 4 <colour> x1 y1 z1 x2 y2 z2 x3 y3 z3 x4 y4 z4
	    var idx = 2;
	    var x1 = parseFloat(parts[idx++]);
	    var y1 = parseFloat(parts[idx++]);
	    var z1 = parseFloat(parts[idx++]);
	    var x2 = parseFloat(parts[idx++]);
	    var y2 = parseFloat(parts[idx++]);
	    var z2 = parseFloat(parts[idx++]);
	    var x3 = parseFloat(parts[idx++]);
	    var y3 = parseFloat(parts[idx++]);
	    var z3 = parseFloat(parts[idx++]);
	    var x4 = parseFloat(parts[idx++]);
	    var y4 = parseFloat(parts[idx++]);
	    var z4 = parseFloat(parts[idx++]);
	    var p1 = new THREE.Vector3(x1, y1, z1);
	    var p2 = new THREE.Vector3(x2, y2, z2);
	    var p3 = new THREE.Vector3(x3, y3, z3);
	    var p4 = new THREE.Vector3(x4, y4, z4);

	    if(CCW == invertNext) {
		step.addTrianglePoints(colorID, p4, p2, p1);
		step.addTrianglePoints(colorID, p4, p3, p2);
	    }
	    else {
		step.addTrianglePoints(colorID, p1, p2, p4);
		step.addTrianglePoints(colorID, p2, p3, p4);
	    }
	    if(!localCull)
		step.cull = false; // Ensure no culling when step is handled.

	    invertNext = false;
	    break;
	case 5: // Conditional lines:
	    var p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    var p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    var p3 = new THREE.Vector3(parseFloat(parts[8]), parseFloat(parts[9]), parseFloat(parts[10]));
	    var p4 = new THREE.Vector3(parseFloat(parts[11]), parseFloat(parts[12]), parseFloat(parts[13]));
	    step.addConditionalLine(colorID, p1, p2, p3, p4);
	    invertNext = false;
	    break;
	}
    }

    part.addStep(step);
    this.ldrPartTypes[part.ID] = part;

    var parseEndTime = new Date();
    console.log("LDraw file read in " + (parseEndTime-parseStartTime) + "ms.");
};

/*
  Part description: a part (ID) placed (position, rotation) with a given color (16/24 allowed) and invertCCW to allow for sub-parts in DAT-parts.
*/
THREE.LDRPartDescription = function(colorID, position, rotation, ID, cull, invertCCW) {
    this.colorID = colorID; // LDraw ID
    this.position = position; // Vector3
    this.rotation = rotation; // Matrix3
    this.ID = ID.toLowerCase(); // part.dat lowercase
    this.cull = cull;
    this.invertCCW = invertCCW;
}

THREE.LDRPartDescription.prototype.placeAt = function(pd) {
    // Compute augmented colorID, position, rotation, ID
    var colorID = (this.colorID === 16 || this.colorID === 24) ? pd.colorID : this.colorID;
    
    var position = new THREE.Vector3();
    position.copy(this.position);
    position.applyMatrix3(pd.rotation);
    position.add(pd.position);

    var rotation = new THREE.Matrix3();
    rotation.multiplyMatrices(pd.rotation, this.rotation);

    var invert = this.invertCCW == pd.invertCCW;

    return new THREE.LDRPartDescription(colorID, position, rotation, this.ID, this.cull, invert);
}

THREE.LDRStepRotation = function(x, y, z, type) {
    this.x = parseFloat(x);
    this.y = parseFloat(y);
    this.z = parseFloat(z);
    this.type = type.toUpperCase();
}

THREE.LDRStepRotation.equals = function(a, b) {
    var aNull = a === null;
    var bNull = b === null;
    if(aNull && bNull)
	return true;
    if(aNull != bNull)
	return false;
    return (a.x === b.x) && (a.y === b.y) && (a.z === b.z) && (a.type === b.type);
}

/* 
   Specification: https://www.lm-software.com/mlcad/Specification_V2.0.pdf (page 7 and 8)
*/
THREE.LDRStepRotation.prototype.getRotationMatrix = function(defaultMatrix, currentMatrix) {
    //console.log("Rotating for " + this.x + ", " + this.y + ", " + this.z);
    var wx = this.x / 180.0 * Math.PI;
    var wy = -this.y / 180.0 * Math.PI;
    var wz = -this.z / 180.0 * Math.PI;

    var s1 = Math.sin(wx);
    var s2 = Math.sin(wy);
    var s3 = Math.sin(wz);
    var c1 = Math.cos(wx);
    var c2 = Math.cos(wy);
    var c3 = Math.cos(wz);

    var a = c2 * c3;
    var b = -c2 * s3;
    var c = s2;
    var d = c1 * s3 + s1 * s2 * c3;
    var e = c1 * c3 - s1 * s2 * s3;
    var f = -s1 * c2;
    var g = s1 * s3 - c1 * s2 * c3;
    var h = s1 * c3 + c1 * s2 * s3;
    var i = c1 * c2;

    var rotationMatrix = new THREE.Matrix4();
    rotationMatrix.set(a, b, c, 0,
		       d, e, f, 0,
		       g, h, i, 0,
		       0, 0, 0, 1);
    var ret = new THREE.Matrix4();
    if(this.type === "REL") {
	ret.copy(defaultMatrix).multiply(rotationMatrix);
    }
    else if(this.type === "ADD") {
	ret.copy(currentMatrix).multiply(rotationMatrix);
    }
    else { // this.type === ABS
	// TODO: Make an "ABS" default rotation matrix.
	ret.copy(rotationMatrix);
    }
    return ret;
}

THREE.LDRStepIdx = 0;
THREE.LDRStep = function() {
    this.idx = THREE.LDRStepIdx++;
    this.empty = true;
    this.ldrs = [];
    this.dats = [];
    this.lines = []; // {colorID, p1, p2}
    this.conditionalLines = []; // {colorID, p1, p2, p3, p4}
    this.triangles = []; // {colorID, p1, p2, p3}
    this.rotation = null;
    this.cull = true;

    this.addLDR = function(ldr) {
	this.empty = false;
	this.ldrs.push(ldr);
    }
    this.addDAT = function(dat) {
	this.empty = false;
	this.dats.push(dat);
    }
    this.addLine = function(c, p1, p2) {
	this.empty = false;
    	this.lines.push({colorID:c, p1:p1, p2:p2});
    }
    this.addTrianglePoints = function(c, p1, p2, p3) {
	this.empty = false;
	this.triangles.push({colorID:c, p1:p1, p2:p2, p3:p3});
    }
    this.addConditionalLine = function(c, p1, p2, p3, p4) {
	this.empty = false;
    	this.conditionalLines.push({colorID:c, p1:p1, p2:p2, p3:p3, p4:p4});
    }

    /*
     * Enrich the meshCollector.
     */
    this.generateThreePart = function(loader, colorID, position, rotation, cull, invertCCW, meshCollector) {
	//console.log("Creating three part for " + this.ldrs.length + " sub models and " + this.dats.length + " DAT parts in color " + colorID + ", cull: " + cull + ", invertion: " + invertCCW);
	if(!meshCollector)
	    throw "Fatal: Missing mesh collector!";
	//console.dir(rotation);
	var ownInversion = (rotation.determinant() < 0) != invertCCW; // Adjust for inversed matrix!
	var ownCull = cull && this.cull;

	var transformColor = function(subColorID) {
	    if(subColorID == 16)
		return colorID; // Main color
	    if(subColorID == 24)
		return 10000 + colorID; // Edge color
	    return subColorID;
	}
	var transformPoint = function(p) {
	    var ret = new THREE.Vector3(p.x, p.y, p.z);
	    ret.applyMatrix3(rotation);
	    ret.add(position);
	    return ret;
	}

	// Add lines:
	for(var i = 0; i < this.lines.length; i++) {
	    var line = this.lines[i]; // {colorID, p1, p2}
	    var p1 = transformPoint(line.p1);
	    var p2 = transformPoint(line.p2);
	    var linePositions = [p1.x, p1.y, p1.z, p2.x, p2.y, p2.z];
	    var lineColor = transformColor(line.colorID);
	    meshCollector.getLinesForColor(lineColor).push(linePositions);
	}

	// Add triangles:
	function addPointToPositions(positions, point) {
	    var p = transformPoint(point);
	    positions.push(p.x, p.y, p.z);
	}
	for(var i = 0; i < this.triangles.length; i++) {
	    var triangle = this.triangles[i]; // {colorID, p1, p2, p3}
	    var triangleColor = transformColor(triangle.colorID);
	    var positions = meshCollector.getTrianglePointPositionsForColor(triangleColor);
	    if(!ownInversion || !ownCull) {
		addPointToPositions(positions, triangle.p1);
		addPointToPositions(positions, triangle.p2);
		addPointToPositions(positions, triangle.p3);
	    }
	    if(ownInversion || !ownCull) { // Use 'if' instead of 'else' to add triangles when there is no culling.
		addPointToPositions(positions, triangle.p3);
		addPointToPositions(positions, triangle.p2);
		addPointToPositions(positions, triangle.p1);
	    }
	}

	// Add conditional lines:
	for(var i = 0; i < this.conditionalLines.length; i++) {
	    var conditionalLine = this.conditionalLines[i];
	    var transformed = {colorID: transformColor(conditionalLine.colorID),
			       p1: transformPoint(conditionalLine.p1),
			       p2: transformPoint(conditionalLine.p2),
			       p3: transformPoint(conditionalLine.p3),
			       p4: transformPoint(conditionalLine.p4)};
	    meshCollector.conditionalLines.push(transformed);
	}

	function handleSubModel(subModelDesc) {
	    var subModelInversion = invertCCW != subModelDesc.invertCCW;
	    var subModelCull = subModelDesc.cull && ownCull; // Cull only if both sub model, this step and the inherited cull info is true!
	    var subModelColor = transformColor(subModelDesc.colorID);

	    var subModel = loader.ldrPartTypes[subModelDesc.ID];
	    if(subModel == undefined) {
		throw { 
		    name: "UnloadedSubmodelException", 
		    level: "Severe", 
		    message: "Unloaded sub model: " + subModelDesc.ID,
		    htmlMessage: "Unloaded sub model: " + subModelDesc.ID,
		    toString:    function(){return this.name + ": " + this.message;} 
		}; 
	    }
	    if(subModel.replacement) {
		var replacementSubModel = loader.ldrPartTypes[subModel.replacement];
		if(replacementSubModel == undefined) {
		    throw { 
			name: "UnloadedSubmodelException", 
			level: "Severe",
			message: "Unloaded replaced sub model: " + subModel.replacement + " replacing " + subModelDesc.ID,
			htmlMessage: "Unloaded replaced sub model: " + subModel.replacement + " replacing " + subModelDesc.ID,
			toString:    function(){return this.name + ": " + this.message;} 
		    }; 
		}
		subModel = replacementSubModel;
	    }
	    var nextPosition = transformPoint(subModelDesc.position);
	    var nextRotation = new THREE.Matrix3();
	    nextRotation.multiplyMatrices(rotation, subModelDesc.rotation);
	    subModel.generateThreePart(loader, subModelColor, nextPosition, nextRotation, subModelCull, subModelInversion, meshCollector);
	}

	// Add submodels:
	for(var i = 0; i < this.ldrs.length; i++) {
	    var subModelDesc = this.ldrs[i];
	    handleSubModel(subModelDesc);
	}
	for(var i = 0; i < this.dats.length; i++) {
	    var subModelDesc = this.dats[i];
	    handleSubModel(subModelDesc);
	}

	// TODO: optional lines
    }
}

THREE.LDRPartType = function() {
    this.ID = null;
    this.modelDescription;
    this.author;
    this.license;
    this.steps = [];
    this.lastRotation = null;
    this.replacement;

    this.addStep = function(step) {
	if(step.empty && this.steps.length === 0)
	    return; // Totally illegal step.
	var sameRotation = THREE.LDRStepRotation.equals(step.rotation, this.lastRotation);
	if(step.empty && sameRotation) {
	    return; // No change.
	}
	if(this.steps.length > 0) {
	    var prevStep = this.steps[this.steps.length-1];
	    if(prevStep.empty && sameRotation) {
		// Special case: Merge into previous step:
		this.steps[this.steps.length-1] = step;
		return;
	    }
	}
	this.steps.push(step);
	this.lastRotation = step.rotation;
    }

    this.setID = function(id) {
	this.ID = id.toLowerCase();
    }

    this.generateThreePart = function(loader, c, p, r, cull, inv, meshCollector) {
	for(var i = 0; i < this.steps.length; i++) {
	    this.steps[i].generateThreePart(loader, c, p, r, cull, inv, meshCollector);
	}
    }
}

/*
 * Group conditional lines by the relationships between their points.
 * Define: a=(p2-p1), b=(p2-pr) and c=(p2-p4)
 * M is some multiplier to ensule grouping matches properly. Currently M=100.000.
 * F(n) = parseInt(multiplier*n).
 * G(p) = F(p.x)+'_'+F(p.y)+'_'+F(p.z)
 * ID = G(a)+'|'+G(b)+'|'+G(c)
 */
THREE.ConditionalLineEvaluator = function() {
    this.M = 100000;
    this.groupIDs = [];
    this.groups = {}; // ID -> {representativeLine, visible}
}

THREE.ConditionalLineEvaluator.prototype.getIdFromLine = function(line) {
    // TODO!
}

THREE.ConditionalLineEvaluator.prototype.addLine = function(line) {
    // TODO!
}

THREE.ConditionalLineEvaluator.prototype.updateGroups = function(line) {
    // TODO!
}

/*
  LDRMeshCollector handles drawing and updates of displayed meshes (triangles and lines).
  This is the class you have to update in order to improve the 3D renderer (such as with materials, luminance, etc.)

  THREE.LDRMeshCollector assumes ldrOptions is anLDR.Options object in global scope.
  (See LDROptions.js)
*/
THREE.LDRMeshCollector = function() {
    this.triangles = []; // Color ID -> triangles. Use getTrianglePointPositionsForColor()
    this.lines = []; // Color ID -> lines. Notice: Use getLinesForColor(). Colors 10000+ are for edge colors!.
    this.conditionalLines = []; // [] -> {colorID, p1, p2, p3, p4}. Direct access. Notice: Colors 10000+ are for edge colors.

    this.triangleColors = []; // [] -> used color
    this.lineColors = []; // [] -> used color (only for non-conditional lines)

    this.triangleMeshes; // [] -> meshes
    this.lineMeshes; // [] -> Meshes (non-conditional lines)
    this.conditionalLineMeshes; // [] -> Meshes (one for each line).

    this.isMeshCollector = true;
    this.old = false;
    this.visible = false;
}

THREE.LDRMeshCollector.prototype.getTrianglePointPositionsForColor = function(colorID) {
    if(!this.triangles[colorID]) {
	this.triangles[colorID] = [];
	this.triangleColors.push(colorID);
    }
    return this.triangles[colorID];
}

THREE.LDRMeshCollector.prototype.getLinesForColor = function(colorID) {
    if(!this.lines[colorID]) {
	this.lines[colorID] = [];
	this.lineColors.push(colorID);
    }
    return this.lines[colorID];
}

/*
  'static' method for disposing ab object and removing it from mesh (baseObject).
*/
THREE.LDRMeshCollector.prototype.removeThreeObject = function(obj, baseObject) {
    if(!obj)
	return;
    obj.geometry.dispose();
    //Do not call: obj.material.dispose(); // Materials are always reused.
    baseObject.remove(obj);
}

THREE.LDRMeshCollector.prototype.updateNormalLines = function(baseObject) {
    // First determine if lines already exist and if they need to be updated:
    if(ldrOptions.showLines === 2) { // Don't show lines:
	if(!this.lineMeshes)
	    return;
	for(var i = 0; i < this.lineMeshes.length; i++) {
	    this.removeThreeObject(this.lineMeshes[i], baseObject);
	}
	this.lineMeshes = null;
	return;
    }
    // Show lines:
    if(!this.lineMeshes) {
	this.createNormalLines(baseObject);
	if(!this.visible) {
	    for(var i = 0; i < this.lineMeshes.length; i++) {
		this.lineMeshes[i].visible = false;
	    }
	}
    }
}

/*
 * See 'http://www.ldraw.org/article/218.html' for specification of 'optional'/'conditional' lines.
 * A conditional line should be draw when the camera sees p3 and p4 on same side of line p1 p2.
 *
 * TODO: Try to use ConditionalLineEvaluator for performance boost.
 */
THREE.LDRMeshCollector.prototype.updateConditionalLines = function(baseObject, camera) {
    if(!camera)
	throw "Camera is undefined!";
    if(ldrOptions.showLines > 0) { // Don't show conditional lines:
	if(!this.conditionalLineMeshes)
	    return;
	for(var i = 0; i < this.conditionalLineMeshes.length; i++) {
	    this.removeThreeObject(this.conditionalLineMeshes[i], baseObject);
	}
	this.conditionalLineMeshes = null;
	return;
    }
    // Show conditional lines:
    if(!this.conditionalLineMeshes) {
	this.createConditionalLines(baseObject);
    }
    if(!this.visible) {
	for(var i = 0; i < this.conditionalLineMeshes.length; i++) {
	    this.conditionalLineMeshes[i].visible = false;
	}
	return;
    }
    //console.log("SLOW UPDATE " + this.conditionalLines.length);

    function toScreenCoordinates(p) {
	var v = new THREE.Vector3();
	p.getWorldPosition(v);
	return v.project(camera);
    }
    for(var i = 0; i < this.conditionalLineMeshes.length; i++) {
	var c = this.conditionalLines[i]; // {color, p1, p2, p3, p4}
	var p1 = toScreenCoordinates(c.wp1);
	var p2 = toScreenCoordinates(c.wp2);
	var p3 = toScreenCoordinates(c.wp3);
	var p4 = toScreenCoordinates(c.wp4);

	var dx12 = p2.x-p1.x;
	var dy12 = p2.y-p1.y;
	var dx13 = p3.x-p1.x;
	var dy13 = p3.y-p1.y;
	var dx14 = p4.x-p1.x;
	var dy14 = p4.y-p1.y;
	var v = (dx12*dy13 - dy12*dx13 > 0) == (dx12*dy14 - dy12*dx14 > 0);
	this.conditionalLineMeshes[i].visible = v;
    }
}

/*
  Create both normal and conditional lines:
*/
THREE.LDRMeshCollector.prototype.createNormalLines = function(baseObject) {
    this.lineMeshes = [];

    for(var i = 0; i < this.lineColors.length; i++) {
	var lineColor = this.lineColors[i];
	var lineMaterial = lineColor < 10000 ? 
	    LDR.Colors.getLineMaterial(lineColor) : 
	    LDR.Colors.getEdgeLineMaterial(lineColor - 10000);
	var linesInColor = this.lines[lineColor];
	for(var j = 0; j < linesInColor.length; j++) {
	    // Create the three.js lines:
	    var lineGeometry = new THREE.BufferGeometry();
	    lineGeometry.addAttribute('position', new THREE.Float32BufferAttribute(linesInColor[j], 3));
	    var line = new THREE.Line(lineGeometry, lineMaterial);
	    this.lineMeshes.push(line);
	    baseObject.add(line);
	}
    }
}

THREE.LDRMeshCollector.prototype.createConditionalLines = function(baseObject) {
    this.conditionalLineMeshes = [];

    // Now handle conditional lines:
    function createPoint(p) { // This function creates a THREE.Object3D in order to identify screen coordinates.
	var ret = new THREE.Object3D();
	ret.position.x = p.x;
	ret.position.y = p.y;
	ret.position.z = p.z;
	baseObject.add(ret);
	ret.updateMatrixWorld();
	return ret;
    }
    for(var i = 0; i < this.conditionalLines.length; i++) {
	var c = this.conditionalLines[i]; // [color, p1, p2, p3, p4]
	var lineColor = c.colorID;
	var lineMaterial = lineColor < 10000 ? 
	    LDR.Colors.getLineMaterial(lineColor) : 
	    LDR.Colors.getEdgeLineMaterial(lineColor - 10000);

	// Create the three.js line:
	var lineGeometry = new THREE.BufferGeometry();
	lineGeometry.addAttribute('position', new THREE.Float32BufferAttribute(
	    [c.p1.x, c.p1.y, c.p1.z, c.p2.x, c.p2.y, c.p2.z], 3));
	var line = new THREE.Line(lineGeometry, lineMaterial);
	//console.log(c.p1.x + "," + c.p1.y + "," + c.p1.z + " -> " + c.p2.x + "," + c.p2.y + c.p2.z);

	// Add points:
	if(!c.wp1) {
	    c.wp1 = createPoint(c.p1);
	    c.wp2 = createPoint(c.p2);
	    c.wp3 = createPoint(c.p3);
	    c.wp4 = createPoint(c.p4);
	}

	this.conditionalLineMeshes.push(line);
	baseObject.add(line);
    }
}

THREE.LDRMeshCollector.prototype.computeBoundingBox = function() {
    // Bounding box:
    var mc = this;
    function expandBB(b) {
	if(!mc.boundingBox) {
	    mc.boundingBox = new THREE.Box3();
	    mc.boundingBox.copy(b);
	}
	else {
	    mc.boundingBox.expandByPoint(b.min);
	    mc.boundingBox.expandByPoint(b.max);
	}
    }

    for(var i = 0; i < this.triangleMeshes.length; i++) {
	expandBB(this.triangleMeshes[i].geometry.boundingBox);
    }
}

/*
  Relevant options:
  - showOldColors 0 = all colors. 1 = single color old. 2 = dulled old.
  - oldColor
*/
THREE.LDRMeshCollector.prototype.buildTriangles = function(old, baseObject) {
    this.triangleMeshes = []; // colorID -> mesh.
    for(var i = 0; i < this.triangleColors.length; i++) {
	var triangleColor = this.triangleColors[i];
	var triangleMaterial;

	if(old && ldrOptions.showOldColors === 1) { // Show dulled!
	    triangleMaterial = LDR.Colors.getTriangleMaterial(16);
	}
	else {
	    if(LDR.Colors[triangleColor] == undefined) {
		console.warn("Unknown LDraw color '" + triangleColor + "', defaulting to black.");
		triangleMaterial = LDR.Colors.getTriangleMaterial(0);
	    }
	    else if(old && ldrOptions.showOldColors === 2) {
		triangleMaterial = LDR.Colors.getDesaturatedTriangleMaterial(triangleColor);
	    }
	    else {
		triangleMaterial = LDR.Colors.getTriangleMaterial(triangleColor);
	    }
	}

	var triangleGeometry = new THREE.BufferGeometry();
	triangleGeometry.addAttribute('position', new THREE.Float32BufferAttribute(
	    new Float32Array(this.triangles[triangleColor]), 3));
	triangleGeometry.computeBoundingBox();
	var mesh = new THREE.Mesh(triangleGeometry, triangleMaterial);
	this.triangleMeshes.push(mesh);
	baseObject.add(mesh);
    }
}

THREE.LDRMeshCollector.prototype.colorTrianglesOldSingleColor = function() {
    for(var i = 0; i < this.triangleColors.length; i++) {
	var mesh = this.triangleMeshes[i];
	mesh.material = LDR.Colors.getTriangleMaterial(16);
	//mesh.material.needsUpdate = true;
    }
}

THREE.LDRMeshCollector.prototype.colorTrianglesDulled = function() {
    for(var i = 0; i < this.triangleColors.length; i++) {
	var triangleColor = this.triangleColors[i];
	var mesh = this.triangleMeshes[i];
	mesh.material = LDR.Colors.getDesaturatedTriangleMaterial(triangleColor);
	//mesh.material.needsUpdate = true;
    }
}

THREE.LDRMeshCollector.prototype.colorTrianglesNormal = function() {
    for(var i = 0; i < this.triangleColors.length; i++) {
	var triangleColor = this.triangleColors[i];
	var mesh = this.triangleMeshes[i];
	mesh.material = LDR.Colors.getTriangleMaterial(triangleColor);
	//mesh.material.needsUpdate = true;
    }
}

THREE.LDRMeshCollector.prototype.updateState = function(old) {
    this.old = old;
    this.oldColor = ldrOptions.oldColor;
    this.showOldColors = ldrOptions.showOldColors;
}

/*
 * Returns true on creation.
 */
THREE.LDRMeshCollector.prototype.createOrUpdateTriangles = function(old, baseObject) {
    if(!this.triangleMeshes) { // Create triangles:
	this.updateState(old);
	this.buildTriangles(old, baseObject);
	return true;
    }

    if(old !== this.old) {
	// Change between new and old:
	if(old) { // Make triangles old:
	    if(ldrOptions.showOldColors === 1) { // Color in old color:
		this.colorTrianglesOldSingleColor();
	    }
	    else if(ldrOptions.showOldColors === 2) { // Dulled colors:
		this.colorTrianglesDulled();
	    }
	}
	else { // Make triangles new!
	    if(this.showOldColors !== 0) {
		this.colorTrianglesNormal();
	    }
	}
    }
    else if(old) { // Remain old:
	if(this.showOldColors !== ldrOptions.showOldColors) { // Change in old type:
	    if(ldrOptions.showOldColors === 1) { // Color in old color:
		this.colorTrianglesOldSingleColor();
	    }
	    else if(ldrOptions.showOldColors === 2) { // Dulled or normal:
		this.colorTrianglesDulled();
	    }
	    else {
		this.colorTrianglesNormal();
	    }
	}
	else if(this.oldColor !== ldrOptions.oldColor && ldrOptions.showOldColors === 1) {
	    this.colorTrianglesOldSingleColor();
	}
    }
    // else remain new: Do nothing.

    this.updateState(old);
    return false;
}

THREE.LDRMeshCollector.prototype.draw = function(baseObject, camera, old) {
    if(old == undefined)
	throw "'old' is undefined!";

    var created = this.createOrUpdateTriangles(old, baseObject);
    if(created) {
	if(ldrOptions.showLines < 2) {
	    this.createNormalLines(baseObject);
	    if(ldrOptions.showLines < 1) {
		this.updateConditionalLines(baseObject, camera);
	    }
	}
	this.computeBoundingBox();
	this.visible = true;
    }
    else {
	this.updateNormalLines(baseObject);
	this.updateConditionalLines(baseObject, camera);
    }
}

THREE.LDRMeshCollector.prototype.isVisible = function(v) {
    return this.visible;
}

/*
  Update meshes and set own visibility indicator.
*/
THREE.LDRMeshCollector.prototype.setVisible = function(v, baseObject, camera) {
    if(this.visible === v)
	return;
    for(var i = 0; i < this.triangleMeshes.length; i++) {
	this.triangleMeshes[i].visible = v;
    }
    if(this.lineMeshes) {
	for(var i = 0; i < this.lineMeshes.length; i++) {
	    this.lineMeshes[i].visible = v;
	}
    }
    this.visible = v;
    this.updateConditionalLines(baseObject, camera);
}

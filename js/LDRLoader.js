'use strict';

/**
 * @author Lasse Deleuran | c-mt.dk and brickhub.org
 * LDR Specification: http://www.ldraw.org/documentation/ldraw-org-file-format-standards.html
 *
 * Special note about colors. 
 * LDraw ID's are used for identifying colors efficiently. However. An LDraw color has both an ordinary value and an 'edge' value which can be used for rendering. In order to simplify the data model for storing geometries by colors, geometries colored in edge colors have '10.000' added to their ID's. An 'edge' color is thus identified by ID's being >= 10000 and the LDraw ID can be obtained by subtracting 10000.
 * This choice is internal to the loader and transparent to code that uses LDRLoader.
 *
 * onLoad is called on completion of loading of all necesasry LDraw files.
 * Parameters for the options object (optional):
 * manager, onProgress and onError are standard for Three.js loaders.
 * onWarning and loadRelatedFilesImmediately are optional:
 * onWarning(warningObj) is called when non-breaking errors are encountered, such as unknown colors and unsupported META commands.
 * loadRelatedFilesImmediately can be set to true in order to start loading dat files as soon as they are encountered. This options makes the loader handle these related files automatically.
 * idToUrl is used to translate an id into a file location. Remember to change this function to fit your own directory structure if needed. A normal LDraw directory has files both under /parts and /p and requires you to search for dat files. You can choose to combine the directories, but this is not considered good practice. The function takes two parameters:
 * - id is the part id to be translated.
 * - top is true for top-level ids, such as .ldr and .mpd.
 */
THREE.LDRLoader = function(onLoad, options) {
    var nop = function(){};
    options = options || {};
    this.ldrPartTypes = {}; // id => part. id can be "parts/3001.dat", "model.mpd", etc.
    this.unloadedFiles = 0;
    this.onLoad = onLoad;
    this.onProgress = options.onProgress || nop;
    this.onError = options.onError || nop;
    this.onWarning = options.onWarning || nop;
    this.loadRelatedFilesImmediately = options.loadRelatedFilesImmediately || false;
    this.loader = new THREE.FileLoader(options.manager || THREE.DefaultLoadingManager);
    this.saveFileLines = options.saveFileLines || false;
    this.mainModel;
    var self = this;
    this.idToUrl = options.idToUrl || function(id, top) {
	if(self.isTopLevelModel(id)){
	    return id;
	}
	return "ldraw_parts/"+id.toLowerCase();
    };
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
	id = id.toLowerCase();
    var url = this.idToUrl(id, top);
    id = id.replace('\\', '/'); // Sanitize id. 

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
 * Additionally. Files without suffixes should also be considered 'top level', since stud.io 2.0 outputs these.
 * All in all, anything but .dat files should be considered 'top level'.
 *
 * id is the id/name of the (sub)file.
 */
THREE.LDRLoader.prototype.isTopLevelModel = function(id) {
    return !id.endsWith(".dat");
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
    var localCull = false; // Do not cull by default - wait for BFC CERTIFY
    var invertNext = false; // Don't assume that first line needs inverted.

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
    var previousComment;

    var dataLines = data.split(/(\r\n)|\n/);
    for(var i = 0; i < dataLines.length; i++) {
	var line = dataLines[i];
	if(!line)
	    continue; // Empty line, or 'undefined' due to '\r\n' split.

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
	    if(part.modelDescription || !previousComment)
		return;
	    part.modelDescription = previousComment;
	    if(previousComment.toLowerCase().startsWith("~moved to ")) {
		var newID = previousComment.substring("~moved to ".length).toLowerCase();
		if(!newID.endsWith(".dat"))
		    newID += ".dat";
		self.onWarning({message:'The part "' + part.ID + '" has been moved to "' + newID + '". Instructions and parts lists will show "' + newID + '".', line:i, subModel:part});
		part.replacement = newID;
	    }
	    else if(previousComment.startsWith("~Unknown part ")) {
		self.onError({message:'Unknown part "' + part.ID + '" will be shown as a cube.', line:i, subModel:part});
	    }
	    previousComment = undefined;
	}

	function handlePotentialFileStart(fileName) {
	    // Normalize the name by bringing to lower case and replacing backslashes:
	    fileName = fileName.toLowerCase().replace('\\', '/');
	    localCull = false; // BFC Statements come after the FILE or Name: - directives.

	    if(part.ID === fileName) { // Consistent 'FILE' and 'Name:' lines.
		setModelDescription();
		part.consistentFileAndName = true;
	    }
	    else if(!self.mainModel) { // First model
		self.mainModel = part.ID = fileName;
	    }
	    else if(part.steps.length == 0 && step.empty && 
		    Object.keys(extraSteps).length == 0 && self.mainModel === part.ID) {
		console.log("Special case: Main model ID change from " + part.ID + " to " + fileName);
		self.mainModel = part.ID = fileName;
	    }
	    else { // Close model and start new:
		if(part.steps.length == 0 && step.empty && 
		   Object.keys(extraSteps).length == 0 && part.ID && 
		   !part.consistentFileAndName) {
		    console.log("Special case: Empty '" + part.ID + "' does not match '" + fileName + "' - Create new shallow part!");		
		    // Create pseudo-model with just one of 'fileName' inside:
		    var rotation = new THREE.Matrix3();
		    rotation.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
		    var shallowSubModel = new THREE.LDRPartDescription(16, 
								       new THREE.Vector3(),
								       rotation, 
								       fileName,
								       true,
								       false);
		    step.addLDR(shallowSubModel);
		}
		closeStep(false);
		if(part.ID) {
		    self.ldrPartTypes[part.ID] = part;
		    self.onProgress(part.ID);
		}
		part = new THREE.LDRPartType();
		part.ID = fileName;
	    }
	}

	switch(lineType) {
	case 0:
	    if(is("FILE") || is("file") || is("Name:")) {
		// LDR FILE or 'Name:' line found. Set name and update data in case this is a new ldr file (do not use file suffix to determine).
		handlePotentialFileStart(parts.slice(2).join(" "));
	    }
	    else if(is("Author:")) {
		part.author = parts.slice(2).join(" ");
		setModelDescription();
	    }
	    else if(is("!LICENSE")) {
		part.license = parts.slice(2).join(" ");
	    }
	    else if(is("!HISTORY")) {
		// Ignore.
	    }
	    else if(is("!LDRAW_ORG")) {
		part.ldraw_org = parts.slice(2).join(" ");
	    }
	    else if(parts[1] === "BFC") {
		// BFC documentation: http://www.ldraw.org/article/415
		var option = parts[2];
		switch(option) {
		case "CERTIFY":
		    part.certifiedBFC = true;
		    part.CCW = CCW = true;
                    localCull = true;
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
		if(parts[parts.length-1] == "CCW") {
                    part.CCW = CCW = true;
		}
		else if(parts[parts.length-1] == "CW") {
                    part.CCW = CCW = false;
		}
	    }
	    else if(parts[1] === "STEP") {
		closeStep(true);
	    }
	    else if(parts[1] === "ROTSTEP") {
		if(parts.length >= 5) {
		    step.rotation = new THREE.LDRStepRotation(parts[2], parts[3], parts[4], (parts.length == 5 ? "REL" : parts[5]));
		}
		else if(parts.length == 3 && parts[2] === "END") {
		    step.rotation = null;
		}
		closeStep(true);
	    }
	    else if(parts[1] === "!BRICKHUB_INLINED") {
		part.inlined = parts.length == 3 ? parts[2] : 'UNKNOWN';
	    }
	    else if(parts[1][0] === "!") {
		invertNext = false;
		self.onWarning({message:'Unknown LDraw command "' + parts[1] + '" is ignored.', line:i, subModel:part});
	    }
	    else {
		invertNext = false;
		previousComment = line.substring(2);
	    }
	    
	    // TODO: LSynth commands
	    // TODO: TEXMAP commands
	    // TODO: Buffer exchange commands

	    if(this.saveFileLines)
		part.lines.push(new LDR.Line0(parts.slice(1).join(" ")));
	    break;
	case 1: // 1 <colour> x y z a b c d e f g h i <file>
	    for(var j = 2; j < 14; j++)
		parts[j] = parseFloat(parts[j]);
	    var position = new THREE.Vector3(parts[2], parts[3], parts[4]);
	    var rotation = new THREE.Matrix3();
	    rotation.set(parts[5],  parts[6],  parts[7], 
			 parts[8],  parts[9],  parts[10], 
			 parts[11], parts[12], parts[13]);
	    var subModelID = parts.slice(14).join(" ").toLowerCase().replace('\\', '/');
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
	    if(this.saveFileLines)
  		part.lines.push(new LDR.Line1(subModel));
	    invertNext = false;
	    break;
	case 2: // Line "2 <colour> x1 y1 z1 x2 y2 z2"
	    var p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    var p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    step.addLine(colorID, p1, p2);
	    if(this.saveFileLines)
		part.lines.push(new LDR.Line2(colorID, p1, p2));
	    invertNext = false;
	    break;
	case 3: // 3 <colour> x1 y1 z1 x2 y2 z2 x3 y3 z3
	    var p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    var p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    var p3 = new THREE.Vector3(parseFloat(parts[8]), parseFloat(parts[9]), parseFloat(parts[10]));
	    if(!part.certifiedBFC || !localCull)
		step.cull = false; // Ensure no culling when step is handled.
	    if(CCW == invertNext) {
		step.addTrianglePoints(colorID, p3, p2, p1);
	    }
	    else {
		step.addTrianglePoints(colorID, p1, p2, p3);
	    }

	    if(this.saveFileLines)
		part.lines.push(new LDR.Line3(colorID, p1, p2, p3, localCull, CCW != invertNext));
	    invertNext = false;
	    break;
	case 4: // 4 <colour> x1 y1 z1 x2 y2 z2 x3 y3 z3 x4 y4 z4
	    var p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    var p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    var p3 = new THREE.Vector3(parseFloat(parts[8]), parseFloat(parts[9]), parseFloat(parts[10]));
	    var p4 = new THREE.Vector3(parseFloat(parts[11]), parseFloat(parts[12]), parseFloat(parts[13]));
	    if(!part.certifiedBFC || !localCull)
		step.cull = false; // Ensure no culling when step is handled.
	    if(CCW == invertNext) {
		step.addQuadPoints(colorID, p4, p3, p2, p1);
	    }
	    else {
		step.addQuadPoints(colorID, p1, p2, p3, p4);
	    }

	    if(this.saveFileLines)
		part.lines.push(new LDR.Line4(colorID, p1, p2, p3, p4, localCull, CCW != invertNext));
	    invertNext = false;
	    break;
	case 5: // Conditional lines:
	    var p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    var p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    var p3 = new THREE.Vector3(parseFloat(parts[8]), parseFloat(parts[9]), parseFloat(parts[10]));
	    var p4 = new THREE.Vector3(parseFloat(parts[11]), parseFloat(parts[12]), parseFloat(parts[13]));
	    step.addConditionalLine(colorID, p1, p2, p3, p4);
	    if(this.saveFileLines)
		part.lines.push(new LDR.Line5(colorID, p1, p2, p3, p4));
	    invertNext = false;
	    break;
	}
    }

    part.addStep(step);
    this.ldrPartTypes[part.ID] = part;

    var parseEndTime = new Date();
    //console.log("LDraw file read in " + (parseEndTime-parseStartTime) + "ms.");
};

THREE.LDRLoader.prototype.removeGeometries = function() {
    for(var ptID in this.ldrPartTypes) {
	if(!this.ldrPartTypes.hasOwnProperty(ptID))
	    continue; // Not a part.
	var partType = this.ldrPartTypes[ptID];

	if(partType === true)
	    continue;
	for(var i = 0; i < partType.steps.length; i++) {
	    partType.steps[i].removePrimitivesAndSubParts(); // Remove unused 'geometries'.
	}

	if(partType.geometry)
	    delete partType.geometry;
    }
}

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

THREE.LDRPartDescription.prototype.placedColor = function(pdColorID) {
    var colorID = this.colorID;
    if(colorID == 16) {
        colorID = pdColorID;
    }
    else if(colorID == 24) {
        colorID = pdColorID == 16 ? 24 : pdColorID; // Ensure color 24 is propagated correctly when placed for main color (16)..
    }

    return colorID;
}

THREE.LDRPartDescription.prototype.placeAt = function(pd) {
    // Compute augmented colorID, position, rotation, ID
    var colorID = this.placedColor(pd.colorID);
    
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

// Get the rotation matrix by looking at the default camera position:
THREE.LDRStepRotation.getAbsRotationMatrix = function() {
    var looker = new THREE.Object3D();
    looker.position.x = -10000;
    looker.position.y = -7000;
    looker.position.z = -10000;
    looker.lookAt(new THREE.Vector3());
    looker.updateMatrix();
    var m0 = new THREE.Matrix4();
    m0.extractRotation(looker.matrix);
    return m0;
}
THREE.LDRStepRotation.ABS = THREE.LDRStepRotation.getAbsRotationMatrix();

/* 
   Specification: https://www.lm-software.com/mlcad/Specification_V2.0.pdf (page 7 and 8)
*/
THREE.LDRStepRotation.prototype.getRotationMatrix = function(defaultMatrix) {
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
	ret.multiplyMatrices(defaultMatrix, rotationMatrix);
    }
    else if(this.type === "ADD") {
        throw "Unsupported rotation type: ADD!"
	//ret.copy(currentMatrix).multiply(rotationMatrix);
    }
    else { // this.type === ABS
	ret.multiplyMatrices(THREE.LDRStepRotation.ABS, rotationMatrix);
    }
    return ret;
}

THREE.LDRStepIdx = 0;
THREE.LDRStep = function() {
    this.idx = THREE.LDRStepIdx++;
    this.empty = true;
    this.hasPrimitives = false;
    this.ldrs = [];
    this.dats = [];
    this.lines = []; // {colorID, p1, p2}
    this.conditionalLines = []; // {colorID, p1, p2, p3, p4}
    this.triangles = []; // {colorID, p1, p2, p3}
    this.quads = []; // {colorID, p1, p2, p3, p4}
    this.rotation = null;
    this.cull = true;
    this.cnt = -1;
}

THREE.LDRStep.prototype.removePrimitivesAndSubParts = function() {
    delete this.ldrs;
    delete this.dats;
    delete this.lines;
    delete this.conditionalLines;
    delete this.triangles;
    delete this.quads;
}

THREE.LDRStep.prototype.addLDR = function(ldr) {
    this.empty = false;
    this.ldrs.push(ldr);
}
THREE.LDRStep.prototype.addDAT = function(dat) {
    this.empty = false;
    this.dats.push(dat);
}
THREE.LDRStep.prototype.addLine = function(c, p1, p2) {
    this.empty = false;
    this.hasPrimitives = true;
    this.lines.push({colorID:c, p1:p1, p2:p2});
}
THREE.LDRStep.prototype.addTrianglePoints = function(c, p1, p2, p3) {
    this.empty = false;
    this.hasPrimitives = true;
    this.triangles.push({colorID:c, p1:p1, p2:p2, p3:p3});
}
THREE.LDRStep.prototype.addQuadPoints = function(c, p1, p2, p3, p4) {
    this.empty = false;
    this.hasPrimitives = true;
    this.quads.push({colorID:c, p1:p1, p2:p2, p3:p3, p4:p4});
}
THREE.LDRStep.prototype.addConditionalLine = function(c, p1, p2, p3, p4) {
    this.empty = false;
    this.hasPrimitives = true;
    this.conditionalLines.push({colorID:c, p1:p1, p2:p2, p3:p3, p4:p4});
}

THREE.LDRStep.prototype.countParts = function(loader) {
    if(this.cnt >= 0)
	return this.cnt;
    this.cnt = this.dats.length;
    for(var i = 0; i < this.ldrs.length; i++) {
	this.cnt += loader.ldrPartTypes[this.ldrs[i].ID].countParts(loader);
    }
    return this.cnt;
}

THREE.LDRStep.prototype.generateThreePart = function(loader, colorID, position, rotation, cull, invertCCW, mc) {
    //console.log("Creating three part for " + this.ldrs.length + " sub models and " + this.dats.length + " DAT parts in color " + colorID + ", cull: " + cull + ", invertion: " + invertCCW);
    var ownInversion = (rotation.determinant() < 0) != invertCCW; // Adjust for inversed matrix!
    var ownCull = cull && this.cull;
    
    var transformColor = function(subColorID) {
	if(subColorID == 16)
	    return colorID; // Main color
	else if(subColorID == 24)
	    return colorID >= 10000 ? colorID : 10000 + colorID; // Edge color
	return subColorID;
    }

    var transformPoint = function(p) {
	var ret = new THREE.Vector3(p.x, p.y, p.z);
	ret.applyMatrix3(rotation);
	ret.add(position);
	return ret;
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
	subModel.generateThreePart(loader, subModelColor, nextPosition, nextRotation, subModelCull, subModelInversion, mc);
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
}

LDR.Line0 = function(txt) {
    this.txt = txt;    
    this.line0 = true;
}
LDR.Line1 = function(desc) {
    this.desc = desc;
    this.line1 = true;
}
LDR.Line2 = function(c, p1, p2) {
    this.c = c;
    this.p1 = p1;
    this.p2 = p2;
    this.line2 = true;
}
LDR.Line3 = function(c, p1, p2, p3, cull, ccw) {
    this.c = c;
    this.p1 = p1;
    this.p2 = p2;
    this.p3 = p3;
    this.cull = cull;
    this.ccw = ccw;
    this.line3 = true;
}
LDR.Line4 = function(c, p1, p2, p3, p4, cull, ccw) {
    this.c = c;
    this.p1 = p1;
    this.p2 = p2;
    this.p3 = p3;
    this.p4 = p4;
    this.cull = cull;
    this.ccw = ccw;
    this.line4 = true;
}
LDR.Line5 = function(c, p1, p2, p3, p4) {
    this.c = c;
    this.p1 = p1;
    this.p2 = p2;
    this.p3 = p3;
    this.p4 = p4;
    this.line5 = true;
}

THREE.LDRPartType = function() {
    this.ID = null;
    this.modelDescription;
    this.author;
    this.license;
    this.steps = [];
    this.lines = [];
    this.lastRotation = null;
    this.replacement;
    this.isReplacing;
    this.inlined;
    this.ldraw_org;
    this.geometry;
    this.cnt = -1;
}

THREE.LDRPartType.prototype.prepareGeometry = function(loader) {
    if(this.geometry) {
	console.warn("Geometry already prepared for " + this.ID);
	return;
    }
    this.countParts(loader);
    this.geometry = new LDR.LDRGeometry();
    this.geometry.fromPartType(loader, this);
    // Clean up this:
    for(var i = 0; i < this.steps.length; i++) {
	this.steps[i].removePrimitivesAndSubParts(); // Remove unused 'geometries'.
    }
}

THREE.LDRPartType.prototype.addStep = function(step) {
    if(step.empty && this.steps.length === 0)
	return; // Totally illegal step.
    
    // Update rotation in case of ADD;
    if(step.rotation && step.rotation.type == "ADD") {
        if(!this.lastRotation) {
            step.rotation.type = "REL";
        }
        else {
            step.rotation = new THREE.LDRStepRotation(step.rotation.x + this.lastRotation.x,
                                                      step.rotation.y + this.lastRotation.y,
                                                      step.rotation.z + this.lastRotation.z,
                                                      this.lastRotation.type);
        }
    }
    
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
    
THREE.LDRPartType.prototype.generateThreePart = function(loader, c, p, r, cull, inv, mc) {
    if(!this.geometry) {
	if(this.isPart()) {
	    //console.log("BUILDING MISSED GEOMETRY FOR " + this.ID);
	    this.geometry = new LDR.LDRGeometry();
	    this.geometry.fromPartType(loader, this);
	}
	else {
	    for(var i = 0; i < this.steps.length; i++) {
		this.steps[i].generateThreePart(loader, c, p, r, cull, inv, mc);
	    }
	    return;
	}
    }
    //console.log("BUFFERED " + this.ID);

    this.geometry.buildGeometriesAndColors();
    
    var m4 = new THREE.Matrix4();
    var m3e = r.elements;
    m4.set(
	m3e[0], m3e[3], m3e[6], p.x,
	m3e[1], m3e[4], m3e[7], p.y,
	m3e[2], m3e[5], m3e[8], p.z,
	0, 0, 0, 1
    );
    
    var expanded = false;
    if(this.geometry.lineGeometry) {
	var material = mc.getLineMaterial(this.geometry.lineColorManager, c, false);
	var normalLines = new THREE.LineSegments(this.geometry.lineGeometry, material);
	normalLines.applyMatrix(m4);
	mc.addLines(normalLines);

	var b = this.geometry.lineGeometry.boundingBox;
	mc.expandBoundingBox(b, m4);
	expanded = true;
    }
    
    if(this.geometry.conditionalLineGeometry) {
	var material = mc.getLineMaterial(this.geometry.lineColorManager, c, true);
	var conditionalLines = new THREE.LineSegments(this.geometry.conditionalLineGeometry, material);
	conditionalLines.applyMatrix(m4);
	mc.addLines(conditionalLines);

	if(!expanded) {
	    var b = this.geometry.conditionalLineGeometry.boundingBox;
	    mc.expandBoundingBox(b, m4);
	    expanded = true;
	}
    }
    
    if(this.geometry.triangleGeometry) {
	var material = mc.getTriangleMaterial(this.geometry.triangleColorManager, c, LDR.Colors.isTrans(c));
	var mesh = new THREE.Mesh(this.geometry.triangleGeometry, material);
	mesh.applyMatrix(m4);
	if(LDR.Colors.isTrans(c))
	    mc.addTrans(mesh);
	else
	    mc.addOpaque(mesh);

	if(!expanded) {
	    var b = this.geometry.triangleGeometry.boundingBox;
	    mc.expandBoundingBox(b, m4);
	}
    }
}
    
THREE.LDRPartType.prototype.isPart = function() {
    return this.ID.endsWith('dat') || (this.steps.length == 1 && this.steps[0].hasPrimitives);
}

THREE.LDRPartType.prototype.countParts = function(loader) {
    if(this.cnt >= 0)
	return this.cnt;
    this.cnt = 0;
    for(var i = 0; i < this.steps.length; i++) {
	this.cnt += this.steps[i].countParts(loader);
    }
    return this.cnt;
}

LDR.ColorManager = function() {
    this.shaderColors = []; // [] => Vector4
    this.highContrastShaderColors = []; // [] => Vector4
    this.map = {}; // colorID -> floatColor
    this.sixteen = -1;
    this.edgeSixteen = -1;

    this.clone = function() {
	var ret = new LDR.ColorManager();
	ret.shaderColors.push(...this.shaderColors);
	ret.highContrastShaderColors.push(...this.highContrastShaderColors);
	ret.sixteen = this.sixteen;
	ret.edgeSixteen = this.edgeSixteen;
	for(var c in this.map) {
	    if(this.map.hasOwnProperty(c))
		ret.map[c] = this.map[c];
	}
	return ret;
    }

    this.overWrite = function(id) {
        var isEdge = id >= 10000;
	var colorObject = LDR.Colors[isEdge ? id-10000 : id];
	if(!colorObject)
	    throw "Unknown color: " + id;
	this.lastSet = id;
	var alpha = colorObject.alpha ? colorObject.alpha/256.0 : 1;
	if(this.sixteen >= 0) {
	    var color = new THREE.Color(isEdge ? colorObject.edge : colorObject.value);
	    this.shaderColors[this.sixteen] = new THREE.Vector4(color.r, color.g, color.b, alpha);
	}
	if(this.edgeSixteen >= 0) {
	    var color = new THREE.Color(colorObject.edge);
	    this.shaderColors[this.edgeSixteen] = new THREE.Vector4(color.r, color.g, color.b, alpha);
	    this.highContrastShaderColors[this.edgeSixteen] = LDR.Colors.isBlack(id) ? 
		new THREE.Vector4(1, 1, 1, 1) :
		new THREE.Vector4(0, 0, 0, 1);
	}
    }

    this.get = function(id) {
	var f = this.map[id];
	if(f) {
	    return f;
	}
	if(id == 16)
	    this.sixteen = this.shaderColors.length;
	else if(id == 10016 || id == 24)
	    this.edgeSixteen = this.shaderColors.length;

	var isEdge = id >= 10000;
	var lowID = isEdge ? id-10000 : id;
	var colorObject = LDR.Colors[lowID];
	if(!colorObject) {
	    throw "Unknown color " + lowID + " from " + id;
	}
	var color = new THREE.Color(isEdge ? colorObject.edge : colorObject.value);
	var alpha = colorObject.alpha ? colorObject.alpha/256.0 : 1;
	f = this.shaderColors.length + 0.1;
	this.map[id] = f;
	this.shaderColors.push(new THREE.Vector4(color.r, color.g, color.b, alpha));
	this.highContrastShaderColors.push(LDR.Colors.isBlack(lowID) ? 
					   new THREE.Vector4(1, 1, 1, 1) :
					   new THREE.Vector4(0, 0, 0, 1));
	return f;
    }
}

/*
  The LDRMeshBuilder is used to build geometries for parts.
 */
LDR.GeometryBuilder = function(loader) {
    this.loader = loader;

    /*
    function checkLocalStorageAvailable(){
	var test = '__TEST__';
	try {
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
	}
	catch {
            return false;
	}
    }
    this.localStorageAvailable = checkLocalStorageAvailable();*/
}

/*
  Find all parts that are referenced directly from non-parts.
 */
LDR.GeometryBuilder.prototype.getAllTopLevelToBeBuilt = function() {
    var toBeBuilt = [];
    var self = this;

    // Set 'isReplacing' on all parts whose geometries should be 
    // maintained because they replace other parts.
    for(var ptID in this.loader.ldrPartTypes) {
	if(!this.loader.ldrPartTypes.hasOwnProperty(ptID))
	    continue; // Not a part.
	var partType = this.loader.ldrPartTypes[ptID];
	if(!partType.replacement)
	    continue; // Not replaced.
	for(var j = 0; j < partType.steps.length; j++) {
	    var step = partType.steps[j];
	    for(var k = 0; k < step.dats.length; k++) {
		var id = step.dats[k].ID;
		this.loader.ldrPartTypes[id].isReplacing = true;
	    }
	}
    }

    function mark(pt) {
	if(!pt.isPart() || pt.geometry || pt.markToBeBuilt)
	    return;
	/*if(self.localStorageAvailable) {
	    var fromStorage = localStorage.getItem(pt.ID);
	    if(fromStorage) {
		pt.geometry = new LDR.LDRGeometry();
		pt.geometry.deserialize(fromStorage);
		return;
	    }
	}*/
	toBeBuilt.push(pt);
	pt.markToBeBuilt = true;
    }

    for(var ptID in this.loader.ldrPartTypes) {
	if(!this.loader.ldrPartTypes.hasOwnProperty(ptID))
	    continue; // Not a part.
	var partType = this.loader.ldrPartTypes[ptID];
	if(partType === true || partType.geometry) {
	    continue;
	}
	if(partType.isPart()) {
	    if(partType.isReplacing)
		mark(partType);
	}
	else {
	    // Mark all parts within:
	    for(var j = 0; j < partType.steps.length; j++) {
		var step = partType.steps[j];
		for(var k = 0; k < step.dats.length; k++) {
		    var id = step.dats[k].ID;
		    mark(this.loader.ldrPartTypes[id]);
		}
	    }
	}
    }
    return toBeBuilt;
}

/*
  This function builds the partTypes in the list 'toBeBuilt'. It does so my running in rounds of ready geometries, since this allows for multiple threads/workers to handle part types simultaneously.
 */
LDR.GeometryBuilder.prototype.build = function(storage, toBeBuilt, onDone) {
    var startTime = new Date();
    /* Set up for part types:
       - children = count of unhandled children (dats within a step)
       - parents = ID's of parents
     */
    var ready = []; // partTypes without children (all children have geometries).
    var self = this;

    function linkChild(parent, child) {
	if(child.geometry)
	    return;
	if(!child.parents)
	    child.parents = {};
	else if(child.parents.hasOwnProperty(parent.ID))
	    return; // Already referencing.
	parent.children++;
	child.parents[parent.ID] = parent;
    }
    function prepare(partType) {
	if(partType.prepared || partType.geometry)
	    return; // Already prepared
	partType.parents = {};
	partType.children = 0;
	partType.prepared = true;

	for(var j = 0; j < partType.steps.length; j++) {
	    var step = partType.steps[j];
	    for(var k = 0; k < step.ldrs.length; k++) {
		var id = step.ldrs[k].ID;
		var child = self.loader.ldrPartTypes[id];
		prepare(child);
		linkChild(partType, child);
	    }
	    for(var k = 0; k < step.dats.length; k++) {
		var id = step.dats[k].ID;
		var child = self.loader.ldrPartTypes[id];
		prepare(child);
		linkChild(partType, child);
	    }
	}
	if(partType.children == 0)
	    ready.push(partType);
    }
    for(var i = 0; i < toBeBuilt.length; i++) {
	//console.log("To be built: " + toBeBuilt[i].ID);
	prepare(toBeBuilt[i]);
    }

    var transaction, objectStore;
    var partsWritten = 0;
    if(storage.db) {
	transaction = storage.db.transaction(["parts"], "readwrite");
	transaction.oncomplete = function(event) {
	    console.log('Completed writing of ' + partsWritten + ' parts');
	};
	transaction.onerror = function(event) {
	    console.warn('Error while writing parts!');
	    console.dir(event);
	};
	objectStore = transaction.objectStore("parts");
    }

    /*
      Run in rounds:
     */
    var nextRound = [];
    do { // Handle each in the ready list:	
	console.log("Handling round with " + ready.length + " entries");
	for(var i = 0; i < ready.length; i++) {
	    var partType = ready[i];
	    for(var ptID in partType.parents) {
		if(!partType.parents.hasOwnProperty(ptID))
		    continue; // Not a part.
		var parent = partType.parents[ptID];
		parent.children--;
		if(parent.children == 0) {
		    nextRound.push(parent);
		}
	    }
	    delete partType.parents;

	    partType.prepareGeometry(this.loader);
	    if(partType.markToBeBuilt && objectStore && partType.inlined == "OFFICIAL") {
		var slimPartType = {
		    ID:partType.ID,
		    g:partType.geometry.pack(),
		    d:partType.modelDescription
		};
		objectStore.add(slimPartType).onsuccess = function(e) {partsWritten++;};
	    }
	}
	ready = nextRound;
	nextRound = [];
    } while(ready.length > 0);

    console.log("Geometries built in " + (new Date()-startTime) + "ms.");
    onDone();

    /*
      Run workers:
      TODO
     *//*
    this.workers = [];    
    for(var i = 0; i < numberOfWorkers; i++) {
	var w = new Worker("LDRConstructionWorker.js");
	this.workers.push(w);
	w.onmessage = function(event) {
	    console.dir(event);
	    //console.dir(event.data);
	};
    } */
}

/*
  MeshCollector holds references to meshes (and similar Three.js structures for lines).
  A Mesh Collector handles updates of meshes (change in options, visibility and 'old').
*/
LDR.MeshCollector = function(opaqueObject, transObject) {
    if(!transObject)
	throw "Missing parameters on MeshCollector";
    this.opaqueObject = opaqueObject;
    this.transObject = transObject; // To be painted last.

    this.lineMeshes = []; // Including conditional line meshes.
    this.triangleMeshes = [];

    this.cntMaterials = 0;
    this.lineMaterials = {}; // [color,isConditional] or cnt -> managers
    this.triangleMaterials = {}; // color or cnt -> managers

    this.old = false;
    this.visible = true;
    this.boundingBox;
    this.isMeshCollector = true;
}

LDR.MeshCollector.prototype.getLineMaterial = function(colorManager, color, conditional) {
    var len = colorManager.shaderColors.length;
    var key;
    if(len > 1) {
	this.cntMaterials++;
	key = this.cntMaterials;
    }
    else {
	key = color + "|" + conditional;
    }
    if(this.lineMaterials.hasOwnProperty(key))
	return this.lineMaterials[key];
    var m = new LDR.Colors.buildLineMaterial(colorManager, color, conditional);
    this.lineMaterials[key] = m;
    //console.log("Constructed (line) material " + this.cntMaterials + " for key " + key);
    return m;
}

LDR.MeshCollector.prototype.getTriangleMaterial = function(colorManager, color, isTrans) {
    var len = colorManager.shaderColors.length;
    var key;
    if(len > 1) {
	this.cntMaterials++;
	key = this.cntMaterials;
    }
    else {
	key = color + "|" + isTrans;
    }
    if(this.triangleMaterials.hasOwnProperty(key))
	return this.triangleMaterials[key];
    var m = new LDR.Colors.buildTriangleMaterial(colorManager, color, isTrans);
    this.triangleMaterials[key] = m;
    //console.log("Constructed (triangle) material " + this.cntMaterials + " for key " + key);
    return m;
}

LDR.MeshCollector.prototype.addLines = function(mesh) {
    this.lineMeshes.push(mesh);
    this.opaqueObject.add(mesh);
}
LDR.MeshCollector.prototype.addOpaque = function(mesh) {
    this.triangleMeshes.push(mesh);
    this.opaqueObject.add(mesh);
}
LDR.MeshCollector.prototype.addTrans = function(mesh) {
    this.triangleMeshes.push(mesh);
    this.transObject.add(mesh);
}

/*
  Sets '.visible' on all meshes according to ldrOptions and 
  visibility of this meshCollector.
 */
LDR.MeshCollector.prototype.updateMeshVisibility = function() {
    var v = this.visible;
    for(var i = 0; i < this.triangleMeshes.length; i++)
	this.triangleMeshes[i].visible = v;
    v = ldrOptions.lineContrast < 2 && this.visible;
    for(var i = 0; i < this.lineMeshes.length; i++)
	this.lineMeshes[i].visible = v;
}

LDR.MeshCollector.prototype.expandBoundingBox = function(boundingBox, m) {
    var b = new THREE.Box3();
    b.copy(boundingBox);
    b.applyMatrix4(m);

    if(!this.boundingBox) {
	this.boundingBox = b;
    }
    else {
	this.boundingBox.expandByPoint(b.min);
	this.boundingBox.expandByPoint(b.max);
    }
}

LDR.MeshCollector.prototype.setOldValue = function(old) {
    if(!LDR.Colors.canBeOld)
	return;
    for(var i = 0; i < this.triangleMeshes.length; i++) {
	this.triangleMeshes[i].material.uniforms.old.value = old;
    }
    for(var i = 0; i < this.lineMeshes.length; i++) {
	this.lineMeshes[i].material.uniforms.old.value = old;
    }
}

LDR.MeshCollector.prototype.colorLinesLDraw = function() {
    for(var i = 0; i < this.lineMeshes.length; i++) {
	var m = this.lineMeshes[i].material;
	var colors = m.colorManager.shaderColors;
	if(colors.length == 1)
	    m.uniforms.color.value = colors[0];
	else
	    m.uniforms.colors.value = colors;
    }
}

LDR.MeshCollector.prototype.colorLinesHighContrast = function() {
    for(var i = 0; i < this.lineMeshes.length; i++) {
	var m = this.lineMeshes[i].material;
	var colors = m.colorManager.highContrastShaderColors;
	if(colors.length == 1)
	    m.uniforms.color.value = colors[0];
	else
	    m.uniforms.colors.value = colors;
    }
}

LDR.MeshCollector.prototype.updateState = function(old) {
    this.old = old;
    this.lineContrast = ldrOptions.lineContrast;
    this.showOldColors = ldrOptions.showOldColors;
}

LDR.MeshCollector.prototype.update = function(old) {
    // Check if lines need to be recolored:
    if(this.lineContrast != ldrOptions.lineContrast) {
	if(ldrOptions.lineContrast == 1)
	    this.colorLinesLDraw();
	else
	    this.colorLinesHighContrast();
    }
    if(old != this.old || ldrOptions.showOldColors != this.showOldColors) {
	this.setOldValue(old && ldrOptions.showOldColors == 1);
    }
    this.updateState(old);
}

/*
  This is a temporary function used by single parts render. 
  To be decomissioned when colors are moved to an attribute.
 */
LDR.MeshCollector.prototype.overwriteColor = function(color) {    
    function handle(m, edge) {
	var c = m.colorManager;
	c.overWrite(color);
	var colors = !edge || ldrOptions.lineContrast > 0 ? c.shaderColors : c.highContrastShaderColors;
	if(colors.length == 1)
	    m.uniforms.color.value = colors[0];
	else
	    m.uniforms.colors.value = colors;
    }

    for(var i = 0; i < this.triangleMeshes.length; i++) {
	handle(this.triangleMeshes[i].material, false);
    }
    for(var i = 0; i < this.lineMeshes.length; i++) {
	handle(this.lineMeshes[i].material, true);
    }
}

LDR.MeshCollector.prototype.draw = function(old) {
    this.update(old);
    this.updateMeshVisibility();
}

LDR.MeshCollector.prototype.isVisible = function(v) {
    return this.visible;
}

/*
  Update meshes and set own visibility indicator.
*/
LDR.MeshCollector.prototype.setVisible = function(v) {
    if(this.visible == v)
	return;
    this.visible = v;
    this.updateMeshVisibility();
}

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
 * idToUrl is used to translate an id into a file location. Remember to change this function to fit your own directory structure if needed. A normal LDraw directory has files both under /parts and /p and requires you to search for dat files. You can choose to combine the directories, but this is not considered good practice. The function takes two parameters:
 * - id is the part id to be translated.
 * - top is true for top-level ids, such as .ldr and .mpd.
 */
THREE.LDRLoader = function(manager, onLoad, onProgress, onError, onWarning, loadRelatedFilesImmediately, idToUrl) {
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
    var self = this;
    this.idToUrl = idToUrl || function(id, top) {
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
		   part.ID != 'empty.dat') {
		    console.log("Special case: Empty '" + part.ID + "' does not match '" + fileName + "' - Create new shallow part!");		
		    // Create pseudo-model with just one of 'fileName' inside:
		    var rotation = new THREE.Matrix3();
		    rotation.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
		    var shallowSubModel = new THREE.LDRPartDescription(16, 
								       new THREE.Vector3(),
								       rotation, 
								       fileName,
								       false,
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
	case 0: // TODO: Many commands from LDraw and various vendors.
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
	    
	    // TODO: MLCad commands:
	    // TODO: LSynth commands:
	    // TODO: TEXMAP commands:
	    // TODO: Buffer exchange commands:
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
	    part.lines.push(new LDR.Line1(subModel));
	    invertNext = false;
	    break;
	case 2: // Line "2 <colour> x1 y1 z1 x2 y2 z2"
	    var p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    var p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    step.addLine(colorID, p1, p2);
	    part.lines.push(new LDR.Line2(colorID, p1, p2));
	    invertNext = false;
	    break;
	case 3: // 3 <colour> x1 y1 z1 x2 y2 z2 x3 y3 z3
	    var p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    var p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    var p3 = new THREE.Vector3(parseFloat(parts[8]), parseFloat(parts[9]), parseFloat(parts[10]));
	    if(CCW == invertNext) {
		step.addTrianglePoints(colorID, p3, p2, p1);
	    }
	    else {
		step.addTrianglePoints(colorID, p1, p2, p3);
	    }
	    if(!part.certifiedBFC || !localCull)
		step.cull = false; // Ensure no culling when step is handled.

	    part.lines.push(new LDR.Line3(colorID, p1, p2, p3, localCull, CCW != invertNext));
	    invertNext = false;
	    break;
	case 4: // 4 <colour> x1 y1 z1 x2 y2 z2 x3 y3 z3 x4 y4 z4
	    var p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    var p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    var p3 = new THREE.Vector3(parseFloat(parts[8]), parseFloat(parts[9]), parseFloat(parts[10]));
	    var p4 = new THREE.Vector3(parseFloat(parts[11]), parseFloat(parts[12]), parseFloat(parts[13]));
	    if(CCW == invertNext) {
		step.addQuadPoints(colorID, p4, p3, p2, p1);
	    }
	    else {
		step.addQuadPoints(colorID, p1, p2, p3, p4);
	    }
	    if(!part.certifiedBFC || !localCull)
		step.cull = false; // Ensure no culling when step is handled.

	    part.lines.push(new LDR.Line4(colorID, p1, p2, p3, p4, localCull, CCW != invertNext));
	    invertNext = false;
	    break;
	case 5: // Conditional lines:
	    var p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    var p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    var p3 = new THREE.Vector3(parseFloat(parts[8]), parseFloat(parts[9]), parseFloat(parts[10]));
	    var p4 = new THREE.Vector3(parseFloat(parts[11]), parseFloat(parts[12]), parseFloat(parts[13]));
	    step.addConditionalLine(colorID, p1, p2, p3, p4);
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
    var colorID = (this.colorID == 16 || this.colorID == 24) ? pd.colorID : this.colorID;
    
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
	ret.copy(defaultMatrix).multiply(rotationMatrix);
    }
    else if(this.type === "ADD") {
        throw "Unsupported rotation type: ADD!"
	//ret.copy(currentMatrix).multiply(rotationMatrix);
    }
    else { // this.type === ABS
	ret.copy(THREE.LDRStepRotation.ABS).multiply(rotationMatrix);
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
    var ret = this.dats.length;
    for(var i = 0; i < this.ldrs.length; i++) {
	ret += loader.ldrPartTypes[this.ldrs[i].ID].countParts(loader);
    }
    return ret;
}

/*
 * Enrich the meshCollector.
 */
THREE.LDRStep.prototype.generateThreePart = function(loader, colorID, position, rotation, cull, invertCCW, meshCollector, parentIsDat, selfIsDat) {
    //console.log("Creating three part for " + this.ldrs.length + " sub models and " + this.dats.length + " DAT parts in color " + colorID + ", cull: " + cull + ", invertion: " + invertCCW);
    if(!meshCollector)
	throw "Fatal: Missing mesh collector!";
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
    
    // Add lines:
    for(var i = 0; i < this.lines.length; i++) {
	var line = this.lines[i]; // {colorID, p1, p2}
	var p1 = transformPoint(line.p1);
	var p2 = transformPoint(line.p2);
	var lineColor = transformColor(line.colorID);
	meshCollector.addLine(lineColor, p1, p2);
    }
    
    // Add triangles:
    for(var i = 0; i < this.triangles.length; i++) {
	var triangle = this.triangles[i]; // {colorID, p1, p2, p3}
	var triangleColor = transformColor(triangle.colorID);
	var p1 = transformPoint(triangle.p1);
	var p2 = transformPoint(triangle.p2);
	var p3 = transformPoint(triangle.p3);
	meshCollector.addTriangles(triangleColor, p1, p2, p3, ownInversion, ownCull);
    }
    
    // Add quads:
    for(var i = 0; i < this.quads.length; i++) {
	var quad = this.quads[i]; // {colorID, p1, p2, p3, p4}
	var quadColor = transformColor(quad.colorID);
	var p1 = transformPoint(quad.p1);
	var p2 = transformPoint(quad.p2);
	var p3 = transformPoint(quad.p3);
	var p4 = transformPoint(quad.p4);
	meshCollector.addQuads(quadColor, p1, p2, p3, p4, ownInversion, ownCull);
    }
    
    // Add conditional lines:
    for(var i = 0; i < this.conditionalLines.length; i++) {
	var conditionalLine = this.conditionalLines[i];
	var p1 = transformPoint(conditionalLine.p1);
	var p2 = transformPoint(conditionalLine.p2);
	var p3 = transformPoint(conditionalLine.p3);
	var p4 = transformPoint(conditionalLine.p4);
	var c = transformColor(conditionalLine.colorID);
	meshCollector.addConditionalLine(c, p1, p2, p3, p4);
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
	subModel.generateThreePart(loader, subModelColor, nextPosition, nextRotation, subModelCull, subModelInversion, meshCollector, selfIsDat);
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
    // Bake:
    if(!parentIsDat && selfIsDat || meshCollector.unbakedVertices.length > 250) {
	meshCollector.bakeVertices();
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

/*
  Binary merge of the geometry streams.
 */
THREE.mergeGeometries = function(geometries) {
    do {
	var nextGeometries = [];
	if(geometries.length % 2 == 1)
	    nextGeometries.push(geometries[geometries.length-1]);
	for(var i = 0; i < geometries.length-1; i+=2) {
	    geometries[i].merge(geometries[i+1]);
	    nextGeometries.push(geometries[i]);
	}
	geometries = nextGeometries;
    } while(geometries.length > 1);
    return geometries[0];
}

THREE.LDRGeometry = function() {
    this.vertices = []; // sorted THREE.Vector3 (x,y,z).
    this.lineIndices = [];
    this.conditionalLineIndices = [];
    this.triangleIndices = [];
    this.quadIndices = [];

    /*
      
     */
    this.fromStep = function() {
	var geometries = [];

	this.ldrs = [];
	this.dats = [];
	this.lines = []; // {colorID, p1, p2}
	this.conditionalLines = []; // {colorID, p1, p2, p3, p4}
	this.triangles = []; // {colorID, p1, p2, p3}
	this.quads = []; // {colorID, p1, p2, p3, p4}
	this.cull = true;

	// TODO

	this.copy(THREE.mergeGeometries(geometries));
    }

    this.copy = function(g) {
	this.vertices = g.vertices;
	this.lineIndices = g.lineIndices;
	this.conditionalLineIndices = g.conditionalLineIndices;
	this.triangleIndices = g.triangleIndices;
	this.quadIndices = g.quadIndices;
    }

    /*
      Merge sort all geometric primitives:
     */
    this.fromPartType = function(pt) {
	// Merge all steps:
	for(var i = 0; i < pt.steps.length; i++)
	    // TODO
	var geometries = [];
	THREE.LDRGeometry();
    }

    this.merge = function(other) {
	// First merge vertices:
	var mergedVertices = [];
	var indexMapThis = [];
	var indexMapOther = [];
	var idxThis = 0, idxOther = 0;
	while(idxThis < this.vertices.length && idxOther < other.vertices.length) {
	    var pThis = this.vertices[idxThis];
	    var pOther = other.vertices[idxOther];
	    if(pThis.x == pOther.x && pThis.y == pOther.y && pThis.z == pOther.z) {
		indexMapThis.push(mergedVertices.length);
		indexMapOther.push(mergedVertices.length);
		mergedVertices.push(pThis);
		++idxThis;
		++idxOther;
	    }
	    else if(pThis.x < pOther.x ||
	       (pThis.x == pOther.x && (pThis.y < pOther.y || 
					(pThis.y == pOther.y && pThis.z < pOther.z)))) {
		indexMapThis.push(mergedVertices.length);
		mergedVertices.push(pThis);
		++idxThis;
	    }
	    else {
		indexMapOther.push(mergedVertices.length);
		mergedVertices.push(pOther);
		++idxOther;
	    }
	}
	while(idxThis < this.vertices.length) {
	    var pThis = this.vertices[idxThis];
	    indexMapThis.push(mergedVertices.length);
	    mergedVertices.push(pThis);
	    ++idxThis;
	}
	while(idxOther < this.vertices.length) {
	    var pOther = this.vertices[idxOther];
	    indexMapOther.push(mergedVertices.length);
	    mergedVertices.push(pOther);
	    ++idxOther;
	}

	// Merge the lines, conditional lines, triangles and quads:
	for(var i = 0; i < this.lineIndices.length; i++)
	    this.lineIndices[i] = indexMapThis[this.lineIndices[i]];
	for(var i = 0; i < this.conditionalLineIndices.length; i++)
	    this.conditionalLineIndices[i] = indexMapThis[this.conditionalLineIndices[i]];
	for(var i = 0; i < this.triangleIndices.length; i++)
	    this.triangleIndices[i] = indexMapThis[this.triangleIndices[i]];
	for(var i = 0; i < this.quadIndices.length; i++)
	    this.quadIndices[i] = indexMapThis[this.quadIndices[i]];
	for(var i = 0; i < other.lineIndices.length; i++)
	    this.lineIndices.oush(indexMapThis[other.lineIndices[i]]);
	for(var i = 0; i < other.conditionalLineIndices.length; i++)
	    this.conditionalLineIndices.push(indexMapThis[other.conditionalLineIndices[i]]);
	for(var i = 0; i < other.triangleIndices.length; i++)
	    this.triangleIndices.push(indexMapThis[other.triangleIndices[i]]);
	for(var i = 0; i < other.quadIndices.length; i++)
	    this.quadIndices.push(indexMapThis[other.quadIndices[i]]);
    }
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
    this.inlined;
    this.ldraw_org;
    this.geometry;

    this.prepareGeometry = function() {
	if(this.geometry) {
	    console.warn("Geometry already prepared for " + this.ID);
	    return;
	}
	this.geometry = new THREE.LDRGeometry();
	this.geometry.fromPartType(this);
    }

    this.addStep = function(step) {
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

    this.generateThreePart = function(loader, c, p, r, cull, inv, meshCollector, parentIsDat) {
	for(var i = 0; i < this.steps.length; i++) {
	    this.steps[i].generateThreePart(loader, c, p, r, cull, inv, meshCollector, parentIsDat, this.isPart());
	}
    }
    
    this.isPart = function() {
	return this.ID.endsWith('dat') || (this.steps.length == 1 && this.steps[0].hasPrimitives);
    }

    this.countParts = function(loader) {
	var ret = 0;
	for(var i = 0; i < this.steps.length; i++) {
	    ret += this.steps[i].countParts(loader);
	}
	return ret;
    }
}

THREE.LDRMeshCollectorColorManager = function() {
    this.shaderColors = []; // [] => Vector4
    this.highContrastShaderColors = []; // [] => Vector4
    this.map = []; // colorID -> floatColor
    this.sixteen = -1;
    this.edgeSixteen = -1;

    this.overWrite = function(id) {
	var colorObject = LDR.Colors[id];
	var alpha = colorObject.alpha ? colorObject.alpha/256.0 : 1;
	if(this.sixteen >= 0) {
	    var color = new THREE.Color(colorObject.value);
	    this.shaderColors[this.sixteen] = new THREE.Vector4(color.r, color.g, color.b, alpha);
	}
	if(this.edgeSixteen >= 0) {
	    color = new THREE.Color(colorObject.edge);
	    this.shaderColors[this.edgeSixteen] = new THREE.Vector4(color.r, color.g, color.b, alpha);
	}
    }

    this.get = function(id) {
	var f = this.map[id];
	if(f) {
	    return f;
	}
	if(id == 16)
	    this.sixteen = this.shaderColors.length;
	else if(id == 10016)
	    this.edgeSixteen = this.shaderColors.length;

	var isEdge = id >= 10000;
	var lowID = isEdge ? id-10000 : id;
	var colorObject = LDR.Colors[lowID];
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

THREE.LDRMeshBuilder = function(loader, onlyLoadParts, onProgress, onLoad) { // , numberOfWorkers
    /* Set up for part types:
       - children = count of unhandled children
       - parents = ID's of parents
     */
    var ready = []; // Ready list of ID's
    function prepare(parent, child) {
	if(child.parents[parent.ID])
	    return; // Already referencing.
	parent.children++;
	child.parents.push(child.ID);
    }
    for(var i = 0; i < loader.ldrPartTypes.length; i++) {
	var partType = loader.ldrPartTypes[i];
	var childLess = true;
	for(var j = 0; j < partType.steps.length; j++) {
	    var step = partType.steps[j];
	    for(var k = 0; k < step.ldrs.length; k++) {
		prepare(partType, loader.ldrPartTypes[step.ldrs[k].ID]);
		childLess = false;
	    }
	    for(var k = 0; k < step.dats.length; k++) {
		prepare(partType, loader.ldrPartTypes[step.dats[k].ID]);
		childLess = false;
	    }
	}
	if(childLess)
	    ready.push(partType.ID);
    }

    /*
      Run in rounds:
     */
    var nextRound = [];
    do { // Handle each in the ready list:	
	for(var i = 0; i < ready.length; i++) {
	    var partType = loader.ldrPartTypes[ready[i]];
	    for(var j = 0; j < partType.parent.length; j++) {
		var parent = partType.parent[j];
		parent.children--;
		if(parent.children == 0 && (!onlyLoadParts || parent.isPart())) {
		    nextRound.push(parent.ID);
		}
	    }
	    partType.prepareGeometry();
	}
	
	ready = nextRound;
	nextRound = [];
    } while(ready.length > 0);

    /*
      Run workers:
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
  LDRMeshCollector handles drawing and updates of displayed meshes (triangles and lines).
  This is the class you have to update in order to improve the 3D renderer (such as with materials, luminance, etc.)

  THREE.LDRMeshCollector assumes ldrOptions is an LDR.Options object in global scope.
  (See LDROptions.js)
*/
THREE.LDRMeshCollector = function() {
    // Vertices (shared among both triangles and lines):
    this.unbakedVertices = []; // Points {x,y,z,id,t,c} // t = 0 for triangles, c=colorID
    this.vertices = []; // 'baked' vertices shared by triangles and normal lines.
    this.sizeVertices = 0;

    this.triangleColors = new THREE.LDRMeshCollectorColorManager();
    this.ttriangleColors = new THREE.LDRMeshCollectorColorManager();
    this.lineColors = new THREE.LDRMeshCollectorColorManager();
    this.conditionalLineColors = new THREE.LDRMeshCollectorColorManager();
    this.triangleIndices = []; // [] -> {p1, p2, p3}
    this.ttriangleIndices = []; // [] -> {p1, p2, p3} ttriangle = transparent triangle
    this.lineIndices = []; // [] -> {p1, p2}
    this.conditionalLines = []; // [] -> {fc, p1, p2, p3, p4}

    // Final three.js geometries:
    this.lineMesh;
    this.conditionalLineMesh;
    this.triangleMesh;
    this.ttriangleMesh;

    this.isMeshCollector = true;
    this.old = false;
    this.visible = false;
    this.created = false;
}

THREE.LDRMeshCollector.prototype.addTriangle = function(c, p1, p2, p3) {
    var t, floatColor, indices;
    if(LDR.Colors.isTrans(c)) {
	floatColor = this.ttriangleColors.get(c);
	indices = this.ttriangleIndices;
	t = 2;
    }
    else {
	floatColor = this.triangleColors.get(c);
	indices = this.triangleIndices;
	t = 1;
    }
    var size = indices.length;
    indices.push(0, 0, 0);

    this.unbakedVertices.push({x:p1.x, y:p1.y, z:p1.z, id:size,   t:t, fc:floatColor},
			      {x:p2.x, y:p2.y, z:p2.z, id:size+1, t:t, fc:floatColor}, 
			      {x:p3.x, y:p3.y, z:p3.z, id:size+2, t:t, fc:floatColor});
}

THREE.LDRMeshCollector.prototype.addTriangles = function(c, p1, p2, p3, ownInversion, ownCull) {
    if(!ownInversion || !ownCull) {
	this.addTriangle(c, p1, p2, p3);
    }
    if(ownInversion || !ownCull) { // Use 'if' instead of 'else' to add triangles when there is no culling.
	this.addTriangle(c, p3, p2, p1);
    }
}

THREE.LDRMeshCollector.prototype.addQuad = function(c, p1, p2, p3, p4) {
    var t, floatColor, indices;
    if(LDR.Colors.isTrans(c)) {
	floatColor = this.ttriangleColors.get(c);
	indices = this.ttriangleIndices;
	t = 2;
    }
    else {
	floatColor = this.triangleColors.get(c);
	indices = this.triangleIndices;
	t = 1;
    }
    var size = indices.length;
    indices.push(0, 0, 0, 0, 0, 0);

    this.unbakedVertices.push({x:p1.x, y:p1.y, z:p1.z, id:size,   t:t, fc:floatColor},
			      {x:p2.x, y:p2.y, z:p2.z, id:size+1, t:t, fc:floatColor}, 
			      {x:p4.x, y:p4.y, z:p4.z, id:size+2, t:t, fc:floatColor},
			      {x:p4.x, y:p4.y, z:p4.z, id:size+3, t:t, fc:floatColor},
			      {x:p2.x, y:p2.y, z:p2.z, id:size+4, t:t, fc:floatColor}, 
			      {x:p3.x, y:p3.y, z:p3.z, id:size+5, t:t, fc:floatColor});
}

THREE.LDRMeshCollector.prototype.addQuads = function(c, p1, p2, p3, p4, ownInversion, ownCull) {
    if(!ownInversion || !ownCull) {
	this.addQuad(c, p1, p2, p3, p4);
    }
    if(ownInversion || !ownCull) { // Use 'if' instead of 'else' to add quads when there is no culling.
	this.addQuad(c, p4, p3, p2, p1);
    }
}

THREE.LDRMeshCollector.prototype.addLine = function(c, p1, p2) {
    var size = this.lineIndices.length;
    this.lineIndices.push(0, 0);
    var floatColor = this.lineColors.get(c, 'line');
    this.unbakedVertices.push({x:p1.x, y:p1.y, z:p1.z, id:size,   t:0, fc:floatColor},
			      {x:p2.x, y:p2.y, z:p2.z, id:size+1, t:0, fc:floatColor});
}

THREE.LDRMeshCollector.prototype.addConditionalLine = function(c, p1, p2, p3, p4) {
    var floatColor = this.conditionalLineColors.get(c, 'cond line');
    this.conditionalLines.push({p1:p1, p2:p2, p3:p3, p4:p4, fc:floatColor});
}

/*
  Sets '.visible' on all meshes according to ldrOptions and 
  visibility of this meshCollector.
 */
THREE.LDRMeshCollector.prototype.updateMeshVisibility = function() {
    var v = this.visible;
    if(this.triangleMesh)
	this.triangleMesh.visible = v;
    if(this.ttriangleMesh)
	this.ttriangleMesh.visible = v;
    v = ldrOptions.lineContrast < 2 && this.visible;
    if(this.lineMesh)
	this.lineMesh.visible = v;
    if(this.conditionalLineMesh)
	this.conditionalLineMesh.visible = v;
}

THREE.LDRMeshCollector.prototype.createNormalLines = function(baseObject) {
    var colors = ldrOptions.lineContrast == 0 ? this.lineColors.highContrastShaderColors : this.lineColors.shaderColors;
    var len = colors.length;
    if(len == 0) {
	return;
    }
    var lineMaterial = new THREE.RawShaderMaterial( {
	uniforms: {
	    colors: { type: 'v4v', value: colors },
	    old: { value: false }
	},
	vertexShader: LDR.Shader.createSimpleVertexShader(len, true, 16, true),
	fragmentShader: LDR.Shader.SimpleFragmentShader,
	transparent: false
    });

    var lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setIndex(this.lineIndices);
    lineGeometry.addAttribute('position', this.vertexAttribute);

    this.lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    baseObject.add(this.lineMesh);
    
    this.lineIndices = undefined;
}

/*
  Create conditional lines.
*/
THREE.LDRMeshCollector.prototype.createConditionalLines = function(baseObject) {
    var colors = ldrOptions.lineContrast == 0 ? this.conditionalLineColors.highContrastShaderColors : this.conditionalLineColors.shaderColors;
    var len = colors.length;
    if(len == 0) {
	return;
    }
    var lineMaterial = new THREE.RawShaderMaterial( {
	uniforms: {
	    colors: { type: 'v4v', value: colors },
	    old: { value: false }
	},
	vertexShader: LDR.Shader.createConditionalVertexShader(len, false, 16, true),
	fragmentShader: LDR.Shader.AlphaTestFragmentShader,
	transparent: false
    });

    var lineGeometry = new THREE.BufferGeometry();
    var p1s = [], p2s = [], p3s = [], p4s = [], colorIndices = [];

    // Now handle conditional lines:
    for(var i = 0; i < this.conditionalLines.length; i++) {
	var line = this.conditionalLines[i]; // {p1, p2, p3, p4, fc}

	p1s.push(line.p1.x, line.p1.y, line.p1.z, line.p2.x, line.p2.y, line.p2.z);
	p2s.push(line.p2.x, line.p2.y, line.p2.z, line.p1.x, line.p1.y, line.p1.z);
	p3s.push(line.p3.x, line.p3.y, line.p3.z, line.p3.x, line.p3.y, line.p3.z);
	p4s.push(line.p4.x, line.p4.y, line.p4.z, line.p4.x, line.p4.y, line.p4.z);
	colorIndices.push(line.fc, line.fc); // 2 points.
    }
    lineGeometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(p1s), 3));
    lineGeometry.addAttribute('p2', new THREE.BufferAttribute(new Float32Array(p2s), 3));
    lineGeometry.addAttribute('p3', new THREE.BufferAttribute(new Float32Array(p3s), 3));
    lineGeometry.addAttribute('p4', new THREE.BufferAttribute(new Float32Array(p4s), 3));
    lineGeometry.addAttribute('colorIndex', new THREE.BufferAttribute(new Float32Array(colorIndices), 1));

    this.conditionalLineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    baseObject.add(this.conditionalLineMesh);

    this.conditionalLines = undefined;
}

THREE.LDRMeshCollector.prototype.computeBoundingBox = function() {
    if(this.boundingBox)
	throw "Bounding box already computed!";
    var mc = this;
    function expandBB(mesh) {
	mesh.geometry.computeBoundingBox();
	var b = mesh.geometry.boundingBox;

	if(!mc.boundingBox) {
	    mc.boundingBox = new THREE.Box3();
	    mc.boundingBox.copy(b);
	}
	else {
	    mc.boundingBox.expandByPoint(b.min);
	    mc.boundingBox.expandByPoint(b.max);
	}
    }

    if(this.triangleMesh) {
	expandBB(this.triangleMesh);
    }
    if(this.ttriangleMesh) {
	expandBB(this.ttriangleMesh);
    }
    if(this.lineMesh) {
	expandBB(this.lineMesh);
    }
    if(this.conditionalLineMesh) {
	expandBB(this.conditionalLineMesh);
    }
}

var orig = 0;
var reduced = 0;
THREE.LDRMeshCollector.prototype.bakeVertices = function() {
    // Sort and reduce the vertices:
    var len = this.unbakedVertices.length;
    orig += len;
    //console.log("Baking " + len + " vertices.");
    this.unbakedVertices.sort(function(a, b){
	if(a.x != b.x)
	    return a.x-b.x;
	if(a.y != b.y)
	    return a.y-b.y;
	if(a.z != b.z)
	    return a.z-b.z;
	return a.fc-b.fc;
    });
    
    var prev = {x:-123456, y:-123456, z:-123456, fc:0};
    for(var i = 0; i < len; i++) {
	var p = this.unbakedVertices[i];
	if(p.fc != prev.fc || p.z != prev.z || p.y != prev.y || p.x != prev.x) {
	    // New vertex:
	    this.vertices.push(p.x, p.y, p.z, p.fc);
	    reduced++;
	    this.sizeVertices++;
	    prev = p;
	}
	if(p.t == 1) { // Non-transparent triangles:
	    this.triangleIndices[p.id] = this.sizeVertices - 1;
	}
	else if(p.t == 2) { // Transparent triangles:
	    this.ttriangleIndices[p.id] = this.sizeVertices - 1;
	}
	else {
	    this.lineIndices[p.id] = this.sizeVertices - 1;
	}
    }
    this.unbakedVertices = [];
    //console.log("Compacted to " + reduced + " vertices / " + orig);
}

THREE.LDRMeshCollector.prototype.buildTriangles = function(old, baseObject, trans) {
    var colors = trans ? this.ttriangleColors : this.triangleColors;
    var len = colors.shaderColors.length;
    if(len == 0) {
	//console.log("No triangles. Skipping mesh. Trans: " + trans);
	return;
    }
    var material = new THREE.RawShaderMaterial( {
	uniforms: {
	    colors: { type: 'v4v', value: colors.shaderColors },
	    old: { value: false }
	},
	vertexShader: LDR.Shader.createSimpleVertexShader(len, false, 16, false),
	fragmentShader: LDR.Shader.SimpleFragmentShader,
	transparent: trans
    });

    var geometry = new THREE.BufferGeometry();
    geometry.setIndex(trans ? this.ttriangleIndices : this.triangleIndices);
    geometry.addAttribute('position', this.vertexAttribute);
    var mesh = new THREE.Mesh(geometry, material);
    baseObject.add(mesh);

    if(trans) {
	this.ttriangleMesh = mesh;
	this.ttriangleIndices = undefined;
    }
    else {
	this.triangleMesh = mesh;
	this.triangleIndices = undefined;
    }
}

THREE.LDRMeshCollector.prototype.colorTrianglesOldSingleColor = function() {
    if(this.triangleMesh) {
	this.triangleMesh.material.uniforms.old.value = 1;
    }
    if(this.ttriangleMesh) {
	this.ttriangleMesh.material.uniforms.old.value = 1;
    }
    if(this.lineMesh) {
	this.lineMesh.material.uniforms.old.value = 1;
    }
    if(this.conditionalLineMesh) {
	this.conditionalLineMesh.material.uniforms.old.value = 1;
    }
}

THREE.LDRMeshCollector.prototype.colorTrianglesNormal = function() {
    if(this.triangleMesh) {
	this.triangleMesh.material.uniforms.old.value = 0;
    }
    if(this.ttriangleMesh) {
	this.ttriangleMesh.material.uniforms.old.value = 0;
    }
    if(this.lineMesh) {
	this.lineMesh.material.uniforms.old.value = 0;
    }
    if(this.conditionalLineMesh) {
	this.conditionalLineMesh.material.uniforms.old.value = 0;
    }
}

THREE.LDRMeshCollector.prototype.colorLinesLDraw = function() {
    if(this.lineMesh) {
	var c = this.lineColors.shaderColors;
	this.lineMesh.material.uniforms.colors.value = c;
    }
    if(this.conditionalLineMesh) {
	var c = this.conditionalLineColors.shaderColors;
	this.conditionalLineMesh.material.uniforms.colors.value = c;
    }
}

THREE.LDRMeshCollector.prototype.colorLinesHighContrast = function() {
    if(this.lineMesh) {
	var c = this.lineColors.highContrastShaderColors;
	this.lineMesh.material.uniforms.colors.value = c;
    }
    if(this.conditionalLineMesh) {
	var c = this.conditionalLineColors.highContrastShaderColors;
	this.conditionalLineMesh.material.uniforms.colors.value = c;
    }
}

THREE.LDRMeshCollector.prototype.updateState = function(old) {
    this.old = old;
    this.lineContrast = ldrOptions.lineContrast;
    this.oldColor = ldrOptions.oldColor;
    this.showOldColors = ldrOptions.showOldColors;
}

/*
 * Returns true on creation.
 */
THREE.LDRMeshCollector.prototype.createOrUpdate = function(old, baseObject) {
    if(!this.created) { // Build:
	this.updateState(old);
	this.vertexAttribute = new THREE.Float32BufferAttribute(this.vertices, 4); // to be reused
	this.vertices = undefined;
	this.buildTriangles(old, baseObject, false);

	this.visible = true;
	this.createNormalLines(baseObject);
	this.createConditionalLines(baseObject);
	this.buildTriangles(old, baseObject, true); // Add transparent triangles last.
	this.computeBoundingBox();

	this.created = true;
	return true;
    }

    // Check if lines need to be recolored:
    if(this.lineContrast != ldrOptions.lineContrast) {
	if(ldrOptions.lineContrast == 1)
	    this.colorLinesLDraw();
	else
	    this.colorLinesHighContrast();
    }

    if(old !== this.old) {
	// Change between new and old:
	if(old) { // Make triangles old:
	    if(ldrOptions.showOldColors === 1) { // Color in old color:
		this.colorTrianglesOldSingleColor();
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

/*
  This is a temporary function used by single parts render. 
  To be decomissioned when colors are moved to an attribute.
 */
THREE.LDRMeshCollector.prototype.overwriteColor = function(color) {    
    if(this.lineMesh) {
	var c = this.lineColors;
	c.overWrite(color);
	this.lineMesh.material.uniforms.colors.value = c.shaderColors;
    }
    if(this.conditionalLineMesh) {
	var c = this.conditionalLineColors;
	c.overWrite(color);	    
	this.conditionalLineMesh.material.uniforms.colors.value = c.shaderColors;
    }
    if(this.triangleMesh) {
	var c = this.triangleColors;
	c.overWrite(color);
	this.triangleMesh.material.uniforms.colors.value = c.shaderColors;
    }
    if(this.ttriangleMesh) {
	var c = this.ttriangleColors;
	c.overWrite(color);
	this.ttriangleMesh.material.uniforms.colors.value = c.shaderColors;
    }
}

THREE.LDRMeshCollector.prototype.draw = function(baseObject, old) {
    var created = this.createOrUpdate(old, baseObject);
    if(!created)
	this.updateMeshVisibility();
}

THREE.LDRMeshCollector.prototype.isVisible = function(v) {
    return this.visible;
}

/*
  Update meshes and set own visibility indicator.
*/
THREE.LDRMeshCollector.prototype.setVisible = function(v) {
    if(this.visible === v)
	return;
    this.visible = v;
    this.updateMeshVisibility();
}

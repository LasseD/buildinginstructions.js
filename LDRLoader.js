'use strict';

/**
 * @author Lasse Deleuran / http://c-mt.dk
 * LDR Specification: http://www.ldraw.org/documentation/ldraw-org-file-format-standards.html
 */
THREE.LDRLoader = function(manager, onLoad, onProgress, onError) {
    this.manager = manager;
    this.ldrPartTypes = []; // id => part. id can be "parts/3001.dat", "model.mpd", etc.
    this.unloadedFiles = 0;
    this.onLoad = onLoad;
    this.onProgress = onProgress;
    this.onError = onError;
    this.loader = new THREE.FileLoader(manager);
    this.mainModel;
}

/*
  Load a ldr/mpd/dat file.
  For BFC parameters, see: http://www.ldraw.org/article/415.html
  This function follows the procedure from there to handle BFC.
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
	var mainModelLoaded = self.parse(text);
	//if(self.isTopLevelModel(id))
	   self.mainModel = mainModelLoaded;
	self.unloadedFiles--; // Warning - might have concurrency issue when two threads simultaneously update this!
	self.reportProgress(id);
    }
    this.unloadedFiles++;
    var url = this.idToUrl(id, top);
    this.loader.load(url, onFileLoaded, self.onProgress, self.onError);
};

/*
  Invoke onProgress(id)
  Check if all subModels have loaded. If so, invoke onLoad()
*/
THREE.LDRLoader.prototype.reportProgress = function(id) {
    this.onProgress(id);
    if(this.unloadedFiles == 0) {
	this.onLoad();
    }
};

THREE.LDRLoader.prototype.isTopLevelModel = function(id) {
    return id.endsWith(".ldr") || id.endsWith(".mpd");
}

/*
TODO FIXME: Remember to change this function to fit your own directory structure. 
A real LDraw directory has files both under /parts and /p and requires you to search for the DAT file.
*/
THREE.LDRLoader.prototype.idToUrl = function(id, top) {
    return id;
    //if(this.isTopLevelModel(id))
    //	return id;
    //return "parts/" + id.toLowerCase();
}

THREE.LDRLoader.prototype.parse = function(data) {
    // BFC Parameters:
    var CCW = true; // Assume CCW as default
    var invertNext = false; // Don't assume that first line needs inverted.

    // Start parsing:
    var part = new THREE.LDRPartType();
    var step = new THREE.LDRStep();
    var extraSteps = {};
    function closeStep(keepRoration) {
	part.addStep(step);
	var rot = step.rotation;
	step = new THREE.LDRStep();
	if(keepRoration)
	    step.rotation = rot;

	for (var key in extraSteps) {
	    var extraStep = extraSteps[key];
	    extraStep.rotation = rot;
	    part.addStep(extraStep);
	}
	extraSteps = {};
    }

    // State information:
    var bufferLinePoints = null;
    var previousComment = "";
    var firstModel = true;
    var firstModelName;

    var dataLines = data.split("\r\n");
    //console.log(dataLines.length + " lines to parse.");
    for(var i = 0; i < dataLines.length; i++) {
	var line = dataLines[i];
	var parts = line.split(" ").filter(x => x !== '');
	if(parts.length <= 1)
	    continue;
	var lineType = parseInt(parts[0]);
	//console.log("Parsing line " + i + " of type " + lineType + ": " + line);

	// Close lines:
	if(bufferLinePoints && lineType != 2) {
	    step.addLine(bufferLinePoints);
	    bufferLinePoints = null;
	}

	switch(lineType) {
	case 0: // TODO: Many commands from LDraw and various vendors.
	    if(parts.length == 3 && "FILE" === parts[1]) { // NOFILE command is not supported.
		// MPD FILE Block found. Set name and start new part if not the first
		if(!firstModel) {
		    // Close model and start new:
		    if(bufferLinePoints) {
			step.addLine(bufferLinePoints);
			bufferLinePoints = null;
		    }
		    closeStep(false);
		    this.ldrPartTypes[part.ID] = part;
		    part = new THREE.LDRPartType();
		}
		part.setID(parts[2]);
		if(firstModel)
		    firstModelName = part.ID;
		firstModel = false;		
	    }
	    else if(parts.length == 3 && "Name:" === parts[1]) {
		// LDR Name: line found. Set name and update data in case this is an ldr file (do not use file suffix to determine).
		// Set name and model description:
		part.setID(parts[2]);
		if(!part.modelDescription)
		    part.modelDescription = previousComment;
		if(firstModel)
		    firstModelName = part.ID;
		firstModel = false;
	    }
	    if(parts.length >= 3 && "Author:" === parts[1]) {
		part.author = line.substring(9).trim();
		if(!part.modelDescription)
		    part.modelDescription = previousComment;
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
		    //console.log("Rotation! " + parts[2] + " " + parts[3] + " " + parts[4] + " " + parts[5]);
		    step.rotation = new THREE.LDRStepRotation(parts[2], parts[3], parts[4], (parts.length == 5 ? "REL" : parts[5]));
		}
		else if(parts.length == 3 && parts[2] === "END") {
		    //console.log("Rotation END! ");
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
	    var subModelID = parts[14].toLowerCase();
	    var subModelColorID = parseInt(parts[1]);
	    var subModel = new THREE.LDRPartDescription(subModelColorID, 
							position, 
							rotation, 
							subModelID, 
						        invertNext);
	    var isLDR = subModelID.endsWith('.ldr');
	    if(isLDR) {
		var prevStep = extraSteps[subModelColorID + subModelID];
		if(prevStep) {
		    prevStep.addLDR(subModel); // Same color and type => add there.
		}
		else {
		    var extraStep = new THREE.LDRStep();
		    extraStep.addLDR(subModel);
		    extraSteps[subModelColorID + subModelID] = extraStep;
		}
	    }
	    else {
		step.addDAT(subModel); // DAT part - no step.
	    }
	    /*if(!isLDR) {
		// TODO FIXME: Comment in the next line to start loading files async. as soon as they are encountered:
		this.load(subModelID, this.isTopLevelModel(part.ID)); // Start loading the separate file immediately!
	    }*/
	    invertNext = false;
	    break;
	case 2: // Line "2 <colour> x1 y1 z1 x2 y2 z2"
	    var p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    var p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    if(bufferLinePoints) {
		// If only one line segment: Might have to swap points:
		if(bufferLinePoints.length == 2) {
		    if(bufferLinePoints[0].equals(p1) || 
		       bufferLinePoints[0].equals(p2)) {
			var tmp = bufferLinePoints[0];
			bufferLinePoints[0] = bufferLinePoints[1];
			bufferLinePoints[1] = tmp;
		    }
		}
		// If p2 matches last point, swap p1 and p2:
		if(p2.equals(bufferLinePoints[bufferLinePoints.length-1])) {
		    var tmp = p1;
		    p1 = p2;
		    p2 = tmp;
		}
		// Append or start new:
		if(p1.equals(bufferLinePoints[bufferLinePoints.length-1])) {
		    bufferLinePoints.push(p2);
		}
		else {
		    step.addLine(bufferLinePoints);
		    bufferLinePoints = [p1, p2];		    
		}
	    }
	    else {
		// No line points. Add:
		bufferLinePoints = [p1, p2];
	    }
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
		step.addTrianglePoint(p3);
		step.addTrianglePoint(p2);
		step.addTrianglePoint(p1);
	    }
	    else {
		step.addTrianglePoint(p1);
		step.addTrianglePoint(p2);
		step.addTrianglePoint(p3);
	    }
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
		step.addTrianglePoint(p4);
		step.addTrianglePoint(p2);
		step.addTrianglePoint(p1);

		step.addTrianglePoint(p4);
		step.addTrianglePoint(p3);
		step.addTrianglePoint(p2);
	    }
	    else {
		step.addTrianglePoint(p1);
		step.addTrianglePoint(p2);
		step.addTrianglePoint(p4);

		step.addTrianglePoint(p2);
		step.addTrianglePoint(p3);
		step.addTrianglePoint(p4);
	    }

	    invertNext = false;
	    break;
	case 5: // Conditional lines:
	    // TODO
	    invertNext = false;
	    break;
	}
    }

    // Close lines:
    if(bufferLinePoints) {
	step.addLine(bufferLinePoints);
	bufferLinePoints = null;
    }
    part.addStep(step);
    this.ldrPartTypes[part.ID] = part;

    return firstModelName;
};

/*
Part description: a part (ID) placed (position, rotation) with a given color (16/24 allowed) and invertCCW to allow for sub-parts in DAT-parts.
*/
THREE.LDRPartDescription = function(colorID, position, rotation, ID, invertCCW) {
    this.colorID = colorID; // LDraw ID
    this.position = position; // Vector3
    this.rotation = rotation; // Matrix3
    this.ID = ID.toLowerCase(); // part.dat lowercase
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

    var i = this.invertCCW == pd.invertCCW;

    return new THREE.LDRPartDescription(colorID, position, rotation, this.ID, i);
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

THREE.LDRStep = function() {
    this.empty = true;
    this.ldrs = [];
    this.dats = [];
    this.lines = [];
    this.trianglePoints = [];
    this.rotation = null;

    this.addLine = function(line) {
	this.empty = false;
    	this.lines.push(line);
    }
    this.addTrianglePoint = function(p) {
	this.empty = false;
	this.trianglePoints.push(p);
    }
    this.addLDR = function(ldr) {
	this.empty = false;
	this.ldrs.push(ldr);
    }
    this.addDAT = function(dat) {
	this.empty = false;
	this.dats.push(dat);
    }

    this.generateThreePart = function(loader, colorID, position, rotation, invertCCW, meshCollector) {
	//console.log("Creating three part for " + this.ldrs.length + " sub models and " + this.dats.length + " DAT parts in color " + colorID + ", invertion: " + invertCCW);
	var ownInvertion = (rotation.determinant() < 0) != invertCCW; // Adjust for inversed matrix!

	var transformPoint = function(p) {
	    var ret = new THREE.Vector3();
	    ret.copy(p);
	    ret.applyMatrix3(rotation);
	    ret.add(position);
	    return ret;
	}

	// Add lines:
	if(colorID == 0) { // Add lines for black parts:
	    for(var i = 0; i < this.lines.length; i++) {
		var linePositions = [];
		var line = this.lines[i];
		for(var j = 0; j < line.length; j++) {
		    var p = transformPoint(line[j]);
		    linePositions.push(p.x, p.y, p.z);
		}
		meshCollector.blackLinePositions.push(linePositions);
	    }
	}
	else { // Add 'normal' lines:
	    for(var i = 0; i < this.lines.length; i++) {
		var linePositions = [];
		var line = this.lines[i];
		for(var j = 0; j < line.length; j++) {
		    var p = transformPoint(line[j]);
		    linePositions.push(p.x, p.y, p.z);
		}
		meshCollector.linePositions.push(linePositions);
	    }
	}

	// Add triangles:
	if(this.trianglePoints.length) {
	    var positions = meshCollector.getTrianglePointPositions(colorID);
	    if(!ownInvertion) {
		for(var i = 0; i < this.trianglePoints.length; i++) { // Simply add the points
		    var p = transformPoint(this.trianglePoints[i]);
		    
		    positions.push(p.x, p.y, p.z);
		}
	    }
	    else {
		for(var i = this.trianglePoints.length-1; i >= 0; i--) {
		    var p = transformPoint(this.trianglePoints[i]);
		    positions.push(p.x, p.y, p.z);
		}
	    }
	}

	function handleSubModel(subModelDesc) {
	    var subModelInversion = invertCCW != subModelDesc.invertCCW;
	    var subModelColor = (subModelDesc.colorID === 16 || subModelDesc.colorID === 24) ? colorID : subModelDesc.colorID;

	    var subModel = loader.ldrPartTypes[subModelDesc.ID];
	    if(subModel == undefined) {
		console.dir(loader.ldrPartTypes);
		throw "Unloaded sub model: " + subModelDesc.ID;
	    }
	    var nextPosition = transformPoint(subModelDesc.position);
	    var nextRotation = new THREE.Matrix3();
	    nextRotation.multiplyMatrices(rotation, subModelDesc.rotation);
	    subModel.generateThreePart(loader, subModelColor, nextPosition, nextRotation, subModelInversion, meshCollector);
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
    this.steps = [];
    this.lastRotation = null;

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

    this.generateThreePart = function(loader, c, p, r, inv, meshCollector) {
	for(var i = 0; i < this.steps.length; i++) {
	    this.steps[i].generateThreePart(loader, c, p, r, inv, meshCollector);
	}
    }
}

/*
THREE.LDRMeshCollector assumes ldrOptions being an LDR.Options object in global scope.
*/
THREE.LDRMeshCollector = function() {
    this.linePositions = []; // Public access to save space.
    this.blackLinePositions = []; // Public access to save space.
    this.t = []; // color ID -> triangles. Access through getTriangleList();
    this.tColors = [];
    this.isMeshCollector = true;
    this.lineMaterial = new THREE.LineBasicMaterial({color: ldrOptions.lineColor});
    this.blackLineMaterial = new THREE.LineBasicMaterial({color: ldrOptions.blackLineColor});
}

THREE.LDRMeshCollector.prototype.getTrianglePointPositions = function(colorID) {
    if(!this.t[colorID]) {
	this.t[colorID] = [];
	this.tColors.push(colorID);
    }
    return this.t[colorID];
}

THREE.LDRMeshCollector.prototype.removeThreeObject = function(obj, baseObject) {
    if(!obj)
	return;
    obj.geometry.dispose();
    //obj.material.dispose(); // Material is reused.
    baseObject.remove(obj);
}

THREE.LDRMeshCollector.prototype.updateLines = function(baseObject, black) {
    var lines = black ? this.blackLines : this.lines;
    // First determine if lines already exist and if they need to be updated:
    if(ldrOptions.showLines === 2) { // Don't show lines:
	if(!lines)
	    return;
	for(var i = 0; i < lines.length; i++) {
	    this.removeThreeObject(lines[i], baseObject);
	}
	if(black)
	    this.blackLines = null;
	else
	    this.lines = null;
	return;
    }
    // Show lines:
    if(!lines) {
	if(black)
	    lines = this.blackLines = [];
	else
	    lines = this.lines = [];

	// Create the lines:
	var p = black ? this.blackLinePositions : this.linePositions;
	for(var i = 0; i < p.length; i++) {
	    var lineGeometry = new THREE.BufferGeometry();
	    lineGeometry.addAttribute('position', new THREE.Float32BufferAttribute(p[i], 3));
	    var line = new THREE.Line(lineGeometry, black ? this.blackLineMaterial : this.lineMaterial);
	    lines.push(line);
	    baseObject.add(line);
	}
    }
    else {
	// Check line colors:
	if(black) {
	    var newLineColor = new THREE.Color(ldrOptions.blackLineColor);
	    if(!newLineColor.equals(this.blackLineMaterial.color)) {
		this.blackLineMaterial.color = newLineColor;
		this.blackLineMaterial.needsUpdate = true;
	    }
	}
	else {
	    var newLineColor = new THREE.Color(ldrOptions.lineColor);
	    if(!newLineColor.equals(this.lineMaterial.color)) {
		this.lineMaterial.color = newLineColor;
		this.lineMaterial.needsUpdate = true;
	    }
	}
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
    for(var i = 0; i < this.tColors.length; i++) {
	var colorID = this.tColors[i];

	if(old && ldrOptions.showOldColors === 1) {
	    var trans = false;
	    var triangleColor = ldrOptions.oldColor;
	}
	else {
	    var trans = ldraw_transparent.includes(colorID);
	    var triangleColor = ldraw_colors[colorID];
	    if(triangleColor == undefined) {
		console.warn("Unknown LDraw color '" + colorID + "', defaulting to black.");
		triangleColor = ldraw_colors[0];
	    }
	    if(old && ldrOptions.showOldColors === 2)
		triangleColor = LDR.Colors.desaturateColor(triangleColor);
	}
	var triangleMaterial = new THREE.MeshBasicMaterial( { 
	    color: triangleColor,
	    transparent: trans,
	    opacity: trans ? 0.5 : 1,
	} );

	var triangleGeometry = new THREE.BufferGeometry();
	triangleGeometry.addAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(this.t[colorID]), 3));
	triangleGeometry.computeBoundingBox();
	var mesh = new THREE.Mesh(triangleGeometry, triangleMaterial);
	this.triangleMeshes.push(mesh);
	baseObject.add(mesh);
    }
}

THREE.LDRMeshCollector.prototype.colorTrianglesOldSingleColor = function() {
    for(var i = 0; i < this.triangleMeshes.length; i++) {
	var mesh = this.triangleMeshes[i];
	mesh.material.color = new THREE.Color(ldrOptions.oldColor);
	mesh.material.transparent = false;
	mesh.material.opacity = 1;
	mesh.material.needsUpdate = true;
    }
}

THREE.LDRMeshCollector.prototype.colorTrianglesDulled = function(dulled) {
    for(var i = 0; i < this.tColors.length; i++) {
	var colorID = this.tColors[i];
	var trans = ldraw_transparent.includes(colorID);
	var triangleColor = ldraw_colors[colorID];
	if(triangleColor == undefined) {
	    triangleColor = ldraw_colors[0];
	}
	if(dulled)
	    triangleColor = LDR.Colors.desaturateColor(triangleColor);
	var mesh = this.triangleMeshes[i];
	mesh.material.color = new THREE.Color(triangleColor);
	mesh.material.transparent = trans;
	mesh.material.opacity = trans ? 0.5 : 1;
	mesh.material.needsUpdate = true;
    }
}
THREE.LDRMeshCollector.prototype.updateState = function(old) {
    this.old = old;
    this.oldColor = ldrOptions.oldColor;
    this.showOldColors = ldrOptions.showOldColors;
}
THREE.LDRMeshCollector.prototype.updateTriangles = function(old, baseObject) {
    if(!this.triangleMeshes) { // Create triangles:
	this.updateState(old);
	this.buildTriangles(old, baseObject);
	return;
    }

    if(old !== this.old) {
	// Change between new and old:
	if(old) { // Make triangles old:
	    if(ldrOptions.showOldColors === 1) { // Color in old color:
		this.colorTrianglesOldSingleColor();
	    }
	    else if(ldrOptions.showOldColors === 2) { // Dulled colors:
		this.colorTrianglesDulled(true);
	    }
	}
	else { // Make triangles new!
	    if(this.showOldColors !== 0) {
		this.colorTrianglesDulled(false);
	    }
	}
    }
    else if(old) { // Remain old:
	if(this.showOldColors !== ldrOptions.showOldColors) { // Change in old type:
	    if(ldrOptions.showOldColors === 1) { // Color in old color:
		this.colorTrianglesOldSingleColor();
	    }
	    else { // Dulled or normal:
		this.colorTrianglesDulled(ldrOptions.showOldColors === 2);
	    }
	}
	else if(this.oldColor !== ldrOptions.oldColor && ldrOptions.showOldColors === 1) {
	    this.colorTrianglesOldSingleColor();
	}
    }
    // else remain new: Do nothing.

    this.updateState(old);
}

THREE.LDRMeshCollector.prototype.draw = function(baseObject, old) {
    if(old == undefined)
	old = this.old; // In case of undefined.

    var created = !this.triangleMeshes;
    this.updateLines(baseObject, true);
    this.updateLines(baseObject, false);
    this.updateTriangles(old, baseObject);
    if(created) {
	this.computeBoundingBox();
    }
}

THREE.LDRMeshCollector.prototype.isVisible = function(v) {
    return this.triangleMeshes && this.triangleMeshes[0].visible;
}
THREE.LDRMeshCollector.prototype.setVisible = function(v) {
    if(this.lines) {
	for(var i = 0; i < this.lines.length; i++)
	    this.lines[i].visible = v;
    }
    if(this.blackLines) {
	for(var i = 0; i < this.blackLines.length; i++)
	    this.blackLines[i].visible = v;
    }
    for(var i = 0; i < this.triangleMeshes.length; i++) {
	this.triangleMeshes[i].visible = v;
    }
}

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
    id = id.toLowerCase(); // Sanitize id.

    if(this.ldrPartTypes[id]) { // Already loaded
	//console.log("Part already loaded or being loaded: " + id);
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
    //console.log("Reporting progress for unloaded files counter: " + this.unloadedFiles);
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
    function closeStep() {
	part.addStep(step);
	step = new THREE.LDRStep();

	for (var key in extraSteps) {
	    part.addStep(extraSteps[key]);
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
		    closeStep();
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
		closeStep();
	    }
	    else if(parts[1] === "ROTSTEP") {
		if(parts.length == 6) {
		    step.rotation = new THREE.LDRStepRotation(parts[2], parts[3], parts[4], parts[5]);
		}
		closeStep();
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
    var colorID = this.colorID == 16 ? pd.colorID : this.colorID;
    
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

THREE.LDRStep = function() {
    this.empty = true;
    this.ldrs = [];
    this.dats = [];
    this.lines = [];
    this.trianglePoints = [];

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

    this.generateThreePart = function(loader, colorID, position, rotation, invertCCW, threePart) {
	//console.log("Creating three part for " + this.ldrs.length + " sub models and " + this.dats.length + " DAT parts in color " + colorID + ", invertion: " + invertCCW);
	var ownInvertion = (rotation.determinant() < 0) != invertCCW; // Adjust for inversed matrix!

	// Materials:
	var lineColor = colorID == 0 ? 15 : 0;
	var lineMaterial = new THREE.LineBasicMaterial({ 
	    color: ldraw_colors[lineColor] 
	});
	var trans = ldraw_transparent.includes(colorID);
	var triangleMaterial = new THREE.MeshBasicMaterial( { 
	    color: ldraw_colors[colorID],
	    transparent: trans,
	    opacity: trans ? 0.5 : 1
	} );

	var transformPoint = function(p) {
	    var ret = new THREE.Vector3();
	    ret.copy(p);
	    ret.applyMatrix3(rotation);
	    ret.add(position);
	    return ret;
	}

	// Add lines:
	for(var i = 0; i < this.lines.length; i++) {
	    var line = this.lines[i];
	    //console.log(line);
	    
	    var lineGeometry = new THREE.BufferGeometry();

	    var positions = [];
	    for(var j = 0; j < line.length; j++) {
		var p = transformPoint(line[j]);
		positions.push(p.x, p.y, p.z);
	    }

	    lineGeometry.addAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	    threePart.add(new THREE.Line(lineGeometry, lineMaterial));
	}

	// Add triangles:
	if(this.trianglePoints.length) {
	    var positions = [];
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
	    var triangleGeometry = new THREE.BufferGeometry();
	    triangleGeometry.addAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3));
	    threePart.add(new THREE.Mesh(triangleGeometry, triangleMaterial));
	}

	function handleSubModel(subModelDesc) {
	    var subModelInversion = invertCCW != subModelDesc.invertCCW;
	    var subModelColor = subModelDesc.colorID;

	    if(subModelColor == 24) {
		subModelColor = lineColor;
	    }
	    else if(subModelColor == 16) {
		subModelColor = colorID;
	    }

	    var subModel = loader.ldrPartTypes[subModelDesc.ID];
	    if(subModel == undefined) {
		throw "Unloaded sub model: " + subModelDesc.ID;
	    }
	    var nextPosition = transformPoint(subModelDesc.position);
	    var nextRotation = new THREE.Matrix3();
	    nextRotation.multiplyMatrices(rotation, subModelDesc.rotation);
	    subModel.generateThreePart(loader, subModelColor, nextPosition, nextRotation, subModelInversion, threePart);
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

    this.addStep = function(step) {
	if(!step.empty)
	    this.steps.push(step);
    }

    this.setID = function(id) {
	this.ID = id.toLowerCase();
    }

    this.generateThreePart = function(loader, c, p, r, inv, threePart) {
	for(var i = 0; i < this.steps.length; i++) {
	    this.steps[i].generateThreePart(loader, c, p, r, inv, threePart);
	}
    }
}

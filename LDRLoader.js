'use strict';

/**
 * @author Lasse Deleuran / http://c-mt.dk
 * LDR Specification: http://www.ldraw.org/documentation/ldraw-org-file-format-standards.html
 */
THREE.LDRLoader = function(manager, onLoad, onProgress, onError) {
    this.manager = manager;
    this.ldrPartTypes = []; // url => part. id can be "parts/3001.dat", "model.mpd", etc.
    this.unloadedFiles = 0;
    this.onLoad = onLoad;
    this.onProgress = onProgress;
    this.onError = onError;
    this.loader = new THREE.FileLoader(manager);
}

/*
  Load a ldr/mpd/dat file.
  For BFC parameters, see: http://www.ldraw.org/article/415.html
  This function follows the procedure from there to handle BFC.
*/
THREE.LDRLoader.prototype.load = function(url) {
    if(this.ldrPartTypes[url]) { // Already loaded
	//console.log("Part already loaded or being loaded: " + url);
	this.reportProgress(url);
	return;
    }
    var self = this;
    self.ldrPartTypes[url] = true;

    var onFileLoaded = function(text) {
	//console.log("File loaded! URL=" + url);
	self.ldrPartTypes[url] = self.parse(text);
	self.unloadedFiles--; // Warning - might have concurrency issue when two threads simultaneously update this!
	self.reportProgress(url);
    }
    this.unloadedFiles++;
    this.loader.load(url, onFileLoaded, self.onProgress, self.onError);
};

/*
  Invoke onProgress(url)
  Check if all subModels have loaded. If so, invoke onLoad()
*/
THREE.LDRLoader.prototype.reportProgress = function(url) {
    //console.log("Reporting progress for unloaded files counter: " + this.unloadedFiles);
    this.onProgress(url);
    if(this.unloadedFiles == 0) {
	this.onLoad();
    }
};

THREE.LDRLoader.prototype.idToUrl = function(id) {
    var url = "dat/" + id.toLowerCase();
    // TODO: Add subfolders!
    return url;
}

THREE.LDRLoader.prototype.parse = function(data) {
    // BFC Parameters:
    var CCW = true; // Assume CCW as default
    var invertNext = false; // Don't assume that first line needs inverted.

    // Start parsing:
    var part = new THREE.LDRPartType();

    // State information:
    var bufferLinePoints = null;

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
	    part.addLine(bufferLinePoints);
	    bufferLinePoints = null;
	}

	switch(lineType) {
	case 0: // TODO: Many commands from LDraw and various vendors.
	    // Set name:
	    if(parts.length == 3 && "Name:" === parts[1]) {
		//console.log("Setting ID of part being loaded: " + parts[2]);
		part.setID(parts[2]);
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
	    else {
		invertNext = false;
	    }
	    
	    // TODO: STEP (And auto-step at the end of a model)
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
	    var subModelUrl = this.idToUrl(parts[14]);
	    //console.log("Sub model found: " + subModelUrl + ", invert: " + invertNext);
	    var subModel = new THREE.LDRPartDescription(parseInt(parts[1]), 
							position, 
							rotation, 
							parts[14], 
						        invertNext);
	    part.addSubModel(subModel);
	    this.load(subModelUrl); // Start loading the submodel immediately!
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
		    part.addLine(bufferLinePoints);
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
		part.addTrianglePoint(p3);
		part.addTrianglePoint(p2);
		part.addTrianglePoint(p1);
	    }
	    else {
		part.addTrianglePoint(p1);
		part.addTrianglePoint(p2);
		part.addTrianglePoint(p3);
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
		part.addTrianglePoint(p4);
		part.addTrianglePoint(p2);
		part.addTrianglePoint(p1);

		part.addTrianglePoint(p4);
		part.addTrianglePoint(p3);
		part.addTrianglePoint(p2);
	    }
	    else {
		part.addTrianglePoint(p1);
		part.addTrianglePoint(p2);
		part.addTrianglePoint(p4);

		part.addTrianglePoint(p2);
		part.addTrianglePoint(p3);
		part.addTrianglePoint(p4);
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
	part.addLine(bufferLinePoints);
	bufferLinePoints = null;
    }

    return part;
};

THREE.LDRPartDescription = function(colorID, position, rotation, ID, invertCCW) {
    this.colorID = colorID; // LDraw ID
    this.position = position; // Vector3
    this.rotation = rotation; // Matrix3
    this.ID = ID; // part.dat lowercase
    this.invertCCW = invertCCW;
}

THREE.LDRPartType = function() {
    this.ID = null;
    this.subModels = [];
    this.lines = [];
    this.trianglePoints = [];
    this.optionalLines = [];

    this.addLine = function(line) {
	this.lines.push(line);
    }

    this.addTrianglePoint = function(p) {
	this.trianglePoints.push(p);
    }

    this.setID = function(id) {
	this.ID = id.toLowerCase();
    }
    
    this.addSubModel = function(subModel) {
	this.subModels.push(subModel);
    }

    this.generateThreePart = function(loader, colorID, position, rotation, invertCCW, threePart) {
	//console.log("Generating three part for " + this.ID + " in color " + colorID + ", invertion: " + invertCCW);
	var ownInvertion = (rotation.determinant() < 0) != invertCCW; // Adjust for inversed matrix!

	var ret = threePart || new THREE.Group();

	// Materials:
	var lineColor = colorID == 0 ? 15 : 0;
	var lineMaterial = new THREE.LineBasicMaterial({ 
	    color: ldraw_colors[lineColor] 
	});
	var triangleMaterial = new THREE.MeshBasicMaterial( { color: ldraw_colors[colorID] } );

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
	    ret.add(new THREE.Line(lineGeometry, lineMaterial));
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
	    ret.add(new THREE.Mesh(triangleGeometry, triangleMaterial));
	}

	// Add submodels:
	for(var i = 0; i < this.subModels.length; i++) {
	    var subModelDesc = this.subModels[i];
	    var subModelUrl = loader.idToUrl(subModelDesc.ID);
	    var subModelInversion = invertCCW != subModelDesc.invertCCW;
	    var subModelColor = subModelDesc.colorID;

	    if(subModelColor == 24) {
		subModelColor = lineColor;
	    }
	    else if(subModelColor == 16) {
		subModelColor = colorID;
	    }

	    var subModel = loader.ldrPartTypes[subModelUrl];
	    if(!subModel || (subModel === true)) {
		console.log("Sub model not yet loaded. Skipping: " + subModelDesc.ID);
		continue;
	    }

	    var nextPosition = transformPoint(subModelDesc.position);
	    var nextRotation = new THREE.Matrix3();
	    nextRotation.multiplyMatrices(rotation, subModelDesc.rotation);
	    subModel.generateThreePart(loader, subModelColor, nextPosition, nextRotation, subModelInversion, ret);
	}

	// TODO: optional lines

	return ret;
    }
}

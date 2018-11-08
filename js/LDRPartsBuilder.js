'use strict';

/*
The LDRPartsBulder is used for displaying parts for LEGO models.
*/
var LDR = LDR || {};

LDR.PartsBulder = function(ldrLoader, mainModelID, mainModelColor) {
    this.ldrLoader = ldrLoader;
    this.mainModelID = mainModelID;
    this.mainModelColor = mainModelColor;

    this.pcs = {}; // partID_colorID -> PartAndColor objects
    this.pcKeys = [];
    
    var pcs = this.pcs;
    var pcKeys = this.pcKeys;

    function build(multiplier, partID, colorID) {
	if(colorID == 16)
	    throw "Building with default color not allowed! Part ID: " + partID;
	var model = ldrLoader.ldrPartTypes[partID];
	if(!model) {
	    console.dir(ldrLoader);
	    throw "model not loaded: " + partID;
	}
	for(var i = 0; i < model.steps.length; i++) {
	    var step = model.steps[i];
	    if(step.ldrs.length > 0) {
		var ldr = step.ldrs[0];
		if(ldr.ID === partID)
		    throw "Error: recursive model: " + partID + " in step " + i;
		build(multiplier*step.ldrs.length, ldr.ID, ldr.colorID == 16 ? colorID : ldr.colorID);
	    }
	    else if(step.dats.length > 0) {	
		for(var j = 0; j < step.dats.length; j++) {
		    var dat = step.dats[j];
		    var datColorID = dat.colorID == 16 ? colorID : dat.colorID;
		    var key = dat.ID + '_' + datColorID;
		    var pc = pcs[key];
		    if(!pc) {
			pc = new LDR.PartAndColor(dat.ID, datColorID, ldrLoader);
			pcs[key] = pc;
			pcKeys.push(key);
		    }
		    // Add count:
		    pc.amount += multiplier;
		}
	    }
	}
    }
    build(1, mainModelID, mainModelColor);
}

LDR.PartsBulder.prototype.updateMeshCollectors = function(baseObject) {
    for(var i = 0; i < this.pcKeys.length; i++) {
	var pcInfo = builder.pcs[builder.pcKeys[i]];
	pcInfo.draw(baseObject, false);
    }
}

LDR.PartAndColor = function(partID, colorID, ldrLoader) {
    this.partID = partID;
    this.colorID = colorID;
    this.key = partID + '_' + colorID;
    this.meshCollector;
    this.amount = 0;
    this.mesh; // Optional use.
    this.ldrLoader = ldrLoader;

    this.partType = ldrLoader.ldrPartTypes[partID];
    if(!this.partType) {
	console.dir(ldrLoader);
	throw "Unknown part type: " + partID;
    }
    // Use replacement part:
    if(this.partType.replacement) {
	//console.log("Replacing: " + partID + " -> " + this.partType.replacement);
	this.partType = ldrLoader.ldrPartTypes[this.partType.replacement];
    }
    // Rotate for pli:
    var pliID = "pli_" + this.partID.slice(0, -4);
    if(LDR.PLI && LDR.PLI[pliID]) {
	var pliInfo = LDR.PLI[pliID];
	var pliName = "pli_" + this.partID;
	if(!ldrLoader.ldrPartTypes[pliName]) {
	    var r = new THREE.Matrix3();
	    r.set(pliInfo[4], pliInfo[5], pliInfo[6],
		  pliInfo[7], pliInfo[8], pliInfo[9],
		  pliInfo[10], pliInfo[11], pliInfo[12]);
	    var dat = new THREE.LDRPartDescription(colorID, 
						   new THREE.Vector3(),
						   r,
						   this.partID,
						   false,
						   false);
	    var step = new THREE.LDRStep();
	    step.addDAT(dat);
	    var pt = new THREE.LDRPartType();
	    pt.ID = pliName;
	    pt.modelDescription = this.partType.modelDescription;
	    pt.author = this.partType.author;
	    pt.license = this.partType.license;
	    pt.steps.push(step);
	    ldrLoader.ldrPartTypes[pliName] = pt;
	    this.partType = pt;
	    console.log("Replaced PLI for " + pliName);
	}
    }
    this.partDesc = this.partType.modelDescription;
}

LDR.PartAndColor.prototype.ensureMeshCollector = function() {
    if(!this.meshCollector) {
	this.meshCollector = new THREE.LDRMeshCollector();

	// Build meshCollector (lines and triangles for part in color):
	var p = new THREE.Vector3();
	var r = new THREE.Matrix3(); 
	r.set(1,0,0, 0,-1,0, 0,0,-1);

	this.partType.generateThreePart(this.ldrLoader, this.colorID, p, r, true, false, this.meshCollector, false);
	this.partType = undefined; // No use for it anymore.
	this.ldrLoader = undefined;
    }
}

LDR.PartAndColor.prototype.getBounds = function() {
    this.ensureMeshCollector();
    if(!this.meshCollector.boundingBox) {
	throw "No bounding box for " + this.partID + " / " + this.partDesc;
    }
    return this.meshCollector.boundingBox;
}
LDR.PartAndColor.prototype.draw = function(baseObject) {
    this.ensureMeshCollector();
    this.meshCollector.draw(baseObject, false);
}
LDR.PartAndColor.prototype.setVisible = function(v, baseObject) {
    this.ensureMeshCollector();
    this.meshCollector.setVisible(v);
}

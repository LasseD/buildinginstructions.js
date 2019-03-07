'use strict';

/*
The LDRPartsBulder is used for displaying parts for LEGO models.
*/
var LDR = LDR || {};

LDR.PartsBulder = function(loader, mainModelID, mainModelColor, onBuiltPart) {
    this.loader = loader;
    this.mainModelID = mainModelID;
    this.mainModelColor = mainModelColor;

    this.pcs = {}; // partID_colorID -> PartAndColor objects
    this.pcKeys = [];
    
    const pcs = this.pcs;
    const pcKeys = this.pcKeys;

    // TODO: Use WebWorkers and finally call onBuiltPart for each built part.
    function build(multiplier, partID, colorID) {
	if(colorID == 16)
	    throw "Building with default color not allowed! Part ID: " + partID;
	var model = loader.partTypes[partID];
	if(!model) {
	    console.dir(loader);
	    throw "model not loaded: " + partID;
	}

        function handleStep(step) {
            if(step.containsNonPartSubModels(loader)) {
		var ldr = step.subModels[0];
		build(multiplier*step.subModels.length, ldr.ID, ldr.colorID == 16 ? colorID : ldr.colorID);
                return;
	    }
            for(var j = 0; j < step.subModels.length; j++) {
                var dat = step.subModels[j];
                var datColorID = dat.colorID == 16 ? colorID : dat.colorID;
                var key = dat.ID.endsWith('.dat') ? dat.ID.substring(0, dat.ID.length-4) : dat.ID;
                key += '_' + datColorID;
                var pc = pcs[key];
                if(!pc) {
                    pc = new LDR.PartAndColor(key, dat.ID, datColorID, loader);
                    pcs[key] = pc;
                    pcKeys.push(key);
                }
                // Add count:
                pc.amount += multiplier;
	    }
        }
        model.steps.forEach(handleStep);
    }
    build(1, mainModelID, mainModelColor);

    function sorter(a, b) {
	a = pcs[a];
	b = pcs[b];
	if(a.colorID != b.colorID)
	    return a.colorID - b.colorID;
	return a.partID < b.partID ? -1 : (b.partID < a.partID ? 1 : 0);
    }
    pcKeys.sort(sorter);
}

LDR.PartsBulder.prototype.updateMeshCollectors = function(baseObject) {
    for(var i = 0; i < this.pcKeys.length; i++) {
	var pcInfo = builder.pcs[builder.pcKeys[i]];
	pcInfo.draw(baseObject);
    }
}

LDR.PartAndColor = function(key, partID, colorID, loader) {
    this.key = key;
    this.partID = partID;
    this.colorID = colorID;
    this.loader = loader;

    this.meshCollector;
    this.amount = 0;
    this.mesh; // Optional use.
    this.annotation;

    this.partType = loader.partTypes[partID];
    if(!this.partType) {
	console.dir(loader);
	throw "Unknown part type: " + partID;
    }
    this.inlined = this.partType.inlined;

    // Use replacement part:
    if(this.partType.replacement) {
	//console.log("Replacing: " + partID + " -> " + this.partType.replacement);
	this.partType = loader.partTypes[this.partType.replacement];
    }
    // Rotate for pli:
    var pliID = "pli_" + this.partType.ID.slice(0, -4);
    if(LDR.PLI && LDR.PLI[pliID]) {
	var pliInfo = LDR.PLI[pliID];
	var pliName = "pli_" + this.partID;
	if(!loader.partTypes[pliName]) {
	    var r = new THREE.Matrix3();
	    r.set(pliInfo[0], pliInfo[1], pliInfo[2],
		  pliInfo[3], pliInfo[4], pliInfo[5],
		  pliInfo[6], pliInfo[7], pliInfo[8]);
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
	    loader.partTypes[pliName] = pt;
	    this.partType = pt;
	    //console.log("Replaced PLI for " + pliName);
	}
    }
    // Annotate:
    if(LDR.Annotations && LDR.Annotations[pliID]) {
	this.annotation = LDR.Annotations[pliID];
    }
    
    this.partDesc = this.partType.modelDescription;
}

LDR.PartAndColor.prototype.ensureMeshCollector = function(baseObject) {
    if(!this.meshCollector) {
	this.meshCollector = new LDR.MeshCollector(baseObject, baseObject);

	// Build meshCollector (lines and triangles for part in color):
	var p = new THREE.Vector3();
	var r = new THREE.Matrix3(); 
	r.set(1,0,0, 0,-1,0, 0,0,-1);

	this.partType.generateThreePart(this.loader, this.colorID, p, r, true, false, this.meshCollector, false);
	this.partType = undefined; // No use for it anymore.
	this.loader = undefined;
    }
}

LDR.PartAndColor.prototype.getBounds = function() {
    if(!this.meshCollector)
	throw 'Mesh collector not built!';
    if(!this.meshCollector.boundingBox) {
	console.dir(this);
	throw "No bounding box for " + this.partID + " / " + this.partDesc;
    }
    return this.meshCollector.boundingBox;
}
LDR.PartAndColor.prototype.draw = function(baseObject) {
    this.ensureMeshCollector(baseObject);
    this.meshCollector.draw(false);
}
LDR.PartAndColor.prototype.setVisible = function(v, baseObject) {
    this.ensureMeshCollector(baseObject);
    this.meshCollector.setVisible(v);
}

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
    console.dir(ldrLoader);
    function build(multiplier, partID, colorID) {
	var model = ldrLoader.ldrPartTypes[partID];
	for(var i = 0; i < model.steps.length; i++) {
	    var step = model.steps[i];
	    if(step.ldrs.length > 0) {
		var ldr = step.ldrs[0];
		build(multiplier*step.ldrs.length, ldr.ID, colorID == 16 ? ldr.colorID : colorID);
	    }
	    else if(step.dats.length > 0) {		
		for(var j = 0; j < step.dats.length; j++) {
		    var dat = step.dats[j];
		    var datColorID = (colorID === 16) ? colorID : dat.colorID;
		    var key = dat.ID + '_' + datColorID;
		    var pc = pcs[key];
		    if(!pc) {
			pc = new LDR.PartAndColor(dat.ID, datColorID, ldrLoader)
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

LDR.PartAndColor = function(partID, colorID, ldrLoader) {
    this.partID = partID;
    this.colorID = colorID;
    this.key = partID + '_' + colorID;
    this.meshCollector = new THREE.LDRMeshCollector();
    this.amount = 0;
    var partType = ldrLoader.ldrPartTypes[partID];
    if(partType.replacement) { // Use replacement part
	partType= ldrLoader.ldrPartTypes[partType.replacement];
    }
    this.partDesc = partType.modelDescription;

    // Build meshCollector (lines and triangles for part in color):
    var p = new THREE.Vector3();
    var r = new THREE.Matrix3(); 
    r.set(1,0,0, 0,-1,0, 0,0,-1);

    partType.generateThreePart(ldrLoader, colorID, p, r, false, this.meshCollector);

    //this.author = author;
}

LDR.PartAndColor.prototype.getBounds = function() {
    return this.meshCollector.boundingBox;
}

LDR.PartAndColor.prototype.draw = function(scene) {
    this.meshCollector.draw(scene, false);
}
LDR.PartAndColor.prototype.setVisible = function(v) {
    this.meshCollector.setVisible(v);
}

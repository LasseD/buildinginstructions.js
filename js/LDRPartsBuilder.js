'use strict';

/*
  The LDRPartsBuilder is used for displaying parts list image icons for LEGO models.
*/
var LDR = LDR || {};

LDR.PartsBuilder = function(loader, mainModelID, mainModelColor, onBuiltPart) {
    this.loader = loader;
    this.mainModelID = mainModelID;
    this.mainModelColor = mainModelColor;

    this.pcs = {}; // partID_colorID -> PartAndColor objects
    this.pcKeys = []; // Used for lookup and sorting.
    
    const pcs = this.pcs;
    const pcKeys = this.pcKeys;

    function build(multiplier, partID, colorID) {
	if(colorID == 16) {
	    throw "Building with default color not allowed! Part ID: " + partID;
        }
	let model = loader.partTypes[partID];

        function handleStep(step) {
            if(step.containsNonPartSubModels(loader)) {
		let ldr = step.subModels[0];
		build(multiplier*step.subModels.length, ldr.ID, ldr.colorID == 16 ? colorID : ldr.colorID);
                return;
	    }
            for(let j = 0; j < step.subModels.length; j++) {
                let dat = step.subModels[j];
                let datColorID = dat.colorID == 16 ? colorID : dat.colorID;
                // Key consists of ID (without .dat) '_', and color ID
                let key = dat.ID.endsWith('.dat') ? dat.ID.substring(0, dat.ID.length-4) : dat.ID;
                key += '_' + datColorID;
                let pc = pcs[key];
                if(!pc) {
                    pc = new LDR.PartAndColor(key, dat, datColorID, loader);
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
	if(a.colorID != b.colorID) {
	    return a.colorID - b.colorID;
        }
	return a.partID < b.partID ? -1 : (b.partID < a.partID ? 1 : 0);
    }
    pcKeys.sort(sorter);
}

LDR.PartAndColor = function(key, part, colorID, loader) {
    this.key = key;
    this.part = part;
    this.colorID = colorID;
    this.loader = loader;

    this.amount = 0;

    this.partType = loader.partTypes[part.ID];
    if(!this.partType) {
	console.dir(loader);
	throw "Unknown part type: " + part.ID;
    }

    // Use replacement part:
    if(this.partType.replacement) {
        let pt;
        if(this.partType.replacementPartType) { // Only perform lookup the first time.
            pt = this.partType.replacementPartType;
        }
        else {
            //console.log("Replacing: " + part.ID + " -> " + this.partType.replacement);
            pt = loader.partTypes[this.partType.replacement];
            this.partType.replacementPartType = pt;
        }
	this.partType = pt;
    }

    // Rotate for pli:
    let pliID = "pli_" + this.partType.ID.slice(0, -4);
    if(this.partType.pli) {
        this.partType = this.partType.pli;
    }
    else if(LDR.PLI && LDR.PLI[pliID]) {
	let pliInfo = LDR.PLI[pliID];
	let pliName = "pli_" + this.part.ID;
	let pt;
	if(!loader.partTypes[pliName]) {
	    let r = new THREE.Matrix3();
	    r.set(pliInfo[0], pliInfo[1], pliInfo[2],
		  pliInfo[3], pliInfo[4], pliInfo[5],
		  pliInfo[6], pliInfo[7], pliInfo[8]);
	    let dat = new THREE.LDRPartDescription(16, 
						   new THREE.Vector3(),
						   r,
						   this.part.ID,
						   true,
						   false); // Potentially rotated PLI.
	    let step = new THREE.LDRStep();
	    step.addSubModel(dat);
	    pt = new THREE.LDRPartType();
	    pt.ID = pliName;
	    pt.modelDescription = this.partType.modelDescription;
	    pt.author = this.partType.author;
	    pt.license = this.partType.license;
	    pt.steps.push(step);
	    loader.partTypes[pliName] = pt;
	    //console.log("Replaced PLI for " + pliName);
	}
	else {
	    pt = loader.partTypes[pliName];
	}
        this.partType.pli = pt;
	this.partType = pt;
    }

    // Annotate:
    if(!this.partType.annotation && LDR.Annotations && LDR.Annotations[pliID]) {
	this.partType.annotation = LDR.Annotations[pliID];
    }
    
    this.partDesc = this.partType.modelDescription;
}

LDR.PartAndColor.prototype.ensureMeshCollector = function(baseObject) {
    if(!this.partType.pliMC) {
	let mc = this.partType.pliMC = new LDR.MeshCollector(baseObject, baseObject);
        //mc.mesh = baseObject; // TODO: Center the position of baseObject here, rather than in PLIBBuilder.getPC

	// Build meshCollector (lines and triangles for part in color):
	let p = new THREE.Vector3();
	let r = new THREE.Matrix3();
	r.set(1,0,0, 0,-1,0, 0,0,-1);

	this.partType.generateThreePart(this.loader, this.colorID, p, r, true, false, mc);
    }
}

LDR.PartAndColor.prototype.getBounds = function() {
    if(!this.partType.pliMC)
	throw 'Mesh collector not built!';
    if(!this.partType.pliMC.boundingBox) {
	console.dir(this);
	throw "No bounding box for " + this.part.ID + " / " + this.partDesc;
    }
    return this.partType.pliMC.boundingBox;
}

LDR.PartAndColor.prototype.colorAndDraw = function(colorID) {
    this.partType.pliMC.overwriteColor(colorID);
    this.partType.pliMC.draw(false);
}

LDR.PartAndColor.prototype.setVisible = function(v, baseObject) {
    this.ensureMeshCollector(baseObject);
    this.partType.pliMC.setVisible(v);
}

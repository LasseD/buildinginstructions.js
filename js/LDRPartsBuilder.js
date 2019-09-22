'use strict';

/*
  The LDRPartsBuilder is used for displaying parts list image icons for LEGO models.
*/
LDR.PartsBuilder = function(loader, mainModelID, mainModelColor, onBuiltPart) {
    this.loader = loader;
    this.mainModelID = mainModelID;
    this.mainModelColor = mainModelColor;

    this.pcs = {}; // partID_colorID -> PartAndColor objects
    this.pcKeys = []; // Used for lookup and sorting.    
    const pcs = this.pcs;
    const pcKeys = this.pcKeys;

    // First fix all replacements:
    loader.substituteReplacementParts();

    function build(multiplier, partID, colorID) {
	//console.log('Building ' + multiplier + " x '" + partID + "' in color " + colorID);
	if(colorID == 16) {
	    throw "Building with default color not allowed! Part ID: " + partID;
        }
	let model = loader.getPartType(partID);

        function handleStep(step, idx) {
            if(step.containsNonPartSubModels(loader)) {
		let ldr = step.subModels[0];
		build(multiplier*step.subModels.length, ldr.ID, ldr.colorID == 16 ? colorID : ldr.colorID);
                return;
	    }

            step.subModels.forEach(dat => {
                let datColorID = dat.colorID == 16 ? colorID : dat.colorID;
                // Key consists of ID (without .dat) '_', and color ID
		if(dat.REPLACEMENT_PLI === true) {
		    return; // Replaced part.
		}
		let id = dat.REPLACEMENT_PLI ? dat.REPLACEMENT_PLI : dat.ID;
                let key = id.endsWith('.dat') ? id.substring(0, id.length-4) : id;
                key += '_' + datColorID;
                let pc = pcs[key];
                if(!pc) {
		    pc = new LDR.PartAndColor(key, dat, datColorID, loader);
		    pcs[key] = pc;
		    pcKeys.push(key);
                }
                // Add count:
                pc.amount += multiplier;
	    });
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
    this.ID = part.REPLACEMENT_PLI ? part.REPLACEMENT_PLI : part.ID;
    this.colorID = colorID;
    this.loader = loader;

    this.amount = 0;

    this.partType = loader.getPartType(this.ID);
    if(!this.partType) {
	console.warn("Unknown part type: " + this.ID + ". Showing box instead.");
	this.partType = LDR.Generator.makeEmpty(this.ID);
    }

    // Rotate for pli:
    let pliID = this.partType.ID.slice(0, -4);
    if(this.partType.pli) {
        this.partType = this.partType.pli;
    }
    else if(LDR.PLI && LDR.PLI.hasOwnProperty(pliID)) {
	let pliInfo = LDR.PLI[pliID];
	let pliName = "pli_" + this.ID;
	let pt;
	if(!loader.partTypes.hasOwnProperty(pliName)) {
	    let r = new THREE.Matrix3();
	    r.set(pliInfo[0], pliInfo[1], pliInfo[2],
		  pliInfo[3], pliInfo[4], pliInfo[5],
		  pliInfo[6], pliInfo[7], pliInfo[8]);
	    let dat = new THREE.LDRPartDescription(16, new THREE.Vector3(),
						   r, this.ID,
						   true, false); // Potentially rotated PLI.
	    let step = new THREE.LDRStep();
	    step.addSubModel(dat);
	    pt = new THREE.LDRPartType();
	    pt.ID = pliName;
	    pt.modelDescription = this.partType.modelDescription;
	    pt.author = this.partType.author;
	    pt.license = this.partType.license;
	    pt.inlined = this.partType.inlined;
	    pt.ldraw_org = this.partType.ldraw_org;
	    pt.steps.push(step);
	    loader.partTypes[pliName] = pt;
	    //console.log("Replaced PLI for " + pliName);
	}
	else {
	    pt = loader.getPartType(pliName);
	}
        this.partType.pli = pt;
	this.partType = pt;
    }

    // Annotate:
    if(!this.partType.annotation && LDR.Annotations && LDR.Annotations.hasOwnProperty(pliID)) {
	this.partType.annotation = LDR.Annotations[pliID];
    }
    
    this.partDesc = this.partType.modelDescription;
}

LDR.PartAndColor.prototype.ensureMeshCollector = function(baseObject) {
    if(!this.partType.pliMC) {
	let mc = this.partType.pliMC = new LDR.MeshCollector(baseObject, baseObject);
	let p = new THREE.Vector3();
	let r = new THREE.Matrix3();
	r.set(1,0,0, 0,-1,0, 0,0,-1);
	this.partType.generateThreePart(this.loader, 40, p, r, true, false, mc); // 40 to ensure transparent parts work correctly in parts list.
    }
}

LDR.PartAndColor.prototype.getBounds = function() {
    if(!this.partType.pliMC) {
	throw 'Mesh collector not built!';
    }
    if(!this.partType.pliMC.boundingBox) {
	console.dir(this);
	throw "No bounding box for " + this.ID + " / " + this.partDesc;
    }
    return this.partType.pliMC.boundingBox;
}

LDR.PartAndColor.prototype.setVisible = function(v, baseObject) {
    this.ensureMeshCollector(baseObject);
    this.partType.pliMC.setVisible(v);
}

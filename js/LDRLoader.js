'use strict';

/**
 * @author Lasse Deleuran | c-mt.dk and brickhub.org
 * LDR Specification: http://www.ldraw.org/documentation/ldraw-org-file-format-standards.html
 *
 * Special note about colors. 
 * LDraw ID's are used for identifying colors efficiently. However. An LDraw color has both an ordinary value and an 'edge' value which can be used for rendering. In order to simplify the data model for storing geometries by colors, geometries colored in edge colors have negative color values with '1' subtracted. An 'edge' color is thus identified by the ID being negative and the LDraw ID can be obtained by negating and subtracting 1.
 * This choice is internal to the loader and transparent to code that uses LDRLoader.
 *
 * onLoad is called on completion of loading of all necessary LDraw files.
 * storage should be an instance of LDR.STORAGE, or null. Unloaded files will be attempted to be read from storage before new file requests are attempted.
 * The optional options object has the following optional parameters:
 * - manager: Three.js loading manager. The default loading manager is used if none is present.
 * - onWarning(warningObj) is called when non-breaking errors are encountered, such as unknown colors and unsupported META commands.
 * - onProgress is called when a sub model has been loaded and will also be used by the manager.
 * - onError(errorObj) is called on breaking errors. errorObj has the following properties:
 *  - message: Human-readable error message.
 *  - line: Line number in the loaded file where the error occured.
 *  - subModel: THREE.LDRPartType in which the error occured.
 * - saveFileLines: Set to 'true' if LDR.Line0, LDR.Line1, ... LDR.Line5-objects should be saved on part types.
 * - physicalRenderingAge: Set to 0 for standard cell shaded rendering. Otherwise, this number indicates the age of physical materials to be rendered (older materials will appear yellowed for some colors)
 * - idToUrl(id) is used to translate an id into all potential file locations. Set this function to fit your own directory structure if needed. A normal LDraw directory has files both under /parts and /p and requires you to search for dat files. You can choose to combine the directories to reduce the need for searching, but this is not considered good practice.
 */
THREE.LDRLoader = function(onLoad, storage, options) {
    let self = this;

    this.partTypes = {}; // id => part. id is typically something like "parts/3001.dat", and "model.mpd".
    this.unloadedFiles = 0;

    this.onLoad = function() {
        let unloaded = [];
        for(let id in self.partTypes) {
            if(self.partTypes.hasOwnProperty(id)) {
                let partType = self.partTypes[id];
                if(partType === true) {
                    console.warn('Unloaded sub model during cleanup: ' + id);
                    unloaded.push(id);
                    continue;
                }
                partType.cleanUp(self);
            }
        }
        unloaded.forEach(id => delete self.partTypes[id]);
        onLoad();
    };
    this.storage = storage || {retrievePartsFromStorage: (loader, toBeFetched, onDone) => onDone(toBeFetched)}; // If there is no storage, simply act as if the storage is not able to fetch anything.

    this.options = options || {};
    this.onProgress = this.options.onProgress || function(){};
    this.onWarning = this.options.onWarning || function(msg){ console.warn(msg); };
    this.onError = this.options.onError || function(msgObj){ console.dir(msgObj); };
    this.loader = new THREE.FileLoader(this.options.manager || THREE.DefaultLoadingManager);
    this.saveFileLines = this.options.saveFileLines || false;
    this.physicalRenderingAge = this.options.physicalRenderingAge || 0;
    this.mainModel;

    this.idToUrl = this.options.idToUrl || function(id) {
	if(!id.endsWith(".dat")){
	    return [id];
	}
        let lowerID = id.toLowerCase();
	return ["ldraw_parts/"+lowerID, "ldraw_unofficial/"+lowerID];
    };
}

/*
 * Load an ldr/mpd/dat file without checking storage first.
 * 
 * id is the file name to load. 
 * id is transformed using 'idToUrl' which can be parsed to the loader using the options parameter in the constructor.
 */
THREE.LDRLoader.prototype.load = function(id) {
    let urls = this.idToUrl(id);
    id = id.toLowerCase().replace('\\', '/'); // Sanitize id. 

    if(this.partTypes[id]) { // Already loaded
        if(this.partTypes[id] !== true) {
            this.reportProgress(id);
        }
	return;
    }
    //console.log('Loading ' + id + ' (' + urls.join(' or ') + ')');

    this.partTypes[id] = true; // Temporary value to prevent concurrent fetching over network.

    let self = this;
    let onFileLoaded = function(text) {
	self.parse(text);
	self.unloadedFiles--; // Warning - might have concurrency issue when two threads simultaneously update this!
	self.reportProgress(id);
    }
    var urlID = 0;
    let onError = function(event) {
        urlID++;
        if(urlID < urls.length) {
            self.loader.load(urls[urlID], onFileLoaded, self.onProgress, onError);
        }
        else {
            self.onError(event);
        }
    }

    this.unloadedFiles++;
    this.loader.load(urls[urlID], onFileLoaded, self.onProgress, onError);
};

/*
 * Attempt to load multiple files (identified by 'ids', an array od ID's of the files).
 * This method will try to fetch the files from 'storage' prior to loading using 'loader'.
 */
THREE.LDRLoader.prototype.loadMultiple = function(ids) {
    let self = this;
    function onStorageFetchingDone(unloadedParts) {
        self.unloadedFiles--;
        unloadedParts.forEach(id => self.load(id));
        self.reportProgress(ids[0]);
    }
    this.unloadedFiles++; // Prevent early exit.

    this.storage.retrievePartsFromStorage(this, ids, onStorageFetchingDone);
}

/*
 * This function is called when a (sub)file has been loaded. 
 * Also. It will be called every time an unloaded subfile is encountered. 
 * It can not be used to ensure completion of a loded (sub)file!
 * This function always invokes onProgress(id)
 * Also. It checks if all subModels have loaded. If so, it invokes onLoad().
 *
 * id is the id/name of the (sub)file.
 */
THREE.LDRLoader.prototype.reportProgress = function(id) {
    this.onProgress(id);
    if(this.unloadedFiles === 0) {
	this.onLoad();
    }
};

/*
 * Primary parser for LDraw files.
 * 
 * data is the plain text file content.
 */
THREE.LDRLoader.prototype.parse = function(data) {
    let parseStartTime = new Date();

    // BFC Parameters:
    let CCW = true; // Assume CCW as default
    let localCull = false; // Do not cull by default - wait for BFC CERTIFY
    let invertNext = false; // Don't assume that first line needs inverted.

    // Start parsing:
    let part = new THREE.LDRPartType();
    let step = new THREE.LDRStep();
    let loadedParts = [];
    function closeStep(keepRotation) {
	part.addStep(step);
	let rot = step.rotation;
	step = new THREE.LDRStep();
	if(keepRotation && rot !== null) {
	    step.rotation = rot.clone();
        }
    }

    // State information:
    let previousComment;
    let inHeader = true;

    let dataLines = data.split(/(\r\n)|\n/);
    for(let i = 0; i < dataLines.length; i++) {
	let line = dataLines[i];
	if(!line) {
	    continue; // Empty line, or 'undefined' due to '\r\n' split.
	}

	let parts = line.split(" ").filter(x => x !== ''); // Remove empty strings.
	if(parts.length <= 1) {
	    continue; // Empty/ empty comment line
        }
	let lineType = parseInt(parts[0]);
        let colorID;
	if(lineType !== 0) {
	    colorID = parts[1];
	    if(colorID.length === 9 && colorID.substring(0, 3) === '0x2') {
		// Direct color: https://www.ldraw.org/article/218.html
		let hexValue = parseInt(colorID.substring(3), 16);
		LDR.Colors[hexValue] = {name:'Direct color 0x2'+colorID, value:hexValue, edge:hexValue, direct:colorID};
		colorID = hexValue;
	    } 
	    else if(LDR.Colors[colorID] === undefined) {
		// This color might be on the form "0x2995220", such as seen in 3626bps5.dat:
		
		this.onWarning({message:'Unknown color "' + colorID + '". Black (0) will be shown instead.', line:i, subModel:part});
		colorID = 0;
	    }
	    else {
		colorID = parseInt(colorID);
	    }
	}
	//console.log("Parsing line " + i + " of type " + lineType + ', color ' + colorID + ": " + line); // Useful if you encounter parse errors.

	let l3 = parts.length >= 3;
	function is(type) {
	    return l3 && type === parts[1];
	}

	var self = this;
        var saveThisHeaderLine = true;
	function setModelDescription() {
	    if(part.modelDescription || !previousComment) {
		return; // Already set or not present.
            }
	    part.modelDescription = previousComment;
            saveThisHeaderLine = false; // Because we are saving it as modelDescription.
	    if(previousComment.startsWith("~Unknown part ")) {
		self.onError({message:'Unknown part "' + part.ID + '" will be shown as a cube.', line:i, subModel:part});
	    }
	    previousComment = undefined;
            return true; // Description set.
	}

	function handlePotentialFileStart(originalFileName) {
	    // Normalize the name by bringing to lower case and replacing backslashes:
	    let fileName = originalFileName.toLowerCase().replace('\\', '/');
	    localCull = false; // BFC Statements come after the FILE or Name: - directives.

	    if(part.ID === fileName) { // Consistent 'FILE' and 'Name:' lines.
		setModelDescription();
		part.consistentFileAndName = true;
	    }
	    else if(!self.mainModel) { // First model
		self.mainModel = part.ID = fileName;
	    }
	    else if(part.steps.length === 0 && step.isEmpty() && self.mainModel === part.ID) {
		console.warn("Special case: Main model ID change from " + part.ID + " to " + fileName);
		self.mainModel = part.ID = fileName;
	    }
	    else { // Close model and start new:
		if(part.steps.length === 0 && step.isEmpty() && part.ID && !part.consistentFileAndName) {
		    console.warn("Special case: Empty '" + part.ID + "' does not match '" + fileName + "' - Create new shallow part!");		
		    // Create pseudo-model with just one of 'fileName' inside:
		    let rotation = new THREE.Matrix3();
		    rotation.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
		    let shallowSubModel = new THREE.LDRPartDescription(16, 
								       new THREE.Vector3(),
								       rotation, 
								       fileName,
								       true,
								       false);
		    step.addSubModel(shallowSubModel);
		}
		closeStep(false);
		if(part.ID) {
		    self.partTypes[part.ID] = part;
		    self.onProgress(part.ID);
                    loadedParts.push(part);
		}
		part = new THREE.LDRPartType();
                inHeader = true;
		part.ID = fileName;
	    }
            part.name = originalFileName;
	}

        let p1, p2, p3, p4; // Used in switch.
	switch(lineType) {
	case 0:
	    if(is("FILE") || is("file") || is("Name:")) {
		// LDR FILE or 'Name:' line found. Set name and update data in case this is a new ldr file (do not use file suffix to determine).
		handlePotentialFileStart(parts.slice(2).join(" "));
                saveThisHeaderLine = false;
	    }
	    else if(is("Author:")) {
		part.author = parts.slice(2).join(" ");
		setModelDescription();
                saveThisHeaderLine = false;
	    }
	    else if(is("!LICENSE")) {
		part.license = parts.slice(2).join(" ");
                saveThisHeaderLine = false;
	    }
	    else if(is("!LDRAW_ORG")) {
		part.ldraw_org = parts[2];
                saveThisHeaderLine = false;
	    }
	    else if(is("!CMDLINE")) {
		part.preferredColor = parseInt(parts[2].substring(2));
                saveThisHeaderLine = false;
	    }
	    else if(parts[1] === "BFC") {
		// BFC documentation: http://www.ldraw.org/article/415
		let option = parts[2];
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
		if(parts[parts.length-1] === "CCW") {
                    part.CCW = CCW = true;
		}
		else if(parts[parts.length-1] === "CW") {
                    part.CCW = CCW = false;
		}
	    }
	    else if(parts[1] === "STEP") {
		closeStep(true);
	    }
	    else if(parts[1] === "ROTSTEP") {
		if(parts.length >= 5) {
		    step.rotation = new THREE.LDRStepRotation(parts[2], parts[3], parts[4], (parts.length === 5 ? "REL" : parts[5]));
		}
		else if(parts.length === 3 && parts[2] === "END") {
		    step.rotation = null;
		}
		closeStep(true);
	    }
	    else if(parts[1] === "!BRICKHUB_INLINED") {
		part.inlined = parts.length === 3 ? parts[2] : 'UNKNOWN';
                saveThisHeaderLine = false;
	    }
	    else if(parts[1] === "!HISTORY") {
		part.historyLines.push(parts.slice(2).join(" "));
                saveThisHeaderLine = false;
	    }
	    else if(parts[1][0] === "!") {
		if(is("!THEME") ||
		   is("!HELP") ||
		   is("!KEYWORDS") ||
		   is("!LPUB") ||
		   is("!LDCAD") ||
		   is("!LEOCAD") ||
		   is("!CATEGORY")) {
		    // Ignore known commands.
		}
		else {
		    invertNext = false;
		    self.onWarning({message:'Unknown LDraw command "' + parts[1] + '" is ignored.', line:i, subModel:part});
		}
	    }
	    else {
		invertNext = false;
		previousComment = line.substring(2);
                if(inHeader) {
                    saveThisHeaderLine = false; // previousComment is expected to be the description line in the header, so do not save it.
                }
	    }
	    
	    // TODO: TEXMAP commands
	    // TODO: Buffer exchange commands

	    if(this.saveFileLines && saveThisHeaderLine) {
                let fileLine = new LDR.Line0(parts.slice(1).join(" "));
                if(inHeader) {
                    part.headerLines.push(fileLine);
                }
                else {
                    step.fileLines.push(fileLine);
                }
            }
	    break;
	case 1: // 1 <colour> x y z a b c d e f g h i <file>
	    for(let j = 2; j < 14; j++) {
		parts[j] = parseFloat(parts[j]);
            }
	    let position = new THREE.Vector3(parts[2], parts[3], parts[4]);
	    let rotation = new THREE.Matrix3();
	    rotation.set(parts[5],  parts[6],  parts[7], 
			 parts[8],  parts[9],  parts[10], 
			 parts[11], parts[12], parts[13]);
	    let subModelID = parts.slice(14).join(" ").toLowerCase().replace('\\', '/');
	    let subModel = new THREE.LDRPartDescription(colorID, 
							position, 
							rotation, 
							subModelID,
							localCull,
						        invertNext);
            step.addSubModel(subModel); // DAT part - no step.

            inHeader = false;
	    if(this.saveFileLines) {
		step.fileLines.push(new LDR.Line1(subModel));
            }
	    invertNext = false;
	    break;
	case 2: // Line "2 <colour> x1 y1 z1 x2 y2 z2"
	    p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    step.addLine(colorID, p1, p2);

            inHeader = false;
	    if(this.saveFileLines) {
		step.fileLines.push(new LDR.Line2(colorID, p1, p2));
            }
	    invertNext = false;
	    break;
	case 3: // 3 <colour> x1 y1 z1 x2 y2 z2 x3 y3 z3
	    p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    p3 = new THREE.Vector3(parseFloat(parts[8]), parseFloat(parts[9]), parseFloat(parts[10]));
	    if(!part.certifiedBFC || !localCull) {
		step.cull = false; // Ensure no culling when step is handled.
            }
	    if(CCW === invertNext) {
		step.addTrianglePoints(colorID, p3, p2, p1);
	    }
	    else {
		step.addTrianglePoints(colorID, p1, p2, p3);
	    }

            inHeader = false;
	    if(this.saveFileLines) {
		step.fileLines.push(new LDR.Line3(colorID, p1, p2, p3, localCull, CCW !== invertNext));
            }
	    invertNext = false;
	    break;
	case 4: // 4 <colour> x1 y1 z1 x2 y2 z2 x3 y3 z3 x4 y4 z4
	    p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    p3 = new THREE.Vector3(parseFloat(parts[8]), parseFloat(parts[9]), parseFloat(parts[10]));
	    p4 = new THREE.Vector3(parseFloat(parts[11]), parseFloat(parts[12]), parseFloat(parts[13]));
	    if(!part.certifiedBFC || !localCull) {
		step.cull = false; // Ensure no culling when step is handled.
            }
	    if(CCW === invertNext) {
		step.addQuadPoints(colorID, p4, p3, p2, p1);
	    }
	    else {
		step.addQuadPoints(colorID, p1, p2, p3, p4);
	    }

            inHeader = false;
	    if(this.saveFileLines) {
		step.fileLines.push(new LDR.Line4(colorID, p1, p2, p3, p4, localCull, CCW !== invertNext));
            }
	    invertNext = false;
	    break;
	case 5: // Conditional lines:
	    p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    p3 = new THREE.Vector3(parseFloat(parts[8]), parseFloat(parts[9]), parseFloat(parts[10]));
	    p4 = new THREE.Vector3(parseFloat(parts[11]), parseFloat(parts[12]), parseFloat(parts[13]));
	    step.addConditionalLine(colorID, p1, p2, p3, p4);
            inHeader = false;
	    if(this.saveFileLines) {
		step.fileLines.push(new LDR.Line5(colorID, p1, p2, p3, p4));
            }
	    invertNext = false;
	    break;
        default:
            self.onWarning({message:'Unknown command "' + parts[1] + '" is ignored.', line:i, subModel:part});
            break;
	}
    }

    part.addStep(step);
    if(part.ID === null && this.mainModel === undefined) {
        part.ID = this.mainModel = 'main'; // No name given - use 'main'.
    }
    this.partTypes[part.ID] = part;
    loadedParts.push(part);

    // Load the unknown parts:    
    let unloadedPartsSet = {};
    let unloadedPartsList = [];
    function checkPart(id) {
        if(!(self.partTypes.hasOwnProperty(id) || unloadedPartsSet.hasOwnProperty(id))) {
            unloadedPartsSet[id] = true;
            unloadedPartsList.push(id);
        }
    }
    loadedParts.forEach(pt => pt.steps.forEach(s => s.subModels.forEach(sm => checkPart(sm.ID))));

    // Check assemblies:
    if(this.options.buildAssemblies) {
        if(!this.assemblyManager) {
            this.assemblyManager = new LDR.AssemblyManager(this);
        }
	loadedParts.forEach(pt => { if(!pt.isPart()) { pt.steps.forEach(
	    step => self.assemblyManager.handleStep(step).forEach(checkPart)
	)} });
    }

    if(unloadedPartsList.length > 0) {
        self.loadMultiple(unloadedPartsList);
    }

    // Save loaded parts into IndexedDB:
    if(this.storage.db) {
        setTimeout(() => self.storage.savePartsToStorage(loadedParts), 2000); // Don't let this action delay rendering.
        // Do not call storage.db.close() as there might be other parts that should be saved.
    }

    //let parseEndTime = new Date();
    //console.log(loadedParts.length + " LDraw file(s) read in " + (parseEndTime-parseStartTime) + "ms.");
};

THREE.LDRLoader.prototype.getPartType = function(id) {
    if(!this.partTypes.hasOwnProperty(id)) {
        return null;
    }
    let pt = this.partTypes[id];
    if(pt === true) {
        return null;
    }
    return pt;
}

THREE.LDRLoader.prototype.getMainModel = function() {
    if(!this.mainModel) {
        throw 'No main model set for ldrLoader!';
    }
    if(!this.partTypes.hasOwnProperty(this.mainModel)) {
        throw 'Inconsistent internal storage for ldrLoader: No main model!';
    }
    let pt = this.partTypes[this.mainModel];
    if(pt === true) {
        throw 'Main model not yet loaded!';
    }
    return pt;
}

THREE.LDRLoader.prototype.applyOnPartTypes = function(f) {
    for(let id in this.partTypes) {
        if(!this.partTypes.hasOwnProperty(id)) {
            continue;
        }
        let pt = this.partTypes[id];
        if(pt === true) {
            continue;
        }
        f(pt);
    }
}

THREE.LDRLoader.prototype.toLDR = function() {
    let self = this;
    let ret = this.partTypes[this.mainModel].toLDR(this);
    this.applyOnPartTypes(partType => {
            if(!(partType.inlined || partType.ID === self.mainModel)) {
                ret += partType.toLDR(self);
            }
        });
    return ret;
}

THREE.LDRLoader.prototype.substituteReplacementParts = function() {
    let self = this;

    let replacementMap = {};
    function buildReplacementMap(pt) {
	if(pt.replacement) {
	    replacementMap[pt.ID] = pt.replacement;
	}
    }
    this.applyOnPartTypes(buildReplacementMap);

    function fixReplacedParts(pt) {
	pt.steps.forEach(step => step.subModels.forEach(sm => {
	    if(replacementMap.hasOwnProperty(sm.ID)) {
		sm.ID = replacementMap[sm.ID]
	    }
	}));
    }
    this.applyOnPartTypes(fixReplacedParts);
}

/*
  Part description: a part (ID) placed (position, rotation) with a
  given color (16/24 allowed) and invertCCW to allow for sub-parts in DAT-parts.
*/
THREE.LDRPartDescription = function(colorID, position, rotation, ID, cull, invertCCW) {
    this.colorID = colorID; // LDraw ID. Negative values indicate edge colors - see top description.
    this.position = position; // Vector3
    this.rotation = rotation; // Matrix3
    this.ID = ID.toLowerCase(); // part.dat lowercase
    this.cull = cull;
    this.invertCCW = invertCCW;
    this.ghost;
    this.original; // If this PD is a colored clone of an original PD.
}

THREE.LDRPartDescription.prototype.cloneColored = function(colorID) {
    if(this.original) {
	throw "Cloning non-original PD!";
    }
    let c = this.colorID;
    if(this.colorID === 16) {
	c = colorID;
    }
    else if(this.colorID === 24) {
	c = -colorID-1;
    }
    let ret = new THREE.LDRPartDescription(c, this.position, this.rotation, this.ID, 
					   this.cull, this.invertCCW);
    ret.REPLACEMENT_PLI = this.REPLACEMENT_PLI;
    ret.original = this;
    ret.ghost = this.ghost || false; // For editor.
    return ret;
}

THREE.LDRPartDescription.prototype.placedColor = function(pdColorID) {
    let colorID = this.colorID;
    if(colorID === 16) {
        colorID = pdColorID;
    }
    else if(colorID === 24) {
        colorID = (pdColorID === 16) ? 24 : pdColorID; // Ensure color 24 is propagated correctly when placed for main color (16)..
    }

    return colorID;
}

THREE.LDRPartDescription.prototype.toLDR = function(loader) {
    let pt = loader.getPartType(this.ID);
    let ID = pt.name; // Proper casing.
    return '1 ' + this.colorID + ' ' + this.position.toLDR() + ' ' + this.rotation.toLDR() + ' ' + ID + '\r\n';
}

THREE.LDRPartDescription.prototype.placeAt = function(pd) {
    // Compute augmented colorID, position, rotation, ID
    let colorID = this.placedColor(pd.colorID);
    
    let position = new THREE.Vector3();
    position.copy(this.position);
    position.applyMatrix3(pd.rotation);
    position.add(pd.position);

    let rotation = new THREE.Matrix3();
    rotation.multiplyMatrices(pd.rotation, this.rotation);

    let invert = this.invertCCW === pd.invertCCW;

    return new THREE.LDRPartDescription(colorID, position, rotation, this.ID, this.cull, invert);
}

THREE.LDRStepRotation = function(x, y, z, type) {
    this.x = parseFloat(x);
    this.y = parseFloat(y);
    this.z = parseFloat(z);
    this.type = type.toUpperCase();
}

THREE.LDRStepRotation.equals = function(a, b) {
    let aNull = a === null;
    let bNull = b === null;
    if(aNull && bNull)
	return true;
    if(aNull !== bNull)
	return false;
    return (a.x === b.x) && (a.y === b.y) && (a.z === b.z) && (a.type === b.type);
}

THREE.LDRStepRotation.prototype.clone = function() {
    return new THREE.LDRStepRotation(this.x, this.y, this.z, this.type);
}

THREE.LDRStepRotation.prototype.toLDR= function() {
    return '0 ROTSTEP ' + this.x + ' ' + this.y + ' ' + this.z + ' ' + this.type + '\r\n';
}

// Get the rotation matrix by looking at the default camera position:
THREE.LDRStepRotation.getAbsRotationMatrix = function() {
    let looker = new THREE.Object3D();
    looker.position.x = -10000;
    looker.position.y = -7000;
    looker.position.z = -10000;
    looker.lookAt(new THREE.Vector3());
    looker.updateMatrix();
    let m0 = new THREE.Matrix4();
    m0.extractRotation(looker.matrix);
    return m0;
}
THREE.LDRStepRotation.ABS = THREE.LDRStepRotation.getAbsRotationMatrix();

/* 
   Specification: https://www.lm-software.com/mlcad/Specification_V2.0.pdf (page 7 and 8)
*/
THREE.LDRStepRotation.prototype.getRotationMatrix = function(defaultMatrix) {
    //console.log("Rotating for " + this.x + ", " + this.y + ", " + this.z);
    let wx = this.x / 180.0 * Math.PI;
    let wy = -this.y / 180.0 * Math.PI;
    let wz = -this.z / 180.0 * Math.PI;

    let s1 = Math.sin(wx);
    let s2 = Math.sin(wy);
    let s3 = Math.sin(wz);
    let c1 = Math.cos(wx);
    let c2 = Math.cos(wy);
    let c3 = Math.cos(wz);

    let a = c2 * c3;
    let b = -c2 * s3;
    let c = s2;
    let d = c1 * s3 + s1 * s2 * c3;
    let e = c1 * c3 - s1 * s2 * s3;
    let f = -s1 * c2;
    let g = s1 * s3 - c1 * s2 * c3;
    let h = s1 * c3 + c1 * s2 * s3;
    let i = c1 * c2;

    let rotationMatrix = new THREE.Matrix4();
    rotationMatrix.set(a, b, c, 0,
		       d, e, f, 0,
		       g, h, i, 0,
		       0, 0, 0, 1);
    let ret = new THREE.Matrix4();
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
    this.hasPrimitives = false;
    this.subModels = [];
    this.lines = []; // {colorID, p1, p2}
    this.conditionalLines = []; // {colorID, p1, p2, p3, p4}
    this.triangles = []; // {colorID, p1, p2, p3}
    this.quads = []; // {colorID, p1, p2, p3, p4}
    this.rotation = null;
    this.cull = true;
    this.cnt = -1;
    this.fileLines = [];
    this.original;
}

LDR.BYTES_WRITTEN = 0;
THREE.LDRStep.prototype.pack = function(obj) {
    let arrayF = [];
    let arrayI = [];

    // SubModels:
    let subModelMap = {};
    let subModelList = [];
    this.subModels.forEach(sm => {
            let id = sm.ID;
            if(!subModelMap.hasOwnProperty(id)) {
                if(!id.endsWith('.dat')) {
                    throw 'Expected part to be packed to have .dat at the end of the name. Found: ' + id;
                }
                subModelMap[id] = subModelList.length;
                let shortID = id.substring(0, id.length-4);
                subModelList.push(shortID);
            }
        });
    obj.sp = subModelList.join('|');

    arrayI.push(this.subModels.length);
    function handleSubModel(sm) {
        arrayI.push(sm.colorID);
        arrayI.push((subModelMap[sm.ID] * 4) + 
                    (sm.invertCCW ? 2 : 0) + 
                    (sm.cull ? 1 : 0)); // Encode these three properties into a single int.

        arrayF.push(sm.position.x, sm.position.y, sm.position.z);
        let e = sm.rotation.elements;
        for(let x = 0; x < 3; x++) {
            for(let y = 0; y < 3; y++) {
                arrayF.push(e[x+y*3]);
            }
        }
    }
    this.subModels.forEach(handleSubModel);

    // Primitives:
    function handle(primitives, size) {
        arrayI.push(primitives.length);
        primitives.forEach(x => {
                arrayI.push(x.colorID);
                arrayF.push(x.p1.x, x.p1.y, x.p1.z, 
                            x.p2.x, x.p2.y, x.p2.z);
                if(size > 2) {
                    arrayF.push(x.p3.x, x.p3.y, x.p3.z);
                }
                if(size > 3) {
                    arrayF.push(x.p4.x, x.p4.y, x.p4.z);
                }
            });
    }
    handle(this.lines, 2);
    handle(this.conditionalLines, 4);
    handle(this.triangles, 3);
    handle(this.quads, 4);

    LDR.BYTES_WRITTEN += arrayF.length * 4 + obj.sp.length*2;
    if(arrayI.some(val => val > 32767)) {
        obj.ai = new Int32Array(arrayI);
        LDR.BYTES_WRITTEN += arrayI.length * 4;
    }
    else {
        obj.ai = new Int16Array(arrayI);
        LDR.BYTES_WRITTEN += arrayI.length * 2;
    }

    //obj.ai = arrayI.some(val => val > 32767) ? new Int32Array(arrayI) : new Int16Array(arrayI);
    obj.af = new Float32Array(arrayF);
}

THREE.LDRStep.prototype.unpack = function(obj) {
    let arrayI = obj.ai;
    let arrayF = obj.af
    let subModelList = obj.sp.split('|').map(x => x += '.dat');
    let idxI = 0, idxF = 0;

    // Sub Models:
    let numSubModels = arrayI[idxI++];
    for(let i = 0; i < numSubModels; i++) {
        let colorID = arrayI[idxI++];
        let packed = arrayI[idxI++];
        let cull = packed % 2 === 1;
        let invertCCW = Math.floor(packed/2) % 2 === 1;
        let ID = subModelList[Math.floor(packed/4)];
        let position = new THREE.Vector3(arrayF[idxF++], arrayF[idxF++], arrayF[idxF++]);
        let rotation = new THREE.Matrix3();
        rotation.set(arrayF[idxF++], arrayF[idxF++], arrayF[idxF++], 
                     arrayF[idxF++], arrayF[idxF++], arrayF[idxF++],
                     arrayF[idxF++], arrayF[idxF++], arrayF[idxF++]);
        this.addSubModel(new THREE.LDRPartDescription(colorID, position, rotation, ID, cull, invertCCW));
    }

    // Primitives:
    function handle(size) {
        let ret = [];
        let numPrimitives = arrayI[idxI++];
        for(let i = 0; i < numPrimitives; i++) {
            let p = {colorID: arrayI[idxI++]};
            p.p1 = new THREE.Vector3(arrayF[idxF++], arrayF[idxF++], arrayF[idxF++]);
            p.p2 = new THREE.Vector3(arrayF[idxF++], arrayF[idxF++], arrayF[idxF++]);
            if(size > 2) {
                p.p3 = new THREE.Vector3(arrayF[idxF++], arrayF[idxF++], arrayF[idxF++]);
            }
            if(size > 3) {
                p.p4 = new THREE.Vector3(arrayF[idxF++], arrayF[idxF++], arrayF[idxF++]);
            }
            ret.push(p);
        }
        return ret;
    }
    this.lines = handle(2);
    this.conditionalLines = handle(4);
    this.triangles = handle(3);
    this.quads = handle(4);
    this.hasPrimitives = this.lines.length > 0 || this.conditionalLines.length > 0 || this.triangles.length > 0 || this.quads.length > 0;
}

THREE.LDRStep.prototype.removePrimitivesAndSubParts = function() {
    delete this.subModels;
    delete this.lines;
    delete this.conditionalLines;
    delete this.triangles;
    delete this.quads;
}

THREE.LDRStep.prototype.cloneColored = function(colorID) {
    if(colorID === 16 || colorID === 24) {
        throw "Cannot clone colored with special color 16 or 24!";
    }
    if(this.hasPrimitives) {
        throw "Cannot clone step with primitives!";
    }
    let ret = new THREE.LDRStep();

    ret.hasPrimitives = false;
    ret.subModels = this.subModels.map(subModel => subModel.cloneColored(colorID));
    ret.rotation = this.rotation;
    ret.cull = true;
    ret.cnt = this.cnt;
    ret.fileLines = this.fileLines;
    ret.original = this;

    return ret;
}

THREE.LDRStep.prototype.toLDR = function(loader, prevStepRotation, isLastStep) {
    let ret = '';
    this.fileLines.forEach(line => ret += line.toLDR(loader));
    if(!this.rotation) {
        if(prevStepRotation) {
            ret += '0 ROTSTEP END\r\n';
        }
        else if(!isLastStep) {
            ret += '0 STEP\r\n';
        }
    }
    else { // We have a rotation. Check against prev:
        if(THREE.LDRStepRotation.equals(this.rotation, prevStepRotation)) {
            ret += '0 STEP\r\n';            
        }
        else {
            ret += this.rotation.toLDR();
        }
    }
    return ret;
}

THREE.LDRStep.prototype.isEmpty = function() {
    return this.subModels.length === 0 && !this.hasPrimitives;
}

THREE.LDRStep.prototype.addSubModel = function(subModel) {
    this.subModels.push(subModel);
}

THREE.LDRStep.prototype.addLine = function(c, p1, p2) {
    this.hasPrimitives = true;
    this.lines.push({colorID:c, p1:p1, p2:p2});
}

THREE.LDRStep.prototype.addTrianglePoints = function(c, p1, p2, p3) {
    this.hasPrimitives = true;
    this.triangles.push({colorID:c, p1:p1, p2:p2, p3:p3});
}

THREE.LDRStep.prototype.addQuadPoints = function(c, p1, p2, p3, p4) {
    this.hasPrimitives = true;
    this.quads.push({colorID:c, p1:p1, p2:p2, p3:p3, p4:p4});
}

THREE.LDRStep.prototype.addConditionalLine = function(c, p1, p2, p3, p4) {
    this.hasPrimitives = true;
    this.conditionalLines.push({colorID:c, p1:p1, p2:p2, p3:p3, p4:p4});
}

/*
  Return true if the step contains a sub model which is not a part.
  This could be any sub assembly consisting of multiple parts.
 */
THREE.LDRStep.prototype.containsNonPartSubModels = function(loader) {
    if(this.subModels.length === 0) {
        return false;
    }
    // We only have to check first sub model, since steps with sub assemblies will be separate:
    let firstSubModel = loader.getPartType(this.subModels[0].ID);
    return !(!firstSubModel || firstSubModel.isPart());
}

THREE.LDRStep.prototype.containsPartSubModels = function(loader) {
    if(this.subModels.length === 0) {
        return false;
    }
    let firstSubModel = loader.getPartType(this.subModels[0].ID);
    return firstSubModel.isPart();
}

THREE.LDRStep.prototype.countParts = function(loader) {
    if(this.cnt >= 0) {
	return this.cnt;
    }
    let cnt = 0;

    this.subModels.forEach(function(subModel) {
	if(subModel.REPLACEMENT_PLI === true) {
	    return;
	}
        let pt = loader.getPartType(subModel.ID);
	if(!pt) {
	    console.warn("Unknown part type: " + subModel.ID);
	    return;
	}
        if(pt.isPart()) {
            cnt++;
        }
        else {
            cnt += pt.countParts(loader);
        }
    });

    this.cnt = cnt;
    return cnt;
}

/*
  Split all color/partType into separate steps with one step containing only parts.
  
  this.subModels = [];
  this.rotation = null;
 */
THREE.LDRStep.prototype.cleanUp = function(loader, newSteps) {
    if(this.isEmpty() || this.hasPrimitives) {
        newSteps.push(this);
        return; // Primitive-containing or empty step - just keep existing.
    }

    // Collect info:
    let self = this;
    let parts = [];
    let subModelsByTypeAndColor = {};

    function handleSubModel(subModelDesc) {
        let subModel = loader.getPartType(subModelDesc.ID);
        if(!subModel || subModel.isPart()) {
            parts.push(subModelDesc);
        }
        else { // Not a part:
            subModel.cleanUp(loader);
            let key = subModelDesc.colorID + '_' + subModel.ID;
            if(subModelsByTypeAndColor.hasOwnProperty(key)) {
                subModelsByTypeAndColor[key].push(subModelDesc);
            }
            else {
                subModelsByTypeAndColor[key] = [subModelDesc];
            }
        }
    }
    this.subModels.forEach(handleSubModel);

    function push(subModels) {
        let newStep = new THREE.LDRStep();
        newStep.subModels = subModels;
        newStep.rotation = self.rotation ? self.rotation.clone() : null;
        subModels.forEach(subModel => newStep.fileLines.push(new LDR.Line1(subModel)));
        newSteps.push(newStep);
    }

    // Split into separate steps if necessary:
    for(let key in subModelsByTypeAndColor) {
        if(subModelsByTypeAndColor.hasOwnProperty(key)) {
            push(subModelsByTypeAndColor[key]);
        }
    }

    // Finally add step for just the parts:
    if(parts.length > 0) {
        push(parts);
    }
}

THREE.LDRStep.prototype.generateThreePart = function(loader, colorID, position, rotation, cull, invertCCW, mc) {
    //console.log("STEP: Creating three part for " + this.subModels.length + " sub models in color " + colorID + ", cull: " + cull + ", invertion: " + invertCCW);
    let ownInversion = (rotation.determinant() < 0) !== invertCCW; // Adjust for inversed matrix!
    let ownCull = cull && this.cull;
    
    let transformColor = function(subColorID) {
	if(subColorID === 16) {
	    return colorID; // Main color
        }
	else if(subColorID === 24) {
	    return colorID < 0 ? colorID : -colorID-1; // Edge color
        }
	return subColorID;
    }

    let transformPoint = function(p) {
	let ret = new THREE.Vector3(p.x, p.y, p.z);
	ret.applyMatrix3(rotation);
	ret.add(position);
	return ret;
    }
    
    function handleSubModel(subModelDesc) {
	let subModelInversion = invertCCW !== subModelDesc.invertCCW;
	let subModelCull = subModelDesc.cull && ownCull; // Cull only if both sub model, this step and the inherited cull info is true!

	let subModelColor = transformColor(subModelDesc.colorID);
	
	let subModel = loader.getPartType(subModelDesc.ID);
	if(!subModel) {
	    loader.onError("Unloaded sub model: " + subModelDesc.ID);
	    return;
	}
	if(subModel.replacement) {
	    let replacementSubModel = loader.getPartType(subModel.replacement);
	    if(!replacementSubModel) {
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
	let nextPosition = transformPoint(subModelDesc.position);
	let nextRotation = new THREE.Matrix3();
	nextRotation.multiplyMatrices(rotation, subModelDesc.rotation);
	subModel.generateThreePart(loader, subModelColor, nextPosition, nextRotation, subModelCull, subModelInversion, mc, subModelDesc);
    }
    
    // Add submodels:
    this.subModels.forEach(handleSubModel);
}

LDR.Line0 = function(txt) {
    this.txt = txt;    
    this.line0 = true;
}

LDR.Line0.prototype.toLDR = function() {
    return '0 ' + this.txt + '\r\n';
}

LDR.Line1 = function(desc) {
    this.desc = desc; // LDRPartDescription
    this.line1 = true;
}

LDR.Line1.prototype.toLDR = function(loader) {
    return this.desc.toLDR(loader);
}

LDR.convertFloat = function(x) {
    x = x.toFixed(6); // Allow at most 6 decimals.
    for(let i = 0; i <= 6; i++) {
        let tmp = parseFloat(x).toFixed(i);
        if(parseFloat(tmp) === parseFloat(x)) {
            return tmp; // Don't output too many '0's.
        }
    }
    return x;
}

THREE.Vector3.prototype.toLDR = function() {
    return LDR.convertFloat(this.x) + ' ' + LDR.convertFloat(this.y) + ' ' + LDR.convertFloat(this.z);
}

THREE.Matrix3.prototype.toLDR = function() {
    let e = this.elements;
    let rowMajor = [e[0], e[3], e[6],
                    e[1], e[4], e[7],
                    e[2], e[5], e[8]]
    return rowMajor.map(LDR.convertFloat).join(' ');
}

LDR.Line2 = function(c, p1, p2) {
    this.c = c;
    this.p1 = p1;
    this.p2 = p2;
    this.line2 = true;
}

LDR.Line2.prototype.toLDR = function() {
    return '2 ' + this.c + ' ' + this.p1.toLDR() + ' ' + this.p2.toLDR() + '\r\n';
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

LDR.Line3.prototype.toLDR = function() {
    return '3 ' + this.c + ' ' + this.p1.toLDR() + ' ' + this.p2.toLDR() + ' ' + this.p3.toLDR() + '\r\n';
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

LDR.Line4.prototype.toLDR = function() {
    return '4 ' + this.c + ' ' + this.p1.toLDR() + ' ' + this.p2.toLDR() + ' ' + this.p3.toLDR() + ' ' + this.p4.toLDR() + '\r\n';
}

LDR.Line5 = function(c, p1, p2, p3, p4) {
    this.c = c;
    this.p1 = p1;
    this.p2 = p2;
    this.p3 = p3;
    this.p4 = p4;
    this.line5 = true;
}

LDR.Line5.prototype.toLDR = function() {
    return '4 ' + this.c + ' ' + this.p1.toLDR() + ' ' + this.p2.toLDR() + ' ' + this.p3.toLDR() + ' ' + this.p4.toLDR() + '\r\n';
}

THREE.LDRPartType = function() {
    this.name; // The value for '0 FILE' and '0 Name:'.
    this.ID = null; // this.name, but lower case and with backslashes replaced with forward slashes.
    this.modelDescription;
    this.author;
    this.license;
    this.steps = [];
    this.headerLines = [];
    this.historyLines = [];
    this.lastRotation = null;
    this.replacement;
    this.inlined;
    this.ldraw_org;
    this.geometry;
    this.cnt = -1;
    this.cleanSteps = false;
    this.certifiedBFC;
    this.CCW;
    this.consistentFileAndName;
}

THREE.LDRPartType.prototype.canBePacked = function() {
    return this.inlined !== 'IDB' && // Don't re-pack.
           this.inlined !== 'GENERATED' && // Don't pack generated parts.
           this.isPart() && // Should be a part.
           this.license === 'Redistributable under CCAL version 2.0 : see CAreadme.txt' &&
	   this.ldraw_org && // And an LDRAW_ORG statement.
           !this.ldraw_org.startsWith('Unofficial_'); // And not be unofficial.
}

THREE.LDRPartType.prototype.pack = function() {
    let ret = {};
    let id = this.ID;
    if(id.endsWith('.dat')) {
        id = id.substring(0, id.length-4);
    }
    ret.ID = id;
    ret.md = this.modelDescription;
    LDR.BYTES_WRITTEN += (id.length + ret.md.length) * 2 + 1;
    this.steps[0].pack(ret);
    // Ignore headers and history to save space.
    ret.e = (this.CCW ? 2 : 0) + (this.certifiedBFC ? 1 : 0);
    return ret;
}

THREE.LDRPartType.prototype.unpack = function(obj) {
    this.ID = this.name = obj.ID + '.dat';
    this.modelDescription = obj.md;
    let step = new THREE.LDRStep();
    step.unpack(obj);
    this.steps = [step];
    this.certifiedBFC = obj.e % 2 === 1;
    this.CCW = Math.floor(obj.e/2) % 2 === 1;
    this.inlined = 'IDB';
}

/*
  Clean up all steps.
  This can cause additional steps (such as when a step contains both parts and sub models.
 */
THREE.LDRPartType.prototype.cleanUp = function(loader) {
    if(this.cleanSteps) {
        return; // Already done.
    }

    if(this.isReplacedPart()) {
	this.replacement = this.steps[0].subModels[0].ID;
	loader.onWarning({message:'The part "' + this.ID + '" has been replaced by "' + this.replacement + '".', line:0, subModel:this});
    }
    else {
	let newSteps = [];
	this.steps.forEach(step => step.cleanUp(loader, newSteps));
	this.steps = newSteps;
    }

    this.cleanSteps = true;
}

THREE.LDRPartType.prototype.toLDR = function(loader) {
    let ret = '0 FILE ' + this.name + '\r\n';
    if(this.modelDescription) {
        ret += '0 ' + this.modelDescription + '\r\n';
    }
    ret += '0 Name: ' + this.name + '\r\n';
    if(this.author) {
        ret += '0 Author: ' + this.author + '\r\n';
    }
    if(this.ldraw_org) {
        ret += '0 !LDRAW_ORG ' + this.ldraw_org + '\r\n';
    }
    if(this.license) {
        ret += '0 !LICENSE ' + this.license + '\r\n';
    }
    if(this.headerLines.length > 0) {
        ret += '\r\n'; // Empty line before additional header lines, such as 'THEME' and 'KEYWORDS'
        this.headerLines.forEach(line => ret += line.toLDR(loader));
    }
    if(this.hasOwnProperty('preferredColor')) {
        ret += '\r\n0 !CMDLINE -c' + this.preferredColor + '\r\n';
    }
    if(this.historyLines.length > 0) {
        ret += '\r\n';
        this.historyLines.forEach(hl => ret += '0 !HISTORY ' + hl + '\r\n');
    }
    if(this.steps.length > 0) {
        ret += '\r\n';
        this.steps.forEach((step, idx, a) => ret += step.toLDR(loader, idx === 0 ? null : a[idx-1].rotation, idx === a.length-1));
    }
    ret += '\r\n';
    return ret;
}

THREE.LDRPartType.prototype.ensureGeometry = function(loader) {
    if(this.geometry) {
	return; // Already prepared.
    }
    this.geometry = new LDR.LDRGeometry();
    this.geometry.fromPartType(loader, this);
    // Clean up after data has moved to this.geometry:
    //TODO this.steps.forEach(step => step.removePrimitivesAndSubParts());
}

THREE.LDRPartType.prototype.addStep = function(step) {
    if(step.isEmpty() && this.steps.length === 0) {
	return; // Totally illegal step.
    }
    
    // Update rotation in case of ADD;
    if(step.rotation && step.rotation.type === "ADD") {
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
    
    let sameRotation = THREE.LDRStepRotation.equals(step.rotation, this.lastRotation);
    if(step.isEmpty() && sameRotation) {
	return; // No change.
    }
    if(this.steps.length > 0) {
	let prevStep = this.steps[this.steps.length-1];
	if(prevStep.isEmpty() && sameRotation) {
	    // Special case: Merge into previous step:
	    this.steps[this.steps.length-1] = step;
	    return;
	}
    }
    this.steps.push(step);
    this.lastRotation = step.rotation;
}
    
THREE.LDRPartType.prototype.generateThreePart = function(loader, c, p, r, cull, inv, mc, pd) {
    if(!this.geometry) {
	if(this.isPart()) {
	    this.ensureGeometry(loader);
	}
	else {
            this.steps.forEach(step => step.generateThreePart(loader, c, p, r, cull, inv, mc));
	    return;
	}
    }

    if(loader.physicalRenderingAge === 0) {
        this.geometry.buildGeometriesAndColors();
    }
    else {
        this.geometry.buildPhysicalGeometriesAndColors();
    }
    
    let m4 = new THREE.Matrix4();
    let m3e = r.elements;
    m4.set(
	m3e[0], m3e[3], m3e[6], p.x,
	m3e[1], m3e[4], m3e[7], p.y,
	m3e[2], m3e[5], m3e[8], p.z,
	0, 0, 0, 1
    );
    
    if(this.geometry.lineGeometry) {
	let material = new LDR.Colors.buildLineMaterial(this.geometry.lineColorManager, c, false);
	let normalLines = new THREE.LineSegments(this.geometry.lineGeometry, material);
	normalLines.applyMatrix(m4);
	mc.addLines(normalLines, pd, false);
    }
    
    if(this.geometry.conditionalLineGeometry) {
	let material = new LDR.Colors.buildLineMaterial(this.geometry.lineColorManager, c, true);
	let conditionalLines = new THREE.LineSegments(this.geometry.conditionalLineGeometry, material);
	conditionalLines.applyMatrix(m4);
	mc.addLines(conditionalLines, pd, true);
    }
    
    if(this.geometry.triangleGeometry) {
        if(loader.physicalRenderingAge === 0) {
            let material = new LDR.Colors.buildTriangleMaterial(this.geometry.triangleColorManager, c, LDR.Colors.isTrans(c));
            let mesh = new THREE.Mesh(this.geometry.triangleGeometry.clone(), material); // Using clone to ensure matrix in next line doesn't affect other usages of the geometry..
            mesh.geometry.applyMatrix(m4);
            //mesh.applyMatrix(m4); // Doesn't work for LDraw library as the matrix needs to be decomposable to position, quaternion and scale.
            if(LDR.Colors.isTrans(c)) {
                mc.addTrans(mesh, pd);
            }
            else {
                mc.addOpaque(mesh, pd);
            }            
        }
        else {
            for(let tc in this.geometry.triangleGeometry) {
                if(!this.geometry.triangleGeometry.hasOwnProperty(tc)) {
                    continue;
                }
                let shownColor = tc === '16' ? c : tc;
                let material = LDR.Colors.buildStandardMaterial(shownColor);
                let g = this.geometry.triangleGeometry[tc];
                let mesh = new THREE.Mesh(g.clone(), material);
                mesh.castShadow = true;
                mesh.geometry.applyMatrix(m4);

                if(LDR.Colors.isTrans(shownColor)) {
                    mc.addTrans(mesh, pd);
                }
                else {
                    mc.addOpaque(mesh, pd);
                }            
            }
        }
    }

    let b = this.geometry.boundingBox;
    mc.expandBoundingBox(b, m4);
}
    
THREE.LDRPartType.prototype.isPart = function() {
    return this.steps.length === 1 && (this.ID.endsWith('.dat') || this.steps[0].hasPrimitives);
}

THREE.LDRPartType.prototype.isReplacedPart = function() {
    if(this.steps.length !== 1) {
	return false; // Not exactly one step.
    }
    let step = this.steps[0];
    if(step.hasPrimitives || step.subModels.length !== 1) {
	return false; // Has primitives or is not consisting of a single sub model.
    }
    let sm = step.subModels[0];
    if(sm.colorID !== 16 || sm.position.x !== 0 || sm.position.y !== 0 || sm.position.z !== 0) {
	return false; // Not color 16 or at position (0,0,0).
    }
    let e = sm.rotation.elements;
    let check = [1,0,0,0,1,0,0,0,1];
    for(let i = 0; i < 9; i++) {
	if(e[i] !== check[i]) {
	    return false; // Not default rotation.
	}
    }
    return true;
}

THREE.LDRPartType.prototype.countParts = function(loader) {
    if(this.cnt >= 0 || this.isPart()) {
	return this.cnt;
    }
    this.cnt = this.steps.map(step => step.countParts(loader)).reduce((a,b)=>a+b, 0);
    return this.cnt;
}

LDR.ColorManager = function() {
    this.shaderColors = []; // [] => Vector4
    this.highContrastShaderColors = []; // [] => Vector4
    this.map = {}; // colorID -> floatColor
    this.sixteen = -1;
    this.edgeSixteen = -1;
    this.anyTransparentColors = false;
    this.mainColorIsTransparent = false;
}

LDR.ColorManager.prototype.clone = function() {
    let ret = new LDR.ColorManager();
    ret.shaderColors.push(...this.shaderColors);
    ret.highContrastShaderColors.push(...this.highContrastShaderColors);
    ret.sixteen = this.sixteen;
    ret.edgeSixteen = this.edgeSixteen;
    ret.anyTransparentColors = this.anyTransparentColors;
    ret.mainColorIsTransparent = this.mainColorIsTransparent;
    for(let c in this.map) {
        if(this.map.hasOwnProperty(c))
            ret.map[c] = this.map[c];
    }
    return ret;
}

LDR.ColorManager.prototype.overWrite = function(id) {
    let isEdge = id < 0;
    let lowID = isEdge ? -id-1 : id;
    let colorObject = LDR.Colors[lowID];
    if(!colorObject) {
        throw "Unknown color: " + id;
    }
    let alpha = colorObject.alpha ? colorObject.alpha/256.0 : 1;
    this.mainColorIsTransparent = alpha < 1;
    
    if(this.sixteen >= 0) {
        let color = new THREE.Color(isEdge ? colorObject.edge : colorObject.value);
        this.shaderColors[this.sixteen] = new THREE.Vector4(color.r, color.g, color.b, alpha);
    }
    
    if(this.edgeSixteen >= 0) {
        let color = new THREE.Color(colorObject.edge);
        this.shaderColors[this.edgeSixteen] = new THREE.Vector4(color.r, color.g, color.b, 1); // Drop alpha from edge lines to increase contrast.
        this.highContrastShaderColors[this.edgeSixteen] = LDR.Colors.getHighContrastColor4(lowID);
    }

    this.lastSet = id;
}

LDR.ColorManager.prototype.get = function(id) {
    let f = this.map[id];
    if(f) {
        return f;
    }
    if(id == 16) {
        this.sixteen = this.shaderColors.length;
    }
    else if(id == 10016 || id == 24) {
        this.edgeSixteen = this.shaderColors.length;
    }
    
    let isEdge = id < 0;
    let lowID = isEdge ? -id-1 : id;
    let colorObject = LDR.Colors[lowID];
    if(!colorObject) {
        throw "Unknown color " + lowID + " from " + id;
    }
    let color = new THREE.Color(isEdge ? colorObject.edge : colorObject.value);
    let alpha = colorObject.alpha ? colorObject.alpha/256.0 : 1;
    this.anyTransparentColors = (this.anyTransparentColors || (alpha < 1))
    
    f = this.shaderColors.length + 0.1;
    this.map[id] = f;
    this.shaderColors.push(new THREE.Vector4(color.r, color.g, color.b, alpha));
    this.highContrastShaderColors.push(LDR.Colors.getHighContrastColor4(lowID));
    return f;
}

LDR.ColorManager.prototype.containsTransparentColors = function() {
    return this.anyTransparentColors || this.mainColorIsTransparent;
}

/*
  MeshCollector holds references to meshes (and similar Three.js structures for lines).
  A Mesh Collector handles updates of meshes. This includes;
  - Changes in options (coloring of old parts, edge colors)
  - visibility
  - 'old': A part placed in 'earlier steps' can be colored 'old' to highlight new parts
  - 'ghost': 'Ghosted' parts will be shown by their lines only (no faces).
*/
LDR.MeshCollectorIdx = 0;
LDR.MeshCollector = function(opaqueObject, transObject) {
    this.opaqueObject = opaqueObject;
    this.transObject = transObject; // To be painted last.

    this.lineMeshes = []; // {mesh,part,opaque,conditional}
    this.triangleMeshes = []; // {mesh,part,opaque}

    this.old = false;
    this.visible = true;
    this.boundingBox;
    this.isMeshCollector = true;
    this.idx = LDR.MeshCollectorIdx++;
    //console.warn('Creating MC ' + this.idx);
}

LDR.MeshCollector.prototype.addLines = function(mesh, part, conditional) {
    this.lineMeshes.push({mesh:mesh, part:part, opaque:true, conditional:conditional});
    this.opaqueObject.add(mesh);
}

LDR.MeshCollector.prototype.addOpaque = function(mesh, part) {
    //scene.add(new THREE.VertexNormalsHelper( mesh, 5, 0x00ff00));
    this.triangleMeshes.push({mesh:mesh, part:part, opaque:true});
    this.opaqueObject.add(mesh);
}

LDR.MeshCollector.prototype.addTrans = function(mesh, part) {
    //scene.add(new THREE.VertexNormalsHelper( mesh, 5, 0x0000ff));
    this.triangleMeshes.push({mesh:mesh, part:part, opaque:false});
    this.transObject.add(mesh);
}

LDR.MeshCollector.prototype.removeAllMeshes = function() {
    var self = this;
    this.lineMeshes.forEach(obj => self.opaqueObject.remove(obj.mesh));
    this.triangleMeshes.filter(obj => obj.opaque).forEach(obj => self.opaqueObject.remove(obj.mesh));
    this.triangleMeshes.filter(obj => !obj.opaque).forEach(obj => self.transObject.remove(obj.mesh));
}

/*
  Sets '.visible' on all meshes according to ldrOptions and 
  visibility of this meshCollector.
 */
LDR.MeshCollector.prototype.updateMeshVisibility = function() {
    let v = this.visible;
    let lineV = v && ldrOptions.lineContrast !== 2;
    for(let i = 0; i < this.lineMeshes.length; i++) {
	this.lineMeshes[i].mesh.visible = lineV;
    }
    for(let i = 0; i < this.triangleMeshes.length; i++) {
        let obj = this.triangleMeshes[i];
        obj.mesh.visible = v && (this.old || !(ldrOptions.showEditor && obj.part && obj.part.original && obj.part.original.ghost)); // Do not show faces for ghosted parts.
    }
}

LDR.MeshCollector.prototype.expandBoundingBox = function(boundingBox, m) {
    let b = new THREE.Box3();
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
    if(!LDR.Colors.canBeOld) {
	return;
    }
    for(let i = 0; i < this.lineMeshes.length; i++) {
	this.lineMeshes[i].mesh.material.uniforms.old.value = old;
    }
    for(let i = 0; i < this.triangleMeshes.length; i++) {
	this.triangleMeshes[i].mesh.material.uniforms.old.value = old;
    }
}

LDR.MeshCollector.prototype.colorLinesLDraw = function() {
    this.lineMeshes.forEach(mesh => {
            let m = mesh.mesh.material;
            let colors = m.colorManager.shaderColors;
            if(colors.length === 1) {
                m.uniforms.color.value = colors[0];
            }
            else {
                m.uniforms.colors.value = colors;
            }
        });
}

LDR.MeshCollector.prototype.colorLinesHighContrast = function() {
    this.lineMeshes.forEach(mesh => {
            let m = mesh.mesh.material;
            let colors = m.colorManager.highContrastShaderColors;
            if(colors.length === 1) {
                m.uniforms.color.value = colors[0];
            }
            else {
                m.uniforms.colors.value = colors;
            }
        });
}

LDR.MeshCollector.prototype.updateState = function(old) {
    this.old = old;
    this.lineContrast = ldrOptions.lineContrast;
    this.showOldColors = ldrOptions.showOldColors;
}

LDR.MeshCollector.prototype.update = function(old) {
    // Check if lines need to be recolored:
    if(this.lineContrast !== ldrOptions.lineContrast) {
	if(ldrOptions.lineContrast === 1) {
	    this.colorLinesLDraw();
        }
	else {
	    this.colorLinesHighContrast();
        }
    }
    if(old !== this.old || ldrOptions.showOldColors !== this.showOldColors) {
	this.setOldValue(old && ldrOptions.showOldColors === 1);
    }
    this.updateState(old);
}

/*
  This is a temporary function used by single parts render. 
  To be decomissioned when colors are moved to an attribute.
 */
LDR.MeshCollector.prototype.overwriteColor = function(color) {
    if(this.overwrittenColor === color) {
        return;
    }
    function handle(obj, edge) {
        const m = obj.mesh.material;
        const c = m.colorManager;
	c.overWrite(color);
	let colors = !edge || ldrOptions.lineContrast > 0 ? c.shaderColors : c.highContrastShaderColors;
	if(colors.length === 1) {
	    m.uniforms.color.value = colors[0];
        }
	else {
	    m.uniforms.colors.value = colors;
        }
    }

    for(let i = 0; i < this.triangleMeshes.length; i++) {
	handle(this.triangleMeshes[i], false);
    }
    for(let i = 0; i < this.lineMeshes.length; i++) {
	handle(this.lineMeshes[i], true);
    }
    this.overwrittenColor = color;
}

LDR.MeshCollector.prototype.draw = function(old) {
    this.update(old);
    this.updateMeshVisibility();
}

LDR.MeshCollector.prototype.isVisible = function() {
    return this.visible;
}

/*
  Update meshes and set own visibility indicator.
*/
LDR.MeshCollector.prototype.setVisible = function(v) {
    if(this.visible === v && this.old) { // If not old, ghosting might have changed.
	return;
    }
    this.visible = v;
    this.updateMeshVisibility();
}

LDR.MeshCollector.prototype.getGhostedParts = function() {
    let lineObjects = this.lineMeshes.filter(obj => obj.part && obj.part.original.ghost);
    let triangleObjects = this.triangleMeshes.filter(obj => obj.part && obj.part.original.ghost);
    return [lineObjects,triangleObjects];
}

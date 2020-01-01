'use strict';

/**
 * @author Lasse Deleuran | c-mt.dk and brickhub.org
 * LDR Specification: http://www.ldraw.org/documentation/ldraw-org-file-format-standards.html
 * LDR Specification for back face culling: https://www.ldraw.org/article/415.html
 * LDR Specification for texture mapping:  https://www.ldraw.org/documentation/ldraw-org-file-format-standards/language-extension-for-texture-mapping.html
 *
 * Special note about colors. 
 * LDraw ID's are used for identifying colors efficiently. However. An LDraw color has both an ordinary value and an 'edge' value which can be used for rendering. In order to simplify the data model for storing geometries by colors, geometries colored in edge colors have negative color values with '1' subtracted. An 'edge' color is thus identified by the ID being negative and the LDraw ID can be obtained by negating and subtracting 1. As an example, the ID for the color red is '4', while the gray edge color is '-4-1' = '-5'.
 * This handling of color ID's is internal to the loader and transparent to code that uses LDRLoader.
 *
 * Description of parameters:
 * onLoad is called on completion of loading of all necessary LDraw files.
 * storage should be an instance of LDR.STORAGE, or null. Unloaded files will be attempted to be read from storage before new file requests are attempted.
 * The optional options object has the following optional parameters:
 * - manager: Three.js loading manager. The default loading manager is used if none is present.
 * - onWarning(warningObj) is called when non-breaking errors are encountered, such as unknown colors and unsupported META commands.
 * - onProgress is called when a sub model or texture has been loaded and will also be used by the manager. A texture is detected by having the second parameter 'true'.
 * - onError(errorObj) is called on breaking errors. errorObj has the following properties:
 *  - message: Human-readable error message.
 *  - line: Line number in the loaded file where the error occured.
 *  - subModel: THREE.LDRPartType in which the error occured.
 * - saveFileLines: Set to 'true' if LDR.Line0, LDR.Line1, ... LDR.Line5-objects should be saved on part types. These are used to generate .ldr files.
 * - physicalRenderingAge: Set to 0 for standard cell shaded rendering. Otherwise, this number indicates the age of physical materials to be rendered (older materials will appear yellowed for some colors)
 * - idToUrl(id) is used to translate an id into all potential file locations. Set this function to fit your own directory structure if needed. A normal LDraw directory has files both under /parts and /p and requires you to search for dat files. You can choose to combine the directories to reduce the need for searching, but this is not considered good practice.
 * - idToTextureUrl(id) is used to translate a texture file name into the position where the file can be fetched. By default the file name is made lower case and rpefixed 'textures/' to locate the texture file.
 * - cleanUpPrimitivesAndSubParts can be set to true to perform cleanup of internal geometries to decrease the amount of memory required.
 */
THREE.LDRLoader = function(onLoad, storage, options) {
    let self = this;

    this.partTypes = {}; // id => true or part. id is typically something like "parts/3001.dat", and "model.mpd".
    this.texmaps = {}; // fileName => true or THREE.Texture. fileName is typically something like wall_deco123.png
    this.texmapListeners = {}; // fileName => list of functions to be called.
    this.texmapDataurls = []; // [id,dataurl] for sotring inline texmaps.
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

    this.idToTextureUrl = this.options.idToTextureUrl || function(id) {
        let lowerID = id.toLowerCase();
	return "textures/"+lowerID;
    };

    this.cleanUpPrimitivesAndSubParts = this.options.cleanUpPrimitivesAndSubParts || false;
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
	self.parse(text, id);
	self.unloadedFiles--; // Warning - might have concurrency issue when two threads simultaneously update this!
	self.reportProgress(id);
    }

    let urlID = 0;
    let onError = function(event) {
        urlID++;
        if(urlID < urls.length) {
            self.loader.load(urls[urlID], onFileLoaded, self.onProgress, onError);
        }
        else {
	    console.warn('Failed to load ' + id);
            self.unloadedFiles--; // Can't load this.
  	    self.reportProgress(id);
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
        unloadedParts.forEach(id => self.load(id));
        self.unloadedFiles--;
        self.reportProgress(ids[0]);
    }
    self.unloadedFiles++; // Prevent early exit.

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
THREE.LDRLoader.prototype.parse = function(data, defaultID) {
    let parseStartTime = new Date();
    let self = this;

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
    let hasFILE = false;
    let skipPart = false;

    // TEXMAP support:
    let texmapPlacement = null;
    let inTexmapFallback = false;

    let dataLines = data.split(/(\r\n)|\n/);
    for(let i = 0; i < dataLines.length; i++) {
	let line = dataLines[i];
	if(!line) {
	    continue; // Empty line, or 'undefined' due to '\r\n' split.
	}

	let parts = line.split(' ').filter(x => x !== ''); // Remove empty strings.
	if(parts.length <= 1) {
	    continue; // Empty/ empty comment line
        }
	let lineType = parseInt(parts[0]);
        if(lineType === 0 && parts.length > 2 && texmapPlacement && parts[1] === '!:') {
            parts = parts.slice(2); // Texmap content.
            lineType = parseInt(parts[0]);
        }

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

        // Expire texmapPlacement:
        if(texmapPlacement && texmapPlacement.used) {
            texmapPlacement = null;
        }

	//console.log("Parsing line " + i + " of type " + lineType + ', color ' + colorID + ": " + line); // Useful if you encounter parse errors.

	let l3 = parts.length >= 3;
	let is = type => l3 && type === parts[1];

        // Set the model description once header is exited:
        if(!inHeader && !part.modelDescription && previousComment) {
	    part.modelDescription = previousComment;
	    if(previousComment.startsWith("~Unknown part ")) {
		self.onError({message:'Unknown part "' + part.ID + '" will be shown as a cube.', line:i, subModel:part});
	    }
	    previousComment = undefined; // Ready for next part.
        }

        let p1, p2, p3, p4; // Used in switch.
	switch(lineType) {
	case 0:
            let saveThisCommentLine = true;

            function handleFileLine(originalFileName) {
                let fileName = originalFileName.toLowerCase().replace('\\', '/'); // Normalize the name by bringing to lower case and replacing backslashes:
                localCull = false; // BFC Statements come after the FILE or Name: - directives.
                saveThisCommentLine = false;
                let isEmpty = part.steps.length === 0 && step.isEmpty();
                
                if(isEmpty && !self.mainModel) { // First model
                    self.mainModel = part.ID = fileName;
                }
                else if(isEmpty && self.mainModel && self.mainModel === part.ID) {
                    console.warn("Special case: Main model ID change from " + part.ID + " to " + fileName);
                    self.mainModel = part.ID = fileName;
                }
                else { // Close model and start new as no FILE directive has been encountered:
                    closeStep(false);
                    
                    if(!part.ID) { // No ID in main model: 
                        console.warn('No ID in main model - setting default ID "' + defaultID + '"');
                        part.ID = defaultID;
			if(!self.mainModel) {
			    self.mainModel = defaultID;
			}
                    }
                    if(!skipPart) {
                        self.partTypes[part.ID] = part;
                        skipPart = false;
                    }
                    self.onProgress(part.ID);
                    loadedParts.push(part);
                    
                    part = new THREE.LDRPartType();
                    inHeader = true;
                    part.ID = fileName;
                }
                part.name = originalFileName;
            }

	    if(is("FILE")) {
		hasFILE = true;
		handleFileLine(parts.slice(2).join(" "));
                saveThisCommentLine = false;
	    }
	    else if(!hasFILE && is("file")) { // Special case where some very old files use '0 file' instead of the proper '0 FILE':
		handleFileLine(parts.slice(2).join(" "));		
                saveThisCommentLine = false;
	    }
	    else if(is("Name:")) {
		part.name = parts.slice(2).join(" ");
		if(part.ID === part.name) { // Consistent 'FILE' and 'Name:' lines.
		    part.consistentFileAndName = true;
		}
                saveThisCommentLine = false;
	    }
	    else if(is("Author:")) {
		part.author = parts.slice(2).join(" ");
                saveThisCommentLine = false;
	    }
	    else if(is("!LICENSE")) {
		part.license = parts.slice(2).join(" ");
                saveThisCommentLine = false;
	    }
	    else if(is("!LDRAW_ORG")) {
		part.ldraw_org = parts.slice(2).join(" ");
                saveThisCommentLine = false;
	    }
	    else if(is("!CMDLINE")) {
		part.preferredColor = parseInt(parts[2].substring(2));
                saveThisCommentLine = false;
	    }
	    else if(parts[1] === "BFC") {
		// BFC documentation: http://www.ldraw.org/article/415
		let option = parts[2];
		switch(option) {
		case "CERTIFY":
		    part.certifiedBFC = true;
		    part.CCW = CCW = true;
                    localCull = true;
                    saveThisCommentLine = false;
		    break;
		case "NOCERTIFY":
		    part.certifiedBFC = false;
		    part.CCW = CCW = true; // Doens't matter since there is no culling.
                    localCull = false;
                    saveThisCommentLine = false;
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
	    }
	    else if(parts[1] === "!HISTORY") {
		part.historyLines.push(parts.slice(2).join(" "));
	    }
	    else if(parts[1] === "!TEXMAP") {
                if(texmapPlacement) { // Expect "0 !TEXMAP FALLBACK" or "0 !TEXMAP END"
                    if(!(parts.length === 3 && (parts[2] === 'FALLBACK' || parts[2] === 'END'))) {
                        self.onWarning({message:'Unexpected !TEXMAP line. Expected FALLBACK or END line. Found: "' + line + '".', line:i, subModel:part});
                        inTexmapFallback = false;
                        texmapPlacement = null;
                    }
                    else if(parts[2] === 'FALLBACK') {
                        inTexmapFallback = true;
                    }
                    else { // !TEXMAP END
                        inTexmapFallback = false;
                        texmapPlacement = null;
                    }
                }
                else { // Expect 0 !TEXMAP START | NEXT...
                    texmapPlacement = new LDR.TexmapPlacement();
                    texmapPlacement.setFromParts(parts);
                    if(texmapPlacement.error) {
                        self.onWarning({message:texmapPlacement.error + ': "' + line + '"', line:i, subModel:part});
                        texmapPlacement = null;
                    }
                }
                saveThisCommentLine = false;
	    }
	    else if(parts[1] === "!DATA" && parts.length === 3 && parts[2] === "START") { // Inline texmap :
                skipPart = true;
                // Take over parsing in order to read full encoded block:
                let encodedContent = '';
                // Parse encoded content:
                for(; i < dataLines.length; i++) {
                    line = dataLines[i]; if(!line) continue;
                    parts = line.split(' ').filter(x => x !== ''); if(parts.length <= 1) continue; // Empty/ empty comment line
                    lineType = parseInt(parts[0]);
                    if(lineType !== 0) {self.onWarning({message:'Unexpected DATA line type ' + lineType + ' is ignored.', line:i, subModel:part}); continue;}
                    if(parts.length === 3 && parts[1] === '!DATA' && parts[2] === 'END') break; // Done
                    if(!parts[1].startsWith('!:')) continue;

                    encodedContent += parts[1].substring(2);
                    if(parts.length > 2) encodedContent += parts.slice(2).join('');
                }
                console.warn('Inline texmap file encountered - standard not yet finalized, so errors might occur!');

                let detectMimetype = id => id.endsWith('jpg') || id.endsWith('jpeg') ? 'jpeg' : 'png'; // Only png supported according to the spec.
		let pid = part.ID;
                let mimetype = detectMimetype(pid);
                let dataurl = 'data:image/' + mimetype + ';base64,' + encodedContent;
                self.texmapDataurls.push({id:pid, mimetype:mimetype, content:encodedContent});

                self.texmaps[pid] = true;
                self.texmapListeners[pid] = [];
                let image = new Image();
                image.onload = function(e) {
                    let texture = new THREE.Texture(this);
                    texture.needsUpdate = true;
                    self.texmaps[pid] = texture;
                    self.texmapListeners[pid].forEach(l => l(texture));
                    self.onProgress(pid);
                };
                image.src = dataurl;

                saveThisCommentLine = false;
	    }
	    else if(LDR.STUDIO && LDR.STUDIO.handleLine(part, parts)) {
                saveThisCommentLine = false;
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
                    saveThisCommentLine = false; // previousComment is expected to be the description line in the header, so do not save it.
                }
	    }
	    
	    // TODO: Buffer exchange commands

	    if(this.saveFileLines && saveThisCommentLine) {
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
	    let subModel = new THREE.LDRPartDescription(colorID, position, rotation, subModelID, localCull, invertNext, texmapPlacement);

            if(!inTexmapFallback) {
                step.addSubModel(subModel); // Adding the line to the step.
                if(this.saveFileLines) {
                    step.fileLines.push(new LDR.Line1(subModel));
                }
            }
            else {
                texmapPlacement.fallback.addSubModel(subModel);
            }
            inHeader = false;
	    invertNext = false;
	    break;
	case 2: // Line "2 <colour> x1 y1 z1 x2 y2 z2"
	    p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));

            if(!inTexmapFallback) {
                step.addLine(colorID, p1, p2, texmapPlacement);
                if(this.saveFileLines) {
                    step.fileLines.push(new LDR.Line2(colorID, p1, p2, texmapPlacement));
                }
            }
            else {
                texmapPlacement.fallback.addLine(colorID, p1, p2, texmapPlacement);
            }
            inHeader = false;
	    invertNext = false;
	    break;
	case 3: // 3 <colour> x1 y1 z1 x2 y2 z2 x3 y3 z3
	    p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    p3 = new THREE.Vector3(parseFloat(parts[8]), parseFloat(parts[9]), parseFloat(parts[10]));
	    if(!part.certifiedBFC || !localCull) {
		step.cull = false; // Ensure no culling when step is handled.
            }

            if(!inTexmapFallback) {
                if(CCW === invertNext) {
                    step.addTrianglePoints(colorID, p3, p2, p1, texmapPlacement);
                }
                else {
                    step.addTrianglePoints(colorID, p1, p2, p3, texmapPlacement);
                }
                if(this.saveFileLines) {
                    step.fileLines.push(new LDR.Line3(colorID, p1, p2, p3, localCull, CCW !== invertNext, texmapPlacement));
                }
            }
            else {
                if(CCW === invertNext) {
                    texmapPlacement.fallback.addTrianglePoints(colorID, p3, p2, p1, texmapPlacement);
                }
                else {
                    texmapPlacement.fallback.addTrianglePoints(colorID, p1, p2, p3, texmapPlacement);
                }
            }

            inHeader = false;
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
            if(!inTexmapFallback) {
                if(CCW === invertNext) {
                    step.addQuadPoints(colorID, p4, p3, p2, p1, texmapPlacement);
                }
                else {
                    step.addQuadPoints(colorID, p1, p2, p3, p4, texmapPlacement);
                }
                if(this.saveFileLines) {
                    step.fileLines.push(new LDR.Line4(colorID, p1, p2, p3, p4, localCull, CCW !== invertNext, texmapPlacement));
                }
            }
            else {
                if(CCW === invertNext) {
                    texmapPlacement.fallback.addQuadPoints(colorID, p4, p3, p2, p1, texmapPlacement);
                }
                else {
                    texmapPlacement.fallback.addQuadPoints(colorID, p1, p2, p3, p4, texmapPlacement);
                }
            }
            inHeader = false;
	    invertNext = false;
	    break;
	case 5: // Conditional lines:
	    p1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
	    p2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
	    p3 = new THREE.Vector3(parseFloat(parts[8]), parseFloat(parts[9]), parseFloat(parts[10]));
	    p4 = new THREE.Vector3(parseFloat(parts[11]), parseFloat(parts[12]), parseFloat(parts[13]));

            if(!inTexmapFallback) {
                step.addConditionalLine(colorID, p1, p2, p3, p4, texmapPlacement);
                if(this.saveFileLines) {
                    step.fileLines.push(new LDR.Line5(colorID, p1, p2, p3, p4, texmapPlacement));
                }
            }
            else {
                texmapPlacement.fallback.addConditionalLine(colorID, p1, p2, p3, p4, texmapPlacement);
            }
            inHeader = false;
	    invertNext = false;
	    break;
        default:
            self.onWarning({message:'Unknown command "' + parts[1] + '" is ignored.', line:i, subModel:part});
            break;
	}
    }

    part.addStep(step);
    if(!part.ID) {
        part.ID = defaultID; // No name given in file.
        if(!this.mainModel) {
            this.mainModel = part.ID;
        }
    }
    if(!skipPart) {
        this.partTypes[part.ID] = part;
    }
    loadedParts.push(part);

    if(LDR.STUDIO) {
	loadedParts.forEach(part => LDR.STUDIO.handlePart(self, part));
    }

    this.onPartsLoaded(loadedParts);

    // Save loaded parts into IndexedDB:
    if(this.storage.db) {
	if(this.options.hasOwnProperty('key') && this.options.hasOwnProperty('timestamp')) {
            self.storage.saveInstructionsToStorage(self, self.options.key, self.options.timestamp);
	}
        self.storage.savePartsToStorage(loadedParts, self);
        // Do not call storage.db.close() as there might be other parts that should be saved.
    }

    // Load textures:
    this.loadTexmaps();

    //console.log(loadedParts.length + " LDraw file(s) read in " + (new Date()-parseStartTime) + "ms.");
};

THREE.LDRLoader.prototype.loadTexmaps = function() {
    let self = this;
    if(LDR.TexmapPlacements.length > 0) {
        if(!this.texmapLoader) {
            this.texmapLoader = new THREE.TextureLoader();
        }

        function setTexture(texture, file) {
            self.texmaps[file] = texture;
            self.texmapListeners[file].forEach(listener => listener(texture));
        }
        LDR.TexmapPlacements.forEach(tmp => {
                let file = tmp.file; // TODO: Can't currently handle glossmaps.
                if(!self.texmaps.hasOwnProperty(file)) {
                    self.texmaps[file] = true;
                    self.texmapListeners[file] = [];
                    self.texmapLoader.load(self.idToTextureUrl(file),
                                           t => setTexture(t, file),
                                           undefined,
                                           e => self.onError(e));
                }
            });
    }
}

THREE.LDRLoader.prototype.generate = function(colorID, mc, taskList) {
    this.loadTexmaps();

    let mainModel = this.getMainModel();

    // Place model in scene:
    let origo = new THREE.Vector3();
    let inv = new THREE.Matrix3();
    inv.set(1,0,0, 0,-1,0, 0,0,-1); // Invert Y, and Z-axis for LDraw
    
    // Generate the meshes:
    if(this.cleanUpPrimitivesAndSubParts) {
	mainModel.setReferencedFrom(this);
    }
    mainModel.generateThreePart(this, colorID, origo, inv, true, false, mc, null, taskList);
}

THREE.LDRLoader.prototype.onPartsLoaded = function(loadedParts) {
    let self = this;

    if(!loadedParts) {
	loadedParts = [];
	this.applyOnPartTypes(pt => loadedParts.push(pt));
    }
    
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

    // Set part info (part vs non-part):
    loadedParts.forEach(pt => pt.isPart = pt.computeIsPart(self));

    // Handle assemblies:
    if(this.options.buildAssemblies) {
	if(!this.assemblyManager) {
            this.assemblyManager = new LDR.AssemblyManager(this);
	}
	const am = this.assemblyManager;
	let handle = pt => { 
	    if(!pt.isPart) {
		pt.steps.forEach(s => am.handleStep(s).forEach(checkPart));
	    }
	};
	loadedParts.forEach(handle);
    }

    if(unloadedPartsList.length > 0) {
        self.loadMultiple(unloadedPartsList);
    }
}

THREE.LDRLoader.prototype.getPartType = function(id) {
    if(!this.partTypes.hasOwnProperty(id)) {
        let subModel;
	if(LDR.Generator && (subModel = LDR.Generator.make(id))) {
	    return this.partTypes[id] = subModel;
	}
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

    // Part types:
    let ret = this.partTypes[this.mainModel].toLDR(this);
    this.applyOnPartTypes(pt => {
            if(!(pt.inlined || pt.ID === self.mainModel || pt.isOfficialLDraw())) {
                ret += pt.toLDR(self);
            }
        });

    // Inline texmaps:
    const CHARACTERS_PER_LINE = 76;
    function outputDataUrl(id, mimetype, content) {
        ret += "0 FILE " + id + "\r\n";
        ret += "0 !DATA START\r\n";
        let lines = Math.ceil(content.length / CHARACTERS_PER_LINE);
        for(let i = 0; i < content.length; i += CHARACTERS_PER_LINE) {
            ret += "0 !:" + content.substr(i, CHARACTERS_PER_LINE) + "\r\n";
        }
        ret += "0 !DATA END\r\n\r\n";
    }
    this.texmapDataurls.forEach(obj => outputDataUrl(obj.id, obj.mimetype, obj.content));

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

THREE.LDRLoader.prototype.unpack = function(obj) {
    let self = this;

    let names = obj['names'].split('¤');

    let parts = [];
    this.mainModel = names[0];

    let arrayI = obj['i'];
    let arrayF = obj['f'];
    let arrayS = obj['s'].split('¤');
    let idxI = 0, idxF = 0, idxS = 0;

    // Unpack texmaps:
    let numberOfTexmaps = arrayI[idxI++];
    for(let i = 0; i < numberOfTexmaps; i++) {
        let tmp = new LDR.TexmapPlacement();
        [idxI, idxF, idxS] = tmp.unpackFrom(arrayI, arrayF, arrayS, idxI, idxF, idxS, names, self.saveFileLines);
        if(tmp.idx !== LDR.TexmapPlacements.length) {
            console.error('Indexing error on packed texmap. Expected ' + LDR.TexmapPlacements.length + ', found ' + tmp.idx);
        }
        LDR.TexmapPlacements.push(tmp);
    }

    // Unpack inline textures:
    let numberOfDataurls = arrayI[idxI++];
    for(let i = 0; i < numberOfDataurls; i++) {
        let id = arrayS[idxS++];
        let mimetype = arrayS[idxS++];
        let content = arrayS[idxS++];
        self.texmapDataurls.push({id:id, mimetype:mimetype, content:content});
        
        self.texmaps[id] = true;
        self.texmapListeners[id] = [];
        let image = new Image();
        image.onload = function(e) {
            let texture = new THREE.Texture(this);
            texture.needsUpdate = true;
            self.texmaps[id] = texture;
            self.texmapListeners[id].forEach(l => l(texture));
            self.onProgress(id);
        };
        let dataurl = 'data:image/' + mimetype + ';base64,' + content;
        image.src = dataurl;
    }

    // Unpack all non-parts:
    names.forEach((name, i) => {
	let numSteps = arrayI[idxI++];
	if(numSteps === 0) {
	    parts.push(name);
	    return; // Packable part to be loaded normally.
	}

	let pt = new THREE.LDRPartType();
	pt.ID = pt.name = name;
	pt.cleanSteps = true;

	for(let j = 0; j < numSteps; j++) {
	    let step = new THREE.LDRStep();
	    [idxI, idxF] = step.unpackFrom(arrayI, arrayF, idxI, idxF, names, LDR.TexmapPlacements, self.saveFileLines);

	    // Handle rotation:
	    let r = arrayI[idxI++];
	    if(r) {
		step.rotation = new THREE.LDRStepRotation(arrayF[idxF++], arrayF[idxF++], arrayF[idxF++], r === 1 ? 'ABS' : 'REL');
	    }

	    pt.steps.push(step);	    
	}

	if(obj.hasOwnProperty('d'+i)) {
            pt.modelDescription = obj['d'+i];
        }
	if(obj.hasOwnProperty('n'+i)) {
	    let inlined = obj['n'+i];
	    pt.inlined = (inlined === -1) ? 'UNOFFICIAL' : inlined;
	}
        if(obj.hasOwnProperty('e'+i)) {
            let encoded = obj['e' + i];
            pt.certifiedBFC = encoded % 2 === 1;
            pt.CCW = Math.floor(encoded/2) % 2 === 1;
        }        

	self.partTypes[name] = pt;
    });

    this.onPartsLoaded();
    this.loadTexmaps();

    return parts;
}

THREE.LDRLoader.prototype.pack = function() {
    let self = this;
    let mainModel = this.getMainModel();

    // First find all parts mentioned in those that will be packed:
    let nameMap = {}; 
    nameMap[mainModel.ID] = 0;
    let names = [mainModel.ID];
    function scanName(id) {
	if(nameMap.hasOwnProperty(id)) {
	    return; // Already handled.
	}
	nameMap[id] = names.length;
	names.push(id);
	let pt = self.getPartType(id);
	if(!pt) {
	    throw 'Unknown part type ' + id;
	}
	if(!pt.canBePacked()) { // Only parts are packed.
	    scanNames(pt);
	}
    }
    function scanNames(pt) {
	pt.steps.forEach(step => step.subModels.forEach(sm => scanName(sm.ID)));
    }
    scanNames(mainModel);

    let ret = {names:names.join('¤')};
    let arrayF = [], arrayI = [], arrayS = [];

    // Pack texmaps:
    arrayI.push(LDR.TexmapPlacements.length);
    LDR.TexmapPlacements.forEach(tmp => tmp.packInto(arrayF, arrayI, arrayS, nameMap));
    
    // Pack dataurls:
    arrayI.push(this.texmapDataurls.length);
    this.texmapDataurls.forEach(x => arrayS.push(x.id, x.mimetype, x.content));

    // Pack everything which could not be packed as parts:
    names.forEach((id, idx) => {
	let pt = self.getPartType(id);
	if(pt.canBePacked() || pt.inlined === 'GENERATED') {
	    arrayI.push(0); // 0 steps to indicate that it should be skipped.
	    return;
	}

	arrayI.push(pt.steps.length);

	pt.steps.forEach(step => {
            step.packInto(arrayF, arrayI, nameMap);

	    // Also handle rotation:
	    if(step.rotation) {
		let r = step.rotation;
		arrayI.push(r === 'ABS' ? 1 : 2);
		arrayF.push(r.x, r.y, r.z);
	    }
	    else {
		arrayI.push(0);
	    }
	});
	
	if(pt.isPart) {
            console.dir(pt);
            if(pt.modelDescription) {
                ret['d' + idx] = pt.modelDescription;
            }
            if(pt.inlined) {
                ret['n' + idx] = (pt.inlined === 'UNOFFICIAL' ? -1 : pt.inlined);
            }
            ret['e' + idx] = (pt.CCW ? 2 : 0) + (pt.certifiedBFC ? 1 : 0);
	}
    });

    if(arrayI.some(val => val > 32767)) {
	ret['i'] = new Int32Array(arrayI);
    }
    else {
	ret['i'] = new Int16Array(arrayI);
    }
    ret['f'] = new Float32Array(arrayF);
    ret['s'] = arrayS.join('¤');

    return ret;
}

/*
  Part description: a part (ID) placed (position, rotation) with a
  given color (16/24 allowed) and invertCCW to allow for sub-parts in DAT-parts.
*/
THREE.LDRPartDescription = function(colorID, position, rotation, ID, cull, invertCCW, texmapPlacement) {
    this.colorID = colorID; // LDraw ID. Negative values indicate edge colors - see top description.
    this.position = position; // Vector3
    this.rotation = rotation; // Matrix3
    this.ID = ID.toLowerCase(); // part.dat lowercase
    this.cull = cull;
    this.invertCCW = invertCCW;
    this.texmapPlacement = texmapPlacement;
    this.ghost;
    this.original; // If this PD is a colored clone of an original PD.
    texmapPlacement && texmapPlacement.use();
}

THREE.LDRPartDescription.prototype.cloneColored = function(colorID) {
    if(this.original) {
	console.dir(this);
	throw "Cloning non-original PD to color " + colorID;
    }
    let c = this.colorID;
    if(this.colorID === 16) {
	c = colorID;
    }
    else if(this.colorID === 24) {
	c = -colorID-1;
    }
    let ret = new THREE.LDRPartDescription(c, this.position, this.rotation, this.ID,
					   this.cull, this.invertCCW, this.texmapPlacement);
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
        colorID = (pdColorID === 16) ? 24 : pdColorID; // Ensure color 24 is propagated correctly when placed for main color (16).
    }
    return colorID;
}

THREE.LDRPartDescription.prototype.toLDR = function(loader) {
    let pt = loader.getPartType(this.ID);
    return '1 ' + this.colorID + ' ' + this.position.toLDR() + ' ' + this.rotation.toLDR() + ' ' + pt.ID + '\r\n';
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

    return new THREE.LDRPartDescription(colorID, position, rotation, this.ID, this.cull, invert, this.texmapPlacement);
}

THREE.LDRStepRotation = function(x, y, z, type) {
    this.x = parseFloat(x);
    this.y = parseFloat(y);
    this.z = parseFloat(z);
    this.type = type.toUpperCase();
}

THREE.LDRStepRotation.equals = function(a, b) {
    let aNull = !a;
    let bNull = !b;
    if(aNull && bNull) {
	return true;
    }
    if(aNull !== bNull) {
	if(!aNull) {
	    return a.isDefault();
	}
	if(!bNull) {
	    return b.isDefault();
	}
	return false;
    }
    return (a.x === b.x) && (a.y === b.y) && (a.z === b.z) && (a.type === b.type);
}

THREE.LDRStepRotation.prototype.isDefault = function() {
    return this.type === 'REL' && this.x === 0 && this.y === 0 && this.z === 0;
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
    this.triangles = []; // {colorID, p1, p2, p3, texmapPlacement}
    this.quads = []; // {colorID, p1, p2, p3, p4, texmapPlacement}
    this.rotation = null;
    this.cull = true;
    this.cnt = -1;
    this.fileLines = [];
    this.original;
}

THREE.LDRStep.prototype.pack = function(obj) {
    let arrayF = [];
    let arrayI = [];
    let arrayS = [];
    
    // SubModels:
    let subModelMap = {};
    let subModelList = [];
    function mapSubModel(sm) {
        let id = sm.ID;
        if(!subModelMap.hasOwnProperty(id)) {
            subModelMap[id] = subModelList.length;
	    let shortID = id.substring(0, id.length-4);
            subModelList.push(shortID);
        }
    }
    this.subModels.forEach(mapSubModel);

    // Texmaps:
    let texmapPlacements = {}; // idx values of texmaps
    let numberOfTexmapPlacements = this.getTexmapPlacements(texmapPlacements);
    arrayI.push(numberOfTexmapPlacements);

    for(let idx in texmapPlacements) {
        if(texmapPlacements.hasOwnProperty(idx)) {
            texmapPlacements[idx].fallback.subModels.forEach(mapSubModel);
        }
    }
    for(let idx in texmapPlacements) {
        if(texmapPlacements.hasOwnProperty(idx)) {
            texmapPlacements[idx].packInto(arrayF, arrayI, arrayS, subModelMap);
        }
    }

    if(arrayS.length > 0) {
        obj.sx = arrayS.join('|'); // Files for texmaps.
    }
    if(subModelList.length > 0) {
        obj.sp = subModelList.join('|'); // All sub models, including those for fallback geometries.
    }
    
    this.packInto(arrayF, arrayI, subModelMap);
    
    if(arrayI.some(val => val > 32767)) {
        obj.ai = new Int32Array(arrayI);
    }
    else {
        obj.ai = new Int16Array(arrayI);
    }
    obj.af = new Float32Array(arrayF);
}

THREE.LDRStep.prototype.packInto = function(arrayF, arrayI, subModelMap) {
    arrayI.push(this.cull ? 1 : 0);

    arrayI.push(this.subModels.length);
    function handleSubModel(sm) {
        if(!subModelMap.hasOwnProperty(sm.ID)) {
            console.dir(subModelMap);
            throw "Unknown sub model " + sm.ID + ' not in map!';
        }
        arrayI.push(sm.colorID);
        arrayI.push(sm.texmapPlacement ? sm.texmapPlacement.idx : -1);        
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
                arrayI.push(x.texmapPlacement ? x.texmapPlacement.idx : -1);
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
    handle(this.triangles, 3);
    handle(this.quads, 4);
    handle(this.conditionalLines, 4);
}

THREE.LDRStep.prototype.unpack = function(obj, saveFileLines) {
    let arrayI = obj.ai;
    let arrayF = obj.af;
    let arrayS = obj.sx ? obj.sx.split('|') : []; // texmap files.
    let subModelList = obj.sp ? obj.sp.split('|').map(x => x += '.dat') : [];

    // Texmaps:
    let idxI = 0, idxF = 0, idxS = 0;

    let numberOfTexmapPlacements = arrayI[idxI++];
    let texmapPlacementMap = {};
    for(let i = 0; i < numberOfTexmapPlacements; i++) {
        let texmapPlacement = new LDR.TexmapPlacement();
        [idxI, idxF, idxS] = texmapPlacement.unpackFrom(arrayI, arrayF, arrayS, idxI, idxF, idxS, subModelList, saveFileLines);
        texmapPlacementMap[texmapPlacement.idx] = texmapPlacement;
        // Map back into global LDR.TexmapPlacements:
        texmapPlacement.idx = LDR.TexmapPlacements.length;
        LDR.TexmapPlacements.push(texmapPlacement);
    }

    this.unpackFrom(arrayI, arrayF, idxI, idxF, subModelList, texmapPlacementMap, saveFileLines);
}

THREE.LDRStep.prototype.unpackFrom = function(arrayI, arrayF, idxI, idxF, subModelList, texmapPlacementMap, saveFileLines) {
    let self = this;
    this.cull = arrayI[idxI++] === 1;

    // Sub Models:
    let numSubModels = arrayI[idxI++];
    for(let i = 0; i < numSubModels; i++) {
        let colorID = arrayI[idxI++];
        let texmapIdx = arrayI[idxI++];
        var texmapPlacement = texmapIdx >= 0 ? texmapPlacementMap[texmapIdx] : null;
        let packed = arrayI[idxI++];
        let cull = (packed % 2 === 1);
	packed -= cull ? 1 : 0;
        let invertCCW = (Math.floor(packed/2) % 2) === 1;
	packed -= invertCCW ? 2 : 0;
        let ID = subModelList[packed/4];

        let position = new THREE.Vector3(arrayF[idxF++], arrayF[idxF++], arrayF[idxF++]);
        let rotation = new THREE.Matrix3();
        rotation.set(arrayF[idxF++], arrayF[idxF++], arrayF[idxF++], 
                     arrayF[idxF++], arrayF[idxF++], arrayF[idxF++],
                     arrayF[idxF++], arrayF[idxF++], arrayF[idxF++]);
        let subModel = new THREE.LDRPartDescription(colorID, position, rotation, ID, cull, invertCCW, texmapPlacement);
        this.addSubModel(subModel);
        if(saveFileLines) {
            this.fileLines.push(new LDR.Line1(subModel));
        }
    }

    // Primitives:
    function handle(size, makeLine) {
        let ret = [];
        let numPrimitives = arrayI[idxI++];
        for(let i = 0; i < numPrimitives; i++) {
            let p = {colorID: arrayI[idxI++]};

            let texmapIdx = arrayI[idxI++];
            if(texmapIdx >= 0) {
                p.texmapPlacement = texmapPlacementMap[texmapIdx];
            }

            p.p1 = new THREE.Vector3(arrayF[idxF++], arrayF[idxF++], arrayF[idxF++]);
            p.p2 = new THREE.Vector3(arrayF[idxF++], arrayF[idxF++], arrayF[idxF++]);
            if(size > 2) {
                p.p3 = new THREE.Vector3(arrayF[idxF++], arrayF[idxF++], arrayF[idxF++]);
            }
            if(size > 3) {
                p.p4 = new THREE.Vector3(arrayF[idxF++], arrayF[idxF++], arrayF[idxF++]);
            }
            ret.push(p);
            if(saveFileLines) {
                self.fileLines.push(makeLine(p.colorID, p.p1, p.p2, p.p3, p.p4, true, true, p.texmapPlacement));
            }
        }
        return ret;
    }
    this.lines = handle(2, (c, p1, p2, p3, p4, cull, ccw, tmp) => new LDR.Line2(c, p1, p2, tmp));
    this.triangles = handle(3, (c, p1, p2, p3, p4, cull, ccw, tmp) => new LDR.Line3(c, p1, p2, p3, cull, ccw, tmp));
    this.quads = handle(4, (c, p1, p2, p3, p4, cull, ccw, tmp) => new LDR.Line4(c, p1, p2, p3, p4, cull, ccw, tmp));
    this.conditionalLines = handle(4, (c, p1, p2, p3, p4, cull, ccw, tmp) => new LDR.Line5(c, p1, p2, p3, p4, tmp));

    this.hasPrimitives = this.lines.length > 0 || this.conditionalLines.length > 0 || this.triangles.length > 0 || this.quads.length > 0;

    return [idxI, idxF];
}

// Count the number of unique texmap placements in the step. Placements are added to the 'seen' map.
THREE.LDRStep.prototype.getTexmapPlacements = function(seen) {
    let ret = 0;
    function handle(p) {
        if(!p.texmapPlacement) {
            return;
        }
        let idx = p.texmapPlacement.idx;
        if(seen.hasOwnProperty(idx)) {
            return;
        }
        seen[idx] = p.texmapPlacement;
        ret++;
    }
    this.subModels.forEach(handle);
    this.triangles.forEach(handle);
    this.quads.forEach(handle);

    return ret;
}

THREE.LDRStep.prototype.cloneColored = function(colorID) {
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

    // First handle texmaps as they often have to be fixed with proper prefixes:
    let tmpMap = {}; // idx -> lines.
    function check(line) {
        let tmp = line.line1 ? line.desc.texmapPlacement : line.tmp;
        if(!tmp){
            return;
        }
        let idx = tmp.idx;
        if(!tmpMap.hasOwnProperty(idx)) {
            tmpMap[idx] = [];
        }
        tmpMap[idx].push(line);
    }
    this.fileLines.forEach(check);
    for(let idx in tmpMap) {
        if(tmpMap.hasOwnProperty(idx)) {
            let lines = tmpMap[idx];
            ret += LDR.TexmapPlacements[idx].toLDR(lines, loader);        
        }
    }

    // Now handle normal lines:
    function outputLine(line) {
        if(line.line1 && line.desc.texmapPlacement || line.tmp) {
            return; // Already output for texmap above.
        }
        ret += line.toLDR(loader);
    }
    this.fileLines.forEach(outputLine);

    // End with STEP or ROTSTEP:
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

THREE.LDRStep.prototype.addLine = function(c, p1, p2, texmapPlacement) {
    this.hasPrimitives = true;
    this.lines.push({colorID:c, p1:p1, p2:p2});
    texmapPlacement && texmapPlacement.use();
}

THREE.LDRStep.prototype.addTrianglePoints = function(c, p1, p2, p3, texmapPlacement) {
    this.hasPrimitives = true;
    this.triangles.push({colorID:c, p1:p1, p2:p2, p3:p3, texmapPlacement:texmapPlacement});
    texmapPlacement && texmapPlacement.use();
}

THREE.LDRStep.prototype.addQuadPoints = function(c, p1, p2, p3, p4, texmapPlacement) {
    this.hasPrimitives = true;
    this.quads.push({colorID:c, p1:p1, p2:p2, p3:p3, p4:p4, texmapPlacement:texmapPlacement});
    texmapPlacement && texmapPlacement.use();
}

THREE.LDRStep.prototype.addConditionalLine = function(c, p1, p2, p3, p4, texmapPlacement) {
    this.hasPrimitives = true;
    this.conditionalLines.push({colorID:c, p1:p1, p2:p2, p3:p3, p4:p4});
    texmapPlacement && texmapPlacement.use();    
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
    return !(!firstSubModel || firstSubModel.isPart);
}

THREE.LDRStep.prototype.containsPartSubModels = function(loader) {
    if(this.subModels.length === 0) {
        return false;
    }
    let firstSubModel = loader.getPartType(this.subModels[0].ID);
    return firstSubModel.isPart;
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
        if(pt.isPart) {
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
        if(!subModel || subModel.isPart) {
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

THREE.LDRStep.prototype.generateThreePart = function(loader, colorID, position, rotation, cull, invertCCW, mc, taskList) {
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
	subModel.generateThreePart(loader, subModelColor, nextPosition, nextRotation, subModelCull, subModelInversion, mc, subModelDesc, taskList);
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

LDR.Line2 = function(c, p1, p2, tmp) {
    this.c = c;
    this.p1 = p1;
    this.p2 = p2;
    this.tmp = tmp;
    this.line2 = true;
}

LDR.Line2.prototype.toLDR = function() {
    return '2 ' + this.c + ' ' + this.p1.toLDR() + ' ' + this.p2.toLDR() + '\r\n';
}

LDR.Line3 = function(c, p1, p2, p3, cull, ccw, tmp) {
    this.c = c;
    this.p1 = p1;
    this.p2 = p2;
    this.p3 = p3;
    this.cull = cull;
    this.ccw = ccw;
    this.tmp = tmp;
    this.line3 = true;
}

LDR.Line3.prototype.toLDR = function() {
    return '3 ' + this.c + ' ' + this.p1.toLDR() + ' ' + this.p2.toLDR() + ' ' + this.p3.toLDR() + '\r\n';
}

LDR.Line4 = function(c, p1, p2, p3, p4, cull, ccw, tmp) {
    this.c = c;
    this.p1 = p1;
    this.p2 = p2;
    this.p3 = p3;
    this.p4 = p4;
    this.cull = cull;
    this.ccw = ccw;
    this.tmp = tmp;
    this.line4 = true;
}

LDR.Line4.prototype.toLDR = function() {
    return '4 ' + this.c + ' ' + this.p1.toLDR() + ' ' + this.p2.toLDR() + ' ' + this.p3.toLDR() + ' ' + this.p4.toLDR() + '\r\n';
}

LDR.Line5 = function(c, p1, p2, p3, p4, tmp) {
    this.c = c;
    this.p1 = p1;
    this.p2 = p2;
    this.p3 = p3;
    this.p4 = p4;
    this.tmp = tmp;
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

    // To support early cleanup:
    this.referencedFrom = {};
    this.references = 0;
}

THREE.LDRPartType.prototype.setReferencedFrom = function(ldrLoader) {
    let self = this;
    function handle(sm) {
	let pt = ldrLoader.getPartType(sm.ID);
	if(!pt.referencedFrom.hasOwnProperty(self.ID)) {
	    pt.referencedFrom[self.ID] = true;
	    pt.references++;
	}
    }
    this.steps.forEach(step => step.subModels.forEach(handle));
}

THREE.LDRPartType.prototype.canBePacked = function() {
    return (!this.inlined || (this.inlined === 'OFFICIAL')) && // Only pack official parts (not 'GENERATED' (from LDRGenerator) or 'IDB' (unpacked from IndexedDB).
           this.isPart && // Should be a part.
           this.license === 'Redistributable under CCAL version 2.0 : see CAreadme.txt' &&
	   this.ldraw_org && // And an LDRAW_ORG statement.
           !this.ldraw_org.startsWith('Unofficial_'); // Double-check that it is official.
}

THREE.LDRPartType.prototype.pack = function(loader) {
    let ret = {};
    let id = this.ID;
    if(id.endsWith('.dat')) {
        id = id.substring(0, id.length-4);
    }
    ret.ID = id;

    let step0 = this.steps[0];
    step0.pack(ret);
    // Ignore headers and history to save space.
    ret.md = this.modelDescription;
    ret.e = (this.CCW ? 2 : 0) + (this.certifiedBFC ? 1 : 0);
    ret.d = this.ldraw_org;

    return ret;
}

THREE.LDRPartType.prototype.unpack = function(obj, saveFileLines) {
    this.ID = this.name = obj.ID + '.dat';
    this.modelDescription = obj.md;
    let step = new THREE.LDRStep();
    step.unpack(obj, saveFileLines);
    this.steps = [step];
    this.certifiedBFC = obj.e % 2 === 1;
    this.CCW = Math.floor(obj.e/2) % 2 === 1;
    this.inlined = 'IDB';
    this.isPart = true;
    this.ldraw_org = obj.d;
}

THREE.LDRPartType.prototype.purgePart = function(loader, ID) {
    if(this.isPart) {
        return;
    }
    function handleStep(step) {
        step.subModels = step.subModels.filter(sm => sm.ID !== ID);
        if(step.subModels.length === 0) {
            step.RM = true;
        }
        else {
            step.subModels.forEach(sm => loader.getPartType(sm.ID).purgePart(loader, ID));
        }
    }
    this.steps.forEach(handleStep);
    this.steps = this.steps.filter(step => !step.RM);
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
	if(this.replacement !== 'box.dat') { // Being replaced by box.dat indicates unknown part substitution, so warning has already been raised.
	    loader.onWarning({message:'The part "' + this.ID + '" has been replaced by "' + this.replacement + '".', line:0, subModel:this});
	}
    }
    else {
	let newSteps = [];
	this.steps.forEach(step => step.cleanUp(loader, newSteps));
	if(newSteps.length === 0) { // Empty!
	    loader.getMainModel().purgePart(loader, this.ID);
	    return;
	}
	this.steps = newSteps;
    }

    this.cleanSteps = true;
}

THREE.LDRPartType.prototype.toLDR = function(loader) {
    let ret = '0 FILE ' + this.ID + '\r\n';
    if(this.modelDescription) {
        ret += '0 ' + this.modelDescription + '\r\n';
    }
    if(this.name) {
	ret += '0 Name: ' + this.name + '\r\n';
    }
    if(this.author) {
        ret += '0 Author: ' + this.author + '\r\n';
    }
    if(this.ldraw_org) {
        ret += '0 !LDRAW_ORG ' + this.ldraw_org + '\r\n';
    }
    if(this.license) {
        ret += '0 !LICENSE ' + this.license + '\r\n';
    }
    if(this.isPart) { // BFC Statement:
        if(!this.certifiedBFC) {
            ret += '0 BFC NOCERTIFY\r\n';            
        }
        else {
            ret += '0 BFC CERTIFY ' + (this.CCW ? 'CCW' : 'CW') + '\r\n';
        }
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
    if(loader.cleanUpPrimitivesAndSubParts) {
	this.removePrimitivesAndSubParts(loader);
    }
}

THREE.LDRPartType.prototype.removePrimitivesAndSubParts = function(loader, parentID) {
    if(!this.steps) {
	return; // When called multiple times from the final part.
    }
    if(parentID) {
	if(this.referencedFrom.hasOwnProperty(parentID)) {
	    delete this.referencedFrom[parentID];
	    this.references--;
	}
    }

    // Propagate:
    let ID = this.ID;
    function handleSM(sm) {
	let pt = loader.getPartType(sm.ID);
	pt.removePrimitivesAndSubParts(loader, ID);
    }
    this.steps.forEach(step => step.subModels && step.subModels.forEach(handleSM));

    // Perform cleanup only if no references left:
    if(this.references === 0) {
	delete this.steps;
    }
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
    
THREE.LDRPartType.prototype.generateThreePart = function(loader, c, p, r, cull, inv, mc, pd, taskList) {
    if(!this.geometry) {
	if(this.isPart) {
            if(taskList) {
                let self = this;
                taskList.push(() => self.generateThreePart(loader, c, p, r, cull, inv, mc, pd));
                mc.expandBoundingBoxByPoint(p); // Assumes p is within the part.
                return;
            }
            else {
                this.ensureGeometry(loader);
            }
	}
	else {
            this.steps.forEach(step => step.generateThreePart(loader, c, p, r, cull, inv, mc, taskList));
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
    
    if(loader.physicalRenderingAge === 0) { // Simple rendering:
        if(this.geometry.triangleGeometries.hasOwnProperty(16)) { // Normal triangle geometry:
            let material = new LDR.Colors.buildTriangleMaterial(this.geometry.triangleColorManager, c, false);
            let mesh = new THREE.Mesh(this.geometry.triangleGeometries[16].clone(), material); // Using clone to ensure matrix in next line doesn't affect other usages of the geometry..
            mesh.geometry.applyMatrix(m4);
            //mesh.applyMatrix(m4); // Doesn't work for LDraw library as the matrix needs to be decomposable to position, quaternion and scale.
            if(LDR.Colors.isTrans(c)) {
                mc.addTrans(mesh, pd);
            }
            else {
                mc.addOpaque(mesh, pd);
            }            
        }
    }
    else { // Physical rendering:
        for(let tc in this.geometry.triangleGeometries) {
            if(!this.geometry.triangleGeometries.hasOwnProperty(tc)) {
                continue;
            }
            let g = this.geometry.triangleGeometries[tc];

            let shownColor = tc === '16' ? c : tc;
            let material = LDR.Colors.buildStandardMaterial(shownColor);
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

    let self = this;
    for(let idx in this.geometry.texmapGeometries) { // Texmap geometries:
        if(!this.geometry.texmapGeometries.hasOwnProperty(idx)) {
            continue;
        }
        this.geometry.texmapGeometries[idx].forEach(obj => {
                let g = obj.geometry, c2 = obj.colorID;
                let c3 = c2 === '16' ? c : c2;
                let textureFile = LDR.TexmapPlacements[idx].file;

                let material;
                let buildMaterial, setMap;
                if(loader.physicalRenderingAge === 0 || !true) {
                    buildMaterial = t => LDR.Colors.buildTriangleMaterial(self.geometry.triangleColorManager, c3, t);
                    setMap = t => material.uniforms.map = {type:'t',value:t};
                }
                else {
                    buildMaterial = t => LDR.Colors.buildStandardMaterial(c3, t);
                    setMap = t => material.map = t;
                }

                if(loader.texmaps[textureFile] === true) {
                    material = buildMaterial(true);
                    function setTexmap(t) {
                        setMap(t);
                        material.needsUpdate = true;
                        loader.onProgress(textureFile);
                    }
                    loader.texmapListeners[textureFile].push(setTexmap);
                }
                else {
                    let texture = loader.texmaps[textureFile];
                    material = buildMaterial(texture);
                }

                let mesh = new THREE.Mesh(g.clone(), material);
                mesh.geometry.applyMatrix(m4);
                if(LDR.Colors.isTrans(c3)) {
                    mc.addTrans(mesh, pd);
                }
                else {
                    mc.addOpaque(mesh, pd);
                }
            });
    }


    let b = this.geometry.boundingBox;
    mc.expandBoundingBox(b, m4);
}
    
THREE.LDRPartType.prototype.isPrimitive = function() {
    if(!this.ldraw_ord) {
        return false;
    }
    let lo = this.ldraw_org.split(' ')[0]; // First token.
    return lo === 'Primitive' || lo === 'Subpart' || lo === '8_Primitive' || lo === '48_Primitive';
}

THREE.LDRPartType.prototype.computeIsPart = function(loader) {
    // Simple checks:
    if(this.steps.length !== 1) {
        return false; // No steps in parts.
    }
    let s = this.steps[0];
    if(s.hasPrimitives) {
        return true; // Contains line, triangle or quad primitives.
    }

    // LDRAW_ORG checks:
    if(this.isOfficialLDraw()) {
        return true;
    }
    
    // Check sub-models. If any is a primitive or subpart, then this is a part:
    for(let i = 0; i < s.subModels.length; i++) {
        let t = loader.getPartType(s.subModels[i].ID);
	if(t) {
            if(t.isPrimitive()) {
                return true;
            }
            if(t.steps.length !== 1) {
                return false; // Sub model is not a part.
            }
        }
    }

    return this.ID.endsWith('.dat'); // Unsafe check as some old models used 'dat' for non-parts, but what can we do?
}

// Official LDraw part types: https://www.ldraw.org/article/398.html
THREE.LDRPartType.prototype.isOfficialLDraw = function() {
    if(!this.ldraw_org) {
        return false;
    }
    let lo = this.ldraw_org.split(' ')[0]; // First token.
    return lo === 'Part' || lo === 'Primitive' || lo === 'Subpart' || 
           lo === '8_Primitive' || lo === '48_Primitive' || lo === 'Shortcut';
}

THREE.LDRPartType.prototype.isReplacedPart = function() {
    if(!this.isPart) {
	return false; // Not a part
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
    if(this.cnt >= 0 || this.isPart) {
	return this.cnt;
    }
    this.cnt = this.steps.map(step => step.countParts(loader)).reduce((a,b)=>a+b, 0);
    return this.cnt;
}

/*
  0 !TEXMAP (START | NEXT) <method> <parameters> <pngfile> [GLOSSMAP pngfile]
 */
LDR.TexmapPlacements = [];
LDR.TexmapPlacement = function() { // Can be set either from parts when read from LDraw file, or from packed indexeddb object.
    this.type; // 0 = planar, 1 = cylindrical, 2 = spherical.
    this.p = [];

    //this.a;
    //this.b;
    this.file;
    //this.glossmapFile;
    this.fallback = new THREE.LDRStep();

    //this.nextOnly;
    //this.used = false; // If this texmap placement is of type 'NEXT' then it can only be used for one line below.
    //this.error; // Set if error during initialization.
    this.idx; // Index in LDR.TexmapPlacements
}

LDR.TexmapPlacement.prototype.setFromParts = function(parts) {
    if(parts.length < 13) {
        this.error = 'Too few arguments on !TEXMAP line';
        return;
    }
    if(parts[2] === 'START') {
        // OK
    }
    else if(parts[2] === 'NEXT') {
        this.nextOnly = true;
    }
    else {
        this.error = 'Unexpected first !TEXMAP command';
        return;
    }

    let idx = 4;
    for(let i = 0; i < 3; i++) {
        this.p.push(new THREE.Vector3(parseFloat(parts[idx++]), parseFloat(parts[idx++]), parseFloat(parts[idx++])));
    }

    if(parts[3] === 'PLANAR') {
        this.setPlanar();
    }
    else if(parts[3] === 'CYLINDRICAL' && parts.length > 13) {
        this.a = parseFloat(parts[idx++]) * Math.PI / 180;
        this.setCylindrical();
    }
    else if(parts[3] === 'SPHERICAL' && parts.length > 14) {
        this.a = parseFloat(parts[idx++]) * Math.PI / 180;
        this.b = parseFloat(parts[idx++]) * Math.PI / 180;
        this.setSpherical();
    }
    else {
        this.error = 'Unexpected method in !TEXMAP command or not enough parameters';
        return;
    }

    this.file = parts[idx];
    if(parts[parts.length-2] === 'GLOSSMAP') {
        this.glossmapFile = parts[idx+2];
    }

    this.idx = LDR.TexmapPlacements.length;
    LDR.TexmapPlacements.push(this);
}

LDR.TexmapPlacement.prototype.use = function() {
    if(this.nextOnly) {
        this.used = true;
    }
}

LDR.TexmapPlacement.prototype.setPlanar = function() {
    this.type = 0; // 0 for planar.

    // Normal and lenth squared for plane P1:
    this.N1 = new THREE.Vector3(); this.N1.subVectors(this.p[1], this.p[0]);
    this.N1LenSq = this.N1.lengthSq();
    this.D1 = -this.N1.dot(this.p[1]);
    
    // Normal and lenth squared for plane P2:
    this.N2 = new THREE.Vector3(); this.N2.subVectors(this.p[2], this.p[0]);
    this.N2LenSq = this.N2.lengthSq();
    this.D2 = -this.N2.dot(this.p[2]);
    
    this.getUV = this.getUVPlanar;
}

LDR.TexmapPlacement.prototype.setCylindrical = function() {
    this.type = 1; // 1 for cylindrical.

    this.n = new THREE.Vector3(); this.n.subVectors(this.p[1], this.p[0]);
    this.nLen = this.n.length();
    this.n.normalize();
    this.D = -this.n.dot(this.p[1]);

    let p3 = this.projectPointToPlane(this.n, this.p[0], this.p[2]);
    this.m = new THREE.Vector3(); this.m.subVectors(p3, this.p[0]);

    this.getUV = this.getUVCylindrical;
}

LDR.TexmapPlacement.prototype.setSpherical = function() {
    this.type = 2; // 2 for spherical.

    // n = p1p2
    this.n = new THREE.Vector3(); this.n.subVectors(this.p[1], this.p[0]);
    this.m = new THREE.Vector3(); this.m.subVectors(this.p[2], this.p[0]);
    // N1 = Normal of P1:
    this.N1 = new THREE.Vector3(); this.N1.crossVectors(this.n, this.m); this.N1.normalize();
    this.D = -this.N1.dot(this.p[0]);
    // N2 = Normal of P2:
    //this.N2 = new THREE.Vector3(); this.N2.crossVectors(this.n, this.N1); this.N2.normalize();
    
    this.getUV = this.getUVSpherical;
}

LDR.TexmapPlacement.prototype.packInto = function(arrayF, arrayI, arrayS, subModelMap) {
    arrayI.push(this.idx, this.type);
    this.p.forEach(pt => arrayF.push(pt.x, pt.y, pt.z));
    if(this.type > 0) {
        arrayF.push(this.a);
    }
    if(this.type > 1) {
        arrayF.push(this.b);
    }

    // Files:
    if(this.glossmapFile) {
        arrayI.push(2);
        arrayS.push(this.glossmapFile);
        arrayS.push(this.file);
    }
    else {
        arrayI.push(1);
        arrayS.push(this.file);
    }

    this.fallback.packInto(arrayF, arrayI, subModelMap);
}

LDR.TexmapPlacement.prototype.unpackFrom = function(arrayI, arrayF, arrayS, idxI, idxF, idxS, subModelList, saveFileLines) {
    this.idx = arrayI[idxI++];
    this.type = arrayI[idxI++];
    for(let i = 0; i < 3; i++) {
        this.p.push(new THREE.Vector3(arrayF[idxF++], arrayF[idxF++], arrayF[idxF++]));
    }

    if(this.type > 0) {
        this.a = arrayF[idxF++];
    }
    if(this.type > 1) {
        this.b = arrayF[idxF++];
    }

    let hasGlossmap = arrayI[idxI++] === 2;
    if(hasGlossmap) {
        this.glossmapFile = arrayS[idxS++];
    }
    this.file = arrayS[idxS++];

    if(this.type === 0) {
        this.setPlanar();
    }
    else if(this.type === 1) {
        this.setCylindrical();
    }
    else {
        this.setSpherical();
    }

    [idxI, idxF] = this.fallback.unpackFrom(arrayI, arrayF, idxI, idxF, subModelList, {}, saveFileLines);

    return [idxI, idxF, idxS];
}

// Plane with normal n and p0 being a point on the plane. p is the point to project.
// q = p - (n * (p-p0))*n. q is projected point.
LDR.TexmapPlacement.prototype.projectPointToPlane = function(n, p0, p) {
    let pp0 = new THREE.Vector3(); pp0.subVectors(p, p0);
    let npp0 = n.dot(pp0);
    let npp0n = new THREE.Vector3(); npp0n.copy(n); npp0n.multiplyScalar(npp0);

    let q = new THREE.Vector3(); q.subVectors(p, npp0n);

    return q;
}

// Use this.p = [p1,p2,p3]
LDR.TexmapPlacement.prototype.getUVPlanar = function(p) {
    let toPlane = (n, D) => Math.abs(n.x*p.x + n.y*p.y + n.z*p.z + D);

    let U = 1 - toPlane(this.N1, this.D1) / this.N1LenSq; // Inversion is required since textures by default have y flipped
    let V = toPlane(this.N2, this.D2) / this.N2LenSq;

    return [U,V];
}

/*
x1 y1 z1 x2 y2 z2 x3 y3 z3 a

p1 = (x1,y1,z1) = Bottom center of cylinder
p2 = (x2,y2,z2) = Top center of cylinder
p3 = (x3,y3,z3) = A location on the outer edge of the cylinder bottom where the center-bottom of the texture would touch
a = Extend of mapping by the texture. [–a/2;a/2] as measured relative to radial line from p1p3
n = p1p2
m = p1p3

p -> (U,V):
 U = angle(m,p1q) / a, q is projection to bottom of the cylinder.
  U = atan2((m x p1q) . n, m . p1q) / a
 V = dist(p,q) / |n|

The point p will be one of the vertices of a triangle. In case V=0, the cylindrical nature of 
The two points pCtx1 and cPtx2 are for providing context of the origi
 */
LDR.TexmapPlacement.prototype.getUVCylindrical = function(p, pCtx1, pCtx2) {
    let self = this;
    function getU(pt) {
        let q = self.projectPointToPlane(self.n, self.p[0], pt);
        let p1q = new THREE.Vector3(); p1q.subVectors(self.p[0], q);
        let cross = new THREE.Vector3(); cross.crossVectors(p1q, self.m);
        let angle = Math.atan2(-cross.dot(self.n), -self.m.dot(p1q));
        let U = 0.5 + angle / self.a;
        return U;
    }
    let U = getU(p);
    if(-1e-4 < U && U < 1e-4 || -1e-4 < U-1 && U-1 < 1e-4) { // Fix wraparound issue.
        let uCtx1 = getU(pCtx1), uCtx2 = getU(pCtx2);
        if(Math.abs(uCtx2-U) > 0.75 || Math.abs(uCtx1-U) > 0.75) {
            U = 1-U;
        }
    }    

    let distToP1Disc = this.n.x*p.x + this.n.y*p.y + this.n.z*p.z + this.D;
    let V = -distToP1Disc / this.nLen;

    return [U,V];
}

/*
x1 y1 z1 x2 y2 z2 x3 y3 z3 a b

p1 = (x1,y1,z1) = center of sphere
p2 = (x2,y2,z2) = Point on the sphere = center of texture map
p3 = (x3,y3,z3) = Forms a plane P1 perpendicular to the texture and bisects it horizontally:
 P1 contains p1, p2, p3.
 Plane P2 can be computed by using p1 and p2 and generating a 3rd point along the normal of P1.
 P2 will be perpendicular to both P1 and the texture and will bisect the texture vertically.
 The two angles indicate the extents of the sphere that get mapped to.
 These are [–a/2;a/2] and [–b/2;b/2] as measured relative to p1p2 and within P1 and P2 respectively.

p -> (U,V):
n = p1p2
q1 = proj(p onto P1)
q2 = proj(p onto P2)
U = angle(n, p1q1)/a 
V = angle(n, p1q2)/b
 */
LDR.TexmapPlacement.prototype.getUVSpherical = function(p, pCtx1, pCtx2) {
    let self = this;

    let a = new THREE.Vector3(); 
    // angle(a,b) = atan2((axb) . n, a.b), a = q-p1
    function getAngle(q, b, n) {
        a.subVectors(q, self.p[0]);
        cross.crossVectors(a, b);
        return Math.atan2(-cross.dot(n), a.dot(b));
    }
    let cross = new THREE.Vector3();
    function getU(pt) {
        let q1 = self.projectPointToPlane(self.N1, self.p[0], pt);
        return 0.5 + getAngle(q1, self.n, self.N1) / self.a;
    }

    let U = getU(p);
    if(U < 1e-4) { // Fix wraparound issue.
        let uCtx1 = getU(pCtx1), uCtx2 = getU(pCtx2);
        if(uCtx2 > 0.75 || uCtx1 > 0.75) {
            U = 1-U;
        }
    }

    let distToP = this.p[0].distanceTo(p);
    let distToP1 = this.N1.x*p.x + this.N1.y*p.y + this.N1.z*p.z + this.D;
    let angle = Math.asin(distToP1 / distToP);
    let V = 0.5 + angle / this.b;

    //let V = 0.5 + getAngle(q2, this.n, this.N2) / this.b; // Correct implementation according to specification, but not what others do!
    //let qV = self.projectPointToPlane(this.N2, this.p[0], p);
    //V = 0.5 + getAngle(qV, this.n, this.N2) / this.b;

    return [U,V];
}

LDR.TexmapPlacement.prototype.toLDR = function(lines, loader) {
    let nextOnly = lines.length === 1 && this.fallback.isEmpty();
    let method = this.type === 0 ? 'PLANAR' : (this.type === 1 ? 'CYLINDRICAL' : 'SPHERICAL');

    let ret = '0 !TEXMAP ' + (nextOnly ? 'NEXT' : 'START') + ' ' + method + ' ';
    this.p.forEach(pt => ret += pt.x + ' ' + pt.y + ' ' + pt.z + ' ');
    if(this.type > 0) {
        ret += parseFloat((this.a * 180 / Math.PI).toFixed(4)) + ' ';
    }
    if(this.type > 1) {
        ret += parseFloat((this.b * 180 / Math.PI).toFixed(4)) + ' ';
    }
    ret += this.file;
    if(this.glossmapFile) {
        ret += ' ' + this.glossmapFile;
    }
    ret += '\r\n';

    lines.forEach(line => ret += '0 !: ' + line.toLDR(loader)); // Remember the special formatting prefix here!
    
    if(!nextOnly) {
        ret += '0 !TEXMAP FALLBACK\r\n';
        ret += this.fallback.toLDR(loader);
        ret += '0 !TEXMAP END\r\n';
    }

    return ret;
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
}

LDR.MeshCollector.prototype.addLines = function(mesh, part, conditional) {
    this.lineMeshes.push({mesh:mesh, part:part, opaque:true, conditional:conditional});
    this.opaqueObject.add(mesh);
}

LDR.MeshCollector.prototype.addOpaque = function(mesh, part) {
    this.triangleMeshes.push({mesh:mesh, part:part, opaque:true});
    this.opaqueObject.add(mesh);
}

LDR.MeshCollector.prototype.addTrans = function(mesh, part) {
    this.triangleMeshes.push({mesh:mesh, part:part, opaque:false});
    this.transObject.add(mesh);
}

LDR.MeshCollector.prototype.removeAllMeshes = function() {
    let self = this;
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

    this.lineMeshes.forEach(obj => obj.mesh.visible = lineV);

    let old = this.old;
    this.triangleMeshes.forEach(obj => obj.mesh.visible = v && (old || !(ldrOptions.showEditor && obj.part && obj.part.original && obj.part.original.ghost))); // Do not show faces for ghosted parts.
}

LDR.MeshCollector.prototype.expandBoundingBoxByPoint = function(p) {
    if(!this.boundingBox) {
	this.boundingBox = new THREE.Box3();
    }
    this.boundingBox.expandByPoint(p);
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

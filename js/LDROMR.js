'use strict';

/**
   For the OMR specification, see https://www.ldraw.org/article/593.html
   This file specifies the LDR.OMR namespace and consists of a series of functions, 
   each returning objects with 'node' handlers to check and fix LDraw files for OMR conformity.

   A 'node' can be either of the following:
   - A 'part type'. This is either a sub model or part (subbModel.ldr, part.dat, etc.) representing a complete '0 FILE ...' dat or ldr file in the mpd.
   - A 'part description'. This represents a line type 1, such as '1 16 0 0 0 1 0 0 0 1 0 0 0 1 something.ldr'.
   - A 'step'. This is a list of part descriptions representing a step in a building instruction.

   A node handler can be constructed for each node type.

   There are two types of handlers: 'checkers' and 'handlers' in the return values of the functions:
   - checkers provide functions for checking if the handlers should be applied to all the nodes.
    - The return value 'false' indicates that the handlers should not bbe applied.
    - Otherwise a return value should be a user-facing string informing the user of the actions to be applied by the handlers if a button is pressed.
   - handlers provide functions for updating nodes. They are to be applied to all nodes.

   The functions that can be defined for checkers are:
   - 'checkPartType'. This function 'checks' a part type and accepts two parameters: 
    - 'pt', the part type node.
    - 'state', the part description in the parent node.
   - 'checkPartDescription'. This function 'checks' a part description and accepts two parameters: 
    - 'pd', the part description node.
    - 'state', the step of the parent node.
   - 'checkStep'. This function 'checks' a step and accepts two parameters: 
    - 'step', the step node.
    - 'state', the part type in the parent node.
    - 'idx', the index of the step in the part type of the parent node.

   Similarly, the functions for handlers accept the same parameters and are named 'handlePartType', 'handlePartDescription', and 'handleStep', respectively.
 */
LDR.OMR = {};

/**
 Check if any part description has a part which has been replaced.
 These are identified by having the description '~Moved to <new_part>'.
 in buildinginstructions.js, the property 'replacement' is set on part types when this occurs.
 */
LDR.OMR.UpgradeToReplacements = function(ldrLoader) {
    return {
        checkers: {checkPartType:pt => (pt.replacement && pt.modelDescription) ? ['Click here to upgrade moved parts',pt.ID,pt.replacement] : false},

        handlers: {handlePartDescription: pd => {
                let pt = ldrLoader.getPartType(pd.ID);
                if(pt.replacement) {
                    pd.ID = pt.replacement;
                }
            }
        }
    };
}

LDR.OMR.UpgradeToPartsBasedOnYear = function(year) {
    let R = {};
    for(let id in LDR.Replacements) {
	if(LDR.Replacements.hasOwnProperty(id)) {
	    let obj = LDR.Replacements[id];
	    R[obj.part] = {part: id, year:obj.year};
	}
    }

    function check(pt) {
	if(!pt.ID.endsWith('.dat')) {
	    return false;
	}
	let id = pt.ID.substring(0, pt.ID.length-4);
	if(LDR.Replacements.hasOwnProperty(id)) {
	    let obj = LDR.Replacements[id];
	    if(obj.year <= year) {
		return ['In ' + year + ', LEGO had replaced some part with newer versions. Click here to set parts as they were in ' + year, id+'.dat', obj.part+'.dat'];
	    }
	}
	if(R.hasOwnProperty(id)) {
	    let obj = R[id];
	    if(obj.year > year) {
		return ['In ' + year + ', LEGO had replaced some part with newer versions. Click here to set parts as they were in ' + year, id+'.dat', obj.part+'.dat'];
	    }
	}
	return false;
    }

    return {
        checkers: {checkPartType:check},
        handlers: {handlePartDescription: pd => {
	    let id = pd.ID;
	    if(!id.endsWith('.dat')) {
		return;
	    }
	    id = id.substring(0, id.length-4);
            if(LDR.Replacements.hasOwnProperty(id)) {
                let obj = LDR.Replacements[id];
		if(obj.year <= year) {
		    pd.ID = obj.part + '.dat';
		}
            }
            else if(R.hasOwnProperty(id)) {
                let obj = R[id];
		if(obj.year > year) {
		    pd.ID = obj.part + '.dat';
		}
            }
        }}
    };
}

/**
 Check if many part descriptions are placed with precision higher than 3 decimals.
 Correct all to at most 3 decimals.
 */
LDR.OMR.FixPlacements = function(ldrLoader) {
    const ACCEPTABLE_FRACTION = 0.3;
    const MIN_TOTAL = 20;

    function convert(x) {
        x = x.toFixed(3);
        for(var i = 0; i < 3; i++) {
            var tmp = parseFloat(x).toFixed(i);
            if(parseFloat(tmp) === parseFloat(x)) {
                return Number(tmp);
            }
        }
        return Number(x);
    };
    
    let checkV = p => p.x!==convert(p.x) || p.y!==convert(p.y) || p.z!==convert(p.z);

    let bad = 0
    let total = 0;
    function checkPD(pd) {
	let p = pd.p;
	let r = pd.r.elements;
        total++;
        if(checkV(p) || pd.r.elements.some(x => x!==convert(x))) {
            ++bad;
            return (total >= MIN_TOTAL) && (bad/total > ACCEPTABLE_FRACTION);
        }
	return false;
    }

    let handlers = {handlePartDescription: function(pd) {
	pd.p.set(convert(pd.p.x),
                 convert(pd.p.y),
                 convert(pd.p.z));
	let e = pd.r.elements;
	pd.r.set(convert(e[0]), convert(e[3]), convert(e[6]),
                 convert(e[1]), convert(e[4]), convert(e[7]),
                 convert(e[2]), convert(e[5]), convert(e[8]));
	return pd;
    }};

    let checkers = {checkPartDescription:pd => 
                    checkPD(pd) ? ['Many parts are placed with precision higher than three decimals. This is often observed in models created in Bricklink Studio 2.0. Click here to align all parts to have at most three decimals in their positions.', pd.toFullLDR(ldrLoader), handlers.handlePartDescription(pd.cloneColored(16)).toLDR(ldrLoader)] : false};

    return {checkers:checkers, handlers:handlers};
}

THREE.LDRPartDescription.prototype.toFullLDR = function(loader) {
    let pt = loader.getPartType(this.ID);
    let ret = '1 ' + this.c + ' ' + this.p.x + ' ' + this.p.y + ' ' + this.p.z + ' ' + this.r.toFullLDR() + ' ' + pt.ID + '\r\n';
    return ret;
}

THREE.Matrix3.prototype.toFullLDR = function() {
    let e = this.elements;
    let rowMajor = [e[0], e[3], e[6],
                    e[1], e[4], e[7],
                    e[2], e[5], e[8]]
    return rowMajor.join(' ');
}

/**
 Check if any author line of a sub model is not the provided argument.
 Fix any deviating author line.
 */
LDR.OMR.FixAuthors = function(expectedAuthor) {
    let title = pt => ['Align author lines in the LDraw file by clicking here', pt.author ? ('0 Author: ' + pt.author) : '[Missing author line]', '0 Author: ' + expectedAuthor];

    function checkPartType(pt) {
	if(pt.isPart) {
	    return !pt.author ? title(pt) : false;

	}
	else {
	    return pt.author !== expectedAuthor ? title(pt) : false;
	}
    }

    let handlers = {handlePartType: pt => {
        if(pt.isPart)  {
	    if(!pt.author) {
		pt.author = expectedAuthor;
	    }
	}
	else {
            pt.author = expectedAuthor;
	}
    }};
    return {checkers:{checkPartType:checkPartType}, handlers:handlers};
}

LDR.OMR.FixTyres = function(ldrLoader) {
    function checkPD(pd) {
	let pt = ldrLoader.getPartType(pd.ID);
	return pd.c == 0 && pt.isPart && pt.modelDescription.startsWith('Tyre ');
    }

    let handlers = {handlePartDescription: function(pd) {
	if(checkPD(pd)) {
	    pd.c = 256;
	}
	return pd;
    }};

    let checkers = {checkPartDescription:pd => 
                    checkPD(pd) ? ['Change the material of tyres to rubber black (256) instead of solid black (0)', pd.toLDR(ldrLoader), handlers.handlePartDescription(pd.cloneColored(0)).toLDR(ldrLoader)] : false};

    return {checkers:checkers, handlers:handlers};
}

/**
 Check and fix all licenses to be OMR compliant.
 All sub models and unofficial parts are affected.
 */
LDR.OMR.FixLicenses = function() {
    const LICENSE = 'Redistributable under CCAL version 2.0 : see CAreadme.txt';

    function title(lc) {
	let from = lc ? ('0 !LICENSE ' + lc) : '[Missing license]';
	return ['Update license lines in the LDraw file', from, '0 !LICENSE ' + LICENSE];
    }

    let checkers = {checkPartType: pt => (pt.license !== LICENSE) ? title(pt.license) : false};
    let handlers = {handlePartType: pt => pt.license = LICENSE};
    return {checkers:checkers, handlers:handlers};
}

/**
   Set all '0 !LDRAW_ORG' lines to indicate either official or non-official as determined by the parameter.
 */
LDR.OMR.LDrawOrgChanged = false;
LDR.OMR.SetLDrawOrg = function(unofficial) {
    let type = unofficial ? 'Unofficial_Model' : 'Model';
    let title = "Set all LDRAW_ORG lines of unofficial parts to 'Unofficial_Part' and of all other to '" + type + "' ";
    if(unofficial) {
        title += " indicating the file is OMR compliant, but not yet accepted into the official OMR library";
    }
    else {
        title += " indicating the file is OMR compliant and accepted into the official library";
    }

    function checkPartType(pt) {
	if(LDR.OMR.LDrawOrgChanged) {
	    return false; // Only change once.
	}
	if(pt.isPart) {
	    if(!pt.ldraw_org) {
		return [title, '[Missing line in part ' + pt.ID + ']', '0 !LDRAW_ORG Unofficial_Part'];
	    }
	    return false;
	}
	else {
	    if(pt.ldraw_org !== type && pt.ldraw_org !== 'Model') {
		return [title,(pt.ldraw_org?('0 !LDRAW_ORG '+pt.ldraw_org):'[Missing line in ' + pt.ID + ']'),'0 !LDRAW_ORG '+type];
	    }
	    return false;
	}
    }

    function handlePartType(pt) {
	if(pt.isPart) {
	    if(!pt.ldraw_org) {
		pt.ldraw_org = 'Unofficial_Part';
	    }
	}
	else {
	    pt.ldraw_org = type;
	}
	LDR.OMR.LDrawOrgChanged = true;
    }

    return {checkers:{checkPartType:checkPartType}, handlers:{handlePartType:handlePartType}};
}

/**
   Ensure all file headers are set up as follow:
    0 FILE <set number> - <sub model name>.ldr
    0 <sub model name>
    0 Name: <set number> - <sub model name>.ldr
   for sub models and
    0 FILE <set number> - <sub model name>.dat
    0 <part decription>
    0 Name: <set number> - <sub model name>.dat
   for all unofficial parts.
   In bbuildinginstructions.org, the 'name' property on part types is used for both '0 FILE' and '0 Name:' lines.
 */
LDR.OMR.StandardizeFileNames = function(setNumber, ldrLoader) {
    let setNumberPrefix = setNumber + ' - ';
    let title = (pt,i,d) => ['Standardize file headers',
			     '0 FILE ' + pt.ID + '\n0 ' + pt.modelDescription + '\n0 Name: ' + pt.name,
			     '0 FILE ' + i + '\n0 ' + d + '\n0 Name: ' + i];
    
    function extract(x) {
	if(x.endsWith('.ldr') || x.endsWith('.LDR') || x.endsWith('.dat') || x.endsWith('.DAT') || x.endsWith('.mpd') || x.endsWith('.MPD')) {
	    x = x.substring(0, x.length-4);
	}
	x = x.replace(/^[\d\s\-]+\-\s+/g, '');
	return x;
    }

    let checkPartType = function(pt) {
        if(!pt.isPart) { // Not a part: Check that all 3 lines are well-formed:
	    let e = extract(pt.name);
	    let d = pt.modelDescription ? pt.modelDescription : e;
	    let i = setNumberPrefix + e + '.ldr';
            if(pt.name !== i || pt.modelDescription !== d) {
		return title(pt, i, d);
	    }
	    return false;
        }
        else if(!pt.inlined && pt.ldraw_org && pt.ldraw_org.startsWith('Unofficial_')) { // Check a part for inconsistencies:
            if(!pt.name.startsWith(setNumberPrefix)) {
		let i = setNumberPrefix + extract(pt.name) + '.dat';
                return title(pt, i, pt.modelDescription);
            }
        }
        return false;
    }

    let handlePartType = function(pt) {
        if(!pt.isPart) {
	    let e = extract(pt.name);
	    if(!pt.modelDescription) {
		pt.modelDescription = e;
	    }
	    let from = pt.ID;
	    pt.ID = pt.name = setNumberPrefix + e + '.ldr';	    
	    ldrLoader.partTypes[pt.ID] = pt;
	    if(ldrLoader.mainModel === from) {
		ldrLoader.mainModel = pt.ID;
	    }
        }
        else if(!pt.inlined && pt.ldraw_org && pt.ldraw_org.startsWith('Unofficial_')) {
            pt.name = setNumberPrefix + extract(pt.name) + '.dat';
        }
    }
    let handlePartDescription = function(pd) {
	let pt = ldrLoader.getPartType(pd.ID);
	handlePartType(pt);
	pd.ID = pt.ID; // Replaced ID.
    }

    return {checkers:{checkPartType:checkPartType}, handlers:{handlePartType:handlePartType, handlePartDescription:handlePartDescription}};
}

/**
   In 2007 LEGO started using new brown and gray colors.
   Some LDraw editors default to old gray colors.
   These functions fix colors that were involved in this color change: 
   If the year given as parameter is before 2007, old colors will be used, while newer models will 
   be changed to use new colors.
   Colors involved are brown, gray and dark gray.
 */
LDR.OMR.ColorPartsAccordingToYear = function(year, ldrLoader) {
    function transformColors(pd, map) {
        if(map.hasOwnProperty(pd.c)) {
            pd.c = map[pd.c];
        }
    }

    if(year >= 2007) {
	let map = {'6':70,'7':71,'8':72};
        function title(pd, c) {
	    let pd2 = pd.cloneColored(16); pd2.c = c;
	    return ['In 2007 LEGO started using new brown and gray colors. Click here to make all parts use the new colors', pd.toLDR(ldrLoader), pd2.toLDR(ldrLoader)];
	}
        return {
            checkers: {checkPartDescription: pd => (pd.c===6||pd.c===7||pd.c===8) ? title(pd, map[pd.c]) : false},
            handlers: {handlePartDescription: pd => transformColors(pd, map)}
        };
    }
    else {
	let map = {'70':6,'71':7,'72':8};
        function title(pd, c) {
	    let pd2 = pd.cloneColored(16); pd2.c = c;
	    return ['Before 2007 LEGO used old brown and gray colors. Click here to make all parts use the old colors as they were in ' + year, pd.toLDR(ldrLoader), pd2.toLDR(ldrLoader)];
	}
        return {
            checkers: {checkPartDescription: pd => (pd.c===70||pd.c===71||pd.c===72) ? title(pd, map[pd.c]) : false},
            handlers: {handlePartDescription: pd => transformColors(pd, map)}
        };
    }
}    

LDR.OMR.GetHeaderContent = function(pt) {
    let theme = '';
    let keywords = [];
    let historyLines = []; // [{date,author,txt}] 
    let otherLines = [];

    function handleLine(line0) {
	let parts = line0.txt.split(' ');
	if(parts.length < 2) {
	    otherLines.push(line0);
	    return;
	}
	let t0 = parts[0];
	let t = parts.slice(1).join(' ');
	
	if(t0 === '!THEME') {
	    theme = t;
	}
	else if(t0 === '!KEYWORDS') {
	    keywords.push(...t.split(',').map(x => x.trim()));
	}
	else if(t0 === '!HISTORY') {
	    if(parts.length < 4) {
		otherLines.push(new LDR.Line0('!HISTORY_LINE_TOO_SHORT ' + t));
		return;
	    }

	    let d = parts[1].match(/^([12]\d{3})-0?([1-9]|11|12)-0?([1-3]?\d)$/);
	    if(!d) {
		otherLines.push(new LDR.Line0('!HISTORY_LINE_DATE_PARSE_FAIL ' + t));
		return;
	    }
	    let date = d[1] + '-' + (d[2].length===1?'0':'') + d[2] + '-' + (d[3].length===1?'0':'') + d[3];
	    try { // Actual valid date check:
		new Date(date).toISOString();
		console.dir(date);
	    }
	    catch(e) {
		otherLines.push(new LDR.Line0('!HISTORY_LINE_DATE_INVALID ' + t));
		return;
	    }

	    let idx = 2;
	    let author = parts[idx++];
	    while(!author.endsWith(']') && idx < parts.length) { // Combine author parts in case of spaces in user name:
		author += ' ' + parts[idx++];
	    }
	    if(idx === parts.length || !(author.startsWith('[') && author.endsWith(']'))) {
		otherLines.push(new LDR.Line0('!HISTORY_LINE_AUTHOR_MALFORMED ' + t));
		return;
	    }

	    historyLines.push({date:date, author:author, txt:parts.slice(idx).join(' ')});
	}
	else {
	    otherLines.push(line0);
	}
    }
    
    pt.headerLines.forEach(handleLine);

    historyLines = historyLines
	.sort((a,b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
	.map(obj => new LDR.Line0('!HISTORY ' + obj.date + ' ' + obj.author + ' ' + obj.txt));

    return [theme, keywords, historyLines, otherLines];
}

// Fix !THEME, !KEYWORDS and !HISTORY header lines:
LDR.OMR.FixHeaderLines = function(expectedTheme, expectedKeywords, ldrLoader) {
    function getHeaderLines(pt) {
	let [theme, keywords, historyLines, otherLines] = LDR.OMR.GetHeaderContent(pt);
	if(expectedTheme) {
	    theme = expectedTheme;
	}
	if(expectedKeywords) {
	    keywords = expectedKeywords;
	}
	let ret = [];
	if(theme) {
	    ret.push(new LDR.Line0('!THEME ' + theme));
	}
	if(keywords.length > 0) {
	    ret.push(new LDR.Line0('!KEYWORDS ' + keywords.join(', ')));
	}
	ret.push(...historyLines);
	ret.push(...otherLines);
	return ret;
    }

    function check(pt) {
	if(pt.ID !== ldrLoader.mainModel) {
	    return false; // Only set header lines in main model
	}
	let lines = getHeaderLines(pt);
	if(lines.length != pt.headerLines.length || 
	   pt.headerLines.some((line,i) => line.txt !== lines[i].txt)) {
	    let f = arr => arr.length == 0 ? '[No header]' : arr.map(x => x.toLDR()).join('\n');
	    return ['Click here to update the headers', f(pt.headerLines), f(lines)];
	}
	return false;
    }

    function handle(pt) {
	if(pt.ID === ldrLoader.mainModel) {
	    pt.headerLines = getHeaderLines(pt);
	}
    }

    return {checkers:{checkPartType:check}, handlers:{handlePartType:handle}};
}

THREE.LDRLoader.prototype.toLDROMR = function() {
    let self = this;

    // Part types:
    let ret = this.getMainModel().toLDR(this);

    this.applyOnPartTypes(pt => {
	if(pt.ID === self.mainModel)
	    return; // Main model
        if(!(pt.isPart && pt.isOfficialLDraw())) {
            ret += pt.toLDR(self); // Non-parts and unofficial parts
        }
    });

    // Inline texmaps:
    const CHARACTERS_PER_LINE = 80;
    function outputDataUrl(id, mimetype, content) {
        ret += "0 !DATA " + id + "\r\n";
        let lines = Math.ceil(content.length / CHARACTERS_PER_LINE);
        for(let i = 0; i < content.length; i += CHARACTERS_PER_LINE) {
            ret += "0 !: " + content.substr(i, CHARACTERS_PER_LINE) + "\r\n";
        }
        ret += "\r\n";
    }
    this.texmapDataurls.forEach(obj => outputDataUrl(obj.id, obj.mimetype, obj.content));

    return ret;
}
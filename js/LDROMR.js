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
LDR.OMR.UpgradeToNewParts = function() {
    return {
        checkers: {checkPartType:pt => pt.replacement ? "Click here to upgrade all moved parts, such as " + pt.ID + " to latest versions" : false},

        handlers: {handlePartDescription: pd => {
                let pt = ldrLoader.getPartType(pd.ID);
                if(pt.replacement) {
                    pd.ID = pt.replacement;
                }
            }
        }
    };
}

/**
 Check if many part descriptions are placed with precision higher than 3 decimals.
 Correct all to at most 3 decimals.
 */
LDR.OMR.FixPlacements = function() {
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
    
    let check3 = p => p.x!==convert(p.x) || p.y!==convert(p.y) || p.z!==convert(p.z);

    let bad = 0
    let total = 0;
    function checkPD(p) {
        total++;
        if(check3(p)) {
            ++bad;
        }
        return (total >= MIN_TOTAL) && (bad/total > ACCEPTABLE_FRACTION);
    }

    let checkers = {checkPartDescription:pd => 
                    checkPD(pd.position) ? "Many parts are placed with precision higher than three decimals, such as '" + pd.ID + "' placed at (" + pd.position.x + ", " + pd.position.y + ", " + pd.position.z + "). This is often observed in models created in Bricklink Studio 2.0. Click here to align all parts to have at most three decimals in their positions." : false};

    let handlers = {handlePartDescription: function(pd) {
	pd.position.set(convert(pd.position.x),
			convert(pd.position.y),
			convert(pd.position.z));
    }};

    return {checkers:checkers, handlers:handlers};
}

/**
 Check if any author line of a sub model is not the provided argument.
 Fix any deviating author line.
 */
LDR.OMR.FixAuthors = function(expectedAuthor) {
    let title = "Change all author lines in the models of the LDraw file to '" + expectedAuthor + "' (This does not include any unofficial parts)";

    let checkers = {checkPartType: pt => pt.isPart ? false : (pt.author !== expectedAuthor ? title : false)};
    
    let handlers = {handlePartType: pt => {
        if(!pt.isPart)  {
            pt.author = expectedAuthor;
	}
    }};

    return {checkers:checkers, handlers:handlers};
}

/**
 Check and fix all licenses to be OMR compliant.
 All sub models and unofficial parts are affected.
 */
LDR.OMR.FixLicenses = function() {
    const LICENSE = 'Redistributable under CCAL version 2.0 : see CAreadme.txt';
    let title = "Change all license lines in the models of the LDraw file (including unofficial parts) to '" + LICENSE + "'";

    let checkers = {checkPartType: pt => pt.license !== LICENSE ? title : false};
    
    let handlers = {handlePartType: pt => {
	pt.license = LICENSE;
    }};

    return {checkers:checkers, handlers:handlers};
}

/**
   Set all '0 !LDRAW_ORG' lines to indicate either official or non-official as determined by the parameter.
 */
LDR.OMR.LDrawOrgChanged = false;
LDR.OMR.SetLDrawOrg = function(unofficial) {
    let type = unofficial ? 'Unofficial_Model' : 'Model';
    let title = "Set all 'LDRAW_ORG' lines to '" + type + "' ";
    if(unofficial) {
        title += " indicating the model is OMR compliant, but not yet accepted into the official library";
    }
    else {
        title += " indicating the model is OMR compliant and accepted into the official library";
    }

    let checkers = {checkPartType: pt => (!LDR.OMR.LDrawOrgChanged && !pt.isPart && pt.ldraw_org !== type && pt.ldraw_org !== 'Model') ? title : false};
    let handlers = {handlePartType: pt => {if(!pt.isPart){pt.ldraw_org = type; LDR.OMR.LDrawOrgChanged = true;}}};
    return {checkers:checkers, handlers:handlers};
}

/**
   Ensure all unofficial parts are inlined.
   In buildinginstructions.js the property 'inlined' on part types determine if the part should be inlined.
 */
LDR.OMR.InlineUnofficialParts = function() {
    let title = id => "Copy content of unofficial files, such as " + id + " into the MPD file to improve OMR compliance";

    let checkers = {checkPartType: pt => (pt.isPart && pt.ldraw_org && pt.ldraw_org.startsWith('Unofficial_') && pt.inlined !== "GENERATED") ? title(pt.ID) : false};

    let handlers = {handlePartType: pt => {if(pt.isPart && pt.inlined && pt.ldraw_org && pt.ldraw_org.startsWith('Unofficial_') && pt.inlined !== "GENERATED"){pt.inlined = undefined;}}};

    return {checkers:checkers, handlers:handlers};
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
LDR.OMR.StandardizeFileNames = function(setNumber) {
    let setNumberPrefix = setNumber + ' - ';
    let title = (i,d) => "Change file headers to follow the standard <pre>0 FILE " + i + "\n0 " + d + "\n0 Name: " + i + "</pre>";
    
    function extract(x) {
	if(x.endsWith('.ldr') || x.endsWith('.LDR') || x.endsWith('.dat') || x.endsWith('.DAT') || x.endsWith('.mpd') || x.endsWith('.MPD')) {
	    x = x.substring(0, x.length-4);
	}
	x = x.replace(/^[\d\s\-]+\-\s+/g, '');
	return x;
    }

    let checkPartType = function(pt) {
        if(!pt.isPart) { // Not a part: Check that all 3 lines are well-formed:
	    let d = extract(pt.name);
	    let i = setNumberPrefix + d + '.ldr';
            if(pt.name !== i || pt.modelDescription !== d) {
		return title(i, d);
	    }
	    return false;
        }
        else if(!pt.inlined && pt.ldraw_org && pt.ldraw_org.startsWith('Unofficial_')) { // Check a part for inconsistencies:
            if(!pt.name.startsWith(setNumberPrefix)) {
		let i = setNumberPrefix + extract(pt.name) + '.dat';
                return title(i, pt.modelDescription);
            }
        }
        return false;
    }

    let handlePartType = function(pt) {
        if(!pt.isPart) {
	    let d = extract(pt.name);
	    pt.modelDescription = d;
	    pt.name = setNumberPrefix + d + '.ldr';
        }
        else if(!pt.inlined && pt.ldraw_org && pt.ldraw_org.startsWith('Unofficial_')) {
            pt.name = setNumberPrefix + extract(pt.name) + '.dat';
        }
    }

    return {checkers:{checkPartType:checkPartType}, handlers:{handlePartType:handlePartType}};
}

/**
   In 2007 LEGO started using new brown and gray colors.
   Some LDraw editors default to old gray colors.
   These functions fix colors that were involved in this color change: 
   If the year given as parameter is before 2007, old colors will be used, while newer models will 
   be changed to use new colors.
   Colors involved are brown, gray and dark gray.
 */
LDR.OMR.ColorPartsAccordingToYear = function(year) {
    function transformColors(pd, map) {
        if(map.hasOwnProperty(pd.colorID)) {
            pd.colorID = map[pd.colorID];
        }
    }

    if(year >= 2007) {
        let title = (id, colorID) => "In 2007 LEGO started using new brown and gray colors. This model has one or more parts in old colors, such as " + id + " in " + LDR.Colors[colorID].name + ". Click here to change to new colors";
        return {
            checkers: {checkPartDescription: pd => (pd.colorID===6||pd.colorID===7||pd.colorID===8) ? title(pd.ID, pd.colorID) : false},
            handlers: {handlePartDescription: pd => transformColors(pd, {'6':70,'7':71,'8':72})}
        };
    }
    else {
        let title = (id, colorID) => "In 2007 LEGO started using new gray and brown colors. This model contains one or more parts in new colors, such as " + id + " in " + LDR.Colors[colorID].name + ". Click here to change to old colors";
        return {
            checkers:{checkPartDescription:pd => (pd.colorID===70||pd.colorID===71||pd.colorID===72) ? title(pd.ID, pd.colorID) : false},
            handlers:{handlePartDescription:pd => transformColors(pd, {'70':6,'71':7,'72':8})}
        };
    }
}    

// TODO: Ensure history lines are well formed.

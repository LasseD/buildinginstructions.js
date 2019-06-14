'use strict';

/**
   OMR - see https://www.ldraw.org/article/593.html
 */ 
LDR.OMR = {};

// ~Moved parts:
LDR.OMR.UpgradeToNewParts = {
    checkers: {checkPartType:pt => pt.replacement ? "Click here to upgrade all moved parts, such as " + pt.ID + " to latest versions" : false},

    handlers: {handlePartDescription: function(pd) {
        let pt = ldrLoader.partTypes[pd.ID];
	if(pt.replacement) {
            pd.ID = pt.replacement;
        }
    }}
}

LDR.OMR.FixAuthors = function(expectedAuthor) {
    let title = "Change all author lines in the models of the LDraw file to '" + expectedAuthor + "' (This does not include any unofficial parts)";

    let checkers = {checkPartType: pt => pt.isPart() ? false : (pt.author !== expectedAuthor ? title : false)};
    
    let handlers = {handlePartType: pt => {
        if(!pt.isPart())  {
            pt.author = expectedAuthor;
	}
    }};

    return {checkers:checkers, handlers:handlers};
}

LDR.OMR.FixLicenses = function() {
    const LICENSE = 'Redistributable under CCAL version 2.0 : see CAreadme.txt';
    let title = "Change all license lines in the models of the LDraw file (including unofficial parts) to '" + LICENSE + "'";

    let checkers = {checkPartType: pt => pt.license !== LICENSE ? title : false};
    
    let handlers = {handlePartType: pt => {
	pt.license = LICENSE;
    }};

    return {checkers:checkers, handlers:handlers};
}

LDR.OMR.SetLDrawOrg = function(unofficial) {
    let type = unofficial ? 'Unofficial_Model' : 'Model';
    let title = "Set all 'LDRAW_ORG' lines to '" + type + "'. ";
    if(unofficial) {
        title += " This value indicates that the model is OMR compliant, but not yet accepted into the official library";
    }
    else {
        title += " This value indicates that the model is OMR compliant and accepted into the official library";
    }

    let checkers = {checkPartType: pt => (!pt.isPart() && pt.ldraw_org !== type) ? title : false};
    let handlers = {handlePartType: pt => {if(!pt.isPart()){pt.ldraw_org = type;}}};
    return {checkers:checkers, handlers:handlers};
}

LDR.OMR.InlineUnofficialParts = function() {
    let title = id => "Copy content of unofficial files, such as " + id + " into the MPD file to improve OMR compliance";

    let checkers = {checkPartType: pt => (pt.isPart() && pt.inlined && (pt.inlined !== 'OFFICIAL')) ? title(pt.ID) : false};

    let handlers = {handlePartType: pt => {if(pt.isPart() && pt.inlined && (pt.inlined !== 'OFFICIAL')){pt.inlined = undefined;}}};

    return {checkers:checkers, handlers:handlers};
}

LDR.OMR.StandardizeFileNames = function(setNumber) {
    let setNumberPrefix = setNumber + ' - ';
    let lp = setNumberPrefix.length;
    let title = (id,desc) => "Click here to ensure all file headers follow the standard <pre>0 FILE " + 
      setNumberPrefix + id + "\n0 " + desc + "\n0 Name: " + setNumberPrefix + id + "</pre>";

    let checkPartType = function(pt) {
        if(!pt.isPart()) { // Not a part: Check that all 3 lines are well-formed:
            if(!pt.name.toLowerCase().endsWith('.ldr')) {
                return title(pt.name + '.ldr', pt.name);
            }
            if(!pt.name.startsWith(setNumberPrefix)) {
                return title(pt.name, pt.name.substring(0, pt.name.length-4));
            }
            let desc = pt.name.substring(lp, pt.name.length-4);
            if(pt.modelDescription !== desc)
		return title(pt.name, desc);
	    return false;
        }
        else if(!pt.inlined) { // Check a part for inconsistencies:
            if(!pt.name.toLowerCase().endsWith('.dat')) {
                return title(pt.name + '.dat', pt.modelDescription);
            }
            if(pt.ldraw_org === 'Unofficial_Part') {
                if(!pt.name.startsWith(setNumberPrefix)) {
                    return title(setNumberPrefix + pt.name, pt.modelDescription);
                }
            }
        }
        return false;
    }

    let handlePartType = function(pt) {
        if(!pt.isPart()) { // Not a part: Ensure all 3 lines are well-formed
            if(!pt.name.toLowerCase().endsWith('.ldr')) {
                pt.name += '.ldr';
            }
            if(!pt.name.startsWith(setNumberPrefix)) {
                pt.name = setNumberPrefix + pt.name;
            }
            let desc = pt.name.substring(lp, pt.name.length-4);
            pt.modelDescription = desc;
        }
        else if(!pt.inlined) { // Handle a part:
            if(!pt.name.toLowerCase().endsWith('.dat')) {
                pt.name += '.dat';
            }
            if(pt.ldraw_org === 'Unofficial_Part') {
                if(!pt.name.startsWith(setNumberPrefix)) {
                    pt.name = setNumberPrefix + pt.name;
                }
            }
        }
    }

    return {checkers:{checkPartType:checkPartType}, handlers:{handlePartType:handlePartType}};
}

// TODO: Ensure history lines are well formed.

'use strict';

/**
   OMR - see https://www.ldraw.org/article/593.html
 */ 
LDR.OMR = {};

// ~Moved parts:
LDR.OMR.UpgradeToNewParts = {
    title: "Click here to upgrade all moved parts to latest versions.",

    checkers: {checkPartType:pt => pt.replacement},

    handlers: {handlePartDescription: function(pd) {
        let pt = ldrLoader.partTypes[pd.ID];
	if(pt.replacement) {
            pd.ID = pt.replacement;
        }
    }}
}

LDR.OMR.FixAuthors = function(expectedAuthor) {
    let title = "Change all author lines in the models of the LDraw file to '" + expectedAuthor + "' (This does not include any unofficial parts)";

    let checkers = {checkPartType: pt => pt.isPart() ? false : pt.author !== expectedAuthor};
    
    let handlers = {handlePartType: pt => {
        if(pt.isPart())  {
	    return;
	}
        pt.author = expectedAuthor;
    }};

    return {title:title, checkers:checkers, handlers:handlers};
}

LDR.OMR.FixLicenses = function() {
    const LICENSE = 'Redistributable under CCAL version 2.0 : see CAreadme.txt';
    let title = "Change all license lines in the models of the LDraw file (including unofficial parts) to '" + LICENSE + "'";

    let checkers = {checkPartType: pt => pt.license !== LICENSE};
    
    let handlers = {handlePartType: pt => {
	pt.license = LICENSE;
    }};

    return {title:title, checkers:checkers, handlers:handlers};
}

LDR.OMR.SetLDrawOrg = function(unofficial) {
    let type = unofficial ? 'Unofficial_Model' : 'Model';
    let title = "Set all 'LDRAW_ORG' lines to '" + type + "'. ";
    if(unofficial) {
        title += " This value indicates that the model is OMR compliant, but not yet accepted into the official libraary.";
    }
    else {
        title += " This value indicates that the model is OMR compliant and accepted into the official libraary.";
    }

    let checkers = {checkPartType: pt => !pt.isPart() && pt.ldraw_org !== type};
    let handlers = {handlePartType: pt => {if(!pt.isPart()){pt.ldraw_org = type;}}};
    return {title:title, checkers:checkers, handlers:handlers};
}

LDR.OMR.StandardizeFileNames = function(setNumber) {
    let setNumberPrefix = setNumber + ' - ';
    let lp = setNumberPrefix.length;
    let title = "Click here to ensure all file headers follow the standard <pre>0 FILE " + 
      setNumberPrefix + "MODEL NAME.ldr\n0 MODEL NAME\n0 Name: " + setNumberPrefix + "MODEL NAME.ldr</pre>";

    let checkPartType = function(pt) {
        if(!pt.isPart()) { // Not a part: Check that all 3 lines are well-formed:
            if(!pt.name.toLowerCase().endsWith('.ldr')) {
                return true;
            }
            if(!pt.name.startsWith(setNumberPrefix)) {
                return true;
            }
            let desc = pt.name.substring(lp, pt.name.length-4);
            return pt.modelDescription !== desc;
        }
        else { // Check a part for inconsistencies:
            if(!pt.name.toLowerCase().endsWith('.dat')) {
                return true;
            }
            if(pt.ldraw_org === 'Unofficial_Part') {
                if(!pt.name.startsWith(setNumberPrefix)) {
                    return true;
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
        else { // Handle a part:
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

    return {title:title, checkers:{checkPartType:checkPartType}, handlers:{handlePartType:handlePartType}};
}

// TODO: Inline unofficial parts (Use !BRICKHUB_INLINED values to detect)

// TODO: Ensure history lines are well formed.

// TODO: Check for official versions of parts

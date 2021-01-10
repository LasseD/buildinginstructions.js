'use strict';

/**
LDCad generated elements: http://www.melkert.net/LDCad/tech/meta
 */
LDR.LDCAD = {};

LDR.LDCAD.handleCommentLine = function(pt, parts) {
    if(parts.length < 3) {
        return false;
    }
    if(parts[1] !== '!LDCAD') {
        return false;
    }
    
    // If 'GENERATED', then mark the part type as a part:
    if(parts[2] === 'GENERATED') {
        pt.computeIsPart = () => true;
        pt.ldCadGenerated = true;
    }

    // TODO: Generate geometries.
    //console.log('Handling LDCad line', parts[2]);
    
    pt.headerLines.push(new LDR.Line0(parts.slice(1).join(' ')));
    return true;
}

LDR.LDCAD.handlePart = function(loader, pt) {
    if(pt.ldCadGenerated && pt.steps.length > 0) {
        // Fix the description set Bricklink ID (LDR.BL[ID->BL]):
        // If sub models contain a shortcut, then use it:
        let step = pt.steps[0];
        for(let i = 0; i < step.subModels.length; i++) {
            let pt2 = loader.getPartType(step.subModels[i].ID);
            if(pt2 && pt2.ldraw_org && pt2.ldraw_org.startsWith('Shortcut')) {
                pt.modelDescription = pt2.modelDescription;
                let noSuffix1 = pt.ID.slice(0, -4);
                let noSuffix2 = pt2.ID.slice(0, -4); // LDR.BL (See 32123a in pli.js)
                LDR.BL[noSuffix1] = LDR.BL.hasOwnProperty(noSuffix2) ? LDR.BL[noSuffix2] : noSuffix2; // Ensure that LDR.BL is applied on parts, such as PF motors where BrickLink uses c01 suffixes.
                return;
            }
        }
    }
    // TODO
}

THREE.LDRPartType.prototype.encodeHeader = function() {
    return (this.ldCadGenerated ? 4 : 0) + // Introducing bit for ldCadGenerated.
           (this.CCW ? 2 : 0) + 
           (this.certifiedBFC ? 1 : 0);
}

THREE.LDRPartType.prototype.decodeHeader = function(encoded) {
    this.ldCadGenerated = Math.floor(encoded/4) % 2 === 1;
    if(this.ldCadGenerated) {
        this.computeIsPart = () => true;
    }
    this.certifiedBFC = encoded % 2 === 1;
    this.CCW = Math.floor(encoded/2) % 2 === 1;
}

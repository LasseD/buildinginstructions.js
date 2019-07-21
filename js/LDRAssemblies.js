/*
  The assembly manager handles assemblies.
  An assemly is a part which is a collection of parts.
  See the following Example of Minifig parts:
  Hips and Legs (73200) = Minifig Hips (3815) + Leg Right (3816) + Leg Left (3817)

  Colors should also be matched:
  - A part within an assembly whose color is not 16 has to be matched exactly.
  - All parts of color 16 within the assembly must have the same color.
  - If a part within an assembly is of color 16, then so should the first part.
 */
LDR.AssemblyManager = function(loader) {
    this.loader = loader;
    let self = this;

    // Build the lookup map:
    this.map = {};
    function addToMap(mainPart, obj) {
        if(self.map.hasOwnProperty(mainPart)) {
            self.map[mainPart].push(obj);
        }
        else {
            self.map[mainPart] = [obj];
        }
    }

    for(ID in LDR.Assemblies) {
        if(!LDR.Assemblies.hasOwnProperty(ID)) {
            continue;
        }
        let parts = LDR.Assemblies[ID];
        let mainPart = parts[0]+'.dat', mainColor = parts[1];
        parts = parts.slice(2);

        let keys = [];
        for(let i = 0; i < parts.length; i+=2) {
            keys.push(parts[i] + '.dat_' + parts[i+1]);
        }

        let obj = {ID:ID+'.dat',c:mainColor,keys:keys};
        addToMap(mainPart, obj);
    }

    // Add torsos:
    function handleTorsosInStep(step) {
	// Try to find a torso, two arms and two hands:
	let torso = step.subModels.find(sm => sm.ID.length >= 10 && sm.ID.startsWith('973') && sm.ID.endsWith('.dat')); if(!torso) return; // No torsos.
        let ID = torso.ID.substring(0, torso.ID.length-4) + 'c01.dat'; // Assembly ID
        if(self.loader.partTypes.hasOwnProperty(ID)) {
            return; // Already built.
        }
	let armLeft = step.subModels.find(sm => sm.ID.startsWith('3819') && sm.ID.endsWith('.dat')); if(!armLeft) return; // Missing left arm.
	let armRight = step.subModels.find(sm => sm.ID.startsWith('3818') && sm.ID.endsWith('.dat')); if(!armRight) return; // Missing right arm.
	let hand = step.subModels.find(sm => sm.ID.startsWith('3820') && sm.ID.endsWith('.dat')); if(!hand) return; // Only need one to get the color
            
        // New torso part type:
        let torsoStep = new THREE.LDRStep();
        let zeroVector = new THREE.Vector3();
        let idMatrix = new THREE.Matrix3(); idMatrix.set(1, 0, 0, 0, 1, 0, 0, 0, 1);

        // Torso:
        torsoStep.addSubModel(new THREE.LDRPartDescription(torso.colorID, zeroVector, idMatrix, torso.ID, true, false));
	
        // Arms:
        let armMatrix1 = new THREE.Matrix3(); armMatrix1.set(1, 0.17, 0, -0.17, 1, 0, 0, 0, 1);
        torsoStep.addSubModel(new THREE.LDRPartDescription(armLeft.colorID, new THREE.Vector3(15.5, 8, 0), armMatrix1, armLeft.ID, true, false));
        let armMatrix2 = new THREE.Matrix3(); armMatrix2.set(1, -0.17, 0, 0.17, 1, 0, 0, 0, 1);
        torsoStep.addSubModel(new THREE.LDRPartDescription(armRight.colorID, new THREE.Vector3(-15.5, 8, 0), armMatrix2, armRight.ID, true, false));
	
        // Hands:
        let handMatrix1 = new THREE.Matrix3(); handMatrix1.set(1, 0.12, -0.12, -0.17, 0.697, -0.697, 0, 0.707, 0.707);
        torsoStep.addSubModel(new THREE.LDRPartDescription(hand.colorID, new THREE.Vector3(23.658, 25.851, -10), handMatrix1, hand.ID, true, false));
        let handMatrix2 = new THREE.Matrix3(); handMatrix2.set(1, -0.12, 0.12, 0.17, 0.697, -0.697, 0, 0.707, 0.707);
        torsoStep.addSubModel(new THREE.LDRPartDescription(hand.colorID, new THREE.Vector3(-23.658, 25.851, -10), handMatrix2, hand.ID, true, false));
	
        // Torso part type:
        let torsoPT = new THREE.LDRPartType();
	let pt = loader.getPartType(torso.ID);
        torsoPT.name = torsoPT.ID = ID;
        torsoPT.modelDescription = LDR.Colors[torso.colorID].name + ' ' + pt.modelDescription + ' / ';
	if(armLeft.colorID === armRight.colorID) {
	    torsoPT.modelDescription += LDR.Colors[armLeft.colorID].name + ' Arms';
	}
	else {
	    torsoPT.modelDescription += LDR.Colors[armLeft.colorID].name + ' Left Arm / ' +
		LDR.Colors[armRight.colorID].name + ' Right Arm';
	}
	torsoPT.modelDescription += ' / ' + LDR.Colors[hand.colorID].name + ' Hands';
        torsoPT.author = 'LDRAssemblies.js';
        torsoPT.license = 'Redistributable under CCAL version 2.0 : see CAreadme.txt';
        torsoPT.ldraw_org = 'Unofficial_Part';
        torsoPT.inlined = 'UNOFFICIAL';
        torsoPT.cleanSteps = torsoPT.certifiedBFC = torsoPT.CCW = torsoPT.consistentFileAndName = true;
        torsoPT.steps = [torsoStep];
        self.loader.partTypes[ID] = torsoPT;
	
        let keys = [armLeft.ID + '_' + armLeft.colorID, 
		    armRight.ID + '_' + armRight.colorID,
		    hand.ID + '_' + hand.colorID,
		    hand.ID + '_' + hand.colorID];
        let obj = {ID:ID,c:16,keys:keys};
        addToMap(pt.ID, obj);
    }
    loader.applyOnPartTypes(pt => pt.steps.forEach(handleTorsosInStep));
}

LDR.AssemblyManager.prototype.handleStep = function(step) {
    let self = this;
    let ret = []; // Parts to be fetched.

    // First find all sub models that are main models of assemblies:
    function handleSubModel(sm, idx) {
        if(sm.REMOVE || !self.map.hasOwnProperty(sm.ID)) {
            return; // Not part of an assembly.
        }

        let aList = self.map[sm.ID];
        for(let i = 0; i < aList.length; i++) { // Try to build all assemblies that have sm as main model:
            let obj = aList[i]; // {ID, c, keys}
            if(obj.c !== 16 && obj.c !== sm.colorID) {
                continue; // Color does not match.
            }
            
            let remainingParts = {};
            obj.keys.forEach(key => {
                    if(remainingParts.hasOwnProperty(key)) {
                        remainingParts[key] = remainingParts[key]+1;
                    }
                    else {
                        remainingParts[key] = 1;
                    }
                });
            function decrease(key) {
                if(remainingParts.hasOwnProperty(key)) {
                    let cnt = remainingParts[key] - 1;
                    if(cnt === 0) {
                        delete remainingParts[key];
                    }
                    else {
                        remainingParts[key] = cnt;
                    }
                    return true;
                }
                return false; // Key not found.
            }

            // First check that all parts are in the step:
            let found = []; // Indices of found parts
            step.subModels.forEach((sm2, idx2) => {
                    if(idx2 === idx || sm2.REPLACEMENT_PLI) {
                        return; // Main model or already removed.
                    }

                    if(sm2.colorID !== 16) { // Attempt to find exact match:
                        if(decrease(sm2.ID + '_' + sm2.colorID)) {
                            found.push({idx:idx2,c:sm2.colorID});
                            return;
                        }
                        // When color is not 16 and not found, then it has to match main model:
                    }

                    if(sm2.colorID === sm.colorID && decrease(sm2.ID + '_16')) {
                        found.push({idx:idx2,c:16});
                    }
                });

            if(found.length !== obj.keys.length) {
                continue; // Not a match.
            }

            // Assembly found! Update step:
            found.forEach(f => step.subModels[f.idx].REPLACEMENT_PLI = true);
	    sm.REPLACEMENT_PLI = obj.ID;
	    if(!self.loader.partTypes.hasOwnProperty(obj.ID)) {
		ret.push(obj.ID);
	    }
        } // for elements in aList = map[sm.ID]
    } // function handleSubModel
    step.subModels.forEach(handleSubModel);
    return ret;
}

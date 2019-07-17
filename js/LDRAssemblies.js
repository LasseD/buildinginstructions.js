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

    // Build the lookup map:
    this.map = {};
    for(ID in LDR.Assemblies) {
        if(!LDR.Assemblies.hasOwnProperty(ID)) {
            continue;
        }
        let parts = LDR.Assemblies[ID];
        let desc = parts[0];
        let mainPart = parts[1]+'.dat', mainColor = parts[2];
        parts = parts.slice(3);

        // If sm.colorID=16 => sm2.colorID=16
        let keys = [];
        for(let i = 0; i < parts.length; i+=2) {
            keys.push(parts[i] + '.dat_' + parts[i+1]);
        }

        let obj = {ID:ID+'.dat',c:mainColor,keys:keys,desc:desc};
        if(this.map.hasOwnProperty(mainPart)) {
            this.map[mainPart].push(obj);
        }
        else {
            this.map[mainPart] = [obj];
        }
    }
    console.log('AssemblyManager built:'); console.dir(this.map);
}

LDR.AssemblyManager.prototype.handleStep = function(step) {
    let self = this;

    // First find all sub models that are main models of assemblies:
    function handleSubModel(sm, idx) {
        if(sm.REMOVE || !self.map.hasOwnProperty(sm.ID)) {
            return; // Not part of an assembly.
        }

        let aList = self.map[sm.ID];
        for(let i = 0; i < aList.length; i++) { // Try to build all assemblies that have sm as main model:
            let obj = aList[i]; // {ID, c, keys, desc}
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
                    if(idx2 === idx || sm2.REMOVE) {
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
            console.log('Replacing ' + sm.ID + ' with ' + obj.ID);
            found.forEach(f => step.subModels[f.idx].REMOVE = true);

            if(!self.loader.getPartType(obj.ID)) {
                let step2 = new THREE.LDRStep();
                
                let origo = new THREE.Matrix3(); origo.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
                let smCopy = new THREE.LDRPartDescription(obj.c, new THREE.Vector3(), origo, sm.ID, true, false);
                step2.addSubModel(smCopy);

                found.forEach(f => {
                        let sm3 = step.subModels[f.idx];
                        sm3.colorID = f.c;
                        step2.addSubModel(sm3);
                    });

                let pt = new THREE.LDRPartType();
                pt.name = pt.ID = obj.ID;
                pt.modelDescription = obj.desc;
                pt.author = 'LDRAssemblies.js';
                pt.license = 'Redistributable under CCAL version 2.0 : see CAreadme.txt';
                pt.inlined = 'GENERATED';
                pt.ldraw_org = 'Part';
                pt.cleanSteps = pt.certifiedBFC = pt.CCW = pt.consistentFileAndName = true;
                pt.steps = [step2];

                self.loader.partTypes[obj.ID] = pt;
            }
            sm.ID = obj.ID;
        } // for elements in aList = map[sm.ID]
    } // function handleSubModel
    step.subModels.forEach(handleSubModel);
    step.subModels = step.subModels.filter(sm => !sm.REMOVE);
}

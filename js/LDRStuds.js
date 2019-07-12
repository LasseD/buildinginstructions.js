'use strict'

LDR.Studs = {}; // Studs namespace

LDR.Studs.setStuds = function(ldrLoader, highContrast, logoType, onDone) {
    console.log('Creating studs. High contrast: ' + highContrast + ' logo type: ' + logoType);

    let idb = []; // Primitives that we know are needed and would like to see fetched using ClientStorage:
    let partTypes = ldrLoader.partTypes;
    idb.push(...LDR.Studs.setStud1(partTypes, highContrast, logoType));
    idb.push(...LDR.Studs.setStud2(partTypes, highContrast, logoType));
    idb.push(...LDR.Studs.setStud2a(partTypes, highContrast));

    if(logoType > 0) {
        let logoID = 'logo' + (logoType === 1 ? '' : logoType) + '.dat';
        if(!partTypes.hasOwnProperty(logoID)) {
            idb.push(logoID);
        }
    }

    if(idb.length === 0) {
        onDone();
    }
    else {
        // Build a different loader to fetch these two since we have to wait for the callback:
        let loader2 = new THREE.LDRLoader(onDone, ldrLoader.storage, ldrLoader.options);
        loader2.partTypes = ldrLoader.partTypes; // Load to same data store.
        loader2.loadMultiple(idb);
    }
}

LDR.Studs.setStud1 = function(partTypes, highContrast, logoType) {
    let pt = LDR.Generator.makeP('Stud', 'stud.dat');
    let step = new THREE.LDRStep();

    let toFetch = ['4-4edge.dat', '4-4disc.dat'];

    // Common positions and rotations:
    let p0 = new THREE.Vector3();
    let r11 = LDR.Generator.makeR(1, 1);
    let r61 = LDR.Generator.makeR(6, 1);
    step.addSubModel(new THREE.LDRPartDescription(16, p0, r61, '4-4edge.dat', true, false));

    if(logoType < 2) {
        var p4 = new THREE.Vector3(0, -4, 0); // 'var' allows drop-through.
        var r64 = LDR.Generator.makeR(6, -4);
        // Stud type one actually uses a 4-4cylc.dat, but then high contrast does not work!
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r61, '4-4edge.dat', true, false));
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r61, '4-4disc.dat', true, false));
    }
    else {
        var p34 = new THREE.Vector3(0, -3.4, 0);
        var p38 = new THREE.Vector3(0, -3.8, 0);
        var r64 = LDR.Generator.makeR(6, -3.4);
        var r5656 = LDR.Generator.makeR(5.6, -5.6);
        var r561 = LDR.Generator.makeR(5.6, 1);

        step.addSubModel(new THREE.LDRPartDescription(16, p34, r5656, 't01o0714.dat', true, false));
        step.addSubModel(new THREE.LDRPartDescription(16, p38, r561, '4-4disc.dat', true, false));
        toFetch.push('t01o0714.dat');
    }

    // Cylinder:
    if(highContrast) {
        step.addSubModel(new THREE.LDRPartDescription(0, p0, r64, '4-4cyli2.dat', true, false));
        toFetch.push('4-4cyli2.dat');
    }
    else {
        step.addSubModel(new THREE.LDRPartDescription(16, p0, r64, '4-4cyli.dat', true, false));
        toFetch.push('4-4cyli.dat');
    }

    // Logo:
    if(logoType === 1) {
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r11, 'logo.dat', true, false));
        toFetch.push('logo.dat');
    }
    else if(logoType > 1) {
        step.addSubModel(new THREE.LDRPartDescription(16, p38, r11, 'logo' + logoType + '.dat', true, false));
        toFetch.push('logo' + logoType + '.dat');
    }

    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    partTypes[pt.ID] = pt;
    return toFetch;
}

LDR.Studs.setStud2a = function(partTypes, highContrast) {
    let pt = LDR.Generator.makeP('Stud Open without Base Edges', 'stud2a.dat');
    let step = new THREE.LDRStep();
    
    let toFetch = ['4-4edge.dat', '4-4cyli2.dat', '4-4ring2.dat'];

    let p0 = new THREE.Vector3();
    let p4 = new THREE.Vector3(0, -4, 0);
    let r41 = LDR.Generator.makeR(4, 1);
    let r61 = LDR.Generator.makeR(6, 1);
    let r44 = LDR.Generator.makeR(4, 4);
    let r64 = LDR.Generator.makeR(6, 4);
    let r21 = LDR.Generator.makeR(2, 1);

    step.addSubModel(new THREE.LDRPartDescription(16, p4, r41, '4-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r61, '4-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r44, '4-4cyli2.dat', true, true)); // inverted. Consider if the conditional lines should be included ot not.
    if(highContrast) {
        step.addSubModel(new THREE.LDRPartDescription(0, p4, r64, '4-4cyli2.dat', true, false));
    }
    else {
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r64, '4-4cyli.dat', true, false));
        toFetch.push('4-4cyli.dat');
    }
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r21, '4-4ring2.dat', true, false));

    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    partTypes[pt.ID] = pt;
    return toFetch;
}

LDR.Studs.setStud2 = function(partTypes, highContrast, logoType) {
    let pt = LDR.Generator.makeP('Stud Open', 'stud2.dat');
    let step = new THREE.LDRStep();

    let p0 = new THREE.Vector3();
    let p4 = new THREE.Vector3(0, -4, 0);
    let r41 = LDR.Generator.makeR(4, 1);
    let r61 = LDR.Generator.makeR(6, 1);
    let r44 = LDR.Generator.makeR(4, 4);
    let r64 = LDR.Generator.makeR(6, 4);
    let r21 = LDR.Generator.makeR(2, 1);

    let toFetch = ['4-4edge.dat', '4-4cyli2.dat'];

    step.addSubModel(new THREE.LDRPartDescription(16, p0, r41, '4-4edge.dat', true, false));

    if(logoType < 2) {
        // 1 16 0 -4 0 6 0 0 0 1 0 0 0 6 4-4edge.dat
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r61, '4-4edge.dat', true, false));
        // 1 16 0 -4 0 2 0 0 0 1 0 0 0 2 4-4ring2.dat
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r21, '4-4ring2.dat', true, false));
        // 1 16 0 -4 0 6 0 0 0 4 0 0 0 6 4-4cyli.dat
        if(highContrast) {
            step.addSubModel(new THREE.LDRPartDescription(0, p4, r64, '4-4cyli2.dat', true, false));
        }
        else {
            step.addSubModel(new THREE.LDRPartDescription(16, p4, r64, '4-4cyli.dat', true, false));
            toFetch.push('4-4cyli.dat');
        }
        toFetch.push('4-4ring2.dat');
    }
    else {
        let p36 = new THREE.Vector3(0, -3.6, 0);
        let r636 = LDR.Generator.makeR(6, 3.6);
        // 1 16 0 -3.6 0 6 0 0 0 3.6 0 0 0 6 4-4cyli.dat
        if(highContrast) {
            step.addSubModel(new THREE.LDRPartDescription(0, p36, r636, '4-4cyli2.dat', true, false));
        }
        else {
            step.addSubModel(new THREE.LDRPartDescription(16, p36, r636, '4-4cyli.dat', true, false));
            toFetch.push('4-4cyli.dat');
        }
        
        let r081 = LDR.Generator.makeR(0.8, 1);
        // 1 16 0 -4 0 0.8 0 0 0 1 0 0 0 0.8 4-4ring5.dat
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r081, '4-4ring5.dat', true, false));
        // 1 16 0 -4 0 0.8 0 0 0 1 0 0 0 0.8 4-4ring6.dat
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r081, '4-4ring6.dat', true, false));

        var r5656 = LDR.Generator.makeR(5.6, -5.6);
        // 1 16 0 -3.6 0 5.6 0 0 0 -5.6 0 0 0 5.6 t01o0714.dat
        step.addSubModel(new THREE.LDRPartDescription(16, p36, r5656, 't01o0714.dat', true, false));
        toFetch.push('4-4ring5.dat', '4-4ring6.dat', 't01o0714.dat');
    }

    step.addSubModel(new THREE.LDRPartDescription(16, p0, r61, '4-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r41, '4-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r44, '4-4cyli2.dat', true, true)); // inverted. Consider if the conditional lines should be included ot not.

    // Logo:
    if(logoType === 1) {
        // 1 16 0 0 0 0.6 0 0 0 1 0 0 0 0.6 logo.dat:
        let r061 = LDR.Generator.makeR(0.6, 1);
        step.addSubModel(new THREE.LDRPartDescription(16, p0, r061, 'logo.dat', true, false));
        toFetch.push('logo.dat');
    }
    else if(logoType > 1) {
        // 1 16 0 0 0 0.62 0 0 0 0.62 0 0 0 0.62 logoX.dat
        let r062062 = LDR.Generator.makeR(0.62, 0.62);
        step.addSubModel(new THREE.LDRPartDescription(16, p0, r062062, 'logo' + logoType + '.dat', true, false));
        toFetch.push('logo' + logoType + '.dat');
    }

    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    partTypes[pt.ID] = pt;
    return toFetch;
}

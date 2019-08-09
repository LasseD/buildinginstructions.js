'use strict'

LDR.Studs = {}; // Studs namespace

LDR.Studs.setStuds = function(ldrLoader, highContrast, logoType, onDone) {
    console.log('Creating studs. High contrast: ' + highContrast + ' logo type: ' + logoType);

    let partTypes = ldrLoader.partTypes;
    let idb = []; // Primitives that we know are needed and would like to see fetched using ClientStorage:
    let force = ldrLoader.options.force ? (ldrLoader.options.force+'/') : ''; // Either 8, 48 or undefined.
    let studs = [
	LDR.Studs.makeStud1(idb, highContrast, logoType, force, true),
	LDR.Studs.makeStud1(idb, highContrast, logoType, force, false),
	LDR.Studs.makeStud2(idb, highContrast, logoType, force),
	LDR.Studs.makeStud2a(idb, highContrast, force),
	LDR.Studs.makeStudP01(idb, highContrast, logoType, force),
	LDR.Studs.makeStudEl(idb, highContrast, logoType, force),
	// TODO: Other types
    ];

    if(logoType > 0) {
        let logoID = 'logo' + (logoType === 1 ? '' : logoType) + '.dat';
        if(!partTypes.hasOwnProperty(logoID)) {
            idb.push(logoID);
        }
    }

    function loadStuds() {
	studs.forEach(s => partTypes[s.ID] = s);
        onDone();
    }

    if(idb.length === 0) {
        loadStuds();
    }
    else {
        // Build a different loader to fetch these two since we have to wait for the callback:
        let loader2 = new THREE.LDRLoader(loadStuds, ldrLoader.storage, ldrLoader.options);
        loader2.partTypes = partTypes; // Load to same data store.
        loader2.loadMultiple(idb);
    }
}

LDR.Studs.makeStud1 = function(toFetch, highContrast, logoType, force, withoutBaseEdge) {
    let pt = LDR.Generator.makeP('Stud' + (withoutBaseEdge ? ' without Base Edges':''), withoutBaseEdge ? 'studa.dat' : 'stud.dat');
    let step = new THREE.LDRStep();

    toFetch.push(force+'4-4edge.dat', force+'4-4disc.dat');

    // Common positions and rotations:
    let p0 = new THREE.Vector3();
    let r11 = LDR.Generator.makeR(1, 1);
    let r61 = LDR.Generator.makeR(6, 1);
    if(!withoutBaseEdge) {
	step.addSubModel(new THREE.LDRPartDescription(16, p0, r61, force+'4-4edge.dat', true, false));
    }

    if(logoType < 2) {
        var p4 = new THREE.Vector3(0, -4, 0); // 'var' used for drop-through.
        var r64 = LDR.Generator.makeR(6, -4); // 'var' used for drop-through.
        // Stud type one actually uses a 4-4cylc.dat, but then high contrast does not work!
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r61, force+'4-4edge.dat', true, false));
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r61, force+'4-4disc.dat', true, false));
    }
    else {
        let p34 = new THREE.Vector3(0, -3.4, 0);
        var p38 = new THREE.Vector3(0, -3.8, 0); // 'var' used for drop-through.
        var r64 = LDR.Generator.makeR(6, -3.4); // 'var' used for drop-through.
        let r5656 = LDR.Generator.makeR(5.6, -5.6);
        let r561 = LDR.Generator.makeR(5.6, 1);

        step.addSubModel(new THREE.LDRPartDescription(16, p34, r5656, 't01o0714.dat', true, false));
        step.addSubModel(new THREE.LDRPartDescription(16, p38, r561, force+'4-4disc.dat', true, false));
        toFetch.push('t01o0714.dat');
    }

    // Cylinder:
    if(highContrast) {
        step.addSubModel(new THREE.LDRPartDescription(0, p0, r64, force+'4-4cyli2.dat', true, false));
        toFetch.push(force+'4-4cyli2.dat');
    }
    else {
        step.addSubModel(new THREE.LDRPartDescription(16, p0, r64, force+'4-4cyli.dat', true, false));
        toFetch.push(force+'4-4cyli.dat');
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

    pt.steps.push(step);
    return pt;
}

LDR.Studs.makeStud2a = function(toFetch, highContrast, force) {
    let pt = LDR.Generator.makeP('Stud Open without Base Edges', 'stud2a.dat');
    let step = new THREE.LDRStep();
    
    toFetch.push(force+'4-4edge.dat', force+'4-4cyli2.dat', force+'4-4ring2.dat');

    let p0 = new THREE.Vector3();
    let p4 = new THREE.Vector3(0, -4, 0);
    let r41 = LDR.Generator.makeR(4, 1);
    let r61 = LDR.Generator.makeR(6, 1);
    let r44 = LDR.Generator.makeR(4, 4);
    let r64 = LDR.Generator.makeR(6, 4);
    let r21 = LDR.Generator.makeR(2, 1);

    step.addSubModel(new THREE.LDRPartDescription(16, p4, r41, force+'4-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r61, force+'4-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r44, force+'4-4cyli2.dat', true, true)); // inverted. Consider if the conditional lines should be included ot not.
    if(highContrast) {
        step.addSubModel(new THREE.LDRPartDescription(0, p4, r64, force+'4-4cyli2.dat', true, false));
    }
    else {
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r64, force+'4-4cyli.dat', true, false));
        toFetch.push('4-4cyli.dat');
    }
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r21, force+'4-4ring2.dat', true, false));

    pt.steps.push(step);
    return pt;
}

LDR.Studs.makeStud2 = function(toFetch, highContrast, logoType, force) {
    let pt = LDR.Generator.makeP('Stud Open', 'stud2.dat');
    let step = new THREE.LDRStep();

    let p0 = new THREE.Vector3();
    let p4 = new THREE.Vector3(0, -4, 0);
    let r41 = LDR.Generator.makeR(4, 1);
    let r61 = LDR.Generator.makeR(6, 1);
    let r44 = LDR.Generator.makeR(4, 4);
    let r64 = LDR.Generator.makeR(6, 4);
    let r21 = LDR.Generator.makeR(2, 1);

    toFetch.push(force+'4-4edge.dat', force+'4-4cyli2.dat');

    step.addSubModel(new THREE.LDRPartDescription(16, p0, r41, force+'4-4edge.dat', true, false));

    if(logoType < 2) {
        // 1 16 0 -4 0 6 0 0 0 1 0 0 0 6 4-4edge.dat
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r61, force+'4-4edge.dat', true, false));
        // 1 16 0 -4 0 2 0 0 0 1 0 0 0 2 4-4ring2.dat
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r21, force+'4-4ring2.dat', true, false));
        // 1 16 0 -4 0 6 0 0 0 4 0 0 0 6 4-4cyli.dat
        if(highContrast) {
            step.addSubModel(new THREE.LDRPartDescription(0, p4, r64, force+'4-4cyli2.dat', true, false));
        }
        else {
            step.addSubModel(new THREE.LDRPartDescription(16, p4, r64, force+'4-4cyli.dat', true, false));
            toFetch.push(force+'4-4cyli.dat');
        }
        toFetch.push(force+'4-4ring2.dat');
    }
    else {
        let p36 = new THREE.Vector3(0, -3.6, 0);
        let r636 = LDR.Generator.makeR(6, 3.6);
        // 1 16 0 -3.6 0 6 0 0 0 3.6 0 0 0 6 4-4cyli.dat
        if(highContrast) {
            step.addSubModel(new THREE.LDRPartDescription(0, p36, r636, force+'4-4cyli2.dat', true, false));
        }
        else {
            step.addSubModel(new THREE.LDRPartDescription(16, p36, r636, force+'4-4cyli.dat', true, false));
            toFetch.push(force+'4-4cyli.dat');
        }
        
        let r081 = LDR.Generator.makeR(0.8, 1);
        // 1 16 0 -4 0 0.8 0 0 0 1 0 0 0 0.8 4-4ring5.dat
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r081, force+'4-4ring5.dat', true, false));
        // 1 16 0 -4 0 0.8 0 0 0 1 0 0 0 0.8 4-4ring6.dat
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r081, force+'4-4ring6.dat', true, false));

        let r5656 = LDR.Generator.makeR(5.6, -5.6);
        // 1 16 0 -3.6 0 5.6 0 0 0 -5.6 0 0 0 5.6 t01o0714.dat
        step.addSubModel(new THREE.LDRPartDescription(16, p36, r5656, 't01o0714.dat', true, false));
        toFetch.push(force+'4-4ring5.dat', force+'4-4ring6.dat', 't01o0714.dat');
    }

    step.addSubModel(new THREE.LDRPartDescription(16, p0, r61, force+'4-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r41, force+'4-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r44, force+'4-4cyli2.dat', true, true)); // inverted. Consider if the conditional lines should be included ot not.

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

    pt.steps.push(step);
    return pt;
}

LDR.Studs.makeStudP01 = function(toFetch, highContrast, logoType, force) {
    let pt = LDR.Generator.makeP('Stud with Dot Pattern', 'studp01.dat');
    let step = new THREE.LDRStep();

    toFetch.push(force+'4-4edge.dat', force+'4-4disc.dat', force+'4-4ring2.dat');

    // Common positions and rotations:
    let p0 = new THREE.Vector3();
    let p4 = new THREE.Vector3(0, -4, 0);

    let r61 = LDR.Generator.makeR(6, 1);
    let r64 = LDR.Generator.makeR(6, -4);
    let r21 = LDR.Generator.makeR(2, 1);
    let r41 = LDR.Generator.makeR(4, 1);

    step.addSubModel(new THREE.LDRPartDescription(16, p0, r61, force+'4-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r61, force+'4-4edge.dat', true, false));
    if(highContrast) {
        step.addSubModel(new THREE.LDRPartDescription(0, p0, r64, force+'4-4cyli2.dat', true, false));
        toFetch.push(force+'4-4cyli2.dat');
    }
    else {
        step.addSubModel(new THREE.LDRPartDescription(16, p0, r64, force+'4-4cyli.dat', true, false));
        toFetch.push(force+'4-4cyli.dat');
    }
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r21, force+'4-4ring2.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(15, p4, r41, force+'4-4disc.dat', true, false));

    // Logo:
    if(logoType === 1) { // Only logo type 1 is supported.
	let r11 = LDR.Generator.makeR(1, 1);
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r11, 'logo.dat', true, false));
        toFetch.push('logo.dat');
    }
    
    pt.steps.push(step);
    return pt;
}

LDR.Studs.makeStudEl = function(toFetch, highContrast, logoType, force) {
    let pt = LDR.Generator.makeP('Stud with Electric Contact', 'studel.dat');
    let step = new THREE.LDRStep();

    toFetch.push(force+'4-4edge.dat',
		 force+'1-4edge.dat',
		 force+'3-4cyli.dat',
		 force+'1-4cyli.dat',
		 force+'4-4cyli.dat',
		 force+'4-4disc.dat',
		);

    // Common positions and rotations:
    let p0 = new THREE.Vector3();
    let p3 = new THREE.Vector3(0, -3, 0);
    let p4 = new THREE.Vector3(0, -4, 0);

    let contrastColor = highContrast ? 0 : 16;

    // 1 16 0 0 0 6 0 0 0 1 0 0 0 6 4-4edge.dat
    let r61 = LDR.Generator.makeR(6, 1);
    step.addSubModel(new THREE.LDRPartDescription(16, p0, r61, force+'4-4edge.dat', true, false));

    // 1 16 0 -4 0 6 0 0 0 1 0 0 0 6 4-4edge.dat
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r61, force+'4-4edge.dat', true, false));

    // 1 16 0 0 0 0 0 6 0 -3 0 -6 0 0 3-4cyli.dat
    let r063 = new THREE.Matrix3(); r063.set(0, 0, 6, 0, -3, 0, -6, 0, 0);
    step.addSubModel(new THREE.LDRPartDescription(contrastColor, p0, r063, force+'3-4cyli.dat', true, false));

    // 1 16 0 -3 0 0 0 6 0 -1 0 -6 0 0 4-4cyli.dat
    let r061 = new THREE.Matrix3(); r061.set(0, 0, 6, 0, -1, 0, -6, 0, 0);
    step.addSubModel(new THREE.LDRPartDescription(contrastColor, p3, r061, force+'4-4cyli.dat', true, false));

    // 1 494 0 0 0 -6 0 0 0 -3 0 0 0 -6 1-4cyli.dat
    let r63 = LDR.Generator.makeR(-6, -3);
    step.addSubModel(new THREE.LDRPartDescription(494, p0, r63, force+'1-4cyli.dat', true, false));

    // 1 16 0 -3 0 -6 0 0 0 1 0 0 0 -6 1-4edge.dat
    let rn61 = LDR.Generator.makeR(-6, 1);
    step.addSubModel(new THREE.LDRPartDescription(16, p3, rn61, force+'1-4edge.dat', true, false));

    // 2 24 -6 0 0 -6 -3 0
    step.addLine(24, new THREE.Vector3(-6, 0, 0), new THREE.Vector3(-6, -3, 0));

    // 2 24 0 0 -6 0 -3 -6
    step.addLine(24, new THREE.Vector3(0, 0, -6), new THREE.Vector3(0, -3, -6));

    // 1 16 0 -4 0 6 0 0 0 1 0 0 0 6 4-4disc.dat
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r61, force+'4-4disc.dat', true, false));

    // Logo:
    if(logoType === 1) { // Only logo type 1 is supported.
	let r11 = new THREE.Matrix3(); r11.set(0, 0, -1, 0, 1, 0, 1, 0, 0);
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r11, 'logo.dat', true, false));
        toFetch.push('logo.dat');
    }
    
    pt.steps.push(step);
    return pt;
}

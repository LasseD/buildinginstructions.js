'use strict'

/**
 * @author Lasse Deleuran | c-mt.dk and brickhub.org
 *
 * LDRStuds.js is used to generate studs with the desired "LEGO" logo.
 *
 * Stud parts can be modified by changing:
 * - hc / high contrast: Color the cylinder around the stud black when set to true.
 * - logo type:
 *  - 0: No logo
 *  - 1: Logo using simple lines (see logo.dat from LDraw)
 *  - 2: Quick draw logos using textures (for physical renderings)
 * - force: Force low/high resolution primitives to be used in the stud
 */
LDR.Studs = {}; // Studs namespace

LDR.Studs.all = [
    (hc, logoType, force) => LDR.Studs.stud1(hc, logoType, force, true),
    (hc, logoType, force) => LDR.Studs.stud1(hc, logoType, force, false),
    (hc, logoType, force) => LDR.Studs.stud2(hc, logoType, force),
    (hc, logoType, force) => LDR.Studs.stud2a(hc, force),
    (hc, logoType, force) => LDR.Studs.stud6(hc, logoType, force, true),
    (hc, logoType, force) => LDR.Studs.stud6(hc, logoType, force, false),
    (hc, logoType, force) => LDR.Studs.stud10(hc, logoType, force),
    (hc, logoType, force) => LDR.Studs.stud13(hc, logoType, force),
    (hc, logoType, force) => LDR.Studs.stud15(hc, logoType, force),
    (hc, logoType, force) => LDR.Studs.stud17(hc, logoType, force, true),
    (hc, logoType, force) => LDR.Studs.stud17(hc, logoType, force, false),
    (hc, logoType, force) => LDR.Studs.studP01(hc, logoType, force),
    (hc, logoType, force) => LDR.Studs.studEl(hc, logoType, force),
    ];

LDR.Studs.makeGenerators = function(force, highContrast, logoType) {
    if(!LDR.Generator) {
        console.warn('Generators not enabled - skipping stud generation.');
        return;
    }
    LDR.Studs.all.forEach(f => {
        let [pt,id] = f(highContrast, logoType, force);
        pt.id = id + '.dat';
        LDR.Generator.register(id, () => pt);
    });
}

LDR.Studs.setStuds = function(loader, highContrast, logoType, onDone) {
    let partTypes = loader.partTypes;
    let force = loader.options.force ? (loader.options.force+'/') : ''; // Either 8, 48 or undefined.

    let idb = []; // Primitives that we know are needed and would like to see fetched using ClientStorage:
    let seen = {};
    LDR.Studs.all.forEach(f => {
	let [pt,id] = f(highContrast, logoType, force);
        id = id + '.dat';
	if(partTypes.hasOwnProperty(id)) { // Used, so replace and ensure sub models are present:
	    partTypes[id] = pt;
            pt.ID = id;
	    pt.steps.forEach(step => step.subModels.forEach(sm => {
		if(!seen.hasOwnProperty(sm.ID)) {
		    idb.push(sm.ID);
		    seen[sm.ID] = true;
		}
	    }));
	}
    });

    if(idb.length === 0) {
        onDone();
    }
    else {
        // Build a different loader to fetch these two since we have to wait for the callback:
	let options = {};
	for(let option in loader.options) {
	    if(option === 'key' || option === 'timestamp') {
		continue; // Ensure the main model is not saved again.
	    }
	    if(loader.options.hasOwnProperty(option)) {
		options[option] = loader.options[option];
	    }
	}
	
        let loader2 = new THREE.LDRLoader(onDone, loader.storage, options);
        loader2.partTypes = partTypes; // Load to same data store.
        loader2.loadMultiple(idb);
    }
}

LDR.Studs.stud1 = function(highContrast, logoType, force, withoutBaseEdge) {
    let [pt,step] = LDR.Generator.pT('Stud' + (withoutBaseEdge ? ' without Base Edges':''));

    // Common positions and rotations:
    let p0 = new THREE.Vector3();
    let r11 = LDR.Generator.R(1, 1);
    let r61 = LDR.Generator.R(6, 1);
    let p4 = new THREE.Vector3(0, -4, 0);
    let r64 = LDR.Generator.R(6, -4);
    if(!withoutBaseEdge) {
	step.asm(p0, r61, force+'4-4edge');
    }

    // Stud type one actually uses a 4-4cylc.dat, but then high contrast does not work!
    step.asm(p4, r61, force+'4-4edge');

    let logoSM = new THREE.LDRPartDescription(16, p4, r61, force+'4-4disc.dat', true, false);
    step.addSubModel(logoSM);
    if(logoType === 2) {
        logoSM.logoPosition = p4;
    }

    // Cylinder:
    if(highContrast) {
        step.asm(p0, r64, force+'4-4cyli2', 0);
    }
    else {
        step.asm(p0, r64, force+'4-4cyli');
    }

    // Logo:
    if(logoType === 1) {
        step.asm(p4, r11, 'logo');
    }

    return [pt, withoutBaseEdge ? 'studa' : 'stud'];
}

LDR.Studs.stud2a = function(highContrast, force) {
    let [pt,step] = LDR.Generator.pT('Stud Open without Base Edges');
    
    let p0 = new THREE.Vector3();
    let p4 = new THREE.Vector3(0, -4, 0);
    let r41 = LDR.Generator.R(4, 1);
    let r61 = LDR.Generator.R(6, 1);
    let r44 = LDR.Generator.R(4, 4);
    let r64 = LDR.Generator.R(6, 4);
    let r21 = LDR.Generator.R(2, 1);

    step.asm(p4, r41, force+'4-4edge');
    step.asm(p4, r61, force+'4-4edge');
    step.asm(p4, r44, force+'4-4cyli2', 16, true, true); // inverted. Consider if the conditional lines should be included ot not.
    if(highContrast) {
        step.asm(p4, r64, force+'4-4cyli2', 0);
    }
    else {
        step.asm(p4, r64, force+'4-4cyli');
    }
    step.asm(p4, r21, force+'4-4ring2');

    return [pt,'stud2a'];
}

LDR.Studs.stud2 = function(highContrast, logoType, force) {
    let [pt,step] = LDR.Generator.pT('Stud Open');

    let p0 = new THREE.Vector3();
    let p4 = new THREE.Vector3(0, -4, 0);
    let r41 = LDR.Generator.R(4, 1);
    let r61 = LDR.Generator.R(6, 1);
    let r44 = LDR.Generator.R(4, 4);
    let r64 = LDR.Generator.R(6, 4);
    let r21 = LDR.Generator.R(2, 1);
    
    step.asm(p0, r41, force+'4-4edge');
    step.asm(p4, r61, force+'4-4edge');
    step.asm(p4, r21, force+'4-4ring2');
    if(highContrast) {
        step.asm(p4, r64, force+'4-4cyli2', 0);
    }
    else {
        step.asm(p4, r64, force+'4-4cyli');
    }
    
    step.asm(p0, r61, force+'4-4edge');
    step.asm(p4, r41, force+'4-4edge');
    step.asm(p4, r44, force+'4-4cyli2', 16, true, true); // inverted. Consider if the conditional lines should be included ot not.

    // Logo:
    if(logoType === 1) {
        // 1 16 0 0 0 0.6 0 0 0 1 0 0 0 0.6 logo.dat:
        let r061 = LDR.Generator.R(0.6, 1);
        step.asm(p0, r061, 'logo');
    }
    else if(logoType === 2) {
        let p5 = new THREE.Vector3(0, -0.5, 0);

        let logoSM = new THREE.LDRPartDescription(16, p5, r41, force+'4-4disc.dat', true, false);;
        step.addSubModel(logoSM);
        logoSM.logoPosition = p5;
    }

    return [pt, 'stud2'];
}

LDR.Studs.studP01 = function(highContrast, logoType, force) {
    let [pt,step] = LDR.Generator.pT('Stud with Dot Pattern');

    // Common positions and rotations:
    let p0 = new THREE.Vector3();
    let p4 = new THREE.Vector3(0, -4, 0);

    let r61 = LDR.Generator.R(6, 1);
    let r64 = LDR.Generator.R(6, -4);
    let r21 = LDR.Generator.R(2, 1);
    let r41 = LDR.Generator.R(4, 1);

    step.asm(p0, r61, force+'4-4edge');
    step.asm(p4, r61, force+'4-4edge');
    if(highContrast) {
        step.asm(p0, r64, force+'4-4cyli2', 0);
    }
    else {
        step.asm(p0, r64, force+'4-4cyli');
    }
    step.asm(p4, r21, force+'4-4ring2');

    let logoSM = new THREE.LDRPartDescription(16, p4, r41, force+'4-4disc.dat', true, false);
    step.addSubModel(logoSM);
    if(logoType === 2) {
        logoSM.logoPosition = p4;
    }

    // Logo:
    if(logoType === 1) {
	let r11 = LDR.Generator.R(1, 1);
        step.asm(p4, r11, 'logo');
    }
    
    return [pt, 'studp01.dat'];
}

LDR.Studs.studEl = function(highContrast, logoType, force) {
    let [pt,step] = LDR.Generator.pT('Stud with Electric Contact');

    // Common positions and rotations:
    let p0 = new THREE.Vector3();
    let p3 = new THREE.Vector3(0, -3, 0);
    let p4 = new THREE.Vector3(0, -4, 0);

    let cc = highContrast ? 0 : 16;

    let r61 = LDR.Generator.R(6, 1);
    step.asm(p0, r61, force+'4-4edge');

    step.asm(p4, r61, force+'4-4edge');

    let r063 = new THREE.Matrix3(); r063.set(0, 0, 6, 0, -3, 0, -6, 0, 0);
    step.asm(p0, r063, force+'3-4cyli', cc);

    let r061 = new THREE.Matrix3(); r061.set(0, 0, 6, 0, -1, 0, -6, 0, 0);
    step.asm(p3, r061, force+'4-4cyli', cc);

    let r63 = LDR.Generator.R(-6, -3);
    step.asm(p0, r63, force+'1-4cyli', 494);

    let rn61 = LDR.Generator.R(-6, 1);
    step.asm(p3, rn61, force+'1-4edge');

    step.addLine(24, new THREE.Vector3(-6, 0, 0), new THREE.Vector3(-6, -3, 0));

    step.addLine(24, new THREE.Vector3(0, 0, -6), new THREE.Vector3(0, -3, -6));

    let logoSM = new THREE.LDRPartDescription(16, p4, r61, force+'4-4disc.dat', true, false);;
    step.addSubModel(logoSM);
    if(logoType === 2) {
        logoSM.logoPosition = p4;
    }

    // Logo:
    if(logoType === 1) {
	let r11 = new THREE.Matrix3(); r11.set(0, 0, -1, 0, 1, 0, 1, 0, 0);
        step.asm(p4, r11, 'logo');
    }
    
    return [pt, 'studel.dat'];
}

THREE.LDRStep.prototype.acl = function(lines) {
    for(let i = 0; i < lines.length; i+=12) {
	this.addConditionalLine(24,
				new THREE.Vector3(lines[i], lines[i+1], lines[i+2]),
				new THREE.Vector3(lines[i+3], lines[i+4], lines[i+5]),
				new THREE.Vector3(lines[i+6], lines[i+7], lines[i+8]),
				new THREE.Vector3(lines[i+9], lines[i+10], lines[i+11]));
    }
}

THREE.LDRStep.prototype.at = function(triangles, color = 16) {
    for(let i = 0; i < triangles.length; i+=9) {
	this.addTriangle(color,
			 new THREE.Vector3(triangles[i], triangles[i+1], triangles[i+2], true),
			 new THREE.Vector3(triangles[i+3], triangles[i+4], triangles[i+5], true),
			 new THREE.Vector3(triangles[i+6], triangles[i+7], triangles[i+8]), true);
    }
}

THREE.LDRStep.prototype.aq = function(quads, color = 16) {
    for(let i = 0; i < quads.length; i+=12) {
	this.addQuad(color,
		     new THREE.Vector3(quads[i], quads[i+1], quads[i+2]),
		     new THREE.Vector3(quads[i+3], quads[i+4], quads[i+5]),
		     new THREE.Vector3(quads[i+6], quads[i+7], quads[i+8]),
		     new THREE.Vector3(quads[i+9], quads[i+10], quads[i+11]),
		     true);
    }
}

LDR.Studs.stud10 = function(highContrast, logoType, force) {
    let [pt,step] = LDR.Generator.pT('Stud For Round 2 x 2 Parts');
    let cc = highContrast ? 0 : 16;

    // Lines:
    step.al([6, 0, 0, 5.6145, 0, 1.9397,
	     1.9387, 0, 5.6145, 0, 0, 6,
	     5.6145, -4, 1.9397, 5.6145, 0, 1.9397,
	     6, -4, 0, 5.6145, -4, 1.9397,
	     5.6145, -4, 1.9397, 4.142, -4, 4.142,
	     4.142, -4, 4.142, 1.9397, -4, 5.6145,
	     1.9397, -4, 5.6145, 0, -4, 6,
	     1.9397, -4, 5.6145, 1.9387, 0, 5.6145]);
    step.acl([4.142,-4,4.142,4.142,0,4.142,1.9397,-4,5.6145,5.6145,-4,1.9397,
	      6,-4,0,6,0,0,5.5434,-4,-2.2962,5.6145,-4,1.9397,
	      0,-4,6,0,0,6,1.9397,-4,5.6145,-2.2962,-4,5.5434]);

    // Common positions and rotations:
    let p0 = new THREE.Vector3();
    let p4 = new THREE.Vector3(0, -4, 0);
    let r64 = new THREE.Matrix3(); r64.set(0, 0, -6, 0, 4, 0, 6, 0, 0);
    let r61 = new THREE.Matrix3(); r61.set(0, 0, -6, 0, 1, 0, 6, 0, 0);

    // Sub parts:
    step.asm(p4, r64, force+'3-4cyli', cc);
    step.asm(p0, r61, force+'3-4edge');
    step.asm(p4, r61, force+'3-4edge');

    let logoSM = new THREE.LDRPartDescription(16, p4, r61, force+'3-4disc.dat', true, false);
    step.addSubModel(logoSM);
    if(logoType === 2) {
        logoSM.logoPosition = p4;
    }

    // Logo:
    if(logoType === 1) {
	let r11 = new THREE.Matrix3(); r11.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
        step.asm(p4, r11, 'logo');
    }

    // Triangles:
    step.at([6,-4,0,5.6145,-4,1.9397,0,-4,0,
	     5.6145,-4,1.9397,4.142,-4,4.142,0,-4,0,
	     4.142,-4,4.142,1.9397,-4,5.6145,0,-4,0,
	     1.9397,-4,5.6145,0,-4,6,0,-4,0], 16);
    
    // Quads:
    step.aq([6,0,0,5.6145,0,1.9397,5.6145,-4,1.9397,6,-4,0,
	     5.6145,0,1.9397,4.142,0,4.142,4.142,-4,4.142,5.6145,-4,1.9397,
	     4.142,0,4.142,1.9387,0,5.6145,1.9397,-4,5.6145,4.142,-4,4.142,
	     1.9387,0,5.6145,0,0,6,0,-4,6,1.9397,-4,5.6145], cc);
    
    return [pt, 'stud10.dat'];
}

LDR.Studs.stud15 = function(highContrast, logoType, force) {
    let [pt,step] = LDR.Generator.pT('Stud for Round 2 x 2 Parts, 1 Face, Complete Edges');
    let cc = highContrast ? 0 : 16;

    // Common positions and rotations:
    let p0 = new THREE.Vector3();
    let p4 = new THREE.Vector3(0, -4, 0);
    let r64 = new THREE.Matrix3(); r64.set(0, 0, -6, 0, 4, 0, 6, 0, 0);
    let r61 = new THREE.Matrix3(); r61.set(0, 0, -6, 0, 1, 0, 6, 0, 0);

    // Sub parts:
    step.asm(p0, r61, force+'3-4edge');
    step.asm(p4, r61, force+'3-4edge');
    let r0 = new THREE.Matrix3(); r0.set(-0.9694, -1.542, 0, 0, 0, -2, 0.1928, -7.7548, 0);
    step.asm(new THREE.Vector3(0.9694, -2, 5.8072), r0, force+'rect2p', cc);
    let r1 = new THREE.Matrix3(); r1.set(0, -1.0502, -1.8379, 2, 0, 0, 0, -1.0502, 1.8379);
    step.asm(new THREE.Vector3(3.7766, -2, 3.7766), r1, force+'rect3', cc);
    let r2 = new THREE.Matrix3(); r2.set(0, -7.7548, -0.1928, 2, 0, 0, 0, -1.542, 0.9694);
    step.asm(new THREE.Vector3(5.8072, -2, 0.9694), r2, force+'rect3', cc);
    step.asm(p4, r64, force+'3-4cyli', cc);

    let logoSM = new THREE.LDRPartDescription(16, p4, r61, force+'3-4disc.dat', true, false);
    step.addSubModel(logoSM);
    if(logoType === 2) {
        logoSM.logoPosition = p4;
    }

    // Logo:
    if(logoType === 1) {
	let r11 = new THREE.Matrix3(); r11.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
        step.asm(p4, r11, 'logo');
    }

    step.at([6, -4, 0, 0, -4, 6, 0, -4, 0], 16);
    step.aq([0, -4, 6, 6, -4, 0, 5.6145, -4, 1.9387, 1.9387, -4, 5.6145], 16);
    step.acl([6,-4,0,6,0,0,5.6145,-4,1.9387,5.5434,0,-2.2962,
	      0,-4,6,0,0,6,1.9387,-4,5.6145,-2.2962,0,5.5434]);
    return [pt, 'stud15.dat'];
}

LDR.Studs.stud17 = function(highContrast, logoType, force, withoutBaseEdges) {
    let [pt,step] = LDR.Generator.pT('Stud Open For Octagonal Parts' + (withoutBaseEdges ? ' without Base Edges' : ''));
    let cc = highContrast ? 0 : 16;

    // Common positions and rotations:
    let p0 = new THREE.Vector3();
    let p4 = new THREE.Vector3(0, -4, 0);
    let r44 = LDR.Generator.R(4, 4);
    let r41 = LDR.Generator.R(4, 1);

    // Sub parts:
    step.asm(p4, r44, force+'4-4cyli.dat', cc, true, true);
    step.asm(p4, r41, force+'4-4edge');
    let r0 = new THREE.Matrix3(); r0.set(2.296, 0, -5.543, 0, 1, 0, 5.543, 0, 2.296);
    step.asm(p4, r0, force+'7-8edge');
    let r1 = new THREE.Matrix3(); r1.set(2.296, 0, -5.543, 0, 4, 0, 5.543, 0, 2.296);
    step.asm(p4, r1, force+'7-8cyli', cc);
    let r2 = new THREE.Matrix3(); r2.set(0.765, 0, -1.848, 0, 1, 0, 1.848, 0, 0.765);
    step.asm(p4, r2, force+'2-4ring2');
    let r3 = new THREE.Matrix3(); r3.set(-0.765, 0, 1.848, 0, 1, 0, -1.848, 0, -0.765);
    step.asm(p4, r3, force+'3-8ring2');

    if(!withoutBaseEdges) {
	step.asm(p0, r41, force+'4-4edge');

	let r4 = new THREE.Matrix3(); r4.set(2.296, 0, -5.543, 0, 1, 0, 5.543, 0, 2.296);
	step.asm(p4, r4, force+'7-8edge');
	step.al([2.296,0,5.543,2.78,0,5.22,
		 5.22,0,2.78,5.543,0,2.296]);
    }

    step.al([2.78,-4,5.22,5.22,-4,2.78,
	     2.296,-4,5.543,2.78,-4,5.22,
	     5.22,-4,2.78,5.543,-4,2.296]);
    step.at([5.22,-4,2.78,2.78,-4,5.22,2.828,-4,2.828], 16);
    step.aq([2.78,0,5.22,2.78,-4,5.22,5.22,-4,2.78,5.22,0,2.78,
	     2.296,0,5.543,2.296,-4,5.543,2.78,-4,5.22,2.78,0,5.22,
	     5.543,-4,2.296,5.543,0,2.296,5.22,0,2.78,5.22,-4,2.78], cc);
    step.aq([2.296,-4,5.543,1.531,-4,3.696,2.828,-4,2.828,2.78,-4,5.22,
	     3.696,-4,1.531,5.543,-4,2.296,5.22,-4,2.78,2.828,-4,2.828], 16);
    step.acl([5.22,-4,2.78,5.22,0,2.78,2.78,-4,5.22,5.543,-4,2.296,
	      2.78,-4,5.22,2.78,0,5.22,5.22,-4,2.78,2.296,-4,5.543,
	      2.296,-4,5.543,2.296,0,5.543,2.78,-4,5.22,0,-4,6,
	      5.543,-4,2.296,5.543,0,2.296,5.22,-4,2.78,6,-4,0]);
    if(!withoutBaseEdges && logoType === 1) {
        let r061 = LDR.Generator.R(0.6, 1);
        step.asm(p0, r061, 'logo');
    }
    else if(logoType === 2) {
        let p5 = new THREE.Vector3(0, -0.5, 0);
        let logoSM = new THREE.LDRPartDescription(16, p5, r41, force+'4-4disc.dat', true, false);
        logoSM.logoPosition = p5;
        step.addSubModel(logoSM);
    }
    return [pt, (withoutBaseEdges ? 'stud17a.dat' : 'stud17.dat')];
}

LDR.Studs.stud13 = function(highContrast, logoType, force) {
    let [pt,step] = LDR.Generator.pT('Stud for Electric Light & Sound Brick  2 x  2 x  1.333');
    let cc = highContrast ? 0 : 16;

    step.al([6,0,0,5.782,0,1.095,
	     5.782,0,1.095,1.095,0,5.782,
	     1.095,0,5.782,0,0,6,
	     5.782,0,1.095,5.782,-4,1.095,
	     1.095,0,5.782,1.095,-4,5.782,
	     6,-4,0,5.782,-4,1.095,
	     5.782,-4,1.095,1.095,-4,5.782,
	     1.095,-4,5.782,0,-4,6]);
    step.aq([6,-4,0,6,0,0,5.782,0,1.095,5.782,-4,1.095,
	     1.095,0,5.782,1.095,-4,5.782,5.782,-4,1.095,5.782,0,1.095,
	     1.095,-4,5.782,1.095,0,5.782,0,0,6,0,-4,6], cc);
    step.at([6,-4,0,5.782,-4,1.095,0,-4,0,
	     5.782,-4,1.095,1.095,-4,5.782,0,-4,0,
	     0,-4,6,0,-4,0,1.095,-4,5.782], 16);
    step.acl([6,0,0,6,-4,0,5.782,0,1.095,5.543,-4,-2.296,
	      0,0,6,0,-4,6,1.095,0,5.782,-2.296,-4,5.543]);

    // Common positions and rotations:
    let p0 = new THREE.Vector3();
    let p4 = new THREE.Vector3(0, -4, 0);
    let r64 = new THREE.Matrix3(); r64.set(0, 0, -6, 0, 4, 0, 6, 0, 0);
    let r61 = new THREE.Matrix3(); r61.set(0, 0, -6, 0, 1, 0, 6, 0, 0);

    // Sub parts:
    step.asm(p4, r64, force+'3-4cyli', cc);
    step.asm(p0, r61, force+'3-4edge');
    step.asm(p4, r61, force+'3-4edge');

    let logoSM = new THREE.LDRPartDescription(16, p4, r61, force+'3-4disc.dat', true, false);
    step.addSubModel(logoSM);
    if(logoType === 2) {
        logoSM.logoPosition = p4;
    }

    // Logo:
    if(logoType === 1) {
	let r11 = new THREE.Matrix3(); r11.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
        step.asm(p4, r11, 'logo');
    }
    return [pt, 'stud13.dat'];
}

LDR.Studs.stud6 = function(highContrast, logoType, force, withoutBaseEdges) {
    let [pt,step] = LDR.Generator.pT('Stud Open For Round 2x2 Parts' + (withoutBaseEdges ? ' without Base Edges' : ''));
    let cc = highContrast ? 0 : 16;

    step.al([5.6145,-4,1.9397,5.6145,0,1.9397,
	     6,-4,0,5.6145,-4,1.9397,
	     5.6145,-4,1.9397,4.142,-4,4.142,
	     4.142,-4,4.142,1.9387,-4,5.6145,
	     1.9387,-4,5.6145,0,-4,6,
	     1.9387,-4,5.6145,1.9387,0,5.6145]);

    // Common positions and rotations:
    let p0 = new THREE.Vector3(0, 0, 0);
    let p4 = new THREE.Vector3(0, -4, 0);
    let r41 = LDR.Generator.R(4, 1);
    let r21 = LDR.Generator.R(-2, 1);
    let r44 = LDR.Generator.R(4, 4);
    let r61 = new THREE.Matrix3(); r61.set(0, 0, -6, 0, 1, 0, 6, 0, 0);
    let r64 = new THREE.Matrix3(); r64.set(0, 0, -6, 0, 4, 0, 6, 0, 0);

    step.asm(p4, r61, force+'3-4edge');
    step.asm(p4, r41, force+'4-4edge');
    step.asm(p4, r44, force+'4-4cyli', cc, true, true);
    let r021 = new THREE.Matrix3(); r021.set(0, 0, -2, 0, 1, 0, 2, 0, 0);
    step.asm(p4, r021, force+'1-4ring2');
    step.asm(p4, r21, force+'1-4ring2');
    let x021 = new THREE.Matrix3(); x021.set(0, 0, 2, 0, 1, 0, -2, 0, 0);
    step.asm(p4, x021, force+'1-4ring2');
    step.asm(p4, r64, force+'3-4cyli', cc);

    if(!withoutBaseEdges) {
	step.asm(p0, r41, force+'4-4edge');
	step.asm(p0, r61, force+'3-4edge');

	step.al([6,0,0,5.6145,0,1.9397,
		 1.9387,0,5.6145,0,0,6]);
    }

    step.aq([6,-4,0,5.615,-4,1.94,3.695,-4,1.531,4,-4,0,
	     5.615,-4,1.94,4.142,-4,4.142,2.828,-4,2.828,3.695,-4,1.531,
	     4.142,-4,4.142,1.94,-4,5.615,1.531,-4,3.695,2.828,-4,2.828,
	     1.94,-4,5.615,0,-4,6,0,-4,4,1.531,-4,3.695], 16);
    step.aq([6,0,0,5.6145,0,1.9397,5.6145,-4,1.9397,6,-4,0,
	     5.6145,0,1.9397,4.142,0,4.142,4.142,-4,4.142,5.6145,-4,1.9397,
	     4.142,0,4.142,1.9387,0,5.6145,1.9387,-4,5.6145,4.142,-4,4.142,
	     1.9387,0,5.6145,0,0,6,0,-4,6,1.9387,-4,5.6145], cc);
    step.acl([4.142,-4,4.142,4.142,0,4.142,2.2962,-4,5.5434,5.5434,-4,2.2962]);

    if(!withoutBaseEdges && logoType === 1) {
        let r061 = LDR.Generator.R(0.6, 1);
        step.asm(p0, r061, 'logo');
    }
    else if(logoType === 2) {
        let p5 = new THREE.Vector3(0, -0.5, 0);
        let logoSM = new THREE.LDRPartDescription(16, p5, r41, force+'4-4disc.dat', true, false);
        logoSM.logoPosition = p5;
        step.addSubModel(logoSM);
    }
    return [pt, withoutBaseEdges ? 'stud6a.dat' : 'stud6.dat'];
}

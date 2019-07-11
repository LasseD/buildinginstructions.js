'use strict'

LDR.Studs = {}; // Studs namespace

LDR.Studs.makePrimitivePartType = function(desc, name) {
   let pt = new THREE.LDRPartType();

   pt.name = pt.ID = name;
   pt.modelDescriptiomn = desc;
   pt.author = 'LDRStuds.js';
   pt.license = 'Redistributable under CCAL version 2.0 : see CAreadme.txt';
   pt.inlined = 'GENERATED';
   pt.ldraw_org = 'Primitive';
   pt.cleanSteps = pt.certifiedBFC = pt.CCW = pt.consistentFileAndName = true;

   return pt;
}

LDR.Studs.makeCircle4 = function(size) {
    let pt = LDR.Studs.makePrimitivePartType('Circle ' + (size*0.25), size + '-4edge.dat');
    let step = new THREE.LDRStep();
    let prev = new THREE.Vector3(1, 0, 0);
    for(let i = 1; i <= 4*size; i++) {
        let angle = i*Math.PI/8;
        let c = Math.cos(angle), s = Math.sin(angle);
        let p = new THREE.Vector3(c, 0, s);
        step.addLine(24, prev, p);
        prev = p;
    }
    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    return pt;
}

LDR.Studs.makeCylinder = function(cond, size) {
    let desc = 'Cylinder ' + (size*0.25);
    if(!cond) {
        desc += ' without Conditional Lines';
    }
    let pt = LDR.Studs.makePrimitivePartType(desc, size + (cond ? '-4cyli.dat' : '-4cyli2.dat'));
    let step = new THREE.LDRStep();

    let p0 = new THREE.Vector3(1, 0, 0), p1 = new THREE.Vector3(1, 1, 0);
    let angle = Math.PI/8;
    let c = Math.cos(angle), s = Math.sin(angle);
    let next0 = new THREE.Vector3(c, 0, s);
    let next1 = new THREE.Vector3(c, 1, s);

    for(let i = 2; i < 4*size+2; i++) {
        let prev0 = p0, prev1 = p1;
        p0 = next0;
        p1 = next1;
        angle = i*Math.PI/8;
        c = Math.cos(angle);
        s = Math.sin(angle);
        next0 = new THREE.Vector3(c, 0, s);
        next1 = new THREE.Vector3(c, 1, s);

        step.addQuadPoints(16, prev1, p1, p0, prev0);
        if(cond) {
            step.addConditionalLine(24, p0, p1, prev0, next0);
        }
    }
    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    return pt;
}

LDR.Studs.makeDisc = function(size) {
    let pt = LDR.Studs.makePrimitivePartType('Disc ' + (size*0.25),
                                             size+'-4disc.dat');
    let step = new THREE.LDRStep();
    let zero = new THREE.Vector3(0, 0, 0);
    let prev = new THREE.Vector3(1, 0, 0);
    for(let i = 1; i <= 4*size; i++) {
        let angle = i*Math.PI/8;
        let c = Math.cos(angle), s = Math.sin(angle);
        let p = new THREE.Vector3(c, 0, s);
        step.addTrianglePoints(16, zero, prev, p);
        prev = p;
    }
    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    return pt;
}

LDR.Studs.makeRing = function(size) {
    let pt = LDR.Studs.makePrimitivePartType('Ring ' + size + ' x 1.0', 
                                             '4-4ring' + size + '.dat');
    let step = new THREE.LDRStep();
    let SIZE = size+1;
    let prev1 = new THREE.Vector3(size, 0, 0);
    let prev2 = new THREE.Vector3(SIZE, 0, 0);
    for(let i = 1; i <= 16; i++) {
        let angle = i*Math.PI/8;
        let c = Math.cos(angle), s = Math.sin(angle);
        let p1 = new THREE.Vector3(SIZE*c, 0, SIZE*s);
        let p2 = new THREE.Vector3(size*c, 0, size*s);
        step.addQuadPoints(16, p1, p2, prev1, prev2);
        prev1 = p2;
        prev2 = p1;
    }
    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    return pt;
}

LDR.Studs.setPrimitives = function(partTypes) {
    let a = [
             LDR.Studs.makeCircle4(1),
             LDR.Studs.makeCircle4(2),
             LDR.Studs.makeCircle4(4),
             LDR.Studs.makeCylinder(true, 1),
             LDR.Studs.makeCylinder(false, 1),
             LDR.Studs.makeCylinder(true, 2),
             LDR.Studs.makeCylinder(false, 2),
             LDR.Studs.makeCylinder(true, 4),
             LDR.Studs.makeCylinder(false, 4),
             LDR.Studs.makeCylinderClosed(1),
             LDR.Studs.makeCylinderClosed(2),
             LDR.Studs.makeCylinderClosed(4),
             LDR.Studs.makeDisc(1),
             LDR.Studs.makeDisc(2),
             LDR.Studs.makeDisc(4),
             LDR.Studs.makeRing(2),
             LDR.Studs.makeRing(5),
             LDR.Studs.makeRing(6)
             ];
    a.forEach(p => partTypes[p.ID] = p);
}

LDR.Studs.setStuds = function(ldrLoader, highContrast, logoType, onDone) {
    console.log('Creating studs. High contrast: ' + highContrast + ' logo type: ' + logoType);

    let partTypes = ldrLoader.partTypes;
    LDR.Studs.setStud1(partTypes, highContrast, logoType);
    LDR.Studs.setStud2(partTypes, highContrast, logoType);
    LDR.Studs.setStud2a(partTypes, highContrast);

    let logoID = 'logo' + (logoType === 1 ? '' : logoType) + '.dat';
    if(logoType > 0) {
        let idb = []; // Primitives that we know are needed and would like to see fetched from IndexedDB
        if(!partTypes.hasOwnProperty(logoID)) {
            idb.push(logoID);
        }

        switch(logoType) {
        case 1:
        case 2:
        case 5:
            idb.push('t01o0714.dat');
            break;
        case 3:
            idb.push('t01o0714.dat', '2-4ring1.dat');
            break;
        case 4: 
            idb.push('t01o0714.dat', '2-8sphe.dat', '1-8sphe.dat', '2-4cyls.dat', 
                     't02o3333.dat', 't02i3333.dat', '1-4cyls.dat');
            break;
        default: // No logo, no dependencies:
            break;
        }

        if(idb.length === 0) {
            onDone();
            return;
        }

        // Build a different loader to fetch these two since we have to wait for the callback:
        let loader2 = new THREE.LDRLoader(onDone, ldrLoader.storage, ldrLoader.options);
        loader2.partTypes = ldrLoader.partTypes; // Load to same data store.
        loader2.loadMultiple(idb);
    }
    else {
        onDone(); // All OK.
    }
}

LDR.Studs.makeRotation = function(a, b) {
    let ret = new THREE.Matrix3();
    ret.set(a, 0, 0, 0, b, 0, 0, 0, a)
    return ret;
}

LDR.Studs.setStud1 = function(partTypes, highContrast, logoType) {
    let pt = LDR.Studs.makePrimitivePartType('Stud', 'stud.dat');
    let step = new THREE.LDRStep();

    // Common positions and rotations:
    let p0 = new THREE.Vector3();
    let r11 = LDR.Studs.makeRotation(1, 1);
    let r61 = LDR.Studs.makeRotation(6, 1);
    step.addSubModel(new THREE.LDRPartDescription(16, p0, r61, '4-4edge.dat', true, false));

    if(logoType < 2) {
        var p4 = new THREE.Vector3(0, -4, 0); // 'var' allows drop-through.
        var r64 = LDR.Studs.makeRotation(6, -4);
        // Stud type one actually uses a 4-4cylc.dat, but then high contrast does not work!
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r61, '4-4edge.dat', true, false));
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r61, '4-4disc.dat', true, false));
    }
    else {
        var p34 = new THREE.Vector3(0, -3.4, 0);
        var p38 = new THREE.Vector3(0, -3.8, 0);
        var r64 = LDR.Studs.makeRotation(6, -3.4);
        var r5656 = LDR.Studs.makeRotation(5.6, -5.6);
        var r561 = LDR.Studs.makeRotation(5.6, 1);

        step.addSubModel(new THREE.LDRPartDescription(16, p34, r5656, 't01o0714.dat', true, false));
        step.addSubModel(new THREE.LDRPartDescription(16, p38, r561, '4-4disc.dat', true, false));
    }

    // Cylinder:
    if(highContrast) {
        step.addSubModel(new THREE.LDRPartDescription(0, p0, r64, '4-4cyli2.dat', true, false));
    }
    else {
        step.addSubModel(new THREE.LDRPartDescription(16, p0, r64, '4-4cyli.dat', true, false));
    }

    // Logo:
    if(logoType === 1) {
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r11, 'logo.dat', true, false));
    }
    else if(logoType > 1) {
        step.addSubModel(new THREE.LDRPartDescription(16, p38, r11, 'logo' + logoType + '.dat', true, false));
    }

    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    partTypes[pt.ID] = pt;
}

LDR.Studs.setStud2a = function(partTypes, highContrast) {
    let pt = LDR.Studs.makePrimitivePartType('Stud Open without Base Edges', 'stud2a.dat');
    let step = new THREE.LDRStep();
    
    let p0 = new THREE.Vector3();
    let p4 = new THREE.Vector3(0, -4, 0);
    let r41 = LDR.Studs.makeRotation(4, 1);
    let r61 = LDR.Studs.makeRotation(6, 1);
    let r44 = LDR.Studs.makeRotation(4, 4);
    let r64 = LDR.Studs.makeRotation(6, 4);
    let r21 = LDR.Studs.makeRotation(2, 1);

    step.addSubModel(new THREE.LDRPartDescription(16, p4, r41, '4-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r61, '4-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r44, '4-4cyli2.dat', true, true)); // inverted. Consider if the conditional lines should be included ot not.
    if(highContrast) {
        step.addSubModel(new THREE.LDRPartDescription(0, p4, r64, '4-4cyli2.dat', true, false));
    }
    else {
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r64, '4-4cyli.dat', true, false));
    }
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r21, '4-4ring2.dat', true, false));

    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    partTypes[pt.ID] = pt;
}

LDR.Studs.setStud2 = function(partTypes, highContrast, logoType) {
    let pt = LDR.Studs.makePrimitivePartType('Stud Open', 'stud2.dat');
    let step = new THREE.LDRStep();

    let p0 = new THREE.Vector3();
    let p4 = new THREE.Vector3(0, -4, 0);
    let r41 = LDR.Studs.makeRotation(4, 1);
    let r61 = LDR.Studs.makeRotation(6, 1);
    let r44 = LDR.Studs.makeRotation(4, 4);
    let r64 = LDR.Studs.makeRotation(6, 4);
    let r21 = LDR.Studs.makeRotation(2, 1);

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
        }
    }
    else {
        let p36 = new THREE.Vector3(0, -3.6, 0);
        let r636 = LDR.Studs.makeRotation(6, 3.6);
        // 1 16 0 -3.6 0 6 0 0 0 3.6 0 0 0 6 4-4cyli.dat
        if(highContrast) {
            step.addSubModel(new THREE.LDRPartDescription(0, p36, r636, '4-4cyli2.dat', true, false));
        }
        else {
            step.addSubModel(new THREE.LDRPartDescription(16, p36, r636, '4-4cyli.dat', true, false));
        }
        
        let r081 = LDR.Studs.makeRotation(0.8, 1);
        // 1 16 0 -4 0 0.8 0 0 0 1 0 0 0 0.8 4-4ring5.dat
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r081, '4-4ring5.dat', true, false));
        // 1 16 0 -4 0 0.8 0 0 0 1 0 0 0 0.8 4-4ring6.dat
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r081, '4-4ring6.dat', true, false));

        var r5656 = LDR.Studs.makeRotation(5.6, -5.6);
        // 1 16 0 -3.6 0 5.6 0 0 0 -5.6 0 0 0 5.6 t01o0714.dat
        step.addSubModel(new THREE.LDRPartDescription(16, p36, r5656, 't01o0714.dat', true, false));
    }

    step.addSubModel(new THREE.LDRPartDescription(16, p0, r61, '4-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r41, '4-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r44, '4-4cyli2.dat', true, true)); // inverted. Consider if the conditional lines should be included ot not.

    // Logo:
    if(logoType === 1) {
        // 1 16 0 0 0 0.6 0 0 0 1 0 0 0 0.6 logo.dat:
        let r061 = LDR.Studs.makeRotation(0.6, 1);
        step.addSubModel(new THREE.LDRPartDescription(16, p0, r061, 'logo.dat', true, false));
    }
    else if(logoType > 1) {
        // 1 16 0 0 0 0.62 0 0 0 0.62 0 0 0 0.62 logoX.dat
        let r062062 = LDR.Studs.makeRotation(0.62, 0.62);
        step.addSubModel(new THREE.LDRPartDescription(16, p0, r062062, 'logo' + logoType + '.dat', true, false));
    }

    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    partTypes[pt.ID] = pt;
}

LDR.Studs.makeCylinderClosed = function(size) {
    let pt = LDR.Studs.makePrimitivePartType('Cylinder Closed ' + (size*0.25), size + '-4cylc.dat');
    let step = new THREE.LDRStep();
    
    let p0 = new THREE.Vector3();
    let p1 = new THREE.Vector3(0, 1, 0);
    let r = LDR.Studs.makeRotation(1, 1);

    step.addSubModel(new THREE.LDRPartDescription(16, p0, r, size+'-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p1, r, size+'-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p0, r, size+'-4disc.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p0, r, size+'-4cyli.dat', true, false));

    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    return pt;
}


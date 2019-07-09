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

LDR.Studs.makeCircle1 = function() {
    let pt = LDR.Studs.makePrimitivePartType('Circle 1.0', '4-4edge.dat');
    let step = new THREE.LDRStep();
    let prev = new THREE.Vector3(1, 0, 0);
    for(let i = 1; i <= 16; i++) {
        let angle = i*Math.PI/8;
        let c = Math.cos(angle), s = Math.sin(angle);
        let p = new THREE.Vector3(c, 0, s);
        step.addLine(24, prev, p);
        prev = p;
    }
    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    return pt;
}

LDR.Studs.makeCylinder1 = function(cond) {
    let desc = 'Cylinder 1.0';
    if(!cond) {
        desc += ' without Conditional Lines';
    }
    let pt = LDR.Studs.makePrimitivePartType(desc, cond ? '4-4cyli.dat' : '4-4cyli2.dat');
    let step = new THREE.LDRStep();

    let p0 = new THREE.Vector3(1, 0, 0), p1 = new THREE.Vector3(1, 1, 0);
    let angle = Math.PI/8;
    let c = Math.cos(angle), s = Math.sin(angle);
    let next0 = new THREE.Vector3(c, 0, s);
    let next1 = new THREE.Vector3(c, 1, s);

    for(let i = 2; i < 18; i++) {
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

LDR.Studs.makeDisc1 = function() {
    let pt = LDR.Studs.makePrimitivePartType('Disc 1.0', '4-4disc.dat');
    let step = new THREE.LDRStep();
    let zero = new THREE.Vector3(0, 0, 0);
    let prev = new THREE.Vector3(1, 0, 0);
    for(let i = 1; i <= 16; i++) {
        let angle = i*Math.PI/8;
        let c = Math.cos(angle), s = Math.sin(angle);
        let p = new THREE.Vector3(c, 0, s);
        step.addTrianglePoints(16, zero, prev, p);
        prev = p;
    }
    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    return pt;
}

LDR.Studs.makeRing2 = function() {
    let pt = LDR.Studs.makePrimitivePartType('Ring 2 x 1.0', '4-4ring2.dat');
    let step = new THREE.LDRStep();
    let prev1 = new THREE.Vector3(2, 0, 0);
    let prev2 = new THREE.Vector3(3, 0, 0);
    for(let i = 1; i <= 16; i++) {
        let angle = i*Math.PI/8;
        let c = Math.cos(angle), s = Math.sin(angle);
        let p1 = new THREE.Vector3(3*c, 0, 3*s);
        let p2 = new THREE.Vector3(2*c, 0, 2*s);
        step.addQuadPoints(16, p1, p2, prev1, prev2);
        prev1 = p2;
        prev2 = p1;
    }
    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    return pt;
}

LDR.Studs.setPrimitives = function(partTypes) {
    let p = LDR.Studs.makeCircle1();
    partTypes[p.ID] = p;

    p = LDR.Studs.makeCylinder1(true);
    partTypes[p.ID] = p;

    p = LDR.Studs.makeCylinder1(false);
    partTypes[p.ID] = p;

    p = LDR.Studs.makeDisc1();
    partTypes[p.ID] = p;

    p = LDR.Studs.makeRing2();
    partTypes[p.ID] = p;
}

LDR.Studs.setStuds = function(partTypes, highContrast, logoType) {
    console.log('Creating studs. High contrast: ' + highContrast);
    LDR.Studs.setStud1(partTypes, highContrast, logoType);
    LDR.Studs.setStud2(partTypes, highContrast, logoType, true);
    LDR.Studs.setStud2(partTypes, highContrast, logoType, false);
}

LDR.Studs.setStud1 = function(partTypes, highContrast, logoType) {
    let pt = LDR.Studs.makePrimitivePartType('Stud', 'stud.dat');
    let step = new THREE.LDRStep();

    let p0 = new THREE.Vector3();
    let p4 = new THREE.Vector3(0, -4, 0);
    let r1 = new THREE.Matrix3(); r1.set(6, 0, 0, 0, 1, 0, 0, 0, 6);
    let r4 = new THREE.Matrix3(); r4.set(6, 0, 0, 0, -4, 0, 0, 0, 6);

    step.addSubModel(new THREE.LDRPartDescription(16, p0, r1, '4-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r1, '4-4edge.dat', true, false));
    if(highContrast) {
        step.addSubModel(new THREE.LDRPartDescription(0, p0, r4, '4-4cyli2.dat', true, false));
    }
    else {
        step.addSubModel(new THREE.LDRPartDescription(16, p0, r4, '4-4cyli.dat', true, false));
    }
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r1, '4-4disc.dat', true, false));

    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    partTypes[pt.ID] = pt;
}

LDR.Studs.setStud2 = function(partTypes, highContrast, logoType, withBaseEdges) {
    let pt = LDR.Studs.makePrimitivePartType('Stud Open' + (withBaseEdges ? '' : ' without Base Edges'), 'stud2' + (withBaseEdges ? '' : 'a') + '.dat');
    let step = new THREE.LDRStep();

    let p0 = new THREE.Vector3();
    let p4 = new THREE.Vector3(0, -4, 0);
    let r414 = new THREE.Matrix3(); r414.set(4, 0, 0, 0, 1, 0, 0, 0, 4);
    let r616 = new THREE.Matrix3(); r616.set(6, 0, 0, 0, 1, 0, 0, 0, 6);
    let r444 = new THREE.Matrix3(); r444.set(4, 0, 0, 0, 4, 0, 0, 0, 4);
    let r646 = new THREE.Matrix3(); r646.set(6, 0, 0, 0, 4, 0, 0, 0, 6);
    let r212 = new THREE.Matrix3(); r212.set(2, 0, 0, 0, 1, 0, 0, 0, 2);

    // Base edges:
    if(withBaseEdges) {
	step.addSubModel(new THREE.LDRPartDescription(16, p0, r414, '4-4edge.dat', true, false));
	step.addSubModel(new THREE.LDRPartDescription(16, p0, r616, '4-4edge.dat', true, false));
    }
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r414, '4-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r616, '4-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r444, '4-4cyli2.dat', true, true)); // inverted. Consider if the conditional lines should be included ot not.
    if(highContrast) {
        step.addSubModel(new THREE.LDRPartDescription(0, p4, r646, '4-4cyli2.dat', true, false));
    }
    else {
        step.addSubModel(new THREE.LDRPartDescription(16, p4, r646, '4-4cyli.dat', true, false));
    }
    step.addSubModel(new THREE.LDRPartDescription(16, p4, r212, '4-4ring2.dat', true, false));

    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    partTypes[pt.ID] = pt;
}

LDR.Studs.removeGeometriesForAllWithStuds = function(partTypes) {
    // TODO
}


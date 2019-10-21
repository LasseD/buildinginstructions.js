'use strict'

LDR.Generator = {}; // Generator namespace

LDR.Generator.map = {
    '1-4edge.dat': () => LDR.Generator.makeCircle4(1),
    '2-4edge.dat': () => LDR.Generator.makeCircle4(2),
    '4-4edge.dat': () => LDR.Generator.makeCircle4(4),
    '1-4cyli.dat': () => LDR.Generator.makeCylinder(true, 1),
    '1-4cyli2.dat': () => LDR.Generator.makeCylinder(false, 1),
    '2-4cyli.dat': () => LDR.Generator.makeCylinder(true, 2),
    '2-4cyli2.dat': () => LDR.Generator.makeCylinder(false, 2),
    '4-4cyli.dat': () => LDR.Generator.makeCylinder(true, 4),
    '4-4cyli2.dat': () => LDR.Generator.makeCylinder(false, 4),
    '1-4cylc.dat': () => LDR.Generator.makeCylinderClosed(1),
    '2-4cylc.dat': () => LDR.Generator.makeCylinderClosed(2),
    '4-4cylc.dat': () => LDR.Generator.makeCylinderClosed(4),
    '1-4cyls.dat': () => LDR.Generator.makeCylinderSloped(1),
    '2-4cyls.dat': () => LDR.Generator.makeCylinderSloped(2),
    '4-4cyls.dat': () => LDR.Generator.makeCylinderSloped(4),
    '1-4disc.dat': () => LDR.Generator.makeDisc(1),
    '2-4disc.dat': () => LDR.Generator.makeDisc(2),
    //'3-4disc.dat': () => LDR.Generator.makeDisc(3), // TODO Check that this is correct!
    '4-4disc.dat': () => LDR.Generator.makeDisc(4),
    '2-4ring1.dat': () => LDR.Generator.makeRing(2, 1),
    '4-4ring2.dat': () => LDR.Generator.makeRing(4, 2),
    '4-4ring3.dat': () => LDR.Generator.makeRing(4, 3),
    '4-4ring5.dat': () => LDR.Generator.makeRing(4, 5),
    '4-4ring6.dat': () => LDR.Generator.makeRing(4, 6),    
    'logo.dat': () => LDR.Generator.makeLogo1(),
    'empty.dat': () => LDR.Generator.makeEmpty()
};

LDR.Generator.make = function(id) {
    if(LDR.Generator.map.hasOwnProperty(id)) {
        return LDR.Generator.map[id]();
    }
    else {
        return null;
    }
}

LDR.Generator.makeP = function(desc, name) {
   let pt = new THREE.LDRPartType();

   pt.name = pt.ID = name;
   pt.modelDescription = desc;
   pt.author = 'LDRGenerator.js';
   pt.license = 'Redistributable under CCAL version 2.0 : see CAreadme.txt';
   pt.inlined = 'GENERATED';
   pt.ldraw_org = 'Primitive';
   pt.cleanSteps = pt.certifiedBFC = pt.CCW = pt.consistentFileAndName = true;
   pt.isPart = true;

   return pt;
}

LDR.Generator.makeR = function(a, b) {
    let ret = new THREE.Matrix3();
    ret.set(a, 0, 0, 0, b, 0, 0, 0, a)
    return ret;
}

LDR.Generator.addLinesToStep = function(step, lines) {
    for(let i = 0; i < lines.length; i+=6) {
	step.addLine(24,
		     new THREE.Vector3(lines[i], lines[i+1], lines[i+2]),
		     new THREE.Vector3(lines[i+3], lines[i+4], lines[i+5]));
    }
}

LDR.Generator.addConditionalLinesToStep = function(step, lines) {
    for(let i = 0; i < lines.length; i+=12) {
	step.addConditionalLine(24,
				new THREE.Vector3(lines[i], lines[i+1], lines[i+2]),
				new THREE.Vector3(lines[i+3], lines[i+4], lines[i+5]),
				new THREE.Vector3(lines[i+6], lines[i+7], lines[i+8]),
				new THREE.Vector3(lines[i+9], lines[i+10], lines[i+11]));
    }
}

LDR.Generator.addTrianglesToStep = function(step, triangles, color = 16) {
    for(let i = 0; i < triangles.length; i+=9) {
	step.addTrianglePoints(color,
			       new THREE.Vector3(triangles[i], triangles[i+1], triangles[i+2]),
			       new THREE.Vector3(triangles[i+3], triangles[i+4], triangles[i+5]),
			       new THREE.Vector3(triangles[i+6], triangles[i+7], triangles[i+8]));
    }
}

LDR.Generator.addQuadsToStep = function(step, quads, color = 16) {
    for(let i = 0; i < quads.length; i+=12) {
	step.addQuadPoints(color,
			   new THREE.Vector3(quads[i], quads[i+1], quads[i+2]),
			   new THREE.Vector3(quads[i+3], quads[i+4], quads[i+5]),
			   new THREE.Vector3(quads[i+6], quads[i+7], quads[i+8]),
			   new THREE.Vector3(quads[i+9], quads[i+10], quads[i+11]));
    }
}

LDR.Generator.makeEmpty = function(id = 'empty.dat') {
    let pt = LDR.Generator.makeP(id, id);
    pt.steps.push(new THREE.LDRStep());
    return pt;
}

LDR.Generator.makeCylinderClosed = function(sections) {
    let pt = LDR.Generator.makeP('Cylinder Closed ' + (sections*0.25),
                                 sections + '-4cylc.dat');
    let step = new THREE.LDRStep();
    
    let p0 = new THREE.Vector3();
    let p1 = new THREE.Vector3(0, 1, 0);
    let r = LDR.Generator.makeR(1, 1);

    step.addSubModel(new THREE.LDRPartDescription(16, p0, r, sections+'-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p1, r, sections+'-4edge.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p0, r, sections+'-4disc.dat', true, false));
    step.addSubModel(new THREE.LDRPartDescription(16, p0, r, sections+'-4cyli.dat', true, false));

    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    return pt;
}

LDR.Generator.makeCircle4 = function(sections) {
    let pt = LDR.Generator.makeP('Circle ' + (sections*0.25),
                                 sections + '-4edge.dat');
    let step = new THREE.LDRStep();
    let prev = new THREE.Vector3(1, 0, 0);
    for(let i = 1; i <= 4*sections; i++) {
        let angle = i*Math.PI/8;
        let c = Math.cos(angle), s = Math.sin(angle);
        let p = new THREE.Vector3(c, 0, s);
        step.addLine(24, prev, p);
        prev = p;
    }
    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    return pt;
}

LDR.Generator.makeCylinder = function(cond, sections) {
    let desc = 'Cylinder ' + (sections*0.25);
    if(!cond) {
        desc += ' without Conditional Lines';
    }
    let pt = LDR.Generator.makeP(desc,
                                 sections + (cond ? '-4cyli.dat' : '-4cyli2.dat'));
    let step = new THREE.LDRStep();

    let p0 = new THREE.Vector3(1, 0, 0), p1 = new THREE.Vector3(1, 1, 0);
    let angle = Math.PI/8;
    let c = Math.cos(angle), s = Math.sin(angle);
    let next0 = new THREE.Vector3(c, 0, s);
    let next1 = new THREE.Vector3(c, 1, s);

    for(let i = 2; i < 4*sections+2; i++) {
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

LDR.Generator.makeCylinderSloped = function(sections) {
    let desc = 'Cylinder Sloped ' + (sections*0.25);
    let pt = LDR.Generator.makeP(desc, sections + '-4cyls.dat');
    let step = new THREE.LDRStep();

    let p0 = new THREE.Vector3(1, 0, 0), p1 = new THREE.Vector3(1, 0, 0);
    let angle = Math.PI/8;
    let c = Math.cos(angle), s = Math.sin(angle);
    let next0 = new THREE.Vector3(c, 0, s);
    let next1 = new THREE.Vector3(c, 1-c, s);

    for(let i = 2; i < 4*sections+2; i++) {
        let prev0 = p0, prev1 = p1;
        p0 = next0;
        p1 = next1;
        angle = i*Math.PI/8;
        c = Math.cos(angle);
        s = Math.sin(angle);
        next0 = new THREE.Vector3(c, 0, s);
        next1 = new THREE.Vector3(c, 1-c, s);

        if(i === 2) {
            step.addTrianglePoints(16, prev1, p1, p0);
        }
        else if(i === 17) {
            step.addTrianglePoints(16, prev1, p1, prev0);
        }
        else {
            step.addQuadPoints(16, prev1, p1, p0, prev0);
        }
        step.addConditionalLine(24, p0, p1, prev0, next0);
    }
    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    return pt;
}

LDR.Generator.makeDisc = function(sections) {
    let pt = LDR.Generator.makeP('Disc ' + (sections*0.25),
                                 sections+'-4disc.dat');
    let step = new THREE.LDRStep();
    let zero = new THREE.Vector3(0, 0, 0);
    let prev = new THREE.Vector3(1, 0, 0);
    for(let i = 1; i <= 4*sections; i++) {
        let angle = i*Math.PI/8;
        let c = Math.cos(angle), s = Math.sin(angle);
        let p = new THREE.Vector3(c, 0, s);
        step.addTrianglePoints(16, zero, prev, p);
        prev = p;
    }
    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    return pt;
}

LDR.Generator.makeRing = function(sections, size) {
    let pt = LDR.Generator.makeP('Ring ' + size + ' x ' + (0.25*sections), 
                                 sections + '-4ring' + size + '.dat');
    let step = new THREE.LDRStep();
    let SIZE = size+1;
    let prev1 = new THREE.Vector3(size, 0, 0);
    let prev2 = new THREE.Vector3(SIZE, 0, 0);
    for(let i = 1; i <= 4*sections; i++) {
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

// Content below copied from logo.dat by Paul Easter [pneaster]
LDR.Generator.logoPositions = [[-2,-4,2,-5,2,-3.5] // L
                               ,
                               [-2,0,-2,-2,2,-3,2,-1],[0,-1,0,-2.5], // E (Divided due to middle line)
                               ,
                               [-1.5,2.25,-2,2,-2,1,-1.5,0.5,1.5,-0.25,2,0,2,1,1.5,1.5,0,2,0,1] //G
                               ,
                               [-1.5,4.75,-2,4.5,-2,3.5,-1.5,3,1.5,2.25,2,2.5,2,3.5,1.5,4,-1.5,4.75] // O
                               ];

LDR.Generator.makeLogo1 = function() {
    let pt = LDR.Generator.makeP('LEGO Logo for Studs - Non-3D Thin Lines', 'logo.dat');
    pt.ldraw_org = 'Unofficial_Primitive';
    let step = new THREE.LDRStep();

    LDR.Generator.logoPositions.forEach(letter => {
	for(let i = 2; i < letter.length; i+=2) {
            let p1 = new THREE.Vector3(letter[i-2], 0, letter[i-1]);
            let p2 = new THREE.Vector3(letter[i], 0, letter[i+1]);
	    step.addLine(24, p1, p2);
	}
    });

    pt.steps.push(step); // No need to user 'addStep()' for primitives.
    return pt;
}

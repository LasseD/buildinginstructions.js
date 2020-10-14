'use strict';

/**
   LDRGenerator defines the LDR.Generator namespace and is used for quick generation of LDraw primitives, such as simple circles, cylinders and discs.
 */

// Helper functions:
THREE.LDRStep.prototype.al = function(lines) {
    for(let i = 0; i < lines.length; i+=6) {
	this.addLine(24,
		     new THREE.Vector3(lines[i], lines[i+1], lines[i+2]),
		     new THREE.Vector3(lines[i+3], lines[i+4], lines[i+5]));
    }
}
THREE.LDRStep.prototype.asm = function(p, r, id, c = 16, cull = true, ccw = false) {
    this.addSubModel(new THREE.LDRPartDescription(c, p, r, id+'.dat', cull, ccw));
}

LDR.Generator = {
    makePT: function(desc) {
        let pt = new THREE.LDRPartType();

        pt.modelDescription = desc;
        pt.author = 'LDRGenerator.js';
        pt.license = 'Redistributable under CCAL version 2.0 : see CAreadme.txt';
        pt.inlined = 'GENERATED';
        pt.ldraw_org = 'Primitive';
        pt.cleanSteps = pt.certifiedBFC = pt.CCW = pt.isPart = true;
        
        let step = new THREE.LDRStep();
        pt.steps.push(step); // No need to user 'addStep()' for primitives.

        return [pt,step];
    },
    makeR: function(a, b) {
        let ret = new THREE.Matrix3();
        ret.set(a, 0, 0, 0, b, 0, 0, 0, a)
        return ret;
    },
    f2s: function(f) {
        if(f === parseInt(f+'')) {
            return f + '.0';
        }
        return f;
    },
    V: (x,y,z) => new THREE.Vector3(x,y,z),
    makeEmpty: function(id = 'Empty') {
        let [pt,ignore] = this.makePT(id);
        pt.steps = [];
        return pt;
    },
    
    makeCylinderClosed: function(sections) {
        let [pt,step] = this.makePT('Cylinder Closed ' + this.f2s(sections*0.25));
        let p0 = this.V();
        let p1 = this.V(0, 1, 0);
        let r = this.makeR(1, 1);
        
        step.asm(p0, r, sections+'-4edge');
        step.asm(p1, r, sections+'-4edge');
        step.asm(p0, r, sections+'-4disc');
        step.asm(p0, r, sections+'-4cyli');
        return pt;
    },
    makeEdge: function(N, D) {
        let [pt,step] = this.makePT('Circle ' + this.f2s(N*1.0/D));
        let prev = this.V(1, 0, 0);
        for(let i = 1; i <= 16/D*N; i++) {
            let angle = i*Math.PI/8;
            let c = Math.cos(angle), s = Math.sin(angle);
            let p = this.V(c, 0, s);
            step.addLine(24, prev, p);
            prev = p;
        }
        return pt;
    },
    makeCylinder: function(cond, sections, flip = false) {
        let desc = 'Cylinder ' + this.f2s(sections*0.25);
        if(!cond) {
            desc += ' without Conditional Lines';
        }
        let [pt,step] = this.makePT(desc);
        
        let p0 = this.V(1, 0, 0), p1 = this.V(1, 1, 0);
        let angle = Math.PI/8;
        let c = Math.cos(angle), s = Math.sin(angle);
        let next0 = this.V(c, 0, s);
        let next1 = this.V(c, 1, s);

        if(cond && sections < 4) { // Add conditional line in beginning:
            if(flip) {
                step.addConditionalLine(24, p0, p1, next1, this.V(1, 1, -.4142)); // I have no idea why 2-4cyli.dat is this irregular.
            }
            else {
                step.addConditionalLine(24, p0, p1, next0, this.V(1, 0, -1));
            }
        }
        let prev0;
        for(let i = 2; i < 4*sections+2; i++) {
            prev0 = p0;
            let prev1 = p1;
            p0 = next0;
            p1 = next1;
            angle = i*Math.PI/8;
            c = Math.cos(angle);
            s = Math.sin(angle);
            next0 = this.V(c, 0, s);
            next1 = this.V(c, 1, s);

            step.addQuad(16, prev1, p1, p0, prev0);

            if(cond) {
                if(flip) {
                    step.addConditionalLine(24, p0, p1, next1, prev1);
                }
                else {
                    step.addConditionalLine(24, p0, p1, next0, prev0);
                }
            }
        }
        if(cond && sections < 4) { // Fix last conditional line to align with orthogonal wall:
            let last = step.conditionalLines[step.conditionalLines.length-1];
            if(flip) { // Irregular 2-4cyli.dat
                last.p3 = this.V(c, 1, -s);
                last.p4 = this.V(-1, 1, -.4141);
            }
            else {
                last.p3 = this.V(-c, 0, s);
                last.p4 = this.V(-1, 0, 1);
            }
        }
        return pt;
    },
    makeCylinderSloped: function(N, lastNext) {
        let [pt,step] = this.makePT('Cylinder Sloped ' + this.f2s(N*0.25));

        let p0 = this.V(1, 0, 0), p1 = this.V(1, 0, 0);
        let angle = Math.PI/8;
        let c = Math.cos(angle), s = Math.sin(angle);
        let next0 = this.V(c, 0, s);
        let next1 = this.V(c, 1-c, s);

        for(let i = 2; i < 4*N+2; i++) {
            let prev0 = p0, prev1 = p1;
            p0 = next0;
            p1 = next1;
            angle = i*Math.PI/8;
            c = Math.cos(angle);
            s = Math.sin(angle);
            next0 = this.V(c, 0, s);
            next1 = this.V(c, 1-c, s);

            if(i === 2) {
                step.addTriangle(16, prev1, p1, p0);
            }
            else if(i === 17) {
                step.addTriangle(16, prev1, p1, prev0);
            }
            else {
                step.addQuad(16, prev1, p1, p0, prev0);
            }
            
            if(p0.y !== p1.y) {
                step.addConditionalLine(24, p0, p1, prev0, next0);
            }
        }
        if(lastNext) {
            next0.copy(lastNext);
        }
        
        return pt;
    },
    makeDisc: function(sections) {
        let [pt,step] = this.makePT('Disc ' + this.f2s(sections*0.25));
        let zero = this.V(0, 0, 0);
        let prev = this.V(1, 0, 0);
        for(let i = 1; i <= 4*sections; i++) {
            let angle = i*Math.PI/8;
            let c = Math.cos(angle), s = Math.sin(angle);
            let p = this.V(c, 0, s);
            step.addTriangle(16, zero, prev, p);
            prev = p;
        }
        return pt;
    },
    makeRing: function(N, D, size) {
        let [pt,step] = this.makePT('Ring  ' + size + ' x ' + this.f2s(1.0/D*N));
        let SIZE = size+1;
        let prev1 = this.V(size, 0, 0);
        let prev2 = this.V(SIZE, 0, 0);
        for(let i = 1; i <= 16/D*N; i++) {
            let angle = i*Math.PI/8;
            let c = Math.cos(angle), s = Math.sin(angle);
            let p1 = this.V(SIZE*c, 0, SIZE*s);
            let p2 = this.V(size*c, 0, size*s);
            step.addQuad(16, prev2, p1, p2, prev1);
            prev1 = p2;
            prev2 = p1;
        }
        return pt;
    },
    logoPositions: [[-2,-4,2,-5,2,-3.5] // L
                    ,
                    [-2,0,-2,-2,2,-3,2,-1],[0,-1,0,-2.5], // E (Divided due to middle line)
                    ,
                    [-1.5,2.25,-2,2,-2,1,-1.5,0.5,1.5,-0.25,2,0,2,1,1.5,1.5,0,2,0,1] //G
                    ,
                    [-1.5,4.75,-2,4.5,-2,3.5,-1.5,3,1.5,2.25,2,2.5,2,3.5,1.5,4,-1.5,4.75] // O
                   ], // Logo positions copied from logo.dat by Paul Easter [pneaster]
    makeLogo1: function() {
        let [pt,step] = this.makePT('LEGO Logo for Studs - Non-3D Thin Lines');
        pt.ldraw_org = 'Unofficial_Primitive';

        this.logoPositions.forEach(letter => {
	    for(let i = 2; i < letter.length; i+=2) {
	        step.al([letter[i-2], 0, letter[i-1], letter[i], 0, letter[i+1]]);
	    }
        });
        return pt;
    },    
    map: {
        '1-4edge': X => X.makeEdge(1, 4),
        '2-4edge': X => X.makeEdge(2, 4),
        '3-4edge': X => X.makeEdge(3, 4),
        '4-4edge': X => X.makeEdge(4, 4),
        '1-8edge': X => X.makeEdge(1, 8),
        '3-8edge': X => X.makeEdge(3, 8),
        '5-8edge': X => X.makeEdge(5, 8),
        '7-8edge': X => X.makeEdge(7, 8),
        '1-16edge': X => X.makeEdge(1, 16),
        '3-16edge': X => X.makeEdge(3, 16),
        '5-16edge': X => X.makeEdge(5, 16),
        '7-16edge': X => X.makeEdge(7, 16),
        '9-16edge': X => X.makeEdge(9, 16),
        '11-16edge': X => X.makeEdge(11, 16),
        '13-16edge': X => X.makeEdge(13, 16),
        '1-4cyli': X => X.makeCylinder(true, 1),
        '2-4cyli': X => X.makeCylinder(true, 2, true), // For unknown reasons the conditional lines are at y=1 instead of y=0
        '4-4cyli': X => X.makeCylinder(true, 4),
        '1-4cyli2': X => X.makeCylinder(false, 1),
        '2-4cyli2': X => X.makeCylinder(false, 2),
        '4-4cyli2': X => X.makeCylinder(false, 4),
        '1-4cylc': X => X.makeCylinderClosed(1),
        '2-4cylc': X => X.makeCylinderClosed(2),
        '4-4cylc': X => X.makeCylinderClosed(4),
        '1-4cyls': X => X.makeCylinderSloped(1, new THREE.Vector3(-1, 0, 1)),
        '2-4cyls': X => X.makeCylinderSloped(2, new THREE.Vector3(-1, 0, -1)),
        '4-4cyls': X => X.makeCylinderSloped(4),
        '1-4disc': X => X.makeDisc(1),
        '2-4disc': X => X.makeDisc(2),
        '3-4disc': X => X.makeDisc(3),
        '4-4disc': X => X.makeDisc(4),
        '2-4ring1': X => X.makeRing(2, 4, 1),
        '4-4ring2': X => X.makeRing(4, 4, 2),
        '4-4ring3': X => X.makeRing(4, 4, 3),
        '4-4ring5': X => X.makeRing(4, 4, 5),
        '4-4ring6': X => X.makeRing(4, 4, 6),    
        'logo': X => X.makeLogo1(),
        'empty': X => X.makeEmpty()
    },
    make: function(id) {
        let sid = id.substring(0, id.length-4);
        if(this.map.hasOwnProperty(sid)) {
            let pt = this.map[sid](this);
            pt.name = pt.ID = id;
            return pt;
        }
        else {
            return null;
        }
    }
};

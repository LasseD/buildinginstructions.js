'use strict';

/**
   LDRGenerator defines the LDR.Generator namespace and is used for quick generation of LDraw primitives, such as simple circles, cylinders and discs.
 */

// Helper functions:
THREE.LDRStep.prototype.al = function(lines) {
    for(let i = 0; i < lines.length; i+=6) {
	this.addLine(24,
		     LDR.Generator.V(lines[i], lines[i+1], lines[i+2]),
		     LDR.Generator.V(lines[i+3], lines[i+4], lines[i+5]));
    }
}
THREE.LDRStep.prototype.at = function(triangles) {
    for(let i = 0; i < triangles.length; i+=9) {
	this.addTriangle(16,
		         LDR.Generator.V(triangles[i], triangles[i+1], triangles[i+2]),
		         LDR.Generator.V(triangles[i+3], triangles[i+4], triangles[i+5]),
		         LDR.Generator.V(triangles[i+6], triangles[i+7], triangles[i+8]));
    }
}
THREE.LDRStep.prototype.aq = function(quads) {
    for(let i = 0; i < quads.length; i+=12) {
	this.addQuad(16,
		     LDR.Generator.V(quads[i], quads[i+1], quads[i+2]),
		     LDR.Generator.V(quads[i+3], quads[i+4], quads[i+5]),
		     LDR.Generator.V(quads[i+6], quads[i+7], quads[i+8]),
		     LDR.Generator.V(quads[i+9], quads[i+10], quads[i+11]));
    }
}
THREE.LDRStep.prototype.asm = function(p = null, r = null, id = '', c = 16, cull = true, ccw = false) {
    if(p === null) {
        p = LDR.Generator.V(0, 0, 0);
    }
    if(r === null) {
        r = LDR.Generator.R(1, 1);
    }
    this.addSubModel(new THREE.LDRPartDescription(c, p, r, id+'.dat', cull, ccw));
}

LDR.Generator = {
    pad2: x => (x < 10 ? ' ' : '') + x,
    pT: function(desc) {
        let pt = new THREE.LDRPartType();

        pt.modelDescription = desc;
        pt.author = 'LDRGenerator.js';
        pt.license = 'Redistributable under CCAL version 2.0 : see CAreadme.txt';
        pt.inlined = 'GENERATED';
        pt.ldraw_org = 'Primitive';
        pt.cleanSteps = pt.certifiedBFC = pt.CCW = pt.isPart = true;
        
        let s = new THREE.LDRStep();
        pt.steps.push(s); // No need to user 'addStep()' for primitives.

        return [pt,s];
    },
    R: function(a, b) {
        let ret = new THREE.Matrix3();
        ret.set(a, 0, 0, 0, b, 0, 0, 0, a);
        return ret;
    },
    R2: function(a, b, c) {
        let ret = new THREE.Matrix3();
        ret.set(0, 0, a, 0, b, 0, c, 0, 0);
        return ret;
    },
    f2s: function(f) {
        if(f === parseInt(f+'')) {
            return f + '.0';
        }
        return f;
    },
    V: (x,y,z) => new THREE.Vector3(x,y,z),
    empty: function(id = 'Empty') {
        let [pt,ignore] = this.pT(id);
        pt.steps = [];
        return pt;
    },
    alias: function(to) {
        let [pt,s] = this.pT("~Moved to " + to);
        s.asm(null, null, to);
        pt.replacement = to + '.dat';
        return pt;
    },
    
    cylClosed: function(sections) {
        let [pt,s] = this.pT('Cylinder Closed ' + this.f2s(sections*0.25));
        let p0 = this.V();
        let p1 = this.V(0, 1, 0);
        let r = this.R(1, 1);
        
        s.asm(p0, r, sections+'-4edge');
        s.asm(p1, r, sections+'-4edge');
        s.asm(p0, r, sections+'-4disc');
        s.asm(p0, r, sections+'-4cyli');
        return pt;
    },
    edge: function(N, D) {
        let [pt,S] = this.pT('Circle ' + this.f2s(N*1.0/D));
        let prev = this.V(1, 0, 0);
        for(let i = 1; i <= 16/D*N; i++) {
            let angle = i*Math.PI/8;
            let c = Math.cos(angle), s = Math.sin(angle);
            let p = this.V(c, 0, s);
            S.addLine(24, prev, p);
            prev = p;
        }
        return pt;
    },
    cyl: function(cond, sections, flip = false) {
        let desc = 'Cylinder ' + this.f2s(sections*0.25);
        if(!cond) {
            desc += ' without Conditional Lines';
        }
        let [pt,S] = this.pT(desc);
        
        let p0 = this.V(1, 0, 0), p1 = this.V(1, 1, 0);
        let angle = Math.PI/8;
        let c = Math.cos(angle), s = Math.sin(angle);
        let next0 = this.V(c, 0, s);
        let next1 = this.V(c, 1, s);

        if(cond && sections < 4) { // Add conditional line in beginning:
            if(flip) {
                S.addConditionalLine(24, p0, p1, next1, this.V(1, 1, -.4142)); // I have no idea why 2-4cyli.dat is this irregular.
            }
            else {
                S.addConditionalLine(24, p0, p1, next0, this.V(1, 0, -1));
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

            S.addQuad(16, prev1, p1, p0, prev0);

            if(cond) {
                if(flip) {
                    S.addConditionalLine(24, p0, p1, next1, prev1);
                }
                else {
                    S.addConditionalLine(24, p0, p1, next0, prev0);
                }
            }
        }
        if(cond && sections < 4) { // Fix last conditional line to align with orthogonal wall:
            let last = S.conditionalLines[S.conditionalLines.length-1];
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
    cylSloped: function(N, lastNext) {
        let [pt,S] = this.pT('Cylinder Sloped ' + this.f2s(N*0.25));

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
                S.addTriangle(16, prev1, p1, p0);
            }
            else if(i === 17) {
                S.addTriangle(16, prev1, p1, prev0);
            }
            else {
                S.addQuad(16, prev1, p1, p0, prev0);
            }
            
            if(p0.y !== p1.y) {
                S.addConditionalLine(24, p0, p1, prev0, next0);
            }
        }
        if(lastNext) {
            next0.copy(lastNext);
        }
        
        return pt;
    },
    disc: function(sections) {
        let [pt,S] = this.pT('Disc ' + this.f2s(sections*0.25));
        let zero = this.V(0, 0, 0);
        let prev = this.V(1, 0, 0);
        for(let i = 1; i <= 4*sections; i++) {
            let angle = i*Math.PI/8;
            let c = Math.cos(angle), s = Math.sin(angle);
            let p = this.V(c, 0, s);
            S.addTriangle(16, zero, prev, p);
            prev = p;
        }
        return pt;
    },
    ring: function(N, D, size) {
        let [pt,S] = this.pT('Ring  ' + size + ' x ' + this.f2s(1.0/D*N));
        let SIZE = size+1;
        let prev1 = this.V(size, 0, 0);
        let prev2 = this.V(SIZE, 0, 0);
        for(let i = 1; i <= 16/D*N; i++) {
            let angle = i*Math.PI/8;
            let c = Math.cos(angle), s = Math.sin(angle);
            let p1 = this.V(SIZE*c, 0, SIZE*s);
            let p2 = this.V(size*c, 0, size*s);
            S.addQuad(16, prev2, p1, p2, prev1);
            prev1 = p2;
            prev2 = p1;
        }
        return pt;
    },
    stug: function(X, Y, suffix = '', sub = 1) {
        const NAMES = {'':'',
                       '2':'Open ',
                       '3':'Tube Solid ',
                       '4':'Tube Open ',
                       'p01':'with Dot Pattern '};
        let [pt,s] = this.pT('Stud ' + NAMES[suffix] + 'Group ' + this.pad2(X) + ' x ' + this.pad2(Y));
                                
        for(let x = 0; x*sub < X; x++) {
            for(let y = 0; y*sub < Y; y++) {
                let p = this.V(20*y*sub - Y*10 + 10*sub, 0, 20*x*sub - X*10 + 10*sub);
                if(sub === 1 && sub === 1) {
                    s.asm(p, null, 'stud' + suffix);
                }
                else {
                    s.asm(p, null, 'stug' + suffix + '-' + sub + 'x' + sub);
                }
            }
        }
        return pt;
    },
    stug2: function(suffix) {
        const NAMES = {10:'Curved',15:'Straight'};
        let [pt,s] = this.pT('Stud Group Truncated Laterally ' + NAMES[suffix] + ' 40D for Round 2 x 2 Parts');

        s.asm(this.V(-10,0,-10), this.R(-1,1), 'stud' + suffix);
        s.asm(this.V(-10,0,10), this.R2(-1,1,1), 'stud' + suffix);
        s.asm(this.V(10,0,-10), this.R2(1,1,-1), 'stud' + suffix);

        s.asm(this.V(10,0,10), null, 'stud' + suffix);

        return pt;
    },
    stug3: function(S, px1, px2, X, py, Y = 'stud', y = 1) {
        let [pt,s] = this.pT('Stud Group  ' + S + ' x  ' + S);
                                
        s.asm(this.V(px1, 0, px2), null, 'stug-' + X + 'x' + X);
        for(let x = 0; x < (S/y)-1; x++) {
            s.asm(this.V(10*(y-S + 2*x*y), 0, py), null, Y);
        }
        for(let x = 0; x < (S/y); x++) {
            s.asm(this.V((S-y)*10, 0, 10*(y-S + 2*x*y)), null, Y);
        }
        return pt;
    },
    stug4: function(x) {
        let [pt,s] = this.pT('Stud Tube Open Group  ' + x + ' x  ' + x);
        x--;
        s.asm(this.V(-10,0,-10), null, 'stug4-' + x + 'x' + x);
        s.asm(this.V(-10,0,10*x), null, 'stug4-1x' + x);
        s.asm(this.V(10*x,0,0), this.R2(-1,1,1), 'stug4-1x' + (x+1));

        return pt;
    },
    triangle: function() {
        let [pt,s] = this.pT('Triangle');
        s.at([0,0,0,1,0,0,0,0,1]);
        s.al([0,0,0,1,0,0, 1,0,0,0,0,1, 0,0,1,0,0,0]);
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
    logo1: function() {
        let [pt,s] = this.pT('LEGO Logo for Studs - Non-3D Thin Lines');
        pt.ldraw_org = 'Unofficial_Primitive';

        this.logoPositions.forEach(letter => {
	    for(let i = 2; i < letter.length; i+=2) {
	        s.al([letter[i-2], 0, letter[i-1], letter[i], 0, letter[i+1]]);
	    }
        });
        return pt;
    },    
    map: {
        '1-4edge': X => X.edge(1, 4),
        '2-4edge': X => X.edge(2, 4),
        '3-4edge': X => X.edge(3, 4),
        '4-4edge': X => X.edge(4, 4),
        '1-8edge': X => X.edge(1, 8),
        '3-8edge': X => X.edge(3, 8),
        '5-8edge': X => X.edge(5, 8),
        '7-8edge': X => X.edge(7, 8),
        '1-16edge': X => X.edge(1, 16),
        '3-16edge': X => X.edge(3, 16),
        '5-16edge': X => X.edge(5, 16),
        '7-16edge': X => X.edge(7, 16),
        '9-16edge': X => X.edge(9, 16),
        '11-16edge': X => X.edge(11, 16),
        '13-16edge': X => X.edge(13, 16),
        
        '1-4cyli': X => X.cyl(true, 1),
        '2-4cyli': X => X.cyl(true, 2, true), // For unknown reasons the conditional lines are at y=1 instead of y=0
        '4-4cyli': X => X.cyl(true, 4),

        '1-4cyli2': X => X.cyl(false, 1),
        '2-4cyli2': X => X.cyl(false, 2),
        '4-4cyli2': X => X.cyl(false, 4),

        '1-4cylc': X => X.cylClosed(1),
        '2-4cylc': X => X.cylClosed(2),
        '4-4cylc': X => X.cylClosed(4),
        '1-4cyls': X => X.cylSloped(1, new THREE.Vector3(-1, 0, 1)),
        '2-4cyls': X => X.cylSloped(2, new THREE.Vector3(-1, 0, -1)),
        '4-4cyls': X => X.cylSloped(4),

        '1-4disc': X => X.disc(1),
        '2-4disc': X => X.disc(2),
        '3-4disc': X => X.disc(3),
        '4-4disc': X => X.disc(4),

        '2-4ring1': X => X.ring(2, 4, 1),
        '4-4ring2': X => X.ring(4, 4, 2),
        '4-4ring3': X => X.ring(4, 4, 3),
        '4-4ring5': X => X.ring(4, 4, 5),
        '4-4ring6': X => X.ring(4, 4, 6),    

        'stug-1x2': X => X.stug(1, 2),
        'stug-1x3': X => X.stug(1, 3),
        'stug-1x4': X => X.stug(1, 4),
        'stug-1x5': X => X.stug(1, 5),
        'stug-1x6': X => X.stug(1, 6),
        'stug-1x7': X => X.stug(1, 7),
        'stug-1x8': X => X.stug(1, 8),
        'stug-1x9': X => X.stug(1, 9),
        'stug-1x10': X => X.stug(1, 10),
        'stug-1x11': X => X.stug(1, 11),
        'stug-1x12': X => X.stug(1, 12),
        'stug-2x1': X => X.stug(2, 1),
        'stug-2x2': X => X.stug(2, 2),
        'stug-3x1': X => X.stug(3, 1),
        'stug-3x3': X => X.stug(3, 3),
        'stug-4x1': X => X.stug(4, 1),
        'stug-4x4': X => X.stug(4, 4, '', 2),
        'stug-5x1': X => X.stug(5, 1),
        'stug-5x5': X => X.stug3(5, -10, -10, 4, 40),
        'stug-6x1': X => X.stug(6, 1),
        'stug-6x6': X => X.stug(6, 6, '', 3),
        'stug-7x1': X => X.stug(7, 1),
        'stug-7x7': X => X.stug3(7, -10, 10, 6, -60),
        'stug-8x1': X => X.stug(8, 1),
        'stug-8x8': X => X.stug(8, 8, '', 4),
        'stug-9x1': X => X.stug(9, 1),
        'stug-9x9': X => X.stug3(9, -30, -30, 6, 60, 'stug-3x3', 3),
        'stug-10x1': X => X.stug(10, 1),
        'stug-11x1': X => X.stug(11, 1),
        'stug-12x1': X => X.stug(12, 1),
        'stug-16x16': X => X.stug(16, 16, '', 8),
        'stug2': X => X.alias('stug-2x2'),
        'stug2-1x2': X => X.stug(1, 2, '2'),
        'stug2-1x3': X => X.stug(1, 3, '2'),
        'stug2-1x4': X => X.stug(1, 4, '2'),
        'stug2-1x6': X => X.stug(1, 6, '2'),
        'stug2-1x8': X => X.stug(1, 8, '2'),
        'stug2-1x10': X => X.stug(1, 10, '2'),
        'stug2-1x12': X => X.stug(1, 12, '2'),
        'stug2-2x1': X => X.stug(2, 1, '2'),
        'stug2-2x2': X => X.stug(2, 2, '2'),
        'stug2-3x1': X => X.stug(3, 1, '2'),
        'stug2-4x1': X => X.stug(4, 1, '2'),
        'stug2-4x4': X => X.stug(4, 4, '2', 2),
        'stug2-6x1': X => X.stug(6, 1, '2'),
        'stug2-10x1': X => X.stug(10, 1, '2'),
        'stug2-12x1': X => X.stug(12, 1, '2'),
        'stug2a': X => X.alias('stug2-2x2'),
        'stug3': X => X.alias('stug-3x3'),
        'stug3-1x2': X => X.stug(1, 2, '3'),
        'stug3-1x3': X => X.stug(1, 3, '3'),
        'stug3-1x4': X => X.stug(1, 4, '3'),
        'stug3-1x5': X => X.stug(1, 5, '3'),
        'stug3-1x7': X => X.stug(1, 7, '3'),
        'stug3-1x8': X => X.stug(1, 8, '3'),
        'stug4': X => X.alias('stug-4x4'),
        'stug4-1x2': X => X.stug(1, 2, '4'),
        'stug4-1x3': X => X.stug(1, 3, '4'),
        'stug4-1x4': X => X.stug(1, 4, '4'),
        'stug4-1x5': X => X.stug(1, 5, '4'),
        'stug4-1x6': X => X.stug(1, 6, '4'),
        'stug4-1x7': X => X.stug(1, 7, '4'),
        'stug4-1x8': X => X.stug(1, 8, '4'),
        'stug4-1x9': X => X.stug(1, 9, '4'),
        'stug4-1x10': X => X.stug(1, 10, '4'),
        'stug4-1x11': X => X.stug(1, 11, '4'),
        'stug4-2x2': X => X.stug(2, 2, '4'),
        'stug4-3x3': X => X.stug(3, 3, '4'),
        'stug4-4x4': X => X.stug(4, 4, '4', 2),
        'stug4-5x5': X => X.stug4(5),
        'stug4-6x6': X => X.stug(6, 6, '4', 3),
        'stug4-7x7': X => X.stug4(7),
        'stug4a': X => X.alias('stug2-4x4'),
        'stug5': X => X.alias('stug-5x5'),
        'stug6': X => X.alias('stug-6x6'),
        'stug7': X => X.alias('stug-7x7'),
        'stug8': X => X.alias('stug-8x8'),
        'stug9': X => X.alias('stug-9x9'),
        'stug10-2x2': X => X.stug2(10),
        'stug15-2x2': X => X.stug2(15),
        'stugp01-1x3': X => X.stug(1, 3, 'p01'),
        'stugp01-1x6': X => X.stug(1, 6, 'p01'),
        'stugp01-1x10': X => X.stug(1, 10, 'p01'),

        'logo': X => X.logo1(),
        'empty': X => X.empty(),
        'triangle': X => X.triangle(),
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

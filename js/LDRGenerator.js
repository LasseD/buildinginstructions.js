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
    e48: function(N, D) {
        let [pt,S] = this.pT('Hi-Res Circle ' + this.f2s(N*1.0/D));
        let prev = this.V(1, 0, 0);
        for(let i = 1; i <= 48/D*N; i++) {
            let angle = i*Math.PI/24;
            let c = Math.cos(angle), s = Math.sin(angle);
            let p = this.V(c, 0, s);
            S.addLine(24, prev, p);
            prev = p;
        }
        return pt;
    },
    cyl: function(cond, N, D, flip = false) {
        let desc = 'Cylinder ' + this.f2s(N*1.0/D);
        if(!cond) {
            desc += ' without Conditional Lines';
        }
        let [pt,S] = this.pT(desc);

        let p0 = this.V(1, 0, 0), p1 = this.V(1, 1, 0);
        let angle = Math.PI/8;
        let c = Math.cos(angle), s = Math.sin(angle);
        let next0 = this.V(c, 0, s);
        let next1 = this.V(c, 1, s);

        if(cond && N < D) { // Add conditional line in beginning:
            if(flip) {
                S.addConditionalLine(24, p0, p1, next1, this.V(1, 1, -.4142)); // I have no idea why 2-4cyli.dat is this irregular.
            }
            else {
                S.addConditionalLine(24, p0, p1, next0, this.V(1, 0, -1));
            }
        }
        let prev0;
        for(let i = 2; i < N*D + 2; i++) {
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
        if(cond && N < D) { // Fix last conditional line to align with orthogonal wall:
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
    ri: function(N, D, size, ERROR_NAME = false) {
        let [pt,S] = this.pT(ERROR_NAME ? ERROR_NAME : 'Ring ' + this.pad2(size) + ' x ' + this.f2s(1.0/D*N));
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
    r48: function(N, D, size) {
        let [pt,S] = this.pT('Hi-Res Ring  ' + size + ' x ' + this.f2s(1.0/D*N));
        let SIZE = size+1;
        let prev1 = this.V(size, 0, 0);
        let prev2 = this.V(SIZE, 0, 0);
        for(let i = 1; i <= 48/D*N; i++) {
            let angle = i*Math.PI/24;
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
    rect: function(hx, name, prefix = '') {
        let [pt,s] = this.pT('Rectangle' + (name ? (prefix + ' with ' + name) : ''));
        if(hx & 1) {
            s.aq([-1,0,1,-1,0,-1,1,0,-1,1,0,1]);
        }
        if(hx & 2) {
            s.al([1,0,1,-1,0,1]);
        }
        if(hx & 4) {
            s.al([-1,0,1,-1,0,-1]);
        }
        if(hx & 8) {
            s.al([-1,0,-1,1,0,-1]);
        }
        if(hx & 16) {
            s.al([1,0,-1,1,0,1]);
        }
        return pt;
    },
    map: {
        'rect': X => X.rect(31),
        'rect1': X => X.rect(17, '1 Edge'),
        'rect2a': X => X.rect(19, '2 Adjacent Edges'),
        'rect2p': X => X.rect(11, '2 Parallel Edges'),
        'rect3': X => X.rect(23, '3 Edges'),
        'recte3': X => X.rect(22, '3 Edges', ' Empty'),
        'recte4': X => X.rect(30, '4 Edges', ' Empty'),

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

        '48\\1-3edge': X => X.e48(1, 3),
        '48\\1-4edge': X => X.e48(1, 4),
        '48\\1-6edge': X => X.e48(1, 6),
        '48\\1-8edge': X => X.e48(1, 8),
        '48\\1-12edge': X => X.e48(1, 12),
        '48\\1-16edge': X => X.e48(1, 16),
        '48\\1-24edge': X => X.e48(1, 24),
        '48\\1-48edge': X => X.e48(1, 48),
        '48\\2-3edge': X => X.e48(2, 3),
        '48\\2-4edge': X => X.e48(2, 4), // Inconsistent slash in official LDraw file
        '48\\3-4edge': X => X.e48(3, 4),
        '48\\3-8edge': X => X.e48(3, 8),
        '48\\3-16edge': X => X.e48(3, 16),
        '48\\4-4edge': X => X.e48(4, 4), // -||-
        '48\\5-8edge': X => X.e48(5, 8),
        '48\\5-12edge': X => X.e48(5, 12),
        '48\\5-16edge': X => X.e48(5, 16),
        '48\\5-24edge': X => X.e48(5, 24),
        '48\\5-48edge': X => X.e48(5, 48),
        '48\\7-16edge': X => X.e48(7, 16),
        '48\\7-24edge': X => X.e48(7, 24),
        '48\\7-48edge': X => X.e48(7, 48),
        '48\\11-24edge': X => X.e48(11, 24),
        '48\\11-48edge': X => X.e48(11, 48),
        '48\\19-48edge': X => X.e48(19, 48),

        // TODO: All cylinders
        '1-4cyli': X => X.cyl(true, 1, 4),
        '2-4cyli': X => X.cyl(true, 2, 4, true), // For unknown reasons the conditional lines are at y=1 instead of y=0
        //'3-4cyli': X => X.cyl(true, 3, 4), TODO FIX
        '4-4cyli': X => X.cyl(true, 4, 4),

        '1-4cyli2': X => X.cyl(false, 1, 4),
        '2-4cyli2': X => X.cyl(false, 2, 4),
        '4-4cyli2': X => X.cyl(false, 4, 4),

        '1-4cylc': X => X.cylClosed(1),
        '2-4cylc': X => X.cylClosed(2),
        '4-4cylc': X => X.cylClosed(4),

        '1-4cyls': X => X.cylSloped(1, X.V(-1, 0, 1)),
        '2-4cyls': X => X.cylSloped(2, X.V(-1, 0, -1)),
        '4-4cyls': X => X.cylSloped(4),

        // TODO: All discs
        '1-4disc': X => X.disc(1),
        '2-4disc': X => X.disc(2),
        '3-4disc': X => X.disc(3),
        '4-4disc': X => X.disc(4),

        '1-4ring1': X => X.ri(1, 4, 1),
        '1-4ring2': X => X.ri(1, 4, 2),
        '1-4ring3': X => X.ri(1, 4, 3),
        '1-4ring4': X => X.ri(1, 4, 4),
        '1-4ring5': X => X.ri(1, 4, 5),
        '1-4ring6': X => X.ri(1, 4, 6),
        '1-4ring7': X => X.ri(1, 4, 7),
        '1-4ring8': X => X.ri(1, 4, 8),
        '1-4ring9': X => X.ri(1, 4, 9),
        '1-4rin10': X => X.ri(1, 4, 10),
        '1-4rin11': X => X.ri(1, 4, 11),
        '1-4rin12': X => X.ri(1, 4, 12),
        '1-4rin13': X => X.ri(1, 4, 13),
        '1-4rin14': X => X.ri(1, 4, 14),
        '1-4rin15': X => X.ri(1, 4, 15),
        '1-4rin16': X => X.ri(1, 4, 16),
        '1-4rin17': X => X.ri(1, 4, 17),
        '1-4rin18': X => X.ri(1, 4, 18),
        '1-4rin19': X => X.ri(1, 4, 19),
        '1-4rin20': X => X.ri(1, 4, 20),
        '1-4rin23': X => X.ri(1, 4, 23),
        '1-4rin24': X => X.ri(1, 4, 24),
        '1-4rin28': X => X.ri(1, 4, 28),
        '1-4rin34': X => X.ri(1, 4, 34),
        '1-4rin38': X => X.ri(1, 4, 38),
        '1-4rin39': X => X.ri(1, 4, 39),
        '1-4rin48': X => X.ri(1, 4, 48),
        '1-4rin49': X => X.ri(1, 4, 49),
        '1-4rin50': X => X.ri(1, 4, 50),
        '1-4ring79': X => X.ri(1, 4, 79),
        '1-8ring1': X => X.ri(1, 8, 1),
        '1-8ring2': X => X.ri(1, 8, 2),
        '1-8ring3': X => X.ri(1, 8, 3),
        '1-8ring4': X => X.ri(1, 8, 4),
        '1-8ring5': X => X.ri(1, 8, 5, 'Ring  5 x 0.25'),
        '1-8ring6': X => X.ri(1, 8, 6),
        '1-8ring7': X => X.ri(1, 8, 7),
        '1-8ring8': X => X.ri(1, 8, 8),
        '1-8ring9': X => X.ri(1, 8, 9),
        '1-8rin10': X => X.ri(1, 8, 10),
        '1-8ring12': X => X.ri(1, 8, 12),
        '1-8rin15': X => X.ri(1, 8, 15),
        '1-8rin17': X => X.ri(1, 8, 17),
        '1-8rin18': X => X.ri(1, 8, 18),
        '1-8rin19': X => X.ri(1, 8, 19),
        '1-8rin23': X => X.ri(1, 8, 23),
        '1-8ring27': X => X.ri(1, 8, 27),
        '1-8ring33': X => X.ri(1, 8, 33),
        '1-8rin39': X => X.ri(1, 8, 39),
        '1-16rin1': X => X.ri(1, 16, 1),
        '1-16rin2': X => X.ri(1, 16, 2),
        '1-16rin3': X => X.ri(1, 16, 3),
        '1-16rin4': X => X.ri(1, 16, 4),
        '1-16ring9': X => X.ri(1, 16, 9),
        '1-16ring11': X => X.ri(1, 16, 11),
        '1-16ring19': X => X.ri(1, 16, 19),
        '2-4ring1': X => X.ri(2, 4, 1),
        '2-4ring2': X => X.ri(2, 4, 2),
        '2-4ring3': X => X.ri(2, 4, 3),
        '2-4ring4': X => X.ri(2, 4, 4),
        '2-4ring5': X => X.ri(2, 4, 5),
        '2-4ring6': X => X.ri(2, 4, 6),
        '2-4ring7': X => X.ri(2, 4, 7),
        '2-4ring8': X => X.ri(2, 4, 8),
        '2-4ring9': X => X.ri(2, 4, 9),
        '2-4rin10': X => X.ri(2, 4, 10),
        '2-4rin11': X => X.ri(2, 4, 11),
        '2-4rin12': X => X.ri(2, 4, 12),
        '2-4rin13': X => X.ri(2, 4, 13),
        '2-4rin14': X => X.ri(2, 4, 14),
        '2-4rin15': X => X.ri(2, 4, 15),
        '2-4rin16': X => X.ri(2, 4, 16),
        '2-4rin17': X => X.ri(2, 4, 17),
        '2-4rin18': X => X.ri(2, 4, 18),
        '2-4ring19': X => X.ri(2, 4, 19),
        '2-4rin20': X => X.ri(2, 4, 20),
        '2-4rin22': X => X.ri(2, 4, 22),
        '2-4rin23': X => X.ri(2, 4, 23),
        '2-4rin24': X => X.ri(2, 4, 24),
        '2-4rin25': X => X.ri(2, 4, 25),
        '2-4rin30': X => X.ri(2, 4, 30),
        '2-4ring32': X => X.ri(2, 4, 32),
        '2-4ring37': X => X.ri(2, 4, 37),
        '2-4ring43': X => X.ri(2, 4, 43),
        '2-4ring44': X => X.ri(2, 4, 44),
        '2-4rin52': X => X.ri(2, 4, 52),
        '3-4ring1': X => X.ri(3, 4, 1),
        '3-4ring2': X => X.ri(3, 4, 2),
        '3-4ring3': X => X.ri(3, 4, 3),
        '3-4ring4': X => X.ri(3, 4, 4),
        '3-4ring5': X => X.ri(3, 4, 5),
        '3-4ring6': X => X.ri(3, 4, 6),
        '3-4ring7': X => X.ri(3, 4, 7),
        '3-4ring8': X => X.ri(3, 4, 8),
        '3-4ring9': X => X.ri(3, 4, 9),
        '3-4rin10': X => X.ri(3, 4, 10),
        '3-4rin14': X => X.ri(3, 4, 14),
        '3-4rin22': X => X.ri(3, 4, 22),
        '3-8ring1': X => X.ri(3, 8, 1),
        '3-8ring2': X => X.ri(3, 8, 2),
        '3-8ring3': X => X.ri(3, 8, 3),
        '3-8ring4': X => X.ri(3, 8, 4),
        '3-8ring5': X => X.ri(3, 8, 5),
        '3-8ring6': X => X.ri(3, 8, 6),
        '3-8ring7': X => X.ri(3, 8, 7),
        '3-8ring8': X => X.ri(3, 8, 8),
        '3-8ring9': X => X.ri(3, 8, 9),
        '3-8rin10': X => X.ri(3, 8, 10),
        '3-8rin12': X => X.ri(3, 8, 12),
        '3-8rin13': X => X.ri(3, 8, 13),
        '3-8rin15': X => X.ri(3, 8, 15),
        '3-8rin16': X => X.ri(3, 8, 16),
        '3-8rin18': X => X.ri(3, 8, 18),
        '3-8rin24': X => X.ri(3, 8, 24),
        '3-16rin1': X => X.ri(3, 16, 1),
        '3-16ring1': X => X.ri(3, 16, 1),
        '3-16rin2': X => X.ri(3, 16, 2),
        '3-16rin3': X => X.ri(3, 16, 3),
        '3-16rin4': X => X.ri(3, 16, 4),
        '3-16rin5': X => X.ri(3, 16, 5),
        '3-16rin6': X => X.ri(3, 16, 6),
        '3-16rin7': X => X.ri(3, 16, 7),
        '3-16rin8': X => X.ri(3, 16, 8),
        '3-16rin9': X => X.ri(3, 16, 9),
        '3-16ring11': X => X.ri(3, 16, 11),
        '3-16ring12': X => X.ri(3, 16, 12),
        '3-16ring13': X => X.ri(3, 16, 13),
        '3-16ring14': X => X.ri(3, 16, 14),
        '3-16ring24': X => X.ri(3, 16, 24),
        '4-4ring1': X => X.ri(4, 4, 1),
        '4-4ring2': X => X.ri(4, 4, 2),
        '4-4ring3': X => X.ri(4, 4, 3),
        '4-4ring4': X => X.ri(4, 4, 4),
        '4-4ring5': X => X.ri(4, 4, 5),
        '4-4ring6': X => X.ri(4, 4, 6),
        '4-4ring7': X => X.ri(4, 4, 7),
        '4-4ring8': X => X.ri(4, 4, 8),
        '4-4ring9': X => X.ri(4, 4, 9),
        '4-4rin10': X => X.ri(4, 4, 10),
        '4-4rin11': X => X.ri(4, 4, 11),
        '4-4rin12': X => X.ri(4, 4, 12),
        '4-4rin13': X => X.ri(4, 4, 13),
        '4-4rin14': X => X.ri(4, 4, 14),
        '4-4rin15': X => X.ri(4, 4, 15),
        '4-4rin16': X => X.ri(4, 4, 16),
        '4-4rin17': X => X.ri(4, 4, 17),
        '4-4rin18': X => X.ri(4, 4, 18),
        '4-4rin19': X => X.ri(4, 4, 19),
        '4-4rin20': X => X.ri(4, 4, 20),
        '4-4rin21': X => X.ri(4, 4, 21),
        '4-4rin22': X => X.ri(4, 4, 22),
        '4-4rin23': X => X.ri(4, 4, 23),
        '4-4rin24': X => X.ri(4, 4, 24),
        '4-4rin25': X => X.ri(4, 4, 25),
        '4-4rin26': X => X.ri(4, 4, 26),
        '4-4rin29': X => X.ri(4, 4, 29),
        '4-4rin30': X => X.ri(4, 4, 30),
        '4-4rin31': X => X.ri(4, 4, 31),
        '4-4rin32': X => X.ri(4, 4, 32),
        '4-4rin33': X => X.ri(4, 4, 33),
        '4-4rin34': X => X.ri(4, 4, 34),
        '4-4ring35': X => X.ri(4, 4, 35),
        '4-4rin36': X => X.ri(4, 4, 36),
        '4-4rin37': X => X.ri(4, 4, 37),
        '4-4rin38': X => X.ri(4, 4, 38),
        '4-4rin39': X => X.ri(4, 4, 39),
        '4-4rin40': X => X.ri(4, 4, 40),
        '4-4rin43': X => X.ri(4, 4, 43),
        '4-4rin44': X => X.ri(4, 4, 44),
        '4-4rin45': X => X.ri(4, 4, 45),
        '4-4rin46': X => X.ri(4, 4, 46),
        '4-4rin47': X => X.ri(4, 4, 47),
        '4-4rin48': X => X.ri(4, 4, 48),
        '4-4rin50': X => X.ri(4, 4, 50),
        '4-4rin51': X => X.ri(4, 4, 51),
        '4-4rin52': X => X.ri(4, 4, 52),
        '4-4rin57': X => X.ri(4, 4, 57),
        '4-4rin77': X => X.ri(4, 4, 77),
        '4-4rin78': X => X.ri(4, 4, 78),
        '4-4rin79': X => X.ri(4, 4, 79),
        '4-4rin85': X => X.ri(4, 4, 85),
        '4-4ring101': X => X.ri(4, 4, 101),
        '5-8ring1': X => X.ri(5, 8, 1),
        '5-8ring2': X => X.ri(5, 8, 2),
        '5-8ring3': X => X.ri(5, 8, 3),
        '5-8ring4': X => X.ri(5, 8, 4),
        '5-8ring6': X => X.ri(5, 8, 6),
        '5-8ring10': X => X.ri(5, 8, 10),
        '5-16ring1': X => X.ri(5, 16, 1),
        '5-16rin2': X => X.ri(5, 16, 2),
        '5-16rin3': X => X.ri(5, 16, 3),
        '5-16rin5': X => X.ri(5, 16, 5),
        '5-16ring12': X => X.ri(5, 16, 12),
        '7-8ring1': X => X.ri(7, 8, 1),
        '7-8ring2': X => X.ri(7, 8, 2),
        '7-8ring3': X => X.ri(7, 8, 3),
        '7-8ring8': X => X.ri(7, 8, 8),
        '7-8ring9': X => X.ri(7, 8, 9),
        '7-8rin12': X => X.ri(7, 8, 12),
        '7-8rin15': X => X.ri(7, 8, 15),
        '7-8rin16': X => X.ri(7, 8, 16),
        '7-8rin39': X => X.ri(7, 8, 39),
        '7-8rin40': X => X.ri(7, 8, 40),
        '7-16rin1': X => X.ri(7, 16, 1),
        '7-16ring2': X => X.ri(7, 16, 2),
        '7-16rin3': X => X.ri(7, 16, 3),
        '7-16ring3': X => X.ri(7, 16, 3),
        '7-16rin4': X => X.ri(7, 16, 4),
        '7-16ring6': X => X.ri(7, 16, 6),
        '7-16ring9': X => X.ri(7, 16, 9),
        '7-16ring11': X => X.ri(7, 16, 11),
        '7-16ring17': X => X.ri(7, 16, 17),
        'ring1': X => X.alias('4-4ring1'),
        'ring2': X => X.alias('4-4ring2'),
        'ring3': X => X.alias('4-4ring3'),
        'ring4': X => X.alias('4-4ring4'),
        'ring7': X => X.alias('4-4ring7'),
        'ring10': X => X.alias('4-4rin10'),

        '48\\1-12rin1': X => X.r48(1, 12, 1),
        '48\\1-12rin2': X => X.r48(1, 12, 2),
        '48\\1-12rin5': X => X.r48(1, 12, 5),
        '48\\1-12rin6': X => X.r48(1, 12, 6),
        '48\\1-12rin8': X => X.r48(1, 12, 8),
        '48\\1-12rin9': X => X.r48(1, 12, 9),
        '48\\1-12ring12': X => X.r48(1, 12, 12),
        '48\\1-12ring13': X => X.r48(1, 12, 13),
        '48\\1-12ring14': X => X.r48(1, 12, 14),
        '48\\1-12ring15': X => X.r48(1, 12, 15),
        '48\\1-12ring17': X => X.r48(1, 12, 17),
        '48\\1-12ring20': X => X.r48(1, 12, 20),
        '48\\1-12ring29': X => X.r48(1, 12, 29),
        '48\\1-12ring3': X => X.r48(1, 12, 3),
        '48\\1-12ring38': X => X.r48(1, 12, 38),
        '48\\1-12ring39': X => X.r48(1, 12, 39),
        '48\\1-12ring4': X => X.r48(1, 12, 4),
        '48\\1-12ring42': X => X.r48(1, 12, 42),
        '48\\1-12ring56': X => X.r48(1, 12, 56),
        '48\\1-12ring59': X => X.r48(1, 12, 59),
        '48\\1-12ring78': X => X.r48(1, 12, 78),
        '48\\1-16rin3': X => X.r48(1, 16, 3),
        '48\\1-16rin8': X => X.r48(1, 16, 8),
        '48\\1-16ring13': X => X.r48(1, 16, 13),
        '48\\1-16ring14': X => X.r48(1, 16, 14),
        '48\\1-16ring19': X => X.r48(1, 16, 19),
        '48\\1-16ring21': X => X.r48(1, 16, 21),
        '48\\1-16ring29': X => X.r48(1, 16, 29),
        '48\\1-16ring39': X => X.r48(1, 16, 39),
        '48\\1-16ring43': X => X.r48(1, 16, 43),
        '48\\1-16ring59': X => X.r48(1, 16, 59),
        '48\\1-16ring6': X => X.r48(1, 16, 6),
        '48\\1-16ring60': X => X.r48(1, 16, 60),
        '48\\1-16ring7': X => X.r48(1, 16, 7),
        '48\\1-24rin3': X => X.r48(1, 24, 3),
        '48\\1-24rin4': X => X.r48(1, 24, 4),
        '48\\1-24rin5': X => X.r48(1, 24, 5),
        '48\\1-24rin6': X => X.r48(1, 24, 6),
        '48\\1-24rin7': X => X.r48(1, 24, 7),
        '48\\1-24rin9': X => X.r48(1, 24, 9),
        '48\\1-24ring10': X => X.r48(1, 24, 10),
        '48\\1-24ring11': X => X.r48(1, 24, 11),
        '48\\1-24ring19': X => X.r48(1, 24, 19),
        '48\\1-24ring29': X => X.r48(1, 24, 29),
        '48\\1-24ring39': X => X.r48(1, 24, 39),
        '48\\1-24ring59': X => X.r48(1, 24, 59),
        '48\\1-24ring60': X => X.r48(1, 24, 60),
        '48\\1-3rin17': X => X.r48(1, 3, 17),
        '48\\1-3ring2': X => X.r48(1, 3, 2),
        '48\\1-3ring9': X => X.r48(1, 3, 9),
        '48\\1-48rin6': X => X.r48(1, 48, 6),
        '48\\1-48rin9': X => X.r48(1, 48, 9),
        '48\\1-48ring43': X => X.r48(1, 48, 43),
        '48\\1-4rin10': X => X.r48(1, 4, 10),
        '48\\1-4rin11': X => X.r48(1, 4, 11),
        '48\\1-4rin13': X => X.r48(1, 4, 13),
        '48\\1-4rin14': X => X.r48(1, 4, 14),
        '48\\1-4rin15': X => X.r48(1, 4, 15),
        '48\\1-4rin16': X => X.r48(1, 4, 16),
        '48\\1-4rin17': X => X.r48(1, 4, 17),
        '48\\1-4rin18': X => X.r48(1, 4, 18),
        '48\\1-4rin19': X => X.r48(1, 4, 19),
        '48\\1-4rin20': X => X.r48(1, 4, 20),
        '48\\1-4rin21': X => X.r48(1, 4, 21),
        '48\\1-4rin22': X => X.r48(1, 4, 22),
        '48\\1-4rin23': X => X.r48(1, 4, 23),
        '48\\1-4rin24': X => X.r48(1, 4, 24),
        '48\\1-4rin25': X => X.r48(1, 4, 25),
        '48\\1-4rin26': X => X.r48(1, 4, 26),
        '48\\1-4rin27': X => X.r48(1, 4, 27),
        '48\\1-4rin29': X => X.r48(1, 4, 29),
        '48\\1-4rin30': X => X.r48(1, 4, 30),
        '48\\1-4rin31': X => X.r48(1, 4, 31),
        '48\\1-4rin32': X => X.r48(1, 4, 32),
        '48\\1-4rin33': X => X.r48(1, 4, 33),
        '48\\1-4rin34': X => X.r48(1, 4, 34),
        '48\\1-4rin35': X => X.r48(1, 4, 36),
        '48\\1-4rin36': X => X.r48(1, 4, 36),
        '48\\1-4rin37': X => X.r48(1, 4, 37),
        '48\\1-4rin38': X => X.r48(1, 4, 38),
        '48\\1-4rin39': X => X.r48(1, 4, 39),
        '48\\1-4rin40': X => X.r48(1, 4, 40),
        '48\\1-4rin41': X => X.r48(1, 4, 41),
        '48\\1-4rin45': X => X.r48(1, 4, 45),
        '48\\1-4rin48': X => X.r48(1, 4, 48),
        '48\\1-4rin51': X => X.r48(1, 4, 51),
        '48\\1-4rin63': X => X.r48(1, 4, 63),
        '48\\1-4rin64': X => X.r48(1, 4, 64),
        '48\\1-4rin65': X => X.r48(1, 4, 65),
        '48\\1-4rin70': X => X.r48(1, 4, 70),
        '48\\1-4rin71': X => X.r48(1, 4, 71),
        '48\\1-4rin82': X => X.r48(1, 4, 82),
        '48\\1-4rin83': X => X.r48(1, 4, 83),
        '48\\1-4ring1': X => X.r48(1, 4, 1),
        '48\\1-4ring12': X => X.r48(1, 4, 12),
        '48\\1-4ring179': X => X.r48(1, 4, 179),
        '48\\1-4ring2': X => X.r48(1, 4, 2),
        '48\\1-4ring3': X => X.r48(1, 4, 3),
        '48\\1-4ring4': X => X.r48(1, 4, 4),
        '48\\1-4ring46': X => X.r48(1, 4, 46),
        '48\\1-4ring5': X => X.r48(1, 4, 5),
        '48\\1-4ring6': X => X.r48(1, 4, 6),
        '48\\1-4ring7': X => X.r48(1, 4, 7),
        '48\\1-4ring79': X => X.r48(1, 4, 79),
        '48\\1-4ring8': X => X.r48(1, 4, 8),
        '48\\1-4ring9': X => X.r48(1, 4, 9),
        '48\\1-6rin12': X => X.r48(1, 6, 12),
        '48\\1-6rin13': X => X.r48(1, 6, 13),
        '48\\1-6rin14': X => X.r48(1, 6, 14),
        '48\\1-6rin16': X => X.r48(1, 6, 16),
        '48\\1-6rin17': X => X.r48(1, 6, 17),
        '48\\1-6rin18': X => X.r48(1, 6, 18),
        '48\\1-6rin19': X => X.r48(1, 6, 19),
        '48\\1-6rin47': X => X.r48(1, 6, 47),
        '48\\1-6rin50': X => X.r48(1, 6, 50),
        '48\\1-6ring1': X => X.r48(1, 6, 1),
        '48\\1-6ring15': X => X.r48(1, 6, 15),
        '48\\1-6ring29': X => X.r48(1, 6, 29),
        '48\\1-6ring3': X => X.r48(1, 6, 3),
        '48\\1-6ring39': X => X.r48(1, 6, 39),
        '48\\1-6ring42': X => X.r48(1, 6, 42),
        '48\\1-6ring43': X => X.r48(1, 6, 43),
        '48\\1-6ring5': X => X.r48(1, 6, 5),
        '48\\1-6ring6': X => X.r48(1, 6, 6),
        '48\\1-6ring7': X => X.r48(1, 6, 7),
        '48\\1-6ring8': X => X.r48(1, 6, 8),
        '48\\1-6ring80': X => X.r48(1, 6, 80),
        '48\\1-6ring9': X => X.r48(1, 6, 9),
        '48\\1-6ring99': X => X.r48(1, 6, 99),
        '48\\1-8rin14': X => X.r48(1, 8, 14),
        '48\\1-8rin16': X => X.r48(1, 8, 16),
        '48\\1-8rin20': X => X.r48(1, 8, 20),
        '48\\1-8rin28': X => X.r48(1, 8, 28),
        '48\\1-8rin35': X => X.r48(1, 8, 35),
        '48\\1-8rin39': X => X.r48(1, 8, 39),
        '48\\1-8rin56': X => X.r48(1, 8, 56),
        '48\\1-8ring1': X => X.r48(1, 8, 1),
        '48\\1-8ring10': X => X.r48(1, 8, 10),
        '48\\1-8ring12': X => X.r48(1, 8, 12),
        '48\\1-8ring13': X => X.r48(1, 8, 13),
        '48\\1-8ring2': X => X.r48(1, 8, 2),
        '48\\1-8ring3': X => X.r48(1, 8, 3),
        '48\\1-8ring4': X => X.r48(1, 8, 4),
        '48\\1-8ring5': X => X.r48(1, 8, 5),
        '48\\1-8ring6': X => X.r48(1, 8, 6),
        '48\\1-8ring7': X => X.r48(1, 8, 7),
        '48\\1-8ring8': X => X.r48(1, 8, 8),
        '48\\1-8ring9': X => X.r48(1, 8, 9),
        '48\\11-24ring13': X => X.r48(11, 24, 13),
        '48\\11-24ring52': X => X.r48(11, 24, 52),
        '48\\11-48ring19': X => X.r48(11, 48, 19),
        '48\\11-48ring40': X => X.r48(11, 48, 40),
        '48\\2-3ring7': X => X.r48(2, 3, 7),
        '48\\2-4rin11': X => X.r48(2, 4, 11),
        '48\\2-4rin12': X => X.r48(2, 4, 12),
        '48\\2-4rin16': X => X.r48(2, 4, 16),
        '48\\2-4rin17': X => X.r48(2, 4, 17),
        '48\\2-4rin19': X => X.r48(2, 4, 19),
        '48\\2-4rin31': X => X.r48(2, 4, 31),
        '48\\2-4ring1': X => X.r48(2, 4, 1),
        '48\\2-4ring2': X => X.r48(2, 4, 2),
        '48\\2-4ring240': X => X.r48(2, 4, 240),
        '48\\2-4ring3': X => X.r48(2, 4, 3),
        '48\\2-4ring37': X => X.r48(2, 4, 37),
        '48\\2-4ring4': X => X.r48(2, 4, 4),
        '48\\2-4ring40': X => X.r48(2, 4, 40),
        '48\\2-4ring5': X => X.r48(2, 4, 5),
        '48\\2-4ring6': X => X.r48(2, 4, 6),
        '48\\2-4ring9': X => X.r48(2, 4, 9),
        '48\\3-16rin7': X => X.r48(3, 16, 7),
        '48\\3-16rin8': X => X.r48(3, 16, 8),
        '48\\3-16ring39': X => X.r48(3, 16, 39),
        '48\\3-4rin13': X => X.r48(3, 4, 13),
        '48\\3-4rin14': X => X.r48(3, 4, 14),
        '48\\3-4rin16': X => X.r48(3, 4, 16),
        '48\\3-4ring7': X => X.r48(3, 4, 7),
        '48\\4-4rin10': X => X.r48(4, 4, 10),
        '48\\4-4rin11': X => X.r48(4, 4, 11),
        '48\\4-4rin12': X => X.r48(4, 4, 12),
        '48\\4-4rin13': X => X.r48(4, 4, 13),
        '48\\4-4rin14': X => X.r48(4, 4, 14),
        '48\\4-4rin15': X => X.r48(4, 4, 15),
        '48\\4-4rin16': X => X.r48(4, 4, 16),
        '48\\4-4rin17': X => X.r48(4, 4, 17),
        '48\\4-4rin18': X => X.r48(4, 4, 18),
        '48\\4-4rin19': X => X.r48(4, 4, 19),
        '48\\4-4rin20': X => X.r48(4, 4, 20),
        '48\\4-4rin21': X => X.r48(4, 4, 21),
        '48\\4-4rin22': X => X.r48(4, 4, 22),
        '48\\4-4rin24': X => X.r48(4, 4, 24),
        '48\\4-4rin25': X => X.r48(4, 4, 25),
        '48\\4-4rin26': X => X.r48(4, 4, 26),
        '48\\4-4rin27': X => X.r48(4, 4, 27),
        '48\\4-4rin28': X => X.r48(4, 4, 28),
        '48\\4-4rin29': X => X.r48(4, 4, 29),
        '48\\4-4rin30': X => X.r48(4, 4, 30),
        '48\\4-4rin33': X => X.r48(4, 4, 33),
        '48\\4-4rin34': X => X.r48(4, 4, 34),
        '48\\4-4rin37': X => X.r48(4, 4, 37),
        '48\\4-4rin41': X => X.r48(4, 4, 41),
        '48\\4-4rin42': X => X.r48(4, 4, 42),
        '48\\4-4rin47': X => X.r48(4, 4, 47),
        '48\\4-4rin49': X => X.r48(4, 4, 49),
        '48\\4-4rin50': X => X.r48(4, 4, 50),
        '48\\4-4rin52': X => X.r48(4, 4, 52),
        '48\\4-4rin53': X => X.r48(4, 4, 53),
        '48\\4-4rin54': X => X.r48(4, 4, 54),
        '48\\4-4rin97': X => X.r48(4, 4, 97),
        '48\\4-4ring1': X => X.r48(4, 4, 1),
        '48\\4-4ring100': X => X.r48(4, 4, 100),
        '48\\4-4ring2': X => X.r48(4, 4, 2),
        '48\\4-4ring3': X => X.r48(4, 4, 3),
        '48\\4-4ring35': X => X.r48(4, 4, 35),
        '48\\4-4ring38': X => X.r48(4, 4, 38),
        '48\\4-4ring39': X => X.r48(4, 4, 39),
        '48\\4-4ring4': X => X.r48(4, 4, 4),
        '48\\4-4ring43': X => X.r48(4, 4, 43),
        '48\\4-4ring44': X => X.r48(4, 4, 44),
        '48\\4-4ring5': X => X.r48(4, 4, 5),
        '48\\4-4ring6': X => X.r48(4, 4, 6),
        '48\\4-4ring7': X => X.r48(4, 4, 7),
        '48\\4-4ring71': X => X.r48(4, 4, 71),
        '48\\4-4ring8': X => X.r48(4, 4, 8),
        '48\\4-4ring9': X => X.r48(4, 4, 9),
        '48\\4-4ring99': X => X.r48(4, 4, 99),
        '48\\5-12ring13': X => X.r48(5, 12, 13),
        '48\\5-12ring14': X => X.r48(5, 12, 14),
        '48\\5-24rin7': X => X.r48(5, 24, 7),
        '48\\5-24rin9': X => X.r48(5, 24, 9),
        '48\\5-24ring10': X => X.r48(5, 24, 10),
        '48\\5-24ring13': X => X.r48(5, 24, 13),
        '48\\5-24ring17': X => X.r48(5, 24, 17),
        '48\\5-24ring18': X => X.r48(5, 24, 18),
        '48\\5-24ring2': X => X.r48(5, 24, 2),
        '48\\5-24ring20': X => X.r48(5, 24, 20),
        '48\\5-24ring24': X => X.r48(5, 24, 24),
        '48\\5-24ring28': X => X.r48(5, 24, 28),
        '48\\5-24ring29': X => X.r48(5, 24, 29),
        '48\\5-24ring3': X => X.r48(5, 24, 3),
        '48\\5-24ring35': X => X.r48(5, 24, 35),
        '48\\5-24ring4': X => X.r48(5, 24, 4),
        '48\\5-24ring5': X => X.r48(5, 24, 5),
        '48\\5-24ring6': X => X.r48(5, 24, 6),
        '48\\5-48rin4': X => X.r48(5, 48, 4),
        '48\\5-48rin9': X => X.r48(5, 48, 9),
        '48\\5-48ring2': X => X.r48(5, 48, 2),
        '48\\5-48ring32': X => X.r48(5, 48, 32),
        '48\\5-48ring5': X => X.r48(5, 48, 5),
        '48\\5-6rin16': X => X.r48(5, 6, 16),
        '48\\5-6ring6': X => X.r48(5, 6, 6),
        '48\\7-16rin3': X => X.r48(7, 16, 3),
        '48\\7-16ring16': X => X.r48(7, 16, 16),
        '48\\7-24rin4': X => X.r48(7, 24, 4),
        '48\\7-48rin5': X => X.r48(7, 48, 5),
        '48\\7-48ring10': X => X.r48(7, 48, 10),
        '48\\7-48ring80': X => X.r48(7, 48, 80),

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

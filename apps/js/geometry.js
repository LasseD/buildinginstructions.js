'use strict';

var UTIL = {};
UTIL.Precision = 4; // Used for outputting to LDraw
UTIL.EPSILON = 1e-7; // Used for epsilon-comparisons for equality.

UTIL.isZero = function(x) {
    return x >= -UTIL.EPSILON && x <= UTIL.EPSILON;;
}

/*
  Geometric types and utility functions.

  Types:
  - Point (x,y)
  - Line (p1, p2) can represent both a line segment and a line.
  - CH (Convex hull)
 */
THREE.Vector3.prototype.cloneInline = function() {
    return new THREE.Vector3(this.x, this.y, this.z);
}

THREE.Vector3.prototype.flipXY = function() {
    var tmp = this.x;
    this.x = this.y;
    this.y = tmp;
    return this;
}

THREE.Vector3.prototype.flipYZ = function() {
    var tmp = this.z;
    this.z = this.y;
    this.y = tmp;
    return this;
}

THREE.Vector3.prototype.toSvg = function(color) {
    return '--><circle ' + (color?'fill="'+color+'"':'') +' r="1" cx="' + this.x + '" cy="' + this.y + '"/><!--';
}

THREE.Vector3.prototype.equals = function(other) {
    return UTIL.isZero(this.x - other.x) && UTIL.isZero(this.y - other.y) && UTIL.isZero(this.z - other.z);
}

THREE.Vector3.prototype.sub = function(p) {
    return new THREE.Vector3(this.x-p.x, this.y-p.y, this.z-p.z);
}

THREE.Vector3.prototype.dist = function(p) {
    var dx = this.x-p.x, dy = this.y-p.y, dz = this.z-p.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

UTIL.Line = function(p1, p2) {
    this.p1 = p1;
    this.p2 = p2;
    if(p1.equals(p2)) {
        throw "Degenerate line: " + this.toSvg();
    }
}

UTIL.Line.prototype.toSvg = function() {
    return '--><line stroke="black" x1="' + this.p1.x + '" y1="' + this.p1.y + '" x2="' + this.p2.x + '" y2="' + this.p2.y + '"/><!--';
}

UTIL.Line.prototype.eval = function(x) {
    if(x == this.p1.x)
        return this.p1.y;
    if(x == this.p2.x)
        return this.p2.y;
    return this.p1.y + (x-this.p1.x) * (this.p2.y-this.p1.y) / (this.p2.x-this.p1.x);
}

UTIL.getTurn = function(a, b, c) {
    //console.log('turn: ' + ((b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x)));
    return (b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x);
}
UTIL.leftTurn = function(a, b, c) {
    return UTIL.getTurn(a, b, c) > UTIL.EPSILON;
}
UTIL.noTurn = function(a, b, c) {
    return UTIL.isZero(UTIL.getTurn(a, b, c));
}
UTIL.rightTurn = function(a, b, c) {
    return UTIL.getTurn(a, b, c) < -UTIL.EPSILON;
}

UTIL.Line.prototype.leftTurn = function(a) {
    return UTIL.leftTurn(this.p1, this.p2, a);
}

UTIL.Line.prototype.isParallelWith = function(line) {
    var p0 = line.p2.sub(line.p1.sub(this.p1));
    return UTIL.isZero(UTIL.getTurn(this.p1, this.p2, p0));
}

UTIL.Line.prototype.intersectsPoint = function(p) {
    //console.warn(this.toSvg() + " vs " + p.toSvg());
    var turn = UTIL.getTurn(this.p1, this.p2, p);
    return UTIL.isZero(turn);
}

UTIL.Line.prototype.intersectsPointOnSegment = function(p) {
    if(!this.intersectsPoint(p))
        return false;

    // Check if p is between p1 and p2:
    const dx = this.p2.x - this.p1.x, dy = this.p2.y = this.p1.y;
    const p3 = new THREE.Vector3(this.p1.x + dy, this.p1.y + dx, 0);
    const p4 = new THREE.Vector3(this.p2.x + dy, this.p2.y + dx, 0);

    return !(UTIL.leftTurn(p3, this.p1, p) || UTIL.rightTurn(p4, this.p2, p));
}

UTIL.Line.prototype.getCenterPoint = function() {
    var x = (this.p1.x+this.p2.x)*0.5;
    var y = (this.p1.y+this.p2.y)*0.5;
    var z = (this.p1.z+this.p2.z)*0.5;
    return new THREE.Vector3(x, y, z);
}

// Stolen from: http://www.cs.swan.ac.uk/~cssimon/line_intersection.html
UTIL.Line.prototype.getIntersectionWithLine = function(p1, p2) {
    const x1 = p1.x, y1 = p1.y, z1 = p1.z, x2 = p2.x, y2 = p2.y, z2 = p2.z;
    const x3 = this.p1.x, y3 = this.p1.y, x4 = this.p2.x, y4 = this.p2.y;
    const t = ((y3-y4)*(x1-x3)+(x4-x3)*(y1-y3)) / ((x4-x3)*(y1-y2)-(x1-x2)*(y4-y3)); // segment between t=0 and t=1
    //const t = ((y1-y2)*(x3-x1)+(x2-x1)*(y3-y1)) / ((x2-x1)*(y3-y4)-(x3-x4)*(y2-y1));
    const x = x1 + t*(x2-x1);
    const y = y1 + t*(y2-y1);
    const z = z1 + t*(z2-z1);
    return new THREE.Vector3(x, y, z);
}

UTIL.lineSegmentsIntersect = function(l1, l2) {
    if(l1.isParallelWith(l2)) {
        return false; // Parallel lines never intersect
    }

    if(l1.intersectsPoint(l2.p1) ||
       l1.intersectsPoint(l2.p2) ||
       l2.intersectsPoint(l1.p1) ||
       l2.intersectsPoint(l1.p2)) {
        return false;
    }

    return l1.leftTurn(l2.p1) != l1.leftTurn(l2.p2) && l2.leftTurn(l1.p1) != l2.leftTurn(l1.p2);
}

/*
  Line segment represented by p1, p2.
 */
UTIL.lineIntersectsLineSegment = function(line, p1, p2) {
    if(line.intersectsPoint(p1) || line.intersectsPoint(p2)) {
        return false; // Don't consider end point intersections.
    }
    return line.leftTurn(p1) != line.leftTurn(p2);
}

UTIL.COLORS = ['#FBB', '#FBF', '#F00', '#0F0', '#00F', '#FF0', '#0FF', '#F0F', '#000', '#BFF'];
UTIL.IDX = 0;

UTIL.removeInlinePoints = function(pts) {
    if(pts.length < 3) {
        return pts;
    }

    // Find index of min-point, as it is guaranteed not to be removed:
    var iMin = 0, min = pts[0];
    for(var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if(p.x < min.x || (p.x == min.x && p.y < min.y)) {
            iMin = i;
            min = p;
        }
    }

    var prev = min, next = pts[(iMin+1)%pts.length];
    var ret = [min];
    for(var i = 2; i <= pts.length; i++) { // Add remaining points:
        var p = next;
        var idx = (i+iMin)%pts.length;
        next = pts[idx];

        if(p.equals(prev) || p.equals(next)) {
            console.warn("Removing duplicate on position " + idx + ": " + p.x + ", " + p.y);
            continue; // Duplicate
        }
        if(UTIL.isZero(prev.z - p.z) && UTIL.isZero(p.z - next.z) && UTIL.noTurn(prev, p, next)) {
            console.warn("Removing inline point on position " + idx + ": " + p.x + ", " + p.y);
            continue; // Inline
        }
        
        ret.push(p);
        prev = p;
    }
    return ret;
}

UTIL.CH = function(pts, color, reversed) {
    this.pts = UTIL.removeInlinePoints(pts);
    if(this.pts < 2) {
        throw "CH degenerates to a point!";
    }
    this.color = color;
    this.reversed = reversed;
    //this.color = UTIL.IDX++;
}

UTIL.CH.prototype.clone = function() {
    var pts = [];
    this.pts.forEach(p => pts.push(new THREE.Vector3(p.x, p.y, p.z)));
    return new UTIL.CH(pts, this.color, this.reversed);
}

UTIL.CH.prototype.getAPointInside = function() {
    // Simply return the centroid:
    var x = this.pts.map(p => p.x).reduce((sum, x) => x+sum)/this.pts.length;
    var y = this.pts.map(p => p.y).reduce((sum, y) => y+sum)/this.pts.length;
    return new THREE.Vector3(x, y, this.pts[0].z);
}

UTIL.CH.prototype.isInside = function(pointInside) {
    if(this.pts.length == 2) { // Check line segment:
        var p1 = this.pts[0];
        var p2 = this.pts[1];
        if(p1.equals(p2)) {
            return p1.equals(pointInside);
        }
        else {
            return new UTIL.Line(p1, p2).intersectsPointOnSegment(pointInside);
        }
    }

    var prev = this.pts[this.pts.length-1];
    for(var i = 0; i < this.pts.length; i++) {
        var p = this.pts[i];
        if(!UTIL.rightTurn(prev, p, pointInside)) {
            return false;
        }
        prev = p;
    }
    return true;
}

UTIL.CH.prototype.intersectsLine = function(line) {
    var prev = this.pts[this.pts.length-1];
    for(var i = 0; i < this.pts.length; i++) {
        var p = this.pts[i];
        if(UTIL.lineIntersectsLineSegment(line, p, prev)) {
            return true;
        }
        prev = p;
    }
    return this.isInside(line.getCenterPoint());
}

UTIL.CH.prototype.toSvg = function() {
    var ret = '--><path fill="' + LDR.Colors.int2Hex(LDR.Colors.getColorHex(this.color)) + '" d="M';

    this.pts.forEach(p => ret += " " + p.x + "," + p.y);
    ret += 'Z"/><!--';
    return ret;
}

/*
  Assert the line already splits the CH.
 */
UTIL.CH.prototype.splitByLine = function(line, ret) {
    //console.log('splitting ' + this.toSvg() + ' by line ' + line.toSvg());
    const pointIntersectionIndices = this.pts.map((p,idx) => line.intersectsPoint(p) ? idx : -1).filter(x => x >= 0);
    if(pointIntersectionIndices.length > 2) {
        console.log(line.toSvg());
        console.log(this.toSvg());
        pointIntersectionIndices.forEach(idx => console.log(this.pts[idx].toSvg()));
        throw "Line intersects more than 2 vertices of CH: " + pointIntersectionIndices;
    }
    if(pointIntersectionIndices.length > 0 && this.pts.length == 2) {
        // Cuts end point - no split.
        ret.push(this);
        return; // Adjacent corners are intersected - do not split.
    }

    var self = this;
    function push(pts) {
        ret.push(new UTIL.CH(pts, self.color, self.reversed));
    }

    if(pointIntersectionIndices.length == 2) { // Split in two or not at all
        if(pointIntersectionIndices[1]-pointIntersectionIndices[0] == 1 ||
           pointIntersectionIndices[1]-pointIntersectionIndices[0] == this.pts.length-1) {
            ret.push(this);
            return; // Adjacent corners are intersected - do not split.
        }
        // Output two new CH's split through the two lines:
        var idx = pointIntersectionIndices[0];
        var pts = [ this.pts[idx] ];
        do {
            idx++;
            pts.push(this.pts[idx]);
        }
        while(idx != pointIntersectionIndices[1]);
        push(pts);

        idx = pointIntersectionIndices[1];
        pts = [ this.pts[idx] ];
        do {
            idx++;
            if(idx == this.pts.length)
                idx = 0;
            pts.push(this.pts[idx]);
        }
        while(idx != pointIntersectionIndices[0]);
        push(pts);

        return;
    }

    const lineIntersectionIndices = this.pts.map((p,idx,a) => UTIL.lineIntersectsLineSegment(line, p, a[(idx+1)%a.length]) ? idx : -1).filter(x => x >= 0);
    if(lineIntersectionIndices.length > 2 || lineIntersectionIndices.length == 0) {
        lineIntersectionIndices.forEach(idx => console.log(line.getIntersectionWithLine(this.pts[idx], this.pts[(idx+1)%this.pts.length]).toSvg('blue')));
        console.dir(this.pts);
        console.dir(line);
        throw "Expected 1-2 CH/line intersections. Found " + lineIntersectionIndices.length + " intersections!";
    }

    if(pointIntersectionIndices.length == 1) { // Split in two with a single line split:
        if(lineIntersectionIndices.length != 1) {
            console.log(this.toSvg());
            console.log(line.toSvg());
            lineIntersectionIndices.forEach(idx => console.log(line.getIntersectionWithLine(
                                  this.pts[idx], this.pts[(idx+1)%this.pts.length]).toSvg('blue')));
            pointIntersectionIndices.forEach(idx => console.log(this.pts[idx].toSvg('pink')));
            throw "Expected 1 CH/line intersection. Found: " + lineIntersectionIndices;
        }

        const v0 = pointIntersectionIndices[0];
        const v1 = lineIntersectionIndices[0];
        if(v0 == v1 || v0 == (v1+1)%this.pts.length) {
            throw "Unexpected CH/line intersection in adjacent line/vertex!";
        }
        
        const va = line.getIntersectionWithLine(this.pts[v1], this.pts[(v1+1)%this.pts.length]);
        // Split in va-v0-... and v0-va-...
        var pts = [ va, this.pts[v0] ];
        var idx = v0;
        do {
            idx++;
            if(idx == this.pts.length)
                idx = 0;
            pts.push(this.pts[idx]);
        }
        while(idx != v1);
        push(pts);

        pts = [ va ];
        idx = v1;
        do {
            idx++;
            if(idx == this.pts.length)
                idx = 0;
            pts.push(this.pts[idx]);
        }
        while(idx != v0);
        push(pts);

        return;
    }

    // Two line splits:
    const i0 = lineIntersectionIndices[0];
    const x0 = line.getIntersectionWithLine(this.pts[i0], this.pts[(i0+1)%this.pts.length]);
    if(this.pts.length == 2) { // Special case: Split line segment:
        push( [this.pts[0], x0] );
        push( [x0,this.pts[1] ]);
        return;
    }
    if(lineIntersectionIndices.length != 2) {
        console.log(this.toSvg());
        console.log(line.toSvg());
        lineIntersectionIndices.forEach(idx => console.log(line.getIntersectionWithLine(
                               this.pts[idx], this.pts[(idx+1)%this.pts.length]).toSvg('blue')));
        throw "Expected 2 line intersections when 0 point intersections. Found: " + lineIntersectionIndices;
    }
    const i1 = lineIntersectionIndices[1];
    const x1 = line.getIntersectionWithLine(this.pts[i1], this.pts[(i1+1)%this.pts.length]);

    var pts = [ x0, x1 ];
    var idx = i1;
    do {
        idx++;
        if(idx == this.pts.length) {
            idx = 0;
        }
        pts.push(this.pts[idx]);
    } while(idx != i0);
    push(pts);

    pts = [ x1, x0 ];
    var idx = i0;
    do {
        idx++;
        if(idx == this.pts.length) {
            idx = 0;
        }
        pts.push(this.pts[idx]);
    } while(idx != i1);
    push(pts);
}

UTIL.orderPathsClockwise = function(paths) {
    for(var i = 0; i < paths.length; i++) {
        const path = paths[i];
        const pts = path.pts;
        if(pts.length < 3) {
            continue;
        }

        var prev = pts[pts.length-1], prevprev = pts[pts.length-2];
        var minX = prev.x+1, minY;
        var minTurnsLeft;
        for(var j = 0; j <= pts.length; j++) {
            const p = pts[j % pts.length];

            if(minX > prev.x || (minX == prev.x && minY > prev.y)) {
                minTurnsLeft = UTIL.leftTurn(prevprev, prev, p);
                minX = prev.x;
                minY = prev.y;
            }
            prevprev = prev;
            prev = p;
        }

        if(minTurnsLeft) {
            pts.reverse();
            path.reversed = !path.reversed;
        }
    }    
}

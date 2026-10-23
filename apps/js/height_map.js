'use strict';

UTIL.paths2LDraw = function(paths, step, tmp) {
    paths.forEach(path => path.pts.forEach(p => p.flipYZ()));
    paths.forEach(path => path.pts = path.reversed ? path.pts.reverse() : path.pts);

    function handlePath(path) {
        const pts = path.pts;
        if(pts.length <= 1) {
            console.warn('Skipping degenerate point: ' + pts[0].x + ', ' + pts[0].y + ', ' + pts[0].z);
        }
	else if(pts.length === 2) {
	    step.addLine(path.color, pts[0], pts[1]);
	}
	else if(pts.length === 3) {
	    step.addTriangle(path.color, pts[0], pts[1], pts[2], false, false, tmp);
	}
	else if(pts.length === 4) {
	    step.addQuad(path.color, pts[0], pts[1], pts[2], pts[3], false, false, tmp);
	}
	else {
            var path1 = {pts:pts.slice(0, 4), color:path.color, reversed:path.reversed};
            var pts2 = [ pts[0] ];
            pts2.push(...pts.slice(3));
            var path2 = {pts:pts2, color:path.color, reversed:path.reversed};
            handlePath(path1);
            handlePath(path2);
	}
    }
    paths.forEach(handlePath);
}

/*
  Assumes txt is formatted as follows:
  - Any empty line, or line starting with '#' is ignored
  - All other lines should denote points by position and height as float values
  - The symbol 'horizontal' or 'vertical' is expected to appear with an offset value right after it. 
    All points are pushed by the offset value.

  A an anchor point at 0 is assumed.
 */
LDR.LinearHeightMap = function(txt) {
    this.horizontal = true;
    this.heightPoints = [];

    var lines = txt.split(/(\r\n)|\n/);
    var dx = 0;

    for(var i = 0; i < lines.length; i++) {
	var line = lines[i];
	if(!line || line[0] == '#')
	    continue; // Empty line, comment line, or 'undefined' due to '\r\n' split.
        var parts = line.split(" ").filter(x => x !== ''); // Remove empty strings.

        for(var j = 0; j < parts.length-1; j+= 2) {
            var part = parts[j];
            if(part == 'horizontal') {
                this.horizontal = true;
                dx = parseFloat(parts[j+1]);
            }
            else if(part == 'vertical') {
                this.horizontal = false;
                dx = parseFloat(parts[j+1]);
            }
            else {
                var x = parseFloat(parts[j]), y = parseFloat(parts[j+1]);
                this.heightPoints.push(new THREE.Vector3(x, y, 0));
            }
        }
    }

    this.heightPoints.forEach(p => p.x += dx); // Move dx
    this.heightPoints.sort((a,b) => a.x - b.x);
    this.heightPoints = this.heightPoints.filter((p, idx, a) => idx == 0 || a[idx-1].x != p.x);

    // Ensure 0:
    var first = this.heightPoints[0];
    var last = this.heightPoints[this.heightPoints.length-1];
    var y0;
    if(first.x > 0) {
        y0 = first.y;
        var h = [new THREE.Vector3(0, y0, 0)];
        h.push(...this.heightPoints);
        this.heightPoints = h;
        console.log("Height map before 0 - added point for 0");
    }
    else if(first.x == 0) {
        y0 = first.y;
        // x-positions all good.
    }
    else if(last.x < 0) {
        y0 = last.y;
        this.heightPoints.push(new THREE.Vector3(0, y0, 0));
        console.log("Height map after 0 - added point for 0");
    }
    else { // See if 0 is found in middle:
        for(var i = 1; i < this.heightPoints.length; i++) {
            var p2 = this.heightPoints[i];
            if(p2.x == 0) {
                y0 = p2.y;
                break; // All good.
            }
            if(p2.x < 0) {
                continue; // Not at 0 yet.
            }
            var p1 = this.heightPoints[i-1];
            y0 = p1.y + (p2.y-p1.y)*(-p1.x)/(p2.x-p1.x);
            console.log("Height map missing height at 0. Interpolated height added: " + y0);

            var h = this.heightPoints.slice(0, i);
            h.push(new THREE.Vector3(0, y0, 0));
            h.push(...this.heightPoints.slice(i));
            this.heightPoints = h;
            break; // done.
        }
    }

    // Update heights to make y0 = 0:
    this.heightPoints.forEach(p => p.y -= y0);
}

LDR.LinearHeightMap.prototype.foldPart = function(part) {
    let self = this;
    part.steps.forEach(step => self.foldStep(step));
}

LDR.LinearHeightMap.prototype.foldStep = function(step) {
    let self = this;

    // Lines, and non-texmapped triangles and quads:
    let pathsWithoutTexmaps = [];
    step.lines.forEach(x => pathsWithoutTexmaps.push(new UTIL.CH([x.p1, x.p2].map(p => p.flipYZ()), x.c, false)));
    step.triangles.filter(x => !x.tmp).forEach(x => pathsWithoutTexmaps.push(new UTIL.CH([x.p1, x.p2, x.p3].map(p => p.flipYZ()), x.c, false)));
    step.quads.filter(x => !x.tmp).forEach(x => pathsWithoutTexmaps.push(new UTIL.CH([x.p1, x.p2, x.p3, x.p4].map(p => p.flipYZ()), x.c, false)));
    // We know that there are no subModels in step, so they are not to be handled.
    UTIL.orderPathsClockwise(pathsWithoutTexmaps);
    
    // Texmapped triangles and quads:
    let pathsWithTexmaps = {}; // tmp.idx => [paths]
    let tmps = [];
    function register(tmp, ch) {
	if(!pathsWithTexmaps.hasOwnProperty(tmp.idx)) {
	    pathsWithTexmaps[tmp.idx] = [];
	    tmps.push(tmp);
	}
	pathsWithTexmaps[tmp.idx].push(ch);
    }
    step.triangles.filter(x => x.tmp).forEach(x => register(x.tmp, new UTIL.CH([x.p1, x.p2, x.p3].map(p => p.flipYZ()), x.c, false)));
    step.quads.filter(x => x.tmp).forEach(x => register(x.tmp, new UTIL.CH([x.p1, x.p2, x.p3, x.p4].map(p => p.flipYZ()), x.c, false)));    
    step.lines = [];
    step.triangles = [];
    step.quads = [];

    // Fold all but conditional lines:
    pathsWithoutTexmaps = this.foldPaths(pathsWithoutTexmaps);
    UTIL.paths2LDraw(pathsWithoutTexmaps, step);
    
    tmps.forEach(tmp => {
	let paths = pathsWithTexmaps[tmp.idx];
	UTIL.orderPathsClockwise(paths);
	paths = self.foldPaths(paths);
	UTIL.paths2LDraw(paths, step, tmp);
    });

    // Convert conditional lines:
    let ghostStep = new THREE.LDRStep();
    /*
    step.conditionalLines.forEach(line => {
        let ch = new UTIL.CH([line.p1, line.p2].map(p => p.flipYZ()), line.c, false); // Original line, no p3/p4
	let paths = self.foldPaths([ch]);
        UTIL.paths2LDraw(paths, ghostStep);
        });*/
    step.conditionalLines = ghostStep.conditionalLines;
}

/*
  Fold all paths, using (0,0) as anchor point.
  This method handles horizontal/vertical height maps and first-coordinates less than 0.
 */
LDR.LinearHeightMap.prototype.foldPaths = function(paths) {
    function flipX(ps) {
        ps.forEach(path => path.pts.forEach(p => p.x = -p.x));        
    }
    function flipXY(ps) {
        ps.forEach(path => path.pts.forEach(p => p.flipXY()));
    }
    
    if(!this.horizontal) {
        console.log('Flipping all points for vertical surface');
        flipXY(paths);
    }

    //console.log('Height map at beginning of foldPaths:'); this.heightPoints.forEach(p => console.log(p.x + ' ' + p.y));
    var ret = this.foldPathsRightFrom0(paths);

    this.heightPoints.forEach(p => p.x = -p.x);
    this.heightPoints.reverse();

    flipX(paths);
    //paths.forEach(path => path.reversed = !path.reversed);
    var ret2 = this.foldPathsRightFrom0(paths);
    flipX(ret2);
    flipX(paths); // Restore.

    this.heightPoints.forEach(p => p.x = -p.x);
    this.heightPoints.reverse();

    ret.push(...ret2);

    if(!this.horizontal) {
        flipXY(ret); // Because it was created from paths.
    }
    return ret;
}

/*
  Assume path is a list of UTIL.CH objects.
  Lines and conditional lines are not considered.
  Return a list of UTIL.CH objects folded onto the height map.
 */
LDR.LinearHeightMap.prototype.foldPathsRightFrom0 = function(paths) {
    const heightPoints = this.heightPoints.filter(p => p.x >= 0).map(p => p.cloneInline());

    // First cut the paths along the height map:
    var mapLeft = heightPoints[0];
    var origLeft = 0;
    heightPoints.forEach(mapRight => {
        var origRight = origLeft + mapRight.dist(mapLeft);
        var line = new UTIL.Line(new THREE.Vector3(origRight, 1, 0), new THREE.Vector3(origRight, -1, 0));

        // Cut all:
        var newPaths = [];
        paths.forEach(path => {
            if(path.intersectsLine(line)) {
                path.splitByLine(line, newPaths);
            }
            else {
                newPaths.push(path);
            }
        });
        paths = newPaths;
        
        origLeft = origRight;
        mapLeft = mapRight;
    });

    // Decorate with average x-value for quicker processing:
    paths.forEach(p => p.averageX = p.pts.map(p => p.x).reduce((a, b) => a+b) / p.pts.length);
    paths = paths.filter(p => p.averageX > 0);
    paths.sort((a, b) => a.averageX - b.averageX);

    // Move last height point to ensure no cutoffs:
    if(paths.length > 0 && heightPoints.length >= 2) {
        var map1 = heightPoints[heightPoints.length-2], map2 = heightPoints[heightPoints.length-1];
        var extraX = 2 * Math.max(paths[paths.length-1].pts.map(p => p.x).reduce((a, b) => a > b ? a : b), map1.x);

        var extraY = map2.y + (map2.y-map1.y)*(extraX-map2.x)/(map2.x-map1.x);
        map2.x = extraX;
        map2.y = extraY;
    }

    // Now fold the reduced paths along the height map:
    mapLeft = new THREE.Vector3(0,0,0);
    origLeft = 0;

    var pathsIdx = 0;
    var ret = [];
    for(var i = 1; i < heightPoints.length; i++) { // Walk along the height graph:
        var mapRight = heightPoints[i];
        var origRight = origLeft + mapRight.dist(mapLeft);
        const mapDx = mapRight.x - mapLeft.x;
        const mapDy = mapRight.y - mapLeft.y;
        const origDx = origRight - origLeft;

        while(pathsIdx < paths.length) {
            var path = paths[pathsIdx];
            if(path.averageX > origRight) {
                break;
            }
            path = path.clone();
            // Update heights of points of path and output:
            path.pts.forEach(function(p) {
                var t = (p.x-origLeft) / origDx;
                p.x = mapLeft.x + mapDx * t;
                // p.y remains unchanged.
                p.z += mapLeft.y + mapDy * t; // p.z was intially p.y - the height.
            });
            ret.push(path);
            pathsIdx++;
        }

        origLeft = origRight;
        mapLeft = mapRight;
    }

    return ret;
}

/*
  Creates a visual representation of the surface consisting of the height points.
 */
LDR.LinearHeightMap.prototype.toLDR = function() {
    if(this.heightPoints.length == 0) {
        return new LDR.LinearHeightMap([new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0)]).toLdr(); // Avoid empty renderer.
    }
    const COLOR = " 16";
    var horizontal = this.horizontal;
    var ret = '\n';
    // Find min:
    var h = this.heightPoints.map(p => new THREE.Vector3(p.x, p.y + 0.5, p.z));

    var minY = Math.max(...h.map(p => p.y));
    function put(x, y, low) {
        low = low ? " 10" : " -10";
        if(horizontal) {
            ret += " " + x + " " + y + low;
        }
        else {
            ret += low + " " + y + " " + x;
        }
    }
    function line(x1, y1, x2, y2, low) {
        ret += "\n2 0"; put(x1, y1, low); put(x2, y2, low);
    }
    function lineAcross(x, y) {
        ret += "\n2 0"; put(x, y, true); put(x, y, false);
    }
    
    // Draw bottom:
    var minX = h[0].x;
    var maxX = h[h.length-1].x;
    // Quad:
    ret += "\n4" + COLOR; put(minX, minY, true); put(maxX, minY, true); put(maxX, minY, false); put(minX, minY, false);
    // Lines:
    line(minX, minY, maxX, minY, true); line(minX, minY, maxX, minY, false);
    lineAcross(minX, minY); lineAcross(maxX, minY);

    // Right side (only quad):
    var x = maxX;
    var y = h[h.length-1].y;
    ret += "\n4" + COLOR; put(x, y, true); put(x, y, false); put(x, minY, false); put(x, minY, true);

    // Left side:
    // Quad:
    x = minX;
    y = h[0].y;
    ret += "\n4" + COLOR; put(x, minY, true); put(x, minY, false); put(x, y, false); put(x, y, true);
    // Lines:
    line(minX, minY, minX, y, true); line(minX, minY, minX, y, false);
    lineAcross(minX, y);

    // All in the middle:
    for(var i = 1; i < h.length; i++) {
        var x0 = x, y0 = y;
        x = h[i].x;
        y = h[i].y;

        // Top quad:
        ret += "\n4" + COLOR; put(x0, y0, false); put(x, y, false); put(x, y, true); put(x0, y0, true);
        // Side quads:
        ret += "\n4" + COLOR; put(x0, y0, true); put(x, y, true); put(x, minY, true); put(x0, minY, true);
        ret += "\n4" + COLOR; put(x, minY, false); put(x, y, false); put(x0, y0, false); put(x0, minY, false); 
        // Lines:
        lineAcross(x, y);
        line(x0, y0, x, y, true); line(x0, y0, x, y, false);
        line(x, minY, x, y, true); line(x, minY, x, y, false);
    }
    
    return ret + '\n';
}
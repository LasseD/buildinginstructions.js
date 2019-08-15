'use strict';

LDR.SVG = LDR.SVG || {};
LDR.SVG.NS = 'http://www.w3.org/2000/svg';

// Left arrow used to go back one step:
LDR.SVG.makeLeftArrow = function(withCircle) {
    let ret = document.createElementNS(LDR.SVG.NS, 'svg');
    ret.setAttribute("viewBox", "0 0 100 100");

    let g = document.createElementNS(LDR.SVG.NS, 'g');
    ret.appendChild(g);
    
    let pts = "20,50 50,20 50,35 80,35 80,65 50,65 50,80";
    let poly = LDR.SVG.makePolygon(pts);
    g.appendChild(poly);
    if(withCircle) {
        g.appendChild(LDR.SVG.makeCircle(50, 50, 49));
    }
    return ret;
}

// Right arrow used to step forward one step. 
// Double size when 'large===true' because it is the primarily-used button:
LDR.SVG.makeRightArrowLarge = function() {
    let ret = document.createElementNS(LDR.SVG.NS, 'svg');
    ret.setAttribute("class", "next_large");
    ret.setAttribute("viewBox", "0 0 200 200");

    let g = document.createElementNS(LDR.SVG.NS, 'g');
    ret.appendChild(g);
    
    let pts = "160,100 100,40 100,70 40,70 40,130 100,130 100,160";
    let poly = LDR.SVG.makePolygon(pts);
    g.appendChild(poly);
    g.appendChild(LDR.SVG.makeCircle(100, 100, 99));
    return ret;
}
LDR.SVG.makeRightArrow = function() {
    let ret = document.createElementNS(LDR.SVG.NS, 'svg');
    ret.setAttribute("class", "next_normal");
    ret.setAttribute("viewBox", "0 0 100 100");

    let g = document.createElementNS(LDR.SVG.NS, 'g');
    ret.appendChild(g);

    let pts = "80,50 50,20 50,35 20,35 20,65 50,65 50,80";
    let poly = LDR.SVG.makePolygon(pts);
    g.appendChild(poly);
    g.appendChild(LDR.SVG.makeCircle(50, 50, 49));
    return ret;
}
LDR.SVG.makeCheckMark = function() {
    let ret = document.createElementNS(LDR.SVG.NS, 'svg');
    ret.setAttribute("class", "done");
    ret.setAttribute("viewBox", "-75 -75 150 150");

    let g = document.createElementNS(LDR.SVG.NS, 'g');
    ret.appendChild(g);

    let path = document.createElementNS(LDR.SVG.NS, 'path');
    path.setAttribute("d", "M-48 -5L-35 -15L-20 10L35-48L48-35L-20 50Z");
    path.setAttribute("fill", "#4B4");

    g.appendChild(path);
    g.appendChild(LDR.SVG.makeCircle(0, 0, 74));
    return ret;
}

// Up arrow is used to return to top of the page
LDR.SVG.makeUpArrow = function() {
    let pts = "50,20 80,50 65,50 65,80 35,80 35,50 20,50";
    let ret = document.createElementNS(LDR.SVG.NS, 'svg');
    ret.setAttribute("viewBox", "0 0 100 100");
    let poly = LDR.SVG.makePolygon(pts);
    ret.appendChild(poly);
    return ret;
}

LDR.SVG.makeZoom = function(verticalLine, mult) {
    let ret = document.createElementNS(LDR.SVG.NS, 'svg');
    ret.setAttribute("viewBox", "0 0 " + (mult*50) + " " + (50*mult));

    let g = document.createElementNS(LDR.SVG.NS, 'g');
    ret.appendChild(g);    

    g.appendChild(LDR.SVG.makeLine(mult*10, mult*25, mult*40, mult*25));
    if(verticalLine)
	g.appendChild(LDR.SVG.makeLine(mult*25, mult*10, mult*25, mult*40));
    // Border
    g.appendChild(LDR.SVG.makeCircle(mult*25, mult*25, mult*25-1));
    return ret;	
}

LDR.SVG.makeCamera = function(x, y, w) {
    let ret = document.createElementNS(LDR.SVG.NS, 'svg');
    ret.setAttribute("viewBox", "0 0 " + w + " " + w);

    ret.appendChild(LDR.SVG.makeRect(x-w/3, y-w/6, w/2, w/3));
    
    let pts = (x-w/3+w/2) + "," + (y-w/10) + " " + 
	(x+w/3) + "," + (y-w/6) + " " + 
	(x+w/3) + "," + (y+w/6) + " " + 
	(x-w/3+w/2) + "," + (y+w/10);	    
    ret.appendChild(LDR.SVG.makePolygon(pts));
    
    // Leg:
    ret.appendChild(LDR.SVG.makeRect(x-w/8, y+w/6, w/10, w/4));
    
    // Tape:
    ret.appendChild(LDR.SVG.makeCircle(x-w/5, y, w/14));    
    ret.appendChild(LDR.SVG.makeCircle(x+w/24, y, w/14));
    ret.appendChild(LDR.SVG.makeLine(x-w/5, y-w/14, x+w/24, y-w/15));

    // Border
    ret.appendChild(LDR.SVG.makeCircle(x, y+5, w/2.1));
    
    return ret;
}

// Home button:
LDR.SVG.makeHome = function () {
    let ret = document.createElementNS(LDR.SVG.NS, 'svg');
    ret.setAttribute("viewBox", "0 0 100 100");
    let edgePoints = "50,20 80,50 75,50 75,80 25,80 25,50 20,50";
    ret.appendChild(LDR.SVG.makePolygon(edgePoints));
    ret.appendChild(LDR.SVG.makeRect(30, 50, 18, 30)); // Door
    ret.appendChild(LDR.SVG.makeRect(53, 50, 16, 16)); // Window
    return ret;
}

// List view:
LDR.SVG.makeListIcon = function () {
    let ret = document.createElementNS(LDR.SVG.NS, 'svg');
    let startY = 19;
    for(let i = 0; i < 5; i++) {
	let line = LDR.SVG.makeLine(10, startY+i*16, 90, startY+i*16);
	ret.appendChild(line);
    }
    return ret;
}
// Icon view:
LDR.SVG.makeBigIconsIcon = function () {
    let ret = document.createElementNS(LDR.SVG.NS, 'svg');
    for(let x = 0; x < 2; x++) {
      for(let y = 0; y < 2; y++) {
	  let rect = LDR.SVG.makeRect(x*46 + 7, y*46 + 7, 40, 40);
	  rect.setAttribute('rx', '4');
	  rect.setAttribute('ry', '4');
	  ret.appendChild(rect);
      }
    }
    return ret;
}

// Options gears:
LDR.SVG.makeOptions = function () {
    let ret = document.createElement('a');
    ret.setAttribute('href', '#options');

    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute("viewBox", "0 0 100 100");
    ret.appendChild(svg);

    LDR.SVG.makeGear(58, 43, 22, 18, svg);
    LDR.SVG.makeGear(35, 66, 14, 12, svg);

    return ret;
}

LDR.SVG.makePolygon = function(pts) {
    let poly = document.createElementNS(LDR.SVG.NS, 'polygon');
    poly.setAttribute('points', pts);
    poly.setAttribute('fill', 'none');
    return poly;
}

LDR.SVG.makePolyLine = function(pts) {
    let poly = document.createElementNS(LDR.SVG.NS, 'polyline');
    poly.setAttribute('points', pts);
    return poly;
}

LDR.SVG.makeTriangle = function(sideX, pointX) {
    let pts = sideX + ",20 " + sideX + ",80" + " " + pointX + ",50";
    return LDR.SVG.makePolygon(pts);
}

LDR.SVG.makeLine = function(x1, y1, x2, y2, forceStroke) {
    let ret = document.createElementNS(LDR.SVG.NS, 'line');
    if(forceStroke) {
	ret.setAttribute('stroke', 'black');
    }
    ret.setAttribute('x1', x1);
    ret.setAttribute('y1', y1);
    ret.setAttribute('x2', x2);
    ret.setAttribute('y2', y2);
    return ret;
}

LDR.SVG.makeCross = function(parent, x, y, r) {
    parent.append(LDR.SVG.makeLine(x-r, y-r, x+r, y+r));
    parent.append(LDR.SVG.makeLine(x-r, y+r, x+r, y-r));
}

LDR.SVG.makePlus = function(parent, x, y, r) {
    parent.append(LDR.SVG.makeLine(x, y-r, x, y+r));
    parent.append(LDR.SVG.makeLine(x-r, y, x+r, y));
}

LDR.SVG.makeRect = function(x, y, w, h, fill, color) {
    let ret = document.createElementNS(LDR.SVG.NS, 'rect');
    ret.setAttribute('x', x);
    ret.setAttribute('y', y);
    ret.setAttribute('width', w);
    ret.setAttribute('height', h);
    if(!fill) {
        ret.setAttribute('fill', 'none');
    }
    if(color) {
	ret.setAttribute('stroke', color);
    }
    return ret;
}

LDR.SVG.makeRoundRect = function(x, y, w, h, r) {
    let ret = LDR.SVG.makeRect(x, y, w, h);
    ret.setAttribute('class', 'show');
    ret.setAttribute('rx', r);
    ret.setAttribute('ry', r);
    return ret;
}

LDR.SVG.makeCircle = function(x, y, r, forceStroke) {
    let ret = document.createElementNS(LDR.SVG.NS, 'circle');
    if(forceStroke)
	ret.setAttribute('stroke', 'black');
    ret.setAttribute('cx', x);
    ret.setAttribute('cy', y);
    ret.setAttribute('r', r);
    ret.setAttribute('fill', 'none');
    return ret;
}

LDR.SVG.appendRotationCircle = function(x, y, r, svg) {
    let d = r/3;
    let circle = LDR.SVG.makeCircle(x, y, r, true);
    circle.setAttribute('stroke-dasharray', "0,10,45,10,50");
    svg.appendChild(circle);
    svg.appendChild(LDR.SVG.makeLine(x-r, y, x-r-d, y+d, true));
    svg.appendChild(LDR.SVG.makeLine(x-r, y, x-r+d, y+d, true));
    svg.appendChild(LDR.SVG.makeLine(x+r, y, x+r-d, y-d, true));
    svg.appendChild(LDR.SVG.makeLine(x+r, y, x+r+d, y-d, true));
}

LDR.SVG.makeGear = function(x, y, r, t, svg) {
    // Crown:
    svg.appendChild(LDR.SVG.makeGearCrown(x, y, r, r-4.5, 0.1, 0.1, t));
    // Cross axle:
    svg.appendChild(LDR.SVG.makeCrossAxleHole(x, y));
    // Circle if big enough:
    if(r > 20) {
	svg.appendChild(LDR.SVG.makeCircle(x, y, r*0.55));
    }
}

LDR.SVG.makeGearCrown = function(x, y, ro, ri, ao, ai, t) {
    let a = (2*Math.PI/t - ai - ao)/2;
    let pts = "M" + (x+ro) + " " + y + " ";
    let angles = [a, ai, a, ao];
    let radii = [ri, ri, ro, ro];
    for(let i = 0; i < t; i++) {
	let A = Math.PI*2/t*i;
	for(let j = 0; j < 4; j++) {
	    A += angles[j];
	    pts += "L" + (x+radii[j]*Math.cos(A)) + " " + (y+radii[j]*Math.sin(A)) + " ";
	}
    }
    pts += "Z";
    let ret = document.createElementNS(LDR.SVG.NS, 'path');
    ret.setAttribute('d', pts);
    ret.setAttribute('fill', 'none');    
    return ret;
}

LDR.SVG.makeCrossAxleHole = function(x, y) {
    let d = 3;
    let D = 1.5*d;
    let pts = "M" + (x+d) + " " + (y-d-D/2) +
	" v"  + d + " h"  + d + " v"  + D +
	" h-" + d + " v"  + d + " h-" + D + 
	" v-" + d + " h-" + d + " v-" + D + 
	" h"  + d + " v-" + d + " Z";
    let ret = document.createElementNS(LDR.SVG.NS, 'path');
    ret.setAttribute('d', pts);
    ret.setAttribute('fill', 'none');    
    return ret;
}

LDR.SVG.makeOffIcon = function(x, y, w) {
    let d = w/10;
    let D = w/2 - 2*d;
    let pts = "M" + (x-D-d) + " " + (y-D) +
	" l"  + d + " -" + d + " l" + D + " " + D + " l" + D + " -" + D + " l" + d + " " + d + // Top 4 lines
	" l-" + D + " " + D + " l" + D + " " + D + // Right 2 lines
	" l-" + d + " " + d + " l-" + D + " -" + D + " l-" + D + " " + D + " l-" + d + " -" + d + // Lower 4 lines
	" l" + D + " -" + D + " Z";
    let ret = document.createElementNS(LDR.SVG.NS, 'path');
    ret.setAttribute('d', pts);
    ret.setAttribute('fill', 'none');    
    return ret;
}

/**
   Misc icons for buttons:
 */
LDR.SVG.makeArrow = function(x1, y1, x2, y2, svg, includeBase) {
    svg.append(LDR.SVG.makeLine(x1, y1, x2, y2, true));
    let dx = (x2-x1)*0.3, dy = (y2-y1)*0.3;
    let x3 = x2-dx, y3 = y2-dy;
    svg.append(LDR.SVG.makeLine(x2, y2, x3-dy, y3-dx, true));
    svg.append(LDR.SVG.makeLine(x2, y2, x3+dy, y3+dx, true));
    if(includeBase) {
        svg.append(LDR.SVG.makeLine(x1+dy, y1+dx, x1-dy, y1-dx, true));
    }
}

LDR.SVG.makeBlock3D = function(x, y, parent) {
    let dx2 = 15, dy = 25, dy2 = dy*0.3;

    let pts1 = 'M ' + x + ' ' + (y - dy/2 + dy2) + 
	' l' + dx2 + ' -' + dy2 + 
	' v' + dy + 
	' l-' + dx2 + ' ' + dy2 + 
	' l-' + dx2 + ' -' + dy2 + 
	' v-' + dy + 
	' l' + dx2 + ' ' + dy2 + 
	' v' + dy +
        ' M ' +(x-dx2) + ' ' + (y-dy/2) + 
	' l' + dx2 + ' -' + dy2 + 
	' l' + dx2 + ' ' + dy2 + 
	' l-' + dx2 + ' ' + dy2 + 
	' Z';
    let p = document.createElementNS(LDR.SVG.NS, 'path');
    p.setAttribute('d', pts1);

    parent.appendChild(p);
}

LDR.SVG.makeEdit = function() {
    let ret = document.createElementNS(LDR.SVG.NS, 'svg');
    ret.setAttribute("viewBox", "-50 -50 100 100");

    let g = document.createElementNS(LDR.SVG.NS, 'g');
    g.setAttribute('transform', 'matrix(0.6 0.5 -0.5 0.6 15 -15)');
    ret.appendChild(g);
    LDR.SVG.makePencil(6, 60, g);
    
    let pts = "M10,-25 -20,-25 -20,25 20,25 20,-10";
    let p = document.createElementNS(LDR.SVG.NS, 'path');
    p.setAttribute('d', pts);
    ret.appendChild(p);

    return ret;    
}

LDR.SVG.makePencil = function(w, h, parent) {
    let h2 = h/2, h6 = h/6, w2 = w/2;
    let pts = 'M-' + w2 + ' -' + (h2-h6) + ' h' + w + ' v-' + h6 + ' h-' + w + ' v' + h +
    ' l ' + w2 + ' ' + h6 + ' l ' + w2 + ' -' + h6 + ' v-' + h;
    let p = document.createElementNS(LDR.SVG.NS, 'path');
    p.setAttribute('d', pts);

    parent.appendChild(p);
}

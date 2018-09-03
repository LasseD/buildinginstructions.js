LDR.Buttons = function(element) {
    this.svgNS = 'http://www.w3.org/2000/svg';
    
    // Add buttons to element:
    
    // Lower buttons:
    this.backButton = this.createDiv('prev_button', 'prevStep(false);');
    this.backButton.appendChild(this.makeLeftArrow());
    element.appendChild(this.backButton);

    var lowerDiv = this.createDiv('camera_buttons');
    this.resetCameraButton = this.createDiv('reset_camera_button', 'resetCameraPosition();');
    this.resetCameraButton.appendChild(this.makeCamera(50, 45, 80));
    lowerDiv.appendChild(this.resetCameraButton);
    this.zoomInButton = this.createDiv('zoom_in_button', 'zoomIn();');
    this.zoomInButton.appendChild(this.makeZoom(true));
    lowerDiv.appendChild(this.zoomInButton);
    this.zoomOutButton = this.createDiv('zoom_out_button', 'zoomOut();');
    this.zoomOutButton.appendChild(this.makeZoom(false));
    lowerDiv.appendChild(this.zoomOutButton);
    element.appendChild(lowerDiv);

    this.nextButton = this.createDiv('next_button', 'nextStep(false);');
    this.nextButton.appendChild(this.makeRightArrow(2));
    element.appendChild(this.nextButton);

    // Upper row of buttons (added last due to their absolute position):    
    this.topButtons = this.createDiv('top_buttons');
    this.frButton = this.createDiv('frButton', 'prevStep(true);');
    this.frButton.appendChild(this.makeFR());
    this.topButtons.appendChild(this.frButton);

    this.homeButton = this.createDiv('homeButton', 'home();');
    this.homeButton.appendChild(this.makeHome());
    this.topButtons.appendChild(this.homeButton);

    this.stepToButton = this.createDiv('stepToContainer');
    this.stepToButton.appendChild(this.makeStepTo());
    this.topButtons.appendChild(this.stepToButton);

    this.optionsButton = this.createDiv('optionsButton');
    this.optionsButton.appendChild(this.makeOptions());
    this.topButtons.appendChild(this.optionsButton);

    this.ffButton = this.createDiv('ffButton', 'nextStep(true);');
    this.ffButton.appendChild(this.makeFF());
    this.topButtons.appendChild(this.ffButton);

    element.appendChild(this.topButtons);
}

// Drawing functions:
// Left arrow used to go back one step:
LDR.Buttons.prototype.makeLeftArrow = function() {
    var pts = "20,50 50,20 50,35 80,35 80,65 50,65 50,80 20,50";
    var ret = document.createElementNS(this.svgNS, 'svg');
    var poly = this.makePolygon(pts);
    ret.appendChild(poly);
    return ret;
}

// Right arrow used to step forward one step. 
// Double size because it is the primarily-used button:
LDR.Buttons.prototype.makeRightArrow = function () {
    var pts = "160,100 100,40 100,70 40,70 40,130 100,130 100,160 160,100";
    var ret = document.createElementNS(this.svgNS, 'svg');
    var poly = this.makePolygon(pts);
    ret.appendChild(poly);
    return ret;
}

LDR.Buttons.prototype.makeZoom = function(verticalLine) {
    var ret = document.createElementNS(this.svgNS, 'svg');
    ret.appendChild(this.makeLine(10, 25, 40, 25));
    if(verticalLine)
	ret.appendChild(this.makeLine(25, 10, 25, 40));
    return ret;	
}

LDR.Buttons.prototype.makeCamera = function(x, y, w) {
    var ret = document.createElementNS(this.svgNS, 'svg');

    ret.appendChild(this.makeRect(x-w/3, y-w/6, w/2, w/3));
    
    var pts = (x-w/3+w/2) + "," + (y-w/10) + " " + 
	(x+w/3) + "," + (y-w/6) + " " + 
	(x+w/3) + "," + (y+w/6) + " " + 
	(x-w/3+w/2) + "," + (y+w/10);	    
    ret.appendChild(this.makePolygon(pts));
    
    // Leg:
    ret.appendChild(this.makeRect(x-w/8, y+w/6, w/10, w/4));
    
    // Tape:
    ret.appendChild(this.makeCircle(x-w/5, y, w/14));    
    ret.appendChild(this.makeCircle(x+w/24, y, w/14));
    ret.appendChild(this.makeLine(x-w/5, y-w/14, x+w/24, y-w/15));
    
    return ret;
}

// Fast forward and fast reverse double-arrow buttons:
LDR.Buttons.prototype.makeFR = function () {
    var ret = document.createElementNS(this.svgNS, 'svg');
    ret.appendChild(this.makeTriangle(50, 20));
    ret.appendChild(this.makeTriangle(80, 50));
    return ret;
}
LDR.Buttons.prototype.makeFF = function () {
    var ret = document.createElementNS(this.svgNS, 'svg');
    ret.appendChild(this.makeTriangle(20, 50));
    ret.appendChild(this.makeTriangle(50, 80));
    return ret;
}

// Home button:
LDR.Buttons.prototype.makeHome = function () {
    var ret = document.createElementNS(this.svgNS, 'svg');
    var edgePoints = "50,20 80,50 75,50 75,80 25,80 25,50 20,50";
    ret.appendChild(this.makePolygon(edgePoints));
    ret.appendChild(this.makeRect(30, 50, 18, 30)); // Door
    ret.appendChild(this.makeRect(53, 50, 16, 16)); // Window
    return ret;
}
LDR.Buttons.prototype.makeOptions = function () {
    var ret = document.createElement('a');
    ret.setAttribute('href', '#options');

    var svg = document.createElementNS(this.svgNS, 'svg');
    ret.appendChild(svg);

    this.makeGear(58, 43, 22, 18, svg);
    this.makeGear(35, 66, 14, 12, svg);

    //svg.appendChild(this.makeRect(20, 20, 60, 60)); // Frame

    return ret;
}

// Step to input field:
LDR.Buttons.prototype.makeStepTo = function() {
    this.stepInput = document.createElement("input");
    this.stepInput.setAttribute("id", "pageNumber");
    this.stepInput.setAttribute("onClick", "this.select();");
    return this.stepInput;
}

// Primitive helper methods for creating elements for buttons:
LDR.Buttons.prototype.createDiv = function(id, onclick) {
    var ret = document.createElement('div');
    ret.setAttribute('id', id);
    if(onclick)
	ret.setAttribute('onclick', onclick);
    return ret;
}
LDR.Buttons.prototype.makePolygon = function(pts) {
    var poly = document.createElementNS(this.svgNS, 'polygon');
    poly.setAttribute('points', pts);
    poly.setAttribute('fill', 'none');
    return poly;
}
LDR.Buttons.prototype.makePolyLine = function(pts) {
    var poly = document.createElementNS(this.svgNS, 'polyline');
    poly.setAttribute('points', pts);
    return poly;
}
LDR.Buttons.prototype.makeTriangle = function(sideX, pointX) {
    var pts = sideX + ",20 " + sideX + ",80" + " " + pointX + ",50";
    return this.makePolygon(pts);
}
LDR.Buttons.prototype.makeLine = function(x1, y1, x2, y2) {
    var ret = document.createElementNS(this.svgNS, 'line');
    ret.setAttribute('x1', x1);
    ret.setAttribute('y1', y1);
    ret.setAttribute('x2', x2);
    ret.setAttribute('y2', y2);
    return ret;
}
LDR.Buttons.prototype.makeRect = function(x, y, w, h) {
    var ret = document.createElementNS(this.svgNS, 'rect');
    ret.setAttribute('x', x);
    ret.setAttribute('y', y);
    ret.setAttribute('width', w);
    ret.setAttribute('height', h);
    ret.setAttribute('fill', 'none');
    return ret;
}
LDR.Buttons.prototype.makeCircle = function(x, y, r) {
    var ret = document.createElementNS(this.svgNS, 'circle');
    ret.setAttribute('cx', x);
    ret.setAttribute('cy', y);
    ret.setAttribute('r', r);
    ret.setAttribute('fill', 'none');
    return ret;
}
LDR.Buttons.prototype.makeGear = function(x, y, r, t, svg) {
    // Crown:
    svg.appendChild(this.makeGearCrown(x, y, r, r-4.5, 0.1, 0.1, t));
    // Cross axle:
    svg.appendChild(this.makeCrossAxleHole(x, y));
    // Circle if big enough:
    if(r > 20)
	svg.appendChild(this.makeCircle(x, y, r*0.55));
}
LDR.Buttons.prototype.makeGearCrown = function(x, y, ro, ri, ao, ai, t) {
    var a = (2*Math.PI/t - ai - ao)/2;
    var pts = "M" + (x+ro) + " " + y + " ";
    var angles = [a, ai, a, ao];
    var radii = [ri, ri, ro, ro];
    for(var i = 0; i < t; i++) {
	var A = Math.PI*2/t*i;
	for(var j = 0; j < 4; j++) {
	    A += angles[j];
	    pts += "L" + (x+radii[j]*Math.cos(A)) + " " + (y+radii[j]*Math.sin(A)) + " ";
	}
    }
    pts += "Z";
    var ret = document.createElementNS(this.svgNS, 'path');
    ret.setAttribute('d', pts);
    ret.setAttribute('fill', 'none');    
    return ret;
}
LDR.Buttons.prototype.makeCrossAxleHole = function(x, y) {
    var d = 3;
    var D = 1.5*d;
    var pts = "M" + (x+d) + " " + (y-d-D/2) +
	" v"  + d + " h"  + d + " v"  + D +
	" h-" + d + " v"  + d + " h-" + D + 
	" v-" + d + " h-" + d + " v-" + D + 
	" h"  + d + " v-" + d + " Z";
    var ret = document.createElementNS(this.svgNS, 'path');
    ret.setAttribute('d', pts);
    ret.setAttribute('fill', 'none');    
    return ret;
}

// Functions for hiding next/prev buttons:
LDR.Buttons.prototype.atFirstStep = function() {
    this.backButton.style.visibility = this.frButton.style.visibility = 'hidden';    
    this.nextButton.style.visibility = this.ffButton.style.visibility = 'visible';
}
LDR.Buttons.prototype.atLastStep = function() {
    this.backButton.style.visibility = this.frButton.style.visibility = 'visible';
    this.nextButton.style.visibility = this.ffButton.style.visibility = 'hidden';
}
LDR.Buttons.prototype.atAnyOtherStep = function() {
    this.backButton.style.visibility = this.nextButton.style.visibility = 'visible';
    this.ffButton.style.visibility = this.frButton.style.visibility = 'visible';
}
LDR.Buttons.prototype.setShownStep = function(step) {
    this.stepInput.value = ""+step;
}

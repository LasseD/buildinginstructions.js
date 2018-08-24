THREE.LDRButtons = function(element) {
    this.svgNS = 'http://www.w3.org/2000/svg';
    
    // Add buttons to element:
    
    // Lower buttons:
    this.backButton = this.createDiv('prev_button', 'prevStep(false);');
    this.backButton.appendChild(this.makeLeftArrow());
    element.appendChild(this.backButton);

    var lowerDiv = this.createDiv('camera_buttons');
    this.resetCameraButton = this.createDiv('reset_camera_button', 'resetCameraPosition();');
    this.resetCameraButton.appendChild(this.makeCamera(50, 50, 80));
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

    this.ffButton = this.createDiv('ffButton', 'nextStep(true);');
    this.ffButton.appendChild(this.makeFF());
    this.topButtons.appendChild(this.ffButton);

    element.appendChild(this.topButtons);
}

// Drawing functions:
// Left arrow used to go back one step:
THREE.LDRButtons.prototype.makeLeftArrow = function() {
    var pts = "20,50 50,20 50,35 80,35 80,65 50,65 50,80 20,50";
    var ret = document.createElementNS(this.svgNS, 'svg');
    var poly = this.makePolygon(pts);
    ret.appendChild(poly);
    return ret;
}

// Right arrow used to step forward one step. 
// Double size because it is the primarily-used button:
THREE.LDRButtons.prototype.makeRightArrow = function () {
    //var pts = "80,50 50,20 50,35 20,35 20,65 50,65 50,80 80,50";
    var pts = "160,100 100,40 100,70 40,70 40,130 100,130 100,160 160,100";
    var ret = document.createElementNS(this.svgNS, 'svg');
    var poly = this.makePolygon(pts);
    ret.appendChild(poly);
    return ret;
}

THREE.LDRButtons.prototype.makeZoom = function(verticalLine) {
    var ret = document.createElementNS(this.svgNS, 'svg');
    ret.appendChild(this.makeLine(10, 25, 40, 25));
    if(verticalLine)
	ret.appendChild(this.makeLine(25, 10, 25, 40));
    return ret;	
}

THREE.LDRButtons.prototype.makeCamera = function(x, y, w) {
    var ret = document.createElementNS(this.svgNS, 'svg');

    var w2 = parseInt(w/2);
    var w3 = parseInt(w/3);
    var w4 = parseInt(w/4);
    var w5 = parseInt(w/5);
    var w6 = parseInt(w/6);
    var w8 = parseInt(w/8);	
    var w10 = parseInt(w/10);
    ret.appendChild(this.makeRect(x-w3, y-w6, w2, w3));
    
    var pts = (x-w3+w2) + "," + (y-w10) + " " + 
	(x+w3) + "," + (y-w6) + " " + 
	(x+w3) + "," + (y+w6) + " " + 
	(x-w3+w2) + "," + (y+w10);	    
    ret.appendChild(this.makePolygon(pts));
    
    ret.appendChild(this.makeLine(x-w8, y+w6, x-w4, y+w2));
    ret.appendChild(this.makeLine(x, y+w6, x+w8, y+w2));
    
    return ret;
}

// Fast forward and fast reverse double-arrow buttons:
THREE.LDRButtons.prototype.makeFR = function () {
    var ret = document.createElementNS(this.svgNS, 'svg');
    ret.appendChild(this.makeTriangle(50, 20));
    ret.appendChild(this.makeTriangle(80, 50));
    return ret;
}
THREE.LDRButtons.prototype.makeFF = function () {
    var ret = document.createElementNS(this.svgNS, 'svg');
    ret.appendChild(this.makeTriangle(20, 50));
    ret.appendChild(this.makeTriangle(50, 80));
    return ret;
}

// Home button:
THREE.LDRButtons.prototype.makeHome = function () {
    var ret = document.createElementNS(this.svgNS, 'svg');
    var roofPoints = "50,20 80,50 70,50 70,40 60,40 60,30 40,30 40,40 30,40 30,50 20,50 50,20 50,30";
    ret.appendChild(this.makePolygon(roofPoints));
    var wallPoints = "25,50 25,80 75,80, 75,50";
    ret.appendChild(this.makePolyLine(wallPoints));
    ret.appendChild(this.makeRect(30, 55, 18, 25)); // Door
    ret.appendChild(this.makeRect(53, 55, 16, 16)); // Window
    return ret;
}

// Primitive helper methods for creating elements for buttons:
THREE.LDRButtons.prototype.createDiv = function(id, onclick) {
    var ret = document.createElement('div');
    ret.setAttribute('id', id);
    if(onclick)
	ret.setAttribute('onclick', onclick);
    return ret;
}
THREE.LDRButtons.prototype.makePolygon = function(pts) {
    var poly = document.createElementNS(this.svgNS, 'polygon');
    poly.setAttribute('points', pts);
    poly.setAttribute('fill', 'none');
    return poly;
}
THREE.LDRButtons.prototype.makePolyLine = function(pts) {
    var poly = document.createElementNS(this.svgNS, 'polyline');
    poly.setAttribute('points', pts);
    return poly;
}
THREE.LDRButtons.prototype.makeTriangle = function(sideX, pointX) {
    var pts = sideX + ",20 " + sideX + ",80" + " " + pointX + ",50";
    return this.makePolygon(pts);
}
THREE.LDRButtons.prototype.makeLine = function(x1, y1, x2, y2) {
    var ret = document.createElementNS(this.svgNS, 'line');
    ret.setAttribute('x1', x1);
    ret.setAttribute('y1', y1);
    ret.setAttribute('x2', x2);
    ret.setAttribute('y2', y2);
    return ret;
}
THREE.LDRButtons.prototype.makeRect = function(x, y, w, h) {
    var ret = document.createElementNS(this.svgNS, 'rect');
    ret.setAttribute('x', x);
    ret.setAttribute('y', y);
    ret.setAttribute('width', w);
    ret.setAttribute('height', h);
    ret.setAttribute('fill', 'none');
    return ret;
}

// Functions for hiding next/prev buttons:
THREE.LDRButtons.prototype.atFirstStep = function() {
    this.backButton.style.visibility = this.frButton.style.visibility = 'hidden';    
    this.nextButton.style.visibility = this.ffButton.style.visibility = 'visible';
}
THREE.LDRButtons.prototype.atLastStep = function() {
    this.backButton.style.visibility = this.frButton.style.visibility = 'visible';
    this.nextButton.style.visibility = this.ffButton.style.visibility = 'hidden';
}
THREE.LDRButtons.prototype.atAnyOtherStep = function() {
    this.backButton.style.visibility = this.nextButton.style.visibility = 'visible';
    this.ffButton.style.visibility = this.frButton.style.visibility = 'visible';
}

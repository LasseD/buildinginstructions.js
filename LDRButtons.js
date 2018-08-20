THREE.LDRButtons = function(element) {
    var largeButtonSize = 100;
    var svgNS = 'http://www.w3.org/2000/svg';
    
    // Add buttons to element:
    this.backButton = createDiv('prev_button', 'prevStep();');
    this.backButton.appendChild(makeLeftArrow());
    element.appendChild(this.backButton);

    var lowerDiv = createDiv('camera_buttons');
    this.resetCameraButton = createDiv('reset_camera_button', 'resetCameraPosition();');
    this.resetCameraButton.appendChild(makeCamera(50, 50, 80));
    lowerDiv.appendChild(this.resetCameraButton);
    this.zoomInButton = createDiv('zoom_in_button', 'zoomIn();');
    this.zoomInButton.appendChild(makeZoom(true));
    lowerDiv.appendChild(this.zoomInButton);
    this.zoomOutButton = createDiv('zoom_out_button', 'zoomOut();');
    this.zoomOutButton.appendChild(makeZoom(false));
    lowerDiv.appendChild(this.zoomOutButton);
    element.appendChild(lowerDiv);

    this.nextButton = createDiv('next_button', 'nextStep();');
    this.nextButton.appendChild(makeRightArrow(2));
    element.appendChild(this.nextButton);

    function makeLeftArrow() {
	var pts = "20,50 50,20 50,35 80,35 80,65 50,65 50,80 20,50";
	var ret = document.createElementNS(svgNS, 'svg');
	var poly = makePolygon(pts);
	ret.appendChild(poly);
	return ret;
    }
    function makeRightArrow() {
	//var pts = "80,50 50,20 50,35 20,35 20,65 50,65 50,80 80,50";
	var pts = "160,100 100,40 100,70 40,70 40,130 100,130 100,160 160,100";
	var ret = document.createElementNS(svgNS, 'svg');
	var poly = makePolygon(pts);
	ret.appendChild(poly);
	return ret;
    }
    function makeZoom(verticalLine) {
	var ret = document.createElementNS(svgNS, 'svg');
	ret.appendChild(makeLine(10, 25, 40, 25));
	if(verticalLine)
	    ret.appendChild(makeLine(25, 10, 25, 40));
	return ret;	
    }
    function makeCamera(x, y, w) {
	var ret = document.createElementNS(svgNS, 'svg');

	var w2 = parseInt(w/2);
	var w3 = parseInt(w/3);
	var w4 = parseInt(w/4);
	var w5 = parseInt(w/5);
	var w6 = parseInt(w/6);
	var w8 = parseInt(w/8);	
	var w10 = parseInt(w/10);
	ret.appendChild(makeRect(x-w3, y-w6, w2, w3));

	var pts = (x-w3+w2) + "," + (y-w10) + " " + 
	    (x+w3) + "," + (y-w6) + " " + 
	    (x+w3) + "," + (y+w6) + " " + 
	    (x-w3+w2) + "," + (y+w10);	    
	ret.appendChild(makePolygon(pts));

	ret.appendChild(makeLine(x-w8, y+w6, x-w4, y+w2));
	ret.appendChild(makeLine(x, y+w6, x+w8, y+w2));
	
	return ret;
    }

    // Helper methods for buttons:
    function createDiv(id, onclick) {
	var ret = document.createElement('div');
	ret.setAttribute('id', id);
	if(onclick)
	    ret.setAttribute('onclick', onclick);
	return ret;
    }
    function makePolygon(pts) {
	var poly = document.createElementNS(svgNS, 'polygon');
	poly.setAttribute('points', pts);
	poly.setAttribute('fill', 'none');
	return poly;
    }
    function makeLine(x1, y1, x2, y2) {
	var ret = document.createElementNS(svgNS, 'line');
	ret.setAttribute('x1', x1);
	ret.setAttribute('y1', y1);
	ret.setAttribute('x2', x2);
	ret.setAttribute('y2', y2);
	return ret;
    }
    function makeRect(x, y, w, h) {
	var ret = document.createElementNS(svgNS, 'rect');
	ret.setAttribute('x', x);
	ret.setAttribute('y', y);
	ret.setAttribute('width', w);
	ret.setAttribute('height', h);
	ret.setAttribute('fill', 'none');
	return ret;
    }
}

THREE.LDRButtons.prototype.atFirstStep = function() {
    this.backButton.style.display = 'none';    
    this.nextButton.style.display = 'block';
}
THREE.LDRButtons.prototype.atLastStep = function() {
    this.backButton.style.display = 'block';
    this.nextButton.style.display = 'none';
}
THREE.LDRButtons.prototype.atAnyOtherStep = function() {
    this.backButton.style.display = 'block';
    this.nextButton.style.display = 'block';
}

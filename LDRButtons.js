LDR.Buttons = function(element) {
    
    // Add buttons to element:
    
    // Lower buttons:
    this.backButton = this.createDiv('prev_button', 'prevStep(false);');
    this.backButton.appendChild(LDR.SVG.makeLeftArrow());
    element.appendChild(this.backButton);

    var lowerDiv = this.createDiv('camera_buttons');
    this.resetCameraButton = this.createDiv('reset_camera_button', 'resetCameraPosition();');
    this.resetCameraButton.appendChild(LDR.SVG.makeCamera(50, 45, 80));
    lowerDiv.appendChild(this.resetCameraButton);
    this.zoomInButton = this.createDiv('zoom_in_button', 'zoomIn();');
    this.zoomInButton.appendChild(LDR.SVG.makeZoom(true));
    lowerDiv.appendChild(this.zoomInButton);
    this.zoomOutButton = this.createDiv('zoom_out_button', 'zoomOut();');
    this.zoomOutButton.appendChild(LDR.SVG.makeZoom(false));
    lowerDiv.appendChild(this.zoomOutButton);
    element.appendChild(lowerDiv);

    this.nextButton = this.createDiv('next_button', 'nextStep(false);');
    this.nextButton.appendChild(LDR.SVG.makeRightArrow(2));
    element.appendChild(this.nextButton);

    // Upper row of buttons (added last due to their absolute position):    
    this.topButtons = this.createDiv('top_buttons');
    this.frButton = this.createDiv('frButton', 'prevStep(true);');
    this.frButton.appendChild(LDR.SVG.makeFR());
    this.topButtons.appendChild(this.frButton);

    this.homeButton = this.createDiv('homeButton', 'home();');
    this.homeButton.appendChild(LDR.SVG.makeHome());
    this.topButtons.appendChild(this.homeButton);

    this.stepToButton = this.createDiv('stepToContainer');
    this.stepToButton.appendChild(this.makeStepTo());
    this.topButtons.appendChild(this.stepToButton);

    this.optionsButton = this.createDiv('optionsButton');
    this.optionsButton.appendChild(LDR.SVG.makeOptions());
    this.topButtons.appendChild(this.optionsButton);

    this.ffButton = this.createDiv('ffButton', 'nextStep(true);');
    this.ffButton.appendChild(LDR.SVG.makeFF());
    this.topButtons.appendChild(this.ffButton);

    element.appendChild(this.topButtons);
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

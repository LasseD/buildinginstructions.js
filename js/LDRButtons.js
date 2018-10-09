'use strict';

LDR.Buttons = function(element, addTopButtons, homeLink, mainImage) {
    // Add buttons to element:
    
    // Lower buttons:
    this.backButton = this.createDiv('prev_button', 'prevStep(false);');
    this.backButton.appendChild(LDR.SVG.makeLeftArrow());
    element.appendChild(this.backButton);

    this.cameraButtons = this.createDiv('camera_buttons');
    this.zoomOutButtonLarge = this.createDiv('zoom_out_button_large', 'zoomOut();');
    this.zoomOutButtonLarge.appendChild(LDR.SVG.makeZoom(false, 2));
    this.cameraButtons.appendChild(this.zoomOutButtonLarge);
    this.resetCameraButton = this.createDiv('reset_camera_button', 'resetCameraPosition();');
    this.resetCameraButton.appendChild(LDR.SVG.makeCamera(50, 45, 80));
    this.cameraButtons.appendChild(this.resetCameraButton);
    this.zoomInButton = this.createDiv('zoom_in_button', 'zoomIn();');
    this.zoomInButton.appendChild(LDR.SVG.makeZoom(true, 1));
    this.cameraButtons.appendChild(this.zoomInButton);
    this.zoomOutButton = this.createDiv('zoom_out_button', 'zoomOut();');
    this.zoomOutButton.appendChild(LDR.SVG.makeZoom(false, 1));
    this.cameraButtons.appendChild(this.zoomOutButton);
    this.zoomInButtonLarge = this.createDiv('zoom_in_button_large', 'zoomIn();');
    this.zoomInButtonLarge.appendChild(LDR.SVG.makeZoom(true, 2));
    this.cameraButtons.appendChild(this.zoomInButtonLarge);
    element.appendChild(this.cameraButtons);

    this.nextButton = this.createDiv('next_button', 'nextStep(false);');
    this.rightArrowLarge = LDR.SVG.makeRightArrowLarge();
    this.rightArrowNormal = LDR.SVG.makeRightArrow();
    this.nextButton.appendChild(this.rightArrowLarge);
    this.nextButton.appendChild(this.rightArrowNormal);
    element.appendChild(this.nextButton);

    if(addTopButtons)
	this.addTopButtonElements(element, homeLink, mainImage);
    this.hideElementsAccordingToOptions(addTopButtons);
}

LDR.Buttons.prototype.addTopButtonElements = function(element, homeLink, mainImage) {
    // Upper row of buttons (added last due to their absolute position):    
    this.topButtons = this.createDiv('top_buttons');
    this.frButton = this.createDiv('frButton', 'prevStep(true);');
    this.frButton.appendChild(LDR.SVG.makeFR());
    this.topButtons.appendChild(this.frButton);

    this.homeButton = this.createDiv('homeButton');
    var homeA = document.createElement('a');
    homeA.setAttribute('href', homeLink);
    homeA.setAttribute('class', 'homeAnchor');
    homeA.appendChild(this.homeButton);
    if(mainImage) {
	var img = document.createElement('img');
	img.setAttribute('src', mainImage);
	this.homeButton.appendChild(img);
    }
    else {
	this.homeButton.appendChild(LDR.SVG.makeHome());
    }
    this.topButtons.appendChild(homeA);

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

LDR.Buttons.prototype.hideElementsAccordingToOptions = function(addTopButtons) {
    // Hide elements according to options:
    if(addTopButtons) {
	// FF/FR buttons:
	if(!ldrOptions.showFFFRButtons) {
	    this.ffButton.style.display = this.frButton.style.display = 'none';
	}
    }

    // LR Buttons:
    if(ldrOptions.showLRButtons === 2) {
	this.backButton.style.display = this.nextButton.style.display = 'none';
    }
    else if(ldrOptions.showLRButtons === 0) {
	this.rightArrowNormal.style.display = 'none';
    }
    else {
	this.rightArrowLarge.style.display = 'none';
    }
    // Camera Buttons:
    if(ldrOptions.showCameraButtons === 2) {
	this.cameraButtons.style.display = 'none';
    }
    else if(ldrOptions.showCameraButtons === 0) {
	this.zoomInButtonLarge.style.display = 'none';
	this.zoomOutButtonLarge.style.display = 'none';
    }
    else {
	this.zoomInButton.style.display = 'none';
	this.zoomOutButton.style.display = 'none';
    }
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
    this.backButton.style.visibility = 'hidden';
    this.nextButton.style.visibility = 'visible';
    if(this.ffButton) {
	this.frButton.style.visibility = 'hidden';
	this.ffButton.style.visibility = 'visible';
    }
}
LDR.Buttons.prototype.atLastStep = function() {
    this.backButton.style.visibility = 'visible';
    this.nextButton.style.visibility = 'hidden';
    if(this.ffButton) {
	this.ffButton.style.visibility = 'hidden';
	this.frButton.style.visibility = 'visible';
    }
}
LDR.Buttons.prototype.atAnyOtherStep = function() {
    this.backButton.style.visibility = this.nextButton.style.visibility = 'visible';
    if(this.ffButton)
	this.ffButton.style.visibility = this.frButton.style.visibility = 'visible';
}
LDR.Buttons.prototype.setShownStep = function(step) {
    this.stepInput.value = ""+step;
}

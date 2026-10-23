'use strict';

import { SVG } from './LDRSVG.js'
import { Options } from './LDROptions.js'

let Buttons = function(actions, element, addTopButtons, homeLink, mainImage, options) {
    let self = this;
    // Add buttons to element:
    
    // Camera buttons:
    this.cameraButtons = this.createDiv('camera_buttons');
    this.cameraButtons.setAttribute('class', 'ui_control');
    this.zoomOutButtonLarge = this.createDiv('zoom_out_button_large', actions.zoomOut);
    this.zoomOutButtonLarge.appendChild(SVG.makeZoom(false, 2));
    this.cameraButtons.appendChild(this.zoomOutButtonLarge);
    this.resetCameraButton = this.createDiv('reset_camera_button', actions.resetCameraPosition);
    this.resetCameraButton.appendChild(SVG.makeCamera(50, 45, 100));
    this.cameraButtons.appendChild(this.resetCameraButton);
    this.zoomInButton = this.createDiv('zoom_in_button', actions.zoomIn);
    this.zoomInButton.appendChild(SVG.makeZoom(true, 1));
    this.cameraButtons.appendChild(this.zoomInButton);
    this.zoomOutButton = this.createDiv('zoom_out_button', actions.zoomOut);
    this.zoomOutButton.appendChild(SVG.makeZoom(false, 1));
    this.cameraButtons.appendChild(this.zoomOutButton);
    this.zoomInButtonLarge = this.createDiv('zoom_in_button_large', actions.zoomIn);
    this.zoomInButtonLarge.appendChild(SVG.makeZoom(true, 2));
    this.cameraButtons.appendChild(this.zoomInButtonLarge);
    element.appendChild(this.cameraButtons);

    // Back button:
    if(actions.prevStep) {
        this.backButton = this.createDiv('prev_button', actions.prevStep);
        this.backButton.appendChild(SVG.makeLeftArrow(!addTopButtons));

        if(!addTopButtons) { // In case back should be shown as a lower button:
            element.appendChild(this.backButton); // Add back button to row with camera buttons
        }
    }

    // Right lower corner buttons:
    if(actions.nextStep) {
        this.nextButton = this.createDiv('next_button', actions.nextStep);
        this.nextButton.append(SVG.makeRightArrow(!addTopButtons));

        if(!addTopButtons) {
            element.appendChild(this.nextButton);
        }
        else {
            this.nextButtonLarge = this.createDiv('next_button_large', actions.nextStep);
            this.nextButtonLarge.setAttribute('class', 'ui_control');

            this.doneButton = this.createDiv('done_button', actions.clickDone);
            this.nextButtonLarge.append(SVG.makeRightArrowLarge());
            this.doneButton.append(SVG.makeCheckMark());
            element.appendChild(this.nextButtonLarge);
            element.appendChild(this.doneButton);
        }
    }

    if(addTopButtons) {
	this.addTopButtonElements(actions, element, homeLink, mainImage, options);
    }

    this.hideElementsAccordingToOptions();

    this.fadeOutHandle;
    let fadeOut = function() {
	self.fadeOutHandle = null;
	$('.ui_control').fadeTo(1000, 0);
    }
    let onFadeInComplete = function() {
        self.fadeOutHandle = setTimeout(fadeOut, 1000);
    }
    fadeOut();

    let runUIFading = function() {
        $('.ui_control').stop(); // Stop fade out.
	if(self.fadeOutHandle) {
	    clearTimeout(self.fadeOutHandle);
        }
	self.fadingIn = true;
	$('.ui_control').css('opacity', 1);
        onFadeInComplete();
    };
    $("#main_canvas, #preview, #next_button_large, #next_button, .ui_control").mousemove(runUIFading);
    $(".ui_control").on('tap', runUIFading);
}

Buttons.prototype.addTopButtonElements = function(actions, element, homeLink, mainImage, options) {
    // Upper row of buttons (added last due to their absolute position):    
    this.topButtons = this.createDiv('top_buttons');

    this.backButton.setAttribute('class', 'top_button');
    this.topButtons.appendChild(this.backButton);

    this.stepToButton = this.createDiv('stepToContainer');
    this.stepToButton.appendChild(this.makeStepTo());
    this.topButtons.appendChild(this.stepToButton);

    if(options.showNumberOfSteps) {
	let stepsEle = this.createDiv('numberOfSteps');
	this.topButtons.appendChild(stepsEle);
	stepsEle.innerHTML = "/ ?";
    }

    this.homeButton = this.create('a', 'home_button', null, 'top_button');
    this.homeButton.setAttribute('href', homeLink);
    if(mainImage) {
	let img = document.createElement('img');
	img.setAttribute('src', mainImage);
	this.homeButton.appendChild(img);
    }
    else {
	this.homeButton.appendChild(SVG.makeUpAndBack());
    }
    this.topButtons.appendChild(this.homeButton);

    // Edit:
    if(options.canEdit) {
        let editButton = this.createDiv('editButton');
        editButton.appendChild(SVG.makeEdit());
        editButton.addEventListener('click', actions.toggleEditor);
        this.topButtons.appendChild(editButton);        
    }

    // Options
    if(options.setUpOptions) {
	this.optionsButton = this.createDiv('optionsButton');
        this.optionsButton.setAttribute('class', 'top_button');
	this.optionsButton.appendChild(SVG.makeOptions());
	this.topButtons.appendChild(this.optionsButton);
    }

    this.nextButton.setAttribute('class', 'top_button');
    this.topButtons.appendChild(this.nextButton);

    element.appendChild(this.topButtons);
}

Buttons.prototype.hideElementsAccordingToOptions = function() {
    if(Options.showCameraButtons == 2) {
	this.zoomInButtonLarge.style.display = 'none';
	this.zoomOutButtonLarge.style.display = 'none';
	this.zoomInButton.style.display = 'none';
	this.zoomOutButton.style.display = 'none';
	this.resetCameraButton.style.visibility = 'hidden';
    }
    else if(Options.showCameraButtons == 0) {
	this.zoomInButtonLarge.style.display = 'none';
	this.zoomOutButtonLarge.style.display = 'none';
	this.zoomInButton.style.display = 'inline-block';
	this.zoomOutButton.style.display = 'inline-block';
	this.resetCameraButton.style.visibility = 'inline-block';
    }
    else {
	this.zoomInButton.style.display = 'none';
	this.zoomOutButton.style.display = 'none';
	this.zoomInButtonLarge.style.display = 'inline-block';
	this.zoomOutButtonLarge.style.display = 'inline-block';
	this.resetCameraButton.style.visibility = 'inline-block';
    }
}

// Step to input field:
Buttons.prototype.makeStepTo = function() {
    this.stepInput = document.createElement("input");
    this.stepInput.setAttribute("id", "pageNumber");
    this.stepInput.setAttribute("onClick", "this.select();");
    return this.stepInput;
}

// Primitive helper methods for creating elements for buttons:
Buttons.prototype.createDiv = function(id, onclick, classA) {
    return this.create('div', id, onclick, classA);
}
Buttons.prototype.create = function(type, id, onclick, classA) {
    let ret = document.createElement(type);
    ret.setAttribute('id', id);
    if(onclick) {
	let semaphore = false;
        ret.addEventListener('mouseup', e => {if(!semaphore){onclick(e);}semaphore=false;});
	ret.addEventListener('touchend', e => {semaphore=true;onclick(e);});
    }
    if(classA) {
        ret.setAttribute('class', classA);
    }
    return ret;
}

// Functions for hiding next/prev buttons:
Buttons.prototype.atFirstStep = function() {
    this.backButton.style.visibility = 'hidden';
    this.nextButton.style.visibility = 'visible';
    if(this.nextButtonLarge) {
        this.nextButtonLarge.style.visibility = 'visible';
    }
    if(this.doneButton) {
        this.doneButton.style.visibility = 'hidden';
    }
}
Buttons.prototype.atLastStep = function() {
    this.backButton.style.visibility = 'visible';
    this.nextButton.style.visibility = 'hidden';
    if(this.nextButtonLarge) {
        this.nextButtonLarge.style.visibility = 'hidden';
    }
    if(this.doneButton) {
        this.doneButton.style.visibility = 'visible';
    }
}
Buttons.prototype.atAnyOtherStep = function() {
    this.backButton.style.visibility = 'visible';
    this.nextButton.style.visibility = 'visible';
    if(this.nextButtonLarge) {
        this.nextButtonLarge.style.visibility = 'visible';
    }
    if(this.doneButton) {
        this.doneButton.style.visibility = 'hidden';
    }
}
Buttons.prototype.setShownStep = function(step) {
    this.stepInput.value = ""+step;
}

export { Buttons }

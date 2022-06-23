'use strict';

/**
 * @author Lasse Deleuran | c-mt.dk and brickhub.org
 * LDR Specification: http://www.ldraw.org/documentation/ldraw-org-file-format-standards.html
 *
 * The color picker makes it easy to enable LDraw color selection in the web app,
 * and for users to pick a color.
 */
LDR.ColorPicker = function(onColorSelected, showOnlyAbsColors = false) {
    let self = this;
    this.onColorSelected = onColorSelected;

    // Create color picker HTML elements:
    const colorPickerEle = document.getElementById('color_picker_holder');

    this.decorateEle = function(colorEle, color, i) {
        colorEle.style.backgroundColor = LDR.Colors.int2Hex(color.value);
        const contrastVector = LDR.Colors.getHighContrastColor4(i);
        const contrastColor = new THREE.Color(contrastVector.x, contrastVector.y, contrastVector.z);
        colorEle.style.color = '#' + contrastColor.getHexString();
        colorEle.innerHTML = i;
	colorEle.parentNode.style.backgroundColor = LDR.Colors.int2Hex(color.edge);
    }

    function addColorElement(color, i) {
        if(showOnlyAbsColors) { // No special materials - only ABS and normal trans:
	    if(i === 16 ||
	       i === 24 ||
	       !color.hasOwnProperty('edge') ||
	       color.hasOwnProperty('material') ||
	       color.hasOwnProperty('luminance')) {
                return;
            }
        }

        let colorContainer = document.createElement('span');
        colorContainer.setAttribute('class', 'color_container');
        colorContainer.setAttribute('background-color', '#ffffff');
        colorPickerEle.append(colorContainer);
        
        let colorEle = document.createElement('span');
        colorEle.setAttribute('class', 'color_ele');
        colorContainer.append(colorEle);

        self.decorateEle(colorEle, color, i);

        colorEle.c = i;
        colorEle.addEventListener('click', function(event){
                event.preventDefault();
                event.stopPropagation();
                $("#color_picker_background, #color_picker_holder").hide();
                onColorSelected(this.c);
            }, false);
    }
    LDR.Colors.forEach(addColorElement);
}

LDR.ColorPicker.prototype.createButton = function() {
    let button = document.createElement('div');
    button.id = 'color_picker_button';
    button.setAttribute('class', 'editor_button');

    button.addEventListener('click', () => $("#color_picker_background, #color_picker_holder").fadeIn(250));

    // Icon:
    button.innerHTML = `
    <svg viewBox = "0 0 100 100" version="1.1">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="100%" y2="100%">
            <stop stop-color="red" offset="0%"/>
            <stop stop-color="orange" offset="20%"/>
            <stop stop-color="yellow" offset="40%"/>
            <stop stop-color="green" offset="60%"/>
            <stop stop-color="blue" offset="80%"/>
            <stop stop-color="violet" offset="100%"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="49" r="49" fill="url(#g)"/>
    </svg>`;

    return button;
}

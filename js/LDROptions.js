'use strict';

LDR.Options = function() {
    this.listeners = [];
    
    // Default values for options (in case of first visit or no cookies:
    this.showOldColors = 0; // 0 = all colors. 1 = single color old
    this.lineContrast = 1; // 0 = High contrast, 1 = LDraw
    this.bgColor = 0xFFFFFF;
    this.pointColor = 0xFF0000;
    this.pointSize = 2;
    this.lineColor = 0x333333;
    this.oldColor = 0xFFFF6F;
    this.showLRButtons = 0; // 0=right big, 1=right normal, 2=both off
    this.showCameraButtons = 0; // 0=+- on right, 1=+- on sides, 2=off
    this.showStepRotationAnimations = 1; // 0=slow, 1=normal speed, 2=off
    this.partsListType = 0; // 0=icons, 1=list
    this.showNotes = 0; // 0=off, 1=on
    this.showPLI = 1; // 0=off, 1=on
    this.rotateModel = 0; // 0=off, 1=on
    this.showEditor = 0; // 0=off, 1=on
    this.studHighContrast = 0; // 0=off, 1=on
    this.studLogo = 0; // 0=off, 1...5=Types of logos from LDraw

    // Read values that might be in cookie:
    this.readOptionsFromCookie();

    let options = this;
    this.onChange = function(partGeometriesChanged) {
	for(let i = 0; i < options.listeners.length; i++) {
	    options.listeners[i](partGeometriesChanged);
	}
	options.saveOptionsToCookie();
    }
}

LDR.Options.prototype.readOptionsFromCookie = function() {
    if(!document.cookie) {
	return; // Can't read cookie.
    }
    let cookieParts = decodeURIComponent(document.cookie).split(/\s*;\s*/);
    for(let i = 0; i < cookieParts.length; i++) {
	let part = cookieParts[i];
	let equalAt = part.indexOf('=');
	if(equalAt > 1) {
	    let key = part.substring(0, equalAt);
	    if(this[key] != undefined)
		this[key] = parseInt(part.substring(equalAt+1));
	}
    } 
}

LDR.Options.prototype.saveOptionsToCookie = function() {
    let options = this;
    function addToKv(v) {
	document.cookie = v + '=' + options[v] + '; SameSite; expires=Wed, 3 Jun 2122 12:00:01 UTC; path=/';
    }
    // Instructions and general options:
    addToKv("showOldColors");
    addToKv("lineContrast");
    addToKv("showPartsCallouts");
    addToKv("showStepRotationAnimations");
    addToKv("showCameraButtons");
    addToKv("showLRButtons");
    addToKv("showPLI");
    addToKv("showEditor");
    addToKv("studHighContrast");
    addToKv("studLogo");
    
    // Parts list-specific:
    addToKv("partsListType");
    addToKv("showNotes");

    // View-specific:
    addToKv("rotateModel");

    // Part view-specific:
    addToKv("pointColor");
    addToKv("pointSize");
    addToKv("bgColor");
}

LDR.Options.setOptionsSelected = function(node, callback) {
    let parent = node.parentNode;
    let children = parent.childNodes;
    for(let i = 0; i < children.length; i++) {
	let child = children[i];
	if(child === node) {
	    callback(i);
	    if(child.getAttribute('class') === 'option')
		child.setAttribute('class', 'option_selected');
	}
	else {
	    if(child.getAttribute('class') === 'option_selected')
		child.setAttribute('class', 'option');	
	}
    }
}

LDR.Options.prototype.appendHeader = function(optionsBlock) {
    let headerDiv = document.createElement('div');
    headerDiv.setAttribute('id', 'options_header');
    optionsBlock.appendChild(headerDiv);

    // To top button:
    let toTop = document.createElement('a');
    toTop.setAttribute('href', '#');
    toTop.appendChild(LDR.SVG.makeUpArrow());    
    toTop.id = 'to_top';
    optionsBlock.append(toTop);
    window.onscroll = function() {
        if (document.body.scrollTop > window.innerHeight || 
            document.documentElement.scrollTop > window.innerHeight) {
            toTop.style.display = "block";
        }
        else {
            toTop.style.display = "none";
        }
    }

    headerDiv.appendChild(LDR.SVG.makeOptions());
}
LDR.Options.prototype.appendFooter = function(optionsBlock) {
    let div = document.createElement('div');
    div.setAttribute('class', 'options_footer');
    let a = document.createElement('a');
    a.setAttribute('href', '#top');

    optionsBlock.appendChild(div);
    div.appendChild(a);
    a.appendChild(LDR.SVG.makeUpArrow());
}
LDR.Options.prototype.appendDescriptionBar = function(optionsBlock, columns, description) {
    let tr = document.createElement('tr');
    tr.setAttribute('class', 'options_description_header');
    optionsBlock.appendChild(tr);

    let td = document.createElement('td');
    td.setAttribute('class', 'options_description');
    td.setAttribute('colspan', ""+columns);
    tr.appendChild(td);

    let desc = document.createElement('span');
    desc.innerHTML = description;
    td.appendChild(desc);
}

LDR.Options.prototype.appendOldBrickColorOptions = function(optionsBlock) {
    let group = this.addOptionsGroup(optionsBlock, 2, "Highlight New Parts");
    let options = this;
    let onOldBrickChange = function(idx) {
	options.showOldColors = idx;
	options.onChange(false);
    };
    let buttons = this.createButtons(group, 2, this.showOldColors, onOldBrickChange);
    
    // Color functions:
    let red = function(){return '#C91A09';};
    let green = function(){return '#257A3E';};
    let blue = function(){return '#0055BF';};    
    let rgb = [red, green, blue];
    
    let lineColor = function(options){
	return LDR.Colors.int2Hex(options.lineColor);
    };
    let oldColor = function(options){
	return LDR.Colors.int2Hex(options.oldColor);
    };

    let positions = [{x:-1,y:1},{x:1,y:1},{x:1,y:-1}];
    let drawParts = function(x, y, cnt, cntOld, svg) {
	for(let i = 0; i < cnt; i++) {
	    let position = positions[i];
	    options.createSvgBlock(x + 0.5*position.x*LDR.Options.svgBlockWidth, 
				   y + 0.5*position.y*LDR.Options.svgBlockHeight, 
				   i == 0 || i == cnt-1,
				   i < cntOld ? oldColor : rgb[i%3],
				   lineColor,
				   svg);
	}
    }

    /* 
       The first option is to always paint colors:
       Indicated by 9 bricks - all colorful.
    */
    let dst = 60;
    let w = 20;
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -40 200 80');
	buttons[0].appendChild(svg);
	drawParts(-dst, 0, 2, 0, svg);
	svg.appendChild(LDR.SVG.makeLine(-w, 0, w, 0, true));
	svg.appendChild(LDR.SVG.makeLine(w/2, w/2, w, 0, true));
	svg.appendChild(LDR.SVG.makeLine(w/2, -w/2, w, 0, true));
	drawParts(dst, 0, 3, 0, svg);
    }
    /* 
       Second option: old colors in customizable color:
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -40 200 80');
	buttons[1].appendChild(svg);
	drawParts(-dst, 0, 2, 0, svg);
	svg.appendChild(LDR.SVG.makeLine(-w, 0, w, 0, true));
	svg.appendChild(LDR.SVG.makeLine(w/2, w/2, w, 0, true));
	svg.appendChild(LDR.SVG.makeLine(w/2, -w/2, w, 0, true));
	drawParts(dst, 0, 3, 2, svg);
    }
}

LDR.Options.prototype.appendContrastOptions = function(optionsBlock) {
    let group = this.addOptionsGroup(optionsBlock, 2, "Lines");
    let options = this;
    let onChange = function(idx) {
	options.lineContrast = idx;
        if(idx == 1) {
          options.lineColor = 0x333333;
        }
        else {
          options.lineColor = 0;
        }
	options.onChange(false);
    };
    let buttons = this.createButtons(group, 2, this.lineContrast, onChange);
    
    // Color functions:
    let red = function(){return '#C91A09';};
    let redEdge1 = function(){return '#000000';};
    let redEdge2 = function(){return '#333333';};
    let black = function(){return '#05131D';};
    let blackEdge1 = function(){return '#FFFFFF';};
    let blackEdge2 = function(){return '#595959';};
    let brown = function(){return '#582A12';};

    /* 
       0: High contrast:
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[0].appendChild(svg);
	this.createSvgBlock(-LDR.Options.svgBlockWidth-2, 0, true, red, redEdge1, svg);
	this.createSvgBlock(0, 0, true, brown, red, svg);
	this.createSvgBlock(LDR.Options.svgBlockWidth+2, 0, true, black, blackEdge1, svg);
    }
    /* 
       1: Standard LDraw lines:
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[1].appendChild(svg);
	this.createSvgBlock(-LDR.Options.svgBlockWidth-2, 0, true, red, redEdge2, svg);
	this.createSvgBlock(0, 0, true, brown, blackEdge2, svg);
	this.createSvgBlock(LDR.Options.svgBlockWidth+2, 0, true, black, blackEdge2, svg);
    }
    /* 
       2: No lines:
    */
    /*{
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[2].appendChild(svg);
	this.createSvgBlock(-LDR.Options.svgBlockWidth-2, 0, true, red, red, svg);
	this.createSvgBlock(0, 0, true, brown, brown, svg);
	this.createSvgBlock(LDR.Options.svgBlockWidth+2, 0, true, black, black, svg);
    }*/
}

/*
  Part color options (points and background color)
*/
LDR.Options.prototype.appendPartColorOptions = function(optionsBlock) {
    let group = this.addOptionsGroup(optionsBlock, 2, "Background and Point Color");
    let options = this;

    // Color functions:
    let bgColor = function(options){return LDR.Colors.int2Hex(options.bgColor);};
    let pointColor = function(options){return LDR.Colors.int2Hex(options.pointColor);};
    let oldColor = function(options){return LDR.Colors.int2Hex(options.oldColor);};
    let lineColor = function(options){return LDR.Colors.int2Hex(options.lineColor);};

    // Build html elements:
    function createPreview(parent, forBG) {
	let preview = document.createElement('td');
	preview.setAttribute('class', 'color_option');
	parent.appendChild(preview);

	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	preview.appendChild(svg);
	if(forBG)
	    options.createSvgBlock(0, 0, true, oldColor, lineColor, svg);
	else
	    options.createSvgPoints(0, 0, pointColor, svg, 2);

	let listener = function() {
	    svg.style.backgroundColor = bgColor(options);
	};
	options.listeners.push(listener);
	listener();

	return preview;
    }
    function createColorInput(parent, color, onChange) {
	let input = document.createElement('input');
	input.setAttribute('class', 'color_input');
	input.setAttribute('type', 'color');
	input.setAttribute('value', color);
	input.addEventListener("input", onChange, false);
	input.addEventListener("change", onChange, false);
	parent.appendChild(input);
	return input;
    }
    let onChange = function() {
	options.bgColor = parseInt(input1.value.substring(1), 16);
	options.pointColor = parseInt(input2.value.substring(1), 16);
	options.onChange(false);
    }

    // Fill in data:
    let preview1 = createPreview(group, true);
    let input1 = createColorInput(preview1, bgColor(options), onChange);

    let preview2 = createPreview(group, false);
    let input2 = createColorInput(preview2, pointColor(options), onChange);
}

/*
Part color options (points and background color)
 */
LDR.Options.prototype.appendPartPointSizeOptions = function(optionsBlock) {
    let group = this.addOptionsGroup(optionsBlock, 5, "Points");
    let options = this;
    let onChange = function(idx) {
	options.pointSize = idx;
	options.onChange(false);
    };
    let buttons = this.createButtons(group, 5, this.pointSize, onChange);

    // Color function:
    let pointColor = function(options){return LDR.Colors.int2Hex(options.pointColor);};

    /* 
       Option 1: off
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-25 -25 50 50');
	svg.setAttribute('class', 'ui_toggles');
	svg.appendChild(LDR.SVG.makeOffIcon(0, 0, 50));
	buttons[0].appendChild(svg);
    }
    /*
      Options 2-5: Size 1-4:
    */
    for(let i = 1; i <= 4; i++) {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-25 -25 50 50');
	options.createSvgPoints(0, 0, pointColor, svg, i);	
	buttons[i].appendChild(svg);
    }
}

LDR.Options.prototype.appendAnimationOptions = function(optionsBlock) {
    let group = this.addOptionsGroup(optionsBlock, 3, "Animations");
    let options = this;
    let onAnimationChange = function(idx) {
	options.showStepRotationAnimations = idx;
	options.onChange(false);
    };
    let buttons = this.createButtons(group, 3, this.showStepRotationAnimations, onAnimationChange);
    let red = function(){return '#C91A09';};
    let lineColor = function(options){
	return LDR.Colors.int2Hex(options.lineColor);
    };
    let w = 20;	
    
    /* 
       Option 1: Slow
    */
    {
	// Left box
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -35 200 70');
	buttons[0].appendChild(svg);
	this.createSvgBlock(-50, 0, true, red, lineColor, svg);

	// Circular arrow:
	let g1 = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g1);
	LDR.SVG.appendRotationCircle(0, 0, 18, g1);

	// Right hand side:
	let g2 = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g2);
	//g2.setAttribute('transform', 'rotate(90 0 0) translate(-50 -55)');
	let turned = this.createSvgBlock(50, 0, true, red, lineColor, g2);

	let a = document.createElementNS(LDR.SVG.NS, 'animateTransform');
	a.setAttribute('id', 'turnerSlow');
	a.setAttribute('attributeName', 'transform');
	a.setAttribute('attributeType', 'XML');
	a.setAttribute('type', 'rotate');
	a.setAttribute('from', '0 50 0');
	a.setAttribute('to', '90 50 0');
	a.setAttribute('dur', '2s');
	a.setAttribute('fill', 'freeze');
	a.setAttribute('begin', '1s;turnerSlow.end+1s');

	g2.appendChild(a);
    }
    /* 
       Option 1: Normal speed
    */
    {
	// Left box
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -35 200 70');
	buttons[1].appendChild(svg);
	this.createSvgBlock(-50, 0, true, red, lineColor, svg);

	// Circular arrow:
	let g1 = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g1);
	LDR.SVG.appendRotationCircle(0, 0, 18, g1);

	// Right hand side:
	let g2 = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g2);
	let turned = this.createSvgBlock(50, 0, true, red, lineColor, g2);

	let a = document.createElementNS(LDR.SVG.NS, 'animateTransform');
	a.setAttribute('id', 'turnerNormal');
	a.setAttribute('attributeName', 'transform');
	a.setAttribute('attributeType', 'XML');
	a.setAttribute('type', 'rotate');
	a.setAttribute('from', '0 50 0');
	a.setAttribute('to', '90 50 0');
	a.setAttribute('dur', '1s');
	a.setAttribute('fill', 'freeze');
	a.setAttribute('begin', '1s;turnerNormal.end+2s');

	g2.appendChild(a);
    }
    /* 
       Option 3: off
    */
    {
	// Left box
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -35 200 70');
	buttons[2].appendChild(svg);
	this.createSvgBlock(-50, 0, true, red, lineColor, svg);

	// Arrow:
	svg.appendChild(LDR.SVG.makeLine(-w, 0, w, 0, true));
	svg.appendChild(LDR.SVG.makeLine(w/2, w/2, w, 0, true));
	svg.appendChild(LDR.SVG.makeLine(w/2, -w/2, w, 0, true));

	// Right hand side:
	let g = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g);
	g.setAttribute('transform', 'rotate(90 0 0) translate(-50 -55)');
	let turned = this.createSvgBlock(50, 0, true, red, lineColor, g);
    }
}

LDR.Options.prototype.appendShowPLIOptions = function(optionsBlock) {
    let group = this.addOptionsGroup(optionsBlock, 2, "Parts List");
    let options = this;
    let onPLIChange = function(idx) {
	options.showPLI = idx;
	options.onChange(false);
    };
    let buttons = this.createButtons(group, 2, this.showPLI, onPLIChange);
    
    // Colors:
    let red = function(){return '#C91A09';};
    let lineColor = function(options){
	return LDR.Colors.int2Hex(options.lineColor);
    };

    /* 
       OFF:
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -40 200 80');
	buttons[0].appendChild(svg);
	for(let xx = -1; xx <= 1; xx++) {
	    this.createSvgBlock(xx*LDR.Options.svgBlockWidth, 
				0, true, red, lineColor, svg);
	}
    }
    /* 
       ON:
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -40 200 80');
	buttons[1].appendChild(svg);
	svg.appendChild(LDR.SVG.makeRoundRect(-90, -30, 60, 60, 2));
	let txt = document.createElementNS(LDR.SVG.NS, 'text');
	txt.setAttribute('x', '-87');
	txt.setAttribute('y', '24');
	txt.setAttribute('fill', 'black');
	txt.innerHTML = "3x";
	svg.appendChild(txt);
	this.createSvgBlock(-2*LDR.Options.svgBlockWidth, 
			    -5, true, red, lineColor, svg);
	for(let xx = 0; xx <= 2; xx++) {
	    this.createSvgBlock(xx*LDR.Options.svgBlockWidth, 
				0, true, red, lineColor, svg);
	}
    }
}

LDR.Options.prototype.appendLROptions = function(optionsBlock, ldrButtons) {
    let group = this.addOptionsGroup(optionsBlock, 3, "Button Size");
    let options = this;
    let onLRChange = function(idx) {
	options.showLRButtons = idx;
	options.onChange(false);

        ldrButtons.nextButtonLarge.style.display = (idx != 0) ? 'none' : 'block';
        ldrButtons.nextButton.style.display = (idx != 1) ? 'none' : 'block';
    };
    let buttons = this.createButtons(group, 3, this.showLRButtons, onLRChange);
    
    /* 
       Option 1: Big
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '0 0 200 200');
	svg.setAttribute('class', 'ui_toggles');
	let r = LDR.SVG.makeRightArrowLarge();
	svg.appendChild(r);
	buttons[0].appendChild(r);
    }
    /* 
       Option 2: Right normal
    */
    {
	let svg = LDR.SVG.makeRightArrow();
	svg.setAttribute('class', 'ui_toggles');
	svg.children[0].setAttribute('transform', 'scale(0.5 0.5) translate(100 100)');
	buttons[1].appendChild(svg);
    }
    /* 
       Option 3: off
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-200 -100 400 200');
	svg.setAttribute('class', 'ui_toggles');
	svg.appendChild(LDR.SVG.makeOffIcon(0, 0, 200));
	buttons[2].appendChild(svg);
    }
}

LDR.Options.prototype.appendCameraOptions = function(optionsBlock, ldrButtons) {
    let group = this.addOptionsGroup(optionsBlock, 3, "Camera Buttons");
    let options = this;
    let onCameraChange = function(idx) {
	options.showCameraButtons = idx;
	options.onChange(false);
        console.warn('Change Camera to ' + idx);
	if(idx == 0) {
	    ldrButtons.zoomInButtonLarge.style.display = 'none';
	    ldrButtons.zoomInButton.style.display = 'inline-block';
	    ldrButtons.zoomOutButtonLarge.style.display = 'none';
	    ldrButtons.zoomOutButton.style.display = 'inline-block';
	    ldrButtons.resetCameraButton.style.visibility = 'visible';
	}
	else if(idx == 1) {
	    ldrButtons.zoomInButtonLarge.style.display = 'inline-block';
	    ldrButtons.zoomInButton.style.display = 'none';
	    ldrButtons.zoomOutButtonLarge.style.display = 'inline-block';
	    ldrButtons.zoomOutButton.style.display = 'none';
	    ldrButtons.resetCameraButton.style.visibility = 'visible';
	}
        else {
            ldrButtons.zoomInButtonLarge.style.display = 'none';
	    ldrButtons.zoomOutButtonLarge.style.display = 'none';
	    ldrButtons.zoomInButton.style.display = 'none';
	    ldrButtons.zoomOutButton.style.display = 'none';
	    ldrButtons.resetCameraButton.style.visibility = 'hidden';
        }
    };
    let buttons = this.createButtons(group, 3, this.showCameraButtons, onCameraChange);
    
    /* 
       Option 1: Small to the right
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '0 0 300 100');
	svg.setAttribute('class', 'ui_toggles');
	svg.appendChild(LDR.SVG.makeCamera(50, 45, 100));
	let o = LDR.SVG.makeZoom(false, 1);
	o.children[0].setAttribute('transform', 'scale(0.5 0.5) translate(100 50)');
	let i = LDR.SVG.makeZoom(true, 1);
	i.children[0].setAttribute('transform', 'scale(0.5 0.5) translate(100 0)');
	svg.appendChild(o);
	svg.appendChild(i);
	buttons[0].appendChild(svg);
    }
    /* 
       Option 2: Large zoom buttons on sides
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '0 0 300 100');
	svg.setAttribute('class', 'ui_toggles');
	svg.appendChild(LDR.SVG.makeCamera(50, 45, 100));
	let o = LDR.SVG.makeZoom(false, 2);
	o.children[0].setAttribute('transform', 'translate(-100 0)');
	let i = LDR.SVG.makeZoom(true, 2);
	i.children[0].setAttribute('transform', 'translate(100 0)');
	svg.appendChild(o);
	svg.appendChild(i);
	buttons[1].appendChild(svg);
    }
    /* 
       Option 3: off
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-150 -50 300 100');
	svg.setAttribute('class', 'ui_toggles');
	svg.appendChild(LDR.SVG.makeOffIcon(0, 0, 100));
	buttons[2].appendChild(svg);
    }
}

LDR.Options.prototype.appendRotationOptions = function(optionsBlock) {
    let group = this.addOptionsGroup(optionsBlock, 2, "Show FPS and Rotate");
    let options = this;
    let onChange = function(idx) {
	options.rotateModel = idx;
	options.onChange(false);
    };
    let buttons = this.createButtons(group, 2, this.rotateModel, onChange);
    let red = function(){return '#C91A09';};
    let lineColor = function(options){
	return LDR.Colors.int2Hex(options.lineColor);
    };
    let w = 20;	
    
    /* 
       Option 0: Off
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[0].appendChild(svg);
	this.createSvgBlock(0, 0, true, red, lineColor, svg);
    }
    /* 
       Option 1: On
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[1].appendChild(svg);

	let g = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g);
	let turned = this.createSvgBlock(0, 0, true, red, lineColor, g);

	let a = document.createElementNS(LDR.SVG.NS, 'animateTransform');
	a.setAttribute('id', 'turnerFull');
	a.setAttribute('attributeName', 'transform');
	a.setAttribute('attributeType', 'XML');
	a.setAttribute('type', 'rotate');
	a.setAttribute('from', '0 0 0');
	a.setAttribute('to', '360 0 0');
	a.setAttribute('dur', '30s');
	a.setAttribute('begin', '1s;turnerFull.end');

	g.appendChild(a);
    }
}

LDR.Options.prototype.appendStudHighContrastOptions = function(optionsBlock) {
    let group = this.addOptionsGroup(optionsBlock, 2, "Contrast on Studs");
    let options = this;
    let onChange = function(idx) {
	options.studHighContrast = idx;
	options.onChange(true);
    };
    let buttons = this.createButtons(group, 2, this.studHighContrast, onChange);
    let red = function(){return '#C91A09';};
    let lineColor = function(options){
	return LDR.Colors.int2Hex(options.lineColor);
    };
    let w = 20;	
    
    /* 
       Option 0: Off
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[0].appendChild(svg);
        this.createSvgCylinder(0, 0, false, red, lineColor, svg);
    }
    /* 
       Option 1: On
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[1].appendChild(svg);
        this.createSvgCylinder(0, 0, true, red, lineColor, svg);
    }
}

LDR.Options.prototype.appendStudLogoOptions = function(optionsBlock) {
    let group = this.addOptionsGroup(optionsBlock, 2, "Logo on Studs");
    let options = this;
    let onChange = function(idx) {
	options.studLogo = idx;
	options.onChange(true);
    };
    let buttons = this.createButtons(group, 2, this.studLogo > 0 ? 1 : 0, onChange);

    /* 
       Option 0: Off. Options 1-5 are versions of logos on stud.
    */
    for(let i = 0; i < 2; i++) {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -35 200 60');
	svg.setAttribute('class', 'ui_toggles');

        svg.append(LDR.SVG.makeCircle(0, -5, 23, true));

        if(i > 0) {
          let lego = document.createElementNS(LDR.SVG.NS, 'text');
          lego.innerHTML = 'LEGO';
          lego.setAttribute('class', 'lego_' + i);
          lego.setAttribute('text-anchor', 'middle');
          svg.append(lego);
        }

	buttons[i].appendChild(svg);
    }
}

LDR.Options.prototype.createButtons = function(parent, numberOfButtons, initiallySelected, onChange) {
    let ret = [];

    for(let i = 0; i < numberOfButtons; i++) {
	let button = document.createElement('td');
	button.setAttribute('class', i === initiallySelected ? 'option_selected' : 'option');
	let event = function(e) {
	    LDR.Options.setOptionsSelected(e.target, onChange);
	}
	button.addEventListener('click', event);
	ret.push(button);
	parent.appendChild(button);
    }

    return ret;
}

LDR.Options.prototype.addOptionsGroup = function(optionsBlock, columns, description) {
    let optionsTable = document.createElement('table');
    optionsTable.setAttribute('class', 'options');
    optionsBlock.appendChild(optionsTable);

    this.appendDescriptionBar(optionsTable, columns, description);

    let optionsGroupRow = document.createElement('tr');
    optionsGroupRow.setAttribute('class', 'options_group');
    optionsTable.appendChild(optionsGroupRow);

    return optionsGroupRow;
}

/*
SVG Icon fun below:
*/
LDR.Options.svgBlockWidth = 30;
LDR.Options.svgBlockHeight = 25;

LDR.Options.prototype.createSvgBlock = function(x, y, closed, getFillColor, getLineColor, parent) {
    let dx2 = LDR.Options.svgBlockWidth/2; // Half a block width
    let dy = LDR.Options.svgBlockHeight;
    let dy2 = dy*0.3; // dy for moving half a block width.

    let pts1 = 'M ' + x + ' ' + (y - dy/2 + dy2) + 
	' l' + dx2 + ' -' + dy2 + 
	' v' + dy + 
	' l-' + dx2 + ' ' + dy2 + 
	' l-' + dx2 + ' -' + dy2 + 
	' v-' + dy + 
	' l' + dx2 + ' ' + dy2 + 
	' v' + dy;
    let path1 = document.createElementNS(LDR.SVG.NS, 'path');
    path1.setAttribute('d', pts1);
    let options = this;
    let listener1 = function() {
	path1.setAttribute('fill', getFillColor(options));
	path1.setAttribute('stroke', getLineColor(options));
    };
    this.listeners.push(listener1);
    parent.appendChild(path1);
    listener1();

    if(!closed)
	return;

    let pts2 = 'M ' +(x-dx2) + ' ' + (y-dy/2) + 
	' l' + dx2 + ' -' + dy2 + 
	' l' + dx2 + ' ' + dy2 + 
	' l-' + dx2 + ' ' + dy2 + 
	' Z';
    let path2 = document.createElementNS(LDR.SVG.NS, 'path');
    path2.setAttribute('d', pts2);
    let listener2 = function() {
	path2.setAttribute('fill', getFillColor(options));
	path2.setAttribute('stroke', getLineColor(options));
    }
    this.listeners.push(listener2);
    parent.appendChild(path2);
    listener2();
}

LDR.Options.prototype.createSvgPoints = function(x, y, getColor, parent, size) {
    let dx2 = LDR.Options.svgBlockWidth/2; // Half a block width
    let dy = LDR.Options.svgBlockHeight;
    let dy2 = dy*0.3; // dy for moving half a block width.

    let pts1 = 'M ' + x + ' ' + (y - dy/2 + dy2) + 
	' l' + dx2 + ' -' + dy2 + 
	' v' + dy + 
	' l-' + dx2 + ' ' + dy2 + 
	' l-' + dx2 + ' -' + dy2 + 
	' v-' + dy + 
	' l' + dx2 + ' ' + dy2 + 
	' v' + dy;
    let path1 = document.createElementNS(LDR.SVG.NS, 'path');
    path1.setAttribute('d', pts1);
    path1.setAttribute('stroke-dasharray', '0.1 5');
    path1.setAttribute('fill', 'none');
    path1.style = "stroke-width: " + size/2;
    let options = this;
    let listener1 = function() {
	path1.setAttribute('stroke', getColor(options));
    };
    this.listeners.push(listener1);
    parent.appendChild(path1);
    listener1();

    let pts2 = 'M ' +(x-dx2) + ' ' + (y-dy/2) + 
	' l' + dx2 + ' -' + dy2 + 
	' l' + dx2 + ' ' + dy2;
    let path2 = document.createElementNS(LDR.SVG.NS, 'path');
    path2.setAttribute('d', pts2);
    path2.setAttribute('stroke-dasharray', '0.1 5');
    path2.setAttribute('fill', 'none');
    path2.style = "stroke-width: " + size/2;
    let listener2 = function() {
	path2.setAttribute('stroke', getColor(options));
    }
    this.listeners.push(listener2);
    parent.appendChild(path2);
    listener2();
}

LDR.Options.prototype.createSvgCylinder = function(x, y, highContrast, getFillColor, getLineColor, parent) {
    let dx2 = LDR.Options.svgBlockWidth*0.5; // Half a block width
    let dy = LDR.Options.svgBlockHeight*0.5;
    let dy2 = dy*0.3; // dy for moving half a block width.

    function makeCyli(y) {
	let c = document.createElementNS(LDR.SVG.NS, 'ellipse');
	c.setAttribute('cx', x);
	c.setAttribute('cy', y);
	c.setAttribute('rx', dx2);
	c.setAttribute('ry', dy2);
	return c;
    }
    let base = makeCyli(y+dy/2);
    let center = LDR.SVG.makeRect(x-dx2, y-dy/2, LDR.Options.svgBlockWidth, dy);
    let top = makeCyli(y-dy/2);

    parent.appendChild(base);
    parent.appendChild(center);
    let l1 = LDR.SVG.makeLine(x-dx2, y-dy/2, x-dx2, y+dy/2);
    parent.appendChild(l1);
    let l2 = LDR.SVG.makeLine(x+dx2, y-dy/2, x+dx2, y+dy/2);	
    parent.appendChild(l2);	

    if(highContrast) {
        base.setAttribute('fill', '#000000');
        center.setAttribute('fill', '#000000');
        l1.setAttribute('stroke', '#000000');
        l2.setAttribute('stroke', '#000000');
    }
    parent.appendChild(top);

    let options = this;
    let listener = function() {
	base.setAttribute('stroke', getLineColor(options));
	if(!highContrast) {
	    l1.setAttribute('stroke', getLineColor(options));
	    l2.setAttribute('stroke', getLineColor(options));
            base.setAttribute('fill', getFillColor(options));
            center.setAttribute('fill', getFillColor(options));
        }
	top.setAttribute('fill', getFillColor(options));
	top.setAttribute('stroke', getLineColor(options));
    };
    this.listeners.push(listener);
    listener();
}

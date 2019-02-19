'use strict';

var LDR = LDR || {};

LDR.Options = function() {
    this.listeners = [];
    
    // Default values for options (in case of first visit or no cookies:
    this.showOldColors = 0; // 0 = all colors. 1 = single color old
    this.showLines = 0; // 0 = all lines. 1 = normal lines. 2 = no lines.
    this.lineContrast = 1; // 0 = High contrast, 1 = LDraw. 2 = no lines.
    this.bgColor = 0xFFFFFF;
    this.pointColor = 0xFF0000;
    this.pointSize = 2;
    this.lineColor = 0x333333;
    this.blackLineColor = 0x595959;
    this.oldColor = 0xFFFF6F;
    this.showLRButtons = 0; // 0=right big, 1=right normal, 2=both off
    this.showCameraButtons = 0; // 0=+- on right, 1=+- on sides, 2=off
    this.showStepRotationAnimations = 1; // 0=slow, 1=normal speed, 2=off
    this.partsListType = 0; // 0=icons, 1=list
    this.showNotes = 0; // 0=off, 1=on
    this.showPLI = 1; // 0=off, 1=on
    this.rotateModel = 0; // 0=off, 1=on

    // Read values that might be in cookie:
    this.readOptionsFromCookie();

    var options = this;
    this.onChange = function() {
	for(var i = 0; i < options.listeners.length; i++) {
	    options.listeners[i](options);
	}
	options.saveOptionsToCookie();
    }
}

LDR.Options.prototype.readOptionsFromCookie = function() {
    if(!document.cookie)
	return; // Can't read cookie.
    var cookieParts = decodeURIComponent(document.cookie).split(/\s*;\s*/);
    for(var i = 0; i < cookieParts.length; i++) {
	var part = cookieParts[i];
	var equalAt = part.indexOf('=');
	if(equalAt > 1) {
	    var key = part.substring(0, equalAt);
	    if(this[key] != undefined)
		this[key] = parseInt(part.substring(equalAt+1));
	}
    } 
}

LDR.Options.prototype.saveOptionsToCookie = function() {
    var options = this;
    function addToKv(v) {
	document.cookie = v + '=' + options[v] + '; expires=Wed, 3 Jun 2122 12:00:01 UTC; path=/';
    }
    addToKv("showOldColors");
    addToKv("showLines");
    addToKv("lineContrast");
    addToKv("lineColor");
    addToKv("pointSize");
    addToKv("blackLineColor");
    addToKv("bgColor");
    addToKv("pointColor");
    addToKv("oldColor");
    addToKv("showPartsCallouts");
    addToKv("showStepRotationAnimations");
    addToKv("showPartsCallouts");
    addToKv("showCameraButtons");
    addToKv("showLRButtons");
    addToKv("partsListType");
    addToKv("showNotes");
    addToKv("showPLI");
    addToKv("rotateModel");
}

LDR.Options.setOptionsSelected = function(node, callback) {
    var parent = node.parentNode;
    var children = parent.childNodes;
    for(var i = 0; i < children.length; i++) {
	var child = children[i];
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
    var headerDiv = document.createElement('div');
    headerDiv.setAttribute('id', 'options_header');
    optionsBlock.appendChild(headerDiv);

    headerDiv.appendChild(LDR.SVG.makeOptions());
}
LDR.Options.prototype.appendFooter = function(optionsBlock) {
    var div = document.createElement('div');
    div.setAttribute('class', 'options_footer');
    var a = document.createElement('a');
    a.setAttribute('href', '#top');

    optionsBlock.appendChild(div);
    div.appendChild(a);
    a.appendChild(LDR.SVG.makeUpArrow());
}
LDR.Options.prototype.appendDescriptionBar = function(optionsBlock, columns, description) {
    var tr = document.createElement('tr');
    tr.setAttribute('class', 'options_description_header');

    var td = document.createElement('td');
    td.setAttribute('class', 'options_description');
    td.setAttribute('colspan', ""+columns);

    var desc = document.createElement('span');
    desc.innerHTML = description;

    var aHolder = document.createElement('span');
    var a = document.createElement('a');
    a.setAttribute('href', '#top');
    var svg = LDR.SVG.makeUpArrow();
    svg.setAttribute('viewBox', '20 20 60 60');
    a.appendChild(svg);
    aHolder.appendChild(a);

    td.appendChild(desc);
    td.appendChild(aHolder);

    tr.appendChild(td);
    optionsBlock.appendChild(tr);
}

LDR.Options.prototype.appendOldBrickColorOptions = function(optionsBlock) {
    var group = this.addOptionsGroup(optionsBlock, 2, "Highlight New Parts");
    var options = this;
    var onOldBrickChange = function(idx) {
	options.showOldColors = idx;
	options.onChange();
    };
    var buttons = this.createButtons(group, 2, this.showOldColors, onOldBrickChange);
    
    // Color functions:
    var red = function(){return '#C91A09';};
    var green = function(){return '#257A3E';};
    var blue = function(){return '#0055BF';};    
    var rgb = [red, green, blue];
    
    var lineColor = function(options){
	return LDR.Colors.int2Hex(options.lineColor);
    };
    var oldColor = function(options){
	return LDR.Colors.int2Hex(options.oldColor);
    };

    var positions = [{x:-1,y:1},{x:1,y:1},{x:1,y:-1}];
    var drawParts = function(x, y, cnt, cntOld, svg) {
	for(var i = 0; i < cnt; i++) {
	    var position = positions[i];
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
    var dst = 60;
    var w = 20;
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
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
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -40 200 80');
	buttons[1].appendChild(svg);
	drawParts(-dst, 0, 2, 0, svg);
	svg.appendChild(LDR.SVG.makeLine(-w, 0, w, 0, true));
	svg.appendChild(LDR.SVG.makeLine(w/2, w/2, w, 0, true));
	svg.appendChild(LDR.SVG.makeLine(w/2, -w/2, w, 0, true));
	drawParts(dst, 0, 3, 2, svg);
    }
}

LDR.Options.prototype.appendLineOptions = function(optionsBlock) {
    var group = this.addOptionsGroup(optionsBlock, 3, "Lines");
    var options = this;
    var onLinesChange = function(idx) {
	options.showLines = idx;
	options.onChange();
    };
    var buttons = this.createButtons(group, 3, this.showLines, onLinesChange);
    
    // Color functions:
    var red = function(){return '#C91A09';};
    var lineColor = function(options){
	return LDR.Colors.int2Hex(options.lineColor);
    };

    /* 
       Option 1: Both lines and conditional lines:
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[0].appendChild(svg);
	this.createSvgBlock(-LDR.Options.svgBlockWidth, 0, true, red, lineColor, svg);
	this.createSvgCylinder(LDR.Options.svgBlockWidth, 0, true, red, lineColor, svg);
    }
    /* 
       Option 2: Only normal lines:
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[1].appendChild(svg);
	this.createSvgBlock(-LDR.Options.svgBlockWidth, 0, true, red, lineColor, svg);
	this.createSvgCylinder(LDR.Options.svgBlockWidth, 0, false, red, lineColor, svg);
    }
    /* 
       Option 3: No lines:
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[2].appendChild(svg);
	this.createSvgBlock(-LDR.Options.svgBlockWidth, 0, true, red, red, svg);
	this.createSvgCylinder(LDR.Options.svgBlockWidth, 0, true, red, red, svg);
    }
}

LDR.Options.prototype.appendContrastOptions = function(optionsBlock) {
    var group = this.addOptionsGroup(optionsBlock, 3, "Contrast");
    var options = this;
    var onChange = function(idx) {
	options.lineContrast = idx;
        if(idx == 1)
          options.lineColor = 0x333333;
        else if(idx == 0)
          options.lineColor = 0;
        else
          options.lineColor = -1;
	options.onChange();
    };
    var buttons = this.createButtons(group, 3, this.lineContrast, onChange);
    
    // Color functions:
    var red = function(){return '#C91A09';};
    var redEdge1 = function(){return '#000000';};
    var redEdge2 = function(){return '#333333';};
    var black = function(){return '#05131D';};
    var blackEdge1 = function(){return '#FFFFFF';};
    var blackEdge2 = function(){return '#595959';};

    /* 
       Option 1: High contrast:
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[0].appendChild(svg);
	this.createSvgBlock(-LDR.Options.svgBlockWidth, 0, true, red, redEdge1, svg);
	this.createSvgBlock(LDR.Options.svgBlockWidth, 0, true, black, blackEdge1, svg);
    }
    /* 
       Option 2: Only normal lines:
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[1].appendChild(svg);
	this.createSvgBlock(-LDR.Options.svgBlockWidth, 0, true, red, redEdge2, svg);
	this.createSvgBlock(LDR.Options.svgBlockWidth, 0, true, black, blackEdge2, svg);
    }
    /* 
       Option 3: No lines:
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[2].appendChild(svg);
	this.createSvgBlock(-LDR.Options.svgBlockWidth, 0, true, red, red, svg);
	this.createSvgBlock(LDR.Options.svgBlockWidth, 0, true, black, black, svg);
    }
}

/*
Choose the colors of lines, lines for black parts and colors for old parts.
*/
LDR.Options.prototype.appendColorOptions = function(optionsBlock) {
    var group = this.addOptionsGroup(optionsBlock, 3, "Colors");
    var options = this;

    // Color functions:
    var red = function(){return '#C91A09';};
    var green = function(){return '#257A3E';};
    var blue = function(){return '#0055BF';};
    var black = function(){return '#333333';};    
    var rgb = [red, green, blue];

    var lineColor = function(options){
	return LDR.Colors.int2Hex(options.lineColor);
    };
    var blackLineColor = function(options){
	return LDR.Colors.int2Hex(options.blackLineColor);
    };
    var oldColor = function(options){
	return LDR.Colors.int2Hex(options.oldColor);
    };

    // Build html elements:
    function createPreview(parent, fillColors, lineColor) {
	var preview = document.createElement('span');
	preview.setAttribute('class', 'preview');
	parent.appendChild(preview);

	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	preview.appendChild(svg);
	for(var i = -1; i <= 1; i++) {
	    options.createSvgBlock(i*LDR.Options.svgBlockWidth, 0, true, fillColors[(i+1)%fillColors.length], lineColor, svg);
	}

	return preview;
    }
    function createColorInput(parent, color, onChange) {
	var input = document.createElement('input');
	input.setAttribute('class', 'color_input');
	input.setAttribute('type', 'color');
	input.setAttribute('value', color);
	input.addEventListener("input", onChange, false);
	input.addEventListener("change", onChange, false);
	parent.appendChild(input);
	return input;
    }
    var onChange = function() {
	options.lineColor = parseInt(input1.value.substring(1), 16);
	options.blackLineColor = parseInt(input2.value.substring(1), 16);
	options.oldColor = parseInt(input3.value.substring(1), 16);
	options.onChange();
    }

    // Fill in data:
    var preview1 = createPreview(group, rgb, lineColor);
    var input1 = createColorInput(preview1, lineColor(options), onChange);

    var preview2 = createPreview(group, [black], blackLineColor);
    var input2 = createColorInput(preview2, blackLineColor(options), onChange);

    var preview3 = createPreview(group, [oldColor], lineColor);
    var input3 = createColorInput(preview3, oldColor(options), onChange);
}

/*
Part color options (points and background color)
*/
LDR.Options.prototype.appendPartColorOptions = function(optionsBlock) {
    var group = this.addOptionsGroup(optionsBlock, 2, "Background and Point Color");
    var options = this;

    // Color functions:
    var bgColor = function(options){return LDR.Colors.int2Hex(options.bgColor);};
    var pointColor = function(options){return LDR.Colors.int2Hex(options.pointColor);};
    var oldColor = function(options){return LDR.Colors.int2Hex(options.oldColor);};
    var lineColor = function(options){return LDR.Colors.int2Hex(options.lineColor);};

    // Build html elements:
    function createPreview(parent, forBG) {
	var preview = document.createElement('td');
	preview.setAttribute('class', 'color_option');
	parent.appendChild(preview);

	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	preview.appendChild(svg);
	if(forBG)
	    options.createSvgBlock(0, 0, true, oldColor, lineColor, svg);
	else
	    options.createSvgPoints(0, 0, pointColor, svg, 2);

	var listener = function(options) {
	    svg.style.backgroundColor = bgColor(options);
	};
	options.listeners.push(listener);
	listener(options);

	return preview;
    }
    function createColorInput(parent, color, onChange) {
	var input = document.createElement('input');
	input.setAttribute('class', 'color_input');
	input.setAttribute('type', 'color');
	input.setAttribute('value', color);
	input.addEventListener("input", onChange, false);
	input.addEventListener("change", onChange, false);
	parent.appendChild(input);
	return input;
    }
    var onChange = function() {
	options.bgColor = parseInt(input1.value.substring(1), 16);
	options.pointColor = parseInt(input2.value.substring(1), 16);
	options.onChange();
    }

    // Fill in data:
    var preview1 = createPreview(group, true);
    var input1 = createColorInput(preview1, bgColor(options), onChange);

    var preview2 = createPreview(group, false);
    var input2 = createColorInput(preview2, pointColor(options), onChange);
}

/*
Part color options (points and background color)
*/
LDR.Options.prototype.appendPartPointSizeOptions = function(optionsBlock) {
    var group = this.addOptionsGroup(optionsBlock, 5, "Points");
    var options = this;
    var onChange = function(idx) {
	options.pointSize = idx;
	options.onChange();
    };
    var buttons = this.createButtons(group, 5, this.pointSize, onChange);

    // Color function:
    var pointColor = function(options){return LDR.Colors.int2Hex(options.pointColor);};

    /* 
       Option 1: off
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-25 -25 50 50');
	svg.setAttribute('class', 'ui_toggles');
	svg.appendChild(LDR.SVG.makeOffIcon(0, 0, 50));
	buttons[0].appendChild(svg);
    }
    /*
      Options 2-5: Size 1-4:
    */
    for(var i = 1; i <= 4; i++) {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-25 -25 50 50');
	options.createSvgPoints(0, 0, pointColor, svg, i);	
	buttons[i].appendChild(svg);
    }
}

LDR.Options.prototype.appendAnimationOptions = function(optionsBlock) {
    var group = this.addOptionsGroup(optionsBlock, 3, "Animations");
    var options = this;
    var onAnimationChange = function(idx) {
	options.showStepRotationAnimations = idx;
	options.onChange();
    };
    var buttons = this.createButtons(group, 3, this.showStepRotationAnimations, onAnimationChange);
    var red = function(){return '#C91A09';};
    var lineColor = function(options){
	return LDR.Colors.int2Hex(options.lineColor);
    };
    var w = 20;	
    
    /* 
       Option 1: Slow
    */
    {
	// Left box
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -35 200 70');
	buttons[0].appendChild(svg);
	this.createSvgBlock(-50, 0, true, red, lineColor, svg);

	// Circular arrow:
	var g1 = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g1);
	LDR.SVG.appendRotationCircle(0, 0, 18, g1);

	// Right hand side:
	var g2 = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g2);
	//g2.setAttribute('transform', 'rotate(90 0 0) translate(-50 -55)');
	var turned = this.createSvgBlock(50, 0, true, red, lineColor, g2);

	var a = document.createElementNS(LDR.SVG.NS, 'animateTransform');
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
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -35 200 70');
	buttons[1].appendChild(svg);
	this.createSvgBlock(-50, 0, true, red, lineColor, svg);

	// Circular arrow:
	var g1 = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g1);
	LDR.SVG.appendRotationCircle(0, 0, 18, g1);

	// Right hand side:
	var g2 = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g2);
	var turned = this.createSvgBlock(50, 0, true, red, lineColor, g2);

	var a = document.createElementNS(LDR.SVG.NS, 'animateTransform');
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
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -35 200 70');
	buttons[2].appendChild(svg);
	this.createSvgBlock(-50, 0, true, red, lineColor, svg);

	// Arrow:
	svg.appendChild(LDR.SVG.makeLine(-w, 0, w, 0, true));
	svg.appendChild(LDR.SVG.makeLine(w/2, w/2, w, 0, true));
	svg.appendChild(LDR.SVG.makeLine(w/2, -w/2, w, 0, true));

	// Right hand side:
	var g = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g);
	g.setAttribute('transform', 'rotate(90 0 0) translate(-50 -55)');
	var turned = this.createSvgBlock(50, 0, true, red, lineColor, g);
    }
}

LDR.Options.prototype.appendShowPLIOptions = function(optionsBlock) {
    var group = this.addOptionsGroup(optionsBlock, 2, "Parts List");
    var options = this;
    var onPLIChange = function(idx) {
	options.showPLI = idx;
	options.onChange();
    };
    var buttons = this.createButtons(group, 2, this.showPLI, onPLIChange);
    
    // Colors:
    var red = function(){return '#C91A09';};
        var lineColor = function(options){
	return LDR.Colors.int2Hex(options.lineColor);
    };

    /* 
       OFF:
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -40 200 80');
	buttons[0].appendChild(svg);
	for(var xx = -1; xx <= 1; xx++) {
	    this.createSvgBlock(xx*LDR.Options.svgBlockWidth, 
				0, true, red, lineColor, svg);
	}
    }
    /* 
       ON:
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -40 200 80');
	buttons[1].appendChild(svg);
	svg.appendChild(LDR.SVG.makeRoundRect(-90, -30, 60, 60, 2));
	var txt = document.createElementNS(LDR.SVG.NS, 'text');
	txt.setAttribute('x', '-87');
	txt.setAttribute('y', '24');
	txt.setAttribute('fill', 'black');
	txt.innerHTML = "3x";
	svg.appendChild(txt);
	this.createSvgBlock(-2*LDR.Options.svgBlockWidth, 
			    -5, true, red, lineColor, svg);
	for(var xx = 0; xx <= 2; xx++) {
	    this.createSvgBlock(xx*LDR.Options.svgBlockWidth, 
				0, true, red, lineColor, svg);
	}
    }
}

LDR.Options.prototype.appendLROptions = function(optionsBlock) {
    var group = this.addOptionsGroup(optionsBlock, 3, "Step Buttons");
    var options = this;
    var onLRChange = function(idx) {
	options.showLRButtons = idx;
	options.onChange();

	ldrButtons.backButton.style.display = ldrButtons.nextButton.style.display = (idx === 2) ? 'none' : 'block';
	if(idx === 0) {
	    ldrButtons.rightArrowLarge.style.display = 'block';
	    ldrButtons.rightArrowNormal.style.display = 'none';
	}
	else if(idx === 1) {
	    ldrButtons.rightArrowLarge.style.display = 'none';
	    ldrButtons.rightArrowNormal.style.display = 'block';
	}
    };
    var buttons = this.createButtons(group, 3, this.showLRButtons, onLRChange);
    
    /* 
       Option 1: Right big
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '0 0 400 200');
	svg.setAttribute('class', 'ui_toggles');
	var l = LDR.SVG.makeLeftArrow();
	l.children[0].setAttribute('transform', 'translate(0 100)');
	var r = LDR.SVG.makeRightArrowLarge();
	r.children[0].setAttribute('transform', 'translate(200 0)');

	svg.appendChild(l);
	svg.appendChild(r);
	buttons[0].appendChild(svg);
    }
    /* 
       Option 2: Right normal
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '0 -100 400 200');
	svg.setAttribute('class', 'ui_toggles');
	svg.appendChild(LDR.SVG.makeLeftArrow());
	var r = LDR.SVG.makeRightArrow();
	r.children[0].setAttribute('transform', 'translate(300 0)');
	svg.appendChild(r);
	buttons[1].appendChild(svg);
    }
    /* 
       Option 3: off
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-200 -100 400 200');
	svg.setAttribute('class', 'ui_toggles');
	svg.appendChild(LDR.SVG.makeOffIcon(0, 0, 200));
	buttons[2].appendChild(svg);
    }
}

LDR.Options.prototype.appendCameraOptions = function(optionsBlock) {
    var group = this.addOptionsGroup(optionsBlock, 3, "Camera Buttons");
    var options = this;
    var onCameraChange = function(idx) {
	options.showCameraButtons = idx;
	options.onChange();

	if(idx === 0) {
	    ldrButtons.zoomInButtonLarge.style.display = 'none';
	    ldrButtons.zoomInButton.style.display = 'block';
	    ldrButtons.zoomOutButtonLarge.style.display = 'none';
	    ldrButtons.zoomOutButton.style.display = 'block';
	    ldrButtons.resetCameraButton.style.visibility = 'visible';
	}
	else if(idx === 1) {
	    ldrButtons.zoomInButtonLarge.style.display = 'block';
	    ldrButtons.zoomInButton.style.display = 'none';
	    ldrButtons.zoomOutButtonLarge.style.display = 'block';
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
    var buttons = this.createButtons(group, 3, this.showCameraButtons, onCameraChange);
    
    /* 
       Option 1: Small to the right
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '0 0 300 100');
	svg.setAttribute('class', 'ui_toggles');
	svg.appendChild(LDR.SVG.makeCamera(100+25, 45, 80));
	var o = LDR.SVG.makeZoom(false, 1);
	o.children[0].setAttribute('transform', 'translate(175 50)');
	var i = LDR.SVG.makeZoom(true, 1);
	i.children[0].setAttribute('transform', 'translate(175 0)');
	svg.appendChild(o);
	svg.appendChild(i);
	buttons[0].appendChild(svg);
    }
    /* 
       Option 2: Large zoom buttons on sides
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '0 0 300 100');
	svg.setAttribute('class', 'ui_toggles');
	svg.appendChild(LDR.SVG.makeCamera(100+50, 45, 80));
	var o = LDR.SVG.makeZoom(false, 2);
	//o.children[0].setAttribute('transform', 'translate( 100)');
	var i = LDR.SVG.makeZoom(true, 2);
	i.children[0].setAttribute('transform', 'translate(200 0)');
	svg.appendChild(o);
	svg.appendChild(i);
	buttons[1].appendChild(svg);
    }
    /* 
       Option 3: off
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-150 -50 300 100');
	svg.setAttribute('class', 'ui_toggles');
	svg.appendChild(LDR.SVG.makeOffIcon(0, 0, 100));
	buttons[2].appendChild(svg);
    }
}

LDR.Options.prototype.appendRotationOptions = function(optionsBlock) {
    var group = this.addOptionsGroup(optionsBlock, 2, "Show FPS and Rotate");
    var options = this;
    var onChange = function(idx) {
	options.rotateModel = idx;
	options.onChange();
    };
    var buttons = this.createButtons(group, 2, this.rotateModel, onChange);
    var red = function(){return '#C91A09';};
    var lineColor = function(options){
	return LDR.Colors.int2Hex(options.lineColor);
    };
    var w = 20;	
    
    /* 
       Option 0: Off
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[0].appendChild(svg);
	this.createSvgBlock(0, 0, true, red, lineColor, svg);
    }
    /* 
       Option 1: On
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[1].appendChild(svg);

	var g = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g);
	var turned = this.createSvgBlock(0, 0, true, red, lineColor, g);

	var a = document.createElementNS(LDR.SVG.NS, 'animateTransform');
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

LDR.Options.prototype.createButtons = function(parent, numberOfButtons, initiallySelected, onChange) {
    var ret = [];

    for(var i = 0; i < numberOfButtons; i++) {
	var button = document.createElement('td');
	button.setAttribute('class', i === initiallySelected ? 'option_selected' : 'option');
	var event = function(e) {
	    LDR.Options.setOptionsSelected(e.target, onChange);
	}
	button.addEventListener('click', event);
	ret.push(button);
	parent.appendChild(button);
    }

    return ret;
}

LDR.Options.prototype.addOptionsGroup = function(optionsBlock, columns, description) {
    var optionsTable = document.createElement('table');
    optionsTable.setAttribute('class', 'options');
    optionsBlock.appendChild(optionsTable);

    this.appendDescriptionBar(optionsTable, columns, description);

    var optionsGroupRow = document.createElement('tr');
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
    var dx2 = LDR.Options.svgBlockWidth/2; // Half a block width
    var dy = LDR.Options.svgBlockHeight;
    var dy2 = dy*0.3; // dy for moving half a block width.

    var pts1 = 'M ' + x + ' ' + (y - dy/2 + dy2) + 
	' l' + dx2 + ' -' + dy2 + 
	' v' + dy + 
	' l-' + dx2 + ' ' + dy2 + 
	' l-' + dx2 + ' -' + dy2 + 
	' v-' + dy + 
	' l' + dx2 + ' ' + dy2 + 
	' v' + dy;
    var path1 = document.createElementNS(LDR.SVG.NS, 'path');
    path1.setAttribute('d', pts1);
    var options = this;
    var listener1 = function(options) {
	path1.setAttribute('fill', getFillColor(options));
	path1.setAttribute('stroke', getLineColor(options));
    };
    this.listeners.push(listener1);
    parent.appendChild(path1);
    listener1(options);

    if(!closed)
	return;

    var pts2 = 'M ' +(x-dx2) + ' ' + (y-dy/2) + 
	' l' + dx2 + ' -' + dy2 + 
	' l' + dx2 + ' ' + dy2 + 
	' l-' + dx2 + ' ' + dy2 + 
	' Z';
    var path2 = document.createElementNS(LDR.SVG.NS, 'path');
    path2.setAttribute('d', pts2);
    var options = this;
    var listener2 = function() {
	path2.setAttribute('fill', getFillColor(options));
	path2.setAttribute('stroke', getLineColor(options));
    }
    this.listeners.push(listener2);
    parent.appendChild(path2);
    listener2(options);
}

LDR.Options.prototype.createSvgPoints = function(x, y, getColor, parent, size) {
    var dx2 = LDR.Options.svgBlockWidth/2; // Half a block width
    var dy = LDR.Options.svgBlockHeight;
    var dy2 = dy*0.3; // dy for moving half a block width.

    var pts1 = 'M ' + x + ' ' + (y - dy/2 + dy2) + 
	' l' + dx2 + ' -' + dy2 + 
	' v' + dy + 
	' l-' + dx2 + ' ' + dy2 + 
	' l-' + dx2 + ' -' + dy2 + 
	' v-' + dy + 
	' l' + dx2 + ' ' + dy2 + 
	' v' + dy;
    var path1 = document.createElementNS(LDR.SVG.NS, 'path');
    path1.setAttribute('d', pts1);
    path1.setAttribute('stroke-dasharray', '0.1 5');
    path1.setAttribute('fill', 'none');
    path1.style = "stroke-width: " + size/2;
    var options = this;
    var listener1 = function(options) {
	path1.setAttribute('stroke', getColor(options));
    };
    this.listeners.push(listener1);
    parent.appendChild(path1);
    listener1(options);

    var pts2 = 'M ' +(x-dx2) + ' ' + (y-dy/2) + 
	' l' + dx2 + ' -' + dy2 + 
	' l' + dx2 + ' ' + dy2;
    var path2 = document.createElementNS(LDR.SVG.NS, 'path');
    path2.setAttribute('d', pts2);
    path2.setAttribute('stroke-dasharray', '0.1 5');
    path2.setAttribute('fill', 'none');
    path2.style = "stroke-width: " + size/2;
    var options = this;
    var listener2 = function() {
	path2.setAttribute('stroke', getColor(options));
    }
    this.listeners.push(listener2);
    parent.appendChild(path2);
    listener2(options);
}

LDR.Options.prototype.createSvgCylinder = function(x, y, conditionalLines, getFillColor, getLineColor, parent) {
    var dx2 = LDR.Options.svgBlockWidth/2; // Half a block width
    var dy = LDR.Options.svgBlockHeight;
    var dy2 = dy*0.3; // dy for moving half a block width.

    function makeCyli(y) {
	var c = document.createElementNS(LDR.SVG.NS, 'ellipse');
	c.setAttribute('cx', x);
	c.setAttribute('cy', y);
	c.setAttribute('rx', dx2);
	c.setAttribute('ry', dy2);
	return c;
    }
    var base = makeCyli(y+dy/2);
    var center = LDR.SVG.makeRect(x-dx2, y-dy/2, LDR.Options.svgBlockWidth, dy);
    var top = makeCyli(y-dy/2);

    parent.appendChild(base);
    parent.appendChild(center);
    if(conditionalLines) {
	var l1 = LDR.SVG.makeLine(x-dx2, y-dy/2, x-dx2, y+dy/2);
	parent.appendChild(l1);
	var l2 = LDR.SVG.makeLine(x+dx2, y-dy/2, x+dx2, y+dy/2);	
	parent.appendChild(l2);	
    }
    parent.appendChild(top);

    var options = this;
    var listener = function(options) {
	base.setAttribute('fill', getFillColor(options));
	base.setAttribute('stroke', getLineColor(options));
	center.setAttribute('fill', getFillColor(options));
	if(conditionalLines) {
	    l1.setAttribute('stroke', getLineColor(options));
	    l2.setAttribute('stroke', getLineColor(options));	    
	}
	top.setAttribute('fill', getFillColor(options));
	top.setAttribute('stroke', getLineColor(options));
    };
    this.listeners.push(listener);
    listener(options);
}

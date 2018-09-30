var LDR = LDR || {};

LDR.Options = function() {
    this.listeners = [];
    
    // Default values for options (in case of first visit or no cookies:
    this.showOldColors = 0; // 0 = all colors. 1 = single color old. 2 = dulled old.
    this.showLines = 1; // 0 = all lines. 1 = normal lines. 2 = no lines.
    this.lineColor = 0x000000;
    this.blackLineColor = 0x777777;
    this.oldColor = 0xffff6f;
    this.showFFFRButtons = 0; // 0=off, 1=on
    this.showLRButtons = 0; // 0=right big, 1=right normal, 2=both off
    this.showCameraButtons = 0; // 0=+- on right, 1=+- on sides, 2=off
    this.showStepRotationAnimations = 0; // 0=on, 1=off
    this.partsListType = 0; // 0=icons, 1=list
    // TODO: Make buttons vv
    this.showPartsCallouts = 0; // 0=left, 1=top, 2=right, 3=bottom, 4=off

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
    addToKv("lineColor");
    addToKv("blackLineColor");
    addToKv("oldColor");
    addToKv("showPartsCallouts");
    addToKv("showStepRotationAnimations");
    addToKv("showPartsCallouts");
    addToKv("showCameraButtons");
    addToKv("showFFFRButtons");
    addToKv("showLRButtons");
    addToKv("partsListType");
}

LDR.Colors = LDR.Colors || {};

LDR.Colors.int2RGB = function(i) {
    var b = (i & 0xff);
    i = i >> 8;
    var g = (i & 0xff);
    i = i >> 8;
    var r = i;
    return [r, g, b];
}

LDR.Colors.int2Hex = function(i) {
    var rgb = LDR.Colors.int2RGB(i);
    var ret = '#';
    for(var j = 0; j < 3; j++) {
	rgb[j] = Number(rgb[j]).toString(16);
	if(rgb[j].length == 1)
	    ret += '0';
	ret += rgb[j];
    }
    return ret;
}

LDR.Colors.desaturateColor = function(hex) {
    var threeColor = new THREE.Color(hex);
    var hsl = {};
    threeColor.getHSL(hsl);

    if(hsl.l == 0)
	hsl.l = 0.3;
    else
	hsl.l *= 0.7;

    threeColor.setHSL(hsl.h, hsl.s, hsl.l);
    return threeColor.getHex();
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
    div.setAttribute('id', 'options_footer');
    var a = document.createElement('a');
    a.setAttribute('href', '#top');

    optionsBlock.appendChild(div);
    div.appendChild(a);
    a.appendChild(LDR.SVG.makeUpArrow());
}
LDR.Options.prototype.appendDescriptionBar = function(optionsBlock, columns, description) {
    var span = document.createElement('tr');

    var td = document.createElement('td');
    td.setAttribute('class', 'options_description');
    td.setAttribute('colspan', ""+columns);
    td.innerHTML = description;

    span.appendChild(td);
    optionsBlock.appendChild(span);
}

LDR.Options.prototype.appendOldBrickColorOptions = function(optionsBlock) {
    var group = this.addOptionsGroup(optionsBlock, 3, "Highlights");
    var options = this;
    var onOldBrickChange = function(idx) {
	options.showOldColors = idx;
	options.onChange();
    };
    var buttons = this.createButtons(group, 3, this.showOldColors, onOldBrickChange);
    
    // Color functions:
    var red = function(){return '#FF0000';};
    var green = function(){return '#00FF00';};
    var blue = function(){return '#0000FF';};    
    var rgb = [red, green, blue];
    
    var dred = LDR.Colors.int2Hex(LDR.Colors.desaturateColor(0xFF0000));
    var fdred = function(){return dred};
    var dgreen = LDR.Colors.int2Hex(LDR.Colors.desaturateColor(0x00FF00));
    var fdgreen = function(){return dgreen};
    var dblue = LDR.Colors.int2Hex(LDR.Colors.desaturateColor(0x0000FF));
    var fdblue = function(){return dblue};
    var desat = [fdred, fdgreen, fdblue];

    var lineColor = function(options){
	return LDR.Colors.int2Hex(options.lineColor);
    };
    var oldColor = function(options){
	return LDR.Colors.int2Hex(options.oldColor);
    };

    /* 
       The first option is to always paint colors:
       Indicated by 9 bricks - all colorful.
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -50 200 100');
	buttons[0].appendChild(svg);
	for(var yy = -1; yy <= 1; yy++) {
	    for(var xx = -1; xx <= 1; xx++) {
		this.createSvgBlock(xx*LDR.Options.svgBlockWidth, 
				    yy*LDR.Options.svgBlockHeight, 
				    yy === -1, 
				    rgb[(xx+yy+2)%3],
				    lineColor,
				    svg);
	    }
	}
    }
    /* 
       Second option: old colors in customizable color:
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -50 200 100');
	buttons[1].appendChild(svg);
	for(var yy = -1; yy <= 1; yy++) {
	    for(var xx = -1; xx <= 1; xx++) {
		this.createSvgBlock(xx*LDR.Options.svgBlockWidth, 
				    yy*LDR.Options.svgBlockHeight, 
				    yy === -1,
				    yy === -1 ? rgb[(xx+yy+2)%3] : oldColor, 
				    lineColor, 
				    svg);
	    }
	}
    }
    /* 
       Third option: old colors desaturated:
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -50 200 100');
	buttons[2].appendChild(svg);
	for(var yy = -1; yy <= 1; yy++) {
	    for(var xx = -1; xx <= 1; xx++) {
		this.createSvgBlock(xx*LDR.Options.svgBlockWidth, 
				    yy*LDR.Options.svgBlockHeight, 
				    yy === -1,
				    (yy === -1 ? rgb : desat)[(xx+yy+2)%3],
				    lineColor, 
				    svg);
	    }
	}
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
    var red = function(){return '#FF0000';};
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

/*
Choose the colors of lines, lines for black parts and colors for old parts.
*/
LDR.Options.prototype.appendColorOptions = function(optionsBlock) {
    var group = this.addOptionsGroup(optionsBlock, 3, "Colors");
    var options = this;

    // Color functions:
    var red = function(){return '#FF0000';};
    var green = function(){return '#00FF00';};
    var blue = function(){return '#0000FF';};
    var black = function(){return '#000000';};    
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

LDR.Options.prototype.appendAnimationOptions = function(optionsBlock) {
    var group = this.addOptionsGroup(optionsBlock, 2, "Animations");
    var options = this;
    var onAnimationChange = function(idx) {
	options.showStepRotationAnimations = idx;
	options.onChange();
    };
    var buttons = this.createButtons(group, 2, this.showStepRotationAnimations, onAnimationChange);
    var red = function(){return '#FF0000';};
    var lineColor = function(options){
	return LDR.Colors.int2Hex(options.lineColor);
    };
    var w = 20;	
    
    /* 
       Option 1: on
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
	a.setAttribute('id', 'turner');
	a.setAttribute('attributeName', 'transform');
	a.setAttribute('attributeType', 'XML');
	a.setAttribute('type', 'rotate');
	a.setAttribute('from', '0 50 0');
	a.setAttribute('to', '90 50 0');
	a.setAttribute('dur', '1s');
	a.setAttribute('fill', 'freeze');
	a.setAttribute('begin', '1s;turner.end+2s');

	g2.appendChild(a);
    }
    /* 
       Option 2: off
    */
    {
	// Left box
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -35 200 70');
	buttons[1].appendChild(svg);
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

LDR.Options.prototype.appendFFFROptions = function(optionsBlock) {
    var group = this.addOptionsGroup(optionsBlock, 2, "Skip Sub Model Buttons");
    var options = this;
    var onFFFRChange = function(idx) {
	options.showFFFRButtons = idx;
	options.onChange();
	ldrButtons.ffButton.style.display = ldrButtons.frButton.style.display = (idx === 0) ? 'none' : 'inline-block';
    };
    var buttons = this.createButtons(group, 2, this.showFFFRButtons, onFFFRChange);
    
    /* 
       Option 1: Off
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-150 -50 300 100');
	svg.setAttribute('class', 'ui_toggles');
	svg.appendChild(LDR.SVG.makeOffIcon(0, 0, 80));
	buttons[0].appendChild(svg);
    }
    /* 
       Option 2: On
    */
    {
	var svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '0 0 300 100');
	svg.setAttribute('class', 'ui_toggles');
	svg.appendChild(LDR.SVG.makeFR(0));
	svg.appendChild(LDR.SVG.makeFF(200));
	buttons[1].appendChild(svg);
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

	ldrButtons.cameraButtons.style.display = (idx === 2) ? 'none' : 'block';
	if(idx === 1) {
	    ldrButtons.zoomInButtonLarge.style.display = 'block';
	    ldrButtons.zoomInButton.style.display = 'none';
	    ldrButtons.zoomOutButtonLarge.style.display = 'block';
	    ldrButtons.zoomOutButton.style.display = 'none';
	}
	else if(idx === 0) {
	    ldrButtons.zoomInButtonLarge.style.display = 'none';
	    ldrButtons.zoomInButton.style.display = 'block';
	    ldrButtons.zoomOutButtonLarge.style.display = 'none';
	    ldrButtons.zoomOutButton.style.display = 'block';
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

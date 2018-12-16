'use strict';

var LDR = LDR || {};
LDR.ICON_SIZE = 200;

/*
  The LDRSubPartBulder is used for displaying a part and all of its sub parts, 
  primitives, and comment lines.
*/
LDR.SubPartBulder = function(table, linkPrefix, ldrLoader, colorID, position, rotation, scene, subjectSize) {
    var self = this;
    this.c = colorID;
    this.p = position;
    this.r = rotation;
    this.scene = scene;
    this.partType = ldrLoader.ldrPartTypes[ldrLoader.mainModel];

    this.camera = new THREE.OrthographicCamera(-subjectSize, subjectSize, subjectSize, -subjectSize, 0.1, 1000000);
    this.camera.position.set(10*subjectSize, 7*subjectSize, 10*subjectSize);
    this.camera.lookAt(new THREE.Vector3());
    this.camera.updateProjectionMatrix();   
    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(LDR.ICON_SIZE, LDR.ICON_SIZE);    
    this.render = function() {
        self.renderer.render(self.scene, self.camera);
    }

    var p0 = new THREE.Vector3();
    var m0 = new THREE.Matrix3(); m0.set(1, 0, 0, 0, 1, 0, 0, 0, 1);

    // Add self to table:
    var tr = LDR.makeEle(table, 'tr');
    LDR.makeEle(tr, 'td', 'line_type').innerHTML = ldrLoader.mainModel;
    LDR.makeEle(tr, 'td', 'line_desc').innerHTML = LDR.writePrettyPointsPR(p0, m0);
    LDR.makeEle(tr, 'td', 'line_cull').innerHTML = "&#x271" + (this.partType.certifiedBFC ? '4' : '6') + ";";;
    var CCW = this.partType.CCW;
    LDR.makeEle(tr, 'td', 'line_wind').innerHTML = "&#x21B" + (CCW ? 'A' : 'B') + ";";
    LDR.makeEle(tr, 'td', 'line_color').innerHTML = colorID;
    this.imageHolder = LDR.makeEle(tr, 'td', 'line_image');

    // Handle all lines:
    var transformColor = function(subColorID) {
	if(subColorID == 16)
	    return colorID; // Main color
	if(subColorID == 24)
	    return 10000 + colorID; // Edge color
	return subColorID;
    }
    var transformPoint = function(p) {
	var ret = new THREE.Vector3(p.x, p.y, p.z);
	ret.applyMatrix3(rotation);
	ret.add(position);
	return ret;
    }

    for(var i = 0; i < this.partType.lines.length; i++) {
	var line = this.partType.lines[i];
	line.idx = i;
	
	tr = LDR.makeEle(table, 'tr');
	if(line.line0) { // Comment line - just display.
	    LDR.makeEle(tr, 'td', 'line_type').innerHTML = 'Comment';
	    var content = LDR.makeEle(tr, 'td', 'line_desc');
	    content.innerHTML = line.txt;
	    content.setAttribute('colspan', '5');
	}
	else {
	    line.mc = new THREE.LDRMeshCollector();
	    var c = transformColor(line.line1 ? line.desc.colorID : line.c);
	    var p1 = undefined, p2 = undefined, p3 = undefined, p4 = undefined;

	    if(line.line1) {
		var subModel = ldrLoader.ldrPartTypes[line.desc.ID];
		if(subModel == undefined) {
		    throw {
			name: "UnloadedSubmodelException",
			level: "Severe",
			message: "Unloaded sub model: " + line.desc.ID,
			htmlMessage: "Unloaded sub model: " + line.desc.ID,
			toString:    function(){return "Unloaded sub model: " + line.desc.ID;} 
		    }; 
		}

		var typeEle = LDR.makeEle(tr, 'td', 'line_type');
		var a = document.createElement('a');
		var url = linkPrefix;
		if(subModel.inlined && !isNaN(subModel.inlined)) {
		    url += "part.php?user_id=" + subModel.inlined + "&id=";
		}
		a.setAttribute('href', url + subModel.ID);
		a.innerHTML = line.desc.ID;
		typeEle.appendChild(a);

		LDR.makeEle(tr, 'td', 'line_desc').innerHTML = LDR.writePrettyPointsPR(line.desc.position, line.desc.rotation);
		LDR.makeEle(tr, 'td', 'line_cull').innerHTML = "&#x271" + (line.desc.cull ? '4' : '6') + ";";
		LDR.makeEle(tr, 'td', 'line_wind').innerHTML = "&#x21B" + (!line.desc.invertCCW ? 'A' : 'B') + ";";
		LDR.makeEle(tr, 'td', 'line_color').innerHTML = line.desc.colorID;

		var nextPosition = transformPoint(line.desc.position);
		var nextRotation = new THREE.Matrix3();
		nextRotation.multiplyMatrices(rotation, line.desc.rotation);

		subModel.generateThreePart(ldrLoader, c, nextPosition, nextRotation, line.desc.cull, line.desc.invertCCW, line.mc, false);
	    }
	    else if(line.line2) {
		LDR.makeEle(tr, 'td', 'line_type').innerHTML = 'Line';
		LDR.writePrettyPoints(LDR.makeEle(tr, 'td', 'line_desc'), [line.p1, line.p2]);
		LDR.makeEle(tr, 'td', 'line_cull').innerHTML = '-';	    
		LDR.makeEle(tr, 'td', 'line_wind').innerHTML = '-';	    
		LDR.makeEle(tr, 'td', 'line_color').innerHTML = line.c;

		p1 = transformPoint(line.p1);
		p2 = transformPoint(line.p2);
		line.mc.addLine(c, p1, p2);
	    }
	    else if(line.line3) {
		LDR.makeEle(tr, 'td', 'line_type').innerHTML = 'Triangle';
		LDR.writePrettyPoints(LDR.makeEle(tr, 'td', 'line_desc'), [line.p1, line.p2, line.p3]);
		LDR.makeEle(tr, 'td', 'line_cull').innerHTML = "&#x271" + (line.cull ? '4' : '6') + ";";;
		LDR.makeEle(tr, 'td', 'line_wind').innerHTML = "&#x21B" + (line.ccw ? 'A' : 'B') + ";";
		LDR.makeEle(tr, 'td', 'line_color').innerHTML = line.c;

		p1 = transformPoint(line.p1);
		p2 = transformPoint(line.p2);
		p3 = transformPoint(line.p3);
		line.mc.addTriangles(c, p1, p2, p3, !line.ccw, line.cull);
	    }
	    else if(line.line4) {
		LDR.makeEle(tr, 'td', 'line_type').innerHTML = 'Quad';
		LDR.writePrettyPoints(LDR.makeEle(tr, 'td', 'line_desc'), [line.p1, line.p2, line.p3, line.p4]);
		LDR.makeEle(tr, 'td', 'line_cull').innerHTML = "&#x271" + (line.cull ? '4' : '6') + ";";;
		LDR.makeEle(tr, 'td', 'line_wind').innerHTML = "&#x21B" + (line.ccw ? 'A' : 'B') + ";";
		LDR.makeEle(tr, 'td', 'line_color').innerHTML = line.c;

		p1 = transformPoint(line.p1);
		p2 = transformPoint(line.p2);
		p3 = transformPoint(line.p3);
		p4 = transformPoint(line.p4);
		line.mc.addQuads(c, p1, p2, p3, p4, !line.ccw, line.cull);
	    }
	    else if(line.line5) {
		LDR.makeEle(tr, 'td', 'line_type').innerHTML = 'Optional';
		LDR.writePrettyPoints(LDR.makeEle(tr, 'td', 'line_desc'), [line.p1, line.p2, line.p3, line.p4]);
		LDR.makeEle(tr, 'td', 'line_cull').innerHTML = '-';	    
		LDR.makeEle(tr, 'td', 'line_wind').innerHTML = '-';	    
		LDR.makeEle(tr, 'td', 'line_color').innerHTML = line.c;

		p1 = transformPoint(line.p1);
		p2 = transformPoint(line.p2);
		p3 = transformPoint(line.p3);
		p4 = transformPoint(line.p4);
		line.mc.addConditionalLine(c, p1, p2, p3, p4);
	    }

	    line.imageHolder = LDR.makeEle(tr, 'td', 'line_image');
	    line.mc.bakeVertices();
	}

	if(p1) {
	    // Add line points to cloud:
	    var pts = [p1.x, p1.y, p1.z, p2.x, p2.y, p2.z];
	    var c1 = new THREE.Color(LDR.writePrettyPointColors[0]);
	    var c2 = new THREE.Color(LDR.writePrettyPointColors[1]);
	    var colors = [c1.r, c1.g, c1.b, c2.r, c2.g, c2.b];

	    if(p3) {
		pts.push(p3.x, p3.y, p3.z);
		var c3 = new THREE.Color(LDR.writePrettyPointColors[2]);
		colors.push(c3.r, c3.g, c3.b);
	    }
	    if(p4) {
		pts.push(p4.x, p4.y, p4.z);
		var c4 = new THREE.Color(LDR.writePrettyPointColors[3]);
		colors.push(c4.r, c4.g, c4.b);
	    }

	    var vertexAttribute = new THREE.Float32BufferAttribute(pts, 3);	
	    var colorAttribute = new THREE.Float32BufferAttribute(colors, 3);

	    var pointGeometry = new THREE.BufferGeometry();
	    pointGeometry.addAttribute('color', colorAttribute);
	    pointGeometry.addAttribute('position', vertexAttribute);

	    var pointMaterial = new THREE.PointsMaterial({size: 3.5, vertexColors: THREE.VertexColors});

            line.markers = new THREE.Points(pointGeometry, pointMaterial);
	    line.markers.visible = false;
	}
    }
}

LDR.writePrettyPointColors = ['#FFA500', '#00CC00', '#4444FF', '#A500FF'];

LDR.writePrettyPoints = function(ele, pts) {
    var ul = LDR.makeEle(ele, 'ul', 'pretty_points');
    for(var i = 0; i < pts.length; i++) {
	var li = LDR.makeEle(ul, 'li');
	li.style.color = LDR.writePrettyPointColors[i];

	var span = LDR.makeEle(li, 'span', 'pretty_points');
	var x = +parseFloat(pts[i].x).toFixed(3);
	var y = +parseFloat(pts[i].y).toFixed(3);
	var z = +parseFloat(pts[i].z).toFixed(3);
	span.innerHTML = x + ' ' + y + ' ' + z;
    }
}

LDR.writePrettyPointsPR = function(p, r) {
    var x = +parseFloat(p.x).toFixed(3);
    var y = +parseFloat(p.y).toFixed(3);
    var z = +parseFloat(p.z).toFixed(3);
    var ret = x + ' ' + y + ' ' + z;

    for(var i = 0; i < r.elements.length; i++) {
	var e = +parseFloat(r.elements[i]).toFixed(3);
	ret += ' ' + e;
    }
    return ret;
}

LDR.makeEle = function(parent, type, cls) {
    var ret = document.createElement(type);
    parent.appendChild(ret);
    if(cls)
	ret.setAttribute('class', cls);
    return ret;
}

LDR.buildThumbnail = function(ele) {
    // Add thumbnail:
    var iconSceneHolder = document.createElement('span');
    iconSceneHolder.setAttribute('class', 'iconScene');
    ele.appendChild(iconSceneHolder);

    var canvas = document.createElement('canvas');
    var w = LDR.ICON_SIZE, h = LDR.ICON_SIZE;
    canvas.width = w*window.devicePixelRatio;
    canvas.height = h*window.devicePixelRatio;
    canvas.style.width = w+'px';
    canvas.style.height = h+'px';
    iconSceneHolder.appendChild(canvas);
    return canvas;
}

LDR.SubPartBulder.prototype.setVisible = function(v) {
    for(var i = 0; i < this.partType.lines.length; i++) {
	var line = this.partType.lines[i];
	if(line.line0)
	    continue;
	line.mc.setVisible(v);
	if(line.markers)
	    line.markers.visible = v;
    }
}

LDR.SubPartBulder.prototype.buildIcons = function(baseMC, baseObject, redPoints, onIconClick) {
    // Add icon for self:
    this.canvas = LDR.buildThumbnail(this.imageHolder);
    var self = this;
    this.canvas.addEventListener('click', function(){
	self.setVisible(false);
	baseMC.setVisible(true);
	redPoints.visible = false;
	onIconClick();
    }, false);

    // Icons for lines:
    for(var i = 0; i < this.partType.lines.length; i++) {
	var line = this.partType.lines[i];
	if(line.line0)
	    continue;

	line.canvas = LDR.buildThumbnail(line.imageHolder);
	line.canvas.line = line;
	line.canvas.addEventListener('click', function(){
	    baseMC.setVisible(false);
	    self.setVisible(false);
	    this.line.mc.setVisible(true);
	    redPoints.visible = true;
	    if(this.line.markers)
		this.line.markers.visible = true;
	    onIconClick();
	}, false);

	if(line.markers) {
	    baseObject.add(line.markers);
	    line.markers.updateMatrix();
	}

	line.mc.draw(baseObject, false);
    }
} 

LDR.SubPartBulder.prototype.drawAllIcons = function(baseMC, baseObject, redPoints) {
    // Base icon:
    this.setVisible(false);
    redPoints.visible = false;

    baseMC.setVisible(true);
    baseMC.draw(baseObject, false);
    baseMC.overwriteColor(this.c);
    this.render();
    var context = this.canvas.getContext('2d');
    context.drawImage(this.renderer.domElement, 0, 0);

    // Icons for lines:
    baseMC.setVisible(false);
    redPoints.visible = true;
    for(var i = 0; i < this.partType.lines.length; i++) {
	var line = this.partType.lines[i];
	if(line.line0)
	    continue;

	line.mc.setVisible(true);
	line.mc.draw(baseObject, false);
	line.mc.overwriteColor(this.c);
	if(line.markers)
	    line.markers.visible = true;

	this.render();
	context = line.canvas.getContext('2d');
	context.drawImage(this.renderer.domElement, 0, 0);

	line.mc.setVisible(false);
	if(line.markers)
	    line.markers.visible = false;
    }
    redPoints.visible = false;
    baseMC.setVisible(true);
}

// TODO: PLI!

/*
    // Rotate for pli:
    var pliID = "pli_" + this.partID.slice(0, -4);
    if(LDR.PLI && LDR.PLI[pliID]) {
	var pliInfo = LDR.PLI[pliID];
	var pliName = "pli_" + this.partID;
	if(!ldrLoader.ldrPartTypes[pliName]) {
	    var r = new THREE.Matrix3();
	    r.set(pliInfo[4], pliInfo[5], pliInfo[6],
		  pliInfo[7], pliInfo[8], pliInfo[9],
		  pliInfo[10], pliInfo[11], pliInfo[12]);
	    var dat = new THREE.LDRPartDescription(colorID, 
						   new THREE.Vector3(),
						   r,
						   this.partID,
						   false,
						   false);
	    var step = new THREE.LDRStep();
	    step.addDAT(dat);
	    var pt = new THREE.LDRPartType();
	    pt.ID = pliName;
	    pt.modelDescription = this.partType.modelDescription;
	    pt.author = this.partType.author;
	    pt.license = this.partType.license;
	    pt.steps.push(step);
	    ldrLoader.ldrPartTypes[pliName] = pt;
	    this.partType = pt;
	    console.log("Replaced PLI for " + pliName);
	}
    }
*/
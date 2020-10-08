'use strict';

LDR.ICON_SIZE = 200;

/*
  The LDRSubPartBulder is used for displaying a part and all of its sub parts, 
  primitives, and comment lines.
*/
LDR.SubPartBuilder = function(baseMC, table, redPoints, loader, partType, c, position, rotation, scene, subjectSize, onIconClick, from) {
    if(c === undefined)
	throw "Color undefined!";

    let self = this;
    this.baseMC = baseMC;
    this.table = table;
    this.redPoints = redPoints;
    this.loader = loader;
    this.c = c;
    this.p = position;
    this.r = rotation;
    this.scene = scene;
    this.partType = partType;
    this.linesBuilt = false;
    this.onIconClick = onIconClick;
    this.from = from;

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

    let p0 = new THREE.Vector3();
    let m0 = new THREE.Matrix3(); m0.set(1, 0, 0, 0, 1, 0, 0, 0, 1);

    // Add self to table:
    let tr = LDR.makeEle(table, 'tr');
    LDR.makeEle(tr, 'td', 'line_type').innerHTML = partType.ID;
    LDR.makeEle(tr, 'td', 'line_desc').innerHTML = LDR.writePrettyPointsPR(p0, m0);
    LDR.makeEle(tr, 'td', 'line_cull').innerHTML = "&#x271" + (this.partType.certifiedBFC ? '4' : '6') + ";";;
    let CCW = this.partType.CCW;
    LDR.makeEle(tr, 'td', 'line_wind').innerHTML = "&#x21B" + (CCW ? 'A' : 'B') + ";";
    LDR.makeEle(tr, 'td', 'line_color').innerHTML = c;
    this.imageHolder = LDR.makeEle(tr, 'td', 'line_image');

    // Add icon for self:
    this.canvas = LDR.buildThumbnail(this.imageHolder);
    this.canvas.addEventListener('click', function(){
	self.setFileLineVisibility(false);
	self.baseMC.setVisible(true);
	self.redPoints.visible = false;
	self.onIconClick();
    }, false);
}

LDR.writePrettyPointColors = ['#FFA500', '#00CC00', '#4444FF', '#A500FF'];

LDR.writePrettyPoints = function(ele, pts) {
    let ul = LDR.makeEle(ele, 'ul', 'pretty_points');
    for(let i = 0; i < pts.length; i++) {
	let li = LDR.makeEle(ul, 'li');
	li.style.color = LDR.writePrettyPointColors[i];

	let span = LDR.makeEle(li, 'span', 'pretty_points');
	let x = pts[i].x;
	let y = pts[i].y;
	let z = pts[i].z;
	span.innerHTML = x + ' ' + y + ' ' + z;
    }
}

LDR.writePrettyPointsPR = function(p, r) {
    let ret = p.x + ' ' + p.y + ' ' + p.z;
    r.elements.forEach(e => ret += ' ' + e);
    return ret;
}

LDR.makeEle = function(parent, type, cls) {
    let ret = document.createElement(type);
    parent.appendChild(ret);
    if(cls) {
	ret.setAttribute('class', cls);
    }
    return ret;
}

LDR.buildThumbnail = function(ele) {
    // Add thumbnail:
    let iconSceneHolder = document.createElement('span');
    iconSceneHolder.setAttribute('class', 'iconScene');
    ele.appendChild(iconSceneHolder);

    let canvas = document.createElement('canvas');
    let w = LDR.ICON_SIZE, h = LDR.ICON_SIZE;
    canvas.width = w*window.devicePixelRatio;
    canvas.height = h*window.devicePixelRatio;
    canvas.style.width = w+'px';
    canvas.style.height = h+'px';
    iconSceneHolder.appendChild(canvas);
    return canvas;
}

THREE.LDRPartType.prototype.removePrimitivesAndSubParts = () => {}; // Ensure primitives are not deleted.

LDR.SubPartBuilder.prototype.setFileLineVisibility = function(v) {
    if(!this.linesBuilt) {
	return;
    }
    function handle(line) {
	line.mc.setVisible(v);
	if(line.markers) {
	    line.markers.visible = v;
	}
    }
    let step = this.partType.steps[0];
    step.subModels.forEach(handle);
    step.lines.forEach(handle);
    step.triangles.forEach(handle);
    step.quads.forEach(handle);
    step.conditionalLines.forEach(handle);
}

LDR.SubPartBuilder.prototype.buildIcons = function(baseObject, linkPrefix) {
    let self = this;
    // Handle all lines:
    let transformColor = function(subColorID) {
	if(subColorID === 16) {
	    return self.c; // Main color
	}
	if(subColorID === 24) {
	    if(self.c === 16) {
		return 24;
	    }
	    else {
		return -self.c-1; // Edge color
	    }
	}
	return subColorID;
    }
    let transformPoint = function(p) {
	let ret = new THREE.Vector3(p.x, p.y, p.z);
	ret.applyMatrix3(self.r);
	ret.add(self.p);
	return ret;
    }

    let i = 0;
    function handleLine(line, type) {
	let p1, p2, p3, p4;
	
	let tr = LDR.makeEle(self.table, 'tr');
	if(type === 0) { // Comment line - just display.
	    LDR.makeEle(tr, 'td', 'line_type').innerHTML = 'Comment';
	    let content = LDR.makeEle(tr, 'td', 'line_desc');
	    content.innerHTML = line.txt;
	    content.setAttribute('colspan', '5');
	}
	else {
	    line.mc = new LDR.MeshCollector(baseObject, baseObject, baseObject);
	    let c = transformColor(line.c);

	    let color = LDR.Colors[c];
	    let shownColor = color.direct ? color.direct : c;
	    let step = new THREE.LDRStep(); // Not used by line1.

	    if(type === 1) {
                let pt = self.loader.getPartType(line.ID);
		if(!pt) {
		    throw {
			name: "UnloadedPartTypeException",
			level: "Severe",
			message: "Unloaded part type: " + line.ID,
			htmlMessage: "Unloaded part type: " + line.ID,
			toString: function(){return "Unloaded part type: " + line.ID;} 
		    };
		}

		let typeEle = LDR.makeEle(tr, 'td', 'line_type');
		let a = document.createElement('a');
		let url = linkPrefix;
		if(pt.inlined && !isNaN(pt.inlined)) {
		    url += "part.php?user_id=" + pt.inlined + "&id=";
		}
		else if(pt.inlined === undefined) {
		    url += "part.php?from=" + self.from + "&id=";
		}
		a.setAttribute('href', url + pt.ID);
		a.innerHTML = line.ID;
		typeEle.appendChild(a);

		LDR.makeEle(tr, 'td', 'line_desc').innerHTML = LDR.writePrettyPointsPR(line.p, line.r);
		LDR.makeEle(tr, 'td', 'line_cull').innerHTML = "&#x271" + (line.cull ? '4' : '6') + ";";
		LDR.makeEle(tr, 'td', 'line_wind').innerHTML = "&#x21B" + (!line.invertCCW ? 'A' : 'B') + ";";
		LDR.makeEle(tr, 'td', 'line_color').innerHTML = line.c;

                // Hack in a new part type for the sub model:
                let identityRotation = new THREE.Matrix3();
                identityRotation.set(1, 0, 0,
                                     0, 1, 0,
                                     0, 0, 1);
                let pd = new THREE.LDRPartDescription(40, new THREE.Vector3(), identityRotation, pt.ID, true, false);
                let g = new LDR.LDRGeometry();
                g.fromPartDescription(self.loader, line);

                step.addSubModel(pd);
                pt = new THREE.LDRPartType();
                pt.ID = 'HIGHLIGHT_PART_' + i++;
                pt.addStep(step);
                pt.geometry = g;
		pt.generateThreePart(self.loader, 40, self.p, self.r, true, false, line.mc, pd);
	    }
	    else if(type === 2) {
		LDR.makeEle(tr, 'td', 'line_type').innerHTML = 'Line';
		LDR.writePrettyPoints(LDR.makeEle(tr, 'td', 'line_desc'), [line.p1, line.p2]);
		LDR.makeEle(tr, 'td', 'line_cull').innerHTML = '-';	    
		LDR.makeEle(tr, 'td', 'line_wind').innerHTML = '-';	    
		LDR.makeEle(tr, 'td', 'line_color').innerHTML = shownColor;

		p1 = transformPoint(line.p1);
		p2 = transformPoint(line.p2);		
		step.addLine(c, p1, p2);
	    }
	    else if(type === 3) {
		LDR.makeEle(tr, 'td', 'line_type').innerHTML = 'Triangle';
		LDR.writePrettyPoints(LDR.makeEle(tr, 'td', 'line_desc'), [line.p1, line.p2, line.p3]);
		LDR.makeEle(tr, 'td', 'line_cull').innerHTML = "&#x271" + (line.cull ? '4' : '6') + ";";;
		LDR.makeEle(tr, 'td', 'line_wind').innerHTML = '-';
		LDR.makeEle(tr, 'td', 'line_color').innerHTML = shownColor;

		p1 = transformPoint(line.p1);
		p2 = transformPoint(line.p2);
		p3 = transformPoint(line.p3);
		step.addTriangle(c, p1, p2, p3, true, false);
	    }
	    else if(type === 4) {
		LDR.makeEle(tr, 'td', 'line_type').innerHTML = 'Quad';
		LDR.writePrettyPoints(LDR.makeEle(tr, 'td', 'line_desc'), [line.p1, line.p2, line.p3, line.p4]);
		LDR.makeEle(tr, 'td', 'line_cull').innerHTML = "&#x271" + (line.cull ? '4' : '6') + ";";;
		LDR.makeEle(tr, 'td', 'line_wind').innerHTML = '-';
		LDR.makeEle(tr, 'td', 'line_color').innerHTML = shownColor;

		p1 = transformPoint(line.p1);
		p2 = transformPoint(line.p2);
		p3 = transformPoint(line.p3);
		p4 = transformPoint(line.p4);
		step.addQuad(c, p1, p2, p3, p4, true, false);
	    }
	    else if(type === 5) {
		LDR.makeEle(tr, 'td', 'line_type').innerHTML = 'Optional';
		LDR.writePrettyPoints(LDR.makeEle(tr, 'td', 'line_desc'), [line.p1, line.p2, line.p3, line.p4]);
		LDR.makeEle(tr, 'td', 'line_cull').innerHTML = '-';	    
		LDR.makeEle(tr, 'td', 'line_wind').innerHTML = '-';	    
		LDR.makeEle(tr, 'td', 'line_color').innerHTML = shownColor;

		p1 = transformPoint(line.p1);
		p2 = transformPoint(line.p2);
		p3 = transformPoint(line.p3);
		p4 = transformPoint(line.p4);
		step.addConditionalLine(c, p1, p2, p3, p4);
	    }

	    if(type !== 1) { // TODO: Why is this necessary?
                let pt = new THREE.LDRPartType();
                pt.ID = 'Shadow part for step';
		pt.addStep(step);
		pt.ensureGeometry(self.loader);
		pt.generateThreePart(self.loader, c, new THREE.Vector3(), new THREE.Matrix3(), line.cull, true, line.mc);
	    }

	    line.imageHolder = LDR.makeEle(tr, 'td', 'line_image');
	}
	if(p1) {
	    // Add line points to cloud:
	    let pts = [p1.x, p1.y, p1.z, p2.x, p2.y, p2.z];
	    let c1 = new THREE.Color(LDR.writePrettyPointColors[0]);
	    let c2 = new THREE.Color(LDR.writePrettyPointColors[1]);
	    let colors = [c1.r, c1.g, c1.b, c2.r, c2.g, c2.b];

	    if(p3) {
		pts.push(p3.x, p3.y, p3.z);
		let c3 = new THREE.Color(LDR.writePrettyPointColors[2]);
		colors.push(c3.r, c3.g, c3.b);
	    }
	    if(p4) {
		pts.push(p4.x, p4.y, p4.z);
		let c4 = new THREE.Color(LDR.writePrettyPointColors[3]);
		colors.push(c4.r, c4.g, c4.b);
	    }

	    let vertexAttribute = new THREE.Float32BufferAttribute(pts, 3);	
	    let colorAttribute = new THREE.Float32BufferAttribute(colors, 3);

	    let pointGeometry = new THREE.BufferGeometry();
	    pointGeometry.setAttribute('color', colorAttribute);
	    pointGeometry.setAttribute('position', vertexAttribute);

	    let pointMaterial = new THREE.PointsMaterial({size: 3.5, vertexColors: THREE.VertexColors});

            line.markers = new THREE.Points(pointGeometry, pointMaterial);
	    line.markers.visible = false;
	} // if(p1)
    } // function handleLine

    let step = this.partType.steps[0];
    step.subModels.forEach(sm => {
            sm.commentLines.forEach(line => handleLine(line, 0));
            handleLine(sm, 1);
        });
    step.lines.forEach(x => handleLine(x, 2));
    step.triangles.forEach(x => handleLine(x, 3));
    step.quads.forEach(x => handleLine(x, 4));
    step.conditionalLines.forEach(x => handleLine(x, 5));
                                                                                
    // Icons for lines:
    function handle(line) {
	line.canvas = LDR.buildThumbnail(line.imageHolder);
	line.canvas.line = line;
	line.canvas.addEventListener('click', function() {
            // Show only this file line and its markers:
	    self.baseMC.setVisible(false);
	    self.setFileLineVisibility(false);
	    this.line.mc.setVisible(true);
	    self.redPoints.visible = true;
	    if(this.line.markers) {
		this.line.markers.visible = true;
	    }
	    self.onIconClick();
	}, false);

	if(line.markers) {
	    baseObject.add(line.markers);
	    line.markers.updateMatrix();
	}
    }
    step.subModels.forEach(handle);
    step.lines.forEach(handle);
    step.triangles.forEach(handle);
    step.quads.forEach(handle);
    step.conditionalLines.forEach(handle);

    this.linesBuilt = true;
} 

LDR.SubPartBuilder.prototype.drawAllIcons = function() {
    let self = this;

    // Base icon:
    this.setFileLineVisibility(false);
    this.redPoints.visible = false;

    this.baseMC.setVisible(true);
    this.baseMC.overwriteColor(this.c);
    this.baseMC.draw(false);
    this.render();
    let context = this.canvas.getContext('2d');
    context.drawImage(this.renderer.domElement, 0, 0);

    if(!this.linesBuilt) {
	return;
    }

    // Icons for lines:
    this.baseMC.setVisible(false);
    this.redPoints.visible = true;
    function handle(line) {
	line.mc.setVisible(true);
	line.mc.overwriteColor(self.c);
	line.mc.draw(false);
	if(line.markers) {
	    line.markers.visible = true;
	}

	self.render();
	context = line.canvas.getContext('2d');
	context.drawImage(self.renderer.domElement, 0, 0);

	line.mc.setVisible(false);
	if(line.markers) {
	    line.markers.visible = false;
	}
    }
    let step = this.partType.steps[0];
    step.subModels.forEach(handle);
    step.lines.forEach(handle);
    step.triangles.forEach(handle);
    step.quads.forEach(handle);
    step.conditionalLines.forEach(handle);

    this.redPoints.visible = false;
    this.baseMC.setVisible(true);
}

// Ensure LDR geometries want to play ball:
LDR.LDRGeometry.prototype.cleanTempData = function() {
    //delete this.vertices; // We need this!
    delete this.lines;
    delete this.conditionalLines;
    delete this.quads;
    delete this.quads2;
    delete this.triangles;
    delete this.triangles2;
}

/*
  Apply matrix r.
  Used for showing vertex positions.
 */
LDR.LDRGeometry.prototype.buildVertexAttribute = function(r) {
    let vertices = [];
    let p = new THREE.Vector3(); // Outside of the loop for performance.
    for(let i = 0; i < this.vertices.length; i++) {
        let v = this.vertices[i];
        p.set(v.x, v.y, v.z);
        p.applyMatrix3(r);
        vertices.push(p.x, p.y, p.z);
    };
    return new THREE.Float32BufferAttribute(vertices, 3);
}

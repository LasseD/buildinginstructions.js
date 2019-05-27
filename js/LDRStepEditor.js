'use strict';

/**
   Operations:
   - Open/Close editor in top bar
    - PLI always shown when editor opened
    - and parts shown individually
   - modify step rotation: ABS,REL, x, y, z --- 2 buttons + 3*3 inputs
   - Remove highlighted parts --- 1 button
   - Color highlighted parts --- 1 button
   - save --- 1 button
   Operations on TODO-list:
   - add step (left and right, move highlighted parts to new step) --- 2 + 2 buttons (with and without parts)
   - remove step (merge left or right) --- 2 buttons
   - Move parts to previous/next step --- 2 buttons
   - inline sub model at current location --- 1 button
   - Group parts into sub model --- 1 button
 */
LDR.StepEditor = function(loader, stepHandler, onChange, modelID) {
    if(!modelID) {
        throw "Missing model ID!";
    }
    this.loader = loader;
    this.stepHandler = stepHandler;
    this.onChange = onChange;
    this.modelID = modelID;
    this.onStepSelectedListeners = [];

    // Current state variables:
    this.part;
    this.stepIndex;
    this.step;

    function showOrHide(options) {
        if(options.showEditor) {
            $("#editor").show();
        }
        else{
            $("#editor").hide();
        }
    }
    ldrOptions.listeners.push(showOrHide);
    showOrHide(ldrOptions);
    
    // Private function to make it easier to create GUI components:
    this.makeEle = function(parent, type, cls, onclick, innerHTML, icon) {
        let ret = document.createElement(type);
        parent.appendChild(ret);

        if(cls) {
            ret.setAttribute('class', cls);
        }

        if(onclick) {
            ret.addEventListener('click', onclick);
        }

        if(icon) {
            ret.append(icon);
        }
        else if(innerHTML) {
            ret.innerHTML = innerHTML;
        }

        return ret;
    }
}

LDR.StepEditor.prototype.updateCurrentStep = function() {
    let [part, stepIndex, step] = this.stepHandler.getCurrentStepInfo();
    this.part = part;
    this.stepIndex = stepIndex;
    this.step = step;
    this.onStepSelectedListeners.forEach(listener => listener());
}

LDR.StepEditor.prototype.toggleEnabled = function() {
    ldrOptions.showEditor = 1-ldrOptions.showEditor;
    ldrOptions.onChange();
}

LDR.StepEditor.prototype.createGuiComponents = function(parentEle) {
    this.createRotationGuiComponents(parentEle);
    //this.createStepGuiComponents(parentEle); // TODO!
    this.createPartGuiComponents(parentEle);

    let self = this;
    
    let saveEle;
    function save() {
        let fileContent = self.loader.toLDR();
        saveEle.innerHTML = 'Saving...';
        $.ajax({
                url: 'ajax/save.htm',
                type: 'POST',
                data: {model: self.modelID, content: fileContent},
                dataType: "text",
                success: function(result) {
                    saveEle.innerHTML = 'SAVE';
                    console.dir(result);
                },
                error: function(xhr, status, error_message) {
                    saveEle.innerHTML = 'ERROR! PRESS TO SAVE AGAIN';
                    console.dir(xhr);
                    console.warn(status);
                    console.warn(error_message);
                }
            });
    }
    let saveParentEle = this.makeEle(parentEle, 'span', 'editor_control');
    saveEle = this.makeEle(saveParentEle, 'button', 'save_button', save, 'SAVE');
    this.updateCurrentStep();
}

LDR.StepEditor.prototype.createRotationGuiComponents = function(parentEle) {
    let self = this, Ele, Normal, Rel, Abs, End, X, Y, Z;
    function propagate(rot) {
        for(let i = self.stepIndex+1; i < self.part.steps.length; i++) {
            let s = self.part.steps[i];
            if(!THREE.LDRStepRotation.equals(self.step.rotation, s.rotation)) {
                console.log('Propagated ' + (i-self.stepIndex) + ' steps');
                break; // Only replace until not the same as the first.
            }
            s.rotation = rot ? rot.clone() : null;
        }
        self.step.rotation = rot; // Update starting step.
        self.onChange();
    }
    function makeNormal() { // Copy previous step rotation, or set to null if first step.
        propagate(self.stepIndex === 0 ? null : self.part.steps[self.stepIndex-1].rotation);
    }
    function makeRel() { 
        let rot = self.step.rotation ? self.step.rotation.clone() : new THREE.LDRStepRotation(0, 0, 0, 'REL');
        rot.type = 'REL';
        propagate(rot);
    }
    function makeAbs() {
        let rot = self.step.rotation ? self.step.rotation.clone() : new THREE.LDRStepRotation(0, 0, 0, 'ABS');
        rot.type = 'ABS';
        propagate(rot);
    }
    function makeEnd() {
        propagate(null);
    }

    function setXYZ(e) {
        e.stopPropagation();
        let rot = self.step.rotation ? self.step.rotation.clone() : new THREE.LDRStepRotation(0, 0, 0, 'REL');
        let x = parseFloat(X.value);
        let y = parseFloat(Y.value);
        let z = parseFloat(Z.value);
        if(isNaN(x) || isNaN(y) || isNaN(z) || 
           X.value !== ''+x || Y.value !== ''+y || Z.value !== ''+z) {
            return;
        }

        rot.x = x;
        rot.y = y;
        rot.z = z;
        propagate(rot);
    }

    Ele = this.makeEle(parentEle, 'span', 'editor_control');
    function makeRotationRadioButton(value, onClick, icon) {
        let button = self.makeEle(Ele, 'input', 'editor_radio_button', onClick);

        let label = self.makeEle(Ele, 'label', 'editor_radio_label', null, value, icon);
        label.setAttribute('for', value);

        button.setAttribute('type', 'radio');
        button.setAttribute('id', value);
        button.setAttribute('name', 'rot_type');
        return button;
    }
    Rel = makeRotationRadioButton('REL', makeRel, this.makeRelIcon());
    Abs = makeRotationRadioButton('ABS', makeAbs, this.makeAbsIcon());

    function makeXYZ(icon, sub, add, x1, y1, x2, y2) {
        function subOrAdd(fun) {
            let rot = self.step.rotation ? self.step.rotation.clone() : new THREE.LDRStepRotation(0, 0, 0, 'REL');
            fun(rot);
            propagate(rot);
            self.onChange();
        }
        let subEle = self.makeEle(Ele, 'button', 'editor_button', () => subOrAdd(sub), icon+'-', self.makeBoxArrowIcon(x1, y1, x2, y2));
        let ret = self.makeEle(Ele, 'input', 'editor_input', setXYZ);
        let addEle = self.makeEle(Ele, 'button', 'editor_button', () => subOrAdd(add), icon+'+', self.makeBoxArrowIcon(x2, y2, x1, y1));

        ret.addEventListener('keyup', setXYZ);
        ret.addEventListener('keydown', e => e.stopPropagation());
        return ret;
    }
    let rotDiff = 90;
    X = makeXYZ('X', rot => rot.x-=rotDiff, rot => rot.x+=rotDiff, -8, 11, -8, -5);
    Y = makeXYZ('Y', rot => rot.y-=rotDiff, rot => rot.y+=rotDiff, -10, 4, 10, 4);
    Z = makeXYZ('Z', rot => rot.z-=rotDiff, rot => rot.z+=rotDiff, 8, -5, 8, 11);

    function onStepSelected() {
        let rot = self.step.rotation;
        if(!rot) {
            rot = new THREE.LDRStepRotation(0, 0, 0, 'REL');
	    Rel.checked = true;
        }
        else { // There is currently a rotation:
            if(rot.type === 'REL') {
                Rel.checked = true;
            }
            else { // rot.type === 'ABS' as 'ADD' is unsupported.
                Abs.checked = true;
            }
        }

        X.value = rot.x;
        Y.value = rot.y;
        Z.value = rot.z;
    }
    this.onStepSelectedListeners.push(onStepSelected);
}

LDR.StepEditor.prototype.createPartGuiComponents = function(parentEle) {
    let self = this;

    let colorPicker = new LDR.ColorPicker(colorID => {self.stepHandler.colorGhosted(colorID); self.onChange();});

    let ele = this.makeEle(parentEle, 'span', 'editor_control');
    let removeButton = this.makeEle(ele, 'button', 'pli_button1', () => {self.stepHandler.removeGhosted(); self.onChange();}, 'REMOVE', self.makeRemovePartsIcon());
    let colorButton = colorPicker.createButton(colorID => {if(colorID===undefined)return; self.stepHandler.colorGhosted(colorID); self.onChange();});
    ele.append(colorButton);

    function onlyShowButtonsIfPartsAreHighlighted() {
        let anyHighlighted = self.step.subModels.some(pd => pd.ghost);
        let display = anyHighlighted ? 'inline' : 'none';
        removeButton.style.display = display;
        colorButton.style.display = display;
    }
    this.onStepSelectedListeners.push(onlyShowButtonsIfPartsAreHighlighted);
}

/**
   SVG Icons for buttons:
*/
LDR.StepEditor.prototype.makeStepIcon = function() {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-75 -25 150 50');
    LDR.SVG.makeBlock3D(-50, 0, svg);
    LDR.SVG.makeArrow(-20, 0, 20, 0, svg);
    LDR.SVG.makeBlock3D(50, 0, svg);
    return svg;
}
LDR.StepEditor.prototype.makeRelIcon = function() {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-75 -25 150 50');

    // Left box
    LDR.SVG.makeBlock3D(-50, 0, svg);
    
    // Arrow:
    LDR.SVG.appendRotationCircle(0, 0, 18, svg);

    // Right hand side:
    let g = document.createElementNS(LDR.SVG.NS, 'g');
    svg.appendChild(g);
    g.setAttribute('transform', 'rotate(90 0 0) translate(-50 -55)');
    let turned = LDR.SVG.makeBlock3D(50, 0, g);

    return svg;
}
LDR.StepEditor.prototype.makeAbsIcon = function() {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-75 -25 150 50');
    LDR.SVG.makeBlock3D(-50, 0, svg);
    LDR.SVG.appendRotationCircle(0, 0, 18, svg);
    svg.append(LDR.SVG.makeRect(37, -13, 24, 31, true));
    return svg;
}
LDR.StepEditor.prototype.makeEndIcon = function() {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-75 -25 150 50');

    LDR.SVG.makeBlock3D(50, 0, svg);
    LDR.SVG.appendRotationCircle(0, 0, 18, svg);

    let g = document.createElementNS(LDR.SVG.NS, 'g');
    svg.appendChild(g);
    g.setAttribute('transform', 'rotate(90 0 0) translate(50 55)');
    let turned = LDR.SVG.makeBlock3D(-50, 0, g);

    return svg;
}

/*
  Show a box and an arrow from x1,y1 to x2,y2
 */
LDR.StepEditor.prototype.makeBoxArrowIcon = function(x1, y1, x2, y2) {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-20 -20 40 40');
    LDR.SVG.makeBlock3D(0, 0, svg);
    LDR.SVG.makeArrow(x1, y1, x2, y2, svg);
    return svg;
}

/**
  Element editing icons
*/
LDR.StepEditor.prototype.addPLIIcon = function(svg, startX, options) {
    svg.append(LDR.SVG.makeRoundRect(-60+startX, -30, 120, 60, 10));
    for(let x = -1; x <= 1; x+=2) {
        LDR.SVG.makeBlock3D(x*30 + startX, 0, svg);
    }
    if(options.ghost) {
        let highlight = LDR.SVG.makeRect(5, -23, 48, 48);
        highlight.setAttribute('stroke', '#5DD');
        svg.append(highlight);
    }
}

LDR.StepEditor.prototype.makeRemovePartsIcon = function() {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-60 -30 120 60');
    this.addPLIIcon(svg, 0, {ghost:true});
    svg.appendChild(LDR.SVG.makeLine(0, -30, 60, 30, true));
    svg.appendChild(LDR.SVG.makeLine(0, 30, 60, -30, true));
    return svg;
}

//
// Editor operations on StepHandler:
//

LDR.StepHandler.prototype.removeGhosted = function() {
    let stepInfo = this.steps[this.current];
    let step = stepInfo.step;
    let mc = stepInfo.meshCollector;
    if(!step || !mc) {
        console.warn('Not at a step where parts can be removed.');
        return [[], [], []]; // Empty result set
    }
    // Remove ghosted parts from both step and mc:
    let removedPartDescriptions = step.subModels.filter(pd => pd.ghost);
    step.subModels = step.subModels.filter(pd => !pd.ghost); // Update step.
    let [lineObjects, triangleObjects] = mc.removeGhostedParts();
    return [removedPartDescriptions, lineObjects, triangleObjects];
}

LDR.StepHandler.prototype.colorGhosted = function(colorID) {
    let stepInfo = this.steps[this.current];
    let step = stepInfo.step;
    let mc = stepInfo.meshCollector;
    if(!step || !mc) {
        console.warn('Not at a step where parts can be colored.');
        return;
    }

    // Update descriptions:
    step.subModels.filter(pd => pd.ghost).forEach(pd => pd.colorID = colorID);

    // Update materials:
    let [lineObjects, triangleObjects] = mc.getGhostedParts();
    let pts = this.loader.partTypes;
    lineObjects.forEach(obj => obj.mesh.material = mc.getLineMaterial(pts[obj.part.ID].geometry.lineColorManager, colorID, obj.conditional));
    let trans = LDR.Colors.isTrans(colorID);
    triangleObjects.forEach(obj => obj.mesh.material = mc.getTriangleMaterial(pts[obj.part.ID].geometry.triangleColorManager, colorID, trans));
}

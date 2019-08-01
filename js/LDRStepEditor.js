'use strict';

/**
   Operations:
   - Open/Close editor using button shown in top bar
   - modify step rotation: ABS,REL, x, y, z
   - Color highlighted parts
   - add step
   - Remove highlighted parts / remove empty step / merge step left
   - save
   Operations on TODO-list:
   - Move parts to previous/next step, skip sub models --- 2 buttons --- -> and <- icons.
   - Move parts to previous/next step, include sub models, create other steps when necessary --- 2 buttons --- -u-> and <-u- icons.
   - inline parts to sub model above / inline whole step / dissolve sub model --- 1 button --- Arrow up
   - Group parts into sub model --- 1 button --- Arrow down
 */
LDR.StepEditor = function(loader, stepHandler, reset, onChange, modelID) {
    this.loader = loader;
    this.stepHandler = stepHandler;
    this.reset = reset;
    this.onChange = onChange;
    this.modelID = modelID;
    this.onStepSelectedListeners = [];
    this.saveEle;

    // Current state variables:
    this.part;
    this.stepIndex;
    this.step;

    function showOrHide() {
        if(ldrOptions.showEditor) {
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
    let [part, stepIndex, stepInfo] = this.stepHandler.getCurrentStepInfo();
    this.part = part;
    this.stepIndex = stepIndex;
    this.step = stepInfo.step;
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
    function save() {
        let fileContent = self.loader.toLDR();
        self.saveEle.innerHTML = 'Saving...';
        $.ajax({
                url: 'ajax/save.htm',
                type: 'POST',
                data: {model: self.modelID, content: fileContent},
                dataType: "text",
                success: function(result) {
                    self.saveEle.innerHTML = 'SAVE';
		    self.saveEle.style.backgroundColor = '#444';
		    self.saveEle.style.borderColor = '#222';
                    console.dir(result);
                },
                error: function(xhr, status, error_message) {
                    self.saveEle.innerHTML = 'ERROR! PRESS TO SAVE AGAIN';
                    console.dir(xhr);
                    console.warn(status);
                    console.warn(error_message);
                }
            });
    }
    let saveParentEle = this.makeEle(parentEle, 'span', 'editor_save');
    this.saveEle = this.makeEle(saveParentEle, 'button', 'save_button', save, 'SAVE');
    this.updateCurrentStep();
}

LDR.StepEditor.prototype.makeSaveElementGreen = function() {
    this.saveEle.style.backgroundColor = '#4B4';
    this.saveEle.style.borderColor = '#2B2';
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
        self.step.original.rotation = rot; // Update starting step.
	self.stepHandler.updateRotations();
	self.makeSaveElementGreen();
        self.onChange();
    }

    function makeNormal() { // Copy previous step rotation, or set to null if first step.
        propagate(self.stepIndex === 0 ? null : self.part.steps[self.stepIndex-1].original.rotation);
    }

    function makeRel() {
	let step = self.step.original;
        let rot = step.rotation ? step.rotation.clone() : new THREE.LDRStepRotation(0, 0, 0, 'REL');
        rot.type = 'REL';
        propagate(rot);
    }

    function makeAbs() {
	let step = self.step.original;
        let rot = step.rotation ? step.rotation.clone() : new THREE.LDRStepRotation(0, 0, 0, 'ABS');
        rot.type = 'ABS';
        propagate(rot);
    }

    function makeEnd() {
        propagate(null);
    }

    function setXYZ(e) {
        e.stopPropagation();
	let step = self.step.original;
        let rot = step.rotation ? step.rotation.clone() : new THREE.LDRStepRotation(0, 0, 0, 'REL');
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
	    let step = self.step.original;
            let rot = step.rotation ? step.rotation.clone() : new THREE.LDRStepRotation(0, 0, 0, 'REL');
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
        let rot = self.step.original.rotation;
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
    let ele = this.makeEle(parentEle, 'span', 'editor_control');
    function update(actualChange) {
	self.reset();
	actualChange();
	self.onChange();
	self.makeSaveElementGreen();
    }

    // Color:
    let colorPicker = new LDR.ColorPicker(c => update(() => self.stepHandler.colorGhosted(c)));
    let colorButton = colorPicker.createButton();
    ele.append(colorButton);

    // Add step:
    let addButton = this.makeEle(ele, 'button', 'pli_button', 
                                 () => update(() => self.stepHandler.addStep()),
                                 '+', self.makeAddIcon());

    // Remove:
    let removeButton = this.makeEle(ele, 'button', 'pli_button', 
                                    () => update(() => self.stepHandler.remove()),
                                    'X', self.makeRemoveIcon());

    function showAndHideButtons() {
        let anyHighlighted = self.step.subModels.some(pd => pd.original.ghost);
        let notLast = self.part.steps.length > 1;

        let display = show => show ? 'inline' : 'none';

        colorButton.style.display = display(anyHighlighted);
        removeButton.style.display = display(anyHighlighted || notLast);
        addButton.style.display = display(true); // You can always add a step.
    }
    this.onStepSelectedListeners.push(showAndHideButtons);
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
  Step editing icons
*/
LDR.StepEditor.prototype.makeRemoveIcon = function() {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-25 -25 50 50');
    LDR.SVG.makeCross(svg, 0, 0, 20);
    return svg;
}
LDR.StepEditor.prototype.makeAddIcon = function() {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-25 -25 50 50');
    LDR.SVG.makePlus(svg, 0, 0, 25);
    return svg;
}

//
// Editor operations on StepHandler:
//

LDR.StepHandler.prototype.colorGhosted = function(colorID) {
    let [part, current, stepInfo] = this.getCurrentStepInfo();
    let step = stepInfo.step;
    if(!step) {
        console.warn('Not at a step where parts can be colored.');
        return;
    }

    // Remove ghosted parts from both step and mc:
    let stepIndex = this.getCurrentStepIndex();
    step.original.subModels.forEach(pd => {if(pd.ghost){pd.colorID = colorID};});

    this.rebuild();
    this.moveSteps(stepIndex, () => {});
}

LDR.StepHandler.prototype.addStep = function() {
    let [part, current, stepInfo] = this.getCurrentStepInfo();
    let step = stepInfo.step;
    if(!step) {
        console.warn('Not at a valid step!');
        return;
    }

    // Update sub models in step:
    let stepIndex = this.getCurrentStepIndex(); // To move back to once the model has been rebuilt.
    let originalStep = step.original;

    let newStep = new THREE.LDRStep();
    if(originalStep.rotation) {
        newStep.rotation = originalStep.rotation.clone();
    }
    part.steps.splice(current+1, 0, newStep);
    console.dir(this);
    stepIndex += this.countUsages(part.ID)+1; // Move to new step.

    this.rebuild();
    this.moveSteps(stepIndex, () => {});
}

LDR.StepHandler.prototype.remove = function() {
    let [part, current, stepInfo] = this.getCurrentStepInfo();
    let step = stepInfo.step;
    if(!step) {
        console.warn('Not at a step where parts can be removed.');
        return;
    }

    // Update sub models in step:
    let stepIndex = this.getCurrentStepIndex(); // To move back to once the model has been rebuilt.
    let originalStep = step.original;
    let originalSubModels = originalStep.subModels;

    if(originalStep.isEmpty()) { // Remove empty step:
        part.steps.splice(current, 1);
        stepIndex -= this.countUsages(part.ID);
    }
    else if(originalSubModels.some(pd => pd.ghost)) { // Remove ghosted parts:
        originalStep.subModels = originalSubModels.filter(pd => !pd.ghost);
        if(part.steps[0].isEmpty()) { // Remove empty first step:
            if(part.steps.length === 1) {
                let mainModel = this.loader.getMainModel();
                mainModel.purgePart(this.loader, part.ID);
            }
            part.steps = part.steps.slice(1);
            stepIndex -= this.countUsages(part.ID);
        }
        // All OK: Update lines in step:
        originalStep.fileLines = originalStep.fileLines.filter(line => (line.line1 ? !line.desc.ghost : true));
    }
    else if(current > 0) { // Merge step left:
        let prevStep = part.steps[current-1];
        prevStep.subModels.push(...originalStep.subModels);
        part.steps.splice(current, 1);
        stepIndex -= this.countUsages(part.ID)+1;
    }

    this.rebuild();
    this.moveSteps(stepIndex, () => {});
}

LDR.StepHandler.prototype.countUsages = function(ID) {
    let ret = 0;

    for(let i = 0; i < this.current; i++) {
        let subStepHandler = this.steps[i].stepHandler;
        if(subStepHandler) {
            if(subStepHandler.part.ID === ID) {
                console.log('Found instance in'); console.dir(subStepHandler);
                ret += 1;
            }
            else {
                ret += subStepHandler.countUsages(ID);
            }
        }
    }
    return ret;
}

THREE.LDRPartType.prototype.purgePart = function(loader, ID) {
    if(this.isPart()) {
        return;
    }
    function handleStep(step) {
        step.subModels = step.subModels.filter(sm => sm.ID !== ID);
        step.subModels.forEach(sm => loader.getPartType(sm.ID).purgePart(loader, ID));
    }
    this.steps.forEach(handleStep);
}
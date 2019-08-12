'use strict';

/**
   Operations:
   - Open/Close editor using button shown in top bar
   - modify step rotation: ABS,REL, x, y, z
   - Color highlighted parts
   - add step
   - Remove highlighted parts / remove empty step / merge step left
   - Move parts to previous/next step, skip sub models
   - Group parts into sub model
   - inline parts/step to all instances of sub models above
   - Move parts to sub model in previous/next step
   - Split sub models in step to more steps when in placement step
   - Join with sub models in step to the right
   - save
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
    this.nextID = 0;

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
    this.makeEle = function(parent, type, cls, onclick, desc, icon, key) {
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
        if(desc) {
	    if(!icon) {
		ret.innerHTML = desc;
	    }
	    ret.setAttribute('title', desc + ' (Press ' + key + ')');
        }
        return ret;
    }
}

LDR.StepEditor.prototype.handleKeyDown = function(e) {
    let k = e.keyCode;
    switch(k) {
    case 67: // 'C'
	this.toggleRot();
	break;
    case 81: // 'Q'
	this.save();
	break;
    case 88: // 'X'
	this['X' + (e.shiftKey ? '-' : '+')]();
	break;
    case 89: // 'Y'
	this['Y' + (e.shiftKey ? '-' : '+')]();
	break;
    case 90: // 'Z'
	this['Z' + (e.shiftKey ? '-' : '+')]();
	break;
	// TODO: ALL OTHER BUTTONS + NAVIGATE PLI
    default:
	console.log('Unknown ' + k);
	break;
    }
}

LDR.StepEditor.prototype.generateNextID = function() {
    const radix = 36;
    while(this.loader.partTypes.hasOwnProperty(this.nextID.toString(radix) + '.ldr')) {
        this.nextID++;
    }
    return this.nextID.toString(radix) + '.ldr';
}

LDR.StepEditor.prototype.updateCurrentStep = function() {
    let [part, stepIndex, stepInfo] = this.stepHandler.getCurrentStepInfo();
    this.part = part;
    this.stepIndex = stepIndex;
    this.step = stepInfo.step;
    this.subStepHandler = stepInfo.stepHandler;
    this.onStepSelectedListeners.forEach(listener => listener());
}

LDR.StepEditor.prototype.toggleEnabled = function() {
    ldrOptions.showEditor = 1-ldrOptions.showEditor;
    ldrOptions.onChange();
}

LDR.StepEditor.prototype.save = function() {
    let fileContent = this.loader.toLDR();
    let self = this;
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

LDR.StepEditor.prototype.createGuiComponents = function(parentEle) {
    this.createRotationGuiComponents(parentEle);
    this.createPartGuiComponents(parentEle);

    let self = this;
    let saveParentEle = this.makeEle(parentEle, 'span', 'editor_save');
    this.saveEle = this.makeEle(saveParentEle, 'button', 'save_button',
				() => self.save(), 'SAVE', false, 'Q');
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

    this.toggleRot = function() {
	let step = self.step.original;
        let rot = step.rotation ? step.rotation.clone() : new THREE.LDRStepRotation(0, 0, 0, 'REL');
        rot.type = (rot.type === 'REL') ? 'ABS' : 'REL';
        propagate(rot);
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

        let label = self.makeEle(Ele, 'label', 'editor_radio_label', null, 'Set the rotation of the step to type "' + value + '"', icon, 'C');
        label.setAttribute('for', value);

        button.setAttribute('type', 'radio');
        button.setAttribute('id', value);
        button.setAttribute('name', 'rot_type');
        return button;
    }
    Rel = makeRotationRadioButton('REL', makeRel, this.makeRelIcon());
    Abs = makeRotationRadioButton('ABS', makeAbs, this.makeAbsIcon());

    let ROT_DIFF = 90;
    function makeXYZ(icon, sub, add, x1, y1, x2, y2) {
        function subOrAdd(fun) {
	    let step = self.step.original;
            let rot = step.rotation ? step.rotation.clone() : new THREE.LDRStepRotation(0, 0, 0, 'REL');
            fun(rot);
            propagate(rot);
            self.onChange();
        }
	self[icon+'+'] = () => subOrAdd(add);
	self[icon+'-'] = () => subOrAdd(sub);

        let subEle = self.makeEle(Ele, 'button', 'editor_button', () => subOrAdd(sub), 
				  'Reduce ' + icon + ' by ' + ROT_DIFF + ' degrees',
				  self.makeBoxArrowIcon(x1, y1, x2, y2), 'SHIFT ' + icon);
        let ret = self.makeEle(Ele, 'input', 'editor_input', setXYZ);
        let addEle = self.makeEle(Ele, 'button', 'editor_button', () => subOrAdd(add),
				  'Increase ' + icon + ' by ' + ROT_DIFF + ' degrees',
				  self.makeBoxArrowIcon(x2, y2, x1, y1), icon);

        ret.addEventListener('keyup', setXYZ);
        ret.addEventListener('keydown', e => e.stopPropagation());
        return ret;
    }
    X = makeXYZ('X', rot => rot.x-=ROT_DIFF, rot => rot.x+=ROT_DIFF, -8, 11, -8, -5);
    Y = makeXYZ('Y', rot => rot.y-=ROT_DIFF, rot => rot.y+=ROT_DIFF, -10, 4, 10, 4);
    Z = makeXYZ('Z', rot => rot.z-=ROT_DIFF, rot => rot.z+=ROT_DIFF, 8, 11, 8, -5);

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

        let [part, current, stepInfo] = self.stepHandler.getCurrentStepInfo();
        let step = stepInfo.step;
        if(step) {
            let stepIndex = self.stepHandler.getCurrentStepIndex(); // To move back to once the model has been rebuilt.
            let originalStep = step.original;
            let originalSubModels = originalStep.subModels;
            let info = {part:part, current:current, stepInfo:stepInfo, step:step,
                        stepIndex:stepIndex, originalStep:originalStep,
                        originalSubModels:originalSubModels};
            actualChange(info);
            self.stepHandler.rebuild();
            self.stepHandler.moveSteps(info.stepIndex, () => {});
        }
        else {
            console.warn('Not at a valid step!');
        }
	self.onChange();
	self.makeSaveElementGreen();
    }

    // Color:
    let colorPicker = new LDR.ColorPicker(c => update(() => self.stepHandler.colorGhosted(c)));
    let colorButton = colorPicker.createButton();
    ele.append(colorButton);

    // Controls:
    this.makeEle(ele, 'button', 'pli_button',
                 () => update(info => self.stepHandler.movePrev(info, false)),
                 'Move to previous step (skipping sub models) or move full step if nothing is selected', self.makeMovePrevIcon());
    this.makeEle(ele, 'button', 'pli_button',
                 () => update(info => self.stepHandler.movePrev(info, true)),
                 'Move to new previous step', self.makeAddIcon(false));
    let removeButton = this.makeEle(ele, 'button', 'pli_button',
                                    () => update(info => self.stepHandler.remove(info)),
                                    'Delete', self.makeRemoveIcon());
    this.makeEle(ele, 'button', 'pli_button',
                 () => update(info => self.stepHandler.moveNext(info, true)),
                 'Move to new next step', self.makeAddIcon(true));
    this.makeEle(ele, 'button', 'pli_button',
                 () => update(info => self.stepHandler.moveNext(info, false)),
                 'Move to next step (skipping sub models) or move full step if nothing is selected', self.makeMoveNextIcon());
    let moveToNewSubModelButton = this.makeEle(ele, 'button', 'pli_button',
                                               () => update(info => self.stepHandler.moveToNewSubModel(info, self.generateNextID())),
                                               'Move down into a new sub model', self.makeMoveToNewSubModelIcon());
    let moveUpLeftButton = this.makeEle(ele, 'button', 'pli_button',
                                        () => update(info => self.stepHandler.moveUp(info, false)),
                                        'Move up to previous step', self.makeMoveUpSideIcon(false));
    let moveUpRightButton = this.makeEle(ele, 'button', 'pli_button',
                                         () => update(info => self.stepHandler.moveUp(info, true)),
                                         'Move up to next step', self.makeMoveUpSideIcon(true));
    let dissolveSubModelButton = this.makeEle(ele, 'button', 'pli_button',
                                              () => update(info => self.stepHandler.moveUp(info, true)),
                                              'Move up and remove this sub model', self.makeDissolveSubModelIcon());
    let moveDownLeftButton = this.makeEle(ele, 'button', 'pli_button',
                                          () => update(info => self.stepHandler.moveDown(info, false)),
                                          'Move to the sub model in previous step', self.makeMoveDownSideIcon(false));
    let moveDownRightButton = this.makeEle(ele, 'button', 'pli_button',
                                           () => update(info => self.stepHandler.moveDown(info, true)),
                                           'Move to the sub model in next step', self.makeMoveDownSideIcon(true));
    let splitButton = this.makeEle(ele, 'button', 'pli_button',
                                   () => update(info => self.stepHandler.split(info)),
                                   'Split the sub models into separate steps', self.makeSplitIcon());
    let joinButton = this.makeEle(ele, 'button', 'pli_button',
                                  () => update(info => self.stepHandler.joinWithNext(info)),
                                   'Join with the sub model from the next step', self.makeJoinIcon());

    function showAndHideButtons() {
        let anyHighlighted = self.step.subModels.some(pd => pd.original.ghost);
        let allHighlighted = !self.step.subModels.some(pd => !pd.original.ghost);
        let last = self.part.steps.length === 1;
        let empty = self.step.subModels.length === 0;
        let isMainModel = self.part.ID === self.loader.mainModel;
        let isAtFirstStepInSubModel = self.stepIndex === 0;
        let isAtLastStepInSubModel = self.stepIndex === self.part.steps.length-1;
        let isNextASubModel = !isAtLastStepInSubModel && 
            self.part.steps[self.stepIndex+1].containsNonPartSubModels(self.loader) &&
            self.part.steps[self.stepIndex+1].subModels.length === 1;
        let isPrevASubModel = !isAtFirstStepInSubModel &&
            self.part.steps[self.stepIndex-1].containsNonPartSubModels(self.loader) &&
            self.part.steps[self.stepIndex-1].subModels.length === 1;
        let atPlacementStep = self.subStepHandler && self.subStepHandler.isAtPlacementStep();
        let isThisAndNextWithSameSubModels = isNextASubModel && !empty && self.step.containsNonPartSubModels(self.loader) && 
            self.step.subModels[0].ID === self.part.steps[self.stepIndex+1].subModels[0].ID;

        let display = show => show ? 'inline' : 'none';

        colorButton.style.display = display(anyHighlighted);
        removeButton.style.display = display(!(last && (!anyHighlighted || allHighlighted) && isMainModel));
        moveToNewSubModelButton.style.display = display(!empty);
        moveUpLeftButton.style.display = display(!isMainModel && isAtFirstStepInSubModel && !isAtLastStepInSubModel);
        moveUpRightButton.style.display = display(!isMainModel && isAtLastStepInSubModel && !isAtFirstStepInSubModel);
        dissolveSubModelButton.style.display = display(!isMainModel && isAtLastStepInSubModel && isAtFirstStepInSubModel);
        moveDownLeftButton.style.display = display(isPrevASubModel);
        moveDownRightButton.style.display = display(isNextASubModel);
        splitButton.style.display = display(atPlacementStep && self.step.subModels.length > 1);
        joinButton.style.display = display(isThisAndNextWithSameSubModels);
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

LDR.StepEditor.prototype.makeAddIcon = function(right) {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-25 -25 50 50');
    let m = right ? 1 : -1;
    LDR.SVG.makePlus(svg, 17*m, 0, 8);
    LDR.SVG.makeArrow(-25*m, 0, 4*m, 0, svg, true);
    
    return svg;
}

LDR.StepEditor.prototype.makeMoveNextIcon = function() {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-25 -25 50 50');
    LDR.SVG.makeArrow(-25, 0, 25, 0, svg, true);
    return svg;
}

LDR.StepEditor.prototype.makeMovePrevIcon = function() {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-25 -25 50 50');
    LDR.SVG.makeArrow(25, 0, -25, 0, svg, true);
    return svg;
}

LDR.StepEditor.prototype.makeMoveToNewSubModelIcon = function() {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-25 -25 50 50');
    LDR.SVG.makeArrow(0, -25, 0, 25, svg, true);
    return svg;
}

LDR.StepEditor.prototype.makeDissolveSubModelIcon = function() {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-25 -25 50 50');
    LDR.SVG.makeArrow(0, 25, 0, -25, svg, true);
    return svg;
}

LDR.StepEditor.prototype.makeMoveUpSideIcon = function(right) {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-25 -25 50 50');
    LDR.SVG.makeArrow(0, 0, right ? 25 : -25, 0, svg);
    svg.appendChild(LDR.SVG.makeLine(0, 0, 0, 25));
    svg.appendChild(LDR.SVG.makeLine(-10, 25, 10, 25));    
    return svg;
}

LDR.StepEditor.prototype.makeMoveDownSideIcon = function(right) {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-25 -25 50 50');
    LDR.SVG.makeArrow(0, 0, 0, 25, svg);
    let x = right ? -25 : 25;
    svg.appendChild(LDR.SVG.makeLine(0, 0, x, 0));
    svg.appendChild(LDR.SVG.makeLine(x, 10, x, -10));    
    return svg;
}

LDR.StepEditor.prototype.makeSplitIcon = function() {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-25 -25 50 50');
    LDR.SVG.makeArrow(0, 0, -25, 0, svg, true);
    LDR.SVG.makeArrow(0, 0, 25, 0, svg, false);
    return svg;
}

LDR.StepEditor.prototype.makeJoinIcon = function() {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-25 -25 50 50');
    LDR.SVG.makeArrow(-25, 0, 0, 0, svg, true);
    LDR.SVG.makeArrow(25, 0, 0, 0, svg, true);
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

LDR.StepHandler.prototype.remove = function(info) {
    if(info.part.ID === this.loader.mainModel && info.step.length === 1 && 
       (!info.originalSubModels.some(sm => sm.ghost) || 
        !info.originalSubModels.some(sm => !sm.ghost))) {
        return; // Can't remove last content of file.
    }

    let part = info.part;
    let ghosts = info.originalSubModels.filter(pd => pd.ghost);
    let mergeFullStep = ghosts.length === 0;

    if(!mergeFullStep) {
        info.originalStep.subModels = info.originalSubModels.filter(pd => !pd.ghost);
        info.originalStep.fileLines = info.originalStep.fileLines.filter(line => (line.line1 ? !line.desc.ghost : true));
    }
    else if(info.current > 0) { // Merge step left:
        let prevStep = part.steps[info.current-1];
        prevStep.subModels.push(...info.originalStep.subModels);
        prevStep.fileLines.push(...info.originalStep.fileLines);
        part.steps.splice(info.current, 1);
        info.stepIndex -= this.countUsages(part.ID)+1;
    }
    else {
        info.originalStep.subModels = [];
    }

    if(part.steps.length === 1 && part.steps[0].subModels.length === 0) {
        this.loader.getMainModel().purgePart(this.loader, part.ID);
        part.steps = part.steps.slice(1);
        info.stepIndex -= this.countUsages(part.ID);
    }
}

LDR.StepHandler.prototype.moveNext = function(info, alwaysToNew) {
    let part = info.part;
    let current = info.current;

    // Create new empty next step if necessary:
    if(alwaysToNew || current === part.steps.length-1) {
        let newStep = new THREE.LDRStep();
        if(info.originalStep.rotation) {
            newStep.rotation = info.originalStep.rotation.clone();
        }
        part.steps.splice(current+1, 0, newStep);
    }

    if(!info.originalSubModels.some(pd => pd.ghost)) { // Move full step:
        info.stepIndex += this.countStepsInsideOfNextStep(); // Move this many steps forward.
        part.steps.splice(current, 1); // Remove current step.
        part.steps.splice(current+1, 0, info.originalStep); // Insert current step after the next.
    }
    else { // Move ghosted parts:
        // First check if there is a step to move data to:
        let nextStepIdx = current+1;
        info.stepIndex++;
        if(part.steps[nextStepIdx].containsNonPartSubModels(this.loader)) {
            info.stepIndex += this.countStepsInsideOfNextStep();
            // Ensure the step after that is available:            
            nextStepIdx++;
            // Add a new step if necessary:
            if(nextStepIdx === part.steps.length ||
               part.steps[nextStepIdx].containsNonPartSubModels(this.loader)) {
                let skippedStep = part.steps[current+1];
                let newStep = new THREE.LDRStep();
                if(skippedStep.rotation) {
                    newStep.rotation = skippedStep.rotation.clone();
                }
                part.steps.splice(current+1, 0, newStep);
            }
        }
        let nextStep = part.steps[nextStepIdx];

        nextStep.subModels.push(...info.originalSubModels.filter(pd => pd.ghost));
        info.originalStep.subModels = info.originalSubModels.filter(pd => !pd.ghost);
        if(part.steps[0].subModels.length === 0) { // Remove empty first step:
            part.steps = part.steps.slice(1);
            info.stepIndex -= this.countUsages(part.ID);
        }
        // All OK: Update lines in step:
        nextStep.fileLines.push(...info.originalStep.fileLines.filter(line => (line.line1 ? line.desc.ghost : false)));
        info.originalStep.fileLines = info.originalStep.fileLines.filter(line => (line.line1 ? !line.desc.ghost : true));
    }
}

LDR.StepHandler.prototype.movePrev = function(info, alwaysToNew) {
    let part = info.part;
    let current = info.current;

    // Create new empty previous step if necessary:
    if(alwaysToNew || current === 0) {
        let newStep = new THREE.LDRStep();
        if(info.originalStep.rotation) {
            newStep.rotation = info.originalStep.rotation.clone();
        }
        part.steps.splice(current, 0, newStep);
        current++; // Position has moved.
        info.stepIndex++; // Position has moved.
    }

    if(!info.originalSubModels.some(pd => pd.ghost)) { // Move full step:
        info.stepIndex -= this.countStepsInsideOfPreviousStep();
        part.steps.splice(current, 1); // Remove current step.
        part.steps.splice(current-1, 0, info.originalStep); // Insert current step before previous.
    }
    else { // Move ghosted parts:
        // First check if there is a step to move data to:
        let prevStepIdx = current-1;
        info.stepIndex--;
        if(part.steps[prevStepIdx].containsNonPartSubModels(this.loader)) {
            info.stepIndex -= this.countStepsInsideOfPreviousStep();
            // Ensure the step before is available:           
            prevStepIdx--;
            // Add a new step if necessary:
            if(prevStepIdx === part.steps.length ||
               part.steps[prevStepIdx].containsNonPartSubModels(this.loader)) {
                let skippedStep = part.steps[current-1];
                let newStep = new THREE.LDRStep();
                if(skippedStep.rotation) {
                    newStep.rotation = skippedStep.rotation.clone();
                }
                part.steps.splice(current-2, 0, newStep);
            }
        }
        let prevStep = part.steps[prevStepIdx];

        // Update steps:
        prevStep.subModels.push(...info.originalSubModels.filter(pd => pd.ghost));
        info.originalStep.subModels = info.originalSubModels.filter(pd => !pd.ghost);
        prevStep.fileLines.push(...info.originalStep.fileLines.filter(line => (line.line1 ? line.desc.ghost : false)));
        info.originalStep.fileLines = info.originalStep.fileLines.filter(line => (line.line1 ? !line.desc.ghost : true));
    }
}

LDR.StepHandler.prototype.moveToNewSubModel = function(info, newID) {
    if(info.originalSubModels.length === 0) {
        return; // Can't move empty step into new sub model.
    }

    // Create new part type:
    let newPT = new THREE.LDRPartType();
    newPT.ID = newPT.name = newPT.modelDescription = newID;
    newPT.author = 'LDRStepEditor';
    newPT.license = 'Redistributable under CCAL version 2.0 : see CAreadme.txt';
    newPT.cleanSteps = newPT.certifiedBFC = newPT.CCW = newPT.consistentFileAndName = true;
    this.loader.partTypes[newID] = newPT;
    console.log('Created model type ' + newPT.ID);

    // Create drop step (where the new part type is inserted):
    let r = new THREE.Matrix3(); r.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
    let newPD = new THREE.LDRPartDescription(16, new THREE.Vector3(), r, newPT.ID, true, false);
    let dropStep = new THREE.LDRStep();
    if(info.originalStep.rotation) {
        dropStep.rotation = info.originalStep.rotation.clone();
    }
    dropStep.fileLines = [ new LDR.Line1(newPD) ];
    dropStep.addSubModel(newPD);

    let part = info.part;
    let current = info.current;
    if(info.originalSubModels.some(pd => pd.ghost)) { // Create new step with sub model:
        info.stepIndex += 2*this.countUsages(part.ID)+1; // Move to new step. x2 for new placement steps.
        part.steps.splice(current+1, 0, dropStep); // Push in drop step.

        // Move lines to new step:
        let newStep = new THREE.LDRStep();
        newStep.subModels.push(...info.originalSubModels.filter(pd => pd.ghost));
        info.originalStep.subModels = info.originalSubModels.filter(pd => !pd.ghost);
        newStep.fileLines.push(...info.originalStep.fileLines.filter(line => (line.line1 ? line.desc.ghost : false)));
        info.originalStep.fileLines = info.originalStep.fileLines.filter(line => (line.line1 ? !line.desc.ghost : true));
        newPT.steps = [ newStep ];
    }
    else { // Move full step to new sub model by simply switching the steps:
        info.stepIndex += this.countUsages(part.ID); // Move to new step.
        newPT.steps = [ part.steps[current] ];
        part.steps[current] = dropStep;
    }
}

LDR.StepHandler.prototype.moveUp = function(info, right) {
    if(info.part.ID === this.loader.mainModel) {
        return; // Can't move main model up!
    }

    let part = info.part;
    let ghosts = info.originalSubModels.filter(pd => pd.ghost);
    let moveFullStep = ghosts.length === 0;
    if(moveFullStep) {
        ghosts = info.originalSubModels;
    }

    // Create new step in all models that use this:
    function handlePT(pt) {
        // Find a step where part is referred:
        for(let i = 0; i < pt.steps.length; i++) {
            let step = pt.steps[i];
            if(!step.subModels.some(sm => sm.ID === part.ID)) {
                continue;
            }
            // Add new step before or after this step:
            let newStep = new THREE.LDRStep();
            function handleSubModel(sm) {
                ghosts.forEach(ghost => {
                        let g = ghost.cloneNoPR(); // No position or rotation - set below:
                
                        g.position = new THREE.Vector3();
                        g.position.copy(ghost.position);
                        g.position.applyMatrix3(sm.rotation);
                        g.position.add(sm.position);
                        
                        g.rotation = new THREE.Matrix3();
                        g.rotation.multiplyMatrices(sm.rotation, ghost.rotation);
                        
                        newStep.subModels.push(g);
                        newStep.fileLines.push(new LDR.Line1(g));
                    });
            }
            step.subModels.forEach(handleSubModel);
            pt.steps.splice(right ? i+1 : i, 0, newStep); // Add step.
            i++; // We can now skip the next step.
        } // for
    } // handlePT
    this.loader.applyOnPartTypes(handlePT);

    // Update or remove old step:
    if(moveFullStep) { // Remove the step from the sub model:
        if(part.steps.length === 1) {
            this.loader.getMainModel().purgePart(this.loader, part.ID);
        }
        else {
            part.steps.splice(info.current, 1);
        }
    }
    else { // Update the step:
        info.originalStep.subModels = info.originalStep.subModels.filter(pd => !pd.ghost);
        info.originalStep.fileLines = info.originalStep.fileLines.filter(line => (line.line1 ? !line.desc.ghost : true));
        info.stepIndex += this.countUsages(part.ID);
    }
}

LDR.StepHandler.prototype.moveDown = function(info, right) {
    if(right && info.current === info.part.steps.length-1 ||
       !right && info.current === 0) {
        return; // No sub model to move down into!
    }
    let adjacentStep = info.part.steps[right ? (info.current+1) : (info.current-1)];
    if(adjacentStep.subModels.length !== 1 ||
       !adjacentStep.containsNonPartSubModels(this.loader)) {
        return; // There has to be a single non-part sub model that this can be moved into.
    }
    let adjacentPD = adjacentStep.subModels[0];    

    let ghosts = info.originalSubModels.filter(pd => pd.ghost);
    let moveFullStep = ghosts.length === 0;
    if(moveFullStep) {
        ghosts = info.originalSubModels;
    }

    // Create new step in sub model of adjacent step.
    let inv = new THREE.Matrix3();
    inv.getInverse(adjacentPD.rotation, true);
    let adjacentPT = this.loader.getPartType(adjacentPD.ID);

    // Add new step before or after this step:
    let newStep = new THREE.LDRStep();
    ghosts.forEach(ghost => {
            let g = ghost.cloneNoPR(); // No position or rotation - set below:
                
            g.position = new THREE.Vector3();
            g.position.copy(ghost.position);
            g.position.sub(adjacentPD.position);
            g.position.applyMatrix3(inv);
            
            g.rotation = new THREE.Matrix3();
            g.rotation.multiplyMatrices(inv, ghost.rotation);
            g.ghost = ghost.ghost;
            
            newStep.subModels.push(g);
            newStep.fileLines.push(new LDR.Line1(g));
        });
    adjacentPT.steps.splice(right ? 0 : adjacentPT.steps.length, 0, newStep); // Add step.
    info.stepIndex += this.countUsages(adjacentPT.ID);

    // Update or remove old step:
    if(moveFullStep) { // Remove the step from the sub model:
        info.part.steps.splice(info.current, 1);
        info.stepIndex -= this.countUsages(info.part.ID);
    }
    else { // Update the step:
        info.originalStep.subModels = info.originalStep.subModels.filter(pd => !pd.ghost);
        info.originalStep.fileLines = info.originalStep.fileLines.filter(line => (line.line1 ? !line.desc.ghost : true));
    }
}

LDR.StepHandler.prototype.split = function(info) {
    if(!info.step.containsNonPartSubModels(this.loader) ||
       info.originalSubModels.length < 2) {
        return; // Not with non-part sub models or not more than 1 sub model..
    }

    for(let i = 1; i < info.originalSubModels.length; i++) {
        let newStep = new THREE.LDRStep();
        let pd = info.originalSubModels[i];
        newStep.addSubModel(pd);
        newStep.fileLines.push(new LDR.Line1(pd));
        info.part.steps.splice(info.current+i, 0, newStep);
    }
    let pd0 = info.originalSubModels[0];
    info.originalStep.subModels = [pd0];
    info.originalStep.fileLines = [new LDR.Line1(pd0)];

    info.stepIndex += (info.originalSubModels.length-1)*this.countUsages(info.part.ID);
}

/**
   Merge content of next step into current step if current step is a placement step and
   the next step contains one or more sub models of the same type.
   This is almost the inverse of split. The difference being that this function only
   merges two steps, while split can result in more.
 */
LDR.StepHandler.prototype.joinWithNext = function(info) {
    if(!info.step.containsNonPartSubModels(this.loader) ||
       info.current === info.part.steps.length-1) {
        return; // No next step, or not with non-part sub models.
    }
    let nextStep = info.part.steps[info.current+1];
    if(!nextStep.containsNonPartSubModels(this.loader) ||
       info.originalSubModels[0].ID !== nextStep.subModels[0].ID) {
        return; // Next step not with non-part sub models, or sub models do not match.
    }

    info.originalSubModels.push(...nextStep.subModels);
    info.step.fileLines.push(...nextStep.fileLines);
    info.part.steps.splice(info.current+1, 1); // Remove the next step.

    info.stepIndex -= this.countUsages(info.part.ID);
}

/**
   Helper functions:
 */
LDR.StepHandler.prototype.countUsages = function(ID) {
    let ret = 0;

    for(let i = 0; i < this.current; i++) {
        let subStepHandler = this.steps[i].stepHandler;
        if(subStepHandler) {
            if(subStepHandler.part.ID === ID) {
                ret += 1;
            }
            else {
                ret += subStepHandler.countUsages(ID);
            }
        }
    }
    return ret;
}

LDR.StepHandler.prototype.countStepsInsideOfNextStep = function() {
    let sh = this.getCurrentStepHandler();
    if(sh.current === sh.length-1) {
        return 1; // No next step - assume one will be created.
    }
    let nextStep = sh.steps[sh.current+1];
    return nextStep.stepHandler ? nextStep.stepHandler.totalNumberOfSteps+1 : 1;
}

LDR.StepHandler.prototype.countStepsInsideOfPreviousStep = function() {
    let sh = this.getCurrentStepHandler();
    if(sh.current === 0) {
        return 1; // No previous step - assume one will be created.
    }
    let prevStep = sh.steps[sh.current-1];
    return prevStep.stepHandler ? prevStep.stepHandler.totalNumberOfSteps+1 : 1;
}

THREE.LDRPartType.prototype.purgePart = function(loader, ID) {
    if(this.isPart()) {
        return;
    }
    function handleStep(step) {
        step.subModels = step.subModels.filter(sm => sm.ID !== ID);
        if(step.subModels.length === 0) {
            step.RM = true;
        }
        else {
            step.subModels.forEach(sm => loader.getPartType(sm.ID).purgePart(loader, ID));
        }
    }
    this.steps.forEach(handleStep);
    this.steps = this.steps.filter(step => !step.RM);
}

THREE.LDRPartDescription.prototype.cloneNoPR = function() {
    let ret = new THREE.LDRPartDescription(this.colorID, null, null, this.ID, 
					   this.cull, this.invertCCW);
    ret.REPLACEMENT_PLI = this.REPLACEMENT_PLI;
    ret.ghost = this.ghost;
    return ret;
}
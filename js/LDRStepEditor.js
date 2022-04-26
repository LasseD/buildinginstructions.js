'use strict';

/**
   Operations:
   - Open/Close editor using button shown in top bar (Icon shows pen and paper)
   - Toggle ghosting of hovered part
   - Toggle ghosting of all parts
   - Modify step rotation: ABS,REL, x, y, z
   - Color ghosted parts
   - Add step
   - Remove ghosted parts / remove empty step / merge step left
   - Move parts to previous/next step, skip sub models
   - Group parts into sub model
   - Inline parts/step to all instances of sub models above
   - Move parts to sub model in previous/next step
   - Split sub models in step to more steps when in placement step
   - Join with sub models in step to the right
   - save
 */
LDR.StepEditor = function(loader, stepHandler, pliBuilder, reset, onChange, modelID) {
    if(!LDR.Options) {
        throw "Editor only functions when options are enabled.";
    }
    this.loader = loader;
    this.stepHandler = stepHandler;
    this.pliBuilder = pliBuilder;
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
        if(LDR.Options.showEditor) {
            $("#editor").show();
        }
        else{
            $("#editor").hide();
        }
    }
    LDR.Options.listeners.push(showOrHide);
    showOrHide(LDR.Options);
    
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
	    if(!key)console.log('FAIL ' + desc);
	    ret.setAttribute('title', desc + ' (Press ' + key + ')');
        }
        return ret;
    }
}

LDR.StepEditor.prototype.handleKeyDown = function(e) {
    let k = e.keyCode;
    switch(k) {
    case 8: // 'BACK SPACE'
    case 46: // 'DELETE'
	this.remove();
	break;
    case 65: // 'A'
	this.movePLILeft();
	break;
    case 66: // 'B'
	this.movePrev(true);
	break;
    case 67: // 'C'
	this.toggleRot();
	break;
    case 68: // 'D'
	this.movePLIRight();
	break;
    case 38: // 'UP'
    case 69: // 'E'
	this.toggleHovered();
	break;
    case 70: // 'F'
	this.moveToNewSubModel();
	break;
    case 71: // 'G'
	this.moveUp(false);
	break;
    case 72: // 'H'
	this.moveUp(true);
	break;
    case 74: // 'J'
	this.moveDown(false);
	break;
    case 75: // 'K'
	this.moveDown(true);
	break;
    case 76: // 'L'
	this.split();
	break;
    case 77: // 'M'
	this.moveNext(false);
	break;
    case 78: // 'N'
	this.moveNext(true);
	break;
    case 81: // 'Q'
	this.save();
	break;
    case 82: // 'R'
	this.toggleAll();
	break;
    case 83: // 'S'
	this.movePLIDown();
	break;
    case 84: // 'T'
	this.join();
	break;
    case 86: // 'V'
	this.movePrev(false);
	break;
    case 87: // 'W'
	this.movePLIUp();
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
    default:
	//console.log('Key not bound to an editor function: ' + k);
	break;
    }
}

LDR.StepEditor.prototype.generateNextID = function() {
    const radix = 36;
    while(this.loader.partTypes.hasOwnProperty(this.nextID.toString(radix) + '.ldr')) {
        this.nextID++;
    }
    return this.nextID.toString(radix);
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
    LDR.Options.showEditor = 1-LDR.Options.showEditor;
    LDR.Options.onChange();
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
    let self = this;
    let saveParentEle = this.makeEle(parentEle, 'span', 'editor_control');
    this.saveEle = this.makeEle(saveParentEle, 'button', 'save_button',
				() => self.save(), 'SAVE', false, 'Q');

    this.createRotationGuiComponents(parentEle);
    this.createPartGuiComponents(parentEle);

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
            let didModelChange = actualChange(info);
	    if(didModelChange) {
		self.stepHandler.rebuild();
		self.stepHandler.moveTo(info.stepIndex);
	    }
	    self.onChange();
	    if(didModelChange) {
		self.makeSaveElementGreen();
	    }
        }
    }

    // Color:
    let colorPicker = new LDR.ColorPicker(c => update(() => self.stepHandler.colorGhosted(c)));
    let colorButton = colorPicker.createButton();
    ele.append(colorButton);

    // PLI Navigation:
    this.movePLIUp = () => update(() => self.pliBuilder.moveClickMapUp());
    this.movePLIDown = () => update(() => self.pliBuilder.moveClickMapDown());
    this.movePLIRight = () => update(() => self.pliBuilder.moveClickMapRight());
    this.movePLILeft = () => update(() => self.pliBuilder.moveClickMapLeft());

    // Left/right/remove controls:
    this.movePrev = x => update(info => self.stepHandler.movePrev(info, x));
    this.makeEle(ele, 'button', 'pli_button', () => self.movePrev(false),
                 'Move to previous step (skipping sub models) or move full step if nothing is selected', self.makeMovePrevIcon(), 'V');
    this.makeEle(ele, 'button', 'pli_button', () => self.movePrev(true),
                 'Move to new previous step', self.makeAddIcon(false), 'B');
    this.remove = () => update(info => self.stepHandler.remove(info));
    let removeButton = this.makeEle(ele, 'button', 'pli_button', () => self.remove(),
                                    'Remove parts or step', self.makeRemoveIcon(), 'DELETE');
    this.moveNext = x => update(info => self.stepHandler.moveNext(info, x));
    this.makeEle(ele, 'button', 'pli_button', () => self.moveNext(true),
                 'Move to new next step', self.makeAddIcon(true), 'N');
    this.makeEle(ele, 'button', 'pli_button', () => self.moveNext(false),
                 'Move to next step (skipping sub models) or move full step if nothing is selected', self.makeMoveNextIcon(), 'M');

    // Sub model controls:
    this.moveToNewSubModel = () => update(info => self.stepHandler.moveToNewSubModel(info, self.generateNextID()));
    let moveToNewSubModelButton = this.makeEle(ele, 'button', 'pli_button', () => self.moveToNewSubModel(),
					       'Move down into a new sub model', self.makeMoveToNewSubModelIcon(), 'F');

    this.moveUp = right => update(info => self.stepHandler.moveUp(info, right));
    let moveUpLeftButton = this.makeEle(ele, 'button', 'pli_button', () => self.moveUp(false),
                                        'Move up to previous step', self.makeMoveUpSideIcon(false), 'G');
    let moveUpRightButton = this.makeEle(ele, 'button', 'pli_button', () => self.moveUp(true),
                                         'Move up to next step', self.makeMoveUpSideIcon(true), 'H');
    let dissolveSubModelButton = this.makeEle(ele, 'button', 'pli_button', () => self.moveUp(true),
					      'Move up and remove this sub model', self.makeDissolveSubModelIcon(), 'H');

    this.moveDown = right => update(info => self.stepHandler.moveDown(info, right));
    let moveDownLeftButton = this.makeEle(ele, 'button', 'pli_button', () => self.moveDown(false),
                                          'Move to the sub model in previous step', self.makeMoveDownSideIcon(false), 'J');
    let moveDownRightButton = this.makeEle(ele, 'button', 'pli_button', () =>self.moveDown(true),
                                           'Move to the sub model in next step', self.makeMoveDownSideIcon(true), 'K');

    this.split = () => update(info => self.stepHandler.split(info));
    let splitButton = this.makeEle(ele, 'button', 'pli_button', () => self.split(),
                                   'Split the sub models into separate steps', self.makeSplitIcon(), 'L');
    this.join = () => update(info => self.stepHandler.joinWithNext(info));
    let joinButton = this.makeEle(ele, 'button', 'pli_button', () => self.join(),
                                  'Join with the sub model from the next step', self.makeJoinIcon(), 'T');


    this.toggleHovered = () => update(info => self.stepHandler.toggleHovered(info));
    let toggleHoveredButton = this.makeEle(ele, 'button', 'pli_button', () => self.toggleHovered(),
					   'Toggle highlight.', self.makeToggleHoveredIcon(), 'E or UP arrow, and use WADS to move between parts');


    this.toggleAll = () => update(info => self.stepHandler.toggleAll(info));
    let toggleAllButton = this.makeEle(ele, 'button', 'pli_button', () => self.toggleAll(),
				       'Highlight all/none', self.makeToggleAllIcon(), 'R and use WADS to move between parts');

    function showAndHideButtons() {
        let anyHovered = self.step.subModels.some(pd => pd.original.hover);
        let anyGhosted = self.step.subModels.some(pd => pd.original.ghost);
        let allGhosted = !self.step.subModels.some(pd => !pd.original.ghost);

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
	let anyPartSubModels = self.step.containsPartSubModels(self.loader);
	let anyNonPartSubModels = self.step.containsNonPartSubModels(self.loader);
        let isThisAndNextWithSameSubModels = isNextASubModel && !empty && anyNonPartSubModels && 
            self.step.subModels[0].ID === self.part.steps[self.stepIndex+1].subModels[0].ID;

        let display = show => show ? 'inline-block' : 'none';

        colorButton.style.display = display(anyGhosted);
        removeButton.style.display = display(!(last && (!anyGhosted || allGhosted) && isMainModel));
        moveToNewSubModelButton.style.display = display(!empty);
        moveUpLeftButton.style.display = display(!isMainModel && isAtFirstStepInSubModel);
        moveUpRightButton.style.display = display(!isMainModel && isAtLastStepInSubModel);
        dissolveSubModelButton.style.display = display(!isMainModel && isAtLastStepInSubModel && isAtFirstStepInSubModel);
        moveDownLeftButton.style.display = display(isPrevASubModel);
        moveDownRightButton.style.display = display(isNextASubModel);
        splitButton.style.display = display(atPlacementStep && self.step.subModels.length > 1);
        joinButton.style.display = display(isThisAndNextWithSameSubModels);
	toggleHoveredButton.style.display = display(anyHovered);
	toggleAllButton.style.display = display(anyPartSubModels);
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

LDR.StepEditor.prototype.makeToggleHoveredIcon = function() {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-20 -20 40 40');
    let r;
    svg.appendChild(r = LDR.SVG.makeRect(-20, -20, 17, 17, false, '#000'));
    r.setAttribute('stroke-dasharray', "5,5");
    svg.appendChild(LDR.SVG.makeRect(-20, 3, 17, 17, false, '#5DD'));
    svg.appendChild(LDR.SVG.makeRect(3, 3, 17, 17, false, '#5DD'));
    svg.appendChild(LDR.SVG.makeRect(3, -20, 17, 17, false, '#5DD'));
    return svg;
}

LDR.StepEditor.prototype.makeToggleAllIcon = function() {
    let svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-20 -20 40 40');
    svg.appendChild(LDR.SVG.makeRect(-20, -20, 17, 17, false, '#5DD'));
    svg.appendChild(LDR.SVG.makeRect(-20, 3, 17, 17, false, '#5DD'));
    svg.appendChild(LDR.SVG.makeRect(3, 3, 17, 17, false, '#5DD'));
    svg.appendChild(LDR.SVG.makeRect(3, -20, 17, 17, false, '#5DD'));
    return svg;
}

//
// Editor operations on StepHandler:
//

LDR.StepHandler.prototype.colorGhosted = function(c) {
    let [part, current, stepInfo] = this.getCurrentStepInfo();
    let step = stepInfo.step;
    if(!step) {
        console.warn('Not at a step where parts can be colored.');
        return false;
    }

    // Remove ghosted parts from both step and mc:
    let stepIndex = this.getCurrentStepIndex();
    step.original.subModels.forEach(pd => {if(pd.ghost){pd.c = c};});

    this.rebuild();
    this.moveTo(stepIndex);
    return true;
}

LDR.StepHandler.prototype.toggleAll = function(info) {
    if(!info.step.containsPartSubModels(this.loader)) {
	return false; // No parts to highlight.
    }

    if(info.originalSubModels.some(sm => !sm.ghost)) {
	info.originalSubModels.forEach(sm => sm.ghost = true);
    }
    else {
	info.originalSubModels.forEach(sm => sm.ghost = false);
    }
    return false;
}

LDR.StepHandler.prototype.toggleHovered = function(info) {
    info.originalSubModels.forEach(sm => {if(sm.hover){sm.ghost=!sm.ghost;}});

    return false;
}

LDR.StepHandler.prototype.remove = function(info) {
    if(info.part.ID === this.loader.mainModel && info.step.length === 1 && 
       (!info.originalSubModels.some(sm => sm.ghost) || 
        !info.originalSubModels.some(sm => !sm.ghost))) {
        return false; // Can't remove last content of file.
    }

    let part = info.part;
    let ghosts = info.originalSubModels.filter(pd => pd.ghost);
    let mergeFullStep = ghosts.length === 0;

    if(!mergeFullStep) {
        info.originalStep.subModels = info.originalSubModels.filter(pd => !pd.ghost);
    }
    else if(info.current > 0) { // Merge step left:
        let prevStep = part.steps[info.current-1];
        prevStep.subModels.push(...info.originalStep.subModels);
        part.steps.splice(info.current, 1);
        info.stepIndex -= this.countUsages(part.ID)+1;
    }
    else {
        info.originalStep.subModels = [];
    }

    if(part.steps.length === 1 && part.steps[0].subModels.length === 0) {
        this.loader.purgePart(part.ID);
        part.steps = part.steps.slice(1);
        info.stepIndex -= this.countUsages(part.ID);
    }
    return true;
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
    }
    return true;
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
    }
    return true;
}

LDR.StepHandler.prototype.moveToNewSubModel = function(info, newID) {
    if(info.originalSubModels.length === 0) {
        return false; // Can't move empty step into new sub model.
    }

    // Create new part type:
    let newPT = new THREE.LDRPartType();
    newPT.ID = newPT.name = newID + '.ldr';
    newPT.modelDescription = newID;
    newPT.author = 'LDRStepEditor';
    newPT.license = 'Redistributable under CCAL version 2.0 : see CAreadme.txt';
    newPT.cleanSteps = newPT.certifiedBFC = newPT.CCW = true;
    this.loader.partTypes[newPT.ID] = newPT;
    console.log('Created model type ' + newPT.ID);

    // Create drop step (where the new part type is inserted):
    let r = new THREE.Matrix3(); r.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
    let newPD = new THREE.LDRPartDescription(16, new THREE.Vector3(), r, newPT.ID, true, false);
    let dropStep = new THREE.LDRStep();
    if(info.originalStep.rotation) {
        dropStep.rotation = info.originalStep.rotation.clone();
    }
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
        newPT.steps = [ newStep ];
    }
    else { // Move full step to new sub model by simply switching the steps:
        info.stepIndex += this.countUsages(part.ID); // Move to new step.
        newPT.steps = [ part.steps[current] ];
        part.steps[current] = dropStep;
    }
    return true;
}

LDR.StepHandler.prototype.moveUp = function(info, right) {
    if(info.part.ID === this.loader.mainModel) {
        return false; // Can't move main model up!
    }

    let part = info.part;
    let ghosts = info.originalSubModels.filter(pd => pd.ghost);
    let moveFullStep = ghosts.length === 0 || (ghosts.length === info.originalSubModels.length && part.steps.length === 1);
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
                
                        g.p = new THREE.Vector3();
                        g.p.copy(ghost.p);
                        g.p.applyMatrix3(sm.r);
                        g.p.add(sm.p);
                        
                        g.r = new THREE.Matrix3();
                        g.r.multiplyMatrices(sm.r, ghost.r);
                        
                        newStep.subModels.push(g);
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
            this.loader.purgePart(part.ID);
        }
        else {
            part.steps.splice(info.current, 1);
        }
    }
    else { // Update the step:
        info.originalStep.subModels = info.originalStep.subModels.filter(pd => !pd.ghost);
        info.stepIndex += this.countUsages(part.ID);
    }
    return true;
}

LDR.StepHandler.prototype.moveDown = function(info, right) {
    if(right && info.current === info.part.steps.length-1 ||
       !right && info.current === 0) {
        return false; // No sub model to move down into!
    }
    let adjacentStep = info.part.steps[right ? (info.current+1) : (info.current-1)];
    if(adjacentStep.subModels.length !== 1 ||
       !adjacentStep.containsNonPartSubModels(this.loader)) {
        return false; // There has to be a single non-part sub model that this can be moved into.
    }
    let adjacentPD = adjacentStep.subModels[0];    

    let ghosts = info.originalSubModels.filter(pd => pd.ghost);
    let moveFullStep = ghosts.length === 0;
    if(moveFullStep) {
        ghosts = info.originalSubModels;
    }

    // Create new step in sub model of adjacent step.
    let inv = new THREE.Matrix3();
    inv.copy(adjacentPD.r).invert();
    let adjacentPT = this.loader.getPartType(adjacentPD.ID);

    // Add new step before or after this step:
    let newStep = new THREE.LDRStep();
    ghosts.forEach(ghost => {
        let g = ghost.cloneNoPR(); // No position or rotation - set below:
                
        g.p = new THREE.Vector3();
        g.p.copy(ghost.p);
        g.p.sub(adjacentPD.p);
        g.p.applyMatrix3(inv);
        
        g.r = new THREE.Matrix3();
        g.r.multiplyMatrices(inv, ghost.r);
        
        newStep.subModels.push(g);
    });
    adjacentPT.steps.splice(right ? 0 : adjacentPT.steps.length, 0, newStep); // Add step.
    info.stepIndex += this.countUsages(adjacentPT.ID);

    // Update or remove old step:
    if(moveFullStep) { // Remove the step from the sub model:
        info.part.steps.splice(info.current, 1);
        info.stepIndex -= 1+this.countUsages(info.part.ID);
    }
    else { // Update the step:
        info.originalStep.subModels = info.originalStep.subModels.filter(pd => !pd.ghost);
	info.stepIndex+=1; // Move to new step.
    }
    return true;
}

LDR.StepHandler.prototype.split = function(info) {
    if(!info.step.containsNonPartSubModels(this.loader) ||
       info.originalSubModels.length < 2) {
        return false; // Not with non-part sub models or not more than 1 sub model..
    }

    for(let i = 1; i < info.originalSubModels.length; i++) {
        let newStep = new THREE.LDRStep();
        let pd = info.originalSubModels[i];
        newStep.addSubModel(pd);
        info.part.steps.splice(info.current+i, 0, newStep);
    }
    let pd0 = info.originalSubModels[0];
    info.originalStep.subModels = [pd0];

    info.stepIndex += (info.originalSubModels.length-1)*this.countUsages(info.part.ID);
    return true;
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
        return false; // No next step, or not with non-part sub models.
    }
    let nextStep = info.part.steps[info.current+1];
    if(!nextStep.containsNonPartSubModels(this.loader) ||
       info.originalSubModels[0].ID !== nextStep.subModels[0].ID) {
        return false; // Next step not with non-part sub models, or sub models do not match.
    }

    info.originalSubModels.push(...nextStep.subModels);
    info.part.steps.splice(info.current+1, 1); // Remove the next step.

    info.stepIndex -= this.countUsages(info.part.ID);
    return true;
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

THREE.LDRPartDescription.prototype.cloneNoPR = function() {
    if(this.original) {
	throw "Cloning non-original PD in cloneNoPR!";
    }
    let ret = new THREE.LDRPartDescription(this.c, null, null, this.ID, 
					   this.cull, this.invertCCW);
    ret.REPLACEMENT_PLI = this.REPLACEMENT_PLI;
    ret.ghost = this.ghost || false;

    return ret;
}

LDR.MeshCollector.prototype.addHoverBox = function(mesh, part) {
    if(!(part)) {
	return;
    }
    let h = part.hoverBox = new THREE.BoxHelper(mesh, 0x55DDDD);
    h.visible = false;
    this.opaqueObject.add(h);
}

LDR.MeshCollector.prototype.updateMeshVisibility = function() {
    let v = this.visible;
    let lineV = v && LDR.Options && LDR.Options.lineContrast !== 2;

    this.lineMeshes.forEach(obj => obj.mesh.visible = lineV);

    let old = this.old;
    this.triangleMeshes.forEach(obj => {
	if(obj.part && obj.part.hoverBox) {
            obj.part.hoverBox.visible = v && !old && LDR.Options.showEditor && (obj.part && obj.part.original && obj.part.original.ghost) ? true : false;
	}
	obj.mesh.visible = v && (old || !(obj.part && obj.part.original && obj.part.original.hover));
    });
}

LDR.MeshCollector.prototype.removeAllMeshes = function() {
    var self = this;
    this.lineMeshes.forEach(obj => self.opaqueObject.remove(obj.mesh));

    this.triangleMeshes.forEach(obj => obj.parent.remove(obj.mesh));
    this.triangleMeshes.forEach(obj => obj.part && obj.part.hoverBox && self.opaqueObject.remove(obj.part.hoverBox));
}

LDR.PLIBuilder.prototype.getClickMapHover = function() {
    return this.clickMap.find(icon => icon.part.original && icon.part.original.hover);
}

LDR.PLIBuilder.prototype.moveClickMapRight = function() {
    if(this.clickMap.length === 0) {
	return; // Nothing to move in.
    }
    let hovered = this.getClickMapHover();

    let ret;
    if(hovered) {
	let x0 = hovered.x;
	let y0 = hovered.y;
	let x1 = hovered.x + hovered.DX;
	let y1 = hovered.y + hovered.DY;

	this.clickMap.forEach(icon => {
	    if(icon.part.original.hover) {
		return; // Old icon.
	    }
	    let x2 = icon.x;
	    let x3 = icon.x + icon.DX;
	    let y2 = icon.y;
	    let y3 = icon.y + icon.DY;

	    if(x2 < x1 || (ret && ret.x+ret.DX < x3)) {
		return; // Have to move right.
	    }
	    if(y0 <= y2 && y1 >= y2 ||
	       y2 <= y0 && y3 >= y0 ||
	       y2 <= y1 && y3 >= y1) {
		ret = icon;
	    }
	});
	hovered.part.original.hover = false;
    }
    else {
	ret = this.clickMap[0];
	for(let i = 1; i < this.clickMap.length; i++) {
	    let icon = this.clickMap[i];
	    if(icon.x < ret.x || icon.x === ret.x && icon.y > ret.y) {
		ret = icon;
	    }
	}
    }

    if(ret) {
	ret.part.original.hover = true;
    }
}

LDR.PLIBuilder.prototype.moveClickMapLeft = function() {
    if(this.clickMap.length === 0) {
	return; // Nothing to move in.
    }
    let hovered = this.getClickMapHover();

    let ret;
    if(hovered) {
	let x0 = hovered.x;
	let y0 = hovered.y;
	let x1 = hovered.x + hovered.DX;
	let y1 = hovered.y + hovered.DY;

	this.clickMap.forEach(icon => {
	    if(icon.part.original.hover) {
		return; // Old icon.
	    }
	    let x2 = icon.x;
	    let x3 = icon.x + icon.DX;
	    let y2 = icon.y;
	    let y3 = icon.y + icon.DY;

	    if(x3 > x0 || (ret && ret.x+ret.DX > x3)) {
		return; // Have to move left.
	    }
	    if(y0 <= y2 && y1 >= y2 ||
	       y2 <= y0 && y3 >= y0 ||
	       y2 <= y1 && y3 >= y1) {
		ret = icon;
	    }
	});
	hovered.part.original.hover = false;
    }
    else {
	ret = this.clickMap[0];
	for(let i = 1; i < this.clickMap.length; i++) {
	    let icon = this.clickMap[i];
	    if(icon.x > ret.x || icon.x === ret.x && icon.y > ret.y) {
		ret = icon;
	    }
	}
    }

    if(ret) {
	ret.part.original.hover = true;
    }
}

LDR.PLIBuilder.prototype.moveClickMapDown = function() {
    if(this.clickMap.length === 0) {
	return; // Nothing to move in.
    }
    let hovered = this.getClickMapHover();

    let ret;
    if(hovered) {
	let x0 = hovered.x;
	let y0 = hovered.y;
	let x1 = hovered.x + hovered.DX;
	let y1 = hovered.y + hovered.DY;

	this.clickMap.forEach(icon => {
	    if(icon.part.original.hover) {
		return; // Old icon.
	    }
	    let y2 = icon.y;
	    let y3 = icon.y + icon.DY;
	    if(y2 < y0 || (ret && ret.y < y2)) {
		return; // Have to move down.
	    }
	    let x2 = icon.x;
	    let x3 = icon.x + icon.DX;
	    if(x0 <= x2 && x1 >= x2 ||
	       x2 <= x0 && x3 >= x0 ||
	       x2 <= x1 && x3 >= x1) {
		ret = icon;
	    }
	});
	hovered.part.original.hover = false;
    }
    else {
	ret = this.clickMap[0];
	for(let i = 1; i < this.clickMap.length; i++) {
	    let icon = this.clickMap[i];
	    if(icon.y < ret.y || icon.y === ret.y && icon.x < ret.x) {
		ret = icon;
	    }
	}
    }

    if(ret) {
	ret.part.original.hover = true;
    }
}

LDR.PLIBuilder.prototype.moveClickMapUp = function() {
    if(this.clickMap.length === 0) {
	return; // Nothing to move in.
    }
    let hovered = this.getClickMapHover();

    let ret;
    if(hovered) {
	let x0 = hovered.x;
	let y0 = hovered.y;
	let x1 = hovered.x + hovered.DX;
	let y1 = hovered.y + hovered.DY;

	this.clickMap.forEach(icon => {
	    if(icon.part.original.hover) {
		return; // Old icon.
	    }
	    let y2 = icon.y;
	    let y3 = icon.y + icon.DY;
	    if(y2 > y0 || (ret && ret.y > y2)) {
		return; // Have to move up.
	    }
	    let x2 = icon.x;
	    let x3 = icon.x + icon.DX;
	    if(x0 <= x2 && x1 >= x2 ||
	       x2 <= x0 && x3 >= x0 ||
	       x2 <= x1 && x3 >= x1) {
		ret = icon;
	    }
	});
	hovered.part.original.hover = false;
    }
    else {
	ret = this.clickMap[0];
	for(let i = 1; i < this.clickMap.length; i++) {
	    let icon = this.clickMap[i];
	    if(icon.y > ret.y || icon.y === ret.y && icon.x > ret.x) {
		ret = icon;
	    }
	}
    }

    if(ret) {
	ret.part.original.hover = true;
    }
}

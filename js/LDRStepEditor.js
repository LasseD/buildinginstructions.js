'use strict';

/**
   Operations (! for MVP):
   - addStep
   - removeStep
   ! modifyStepRotation: type[normal,ABS,REL,ADD,END], x, y, z
   - dissolveSubModel
   - save
   - Move parts to previous/next
 */
LDR.StepEditor = function(loader, builder, onChange) {
    this.loader = loader;
    this.builder = builder;
    this.onChange = onChange;
    this.onStepSelectedListeners = [];
    
    // Private function to make it easier to create GUI components:
    this.makeEle = function(parent, type, cls, onclick, innerHTML) {
        var ret = document.createElement(type);
        parent.appendChild(ret);
        if(cls) {
            ret.setAttribute('class', cls);
        }
        if(onclick) {
            ret.addEventListener('click', onclick);
        }
        if(innerHTML) {
            ret.innerHTML = innerHTML;
        }
        return ret;
    }
}

LDR.StepEditor.prototype.updateCurrentStep = function() {
    var [part, stepIndex] = this.builder.getCurrentPartAndStepIndex();
    this.onStepSelectedListeners.forEach(listener => listener(part, stepIndex));
}

LDR.StepEditor.prototype.createGuiComponents = function(parentEle) {
    this.createRotationGuiComponents(parentEle);
    // TODO Other groups of GUI components: For moving parts (to next), creating and removing steps, dissolving sub-model

    function save() {
        // TODO
    }
    var saveParentEle = this.makeEle(parentEle, 'span', 'editor_control');
    var saveEle = this.makeEle(saveParentEle, 'button', 'editor_button', null, save);
    saveEle.innerHTML = 'Save';
}

LDR.StepEditor.prototype.createRotationGuiComponents = function(parentEle) {
    var self = this, Ele, Normal, Rel, Abs, Add, End, X, Y, Z;
    function makeNormal() {
        // TODO
    }
    function makeRel() {
        // TODO
    }
    function makeAbs() {
        // TODO
    }
    function makeAdd() {
        // TODO
    }
    function makeEnd() {
        // TODO
    }
    function setXYZ() {
        // TODO
    }
    function undoRotationChange() {
        // TODO
    }

    // TODO: https://viralpatel.net/blogs/css-radio-button-checkbox-background/
    Ele = this.makeEle(parentEle, 'span', 'editor_control');
    function makeRotationRadioButton(value, onClick) {
        var label = self.makeEle(Ele, 'label', 'editor_radio_label', null, value);
        label.setAttribute('for', value);
        var button = self.makeEle(Ele, 'input', 'editor_radio_button', onClick);
        button.setAttribute('type', 'radio');
        button.setAttribute('id', value);
        button.setAttribute('name', 'rot_type');
        button.setAttribute('value', 'false');
    }
    Normal = makeRotationRadioButton('STEP', makeNormal);
    Rel = makeRotationRadioButton('REL', makeRel);
    Abs = makeRotationRadioButton('ABS', makeAbs);
    Add = makeRotationRadioButton('ADD', makeAdd);
    End = makeRotationRadioButton('END', makeEnd);

    this.makeEle(Ele, 'label', 'editor_label', null, 'x');
    X = this.makeEle(Ele, 'input', 'editor_input', setXYZ);
    this.makeEle(Ele, 'label', 'editor_label', null, 'y');
    Y = this.makeEle(Ele, 'input', 'editor_input', setXYZ);
    this.makeEle(Ele, 'label', 'editor_label', null, 'z');
    Z = this.makeEle(Ele, 'input', 'editor_input', setXYZ);

    function onStepSelected(part, stepIndex) {
        var step = part.steps[stepIndex];
        var rot = step.rotation;
        
    }
    this.onStepSelectedListeners.push(onStepSelected);
}

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
    if(!onChange)
        throw "Missing callback for step changes!";
    this.loader = loader;
    this.builder = builder;
    this.onChange = onChange;
    this.onStepSelectedListeners = [];

    // Current state variables:
    this.part;
    this.stepIndex;
    this.step;
    
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
    this.part = part;
    this.stepIndex = stepIndex;
    this.step = part.steps[stepIndex];
    this.onStepSelectedListeners.forEach(listener => listener());
}

LDR.StepEditor.prototype.createGuiComponents = function(parentEle) {
    this.createRotationGuiComponents(parentEle);
    // TODO Other groups of GUI components: For moving parts (to next), creating and removing steps, dissolving sub-model

    function save() {
        // TODO: Send POST request with file.
    }
    var saveParentEle = this.makeEle(parentEle, 'span', 'editor_control');
    var saveEle = this.makeEle(saveParentEle, 'button', 'editor_button', null, save);
    saveEle.innerHTML = 'Save';
    this.updateCurrentStep();
}

LDR.StepEditor.prototype.createRotationGuiComponents = function(parentEle) {
    var self = this, Ele, Normal, Rel, Abs, End, X, Y, Z;
    function propagate(rot) {
        for(var i = self.stepIndex+1; i < self.part.steps.length; i++) {
            var s = self.part.steps[i];
            if(!THREE.LDRStepRotation.equals(self.step.rotation, s.rotation)) {
                break; // Only replace those 
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
        var rot = self.step.rotation ? self.step.rotation.clone() : new THREE.LDRStepRotation(0, 0, 0, 'REL');
        rot.type = 'REL';
        propagate(rot);
    }
    function makeAbs() {
        var rot = self.step.rotation ? self.step.rotation.clone() : new THREE.LDRStepRotation(0, 0, 0, 'ABS');
        rot.type = 'ABS';
        propagate(rot);
    }
    function makeEnd() {
        propagate(null);
    }

    function setXYZ(e) {
        e.stopPropagation();
        var rot = self.step.rotation ? self.step.rotation.clone() : new THREE.LDRStepRotation(0, 0, 0, 'REL');
        var x = parseFloat(X.value);
        var y = parseFloat(Y.value);
        var z = parseFloat(Z.value);
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
    function makeRotationRadioButton(value, onClick) {
        var button = self.makeEle(Ele, 'input', 'editor_radio_button', onClick);

        var label = self.makeEle(Ele, 'label', 'editor_radio_label', null, value);
        label.setAttribute('for', value);

        button.setAttribute('type', 'radio');
        button.setAttribute('id', value);
        button.setAttribute('name', 'rot_type');
        //button.setAttribute('value', 'false');
        return button;
    }
    Normal = makeRotationRadioButton('STEP', makeNormal);
    Rel = makeRotationRadioButton('REL', makeRel);
    Abs = makeRotationRadioButton('ABS', makeAbs);
    End = makeRotationRadioButton('END', makeEnd);

    function makeXYZ(type) {
        self.makeEle(Ele, 'label', 'editor_label', null, type);
        var ret = self.makeEle(Ele, 'input', 'editor_input', setXYZ);
        ret.addEventListener('keyup', setXYZ);
        ret.addEventListener('keydown', e => e.stopPropagation());
        return ret;
    }
    X = makeXYZ('X');
    Y = makeXYZ('Y');
    Z = makeXYZ('Z');

    function onStepSelected() {
        var rot = self.step.rotation;
        if(!rot) {
            X.value = Y.value = Z.value = "";
            if(self.stepIndex === 0 || !self.part.steps[self.stepIndex-1].rotation) {
                Normal.checked = true;
            }
            else {
                // Previous step had a rotation, so this step must be an end step:
                End.checked = true;
            }
        }
        else {
            if(rot.type === 'REL') {
                Rel.checked = true;
            }
            else { // rot.type === 'ABS' as 'ADD' is unsupported.
                Abs.checked = true;
            }
            X.value = rot.x;
            Y.value = rot.y;
            Z.value = rot.z;
        }
        X.disabled = Y.disabled = Z.disabled = rot === null;
    }
    this.onStepSelectedListeners.push(onStepSelected);
}

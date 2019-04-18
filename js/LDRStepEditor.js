'use strict';

/**
   Finished Operations:
   - save --- 1 button
   - modify step rotation: type[normal,ABS,REL,END], x, y, z --- 4 buttons + 3*3 inputs
   Operations on TODO-list:
   - Open/Close editor in top bar (changes PLI - PLI always shown when editor opened)
   - add step (left and right, move highlighted parts to new step) --- 2 buttons
   - remove step (merge left or right) --- 2 buttons
   - dissolve sub model --- 1 button
   - Move parts to previous/next step --- 2 buttons
 */
LDR.StepEditor = function(loader, builder, onChange) {
    if(!onChange) {
        throw "Missing callback for step changes!";
    }
    this.loader = loader;
    this.builder = builder;
    this.onChange = onChange;
    this.onStepSelectedListeners = [];

    // Current state variables:
    this.part;
    this.stepIndex;
    this.step;
    
    // Private function to make it easier to create GUI components:
    this.makeEle = function(parent, type, cls, onclick, innerHTML, icon) {
        var ret = document.createElement(type);
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
    var [part, stepIndex] = this.builder.getCurrentPartAndStepIndex();
    this.part = part;
    this.stepIndex = stepIndex;
    this.step = part.steps[stepIndex];
    this.onStepSelectedListeners.forEach(listener => listener());
}

LDR.StepEditor.prototype.createGuiComponents = function(parentEle) {
    this.createRotationGuiComponents(parentEle);
    // TODO Other groups of GUI components: For moving parts (to next), creating and removing steps, dissolving sub-model

    var self = this;
    
    var saveEle;
    function save() {
        var fileContent = self.loader.toLDR();
        saveEle.innerHTML = 'Saving...';
        $.ajax({
                url: 'ajax/save.htm',
                type: 'POST',
                data: {model: 1, content: fileContent},
                dataType: "text",
                success: function(result) {
                    saveEle.innerHTML = 'SAVE ALL';
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
    var saveParentEle = this.makeEle(parentEle, 'span', 'editor_control');
    saveEle = this.makeEle(saveParentEle, 'button', 'save_button', save, 'SAVE ALL');
    this.updateCurrentStep();
}

LDR.StepEditor.prototype.createRotationGuiComponents = function(parentEle) {
    var self = this, Ele, Normal, Rel, Abs, End, X, Y, Z;
    function propagate(rot) {
        console.log('Attempting propagation');
        for(var i = self.stepIndex+1; i < self.part.steps.length; i++) {
            var s = self.part.steps[i];
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
    function makeRotationRadioButton(value, onClick, icon) {
        var button = self.makeEle(Ele, 'input', 'editor_radio_button', onClick);

        var label = self.makeEle(Ele, 'label', 'editor_radio_label', null, value, icon);
        label.setAttribute('for', value);

        button.setAttribute('type', 'radio');
        button.setAttribute('id', value);
        button.setAttribute('name', 'rot_type');
        return button;
    }
    Normal = makeRotationRadioButton('STEP', makeNormal, this.makeStepIcon());
    Rel = makeRotationRadioButton('REL', makeRel, this.makeRelIcon());
    Abs = makeRotationRadioButton('ABS', makeAbs, this.makeAbsIcon());
    End = makeRotationRadioButton('END', makeEnd, this.makeEndIcon());

    function makeXYZ(icon, sub, add, x1, y1, x2, y2) {
        function subOrAdd(fun) {
            var rot = self.step.rotation ? self.step.rotation.clone() : new THREE.LDRStepRotation(0, 0, 0, 'REL');
            fun(rot);
            propagate(rot);
            self.onChange();
        }
        var subEle = self.makeEle(Ele, 'button', 'editor_button', () => subOrAdd(sub), icon+'-', self.makeBoxArrowIcon(x1, y1, x2, y2));
        var ret = self.makeEle(Ele, 'input', 'editor_input', setXYZ);
        var addEle = self.makeEle(Ele, 'button', 'editor_button', () => subOrAdd(add), icon+'+', self.makeBoxArrowIcon(x2, y2, x1, y1));

        ret.addEventListener('keyup', setXYZ);
        ret.addEventListener('keydown', e => e.stopPropagation());
        return ret;
    }
    var rotDiff = 45;
    X = makeXYZ('X', rot => rot.x-=rotDiff, rot => rot.x+=rotDiff, -8, 11, -8, -5);
    Y = makeXYZ('Y', rot => rot.y-=rotDiff, rot => rot.y+=rotDiff, -10, 4, 10, 4);
    Z = makeXYZ('Z', rot => rot.z-=rotDiff, rot => rot.z+=rotDiff, 8, -5, 8, 11);

    function onStepSelected() {
        var rot = self.step.rotation;
        if(!rot) {
            rot = new THREE.LDRStepRotation(0, 0, 0, 'REL');
            if(self.stepIndex === 0 || !self.part.steps[self.stepIndex-1].rotation) {
                Normal.checked = true;
            }
            else {
                // Previous step had a rotation, so this step must be an end step:
                End.checked = true;
            }
        }
        else { // There is currently a rotation:
            if(self.stepIndex === 0 ? (rot.type === 'REL' && rot.x === 0 && rot.y === 0 && rot.z === 0) :
               THREE.LDRStepRotation.equals(rot, self.part.steps[self.stepIndex-1].rotation)) {
                Normal.checked = true;
            }
            else if(rot.type === 'REL') {
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

/**
   SVG Icons for buttons:
*/
LDR.StepEditor.prototype.makeStepIcon = function() {
    var svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-75 -25 150 50');
    LDR.SVG.makeBlock3D(-50, 0, svg);
    LDR.SVG.makeArrow(-20, 0, 20, 0, svg);
    LDR.SVG.makeBlock3D(50, 0, svg);
    return svg;
}
LDR.StepEditor.prototype.makeRelIcon = function() {
    var svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-75 -25 150 50');

    // Left box
    LDR.SVG.makeBlock3D(-50, 0, svg);
    
    // Arrow:
    LDR.SVG.appendRotationCircle(0, 0, 18, svg);

    // Right hand side:
    var g = document.createElementNS(LDR.SVG.NS, 'g');
    svg.appendChild(g);
    g.setAttribute('transform', 'rotate(90 0 0) translate(-50 -55)');
    var turned = LDR.SVG.makeBlock3D(50, 0, g);

    return svg;
}
LDR.StepEditor.prototype.makeAbsIcon = function() {
    var svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-75 -25 150 50');
    LDR.SVG.makeBlock3D(-50, 0, svg);
    LDR.SVG.appendRotationCircle(0, 0, 18, svg);
    svg.append(LDR.SVG.makeRect(37, -13, 24, 31, true));
    return svg;
}
LDR.StepEditor.prototype.makeEndIcon = function() {
    var svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-75 -25 150 50');

    LDR.SVG.makeBlock3D(50, 0, svg);
    LDR.SVG.appendRotationCircle(0, 0, 18, svg);

    var g = document.createElementNS(LDR.SVG.NS, 'g');
    svg.appendChild(g);
    g.setAttribute('transform', 'rotate(90 0 0) translate(50 55)');
    var turned = LDR.SVG.makeBlock3D(-50, 0, g);

    return svg;
}
LDR.StepEditor.prototype.makeBoxArrowIcon = function(x1, y1, x2, y2) {
    var svg = document.createElementNS(LDR.SVG.NS, 'svg');
    svg.setAttribute('viewBox', '-20 -20 40 40');
    LDR.SVG.makeBlock3D(0, 0, svg);
    LDR.SVG.makeArrow(x1, y1, x2, y2, svg);
    return svg;
}

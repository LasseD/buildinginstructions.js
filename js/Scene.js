'use strict';

var ENV = {};

ENV.DEFAULT_FOV = 20; // Camera frustrum vertical field of view.

ENV.Scene = function(canvas) {
    let self = this;

    this.controllers = [];
    this.activeControllerIndex = 0;

    this.floor;
    this.hemisphereLight;

    this.scene = new THREE.Scene();

    // Set up renderer:
    this.renderer = new THREE.WebGLRenderer({canvas:canvas, antialias: true});
    this.renderer.setPixelRatio(window.devicePixelRatio);
    //this.renderer.gammaInput = true; // Use gamma correction if the intersection of lights bothers you.
    //this.renderer.gammaOutput = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Default is PCFShadowMap
    this.renderer.shadowMapSoft = true;

    // Set up camera:
    this.camera = new THREE.PerspectiveCamera(ENV.DEFAULT_FOV, 16/9.0, 0.1, 100000);
    let orbitControls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    orbitControls.addEventListener('change', () => self.onCameraMoved());
    orbitControls.handleKeys = false;
    this.controllers.push(new ENV.CameraController(this, orbitControls));
    
    // Rendering elements:
    this.baseObject = new THREE.Group();
    let opaqueObject = new THREE.Group();
    let transObject = new THREE.Group();
    this.baseObject.add(opaqueObject); // Draw non-trans before trans.
    this.baseObject.add(transObject);
    this.scene.add(this.baseObject);
    this.mc = new LDR.MeshCollector(opaqueObject, transObject);

    function handleKeyDown(e) {
        e = e || window.event;
        if(e.altKey) {
	    // Don't handle key events when ALT is pressed, as they browser-level overwrites!
	    return;
        }
        //console.dir(e);
        let c = self.controllers[self.activeControllerIndex];
        if(e.keyCode === 37) { // Left:
            c.deactivate();
            self.activeControllerIndex--;
            if(self.activeControllerIndex < 0) {
                self.activeControllerIndex = self.controllers.length-1;
            }
            c = self.controllers[self.activeControllerIndex];
            c.activate();
        }
        else if (e.keyCode === 39) { // Right:
            c.deactivate();
            self.activeControllerIndex++;
            if(self.activeControllerIndex === self.controllers.length) {
                self.activeControllerIndex = 0;
            }
            c = self.controllers[self.activeControllerIndex];
            c.activate();
        }
        else if(e.keyCode === 8 || e.keyCode === 46) { // DELETE
            self.removeLight();
        }
        else if(e.keyCode === 79) { // O
            self.addDirectionalLight(0xFFFFFF, 1, 0, self.size.w+self.size.l, self.size.h);
        }
        else if(e.keyCode === 80) { // P
            self.addPointLight(0xFFFFFF, 1, 0, self.size.w+self.size.l, self.size.h);
        }
        else {
            self.controllers[self.activeControllerIndex].handleKey(e.keyCode, e.shiftKey);
        }
        self.render();
    }
    document.onkeydown = handleKeyDown;

    //RectAreaLightUniformsLib.init();
}

ENV.Scene.prototype.render = function() {
    this.renderer.render(this.scene, this.camera);
}

ENV.Scene.prototype.onCameraMoved = function() {
    let cameraDist = this.camera.position.length();
    this.camera.near = Math.max(0.5, cameraDist - this.size.diam*3);
    this.camera.far = cameraDist + this.size.diam*3;

    this.camera.updateProjectionMatrix();
    this.render();
}

ENV.Scene.prototype.onChange = function(eleW, eleH) {
    this.renderer.setSize(eleW, eleH);
    this.camera.aspect = eleW/eleH;
    this.onCameraMoved();
}

ENV.Scene.prototype.addPointLight = function(color, intensity, angle, dist, y) {
    let light = new THREE.PointLight(color, intensity, 2*(dist+y));
    
    light.castShadow = true;
    light.shadow.mapSize.width = Math.floor(2.5*this.size.diam); // Adjust according to size!
    light.shadow.mapSize.height = Math.floor(2.5*this.size.diam);
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 2*(dist+y);

    let h = new THREE.PointLightHelper(light, 5, 0xFF0000);

    let c = new ENV.LightController(this, light, h, angle, dist, y);
    this.controllers.push(c);
    this.activeControllerIndex = this.controllers.length-1;
}

ENV.Scene.prototype.addDirectionalLight = function(color, intensity, angle, dist, y) {
    let light = new THREE.DirectionalLight(color, intensity, 2*(dist+y));
    
    light.castShadow = true;
    let diam = this.size.diam;
    light.shadow.mapSize.width = Math.floor(2.5*diam); // Adjust according to size!
    light.shadow.mapSize.height = Math.floor(2.5*diam);
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 2*(dist+y);
    light.shadow.camera.left = -diam;
    light.shadow.camera.right = diam;
    light.shadow.camera.top = diam;
    light.shadow.camera.bottom = -diam;

    let h = new THREE.DirectionalLightHelper(light, 5, 0x0000FF);

    let c = new ENV.LightController(this, light, h, angle, dist, y);
    this.controllers.push(c);
    this.activeControllerIndex = this.controllers.length-1;
}

/*
ENV.Scene.prototype.addRectAreaLight = function(color, intensity, angle, dist, y) {
    let light = new THREE.RectAreaLight(color, intensity, this.size, this.size);
    light.origAngle = light.angle = angle;
    light.origDist = light.dist = dist;
    light.origY = light.y = y;

    //light.castShadow = true; // Shadows not yet supported!
    light.add(new THREE.RectAreaLightHelper(light));

    console.dir(light);

    this.scene.add(light);
}*/

ENV.Scene.prototype.removeLight = function() {
    let c = this.controllers[this.activeControllerIndex];
    if(!c.isLightController) {
        console.warn('Not a light!');
        return;
    }

    c.kill();

    this.controllers = this.controllers.filter(cc => cc !== c);
    if(this.activeControllerIndex === this.controllers.length) {
        this.activeControllerIndex = this.controllers.length-1;
    }
    this.render();
}

ENV.Scene.prototype.setHemisphereLight = function(sky, ground, intensity) {
    let light = new THREE.HemisphereLight(sky, ground, intensity);
    if(this.hemisphereLight) {
        this.scene.remove(this.hemisphereLight);
    }
    this.hemisphereLight = light;
    this.scene.add(light);
}

ENV.Scene.prototype.resetCamera = function() {
    let cameraDist = 2*this.size.diam;
    this.baseObject.position.y = -this.size.h/2;
    this.camera.position.set(cameraDist, 0.7*cameraDist, cameraDist);
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));
}

ENV.Scene.prototype.buildStandardScene = function() {
    let self = this;
    let b = this.mc.boundingBox || new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1,1,1)); // To build scene around.
    let w = b.max.x-b.min.x, l = b.max.z-b.min.z, h = b.max.y-b.min.y;
    this.size = {w:w, l:l, h:h, diam:Math.sqrt(w*w + l*l + h*h)};

    // Set up camera:
    this.resetCamera();
    
    // Scene:
    this.scene.background = new THREE.Color(0x77777A);

    // Subject:
    var elementCenter = new THREE.Vector3();
    b.getCenter(elementCenter);
    this.baseObject.position.set(-elementCenter.x, -elementCenter.y, -elementCenter.z);
    //this.baseObject.add(new THREE.Box3Helper(b, 0xFF00FF));

    // Floor:
    if(this.floor) {
        this.scene.remove(this.floor);
    }
    let floorSize = 4 * this.size.diam;
    var floorGeometry = new THREE.PlaneBufferGeometry(floorSize, floorSize);
    var floorMaterial = new THREE.MeshStandardMaterial({
            color: 0xFEFEFE,
            metalness: 0.0,
            roughness: 0.9,
        });
    this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
    this.floor.rotation.x = -Math.PI/2;
    this.floor.position.y = b.min.y - 0.001; // -0.001 to avoid floor clipping issues on large models.
    this.floor.receiveShadow = true;
    this.baseObject.add(this.floor);

    // Lights:
    this.addPointLight(0xF6E3FF, 0.70,  1.1, this.size.w*1.5, this.size.h*2.0);
    this.addPointLight(0xF7E5FD, 0.65,  0.8, this.size.w*1.3, this.size.h*1.7);
    //this.addDirectionalLight(0xF6E3FF, 0.35,  -0.1, this.size.w*1.5, this.size.h*2.0);

    this.activeControllerIndex = 0; // Since adding point lights changes this.

    this.setHemisphereLight(0xF4F4FB, 0x30302B, 0.45);
}

ENV.CameraController = function(scene, orbitControls) {
    this.isCameraController = true;
    
    const PAN_SPEED = 20;

    this.handleKey = (key,shift) => {
        switch(key) {
        case 27: // ESC
          scene.resetCamera();
          break;
        case 65: // A
          scene.baseObject.rotation.y += 0.1;
          scene.render();
          break;
        case 67: // C
          console.log(shift);
          LDR.Colors[16].m.color = new THREE.Color(LDR.Colors[shift ? 1 : 4].value); // Set main color.
          LDR.Colors[16].m.needsUpdate = true;
          scene.render();
          break;
        case 68: // D
          scene.baseObject.rotation.y -= 0.1;
          scene.render();
          break;
        case 69: // E
          orbitControls.dollyOut(1.1);
          orbitControls.update();
          break;
        case 70: // F
          scene.camera.fov += (shift ? 5 : -5);
          scene.camera.updateProjectionMatrix();
          scene.render();
          break;
        case 81: // Q
          orbitControls.dollyIn(1.1);
          orbitControls.update();
          break;
        case 82: // R
          scene.hemisphereLight.intensity += (shift ? 0.05 : -0.05);
          scene.render();
          break;
        case 83: // S
          scene.baseObject.position.y -= scene.size.h * 0.1;
          scene.render();
          break;
        case 87: // W
          scene.baseObject.position.y += scene.size.h * 0.1;
          scene.render();
          break;
        }
    }

    this.activate = () => {};
    this.deactivate = () => {};
}

ENV.LightController = function(scene, light, h, angle, dist, y) {
    let self = this;
    this.isLightController = true;

    const origAngle = angle;
    const origDist = dist;
    const origY = y;
    h.visible = false;
    scene.scene.add(light);
    scene.scene.add(h);

    this.kill = function() {
        let self = this;
        self.deactivate();
        scene.scene.remove(h);
        scene.scene.remove(light);
    }

    this.update = function() {
        light.position.set(Math.cos(angle)*dist, 
                           y, 
                           Math.sin(angle)*dist);
        light.lookAt(0,0,0);
        h.update();
        //console.log('Light at angle=' + (angle/origAngle) + ', dist=' + (dist/origDist) + ', y=' + (y/origY)) + ' (In comparison to original position)';
    }
    this.update();

    this.reset = function() {
        y = origY;
        dist = origDist;
        angle = origAngle;
    }

    this.handleKey = (key,shift) => {
        switch(key) {
        case 65: // A
        angle += 0.1;
        break;
        case 68: // D
        angle -= 0.1;
        break;
        case 87: // W
        y += origY*0.1;
        break;
        case 83: // S
        y -= origY*0.1;
        break;
        case 81: // Q
        dist += origDist*0.1;
        break;
        case 82: // R
        light.intensity += (shift ? 0.05 : -0.05);
        break;
        case 69: // E
        dist -= origDist*0.1;
        break;
        case 27: // ESC
        self.resetLight();
        break;
        }
        self.update();
        scene.render();
    }

    this.activate = () => h.visible = true;
    this.deactivate = () => h.visible = false;
}

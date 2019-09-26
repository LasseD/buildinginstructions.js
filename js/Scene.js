'use strict';

var ENV = {};

ENV.DEFAULT_FOV = 20; // Camera frustrum vertical field of view.

ENV.Scene = function(canvas) {
    let self = this;

    this.controllers = [];
    this.activeControllerIndex = 0;

    this.hemisphereLight;

    this.scene = new THREE.Scene();
    this.R; // Radius of floor.
    this.sides = [null, null, null, null, null]; // floor, N, E, S, W

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
    this.orbitControls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.addEventListener('change', () => self.onCameraMoved());
    this.orbitControls.handleKeys = false;
    this.controllers.push(new ENV.CameraController(this));
    
    // Rendering elements:
    this.baseObject = new THREE.Group();
    let opaqueObject = new THREE.Group();
    let transObject = new THREE.Group();
    this.baseObject.add(opaqueObject); // Draw non-trans before trans.
    this.baseObject.add(transObject);
    this.scene.add(this.baseObject);
    this.mc = new LDR.MeshCollector(opaqueObject, transObject);

    // Buttons:
    this.moveControllersLeft = function() {
        c.deactivate();
        self.activeControllerIndex--;
        if(self.activeControllerIndex < 0) {
            self.activeControllerIndex = self.controllers.length-1;
        }
        c = self.controllers[self.activeControllerIndex];
        c.activate();
    }
    this.moveControllersRight = function() {
        c.deactivate();
        self.activeControllerIndex++;
        if(self.activeControllerIndex === self.controllers.length) {
            self.activeControllerIndex = 0;
        }
        c = self.controllers[self.activeControllerIndex];
        c.activate();        
    }

    // Keys:
    function handleKeyDown(e) {
        e = e || window.event;
        if(e.altKey) {
	    // Don't handle key events when ALT is pressed, as they browser-level overwrites!
	    return;
        }
        //console.dir(e);
        let c = self.controllers[self.activeControllerIndex];
        if(e.keyCode === 37) { // Left:
            self.moveControllersLeft();
        }
        else if (e.keyCode === 39) { // Right:
            self.moveControllersRight();
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

ENV.Scene.prototype.repositionFloor = function(dist) {
    let height = this.mc.boundingBox.min.y - dist;

    this.sides[0].position.y = height; // Floor

    for(let i = 1; i < 5; i++) { // Update the four sides:
        this.sides[i].position.y = height + this.R;
    }
}

ENV.Scene.prototype.buildStandardScene = function() {
    let self = this;
    let b = this.mc.boundingBox || new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1,1,1)); // To build scene around.
    let bump = x => Math.max(100, x);
    let w = bump(b.max.x-b.min.x), l = bump(b.max.z-b.min.z), h = bump(b.max.y-b.min.y);
    this.size = {w:w, l:l, h:h, diam:Math.sqrt(w*w + l*l + h*h)};

    // Set up camera:
    this.resetCamera();
    
    // Subject:
    var elementCenter = new THREE.Vector3();
    b.getCenter(elementCenter);
    this.baseObject.position.set(-elementCenter.x, -elementCenter.y, -elementCenter.z);
    //this.baseObject.add(new THREE.Box3Helper(b, 0xFF00FF));

    // Floor and sides:
    let R = this.R = 1.6 * this.size.diam;
    var floorGeometry = new THREE.PlaneBufferGeometry(2*R, 2*R);
    var floorMaterial = new THREE.MeshStandardMaterial({
            color: 0xFEFEFE,
            metalness: 0.0,
            roughness: 0.0,
            normalMap: ENV.createFloorTexture(64, Math.floor(R/2)),
        });
    var sideMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            metalness: 0.0,
            roughness: 1.0,
        });
    for(let i = 0; i < 5; i++) {
        this.sides[i] = new THREE.Mesh(floorGeometry, i === 0 ? floorMaterial : sideMaterial);
        this.sides[i].receiveShadow = true;
        this.baseObject.add(this.sides[i]);
    }

    // Floor:
    let floor = this.sides[0];
    floor.rotation.x = -Math.PI/2;

    // Sides:
    let sidePositionX = [0, R, 0, -R];
    let sidePositionZ = [-R, 0, R, 0];
    let sideRotation = [0, -Math.PI/2, Math.PI, Math.PI/2];
    for(let i = 0; i < 4; i++) {
        let side = this.sides[i+1];
        side.position.x = sidePositionX[i];
        side.position.z = sidePositionZ[i];
        side.rotation.y = sideRotation[i];
    }

    this.repositionFloor(0.001); // -0.001 to avoid floor clipping issues on large models.

    // Lights:
    this.addPointLight(0xF6E3FF, 0.70,  1.1, this.size.w*1.5, this.size.h*2.0);
    //this.addPointLight(0xF7E5FD, 0.65,  0.8, this.size.w*1.3, this.size.h*1.7);
    //this.addDirectionalLight(0xF6E3FF, 0.35,  -0.1, this.size.w*1.5, this.size.h*2.0);

    this.activeControllerIndex = 0; // Since adding point lights changes this.

    this.setHemisphereLight(0xF4F4FB, 0x30302B, 0.65);
}

ENV.CameraController = function(scene) {
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
        case 68: // D
          scene.baseObject.rotation.y -= 0.1;
          scene.render();
          break;
        case 69: // E
          scene.orbitControls.dollyOut(1.1);
          scene.orbitControls.update();
          break;
        case 70: // F
          scene.camera.fov += (shift ? 5 : -5);
          scene.camera.updateProjectionMatrix();
          scene.render();
          break;
        case 81: // Q
          scene.orbitControls.dollyIn(1.1);
          scene.orbitControls.update();
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

ENV.createFloorTexture = function(size, repeats) {
    if(ENV.FloorTexture)
        return ENV.FloorTexture;

    let canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;

    let ctx = canvas.getContext("2d");
    ctx.fillStyle = 'rgb(128,128,255)';
    ctx.fillRect(0, 0, size, size);

    const M = size/2;
    const EDGE = 0.5;
    let toColor = x => 128 + Math.round(127*x);

    for(let y = 0; y < size; y++) {
        let Y = (y < M) ? y*2 : (y-M)*2;
        for (let x = 0; x < size; x++) {
            let X = y < M ? x : (x+M > size ? x+M-size : x+M);

            let dx = (M-X)/M, dy = (M-Y)/M;
            let D = dx*dx + dy*dy;
            if(D > 1) {
                continue;
            }
            let DD = 1-D;
            if(DD < EDGE) { // Blend back to blue: dx/dy -> 0 as EDGE -> DD -> 0
                dx *= 1-(EDGE-DD)/EDGE;
                dy *= 1-(EDGE-DD)/EDGE;
            }
            
            let dz = Math.sqrt(1 - dx*dx - dy*dy);//Math.asin(dy);

            ctx.fillStyle = 'rgb(' + toColor(dx) + ',' + toColor(dy) + ',' + toColor(dz) + ')';
            ctx.fillRect(x, y, 1, 1);
        }
    }

    let texture = new THREE.Texture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeats, repeats);
    texture.needsUpdate = true; // Otherwise canvas will not be applied.
    document.body.appendChild(canvas);
    return ENV.FloorTexture = texture;
}
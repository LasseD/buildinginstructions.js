'use strict';

var ENV = {};

ENV.FOV = 20; // Camera frustrum vertical field of view.

ENV.Scene = function() {
    let self = this;
    this.floor;
    this.hemisphereLight;
    this.lights = [];

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 16/9.0, 0.1, 100000);

    // Set up renderer:
    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.renderer.setPixelRatio(window.devicePixelRatio);
    //this.renderer.gammaInput = true; // TODO: Is this just for metals?
    //this.renderer.gammaOutput = true; // TODO: Is this just for metals?
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Default is PCFShadowMap

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
        if(e.keyCode === 65) { // A:
            self.rotateLights(.1);
        }
        else if (e.keyCode === 68) { // D:
            self.rotateLights(-.1);
        }
        else if (e.keyCode === 69) { // E:
            self.distanceLights(.1);
        }
        else if(e.keyCode === 81) { // Q:
            self.distanceLights(-.1);
        }
        else if(e.keyCode === 83) { // S:
            self.raiseLights(-.05);
        }
        else if(e.keyCode === 87) { // W:
            self.raiseLights(.05);
        }
        else if(e.keyCode === 27) { // ESC:
	    self.resetLights();
        }
    }    
    document.onkeydown = handleKeyDown;

    //RectAreaLightUniformsLib.init();

    LDR.Colors.loadTextures();
}

ENV.Scene.prototype.render = function() {
    this.renderer.render(this.scene, this.camera);
}

ENV.Scene.prototype.onChange = function(eleW, eleH) {
    this.renderer.setSize(eleW, eleH);
    this.camera.aspect = eleW/eleH;
    this.camera.updateProjectionMatrix();
    this.render();
}

ENV.Scene.prototype.addPointLight = function(size, color, intensity, angle, dist, y) {
    let diam = Math.sqrt(size.w*size.w + size.l*size.l);

    let light = new THREE.PointLight(color, intensity, 2*dist);
    light.origAngle = light.angle = angle;
    light.origDist = light.dist = dist;
    light.origY = light.y = y;

    light.castShadow = true;
    light.shadow.mapSize.width = Math.floor(2.5*diam); // Adjust according to size!
    light.shadow.mapSize.height = Math.floor(2.5*diam);
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 2*(dist+y);

    this.scene.add(light);
    this.lights.push(light);
}

ENV.Scene.prototype.addRectAreaLight = function(size, color, intensity, angle, dist, y) {
    let light = new THREE.RectAreaLight(color, intensity, size, size);
    light.origAngle = light.angle = angle;
    light.origDist = light.dist = dist;
    light.origY = light.y = y;

    //light.castShadow = true; // Shadows not yet supported!
    light.add(new THREE.RectAreaLightHelper(light));

    console.dir(light);

    this.scene.add(light);
    this.lights.push(light);
}

ENV.Scene.prototype.clearLights = function() {
    this.lights.forEach(light => self.scene.remove(light));
    this.lights = [];
}

ENV.Scene.prototype.reorientLights = function() {
    this.lights.forEach(light => {
            light.position.set(Math.cos(light.angle)*light.dist, 
                               light.y, 
                               Math.sin(light.angle)*light.dist);
            light.lookAt(0,0,0);
        });
    this.render();
    console.log('Lights at');
    this.lights.forEach(l => console.log('angle=' + l.angle + ', dist=' + l.dist + ', y=' + l.y));
}

ENV.Scene.prototype.rotateLights = function(v) {
    this.lights.forEach(light => light.angle += v);
    this.reorientLights();
}

ENV.Scene.prototype.raiseLights = function(v) {
    this.lights.forEach(light => light.y += light.origY*v);
    this.reorientLights();
}

ENV.Scene.prototype.distanceLights = function(v) {
    this.lights.forEach(light => light.dist += light.origDist*v);
    this.reorientLights();
}

ENV.Scene.prototype.resetLights = function() {
    this.lights.forEach(light => {
            light.y = light.origY;
            light.dist = light.origDist;
            light.angle = light.origAngle;
        });
    this.reorientLights();
}

ENV.Scene.prototype.setHemisphereLight = function(sky, ground, intensity) {
    let light = new THREE.HemisphereLight(sky, ground, intensity);
    if(this.hemisphereLight) {
        this.scene.remove(this.hemisphereLight);
    }
    this.hemisphereLight = light;
    this.scene.add(light);
}

ENV.Scene.prototype.buildStandardScene = function() {
    let self = this;
    let b = this.mc.boundingBox; // To build scene around.
    let size = {w:b.max.x-b.min.x, l:b.max.z-b.min.z, h:b.max.y-b.min.y};

    // Set up camera:
    let cameraDist = 1.8*Math.max(size.w, size.l, size.h);
    this.camera.position.set(cameraDist, cameraDist, cameraDist);
    this.camera.lookAt(new THREE.Vector3());
    
    // Scene:
    this.scene.background = new THREE.Color(0x303030);

    // Subject:
    var elementCenter = new THREE.Vector3();
    b.getCenter(elementCenter);
    this.baseObject.position.set(-elementCenter.x, -b.min.y, -elementCenter.z);
    //this.baseObject.add(new THREE.Box3Helper(b, 0xFF00FF));

    // Floor:
    if(this.floor) {
        this.scene.remove(this.floor);
    }
    let floorSize = 15 * Math.max(size.w, size.l);
    var floorGeometry = new THREE.PlaneBufferGeometry(floorSize, floorSize);
    var floorMaterial = new THREE.MeshStandardMaterial({
            color: 0xFEFEFE,
            metalness: 0.0,
            roughness: 0.9,
        });
    this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
    this.floor.rotation.x = -Math.PI/2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    // Lights:
    this.clearLights();

    this.addPointLight(size, 0xF6E3FF, 0.73,  0.8, size.w*1.5, size.h*2.0);
    this.addPointLight(size, 0xE6F3FF, 0.55, -0.1, size.w*0.7, size.h*2.6);
    this.reorientLights();
    
    this.setHemisphereLight(0xF4F4FB, 0x30302B, 0.25);
}
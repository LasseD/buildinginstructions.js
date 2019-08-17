'use strict';

var ENV = {};

ENV.FOV = 40; // Camera frustrum vertical field of view.

ENV.Scene = function(eleW, eleH) {
    this.floor;
    this.ambientLight;
    this.pointLights = [];

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, eleW/eleH, 0.1, 100000);

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

    LDR.Colors.loadTextures();
}

ENV.Scene.prototype.render = function() {
    this.renderer.render(this.scene, this.camera);
}

ENV.Scene.prototype.onChange = function(eleW, eleH) {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = eleW/eleH;
    this.camera.updateProjectionMatrix();
    this.render();
}

ENV.Scene.prototype.addPointLight = function(size, color, intensity, x, y, z) {
    let dist = Math.sqrt(x*x+y*y+z*z);
    let diam = Math.sqrt(size.w*size.w + size.l*size.l);
    //console.log('Creating light at ' + x + ', ' + y + ', ' + z + ', dist: ' + dist + ', diameter of subject: ' + diam);

    let light = new THREE.PointLight(color, intensity, 2*dist);
    light.position.set(x, y, z);
    light.castShadow = true;

    light.shadow.mapSize.width = Math.floor(2*diam); // Adjust according to size!
    light.shadow.mapSize.height = Math.floor(2*diam);
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 2*dist;

    this.scene.add(light);
    this.pointLights.push(light);
}

ENV.Scene.prototype.clearPointLights = function() {
    this.pointLights.forEach(light => self.scene.remove(light));
    this.pointLights = [];
}

ENV.Scene.prototype.setAmbientLight = function(color, intensity) {
    let light = new THREE.AmbientLight(color, intensity);
    if(this.ambientLight) {
        this.scene.remove(this.ambientLight);
    }
    this.ambientLight = light;
    this.scene.add(light);
}

ENV.Scene.prototype.buildStandardScene = function() {
    let self = this;
    let b = this.mc.boundingBox; // To build scene around.
    let size = {w:b.max.x-b.min.x, l:b.max.z-b.min.z, h:b.max.y-b.min.y};

    // Set up camera:
    let cameraDist = 1.5*Math.max(size.w, size.l, size.h);
    this.camera.position.set(cameraDist, 0.55*cameraDist, cameraDist);
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

    // Point lights:
    this.clearPointLights();
    this.addPointLight(size, 0xF6E3FF, 0.7, 0.8*size.w, 4*size.h, 1.7*size.l);
    this.addPointLight(size, 0xE6F3FF, 0.7, 0.8*size.w, 5*size.h, -1.7*size.l);
    this.addPointLight(size, 0xE6F3FF, 0.4, -1.2*size.w, 4*size.h, 0.3*size.l);
    
    // Ambient light:
    this.setAmbientLight(0xFFFFFF, 0.2);
}
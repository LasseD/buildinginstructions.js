'use strict';

var ENV = {};

ENV.DEFAULT_FOV = 20; // Camera frustrum vertical field of view.

ENV.Scene = function(canvas, color) {
    let self = this;
    this.modelColor = color || 16;

    this.pointLights = [];
    this.directionalLights = [];
    this.hemisphereLight;

    this.scene = new THREE.Scene();
    this.roomObject = new THREE.Group();
    this.scene.add(this.roomObject);
    this.R; // Radius of floor.
    this.floor;

    // Set up renderer:
    this.renderer = new THREE.WebGLRenderer({canvas:canvas, antialias: true});
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Default is PCFShadowMap
    this.renderer.shadowMapSoft = true;

    // Set up camera:
    this.camera = new THREE.PerspectiveCamera(ENV.DEFAULT_FOV, 16/9.0, 0.1, 100000);
    this.orbitControls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.addEventListener('change', () => self.onCameraMoved());
    this.orbitControls.handleKeys = false;
    this.orbitControls.screenSpacePanning = true;
    
    // Rendering elements:
    this.reset();

    // Light and background:
    this.hemisphereLight = new THREE.HemisphereLight(0xF4F4FB, 0x30302B, 0.65);
    this.scene.add(this.hemisphereLight);
    this.scene.background = new THREE.Color(0xFBF3FF);
}

ENV.Scene.prototype.reset = function() {
    if(this.baseObject) {
        this.scene.remove(this.baseObject);
    }
    this.baseObject = new THREE.Group();
    let opaqueObject = new THREE.Group();
    let sixteenObject = new THREE.Group();
    let transObject = new THREE.Group();
    this.baseObject.add(opaqueObject); // Draw non-trans before trans.
    this.baseObject.add(sixteenObject);
    this.baseObject.add(transObject);
    this.scene.add(this.baseObject);
    this.mc = new LDR.MeshCollector(opaqueObject, sixteenObject, transObject);
}

ENV.Scene.prototype.setUpGui = function(setModelColorOriginal, canSetColor = true) {
    let self = this;
    let size = this.size;
    let r = () => {self.camera.updateProjectionMatrix(); self.render()};

    // dat.GUI setup:
    let options = {
        scene: {
            background: '#A0A0A2',
            floor: {
                color: '#FFFFFF',
            }
        },
        model: {
        },
        hemisphereLight: {
            color: "#F4F4FB",
            groundColor: "#30302B",
        }
    };
    if(canSetColor) {
        options.model.color = self.modelColor;
    }

    let gui = new dat.GUI({autoPlace: false});    
    {
        let c = gui.addFolder('Camera');
	let d = Math.max(size.w, size.l)*5;
        c.add(this.camera.position, 'x', -d, d).listen().onChange(r);
        c.add(this.camera.position, 'y', -5*size.h, 5*size.h).listen().onChange(r);
        c.add(this.camera.position, 'z', -d, d).listen().onChange(r);
        c.add(this.camera, 'fov', 1, 150).listen().onChange(r);
        c.add(self, 'resetCamera').name('Reset');
    }
    {
        let c = gui.addFolder('Scene');
        //this.scene
        function setBGColor(v) {
            self.scene.background = new THREE.Color(v);
            self.render();
        }
        c.addColor(options.scene, 'background').onChange(setBGColor);
        if(this.floor) {
            c.add(this.floor.material, 'visible').name('floor').listen().onChange(r);
            function setFloorColor(v) {
                self.floor.material.color = new THREE.Color(v);
                self.render();
            }
            c.addColor(options.scene.floor, 'color').name('floor color').onChange(setFloorColor);
        }
    }
    {
        let c = gui.addFolder('Model');
        let c1 = c.addFolder('Position');
        c1.add(this.baseObject.position, 'x', -size.w, size.w).listen().onChange(r);
        c1.add(this.baseObject.position, 'y', -size.h, size.h).listen().onChange(r);
        c1.add(this.baseObject.position, 'z', -size.l, size.l).listen().onChange(r);
        let c2 = c.addFolder('Rotation');
        c2.add(this.baseObject.rotation, 'x', -Math.PI, Math.PI).listen().onChange(r);
        c2.add(this.baseObject.rotation, 'y', -Math.PI, Math.PI).listen().onChange(r);
        c2.add(this.baseObject.rotation, 'z', -Math.PI, Math.PI).listen().onChange(r);
        if(LDR.Colors[16].m) { // Be able to set color:
            let choices = {};
            for(let idx in LDR.Colors) {
                if(idx !== "16" && idx !== "24" && LDR.Colors.hasOwnProperty(idx)) {
                    let color = LDR.Colors[idx];
                    if(color.hasOwnProperty('edge') && !color.hasOwnProperty('material') && !color.hasOwnProperty('luminance')) { // No special materials - only ABS and normal trans:
                        choices[idx + ' ' + color.name.replace(/\_/gi, ' ')] = idx;
                    }
                }
            }
            self.setModelColor = function(idx) {
                // Copy material settings:
                const m = LDR.Colors.buildStandardMaterial(idx);
                const M = LDR.Colors[16].m;
                M.color = m.color;
                M.roughness = m.roughness;
                M.metalness = m.metalness;
                M.envMapIntensity = m.envMapIntensity;
                M.transparent = m.transparent;
                M.opacity = m.opacity;
                M.shininess = m.shininess;
                M.reflectivity = m.reflectivity;
                M.specular = m.specular;
                self.mc.overwrittenColor = idx;

                LDR.Colors.loadTextures(() => {M.normalMap = m.normalMap; M.needsUpdate = true; self.render();});
		setModelColorOriginal && setModelColorOriginal(idx);
            }
	    if(canSetColor) {
		c.add(options.model, 'color', choices).onChange(idx => self.setModelColor(idx));
		c.open(); // Open the folder by default if color can be set.
	    }
        }
	else {
	    self.setModelColor = () => {}; // No option to change color if no color 16 is present.
	}
    }
    {
        let c = gui.addFolder('Hemisphere Light');
        c.add(self.hemisphereLight, 'intensity', 0.0, 1.0).listen().onChange(r);
        function setColor(v) {
            self.hemisphereLight.color = new THREE.Color(v);
            self.render();
        }
        c.addColor(options.hemisphereLight, 'color').onChange(setColor);
        function setGroundColor(v) {
            self.hemisphereLight.groundColor = new THREE.Color(v);
            self.render();
        }
        c.addColor(options.hemisphereLight, 'groundColor').name('ground color').onChange(setGroundColor);
    }
    {
        let c = gui.addFolder('Point Lights');
        this.addPL = function() {
            let light = self.addPointLight();
            self.registerLight(light, c);
            self.render();
        }
        c.add(self, 'addPL').name('Add Point Light');
        this.pointLights.forEach(light => self.registerLight(light, c));
    }
    {
        let c = gui.addFolder('Directional Lights');
        this.addDL = function() {
            let light = self.addDirectionalLight();
            self.registerLight(light, c);
            self.render();
        }
        c.add(self, 'addDL').name('Add Dir. Light');
        this.directionalLights.forEach(light => self.registerLight(light, c));
    }

    gui.close();

    this.renderer.domElement.parentElement.appendChild(gui.domElement);
}

ENV.Scene.prototype.render = function() {
    if(this.composer) {
        this.composer.render();
    }
    else {
        this.renderer.render(this.scene, this.camera);
    }
}

ENV.Scene.prototype.onCameraMoved = function() {
    if(!this.size) {
	return; // Called before ready
    }
    let cameraDist = this.camera.position.length();
    this.camera.near = Math.max(0.5, cameraDist - this.size.diam*3);
    this.camera.far = cameraDist + this.size.diam*4;

    this.camera.updateProjectionMatrix();
    this.render();
}

ENV.Scene.prototype.onChange = function(eleW, eleH) {
    this.renderer.setSize(eleW, eleH);
    this.camera.aspect = eleW/eleH;

    this.composer = new THREE.EffectComposer(this.renderer);
    this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));
    if(!this.mc.attachGlowPasses(eleW, eleH, this.scene, this.camera, this.composer)) {
        this.composer = null;
    }

    this.onCameraMoved();
}

ENV.Scene.prototype.addPointLight = function() {
    const color = 0xF6E3FF;
    const intensity = 0.7;
    const dist = this.size.w*1.5;
    const y = this.size.h*2;
    let light = new THREE.PointLight(color, intensity, 2*(dist+y));
    
    light.castShadow = true;
    light.shadow.mapSize.width = Math.floor(2.5*this.size.diam); // Adjust according to size!
    light.shadow.mapSize.height = Math.floor(2.5*this.size.diam);
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 2*(dist+y);
    light.shadow.radius = 8; // Soft shadow
    light.position.set(dist, y, dist);

    this.scene.add(light);
    this.pointLights.push(light);
    return light;
}

ENV.Scene.prototype.addDirectionalLight = function() {
    const dist = this.size.w*1.5;
    const y = this.size.h;
    const diam = this.size.diam;

    let light = new THREE.DirectionalLight(0xF6E3FF, 0.4); // color, intensity
    light.position.set(-0.05*dist, y, -0.02*dist);
    light.lookAt(0,0,0);
    
    light.castShadow = true;
    light.shadow.mapSize.width = Math.floor(3*diam); // Adjust according to size!
    light.shadow.mapSize.height = Math.floor(3*diam);
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 3.5*(dist+y);
    light.shadow.camera.left = -diam;
    light.shadow.camera.right = diam;
    light.shadow.camera.top = diam;
    light.shadow.camera.bottom = -diam;
    light.shadow.radius = 8; // Soft shadow

    this.scene.add(light);
    this.directionalLights.push(light);
    return light;
}

ENV.LightIdx = 1;
ENV.Scene.prototype.registerLight = function(light, folder) {
    let self = this;
    let h = light.type === "PointLight" ?
      new THREE.PointLightHelper(light, 5, 0xFF0000) :
      new THREE.DirectionalLightHelper(light, 5, 0x0000FF);
    h.visible = false;
    this.scene.add(h);

    let size = this.size;

    function r() {
        light.lookAt(0,0,0);
        self.render();
    }

    let c = folder.addFolder('Light ' + ENV.LightIdx++);
    c.add(light.position, 'x', -10*size.w, 10*size.w).onChange(r);
    c.add(light.position, 'y', -size.h, 5*size.h).onChange(r);
    c.add(light.position, 'z', -10*size.l, 10*size.l).onChange(r);
    c.add(light, 'intensity', 0.0, 1.0).onChange(r);
    function setColor(v) {
        light.color = new THREE.Color(v);
        h.update();
        r();
    }
    let options = {
        color: '#FFFFFF',
        Remove: function(){self.scene.remove(light); self.scene.remove(h); folder.removeFolder(c); r();},
    };
    c.addColor(options, 'color').onChange(setColor);
    c.add(h, 'visible').name('show helper').onChange(r);
    c.add(options, 'Remove');
    c.open();
}

ENV.Scene.prototype.resetCamera = function() {
    let cameraDist = 2*this.size.diam;
    this.camera.position.set(cameraDist, 0.65*cameraDist, cameraDist);
    this.camera.lookAt(new THREE.Vector3());
    this.camera.fov = ENV.DEFAULT_FOV;
    this.camera.updateProjectionMatrix();
    this.render();
}

ENV.Scene.prototype.repositionFloor = function(dist) {
    let b = this.mc.boundingBox;
    this.setSize(b);
    this.resetCamera(); // Updates distance

    this.baseObject.position.set(-b.min.x - 0.5*(b.max.x - b.min.x), 
				 -b.min.y - 0.5*(b.max.y - b.min.y), 
				 -b.min.z - 0.5*(b.max.z - b.min.z));
    this.roomObject.position.set(0, dist - 0.5*(b.max.y - b.min.y), 0);
    this.onCameraMoved();
}

ENV.Scene.prototype.setSize = function(b) {
    let bump = x => Math.max(100, x);
    let w = bump(b.max.x-b.min.x), l = bump(b.max.z-b.min.z), h = bump(b.max.y-b.min.y);
    this.size = {w:w, l:l, h:h, diam:Math.max(w,l,h)};
}

ENV.Scene.prototype.build = function() {
    let b = this.mc.boundingBox || new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1,1,1)); // To build scene around.
    this.setSize(b);

    // Model:
    var elementCenter = new THREE.Vector3();
    b.getCenter(elementCenter);
    this.baseObject.position.set(-elementCenter.x, elementCenter.y, -elementCenter.z);

    // Lights:
    //this.addPointLight();
    this.addDirectionalLight();
}
ENV.Scene.prototype.buildOMRScene = ENV.Scene.prototype.buildStandardScene = ENV.Scene.prototype.build; // Backward compatibility

ENV.Scene.prototype.buildFloor = function() {
    let R = this.R = 6 * this.size.diam;
    var floorGeometry = new THREE.PlaneBufferGeometry(2*R, 2*R);
    var floorMaterial = new THREE.MeshStandardMaterial({
            color: 0xFEFEFE,
            metalness: 0.0,
            roughness: 0.0,
            normalMap: ENV.createFloorTexture(64, Math.floor(R/2)),
        });
    this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
    this.floor.receiveShadow = true;
    this.roomObject.add(this.floor);
    this.floor.rotation.x = -Math.PI/2;
    this.repositionFloor(0.001); // -0.001 to avoid floor clipping issues on large models.
}

ENV.createFloorTexture = function(size, repeats) {
    if(ENV.FloorTexture) {
        return ENV.FloorTexture;
    }

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
    // document.body.appendChild(canvas);
    return ENV.FloorTexture = texture;
}
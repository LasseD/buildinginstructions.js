'use strict';

/*
  The LDR.Measurer takes a camera (reusable) and a THREE.Box3 with a given matrixWorld.
  Using these components, the size of the projection of the THREE.Box3 onto the camera
  is measured.

  When projecting, the screen position is computed as:

  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4( position, 1.0 );
  where
  projectionMatrix = camera.projectionMatrix
  viewMatrix = camera.matrixWorldInverse
  modelMatrix = object.matrixWorld
 */
LDR.Measurer = function(camera) {
    this.camera = camera;

    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.camera.matrixWorldInverse.getInverse(this.camera.matrixWorld);

    this.m = new THREE.Matrix4();
    this.m.copy(this.camera.projectionMatrix);
    this.m.multiply(this.camera.matrixWorldInverse);
}

LDR.Measurer.prototype.measure = function(b, matrixWorld) {
    let m = new THREE.Matrix4();
    m.copy(this.m);
    m.multiply(matrixWorld); // modelMatrix

    let pts = [new THREE.Vector3(b.min.x, b.min.y, b.min.z),
	       new THREE.Vector3(b.max.x, b.max.y, b.max.z),
	       new THREE.Vector3(b.min.x, b.min.y, b.max.z),
	       new THREE.Vector3(b.min.x, b.max.y, b.min.z),
	       new THREE.Vector3(b.max.x, b.min.y, b.min.z),
	       new THREE.Vector3(b.min.x, b.max.y, b.max.z),
	       new THREE.Vector3(b.max.x, b.min.y, b.max.z),
	       new THREE.Vector3(b.max.x, b.max.y, b.min.z)];

    for(let i = 0; i < 8; i++) {
	pts[i].applyMatrix4(m);
    }
    
    let minx = pts[0].x;
    let maxx = pts[0].x;
    let miny = pts[0].y;
    let maxy = pts[0].y;
    for(let i = 1; i < 8; i++) {
	minx = Math.min(minx, pts[i].x);
	maxx = Math.max(maxx, pts[i].x);

	miny = Math.min(miny, pts[i].y);
	maxy = Math.max(maxy, pts[i].y);
    }
    
    let dx = maxx-minx;
    let dy = maxy-miny;
    return [dx,dy];
}

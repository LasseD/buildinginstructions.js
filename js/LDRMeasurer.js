'use strict';

import * as THREE from 'three'

/*
  The Measurer takes a camera (reusable) and a THREE.Box3 with a given matrixWorld.
  Using these components, the size of the projection of the THREE.Box3 onto the camera
  is measured.

  When projecting, the screen position is computed as:

  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4( position, 1.0 );
  where
  projectionMatrix = camera.projectionMatrix
  viewMatrix = camera.matrixWorldInverse
  modelMatrix = object.matrixWorld
 */
let Measurer = function(camera) {
    this.camera = camera;

    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();

    this.m = new THREE.Matrix4();
    this.m.copy(this.camera.projectionMatrix);
    this.m.multiply(this.camera.matrixWorldInverse);
}

let getScreenSize = function() {
    const root = document.documentElement;
    if(!(root && root.clientWidth && root.clientHeight)) {
        return [window.outerWidth, window.outerHeight];
    }
    return [root.clientWidth, root.clientHeight];
}

/**
   Measure the screen size of the object using the vertices of the bounding box.
   Useful for displaying full models on screen.
 */
Measurer.prototype.measure = function(b, matrixWorld) {
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
    pts.forEach(p => p.applyMatrix4(m));
    
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

let EPS = 0.00001;

let equals = function(a, b) {
    let d = a-b;
    return -EPS < d && d < EPS;
}

/**
   A line that can be evaluated:
   f(x) = a*x + y0
   From parameters: 
   - p1.y = p1.x*a+y0, p2.y = p2.x*a+y0 => a = dy/dx
   - p1.y = p1.x*a+y0 => y0 = p1.y-p1.x*a
 */
let MeasuringLine = function(p1, p2) {
    if(!p1) {
        return;
    }

    if(p1.x > p2.x) { // Swap is p2 is left of p1:
        let tmp = p1;
        p1 = p2;
        p2 = tmp;
    }
    this.a = (p2.y-p1.y) / (p2.x-p1.x);
    this.y0 = p1.y - p1.x*this.a;
}

MeasuringLine.prototype.eval = function(x) {
    return this.y0 + this.a * x;
}

MeasuringLine.prototype.toString = function() {
    return 'f(x)=' + this.y0 + (this.a > 0 ? '+' : '') + this.a + '*x';
}

/**
   Origo (x,y): y2 = f(x)-y
 */
MeasuringLine.prototype.setOrigoTo = function(x, y) {
    this.y0 = this.eval(x) - y;
    return this;
}

MeasuringLine.prototype.scaleY = function(scale) {
    this.y0 *= scale;
    return this;
}

MeasuringLine.prototype.clone = function() {
    let ret = new MeasuringLine();
    ret.y0 = this.y0;
    ret.a = this.a;
    return ret;
}

/**
   Measure the screen-projecting lines surrounding the bounding box aobve and below.
   Useful for packing part list images (PLI's)
   Returns: [width, height, linesBelow, linesAbove]
 */
Measurer.prototype.measureConvexHull = function(b, matrixWorld) {
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
    pts.forEach(p => {p.applyMatrix4(m); p.x = -p.x;}); // Transform to screen coordinates.

    let minx = Math.min.apply(null, pts.map(p => p.x));
    let maxx = Math.max.apply(null, pts.map(p => p.x));
    let miny = Math.min.apply(null, pts.map(p => p.y));
    let maxy = Math.max.apply(null, pts.map(p => p.y));
    
    let edges = [{p1:pts[0], p2:pts[2]},
                 {p1:pts[0], p2:pts[3]},
                 {p1:pts[0], p2:pts[4]},
                 {p1:pts[1], p2:pts[5]},
                 {p1:pts[1], p2:pts[6]},
                 {p1:pts[1], p2:pts[7]},
                 {p1:pts[2], p2:pts[5]},
                 {p1:pts[2], p2:pts[6]},
                 {p1:pts[3], p2:pts[5]},
                 {p1:pts[3], p2:pts[7]},
                 {p1:pts[4], p2:pts[6]},
                 {p1:pts[4], p2:pts[7]}];

    edges = edges.filter(e => !equals(e.p1.x, e.p2.x));
    let toLine = e => new MeasuringLine(e.p1, e.p2).setOrigoTo(minx, miny);
    let linesBelow = edges.filter(e => equals(e.p1.y, miny) || equals(e.p2.y, miny)).map(toLine);
    let linesAbove = edges.filter(e => equals(e.p1.y, maxy) || equals(e.p2.y, maxy)).map(toLine);
    
    let width = maxx-minx;
    let height = maxy-miny;
    return [width,height,linesBelow,linesAbove];
}

export { Measurer }

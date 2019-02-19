'use strict';

var LDR = {};
importScripts('three.min.js', 'LDRGeometries.js', 'ClientStorage.js');

var db;
var storage = new LDR.STORAGE(x => db = x.db);

onmessage = function(e) {
    var partType = e.data[0];
    var loader = e.data[1];

    // Prepare determinants:
    for(var i = 0; i < partType.steps.length; i++) {
	var step = partType.steps[i];
	for(var j = 0; j < step.dats.length; j++) {
	    var pd = step.dats[j];
	    var r = new THREE.Matrix3();
	    r.copy(pd.rotation);
	    pd.rotation = r;
	}
	for(var j = 0; j < step.ldrs.length; j++) {
	    var pd = step.ldrs[j];
	    var r = new THREE.Matrix3();
	    r.copy(pd.rotation);
	    pd.rotation = r;
	}
    }

    var geometry = new LDR.LDRGeometry();
    geometry.fromPartType(loader, partType);
    //console.log("Sending back geometry for: " + partType.ID);

    var packed = geometry.pack();
    postMessage([partType.ID, geometry]);

    if(partType.markToBeBuilt && db && partType.inlined == "OFFICIAL") {
	var transaction = storage.db.transaction(["parts"], "readwrite");
	transaction.oncomplete = function(event) {
	    //console.log('Completed writing of ' + partType.ID);
	};
	transaction.onerror = function(event) {
	    console.warn('Error while writing ' + partType.ID);
	    console.dir(event);
	};
	var slimPartType = {
	    ID:partType.ID,
	    g:packed,
	    d:partType.modelDescription
	};
	transaction.objectStore("parts").add(slimPartType);
    }
}

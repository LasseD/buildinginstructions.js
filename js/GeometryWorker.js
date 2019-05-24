'use strict';

var LDR = {};
importScripts('three.min.js', 'LDRGeometries.js', 'ClientStorage.js');

var db;
var storage = new LDR.STORAGE(x => db = x.db);

onmessage = function(e) {
    let partType = e.data[0];
    let loader = e.data[1];

    // Prepare determinants:
    function handleSubModel(pd) {
        let r = new THREE.Matrix3();
        r.copy(pd.rotation);
        pd.rotation = r; // Ensure determinant can be taken.
    }
    partType.steps.forEach(step => step.subModels.forEach(handleSubModel));

    let geometry = new LDR.LDRGeometry();
    geometry.fromPartType(loader, partType);
    //console.log("Sending back geometry for: " + partType.ID);

    let packed = geometry.pack();
    postMessage([partType.ID, geometry]);

    if(partType.markToBeBuilt && db && partType.inlined == "OFFICIAL") {
	let transaction = storage.db.transaction(["parts"], "readwrite");
	transaction.oncomplete = function(event) {
	    //console.log('Completed writing of ' + partType.ID);
	};
	transaction.onerror = function(event) {
	    console.warn('Error while writing ' + partType.ID);
	    console.dir(event);
	};
	let slimPartType = {
	    ID:partType.ID,
	    g:packed,
	    d:partType.modelDescription
	};
	transaction.objectStore("parts").add(slimPartType);
    }
}

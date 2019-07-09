'use strict';

LDR.STORAGE = function(onReady) {
    this.req = indexedDB.open("ldraw", 3);
    this.db;

    this.req.onupgradeneeded = function(event) {
	const db = event.target.result;
	db.onerror = errorEvent => console.dir(errorEvent);

	if(event.oldVersion < 1) {
	    db.createObjectStore("parts", {keyPath: "ID"});
	}
	else if(event.oldVersion < 2) {
	    // Colors in the 10k+ range need to be updated to 100k+
	    // This is the easy way to upgrade: Simply purge the store.
	    var partsStore = this.transaction.objectStore("parts");
	    partsStore.clear();
	}
	else if(event.oldVersion < 3) {
	    // New structure of the parts table - now storing lines instead of geometries.
	    var partsStore = this.transaction.objectStore("parts");
	    partsStore.clear();
	}
    };

    let self = this;
    this.req.onerror = function(event) {
	console.warn('DB Error: ' + event.target.errorCode);
	console.dir(event);
	onReady(self);
    };

    this.req.onsuccess = function(event) {
	self.db = event.target.result;
	onReady(self);
    };

    this.req.onblocked = function() {
        console.warn('there is another open connection to the ldraw database!');
        onReady(self); // Continue execution without self.db
    };
};

/*
  Attempts to fetch all in array 'parts' and calls onDone(stillToBeBuilt) on completion.
 */
LDR.STORAGE.prototype.retrievePartsFromStorage = function(loader, parts, onDone) {
    console.log('Attempting to retrieve ' + parts.length + ' part(s) from indexedDB: ' + parts.slice(0, 10).join('/') + '...');
    let stillToBeBuilt = [];
    let seen = {};
    parts.forEach(partID => seen[partID] = true);
    
    let transaction = this.db.transaction(["parts"]);
    let objectStore = transaction.objectStore("parts");

    let self = this;
    let remaining = parts.length;

    function onHandled(partID) {
	remaining--;

        if(loader.partTypes.hasOwnProperty(partID)) {
            // Check if any sub model should be fetched:
            let part = loader.partTypes[partID];
            let checkSubModel = function(sm) {
                if(!(loader.partTypes.hasOwnProperty(sm.ID) || seen.hasOwnProperty(sm.ID))) {
                    //console.log(partID + ' => fetch: ' + sm.ID);
                    remaining++;
                    seen[sm.ID] = true;
                    fetch(sm.ID);
                }
            }
            part.steps.forEach(step => step.subModels.forEach(checkSubModel));
        }

	if(remaining === 0) {
	    if(stillToBeBuilt.length > 0) {
		console.warn(stillToBeBuilt.length + " part(s) could not be fetched from indexedDB: " + stillToBeBuilt.slice(0, 10).join('/') + '...');
	    }
	    onDone(stillToBeBuilt);
	}
    }

    function fetch(partID) {
        let shortPartID = partID;
        if(partID.endsWith('.dat')) {
            shortPartID = partID.substring(0, partID.length-4); // Smaller keys.
        }
	let request = objectStore.get(shortPartID);
	request.onerror = function(event) {
	    stillToBeBuilt.push(partID);
	    console.warn(shortPartID + " retrieval error from indexedDB!");
	    console.dir(event);
	    onHandled(partID);
	};
	request.onsuccess = function(event) {
	    let result = request.result;
	    if(result) {
		//console.log("Fetched " + shortPartID + " from indexedDB");
		let part = new THREE.LDRPartType();
                part.unpack(result);
                loader.partTypes[partID] = part;
	    }
	    else {
		stillToBeBuilt.push(partID);
	    }
	    onHandled(partID);
	};
    }

    parts.forEach(fetch);
}

LDR.STORAGE.prototype.savePartsToStorage = function(parts) {
    let partsWritten = 0;
    let transaction = this.db.transaction(["parts"], "readwrite");
    
    transaction.oncomplete = function(event) {
        if(partsWritten === 0) {
            console.log('No new parts were written to indexedDB');
        }
        else {
            console.log('Completed writing of ' + partsWritten + ' parts');
        }
    };
    transaction.onerror = function(event) {
        console.warn('Error while writing parts!');
        console.dir(event);
        console.dir(transaction.error);
    };
    let objectStore = transaction.objectStore("parts");
    
    function savePartType(pt) {
        if(pt.canBePacked()) {
            let packed = pt.pack();
            objectStore.put(packed).onsuccess = function(e) {partsWritten++;};
        }
    }
    parts.forEach(savePartType);
}
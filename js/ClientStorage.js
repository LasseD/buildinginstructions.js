'use strict';

LDR.STORAGE = function(onReady) {
    this.req = indexedDB.open("ldraw", 7);
    this.db;

    this.req.onupgradeneeded = function(event) {
	const db = event.target.result;
	db.onerror = errorEvent => console.dir(errorEvent);

	if(event.oldVersion < 1) {
	    db.createObjectStore("parts", {keyPath: "ID"});
	}
	if(event.oldVersion < 3) {
	    // New structure of the parts table - now storing lines instead of geometries.
	}
	if(event.oldVersion < 4) {
	    db.createObjectStore("instructions", {keyPath: "key"});
	}
	if(event.oldVersion < 5) {
	    // ldraw_org added to parts.
	}
	if(event.oldVersion < 6) {
	    // texmap added
	}
	if(event.oldVersion < 7) {
	    // Bug fix for when partType.cleanUp is called
	    var pStore = this.transaction.objectStore("parts");
	    pStore.clear();
	    var iStore = this.transaction.objectStore("instructions");
	    iStore.clear();
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
    if(parts.length === 0) { // Ensure onDone is called when nothing is fetched.
        onDone([]);
        return;
    }
    //console.log('Attempting to retrieve ' + parts.length + ' part(s) from indexedDB: ' + parts.slice(0, 10).join('/') + '...');
    let stillToBeBuilt = [];
    let seen = {};
    parts.forEach(partID => seen[partID] = true);
    
    let transaction = this.db.transaction(["parts"]);
    let objectStore = transaction.objectStore("parts");

    let self = this;
    let remaining = parts.length;

    function onHandled(partID) {
	remaining--;

        // Check if any sub model should be fetched:
        let part = loader.getPartType(partID);
        if(part) { // Remember onHandled is also called on error, where part will not be set.
	    let toFetch = [];
            let checkSubModel = function(sm) {
                if(!(loader.partTypes.hasOwnProperty(sm.ID) || seen.hasOwnProperty(sm.ID))) {
                    seen[sm.ID] = true;
                    toFetch.push(sm.ID);
                }
            }
            part.steps.forEach(step => step.subModels.forEach(checkSubModel));
	    remaining += toFetch.length;
	    toFetch.forEach(fetch);
        }

	if(remaining === 0) {
	    if(stillToBeBuilt.length > 0) {
		console.warn(stillToBeBuilt.length + " part(s) could not be fetched from indexedDB: " + stillToBeBuilt.slice(0, 10).join('/') + '...');
	    }
	    onDone(stillToBeBuilt);
	}
    }

    function fetch(partID) {
        // Try first to generate the parts as this is quicker:
        if(LDR.Generator) {
            let pt = LDR.Generator.make(partID);
            if(pt) {
                loader.partTypes[partID] = pt;
                onHandled(partID);
                return;
            }
        }

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
		try {
		    let pt = new THREE.LDRPartType();
                    pt.unpack(result);
		    loader.partTypes[pt.ID] = pt;
		}
		catch(e) {
		    console.warn(e);
		    stillToBeBuilt.push(partID);		    
		}
	    }
	    else {
		stillToBeBuilt.push(partID);
	    }
	    onHandled(partID);
	};
    }

    parts.forEach(fetch);
}

LDR.STORAGE.prototype.retrieveInstructionsFromStorage = function(loader, onDone) {
    if(!loader.options.hasOwnProperty('key') || !loader.options.hasOwnProperty('timestamp')) {
	onDone(false);
	return;
    }
    let key = loader.options.key;
    let timestamp = loader.options.timestamp;
    console.log('Attempting to retrieve instructions ' + key + ' from indexedDB!');    
    let transaction = this.db.transaction(["instructions"]);
    let objectStore = transaction.objectStore("instructions");

    let request = objectStore.get(key);
    request.onerror = function(event) {
	console.warn(shortPartID + " retrieval error from indexedDB!");
	console.dir(event);
	onDone(false);
    };
    request.onsuccess = function(event) {
	let result = request.result;
	if(result && result.timestamp === timestamp) {
	    //console.log("Fetched " + key + " from indexedDB");
	    try {
		let parts = loader.unpack(result);
		onDone(true, parts);
	    }
	    catch(e) {
		console.warn(e);
		onDone(false);
	    }
	}
	else {
	    onDone(false);
	}
    };
}

LDR.STORAGE.prototype.savePartsToStorage = function(parts, loader) {
    let partsWritten = 0;
    let transaction = this.db.transaction(["parts"], "readwrite");
    
    transaction.oncomplete = function(event) {
        if(partsWritten === 0) {
            console.log('No new parts were written to indexedDB');
        }
        else if(partsWritten > 1) {
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
            let packed = pt.pack(loader);
            objectStore.put(packed).onsuccess = function(e) {partsWritten++;};
        }
    }
    parts.forEach(savePartType);
}

LDR.STORAGE.prototype.saveInstructionsToStorage = function(loader, key, timestamp) {
    if(loader.hasOwnProperty('instructionsSaved')) {
	console.warn('Attempting to save instructions more than once!');
	return;
    }
    loader.instructionsSaved = true;
    let transaction = this.db.transaction(["instructions"], "readwrite");
    
    transaction.oncomplete = function(event) {
        console.log('Instructions transaction for saving completed successfully!');
    };
    transaction.onerror = function(event) {
        console.warn('Error while writing instructions!');
        console.dir(event);
        console.dir(transaction.error);
    };
    let objectStore = transaction.objectStore("instructions");
    
    let packed = loader.pack();
    packed.key = key;
    packed.timestamp = timestamp;
    objectStore.put(packed).onsuccess = () => console.log('Instructions saved!');
}
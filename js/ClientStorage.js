'use strict';

LDR.STORAGE = function(onReady) {
    let self = this;
    this.req = indexedDB.open("ldraw", 9);

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
	    // step culling moved to lines
	}
	if(event.oldVersion < 8) {
            // Moved comments to lines of type 1.
	}
	if(event.oldVersion < 9) {
            // Added assembies to list of parts used in instructions. This fixes bug where storage is used to load model when at a sub model, thus causing double rendering due to asynchroneous fetching from indexedDB... that took 4 days to debug.
	    var pStore = this.transaction.objectStore("parts");
	    pStore.clear();
	    var iStore = this.transaction.objectStore("instructions");
	    iStore.clear();
	}
    };

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

    this.requestedParts = {};
};

/*
  Attempts to fetch all in array 'parts' and calls onDone(stillToBeBuilt) on completion.
 */
LDR.STORAGE.prototype.retrievePartsFromStorage = function(loader, parts, onDone) {
    if(parts.length === 0 || !this.db) { // Ensure onDone is called when nothing is fetched or can be fetched.
        onDone([]);
        return;
    }
    let stillToBeBuilt = [];
    let seen = {};
    parts.forEach(partID => seen[partID] = true);
    
    let transaction = this.db.transaction(["parts"]);
    let objectStore = transaction.objectStore("parts");

    let self = this;
    let remaining = parts.length;

    function onHandled(partID) {
        // Check if any sub model should be fetched:
        let part = loader.getPartType(partID);
        if(part) { // Remember onHandled is also called on error, where part will not be set.
            function checkSubModel(sm) {
                if(!(loader.partTypes.hasOwnProperty(sm.ID) || seen.hasOwnProperty(sm.ID))) {
                    seen[sm.ID] = true;
                    remaining++;
                    fetch(sm.ID);
                }
            }
            part.steps.forEach(step => step.subModels.forEach(checkSubModel));
        }

	remaining--;
	if(remaining === 0) {
	    if(stillToBeBuilt.length > 0) {
		console.warn(stillToBeBuilt.length + " part(s) could not be fetched from indexedDB: " + stillToBeBuilt.slice(0, 10).join('/') + '...');
	    }
	    onDone(stillToBeBuilt);
	}
    }

    function fetch(partID) {        
        if(self.requestedParts.hasOwnProperty(partID)) {
	    stillToBeBuilt.push(partID);
	    onHandled(partID);
            return; // Already fetched.
        }
        self.requestedParts[partID] = true;                

        // Try first to generate the parts as this is quicker:
        if(LDR.Generator) {
            let pt = LDR.Generator.make(partID);
            if(pt) {
                loader.setPartType(pt);
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
		try {
		    let pt = new THREE.LDRPartType();
                    pt.unpack(result);
		    loader.setPartType(pt);
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
    if(!loader.options.hasOwnProperty('key') || !loader.options.hasOwnProperty('timestamp') || !this.db) {
	onDone(false);
	return;
    }
    let key = loader.options.key;
    let timestamp = loader.options.timestamp;
    let transaction = this.db.transaction(["instructions"]);
    let objectStore = transaction.objectStore("instructions");

    let request = objectStore.get(key);
    request.onerror = function(event) {
	console.warn(shortPartID + " retrieval error from indexedDB for key " + key);
	console.dir(event);
	onDone(false);
    };
    request.onsuccess = function(event) {
	let result = request.result;
	if(result && result.timestamp === timestamp) {
	    try {
		let parts = loader.unpack(result);
		onDone(true, parts);
                console.log('Instructions with key ' + key + ' read and unpacked from indexedDB!');
	    }
	    catch(e) {
		loader.onWarning({message:'Error during unpacking of instructions from indexedDB: ' + e, subModel:key});
		onDone(false);
	    }
	}
	else {
            console.log('IndexedDB did not contain a current version of instructions with key "' + key + '" - new instructions will be fetched.');
	    onDone(false);
	}
    };
}

LDR.STORAGE.prototype.savePartsToStorage = function(parts, loader) {
    if(!this.db) {
	return; // No db to save to.
    }
    let partsWritten = 0;
    let transaction = this.db.transaction(["parts"], "readwrite");
    
    transaction.oncomplete = function(event) {
        //console.log('Number of parts saved in indexedDB: ' + partsWritten);
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
    if(loader.instructionsSaved || !this.db) {
	return; // Already saved or no db.
    }
    loader.instructionsSaved = true;
    let transaction = this.db.transaction(["instructions"], "readwrite");
    
    transaction.oncomplete = function(event) {
        //console.log('Instructions transaction for saving completed successfully!');
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
    objectStore.put(packed).onsuccess = () => console.log('Instructions saved to indexedDB.');
}

'use strict';

LDR.STORAGE = function(onDone) {
    this.req = indexedDB.open("ldraw", 2); 
    this.db;

    this.req.onupgradeneeded = function(event) {
	const db = event.target.result; // IDBDatabase
	db.onerror = errorEvent => console.dir(errorEvent);

	if(event.oldVersion < 1) {
	    db.createObjectStore("parts", {keyPath: "ID"});
	    db.createObjectStore("models", {keyPath: "ID"});
	}
	else if(event.oldVersion < 2) {
	    // Colors in the 10k+ range need to be updated to 100k+
	    // This is the easy way to upgrade: Simply purge the store.
	    var partsStore = this.transaction.objectStore("parts");
	    partsStore.clear();
	}
    };

    let self = this;
    this.req.onerror = function(event) {
	console.warn('DB Error: ' + event.target.errorCode);
	console.dir(event);
	onDone(self);
    };

    this.req.onsuccess = function(event) {
	self.db = event.target.result;
	onDone(self);
    };
};

/*
  Attempts to fetch all in array 'parts' and calls onDone(stillToBeBuilt) on completion.
 */
LDR.STORAGE.prototype.retrievePartsFromStorage = function(parts, onDone) {
    let stillToBeBuilt = [];
    
    let transaction = this.db.transaction(["parts"]);
    let objectStore = transaction.objectStore("parts");

    let self = this;
    let remaining = parts.length;

    function onHandled() {
	remaining--;
	if(remaining == 0) {
	    if(stillToBeBuilt.length > 0) {
		console.warn(stillToBeBuilt.length + " parts could not be fetched from indexedDB. These include parts, such as " + stillToBeBuilt[0].ID);
	    }
	    onDone(stillToBeBuilt);
	}
    }

    function fetch(part) {
	//console.log('Fetching ' + part.ID);
	let request = objectStore.get(part.ID);
	request.onerror = function(event) {
	    stillToBeBuilt.push(part);
	    console.warn(part.ID + " retrieval error from indexedDB!");
	    console.dir(event);
	    onHandled();
	};
	request.onsuccess = function(event) {
	    let result = request.result;
	    if(result) {
		//console.log("Fetched " + part.ID + " from indexedDB");
		part.geometry = new LDR.LDRGeometry();
		part.geometry.unpack(result.g);
	    }
	    else {
		stillToBeBuilt.push(part);
	    }
	    onHandled();
	};
    }
    parts.forEach(fetch);
}

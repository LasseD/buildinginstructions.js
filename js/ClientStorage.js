'use strict';

LDR.STORAGE = function(onDone) {
    this.req = /*window.*/indexedDB.open("ldraw", 1); 
    this.db;

    this.req.onupgradeneeded = function(event) {
	const db = event.target.result; // IDBDatabase
	db.createObjectStore("parts", {keyPath: "ID"});
	db.createObjectStore("models", {keyPath: "ID"});
    };

    var self = this;
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
    var stillToBeBuilt = [];
    
    var transaction = this.db.transaction(["parts"]);
    var objectStore = transaction.objectStore("parts");

    var self = this;
    var remaining = parts.length;

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
	var request = objectStore.get(part.ID);
	request.onerror = function(event) {
	    stillToBeBuilt.push(part);
	    console.warn(part.ID + " retrieval error from indexedDB!");
	    console.dir(event);
	    onHandled();
	};
	request.onsuccess = function(event) {
	    var result = request.result;
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

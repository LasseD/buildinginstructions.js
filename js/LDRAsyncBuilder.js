THREE.LDRAsyncBuilder = function(host, ldrLoader, partDesc) {
    this.host = host;
    this.ldrLoader = ldrLoader;
    this.partDesc = partDesc;
    this.loaded = false;
    this.done = false;
    this.builders = [];
    this.building = false;
}

/*
Try to build the three object - return ID for any missing part preventing the build.
*/
THREE.LDRAsyncBuilder.prototype.build = function() {
    if(this.done)
	return false;
    var partTypeID = this.partDesc.ID;
    var isDAT = partTypeID.endsWith('.dat');
    var partType = this.ldrLoader.ldrPartTypes[partTypeID];

    if(!this.loaded) {
	if(!partType || (partType === true)) {
	    // Still not loaded.
	    return partTypeID;
	}
	// Load all sub-parts:
	for(var i = 0; i < partType.subModels.length; i++) {
	    var subHost = null;
	    if(!isDAT) {
		subHost = new THREE.Group();
		this.host.add(subHost);
	    }
	    // Build new PartDescription for sub-model:
	    var d = partType.subModels[i];

	    var c = d.colorID == 16 ? this.partDesc.colorID : d.colorID;

	    var p = new THREE.Vector3();
	    p.copy(d.position);
	    p.applyMatrix3(this.partDesc.rotation);
	    p.add(this.partDesc.position);

            var r = new THREE.Matrix3();
	    r.multiplyMatrices(this.partDesc.rotation, d.rotation);

	    var dd = new THREE.LDRPartDescription(c, p, r, d.ID, false);
	    var builder = new THREE.LDRAsyncBuilder(subHost, this.ldrLoader, dd);
	    this.builders.push(builder);
	}
	this.loaded = true;
    }
    
    // Actual building:
    if(isDAT) {
	// If DAT: check if all below are loaded. If so, simply build the treepart here.
	var anyMissing = false;

	for(var i = 0; i < this.builders.length; i++) {
	    var builder = this.builders[i];
	    var anyMissing = builder.build() || anyMissing;
	}
	if(anyMissing) {
	    //console.log("Can't load because of missing " + anyMissing);
	    return anyMissing;
	}
	if(this.host != null) { // Only build first DAT part:
	    //console.log("Generating " + partTypeID + " in color " + this.partDesc.colorID);
            partType.generateThreePart(this.ldrLoader, this.partDesc.colorID, this.partDesc.position, this.partDesc.rotation, this.partDesc.invertCCW, this.host);
	}
    }
    else {
	// Else, build recursively.
	var anyMissing;
	for(var i = 0; i < this.builders.length; i++) {
	    var builder = this.builders[i];
	    anyMissing = builder.build() || anyMissing;
	}
	if(anyMissing)
	    return anyMissing;
    }
    //console.log("Built " + partTypeID);
    this.done = true;
    return false; // done
}

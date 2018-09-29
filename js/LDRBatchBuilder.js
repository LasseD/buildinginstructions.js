THREE.LDRBatchBuilder = function(ldrLoader, partDesc) {
    this.ldrLoader = ldrLoader;
    this.partDesc = partDesc;
    this.builders = [];
    this.idx = 0; // Next to be built.

    var partTypeID = this.partDesc.ID;
    var isDAT = partTypeID.endsWith('.dat');
    var partType = this.ldrLoader.ldrPartTypes[partTypeID];
    if(isDAT)
	return; // Don't build more inside.

    // Load all sub-parts:
    for(var i = 0; i < partType.subModels.length; i++) {
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
	var builder = new THREE.LDRBatchBuilder(ldrLoader, dd);
	this.builders.push(builder);
    }    
}

THREE.LDRBatchBuilder.prototype.done = function() {
    return this.idx >= this.builders.length;
}

/*
Builds batchSize elements onto the model. Returns the number of parts (DAT) built.
*/
THREE.LDRBatchBuilder.prototype.build = function(batchSize, threePart) {
    var partTypeID = this.partDesc.ID;
    var isDAT = partTypeID.endsWith('.dat');
    var partType = this.ldrLoader.ldrPartTypes[partTypeID];
    var sum = 0;
    
    if(isDAT) {
        partType.generateThreePart(this.ldrLoader, this.partDesc.colorID, this.partDesc.position, this.partDesc.rotation, this.partDesc.invertCCW, threePart);
	return 1;
    }
    else { // Build recursively:
	while(this.idx < this.builders.length) {
	    sum += this.builders[this.idx].build(batchSize-sum, threePart);
	    if(this.builders[this.idx].done())
		this.idx++
	    if(sum == batchSize)
		return batchSize;
	}
    }
    return sum;
}

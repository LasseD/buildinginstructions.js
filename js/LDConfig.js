'use strict';

/*
  Use this file if you prefer loading colros directly from LDConfig.ldr, rather than
  directly from colors.js.
  The reasons for this can be if you are experimenting with alternate colors, or if
  you don't want to rely on updates from the main repository for updates to colors.js
*/
var LDR = {};LDR.Colors = [];

/*
  Main entry point to load colors from ldconfig.ldr is this method.
  You can optionally supply your own url to ldconfig.ldr
  The other parameters are callbacks.
  Once onLoad is called, all colors in LDR.Colors are built.
*/
LDR.Colors.load = function(onLoad, onError, url='ldconfig.ldr') {
    let loader = new THREE.FileLoader(THREE.DefaultLoadingManager);    
    loader.load(url, onFileLoaded, undefined, onError);
    
    function onFileLoaded(ldr) {
	let dataLines = ldr.split(/(\r\n)|\n/);

	let legoInfo = null;
	for(let i = 0; i < dataLines.length; i++) {
	    let line = dataLines[i];
	    if(!line) {
		continue; // Empty line, or 'undefined' due to '\r\n' split.
	    }
	    
	    let parts = line.split(' ').filter(x => x !== ''); // Remove empty strings.
	    if(parts.length <= 1 || parts[0] !== '0') {
		continue; // Empty comment line
	    }
	    
	    if(parts.length >= 6 && parts[1] === '//' && parts[2] === 'LEGOID' && parts[4] === '-') {
		// LEGO Info
		legoInfo = {lego_id:parseInt(parts[3]), lego_name:parts.slice(5).join(' ')};
	    }
	    else if(parts.length >= 9 && parts[1] === '!COLOUR' && parts[3] === 'CODE' && parts[5] === 'VALUE') {
		let info = legoInfo || {};
		info.name = parts[2];
		let ID = parseInt(parts[4]);
		info.value = parseInt('0x' + parts[6].substring(1));
		info.edge = parseInt('0x' + parts[8].substring(1));
		
		let idx = 9;
		if(parts.length > idx+1 && parts[idx] == 'ALPHA') {
                    info.alpha = parseInt(parts[idx+1]);
		    idx+=2;
		}
		if(parts.length > idx+1 && parts[idx] == 'LUMINANCE') {
                    info.luminance = parseInt(parts[idx+1]);
		    idx+=2;
		}
		if(parts.length > idx) {
                    info.material = parts.slice(idx).join(' ');
		}
		
		LDR.Colors[ID] = info;
		legoInfo = null; // legoInfo has now been used.
	    }
	}
	onLoad();
    }
}


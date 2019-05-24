'use strict';

var Algorithm = Algorithm || {};

/*
  Squares: array with 'square' objects {x, y, width}.
 */
Algorithm.PackSquares = function(fillHeight, maxWidth, maxHeight, squares, maxSquareWidth) {
    // Compute squareWidth by increasing minSquareWidth as much as possible:
    let len = squares.length;
    let minSquareWidth = 64;

    let longSide = fillHeight ? maxHeight : maxWidth;
    let shortSide = !fillHeight ? maxHeight : maxWidth;

    // Binary search for maximum size:
    while(minSquareWidth < maxSquareWidth-1) {
	let squareWidth = (minSquareWidth + maxSquareWidth)/2;
	// Check fit
	let longSquares = parseInt(longSide / squareWidth);
	let shortSquares = parseInt((len+longSquares-1)/longSquares);
	if(shortSquares*squareWidth < shortSide)
	    minSquareWidth = squareWidth;
	else
	    maxSquareWidth = squareWidth;
    }

    // Update width and position (x,y) in all squares:
    let size = minSquareWidth;
    let longSquares = parseInt(longSide / size);
    let shortSquares = parseInt((len+longSquares-1)/longSquares);
    longSquares = parseInt((len+shortSquares-1)/shortSquares);

    //console.log("size=" + size + ", longSquares=" + longSquares + ", shortSquares=" + shortSquares);
    let idx = 0;
    if(fillHeight) {
	for(let x = 0; x < shortSquares; x++) {
	    for(let y = 0; y < longSquares && idx < len; y++) {
		squares[idx].x = x*size;
		squares[idx].y = y*size;
		squares[idx].width = size;
		squares[idx].height = size;
		idx++;
	    }
	}
	return [size*shortSquares, size*longSquares];
    }
    else {
	for(let x = 0; x < longSquares; x++) {
	    for(let y = 0; y < shortSquares && idx < len; y++) {
		squares[idx].x = x*size;
		squares[idx].y = y*size;
		squares[idx].width = size;
		squares[idx].height = size;
		idx++;
	    }
	}
	return [size*longSquares, size*shortSquares];
    }
}

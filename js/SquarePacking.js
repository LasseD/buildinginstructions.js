'use strict';

var Algorithm = Algorithm || {};

/*
  Squares: array with 'square' objects {x, y, width}.
 */
Algorithm.PackSquares = function(fillHeight, maxWidth, maxHeight, squares, maxSquareWidth) {
    // Compute squareWidth by increasing minSquareWidth as much as possible:
    var len = squares.length;
    var minSquareWidth = 64;

    var longSide = fillHeight ? maxHeight : maxWidth;
    var shortSide = !fillHeight ? maxHeight : maxWidth;

    // Binary search for maximum size:
    while(minSquareWidth < maxSquareWidth-1) {
	var squareWidth = (minSquareWidth + maxSquareWidth)/2;
	// Check fit
	var longSquares = parseInt(longSide / squareWidth);
	var shortSquares = parseInt((len+longSquares-1)/longSquares);
	if(shortSquares*squareWidth < shortSide)
	    minSquareWidth = squareWidth;
	else
	    maxSquareWidth = squareWidth;
    }

    // Update width and position (x,y) in all squares:
    var size = minSquareWidth;
    var longSquares = parseInt(longSide / size);
    var shortSquares = parseInt((len+longSquares-1)/longSquares);
    longSquares = parseInt((len+shortSquares-1)/shortSquares);

    //console.log("size=" + size + ", longSquares=" + longSquares + ", shortSquares=" + shortSquares);
    var idx = 0;
    if(fillHeight) {
	for(var x = 0; x < shortSquares; x++) {
	    for(var y = 0; y < longSquares && idx < len; y++) {
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
	for(var x = 0; x < longSquares; x++) {
	    for(var y = 0; y < shortSquares && idx < len; y++) {
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

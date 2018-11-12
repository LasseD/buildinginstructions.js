
'use strict';

var Algorithm = Algorithm || {};

/*
  Rectangles: array with 'rectangle' objects {x, y, width}.
 */
Algorithm.PackRectangles = function(fillHeight, maxWidth, maxHeight, rectangles, maxRectangleWidth) {
    // Compute rectangleWidth by increasing minRectangleWidth as much as possible:
    var len = rectangles.length;
    //console.log("max width=" + maxWidth + ", max height=" + maxHeight + ", fillHeight=" + fillHeight + ", len=" + len);
    var minRectangleWidth = 64;
    var heightAdd = 8; // Add for height to include multiplication.

    var maxRectangleSideLength = 0;
    for(var i = 0; i < rectangles.length; i++)
	maxRectangleSideLength = Math.max(maxRectangleSideLength, rectangles[i].dx, rectangles[i].dy);

    // Binary search for maximum size:
    while(minRectangleWidth < maxRectangleWidth-1) {
	var rectangleWidth = (minRectangleWidth + maxRectangleWidth)/2;
	var scale = rectangleWidth/maxRectangleSideLength;
	// Check fit:
	var indentX = 0, indentY = 0; // Where to place the current rectangle.

	if(fillHeight) {
	    var maxW = 0; // Max width in current column.
	    // Test that we can build the BOM:
	    for(var i = 0; i < rectangles.length; i++) {
		var r = rectangles[i];
		var rWidth = scale*r.dx;
		var rHeight = scale*r.dy;
		if(indentY + rHeight + heightAdd > maxHeight) {
		    // Place in new row
		    indentX += maxW;
		    indentY = 0;
		    maxW = rWidth;
		}
		else {
		    indentY += rHeight + heightAdd;
		    maxW = Math.max(maxW, rWidth);
		}
	    }
	    if(indentX < maxWidth)
		minRectangleWidth = rectangleWidth;
	    else
		maxRectangleWidth = rectangleWidth;
	}
	else {
	    var maxH = 0;
	    for(var i = 0; i < rectangles.length; i++) {
		var r = rectangles[i];
		if(indentX + scale*r.dx > maxWidth) {
		    indentY += maxH + heightAdd;
		    indentX = 0;
		    maxH = scale*r.dy;
		}
		else {
		    indentX += scale*r.dx;
		    maxH = Math.max(maxH, scale*r.dy);
		}
	    }
	    if(indentY + heightAdd < maxHeight)
		minRectangleWidth = rectangleWidth;
	    else
		maxRectangleWidth = rectangleWidth;
	}
    }

    // Update width and position (x,y) in all rectangles:
    var scale = minRectangleWidth/maxRectangleSideLength;

    var w = 0, h = 0, indentX = 0, indentY = 0;
    if(fillHeight) {
	var maxW = 0;	
	for(var i = 0; i < rectangles.length; i++) {
	    var r = rectangles[i];
	    r.width = scale*r.dx;
	    r.height = scale*r.dy;

	    // Place the rectangle:
	    if(indentY + r.height > maxHeight) {
		indentX += maxW;
		indentY = 0;
		maxW = r.width;
	    }
	    else {
		maxW = Math.max(maxW, r.width);
	    }

	    r.x = indentX;
	    r.y = indentY;
	    w = Math.max(w, indentX + r.width);
	    h = Math.max(h, indentY + r.height);
	    indentY += r.height + heightAdd;
	}
    }
    else {
	var maxH = 0;
	for(var i = 0; i < rectangles.length; i++) {
	    var r = rectangles[i];
	    r.width = scale*r.dx;
	    r.height = scale*r.dy;

	    if(indentX + r.width > maxWidth) {
		indentY += maxH + heightAdd;
		indentX = 0;
		maxH = r.height;
	    }
	    else {
		maxH = Math.max(maxH, r.height);
	    }

	    r.x = indentX;
	    r.y = indentY;	    
	    w = Math.max(w, indentX + r.width);
	    h = Math.max(h, indentY + r.height);
	    indentX += r.width;   
	}
    }
    return [w, h];
}

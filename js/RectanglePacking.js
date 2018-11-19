'use strict';

var Algorithm = Algorithm || {};

/*
  Rectangles: array with 'rectangle' objects {x, y, width}.
 */
Algorithm.PackRectangles = function(fillHeight, maxWidth, maxHeight, rectangles, maxRectangleWidth) {
    // Compute rectangleWidth by increasing minRectangleWidth as much as possible:
    var len = rectangles.length;
    var minRectangleWidth = 1;
    var widthAdd = 4; // Add for width when fillWidth
    var heightAdd = 10; // Add for height to include multiplication.

    var maxRectangleSideLength = 0;
    for(var i = 0; i < rectangles.length; i++)
	maxRectangleSideLength = Math.max(maxRectangleSideLength, rectangles[i].dx, rectangles[i].dy);

    // Binary search for maximum size:
    while(minRectangleWidth < maxRectangleWidth-1) {
	var rectangleWidth = (minRectangleWidth + maxRectangleWidth)/2;
	var scale = rectangleWidth/maxRectangleSideLength;
	// Check fit:
	var w = 0, h = 0, indentX = 0, indentY = 0; // indentXY = where to place the current rectangle.

	if(fillHeight) {
	    var maxW = 0; // Max width in current column.
	    // Test that we can build the BOM:
	    for(var i = 0; i < rectangles.length; i++) {
		var r = rectangles[i];
		r.width = scale*r.dx;
		r.height = scale*r.dy;

		if(indentY + r.height + heightAdd > maxHeight) { // Place in new row
		    indentX += maxW;
		    indentY = 0;
		    maxW = r.width;
		}
		else
		    maxW = Math.max(maxW, r.width);
		r.x = indentX; r.y = indentY;
		w = Math.max(w, indentX + r.width);
		h = Math.max(h, indentY + r.height);
		indentY += r.height + heightAdd; // Place next
	    }
	}
	else {
	    var maxH = 0;
	    for(var i = 0; i < rectangles.length; i++) {
		var r = rectangles[i];
		r.width = scale*r.dx;
		r.height = scale*r.dy;

		if(indentX + r.width + widthAdd > maxWidth) { // Place in new column
		    indentY += maxH + heightAdd;
		    indentX = 0;
		    maxH = r.height;
		}
		else
		    maxH = Math.max(maxH, r.height);
		r.x = indentX; r.y = indentY;
		w = Math.max(w, indentX + r.width);
		h = Math.max(h, indentY + r.height);
		indentX += r.width + widthAdd; // Place next
	    }
	}
	if(w < maxWidth && h < maxHeight)
	    minRectangleWidth = rectangleWidth;
	else
	    maxRectangleWidth = rectangleWidth;
    }
    return [w, h];
}

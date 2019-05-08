'use strict';

var Algorithm = Algorithm || {};

/*
  Rectangles: array with 'rectangle' objects {x, y, width}.
 */
Algorithm.PackRectangles = function(fillHeight, maxWidth, maxHeight, rectangles, maxSizePerPixel) {
    // Compute rectangleWidth by increasing minRectangleWidth as much as possible:
    var len = rectangles.length;
    var minRectangleWidth = 1;
    var WIDTH_ADD = 4; // Add for width when fillWidth
    var HEIGHT_ADD = 20; // Add for height to include multiplication.
    var MIN_WIDTH = 25;

    var maxRectangleSideLength = 0;
    var maxSize = 0;
    for(var i = 0; i < rectangles.length; i++) {
	var r = rectangles[i];
	maxRectangleSideLength = Math.max(maxRectangleSideLength, r.dx, r.dy);
	maxSize = Math.max(maxSize, r.size);
    }
    var maxRectangleWidth = maxWidth;
    //console.log("maxSize=" + maxSize + " => maxRectangleWidth=" + maxRectangleWidth + ', maxWidth=' + maxWidth);
    var w, h;

    function run(rectangleWidth) {
	var scale = rectangleWidth/maxRectangleSideLength;
	// Check fit:
	w = h = 0;
        var indentX = 0, indentY = 0; // indentXY = where to place the current rectangle.

	if(fillHeight) {
	    var maxW = MIN_WIDTH; // Max width in current column.
	    // Test that we can build the BOM:
	    for(var i = 0; i < rectangles.length; i++) {
		var r = rectangles[i];
		r.width = scale*r.dx;
		r.height = scale*r.dy;

		if(indentY > 0 && indentY + r.height + HEIGHT_ADD > maxHeight) { // Place in new row
		    indentX += maxW;
		    indentY = 0;
		    maxW = Math.max(MIN_WIDTH, r.width);
		}
		else {
		    maxW = Math.max(maxW, r.width);
                }
		r.x = indentX;
                r.y = indentY;
		w = Math.max(w, indentX + r.width);
		h = Math.max(h, indentY + r.height);
		indentY += r.height + HEIGHT_ADD; // Place next
	    }
	}
	else {
	    var maxH = 0;
	    for(var i = 0; i < rectangles.length; i++) {
		var r = rectangles[i];
		r.width = scale*r.dx;
		r.height = scale*r.dy;

		if(indentX + r.width + WIDTH_ADD > maxWidth) { // Place in new column
		    indentY += maxH + HEIGHT_ADD;
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
		indentX += r.width + WIDTH_ADD; // Place next
	    }
	}

	if(w < maxWidth && h < maxHeight) {
	    minRectangleWidth = rectangleWidth;
        }
	else {
	    maxRectangleWidth = rectangleWidth;
        }        
    }

    // Binary search for maximum size:
    while(minRectangleWidth < maxRectangleWidth - 2.5) { // The larger the constant here, the quicker.
	var rectangleWidth = (minRectangleWidth + maxRectangleWidth)*0.5;
        run(rectangleWidth);
    }
    run(minRectangleWidth); // Ensure proper placement.
    //console.log(maxWidth + "/" + maxHeight + " -> " + w + "/" + h);
    return [w, h];
}

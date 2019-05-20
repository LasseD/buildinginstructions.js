'use strict';

var Algorithm = Algorithm || {};

/*
  Rectangles: array with 'rectangle' objects {x, y, width}.
 */
Algorithm.PackRectangles = function(fillHeight, maxWidth, maxHeight, rectangles, maxSizePerPixel) {
    // Compute rectangleWidth by increasing minRectangleWidth as much as possible:
    let len = rectangles.length;
    let minRectangleWidth = 1;
    let WIDTH_ADD = 4; // Add for width when fillWidth
    let HEIGHT_ADD = 20; // Add for height to include multiplication.
    let MIN_WIDTH = 25;

    let maxRectangleSideLength = 0;
    let maxSize = 0;
    for(let i = 0; i < rectangles.length; i++) {
	let r = rectangles[i];
	maxRectangleSideLength = Math.max(maxRectangleSideLength, r.dx, r.dy);
	maxSize = Math.max(maxSize, r.size);
    }
    let maxRectangleWidth = maxWidth;
    //console.log("maxSize=" + maxSize + " => maxRectangleWidth=" + maxRectangleWidth + ', maxWidth=' + maxWidth);
    let w, h;

    function run(rectangleWidth) {
	let scale = rectangleWidth/maxRectangleSideLength;
	// Check fit:
	w = h = 0;
        let indentX = 0, indentY = 0; // indentXY = where to place the current rectangle.

	if(fillHeight) {
	    let maxW = MIN_WIDTH; // Max width in current column.
	    // Test that we can build the BOM:
	    for(let i = 0; i < rectangles.length; i++) {
		let r = rectangles[i];
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
	    let maxH = 0;
	    for(let i = 0; i < rectangles.length; i++) {
		let r = rectangles[i];
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
	let rectangleWidth = (minRectangleWidth + maxRectangleWidth)*0.5;
        run(rectangleWidth);
    }
    run(minRectangleWidth); // Ensure proper placement.
    //console.log(maxWidth + "/" + maxHeight + " -> " + w + "/" + h);
    return [w, h];
}

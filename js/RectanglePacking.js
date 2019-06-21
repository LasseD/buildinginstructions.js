'use strict';

var Algorithm = Algorithm || {};

/*
  Rectangles: array with 'rectangle' objects {x, y, width}.
 */
Algorithm.PackRectangles = function(fillHeight, maxWidth, maxHeight, rectangles, textHeight) {
    // Compute rectangleWidth by increasing minRectangleWidth as much as possible:
    let len = rectangles.length;
    let minRectangleWidth = 1;
    let WIDTH_ADD = 4; // Add for width when fillWidth

    let maxRectangleSideLength = 0;
    let maxSize = 0;
    for(let i = 0; i < rectangles.length; i++) {
	let r = rectangles[i];
	maxRectangleSideLength = Math.max(maxRectangleSideLength, r.dx, r.dy);
	maxSize = Math.max(maxSize, r.size);
    }
    let maxRectangleWidth = maxWidth;
    //console.log("maxSize=" + maxSize + " => maxRectangleWidth=" + maxRectangleWidth + ', maxWidth=' + maxWidth + ', maxHeigh=' + maxHeight);
    let w, h;

    /**
       let minWidth = Math.min(topWidth, bottomWidth);
       Assume a PLI on top placed with top right corner at (0,0):
       - pt1 and pt2 = line y-coordinates at -minWidth and 0.
       Similarly for a PLI on bottom:
       - pb1, and pb2
    */
    function lineDist(topLine, topWidth, bottomLine, bottomWidth) {
       let minWidth = Math.min(topWidth, bottomWidth);        
       let pt1 = topLine.eval(topWidth-minWidth), pt2 = topLine.eval(topWidth);
       let pb1 = bottomLine.eval(bottomWidth-minWidth), pb2 = bottomLine.eval(bottomWidth);
       return Math.max(pt1-pb1, pt2-pb2);
    }

    function lineSetDist(topLines, topWidth, bottomLines, bottomWidth) {
        //console.log('top width: ' + topWidth + ', bottom width: ' + bottomWidth);
        //console.log('top lines:'); topLines.forEach(line => console.log(line.toString()));
        //console.log('bottom lines:'); bottomLines.forEach(line => console.log(line.toString()));
        let min = 9999999;
        topLines.forEach(topLine => min = Math.min(min, Math.min.apply(null, bottomLines.map(bottomLine => lineDist(topLine, topWidth, bottomLine, bottomWidth)))));
        //console.log('Lines dist min = ' + min);
        return min;
    }

    function run(rectangleWidth) {
	let scale = rectangleWidth/maxRectangleSideLength;
        //console.log('Running for scale ' + scale)
	// Check fit:

        rectangles.forEach(r => {
                r.DX = scale*r.dx;
                r.DY = scale*r.dy;
                r.LINES_BELOW = r.linesBelow.map(line => line.clone().scaleY(scale));
                r.LINES_ABOVE = r.linesAbove.map(line => line.clone().scaleY(scale));
            });

        let firstInColumn = 0; // Handle PLI's column byb column - end a column by moving them to align on the right side.
        let alignInColumn = to => {
            for(let j = firstInColumn; j < to; j++) {
                let r2 = rectangles[j];
                r2.x = w - r2.DX;
            }
            firstInColumn = to;
        };
        
        let r = rectangles[0];
        r.x = r.y = 0;
        let maxW = w = r.DX; // Max width in current column.
        h = r.DY;

        for(let i = 1; i < rectangles.length && w < maxWidth && h < maxHeight; i++) {
            let prev = r;
            r = rectangles[i];

            //console.log('prev height: ' + prev.DY + ', r height: ' + r.DY);
            // Attempt to place r below prev:
            r.x = prev.x;
            r.y = prev.y + //Math.min(prev.DY,
                lineSetDist(prev.LINES_ABOVE, prev.DX, r.LINES_BELOW, r.DX);//);
            if(r.y + r.DY > maxHeight) {
                //console.log('New column at ' + w);
                alignInColumn(i);
                r.x += maxW;
                r.y = 0;
                w = r.x + r.DX;
                h = Math.max(h, r.DY);
                maxW = r.DX;
            }
            else {
                w = Math.max(w, r.x+r.DX);
                h = Math.max(h, r.y+r.DY);
                maxW = Math.max(maxW, r.DX);
            }
            //console.log('Placed at ' + r.x + ', ' + r.y);
        }
        alignInColumn(rectangles.length);

	if(w < maxWidth && h < maxHeight) {
	    minRectangleWidth = rectangleWidth;
        }
	else {
	    maxRectangleWidth = rectangleWidth;
        }        
    }

    // Binary search for maximum size:
    while(minRectangleWidth+5 < maxRectangleWidth) { // The larger the constant here, the quicker.
	let rectangleWidth = (minRectangleWidth + maxRectangleWidth)*0.5;
        run(rectangleWidth);
    }
    run(minRectangleWidth); // Ensure proper placement.
    //console.log(maxWidth + "/" + maxHeight + " -> " + w + "/" + h);
    return [w, h];
}

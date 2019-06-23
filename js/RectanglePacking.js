'use strict';

var Algorithm = Algorithm || {};

/**
   Pack PLI's on screen.
   Use binary search to maximize the 'scale' of all PLI's.

   Consider a 'dx' and 'dy' of a PLI as width and height of screen facing bounding rectangle.
   'maxPliSideLength' is the maximum of all dx's and dy's.
   'pliWidth' denotes the actual size of maxPliSideLength on screen.
   'scale' is pliWidth / maxPliSideLength.
 */
Algorithm.PackPlis = function(fillHeight, maxWidth, maxHeight, plis, textHeight) {
    const WIDTH_ADD = 4; // Spacing between columns.
    const TEXT_WIDTH_TO_HEIGHT_RATIO = 0.6;

    // Placement of text:
    plis.forEach(r => r.MULT_DX = (1+(''+r.mult).length) * textHeight * TEXT_WIDTH_TO_HEIGHT_RATIO);

    // Set up binary search variables (see function description):
    let minPliWidth = 1;
    let maxPliSideLength = Math.max.apply(null, plis.map(r => Math.max(r.dx,r.dy)));
    let maxPliWidth = maxWidth;
    let w, h; // Total width and height.

    /**
       let minWidth = Math.min(topWidth, bottomWidth);
       Assume a PLI on top placed with top right corner at (0,0):
       - pt1 and pt2 = line y-coordinates at -minWidth and 0.
       Similarly for a PLI on bottom:
       - pb1, and pb2
    */
    function lineSetDist(topLines, topWidth, bottomLines, bottomWidth) {
        let min = 9999999;

        function lineDist(topLine, bottomLine) {
            let minWidth = Math.min(topWidth, bottomWidth);
            let pt1 = topLine.eval(topWidth-minWidth), pt2 = topLine.eval(topWidth);
            let pb1 = bottomLine.eval(bottomWidth-minWidth), pb2 = bottomLine.eval(bottomWidth);
            return Math.max(pt1-pb1, pt2-pb2);
        }
        topLines.forEach(topLine => min = Math.min(min, Math.min.apply(null, bottomLines.map(bottomLine => lineDist(topLine, bottomLine)))));
        return min;
    }

    function textBoxDist(prev, r) {
        if(r.DX < prev.FULL_DX-prev.MULT_DX) {
            return -999999; // No overlap between r and the text boxes of prev.
        }

        // x1 and x2 are positions of lower point below multiplier of prev.
        let x1 = r.DX-prev.FULL_DX;
        let x2 = x1 + prev.MULT_DX;
        let y12 = prev.MULT_Y+textHeight;
        let pts = [{x:x1, y:y12}, {x:x2, y:y12}];
        
        function linePointsDist(line) {
            let boxPoints = pts.map(p => line.eval(p.x) + p.y);
            return Math.max.apply(null, boxPoints);
        }
        let ret = Math.min.apply(null, r.LINES_BELOW.map(line => linePointsDist(line, pts)));
        return Math.min(prev.MULT_Y+textHeight, ret);
    }

    function run(pliWidth) {
	let scale = pliWidth/maxPliSideLength;

	// Update geometry after change of scale:
        plis.forEach(r => {
                r.DX = scale*r.dx;
                r.DY = scale*r.dy;
                r.LINES_BELOW = r.linesBelow.map(line => line.clone().scaleY(scale));
                r.LINES_ABOVE = r.linesAbove.map(line => line.clone().scaleY(scale));
                // Position of multiplier:
                let lines = r.LINES_ABOVE.filter(line => line.a > 0); // Lines going \
                let linesAtMultDx = lines.map(line => line.eval(r.MULT_DX));
                r.MULT_Y = Math.min(r.DY, Math.min.apply(null, linesAtMultDx));
                r.FULL_DX = Math.max(r.DX, r.MULT_DX);
                r.FULL_DY = Math.max(r.DY, r.MULT_Y+textHeight);

                if(r.annotation) {
                    // Position of annotation:
                    r.ANNO_Y = Math.min.apply(null, r.LINES_ABOVE.map(line => line.eval(r.DX)));
                    r.FULL_DY = Math.max(r.FULL_DY, r.ANNO_Y+textHeight);
                }
            });

        let firstInColumn = 0; // Handle PLI's column byb column - end a column by moving them to align on the right side.
        let alignInColumn = to => {
            let maxAnno = 0;
            for(let j = firstInColumn; j < to; j++) {
                let r2 = plis[j];
                r2.x = w - r2.FULL_DX;
                if(r2.annotation) {
                    maxAnno = Math.max(maxAnno, r2.annotation.length);
                }
            }
            firstInColumn = to;
            maxAnno *= textHeight * TEXT_WIDTH_TO_HEIGHT_RATIO * 0.89; // Special annotation size - slightly smaller than for multipliers
            maxW += WIDTH_ADD + maxAnno;
            w += maxAnno;
        };
        
        let r = plis[0];
        r.x = r.y = 0;
        let maxW = w = r.FULL_DX; // Max width in current column.
        h = r.FULL_DY;

        for(let i = 1; i < plis.length && w < maxWidth && h < maxHeight; i++) {
            let prev = r;
            r = plis[i];

            // Attempt to place r below prev:
            r.x = prev.x;
            r.y = prev.y + Math.max(textBoxDist(prev, r),
                                    lineSetDist(prev.LINES_ABOVE, prev.FULL_DX, r.LINES_BELOW, r.FULL_DX));
            if(r.y < 0) {
                r.y = 0; // Special case where r can be placed really high up.
            }

            if(r.y + r.FULL_DY > maxHeight) {
                alignInColumn(i);
                r.x += maxW;
                r.y = 0;
                w = r.x + r.FULL_DX;
                h = Math.max(h, r.FULL_DY);
                maxW = r.FULL_DX;
            }
            else {
                w = Math.max(w, r.x+r.FULL_DX);
                h = Math.max(h, r.y+r.FULL_DY);
                maxW = Math.max(maxW, r.FULL_DX);
            }
        }
        alignInColumn(plis.length);

	if(w < maxWidth && h < maxHeight) {
	    minPliWidth = pliWidth;
            return true; // Indicate current size is OK.
        }
	else {
	    maxPliWidth = pliWidth;
            return false;
        }
    }

    // Binary search for maximum size PLI's:
    let currentPlacementIsOK = false;
    while(minPliWidth+5 < maxPliWidth) { // The larger the constant here, the quicker.
	let pliWidth = (minPliWidth + maxPliWidth)*0.5;
        currentPlacementIsOK = run(pliWidth);
    }
    if(!currentPlacementIsOK) {
        run(minPliWidth); // Ensure proper placement.
    }
    return [w, h];
}

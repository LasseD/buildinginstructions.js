'use strict';

var MAPS = {};

MAPS.make11477 = function(scaleX, addX, scaleY, addY) {
    var ret = [20, -16, 12.616, -15.652, 5.36, -14.604, -1.648, -12.883, -8.284, -10.51, -14.44, -7.534, -20, -4];
    return ret.map((v, idx) => idx%2==0 ? scaleX*v+addX : scaleY*v+addY);
}

MAPS.make50950 = function(scaleX, addX, scaleY, addY) {
    var ret = [30, 0,
               16.95, 0.86,
               4.12, 3.41,
               -8.27, 7.61,
               -20, 13.4,
               -30, 20
               ];
    return ret.map((v, idx) => idx%2==0 ? scaleX*v+addX : scaleY*v+addY);
}

MAPS.make54200 = function(scaleX, addX, scaleY, addY) {
    var ret = [-30, 8,
               -10, -4,
               10, -16
               ];
    return ret.map((v, idx) => idx%2==0 ? scaleX*v+addX : scaleY*v+addY);
}

MAPS.make93606 = function(scaleX, addX, scaleY, addY) {
    var ret = [40, 0,
               19.12, 1.283576,
               -1.408,5.089527,
               -21.232, 11.358153,
               -40, 20
               ];
    return ret.map((v, idx) => idx%2==0 ? scaleX*v+addX : scaleY*v+addY);
}

MAPS.make11477Pair = function(spacers) {
    var ret = MAPS.make11477(1, -10*spacers-20, 1, 0);
    ret.push(...MAPS.make11477(-1, 10*spacers+20, 1, 0));
    return ret;
}

MAPS.make54200Pair = function(spacers) {
    var ret = MAPS.make54200(1, -10*spacers-10, 1, 0);
    ret.push(...MAPS.make54200(-1, 10*spacers+10, 1, 0));
    return ret;
}

MAPS.makeCyli = function(radius, sections) {
    let ret = [];
    for(let i = 0; i < sections; i++) {
        let angle = Math.PI*(1+i/sections);
        ret.push(radius*Math.cos(angle), radius*Math.sin(angle));
    }
    ret.push(radius, 0);
    return ret;
}

MAPS.CNT = 0;

MAPS.Mapping = function(title, heights, horizontal, dx) {
    this.title = title;
    this.heights = heights;
    this.horizontal = horizontal;
    this.dx = dx;
    this.id = 'map_' + MAPS.CNT++;
}

MAPS.Mapping.prototype.toTxt = function() {
    var ret = '# ' + this.title + '\n';
    if(this.horizontal)
        ret += 'horizontal ';
    else
        ret += 'vertical ';
    ret += this.dx + '\n';
    this.heights.forEach(v => ret += " " + v);
    ret += '\n';
    return ret;
}

MAPS.Mapping.prototype.toEle = function(parent, fold, w, h) {
    var mapEle = document.createElement('div'); parent.append(mapEle);
    mapEle.setAttribute('class', 'map');
    mapEle.id = this.id;
    var titleEle = document.createElement('span'); mapEle.append(titleEle);
    titleEle.setAttribute('class', 'title');
    titleEle.innerHTML = this.title;
    const self = this;
    mapEle.addEventListener('click', function(){
            $('.map').removeClass('map_active');
            $('#surface').val(self.toTxt());
            $('#' + self.id).addClass('map_active');
            fold();
        });

    // Make svg:
    const NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg'); mapEle.appendChild(svg);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    var pts = [];
    var maxY = this.heights[1];
    var minY = maxY;
    this.heights.forEach(function(h, idx) {
            if(idx%2 == 0) { 
                pts.push({x:h}); 
            } 
            else { 
                pts[(idx-1)/2].y = h;
                maxY = Math.max(maxY, h);
                minY = Math.min(minY, h);
            }
        });
    pts.sort((a, b) => a.x - b.x);
    var minX = pts[0].x;
    var maxX = pts[pts.length-1].x;
    var scale = w / (maxX - minX);
    var y0 = h/2 - (maxY-minY)*scale/2;
    pts.forEach(function(p) { // Change coordinates:
            p.x = (p.x-minX) * scale;
            p.y = (p.y-minY) * scale + y0;
        });
    maxY = (maxY-minY)*scale + y0;

    // Polygon with height map:
    var poly = document.createElementNS(NS, 'polygon'); svg.append(poly);
    var polyPts = w + " " + maxY + " " + 0 + " " + maxY;
    pts.forEach(p => polyPts += " " + p.x + " " + p.y);
    poly.setAttribute('points', polyPts);
    
    // Lines:
    var line = function(x1, y1, x2, y2) {
        var ret = document.createElementNS(NS, 'line');
        ret.setAttribute('x1', x1);
        ret.setAttribute('y1', y1);
        ret.setAttribute('x2', x2);
        ret.setAttribute('y2', y2);
        svg.append(ret);
    }
    pts.forEach(p => line(p.x, maxY, p.x, p.y));
    //console.dir(pts);

    // Additional info:
    var infoEle = document.createElement('span'); mapEle.append(infoEle);
    infoEle.setAttribute('class', 'info');
    infoEle.innerHTML = '1 x ' + (maxX-minX)/20 + (this.horizontal ? ' &#8596;' : ' &#8597;');
}

MAPS.ALL = [
    new MAPS.Mapping('11477 (1x2 curved slope)', MAPS.make11477(1, 0, 1, 0), true, 0),
    new MAPS.Mapping('11477', MAPS.make11477(1, 0, 1, 0), false, 0),
    new MAPS.Mapping('11477', MAPS.make11477(-1, 0, 1, 0), true, 0),
    new MAPS.Mapping('11477', MAPS.make11477(-1, 0, 1, 0), false, 0),

    new MAPS.Mapping('93273', MAPS.make11477Pair(0), true, 0),
    new MAPS.Mapping('93273', MAPS.make11477Pair(0), false, 0),

    new MAPS.Mapping('2 x 11477 + 1', MAPS.make11477Pair(1), true, 0),
    new MAPS.Mapping('2 x 11477 + 2', MAPS.make11477Pair(2), true, 0),
    new MAPS.Mapping('2 x 11477 + 3', MAPS.make11477Pair(3), true, 0),

    new MAPS.Mapping('50950 (1x3 curved slope)', MAPS.make50950(1, 0, 1, 0), true, 0),
    new MAPS.Mapping('50950', MAPS.make50950(1, 0, 1, 0), false, 0),
    new MAPS.Mapping('50950', MAPS.make50950(-1, 0, 1, 0), true, 0),
    new MAPS.Mapping('50950', MAPS.make50950(-1, 0, 1, 0), false, 0),

    new MAPS.Mapping('93606 (2x4 curved slope)', MAPS.make93606(1, 0, 1, 0), true, 0),
    new MAPS.Mapping('93606', MAPS.make93606(1, 0, 1, 0), false, 0),
    new MAPS.Mapping('93606', MAPS.make93606(-1, 0, 1, 0), true, 0),
    new MAPS.Mapping('93606', MAPS.make93606(-1, 0, 1, 0), false, 0),

    new MAPS.Mapping('4 x 54200 (cheese slopes)', MAPS.make54200Pair(0), true, 0),
    new MAPS.Mapping('4 x 54200',                 MAPS.make54200Pair(0), false, 0),
    new MAPS.Mapping('4 x 54200 + 1', MAPS.make54200Pair(1), true, 0),
    new MAPS.Mapping('4 x 54200 + 1', MAPS.make54200Pair(1), false, 0),
    
    new MAPS.Mapping('2 x Wedge 2 x 3', [-60, 20, 0, 0, 60, 20], true, 0),
    new MAPS.Mapping('2 x Wedge 2 x 3', [-60, 20, 0, 0, 60, 20], false, 0),
    new MAPS.Mapping('2 x Wedge 2 x 4', [-80, 20, 0, 0, 80, 20], true, 0),
    new MAPS.Mapping('2 x Wedge 2 x 4', [-80, 20, 0, 0, 80, 20], false, 0),

    new MAPS.Mapping('2 x 2 cylinder', MAPS.makeCyli(20, 12), false, 0),
    new MAPS.Mapping('2 x 2 cylinder', MAPS.makeCyli(20, 12), true, 0),
    new MAPS.Mapping('4 x 4 cylinder', MAPS.makeCyli(40, 24), false, 0),
    new MAPS.Mapping('4 x 4 cylinder', MAPS.makeCyli(40, 24), true, 0),
];
from dataclasses import dataclass
import sys
from math import sqrt

# ElementType has a width, length and height (1 to 3)
@dataclass
class ElementType:
    w: int
    l: int
    h: int
    ldrawType: str
    ldrawColor: int
    def __hash__(self):
        return self.w + self.l
    def __eq__(self, other):
        return self.w == other.w and self.l == other.l
    def __gt__(self, other):
        if self.w != other.w:
            return self.w > other.w
        return self.l > other.l
    def __str__(self):
        return str(self.w) + "x" + str(self.l)

b2x4 = ElementType(2, 4, 3, '3001.dat', 14)
p2x3 = ElementType(2, 3, 1, '3021.dat', 4)
b1x2 = ElementType(1, 2, 3, '3004.dat', 14)
b2x2 = ElementType(2, 2, 3, '3003.dat', 14)
pEyes = ElementType(2, 2, 3, '3003pe2.dat', 14)

elementTypes = [b2x4, p2x3, p2x3, b1x2, b2x2] # The pieces in the duck set.

# Element is a placed element consisting of a type, (x,y,z) position and orientation
# Position is like in LDraw to make export to LDraw easy
@dataclass
class Element:
    t: ElementType
    x: int
    y: int
    z: int
    v: bool # Vertical placement of brick
    def __hash__(self):
        return self.x + 13*self.y + 11*self.z + 7*(1 if self.v else 0) + self.t.__hash__()
    def __gt__(self, other):
        if self.t != other.t:
            return self.t > other.t
        if self.v != other.v:
            return self.v # self is vertical, which means it is greater
        if self.x != other.x:
            return self.x > other.x
        if self.y != other.y:
            return self.y > other.y
        if self.z != other.z:
            return self.z > other.z
        return False
    def __str__(self):
        return str(self.t) + " at " + str(self.x) + "," + str(self.y) + "," + str(self.z) + (" |" if self.v else " --")

class Model:
    def __init__(self, elements):
        self.b2x4 = None
        self.p2x3a = None
        self.p2x3b = None
        self.b1x2 = None
        self.b2x2 = None
        for element in elements:
            self.add(element)
    def add(self, e):
        if e.t == b2x4:
            self.b2x4 = e
        elif e.t == p2x3 and self.p2x3a == None:
            self.p2x3a = e
        elif e.t == p2x3: # Ensure 2x3 plates are sorted:
            if e > self.p2x3a:
                self.p2x3b = e
            else:
                self.p2x3b = self.p2x3a
                self.p2x3a = e
        elif e.t == b1x2:
            self.b1x2 = e
        elif e.t == b2x2:
            self.b2x2 = e
    def elements(self):
        return [self.b2x4, self.p2x3a, self.p2x3b, self.b1x2, self.b2x2]
    def __hash__(self):
        ret = 0
        for element in self.elements():
            if element != None:
                ret = ret + element.__hash__()
        return ret
    def __eq__(self, other):
        ea = self.elements()
        eb = other.elements()
        for i in range(len(ea)):
            a = ea[i]
            b = eb[i]
            if a != b:
                return False
        return True
    def print(self, addX, addY, f):
        for element in self.elements() + [Element(pEyes, 0, 0, 0, False)]:
            if element == None:
                continue
            pos = ' ' + str(addX + element.x*10) + ' ' + str(-element.z*8 - 8*element.t.h) + ' ' + str(addY + element.y*10)
            matrix = ' 1 0 0 0 1 0 0 0 1 ' if not element.v else ' 0 0 -1 0 1 0 1 0 0 '
            f.write("1 " + str(element.t.ldrawColor) + pos + matrix + element.t.ldrawType + "\n")
        f.write("\n")
    def __str__(self):
        return self.elements().join(', ')

found = set()
samples = []
count = 0
SPACE = 200

def printFile(models):
    f = open("models/ducks.ldr", "w")
    f.write("0 Ducks from set 2000416\n")
    f.write("0 Name: ducks.ldr\n")
    f.write("0 Author: ducks.py\n")
    f.write("0 !LICENSE Licensed under CC BY 4.0 : see CAreadme.txt\n")
    f.write("\n")
    r = int(sqrt(len(models)))
    i = 0
    print('Printing', len(models), 'models')
    for model in models:
        addX = SPACE * int(i / r)
        addY = SPACE * (i % r)
        i = i + 1
        #notNone = [x for x in model.elements() if x != None]
        #if any(a.x+1 == b.x and a.y == b.y and a.v == b.v for a in notNone for b in notNone if a != b):
        model.print(addX, addY, f)
    f.close()

# Compute where elementType of orientation v can be placed above and below base:
def placements(base, elementType, v):
    ret = []

    # Try above and below for each position:
    z = base.z
    minX = base.x - ((base.t.w if base.v else base.t.l) -1) - ((elementType.w if v else elementType.l) - 1)
    maxX = base.x + ((base.t.w if base.v else base.t.l) -1) + ((elementType.w if v else elementType.l) - 1)
    minY = base.y - ((base.t.l if base.v else base.t.w) -1) - ((elementType.l if v else elementType.w) - 1)
    maxY = base.y + ((base.t.l if base.v else base.t.w) -1) + ((elementType.l if v else elementType.w) - 1)
    for x in range(minX, maxX+1, 2):
        for y in range(minY, maxY+1, 2):
            ret.append(Element(elementType, x, y, z-elementType.h, v))
            ret.append(Element(elementType, x, y, z+base.t.h, v))

    # 1x2 brick can be placed below 2x2 plates and 2x4 brick:
    if base.t.w == 1: # Base is 1x2 brick:
        if elementType.l == 3 and v == base.v: # elementType is 2x3 plate:
            ret.append(Element(elementType, base.x, base.y, z+base.t.h, v))
        elif elementType.l == 4 and v == base.v:
            if v:
                ret.append(Element(elementType, base.x, base.y-1, z+base.t.h, v))
                ret.append(Element(elementType, base.x, base.y+1, z+base.t.h, v))
            else:
                ret.append(Element(elementType, base.x-1, base.y, z+base.t.h, v))
                ret.append(Element(elementType, base.x+1, base.y, z+base.t.h, v))        
    elif elementType.w == 1:
        if base.t.l == 3 and v == base.v:
            ret.append(Element(elementType, base.x, base.y, z-elementType.h, v))
        elif base.t.l == 4 and v == base.v:
            if v:
                ret.append(Element(elementType, base.x, base.y-1, z-elementType.h, v))
                ret.append(Element(elementType, base.x, base.y+1, z-elementType.h, v))
            else:
                ret.append(Element(elementType, base.x-1, base.y, z-elementType.h, v))
                ret.append(Element(elementType, base.x+1, base.y, z-elementType.h, v))            
    return ret

def hits(a, b):
    if a.z + a.t.h <= b.z or b.z + b.t.h <= a.z:
        return False # No z overlap
    aw = a.t.l if a.v else a.t.w
    bw = b.t.l if b.v else b.t.w
    al = a.t.l if not a.v else a.t.w
    bl = b.t.l if not b.v else b.t.w
    return abs(a.x-b.x) < al+bl and abs(a.y-b.y) < aw+bw

# Place one of the remaining bricks (toPlaceIndices) onto alreadyPlaced and recurse.
def build(toPlaceIndices, alreadyPlaced):
    global count

    if len(toPlaceIndices) == 0:
        count = count + 1
        if count % 100000 == 0:
            print(count, ', '.join([str(x) for x in alreadyPlaced]))
            samples.append(Model(alreadyPlaced))
            printFile(samples)
        return
    
    for toPlaceIndex in toPlaceIndices:
        toPlace = elementTypes[toPlaceIndex]
        newToPlaceIndices = [x for x in toPlaceIndices if x != toPlaceIndex]

        # Try to place on all placed bricks:
        for base in alreadyPlaced:
            ps = placements(base, toPlace, False)
            if toPlace.w != toPlace.h:
                ps = ps + placements(base, toPlace, True) # Add vertical placements if non-square
            for placement in ps:
                if any(hits(a,placement) for a in alreadyPlaced):
                    continue # Collision!
                newAlreadyPlaced = alreadyPlaced + [placement]
                model = Model(newAlreadyPlaced)
                if not model in found:
                    found.add(model)
                    build(newToPlaceIndices, newAlreadyPlaced)

# 2x2 Eye brick assumed at 0, 0, 0, False
build([0, 1, 2, 3, 4], [Element(pEyes, 0, 0, 0, False)])
printFile(found)
print('Found:', count)


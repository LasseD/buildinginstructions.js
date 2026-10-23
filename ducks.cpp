#define ABS(a) ((a) < 0 ? -(a) : (a))
#define MIN(a,b) ((a) < (b) ? (a) : (b))

#include "stdint.h"
#include <iostream>
#include <fstream>
#include <assert.h>
#include <sstream>
#include <set>

using namespace std;

struct PermutationNode {
  PermutationNode *next;
  int idx;
};
struct PermutationHandler {
  PermutationNode *nodes;
  
  PermutationHandler(int size, int *indices) {
    nodes = new PermutationNode[size+1];
    for(int i = 0; i < size; ++i) {
      nodes[i+1].idx = indices[i];
      nodes[i].next = &(nodes[i+1]);
    }
    nodes[size].next = NULL;
  }

  ~PermutationHandler() {
    delete[] nodes;
  }

  PermutationNode* root() {
    return &(nodes[0]);
  }
};

// ElementType has a width, length and height (1 to 3)
struct ElementType {
  uint8_t idx, w, l, h, ldrawColor;
  string ldrawType, name;

  ElementType() {
  }

  ElementType(uint8_t idx, uint8_t w, uint8_t l, uint8_t h, uint8_t ldrawColor, string ldrawType, string name) : idx(idx), w(w), l(l), h(h), ldrawColor(ldrawColor), ldrawType(ldrawType), name(name) {
  }

  ElementType(const ElementType &e) : idx(e.idx), w(e.w), l(e.l), h(e.h), ldrawColor(e.ldrawColor), ldrawType(e.ldrawType), name(e.name){
  }

  friend ostream& operator <<(ostream &os,const ElementType &e) {
    return os << e.name;
  }

};

ElementType b2x4(0, 2, 4, 3, 14, "3001.dat", "2x4");
ElementType p2x3a(1, 2, 3, 1, 4, "3021.dat", "2x3a");
ElementType p2x3b(2, 2, 3, 1, 4, "3021.dat", "2x3b");
ElementType b1x2(3, 1, 2, 3, 14, "3004.dat", "1x2");
ElementType b2x2(4, 2, 2, 3, 14, "3003.dat", "2x2");
ElementType bEyes(5, 2, 2, 3, 14, "3003pe2.dat", "E2x2");

ElementType elementTypes[5] = {b2x4, p2x3a, p2x3b, b1x2, b2x2}; // The pieces in the duck set.

// Element is a placed element consisting of a type, (x,y,z) position and orientation
// Position is like in LDraw to make export to LDraw easy
// Max move 10 studs from base E2x2 => 20 "half moves" x 2 directions -> 40 => 6 bit
// z height: Max 11 above, 11 below => 22 positions => 5 bit
struct Element {
  ElementType *t;
  int8_t x, y, z;
  bool v; // Vertical placement of brick

  Element() : t(NULL), x(-30), y(-30), z(-15), v(false) {
  }

  Element(ElementType *t, int8_t x, int8_t y, int8_t z, bool v) : t(t), x(x), y(y), z(z), v(v) {
  }

  Element(const Element &e) : t(e.t), x(e.x), y(e.y), z(e.z), v(e.v) {
  }

  // Returns 18 bits encoded position. No type information.
  uint64_t hash() const {
    uint64_t xx = (uint64_t)(30 + x);
    uint64_t yy = (uint64_t)(30 + y);
    uint64_t zz = (uint64_t)(15 + z);

    uint64_t ret = xx;
    ret = (xx << 6) | yy;
    ret = (ret << 5) | zz;
    ret = (ret << 1) | (v ? 1 : 0);

    return ret;
  }

  void print(int addX, int addY, ofstream &os) const {
    if(x == -30) {
      return;
    }
    assert(t != NULL);
    
    os << "1 " << (int)t->ldrawColor;
    os << " " << (addX + x*10) << " " << (-z*8 - 8*t->h) << " " << (addY + y*10);
    if(!v)
      os << " 1 0 0 0 1 0 0 0 1 ";
    else
      os << " 0 0 -1 0 1 0 1 0 0 ";
    os << t->ldrawType << endl;
  }

  friend ostream& operator <<(ostream &os,const Element &e) {
    return os << *(e.t) << (e.v ? "--" : "|") << (int)e.x << "," << (int)e.y << "," << (int)e.z << (e.v ? "--" : "|");
  }
};

Element eyeBrick(&bEyes, 0, 0, 0, false);

struct Model {
  Element elements[5];

  void add(const Element &e) {
    elements[e.t->idx] = e;
  }

  Model(Element const * const es, int size) {
    for(int i = 0; i < size; i++) {
      assert(es[i].t != NULL);
      add(es[i]);
    }
  }

  pair<uint64_t,uint64_t> hash() const {
    uint64_t L = (elements[0].hash() << 36) | (elements[1].hash() << 18) | elements[2].hash();
    uint64_t R = (elements[3].hash() << 18) | elements[4].hash();
    return pair<uint64_t,uint64_t>(L, R);
  }

  void print(int addX, int addY, ofstream &os) const {
    eyeBrick.print(addX, addY, os);
    
    for(int i = 0; i < 5; i++) {
      elements[i].print(addX, addY, os);
    }
    os << endl;
  }

  bool isDuckLike() const {
    bool aFound = false;
    int ai, bi;

    for(int i = 0; i < 5; i++) {
      const Element &e = elements[i];

      if(e.y != 0) {
	return false; // Not in middle!
      }

      // Find 2x3 plates:
      ElementType const * const et = e.t;
      if(et->l == 3) {
	if(aFound)
	  bi = i;
	else {
	  ai = i;
	  aFound = true;
	}
      }
    }

    // Assume one 2x3 is the beak attached to the eye brick.
    // The other has to be the foot, so below z = -1, or together with the beak.
    assert(aFound);
    const Element &a = elements[ai];
    const Element &b = elements[bi];

    if(a.z == -1 && b.z == -2 || a.z == -2 && b.z == -1) {
      return a.x == b.x && a.y == b.y && a.v == b.v; // Have to be together as beak!
    }

    if(a.z > -1 || b.z > -1) {
      return false; // Placed to high to be a foot!
    }

    // Find out if 2x3 plate is lowest:
    for(int i = 0; i < 5; i++) {
      const Element &e = elements[i];

      if(i != ai && i != bi && e.z <= MIN(a.z,b.z)) {
	return false; // Something below!
      }
    }

    return true; // All OK!
  }

  friend ostream& operator <<(ostream &os,const Model &m) {
    for(int i = 0; i < 5; i++) {
      os << m.elements[i];
    }
    return os;
  }
};

set<pair<uint64_t,uint64_t> > found;
vector<Model> samples;
uint64_t doubleCount = 0, duckCount = 0;
const int SPACE_X = 250, SPACE_Y = 150;

void printFile(vector<Model> &models) {
  cout << "Printing " << models.size() << " models" << endl;
  ofstream os("models/cducks.ldr");
  os << "0 Ducks from set 2000416" << endl;
  os << "0 Name: ducks.ldr" << endl;
  os << "0 Author: ducks.cpp" << endl;
  os << "0 !LICENSE Licensed under CC BY 4.0 : see CAreadme.txt" << endl;
  os << endl;
  int r = (int)(sqrt(models.size()));
  int i = 0;
  for(vector<Model>::const_iterator it = models.begin(); it != models.end(); it++) {
    int addX = SPACE_X * (int)(i / r);
    int addY = SPACE_Y * (i % r);
    i++;
    it->print(addX, addY, os);
  }
  os.flush();
  os.close();
}

// Compute where elementType of orientation v can be placed above and below base:
void placements(Element &base, ElementType &et, bool v, vector<Element> &ret) {

  // Try above and below for each position:
  int8_t zUp = base.z + base.t->h;
  int8_t zDown = base.z - et.h;

  int8_t minX = base.x - ((base.v ? base.t->w : base.t->l) -1) - ((v ? et.w : et.l) - 1);
  int8_t maxX = base.x + ((base.v ? base.t->w : base.t->l) -1) + ((v ? et.w : et.l) - 1);
  int8_t minY = base.y - ((base.v ? base.t->l : base.t->w) -1) - ((v ? et.l : et.w) - 1);
  int8_t maxY = base.y + ((base.v ? base.t->l : base.t->w) -1) + ((v ? et.l : et.w) - 1);
  for(int8_t x = minX; x <= maxX; x += 2) {
    for(int8_t y = minY; y <= maxY; y += 2) {
      ret.push_back(Element(&et, x, y, zDown, v));
      ret.push_back(Element(&et, x, y, zUp, v));
    }
  }

  // 1x2 brick can be placed below 2x2 plates and 2x4 brick:
  if(base.t->w == 1) { // Base is 1x2 brick
    if(et.l == 3 && v == base.v) { // et is 2x3 plate:
      ret.push_back(Element(&et, base.x, base.y, zUp, v));
    }
    else if(et.l == 4 && v == base.v) {
      if(v) {
	ret.push_back(Element(&et, base.x, base.y-1, zUp, v));
	ret.push_back(Element(&et, base.x, base.y+1, zUp, v));
      }
      else {
	ret.push_back(Element(&et, base.x-1, base.y, zUp, v));
	ret.push_back(Element(&et, base.x+1, base.y, zUp, v));
      }
    }
    else if(et.w == 1) {
      if(base.t->l == 3 and v == base.v) {
	ret.push_back(Element(&et, base.x, base.y, zDown, v));
      }
      else if(base.t->l == 4 and v == base.v) {
	if(v) {
	  ret.push_back(Element(&et, base.x, base.y-1, zDown, v));
	  ret.push_back(Element(&et, base.x, base.y+1, zDown, v));
	}
	else {
	  ret.push_back(Element(&et, base.x-1, base.y, zDown, v));
	  ret.push_back(Element(&et, base.x+1, base.y, zDown, v));
	}
      }
    }
  }
}

bool hits(const Element &a, const Element &b) {
  if(a.z + a.t->h <= b.z) {
    return false; // Assume a.z = 0 and a.h = 3: If b.z = 3 or above, then they cannot intersect!
  }
  if(b.z + b.t->h <= a.z) {
    return false; // Reversed.
  }

  int8_t aw = a.v ? a.t->l : a.t->w;
  int8_t bw = b.v ? b.t->l : b.t->w;
  int8_t al = !a.v ? a.t->l : a.t->w;
  int8_t bl = !b.v ? b.t->l : b.t->w;

  return ABS(a.x-b.x) < al+bl and ABS(a.y-b.y) < aw+bw;
}

// Place one of the remaining bricks (toPlaceIndices) onto alreadyPlaced and recurse.  
void build(PermutationHandler &ph, Element *perm, const int size, const bool beaked) {
  if(size == 6) {
    Model m(&perm[1], 5);
    
    doubleCount++;
    if(doubleCount % 5000000 == 0) {
      cout << "Found duck! " << (doubleCount/2)/1000000 << "m:";
      for(int i = 0; i < 6; i++) {
	cout << " " << perm[i];
      }
      cout << endl;
    }
    bool duckLike = m.isDuckLike();
    if(beaked && duckLike) {
      duckCount++;
      if(duckCount % 100 == 0) {
	cout << "Real duck " << (duckCount/2) << " found! (" << duckCount << ")" << endl;
	samples.push_back(m);
	printFile(samples);
      }
      //int *x = NULL; x[1] = 2; // SEG FAULT!
    }
    return;
  }

  // try all combinations:
  PermutationNode *node = ph.root();
  while(node->next != NULL) {
    PermutationNode *n = node->next;
    // remove n from permutation:
    node->next = n->next;

    // Try all positions we can place the element!
    vector<Element> positions;
    ElementType &et = elementTypes[n->idx];
    placements(perm[size-1], et, false, positions);
    placements(perm[size-1], et, true, positions);

    for(vector<Element>::const_iterator it = positions.begin(); it != positions.end(); it++) {
      Element toAdd = *it;

      // Check no hit against new element:
      bool ok = true;
      for(int i = 0; i < size; i++) {
	if(hits(perm[i], toAdd)) {
	  ok = false;
	  break;
	}
      }
      if(!ok) {
	continue; // Collision detected!
      }
      
      // Only run if unknown:
      Model m(&perm[1], size-1);
      m.add(toAdd);

      if(found.find(m.hash()) == found.end()) { // New duck:
	perm[size] = toAdd;
	bool b = beaked || (size == 1 && et.l == 3 && toAdd.z == -1);
	build(ph, perm, size+1, b);
      }
    }
    
    // re-insert in permutation and go to next:
    node->next = n; // n->next is already set (never changes)
    node = n;
  }
}

int main() {
  int indices[5] = {1,0,2,3,4};
  Element perm[6];
  // 2x2 Eye brick assumed at 0, 0, 0, False
  perm[0] = eyeBrick;
  PermutationHandler ph(5, indices);
  
  build(ph, perm, 1, false);
  cout << "Counts:" << endl;
  cout << "All ducks: " << doubleCount << " -> " << doubleCount/2 << endl;
  cout << "Beautiful ducks: " << duckCount << " -> " << duckCount/2 << endl;
  printFile(samples);
  return 0;
}



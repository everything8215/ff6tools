function Tose70Encoder() {}

Tose70Encoder.prototype.encode = function(data) {

    var bestComp;
    // try all 5 encoding modes and choose the one with the smallest compressed size
    for (this.m1 = 0; this.m1 < 5; this.m1++) {
        for (this.m3 = 0; this.m3 < 5; this.m3++) {
            var comp = this.compress(data);
            if (!bestComp || comp.length < bestComp.length) bestComp = comp;
        }
    }

    return bestComp;
}

Tose70Encoder.prototype.compress = function(data) {
    this.src = this.deltaMod(data);
    this.s = 0; // source pointer

    // read the data line-by-line
    this.huffman = {node8: {}, tree8: [], node4: {}, tree4: []};
    this.stringValues = [];
    this.stringOffset = 0;
    this.maxString = 0;
    this.golomb = {values: []};
    this.lines = [];
    
    if (this.m1 === 0) {
        this.getLine = this.getLine0;
        this.putLine = this.putLine0;
        this.golomb.n = 2;
        this.golomb.w = 2;
        this.minString = 1;
        this.maxString = 64;
    } else if (this.m1 === 1) {
        this.getLine = this.getLine1;
        this.putLine = this.putLine1;
        this.golomb.n = 4;
        this.golomb.w = 2;
        this.minString = 1;
    } else if (this.m1 === 2) {
        this.getLine = this.getLine2;
        this.putLine = this.putLine2;
        this.golomb.n = 7;
        this.golomb.w = 3;
        this.minString = 13;
    } else if (this.m1 === 3) {
        // if the length of the data is an odd number, this will truncate the last byte
        this.src = new Uint16Array(this.src.buffer, this.src.byteOffset, this.src.byteLength >> 1);
        this.getLine = this.getLine3;
        this.putLine = this.putLine3;
        this.golomb.n = 3;
        this.golomb.w = 2;
        this.minString = 10;
    } else {
        this.getLine = this.getLine4;
        this.putLine = this.putLine4;
        this.golomb.n = 0;
        this.minString = 1;
    }
    
    // read the source data
    while (this.s < this.src.length) this.getLine();
    this.pushStringBuffer();
    
    // destination buffer twice as long as source (should cover anything)
    this.dest = new Uint32Array(data.byteLength << 1);
    this.d = 1; // skip 32 bits for the header

    // initialize the bitstream buffer
    this.bitstream = this.src[this.s++];
    this.b = 24; // skip 8 bits for the compression mode
    
    // initialize the huffman tree
    this.initHuffman();
    
    // calculate the golomb parameters
    this.initGolomb();
    
    // write the compressed data to the bitstream
    for (var l = 0; l < this.lines.length; l++) this.putLine(this.lines[l]);

    // write any leftover bits in the bitstream
    this.dest[this.d++] = this.bitstream;

    // write the header and compression mode
    this.dest[0] = (data.length << 8) | 0x70;
    this.dest[1] |= (this.m1 << 24) | (this.m2 << 27) | (this.m3 << 29);
    
    return new Uint8Array(this.dest.buffer, this.dest.byteOffset, this.d * 4);
}

Tose70Encoder.prototype.getLZ77 = function(maxRun) {
    // find the longest sequence that matches the decompression buffer
    var run = 0;
    var offset = 0;
    var s = this.s;
    maxRun = maxRun || this.src.length;
    for (var o = 1; o <= s; o++) {
        var r = 0;

        while ((r < maxRun) && (s + r < this.src.length) && (s + r - o >= 0) && (this.src[s + r - o] === this.src[s + r])) r++;

        if (r > run) {
            // this sequence is longer than any others that have been found so far
            run = r;
            offset = o;
        }
    }
    return {type: "lz77", run: run, offset: offset};
}

Tose70Encoder.prototype.pushStringBuffer = function() {
    
    while (this.maxString && this.stringValues.length > this.maxString) {
        // push strings recursively
        var partialString = this.stringValues.slice(this.maxString);
        this.stringValues = this.stringValues.slice(0, this.maxString);
        this.pushStringBuffer();
        this.stringOffset -= partialString.length;
        this.stringValues = partialString;
    }

    if (this.stringValues.length >= this.minString) {
        this.lines.push({type: "string", string: this.stringValues, run: this.stringValues.length, offset: this.stringOffset});
    } else if (this.stringValues.length !== 0) {
        for (var i = 0; i < this.stringValues.length; i++) this.lines.push({type: "raw", value: this.stringValues[i]});
    }
    this.stringOffset = this.s;
    this.stringValues = [];
}

Tose70Encoder.prototype.getLine0 = function() {

    // try to do rle first
    var value = this.src[this.s];
    var l = 0;
    while (value === this.src[this.s + l] && (l < 65)) l++;
    
    // use rle if the same byte is repeated more than twice
    if (l >= 2) {
        this.s += l;
        this.pushStringBuffer();
        this.lines.push({type: "rle", run: l, value: value});
        return;
    }
    
    var lz77 = this.getLZ77(66);
    if (lz77.run >= 3) {
        // use lz77
        this.s += lz77.run;
        this.pushStringBuffer();
        this.golomb.values.push(lz77.offset);
        this.lines.push(lz77);
    } else {
        this.s++;
        this.pushHuffmanValue(value);
        this.stringValues.push(value);
    }
}

Tose70Encoder.prototype.putLine0 = function(line) {
    
    if (line.type === "rle") {
        this.putBits(3, 2);
        this.putBits(line.run - 2, 6);
        this.putByte(line.value);
        
    } else if (line.type === "raw") {
        this.putBits(2, 2);
        this.putBits(0, 6);
        this.putValue(line.value);

    } else if (line.type === "string") {
        this.putBits(2, 2);
        this.putBits(line.run - 1, 6);
        this.putString(line.string);
        
    } else if (line.type === "lz77") {
        this.putGolomb(line.offset);
        this.putBits(line.run - 3, 6);
    }
}

Tose70Encoder.prototype.getLine1 = function() {

    var lz77 = this.getLZ77(18);
    if (lz77.run >= 3) {
        // use lz77
        this.s += lz77.run;
        this.golomb.values.push(lz77.offset);
        this.lines.push(lz77);
    } else {
        // no compression
        var value = this.src[this.s++];
        this.pushHuffmanValue(value);
        this.lines.push({type: "raw", value: value});
    }
}

Tose70Encoder.prototype.putLine1 = function(line) {

    if (line.type === "raw") {
        this.putBits(0, 1);
        this.putValue(line.value);
        
    } else if (line.type === "lz77") {
        this.putBits(1, 1);
        this.putGolomb(line.offset);
        this.putBits(line.run - 3, 4);
    }
}

Tose70Encoder.prototype.getLine2 = function() {

    var lz77 = this.getLZ77();
    if (lz77.run >= 3) {
        // use lz77
        this.s += lz77.run;
        this.pushStringBuffer();
        this.golomb.values.push(lz77.offset);
        this.lines.push(lz77);
    } else {
        var value = this.src[this.s++];
        this.pushHuffmanValue(value);
        this.stringValues.push(value);
    }
}

Tose70Encoder.prototype.putLine2 = function(line) {
    
    if (line.type === "raw") {
        this.putBits(0, 1);
        this.putValue(line.value);
        
    } else if (line.type === "string") {
        this.putBits(1, 1);
        this.putBits(7, 3);
        this.putVar(line.run - 1, 3);
        this.putBits(0, 1);
        this.putString(line.string);
        
    } else if (line.type === "lz77") {
        this.putBits(1, 1);
        if (line.run <= 18) {
            // short lz77
            this.putGolomb(line.offset);
            this.putBits(line.run - 3, 4);
            
        } else {
            // long lz77
            this.putBits(7, 3);
            this.putVar((line.run - 3) >> 4, 3);
            this.putBits(1, 1);
            this.putGolomb(line.offset);
            this.putBits((line.run - 3) & 0x0F, 4);
        }
    }
}

Tose70Encoder.prototype.getLine3 = function() {

    var lz77 = this.getLZ77();
    if (lz77.run >= 2) {
        // use lz77
        this.s += lz77.run;
        this.pushStringBuffer();
        this.golomb.values.push(lz77.offset);
        this.lines.push(lz77);
    } else {
        // no compression
        var value = this.src[this.s++];
        var v1 = value & 0xFF;
        var v2 = value >> 8;
        this.pushHuffmanValue(v1);
        this.pushHuffmanValue(v2);
        this.stringValues.push(value);
    }
}

Tose70Encoder.prototype.putLine3 = function(line) {
    
    if (line.type === "raw") {
        this.putBits(0, 1);
        this.putValue(line.value & 0xFF);
        this.putValue(line.value >> 8);
        
    } else if (line.type === "string") {
        this.putBits(1, 1);
        this.putBits(3, 2);
        this.putVar(line.run - 1, 2);
        this.putBits(0, 1);
        for (var i = 0; i < line.string.length; i++) {
            this.putValue(line.string[i] & 0xFF);
            this.putValue(line.string[i] >> 8);
        }
        
    } else if (line.type === "lz77") {
        if (line.run > 9) {
            // long lz77
            this.putBits(1, 1);
            this.putBits(3, 2);
            this.putVar((line.run - 2) >> 3, 2);
            this.putBits(1, 1);
            this.putGolomb(line.offset);
            this.putBits((line.run - 2) & 0x07, 3);
            
        } else {
            // short lz77
            this.putBits(1, 1);
            this.putGolomb(line.offset);
            this.putBits(line.run - 2, 3);
        }
    }
}

Tose70Encoder.prototype.getLine4 = function() {

    // no compression
    var value = this.src[this.s++];
    this.pushHuffmanValue(value);
    this.lines.push({type: "raw", value: value});
}

Tose70Encoder.prototype.putLine4 = function(line) {
    this.putValue(line.value);
}

Tose70Encoder.prototype.pushHuffmanValue = function(v) {

    var node;

    // add the value to the 8-bit huffman node
    node = this.huffman.node8[v];
    if (!node) {
        node = {count: 0, value: v, depth: 1};
        this.huffman.node8[v] = node;
        this.huffman.tree8.push(node);
    }
    node.count++;

    // add the high nybble to the 4-bit huffman node
    var v1 = v >> 4;
    node = this.huffman.node4[v1];
    if (!node) {
        node = {count: 0, value: v1, depth: 1};
        this.huffman.node4[v1] = node;
        this.huffman.tree4.push(node);
    }
    node.count++;

    // add the low nybble to the 4-bit huffman node
    var v2 = v & 0x0F;
    node = this.huffman.node4[v2];
    if (!node) {
        node = {count: 0, value: v2, depth: 1};
        this.huffman.node4[v2] = node;
        this.huffman.tree4.push(node);
    }
    node.count++;
}

Tose70Encoder.prototype.initHuffman = function() {

    this.initHuffmanTree(this.huffman.tree8);
    this.initHuffmanTree(this.huffman.tree4);
    
    // calculate the size of the huffman tree for each mode
    var length0 = 0;
    var length4 = 32;
    var length8 = 128;
    
    var keys, k, node;
    keys = Object.keys(this.huffman.node8);
    length8 += keys.length * 8;
    for (k = 0; k < keys.length; k++) {
        node = this.huffman.node8[keys[k]];
        length0 += node.count * 8;
        length8 += node.count * node.depth;
    }

    keys = Object.keys(this.huffman.node4);
    length4 += keys.length * 4;
    for (k = 0; k < keys.length; k++) {
        node = this.huffman.node4[keys[k]];
        length4 += node.count * node.depth;
    }
    
    if ((length0 <= length4) && (length0 <= length8)) {
        this.m2 = 0;
        this.huffman.size = 0;
        this.huffman.tree = null;
        this.huffman.node = null;
        this.putValue = this.putByte;
    } else if (length4 <= length8) {
        this.m2 = 1;
        this.huffman.size = 4;
        this.huffman.tree = this.huffman.tree4;
        this.huffman.node = this.huffman.node4;
        this.putValue = this.putHuffman4;
    } else {
        this.m2 = 2;
        this.huffman.size = 8;
        this.huffman.tree = this.huffman.tree8;
        this.huffman.node = this.huffman.node8;
        this.putValue = this.putHuffman;
    }
    
    this.putHuffmanTree();
}

Tose70Encoder.prototype.initHuffmanTree = function(tree) {
    
    if (tree.length < 2) return;
    
    while (tree.length > 2) {
        // sort the nodes from lowest to highest occurence
        tree = tree.sort(function(a, b) { return a.count - b.count; })
    
        // combine the two lowest occuring nodes into a new node
        var left = tree.shift();
        var right = tree.shift();
        tree.push({count: left.count + right.count, value: [left, right]});
    }
    
    this.initHuffmanNode(tree);
}

Tose70Encoder.prototype.initHuffmanNode = function(node, depth) {
    depth = depth || 0;
    depth++;
    
    // left node (0)
    if (isNumber(node[0].value)) {
        node[0].depth = depth;
    } else {
        this.initHuffmanNode(node[0].value, depth);
    }

    // right node (1)
    if (!node[1]) return;
    if (isNumber(node[1].value)) {
        node[1].depth = depth;
    } else {
        this.initHuffmanNode(node[1].value, depth);
    }
}

Tose70Encoder.prototype.putHuffmanTree = function() {
    if (this.huffman.size === 0) return;
    
    // make an array of nodes
    var allNodes = [];
    var keys = Object.keys(this.huffman.node);
    for (var k = 0; k < keys.length; k++) allNodes.push(this.huffman.node[keys[k]]);
    
    var code = 0;
    var size = this.huffman.size;
    
    // sort the nodes by depth
    for (var d = 1; d <= (size * 2); d++) {
        // get the subset of nodes at this depth, sorted by Huffman code
        var subNodes = allNodes.filter(function(node) { return node.depth === d; });
        this.putBits(subNodes.length, size);
        subNodes = subNodes.sort(function (a, b) { return a.code - b.code; });
        for (var n = 0; n < subNodes.length; n++) {
            var node = subNodes[n];
            node.code = code;
//            console.log(code.toString(2).padStart(node.depth, '0') + ": " + node.value);
            this.putBits(node.value, size);
            code++;
        }
        code <<= 1;
    }
}

Tose70Encoder.prototype.putHuffman = function(value) {
    if (this.huffman.size === 0) return;
    var node = this.huffman.node[value];
    if (!node) return;
    this.putBits(node.code, node.depth);
}

Tose70Encoder.prototype.putHuffman4 = function(value) {
    this.putHuffman(value >> 4);
    this.putHuffman(value & 0x0F);
}

Tose70Encoder.prototype.initGolomb = function() {

    if (this.golomb.n === 0) return;
    
    // sort the golomb values in ascending order
    this.golomb.values = this.golomb.values.sort(function(a, b) { return a - b; });

    // start with an even distribution of golomb cutoffs
    this.golomb.cutoffs = [];
    for (var i = 0; i < this.golomb.n; i++) {
        this.golomb.cutoffs[i] = Math.max(Math.ceil((i + 1) / this.golomb.n * this.golomb.values.length) - 1, 0);
    }
    
    // optimize the parameters 6 times (this seems to be optimimum)
    this.optimizeGolomb();
    this.optimizeGolomb();
    this.optimizeGolomb();
    this.optimizeGolomb();
    this.optimizeGolomb();
    this.optimizeGolomb();
    
    // write the optimized golomb exponents
    for (var i = 0; i < this.golomb.n; i++) this.putBits(this.golomb.exponents[i] - 1, 4);
}

Tose70Encoder.prototype.optimizeGolomb = function() {
    
    // optimize each parameter
    for (var i = 0; i < (this.golomb.n - 1); i++) {
        
        var bestCutoff = this.golomb.cutoffs[i];
        var bestLength = 0;
        for (var c = this.golomb.cutoffs[i - 1] || 0; c < this.golomb.cutoffs[i + 1]; c++) {
            this.golomb.cutoffs[i] = c;
            var l = this.golombLength();
            if (bestLength === 0 || l < bestLength) {
                bestLength = l;
                bestCutoff = c;
            }
        }
        this.golomb.cutoffs[i] = bestCutoff;
    }
    return this.golombLength();
}

Tose70Encoder.prototype.golombLength = function() {
    this.golomb.parameters = [];
    this.golomb.exponents = [];
    var p = 1;
    var value, i;
    for (i = 0; i < this.golomb.n; i++) {
        value = this.golomb.values[this.golomb.cutoffs[i]] - p;
        var e = 1;
        while ((value > 1) && (e < 16)) {
            e++;
            value >>= 1;
        }
        this.golomb.parameters.push(p);
        this.golomb.exponents.push(e);
        p += 1 << e;
    }

    var sum = 0;
    for (i = 0; i < this.golomb.values.length; i++) {
        value = this.golomb.values[i];
        var j = this.golomb.n - 1;
        while (value < this.golomb.parameters[j]) j--;
        sum += this.golomb.exponents[j] + this.golomb.w;
    }
    return sum;
}

Tose70Encoder.prototype.putGolomb = function(value) {
    
    // find the largest golomb parameter that is less than the value
    var i = this.golomb.n - 1;
    while (value < this.golomb.parameters[i]) i--;
    var p = this.golomb.parameters[i];
    var e = this.golomb.exponents[i];
    this.putBits(i, this.golomb.w);
    this.putBits(value - p, e);
}

Tose70Encoder.prototype.putBits = function(value, n) {
    if (!n) {
        return;
    } else if (n > this.b) {
        n -= this.b;
        this.bitstream |= value >> n;
        value &= (~0 >>> (32 - n));
        this.dest[this.d++] = this.bitstream;
        this.bitstream = 0;
        this.b = 32;
    }
    this.b -= n;
    this.bitstream |= (value << this.b);
}

Tose70Encoder.prototype.putByte = function(value) {
    this.putBits(value, 8);
}

Tose70Encoder.prototype.putVar = function(value, w) {
    // put a variable length number in the bitstream
    var mask = ~0;
    var n = 0;
    while (value & mask) {
        mask <<= w;
        n += w;
    }
    
    while (n) {
        n -= w;
        this.putBits((value & ~mask) >> n, w);
        this.putBits((n === 0) ? 0 : 1, 1);
        mask >>= w;
    }
}

Tose70Encoder.prototype.putString = function(string) {
    for (var i = 0; i < string.length; i++) this.putValue(string[i]);
}

Tose70Encoder.prototype.deltaMod = function(data) {
    if (this.m3 === 1) {
        // nybble delta mod
        return this.deltaMod1(data);
    } else if (this.m3 === 2) {
        // byte delta mod
        return this.deltaMod2(data);
    } else if (this.m3 === 3) {
        // word delta mod
        return this.deltaMod3(data);
    } else if (this.m3 === 4) {
        // even/odd byte delta mod
        return this.deltaMod4(data);
    } else {
        // no delta mod
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
}

Tose70Encoder.prototype.deltaMod1 = function(data) {
    var src = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    var s = 0;
    var dest = new Uint8Array(data.length);
    var d = 0;
    var lo = 0; var hi = 0;
    var lo1 = 0;
    var hi1 = 0;

    while (d < dest.length) {
        hi = src[s++];
        lo = hi & 0x0F;
        hi &= 0xF0;
        hi1 = hi;
        dest[d++] = (lo - (hi1 >> 4)) & 0x0F | (hi - (lo1 << 4)) & 0xF0;
        lo1 = lo;
    }
    return dest;
}

Tose70Encoder.prototype.deltaMod2 = function(data) {
    var src = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    var s = 0;
    var dest = new Uint8Array(data.length);
    var d = 0;

    dest[d++] = src[s++];
    while (d < dest.length) {
        dest[d++] = src[s] - src[s - 1]; s++;
    }
    return dest;
}

Tose70Encoder.prototype.deltaMod3 = function(data) {
    var src = new Uint16Array(data.buffer, data.byteOffset, Math.ceil(data.byteLength / 2));
    var s = 0;
    var dest = new Uint16Array(data.length);
    var d = 0;

    dest[d++] = src[s++];
    while (d < dest.length) {
        dest[d++] = src[s] - src[s - 1]; s++;
    }
    return new Uint8Array(dest.buffer, dest.byteOffset, dest.byteLength);
}

Tose70Encoder.prototype.deltaMod4 = function(data) {
    var src = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    var s = 0;
    var dest = new Uint8Array(data.length);
    var d = 0;

    dest[d++] = src[s++];
    dest[d++] = src[s++];
    while (d < dest.length) {
        dest[d++] = src[s] - src[s - 2]; s++;
    }
    return dest;
}

function Tose70Decoder() {}

Tose70Decoder.prototype.decode = function(data) {
    this.src = new Uint32Array(data.buffer, data.byteOffset, data.byteLength >> 2);
    this.s = 0; // source pointer
    
    // get the decompressed length
    this.length = this.src[this.s++] >> 8; // skip the first byte
    this.dest = new Uint8Array(this.length);
    this.d = 0;

    // initialize the bitstream buffer
    this.bitstream = this.src[this.s++];
    this.b = 32;

    this.miscBits = 0;
    this.golombBits = 0;
    this.huffmanBits = 0;
    this.tBits = 0;
    this.varBits = 0;
    
    // get the compression mode
    var mode = this.getByte();
    var m1 = mode & 0x07;
    var m2 = (mode & 0x18) >> 3;
    var m3 = (mode & 0xE0) >> 5;

    // initialize the Huffman tree
    if (m2 === 0) {
        // no huffman encoding
        this.getValue = this.getByte;
    } else if (m2 === 1) {
        // initialize the huffman table
        this.initHuffman(4);
        this.getValue = this.getHuffman4;
    } else if (m2 === 2) {
        this.initHuffman(8);
        this.getValue = this.getHuffman;
    } else {
        return new Uint8Array(0);
    }

    // initialize the Golomb tree
    if (m1 === 0) {
        this.initGolomb(2);
        this.putLine = this.putLine0;
    } else if (m1 === 1) {
        this.initGolomb(4);
        this.putLine = this.putLine1;
    } else if (m1 === 2) {
        this.initGolomb(7);
        this.putLine = this.putLine2;
    } else if (m1 === 3) {
        this.initGolomb(3);
        this.putLine = this.putLine3;
    } else if (m1 === 4) {
        this.putLine = this.putLine4;
    } else {
        return new Uint8Array(0);
    }

    while (this.d < this.length) this.putLine();
    
    // do post-decoding
    if (m3 === 1) {
        this.postDecode1();
    } else if (m3 === 2) {
        this.postDecode2();
    } else if (m3 === 3) {
        this.postDecode3();
    } else if (m3 === 4) {
        this.postDecode4();
    }
    
    data = data.subarray(0, this.s * 4);
    return this.dest;
}

Tose70Decoder.prototype.getBits = function(n) {
    var value = 0;
    if (n === 0) {
        return 0;
    } else if (n > this.b) {
        // we need more bits than what's left in the buffer
        if (this.b !== 0) {
            // empty the bitstream buffer
            value = this.bitstream >>> (32 - this.b);
            n -= this.b;
            value <<= n;
        }

        // load the next 32-bit word in the buffer
        this.bitstream = this.src[this.s++];
        this.b = 32;
    }

    value |= this.bitstream >>> (32 - n);
    this.bitstream <<= n;
    this.b -= n;
    return value;
}

Tose70Decoder.prototype.getByte = function() {
    this.huffmanBits += 8;
    return this.getBits(8);
}

Tose70Decoder.prototype.getVar = function(w) {
    // get a variable length number
    var value;
    while (true) {
        value |= this.getBits(w);
        this.varBits += w + 1;
        if (!this.getBits(1)) return value;
        value <<= w;
    }
}

Tose70Decoder.prototype.initHuffman = function(size) {
    this.huffmanTree = [];
    var code = 0;
    for (var d = 0; d < (size * 2); d++) {
        // get the number of values at this depth
        this.huffmanBits += size;
        var count = this.getBits(size);
        for (var v = 0; v < count; v++) {
            var node = this.huffmanTree;
            for (var d1 = d; d1 !== 0; d1--) {
                var c = (code >> d1) & 1;
                if (!node[c]) node[c] = [];
                node = node[c];
                if (isNumber(node)) return;
            }
            this.huffmanBits += size;
            node[code & 1] = this.getBits(size);
            code++;
        }
        code <<= 1;
    }
}

Tose70Decoder.prototype.getHuffman = function(node) {
    node = node || this.huffmanTree;
    this.huffmanBits += 1;
    node = node[this.getBits(1)];
    if (isNumber(node)) return node;
    if (!node) return null;
    return this.getHuffman(node);
}

Tose70Decoder.prototype.getHuffman4 = function() {
    var v1 = this.getHuffman();
    var v2 = this.getHuffman();
    return (v1 << 4) | v2;
}

Tose70Decoder.prototype.initGolomb = function(n) {
    this.golombExponent = new Uint8Array(8);
    this.golombParameter = new Uint16Array(8);
    var p = 1;
    var e;
    for (var i = 0; i < n; i++) {
        this.golombBits += 4;
        e = this.getBits(4) + 1;
        this.golombExponent[i] = e;
        this.golombParameter[i] = p;
        p += 1 << e;
    }
}

Tose70Decoder.prototype.getGolomb = function(p) {
    var e = this.golombExponent[p];
    this.golombBits += e;
    return this.getBits(e) + this.golombParameter[p];
}

Tose70Decoder.prototype.putByte = function(byte) {
    if (this.d >= this.dest.length) return;
    this.dest[this.d++] = byte;
}

Tose70Decoder.prototype.putValue = function() {
    this.putByte(this.getValue());
}

Tose70Decoder.prototype.putString = function(run) {
    for (var i = 0; i < run; i++) this.putValue();
}

Tose70Decoder.prototype.putRLE = function(run, byte) {
    for (var i = 0; i < run; i++) this.putByte(byte);
}

Tose70Decoder.prototype.putLZ77 = function(offset, run) {
    if (this.d - offset < 0) return;
    for (var i = 0; i < run; i++) this.putByte(this.dest[this.d - offset]);
}

Tose70Decoder.prototype.putLine0 = function() {

    this.tBits += 2;
    var t = this.getBits(2);
    var run, byte, offset;
    if (t === 3) {
        // repeat a raw 8-bit value
        this.miscBits += 6;
        run = this.getBits(6) + 2;
        this.miscBits += 8;
        byte = this.getBits(8);
        this.putRLE(run, byte);
    } else if (t === 2) {
        // copy a string of encoded values from bitstream
        this.miscBits += 6;
        run = this.getBits(6) + 1;
        this.putString(run);
    } else {
        // repeat run from buffer (lz77)
        offset = this.getGolomb(t);
        this.miscBits += 6;
        run = this.getBits(6) + 3;
        this.putLZ77(offset, run);
    }
}

Tose70Decoder.prototype.putLine1 = function() {
    this.miscBits += 1;
    if (!this.getBits(1)) {
        // not compressed
        this.putValue();
    } else {
        // repeat run from buffer (short)
        this.miscBits += 2;
        var offset = this.getGolomb(this.getBits(2));
        this.miscBits += 4;
        var run = this.getBits(4) + 3;
        this.putLZ77(offset, run);
    }
}

Tose70Decoder.prototype.putLine2 = function() {
    this.miscBits += 1;
    if (!this.getBits(1)) {
        // not compressed
        this.putValue();
        return;
    }

    // compressed
    this.tBits += 3;
    var t = this.getBits(3);
    var run, offset;
    if (t === 7) {
        run = this.getVar(3);
        this.miscBits += 1;
        if (!this.getBits(1)) {
            // copy a string of bytes from bitstream
            run++;
            this.putString(run);
        } else {
            // repeat run from buffer (long)
            this.tBits += 3;
            offset = this.getGolomb(this.getBits(3));
            run <<= 4;
            this.miscBits += 4;
            run += this.getBits(4) + 3;
            this.putLZ77(offset, run);
        }
    } else {
        // repeat run from buffer (short)
        offset = this.getGolomb(t);
        this.miscBits += 4;
        run = this.getBits(4) + 3;
        this.putLZ77(offset, run);
    }
}

Tose70Decoder.prototype.putLine3 = function() {
    this.miscBits += 1;
    if (!this.getBits(1)) {
        // not compressed
        this.putValue();
        this.putValue();
        return;
    }

    // compressed
    this.tBits += 2;
    var t = this.getBits(2);
    var run, offset;
    if (t === 3) {
        run = this.getVar(2);
        this.miscBits += 1;
        if (!this.getBits(1)) {
            // copy a string of bytes from bitstream
            run++;
            this.putString(run * 2);
        } else {
            this.tBits += 2;
            // repeat run from buffer (long)
            offset = this.getGolomb(this.getBits(2));
            run <<= 3;
            this.miscBits += 3;
            run += this.getBits(3) + 2;
            this.putLZ77(offset * 2, run * 2);
        }
    } else {
        // repeat run from buffer (short)
        offset = this.getGolomb(t);
        this.miscBits += 3;
        run = this.getBits(3) + 2;
        this.putLZ77(offset * 2, run * 2);
    }
}

Tose70Decoder.prototype.putLine4 = function() {
    this.putValue();
}

Tose70Decoder.prototype.postDecode1 = function() {
    this.d = 0;
    var previous = 0;
    var hi, lo;
    while (this.d < this.length) {
        hi = this.dest[this.d] & 0xF0;
        lo = this.dest[this.d] & 0x0F;
        hi = (hi + previous) & 0xF0;
        lo = (lo + (hi >> 4)) & 0x0F;
        this.dest[this.d++] = lo | hi;
        previous = lo << 4;
    }
}

Tose70Decoder.prototype.postDecode2 = function() {
    this.d = 0;
    var previous = 0;
    while (this.d < this.length) {
        previous = (this.dest[this.d] + previous) & 0xFF;
        this.dest[this.d++] = previous;
    }
}

Tose70Decoder.prototype.postDecode3 = function() {
    this.d = 0;
    var previous = 0;
    var current = 0;
    while (this.d < this.length) {
        current = this.dest[this.d];
        current |= (this.dest[this.d + 1] << 8);
        current = (current + previous) & 0xFFFF;
        previous = current;
        this.dest[this.d++] = current & 0xFF;
        this.dest[this.d++] = current >> 8;
    }
}

Tose70Decoder.prototype.postDecode4 = function() {
    this.d = 0;
    var previous1 = 0;
    var previous2 = 0;
    while (this.d < this.length) {
        previous1 = (this.dest[this.d] + previous1) & 0xFF;
        this.dest[this.d++] = previous1;
        previous2 = (this.dest[this.d] + previous2) & 0xFF;
        this.dest[this.d++] = previous2;
    }
}

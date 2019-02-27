//
// gfx.js
// created 1/7/2018
//

var Uint8Array;
var Uint16Array;
var Uint32Array;

var GFX = {}

GFX.makeLong = function(a,b) { return ((a & 0xFFFF) | ((b & 0xFFFF) << 16)); }
GFX.makeWord = function(a,b) { return ((a & 0xFF) | ((b & 0xFF) << 8)); }
GFX.makeByte = function(a,b) { return ((a & 0x0F) | ((b & 0x0F) << 4)); }
GFX.hiWord = function(a) { return ((a >> 16) & 0xFFFF); }
GFX.loWord = function(a) { return (a & 0xFFFF); }
GFX.hiByte = function(a) { return ((a >> 8) & 0xFF); }
GFX.loByte = function(a) { return (a & 0xFF); }
GFX.hiNybble = function(a) { return ((a >> 4) & 0x0F); }
GFX.loNybble = function(a) { return (a & 0x0F); }

GFX.GraphicsFormat = {
    linear8bpp: "linear8bpp",
    linear4bpp: "linear4bpp",
    linear2bpp: "linear2bpp",
    linear1bpp: "linear1bpp",
    nes2bpp: "nes2bpp",
    nes1bpp: "nes1bpp",
    snesMode7: "snesMode7",
    snes8bpp: "snes8bpp",
    snes4bpp: "snes4bpp",
    snes3bpp: "snes3bpp",
    snes2bpp: "snes2bpp",
    genesis4bpp: "genesis4bpp"
};

GFX.PaletteFormat = {
    argb8888: "argb8888",
    bgr555: "bgr555",
    nesPalette: "nesPalette"
}

GFX.TileFormat = {
    default: "default",
    gba4bppTile: "gba4bppTile",
    gba2bppTile: "gba2bppTile",
    nesBGTile: "nesBGTile",
    nesSpriteTile: "nesSpriteTile",
    snes4bppTile: "snes4bppTile",
    snes2bppTile: "snes2bppTile",
    snesSpriteTile: "snesSpriteTile",
}

GFX.Z = {
    bottom: 0, // force to bottom
    snesBk: 0, // snes back area
    snew4L: 2, // snes layer 4, low priority
    snes3L: 3, // snes layer 3, low priority
    snesS0: 4, // snes sprites, priority 0
    snes4H: 6, // snes layer 4, high priority
    snes3H: 7, // snes layer 3, high priority
    snesS1: 8, // snes sprites, priority 1
    snes2L: 10, // snes layer 2, low priority
    snes1L: 11, // snes layer 1, low priority
    snesS2: 12, // snes sprites, priority 2
    snes2H: 14, // snes layer 2, high priority
    snes1H: 15, // snes layer 1, high priority
    snesS3: 16, // snes sprites, priority 3
    snes3P: 17, // snes layer 3, highest priority
    top: 100 // force to top
}

GFX.decode = function(data, format) {
        
    switch (format) {
        case GFX.GraphicsFormat.linear4bpp:
            return GFX.decodeLinear4bpp(data);

        case GFX.GraphicsFormat.snes4bpp:
            return GFX.decodeSNES4bpp(data);

        case GFX.GraphicsFormat.snes3bpp:
            return GFX.decodeSNES3bpp(data);

        case GFX.GraphicsFormat.snes2bpp:
            return GFX.decodeSNES2bpp(data);

        case GFX.PaletteFormat.bgr555:
            return GFX.decodeBGR555(data);
            
        default:
            return data;
    }
}

GFX.decodeLinear8bpp = function(data) {
    return data;
}

GFX.encodeLinear8bpp = function(data) {
    return data;
}

GFX.decodeLinear4bpp = function(data) {
    
    // 8-bit source, 8-bit destination
    var src = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    var dest = new Uint8Array(data.byteLength * 2);
    
    var s = 0;
    var d = 0;
    var c;

    while (s < src.length) {
        c = src[s++];
        dest[d++] = GFX.loNybble(c);
        dest[d++] = GFX.hiNybble(c);
    }
    return dest;
}

GFX.encodeLinear4bpp = function(data) {
    
    // 8-bit source, 8-bit destination
    var src = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    var dest = new Uint8Array(Math.ceil(data.byteLength / 2));
    
    var s = 0;
    var d = 0;
    var a1, a2;

    while (s < src.length) {
        a1 = src[s++] & 0x0F;
        a2 = (src[s++] || 0) & 0x0F;
        dest[d++] = GFX.makeByte(a1,a2);
    }
    return dest;
}

GFX.decodeLinear2bpp = function(data) {
    
    // 8-bit source, 8-bit destination
    var src = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    var dest = new Uint8Array(data.byteLength * 4);
    
    var s = 0;
    var d = 0;
    var c;

    while (s < src.length) {
        c = src[s++];
        dest[d++] = c & 0x03; c >>= 2;
        dest[d++] = c & 0x03; c >>= 2;
        dest[d++] = c & 0x03; c >>= 2;
        dest[d++] = c & 0x03;
    }
    return dest;
}

GFX.encodeLinear2bpp = function(data) {
    
    // 8-bit source, 8-bit destination
    var src = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    var dest = new Uint8Array(Math.ceil(data.byteLength / 4));
    
    var s = 0;
    var d = 0;
    var a1, a2, a3, a4;

    while (s < src.length) {
        a1 = src[s++] & 0x03;
        a2 = (src[s++] || 0) & 0x03;
        a3 = (src[s++] || 0) & 0x03;
        a4 = (src[s++] || 0) & 0x03;
        dest[d++] = a1 | (a2 << 2) | (a3 << 4) | (a4 << 6);
    }
    return dest;
}

GFX.decodeLinear1bpp = function(data) {
    
    // 8-bit source, 8-bit destination
    var src = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    var dest = new Uint8Array(data.byteLength * 8);
    
    var s = 0;
    var d = 0;
    var c;

    while (s < src.length) {
        c = src[s++];
        dest[d++] = c & 1; c >>= 1;
        dest[d++] = c & 1; c >>= 1;
        dest[d++] = c & 1; c >>= 1;
        dest[d++] = c & 1; c >>= 1;
        dest[d++] = c & 1; c >>= 1;
        dest[d++] = c & 1; c >>= 1;
        dest[d++] = c & 1; c >>= 1;
        dest[d++] = c & 1;
    }
    return dest;
}

GFX.encodeLinear1bpp = function(data) {
    
    // 8-bit source, 8-bit destination
    var src = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    var dest = new Uint8Array(Math.ceil(data.byteLength / 8));
    
    var s = 0;
    var d = 0;
    var a;

    while (s < src.length) {
        a = src[s++] & 1;
        a |= (src[s++] & 1) << 1;
        a |= (src[s++] & 1) << 2;
        a |= (src[s++] & 1) << 3;
        a |= (src[s++] & 1) << 4;
        a |= (src[s++] & 1) << 5;
        a |= (src[s++] & 1) << 6;
        a |= (src[s++] & 1) << 7;
        dest[d++] = a;
    }
    return dest;
}

GFX.decodeNES2bpp = function(data) {

    // 8-bit source, 8-bit destination
    var src = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    var dest = new Uint8Array(data.byteLength * 4);

    var s = 0;
    var d = 0;
    var c, bp1, bp2, bp;

    while (s < src.length) {
        for (r = 0; r < 8; r++) {
            bp2 = src[s + 8];
            bp1 = src[s++];
            bp = GFX.makeWord(bp1, bp2);
            for (b = 0; b < 8; b++) {
                c = bp & 0x8080;
                c >>= 7;
                c |= (c >> 7);
                c &= 0x03;
                dest[d++] = c;
                bp <<= 1;
            }
        }
        s += 8;
    }
    return dest;
}

GFX.decodeSNES4bpp = function(data) {
    
    // 16-bit source, 8-bit destination
    var src = new Uint16Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 2));
    var dest = new Uint8Array(data.byteLength * 2);
    
    var s = 0;
    var d = 0;
    var bp12, bp34, bp, c, r, b;

    while (s < src.length) {
        for (r = 0; r < 8; r++) {
            bp34 = src[s + 8];
            bp12 = src[s++];
            bp = GFX.makeLong(bp12, bp34);
            for (b = 0; b < 8; b++) {
                c = bp & 0x80808080;
                c >>= 7;
                c |= (c >> 7);
                c |= (c >> 14);
                c &= 0x0F;
                dest[d++] = c;
                bp <<= 1;
            }
        }
        s += 8;
    }
    return dest;
}

GFX.decodeSNES3bpp = function(data) {
    
    // 16-bit/8-bit source, 8-bit destination
    var src16 = new Uint16Array(data.buffer, data.byteOffset, data.byteLength / 2);
    var src8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    var dest = new Uint8Array(Math.ceil(data.byteLength * 8 / 3));

    var s16 = 0;
    var s8 = 16;
    var d = 0;
    var bp12, bp3, bp, c, r, b;
    
    while (s16 < src16.length) {
        for (r = 0; r < 8; r++) {
            bp12 = src16[s16++];
            bp3 = src8[s8++];
            bp = GFX.makeLong(bp12, bp3);
            for (b = 0; b < 8; b++) {
                c = bp & 0x808080;
                c >>= 7;
                c |= (c >> 7);
                c |= (c >> 14);
                c &= 0x07;
                dest[d++] = c;
                bp <<= 1;
            }
        }
        s16 += 4;
        s8 += 16;
    }
    return dest;
}

GFX.decodeSNES2bpp = function(data) {
    
    // 16-bit source, 8-bit destination
    var src = new Uint16Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 2));
    var dest = new Uint8Array(data.byteLength * 4);
    
    var s = 0;
    var d = 0;
    var bp, c, r, b;

    while (s < src.length) {
        for (r = 0; r < 8; r++) {
            bp = src[s++];
            for (b = 0; b < 8; b++) {
                c = bp & 0x8080;
                c >>= 7;
                c |= (c >> 7);
                c &= 0x03;
                dest[d++] = c;
                bp <<= 1;
            }
        }
    }
    return dest;
};

// from blargg's full palette demo
GFX.colorsNES = [
    [ 84,  84,  84], [  0,  30, 116], [  8,  16, 144], [ 48,   0, 136],
    [ 68,   0, 100], [ 92,   0,  48], [ 84,   4,   0], [ 60,  24,   0],
    [ 32,  42,   0], [  8,  58,   0], [  0,  64,   0], [  0,  60,   0],
    [  0,  50,  60], [  0,   0,   0], [  0,   0,   0], [  0,   0,   0],
    
    [152, 150, 152], [  8,  76, 196], [ 48,  50, 236], [ 92,  30, 228],
    [136,  20, 176], [160,  20, 100], [152,  34,  32], [120,  60,   0],
    [ 84,  90,   0], [ 40, 114,   0], [  8, 124,   0], [  0, 118,  40],
    [  0, 102, 120], [  0,   0,   0], [  0,   0,   0], [  0,   0,   0],
    
    [236, 238, 236], [ 76, 154, 236], [120, 124, 236], [176,  98, 236],
    [228,  84, 236], [236,  88, 180], [236, 106, 100], [212, 136,  32],
    [160, 170,   0], [116, 196,   0], [ 76, 208,  32], [ 56, 204, 108],
    [ 56, 180, 204], [ 60,  60,  60], [  0,   0,   0], [  0,   0,   0],
    
    [236, 238, 236], [168, 204, 236], [188, 188, 236], [212, 178, 236],
    [236, 174, 236], [236, 174, 212], [236, 180, 176], [228, 196, 144],
    [204, 210, 120], [180, 222, 120], [168, 226, 144], [152, 226, 180],
    [160, 214, 228], [160, 162, 160], [  0,   0,   0], [  0,   0,   0]
];

GFX.decodeNESPalette = function(data) {
    
    // 8-bit source, 8-bit destination
    var src = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    var dest = new Uint8Array(data.byteLength * 4);

    var s = 0;
    var d = 0;
    var c;

    while (s < src.length) {
        c = src[s++] & 0x3F;
        dest[d++] = GFX.colorsNES[c][0];
        dest[d++] = GFX.colorsNES[c][1];
        dest[d++] = GFX.colorsNES[c][2];
        dest[d++] = 0xFF;
    }
    return new Uint32Array(dest.buffer, dest.byteOffset, Math.ceil(dest.byteLength / 4));
}

GFX.colors31 = [0, 8, 16, 25, 33, 41, 49, 58, 66, 74, 82, 90, 99, 107, 115, 123, 132, 140, 148, 156, 165, 173, 181, 189, 197, 206, 214, 222, 230, 239, 247, 255];

GFX.decodeBGR555 = function(data) {
    
    // 16-bit source, 8-bit destination
    var src = new Uint16Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 2));
    var dest = new Uint8Array(data.byteLength * 2);

    var s = 0;
    var d = 0;
    var bgr555;

    while (s < src.length) {
        bgr555 = src[s++];
        dest[d++] = GFX.colors31[bgr555 & 0x1F]; bgr555 >>= 5;
        dest[d++] = GFX.colors31[bgr555 & 0x1F]; bgr555 >>= 5;
        dest[d++] = GFX.colors31[bgr555 & 0x1F];
        dest[d++] = 0xFF;
    }
    return new Uint32Array(dest.buffer, dest.byteOffset, Math.ceil(dest.byteLength / 4));
}

GFX.render = function(dest, gfx, pal, ppl) {
    
    // 32-bit destination, 32-bit palette
    dest = new Uint32Array(dest.buffer, dest.byteOffset);
    pal = new Uint32Array(pal.buffer, pal.byteOffset, Math.ceil(pal.byteLength / 4));

    var g = 0;
    var d = 0;
    var x = 0;
    var y, c, p;
    
    while (g < gfx.length) {
        y = d + x;
        for (var line = 0; line < 8; line++) {
            p = y;
            c = gfx[g++]; if (c) dest[p] = pal[c]; p++;
            c = gfx[g++]; if (c) dest[p] = pal[c]; p++;
            c = gfx[g++]; if (c) dest[p] = pal[c]; p++;
            c = gfx[g++]; if (c) dest[p] = pal[c]; p++;
            c = gfx[g++]; if (c) dest[p] = pal[c]; p++;
            c = gfx[g++]; if (c) dest[p] = pal[c]; p++;
            c = gfx[g++]; if (c) dest[p] = pal[c]; p++;
            c = gfx[g++]; if (c) dest[p] = pal[c]; p++;
            y += ppl;
        }
        x += 8;
        if (x >= ppl) {
            x = 0;
            d += 8 * ppl;
        }
    }
}

GFX.PPU = function() {
    var Layer = function() {
        this.format = 0;
        this.rows = 32;
        this.cols = 32;
        this.x = 0;
        this.y = 0;
        this.z = new Array(16).fill(0);
        this.gfx = null;
        this.tiles = null;
        this.attr = null;
        this.main = false;
        this.sub = false;
        this.math = false;
    }
    this.layers = [new Layer(), new Layer(), new Layer(), new Layer()];
    this.height = 0;
    this.width = 0;
    this.pal = null;
    this.subtract = false;
    this.half = false;
    this.back = false;
    this.flipped = false;
}

GFX.PPU.prototype.renderPPU = function(dest, x, y, width, height) {
    
    // declare this variable so i can access the ppu inside closures
    var ppu = this;

    x = x || 0;
    y = y || 0;
    width = width || ppu.width;
    height = height || ppu.height;
    
    // 32-bit destination, 32-bit palette
    dest = new Uint32Array(dest.buffer, dest.byteOffset);
    ppu.pal = new Uint32Array(ppu.pal.buffer, ppu.pal.byteOffset);

    // line buffers
    var main; // = new Uint32Array(width);
    var sub = new Uint32Array(width);
    var zBuffer = new Uint8Array(width);

    var d = 0; // destination buffer location
    var l; // layer index
    var layer;
    
    var ly, lx;
    var tx, ty;
    var i, c, s, t, p, z, h, v, m;
    
    // color math as determined by ppu
    var math = GFX.mathNone;
    var ppuMath = GFX.mathNone;
    if (ppu.subtract) {
        ppuMath = ppu.half ? GFX.mathHalfSub : GFX.mathSub;
    } else {
        ppuMath = ppu.half ? GFX.mathHalfAdd : GFX.mathAdd;
    }

    // tile format based on layer
    var updateTile;
    
    // pixel rendering function
    var renderPixel;

    function renderPixelSub() {
        if (layer.z[z] > zBuffer[i]) {
            c = layer.gfx[t + ty + tx];
            if (c & m) {
                zBuffer[i] = layer.z[z];
                sub[i] = ppu.pal[p + c];
            }
        }
        ++i;
        ++lx;
    }

    function renderPixelMain() {
        if (layer.z[z] > zBuffer[i]) {
            c = layer.gfx[t + ty + tx];
            if (c & m) {
                zBuffer[i] = layer.z[z];
                s = sub[i];
                if (s) {
                    main[i] = math(ppu.pal[p + c], s);
                } else {
                    main[i] = ppu.pal[p + c];
                }
            }
        }
        ++i;
        ++lx;
    }

    function updateTileGBA4bpp() {
        var row = (ly >> 3) % layer.rows;
        var col = (lx >> 3) % layer.cols;
        t = layer.tiles[col + row * layer.cols];
        p = (t & 0x7000) >> 8; // palette
        z = (t & 0x8000) >> 15; // z-level
        h = (t & 0x0400); // horizontal flip
        v = (t & 0x0800); // vertical flip
        t = (t & 0x03FF) << 6; // tile index
        ty = (v ? (7 - (ly & 7)) : (ly & 7)) << 3;
        m = 15;
    }

    function updateTileGBA2bpp() {
        var row = (ly >> 3) % layer.rows;
        var col = (lx >> 3) % layer.cols;
        t = layer.tiles[col + row * layer.cols];
        p = (t & 0x7000) >> 10; // palette
        z = (t & 0x8000) >> 15; // z-level
        h = (t & 0x0400); // horizontal flip
        v = (t & 0x0800); // vertical flip
        t = (t & 0x03FF) << 6; // tile index
        ty = (v ? (7 - (ly & 7)) : (ly & 7)) << 3;
        m = 3;
    }

    function updateTileSNES4bpp() {
        var row = (ly >> 3) % layer.rows;
        var col = (lx >> 3) % layer.cols;
        t = layer.tiles[col + row * layer.cols];
        p = (t & 0x1C00) >> 6; // palette
        z = (t & 0x2000) >> 13; // z-level
        h = (t & 0x4000); // horizontal flip
        v = (t & 0x8000); // vertical flip
        t = (t & 0x03FF) << 6; // tile index
        ty = (v ? (7 - (ly & 7)) : (ly & 7)) << 3;
        m = 15;
    }

    function updateTileSNES2bpp() {
        var row = (ly >> 3) % layer.rows;
        var col = (lx >> 3) % layer.cols;
        t = layer.tiles[col + row * layer.cols];
        p = (t & 0x1C00) >> 8; // palette
        z = (t & 0x2000) >> 13; // z-level
        h = (t & 0x4000); // horizontal flip
        v = (t & 0x8000); // vertical flip
        t = (t & 0x03FF) << 6; // tile index
        ty = (v ? (7 - (ly & 7)) : (ly & 7)) << 3;
        m = 3;
    }
    
    function updateTileSNESSprite() {
        var row = (ly >> 3) % layer.rows;
        var col = (lx >> 3) % layer.cols;
        t = layer.tiles[col + row * layer.cols];
        p = (t & 0x0E00) >> 5; // palette
        z = (t & 0x3000) >> 12; // z-level
        h = (t & 0x4000); // horizontal flip
        v = (t & 0x8000); // vertical flip
        t = (t & 0x01FF) << 6; // tile index
        ty = (v ? (7 - (ly & 7)) : (ly & 7)) << 3;
        m = 15;
    }

    function updateTileNESBG() {
        var row = (ly >> 3) % layer.rows;
        var col = (lx >> 3) % layer.cols;
        var poo = col + row * layer.cols;
        t = layer.tiles[poo] << 6; // tile index
        p = layer.attr[poo >> 2]; // palette index (from attribute table)
        p >>= (poo & 3); p &= 0x03; p <<= 2;
        z = 0;
        ty = (ly & 7) << 3;
        m = 3;
    }

    function renderLayerLine() {
        
        ly = y + layer.y; // y location in layer (ignoring flip)
        lx = x + layer.x; // x location in layer (ignoring flip)
        while (ly < 0) ly += 0x1000;
        while (lx < 0) lx += 0x1000;
        i = 0; // scanline x position
        
        // draw first tile
        updateTile();
        tx = (h ? (7 - lx) : lx) & 7;
        while (h ? (tx >= 0) : (tx < 8)) {
            renderPixel();
            h ? --tx : ++tx;
        }

        // draw mid tiles
        while (i < width - 8) {
            updateTile();
            if (h) {
                tx = 7;
                while (tx >= 0) {
                    renderPixel();
                    --tx;
                }
            } else {
                tx = 0;
                while (tx < 8) {
                    renderPixel();
                    ++tx;
                }
            }
        }
        
        // draw last tile
        updateTile();
        tx = h ? 7 : 0;
        while (i < width) {
            renderPixel();
            h ? --tx : ++tx;
        }
    }
    
    function renderLine() {
                
        zBuffer.fill(0);
        sub.fill(0);
        
        // render subscreen layers
        renderPixel = renderPixelSub;
        for (l = 0; l < 4; l++) {
            layer = ppu.layers[l];
            if (layer.sub) {
                switch (layer.format) {
                    case GFX.TileFormat.gba2bppTile:
                        updateTile = updateTileGBA2bpp;
                        break;
                    case GFX.TileFormat.gba4bppTile:
                        updateTile = updateTileGBA4bpp;
                        break;
                    case GFX.TileFormat.snes2bppTile:
                        updateTile = updateTileSNES2bpp;
                        break;
                    case GFX.TileFormat.snes4bppTile:
                        updateTile = updateTileSNES4bpp;
                        break;
                    case GFX.TileFormat.snesSpriteTile:
                        updateTile = updateTileSNESSprite;
                        break;
                    case GFX.TileFormat.nesBGTile:
                        updateTile = updateTileNESBG;
                        break;
                }
                renderLayerLine();
            }
        }
        
        // clear the z-level
        zBuffer.fill(0);

        // render main screen layers
        main = new Uint32Array(width);
        renderPixel = renderPixelMain;
        
        // render the back area
        if (ppu.back) {
            c = ppu.pal[0];
            main.fill(c);
        }

        for (l = 0; l < 4; l++) {
            layer = ppu.layers[l];
            if (layer.main) {
                switch (layer.format) {
                    case GFX.TileFormat.gba2bppTile:
                        updateTile = updateTileGBA2bpp;
                        break;
                    case GFX.TileFormat.gba4bppTile:
                        updateTile = updateTileGBA4bpp;
                        break;
                    case GFX.TileFormat.snes2bppTile:
                        updateTile = updateTileSNES2bpp;
                        break;
                    case GFX.TileFormat.snes4bppTile:
                        updateTile = updateTileSNES4bpp;
                        break;
                    case GFX.TileFormat.snesSpriteTile:
                        updateTile = updateTileSNESSprite;
                        break;
                    case GFX.TileFormat.nesBGTile:
                        updateTile = updateTileNESBG;
                        break;
                }
                math = layer.math ? ppuMath : GFX.mathNone;
                renderLayerLine();
            }
        }
    }
        
    // render each scanline
    var yf = y + height;
    
    while (y < yf) {
        renderLine();
        dest.set(main, d);
        d += width;
        if (d > dest.length) break;
        y++;
    }

    return;
}

//GFX.PPU.prototype.renderPPUx = function(dest, x, y, width, height) {
//    
//    // declare this variable so i can access the ppu inside closures
//    var ppu = this;
//
//    x = x || 0;
//    y = y || 0;
//    width = width || ppu.width;
//    height = height || ppu.height;
//    
//    // 32-bit destination, 32-bit palette
//    dest = new Uint32Array(dest.buffer, dest.byteOffset);
//    ppu.pal = new Uint32Array(ppu.pal.buffer, ppu.pal.byteOffset);
//
//    // line buffers
//    var main = dest;
//    var sub = new Uint32Array(dest.length);
//    var zBuffer = new Uint8Array(dest.length);
//
//    var d = 0; // destination buffer location
//    var l; // layer index
//    var layer;
//    
//    var ly, lx;
//    var tx, ty;
//    var dx, dy, poo;
//    var i, c, s, t, p, z, h, v, m;
//    
//    // color math as determined by ppu
//    var math = GFX.mathNone;
//    var ppuMath = GFX.mathNone;
//    if (ppu.subtract) {
//        ppuMath = ppu.half ? GFX.mathHalfSub : GFX.mathSub;
//    } else {
//        ppuMath = ppu.half ? GFX.mathHalfAdd : GFX.mathAdd;
//    }
//    
//    // tile format based on layer
//    var updateTile;
//    
//    // pixel rendering function
//    var renderPixel;
//
//    function renderPixelSub() {
//        i = d + dx + dy;
//        if (layer.z[z] > zBuffer[i]) {
//            c = layer.gfx[t + ty + tx];
//            if (c & m) {
//                zBuffer[i] = layer.z[z];
//                sub[i] = ppu.pal[p + c];
//            }
//        }
//        ++dx;
//    }
//
//    function renderPixelMain() {
//        i = d + dx + dy;
//        if (layer.z[z] > zBuffer[i]) {
//            c = layer.gfx[t + ty + tx];
//            if (c & m) {
//                zBuffer[i] = layer.z[z];
//                s = sub[i];
//                if (s) {
//                    main[i] = math(ppu.pal[p + c], s);
//                } else {
//                    main[i] = ppu.pal[p + c];
//                }
//            }
//        }
//        ++dx;
//    }
//
//    function updateTileGBA4bpp() {
//        var row = (ly >> 3) % layer.rows;
//        var col = (lx >> 3) % layer.cols;
//        t = layer.tiles[col + row * layer.cols];
//        p = (t & 0x7000) >> 8; // palette
//        z = (t & 0x8000) >> 15; // z-level
//        h = (t & 0x0400); // horizontal flip
//        v = (t & 0x0800); // vertical flip
//        t = (t & 0x03FF) << 6; // tile index
//        m = 15;
//    }
//
//    function updateTileGBA2bpp() {
//        var row = (ly >> 3) % layer.rows;
//        var col = (lx >> 3) % layer.cols;
//        t = layer.tiles[col + row * layer.cols];
//        p = (t & 0x7000) >> 10; // palette
//        z = (t & 0x8000) >> 15; // z-level
//        h = (t & 0x0400); // horizontal flip
//        v = (t & 0x0800); // vertical flip
//        t = (t & 0x03FF) << 6; // tile index
//        m = 3;
//    }
//
//    function updateTileSNES4bpp() {
//        var row = (ly >> 3) % layer.rows;
//        var col = (lx >> 3) % layer.cols;
//        t = layer.tiles[col + row * layer.cols];
//        p = (t & 0x1C00) >> 6; // palette
//        z = (t & 0x2000) >> 13; // z-level
//        h = (t & 0x4000); // horizontal flip
//        v = (t & 0x8000); // vertical flip
//        t = (t & 0x03FF) << 6; // tile index
//        m = 15;
//    }
//
//    function updateTileSNES2bpp() {
//        var row = (ly >> 3) % layer.rows;
//        var col = (lx >> 3) % layer.cols;
//        t = layer.tiles[col + row * layer.cols];
//        p = (t & 0x1C00) >> 8; // palette
//        z = (t & 0x2000) >> 13; // z-level
//        h = (t & 0x4000); // horizontal flip
//        v = (t & 0x8000); // vertical flip
//        t = (t & 0x03FF) << 6; // tile index
//        m = 3;
//    }
//    
//    function updateTileSNESSprite() {
//        var row = (ly >> 3) % layer.rows;
//        var col = (lx >> 3) % layer.cols;
//        t = layer.tiles[col + row * layer.cols];
//        p = (t & 0x0E00) >> 5; // palette
//        z = (t & 0x3000) >> 12; // z-level
//        h = (t & 0x4000); // horizontal flip
//        v = (t & 0x8000); // vertical flip
//        t = (t & 0x01FF) << 6; // tile index
//        m = 15;
//    }
//
//    function updateTileNESBG() {
//        var row = (ly >> 3) % layer.rows;
//        var col = (lx >> 3) % layer.cols;
//        t = layer.tiles[col + row * layer.cols]; // tile index
//        p = layer.attr[t]; // palette index (from attribute table)
//        m = 3;
//    }
//
//    function renderTile() {
//        updateTile();
//        dy = 0;
//        if (v) {
//            ty = 56;
//            while (ty >= 0) {
//                dx = poo;
//                if (h) {
//                    tx = 7;
//                    while (tx >= 0) {
//                        renderPixel();
//                        --tx;
//                    }
//                } else {
//                    tx = 0;
//                    while (tx < 8) {
//                        renderPixel();
//                        ++tx;
//                    }
//                }
//                ty -= 8;
//                dy += width;
//            }
//        } else {
//            ty = 0;
//            while (ty < 64) {
//                dx = poo;
//                if (h) {
//                    tx = 7;
//                    while (tx >= 0) {
//                        renderPixel();
//                        --tx;
//                    }
//                } else {
//                    tx = 0;
//                    while (tx < 8) {
//                        renderPixel();
//                        ++tx;
//                    }
//                }
//                ty += 8;
//                dy += width;
//            }
//        }
//    }
//    
//    function renderLayer() {
//        
//        ly = y + layer.y; // y location in layer (ignoring flip)
//        while (ly < 0) ly += 0x1000;
//        var lyf = ly + height;
//        d = 0;
//        
//        // draw mid rows
//        while (ly < lyf) {
//            lx = x + layer.x; // x location in layer (ignoring flip)
//            while (lx < 0) lx += 0x1000;
//            var lxf = lx + width;
//
//            poo = 0;
//            while (lx < lxf) {
//                renderTile();
//                lx += 8;
//                poo += 8;
//            }
//            ly += 8;
//            d += width * 8;
//        }
//    }
//                    
//    // render subscreen layers
//    renderPixel = renderPixelSub;
//    for (l = 0; l < 4; l++) {
//        layer = ppu.layers[l];
//        if (layer.sub) {
//            switch (layer.format) {
//                case GFX.TileFormat.gba2bppTile:
//                    updateTile = updateTileGBA2bpp;
//                    break;
//                case GFX.TileFormat.gba4bppTile:
//                    updateTile = updateTileGBA4bpp;
//                    break;
//                case GFX.TileFormat.snes2bppTile:
//                    updateTile = updateTileSNES2bpp;
//                    break;
//                case GFX.TileFormat.snes4bppTile:
//                    updateTile = updateTileSNES4bpp;
//                    break;
//                case GFX.TileFormat.snesSpriteTile:
//                    updateTile = updateTileSNESSprite;
//                    break;
//                case GFX.TileFormat.nesBGTile:
//                    updateTile = updateTileNESBG;
//                    break;
//            }
//            renderLayer();
//        }
//    }
//
//    // clear the z-level
//    zBuffer.fill(0);
//
//    // render the back area
//    if (ppu.back) {
//        c = ppu.pal[0];
//        main.fill(c);
//    }
//
//    // render main screen layers
//    renderPixel = renderPixelMain;
//    for (l = 0; l < 4; l++) {
//        layer = ppu.layers[l];
//        if (layer.main) {
//            switch (layer.format) {
//                case GFX.TileFormat.gba2bppTile:
//                    updateTile = updateTileGBA2bpp;
//                    break;
//                case GFX.TileFormat.gba4bppTile:
//                    updateTile = updateTileGBA4bpp;
//                    break;
//                case GFX.TileFormat.snes2bppTile:
//                    updateTile = updateTileSNES2bpp;
//                    break;
//                case GFX.TileFormat.snes4bppTile:
//                    updateTile = updateTileSNES4bpp;
//                    break;
//                case GFX.TileFormat.snesSpriteTile:
//                    updateTile = updateTileSNESSprite;
//                    break;
//                case GFX.TileFormat.nesBGTile:
//                    updateTile = updateTileNESBG;
//                    break;
//            }
//            math = layer.math ? ppuMath : GFX.mathNone;
//            renderLayer();
//        }
//    }
//
//    return;
//}

GFX.mathNone = function(c1) {
    return c1;
}

GFX.mathAdd = function(c1, c2) {
    var b1 = c1 & 0x000000FF;
    var g1 = c1 & 0x0000FF00;
    var r1 = c1 & 0x00FF0000;
    var b2 = c2 & 0x000000FF;
    var g2 = c2 & 0x0000FF00;
    var r2 = c2 & 0x00FF0000;
    var b = b1 + b2; if (b > 0x000000FF) b = 0x000000FF;
    var g = g1 + g2; if (g > 0x0000FF00) g = 0x0000FF00;
    var r = r1 + r2; if (r > 0x00FF0000) r = 0x00FF0000;
    var a = 0xFF000000;
    return b | g | r | a;
}

GFX.mathHalfAdd = function(c1, c2) {
    if (c2 == 0) {
        return c1;
    }
    var c = ((c1 & 0x00FEFEFE) + (c2 & 0x00FEFEFE)) >> 1;
    c += (c1 & c2 & 0x00010101);
    c += 0xFF000000;
    return c;
}

GFX.mathSub = function(c1, c2) {
    var c = 0;
    var b1 = c1 & 0x000000FF;
    var g1 = c1 & 0x0000FF00;
    var r1 = c1 & 0x00FF0000;
    var a1 = c1 & 0xFF000000;
    var b2 = c2 & 0x000000FF;
    var g2 = c2 & 0x0000FF00;
    var r2 = c2 & 0x00FF0000;
    if (r1 > r2) c += (r1 - r2);
    if (g1 > g2) c += (g1 - g2);
    if (b1 > b2) c += (b1 - b2);
    c += a1;
    return c;
}

GFX.mathHalfSub = function(c1, c2) {
    var b1 = c1 & 0x000000FF;
    var g1 = c1 & 0x0000FF00;
    var r1 = c1 & 0x00FF0000;
    var a1 = c1 & 0xFF000000;
    var b2 = (c2 & 0x000000FE) >> 1;
    var g2 = (c2 & 0x0000FE00) >> 1;
    var r2 = (c2 & 0x00FE0000) >> 1;
    var b = b1 - b2; if (b < 0x00000000) b = 0;
    var g = g1 - g2; if (g < 0x00000100) g = 0;
    var r = r1 - r2; if (r < 0x00010000) r = 0;
    var a = a1;
    return b | g | r | a;
}

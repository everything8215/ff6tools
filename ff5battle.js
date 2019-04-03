//
// ff5battle.js
// created 1/14/2019
//

function FF5Battle(rom) {
    this.rom = rom;
    this.name = "FF5Battle";

    this.b = null; // battle index
    this.bg = 0; // battle background index
    this.battleProperties = null;
    this.ppu = null;
    this.canvas = document.createElement('canvas');
    this.battleCanvas = document.createElement('canvas');
    this.battleCanvas.width = 256;
    this.battleCanvas.height = 256;
    this.monsterCanvas = document.createElement('canvas');
    this.div = document.createElement('div');
    this.div.id = 'map-edit';
    this.div.appendChild(this.canvas);
    
    this.battleRect = new Rect(8, 248, 1, 160);
    this.zoom = 2.0;

    this.selectedMonster = null;
    
    this.observer = new ROMObserver(rom, this, {sub: true, link: true, array: true});

    var self = this;
    this.canvas.onmousedown = function(e) { self.mouseDown(e) };
    this.canvas.onmousemove = function(e) { self.mouseMove(e) };
    this.canvas.onmouseup = function(e) { self.mouseUp(e) };
//    this.canvas.onmouseenter = function(e) { self.mouseEnter(e) };
    this.canvas.onmouseleave = function(e) { self.mouseLeave(e) };
    this.monsterPoint = null;
    this.clickedPoint = null;
}

FF5Battle.prototype.battleName = function(b) {
    var battleProperties = this.rom.battleProperties.item(b);
    var isBoss = battleProperties.flags.value & 0x20;
    
    // count up the monsters
    var monsterList = {};
    var index, count;
    for (var m = 1; m <= 8; m++) {
        if (isBoss) {
            index = battleProperties["monster" + m + "Boss"].value;
        } else {
            index = battleProperties["monster" + m].value;
        }
        if ((index & 0xFF) === 0xFF) continue;
        count = monsterList[index];
        monsterList[index] = (count || 0) + 1;
    }

    var battleName = "";
    var keys = Object.keys(monsterList);
    for (var k = 0; k < keys.length; k++) {
        index = keys[k];
        count = monsterList[index];
        if (battleName !== "") battleName += ", ";
        battleName += "<stringTable.monsterName[" + index.toString() + "]>"
        if (count !== 1) battleName += " ×" + count;
    }
    
    if (battleName === "") battleName = "Battle %i";
    return battleName;
}

FF5Battle.prototype.mouseDown = function(e) {
    var x = Math.floor(e.offsetX / this.zoom) + this.battleRect.l;
    var y = Math.floor(e.offsetY / this.zoom) + this.battleRect.t;
    this.selectedMonster = this.monsterAtPoint(x, y);

    if (this.selectedMonster) {
        this.clickedPoint = {x: x, y: y};
        this.monsterPoint = { x: this.selectedMonster.x, y: this.selectedMonster.y };
        propertyList.select(this.rom.monsterProperties.item(this.selectedMonster.monster));
    } else {
        propertyList.select(this.battleProperties);
    }
    
    this.drawBattle();
}

FF5Battle.prototype.mouseMove = function(e) {
    if (!this.selectedMonster || !this.clickedPoint) return;
    
    var x = Math.floor(e.offsetX / this.zoom) + this.battleRect.l;
    var y = Math.floor(e.offsetY / this.zoom) + this.battleRect.t;
    
    var dx = x - this.clickedPoint.x;
    var dy = y - this.clickedPoint.y;

    var position = this.selectedMonster.position;
    var monsterX = position.x.value;
    var monsterY = position.x.value;
    var newX = (this.monsterPoint.x + dx) & ~7;
    var newY = (this.monsterPoint.y + dy) & ~7;
    newX = Math.min(128, Math.max(0, newX));
    newY = Math.min(128, Math.max(0, newY));
    
    if (newX === monsterX && newY === monsterY) return;
    
    this.observer.stopObserving(this.battleProperties);
    position.x.value = newX;
    position.y.value = newY;
    this.observer.startObserving(this.battleProperties, this.loadBattle);
    this.drawBattle();
}

FF5Battle.prototype.mouseUp = function(e) {
    
    if (!this.selectedMonster || !this.monsterPoint) return;

    // get the new monster's position properties
    var position = this.selectedMonster.position;
    
    var newPoint = { x: position.x.value, y: position.y.value };
    var oldPoint = this.monsterPoint;

    this.clickedPoint = null;
    this.monsterPoint = null;

    // return if the monster didn't move
    if (oldPoint.x === newPoint.x && oldPoint.y === newPoint.y) return;

    // temporarily move the monster back to its original position
    position.x.value = oldPoint.x;
    position.y.value = oldPoint.y;

    this.observer.stopObserving(this.battleProperties);
    this.rom.beginAction();
    position.x.setValue(newPoint.x);
    position.y.setValue(newPoint.y);
    this.rom.endAction();
    this.observer.startObserving(this.battleProperties, this.loadBattle);
}

FF5Battle.prototype.mouseLeave = function(e) {
    this.mouseUp(e);
}

FF5Battle.prototype.selectObject = function(object) {
    document.getElementById("tileset-div").classList.add('hidden');
    document.getElementById("tileset-layers").classList.add('hidden');
    document.getElementById("map-controls").classList.add('hidden');
    this.loadBattle(object.i);
}

FF5Battle.prototype.loadBattle = function(b) {
    b = Number(b);
    if (isNumber(b) && this.b !== b) {
        // battle index has changed
        this.observer.stopObserving(this.battleProperties);
        this.b = b;
        this.battleProperties = this.rom.battleProperties.item(b);
        this.observer.startObserving(this.battleProperties, this.loadBattle);
    }
    
    this.selectedMonster = null;
    this.drawBattle();
}

FF5Battle.prototype.monsterInSlot = function(slot) {
    var m;
    if (this.battleProperties.flags.value & 0x20) {
        m = this.battleProperties["monster" + slot + "Boss"].value;
    } else {
        m = this.battleProperties["monster" + slot].value;
    }
    if ((m & 0xFF) === 0xFF) return null; // slot is empty

    var pal = this.battleProperties["monster" + slot + "Palette"].value;
    
    var monsterPosition = this.rom.monsterPosition.item(this.b).item(slot - 1);
    var x = monsterPosition.x.value;
    var y = monsterPosition.y.value;
    
    var id;
    if (this.battleProperties.flags.value & 0x20) {
        id = this.rom.monsterProperties.item(m).monsterIDBoss.value;
    } else {
        id = this.rom.monsterProperties.item(m).monsterID.value;
    }
    
    // minimum size is 1x1
    var w = 1; var h = 1;
    var map = this.mapForMonster(id);
    for (var t = 0; t < map.tiles.length; t++) {
        if (!map.tiles[t]) continue;
        w = Math.max(w, (t % map.size) + 1);
        h = Math.max(h, Math.floor(t / map.size) + 1)
    }
    
    return {
        "slot": slot,
        "x": x,
        "y": y,
        "position": monsterPosition,
        "pal": pal,
        "monster": m,
        "id": id,
        "rect": new Rect(x, x + w * 8, y, y + h * 8)
    };
}

FF5Battle.prototype.monsterAtPoint = function(x, y) {
    
    for (var slot = 1; slot <= 8; slot++) {
        var m = this.monsterInSlot(slot);
        if (m && m.rect.containsPoint(x, y)) return m;
    }
    return null;
}

FF5Battle.prototype.drawBattle = function() {
    this.drawBackground();
    for (var slot = 8; slot > 0; slot--) {
        this.drawMonster(slot);
    }

    this.zoom = this.div.clientWidth / this.battleRect.w;
    
    var scaledRect = this.battleRect.scale(this.zoom);
    this.canvas.width = scaledRect.w;
    this.canvas.height = scaledRect.h;
    
    var ctx = this.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.drawImage(this.battleCanvas, this.battleRect.l, this.battleRect.t, this.battleRect.w, this.battleRect.h, 0, 0, scaledRect.w, scaledRect.h);
}

FF5Battle.prototype.mapForMonster = function(m) {

    // load graphics properties
    var gfxProperties = this.rom.monsterGraphicsProperties.item(m);

    // load graphics map and set up tile data
    var size, mask, row, map;
    if (gfxProperties.largeMap.value) {
        size = 16; mask = 0x8000;
        if (this.rom.isSFC) {
            map = this.rom.monsterGraphicsMap.large.item(gfxProperties.map.value).data;
        } else {
            var mapBegin = this.rom.mapAddress(gfxProperties.mapPointer.value);
            var mapEnd = mapBegin + 32;
            map = this.rom.data.subarray(mapBegin, mapEnd);
        }
        map = new Uint16Array(map.buffer, map.byteOffset, map.byteLength / 2);
    } else {
        size = 8; mask = 0x80;
        if (this.rom.isSFC) {
            map = this.rom.monsterGraphicsMap.small.item(gfxProperties.map.value).data;
        } else {
            var mapBegin = this.rom.mapAddress(gfxProperties.mapPointer.value);
            var mapEnd = mapBegin + 8;
            map = this.rom.data.subarray(mapBegin, mapEnd);
        }
    }
    
    var tiles = new Uint16Array(size * size);
    
    for (var g = 1, t = 0; t < tiles.length; t++, row <<= 1) {
        if (t % size === 0) {
            row = map[t / size];
//            if (this.rom.isSFC && size === 16) row = bytesSwapped16(row);
        }
        if (row & mask) tiles[t] = g++;
    }
    return {size: size, tiles: tiles};
}

FF5Battle.prototype.drawMonster = function(slot) {
    
    var m = this.monsterInSlot(slot);
    if (m === null) return; // return if slot is empty
    
    // load graphics properties
    var gfxProperties = this.rom.monsterGraphicsProperties.item(m.id);
    
    // decode the graphics
    var gfx = this.rom.monsterGraphics.item(m.id);
    if (this.rom.isSFC) {
        var format = gfxProperties.is3bpp.value ? "snes3bpp" : "snes4bpp";
        if (gfx.format !== format) {
            gfx.format = format;
            gfx.disassemble(gfx.parent.data);        
        }
    }
    
    // leave the first tile blank
    var graphics = new Uint8Array(gfx.data.length + 64);
    graphics.set(gfx.data, 64);
    
    var map = this.mapForMonster(m.id);
    
    // load palette
    var p = gfxProperties.palette.value;
    var pal = new Uint32Array(16);
    if (this.battleProperties.gfxFlags.value & 4) {
        // use underwater palette
        pal.set(this.rom.monsterPaletteUnderwater.data);
    } else {
        pal.set(this.rom.monsterPalette.item(p).data);
        if (this.rom.isGBA || !gfxProperties.is3bpp.value) pal.set(this.rom.monsterPalette.item(p + 1).data, 8);
    }
    
    // set up the ppu
    var ppu = new GFX.PPU();
    ppu.pal = pal;
    ppu.width = map.size * 8;
    ppu.height = map.size * 8;

    // layer 1
    ppu.layers[0].format = GFX.TileFormat.snesSpriteTile;
    ppu.layers[0].cols = map.size;
    ppu.layers[0].rows = map.size;
    ppu.layers[0].z[0] = GFX.Z.snesS0;
    ppu.layers[0].z[1] = GFX.Z.snesS1;
    ppu.layers[0].z[2] = GFX.Z.snesS2;
    ppu.layers[0].z[3] = GFX.Z.snesS3;
    ppu.layers[0].gfx = graphics;
    ppu.layers[0].tiles = map.tiles;
    ppu.layers[0].main = true;

    // draw the monster
    this.monsterCanvas.width = ppu.width;
    this.monsterCanvas.height = ppu.height;
    var context = this.monsterCanvas.getContext('2d');
    var imageData = context.createImageData(ppu.width, ppu.height);
    ppu.renderPPU(imageData.data);
    context.putImageData(imageData, 0, 0);
    
    if (!this.battleProperties["monster" + slot + "Present"].value) this.transparentMonster();
    
    // tint the selected monster
    if (this.selectedMonster && this.selectedMonster.slot === slot) this.tintMonster();
    
    var ctx = this.battleCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.drawImage(this.monsterCanvas, 0, 0, m.rect.w, m.rect.h, m.rect.l, m.rect.t, m.rect.w, m.rect.h);
}

FF5Battle.prototype.tintMonster = function() {
    // create an offscreen canvas filled with the color
    var tintCanvas = document.createElement('canvas');
    tintCanvas.width = this.monsterCanvas.width;
    tintCanvas.height = this.monsterCanvas.height;
    var ctx = tintCanvas.getContext('2d');
    ctx.fillStyle = 'hsla(210, 100%, 50%, 0.5)';
    ctx.fillRect(0, 0, this.monsterCanvas.width, this.monsterCanvas.height);
    
    ctx = this.monsterCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.drawImage(tintCanvas, 0, 0);
}

FF5Battle.prototype.transparentMonster = function() {
    // create an offscreen canvas filled with the color
    var transparentCanvas = document.createElement('canvas');
    transparentCanvas.width = this.monsterCanvas.width;
    transparentCanvas.height = this.monsterCanvas.height;
    var ctx = transparentCanvas.getContext('2d');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(0, 0, this.monsterCanvas.width, this.monsterCanvas.height);
    
    ctx = this.monsterCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(transparentCanvas, 0, 0);
}

FF5Battle.prototype.drawBackground = function() {
    
    var bg = this.bg;
    var properties = this.rom.battleBackgroundProperties.item(bg);
    
    // load graphics
    var gfx = new Uint8Array(0x10000);
    var g = properties.graphics.value;
    var gfxOffset = this.rom.battleBackgroundGraphicsOffset.item(g).offset.value;
    gfxOffset -= 0x7FC000;
    gfx.set(this.rom.battleBackgroundGraphics.item(g).data.subarray(gfxOffset << 1), 0x2000);
        
    // load layout
    var l = properties.layout.value;
    var layout = this.rom.battleBackgroundLayout.item(l).data;
    var h = properties.hFlip.value;
    var hFlip = new Uint8Array(0x0280);
    if (h !== 0xFF) hFlip = this.rom.battleBackgroundTileFlip.item(h).data;
    var v = properties.vFlip.value;
    var vFlip = new Uint8Array(0x0280);
    if (v !== 0xFF) hFlip = this.rom.battleBackgroundTileFlip.item(v).data;
    var tiles = new Uint16Array(0x0280);
    for (var i = 0; i < layout.length; i++) {
        tiles[i] = layout[i];
        if (hFlip[i]) tiles[i] |= 0x4000;
        if (vFlip[i]) tiles[i] |= 0x8000;
    }
    
    var pal = new Uint32Array(0x80);
    pal[0] = 0xFF000000;
    var p1 = properties.palette1.value;
    var p2 = properties.palette2.value;
    pal.set(this.rom.battleBackgroundPalette.item(p1).data, 0x10);
    pal.set(this.rom.battleBackgroundPalette.item(p2).data, 0x20);
    
    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = pal;
    this.ppu.height = 256;
    this.ppu.width = 256;
    this.ppu.back = true;

    // layer 2
    this.ppu.layers[1].format = GFX.TileFormat.snes4bppTile;
    this.ppu.layers[1].cols = 32;
    this.ppu.layers[1].rows = 32;
    this.ppu.layers[1].z[0] = GFX.Z.snes2L;
    this.ppu.layers[1].z[1] = GFX.Z.snes2H;
    this.ppu.layers[1].gfx = gfx;
    this.ppu.layers[1].tiles = tiles;
    this.ppu.layers[1].main = true;

    var context = this.battleCanvas.getContext('2d');
    imageData = context.createImageData(256, 256);
    this.ppu.renderPPU(imageData.data, 0, 0, 256, 256);
    context.putImageData(imageData, 0, 0);
}
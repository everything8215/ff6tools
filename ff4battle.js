//
// ff4battle.js
// created 7/7/2018
//

function FF4Battle(rom) {
    this.rom = rom;
    this.name = "FF4Battle";

    this.b = null; // battle index
    this.bg = 0; // battle background index
    this.altPalette = false; // use alternate background palette
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
    
    this.battleRect = new Rect(8, 249, 1, 141);
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

FF4Battle.prototype.battleName = function(b) {
    var battleProperties = this.rom.battleProperties.item(b);
    var monster1 = battleProperties.monster1.value;
    var monster2 = battleProperties.monster2.value;
    var monster3 = battleProperties.monster3.value;
    var m1 = battleProperties.monster1Count.value
    var m2 = battleProperties.monster2Count.value
    var m3 = battleProperties.monster3Count.value

    if (monster2 === monster3) { m2 += m3; m3 = 0; }
    if (monster1 === monster2) { m1 += m2; m2 = 0; }
    if (monster1 === monster3) { m1 += m3; m3 = 0; }

    var battleName = "";
    if (m1 !== 0) {
        battleName += "<monsterName[" + monster1.toString() + "]>"
        if (m1 !== 1) battleName += " ×" + m1;
    }
    if (m2 !== 0) {
        if (battleName !== "") battleName += ", ";
        battleName += "<monsterName[" + monster2.toString() + "]>"
        if (m2 !== 1) battleName += " ×" + m2;
    }
    if (m3 !== 0) {
        if (battleName !== "") battleName += ", ";
        battleName += "<monsterName[" + monster3.toString() + "]>"
        if (m3 !== 1) battleName += " ×" + m3;
    }
    if (battleName === "") battleName = "Battle %i";
    return battleName;
}

FF4Battle.prototype.mouseDown = function(e) {
    
    var x = Math.floor(e.offsetX / this.zoom) + this.battleRect.l;
    var y = Math.floor(e.offsetY / this.zoom) + this.battleRect.t;
    this.selectedMonster = this.monsterAtPoint(x, y);

    if (this.selectedMonster) {
        this.clickedPoint = {x: x, y: y};
        this.monsterPoint = { x: this.selectedMonster.x.value, y: this.selectedMonster.y.value };
        
        propertyList.select(this.rom.monsterProperties.item(this.selectedMonster.m));
    } else {
        propertyList.select(this.battleProperties);
    }
    
    this.drawBattle();
}

FF4Battle.prototype.mouseMove = function(e) {
    if (!this.selectedMonster || !this.clickedPoint) return;
    
    var x = Math.floor(e.offsetX / this.zoom) + this.battleRect.l;
    var y = Math.floor(e.offsetY / this.zoom) + this.battleRect.t;
    
    var dx = x - this.clickedPoint.x;
    var dy = y - this.clickedPoint.y;

    var monsterX = this.selectedMonster.x.value;
    var monsterY = this.selectedMonster.y.value;
    var newX = (this.monsterPoint.x + dx) & ~7;
    var newY = (this.monsterPoint.y + dy) & ~7;
    newX = Math.min(136, Math.max(16, newX));
    newY = Math.min(128, Math.max(0, newY));
    
    if (newX === monsterX && newY === monsterY) return;
    
    this.observer.stopObserving(this.battleProperties);
    this.selectedMonster.x.value = newX;
    this.selectedMonster.y.value = newY;
    this.observer.startObserving(this.battleProperties, this.loadBattle);
    this.drawBattle();
}

FF4Battle.prototype.mouseUp = function(e) {
    
    if (!this.selectedMonster || !this.monsterPoint) return;

    // get the new monster's position properties
    var newPoint = { x: this.selectedMonster.x.value, y: this.selectedMonster.y.value };
    var oldPoint = this.monsterPoint;

    this.clickedPoint = null;
    this.monsterPoint = null;

    // return if the monster didn't move
    if (oldPoint.x === newPoint.x && oldPoint.y === newPoint.y) return;

    // temporarily move the monster back to its original position
    this.selectedMonster.x.value = oldPoint.x;
    this.selectedMonster.y.value = oldPoint.y;

    this.observer.stopObserving(this.battleProperties);
    this.rom.beginAction();
    this.selectedMonster.x.setValue(newPoint.x);
    this.selectedMonster.y.setValue(newPoint.y);
    this.rom.endAction();
    this.observer.startObserving(this.battleProperties, this.loadBattle);
}

FF4Battle.prototype.mouseLeave = function(e) {
    this.mouseUp(e);
}

FF4Battle.prototype.selectObject = function(object) {
    document.getElementById("toolbox-div").classList.add('hidden');
    document.getElementById("toolbox-buttons").classList.add('hidden');
    document.getElementById("map-controls").classList.add('hidden');
    this.loadBattle(object.i);
}

FF4Battle.prototype.loadBattle = function(b) {
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

FF4Battle.prototype.monsterInSlot = function(slot) {
    
    var type = 1;
    var monsterCount = [
        0,
        this.battleProperties.monster1Count.value,
        this.battleProperties.monster2Count.value,
        this.battleProperties.monster3Count.value];
    
    var i = 0;
    while (i < slot) {
        if (monsterCount[type]) {
            monsterCount[type]--;
            i++;
            continue;
        }
        type++;
        if (type > 3) return null;
    }
    
    var m = this.battleProperties["monster" + type].value;
    if (m === 0xFF) return null; // slot is empty
    
    var h = this.battleProperties.hiddenMonsters.value;
    var hidden = false;
    if (h === 1 && type === 2) {
        hidden = true;
    } else if (h === 2 && (type === 2 || type === 3)) {
        hidden = true;
    } else if (h === 3 && type === 3) {
        hidden = true;
    }

    // get monster position and size
    var gfxProperties = this.rom.monsterGraphicsProperties.item(m);
    var size, bossProperties;
    var x, y, w, h;
    if (gfxProperties.isBoss.value) {
        var bossProperties = this.rom.monsterBossProperties.item(gfxProperties.bossProperties.value);
        x = bossProperties.x;
        y = bossProperties.y;
        var size = this.rom.monsterSize.item(bossProperties.size.value);
        w = size.width.value * 8;
        h = size.height.value * 8;
    } else {
        // load monster position
        var p = this.battleProperties.monsterPosition.value;
        var monsterPosition = this.rom.monsterPosition.item(p).item(slot - 1);
        x = monsterPosition.x;
        y = monsterPosition.y;
        var size = this.rom.monsterSize.item(gfxProperties.size.value);
        w = size.width.value * 8;
        h = size.height.value * 8;
    }

    if (gfxProperties.isCharacter.value) {
        // characters are a fixed size
        w = 16; h = 24;
    }

    return {
        slot: slot,
        m: m,
        type: type,
        x: x,
        y: y,
        rect: new Rect(x.value, x.value + w, y.value, y.value + h),
        gfxProperties: gfxProperties,
        bossProperties: bossProperties,
        size: size,
        hidden: hidden
    };
}

FF4Battle.prototype.monsterAtPoint = function(x, y) {
    
    for (var slot = 8; slot > 0; slot--) {
        var m = this.monsterInSlot(slot);
        if (m && m.rect.containsPoint(x, y)) return m;
    }
    return null;
}

FF4Battle.prototype.drawBattle = function() {
    this.drawBackground();
    for (var slot = 1; slot <= 8; slot++) {
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

FF4Battle.prototype.drawMonster = function(slot) {
    
    var m = this.monsterInSlot(slot);
    if (m === null) return; // return if slot is empty
    
    // load graphics properties
    var gfxProperties = m.gfxProperties;
    var w, h, tiles, gfx, pal;
    
    if (gfxProperties.isCharacter.value) {
        var c = gfxProperties.characterIndex.value;
        if (c > this.rom.characterGraphics.array.length) return;
        gfx = this.rom.characterGraphics.item(c).data;
        
        var p = gfxProperties.palette.value;
        if (p > this.rom.characterPalette.array.length) return;
        pal = this.rom.characterPalette.item(p).data;
        
        if (this.battleProperties.flags2.value & 0x10) {
            // enemy character
            tiles = new Uint16Array([0x4001, 0x4000, 0x4003, 0x4002, 0x4005, 0x4004]);
        } else {
            tiles = new Uint16Array([0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005]);
        }
        w = 2; h = 3;
        
    } else if (gfxProperties.isBoss.value && m.bossProperties) {
        var bossProperties = m.bossProperties;
        w = m.size.width.value;
        h = m.size.height.value;
        tiles = new Uint16Array(w * h);
        tiles.fill(0x0200);
        
        var mapIndex = bossProperties.map.value;
        if (gfxProperties.bossProperties.value === 63) mapIndex = 55; // zeromus map
        var map = this.rom.monsterBossMap.item(mapIndex).data;
        var p = bossProperties.palette.value;

        for (var t = 0, i = 0; i < map.length; i++) {
            var mask = map[i];
            if (mask === 0xFF) {
                t++; continue;
            } else if (mask === 0xFE) {
                t += map[++i]; continue;
            }

            tiles[t++] = mask;
        }
    } else {
        if (!m.size) return;
        w = m.size.width.value;
        h = m.size.height.value;
        tiles = new Uint16Array(w * h);
        for (var t = 0; t < tiles.length; t++) tiles[t] = t;
        var p = gfxProperties.palette.value;
    }

    if (!gfxProperties.isCharacter.value) {
        // decode the graphics
        var bytesPerTile = gfxProperties.is3bpp.value ? 24 : 32;
        var decode = gfxProperties.is3bpp.value ? GFX.decodeSNES3bpp : GFX.decodeSNES4bpp;
        var begin = this.rom.monsterGraphics.range.begin + gfxProperties.graphicsPointer.value;
        var end = begin + 256 * bytesPerTile;
        gfx = decode(this.rom.data.subarray(begin, end));

        // load palette (use palette 1, palette 0 is for transparent tiles)
        pal = new Uint32Array(17);
        pal.set(this.rom.monsterPalette.item(p).data);
        if (this.rom.isGBA || !gfxProperties.is3bpp.value) pal.set(this.rom.monsterPalette.item(p + 1).data, 8);
    }

    // set up the ppu
    var ppu = new GFX.PPU();
    ppu.pal = pal;
    ppu.width = w * 8;
    ppu.height = h * 8;

    // layer 1
    ppu.layers[0].format = GFX.TileFormat.snesSpriteTile;
    ppu.layers[0].cols = w;
    ppu.layers[0].rows = h;
    ppu.layers[0].z[0] = GFX.Z.snesS0;
    ppu.layers[0].z[1] = GFX.Z.snesS1;
    ppu.layers[0].z[2] = GFX.Z.snesS2;
    ppu.layers[0].z[3] = GFX.Z.snesS3;
    ppu.layers[0].gfx = gfx;
    ppu.layers[0].tiles = tiles;
    ppu.layers[0].main = true;

    // draw the monster
    this.monsterCanvas.width = ppu.width;
    this.monsterCanvas.height = ppu.height;
    var context = this.monsterCanvas.getContext('2d');
    var imageData = context.createImageData(ppu.width, ppu.height);
    ppu.renderPPU(imageData.data);
    context.putImageData(imageData, 0, 0);
    
    if (m.hidden) this.transparentMonster();
    
    // tint the selected monster
    if (this.selectedMonster && this.selectedMonster.slot === slot) this.tintMonster();
    
    var ctx = this.battleCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    monsterRect = m.rect;
    ctx.drawImage(this.monsterCanvas, 0, 0, monsterRect.w, monsterRect.h, monsterRect.l, monsterRect.t, monsterRect.w, monsterRect.h);
}

FF4Battle.prototype.tintMonster = function() {
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

FF4Battle.prototype.transparentMonster = function() {
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

// from 03/F7BC
FF4Battle.altPalette = [0x16, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x12, 0x14, 0x00, 0x00, 0x13, 0x15, 0x00, 0x00, 0x00, 0x00];

FF4Battle.prototype.drawBackground = function() {
    
    // load graphics
    var bg = (this.b === 439) ? 16 : this.bg;
    var gfx = new Uint8Array(0x10000);
    var gfx1 = this.rom.battleBackgroundGraphics.item(bg).data;
    gfx.set(gfx1);
    if (bg !== 16) {
        // this is necessary for the cave background because it shares one tile with the moon background
        var gfx2 = this.rom.battleBackgroundGraphics.item(bg + 1).data;
        gfx.set(gfx2, gfx1.length);
    }
    
    var properties = this.rom.battleBackgroundProperties.item(bg);
    var tiles = new Uint16Array(0x0400);
    
    // load lower layout
    var layout = new Uint16Array(this.rom.battleBackgroundLayoutLower.item(properties.bottom.value).data);
    for (var i = 0; i < layout.length; i++) {
        layout[i] += properties.offset.value;
    }
    tiles.set(layout, 0x100);
    tiles.set(layout, 0x140);
    tiles.set(layout, 0x180);
    tiles.set(layout, 0x1C0);
    tiles.set(layout, 0x200);
    
    // load upper layouts
    layout = this.rom.battleBackgroundLayoutUpper.item(properties.top.value).data;
    tiles.set(layout);
    if (properties.middle.value) {
        layout = this.rom.battleBackgroundLayoutUpper.item(properties.middle.value).data;
        tiles.set(layout, 0x100);
    }
    
    var pal = new Uint32Array(0x80);
    pal[0] = 0xFF000000;
    var p = bg;
    if (this.altPalette && FF4Battle.altPalette[p]) p = FF4Battle.altPalette[p];
    pal.set(this.rom.battleBackgroundPalette.item(p).data.subarray(0, 8));
    pal.set(this.rom.battleBackgroundPalette.item(p).data.subarray(8, 16), 0x10);
    
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

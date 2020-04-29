//
// ff6battle.js
// created 6/24/2018
//

function FF6Battle(rom) {
    ROMEditor.call(this, rom);
    this.name = "FF6Battle";
    this.vram = new FF6BattleVRAM(rom, this);

    this.b = null; // battle index
    this.bg = 0; // battle background index
    this.battleType = FF6Battle.Type.normal;
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
    
    this.battleRect = new Rect(8, 248, rom.isSFC ? 5 : 32, 152);
    this.zoom = 2.5;

    this.selectedMonster = null;
    this.selectedCharacter = null;
    this.showVRAM = false;
    this.showMonsters = true;

    this.observer = new ROMObserver(rom, this, {sub: true, link: true, array: true});

    var self = this;
    this.canvas.onmousedown = function(e) { self.mouseDown(e) };
    this.canvas.onmousemove = function(e) { self.mouseMove(e) };
    this.canvas.onmouseup = function(e) { self.mouseUp(e) };
//    this.canvas.onmouseenter = function(e) { self.mouseEnter(e) };
    this.canvas.onmouseleave = function(e) { self.mouseLeave(e) };
    this.monsterPoint = null;
    this.clickedPoint = null;
    
//    this.rom.monsterGraphics; // load monster graphics
//    this.rom.monsterPalette; // load monster palettes
//    this.rom.monsterGraphicsMap; // load monster graphics maps
    this.updateBattleStrings();
}

FF6Battle.prototype = Object.create(ROMEditor.prototype);
FF6Battle.prototype.constructor = FF6Battle;

FF6Battle.Type = {
    normal: "normal",
    back: "back",
    pincer: "pincer",
    side: "side"
}

FF6Battle.prototype.updateBattleStrings = function() {
    
//    var stringTable = this.rom.stringTable.monsterPalette;
//    for (var m = 0; m < (this.rom.monsterGraphicsProperties.arrayLength - 36); m++) {
//        
//        var g = m;
//        if (m >= 384) g += 36;
//        var graphicsProperties = this.rom.monsterGraphicsProperties.item(g);
//        var i = graphicsProperties.palette.value.i;
//        var string = stringTable.string[i];
//        if (!string) {
//            stringTable.setString(i, "<stringTable.monsterName[" + m.toString() + "]>");
//        } else {
//            // duplicate monsters using the same graphics
//            string.value += ", <stringTable.monsterName[" + m.toString() + "]>";
//        }
//    }
//
//    var bigString = "";
//    for (var s = 0; s < stringTable.string.length; s++) {
//        var string = stringTable.string[s];
//        if (!string) continue;
//        bigString += '"' + s + '": "' + string.fString() + '",\n';
//    }
//    console.log(bigString);

    for (var b = 0; b < this.rom.battleProperties.arrayLength; b++) {
        var battleProperties = this.rom.battleProperties.item(b);

        // count up the monsters
        var monsterList = {};
        var index, count;
        for (var m = 1; m <= 6; m++) {
            index = battleProperties["monster" + m].value;
            if (index === 0x01FF) continue;
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
        this.rom.stringTable.battleProperties.string[b].value = battleName;
    }
}

FF6Battle.prototype.beginAction = function(callback) {
    this.rom.beginAction();
    this.rom.doAction(new ROMAction(this.observer, this.observer.wake, this.observer.sleep));
    if (callback) this.rom.doAction(new ROMAction(this, callback, null));
}

FF6Battle.prototype.endAction = function(callback) {
    if (callback) this.rom.doAction(new ROMAction(this, null, callback));
    this.rom.doAction(new ROMAction(this.observer, this.observer.sleep, this.observer.wake));
    this.rom.endAction();
}

FF6Battle.prototype.mouseDown = function(e) {
    
    this.closeList();
    
    var x = Math.floor(e.offsetX / this.zoom) + this.battleRect.l;
    var y = Math.floor(e.offsetY / this.zoom) + this.battleRect.t;
    this.selectedMonster = this.monsterAtPoint(x, y);
    this.selectedCharacter = this.characterAtPoint(x, y);

    if (this.selectedMonster) {
        var m = this.selectedMonster;
        this.selectedCharacter = null;
        this.clickedPoint = {x: x, y: y};
        this.monsterPoint = { x: m.x.value, y: m.y.value };
        propertyList.select(this.rom.monsterProperties.item(m.monster));
    } else if (this.selectedCharacter) {
        var c = this.selectedCharacter;
        this.clickedPoint = {x: x, y: y};
        var characterAI = this.getCharacterAI();
        this.characterPoint = { x: c.x.value, y: c.y.value };
        propertyList.select(this.rom.monsterProperties.item(c.script) || characterAI);
    } else {
        propertyList.select(this.battleProperties);
    }
    
    this.drawBattle();
}

FF6Battle.prototype.mouseMove = function(e) {
    if (!this.clickedPoint) return;
    
    var x = Math.floor(e.offsetX / this.zoom) + this.battleRect.l;
    var y = Math.floor(e.offsetY / this.zoom) + this.battleRect.t;
    var dx = x - this.clickedPoint.x;
    var dy = y - this.clickedPoint.y;
    
    if (this.selectedMonster) {
        var m = this.selectedMonster;
        
        // move backward enemies in the opposite direction
        if (m.hFlip && this.battleType !== FF6Battle.Type.side) dx = -dx;

        if (dx < 0) dx += 7;
        if (dy < 0) dy += 7;
        
        var newX = (this.monsterPoint.x + dx) & ~7;
        var newY = (this.monsterPoint.y + dy) & ~7;
        
        // fix x position for pincer attack
        if (this.battleType === FF6Battle.Type.pincer) {
            if (m.hFlip) {
                // monster is on the right
                if (newX > 0x78) {
                    // monster moved from right to left
                    newX = 0x68 - m.rect.w - (newX - 0x78);
                } else if (newX + m.rect.w < 0x68) {
                    return;
                }
            } else {
                // monster is on the left
                if (newX + m.rect.w >= 0x68) {
                    // monster moved from left to right
                    newX = 0x80 - (newX + m.rect.w - 0x68);
                    if (newX + m.rect.w < 0x68) return;
                }
            }
        }
        
        newX = Math.max(0, Math.min(newX, 0x78));
        newY = Math.max(0, Math.min(newY, 0x78));
        if (newX === m.x.value && newY === m.y.value) return;
        
        this.observer.sleep();
        m.x.value = newX;
        m.y.value = newY;
        this.observer.wake();
        this.drawBattle();
        
    } else if (this.selectedCharacter) {
        var c = this.selectedCharacter;
        
        var newX = (this.characterPoint.x + dx) & ~1;
        var newY = (this.characterPoint.y + dy) & ~1;
        newX = Math.max(this.battleRect.l, Math.min(newX, this.battleRect.r - 16));
        newY = Math.max(this.battleRect.t, Math.min(newY, this.battleRect.b - 24));
        if (newX === c.x.value && newY === c.y.value) return;
        
        this.observer.sleep();
        c.x.value = newX;
        c.y.value = newY;
        this.observer.wake();
        this.drawBattle();
    }
}

FF6Battle.prototype.mouseUp = function(e) {
    
    if (this.selectedMonster && this.monsterPoint) {
        var m = this.selectedMonster;

        var newPoint = { x: m.x.value, y: m.y.value };
        var oldPoint = this.monsterPoint;

        this.clickedPoint = null;
        this.monsterPoint = null;

        // return if the monster didn't move
        if (oldPoint.x === newPoint.x && oldPoint.y === newPoint.y) return;

        // temporarily move the monster back to its original position
        m.x.value = oldPoint.x;
        m.y.value = oldPoint.y;

        this.beginAction(this.drawBattle);
        m.x.setValue(newPoint.x);
        m.y.setValue(newPoint.y);
        this.endAction(this.drawBattle);
        
    } else if (this.selectedCharacter && this.characterPoint) {
        var c = this.selectedCharacter;

        var newPoint = { x: c.x.value, y: c.y.value };
        var oldPoint = this.characterPoint;

        this.clickedPoint = null;
        this.characterPoint = null;

        // return if the character didn't move
        if (oldPoint.x === newPoint.x && oldPoint.y === newPoint.y) return;

        // temporarily move the character back to its original position
        c.x.value = oldPoint.x;
        c.y.value = oldPoint.y;

        this.beginAction(this.drawBattle);
        c.x.setValue(newPoint.x);
        c.y.setValue(newPoint.y);
        this.endAction(this.drawBattle);
    }
}

FF6Battle.prototype.mouseLeave = function(e) {
    this.mouseUp(e);
}

FF6Battle.prototype.selectObject = function(object) {
    this.loadBattle(object.i);
    this.show();
    this.vram.show(this.showVRAM);
}

FF6Battle.prototype.show = function() {
    var vram = this.vram;
    var battle = this;

    this.resetControls();
    this.showControls();
    this.closeList();
    this.addTwoState("showMonsters", function(checked) { battle.showMonsters = checked; battle.drawBattle(); }, "Monsters", this.showMonsters);
    
    var bgNames = [];
    for (var i = 0; i < this.rom.battleBackgroundProperties.arrayLength; i++) {
        bgNames.push(this.rom.stringTable.battleBackground.string[i].fString());
    }
    var onChangeBG = function(bg) { battle.bg = bg; battle.drawBattle(); }
    var bgSelected = function(bg) { return battle.bg === bg; }
    this.addList("showBackground", "Background", bgNames, onChangeBG, bgSelected);
    
    var onChangeType = function(type) {
        switch (type) {
            case 0: battle.battleType = FF6Battle.Type.normal; break;
            case 1: battle.battleType = FF6Battle.Type.back; break;
            case 2: battle.battleType = FF6Battle.Type.pincer; break;
            case 3: battle.battleType = FF6Battle.Type.side; break;
        }
        battle.drawBattle();
    }
    var typeSelected = function(type) {
        switch (type) {
            case 0: return battle.battleType === FF6Battle.Type.normal;
            case 1: return battle.battleType === FF6Battle.Type.back;
            case 2: return battle.battleType === FF6Battle.Type.pincer;
            case 3: return battle.battleType === FF6Battle.Type.side;
        }
    }
    this.addList("battleType", "Type", ["Normal", "Back", "Pincer", "Side"], onChangeType, typeSelected);
    this.addTwoState("showVRAM", function(checked) { vram.show(checked); }, "VRAM", this.showVRAM);
}

FF6Battle.prototype.hide = function() {
    this.observer.stopObservingAll();
}

FF6Battle.prototype.loadBattle = function(b) {
    b = Number(b);
    if (isNumber(b) && this.b !== b) {
        // battle index has changed
        this.observer.stopObservingAll();
//        this.observer.stopObserving(this.battleProperties);
        this.b = b;
        this.battleProperties = this.rom.battleProperties.item(b);
        this.observer.startObserving(this.battleProperties, this.drawBattle);
        this.observer.startObserving(this.getCharacterAI(), this.drawBattle);
    }
    
    this.selectedMonster = null;
    this.selectedCharacter = null;
    this.drawBattle();
}

FF6Battle.prototype.getCharacterAI = function() {
    if (!this.battleProperties.enableCharacterAI.value) return null;
    var ai = this.battleProperties.characterAI.value;
    return this.rom.characterAI.item(ai);
}

FF6Battle.prototype.monsterInSlot = function(slot) {
    var m = this.battleProperties["monster" + slot].value;
    if (m === 0x01FF) return null; // slot is empty

    // load graphics properties
    var x = this.battleProperties["monster" + slot + "X"].value;
    var y = this.battleProperties["monster" + slot + "Y"].value;

    // graphics index
    var g = m;
    if (this.rom.isGBA && g >= 384) g += 36;

    // minimum size is 1x1
    var w = 1; var h = 1;
    var map = this.mapForMonster(g);
    if (map) {
        for (var t = 0; t < map.tiles.length; t++) {
            if (!map.tiles[t]) continue;
            w = Math.max(w, (t % map.size) + 1);
            h = Math.max(h, Math.floor(t / map.size) + 1);
        }
    }
    w *= 8;
    h *= 8;
    
    // ghost train
    if (m === 262) { w = 128; h = 128; }
    
    var vramRect = this.vram.rectForSlot(slot);
    var oversize = false;
    if (w > vramRect.w) {
        oversize = true;
        w = vramRect.w || w;
    }
    if (h > vramRect.h) {
        oversize = true;
        h = vramRect.h || h;
    }
    
    // see C1/1481
    var hFlip = false;
    switch (this.battleType) {
        case FF6Battle.Type.normal:
            break;
        case FF6Battle.Type.back:
            x = 256 - (x + w);
            hFlip = true;
            break;
        case FF6Battle.Type.pincer:
            if ((x + w) < 0x68) break;
            x = 256 - (x + w - 0x40);
            hFlip = true;
            break;
        case FF6Battle.Type.side:
            x += 0x30;
            if (x < 0x80) hFlip = true;
            break;
    }
    var rect = new Rect(x, x + w, y, y + h);

    return {
        "slot": slot,
        "x": this.battleProperties["monster" + slot + "X"],
        "y": this.battleProperties["monster" + slot + "Y"],
        "present": this.battleProperties["monster" + slot + "Present"],
        "monster": m,
        "graphics": g,
        "rect": rect,
        "hFlip": hFlip,
        "vOffset": this.rom.monsterProperties.item(m).verticalOffset.value,
        "oversize": oversize
    };
}

FF6Battle.prototype.characterInSlot = function(slot) {
    var characterAI = this.getCharacterAI();
    if (!characterAI) return null;
    
    var c = characterAI.slot.item(slot - 1);
    if (c.character.getSpecialValue() === 0xFF) return null;
    
    var x = Math.min(c.x.value, this.battleRect.r - 16);
    var y = Math.min(c.y.value, this.battleRect.b - 24);
    
    return {
        "slot": slot,
        "x": c.x,
        "y": c.y,
        "character": c.character.c.value,
        "enemy": c.character.flags.value & 1,
        "hidden": c.character.flags.value & 2,
        "graphics": c.graphics.value,
        "script": c.aiScript.value,
        "rect": new Rect(x, x + 16, y, y + 24)
    };
}

FF6Battle.prototype.monstersSortedByPriority = function() {
    return [this.monsterInSlot(1),
        this.monsterInSlot(2),
        this.monsterInSlot(3),
        this.monsterInSlot(4),
        this.monsterInSlot(5),
        this.monsterInSlot(6)].sort(function(a, b) {
        if (a === null) return +1;
        if (b === null) return -1;
        return (b.rect.b + b.vOffset) - (a.rect.b + a.vOffset);
    });
}

FF6Battle.prototype.charactersSortedByPriority = function() {
    return [this.characterInSlot(1),
        this.characterInSlot(2),
        this.characterInSlot(3),
        this.characterInSlot(4)].sort(function(a, b) {
        if (a === null) return +1;
        if (b === null) return -1;
        return b.rect.b - a.rect.b;
    });
}

FF6Battle.prototype.monsterAtPoint = function(x, y) {
    
    var sorted = this.monstersSortedByPriority();
    for (var i = 0; i < 6; i++) {
        var m = sorted[i]
        if (m && m.rect.containsPoint(x, y)) return m;
    }
    return null;
}

FF6Battle.prototype.characterAtPoint = function(x, y) {
    
    var sorted = this.charactersSortedByPriority();
    for (var i = 0; i < 4; i++) {
        var c = sorted[i];
        if (c && c.rect.containsPoint(x, y)) return c;
    }
    return null;
}

FF6Battle.prototype.drawBattle = function() {

    this.vram.clearVRAM();
    
    this.drawBackground();
    
    if (this.showMonsters) {
        var self = this;
        this.monstersSortedByPriority().reverse().forEach(function(m) {
            if (!m) return;
            self.drawMonster(m.slot);
        });
        this.charactersSortedByPriority().reverse().forEach(function(c) {
            if (!c) return;
            self.drawCharacter(c.slot);
        });
    }
    
    this.zoom = this.div.clientWidth / this.battleRect.w;
    
    var scaledRect = this.battleRect.scale(this.zoom);
    this.canvas.width = scaledRect.w;
    this.canvas.height = scaledRect.h;
    
    var ctx = this.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.drawImage(this.battleCanvas, this.battleRect.l, this.battleRect.t, this.battleRect.w, this.battleRect.h, 0, 0, scaledRect.w, scaledRect.h);
    
    this.vram.drawVRAM();
}

FF6Battle.prototype.mapForMonster = function(m) {

    // load graphics properties
    var gfxProperties = this.rom.monsterGraphicsProperties.item(m);

    // load graphics map and set up tile data
    var size, mask, row, map;
    if (gfxProperties.useLargeMap.value) {
        size = 16; mask = 0x8000;
        if (this.rom.isSFC) {
            map = this.rom.monsterGraphicsMap.large.item(gfxProperties.largeMap.value);
            if (!map) return null;
            map = map.data;
        } else {
            map = gfxProperties.mapPointer.target.data;
//            var mapBegin = this.rom.mapAddress(gfxProperties.mapPointer.value);
//            var mapEnd = mapBegin + 32;
//            map = this.rom.data.subarray(mapBegin, mapEnd);
        }
        map = new Uint16Array(map.buffer, map.byteOffset, map.byteLength / 2);
    } else {
        size = 8; mask = 0x80;
        if (this.rom.isSFC) {
            map = this.rom.monsterGraphicsMap.small.item(gfxProperties.smallMap.value);
            if (!map) return null;
            map = map.data;
        } else {
            map = gfxProperties.mapPointer.target.data;
//            var mapBegin = this.rom.mapAddress(gfxProperties.mapPointer.value);
//            var mapEnd = mapBegin + 8;
//            map = this.rom.data.subarray(mapBegin, mapEnd);
        }
    }
    
    var tiles = new Uint16Array(size * size);
    
    for (var g = 1, t = 0; t < tiles.length; t++, row <<= 1) {
        if (t % size === 0) {
            row = map[t / size];
            if (this.rom.isSFC && size === 16) row = bytesSwapped16(row);
        }
        if (row & mask) tiles[t] = g++;
    }
    return {size: size, tiles: tiles};
}

FF6Battle.prototype.drawMonster = function(slot) {
    var m = this.monsterInSlot(slot);
    if (m === null) return; // return if slot is empty
    if (m.monster === 262) this.drawGhostTrain(slot);
    
    // load graphics properties
    var gfxProperties = this.rom.monsterGraphicsProperties.item(m.graphics);
    
    // decode the graphics
    var gfx = gfxProperties.graphicsPointer.target;
//    var gfx = this.rom.monsterGraphics.item(m.graphics);
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
    
    var map = this.mapForMonster(m.graphics);
    if (!map) return;
    
    // load palette
//    var p = gfxProperties.palette.value;
    var pal = new Uint32Array(16);
    pal.set(gfxProperties.palette.target.data);
//    pal.set(this.rom.monsterPalette.item(p).data);
//    if (this.rom.isGBA || !gfxProperties.is3bpp.value) pal.set(this.rom.monsterPalette.item(p + 1).data, 8);
    
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
    
    // make monster transparent if it is not present
    if (!m.present.value) this.transparentMonster();
    
    // tint the selected monster
    if (this.selectedMonster && this.selectedMonster.slot === slot) this.tintMonster('hsla(210, 100%, 50%, 0.5)');

    // tint oversize monsters red
    if (m.oversize) this.tintMonster('rgba(200, 0, 0, 0.5)');

    // draw the monster on the battle canvas
    var ctx = this.battleCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    if (!m.hFlip) {
        ctx.drawImage(this.monsterCanvas, 0, 0, m.rect.w, m.rect.h, m.rect.l, m.rect.t, m.rect.w, m.rect.h);
    } else {
        // flip monster horizontally
        ctx.scale(-1, 1);
        ctx.drawImage(this.monsterCanvas, 0, 0, m.rect.w, m.rect.h, -m.rect.l, m.rect.t, -m.rect.w, m.rect.h);
        ctx.setTransform(1,0,0,1,0,0);
    }
    
    // draw the monster on the vram canvas
    var vramRect = this.vram.rectForSlot(slot);
    if (vramRect.isEmpty()) return;
    ctx = this.vram.vramCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.drawImage(this.monsterCanvas, 0, 0, m.rect.w, m.rect.h, vramRect.l, vramRect.t, m.rect.w, m.rect.h);
}

// from C2/CE2B
FF6Battle.characterPaletteIndex = [2, 1, 4, 4, 0, 0, 0, 3, 3, 4, 5, 3, 3, 5, 1, 0, 0, 3, 6, 1, 0, 3, 3, 0]

FF6Battle.prototype.drawCharacter = function(slot) {
    var c = this.characterInSlot(slot);
    if (!c) return;
    
    // load graphics
    var g = c.graphics;
    if (g === 0xFF) {
        // use character graphics
        g = c.character;
    }

    var graphics = this.rom.mapSpriteGraphics.item(g === 23 ? 14 : g); // green soldier palette override
    if (!graphics) return;
    
    // load palette
    var p = FF6Battle.characterPaletteIndex[g];
    var pal = this.rom.characterPalettes.item(p);
    if (!pal) return;
    
    var tiles;
    if (c.enemy) {
        // enemy character
        tiles = new Uint16Array([0x401F, 0x401E, 0x4029, 0x4028, 0x402B, 0x402A]);
    } else {
        // friendly character
        tiles = new Uint16Array([0x001E, 0x001F, 0x0028, 0x0029, 0x002A, 0x002B]);
    }
    
    // set up the ppu
    var ppu = new GFX.PPU();
    ppu.pal = pal.data;
    ppu.width = 16;
    ppu.height = 24;

    // layer 1
    ppu.layers[0].format = GFX.TileFormat.snesSpriteTile;
    ppu.layers[0].cols = 2;
    ppu.layers[0].rows = 3;
    ppu.layers[0].z[0] = GFX.Z.snesS0;
    ppu.layers[0].z[1] = GFX.Z.snesS1;
    ppu.layers[0].z[2] = GFX.Z.snesS2;
    ppu.layers[0].z[3] = GFX.Z.snesS3;
    ppu.layers[0].gfx = graphics.data;
    ppu.layers[0].tiles = tiles;
    ppu.layers[0].main = true;

    // draw the character
    this.monsterCanvas.width = ppu.width;
    this.monsterCanvas.height = ppu.height;
    var context = this.monsterCanvas.getContext('2d');
    var imageData = context.createImageData(ppu.width, ppu.height);
    ppu.renderPPU(imageData.data);
    context.putImageData(imageData, 0, 0);
    
    // tint the selected character
    if (this.selectedCharacter && this.selectedCharacter.slot === slot) this.tintMonster('hsla(210, 100%, 50%, 0.5)');
    if (c.hidden) this.transparentMonster();
    
    var ctx = this.battleCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.drawImage(this.monsterCanvas, 0, 0, c.rect.w, c.rect.h, c.rect.l, c.rect.t, c.rect.w, c.rect.h);
}

FF6Battle.prototype.tintMonster = function(style) {
    // create an offscreen canvas filled with the color
    var tintCanvas = document.createElement('canvas');
    tintCanvas.width = this.monsterCanvas.width;
    tintCanvas.height = this.monsterCanvas.height;
    var ctx = tintCanvas.getContext('2d');
    ctx.fillStyle = style;
    ctx.fillRect(0, 0, this.monsterCanvas.width, this.monsterCanvas.height);
    
    ctx = this.monsterCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.drawImage(tintCanvas, 0, 0);
}

FF6Battle.prototype.transparentMonster = function() {
    // create an offscreen canvas filled with the color
    var transparentCanvas = document.createElement('canvas');
    transparentCanvas.width = this.monsterCanvas.width;
    transparentCanvas.height = this.monsterCanvas.height;
    var ctx = transparentCanvas.getContext('2d');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(0, 0, this.monsterCanvas.width, this.monsterCanvas.height);
    
    ctx = this.monsterCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(transparentCanvas, 0, 0);
}

FF6Battle.prototype.drawGhostTrain = function(slot) {
    var m = this.monsterInSlot(slot);
    
    // load graphics properties
    var gfxProperties = this.rom.monsterGraphicsProperties.item(m.graphics);
    
    // load battle background properties
    var properties = this.rom.battleBackgroundProperties.item(50);
    var g1 = properties.graphics1.value;
    var g3 = properties.graphics3.value;

    // load graphics
    var gfx = new Uint8Array(0x10000);
    gfx.set(this.loadBattleBackgroundGraphics(g1), this.rom.isSFC ? 0x0000 : 0x4000);
    gfx.set(this.loadBattleBackgroundGraphics(g3), this.rom.isSFC ? 0x6000 : 0x2000);

    var l = properties.layout1.value;
    var layout = this.rom.battleBackgroundLayout.item(l).data;
    layout = new Uint16Array(layout.buffer, layout.byteOffset, Math.floor(layout.byteLength / 2));
    for (var i = 0; i < layout.length; i++) layout[i] &= 0x01FF;
    
    // load palette
//    var p = gfxProperties.palette.value;
    var pal = new Uint32Array(0x80);
    pal.set(gfxProperties.palette.target.data);
//    pal.set(this.rom.monsterPalette.item(p).data);
//    pal.set(this.rom.monsterPalette.item(p + 1).data, 8);

    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = pal;
    this.ppu.height = 128;
    this.ppu.width = 128;

    // layer 1
    this.ppu.layers[0].format = this.rom.isSFC ? GFX.TileFormat.snes4bppTile : GFX.TileFormat.gba4bppTile;
    this.ppu.layers[0].cols = 16;
    this.ppu.layers[0].rows = 16;
    this.ppu.layers[0].z[0] = GFX.Z.snes1L;
    this.ppu.layers[0].z[1] = GFX.Z.snes1H;
    this.ppu.layers[0].gfx = gfx;
    this.ppu.layers[0].tiles = layout;
    this.ppu.layers[0].main = true;

    // draw the monster
    this.monsterCanvas.width = this.ppu.width;
    this.monsterCanvas.height = this.ppu.height;
    var context = this.monsterCanvas.getContext('2d');
    var imageData = context.createImageData(this.ppu.width, this.ppu.height);
    this.ppu.renderPPU(imageData.data);
    context.putImageData(imageData, 0, 0);
    
    // make monster transparent if it is not present
    if (!m.present.value) this.transparentMonster();
    
    // tint the selected monster
    if (this.selectedMonster && this.selectedMonster.slot === slot) this.tintMonster('hsla(210, 100%, 50%, 0.5)');

    // tint oversize monsters red
    if (m.oversize) this.tintMonster('rgba(200, 0, 0, 0.5)');
    
    // draw the monster on the battle canvas
    var ctx = this.battleCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    if (!m.hFlip) {
        ctx.drawImage(this.monsterCanvas, 0, 0, m.rect.w, m.rect.h, m.rect.l, m.rect.t, m.rect.w, m.rect.h);
    } else {
        ctx.scale(-1, 1);
        ctx.drawImage(this.monsterCanvas, 0, 0, m.rect.w, m.rect.h, -m.rect.l, m.rect.t, -m.rect.w, m.rect.h);
        ctx.setTransform(1,0,0,1,0,0);
    }

    // draw the monster on the vram canvas
    var vramRect = this.vram.rectForSlot(slot);
    if (vramRect.isEmpty()) return;
    ctx = this.vram.vramCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.drawImage(this.monsterCanvas, 0, 0, m.rect.w, m.rect.h, vramRect.l, vramRect.t, m.rect.w, m.rect.h);
}

FF6Battle.prototype.drawBackground = function() {
    
    var properties = this.rom.battleBackgroundProperties.item(this.bg);
    var g1 = properties.graphics1.value;
    var g2 = properties.graphics2.value;
    var g3 = properties.graphics3.value;

    // load graphics
    var gfx = new Uint8Array(0x10000);
    gfx.set(this.loadBattleBackgroundGraphics(g1), this.rom.isSFC ? 0x0000 : 0x4000);
    gfx.set(this.loadBattleBackgroundGraphics(g2), this.rom.isSFC ? 0x2000 : 0x6000);
    gfx.set(this.loadBattleBackgroundGraphics(g3), this.rom.isSFC ? 0xE000 : 0x2000);
    
    var l = properties.layout1.value;
    var layout = this.rom.battleBackgroundLayout.item(l).data;
    
    var p = properties.palette.value;
    var pal = new Uint32Array(0x80);
    pal[0] = 0xFF000000;
    pal.set(this.rom.battleBackgroundPalette.item(p).data, 0x50);
    
    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = pal;
    this.ppu.height = 256;
    this.ppu.width = 256;
    this.ppu.back = true;

    // layer 2
    this.ppu.layers[1].format = this.rom.isSFC ? GFX.TileFormat.snes4bppTile : GFX.TileFormat.gba4bppTile;
    this.ppu.layers[1].cols = 32;
    this.ppu.layers[1].rows = 32;
    this.ppu.layers[1].z[0] = GFX.Z.snes2L;
    this.ppu.layers[1].z[1] = GFX.Z.snes2H;
    this.ppu.layers[1].gfx = gfx;
    this.ppu.layers[1].tiles = new Uint16Array(layout.buffer, layout.byteOffset, Math.floor(layout.byteLength / 2));
    this.ppu.layers[1].main = true;

    var context = this.battleCanvas.getContext('2d');
    imageData = context.createImageData(256, 256);
    this.ppu.renderPPU(imageData.data, 0, 0, 256, 256);
    context.putImageData(imageData, 0, 0);
}

FF6Battle.prototype.loadBattleBackgroundGraphics = function(i) {
    if (i === 0xFF) return new Uint8Array(0); // no graphics

    var bgGraphics = this.rom.battleBackgroundGraphics;
    var pointer = bgGraphics.createPointer(i & 0x7F);
//    var pointer = bgGraphics.pointerTable.item(i & 0x7F).pointer;

    var begin;
    if (this.rom.isSFC) {
        // normal battle bg graphics
        if (bgGraphics.range.contains(this.rom.mapAddress(pointer.value))) return bgGraphics.item(i & 0x7F).data;

        // use map graphics (absolute pointer)
        begin = this.rom.mapAddress(pointer.value);
    } else {
        // normal battle bg graphics
        if ((pointer.value & 0x800000) === 0) return bgGraphics.item(i & 0x7F).data;
        pointer.options.offset = this.rom.mapAddress(Number(this.rom.mapGraphics.pointerOffset));

        // use map graphics (absolute pointer)
//        pointer.mask = 0x7FFFFF;
//        pointer.offset = this.rom.mapGraphics.pointerTable.item(0).pointer.offset;
//        pointer.disassemble(pointer.parent.data);
//        var offset = this.rom.mapGraphics.pointerOffset;
        begin = pointer.value & 0x7FFFFF;
    }
    var end = begin + (i & 0x80 ? 0x2000 : 0x1000);
    var decode = this.rom.isSFC ? GFX.decodeSNES4bpp : GFX.decodeLinear4bpp;
    return decode(this.rom.data.subarray(begin, end))[0];
}

function FF6BattleVRAM(rom, battle) {
    this.rom = rom;
    this.battle = battle;
    this.name = "FF6BattleVRAM";

    this.canvas = document.createElement('canvas');
    this.vramCanvas = document.createElement('canvas');
    this.vramCanvas.width = 128;
    this.vramCanvas.height = 128;
    
    this.zoom = 2.0;

    var self = this;
    this.canvas.onmousedown = function(e) { self.mouseDown(e) };
}

FF6BattleVRAM.prototype.show = function(show) {

    this.battle.showVRAM = show;
    this.div = document.getElementById('toolbox-div');
    if (show) {
        this.div.classList.remove('hidden');
        this.div.innerHTML = "";
        this.div.appendChild(this.canvas);
        this.div.style.height = "256px";
    } else {
        this.div.classList.add('hidden');
        this.div.innerHTML = "";
    }

    document.getElementById("toolbox-buttons").classList.add('hidden');
}

FF6BattleVRAM.prototype.mouseDown = function(e) {
    var x = Math.floor(e.offsetX / this.zoom);
    var y = Math.floor(e.offsetY / this.zoom);
    
    var clickedSlot = this.slotAtPoint(x, y);
    if (!clickedSlot) return;
    
    var m = this.battle.monsterInSlot(clickedSlot);
    if (!m) return;
    
    this.battle.selectedMonster = m;
    this.battle.selectedCharacter = null;
    propertyList.select(this.rom.monsterProperties.item(m.monster));

    this.battle.drawBattle();
}

FF6BattleVRAM.prototype.rectForSlot = function(slot) {
    var v = this.battle.battleProperties.vramMap.value;
    var vramMap = this.rom.battleVRAMMap.item(v);
    if (slot > vramMap.arrayLength) { return Rect.emptyRect; }
    var vramMapData = vramMap.item(slot - 1);
    
    // monster slot, get vram map data
    var vramAddress = vramMapData.vramAddress.value;
    var w = vramMapData.width.value;
    var h = vramMapData.height.value;
    var l = (vramAddress & 0x01E0) >> 5;
    var t = (vramAddress & 0xFE00) >> 9;
    var r = l + w;
    var b = t + h;
    var slotRect = new Rect(l, r, t, b);
    return slotRect.scale(8);
}

FF6BattleVRAM.prototype.slotAtPoint = function(x, y) {
    for (var slot = 1; slot <= 6; slot++) {
        if (this.rectForSlot(slot).containsPoint(x, y)) return slot;
    }
    return null;
}

FF6BattleVRAM.prototype.clearVRAM = function() {
    
    // clear the vram canvas
    this.vramCanvas.height = 128;
    this.vramCanvas.width = 128;

//    if (this.canvas.parentElement) {
//        this.canvas.parentElement.style.height = "256px";
//        this.canvas.parentElement.classList.remove("hidden");
//    }
//    this.canvas.parentElement.style.height = "256px";
//    this.canvas.parentElement.classList.remove("hidden");

    // recalculate zoom
    this.zoom = 2.0; //this.div.clientWidth / 128;

    this.canvas.width = 128 * this.zoom;
    this.canvas.height = 128 * this.zoom;

    var ctx = this.canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 128 * this.zoom, 128 * this.zoom)
}

FF6BattleVRAM.prototype.drawVRAM = function() {

    var vramRect = new Rect(0, this.canvas.width, 0, this.canvas.height);
    
    // draw the monsters
    var ctx = this.canvas.getContext('2d');
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.drawImage(this.vramCanvas, 0, 0, vramRect.w, vramRect.h);

    // draw the slots
    for (var slot = 1; slot <= 6; slot++) {
        var slotRect = this.rectForSlot(slot);
        if (slotRect.isEmpty()) continue;
        slotRect = slotRect.scale(this.zoom);

        // draw the vram slot
        var x = slotRect.l + 0.5;
        var y = slotRect.t + 0.5;
        var w = slotRect.w - 1;
        var h = slotRect.h - 1;

        ctx.rect(x, y, w, h);
        ctx.lineWidth = 1;
        ctx.strokeStyle = "gray";
        ctx.stroke();
        if (this.battle.selectedMonster && this.battle.selectedMonster.slot === slot) {
            ctx.fillStyle = 'hsla(210, 100%, 50%, 0.5)';
        } else {
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        }
        ctx.fillText(slot.toString(), slotRect.centerX, slotRect.centerY);
        ctx.strokeStyle = "rgba(255, 255, 255, 1.0)";
        ctx.strokeText(slot.toString(), slotRect.centerX, slotRect.centerY);
    }
}

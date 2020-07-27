//
// ff4battle.js
// created 7/7/2018
//

function FF4Battle(rom) {
    ROMEditor.call(this, rom);
    this.name = "FF4Battle";
    this.vram = new FF4BattleVRAM(rom, this);

    this.b = null; // battle index
    this.bg = 0; // battle background index
    this.altPalette = false; // use alternate background palette
    this.backAttack = false;
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

    // this.battleRect = new Rect(0, 256, 0, 256);
    this.battleRect = new Rect(8, 249, this.rom.isSFC ? 1 : 8, this.rom.isSFC ? 141 : 120);
    this.zoom = 1.0;

    this.selectedMonster = null;
    this.showVRAM = false;
    this.showMonsters = true;

    this.observer = new ROMObserver(rom, this, {sub: true, link: true, array: true});

    var self = this;
    this.canvas.onmousedown = function(e) { self.mouseDown(e) };
    this.canvas.onmousemove = function(e) { self.mouseMove(e) };
    this.canvas.onmouseup = function(e) { self.mouseUp(e) };
//    this.canvas.onmouseenter = function(e) { self.mouseEnter(e) };
    this.canvas.onmouseleave = function(e) { self.mouseLeave(e) };
    this.resizeSensor = null;
    this.monsterPoint = null;
    this.clickedPoint = null;

    this.updateBattleStrings();
}

FF4Battle.prototype = Object.create(ROMEditor.prototype);
FF4Battle.prototype.constructor = FF4Battle;

FF4Battle.prototype.updateBattleStrings = function() {

    if (this.rom.isGBA) {
        this.updateBattleStringsGBA();
        return;
    }

    var paletteStringTable = this.rom.stringTable.monsterPalette;
    var graphicsStringTable = this.rom.stringTable.monsterGraphics;
    for (var m = 0; m < this.rom.monsterProperties.arrayLength; m++) {

        // skip characters
        if (this.rom.monsterGraphicsProperties.item(m).isCharacter.value) continue;

        var p = this.rom.monsterGraphicsProperties.item(m).palette.value;
        var paletteString = paletteStringTable.string[p];
        if (!paletteString) {
            paletteStringTable.setString(p, "<stringTable.monsterName[" + m.toString() + "]>");
        }

        var g = this.rom.monsterGraphicsProperties.item(m).graphicsPointer.value;
        var graphicsString = graphicsStringTable.string[g];
        if (!graphicsString) {
            graphicsStringTable.setString(g, "<stringTable.monsterName[" + m.toString() + "]>");
        } else {
            // duplicate monsters using the same graphics
            graphicsString.value += ", <stringTable.monsterName[" + m.toString() + "]>";
        }
    }

    for (var b = 0; b < this.rom.battleProperties.arrayLength; b++) {
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
        this.rom.stringTable.battleProperties.string[b].value = battleName;
    }
}

FF4Battle.prototype.updateBattleStringsGBA = function() {
    for (var b = 0; b < this.rom.battleMonster.arrayLength; b++) {
        var battleMonster = this.rom.battleMonster.item(b);

        // count up the monsters
        var monsterList = {};
        var index, count;
        for (var m = 0; m < battleMonster.arrayLength; m++) {
            index = battleMonster.item(m).monster.value;
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
    //        battleName += this.rom.stringTable.monsterName.fString(index);
            if (count !== 1) battleName += " ×" + count;
        }

        if (battleName === "") battleName = "Battle %i";
        this.rom.stringTable.battleProperties.string[b].value = battleName;
    }
}

FF4Battle.prototype.mouseDown = function(e) {

    this.closeList();

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
    this.closeList();
    if (!this.selectedMonster || !this.clickedPoint) return;

    var x = Math.floor(e.offsetX / this.zoom) + this.battleRect.l;
    var y = Math.floor(e.offsetY / this.zoom) + this.battleRect.t;

    var dx = x - this.clickedPoint.x;
    var dy = y - this.clickedPoint.y;

    // move backward enemies in the opposite direction
    if (this.backAttack) dx = -dx;

    if (dx < 0) dx += 7;
    if (dy < 0) dy += 7;

    var monsterX = this.selectedMonster.x.value;
    var monsterY = this.selectedMonster.y.value;
    var newX = (this.monsterPoint.x + dx) & ~7;
    var newY = (this.monsterPoint.y + dy) & ~7;
    if (this.rom.isGBA) {
        newX = Math.min(136, Math.max(8, newX));
        newY = Math.min(144, Math.max(16, newY));
    } else {
        newX = Math.min(144, Math.max(16, newX));
        newY = Math.min(128, Math.max(0, newY));
    }

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
    this.loadBattle(object.i);
    this.show();
    this.vram.show(this.showVRAM);
}

FF4Battle.prototype.show = function() {

    var vram = this.vram;
    var battle = this;

    this.resetControls();
    this.showControls();
    this.closeList();
    this.addTwoState("showMonsters", function(checked) { battle.showMonsters = checked; battle.drawBattle(); }, "Monsters", this.showMonsters);

    var bgNames = [];
    for (var i = 0; i < this.rom.battleBackgroundGraphics.arrayLength; i++) {
        bgNames.push(this.rom.stringTable.battleBackgroundProperties.string[i].fString());
    }
    var onChangeBG = function(bg) { battle.bg = bg; battle.drawBattle(); }
    var bgSelected = function(bg) { return battle.bg === bg; }
    this.addList("showBackground", "Background", bgNames, onChangeBG, bgSelected);

    if (this.rom.isSFC) this.addTwoState("useAltPalette", function(checked) { battle.altPalette = checked; battle.drawBattle(); }, "Alt. Palette", this.altPalette);
    this.addTwoState("backAttack", function(checked) { battle.backAttack = checked; battle.drawBattle(); }, "Back Attack", this.backAttack);
    if (this.rom.isSFC) this.addTwoState("showVRAM", function(checked) { vram.show(checked); }, "VRAM", this.showVRAM);

    this.resizeSensor = new ResizeSensor(document.getElementById("edit-top"), function() { battle.drawBattle(); });
}

FF4Battle.prototype.hide = function() {
    this.observer.stopObservingAll();
    if (this.resizeSensor) {
        this.resizeSensor.detach(document.getElementById("edit-top"));
        this.resizeSensor = null;
    }
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

    this.backAttack = false;
    if (this.rom.isSFC && this.battleProperties.flags1.value & 0x01) this.backAttack = true;
    if (this.rom.isGBA && this.battleProperties.flags.value & 0x04) this.backAttack = true;
    if (this.rom.isGBA && this.battleProperties.background.value !== 0) this.bg = this.battleProperties.background.value - 1;
    this.selectedMonster = null;
    this.drawBattle();
}

FF4Battle.prototype.typeHidden = function(type) {
    var h = this.battleProperties.hiddenMonsters.value;
    if (h === 1 && type === 2) {
        return true;
    } else if (h === 2 && (type === 2 || type === 3)) {
        return true;
    } else if (h === 3 && type === 3) {
        return true;
    }
    return false;
}

FF4Battle.prototype.monsterInSlot = function(slot) {

    if (this.rom.isGBA) return this.monsterInSlotGBA(slot);

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

    var hidden = this.typeHidden(type);

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

    var rect = new Rect(x.value, x.value + w, y.value, y.value + h);
    if (this.backAttack) {
        rect.l = 256 - (x.value + w);
        rect.r = 256 - x.value;
    }

    return {
        slot: slot,
        m: m,
        type: type,
        x: x,
        y: y,
        rect: rect,
        gfxProperties: gfxProperties,
        bossProperties: bossProperties,
        size: size,
        hidden: hidden
    };
}

FF4Battle.prototype.monsterInSlotGBA = function(slot) {
    var battleMonster = this.rom.battleMonster.item(this.b);
    if (slot > battleMonster.arrayLength) return null;
    var monster = battleMonster.item(slot - 1);

    var m = monster.monster.value;
    var type = monster.monsterType.value;

    var monsterSize = this.rom.monsterSize.item(m);

    var x = monster.x;
    var y = monster.y;
    var w = monsterSize.width.value;
    var h = monsterSize.height.value;

    var rect = new Rect(x.value, x.value + w, y.value, y.value + h);
    if (this.backAttack) {
        rect.l = 256 - (x.value + w);
        rect.r = 256 - x.value;
    }

    var hidden = false;

    return {
        slot: slot,
        m: m,
        type: type,
        x: x,
        y: y,
        rect: rect,
        hidden: hidden
    };
}

FF4Battle.prototype.firstMonsterOfType = function(type) {
    for (var slot = 1; slot <= 8; slot++) {
        var monster = this.monsterInSlot(slot);
        if (!monster) break;
        if (monster.type === type) return monster;
    }
    return null;
}

FF4Battle.prototype.monsterAtPoint = function(x, y) {

    for (var slot = 8; slot > 0; slot--) {
        var m = this.monsterInSlot(slot);
        if (m && m.rect.containsPoint(x, y)) return m;
    }
    return null;
}

FF4Battle.prototype.drawBattle = function() {
    if (this.rom.isSFC) {
        this.vram.clearVRAM();
        this.vram.loadVRAM();
    }

    this.drawBackground();

    if (this.showMonsters) {
        for (var slot = 1; slot <= 8; slot++) this.drawMonster(slot);
    }

    this.zoom = Math.min(this.div.clientWidth / this.battleRect.w, this.div.clientHeight / this.battleRect.h);
    this.zoom = Math.min(Math.max(this.zoom, 1.0), 4.0);

    var scaledRect = this.battleRect.scale(this.zoom);
    this.canvas.width = scaledRect.w;
    this.canvas.height = scaledRect.h;

    var ctx = this.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(this.battleCanvas, this.battleRect.l, this.battleRect.t, this.battleRect.w, this.battleRect.h, 0, 0, scaledRect.w, scaledRect.h);

    if (this.rom.isSFC) this.vram.drawVRAM();
}

FF4Battle.prototype.drawMonster = function(slot) {

    if (this.rom.isGBA) {
        this.drawMonsterGBA(slot);
        return;
    }

    var m = this.monsterInSlot(slot);
    if (m === null) return; // return if slot is empty

    // load graphics properties
    var gfxProperties = m.gfxProperties;
    var w, h, tiles;

    var monsterString = "monster" + m.type.toString();
    var f1 = this.vram.tileData1[monsterString].value;
    f1 &= 0xE3;
    f1 |= (m.type + 2) << 2; // palette
    var f2 = this.vram.tileData2[monsterString].value;
    var tileFlags = (f1 << 8) | f2;

    if (gfxProperties.isCharacter.value) {

        if (this.battleProperties.flags2.value & 0x10) {
            // enemy character
            tiles = new Uint16Array([0x4001, 0x4000, 0x4003, 0x4002, 0x4005, 0x4004]);
        } else {
            tiles = new Uint16Array([0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005]);
        }
        for (var t = 0; t < tiles.length; t++) { tiles[t] |= tileFlags; }
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

        if (bossProperties.tileIndexMSB.value) tileFlags |= 0x0100;
        for (var t = 0, i = 0; i < map.length; i++) {
            var mask = map[i];
            if (mask === 0xFF) {
                t++; continue;
            } else if (mask === 0xFE) {
                t += map[++i]; continue;
            }

            tiles[t++] = mask + tileFlags;
        }

    } else {
        if (!m.size) return;
        w = m.size.width.value;
        h = m.size.height.value;
        tiles = new Uint16Array(w * h);
        for (var t = 0; t < tiles.length; t++) tiles[t] = t + tileFlags;
    }

    // set up the ppu
    var ppu = new GFX.PPU();
    ppu.pal = this.vram.vramPalette;
    ppu.width = w * 8;
    ppu.height = h * 8;

    // layer 1
    ppu.layers[0].cols = w;
    ppu.layers[0].rows = h;
    ppu.layers[0].z[0] = GFX.Z.snesS0;
    ppu.layers[0].z[1] = GFX.Z.snesS1;
    ppu.layers[0].z[2] = GFX.Z.snesS2;
    ppu.layers[0].z[3] = GFX.Z.snesS3;
    ppu.layers[0].gfx = this.vram.vramGraphics;
    ppu.layers[0].tiles = GFX.tileFormat.snes4bppTile.decode(tiles)[0];
    ppu.layers[0].main = true;

    // draw the monster
    this.monsterCanvas.width = ppu.width;
    this.monsterCanvas.height = ppu.height;
    var context = this.monsterCanvas.getContext('2d');
    var imageData = context.createImageData(ppu.width, ppu.height);
    ppu.renderPPU(imageData.data);
    context.putImageData(imageData, 0, 0);

    if (m.hidden || (this.battleProperties.flags2.value & 0x80)) this.transparentMonster();

    // tint the selected monster
    if (this.selectedMonster && this.selectedMonster.slot === slot) this.tintMonster();

    var ctx = this.battleCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
    if (!this.backAttack) {
        ctx.drawImage(this.monsterCanvas, 0, 0, m.rect.w, m.rect.h, m.rect.l, m.rect.t, m.rect.w, m.rect.h);
    } else {
        // flip monster horizontally
        ctx.scale(-1, 1);
        ctx.drawImage(this.monsterCanvas, 0, 0, m.rect.w, m.rect.h, -m.rect.l, m.rect.t, -m.rect.w, m.rect.h);
        ctx.setTransform(1,0,0,1,0,0);
    }
}

FF4Battle.prototype.drawMonsterGBA = function(slot) {
    var m = this.monsterInSlotGBA(slot);
    if (m === null) return; // return if slot is empty

    // decode the graphics
    var graphicsData = this.rom.monsterGraphics.item(m.m * 2 + 1);
    if (!graphicsData.format) {
        if (graphicsData.data[0] === 0x10) {
            graphicsData.format = ["linear4bpp", "tose-graphics", "gba-lzss"];
        } else if (graphicsData.data[0] === 0x70) {
            graphicsData.format = ["linear4bpp", "tose-graphics", "tose-70"];
        } else {
            graphicsData.format = ["gba-lzss", "tose-graphics"];
        }
        graphicsData.disassemble(this.rom.monsterGraphics.data);
    }

    var graphics = graphicsData.data;

    // load size
    var w = m.rect.w >> 3;
    var h = m.rect.h >> 3;

    var tiles = new Uint16Array(w * h);
    for (var t = 0; t < tiles.length; t++) tiles[t] = t;

    // load palette
    var paletteData = this.rom.monsterGraphics.item(m.m * 2);
    if (!paletteData.format) {
        paletteData.format = ["bgr555", "tose-palette"];
        paletteData.disassemble(paletteData.parent.data);
    }
    var pal = paletteData.data;

    // set up the ppu
    var ppu = new GFX.PPU();
    ppu.pal = pal;
    ppu.width = w * 8;
    ppu.height = h * 8;

    // layer 1
    ppu.layers[0].cols = w;
    ppu.layers[0].rows = h;
    ppu.layers[0].z[0] = GFX.Z.snesS0;
    ppu.layers[0].z[1] = GFX.Z.snesS1;
    ppu.layers[0].z[2] = GFX.Z.snesS2;
    ppu.layers[0].z[3] = GFX.Z.snesS3;
    ppu.layers[0].gfx = graphics;
    ppu.layers[0].tiles = tiles;
    ppu.layers[0].main = true;

    // draw the monster
    this.monsterCanvas.width = ppu.width;
    this.monsterCanvas.height = ppu.height;
    var context = this.monsterCanvas.getContext('2d');
    var imageData = context.createImageData(ppu.width, ppu.height);
    ppu.renderPPU(imageData.data);
    context.putImageData(imageData, 0, 0);

    // tint the selected monster
    if (this.selectedMonster && this.selectedMonster.slot === slot) this.tintMonster();

    var ctx = this.battleCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
    if (!this.backAttack) {
        ctx.drawImage(this.monsterCanvas, 0, 0, m.rect.w, m.rect.h, m.rect.l, m.rect.t, m.rect.w, m.rect.h);
    } else {
        // flip monster horizontally
        ctx.scale(-1, 1);
        ctx.drawImage(this.monsterCanvas, 0, 0, m.rect.w, m.rect.h, -m.rect.l, m.rect.t, -m.rect.w, m.rect.h);
        ctx.setTransform(1,0,0,1,0,0);
    }
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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(0, 0, this.monsterCanvas.width, this.monsterCanvas.height);

    ctx = this.monsterCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(transparentCanvas, 0, 0);
}

// from 03/F7BC
FF4Battle.altPalette = [0x16, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x12, 0x14, 0x00, 0x00, 0x13, 0x15, 0x00, 0x00, 0x00, 0x00];

FF4Battle.prototype.drawBackground = function() {

    if (this.rom.isGBA) {
        this.drawBackgroundGBA();
        return;
    }

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

    var bgProperties = this.rom.battleBackgroundProperties.item(bg);

    // load tile properties
    var top = bgProperties.top.value;
    var middle = bgProperties.middle.value;
    var bottom = bgProperties.bottom.value;

    var topTiles = this.rom.battleBackgroundLayoutUpper.item(top);
    var middleTiles = this.rom.battleBackgroundLayoutUpper.item(middle);
    var bottomTiles = this.rom.battleBackgroundLayoutLower.item(bottom);

    var offset = bgProperties.offset.value;
    var bottomData = bottomTiles.data.slice();
    if (offset) {
        // set tile offset (bottom tiles only)
        for (var i = 0; i < bottomData.length; i++) bottomData[i] += offset;
    }

    var tiles = new Uint32Array(0x240);
    tiles.set(topTiles.data);
    if (middle) {
        tiles.set(middleTiles.data, 0x100);
    } else {
        tiles.set(bottomData, 0x100);
        tiles.set(bottomData, 0x140);
        tiles.set(bottomData, 0x180);
        tiles.set(bottomData, 0x1C0);
    }
    tiles.set(bottomData, 0x200);

    var pal = new Uint32Array(0x80);
    pal[0] = 0xFF000000;
    var p = bg;
    if (this.altPalette && FF4Battle.altPalette[p]) p = FF4Battle.altPalette[p];
    pal.set(this.rom.battleBackgroundPalette.item(p).data);
    // pal.set(this.rom.battleBackgroundPalette.item(p).data.subarray(0, 8));
    // pal.set(this.rom.battleBackgroundPalette.item(p).data.subarray(8, 16), 0x10);

    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = pal;
    this.ppu.width = 256;
    this.ppu.height = 144;
    this.ppu.back = true;

    // layer 2
    this.ppu.layers[1].cols = 32;
    this.ppu.layers[1].rows = 18;
    this.ppu.layers[1].z[0] = GFX.Z.snes2L;
    this.ppu.layers[1].z[1] = GFX.Z.snes2H;
    this.ppu.layers[1].gfx = gfx;
    this.ppu.layers[1].tiles = tiles;
    this.ppu.layers[1].main = true;

    var context = this.battleCanvas.getContext('2d');
    imageData = context.createImageData(256, 192);
    this.ppu.renderPPU(imageData.data, 0, 0, 256, 192);
    context.putImageData(imageData, 0, 0);
}

FF4Battle.prototype.drawBackgroundGBA = function() {

    // load graphics
    var gfx = new Uint8Array(0x10000);
    var graphicsData = this.rom.battleBackgroundGraphics.item(this.bg);
    gfx.set(graphicsData.data);

    // load layout
    var tilemap = this.rom.battleBackgroundLayout.item(this.bg);

    // load palette
    var pal = new Uint32Array(0x100);
    var paletteData = this.rom.battleBackgroundPalette.item(this.bg);
    pal[0] = 0xFF000000;
    pal.set(paletteData.data);

    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = pal;
    this.ppu.width = 256;
    this.ppu.height = 128;
    this.ppu.back = true;

    // layer 2
    this.ppu.layers[1].cols = 32;
    this.ppu.layers[1].rows = 16;
    this.ppu.layers[1].z[0] = GFX.Z.snes2L;
    this.ppu.layers[1].z[1] = GFX.Z.snes2H;
    this.ppu.layers[1].gfx = gfx;
    this.ppu.layers[1].tiles = tilemap.data;
    this.ppu.layers[1].main = true;

    var context = this.battleCanvas.getContext('2d');
    imageData = context.createImageData(256, 128);
    this.ppu.renderPPU(imageData.data, 0, 0, 256, 128);
    context.putImageData(imageData, 0, 0);
}

// FF4BattleBackgroundEditor (sfc only)
function FF4BattleBackgroundEditor(rom) {
    ROMTilemapView.call(this, rom);
    this.name = "FF4BattleBackgroundEditor";
    this.bgProperties = null;
    this.altPalette = false;
    this.observer.options.sub = true;
    this.observer.options.link = true;
}

FF4BattleBackgroundEditor.prototype = Object.create(ROMTilemapView.prototype);
FF4BattleBackgroundEditor.prototype.constructor = FF4BattleBackgroundEditor;

FF4BattleBackgroundEditor.prototype.selectObject = function(object) {

    this.bgProperties = object;

    // update the tilemap
    this.updateTilemapDefinition();

    // call the default method
    ROMTilemapView.prototype.selectObject.call(this);
    // this.paletteView.updateToolbox();
    // this.graphicsView.updateToolbox();
}

FF4BattleBackgroundEditor.prototype.show = function() {

    // add default controls
    ROMTilemapView.prototype.show.call(this);

    // add a control to use the alternate palette
    var self = this;
    this.addTwoState("useAltPalette", function(checked) {
        self.altPalette = checked;
        self.updateTilemapDefinition();
        self.loadTilemap();
        self.paletteView.redraw();
        self.graphicsView.redraw();
    }, "Alt. Palette", this.altPalette);
}

FF4BattleBackgroundEditor.prototype.updateTilemapDefinition = function() {
    var index = this.bgProperties.i;
    var top = this.bgProperties.top.value;
    var middle = this.bgProperties.middle.value;
    var bottom = this.bgProperties.bottom.value;

    this.topTiles = this.rom.battleBackgroundLayoutUpper.item(top);
    if (middle) {
        this.middleTiles = this.rom.battleBackgroundLayoutUpper.item(middle);
    } else {
        this.middleTiles = null;
    }
    this.bottomTiles = this.rom.battleBackgroundLayoutLower.item(bottom);

    this.object = this.topTiles;

    // get the tile format
    var formatKey = this.object.format;

    // for assemblies with multiple formats, the graphics format is the first one
    if (isArray(formatKey)) formatKey = formatKey[0];

    // ignore format parameters
    if (formatKey.includes("(")) {
        formatKey = formatKey.substring(0, formatKey.indexOf("("));
    }
    this.format = GFX.tileFormat[formatKey] || GFX.tileFormat.defaultTile;

    // create graphics definition
    var graphics = this.rom.battleBackgroundGraphics.item(index);
    var graphicsDefinition = [[{
        path: "battleBackgroundGraphics[" + index + "]"
    }]];
    if (index < 15 && graphics.data.length < 0x0A00) graphicsDefinition[0].push({
        path: "battleBackgroundGraphics[" + (index + 1) + "]",
        offset: graphics.data.length,
        range: "0-" + (0x0A00 - graphics.data.length)
    });
    this.topTiles.graphics = graphicsDefinition;
    if (this.middleTiles) this.middleTiles.graphics = graphicsDefinition;
    this.bottomTiles.graphics = graphicsDefinition;

    // create palette definition
    var p = index;
    if (this.altPalette) p = FF4Battle.altPalette[index] || p;
    var paletteDefinition = "battleBackgroundPalette[" + p + "]";
    this.topTiles.palette = paletteDefinition
    if (this.middleTiles) this.middleTiles.palette = paletteDefinition;
    this.bottomTiles.palette = paletteDefinition;

    // create tile offset definition (bottom tiles only)
    tileOffsetDefinition = {
        path: "battleBackgroundProperties[" + index + "].offset",
        offset: middle ? 0x200 : 0x100
    }
    this.bottomTiles.tileOffset = tileOffsetDefinition.path;
}

FF4BattleBackgroundEditor.prototype.loadTilemap = function() {
    this.width = 32;
    this.height = 18;
    this.backColor = true;

    // update graphics and palette
    this.graphicsView.loadDefinition(this.object.graphics);
    this.paletteView.loadDefinition(this.object.palette);
    this.paletteView.updateToolbox();
    this.graphicsView.updateToolbox();

    this.graphicsView.updateTilemap();
    this.graphicsView.redraw();
    this.paletteView.redraw();

    this.tilemap = new Uint32Array(0x480);

    this.tilemap.set(this.topTiles.data);
    if (this.middleTiles) {
        this.tilemap.set(this.middleTiles.data, 0x100);
    } else {
        this.tilemap.set(this.bottomTiles.data, 0x100);
        this.tilemap.set(this.bottomTiles.data, 0x140);
        this.tilemap.set(this.bottomTiles.data, 0x180);
        this.tilemap.set(this.bottomTiles.data, 0x1C0);
    }
    this.tilemap.set(this.bottomTiles.data, 0x200);

    this.loadTileOffset(tileOffsetDefinition);

    // start observing tile layout and definition objects
    this.observer.stopObservingAll();
    this.observer.startObserving(this.bgProperties, this.loadTilemap);
    this.observer.startObserving(this.object, this.loadTilemap);
    this.observeDefinitionObject([this.object.tileOffset]);

    this.drawTilemap();
}

FF4BattleBackgroundEditor.prototype.setTilemap = function() {

    // return if nothing selected
    if (!this.tilemap) return;

    // make a copy of the current tiles
    var newData = this.tilemap.slice(0, this.object.data.length);

    // this.rom.beginAction();

    var top = this.bgProperties.top.value;
    var topTilesObject = this.rom.battleBackgroundLayoutUpper.item(top);
    var topTiles = this.tilemap.subarray(0x0000, 0x0100);
    topTilesObject.setData(topTiles);

    var middle = this.bgProperties.middle.value;
    if (middle) {
        var middleTilesObject = this.rom.battleBackgroundLayoutUpper.item(middle);
        var middleTiles = this.tilemap.subarray(0x0100, 0x0200);
        middleTilesObject.setData(middleTiles);
    }

    var index = this.bgProperties.i;
    var bottom = this.bgProperties.bottom.value;
    var bottomTilesObject = this.rom.battleBackgroundLayoutLower.item(bottom);
    if (middle) {
        var bottomTiles = this.tilemap.slice(0x0200, 0x0240);
    } else {
        var bottomTiles = this.tilemap.slice(0x0100, 0x0140);
    }
    this.setTileOffset("battleBackgroundProperties[" + index + "].offset", bottomTiles);
    bottomTilesObject.setData(bottomTiles);

    // this.rom.endAction();

    // reload tile layout
    // this.loadTilemap();
}

// FF4BattleVRAM
function FF4BattleVRAM(rom, battle) {
    this.rom = rom;
    this.battle = battle;
    this.name = "FF4BattleVRAM";

    this.canvas = document.createElement('canvas');
    this.vramCanvas = document.createElement('canvas');
    this.vramCanvas.width = 256;
    this.vramCanvas.height = 512;

    this.zoom = 2.0;

    var self = this;
    this.canvas.onmousedown = function(e) { self.mouseDown(e) };
}

FF4BattleVRAM.prototype.show = function(show) {

    this.battle.showVRAM = show;
    this.div = document.getElementById('toolbox-div');
    if (show) {
        this.div.classList.remove('hidden');
        this.div.innerHTML = "";
        this.div.appendChild(this.canvas);
        this.div.style.height = "512px";
    } else {
        this.div.classList.add('hidden');
        this.div.innerHTML = "";
    }

    document.getElementById("toolbox-layer-div").classList.add('hidden');
}

FF4BattleVRAM.prototype.mouseDown = function(e) {
    var x = Math.floor(e.offsetX / this.zoom);
    var y = Math.floor(e.offsetY / this.zoom);

    var clickedType = this.typeAtPoint(x, y);
    if (!clickedType) return;

    var monster = this.battle.firstMonsterOfType(clickedType);
    if (!monster) return;

    this.battle.selectedMonster = monster;
    this.battle.selectedCharacter = null;
    propertyList.select(this.rom.monsterProperties.item(monster.m));

    this.battle.drawBattle();
}

FF4BattleVRAM.prototype.rectForType = function(type) {
    var v = this.battle.battleProperties.vramMap.value;
    var monsterString = "monster" + type.toString();
    var bossTileCount = this.bossTileCount[monsterString];
    var vramOffset = this.vramOffset[monsterString];
    if (!vramOffset.value) return Rect.emptyRect;

    // monster slot, get vram map data
    var w = 128;
    var h = (bossTileCount.value === 0x7F ? 64 : 128);
    var l = 0;
    var t = (vramOffset.value - 0x2000) >> 5;
    var r = l + w;
    var b = t + h;
    var slotRect = new Rect(l, r, t, b);
    return slotRect;
}

FF4BattleVRAM.prototype.typeAtPoint = function(x, y) {
    for (var type = 1; type <= 3; type++) {
        if (this.rectForType(type).containsPoint(x, y)) return type;
    }
    return null;
}

FF4BattleVRAM.prototype.clearVRAM = function() {

    // clear the vram canvas
    this.vramCanvas.width = 256;
    this.vramCanvas.height = 512;

//    if (this.canvas.parentElement) {
//        this.canvas.parentElement.style.height = "512px";
//        this.canvas.parentElement.classList.remove("hidden");
//    }

    // recalculate zoom
    this.zoom = 2.0; //this.div.clientWidth / 128;

    this.canvas.width = 128 * this.zoom;
    this.canvas.height = 256 * this.zoom;

    var ctx = this.canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 128 * this.zoom, 256 * this.zoom)
}

FF4BattleVRAM.prototype.loadVRAM = function() {

    var v = this.battle.battleProperties.vramMap.value;
    this.bossTileCount = this.rom.battleVRAMMap.bossTileCount.item(v);
    this.vramOffset = this.rom.battleVRAMMap.vramOffset.item(v);
    this.tileData1 = this.rom.battleVRAMMap.tileData1.item(v);
    this.tileData2 = this.rom.battleVRAMMap.tileData2.item(v);
    this.vramGraphics = new Uint8Array(0x8000);
    this.vramPalette = new Uint32Array(0x100);
    this.tiles = new Uint16Array(16 * 32);

    for (var t = 1; t <= 3; t++) {
        var monsterString = "monster" + t.toString();
        var offset = this.vramOffset[monsterString].value;
        var tileOffset = (offset - 0x2000) >> 4;
        var paletteOffset = t + 2;

        var m = this.battle.battleProperties[monsterString].value;
        if (m === 255) continue;
        var gfxProperties = this.rom.monsterGraphicsProperties.item(m);

        // set tile data
        if (offset) {
            var f1 = this.tileData1[monsterString].value;
            var f2 = this.tileData2[monsterString].value;
            var tileFlags = (f1 << 8) | f2;
            for (var tile = 0; tile < this.tiles.length; tile++) {
                this.tiles[tile + tileOffset] = tile + tileFlags;
            }
        }

        if (gfxProperties.isCharacter.value) {

            // load graphics
            if (offset) {
                var c = gfxProperties.characterIndex.value;
                if (c > this.rom.characterGraphics.arrayLength) return;
                gfx = this.rom.characterGraphics.item(c).data;
                this.vramGraphics.set(gfx, (offset - 0x2000) * 4);
            }

            // load palette
            var p = gfxProperties.palette.value;
            if (p > this.rom.characterPalette.arrayLength) return;
            pal = this.rom.characterPalette.item(p).data;
            this.vramPalette.set(pal, paletteOffset * 0x10);

        } else if (gfxProperties.isBoss.value) {

            // load palette
            var bossProperties = this.rom.monsterBossProperties.item(gfxProperties.bossProperties.value);
            var p = bossProperties.palette.value;
            pal = new Uint32Array(16);
            pal.set(this.rom.monsterPalette.item(p).data);
            if (this.rom.isGBA || !gfxProperties.is3bpp.value) pal.set(this.rom.monsterPalette.item(p + 1).data, 8);
            this.vramPalette.set(pal, paletteOffset * 0x10);

            // decode the graphics
            if (offset) {
                var tileCount = this.bossTileCount[monsterString].value;
                var bytesPerTile = gfxProperties.is3bpp.value ? 24 : 32;
                var begin = this.rom.monsterGraphics.range.begin + gfxProperties.graphicsPointer.value;
                var end = begin + tileCount * bytesPerTile;
                var format = gfxProperties.is3bpp.value ? GFX.graphicsFormat.snes3bpp : GFX.graphicsFormat.snes4bpp;
                gfx = format.decode(this.rom.data.subarray(begin, end));
                this.vramGraphics.set(gfx[0], (offset - 0x2000) * 4);
            }

        } else {
            // load palette
            var p = gfxProperties.palette.value;
            pal = new Uint32Array(16);
            pal.set(this.rom.monsterPalette.item(p).data);
            if (this.rom.isGBA || !gfxProperties.is3bpp.value) pal.set(this.rom.monsterPalette.item(p + 1).data, 8);
            this.vramPalette.set(pal, paletteOffset * 0x10);

            // decode the graphics
            if (offset) {
                var bytesPerTile = gfxProperties.is3bpp.value ? 24 : 32;
                var begin = this.rom.monsterGraphics.range.begin + gfxProperties.graphicsPointer.value;
                var size = this.rom.monsterSize.item(gfxProperties.size.value);
                var w = size.width.value * 8;
                var h = size.height.value * 8;
                var end = begin + w * h * bytesPerTile / 64;
                var format = gfxProperties.is3bpp.value ? GFX.graphicsFormat.snes3bpp : GFX.graphicsFormat.snes4bpp;
                gfx = format.decode(this.rom.data.subarray(begin, end));
                this.vramGraphics.set(gfx[0], (offset - 0x2000) * 4);
            }
        }
    }
}

FF4BattleVRAM.prototype.drawVRAM = function() {

    // set up the ppu
    var ppu = new GFX.PPU();
    ppu.pal = this.vramPalette;
    ppu.width = 16 * 8;
    ppu.height = 32 * 8;

    // layer 1
    ppu.layers[0].cols = 16;
    ppu.layers[0].rows = 32;
    ppu.layers[0].z[0] = GFX.Z.snesS0;
    ppu.layers[0].z[1] = GFX.Z.snesS1;
    ppu.layers[0].z[2] = GFX.Z.snesS2;
    ppu.layers[0].z[3] = GFX.Z.snesS3;
    ppu.layers[0].gfx = this.vramGraphics;
    ppu.layers[0].tiles = GFX.tileFormat.snes4bppTile.decode(this.tiles)[0];
    ppu.layers[0].main = true;

    // draw the monster
    this.vramCanvas.width = ppu.width;
    this.vramCanvas.height = ppu.height;
    var context = this.vramCanvas.getContext('2d');
    var imageData = context.createImageData(ppu.width, ppu.height);
    ppu.renderPPU(imageData.data);
    context.putImageData(imageData, 0, 0);

    for (var type = 1; type <= 3; type++) {
        if (this.battle.typeHidden(type)) this.transparentMonster(type);
    }

    // tint the selected monster
    if (this.battle.selectedMonster) this.tintMonster(this.battle.selectedMonster.type);

    // draw the monsters
    var ctx = this.canvas.getContext('2d');
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.vramCanvas, 0, 0, 256, 512);

    // draw the slots
    for (var type = 1; type <= 3; type++) {
        var typeRect = this.rectForType(type);
        if (typeRect.isEmpty()) continue;
        typeRect = typeRect.scale(this.zoom);

        // draw the vram slot
        var x = typeRect.l + 0.5;
        var y = typeRect.t + 0.5;
        var w = typeRect.w - 1;
        var h = typeRect.h - 1;

        ctx.rect(x, y, w, h);
        ctx.lineWidth = 1;
        ctx.strokeStyle = "gray";
        ctx.stroke();
        if (this.battle.selectedMonster && this.battle.selectedMonster.type === type) {
            ctx.fillStyle = 'hsla(210, 100%, 50%, 0.5)';
        } else {
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        }
        ctx.fillText(type.toString(), typeRect.centerX, typeRect.centerY);
        ctx.strokeStyle = "rgba(255, 255, 255, 1.0)";
        ctx.strokeText(type.toString(), typeRect.centerX, typeRect.centerY);
    }
}

FF4BattleVRAM.prototype.tintMonster = function(type) {
    // create an offscreen canvas filled with the color
    var tintCanvas = document.createElement('canvas');
    tintCanvas.width = this.vramCanvas.width;
    tintCanvas.height = this.vramCanvas.height;
    var ctx = tintCanvas.getContext('2d');
    ctx.fillStyle = 'hsla(210, 100%, 50%, 0.5)';
    var typeRect = this.rectForType(type);
    ctx.fillRect(typeRect.l, typeRect.t, typeRect.w, typeRect.h);

    ctx = this.vramCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.drawImage(tintCanvas, 0, 0);
}

FF4BattleVRAM.prototype.transparentMonster = function(type) {
    // create an offscreen canvas filled with the color
    var transparentCanvas = document.createElement('canvas');
    transparentCanvas.width = this.vramCanvas.width;
    transparentCanvas.height = this.vramCanvas.height;
    var ctx = transparentCanvas.getContext('2d');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    var typeRect = this.rectForType(type);
    ctx.fillRect(typeRect.l, typeRect.t, typeRect.w, typeRect.h);

    ctx = this.vramCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(transparentCanvas, 0, 0);
}

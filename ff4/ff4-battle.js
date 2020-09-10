//
// ff4-battle.js
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
}

FF4Battle.prototype.show = function() {

    var vram = this.vram;
    var battle = this;

    this.resetControls();
    this.showControls();
    this.closeList();

    // add a control to show/hide monsters
    this.addTwoState("showMonsters", function(checked) {
        battle.showMonsters = checked;
        battle.drawBattle();
    }, "Monsters", this.showMonsters);

    // add a control to select the battle background
    var bgNames = [];
    for (var i = 0; i < this.rom.battleBackgroundGraphics.arrayLength; i++) {
        bgNames.push(this.rom.stringTable.battleBackgroundProperties.string[i].fString());
    }
    function onChangeBG(bg) {
        battle.bg = bg;
        battle.drawBattle();
    }
    function bgSelected(bg) {
        return battle.bg === bg;
    }
    this.addList("showBackground", "Background", bgNames, onChangeBG, bgSelected);

    // add a control to use the alternate battle background palette
    if (this.rom.isSFC) this.addTwoState("useAltPalette", function(checked) {
        battle.altPalette = checked;
        battle.drawBattle();
    }, "Alt. Palette", this.altPalette);

    // add a control to show a back attack formation
    this.addTwoState("backAttack", function(checked) {
        battle.backAttack = checked;
        battle.drawBattle();
    }, "Back Attack", this.backAttack);

    // add a control to show/hide VRAM
    if (this.rom.isSFC) this.addTwoState("showVRAM", function(checked) {
        battle.showVRAM = checked;
        if (battle.showVRAM) {
            battle.vram.show();
            battle.vram.redraw();
        } else {
            battle.vram.hide();
        }
    }, "VRAM", this.showVRAM);

    // notify on resize
    this.resizeSensor = new ResizeSensor(document.getElementById("edit-top"), function() {
        battle.drawBattle();
    });

    // show the VRAM
    if (this.rom.isSFC && this.showVRAM) this.vram.show();
}

FF4Battle.prototype.hide = function() {
    this.observer.stopObservingAll();
    if (this.resizeSensor) {
        this.resizeSensor.detach(document.getElementById("edit-top"));
        this.resizeSensor = null;
    }
    if (this.rom.isSFC) this.vram.hide()
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
    if (this.rom.isSFC) {
        this.vram.loadVRAM();
        this.vram.resize();
        this.vram.redraw();
    }
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

    var vramSlot = 1;
    var monsterCount = [
        0,
        this.battleProperties.monster1Count.value,
        this.battleProperties.monster2Count.value,
        this.battleProperties.monster3Count.value];

    var i = 0;
    while (i < slot) {
        if (monsterCount[vramSlot]) {
            monsterCount[vramSlot]--;
            i++;
            continue;
        }
        vramSlot++;
        if (vramSlot > 3) return null;
    }

    var m = this.battleProperties["monster" + vramSlot].value;
    if (m === 0xFF) return null; // slot is empty

    var hidden = this.typeHidden(vramSlot);

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
        vramSlot: vramSlot,
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
    var vramSlot = monster.monsterType.value;

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
        vramSlot: vramSlot,
        x: x,
        y: y,
        rect: rect,
        hidden: hidden
    };
}

FF4Battle.prototype.firstMonsterInVRAMSlot = function(vramSlot) {
    for (var slot = 1; slot <= 8; slot++) {
        var monster = this.monsterInSlot(slot);
        if (!monster) break;
        if (monster.vramSlot === vramSlot) return monster;
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
    if (this.rom.isSFC) this.vram.redraw();

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

    if (this.rom.isSFC) this.vram.redraw();
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

    var monsterString = `monster${m.vramSlot}`;
    var f1 = this.vram.tileData1[monsterString].value;
    f1 &= 0xE3;
    f1 |= (m.vramSlot + 2) << 2; // palette
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
    ppu.pal = this.rom.gammaCorrectedPalette(this.vram.ppu.pal);
    ppu.width = w * 8;
    ppu.height = h * 8;

    // layer 1
    ppu.layers[0].cols = w;
    ppu.layers[0].rows = h;
    ppu.layers[0].z[0] = GFX.Z.snesS0;
    ppu.layers[0].z[1] = GFX.Z.snesS1;
    ppu.layers[0].z[2] = GFX.Z.snesS2;
    ppu.layers[0].z[3] = GFX.Z.snesS3;
    ppu.layers[0].gfx = this.vram.ppu.layers[0].gfx;
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
            graphicsData.format = ["linear4bpp", "tose-graphics"];
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
    ppu.pal = this.rom.gammaCorrectedPalette(pal);
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
    this.ppu.pal = this.rom.gammaCorrectedPalette(pal);
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
    this.ppu.pal = this.rom.gammaCorrectedPalette(pal);
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
class FF4BattleBackgroundEditor extends ROMTilemapView {
    constructor(rom) {
        super(rom);
        this.name = "FF4BattleBackgroundEditor";
        this.bgProperties = null;
        this.altPalette = false;
        this.observer.options.sub = true;
        this.observer.options.link = true;
        this.showRegions = false;
    }

    selectObject(object) {
        this.bgProperties = object;

        // update the tilemap
        this.updateTilemapDefinition();

        // call the default method
        super.selectObject(this.topTiles);
    }

    resetControls() {
        super.resetControls();

        const self = this;

        // add a control to use the alternate palette
        this.addTwoState('useAltPalette', function(checked) {
            self.altPalette = checked;
            self.updateTilemapDefinition();
            self.paletteView.redraw();
            self.graphicsView.redraw();
        }, 'Alt. Palette', this.altPalette);

        // add a control to show tilemap regions
        this.addTwoState('showRegions', function(checked) {
            self.showRegions = checked;
            self.redraw();
        }, 'Regions', this.showRegions);
    }

    updateTilemapDefinition() {
        const i = this.bgProperties.i;
        const top = this.bgProperties.top.value;
        const middle = this.bgProperties.middle.value;
        const bottom = this.bgProperties.bottom.value;

        // start observing tile layout and definition objects
        this.observer.stopObservingAll();
        this.observer.startObserving(this.bgProperties, this.updateTilemapDefinition);

        this.topTiles = this.rom.battleBackgroundLayoutUpper.item(top);
        this.observer.startObserving(this.topTiles, this.updateTilemapDefinition);
        if (middle) {
            this.middleTiles = this.rom.battleBackgroundLayoutUpper.item(middle);
            this.observer.startObserving(this.middleTiles, this.updateTilemapDefinition);
        } else {
            this.middleTiles = null;
        }
        this.bottomTiles = this.rom.battleBackgroundLayoutLower.item(bottom);
        this.observer.startObserving(this.bottomTiles, this.updateTilemapDefinition);

        this.object = this.topTiles;

        // get the tile format
        let formatKey = this.object.format;

        // for assemblies with multiple formats, the graphics format is the first one
        if (isArray(formatKey)) formatKey = formatKey[0];

        // ignore format parameters
        if (formatKey.includes('(')) {
            formatKey = formatKey.substring(0, formatKey.indexOf('('));
        }
        this.format = GFX.tileFormat[formatKey] || GFX.tileFormat.defaultTile;

        // create graphics definition
        const graphics = this.rom.battleBackgroundGraphics.item(i);
        const graphicsDefinition = [[{
            path: `battleBackgroundGraphics[${i}]`
        }]];
        if (i < 15 && graphics.data.length < 0x0A00) graphicsDefinition[0].push({
            path: `battleBackgroundGraphics[${i + 1}]`,
            offset: graphics.data.length,
            range: `0-${0x0A00 - graphics.data.length}`
        });
        this.topTiles.graphics = graphicsDefinition;
        if (this.middleTiles) this.middleTiles.graphics = graphicsDefinition;
        this.bottomTiles.graphics = graphicsDefinition;

        // create palette definition
        const p = this.altPalette ? (FF4Battle.altPalette[i] || i) : i;
        var paletteDefinition = `battleBackgroundPalette[${p}]`;
        this.topTiles.palette = paletteDefinition
        if (this.middleTiles) this.middleTiles.palette = paletteDefinition;
        this.bottomTiles.palette = paletteDefinition;

        // create tile offset definition (bottom tiles only)
        const tileOffsetDefinition = {
            path: `battleBackgroundProperties[${i}].offset`,
            offset: middle ? 0x200 : 0x100
        }
        this.bottomTiles.tileOffset = tileOffsetDefinition;

        this.loadTilemap();
    }

    drawMask() {
        super.drawMask();

        if (!this.showRegions) return;

        const context = this.canvas.getContext('2d');
        context.globalCompositeOperation = 'source-over';
        context.fillStyle = 'rgb(0, 0, 0, 0.5)';
        context.font = `${12 * this.zoom}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // draw the top region
        context.rect(0, 0, 256 * this.zoom, 64 * this.zoom);
        context.strokeStyle = 'gray';
        context.stroke();
        context.fillText('Top Tilemap', 128 * this.zoom, 32 * this.zoom);
        context.strokeStyle = 'white';
        context.strokeText('Top Tilemap', 128 * this.zoom, 32 * this.zoom);

        if (this.middleTiles) {
            // draw the middle region
            context.rect(0, 64 * this.zoom, 256 * this.zoom, 64 * this.zoom);
            context.strokeStyle = 'gray';
            context.stroke();
            context.fillText('Middle Tilemap', 128 * this.zoom, 96 * this.zoom);
            context.strokeStyle = 'white';
            context.strokeText('Middle Tilemap', 128 * this.zoom, 96 * this.zoom);

            // draw the bottom region
            context.rect(0, 128 * this.zoom, 256 * this.zoom, 16 * this.zoom);
            context.strokeStyle = 'gray';
            context.stroke();
            context.fillText('Bottom Tilemap', 128 * this.zoom, 136 * this.zoom);
            context.strokeStyle = 'white';
            context.strokeText('Bottom Tilemap', 128 * this.zoom, 136 * this.zoom);
        } else {
            // draw the bottom region
            context.rect(0, 64 * this.zoom, 256 * this.zoom, 16 * this.zoom);
            context.strokeStyle = 'gray';
            context.stroke();
            context.fillText('Bottom Tilemap', 128 * this.zoom, 72 * this.zoom);
            context.strokeStyle = 'white';
            context.strokeText('Bottom Tilemap', 128 * this.zoom, 72 * this.zoom);

            // draw the repeated bottom region
            context.fillRect(0, 80 * this.zoom, 256 * this.zoom, 64 * this.zoom);
            context.rect(0, 80 * this.zoom, 256 * this.zoom, 64 * this.zoom);
            context.strokeStyle = 'gray';
            context.stroke();
            context.strokeStyle = 'white';
            context.strokeText('Bottom Tilemap (Repeated)', 128 * this.zoom, 112 * this.zoom);
        }
    }

    loadTilemap() {
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

        this.loadTileOffset(this.bottomTiles.tileOffset);

        this.redraw();
    }

    setTilemap() {
        // return if nothing selected
        if (!this.tilemap) return;

        this.rom.beginAction();
        this.observer.sleep();

        const topTiles = this.tilemap.slice(0x0000, 0x0100);
        this.topTiles.setData(topTiles);

        const begin = this.middleTiles ? 0x200 : 0x100;
        const bottomTiles = this.tilemap.slice(begin, begin + 0x40);
        const index = this.bgProperties.i;

        if (this.middleTiles) {
            const middleTiles = this.tilemap.slice(0x0100, 0x0200);
            this.middleTiles.setData(middleTiles);
        } else {
            // copy bottom tiles to lower rows
            this.tilemap.set(bottomTiles, 0x140);
            this.tilemap.set(bottomTiles, 0x180);
            this.tilemap.set(bottomTiles, 0x1C0);
            this.tilemap.set(bottomTiles, 0x200);
            this.redraw();
        }

        this.setTileOffset(this.bottomTiles.tileOffset.path, bottomTiles);
        this.bottomTiles.setData(bottomTiles);

        this.observer.wake();
        this.rom.endAction();
    }
}

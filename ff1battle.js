//
// ff1battle.js
// created 11/10/2018
//

function FF1Battle(rom) {
    ROMEditor.call(this, rom);
    this.name = "FF1Battle";

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
    
    this.battleRect = new Rect(0, 192, 0, 144);
    this.zoom = 2.0;

    this.selectedMonster = null;
    this.showMonsters = true;
    
    this.observer = new ROMObserver(rom, this, {sub: true, link: true, array: true});

    var self = this;
    this.canvas.onmousedown = function(e) { self.mouseDown(e) };
    
    this.updateBattleStrings();
}

FF1Battle.prototype = Object.create(ROMEditor.prototype);
FF1Battle.prototype.constructor = FF1Battle;

//FF1Battle.prototype.battleName = function(b) {
//    var battleProperties = this.rom.battleProperties.item(b);
//    var monster1 = battleProperties.monster1.value;
//    var monster2 = battleProperties.monster2.value;
//    var monster3 = battleProperties.monster3.value;
//    var monster4 = battleProperties.monster4.value;
//    var m1 = battleProperties.monster1Max.value
//    var m2 = battleProperties.monster2Max.value
//    var m3 = battleProperties.monster3Max.value
//    var m4 = battleProperties.monster4Max.value
//
//    if (monster3 === monster4) { m3 += m4; m4 = 0; }
//    if (monster2 === monster4) { m2 += m4; m4 = 0; }
//    if (monster1 === monster4) { m1 += m4; m4 = 0; }
//    if (monster2 === monster3) { m2 += m3; m3 = 0; }
//    if (monster1 === monster2) { m1 += m2; m2 = 0; }
//    if (monster1 === monster3) { m1 += m3; m3 = 0; }
//
//    var battleName = "";
//    if (m1 !== 0) {
//        battleName += "<monsterName[" + monster1.toString() + "]>"
//    }
//    if (m2 !== 0) {
//        if (battleName !== "") battleName += ", ";
//        battleName += "<monsterName[" + monster2.toString() + "]>"
//    }
//    if (m3 !== 0) {
//        if (battleName !== "") battleName += ", ";
//        battleName += "<monsterName[" + monster3.toString() + "]>"
//    }
//    if (m4 !== 0) {
//        if (battleName !== "") battleName += ", ";
//        battleName += "<monsterName[" + monster4.toString() + "]>"
//    }
//    if (battleName === "") battleName = "Battle %i";
//    return battleName;
//}

FF1Battle.prototype.updateBattleStrings = function() {
    
    for (var b = 0; b < this.rom.battleProperties.array.length; b++) {
        var battleProperties = this.rom.battleProperties.item(b);
        var monster1 = battleProperties.monster1.value;
        var monster2 = battleProperties.monster2.value;
        var monster3 = battleProperties.monster3.value;
        var monster4 = battleProperties.monster4.value;
        var m1 = battleProperties.monster1Max.value
        var m2 = battleProperties.monster2Max.value
        var m3 = battleProperties.monster3Max.value
        var m4 = battleProperties.monster4Max.value

        if (monster3 === monster4) { m3 += m4; m4 = 0; }
        if (monster2 === monster4) { m2 += m4; m4 = 0; }
        if (monster1 === monster4) { m1 += m4; m4 = 0; }
        if (monster2 === monster3) { m2 += m3; m3 = 0; }
        if (monster1 === monster2) { m1 += m2; m2 = 0; }
        if (monster1 === monster3) { m1 += m3; m3 = 0; }

        var battleName = "";
        if (m1 !== 0) {
            battleName += "<monsterName[" + monster1.toString() + "]>"
        }
        if (m2 !== 0) {
            if (battleName !== "") battleName += ", ";
            battleName += "<monsterName[" + monster2.toString() + "]>"
        }
        if (m3 !== 0) {
            if (battleName !== "") battleName += ", ";
            battleName += "<monsterName[" + monster3.toString() + "]>"
        }
        if (m4 !== 0) {
            if (battleName !== "") battleName += ", ";
            battleName += "<monsterName[" + monster4.toString() + "]>"
        }
        this.rom.stringTable.battleProperties.string[b].value = battleName;
    }
}

FF1Battle.prototype.mouseDown = function(e) {
    this.closeList();
    var x = Math.floor(e.offsetX / this.zoom) + this.battleRect.l;
    var y = Math.floor(e.offsetY / this.zoom) + this.battleRect.t;
    this.selectedMonster = this.monsterAtPoint(x, y);

    if (this.selectedMonster) {        
        propertyList.select(this.rom.monsterProperties.item(this.selectedMonster.monster));
    } else {
        propertyList.select(this.battleProperties);
    }
    
    this.drawBattle();
}

FF1Battle.prototype.selectObject = function(object) {
    this.loadBattle(object.i);
    this.show();
}

FF1Battle.prototype.show = function() {
    var battle = this;

    document.getElementById('toolbox-buttons').classList.add("hidden");
    document.getElementById('toolbox-div').classList.add("hidden");

    this.resetControls();
    this.showControls();
    this.closeList();
    this.addTwoState("showMonsters", function(checked) { battle.showMonsters = checked; battle.drawBattle(); }, "Monsters", this.showMonsters);
    
    var bgNames = [];
    for (var i = 0; i < this.rom.stringTable.battleBackground.string.length; i++) {
        bgNames.push(this.rom.stringTable.battleBackground.string[i].fString());
    }
    var onChangeBG = function(bg) { battle.bg = bg; battle.drawBattle(); }
    var bgSelected = function(bg) { return battle.bg === bg; }
    this.addList("showBackground", "Background", bgNames, onChangeBG, bgSelected);
}

FF1Battle.prototype.loadBattle = function(b) {
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

FF1Battle.prototype.monsterInSlot = function(slot) {
    
    var x, y, h, w;
    
    var i = 0;
    var type = 1;
    var monsterCount = [0,
        this.battleProperties.monster1Max.value,
        this.battleProperties.monster2Max.value,
        this.battleProperties.monster3Max.value,
        this.battleProperties.monster4Max.value];

    var g1 = this.battleProperties.monster1Graphics.value;
    var g2 = this.battleProperties.monster2Graphics.value;
    var g3 = this.battleProperties.monster3Graphics.value;
    var g4 = this.battleProperties.monster4Graphics.value;
    var size = this.battleProperties.size.value;
    
    switch (size) {
        case 0: // 9 small monsters
            if (slot > 9) return null;
            
            if (slot <= 3) x = 8;
            else if (slot <= 6) x = 40;
            else x = 72;

            if (slot % 3 === 1) y = 72;
            else if (slot % 3 === 2) y = 40;
            else y = 104;

            w = h = 32;
            
            if (g1 === 1 || g1 === 3) monsterCount[1] = 0;
            if (g2 === 1 || g2 === 3) monsterCount[2] = 0;
            if (g3 === 1 || g3 === 3) monsterCount[3] = 0;
            if (g4 === 1 || g4 === 3) monsterCount[4] = 0;
            
            break;
            
        case 1: // 4 large monsters
            if (slot > 4) return null;
            
            x = (slot <= 2) ? 8 : 56;
            y = (slot % 2 === 1) ? 40 : 88;

            w = h = 48;
            
            if (g1 === 0 || g1 === 2) monsterCount[1] = 0;
            if (g2 === 0 || g2 === 2) monsterCount[2] = 0;
            if (g3 === 0 || g3 === 2) monsterCount[3] = 0;
            if (g4 === 0 || g4 === 2) monsterCount[4] = 0;
            
            break;

        case 2: // 2 large, 6 small
            if (slot <= 2) {
                x = 8;
                y = (slot === 1) ? 40 : 88;
                w = h = 48;
                if (g1 === 0 || g1 === 2) monsterCount[1] = 0;
                if (g2 === 0 || g2 === 2) monsterCount[2] = 0;
                if (g3 === 0 || g3 === 2) monsterCount[3] = 0;
                if (g4 === 0 || g4 === 2) monsterCount[4] = 0;
                
            } else if (slot <= 8) {
                x = (slot <= 5) ? 56 : 88;
                if ((slot - 2) % 3 === 1) y = 72;
                else if ((slot - 2) % 3 === 2) y = 40;
                else y = 104;
                w = h = 32
                i = 2;
                if (g1 === 1 || g1 === 3) monsterCount[1] = 0;
                if (g2 === 1 || g2 === 3) monsterCount[2] = 0;
                if (g3 === 1 || g3 === 3) monsterCount[3] = 0;
                if (g4 === 1 || g4 === 3) monsterCount[4] = 0;

            } else {
                return null;
            }
            break;
            
        case 3: // fiend
            if (slot > 1) return null;
            x = 32;
            y = 56;
            w = h = 64;
            break;

        case 4: // chaos
            if (slot > 1) return null;
            x = 8;
            y = 40;
            w = 112;
            h = 96;
            break;

        default:
            return null;
    }
    
    while (i < slot) {
        if (monsterCount[type]) {
            monsterCount[type]--;
            i++;
            continue;
        }
        type++;
        if (type > 4) return null;
    }

    var offset = 0;
    var graphics = this.battleProperties["monster" + type + "Graphics"].value;
    switch (graphics) {
        case 0: offset = 18; break;
        case 1: offset = 50; break;
        case 2: offset = 34; break;
        case 3: offset = 86; break;
        default: break;
    }

    return {slot: slot,
            offset: offset,
            size: size,
            rect: new Rect(x, x + w, y, y + h),
            graphics: graphics,
            palette: this.battleProperties["monster" + type + "Palette"].value,
            monster: this.battleProperties["monster" + type].value};
}

FF1Battle.prototype.monsterAtPoint = function(x, y) {
    
    for (var slot = 1; slot <= 9; slot++) {
        var m = this.monsterInSlot(slot);
        if (!m) continue;
        if (m.rect.containsPoint(x, y)) return m;
    }
    return null;
}

FF1Battle.prototype.drawBattle = function() {
    this.drawBackground();
    if (this.showMonsters) {
        for (var slot = 1; slot <= 9; slot++) this.drawMonster(slot);
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

FF1Battle.prototype.drawMonster = function(slot) {
    
    var m = this.monsterInSlot(slot);
    if (m === null) return; // return if slot is empty
    
    // load graphics
    var g = this.battleProperties.graphics.value;
    var gfx = this.rom.monsterGraphics.item(g).data;

    // load palettes
    var p1 = this.battleProperties.palette1.value;
    var p2 = this.battleProperties.palette2.value;
    var pal = new Uint32Array(16);
    pal.set(this.rom.monsterPalette.item(p1).data, 4);
    pal.set(this.rom.monsterPalette.item(p2).data, 8);
    
    // create tile layout
    var w = m.rect.w >> 3;
    var h = m.rect.h >> 3;

    var tiles = new Uint16Array(w * h);
    if (m.size < 3) {
        // normal monster
        var p = (m.palette + 1) << 10;
        for (var i = 0; i < tiles.length; i++) tiles[i] = (i + m.offset) | p;
    } else if (m.size === 3) {
        // fiend
        var map = this.rom.monsterMapFiend.item(m.graphics);
        var i = 0;
        for (var i = 0; i < tiles.length; i++) {
            var x = ((i % 8) >> 1) + 2;
            var y = (Math.floor(i / 8) >> 1) + 2;
            var p = map.palette.data[x + y * 8] << 10;
            tiles[i] = map.tiles.data[i] | p;
        }
        
    } else if (m.size === 4) {
        // chaos
        var map = this.rom.monsterMapChaos;
        for (var i = 0; i < tiles.length; i++) {
            var x = ((i % 14) >> 1) + 1;
            var y = (Math.floor(i / 14) >> 1) + 1;
            var p = map.palette.data[x + y * 8] << 10;
            tiles[i] = map.tiles.data[i] | p;
        }
    }

    // set up the ppu
    var ppu = new GFX.PPU();
    ppu.pal = pal;
    ppu.width = m.rect.w;
    ppu.height = m.rect.h;

    // layer 1
    ppu.layers[0].format = GFX.TileFormat.snes2bppTile;
    ppu.layers[0].cols = w;
    ppu.layers[0].rows = h;
    ppu.layers[0].z[0] = GFX.Z.top;
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
    
    // tint the selected monster
    if (this.selectedMonster && this.selectedMonster.slot === slot) this.tintMonster();
    
    var ctx = this.battleCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.drawImage(this.monsterCanvas, 0, 0, m.rect.w, m.rect.h, m.rect.l, m.rect.t, m.rect.w, m.rect.h);
}

FF1Battle.prototype.tintMonster = function() {
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

FF1Battle.backgroundLayout = new Uint16Array([
    0x0C77, 0x0C78, 0x0C78, 0x0C78, 0x0C78, 0x0C78, 0x0C78, 0x0C78, 0x0C78, 0x0C78, 0x0C78, 0x0C78, 0x0C78, 0x0C78, 0x0C78, 0x0C79, 0x0C77, 0x0C78, 0x0C78, 0x0C78, 0x0C78, 0x0C78, 0x0C78, 0x0C79,
    0x0C7A, 0x0001, 0x0002, 0x0003, 0x0004, 0x0003, 0x0004, 0x0001, 0x0002, 0x0001, 0x0002, 0x0003, 0x0004, 0x0003, 0x0004, 0x0C7B, 0x0C7A, 0x0001, 0x0002, 0x0003, 0x0004, 0x0003, 0x0004, 0x0C7B,
    0x0C7A, 0x0005, 0x0006, 0x0007, 0x0008, 0x0007, 0x0008, 0x0005, 0x0006, 0x0005, 0x0006, 0x0007, 0x0008, 0x0007, 0x0008, 0x0C7B, 0x0C7A, 0x0005, 0x0006, 0x0007, 0x0008, 0x0007, 0x0008, 0x0C7B,
    0x0C7A, 0x0009, 0x000A, 0x000B, 0x000C, 0x000B, 0x000C, 0x0009, 0x000A, 0x0009, 0x000A, 0x000B, 0x000C, 0x000B, 0x000C, 0x0C7B, 0x0C7A, 0x0009, 0x000A, 0x000B, 0x000C, 0x000B, 0x000C, 0x0C7B,
    0x0C7A, 0x000D, 0x000E, 0x000F, 0x0010, 0x000F, 0x0010, 0x000D, 0x000E, 0x000D, 0x000E, 0x000F, 0x0010, 0x000F, 0x0010, 0x0C7B, 0x0C7A, 0x000D, 0x000E, 0x000F, 0x0010, 0x000F, 0x0010, 0x0C7B,
    0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B, 0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B,
    0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B, 0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B,
    0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B, 0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B,
    0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B, 0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B,
    0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B, 0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B,
    0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B, 0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B,
    0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B, 0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B,
    0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B, 0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B,
    0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B, 0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B,
    0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B, 0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B,
    0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B, 0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B,
    0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B, 0x0C7A, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7F, 0x0C7B,
    0x0C7C, 0x0C7D, 0x0C7D, 0x0C7D, 0x0C7D, 0x0C7D, 0x0C7D, 0x0C7D, 0x0C7D, 0x0C7D, 0x0C7D, 0x0C7D, 0x0C7D, 0x0C7D, 0x0C7D, 0x0C7E, 0x0C7C, 0x0C7D, 0x0C7D, 0x0C7D, 0x0C7D, 0x0C7D, 0x0C7D, 0x0C7E
]);

FF1Battle.prototype.drawBackground = function() {
    
    var bg = this.bg;
    
    // load the text graphics (for the border)
    var gfx = new Uint8Array(0x10000);
    gfx.set(this.rom.textGraphics.data);
    
    // load the battle backgroud graphics
    gfx.set(this.rom.monsterGraphics.item(bg).data.subarray(0, 0x1000));
    
    // set up the tile layout
    var w = 24;
    var h = 18;
//    var layout = new Uint16Array(w * h);
//    for (var i = 0; i < w * h; i++) layout[i] = 0x0C7F;
//    layout[0] = 0x0C77;
//    layout[w-1] = 0x0C79;
//    layout[w*(h-1)] = 0x0C7C;
//    layout[w*h-1] = 0x0C7E;
//    for (var i = 1; i < (w-1); i++) layout[i] = 0x0C78;
//    for (var i = w; i < w*(h-1); i+=w) layout[i] = 0x0C7A;
//    for (var i = w*2-1; i < w*h-1; i+=w) layout[i] = 0x0C7B;
//    for (var i = w*(h-1)+1; i < w*h-1; i++) layout[i] = 0x0C7D;
        
    // load the palette
    var pal = new Uint32Array(16);
    pal.set(this.rom.battleBackgroundPalette.item(bg).data);
    pal[12] = 0xFF000000;
    pal[13] = 0xFF666666;
    pal[14] = 0xFF000000;
    pal[15] = 0xFFEEEEEE;
    
    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = pal;
    this.ppu.height = h * 8;
    this.ppu.width = w * 8;
    this.ppu.back = true;

    // layer 1
    this.ppu.layers[1].format = GFX.TileFormat.snes2bppTile;
    this.ppu.layers[1].cols = w;
    this.ppu.layers[1].rows = h;
    this.ppu.layers[1].z[0] = GFX.Z.snes2L;
    this.ppu.layers[1].z[1] = GFX.Z.snes2H;
    this.ppu.layers[1].gfx = gfx;
    this.ppu.layers[1].tiles = FF1Battle.backgroundLayout;
    this.ppu.layers[1].main = true;

    var context = this.battleCanvas.getContext('2d');
    imageData = context.createImageData(w * 8, h * 8);
    this.ppu.renderPPU(imageData.data, 0, 0, w * 8, h * 8);
    context.putImageData(imageData, 0, 0);
}
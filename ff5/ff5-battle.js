//
// ff5-battle.js
// created 1/14/2019
//

class FF5Battle extends ROMEditor {
    constructor(rom) {
        super(rom);

        this.name = 'FF5Battle';

        this.b = null; // battle index
        this.bg = 0; // battle background index
        this.showMonsters = true;
        this.battleProperties = null;
        this.selectedMonster = null;
        this.monsterPoint = null;
        this.clickPoint = null;
        this.monsterSlots = [];
        this.ppu = new GFX.PPU();

        // off-screen canvas for drawing the battle
        this.battleCanvas = document.createElement('canvas');
        this.battleCanvas.width = 256;
        this.battleCanvas.height = 256;

        // off-screen canvas for drawing individual monsters
        this.monsterCanvas = document.createElement('canvas');

        // on-screen canvas
        this.canvas = document.createElement('canvas');

        this.div.classList.add('battle-edit');
        this.div.appendChild(this.canvas);

        this.battleRect = new Rect(8, 248, this.rom.isSFC ? 1 : 8, this.rom.isSFC ? 160 : 128);
        this.zoom = 1.0;

        this.observer = new ROMObserver(rom, this);

        // add message handlers
        const self = this;
        this.canvas.onmousedown = function(e) { self.mouseDown(e) };
        this.canvas.onmousemove = function(e) { self.mouseMove(e) };
        this.canvas.onmouseup = function(e) { self.mouseUp(e) };
        this.canvas.onmouseleave = function(e) { self.mouseLeave(e) };
        this.resizeSensor = null;
        this.monsterPoint = null;
        this.clickPoint = null;

        this.updateBattleStrings();
    }

    updateBattleStrings() {
        const battlePropertiesArray = this.rom.battleProperties;
        const battleStringTable = this.rom.stringTable.battleProperties;
        for (let b = 0; b < battlePropertiesArray.arrayLength; b++) {
            const battleProperties = battlePropertiesArray.item(b);
            const isBoss = battleProperties.flags.value & 0x20;

            // count up the monsters
            const monsterList = {};
            for (let m = 1; m <= 8; m++) {
                const key = `monster${m}${isBoss ? 'Boss' : ''}`;
                const index = battleProperties[key].value;
                if ((index & 0xFF) === 0xFF) continue;
                const count = monsterList[index];
                monsterList[index] = (count || 0) + 1;
            }

            let battleName = '';
            for (const index in monsterList) {
                const count = monsterList[index];
                if (battleName) battleName += ', ';
                if (this.rom.isGBA) {
                    battleName += `<stringTable.battleMonster[${index}]>`;
                } else {
                    battleName += `<stringTable.monsterName[${index}]>`;
                }
                if (count !== 1) battleName += ` ×${count}`;
            }

            if (!battleName) battleName = 'Battle %i';
            battleStringTable.string[b].value = battleName;
        }
    }

    mouseDown(e) {
        this.closeList();

        const x = Math.floor(e.offsetX / this.zoom) + this.battleRect.l;
        const y = Math.floor(e.offsetY / this.zoom) + this.battleRect.t;
        this.selectedMonster = this.monsterAtPoint(x, y);

        if (this.selectedMonster) {
            this.clickPoint = { x: x, y: y };
            this.monsterPoint = {
                x: this.selectedMonster.position.x.value,
                y: this.selectedMonster.position.y.value
            };
            propertyList.select(this.selectedMonster.properties);
        } else {
            propertyList.select(this.battleProperties);
        }

        this.drawBattle();
    }

    mouseMove(e) {
        if (!this.selectedMonster || !this.clickPoint) return;

        const x = Math.floor(e.offsetX / this.zoom) + this.battleRect.l;
        const y = Math.floor(e.offsetY / this.zoom) + this.battleRect.t;

        const dx = x - this.clickPoint.x;
        const dy = y - this.clickPoint.y;

        const monsterX = this.selectedMonster.position.x.value;
        const monsterY = this.selectedMonster.position.x.value;
        let newX = (this.monsterPoint.x + dx) & ~7;
        let newY = (this.monsterPoint.y + dy) & ~7;
        newX = Math.min(128, Math.max(0, newX));
        newY = Math.min(128, Math.max(0, newY));

        if (newX === monsterX && newY === monsterY) return;

        this.selectedMonster.position.x.value = newX;
        this.selectedMonster.position.y.value = newY;
        this.drawBattle();
    }

    mouseUp(e) {
        if (!this.selectedMonster || !this.monsterPoint) return;

        // get the new monster's position properties
        const newPoint = {
            x: this.selectedMonster.position.x.value,
            y: this.selectedMonster.position.y.value
        };
        const oldPoint = this.monsterPoint;

        this.clickPoint = null;
        this.monsterPoint = null;

        // return if the monster didn't move
        if (oldPoint.x === newPoint.x && oldPoint.y === newPoint.y) return;

        // temporarily move the monster back to its original position
        this.selectedMonster.position.x.value = oldPoint.x;
        this.selectedMonster.position.y.value = oldPoint.y;

        this.beginAction(this.drawBattle);
        this.selectedMonster.position.x.setValue(newPoint.x);
        this.selectedMonster.position.y.setValue(newPoint.y);
        this.endAction(this.drawBattle);
    }

    mouseLeave(e) {
        this.mouseUp(e);
    }

    selectObject(object) {
        this.loadBattle(object.i);
    }

    show() {
        this.showControls();
        this.closeList();

        // notify on resize
        const self = this;
        const editTop = document.getElementById('edit-top');
        if (!this.resizeSensor) {
            this.resizeSensor = new ResizeSensor(editTop, function() {
                self.drawBattle();
            });
        }
    }

    hide() {
        this.battleProperties = null;
        this.observer.stopObservingAll();
        if (this.resizeSensor) {
            const editTop = document.getElementById('edit-top');
            this.resizeSensor.detach(editTop);
            this.resizeSensor = null;
        }
    }

    resetControls() {
        super.resetControls();
        const self = this;

        // add a control to show/hide monsters
        this.addTwoState('showMonsters', function(checked) {
            self.showMonsters = checked;
            self.drawBattle();
        }, 'Monsters', this.showMonsters);

        // add a control to select the battle background
        const bgNames = [];
        const bgStringTable = this.rom.stringTable.battleBackgroundProperties;
        const bgCount = this.rom.battleBackgroundProperties.arrayLength;
        for (var i = 0; i < bgCount; i++) {
            const bgNameString = bgStringTable.string[i];
            if (bgNameString) bgNames.push(bgNameString.fString());
        }
        function onChangeBG(bg) {
            self.bg = bg;
            self.drawBattle();
        };
        function bgSelected(bg) {
            return self.bg === bg;
        }
        this.addList('showBackground', 'Background', bgNames, onChangeBG, bgSelected);
    }

    loadBattle(b) {
        this.resetControls();
        b = Number(b);
        if (isNumber(b)) this.b = b;

        this.observer.stopObservingAll();
        this.battleProperties = this.rom.battleProperties.item(this.b);
        this.monsterPosition = this.rom.monsterPosition.item(this.b);
        this.observer.startObservingSub(this.battleProperties, this.loadBattle);
        this.observer.startObservingSub(this.monsterPosition, this.drawBattle);

        this.selectedMonster = null;
        this.monsterSlots = [];
        for (let m = 1; m <= 8; m++) {
            const monster = this.loadMonster(m);
            if (monster) this.monsterSlots.push(monster);
        }

        this.drawBattle();
    }

    loadMonster(slot) {

        const monster = { slot: slot };

        // get monster index
        const isBoss = this.battleProperties.flags.value & 0x20;
        monster.key = `monster${slot}`;
        if (isBoss) {
            monster.m = this.battleProperties[`${monster.key}Boss`].value;
        } else {
            monster.m = this.battleProperties[monster.key].value;
        }
        if ((monster.m & 0xFF) === 0xFF) return null; // slot is empty

        // get monster properties
        let index;
        if (this.rom.isSFC) {
            index = monster.m;
        } else if (monster.m < 256) {
            // normal monster
            index = monster.m + 224;
        } else if (monster.m < 384) {
            // normal boss
            index = monster.m - 256;
        } else if (monster.m < 416) {
            // gba boss
            index = monster.m - 256;
        } else {
            // cloister of the dead boss
            index = monster.m - 256;
        }
        monster.properties = this.rom.monsterProperties.item(index);
        this.observer.startObservingSub(monster.properties, this.loadBattle);

        // get monster id
        if (isBoss) {
            monster.id = monster.properties.monsterIDBoss.value;
        } else {
            monster.id = monster.properties.monsterID.value;
        }

        monster.p = this.battleProperties[`${monster.key}Palette`].value;
        monster.present = this.battleProperties[`${monster.key}Present`].value;
        monster.position = this.monsterPosition.item(slot - 1);
        this.observer.startObservingSub(monster.position, this.drawBattle);

        if (this.rom.isSFC) {
            monster.gfxProperties = this.rom.monsterGraphicsProperties.item(monster.m);
            this.observer.startObservingSub(monster.gfxProperties, this.loadBattle);

            // load graphics map
            const map = {};
            if (monster.gfxProperties.useLargeMap.value) {
                // large map
                const mapIndex = monster.gfxProperties.largeMap.value;
                const data8 = this.rom.monsterGraphicsMap.large.item(mapIndex).data;
                map.size = 16;
                map.data = new Uint16Array(data8.buffer, data8.byteOffset, data8.byteLength / 2);
            } else {
                // small map
                const mapIndex = monster.gfxProperties.smallMap.value;
                map.size = 8;
                map.data = this.rom.monsterGraphicsMap.small.item(mapIndex).data;
            }

            // set up the tilemap
            const tileCount = map.size * map.size;
            monster.tiles = new Uint16Array(tileCount);
            let row = 0;
            const mask = 1 << (map.size - 1);
            for (let g = 1, t = 0; t < tileCount; t++, row <<= 1) {
                if (t % map.size === 0) row = map.data[t / map.size];
                if (row & mask) monster.tiles[t] = g++;
            }
            monster.map = map;
            monster.w = map.size * 8;
            monster.h = map.size * 8;

            // load the graphics
            const graphicsObject = monster.gfxProperties.graphicsPointer.target;
            const format = monster.gfxProperties.is3bpp.value ? 'snes3bpp' : 'snes4bpp';
            if (graphicsObject.format !== format) {
                graphicsObject.format = format;
                graphicsObject.disassemble(graphicsObject.parent.data);
            }

            // leave the first tile blank
            monster.graphics = new Uint8Array(graphicsObject.data.length + 64);
            monster.graphics.set(graphicsObject.data, 64);
            this.observer.startObserving(graphicsObject, this.loadBattle);

            // load palette
            const paletteObject = monster.gfxProperties.palette.target;
            monster.palette = paletteObject.data;
            this.observer.startObserving(paletteObject, this.loadBattle);

        } else {
            // set up the tilemap
            monster.size = this.rom.monsterSize.item(monster.id);
            this.observer.startObservingSub(monster.size, this.loadBattle);
            monster.w = monster.size.width.value;
            monster.h = monster.size.height.value;
            monster.tiles = new Uint16Array(monster.w * monster.h / 64);
            for (var t = 0; t < monster.tiles.length; t++) monster.tiles[t] = t;

            // load the graphics
            const g = monster.id * 2;
            const graphicsObject = this.rom.monsterGraphics.item(g);
            if (!graphicsObject.format) {
                graphicsObject.format = ['linear4bpp', 'tose-graphics', 'gba-lzss'];
                graphicsObject.disassemble(graphicsObject.parent.data);
            }
            monster.graphics = graphicsObject.data;
            this.observer.startObserving(graphicsObject, this.loadBattle);

            // load palette
            const p = monster.id * 2 + 1;
            const paletteObject = this.rom.monsterGraphics.item(p);
            if (!paletteObject.format) {
                paletteObject.format = ['bgr555', 'tose-palette'];
                paletteObject.disassemble(paletteObject.parent.data);
            }
            monster.palette = paletteObject.data;
            this.observer.startObserving(paletteObject, this.loadBattle);
        }

        return monster;
    }

    rectForMonster(monster) {

        // minimum size is 8x8
        let w = 1;
        let h = 1;
        if (this.rom.isSFC) {
            for (let t = 0; t < monster.tiles.length; t++) {
                if (!monster.tiles[t]) continue;
                w = Math.max(w, (t % monster.map.size) + 1);
                h = Math.max(h, Math.floor(t / monster.map.size) + 1);
            }
            w *= 8;
            h *= 8;
        } else {
            w = Math.max(monster.size.width.value, 8);
            h = Math.max(monster.size.height.value, 8);
        }

        const l = monster.position.x.value;
        const r = l + w;
        const t = monster.position.y.value;
        const b = t + h;
        return new Rect(l, r, t, b);
    }

    monsterAtPoint(x, y) {
        for (const monster of this.monsterSlots) {
            if (this.rectForMonster(monster).containsPoint(x, y)) return monster;
        }
        return null;
    }

    drawBattle() {
        this.drawBackground();

        if (this.showMonsters) {
            // draw monsters in reverse order
            for (const monster of this.monsterSlots.slice().reverse()) {
                this.drawMonster(monster);
            }
        }

        const zx = this.div.clientWidth / this.battleRect.w;
        const zy = this.div.clientHeight / this.battleRect.h;
        this.zoom = Math.max(Math.min(zx, zy, 4.0), 1.0);

        this.canvas.width = this.battleRect.w * this.zoom;
        this.canvas.height = this.battleRect.h * this.zoom;

        const context = this.canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.globalCompositeOperation = 'copy';
        context.drawImage(this.battleCanvas,
            this.battleRect.l, this.battleRect.t, this.battleRect.w, this.battleRect.h,
            0, 0, this.canvas.width, this.canvas.height);
    }

    drawMonster(monster) {

        // load palette
        const palette = new Uint32Array(256);
        if (this.rom.isSFC && this.battleProperties.gfxFlags.value & 4) {
            // use underwater palette
            palette.set(this.rom.monsterPaletteUnderwater.data);
        } else {
            palette.set(monster.palette);
        }

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(palette);
        this.ppu.width = monster.w;
        this.ppu.height = monster.h;

        // layer 1
        this.ppu.layers[0].format = GFX.tileFormat.snesSpriteTile;
        this.ppu.layers[0].cols = monster.w / 8;
        this.ppu.layers[0].rows = monster.h / 8;
        this.ppu.layers[0].z[0] = GFX.Z.snesS0;
        this.ppu.layers[0].z[1] = GFX.Z.snesS1;
        this.ppu.layers[0].z[2] = GFX.Z.snesS2;
        this.ppu.layers[0].z[3] = GFX.Z.snesS3;
        this.ppu.layers[0].gfx = monster.graphics;
        this.ppu.layers[0].tiles = monster.tiles;
        this.ppu.layers[0].main = true;

        // draw the monster
        this.monsterCanvas.width = this.ppu.width;
        this.monsterCanvas.height = this.ppu.height;
        const monsterContext = this.monsterCanvas.getContext('2d');
        const imageData = monsterContext.createImageData(this.ppu.width, this.ppu.height);
        this.ppu.renderPPU(imageData.data);
        monsterContext.putImageData(imageData, 0, 0);

        // make hidden monsters transparent
        if (!monster.present) {
            transparentRect(this.monsterCanvas);
        }

        // tint the selected monster
        if (this.selectedMonster === monster) {
            tintRect(this.monsterCanvas, 'hsla(210, 100%, 50%, 0.5)');
        }

        const rect = this.rectForMonster(monster);
        const context = this.battleCanvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.drawImage(this.monsterCanvas, 0, 0, rect.w, rect.h, rect.l, rect.t, rect.w, rect.h);
    }

    drawBackground() {
        if (this.rom.isGBA) {
            this.drawBackgroundGBA();
            return;
        }

        var bg = this.bg;
        var properties = this.rom.battleBackgroundProperties.item(bg);

        // load graphics
        var gfx = new Uint8Array(0x10000);
        var g = properties.graphics.value;
        var gfxPointer = this.rom.battleBackgroundGraphicsPointer.item(g);
        var gfxObject = gfxPointer.pointer.target;
        var gfxOffset = this.rom.battleBackgroundGraphicsOffset.item(g).offset.value;
        gfx.set(gfxObject.data.subarray(gfxOffset << 6));

        // load layout
        var l = properties.layout.value;
        var layout = this.rom.battleBackgroundLayout.item(l).data;
        var h = properties.hFlip.value;
        var hFlip = new Uint8Array(0x0280);
        if (h !== 0xFF) hFlip = this.rom.battleBackgroundTileFlip.item(h).data;
        var v = properties.vFlip.value;
        var vFlip = new Uint8Array(0x0280);
        if (v !== 0xFF) hFlip = this.rom.battleBackgroundTileFlip.item(v).data;
        var tiles = new Uint32Array(0x0280);
        for (var i = 0; i < layout.length; i++) {
            tiles[i] = layout[i];
            if (hFlip[i]) tiles[i] |= 0x10000000;
            if (vFlip[i]) tiles[i] |= 0x20000000;
        }

        var pal = new Uint32Array(0x80);
        pal[0] = 0xFF000000;
        var p1 = properties.palette1.value;
        var p2 = properties.palette2.value;
        pal.set(this.rom.battleBackgroundPalette.item(p1).data, 0x00);
        pal.set(this.rom.battleBackgroundPalette.item(p2).data, 0x10);

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(pal);
        this.ppu.width = 256;
        this.ppu.height = 160;
        this.ppu.back = true;

        // layer 2
        this.ppu.layers[1].cols = 32;
        this.ppu.layers[1].rows = 20;
        this.ppu.layers[1].z[0] = GFX.Z.snes2L;
        this.ppu.layers[1].z[1] = GFX.Z.snes2H;
        this.ppu.layers[1].gfx = gfx;
        this.ppu.layers[1].tiles = tiles;
        this.ppu.layers[1].main = true;

        var context = this.battleCanvas.getContext('2d');
        const imageData = context.createImageData(256, 160);
        this.ppu.renderPPU(imageData.data, 0, 0, 256, 160);
        context.putImageData(imageData, 0, 0);
    }

    drawBackgroundGBA() {
        const g = this.bg * 3; // graphics index
        const l = this.bg * 3 + 1; // tilemap index
        const p = this.bg * 3 + 2; // palette index

        // load graphics
        const graphics = new Uint8Array(0x10000);
        const graphicsData = this.rom.battleBackgroundGraphics.item(g);
        if (!graphicsData.format) {
            graphicsData.format = ['linear4bpp', 'tose-graphics', 'gba-lzss'];
            graphicsData.disassemble(graphicsData.parent.data);
        }
        graphics.set(graphicsData.data);

        // load tilemap
        const tilemapData = this.rom.battleBackgroundGraphics.item(l);
        if (!tilemapData.format) {
            tilemapData.format = ['gba4bppTile', 'tose-layout'];
            tilemapData.width = 32;
            tilemapData.height = 17;
            tilemapData.disassemble(tilemapData.parent.data);
        }
        const tiles = tilemapData.data;

        // load palette
        const palette = new Uint32Array(0x100);
        const paletteData = this.rom.battleBackgroundGraphics.item(p);
        if (!paletteData.format) {
            paletteData.format = ['bgr555', 'tose-palette'];
            paletteData.disassemble(paletteData.parent.data);
        }
        palette[0] = 0xFF000000;
        palette.set(paletteData.data);

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(palette);
        this.ppu.width = 256;
        this.ppu.height = 136;
        this.ppu.back = true;

        // layer 2
        this.ppu.layers[1].cols = 32;
        this.ppu.layers[1].rows = 17;
        this.ppu.layers[1].z[0] = GFX.Z.snes2L;
        this.ppu.layers[1].z[1] = GFX.Z.snes2H;
        this.ppu.layers[1].gfx = graphics;
        this.ppu.layers[1].tiles = tiles;
        this.ppu.layers[1].main = true;

        const context = this.battleCanvas.getContext('2d');
        const imageData = context.createImageData(256, 136);
        this.ppu.renderPPU(imageData.data, 0, 0, 256, 136);
        context.putImageData(imageData, 0, 0);
    }
}

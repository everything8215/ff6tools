//
// ff4-battle.js
// created 7/7/2018
//

class FF4Battle extends ROMEditor_ {
    constructor(rom) {
        super(rom);

        this.name = 'FF4Battle';
        this.vram = new FF4BattleVRAM(rom, this);

        this.div = document.createElement('div');
        this.div.id = 'map-edit';

        // off-screen canvas for drawing the battle
        this.battleCanvas = document.createElement('canvas');
        this.battleCanvas.width = 256;
        this.battleCanvas.height = 256;
        this.ppu = new GFX.PPU();

        // off-screen canvas for drawing individual monsters
        this.monsterCanvas = document.createElement('canvas');

        // on-screen canvas
        this.canvas = document.createElement('canvas');
        this.div.appendChild(this.canvas);

        this.battleRect = new Rect(8, 249, this.rom.isSFC ? 1 : 8, this.rom.isSFC ? 141 : 120);
        this.zoom = 1.0;

        this.b = null; // battle index
        this.bg = 0; // battle background index
        this.battleProperties = null;
        this.selectedMonster = null;
        this.monsterPoint = null;
        this.clickPoint = null;
        this.monsterSlot = [];

        this.showMonsters = true;
        this.altPalette = false; // use alternate background palette
        this.backAttack = false;
        this.showVRAM = false;

        this.observer = new ROMObserver(rom, this);

        // add message handlers
        const self = this;
        this.canvas.onmousedown = function(e) { self.mouseDown(e); };
        this.canvas.onmousemove = function(e) { self.mouseMove(e); };
        this.canvas.onmouseup = function(e) { self.mouseUp(e); };
        this.canvas.onmouseleave = function(e) { self.mouseLeave(e); };
        this.resizeSensor = null;

        this.updateBattleStrings();
    }

    updateBattleStrings() {

        if (this.rom.isGBA) {
            this.updateBattleStringsGBA();
            return;
        }

        const paletteStringTable = this.rom.stringTable.monsterPalette;
        const graphicsStringTable = this.rom.stringTable.monsterGraphics;
        for (let m = 0; m < this.rom.monsterProperties.arrayLength; m++) {

            const graphicsProperties = this.rom.monsterGraphicsProperties.item(m);

            // skip characters
            if (graphicsProperties.isCharacter.value) continue;

            let p;
            if (graphicsProperties.isBoss.value) {
                const b = graphicsProperties.bossProperties.value;
                const bossProperties = this.rom.monsterBossProperties.item(b);
                p = bossProperties.palette.value;
            } else {
                p = this.rom.monsterGraphicsProperties.item(m).palette.value;
            }
            const paletteString = paletteStringTable.string[p];
            if (!paletteString) {
                paletteStringTable.setString(p, `<stringTable.monsterName[${m}]>`);
            }

            const g = this.rom.monsterGraphicsProperties.item(m).graphicsPointer.value;
            const graphicsString = graphicsStringTable.string[g];
            if (!graphicsString) {
                graphicsStringTable.setString(g, `<stringTable.monsterName[${m}]>`);
            } else {
                // duplicate monsters using the same graphics
                graphicsString.value += `, <stringTable.monsterName[${m}]>`;
            }
        }

        for (let b = 0; b < this.rom.battleProperties.arrayLength; b++) {
            const battleProperties = this.rom.battleProperties.item(b);
            const monster1 = battleProperties.monster1.value;
            const monster2 = battleProperties.monster2.value;
            const monster3 = battleProperties.monster3.value;
            let m1 = battleProperties.monster1Count.value;
            let m2 = battleProperties.monster2Count.value;
            let m3 = battleProperties.monster3Count.value;

            if (monster2 === monster3) { m2 += m3; m3 = 0; }
            if (monster1 === monster2) { m1 += m2; m2 = 0; }
            if (monster1 === monster3) { m1 += m3; m3 = 0; }

            let battleName = '';
            if (m1 !== 0) {
                battleName += `<monsterName[${monster1}]>`;
                if (m1 !== 1) battleName += ` ×${m1}`;
            }
            if (m2 !== 0) {
                if (battleName !== '') battleName += ', ';
                battleName += `<monsterName[${monster2}]>`;
                if (m2 !== 1) battleName += ` ×${m2}`;
            }
            if (m3 !== 0) {
                if (battleName !== '') battleName += ', ';
                battleName += `<monsterName[${monster3}]>`;
                if (m3 !== 1) battleName += ` ×${m3}`;
            }
            this.rom.stringTable.battleProperties.string[b].value = battleName;
        }
    }

    updateBattleStringsGBA() {
        for (let b = 0; b < this.rom.battleMonster.arrayLength; b++) {
            const battleMonster = this.rom.battleMonster.item(b);

            // count up the monsters
            const monsterList = {};
            let index, count;
            for (let m = 0; m < battleMonster.arrayLength; m++) {
                index = battleMonster.item(m).monster.value;
                count = monsterList[index];
                monsterList[index] = (count || 0) + 1;
            }

            let battleName = '';
            for (const key in monsterList) {
                count = monsterList[key];
                if (battleName !== '') battleName += ', ';
                battleName += `<stringTable.monsterName[${key}]>`;
                if (count !== 1) battleName += ` ×${count}`;
            }

            if (battleName === '') battleName = 'Battle %i';
            this.rom.stringTable.battleProperties.string[b].value = battleName;
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
        this.closeList();
        if (!this.selectedMonster || !this.clickPoint) return;

        const x = Math.floor(e.offsetX / this.zoom) + this.battleRect.l;
        const y = Math.floor(e.offsetY / this.zoom) + this.battleRect.t;

        let dx = x - this.clickPoint.x;
        let dy = y - this.clickPoint.y;

        // move backward enemies in the opposite direction
        if (this.backAttack) dx = -dx;

        if (dx < 0) dx += 7;
        if (dy < 0) dy += 7;

        const monsterX = this.selectedMonster.position.x.value;
        const monsterY = this.selectedMonster.position.y.value;
        let newX = (this.monsterPoint.x + dx) & ~7;
        let newY = (this.monsterPoint.y + dy) & ~7;
        if (this.rom.isGBA) {
            newX = Math.min(136, Math.max(8, newX));
            newY = Math.min(144, Math.max(16, newY));
        } else {
            newX = Math.min(144, Math.max(16, newX));
            newY = Math.min(128, Math.max(0, newY));
        }

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

    show() {
        this.showControls();
        this.closeList();

        // notify on resize
        const self = this;
        this.resizeSensor = new ResizeSensor(document.getElementById('edit-top'), function() {
            self.drawBattle();
        });

        // show the VRAM
        if (this.rom.isSFC && this.showVRAM) this.vram.show();
    }

    hide() {
        this.observer.stopObservingAll();
        if (this.resizeSensor) {
            this.resizeSensor.detach(document.getElementById('edit-top'));
            this.resizeSensor = null;
        }
        if (this.rom.isSFC) this.vram.hide()
    }

    selectObject(object) {

        if (this.battleProperties === object) return;

        this.battleProperties = object;
        this.b = object.i;
        this.loadBattle();
        // this.loadBattle(object.i);
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
        const bgCount = this.rom.battleBackgroundGraphics.arrayLength;
        for (let i = 0; i < bgCount; i++) {
            const bgNameString = bgStringTable.string[i];
            if (bgNameString) bgNames.push(bgNameString.fString());
        }
        function onChangeBG(bg) {
            self.bg = bg;
            self.drawBattle();
        }
        function bgSelected(bg) {
            return self.bg === bg;
        }
        this.addList('showBackground', 'Background', bgNames, onChangeBG, bgSelected);

        // add a control to use the alternate battle background palette
        if (this.rom.isSFC) this.addTwoState('useAltPalette', function(checked) {
            self.altPalette = checked;
            self.drawBattle();
        }, 'Alt. Palette', this.altPalette);

        // add a control to show a back attack formation
        this.addTwoState('backAttack', function(checked) {
            self.backAttack = checked;
            self.drawBattle();
        }, 'Back Attack', this.backAttack);

        // add a control to show/hide VRAM
        if (this.rom.isSFC) this.addTwoState('showVRAM', function(checked) {
            self.showVRAM = checked;
            if (self.showVRAM) {
                self.vram.show();
                self.vram.redraw();
            } else {
                self.vram.hide();
            }
        }, 'VRAM', this.showVRAM);
    }

    loadBattle() {
        this.resetControls();
        // b = Number(b);
        // if (isNumber(b) && this.b !== b) {
        //     this.b = b;
        //     this.battleProperties = this.rom.battleProperties.item(this.b);
            this.backAttack = false;
            if (this.rom.isSFC && this.battleProperties.flags1.value & 0x01) {
                this.backAttack = true;
            } else if (this.rom.isGBA && this.battleProperties.flags.value & 0x04) {
                this.backAttack = true;
            }

            if (this.rom.isGBA && this.battleProperties.background.value !== 0) {
                this.bg = this.battleProperties.background.value - 1;
            }
        // }

        this.observer.stopObservingAll();
        this.battleProperties = this.rom.battleProperties.item(this.b);
        this.observer.startObservingSub(this.battleProperties, this.loadBattle);

        this.selectedMonster = null;
        this.monsterSlot = [];
        for (let slot = 1; slot <= 8; slot++) {
            const monster = this.loadMonster(slot);
            if (monster) this.monsterSlot.push(monster);
        }

        // draw vram
        if (this.rom.isSFC) {
            this.vram.loadVRAM();
            this.vram.resize();
            this.vram.redraw();
        }
        this.drawBattle();
    }

    loadMonster(slot) {
        if (this.rom.isGBA) return this.loadMonsterGBA(slot);

        const monster = { slot: slot };

        // get vram slot
        monster.vramSlot = 1;
        const monsterCount = [
            0,
            this.battleProperties.monster1Count.value,
            this.battleProperties.monster2Count.value,
            this.battleProperties.monster3Count.value];

        let i = 0;
        while (i < slot) {
            if (monsterCount[monster.vramSlot]) {
                monsterCount[monster.vramSlot]--;
                i++;
                continue;
            }
            monster.vramSlot++;
            if (monster.vramSlot > 3) return null;
        }

        // get monster index
        monster.key = `monster${monster.vramSlot}`;
        monster.m = this.battleProperties[monster.key].value;
        if (monster.m === 0xFF) return null; // slot is empty
        monster.properties = this.rom.monsterProperties.item(monster.m);

        // determine if monster should be hidden
        monster.hidden = this.typeHidden(slot);

        // get monster graphics properties
        monster.gfxProperties = this.rom.monsterGraphicsProperties.item(monster.m);
        this.observer.startObservingSub(monster.gfxProperties, this.loadBattle);

        if (monster.gfxProperties.isBoss.value) {
            // load boss position and size
            const b = monster.gfxProperties.bossProperties.value;
            monster.bossProperties = this.rom.monsterBossProperties.item(b);
            const s = monster.bossProperties.size.value;
            monster.size = this.rom.monsterSize.item(s);
            monster.position = monster.bossProperties;
            this.observer.startObservingSub(monster.bossProperties, this.loadBattle);

        } else {
            // load monster position and size
            const p = this.battleProperties.monsterPosition.value;
            const s = monster.gfxProperties.size.value;
            monster.size = this.rom.monsterSize.item(s);
            monster.position = this.rom.monsterPosition.item(p).item(slot - 1);
            this.observer.startObservingSub(monster.position, this.drawBattle);
        }
        this.observer.startObservingSub(monster.size, this.loadBattle);

        return monster;
    }

    loadMonsterGBA(slot) {

        const monster = { slot: slot };

        const battleMonsterArray = this.rom.battleMonster.item(this.b);
        if (slot > battleMonsterArray.arrayLength) return null;
        const battleMonster = battleMonsterArray.item(slot - 1);

        monster.m = battleMonster.monster.value;
        monster.vramSlot = battleMonster.monsterType.value;

        monster.size = this.rom.monsterSize.item(monster.m);
        monster.position = battleMonster;

        this.observer.startObservingSub(monster.size, this.loadBattle);
        this.observer.startObservingSub(monster.position, this.loadBattle);

        monster.hidden = false;

        return monster;
    }

    typeHidden(type) {
        const h = this.battleProperties.hiddenMonsters.value;
        if (h === 1 && type === 2) {
            return true;
        } else if (h === 2 && (type === 2 || type === 3)) {
            return true;
        } else if (h === 3 && type === 3) {
            return true;
        }
        return false;
    }

    rectForMonster(monster) {
        if (!monster.size) return Rect.emptyRect;
        const x = monster.position.x.value;
        const y = monster.position.y.value;
        const w = monster.size.width.value;
        const h = monster.size.height.value;

        const rect = new Rect(x, x + w, y, y + h);

        if (this.rom.isSFC && monster.gfxProperties.isCharacter.value) {
            // characters are a fixed size
            rect.w = 16;
            rect.h = 24;
        }

        if (this.backAttack) {
            rect.l = 256 - (x + w);
            rect.r = 256 - x;
        }

        return rect;
    }

    monsterAtPoint(x, y) {
        for (const monster of this.monsterSlot) {
            if (this.rectForMonster(monster).containsPoint(x, y)) {
                return monster;
            }
        }
        return null;
    }

    firstMonsterInVRAMSlot(vramSlot) {
        for (const monster of this.monsterSlot) {
            if (monster.vramSlot === vramSlot) return monster;
        }
        return null;
    }

    drawBattle() {
        if (this.rom.isSFC) this.vram.redraw();

        this.drawBackground();

        if (this.showMonsters) {
            for (const monster of this.monsterSlot) this.drawMonster(monster);
        }

        const zx = this.div.clientWidth / this.battleRect.w;
        const zy = this.div.clientHeight / this.battleRect.h;
        this.zoom = Math.max(Math.min(zx, zy, 4.0), 1.0);

        this.canvas.width = Math.floor(this.battleRect.w * this.zoom);
        this.canvas.height = Math.floor(this.battleRect.h * this.zoom);

        const context = this.canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.webkitImageSmoothingEnabled = false;
        context.globalCompositeOperation = 'copy';
        context.drawImage(this.battleCanvas,
            this.battleRect.l, this.battleRect.t, this.battleRect.w, this.battleRect.h,
            0, 0, this.canvas.width, this.canvas.height);

        if (this.rom.isSFC) this.vram.redraw();
    }

    drawMonster(monster) {
        if (this.rom.isGBA) {
            this.drawMonsterGBA(monster);
            return;
        }

        // get graphics properties
        const gfxProperties = monster.gfxProperties;

        let f1 = this.vram.tileData1[monster.key].value;
        f1 &= 0xE3;
        f1 |= (monster.vramSlot + 2) << 2; // palette
        let f2 = this.vram.tileData2[monster.key].value;
        let tileFlags = (f1 << 8) | f2;

        let w = 1;
        let h = 1;
        let tiles;
        if (gfxProperties.isCharacter.value) {

            if (this.battleProperties.flags2.value & 0x10) {
                // enemy character
                tiles = new Uint16Array([0x4001, 0x4000, 0x4003, 0x4002, 0x4005, 0x4004]);
            } else {
                tiles = new Uint16Array([0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005]);
            }
            for (let t = 0; t < tiles.length; t++) tiles[t] |= tileFlags;
            w = 16; h = 24;

        } else if (gfxProperties.isBoss.value && monster.bossProperties) {
            const bossProperties = monster.bossProperties;
            if (monster.size) {
                w = monster.size.width.value;
                h = monster.size.height.value;
            }
            tiles = new Uint16Array(w * h / 64);
            tiles.fill(0x0200);

            let mapIndex = bossProperties.map.value;
            if (gfxProperties.bossProperties.value === 63) {
                // use zeromus map
                mapIndex = 55;
            }
            const map = this.rom.monsterBossMap.item(mapIndex).data;

            if (bossProperties.tileIndexMSB.value) tileFlags |= 0x0100;
            for (let t = 0, i = 0; i < map.length; i++) {
                const mask = map[i];
                if (mask === 0xFF) {
                    t++; continue;
                } else if (mask === 0xFE) {
                    t += map[++i]; continue;
                }

                tiles[t++] = mask + tileFlags;
            }

        } else {
            if (monster.size) {
                w = monster.size.width.value;
                h = monster.size.height.value;
            }
            tiles = new Uint16Array(w * h / 64);
            for (let t = 0; t < tiles.length; t++) {
                tiles[t] = t + tileFlags;
            }
        }

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(this.vram.ppu.pal);
        this.ppu.width = w;
        this.ppu.height = h;

        // layer 1
        this.ppu.layers[0].cols = w / 8;
        this.ppu.layers[0].rows = h / 8;
        this.ppu.layers[0].z[0] = GFX.Z.snesS0;
        this.ppu.layers[0].z[1] = GFX.Z.snesS1;
        this.ppu.layers[0].z[2] = GFX.Z.snesS2;
        this.ppu.layers[0].z[3] = GFX.Z.snesS3;
        this.ppu.layers[0].gfx = this.vram.ppu.layers[0].gfx;
        this.ppu.layers[0].tiles = GFX.tileFormat.snes4bppTile.decode(tiles)[0];
        this.ppu.layers[0].main = true;

        // draw the monster
        this.monsterCanvas.width = this.ppu.width;
        this.monsterCanvas.height = this.ppu.height;
        const monsterContext = this.monsterCanvas.getContext('2d');
        const imageData = monsterContext.createImageData(this.ppu.width, this.ppu.height);
        this.ppu.renderPPU(imageData.data);
        monsterContext.putImageData(imageData, 0, 0);

        // make hidden monsters transparent
        if (monster.hidden || (this.battleProperties.flags2.value & 0x80)) {
            transparentRect(this.monsterCanvas);
        }

        // tint the selected monster
        if (this.selectedMonster === monster) {
            tintRect(this.monsterCanvas, 'hsla(210, 100%, 50%, 0.5)');
        }

        const rect = this.rectForMonster(monster);

        const context = this.battleCanvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.webkitImageSmoothingEnabled = false;
        context.globalCompositeOperation = 'source-over';
        if (!this.backAttack) {
            context.drawImage(this.monsterCanvas, 0, 0, rect.w, rect.h, rect.l, rect.t, rect.w, rect.h);
        } else {
            // flip monster horizontally
            context.scale(-1, 1);
            context.drawImage(this.monsterCanvas, 0, 0, rect.w, rect.h, -rect.l, rect.t, -rect.w, rect.h);
            context.setTransform(1,0,0,1,0,0);
        }
    }

    drawMonsterGBA(monster) {

        // decode the graphics
        const graphicsData = this.rom.monsterGraphics.item(monster.m * 2 + 1);
        if (!graphicsData.format) {
            if (graphicsData.data[0] === 0x10) {
                graphicsData.format = ['linear4bpp', 'tose-graphics', 'gba-lzss'];
            } else if (graphicsData.data[0] === 0x70) {
                graphicsData.format = ['linear4bpp', 'tose-graphics', 'tose-70'];
            } else {
                graphicsData.format = ['linear4bpp', 'tose-graphics'];
            }
            graphicsData.disassemble(this.rom.monsterGraphics.data);
        }

        const graphics = graphicsData.data;

        // load size
        const w = monster.size.width.value;
        const h = monster.size.height.value;

        const tiles = new Uint16Array(w * h / 64);
        for (let t = 0; t < tiles.length; t++) tiles[t] = t;

        // load palette
        const paletteData = this.rom.monsterGraphics.item(monster.m * 2);
        if (!paletteData.format) {
            paletteData.format = ['bgr555', 'tose-palette'];
            paletteData.disassemble(paletteData.parent.data);
        }
        const pal = paletteData.data;

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(pal);
        this.ppu.width = w;
        this.ppu.height = h;

        // layer 1
        this.ppu.layers[0].cols = w / 8;
        this.ppu.layers[0].rows = h / 8;
        this.ppu.layers[0].z[0] = GFX.Z.snesS0;
        this.ppu.layers[0].z[1] = GFX.Z.snesS1;
        this.ppu.layers[0].z[2] = GFX.Z.snesS2;
        this.ppu.layers[0].z[3] = GFX.Z.snesS3;
        this.ppu.layers[0].gfx = graphics;
        this.ppu.layers[0].tiles = tiles;
        this.ppu.layers[0].main = true;

        // draw the monster
        this.monsterCanvas.width = this.ppu.width;
        this.monsterCanvas.height = this.ppu.height;
        const monsterContext = this.monsterCanvas.getContext('2d');
        const imageData = monsterContext.createImageData(this.ppu.width, this.ppu.height);
        this.ppu.renderPPU(imageData.data);
        monsterContext.putImageData(imageData, 0, 0);

        // tint the selected monster
        if (this.selectedMonster === monster) {
            this.tintMonster();
        }

        const rect = this.rectForMonster(monster);

        const context = this.battleCanvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.webkitImageSmoothingEnabled = false;
        context.globalCompositeOperation = 'source-over';
        if (!this.backAttack) {
            context.drawImage(this.monsterCanvas, 0, 0, rect.w, rect.h, rect.l, rect.t, rect.w, rect.h);
        } else {
            // flip monster horizontally
            context.scale(-1, 1);
            context.drawImage(this.monsterCanvas, 0, 0, rect.w, rect.h, -rect.l, rect.t, -rect.w, rect.h);
            context.setTransform(1,0,0,1,0,0);
        }
    }

    tintMonster() {
        // create an offscreen canvas filled with the color
        const tintCanvas = document.createElement('canvas');
        tintCanvas.width = this.monsterCanvas.width;
        tintCanvas.height = this.monsterCanvas.height;
        const tintContext = tintCanvas.getContext('2d');
        tintContext.fillStyle = 'hsla(210, 100%, 50%, 0.5)';
        tintContext.fillRect(0, 0, this.monsterCanvas.width, this.monsterCanvas.height);

        const monsterContext = this.monsterCanvas.getContext('2d');
        monsterContext.globalCompositeOperation = 'source-atop';
        monsterContext.drawImage(tintCanvas, 0, 0);
    }

    transparentMonster() {
        // create an offscreen canvas filled with the color
        const transparentCanvas = document.createElement('canvas');
        transparentCanvas.width = this.monsterCanvas.width;
        transparentCanvas.height = this.monsterCanvas.height;
        const transparentContext = transparentCanvas.getContext('2d');
        transparentContext.fillStyle = 'rgba(255, 255, 255, 0.5)';
        transparentContext.fillRect(0, 0, this.monsterCanvas.width, this.monsterCanvas.height);

        const monsterContext = this.monsterCanvas.getContext('2d');
        monsterContext.globalCompositeOperation = 'destination-out';
        monsterContext.drawImage(transparentCanvas, 0, 0);
    }

    drawBackground() {

        if (this.rom.isGBA) {
            this.drawBackgroundGBA();
            return;
        }

        // load graphics
        const bg = (this.b === 439) ? 16 : this.bg;
        const gfx = new Uint8Array(0x10000);
        const gfx1 = this.rom.battleBackgroundGraphics.item(bg).data;
        gfx.set(gfx1);
        if (bg !== 16) {
            // this is necessary for the cave background because it shares one tile with the moon background
            const gfx2 = this.rom.battleBackgroundGraphics.item(bg + 1).data;
            gfx.set(gfx2, gfx1.length);
        }

        const bgProperties = this.rom.battleBackgroundProperties.item(bg);

        // load tile properties
        const top = bgProperties.top.value;
        const middle = bgProperties.middle.value;
        const bottom = bgProperties.bottom.value;

        const topTiles = this.rom.battleBackgroundLayoutUpper.item(top);
        const middleTiles = this.rom.battleBackgroundLayoutUpper.item(middle);
        const bottomTiles = this.rom.battleBackgroundLayoutLower.item(bottom);

        const offset = bgProperties.offset.value;
        const bottomData = bottomTiles.data.slice();
        if (offset) {
            // set tile offset (bottom tiles only)
            for (let i = 0; i < bottomData.length; i++) bottomData[i] += offset;
        }

        const tiles = new Uint32Array(0x240);
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

        const pal = new Uint32Array(0x80);
        pal[0] = 0xFF000000;
        let p = bg;
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

        const context = this.battleCanvas.getContext('2d');
        const imageData = context.createImageData(256, 192);
        this.ppu.renderPPU(imageData.data, 0, 0, 256, 192);
        context.putImageData(imageData, 0, 0);
    }

    drawBackgroundGBA() {

        // load graphics
        const gfx = new Uint8Array(0x10000);
        const graphicsData = this.rom.battleBackgroundGraphics.item(this.bg);
        gfx.set(graphicsData.data);

        // load layout
        const tilemap = this.rom.battleBackgroundLayout.item(this.bg);

        // load palette
        const pal = new Uint32Array(0x100);
        const paletteData = this.rom.battleBackgroundPalette.item(this.bg);
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

        const context = this.battleCanvas.getContext('2d');
        const imageData = context.createImageData(256, 128);
        this.ppu.renderPPU(imageData.data, 0, 0, 256, 128);
        context.putImageData(imageData, 0, 0);
    }
}

// from 03/F7BC
FF4Battle.altPalette = [0x16, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x12, 0x14, 0x00, 0x00, 0x13, 0x15, 0x00, 0x00, 0x00, 0x00];

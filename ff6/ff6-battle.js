//
// ff6-battle.js
// created 6/24/2018
//

class FF6Battle extends ROMEditor_ {
    constructor(rom) {
        super(rom);

        this.name = 'FF6Battle';
        this.vram = new FF6BattleVRAM(rom, this);

        this.div.classList.add('battle-edit');

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

        this.battleRect = new Rect(8, 248, rom.isSFC ? 5 : 32, 152);
        this.zoom = 1.0;

        this.b = null; // battle index
        this.bg = 0; // battle background index
        this.battleProperties = null;
        this.selectedMonster = null;
        this.selectedCharacter = null;
        this.monsterPoint = null;
        this.clickPoint = null;
        this.monsterSlot = [];
        this.characterSlot = [];

        this.showMonsters = true;
        this.showVRAM = false;
        this.battleType = FF6Battle.Type.normal;

        this.observer = new ROMObserver(rom, this);

        const self = this;
        this.canvas.onmousedown = function(e) { self.mouseDown(e); };
        this.canvas.onmousemove = function(e) { self.mouseMove(e); };
        this.canvas.onmouseup = function(e) { self.mouseUp(e); };
    //    this.canvas.onmouseenter = function(e) { self.mouseEnter(e) };
        this.canvas.onmouseleave = function(e) { self.mouseLeave(e); };
        this.resizeSensor = null;

        this.updateBattleStrings();
    }

    updateBattleStrings() {
        // set graphics to 3bpp or 4bpp
        if (this.rom.isSFC) {
            for (const gfxProperties of this.rom.monsterGraphicsProperties.iterator()) {

                // decode the graphics
                const graphics = gfxProperties.graphicsPointer.target;
                const format = gfxProperties.is3bpp.value ? 'snes3bpp' : 'snes4bpp';
                if (graphics.format !== format) {
                    graphics.format = format;
                    graphics.disassemble(graphics.parent.data);
                }
            }
        }

        const battleStringTable = this.rom.stringTable.battleProperties;
        for (const battleProperties of this.rom.battleProperties.iterator()) {

            // count up the monsters
            const monsterList = {};
            for (let slot = 1; slot <= 6; slot++) {
                const index = battleProperties[`monster${slot}`].value;
                if (index === 0x01FF) continue;
                const count = monsterList[index];
                monsterList[index] = (count || 0) + 1;
            }

            let battleName = '';
            for (const index in monsterList) {
                const count = monsterList[index];
                if (battleName) battleName += ', ';
                battleName += `<stringTable.monsterName[${index}]>`;
                if (count !== 1) battleName += ` ×${count}`;
            }

            if (!battleName) battleName = 'Battle %i';
            const b = battleProperties.i;
            battleStringTable.string[b].value = battleName;
        }
    }

    mouseDown(e) {

        e.preventDefault();
        this.closeList();

        const x = Math.floor(e.offsetX / this.zoom) + this.battleRect.l;
        const y = Math.floor(e.offsetY / this.zoom) + this.battleRect.t;
        this.selectedMonster = this.monsterAtPoint(x, y);
        this.selectedCharacter = this.characterAtPoint(x, y);

        if (this.selectedMonster) {
            this.selectedCharacter = null;
            this.clickPoint = { x: x, y: y };
            this.monsterPoint = {
                x: this.selectedMonster.x.value,
                y: this.selectedMonster.y.value
            };
            propertyList.select(this.selectedMonster.properties);
        } else if (this.selectedCharacter) {
            this.clickPoint = { x: x, y: y };
            this.characterPoint = {
                x: this.selectedCharacter.x.value,
                y: this.selectedCharacter.y.value
            };
            propertyList.select(this.selectedCharacter.properties);
        } else {
            propertyList.select(this.battleProperties);
        }

        this.drawBattle();
    }

    mouseMove(e) {
        if (!this.clickPoint) return;
        e.preventDefault();

        const x = Math.floor(e.offsetX / this.zoom) + this.battleRect.l;
        const y = Math.floor(e.offsetY / this.zoom) + this.battleRect.t;

        let dx = x - this.clickPoint.x;
        let dy = y - this.clickPoint.y;

        if (this.selectedMonster) {
            const m = this.selectedMonster;

            // move backward enemies in the opposite direction
            if (m.hFlip && this.battleType !== FF6Battle.Type.side) dx = -dx;

            if (dx < 0) dx += 7;
            if (dy < 0) dy += 7;

            let newX = (this.monsterPoint.x + dx) & ~7;
            let newY = (this.monsterPoint.y + dy) & ~7;

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

            m.x.value = newX;
            m.y.value = newY;
            this.drawBattle();

        } else if (this.selectedCharacter) {
            const c = this.selectedCharacter;

            let newX = (this.characterPoint.x + dx) & ~1;
            let newY = (this.characterPoint.y + dy) & ~1;
            newX = Math.max(this.battleRect.l, Math.min(newX, this.battleRect.r - 16));
            newY = Math.max(this.battleRect.t, Math.min(newY, this.battleRect.b - 24));
            if (newX === c.x.value && newY === c.y.value) return;

            c.x.value = newX;
            c.y.value = newY;
            this.drawBattle();
        }
    }

    mouseUp(e) {
        e.preventDefault();

        if (this.selectedMonster && this.monsterPoint) {

            const newPoint = {
                x: this.selectedMonster.x.value,
                y: this.selectedMonster.y.value
            };
            const oldPoint = this.monsterPoint;

            this.clickPoint = null;
            this.monsterPoint = null;

            // return if the monster didn't move
            if (oldPoint.x === newPoint.x && oldPoint.y === newPoint.y) return;

            // temporarily move the monster back to its original position
            this.selectedMonster.x.value = oldPoint.x;
            this.selectedMonster.y.value = oldPoint.y;

            this.beginAction(this.drawBattle);
            this.selectedMonster.x.setValue(newPoint.x);
            this.selectedMonster.y.setValue(newPoint.y);
            this.endAction(this.drawBattle);

        } else if (this.selectedCharacter && this.characterPoint) {

            const newPoint = {
                x: this.selectedCharacter.x.value,
                y: this.selectedCharacter.y.value
            };
            const oldPoint = this.characterPoint;

            this.clickPoint = null;
            this.characterPoint = null;

            // return if the character didn't move
            if (oldPoint.x === newPoint.x && oldPoint.y === newPoint.y) return;

            // temporarily move the character back to its original position
            this.selectedCharacter.x.value = oldPoint.x;
            this.selectedCharacter.y.value = oldPoint.y;

            this.beginAction(this.drawBattle);
            this.selectedCharacter.x.setValue(newPoint.x);
            this.selectedCharacter.y.setValue(newPoint.y);
            this.endAction(this.drawBattle);
        }
    }

    mouseLeave(e) {
        this.mouseUp(e);
    }

    show() {
        this.showControls();
        this.closeList();

        // show the VRAM
        if (this.rom.isSFC && this.showVRAM) this.vram.show();

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
        this.observer.stopObservingAll();
        if (this.resizeSensor) {
            const editTop = document.getElementById('edit-top');
            this.resizeSensor.detach(editTop);
            this.resizeSensor = null;
        }
        this.vram.hide();
    }

    selectObject(object) {

        if (this.battleProperties === object) return;

        this.selectedCharacter = null;
        this.selectedMonster = null;
        this.battleProperties = object;
        this.b = object.i;
        this.loadBattle();
    }

    resetControls() {
        super.resetControls();
        const self = this;

        // add a control to show/hide VRAM
        this.addTwoState('showMonsters', function(checked) {
            self.showMonsters = checked;
            self.drawBattle();
        }, 'Monsters', this.showMonsters);

        // add a control to select the battle background
        const bgNames = [];
        const bgStringTable = this.rom.stringTable.battleBackground;
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

        // add a control to show different battle types
        function onChangeType(type) {
            switch (type) {
                case 0: self.battleType = FF6Battle.Type.normal; break;
                case 1: self.battleType = FF6Battle.Type.back; break;
                case 2: self.battleType = FF6Battle.Type.pincer; break;
                case 3: self.battleType = FF6Battle.Type.side; break;
            }
            self.drawBattle();
        }
        function typeSelected(type) {
            switch (type) {
                case 0: return self.battleType === FF6Battle.Type.normal;
                case 1: return self.battleType === FF6Battle.Type.back;
                case 2: return self.battleType === FF6Battle.Type.pincer;
                case 3: return self.battleType === FF6Battle.Type.side;
            }
        }
        const typeNames = ['Normal', 'Back', 'Pincer', 'Side'];
        this.addList('battleType', 'Type', typeNames, onChangeType, typeSelected);

        // add a control to show/hide VRAM
        this.addTwoState('showVRAM', function(checked) {
            self.showVRAM = checked;
            if (self.showVRAM) {
                self.vram.show();
                self.vram.redraw();
            } else {
                self.vram.hide();
            }
        }, 'VRAM', self.showVRAM);
    }

    loadBattle() {

        this.resetControls();

        this.observer.stopObservingAll();
        this.observer.startObserving([
            this.battleProperties.vramMap,
            this.battleProperties.characterAI,
            this.battleProperties.enableCharacterAI,
            this.battleProperties.flags
        ], this.loadBattle);

        // load monsters
        this.monsterSlot = [];
        for (let slot = 1; slot <= 6; slot++) {
            const monster = this.loadMonster(slot);
            if (monster) this.monsterSlot.push(monster);
        }

        // load characters
        this.characterSlot = [];
        for (let slot = 1; slot <= 4; slot++) {
            const character = this.loadCharacter(slot);
            if (character) this.characterSlot.push(character);
        }

        // draw vram
        if (this.rom.isSFC) {
            this.vram.resize();
            this.vram.redraw();
        }
        this.drawBattle();
    }

    loadMonster(slot) {
        const monsterIndex = this.battleProperties[`monster${slot}`];
        this.observer.startObserving(monsterIndex, this.loadBattle);
        const m = monsterIndex.value;
        if (m === 0x01FF) return null; // slot is empty

        const monster = { slot: slot };
        monster.m = m;
        monster.present = this.battleProperties[`monster${slot}Present`];
        monster.properties = this.rom.monsterProperties.item(monster.m);
        monster.vOffset = monster.properties.verticalOffset;
        monster.x = this.battleProperties[`monster${slot}X`];
        monster.y = this.battleProperties[`monster${slot}Y`];

        this.observer.startObserving([
            monster.index,
            monster.present,
            monster.vOffset,
            monster.x,
            monster.y
        ], this.drawBattle);

        // graphics index
        monster.g = monster.m;
        if (this.rom.isGBA && monster.g >= 384) monster.g += 36;

        monster.gfxProperties = this.rom.monsterGraphicsProperties.item(monster.g);
        this.observer.startObservingSub(monster.gfxProperties, this.drawBattle);

        return monster;
    }

    updateMonsterRect(monster) {

        let w = 1;
        let h = 1;
        monster.size = 8;

        if (monster.m === 262) {
            // ghost train
            w = 16;
            h = 16;
            monster.size = 16;

        } else {
            // load graphics map and set up tile data
            const largeMap = monster.gfxProperties.useLargeMap.value;
            let mapObject = null;
            if (this.rom.isGBA) {
                mapObject = monster.gfxProperties.mapPointer.target;
            } else if (largeMap) {
                const mapIndex = monster.gfxProperties.largeMap.value;
                mapObject = this.rom.monsterGraphicsMap.large.item(mapIndex);
            } else {
                const mapIndex = monster.gfxProperties.smallMap.value;
                mapObject = this.rom.monsterGraphicsMap.small.item(mapIndex);
            }

            let map = null;
            if (!mapObject) {
                monster.size = 1;
                map = [0];
            } else if (largeMap) {
                monster.size = 16;
                map = new Uint16Array(mapObject.data.buffer);
            } else {
                map = mapObject.data
            }
            if (!map) return;

            // load the tile map
            const tileCount = monster.size * monster.size;
            monster.tiles = new Uint32Array(tileCount);

            const mask = 1 << (monster.size - 1);
            for (let row = 0, g = 1, t = 0; t < tileCount; t++, row <<= 1) {
                if (t % monster.size === 0) {
                    row = map[t / monster.size];
                }
                if (row & mask) monster.tiles[t] = g++;
            }

            // determine the monster width and height
            for (let t = 0; t < monster.tiles.length; t++) {
                if (!monster.tiles[t]) continue;
                w = Math.max(w, (t % monster.size) + 1);
                h = Math.max(h, Math.floor(t / monster.size) + 1);
            }
        }

        w *= 8; h *= 8;

        // determine if the monster will fit in its vram slot
        const vramRect = this.vram.rectForSlot(monster.slot);
        monster.oversize = false;
        if (w > vramRect.w) {
            monster.oversize = true;
            w = vramRect.w || w;
        }
        if (h > vramRect.h) {
            monster.oversize = true;
            h = vramRect.h || h;
        }

        // get position, modify based on battle type
        let x = monster.x.value;
        let y = monster.y.value + 1;

        // see C1/1481
        monster.hFlip = false;
        switch (this.battleType) {
            case FF6Battle.Type.normal:
                break;
            case FF6Battle.Type.back:
                x = 256 - (x + w);
                monster.hFlip = true;
                break;
            case FF6Battle.Type.pincer:
                if ((x + w) < 0x68) break;
                x = 256 - (x + w - 0x40);
                monster.hFlip = true;
                break;
            case FF6Battle.Type.side:
                x += 0x30;
                if (x < 0x80) monster.hFlip = true;
                break;
        }
        monster.rect = new Rect(x, x + w, y, y + h);
    }

    monsterAtPoint(x, y) {
        for (const monster of this.monsterSlot) {
            // const rect = this.rectForMonster(monster);
            if (monster.rect.containsPoint(x, y)) return monster;
        }
        return null;
    }

    monsterInSlot(slot) {
        for (const monster of this.monsterSlot) {
            if (monster.slot === slot) return monster;
        }
        return null;
    }

    loadCharacter(slot) {
        if (!this.battleProperties.enableCharacterAI.value) return null;
        const ai = this.battleProperties.characterAI.value;
        const characterAI = this.rom.characterAI.item(ai);
        if (!characterAI) return null;

        const aiSlot = characterAI.slot.item(slot - 1);

        // reload battle if character slot becomes active or inactive
        this.observer.startObserving(aiSlot.character, this.loadBattle);

        const character = { slot: slot };

        // return if no character ai
        if (aiSlot.character.getSpecialValue() === 0xFF) return null;

        character.properties = aiSlot;
        character.x = aiSlot.x;
        character.y = aiSlot.y;
        character.c = aiSlot.character.c;
        character.g = aiSlot.graphics;
        character.flags = aiSlot.character.flags;

        this.observer.startObserving([
            character.x,
            character.y,
            character.g,
            character.c,
            character.flags
        ], this.drawBattle);

        return character;
    }

    updateCharacterRect(character) {
        const x = Math.min(character.x.value, this.battleRect.r - 16);
        const y = Math.min(character.y.value, this.battleRect.b - 24);
        character.rect = new Rect(x, x + 16, y, y + 24);
    }

    characterAtPoint(x, y) {
        for (const character of this.characterSlot) {
            // const rect = this.rectForCharacter(character);
            if (character.rect.containsPoint(x, y)) return character;
        }
        return null;
    }

    drawBattle() {

        // clear the vram canvas and draw the battle background
        this.vram.vramCanvas.height = 128;
        this.vram.vramCanvas.width = 128;

        this.drawBackground();

        // update monster and character rects
        for (const monster of this.monsterSlot) {
            this.updateMonsterRect(monster);
        }
        for (const character of this.characterSlot) {
            this.updateCharacterRect(character);
        }

        // sort monsters and characters by priority
        this.monsterSlot.sort(function(a, b) {
            const dy = (b.rect.b + b.vOffset.value) - (a.rect.b + a.vOffset.value);
            return dy || (a.slot - b.slot);
        });
        this.characterSlot.sort(function(a, b) {
            const dy = b.rect.b - a.rect.b;
            return dy || (a.slot - b.slot);
        });

        if (this.showMonsters) {
            // draw in reverse order (lowest to highest priority)
            for (const monster of this.monsterSlot.slice().reverse()) {
                this.drawMonster(monster);
            }
            for (const character of this.characterSlot.slice().reverse()) {
                this.drawCharacter(character);
            }
        }

        const zx = this.div.clientWidth / this.battleRect.w;
        const zy = this.div.clientHeight / this.battleRect.h;
        this.zoom = Math.max(Math.min(zx, zy, 4.0), 1.0);

        this.canvas.width = Math.floor(this.battleRect.w * this.zoom);
        this.canvas.height = Math.floor(this.battleRect.h * this.zoom);

        const context = this.canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.globalCompositeOperation = 'copy';
        context.drawImage(this.battleCanvas,
            this.battleRect.l, this.battleRect.t, this.battleRect.w, this.battleRect.h,
            0, 0, this.canvas.width, this.canvas.height);

        this.vram.redraw();
    }

    drawMonster(monster) {

        // get position and size
        let x = monster.x.value;
        let y = monster.y.value;
        let graphics = null;
        let palette = null;

        if (monster.m === 262) {
            // ghost train

            // load battle background properties
            const properties = this.rom.battleBackgroundProperties.item(50);
            this.observer.startObservingSub(properties, this.drawBattle);
            const g1 = properties.graphics1;
            const g2 = properties.graphics2.value;
            const g3 = properties.graphics3.value;

            // load graphics
            graphics = new Uint8Array(0x10000);
            if (g1.getSpecialValue() !== 0xFF) {
                const graphics1 = this.loadBattleBackgroundGraphics(g1.g.value, g1.double.value);
                graphics.set(graphics1, this.rom.isSFC ? 0x0000 : 0x4000);
            }
            if (g3 !== 0xFF) {
                const graphics3 = this.loadBattleBackgroundGraphics(g3, false);
                graphics.set(graphics3, this.rom.isSFC ? 0x6000 : 0x2000);
            }

            // load tilemap
            const l = properties.layout1.value;
            const layout = this.rom.battleBackgroundLayout.item(l);
            this.observer.startObserving(layout, this.drawBattle);
            monster.tiles = layout.data.slice();
            for (let i = 0; i < monster.tiles.length; i++) {
                monster.tiles[i] &= 0xFFFF01FF;
            }

            // load palette
            const paletteObject = monster.gfxProperties.palette.target;
            this.observer.startObserving(paletteObject, this.drawBattle);
            palette = new Uint32Array(0x80);
            palette.set(paletteObject.data, 0x60);

        } else {
            // load the graphics, leave the first tile blank
            const graphicsObject = monster.gfxProperties.graphicsPointer.target;
            if (this.rom.isSFC) {
                const format = monster.gfxProperties.is3bpp.value ? 'snes3bpp' : 'snes4bpp';
                if (graphicsObject.format !== format) {
                    graphicsObject.format = format;
                    graphicsObject.disassemble(graphicsObject.parent.data);
                }
            }
            this.observer.startObserving(graphicsObject, this.drawBattle);
            graphics = new Uint8Array(graphicsObject.data.length + 64);
            graphics.set(graphicsObject.data, 64);

            // load the palette
            const paletteObject = monster.gfxProperties.palette.target;
            this.observer.startObserving(paletteObject, this.drawBattle);
            palette = new Uint32Array(16);
            palette.set(paletteObject.data);
        }

        // set up the ppu
        const ppu = new GFX.PPU();
        ppu.pal = this.rom.gammaCorrectedPalette(palette);
        ppu.width = monster.size * 8;
        ppu.height = monster.size * 8;

        // layer 1
        ppu.layers[0].cols = monster.size;
        ppu.layers[0].rows = monster.size;
        ppu.layers[0].z[0] = GFX.Z.snesS0;
        ppu.layers[0].z[1] = GFX.Z.snesS1;
        ppu.layers[0].z[2] = GFX.Z.snesS2;
        ppu.layers[0].z[3] = GFX.Z.snesS3;
        ppu.layers[0].gfx = graphics;
        ppu.layers[0].tiles = monster.tiles;
        ppu.layers[0].main = true;

        // draw the monster
        this.monsterCanvas.width = ppu.width;
        this.monsterCanvas.height = ppu.height;
        const monsterContext = this.monsterCanvas.getContext('2d');
        const imageData = monsterContext.createImageData(ppu.width, ppu.height);
        ppu.renderPPU(imageData.data);
        monsterContext.putImageData(imageData, 0, 0);

        // make monster transparent if it is not present
        if (!monster.present.value) {
            transparentRect(this.monsterCanvas);
        }

        // tint the selected monster
        if (this.selectedMonster === monster) {
            tintRect(this.monsterCanvas, 'hsla(210, 100%, 50%, 0.5)');
        }

        // tint oversize monsters red
        if (monster.oversize) {
            tintRect(this.monsterCanvas, 'rgba(200, 0, 0, 0.5)');
        }

        // draw the monster on the battle canvas
        const rect = monster.rect;
        const context = this.battleCanvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        if (!monster.hFlip) {
            context.drawImage(this.monsterCanvas,
                0, 0, rect.w, rect.h,
                rect.l, rect.t, rect.w, rect.h
            );
        } else {
            // flip monster horizontally
            context.scale(-1, 1);
            context.drawImage(this.monsterCanvas, 0, 0,
                rect.w, rect.h, -rect.l, rect.t,
                -rect.w, rect.h
            );
            context.setTransform(1,0,0,1,0,0);
        }

        // draw the monster on the vram canvas
        const vramRect = this.vram.rectForSlot(monster.slot);
        if (!vramRect.isEmpty()) {
            const vramContext = this.vram.vramCanvas.getContext('2d');
            vramContext.imageSmoothingEnabled = false;
            vramContext.drawImage(this.monsterCanvas,
                0, 0, rect.w, rect.h,
                vramRect.l, vramRect.t, rect.w, rect.h
            );
        }
    }

    drawCharacter(character) {

        // use character graphics by default
        let g = character.g.value;
        if (g === 0xFF) g = character.c.value;
        if (g > 23) return;

        // load palette
        const p = FF6Battle.characterPaletteIndex[g];
        const palette = this.rom.battleCharacterPalette.item(p);
        this.observer.startObserving(palette, this.drawBattle);

        // load graphics
        if (g === 23) g = 14; // green soldier
        const graphics = this.rom.mapSpriteGraphics.item(g);
        this.observer.startObserving(graphics, this.drawBattle);

        const tiles = new Uint32Array(6);
        if (character.flags.value & 1) {
            // enemy character (face right)
            tiles.set([
                0x1000001F, 0x1000001E,
                0x10000029, 0x10000028,
                0x1000002B, 0x1000002A
            ]);
        } else {
            // friendly character (face left)
            tiles.set([
                0x0000001E, 0x0000001F,
                0x00000028, 0x00000029,
                0x0000002A, 0x0000002B
            ]);
        }

        // set up the ppu
        const ppu = new GFX.PPU();
        ppu.pal = this.rom.gammaCorrectedPalette(palette.data);
        ppu.width = 16;
        ppu.height = 24;

        // layer 1
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
        const monsterContext = this.monsterCanvas.getContext('2d');
        const imageData = monsterContext.createImageData(ppu.width, ppu.height);
        ppu.renderPPU(imageData.data);
        monsterContext.putImageData(imageData, 0, 0);

        // make character transparent if it is not present
        if (character.flags.value & 2) {
            transparentRect(this.monsterCanvas);
        }

        // tint the selected character
        if (this.selectedCharacter === character) {
            tintRect(this.monsterCanvas, 'hsla(210, 100%, 50%, 0.5)');
        }

        // draw the character on the vram canvas
        const rect = character.rect;
        const context = this.battleCanvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.drawImage(this.monsterCanvas,
            0, 0, rect.w, rect.h,
            rect.l, rect.t, rect.w, rect.h
        );
    }

    drawBackground() {

        const properties = this.rom.battleBackgroundProperties.item(this.bg);
        this.observer.startObservingSub(properties, this.drawBattle);

        // load graphics
        const g1 = properties.graphics1;
        const g2 = properties.graphics2.value;
        const g3 = properties.graphics3.value;
        const graphics = new Uint8Array(0x10000);
        if (g1.getSpecialValue() !== 0xFF) {
            const graphics1 = this.loadBattleBackgroundGraphics(g1.g.value, g1.double.value);
            graphics.set(graphics1, this.rom.isSFC ? 0x0000 : 0x4000);
        }
        if (g2 !== 0xFF) {
            const graphics2 = this.loadBattleBackgroundGraphics(g2, false);
            graphics.set(graphics2, this.rom.isSFC ? 0x2000 : 0x6000);
        }
        if (g3 !== 0xFF) {
            const graphics3 = this.loadBattleBackgroundGraphics(g3, false);
            graphics.set(graphics3, this.rom.isSFC ? 0xE000 : 0x2000);
        }

        const l = properties.layout1.value;
        const layout = this.rom.battleBackgroundLayout.item(l);
        this.observer.startObserving(layout, this.drawBattle);

        const p = properties.palette.value;
        const paletteObject = this.rom.battleBackgroundPalette.item(p);
        this.observer.startObserving(paletteObject, this.drawBattle);
        const palette = new Uint32Array(0x80);
        palette[0] = 0xFF000000;
        palette.set(paletteObject.data, 0x50);

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(palette);
        this.ppu.height = 256;
        this.ppu.width = 256;
        this.ppu.back = true;

        // layer 2
        this.ppu.layers[1].cols = 32;
        this.ppu.layers[1].rows = 32;
        this.ppu.layers[1].z[0] = GFX.Z.snes2L;
        this.ppu.layers[1].z[1] = GFX.Z.snes2H;
        this.ppu.layers[1].gfx = graphics;
        this.ppu.layers[1].tiles = layout.data;
        this.ppu.layers[1].main = true;

        const context = this.battleCanvas.getContext('2d');
        const imageData = context.createImageData(256, 256);
        this.ppu.renderPPU(imageData.data, 0, 0, 256, 256);
        context.putImageData(imageData, 0, 0);
    }

    loadBattleBackgroundGraphics(i, double) {
        if (i === 0xFF) return new Uint8Array(0); // no graphics

        const bgGraphics = this.rom.battleBackgroundGraphics;
        const pointer = bgGraphics.createPointer(i);

        if (this.rom.isSFC) {
            // normal battle bg graphics
            if (bgGraphics.range.contains(this.rom.mapAddress(pointer.value))) {
                const graphics = bgGraphics.item(i);
                this.observer.startObserving(graphics, this.drawBattle);
                return graphics.data;
            }

            // use map graphics (absolute pointer)
            const begin = this.rom.mapAddress(pointer.value);
            const end = begin + (double ? 0x2000 : 0x1000);
            const decode = GFX.graphicsFormat.snes4bpp.decode;
            return decode(this.rom.data.subarray(begin, end))[0];
        } else {
            // normal battle bg graphics
            if ((pointer.value & 0x800000) === 0) {
                const graphics = bgGraphics.item(i);
                this.observer.startObserving(graphics, this.drawBattle);
                return graphics.data;
            }

            // use map graphics (absolute pointer)
            const offset = Number(this.rom.mapGraphics.pointerOffset);
            pointer.options.offset = this.rom.mapAddress(offset);
            const begin = pointer.value & 0x7FFFFF;
            const end = begin + (double ? 0x2000 : 0x1000);
            const decode = GFX.graphicsFormat.linear4bpp.decode;
            return decode(this.rom.data.subarray(begin, end))[0];
        }
    }
}

FF6Battle.Type = {
    normal: 'normal',
    back: 'back',
    pincer: 'pincer',
    side: 'side'
}

// from C2/CE2B
FF6Battle.characterPaletteIndex = [
    2, 1, 4, 4, 0, 0, 0, 3, 3, 4, 5, 3, 3, 5, 1, 0,
    0, 3, 6, 1, 0, 3, 3, 0
]

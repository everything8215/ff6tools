//
// ff1-battle.js
// created 11/10/2018
//

class FF1Battle extends ROMEditor {
    constructor(rom) {
        super(rom);

        this.name = 'FF1Battle';

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

        this.battleRect = new Rect(0, 192, 0, 144);
        this.zoom = 1.0;

        this.b = null; // battle index
        this.bg = 0; // battle background index
        this.ab = 0; // battle A/B
        this.minMax = 2; // min/max number of monsters
        this.battleProperties = null;
        this.selectedMonster = null;
        this.showMonsters = true;
        this.showCharacters = true;
        this.monsterSlot = [];

        this.observer = new ROMObserver(rom, this);

        const self = this;
        this.canvas.onmousedown = function(e) { self.mouseDown(e); };

        this.updateBattleStrings();
    }

    updateBattleStrings() {
        for (let b = 0; b < this.rom.battleProperties.arrayLength; b++) {
            const battleProperties = this.rom.battleProperties.item(b);
            const monster1 = battleProperties.monster1.value;
            const monster2 = battleProperties.monster2.value;
            const monster3 = battleProperties.monster3.value;
            const monster4 = battleProperties.monster4.value;
            let m1 = battleProperties.monster1Max.value
            let m2 = battleProperties.monster2Max.value
            let m3 = battleProperties.monster3Max.value
            let m4 = battleProperties.monster4Max.value
            let m1b = battleProperties.monster1MaxB.value
            let m2b = battleProperties.monster2MaxB.value

            if (monster3 === monster4) { m3 += m4; m4 = 0; }
            if (monster2 === monster4) { m2 += m4; m4 = 0; }
            if (monster1 === monster4) { m1 += m4; m4 = 0; }
            if (monster2 === monster3) { m2 += m3; m3 = 0; }
            if (monster1 === monster2) { m1 += m2; m2 = 0; m1b += m2b; m2b = 0; }
            if (monster1 === monster3) { m1 += m3; m3 = 0; }

            let battleName = '';
            if (m1) {
                battleName += `<monsterName[${monster1}]>`;
            }
            if (m2) {
                if (battleName) battleName += ', ';
                battleName += `<monsterName[${monster2}]>`;
            }
            if (m3) {
                if (battleName) battleName += ', ';
                battleName += `<monsterName[${monster3}]>`;
            }
            if (m4) {
                if (battleName) battleName += ', ';
                battleName += `<monsterName[${monster4}]>`;
            }

            if (m1b + m2b) {
                let battleNameB = '';

                if (m1b) {
                    battleNameB += `<monsterName[${monster1}]>`;
                }
                if (m2b) {
                    if (battleNameB) battleNameB += ', ';
                    battleNameB += `<monsterName[${monster2}]>`;
                }

                if (battleNameB != battleName) battleName += ` / ${battleNameB}`;
            }
            this.rom.stringTable.battleProperties.string[b].value = battleName;
        }
    }

    mouseDown(e) {
        this.closeList();
        const x = Math.floor(e.offsetX / this.zoom) + this.battleRect.l;
        const y = Math.floor(e.offsetY / this.zoom) + this.battleRect.t;
        this.selectedMonster = this.monsterAtPoint(x, y);

        if (this.selectedMonster) {
            propertyList.select(this.rom.monsterProperties.item(this.selectedMonster.monster));
        } else {
            propertyList.select(this.battleProperties);
        }

        this.redraw();
    }

    show() {
        this.showControls();
        this.closeList();
        this.resize();
        super.show();
    }

    hide() {
        super.hide();
        this.battleProperties = null;
    }

    selectObject(object) {
        if (this.battleProperties === object) return;

        this.selectedMonster = null;
        this.battleProperties = object;
        this.b = object.i;
        this.loadBattle();
    }

    resetControls() {
        super.resetControls();
        const self = this;

        // add a control to show/hide monsters
        this.addTwoState('showMonsters', function(checked) {
            self.showMonsters = checked;
            self.loadBattle();
        }, 'Monsters', this.showMonsters);

        // add a control to show/hide characters
        this.addTwoState('showCharacters', function(checked) {
            self.showCharacters = checked;
            self.loadBattle();
        }, 'Characters', this.showCharacters);

        // add a control to change the battle background
        const bgNames = [];
        for (const bgNameString of this.rom.stringTable.battleBackground.string) {
            bgNames.push(bgNameString.fString());
        }
        this.addList('showBackground', 'Background', bgNames, function(bg) {
            self.bg = bg;
            self.loadBattle();
        }, function(bg) {
            return self.bg === bg;
        });

        // add a control to switch between battle A and B
        this.addList('showBattleAB', 'Battle A/B', [
            'Battle A',
            'Battle B'
        ], function(ab) {
            self.ab = ab;
            self.loadBattle();
        }, function(ab) {
            return self.ab === ab;
        });

        // add a control to show min/max/ave number of monsters
        this.addList('showBattleMinMax', 'Min/Max', [
            'Minimum',
            'Maximum',
            'Average'
        ], function(minMax) {
            self.minMax = minMax;
            self.loadBattle();
        }, function(minMax) {
            return self.minMax === minMax;
        });
    }

    loadBattle() {
        this.resetControls();
        this.observer.stopObservingAll();
        this.observer.startObservingSub(this.battleProperties, this.loadBattle);

        // load monsters
        this.monsterSlot = [];
        for (let slot = 1; slot <= 9; slot++) {
            const monster = this.monsterInSlot(slot);
            if (monster) this.monsterSlot.push(monster);
        }

        this.redraw();
    }

    monsterInSlot(slot) {

        const monsterCount = [0, 0, 0, 0, 0];
        if (this.ab === 0) {
            // battle A
            for (let m = 1; m <= 4; m++) {
                const slotMin = this.battleProperties[`monster${m}Min`].value;
                const slotMax = this.battleProperties[`monster${m}Max`].value;
                if (this.minMax === 0) {
                    monsterCount[m] = slotMin;
                } else if (this.minMax === 1) {
                    monsterCount[m] = slotMax;
                } else if (this.minMax === 2) {
                    monsterCount[m] = Math.round((slotMin + slotMax) / 2);
                }
            }
        } else {
            // battle B
            for (let m = 1; m <= 2; m++) {
                const slotMin = this.battleProperties[`monster${m}MinB`].value;
                const slotMax = this.battleProperties[`monster${m}MaxB`].value;
                if (this.minMax === 0) {
                    monsterCount[m] = slotMin;
                } else if (this.minMax === 1) {
                    monsterCount[m] = slotMax;
                } else if (this.minMax === 2) {
                    monsterCount[m] = Math.round((slotMin + slotMax) / 2);
                }
            }
        }

        const g1 = this.battleProperties.monster1Graphics.value;
        const g2 = this.battleProperties.monster2Graphics.value;
        const g3 = this.battleProperties.monster3Graphics.value;
        const g4 = this.battleProperties.monster4Graphics.value;
        const size = this.battleProperties.size.value;

        let x, y, h, w;
        let i = 0;
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

                x = (slot <= 2) ? 8 : 72;
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

        let type = 1;
        while (i < slot) {
            if (monsterCount[type]) {
                monsterCount[type]--;
                i++;
                continue;
            }
            type++;
            if (this.ab === 0 && type > 4) return null;
            if (this.ab === 1 && type > 2) return null;
        }

        let offset = 0;
        const graphics = this.battleProperties[`monster${type}Graphics`].value;
        switch (graphics) {
            case 0: offset = 18; break;
            case 1: offset = 50; break;
            case 2: offset = 34; break;
            case 3: offset = 86; break;
            default: break;
        }

        return {
            slot: slot,
            offset: offset,
            size: size,
            rect: new Rect(x, x + w, y, y + h),
            graphics: graphics,
            palette: this.battleProperties[`monster${type}Palette`].value,
            monster: this.battleProperties[`monster${type}`].value
        };
    }

    monsterAtPoint(x, y) {

        for (const monster of this.monsterSlot) {
            if (monster.rect.containsPoint(x, y)) return monster;
        }
        return null;
    }

    resize() {
        const zoomX = this.div.clientWidth / this.battleRect.w;
        const zoomY = this.div.clientHeight / this.battleRect.h;
        this.zoom = Math.min(zoomX, zoomY);
        this.zoom = Math.max(this.zoom, 1.0);
        this.zoom = Math.min(this.zoom, 4.0);
    }

    redraw() {
        // draw the battle background and border
        this.drawBackground();

        // draw monsters
        if (this.showMonsters) {
            for (const monster of this.monsterSlot) this.drawMonster(monster);
        }

        // draw characters
        if (this.showCharacters) {
            for (let slot = 1; slot <= 4; slot++) this.drawCharacter(slot);
        }

        // update the canvas size
        const scaledRect = this.battleRect.scale(this.zoom);
        this.canvas.width = scaledRect.w;
        this.canvas.height = scaledRect.h;

        // draw the battle to the onscreen canvas
        const context = this.canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.drawImage(this.battleCanvas,
            this.battleRect.l, this.battleRect.t, this.battleRect.w, this.battleRect.h,
            0, 0, scaledRect.w, scaledRect.h
        );
    }

    drawMonster(monster) {

        // load graphics
        const g = this.battleProperties.graphics.value;
        const gfx = this.rom.monsterGraphics.item(g).data;

        // load palettes
        const p1 = this.battleProperties.palette1.value;
        const p2 = this.battleProperties.palette2.value;
        const pal = new Uint32Array(16);
        pal.set(this.rom.monsterPalette.item(p1).data, 4);
        pal.set(this.rom.monsterPalette.item(p2).data, 8);

        // create tile layout
        const w = monster.rect.w >> 3;
        const h = monster.rect.h >> 3;

        const tiles = new Uint32Array(w * h);
        if (monster.size < 3) {
            // normal monster
            const p = (monster.palette + 1) << 18;
            for (let i = 0; i < tiles.length; i++) {
                tiles[i] = (i + monster.offset) | p;
            }
        } else if (monster.size === 3) {
            // fiend
            const map = this.rom.monsterMapFiend.item(monster.graphics);
            for (let i = 0; i < tiles.length; i++) {
                const x = ((i % 8) >> 1) + 2;
                const y = (Math.floor(i / 8) >> 1) + 2;
                const p = map.palette.data[x + y * 8] << 18;
                tiles[i] = map.tiles.data[i] | p;
            }

        } else if (monster.size === 4) {
            // chaos
            const map = this.rom.monsterMapChaos;
            for (let i = 0; i < tiles.length; i++) {
                const x = ((i % 14) >> 1) + 1;
                const y = (Math.floor(i / 14) >> 1) + 1;
                const p = map.palette.data[x + y * 8] << 18;
                tiles[i] = map.tiles.data[i] | p;
            }
        }

        // set up the ppu
        const ppu = new GFX.PPU();
        ppu.pal = this.rom.gammaCorrectedPalette(pal);
        ppu.width = monster.rect.w;
        ppu.height = monster.rect.h;

        // layer 1
        ppu.layers[0].cols = w;
        ppu.layers[0].rows = h;
        ppu.layers[0].z[0] = GFX.Z.top;
        ppu.layers[0].gfx = gfx;
        ppu.layers[0].tiles = tiles;
        ppu.layers[0].main = true;

        // draw the monster
        this.monsterCanvas.width = ppu.width;
        this.monsterCanvas.height = ppu.height;
        const monsterContext = this.monsterCanvas.getContext('2d');
        const imageData = monsterContext.createImageData(ppu.width, ppu.height);
        ppu.renderPPU(imageData.data);
        monsterContext.putImageData(imageData, 0, 0);

        // tint the selected monster
        if (monster === this.selectedMonster) {
            tintRect(this.monsterCanvas, 'hsla(210, 100%, 50%, 0.5)');
        }

        const context = this.battleCanvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.drawImage(this.monsterCanvas,
            0, 0, monster.rect.w, monster.rect.h,
            monster.rect.l, monster.rect.t, monster.rect.w, monster.rect.h);
    }

    drawCharacter(slot) {

        const rect = new Rect(168, 184, 16 + slot * 24, 40 + slot * 24);

        let g, p;
        switch (slot) {
            case 1: g = 0; p = 1; break; // fighter
            case 2: g = 2; p = 0; break; // monk
            case 3: g = 4; p = 1; break; // white mage
            case 4: g = 5; p = 0; break; // black mage
        }

        const gfx = this.rom.battleCharacterGraphics.item(g);
        const pal = this.rom.battleCharacterPalette.item(p);

        // draw the character
        this.monsterCanvas.width = rect.w;
        this.monsterCanvas.height = rect.h;
        const charContext = this.monsterCanvas.getContext('2d');
        const imageData = charContext.createImageData(rect.w, rect.h);
        GFX.render(imageData.data, gfx.data, pal.data, 16);
        charContext.putImageData(imageData, 0, 0);

        // draw on the battle canvas
        const context = this.battleCanvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.drawImage(this.monsterCanvas,
            0, 0, rect.w, rect.h,
            rect.l, rect.t, rect.w, rect.h);
    }

    drawBackground() {

        const bg = this.bg; // bacground index

        // load the text graphics (for the border)
        const gfx = new Uint8Array(0x10000);
        gfx.set(this.rom.textGraphics.data);

        // load the battle backgroud graphics
        gfx.set(this.rom.monsterGraphics.item(bg).data.subarray(0, 0x1000));

        // set up the tile layout
        let w = 24;
        let h = 18;

        // load the palette
        const pal = new Uint32Array(16);
        pal.set(this.rom.battleBackgroundPalette.item(bg).data);
        const borderPalette = GFX.paletteFormat.nesPalette.decode(FF1Battle.borderPalette);
        pal.set(borderPalette[0], 12);

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(pal);
        this.ppu.height = h * 8;
        this.ppu.width = w * 8;
        this.ppu.back = true;

        // layer 1
        this.ppu.layers[1].cols = w;
        this.ppu.layers[1].rows = h;
        this.ppu.layers[1].z[0] = GFX.Z.snes2L;
        this.ppu.layers[1].z[1] = GFX.Z.snes2H;
        this.ppu.layers[1].gfx = gfx;
        this.ppu.layers[1].tiles = GFX.tileFormat.snes2bppTile.decode(FF1Battle.backgroundLayout)[0];
        this.ppu.layers[1].main = true;

        const context = this.battleCanvas.getContext('2d');
        const imageData = context.createImageData(w * 8, h * 8);
        this.ppu.renderPPU(imageData.data, 0, 0, w * 8, h * 8);
        context.putImageData(imageData, 0, 0);
    }
}

// border palette is hardcoded at 0F/EB29
FF1Battle.borderPalette = new Uint8Array([0x0F, 0x00, 0x0F, 0x30]);

// this is hardcoded, mostly at 0F/F28D (menus) and 0F/F385 (backdrop)
// instead of using the attribute table at 0F/F400, i treated these like
// the 2bpp snes tile format
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

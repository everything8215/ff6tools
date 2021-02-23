//
// ff4-map.js
// created 3/17/2018
//

// Jap translations: http://ff4.wikidot.com/weapons

class FF4Map extends ROMEditor {
    constructor(rom) {
        super(rom);

        this.name = 'FF4Map';
        this.tileset = new FF4MapTileset(rom, this);

        this.div.classList.add('map-edit');

        this.scrollDiv = document.createElement('div');
        this.scrollDiv.classList.add('no-select');
        this.div.appendChild(this.scrollDiv);

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'map';
        this.canvas.width = 256;
        this.canvas.height = 256;
        this.scrollDiv.appendChild(this.canvas);

        this.cursorCanvas = document.createElement('canvas');
        this.cursorCanvas.id = 'map-cursor';
        this.cursorCanvas.width = 16;
        this.cursorCanvas.height = 16;
        this.scrollDiv.appendChild(this.cursorCanvas);

        this.mapCanvas = document.createElement('canvas');
        this.mapCanvas.width = 256;
        this.mapCanvas.height = 256;
        this.mapSectors = [];
        this.dirtyRect = null;
        this.mapRect = new Rect(0, 0, 256, 256);
        this.npcCanvas = document.createElement('canvas');

        this.mapProperties = null;
        this.m = null; // map index
        this.w = 0; // world index
        this.l = 0; // selected layer
        this.zoom = 1.0; // zoom multiplier
        this.selection = {
            x: 0, y: 0, w: 1, h: 1,
            tilemap: new Uint8Array(1)
        };
        this.clickPoint = null;
        this.triggerPoint = null;
        this.isDragging = false;
        this.layer = [new FF4MapLayer(rom, FF4MapLayer.Type.layer1),
                      new FF4MapLayer(rom, FF4MapLayer.Type.layer2)];
        this.selectedLayer = this.layer[0];
        // this.worldLayer = new FF4MapLayer(rom, FF4MapLayer.Type.world);
        this.triggers = [];
        this.showCursor = false;
        this.showLayer1 = true;
        this.showLayer2 = true;
        this.showTriggers = true;
        this.showScreen = false;
        this.selectedTrigger = null;
        this.isWorld = false;
        this.observer = new ROMObserver(rom, this);
        this.ppu = new GFX.PPU();

        // mask layer stuff
        this.screenCanvas = document.createElement('canvas');
        this.screenCanvas.id = 'map-screen';
        this.screenCanvas.width = 256;
        this.screenCanvas.width = 256;
        this.scrollDiv.appendChild(this.screenCanvas);

        const self = this;
        this.div.onscroll = function() { self.scroll(); };
        this.scrollDiv.onmousedown = function(e) { self.mouseDown(e); };
        this.scrollDiv.onmouseup = function(e) { self.mouseUp(e); };
        this.scrollDiv.onmousemove = function(e) { self.mouseMove(e); };
        this.scrollDiv.onmouseenter = function(e) { self.mouseEnter(e); };
        this.scrollDiv.onmouseleave = function(e) { self.mouseLeave(e); };
        this.scrollDiv.oncontextmenu = function(e) { self.openMenu(e); return false; };
        this.resizeSensor = null;

        this.initBattleGroups();
        this.updateTilesets();
    }

    initBattleGroups() {

        // set the battle offset for underground and moon maps
        for (let m = 256; m < 512; m++) {
            const b = this.rom.mapBattle.item(m).battleGroup.value;
            if (b === 0) continue;
            const battleGroup = this.rom.battleGroup.item(b);
            for (let i = 1; i <= 8; i++) {
                const battle = battleGroup[`battle${i}`];
                if (battle.offset === 256) continue;
                battle.offset = 256;
                battle.value += 256;
            }
        }

        for (let m = 64; m < 84; m++) {
            const b = this.rom.worldBattle.item(m).battleGroup.value;
            if (b === 0) continue;
            const battleGroup = this.rom.battleGroupWorld.item(b);
            for (let i = 1; i <= 8; i++) {
                const battle = battleGroup[`battle${i}`];
                if (battle.offset === 256) continue;
                battle.offset = 256;
                battle.value += 256;
            }
        }
    }

    updateTilesets() {

        for (let t = 0; t < this.rom.mapTilesets.arrayLength; t++) {
            const tileset = this.rom.mapTilesets.item(t);
            const graphics = this.rom.mapGraphics.item(t);

            if (t === 0 || t === 15) {
                graphics.format = 'snes4bpp';
                graphics.disassemble(graphics.parent.data);
                tileset.graphics = `mapGraphics[${t}]`;
                continue;
            } else if (t === 14) {
                tileset.graphics = `mapGraphics[${t}]`;
                continue;
            }

            tileset.graphics = [`mapGraphics[${t}]`];
            const length1 = graphics.data.length;
            const length2 = 0x6000 - graphics.data.length;
            if (length2 <= 0) continue;
            tileset.graphics.push({
                path: `mapGraphics[${t + 1}]`,
                offset: length1,
                range: `0-${length2}`
            });
        }

        for (let m = 0; m < this.rom.mapProperties.arrayLength; m++) {
            const mapProperties = this.rom.mapProperties.item(m);
            const g = mapProperties.graphics.value;
            const p = mapProperties.palette.value;

            const tileset = this.rom.mapTilesets.item(g);

            const paletteDefinition = [
                {
                    path: `mapPalettes[${p}]`,
                    range: '0-8',
                    offset: 16
                }, {
                    path: `mapPalettes[${p}]`,
                    range: '8-16',
                    offset: 32
                }, {
                    path: `mapPalettes[${p}]`,
                    range: '16-24',
                    offset: 48
                }, {
                    path: `mapPalettes[${p}]`,
                    range: '24-32',
                    offset: 64
                }, {
                    path: `mapPalettes[${p}]`,
                    range: '32-40',
                    offset: 80
                }, {
                    path: `mapPalettes[${p}]`,
                    range: '40-48',
                    offset: 96
                }, {
                    path: `mapPalettes[${p}]`,
                    range: '48-56',
                    offset: 112
                }
            ];

            if (g === 0 || g === 15) {
                paletteDefinition.push(
                    {
                        path: `mapPalettes[${p + 1}]`,
                        range: '0-8',
                        offset: 24
                    }, {
                        path: `mapPalettes[${p + 1}]`,
                        range: '8-16',
                        offset: 40
                    }, {
                        path: `mapPalettes[${p + 1}]`,
                        range: '16-24',
                        offset: 56
                    }, {
                        path: `mapPalettes[${p + 1}]`,
                        range: '24-32',
                        offset: 72
                    }, {
                        path: `mapPalettes[${p + 1}]`,
                        range: '32-40',
                        offset: 88
                    }, {
                        path: `mapPalettes[${p + 1}]`,
                        range: '40-48',
                        offset: 104
                    }, {
                        path: `mapPalettes[${p + 1}]`,
                        range: '48-56',
                        offset: 120
                    }
                );
            }
            tileset.palette = [paletteDefinition];
        }
    }

    show() {
        this.showControls();
        this.tileset.show();

        // notify on resize
        const self = this;
        const editTop = document.getElementById('edit-top');
        if (!this.resizeSensor) {
            this.resizeSensor = new ResizeSensor(editTop, function() {
                self.scroll();
            });
        }
    }

    hide() {
        this.mapProperties = null;
        this.observer.stopObservingAll();
        if (this.resizeSensor) {
            const editTop = document.getElementById('edit-top');
            this.resizeSensor.detach(editTop);
            this.resizeSensor = null;
        }
        this.tileset.hide();
    }

    selectObject(object) {

        if (this.mapProperties === object) return;

        this.mapProperties = object;
        this.m = object.i;

        if ([0xFB, 0xFC, 0xFD].includes(this.m & 0xFF)) {
            // world map
            this.m &= 0xFF;
            this.isWorld = true;
            this.loadWorldMap();
            propertyList.select(null);
        } else {
            // normal map
            this.isWorld = false;
            this.loadMap();
        }
    }

    resetControls() {

        super.resetControls();

        const self = this;

        // add layer toggle buttons
        this.addTwoState('showLayer1', function() {
            self.changeLayer('showLayer1');
        }, 'Layer 1', this.showLayer1);
        this.addTwoState('showLayer2', function() {
            self.changeLayer('showLayer2');
        }, 'Layer 2', this.showLayer2);
        this.addTwoState('showTriggers', function() {
            self.changeLayer('showTriggers');
        }, 'Triggers', this.showTriggers);

        // add tile mask button
        const maskArray = this.isWorld ? FF4Map.WorldTileMasks : FF4Map.TileMasks
        const maskKeys = Object.keys(maskArray);
        const maskNames = [];
        for (let i = 0; i < maskKeys.length; i++) {
            maskNames[i] = maskArray[maskKeys[i]];
        }
        if (!maskNames.includes(this.tileMask)) {
            this.tileMask = FF4Map.TileMasks.none;
        }
        function onChangeMask(mask) {
            self.tileMask = maskArray[maskKeys[mask]];
            self.drawMap();
            self.tileset.selectLayer(self.l);
        };
        function maskSelected(mask) {
            return self.tileMask === maskArray[maskKeys[mask]];
        };
        this.addList('showMask', 'Mask', maskNames, onChangeMask, maskSelected);

        // add screen mask button
        this.addTwoState('showScreen', function() {
            self.changeLayer('showScreen');
        }, 'Screen', this.showScreen);
        this.addZoom(this.zoom, function() {
            self.changeZoom();
        });
    }

    changeZoom() {

        // save the old scroll location
        const l = this.div.scrollLeft;
        const t = this.div.scrollTop;
        const w = this.div.clientWidth;
        const h = this.div.clientHeight;
        const oldRect = new Rect(l, l + w, t, t + h);
        const oldZoom = this.zoom;

        // update zoom
        this.zoom = Math.pow(2, Number(document.getElementById('zoom').value));
        const zoomValue = document.getElementById('zoom-value');
        zoomValue.innerHTML = `${this.zoom * 100}%`;

        // update the scroll div size
        const parentWidth = this.ppu.width * this.zoom;
        const parentHeight = this.ppu.height * this.zoom;
        this.scrollDiv.style.width = `${parentWidth}px`;
        this.scrollDiv.style.height = `${parentHeight}px`;

        // calculate the new scroll location
        const x = Math.round(oldRect.centerX / oldZoom) * this.zoom;
        const y = Math.round(oldRect.centerY / oldZoom) * this.zoom;
        let newRect = new Rect(x - w / 2, x + w / 2, y - h / 2, y + h / 2);
        if (newRect.r > parentWidth) newRect = newRect.offset(parentWidth - newRect.r, 0);
        if (newRect.b > parentHeight) newRect = newRect.offset(0, parentHeight - newRect.b);
        if (newRect.l < 0) newRect = newRect.offset(-newRect.l, 0);
        if (newRect.t < 0) newRect = newRect.offset(0, -newRect.t);

        // set the new scroll location and redraw
        this.div.scrollLeft = newRect.l;
        this.div.scrollTop = newRect.t;
        this.scroll();
    }

    scroll() {

        // get the visible dimensions
        const x = this.div.scrollLeft;
        const y = this.div.scrollTop;
        const w = this.div.clientWidth;
        const h = this.div.clientHeight;

        const margin = Math.max(w, h) >> 2;
        this.mapRect.r = Math.min(x + w + margin, this.ppu.width * this.zoom);
        this.mapRect.l = Math.max(0, Math.min(x - margin, this.mapRect.r - w));
        this.mapRect.b = Math.min(y + h + margin, this.ppu.height * this.zoom);
        this.mapRect.t = Math.max(0, Math.min(y - margin, this.mapRect.b - h));

        this.canvas.style.left = `${this.mapRect.l}px`;
        this.canvas.style.top = `${this.mapRect.t}px`;
        this.canvas.width = this.mapRect.w;
        this.canvas.height = this.mapRect.h;

        this.drawMap();
    }

    getEventPoint(e) {
        // convert screen coordinates to ppu coordinates
        const x = e.offsetX / this.zoom + this.ppu.layers[this.l].x;
        const y = e.offsetY / this.zoom + this.ppu.layers[this.l].y;

        // get the tile (x,y) position on the selected layer
        let col = x >> 4;
        let row = y >> 4;
        if (this.l !== 3) {
            col %= this.ppu.layers[this.l].cols;
            row %= this.ppu.layers[this.l].rows;
            while (col < 0) col += this.ppu.layers[this.l].cols;
            while (row < 0) row += this.ppu.layers[this.l].rows;
        }

        return {
            x: col, y: row,
            button: e.button
        }
    }

    mouseDown(e) {

        this.clickPoint = this.getEventPoint(e);

        // update the selection position
        this.selection.x = this.clickPoint.x;
        this.selection.y = this.clickPoint.y;
        this.isDragging = true;

        if (this.l === 3) {
            // right click handled by context menu
            if (this.clickPoint.button === 2) return;

            const triggers = this.triggersAt(e.offsetX, e.offsetY);
            if (triggers.length) {
                // select the first trigger, or the next trigger in a stack
                let index = triggers.indexOf(this.selectedTrigger);
                index = (index + 1) % triggers.length;
                this.selectTrigger(triggers[index]);
            } else {
                // clear trigger selection
                this.selectTrigger(null);
                this.isDragging = false;
                if (this.isWorld) {
                    // select world map battle
                    this.selectWorldBattle(this.clickPoint.x, this.clickPoint.y);
                } else {
                    // select map properties
                    propertyList.select(this.mapProperties);
                }
            }

        } else if (this.clickPoint.button === 2) {
            // right mouse button down - select tiles
            this.selectTiles();

        } else {
            // left mouse button down - draw tiles
            this.beginAction(this.drawMap);
            this.rom.doAction(new ROMAction(this.selectedLayer, this.selectedLayer.decodeLayout, null, 'Decode Layout'));
            this.setTiles();
        }

        this.drawScreen();
        this.drawCursor();
    }

    mouseMove(e) {

        const point = this.getEventPoint(e);

        // update the displayed coordinates
        const coordinates = document.getElementById('coordinates');
        coordinates.innerHTML = `(${point.x}, ${point.y})`;

        // return if the cursor position didn't change
        if (this.selection.x === point.x && this.selection.y === point.y) return;

        // update the selection position
        this.selection.x = point.x;
        this.selection.y = point.y;

        if (!this.isDragging) {
            // update the cursor
            this.drawScreen();
            this.drawCursor();
            return;
        }

        if (this.l === 3 && this.selectedTrigger) {

            if (this.selectedTrigger.x.value !== point.x || this.selectedTrigger.y.value !== point.y) {
                this.selectedTrigger.x.value = point.x;
                this.selectedTrigger.y.value = point.y;
                this.invalidateMap(this.rectForTrigger(this.selectedTrigger).scale(1 / this.zoom));
                this.drawMap();
            }
        } else if (this.clickPoint.button === 2) {
            this.selectTiles();
        } else {
            this.setTiles();
        }

        // update the cursor
        this.drawScreen();
        this.drawCursor();
    }

    mouseUp(e) {

        if (this.l === 3 && this.selectedTrigger && this.isDragging) {
            // save the new trigger position
            const x = this.selectedTrigger.x.value;
            const y = this.selectedTrigger.y.value;

            if (x != this.clickPoint.x || y !== this.clickPoint.y) {
                // move the trigger back to its old position
                this.selectedTrigger.x.value = this.triggerPoint.x;
                this.selectedTrigger.y.value = this.triggerPoint.y;

                // set the new trigger position (and trigger undo)
                this.beginAction(this.reloadTriggers);
                this.selectedTrigger.x.setValue(x);
                this.selectedTrigger.y.setValue(y);
                this.endAction(this.reloadTriggers);
            }
        } else if (this.rom.action && this.isDragging) {
            this.rom.doAction(new ROMAction(this.selectedLayer, null, this.selectedLayer.decodeLayout, 'Decode Layout'));
            this.rom.pushAction(new ROMAction(this, null, this.drawMap, 'Redraw Map'));
            this.endAction();
        }

        this.isDragging = false;
        // this.clickButton = null;
    }

    mouseEnter(e) {

        // show the cursor
        this.showCursor = true;
        this.drawScreen();
        this.drawCursor();

        this.mouseUp(e);
    }

    mouseLeave(e) {

        // hide the cursor
        this.showCursor = (this.l === 3);
        this.drawCursor();

        this.mouseUp(e);
    }

    openMenu(e) {
        if (this.l !== 3) return; // no menu unless editing triggers

        this.clickPoint = this.getEventPoint(e);

        // update the selection position
        this.selection.x = this.clickPoint.x;
        this.selection.y = this.clickPoint.y;

        const triggers = this.triggersAt(e.offsetX, e.offsetY);
        if (triggers.length) {
            // open a menu for the selected trigger
            let index = triggers.indexOf(this.selectedTrigger);
            if (index === -1) index = 0;
            this.selectTrigger(triggers[index]);
        } else {
            // clear trigger selection
            this.selectTrigger(null);
        }
        this.drawScreen();
        this.drawCursor();

        this.menu = new ROMMenu();

        const self = this;
        this.menu.createMenuItem(this.menu.topMenu, {
            name: 'Insert Entrance Trigger',
            onclick: function() {
                self.closeMenu();
                self.insertTrigger();
            }
        });

        this.menu.createMenuItem(this.menu.topMenu, {
            name: 'Insert Event Trigger',
            onclick: function() {
                self.closeMenu();
                self.insertTrigger('eventTriggers');
            }
        });

        this.menu.createMenuItem(this.menu.topMenu, {
            name: 'Insert Treasure',
            disabled: this.isWorld,
            onclick: function() {
                self.closeMenu();
                self.insertTrigger('treasureProperties');
            }
        });

        this.menu.createMenuItem(this.menu.topMenu, {
            name: 'Insert NPC',
            disabled: this.isWorld,
            onclick: function() {
                self.closeMenu();
                self.insertNPC();
            }
        });

        this.menu.createMenuItem(this.menu.topMenu, {
            name: 'Delete Trigger',
            disabled: this.selectedTrigger === null,
            onclick: function() {
                self.closeMenu();
                self.deleteTrigger();
            }
        });

        this.menu.open(e.x, e.y);
    }

    closeMenu() {
        if (this.menu) this.menu.close();
    }

    setTiles() {
        // return if not dragging
        if (!this.clickPoint) return;

        const x = this.selection.x;
        const y = this.selection.y;
        const w = this.selection.w;
        const h = this.selection.h;

        const l = ((x << 4) - this.ppu.layers[this.l].x) % this.ppu.width;
        const r = l + (w << 4);
        const t = ((y << 4) - this.ppu.layers[this.l].y) % this.ppu.height;
        const b = t + (h << 4);
        const rect = new Rect(l, r, t, b);

        this.selectedLayer.setLayout(this.selection);
        const self = this;
        function invalidate() {
            self.invalidateMap(rect);
        }
        this.rom.doAction(new ROMAction(this, invalidate, invalidate, 'Invalidate Map'));
        this.drawMap();
    }

    selectTiles() {
        // return if not dragging
        if (!this.clickPoint) return;

        const x = Math.min(this.selection.x, this.clickPoint.x);
        const y = Math.min(this.selection.y, this.clickPoint.y);
        const w = Math.abs(this.selection.x - this.clickPoint.x) + 1;
        const h = Math.abs(this.selection.y - this.clickPoint.y) + 1;

        this.selection = this.selectedLayer.getLayout(x, y, w, h);

        if (w === 1 && h === 1) {
            // select a single tile in the tileset view
            const tile = this.selection.tilemap[0];
            this.tileset.selection = {
                x: tile & 0x0F,
                y: tile >> 4,
                w: 1, h: 1,
                tilemap: new Uint8Array([tile])
            };
            this.selectTileProperties(tile);
        } else {
            this.tileset.selection = null;
        }
        this.tileset.drawCursor();
    }

    selectWorldBattle(x, y) {

        x >>= 5;
        y >>= 5;

        let sector = 0;
        if (this.w === 0) {
            // overworld
            x &= 7;
            y &= 7;
            sector = x + (y << 3);
        } else if (this.w === 1) {
            // underground
            offset = 64;
            x &= 3;
            y &= 3;
            sector = x + (y << 2) + 64;
        } else if (this.w === 2) {
            // moon
            offset = 80;
            x &= 1;
            y &= 1;
            sector = x + (y << 1) + 80;
        }

        const battleGroup = this.rom.worldBattle.item(sector);
        propertyList.select(battleGroup);
    }

    selectTileProperties(t) {

        if (this.l !== 0) return;

        // select tile properties
        const tileProperties = this.tilePropertiesAtTile(t);
        if (tileProperties) propertyList.select(tileProperties);
    }

    tilePropertiesAtTile(t) {
        if (this.isWorld) {
            return this.rom.worldTileProperties.item(this.w).item(t);
        } else {
            const g = this.mapProperties.graphics.value;
            return this.rom.mapTileProperties.item(g).item(t);
        }
    }

    selectLayer(l) {
        // set the selected layer
        l = Number(l);
        if (isNumber(l)) this.l = l;

        if (this.isWorld) {
            this.selectedLayer = this.layer[0]
        } else {
            this.selectedLayer = this.layer[this.l]
        }

        this.showCursor = (this.l === 3);
        this.drawScreen();
        this.drawCursor();
    }

    changeLayer(id) {
        this[id] = document.getElementById(id).checked;
        this.ppu.layers[0].main = this.showLayer1;
        if (!this.isWorld) {
            this.ppu.layers[0].sub = this.showLayer1 && this.mapProperties.addition.value;
            this.ppu.layers[1].main = this.showLayer2;
        }
        this.invalidateMap();
        this.drawMap();
    }

    loadMap() {

        this.resetControls();
        this.observer.stopObservingAll();
        const mp = this.rom.mapProperties.item(this.m);

        // start observing relevant map properties
        this.observer.startObserving([
            mp.graphics,
            mp.palette,
            mp.layout1,
            mp.layout2,
            mp.layoutMSB,
            mp.addition
        ], this.loadMap);

        // observe tile properties (redraw map and tileset, don't reload)
        const self = this;
        const g = mp.graphics.value;
        const tileProperties = this.rom.mapTileProperties.item(g);
        for (const tp of tileProperties.iterator()) {
            this.observer.startObservingSub(tp, function() {
                self.drawMap();
                self.tileset.redraw();
            });
        }

        // set the battle background
        const battleEditor = propertyList.getEditor('FF4Battle');
        battleEditor.bg = mp.battleBackground.value;
        battleEditor.altPalette = mp.battleBackgroundPalette.value;

        // load graphics
        const gfx = new Uint8Array(0x10000);
        if ((g === 0) || (g === 15)) {
            // 4bpp graphics
            const graphics1 = this.rom[`mapGraphics${g}`];
            this.observer.startObserving(graphics1, this.loadMap);
            gfx.set(graphics1.data);
        } else {
            // 3bpp graphics
            const graphics1 = this.rom[`mapGraphics${g}`];
            const graphics2 = this.rom[`mapGraphics${g + 1}`];
            this.observer.startObserving(graphics1, this.loadMap);
            this.observer.startObserving(graphics2, this.loadMap);
            gfx.set(graphics1.data);
            gfx.set(graphics2.data, graphics1.data.length);
        }

        // load animation graphics (from 15/CB55)
        const animTable = [0, 0, 0, 2, 3, 6, 7, 10, 10, 10, 10, 10, 13, 13, 13, 16];
        const animGfx = this.rom.mapAnimationGraphics.data;
        for (let i = 0; i < 4; i++) {
            const a = animTable[g] + i;
            const start = a * 0x0400;
            const end = start + 0x0100;
            gfx.set(animGfx.subarray(start, end), 0x4800 + i * 0x0100);
        }

        // load palette
        const pal = new Uint32Array(128);
        if ((g === 0) || (g === 15)) {
            // 4bpp graphics
            const pal1 = this.rom.mapPalettes.item(mp.palette.value);
            const pal2 = this.rom.mapPalettes.item(mp.palette.value + 1);
            this.observer.startObserving(pal1, this.loadMap);
            this.observer.startObserving(pal2, this.loadMap);
            for (let p = 0; p < 7; p++) {
                pal.set(pal1.data.subarray(p * 8, p * 8 + 8), (p + 1) * 16);
                pal.set(pal2.data.subarray(p * 8, p * 8 + 8), (p + 1) * 16 + 8);
            }
        } else {
            // 3bpp graphics
            const pal1 = this.rom.mapPalettes.item(mp.palette.value);
            this.observer.startObserving(pal1, this.loadMap);
            for (let p = 0; p < 7; p++) {
                pal.set(pal1.data.subarray(p * 8, p * 8 + 8), (p + 1) * 16);
            }
        }
        pal[0] = 0xFF000000; // set background color to black

        const tileset = this.rom.mapTilesets.item(g);
        this.observer.startObserving(tileset, this.loadMap);

        const layoutArray = (mp.layoutMSB.value || this.m >= 256) ?
            this.rom.mapLayouts.undergroundMoonLayouts :
            this.rom.mapLayouts.overworldLayouts;

        // load and de-interlace tile layouts
        const l1 = mp.layout1.value;
        const layout1 = layoutArray.item(l1) || new Uint8Array(0x0400);
        if (layout1 instanceof Uint8Array) {
            layout1.fill(map.fill);
        }
        this.layer[0].type = FF4MapLayer.Type.layer1;
        this.layer[0].loadLayout({
            layout: layout1,
            tileset: tileset.data,
            w: 32, h: 32
        });

        const l2 = mp.layout2.value;
        const layout2 = layoutArray.item(l2) || new Uint8Array(0x0400);
        if (layout2 instanceof Uint8Array) {
            layout2.fill(map.fill);
        }
        this.layer[1].loadLayout({
            layout: layout2,
            tileset: tileset.data,
            w: 32, h: 32
        });

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(pal);
        this.ppu.height = 32 * 16;
        this.ppu.width = 32 * 16;
        this.ppu.back = true;
        this.ppu.subtract = false;
        this.ppu.half = mp.addition.value;

        // layer 1
        this.ppu.layers[0].cols = this.layer[0].w * 2;
        this.ppu.layers[0].rows = this.layer[0].h * 2;
        this.ppu.layers[0].z[0] = GFX.Z.snes1L;
        this.ppu.layers[0].z[1] = GFX.Z.snes1H;
        this.ppu.layers[0].gfx = gfx;
        this.ppu.layers[0].tiles = this.layer[0].tiles;
        this.ppu.layers[0].main = this.showLayer1; // layer 1 always in main screen
        this.ppu.layers[0].sub = this.showLayer1 && mp.addition.value;
        this.ppu.layers[0].math = mp.addition.value;

        // layer 2
        this.ppu.layers[1].cols = this.layer[1].w * 2;
        this.ppu.layers[1].rows = this.layer[1].h * 2;
        this.ppu.layers[1].z[0] = GFX.Z.snes2L;
        this.ppu.layers[1].z[1] = GFX.Z.snes2H;
        this.ppu.layers[1].gfx = gfx;
        this.ppu.layers[1].tiles = this.layer[1].tiles;
        this.ppu.layers[1].main = this.showLayer2;
        this.ppu.layers[1].sub = false;
        this.ppu.layers[1].math = mp.addition.value;

        this.scrollDiv.style.width = `${this.ppu.width * this.zoom}px`;
        this.scrollDiv.style.height = `${this.ppu.height * this.zoom}px`;
        this.mapCanvas.width = this.ppu.width;
        this.mapCanvas.height = this.ppu.height;

        this.invalidateMap();
        this.selectedTrigger = null;
        this.loadTriggers();
        this.scroll();

        this.tileset.loadMap();
    }

    loadWorldMap(m) {

        this.resetControls();
        this.observer.stopObservingAll();

        // set the map background
        const battleEditor = propertyList.getEditor('FF4Battle');
        let size = 256;
        if (this.m === 0xFB) {
            // overworld
            this.w = 0;
            battleEditor.bg = 0;
        } else if (this.m === 0xFC) {
            // underground
            this.w = 1;
            battleEditor.bg = 15;
        } else if (this.m === 0xFD) {
            // moon
            this.w = 2;
            battleEditor.bg = 5;
            size = 64;
        }
        battleEditor.altPalette = false;

        const graphics = this.rom.worldGraphics.item(this.w);
        const palette = this.rom.worldPalettes.item(this.w);
        const paletteAssignment = this.rom.worldPaletteAssignments.item(this.w);
        const tileset = this.rom.worldTilesets.item(this.w);
        const tileProperties = this.rom.worldTileProperties.item(this.w);

        const self = this;
        this.observer.startObserving([
            graphics,
            palette,
            paletteAssignment,
            tileset
        ], this.loadMap);
        for (const tp of tileProperties.iterator()) {
            this.observer.startObservingSub(tp, function() {
                self.drawMap();
                self.tileset.redraw();
            });
        }

        const layout = [];
        for (let i = 0; i < size; i++) {
            layout.push(rom[`worldLayout${this.w}`].item(i));
        }

        this.layer[0].type = FF4MapLayer.Type.world;
        this.layer[0].loadLayout({
            layout: layout,
            tileset: tileset.data,
            w: size,
            h: size,
            paletteAssignment: paletteAssignment.data
        });

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(palette.data);
        this.ppu.width = size * 16;
        this.ppu.height = size * 16;
        this.ppu.back = true;

        // layer 1
        this.ppu.layers[0].cols = size * 2;
        this.ppu.layers[0].rows = size * 2;
        this.ppu.layers[0].z[0] = GFX.Z.snes1L;
        this.ppu.layers[0].z[1] = GFX.Z.snes1H;
        this.ppu.layers[0].gfx = graphics.data;
        this.ppu.layers[0].tiles = this.layer[0].tiles;
        this.ppu.layers[0].main = this.showLayer1; // layer 1 always in main screen

        this.scrollDiv.style.width = `${this.ppu.width * this.zoom}px`;
        this.scrollDiv.style.height = `${this.ppu.height * this.zoom}px`;
        this.mapCanvas.width = this.ppu.width;
        this.mapCanvas.height = this.ppu.height;

        this.invalidateMap();
        this.selectedTrigger = null;
        this.loadTriggers();
        this.scroll();

        this.tileset.loadMap(m);
    }

    invalidateMap(rect) {
        const clipX = Math.ceil(this.ppu.width / 256);
        const clipY = Math.ceil(this.ppu.height / 256);
        if (!rect) {
            // invalidate all sectors
            const sectorCount = clipX * clipY;
            this.mapSectors = new Array(sectorCount);
            this.dirtyRect = null;
        } else if (this.dirtyRect) {
            // combine dirty areas
            const left = Math.min(this.dirtyRect.l, rect.l);
            const top = Math.min(this.dirtyRect.t, rect.t);
            const right = Math.max(this.dirtyRect.r, rect.r);
            const bottom = Math.max(this.dirtyRect.b, rect.b);
            this.dirtyRect = new Rect(left, right, top, bottom);
        } else {
            // set a new dirty area
            this.dirtyRect = rect;
        }
    }

    drawMap() {

        // update the map canvas
        const mapContext = this.mapCanvas.getContext('2d');
        const clip = Math.ceil(this.ppu.width / 256);

        // draw all visible sectors
        for (let s = 0; s < this.mapSectors.length; s++) {
            // continue if this sector is already drawn
            if (this.mapSectors[s]) continue;

            // continue if this sector is not visible
            const col = s % clip;
            const row = Math.floor(s / clip);
            const l = col * 256;
            const r = l + 256;
            const t = row * 256;
            const b = t + 256;
            const sectorRect = new Rect(l, r, t, b);
            if (this.mapRect.intersect(sectorRect.scale(this.zoom)).isEmpty()) continue;

            // draw the sector (256 x 256 pixels)
            const imageData = mapContext.createImageData(256, 256);
            this.ppu.renderPPU(imageData.data, sectorRect.l, sectorRect.t, 256, 256);
            mapContext.putImageData(imageData, sectorRect.l, sectorRect.t);

            // validate the sector
            this.mapSectors[s] = true;
        }

        // redraw dirty portions of the map
        if (this.dirtyRect) {

            const rect = this.dirtyRect;
            this.dirtyRect = null;

            // render the image on the map canvas
            const imageData = mapContext.createImageData(rect.w, rect.h);
            this.ppu.renderPPU(imageData.data, rect.l, rect.t, rect.w, rect.h);
            mapContext.putImageData(imageData, rect.l, rect.t);
        }

        const context = this.canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.globalCompositeOperation = 'copy';
        const scaledRect = this.mapRect.scale(1 / this.zoom);
        context.drawImage(this.mapCanvas,
            scaledRect.l, scaledRect.t, scaledRect.w, scaledRect.h,
            0, 0, this.mapRect.w, this.mapRect.h
        );

        this.drawMask();
        this.drawTriggers();
        this.drawNPCs();
        this.drawScreen();
        this.drawCursor();
    }

    drawMask() {

        if (this.tileMask === FF4Map.TileMasks.none) return;

        const context = this.canvas.getContext('2d');
        context.globalCompositeOperation = 'source-over';

        // calculate coordinates on the map rect
        const xStart = (this.mapRect.l / this.zoom) >> 4;
        const xEnd = (this.mapRect.r / this.zoom) >> 4;
        const yStart = (this.mapRect.t / this.zoom) >> 4;
        const yEnd = (this.mapRect.b / this.zoom) >> 4;
        const xOffset = (this.mapRect.l / this.zoom) % 16;
        const yOffset = (this.mapRect.t / this.zoom) % 16;
        const w = this.layer[0].w;
        const h = this.layer[0].h;

        // draw the mask at each tile
        for (let y = yStart; y <= yEnd; y++) {
            for (let x = xStart; x <= xEnd; x++) {

                let tile = 0;
                if (this.isWorld) {
                    tile = this.layer[0].layout[y].data[x];
                } else {
                    if (this.layer[0].layout instanceof Uint8Array) return null;
                    const t = (x % w) + (y % h) * w;
                    tile = this.layer[0].layout.data[t];
                }
                const color = this.maskColorAtTile(tile);
                if (!color) continue;
                context.fillStyle = color;

                const left = (((x - xStart) << 4) - xOffset) * this.zoom;
                const top = (((y - yStart) << 4) - yOffset) * this.zoom;
                const size = 16 * this.zoom;

                context.fillRect(left, top, size, size);
            }
        }
    }

    maskColorAtTile(t) {
        const tileProperties = this.tilePropertiesAtTile(t);
        if (!tileProperties) return null;
        const tp = tileProperties.byte1.value | tileProperties.byte2.value << 8;
        if (!tp) return null;

        if (this.isWorld) {
            if (this.tileMask === FF4Map.WorldTileMasks.zUpper) {
                if (!(tp & 0x40)) {
                    return 'rgba(0, 0, 255, 0.5)';
                }
            } else if (this.tileMask === FF4Map.WorldTileMasks.zLower) {
                if (!(tp & 1)) {
                    return 'rgba(0, 0, 255, 0.5)';
                }
            } else if (this.tileMask === FF4Map.WorldTileMasks.triggers) {
                if (tp & 0x1000) {
                    return 'rgba(0, 255, 255, 0.5)'; // trigger (cyan)
                }
            } else if (this.tileMask === FF4Map.WorldTileMasks.battle) {
                if (tp & 0x0800) {
                    return 'rgba(255, 0, 0, 0.5)';
                }
            } else if (this.tileMask === FF4Map.WorldTileMasks.forest) {
                if (tp & 0x0100) {
                    return 'rgba(255, 255, 0, 0.5)'; // bottom half hidden (yellow)
                }
            } else if (this.tileMask === FF4Map.WorldTileMasks.chocoboNoLava) {
                if (tp & 0x02) {
                    return 'rgba(255, 255, 0, 0.5)'; // chocobo/no lava (yellow)
                }
            } else if (this.tileMask === FF4Map.WorldTileMasks.blackChocoboFly) {
                if (tp & 0x04) {
                    return 'rgba(255, 255, 0, 0.5)'; // yellow
                }
            } else if (this.tileMask === FF4Map.WorldTileMasks.blackChocoboLand) {
                if (tp & 0x08) {
                    return 'rgba(255, 255, 0, 0.5)'; // yellow
                }
            } else if (this.tileMask === FF4Map.WorldTileMasks.hovercraft) {
                if (tp & 0x10) {
                    return 'rgba(255, 255, 0, 0.5)'; // yellow
                }
            } else if (this.tileMask === FF4Map.WorldTileMasks.airshipFly) {
                if (tp & 0x20) {
                    return 'rgba(255, 255, 0, 0.5)'; // yellow
                }
            } else if (this.tileMask === FF4Map.WorldTileMasks.airshipLand) {
                if (tp & 0x0200) {
                    return 'rgba(255, 255, 0, 0.5)'; // yellow
                }
            } else if (this.tileMask === FF4Map.WorldTileMasks.lunarWhale) {
                if (tp & 0x80) {
                    return 'rgba(255, 255, 0, 0.5)'; // yellow
                }
            } else if (this.tileMask === FF4Map.WorldTileMasks.unknown) {
                if (tp & 0x0400) {
                    return 'rgba(255, 255, 0, 0.5)'; // yellow
                }
            }
        } else {
            if (this.tileMask === FF4Map.TileMasks.zUpper) {
                if (tp & 0x04) {
                    return 'rgba(0, 255, 255, 0.5)'; // bridge
                } else if (!(tp & 0x01)) {
                    return 'rgba(0, 0, 255, 0.5)';
                }
            } else if (this.tileMask === FF4Map.TileMasks.zLower) {
                if (tp & 0x04) {
                    return 'rgba(0, 255, 255, 0.5)'; // bridge
                } else if (!(tp & 0x02)) {
                    return 'rgba(0, 0, 255, 0.5)';
                }
            } else if (this.tileMask === FF4Map.TileMasks.triggers) {
                if (tp & 0x0008) {
                    return 'rgba(0, 255, 0, 0.5)'; // save point (green)
                } else if (tp & 0x0010) {
                    return 'rgba(0, 0, 255, 0.5)'; // door (blue)
                } else if (tp & 0x1000) {
                    return 'rgba(255, 255, 0, 0.5)'; // exit (yellow)
                } else if (tp & 0x2000) {
                    return 'rgba(255, 0, 255, 0.5)'; // through-tile (magenta)
                } else if (tp & 0x8000) {
                    return 'rgba(0, 255, 255, 0.5)'; // trigger (cyan)
                } else if (tp & 0x0100) {
                    return 'rgba(255, 0, 0, 0.5)'; // damage (red)
                } else if (tp & 0x0200) {
                    return 'rgba(0, 255, 255, 0.5)'; // unknown (white)
                }
            } else if (this.tileMask === FF4Map.TileMasks.battle) {
                if (tp & 0x4000) {
                    return 'rgba(255, 0, 0, 0.5)';
                }
            } else if (this.tileMask === FF4Map.TileMasks.spriteVisibility) {
                if (tp & 0x0400) {
                    return 'rgba(0, 0, 255, 0.5)'; // entire sprite hidden (blue)
                } else if (tp & 0x0800) {
                    return 'rgba(255, 255, 0, 0.5)'; // bottom half hidden (yellow)
                }
            }
        }

        return null;
    }

    drawScreen() {

        this.screenCanvas.style.display = 'none';
        if (!this.showScreen) return;

        // calculate the screen rect
        const x = ((this.selection.x * 16) - this.ppu.layers[this.l].x) % this.ppu.width;
        const y = ((this.selection.y * 16) - this.ppu.layers[this.l].y) % this.ppu.height;
        let screenRect = new Rect(x - 7 * 16 + 1, x + 9 * 16 - 1, y - 7 * 16 + 1, y + 7 * 16 + 1);

        screenRect.l = Math.max(0, screenRect.l);
        screenRect.r = Math.min(this.ppu.width, screenRect.r);
        screenRect.t = Math.max(0, screenRect.t);
        screenRect.b = Math.min(this.ppu.height, screenRect.b);

        // scale and offset to match the map rect
        screenRect = screenRect.scale(this.zoom).offset(-this.mapRect.l, -this.mapRect.t);

        // draw the screen mask
        this.screenCanvas.width = this.mapRect.w;
        this.screenCanvas.height = this.mapRect.h;
        this.screenCanvas.style.left = `${this.mapRect.l}px`;
        this.screenCanvas.style.top = `${this.mapRect.t}px`;
        this.screenCanvas.style.display = 'block';
        const ctx = this.screenCanvas.getContext('2d');
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, this.screenCanvas.width, this.screenCanvas.height);
        ctx.globalCompositeOperation = 'destination-out'
        ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';
        ctx.fillRect(screenRect.l, screenRect.t, screenRect.w, screenRect.h);
    }

    drawCursor() {

        this.cursorCanvas.style.display = 'none';
        if (!this.showCursor) return;

        const col = this.selection.x;
        const row = this.selection.y;

        // get the cursor geometry and color
        let x = ((col << 4) - this.ppu.layers[this.l].x) % this.ppu.width;
        x *= this.zoom;
        let y = ((row << 4) - this.ppu.layers[this.l].y) % this.ppu.height;
        y *= this.zoom;
        let w = this.selection.w * 16;
        w *= this.zoom;
        let h = this.selection.h * 16;
        h *= this.zoom;
        const colors = ['green', 'blue', 'red', 'white'];
        let c = colors[this.l];

        // draw the cursor around the selected trigger
        if (this.l === 3) {
            if (!this.selectedTrigger || this.triggers.indexOf(this.selectedTrigger) === -1) return;
            x = this.selectedTrigger.x.value * 16 * this.zoom;
            y = this.selectedTrigger.y.value * 16 * this.zoom;
            w = 16 * this.zoom;
            h = 16 * this.zoom;

            switch (this.selectedTrigger.key) {
                case 'eventTriggers':
                case 'mapTriggers':
                    c = 'rgba(0, 0, 255, 1.0)'; break;
                case 'worldTriggers':
                case 'entranceTriggers':
                    c = 'rgba(255, 0, 0, 1.0)'; break;
                case 'treasureProperties':
                    c = 'rgba(255, 255, 0, 1.0)'; break;
                case 'npcProperties':
                    c = 'rgba(128, 128, 128, 1.0)'; break;
            }
        }

        // draw the cursor
        w = Math.min(this.ppu.width * this.zoom - x, w);
        h = Math.min(this.ppu.height * this.zoom - y, h);
        if (w <= 0 || h <= 0) return;

        // set up the cursor canvas
        this.cursorCanvas.width = w;
        this.cursorCanvas.height = h;
        this.cursorCanvas.style.left = `${x}px`;
        this.cursorCanvas.style.top = `${y}px`;
        this.cursorCanvas.style.display = 'block';
        const context = this.cursorCanvas.getContext('2d');

        // convert the selection to screen coordinates
        context.lineWidth = 1;
        context.strokeStyle = 'black';
        x = 0.5; y = 0.5; w--; h--;
        context.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        context.strokeStyle = c;
        context.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        context.strokeStyle = 'white';
        context.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        context.strokeStyle = 'black';
        context.strokeRect(x, y, w, h);
    }

    reloadTriggers() {
        this.loadTriggers();
        this.drawMap();
    }

    loadTriggers() {

        this.triggers = [];

        // load triggers
        let triggers = this.rom.mapTriggers.item(this.m);
        if (this.isWorld) triggers = this.rom.worldTriggers.item(this.m - 0xFB);
        for (let i = 0; i < triggers.arrayLength; i++) {
            const trigger = triggers.item(i);
            if (trigger.map.value === 0xFE) {
                trigger.key = 'treasureProperties';
                trigger.name = 'Treasure Properties';
                if (this.m >= 256 && trigger.battle.offset !== 0x01E0) {
                    trigger.battle.value += 32;
                    trigger.battle.offset = 0x01E0;
                }
            } else if (trigger.map.value === 0xFF) {
                trigger.key = 'eventTriggers';
                trigger.name = 'Event Trigger';
            } else {
                trigger.key = 'entranceTriggers';
                trigger.name = 'Entrance Trigger';
                if (this.m >= 252 && trigger.map.offset !== 256) {
                    trigger.map.value += 256;
                    trigger.map.offset = 256;
                }
            }
            this.observer.startObservingSub(trigger, this.reloadTriggers);
            this.triggers.push(trigger);
        }

        // load npcs
        if (this.isWorld) return;
        let npcIndex = this.mapProperties.npc.value;
        if (npcIndex === 0 && this.m !== 0) return;
        let offset = 0;
        if (this.mapProperties.npcMSB.value || this.m >= 256) {
            npcIndex += 256;
            offset = 256;
        }
        const npcProperties = this.rom.npcProperties.item(npcIndex);
        const npcGraphics = this.rom.npcGraphicsProperties;
        this.observer.startObserving([
            this.mapProperties.npc,
            this.mapProperties.npcMSB,
            this.mapProperties.npcPalette1,
            this.mapProperties.npcPalette2
        ], this.reloadTriggers);

        for (let i = 0; i < npcProperties.arrayLength; i++) {
            const npc = npcProperties.item(i);
            if (npc.switch.offset !== offset) {
                npc.switch.value += offset;
                npc.switch.offset = offset;
            }
            const graphics = npcGraphics.item(npc.switch.value).graphics;
            this.observer.startObserving([
                graphics,
                npc.palette,
                npc.switch,
                npc.direction,
                npc.x,
                npc.y
            ], this.reloadTriggers);
            this.triggers.push(npc);
        }
    }

    selectTrigger(trigger) {
        this.selectedTrigger = trigger;
        propertyList.select(trigger);
        if (!trigger) return;
        this.triggerPoint = {
            x: this.selectedTrigger.x.value,
            y: this.selectedTrigger.y.value
        };

        if (this.selectedTrigger.key === 'npcProperties') {
            const script = this.rom.npcScript.item(trigger.switch.value);
            propertyList.select(script);
        } else if (this.selectedTrigger instanceof ROMCommand) {
            const script = this.selectedTrigger.parent;
            propertyList.select(script);
            scriptList.selectCommand(this.selectedTrigger);
        } else if (this.selectedTrigger.object) {
            trigger = this.selectedTrigger.object;
        }
        propertyList.select(trigger);
    }

    insertTrigger(type) {

        let triggers = this.rom.mapTriggers.item(this.m);
        if (this.isWorld) triggers = this.rom.worldTriggers.item(this.m - 0xFB);

        const trigger = triggers.blankAssembly();

        this.beginAction(this.reloadTriggers);
        trigger.x.setValue(this.clickPoint.x);
        trigger.y.setValue(this.clickPoint.y);
        if (type === 'treasureProperties') {
            trigger.map.setValue(0xFE);

            // treasures have to come first
            let i = 0;
            while (i < triggers.arrayLength && triggers.item(i).map.value === 0xFE) i++;
            triggers.insertAssembly(trigger, i);
            this.updateTreasures();

        } else if (type === 'eventTriggers') {
            trigger.map.setValue(0xFF);
            triggers.insertAssembly(trigger);
        } else {
            triggers.insertAssembly(trigger);
        }
        this.endAction(this.reloadTriggers);

        this.selectedTrigger = trigger;
        propertyList.select(trigger);
    }

    updateTreasures() {
        let t = 0;
        for (let m = 0; m < this.rom.mapProperties.arrayLength; m++) {
            if (m === 256) t = 0; // reset to zero for underground/moon treasures
            this.rom.mapProperties.item(m).treasure.setValue(t);
            const triggers = this.rom.mapTriggers.item(m);
            for (const trigger of triggers.iterator()) {
                if (trigger.map.value === 0xFE) t++;
            }
        }
    }

    insertNPC() {

        // get the npc properties
        if (this.isWorld) return;
        const npcIndex = this.mapProperties.npc.value;
        if (npcIndex === 0 && this.m !== 0) return;
        const npcProperties = this.rom.npcProperties.item(npcIndex);

        const npc = npcProperties.blankAssembly();

        this.beginAction(this.reloadTriggers);
        npc.x.setValue(this.clickPoint.x);
        npc.y.setValue(this.clickPoint.y);
        npc.switch.setValue(1);
        npcProperties.insertAssembly(npc);
        this.endAction(this.reloadTriggers);

        this.selectedTrigger = npc;
        propertyList.select(npc);
    }

    deleteTrigger() {

        const trigger = this.selectedTrigger;
        if (!trigger) return;
        const triggers = trigger.parent;
        const index = triggers.array.indexOf(trigger);
        if (index === -1) return;

        this.beginAction(this.reloadTriggers);
        triggers.removeAssembly(index);
        this.endAction(this.reloadTriggers);

        this.selectedTrigger = null;
        propertyList.select(null);
    }

    drawTriggerRect(x, y, color, context) {

        // function for drawing trigger rectangles with rounded corners
        const r = this.zoom * 2;
        const s = this.zoom * 16 - 4 + 1;

        context.lineWidth = 1;
        context.strokeStyle = 'white';
        context.fillStyle = color;

        context.beginPath();
        context.moveTo(x, y + r);
        context.arcTo(x, y, x + r, y, r);
        context.lineTo(x + s - r, y);
        context.arcTo(x + s, y, x + s, y + r, r);
        context.lineTo(x + s, y + s - r);
        context.arcTo(x + s, y + s, x + s - r, y + s, r);
        context.lineTo(x + r, y + s);
        context.arcTo(x, y + s, x, y + s - r, r);
        context.closePath();
        context.fill();
        context.stroke();
    }

    drawTriggers() {

        if (!this.showTriggers) return;

        const xClient = this.mapRect.l;
        const yClient = this.mapRect.t;
        const context = this.canvas.getContext('2d');
        context.globalCompositeOperation = 'source-over';

        for (const trigger of this.triggers) {
            const triggerRect = this.rectForTrigger(trigger);
            if (this.mapRect.intersect(triggerRect).isEmpty()) continue;
            let color = 'purple';
            switch (trigger.key) {
                case 'eventTriggers':
                    color = 'rgba(0, 0, 255, 0.5)';
                    break;
                case 'entranceTriggers':
                    color = 'rgba(255, 0, 0, 0.5)';
                    break;
                case 'treasureProperties':
                    color = 'rgba(255, 255, 0, 0.5)';
                    break;
                case 'npcProperties':
                    color = 'rgba(128, 128, 128, 0.5)';
                    break;
                default:
                    break;
            }
            const x = trigger.x.value * this.zoom * 16 + 2 - 0.5 - xClient;
            const y = trigger.y.value * this.zoom * 16 + 2 - 0.5 - yClient;
            this.drawTriggerRect(x, y, color, context);
        }
    }

    drawNPCs() {
        if (!this.showTriggers) return;

        // draw npcs (sort by y-coordinate and sprite priority)
        const npcs = this.triggers.filter(function(trigger) {
            return (trigger.key === 'npcProperties');
        }).sort(function(trigger1, trigger2) {
            const y1 = trigger1.y.value;
            const y2 = trigger2.y.value;
            return y1 - y2;
        });
        for (let i = 0; i < npcs.length; i++) {
            const npc = npcs[i];
            this.drawNPC(npc);
        }
    }

    triggerAt(x, y) {

        const triggers = this.triggersAt(x, y);
        if (triggers.length === 0) return null;
        return triggers[0];
    }

    triggersAt(x, y) {
        const triggers = [];

        for (const trigger of this.triggers) {
            const rect = this.rectForTrigger(trigger);
            if (rect.containsPoint(x, y)) triggers.push(trigger);
        }
        return triggers;
    }

    rectForTrigger(trigger) {
        const l = trigger.x.value * 16 * this.zoom;
        const r = l + 16 * this.zoom;
        const t = trigger.y.value * 16 * this.zoom;
        const b = t + 16 * this.zoom;
        return new Rect(l, r, t, b);
    }

    drawNPC(npc) {

        const x = npc.x.value * 16;
        const y = npc.y.value * 16;
        const w = 16;
        const h = 16;

        const index = npc.switch.value;
        const g = this.rom.npcPointers.item(index).graphics.graphics.value;
        const direction = npc.direction.value;
        let p = npc.palette.value;

        // decode palette
        const pal = new Uint32Array(0x80);
        const p1 = this.mapProperties.npcPalette1.value * 2;
        const p2 = this.mapProperties.npcPalette2.value * 2;
        pal.set(this.rom.mapSpritePalettes.item(0).data, 0x00);
        pal.set(this.rom.mapSpritePalettes.item(1).data, 0x10);
        pal.set(this.rom.mapSpritePalettes.item(2).data, 0x20);
        pal.set(this.rom.mapSpritePalettes.item(3).data, 0x30);
        pal.set(this.rom.npcPalettes.item(p1).data, 0x40);
        pal.set(this.rom.npcPalettes.item(p1 + 1).data, 0x50);
        pal.set(this.rom.npcPalettes.item(p2).data, 0x60);
        pal.set(this.rom.npcPalettes.item(p2 + 1).data, 0x70);
        if (g < 14) {
            // character palette (from 15/B2FA)
            const characterPalettes = [0, 0, 1, 2, 2, 2, 0, 1, 1, 3, 0, 1, 0, 0, 0, 0, 0, 0];
            p = characterPalettes[g] << 20;
        } else {
            // npc palette
            p += 4;
            p <<= 20;
        }

        const spriteGraphics = this.rom.mapSpriteGraphics.item(g).data;
        const tileCount = spriteGraphics.length >> 6;
        let offset = 0;
        let tileData = new Uint32Array([0 | p, 1 | p, 2 | p, 3 | p]);
        if (direction === 0 && tileCount > 1) {
            // up
            offset = 0x100;
        } else if (direction === 1 && tileCount > 2) {
            // right
            offset = 0x200;
            p |= 0x10000000;
            tileData = new Uint32Array([1 | p, 0 | p, 3 | p, 2 | p]);
        } else if (direction === 2) {
            // down
            offset = 0;
        } else if (direction === 3 && tileCount > 2) {
            // left
            offset = 0x200;
        }

        const gfx = spriteGraphics.subarray(offset, offset + 0x100);

        // sprite are shifted up by 2 pixels
        let npcRect = new Rect(x, x + w, y - 2, y + h - 2);
        npcRect = npcRect.scale(this.zoom);
        if (this.mapRect.intersect(npcRect).isEmpty()) return;

        // set up the ppu
        const ppu = new GFX.PPU();
        ppu.pal = this.rom.gammaCorrectedPalette(pal);
        ppu.width = w;
        ppu.height = h;

        // layer 1
        ppu.layers[0].cols = w >> 3;
        ppu.layers[0].rows = h >> 3;
        ppu.layers[0].z[0] = GFX.Z.snesS0;
        ppu.layers[0].z[1] = GFX.Z.snesS1;
        ppu.layers[0].z[2] = GFX.Z.snesS2;
        ppu.layers[0].z[3] = GFX.Z.snesS3;
        ppu.layers[0].gfx = gfx;
        ppu.layers[0].tiles = tileData;
        ppu.layers[0].main = true;

        // draw the npc
        this.npcCanvas.width = w;
        this.npcCanvas.height = h;
        const npcContext = this.npcCanvas.getContext('2d');
        const imageData = npcContext.createImageData(w, h);
        ppu.renderPPU(imageData.data);
        npcContext.putImageData(imageData, 0, 0);

        const ctx = this.canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.globalCompositeOperation = 'source-over';
        npcRect = npcRect.offset(-this.mapRect.l, -this.mapRect.t);
        ctx.drawImage(this.npcCanvas, 0, 0, w, h, npcRect.l, npcRect.t, npcRect.w, npcRect.h);
    }
}

FF4Map.TileMasks = {
    none: 'None',
    zUpper: 'Passable on Upper Z-Level',
    zLower: 'Passable on Lower Z-Level',
    triggers: 'Trigger Tiles',
    battle: 'Enable Random Battles',
    spriteVisibility: 'Sprite Visibility'
}

FF4Map.WorldTileMasks = {
    none: 'None',
    zUpper: 'Passable on Upper Z-Level',
    zLower: 'Passable on Lower Z-Level',
    triggers: 'Trigger Tiles',
    chocoboNoLava: 'Chocobo Can Move/Lava',
    blackChocoboFly: 'Black Chocobo Can Fly',
    blackChocoboLand: 'Black Chocobo Can Land',
    hovercraft: 'Hovercraft Can Move',
    airshipFly: 'Airship Can Fly (No Lava)',
    airshipLand: 'Airship Can Land',
    lunarWhale: 'Lunar Whale Can Fly',
    battle: 'Enable Random Battles',
    forest: 'Hide Bottom of Sprite',
    unknown: 'Unknown 1.2'
}

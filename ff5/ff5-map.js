//
// ff5-map.js
// created 3/13/2018
//

class FF5Map extends ROMEditor_ {
    constructor(rom) {
        super(rom);

        this.name = 'FF5Map';
        this.tileset = new FF5MapTileset(rom, this);

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
        this.menu = document.getElementById('menu');

        this.mapProperties = null;
        this.m = null; // map index
        this.world = 0; // bartz' world, galuf's world, or underwater
        this.isWorld = false;
        this.l = 0; // selected layer
        this.zoom = 1.0; // zoom multiplier
        this.selection = {
            x: 0, y: 0, w: 1, h: 1,
            tilemap: new Uint8Array(1)
        };
        this.clickPoint = null;
        this.triggerPoint = null;
        this.isDragging = false;
        this.layer = [new FF5MapLayer(rom),
                      new FF5MapLayer(rom),
                      new FF5MapLayer(rom)];
        this.selectedLayer = this.layer[0];
        this.showCursor = true;
        this.showLayer1 = true;
        this.showLayer2 = true;
        this.showLayer3 = true;
        this.showTriggers = true;
        this.showScreen = false;
        this.triggers = [];
        this.selectedTrigger = null;
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

        this.updateTilesetDefinitions();
    }

    updateTilesetDefinitions() {
        for (const tileset of this.rom.mapTilesets.iterator()) {
            tileset.palette = [];
            tileset.graphics = [];
        }

        for (let m = 3; m < this.rom.mapProperties.arrayLength; m++) {
            const mapProperties = this.rom.mapProperties.item(m);
            const t = mapProperties.tileset.value;
            const g1 = mapProperties.gfx1.value;
            const g2 = mapProperties.gfx2.value;
            const g3 = mapProperties.gfx3.value;
            const p = mapProperties.palette.value;

            // skip dummy maps
            if (g1 + g2 + g3 === 0) continue;

            const graphicsDefinition = [
                {
                    path: `mapGraphics[${g1}]`,
                    offset: 0x0000
                }, {
                    path: `mapGraphics[${g2}]`,
                    offset: 0x4000
                }, {
                    path: `mapGraphics[${g3}]`,
                    offset: 0x8000
                }
            ];

            const paletteDefinition = `mapPalettes[${p}]`;

            const tileset = this.rom.mapTilesets.item(t);

            if (!tileset.graphics.length) {
                tileset.graphics.push(graphicsDefinition);
            }
            if (!tileset.palette.includes(paletteDefinition)) {
                tileset.palette.push(paletteDefinition);
            }
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

        if (this.m < 5) {
            // world map
            this.isWorld = true;
            this.world = this.rom.isSFC ? 0 : 1; // worlds are swapped in gba versions
            if (this.m === 1) this.world ^= 1;
            if (this.m > 2) this.world = 2; // sea floor
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
        this.addTwoState('showLayer3', function() {
            self.changeLayer('showLayer3');
        }, 'Layer 3', this.showLayer3);
        this.addTwoState('showTriggers', function() {
            self.changeLayer('showTriggers');
        }, 'Triggers', this.showTriggers);

        // add screen mask button
        this.addTwoState('showScreen', function() {
            self.changeLayer('showScreen');
        }, 'Screen', this.showScreen);

        // add zoom control
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

        this.closeMenu();

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

        this.closeMenu();
        this.clickPoint = this.getEventPoint(e);

        // update the selection position
        this.selection.x = this.clickPoint.x;
        this.selection.y = this.clickPoint.y;

        if (this.l === 3) {
            const triggers = this.triggersAt(e.offsetX, e.offsetY);
            const index = triggers.indexOf(this.selectedTrigger);
            if (index !== -1) {
                // select the next trigger in a stack
                this.selectedTrigger = triggers[(index + 1) % triggers.length];
                propertyList.select(this.selectedTrigger);
                this.isDragging = true;
                this.triggerPoint = {
                    x: this.selectedTrigger.x.value,
                    y: this.selectedTrigger.y.value
                };
                this.reloadTriggers();
            } else if (triggers.length !== 0) {
                // select the first trigger
                this.selectedTrigger = triggers[0];
                propertyList.select(this.selectedTrigger);
                this.isDragging = true;
                this.triggerPoint = {
                    x: this.selectedTrigger.x.value,
                    y: this.selectedTrigger.y.value
                };
            } else {
                // clear trigger selection selection and select map properties
                this.selectedTrigger = null;
                if (this.m < 3) {
                    this.selectWorldBattle(this.clickPoint.x, this.clickPoint.y)
                } else if (this.m >= 5) {
                    propertyList.select(this.mapProperties);
                }
                this.isDragging = false;
            }
        } else if (this.clickPoint.button === 2) {
            this.selectTiles();
            this.isDragging = true;

        } else {
            this.beginAction();
            this.rom.pushAction(new ROMAction(this, this.drawMap, null, 'Redraw Map'));
            this.rom.doAction(new ROMAction(this.selectedLayer, this.selectedLayer.decodeLayout, null, 'Decode Layout'));
            this.setTiles();
            this.isDragging = true;
        }

        this.drawScreen();
        this.drawCursor();
    }

    mouseMove(e) {

        // return if the menu is open
        if (this.menu.classList.contains('active')) return;

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

            if (this.selectedTrigger.x.value !== point.x ||
                this.selectedTrigger.y.value !== point.y) {
                this.selectedTrigger.x.value = point.x;
                this.selectedTrigger.y.value = point.y;
                this.invalidateMap(this.rectForTrigger(this.selectedTrigger).scale(1 / this.zoom));
                this.drawMap();
            }
        } else if (this.clickPoint && this.clickPoint.button === 2) {
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
            this.endAction(this.drawMap);
        }

        this.isDragging = false;
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
        this.drawScreen();
        this.drawCursor();

        this.mouseUp(e);
    }

    openMenu(e) {
        if (this.l !== 3) return; // no menu unless editing triggers
        this.updateMenu();

        this.clickPoint = this.getEventPoint(e);

        this.menu.classList.add('menu-active');
        this.menu.style.left = `${e.x}px`;
        this.menu.style.top = `${e.y}px`;
    }

    closeMenu() {
        this.menu.classList.remove('menu-active');
    }

    updateMenu() {
        this.menu.innerHTML = '';

        const self = this;
        function appendMenuItem(label, onclick) {
            const li = document.createElement('li');
            li.classList.add('menu-item');
            li.innerHTML = label;
            if (onclick) {
                li.onclick = onclick;
            } else {
                li.classList.add('menu-item-disabled');
            }
            self.menu.appendChild(li);
        }

        appendMenuItem('Insert Entrance Trigger', function() {
            self.insertTrigger('entranceTriggers');
        });
        appendMenuItem('Insert Event Trigger', function() {
            self.insertTrigger('eventTriggers');
        });
        appendMenuItem('Insert Treasure', !this.isWorld ? function() {
            self.insertTrigger('treasureProperties');
        } : null);
        appendMenuItem('Insert NPC', !this.isWorld ? function() {
            self.insertTrigger('npcProperties');
        } : null);
        appendMenuItem('Delete Trigger', this.selectedTrigger ? function() {
            self.deleteTrigger();
        } : null);
    }

    setTiles() {
        // return if not dragging
        if (!this.clickPoint) return;

        const x = this.selection.x;
        const y = this.selection.y;
        const w = this.selection.w;
        const h = this.selection.h;

        const l = ((x << 4) - this.ppu.layers[this.l].x) & (this.ppu.width - 1);
        const r = l + (w << 4);
        const t = ((y << 4) - this.ppu.layers[this.l].y) & (this.ppu.height - 1);
        const b = t + (h << 4);
        const rect = new Rect(l, r, t, b);

        this.selectedLayer.setLayout(this.selection);
        const self = this;
        function invalidate() { self.invalidateMap(rect); };
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
        if (this.m > 2) return;

        x >>= 5;
        y >>= 5;

        const sector = x | (y << 3) | (this.m << 6);
        const battleGroup = this.rom.worldBattleGroup.item(sector);
        propertyList.select(battleGroup);
    }

    selectTileProperties(t) {

        if (this.l !== 0) return;

        // select tile properties
        const tileProperties = this.tilePropertiesAtTile(t);
        if (tileProperties) propertyList.select(tileProperties);
    }

    tilePropertiesAtTile(t) {
        if (this.selectedLayer.type === FF5MapLayer.Type.layer1) {
            // layer 1 tile properties determined by graphics index
            const tp = this.mapProperties.tileProperties.value;
            return this.rom.mapTileProperties.item(tp).item(t);
        } else if (this.selectedLayer.type === FF5MapLayer.Type.world) {
            // world map tile properties
            return this.rom.worldTileProperties.item(this.world).item(t);
        }
        return null;
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
        const mp = this.rom.mapProperties.item(this.m);
        const colorMath = this.rom.mapColorMath.item(mp.colorMath.value);
        this.ppu.layers[0].main = this.showLayer1;
        if (!this.isWorld) {
            this.ppu.layers[0].sub = this.showLayer1 && colorMath.sub1.value;
            this.ppu.layers[1].main = this.showLayer2 && colorMath.main2.value;
            this.ppu.layers[1].sub = this.showLayer2 && colorMath.sub2.value;
            this.ppu.layers[2].main = this.showLayer3 && colorMath.main3.value;
            this.ppu.layers[2].sub = this.showLayer3 && colorMath.sub3.value;
        }
        this.invalidateMap();
        this.drawMap();
    }

    loadMap(m) {

        this.resetControls();
        const mp = this.mapProperties;

        this.observer.stopObservingAll();
        this.observer.startObserving([
            mp.gfx1, mp.gfx2, mp.gfx3,
            mp.gfxLayer3,
            mp.animation,
            mp.tileset,
            mp.palette,
            mp.layout1, mp.layout2, mp.layout3,
            mp.tiledLayer2, mp.tiledLayer3,
            mp.tileProperties,
            mp.colorMath,
            mp.vOffsetLayer2, mp.hOffsetLayer2,
            mp.vOffsetLayer3, mp.hOffsetLayer3
        ], this.loadMap);

        // observe tile properties (redraw map and tileset, don't reload map)
        const self = this;
        const tp = this.rom.mapTileProperties.item(mp.tileProperties.value);
        for (const tile of tp.iterator()) {
            this.observer.startObservingSub(tile, function() {
                self.drawMap();
                self.tileset.redraw();
            });
        }

        const battleEditor = propertyList.getEditor('FF5Battle');
        if (battleEditor) battleEditor.bg = this.mapProperties.battleBackground.value;

        // load graphics
        const gfx = new Uint8Array(0x10000);
        const gfx1 = this.rom.mapGraphics.item(mp.gfx1.value);
        const gfx2 = this.rom.mapGraphics.item(mp.gfx2.value);
        const gfx3 = this.rom.mapGraphics.item(mp.gfx3.value);
        this.observer.startObserving(gfx1, this.loadMap);
        this.observer.startObserving(gfx2, this.loadMap);
        this.observer.startObserving(gfx3, this.loadMap);
        gfx.set(gfx1.data, 0x0000);
        gfx.set(gfx2.data, 0x4000);
        gfx.set(gfx3.data, 0x8000);

        // load layer 3 graphics
        const graphicsLayer3 = this.rom.mapGraphicsLayer3.item(mp.gfxLayer3.value);
        this.observer.startObserving(graphicsLayer3, this.loadMap);
        gfx.set(graphicsLayer3.data, 0xC000);

        if (mp.animation.value) {
            // load animation graphics
            const animGfx = this.rom.mapAnimationGraphics;
            const anim = this.rom.mapAnimationProperties.item(mp.tileset.value);
            const animGfx2 = this.rom.mapAnimationGraphics2;
            if (this.rom.isSFC) {
                for (let i = 0; i < 8; i++) {
                    const flag = anim[`flag${i + 1}`].value;
                    const t = anim[`tile${i + 1}`].value;
                    if (flag) {
                        gfx.set(GFX.graphicsFormat.snes4bpp.decode(animGfx.data.subarray(t, t + 0x80))[0], 0xB800 + i * 0x0100);
                    } else {
                        gfx.set(GFX.graphicsFormat.snes4bpp.decode(animGfx2.data.subarray(t, t + 0x80))[0], 0xB800 + i * 0x0100);
                    }
                }
            } else {
                for (let i = 0; i < 8; i++) {
                    const t = anim[`tile${i + 1}`].value * 0x20;
                    gfx.set(GFX.graphicsFormat.linear4bpp.decode(animGfx.data.subarray(t, t + 0x80))[0], 0xB800 + i * 0x0100);
                }
            }

            // load layer 3 animation graphics
            if (this.rom.isSFC) {
                for (let i = 0; i < 4; i++) {
                    const flag = anim[`flag${i + 1}Layer3`].value;
                    const t = anim[`tile${i + 1}Layer3`].value;
                    if (flag) {
                        gfx.set(GFX.graphicsFormat.snes2bpp.decode(animGfx.data.subarray(t, t + 0x40))[0], 0xFC00 + i * 0x0100);
                    } else {
                        gfx.set(GFX.graphicsFormat.snes2bpp.decode(animGfx2.data.subarray(t, t + 0x40))[0], 0xFC00 + i * 0x0100);
                    }
                }
            } else {
                for (let i = 0; i < 4; i++) {
                    const t = anim[`tile${i + 1}Layer3`].value * 0x20;
                    gfx.set(GFX.graphicsFormat.linear4bpp.decode(animGfx.data.subarray(t, t + 0x80))[0], 0xFC00 + i * 0x0100);
                }
            }
        }

        // load palette
        const paletteObject = this.rom.mapPalettes.item(mp.palette.value);
        this.observer.startObserving(paletteObject, this.loadMap);
        const pal = new Uint32Array(paletteObject.data);
        pal[0] = 0xFF000000; // set background color to black

        const tileset = this.rom.mapTilesets.item(mp.tileset.value).data;

        // layer 3 palettes are only 4 colors each
        const tileset3 = tileset.slice();
        for (let i = 0; i < tileset3.length; i++) {
            let p = tileset3[i] & 0x00FF0000;
            p >>= 2;
            tileset3[i] &= 0xFF00FFFF;
            tileset3[i] |= p & 0x00FF0000;
        }

        // tile priority is stored separately for GBA version
        let tilePriority = null;
        if (this.rom.isGBA) tilePriority = this.rom.mapTilePriority.item(mp.tileset.value);

        // load and de-interlace tile layouts
        let layout1;
        if (mp.layout1.value) {
            layout1 = this.rom.mapLayouts.item(mp.layout1.value - 1);
            if (layout1.lazyData && layout1.lazyData.length === 1) {
                const fill = layout1.lazyData[0];
                layout1 = new Uint32Array(0x1000);
                layout1.fill(fill);
            }
        } else {
            layout1 = new Uint32Array(0x1000);
            layout1.fill(1);
        }
        let w = 64;
        let h = 64;
        this.layer[0].loadLayout({
            type: FF5MapLayer.Type.layer1,
            layout: layout1,
            tileset: tileset,
            w: w, h: h,
            tilePriority: tilePriority
        });

        let layout2;
        if (mp.layout2.value) {
            layout2 = this.rom.mapLayouts.item(mp.layout2.value - 1);
            if (layout2.lazyData && layout2.lazyData.length === 1) {
                const fill = layout2.lazyData[0];
                layout2 = new Uint32Array(0x1000);
                layout2.fill(fill);
            }
        } else {
            layout2 = new Uint32Array(0x1000);
            layout2.fill(1);
        }
        w = 64;
        h = mp.tiledLayer2.value ? 16 : 64;
        this.layer[1].loadLayout({
            type: FF5MapLayer.Type.layer2,
            layout: layout2,
            tileset: tileset,
            w: w, h: h,
            tilePriority: tilePriority
        });

        let layout3;
        if (mp.layout3.value) {
            layout3 = this.rom.mapLayouts.item(mp.layout3.value - 1);
            if (layout3.lazyData && layout3.lazyData.length === 1) {
                const fill = layout3.lazyData[0];
                layout3 = new Uint32Array(0x1000);
                layout3.fill(fill);
            }
        } else {
            layout3 = new Uint32Array(0x1000);
            layout3.fill(1);
        }
        w = 64;
        h = mp.tiledLayer3.value ? 16 : 64;
        this.layer[2].loadLayout({
            type: FF5MapLayer.Type.layer3,
            layout: layout3,
            tileset: tileset3,
            w: w, h: h,
            tilePriority: tilePriority
        });

        // get color math properties
        const colorMath = this.rom.mapColorMath.item(mp.colorMath.value);
        this.observer.startObservingSub(colorMath, this.loadMap);

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(pal);
        this.ppu.height = 64 * 16;
        this.ppu.width = 64 * 16;
        this.ppu.back = true;
        this.ppu.subtract = colorMath.subtract.value;
        this.ppu.half = colorMath.half.value;

        // layer 1
        this.ppu.layers[0].cols = this.layer[0].w * 2;
        this.ppu.layers[0].rows = this.layer[0].h * 2;
        this.ppu.layers[0].z[0] = GFX.Z.snes1L;
        this.ppu.layers[0].z[1] = GFX.Z.snes1H;
        this.ppu.layers[0].gfx = gfx;
        this.ppu.layers[0].tiles = this.layer[0].tiles;
        this.ppu.layers[0].main = this.showLayer1; // layer 1 always in main screen
        this.ppu.layers[0].sub = this.showLayer1 && colorMath.sub1.value;
        this.ppu.layers[0].math = colorMath.layer1.value;

        // layer 2
        this.ppu.layers[1].cols = this.layer[1].w * 2;
        this.ppu.layers[1].rows = this.layer[1].h * 2;
        this.ppu.layers[1].x = -mp.hOffsetLayer2.value * 16;
        this.ppu.layers[1].y = -mp.vOffsetLayer2.value * 16;
        this.ppu.layers[1].z[0] = GFX.Z.snes2L;
        this.ppu.layers[1].z[1] = GFX.Z.snes2H;
        this.ppu.layers[1].gfx = gfx;
        this.ppu.layers[1].tiles = this.layer[1].tiles;
        this.ppu.layers[1].main = this.showLayer2 && colorMath.main2.value;
        this.ppu.layers[1].sub = this.showLayer2 && colorMath.sub2.value;
        this.ppu.layers[1].math = colorMath.layer2.value;

        // layer 3
        this.ppu.layers[2].cols = this.layer[2].w * 2;
        this.ppu.layers[2].rows = this.layer[2].h * 2;
        this.ppu.layers[2].x = -mp.hOffsetLayer3.value * 16;
        this.ppu.layers[2].y = -mp.vOffsetLayer3.value * 16;
        this.ppu.layers[2].z[0] = GFX.Z.snes3L;
        this.ppu.layers[2].z[1] = GFX.Z.snes3P; // always high priority layer 3
        this.ppu.layers[2].gfx = gfx.subarray(0xC000);
        this.ppu.layers[2].tiles = this.layer[2].tiles;
        this.ppu.layers[2].main = this.showLayer3 && colorMath.main3.value;
        this.ppu.layers[2].sub = this.showLayer3 && colorMath.sub3.value;
        this.ppu.layers[2].math = colorMath.layer3.value;

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

    loadWorldMap(m) {

        this.resetControls();
        this.observer.stopObservingAll();
        this.mapProperties = null;

        // load graphics and layout
        const gfx = this.rom.worldGraphics.item(this.world);
        const palette = this.rom.worldPalettes.item(this.world);
        const tileset = this.rom.worldTilesets.item(this.world);

        this.observer.startObserving(gfx, this.loadMap);
        this.observer.startObserving(palette, this.loadMap);
        this.observer.startObserving(tileset, this.loadMap);

        let paletteAssignment = null;
        if (this.rom.isSFC) {
            paletteAssignment = this.rom.worldPaletteAssignments.item(this.world);
            this.observer.startObserving(paletteAssignment, this.loadMap);
        }

        const layout = [];
        if (this.rom.isSFC) {
            for (let i = 0; i < 256; i++) layout.push(this.rom.worldLayouts.item(this.m * 256 + i));
        } else {
            for (let i = 0; i < 256; i++) layout.push(this.rom.worldLayouts.item(this.m).layout.item(i));
        }

        this.layer[0].type = FF5MapLayer.Type.world;
        this.layer[0].loadLayout({
            type: FF5MapLayer.Type.world,
            layout: layout,
            tileset: tileset.data,
            w: 256, h: 256,
            paletteAssignment: paletteAssignment
        });

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(palette.data);
        this.ppu.width = 256 * 16;
        this.ppu.height = 256 * 16;
        this.ppu.back = true;

        // layer 1
        this.ppu.layers[0].cols = 256 * 2;
        this.ppu.layers[0].rows = 256 * 2;
        this.ppu.layers[0].z[0] = GFX.Z.snes1L;
        this.ppu.layers[0].z[1] = GFX.Z.snes1H;
        this.ppu.layers[0].gfx = gfx.data;
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
        const clipX = Math.floor(this.ppu.width / 256);
        const clipY = Math.floor(this.ppu.height / 256);
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
        const clip = Math.floor(this.ppu.width / 256);

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

        // this.drawMask();
        this.drawTriggers();
        this.drawScreen();
        this.drawCursor();
    }

    drawScreen() {

        this.screenCanvas.style.display = 'none';
        if (!this.showScreen) return;

        // calculate the screen rect
        const x = ((this.selection.x * 16) - this.ppu.layers[this.l].x) & (this.ppu.width - 1);
        const y = ((this.selection.y * 16) - this.ppu.layers[this.l].y) & (this.ppu.height - 1);
        let screenRect = new Rect(x - 7 * 16 + 8, x + 9 * 16 - 8, y - 7 * 16 + 1, y + 7 * 16 + 1);
        if (this.rom.isGBA) {
            screenRect.t += 39;
            screenRect.b -= 25;
        }

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
        const context = this.screenCanvas.getContext('2d');
        context.globalCompositeOperation = 'source-over'
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, this.screenCanvas.width, this.screenCanvas.height);
        context.globalCompositeOperation = 'destination-out'
        context.fillStyle = 'rgba(0, 0, 0, 1.0)';
        context.fillRect(screenRect.l, screenRect.t, screenRect.w, screenRect.h);
    }

    drawCursor() {

        this.cursorCanvas.style.display = 'none';
        if (!this.showCursor) return;

        const col = this.selection.x;
        const row = this.selection.y;

        // get the cursor geometry and color
        let x = ((col << 4) - this.ppu.layers[this.l].x) & (this.ppu.width - 1);
        x *= this.zoom;
        let y = ((row << 4) - this.ppu.layers[this.l].y) & (this.ppu.height - 1);
        y *= this.zoom;
        let w = this.selection.w * 16;
        w *= this.zoom;
        let h = this.selection.h * 16;
        h *= this.zoom;
        const colors = ['green', 'blue', 'red', 'white'];
        let c = colors[this.l];

        // draw the cursor around the selected trigger
        if (this.l === 3) {
            if (!this.selectedTrigger) return;
            x = this.selectedTrigger.x.value * 16 * this.zoom;
            y = this.selectedTrigger.y.value * 16 * this.zoom;
            w = 16 * this.zoom;
            h = 16 * this.zoom;

            switch (this.selectedTrigger.key) {
                case 'eventTriggers': c = 'rgba(0, 0, 255, 1.0)'; break;
                case 'entranceTriggers': c = 'rgba(255, 0, 0, 1.0)'; break;
                case 'treasureProperties': c = 'rgba(255, 255, 0, 1.0)'; break;
                case 'npcProperties': c = 'rgba(128, 128, 128, 1.0)'; break;
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
        const ctx = this.cursorCanvas.getContext('2d');

        // convert the selection to screen coordinates
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'black';
        x = 0.5; y = 0.5; w--; h--;
        ctx.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        ctx.strokeStyle = c;
        ctx.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        ctx.strokeStyle = 'white';
        ctx.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        ctx.strokeStyle = 'black';
        ctx.strokeRect(x, y, w, h);
    }

    reloadTriggers() {
        this.loadTriggers();
        this.drawMap();
    }

    loadTriggers() {

        this.triggers = [];

        for (const trigger of this.rom.eventTriggers.item(this.m).iterator()) {
            this.observer.startObservingSub(trigger, this.reloadTriggers);
            this.triggers.push(trigger);
        }
        for (const trigger of this.rom.entranceTriggers.item(this.m).iterator()) {
            this.observer.startObservingSub(trigger, this.reloadTriggers);
            this.triggers.push(trigger);
        }
        for (const trigger of this.rom.npcProperties.item(this.m).iterator()) {
            this.observer.startObservingSub(trigger, this.reloadTriggers);
            this.triggers.push(trigger);
        }
        for (const trigger of this.rom.treasureProperties.item(this.m).iterator()) {
            this.observer.startObservingSub(trigger, this.reloadTriggers);
            this.triggers.push(trigger);
        }
    }

    insertTrigger(type) {

        this.closeMenu();

        const triggerArray = this.rom[type].item(this.m);
        const newTrigger = triggerArray.blankAssembly();

        this.beginAction(this.reloadTriggers);
        triggerArray.insertAssembly(newTrigger);
        newTrigger.x.setValue(this.clickPoint.x);
        newTrigger.y.setValue(this.clickPoint.y);
        this.endAction(this.reloadTriggers);

        this.selectedTrigger = newTrigger;
        propertyList.select(newTrigger);
    }

    deleteTrigger() {

        this.closeMenu();
        const trigger = this.selectedTrigger;
        if (!trigger) return;
        const triggerArray = trigger.parent;
        const index = triggerArray.array.indexOf(trigger);
        if (index === -1) return;

        this.beginAction(this.reloadTriggers);
        triggerArray.removeAssembly(index);
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
            }
            const x = trigger.x.value * this.zoom * 16 + 2 - 0.5 - xClient;
            const y = trigger.y.value * this.zoom * 16 + 2 - 0.5 - yClient;
            this.drawTriggerRect(x, y, color, context);
        }

        // draw npcs (sort by y-coordinate and sprite priority)
        const self = this;
        const npcs = this.triggers.filter(function(trigger) {
            return (trigger.key === 'npcProperties');
        }).sort(function(a, b) {
            if (a === self.selectedTrigger) return 1;
            if (b === self.selectedTrigger) return -1;
            return a.y.value - b.y.value;
        });
        for (const npc of npcs) {
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

        let x = npc.x.value * 16;
        let y = npc.y.value * 16;
        let w = 16;
        let h = 16;

        let g = npc.graphics.value;
        if (g === 0xFF) return;
        let a = npc.animation.value;
        let direction = npc.direction.value;
        let p = npc.palette.value << 20;

        // set tile data
        let f = direction << 1;
        if (a !== 0 && a !== 5) {
            const specialFrame = [8, 9, 10, 11, 12, 34, 33, 15]; // from C0/4000
            f = specialFrame[direction];
        }

        const spriteFrame = this.rom.mapSpriteFrame.item(f);
        let tiles = [];
        for (let t = 1; t <= 4; t++) {
            let tile = spriteFrame[`tile${t}`].value;
            if (tile & 0x4000) {
                // h-flip
                tile &= 0x03FF;
                tile |= 0x10000000;
            }
            tiles.push(tile | p);
        }

        // decode palette
        const pal = new Uint32Array(0x80);
        pal.set(this.rom.mapSpritePalettes.item(0).data, 0x00);
        pal.set(this.rom.mapSpritePalettes.item(1).data, 0x10);
        pal.set(this.rom.mapSpritePalettes.item(2).data, 0x20);
        pal.set(this.rom.mapSpritePalettes.item(3).data, 0x30);
        pal.set(this.rom.mapSpritePalettes.item(0).data, 0x40);
        pal.set(this.rom.mapSpritePalettes.item(1).data, 0x50);
        pal.set(this.rom.mapSpritePalettes.item(2).data, 0x60);
        pal.set(this.rom.mapSpritePalettes.item(3).data, 0x70);

        // get a pointer to the sprite graphics
        let gfxOffset = 0;
        let tileCount = 0;
        if (g < 0x32) {
            tileCount = 16;
            gfxOffset = g * 0x0200;
        } else if (g < 0x4B) {
            tileCount = 32;
            gfxOffset = (g - 0x32) * 0x0400 + 0x6400;
        } else if (g < 0x52) {
            tileCount = 64;
            gfxOffset = (g - 0x4B) * 0x0800 + 0xC800;
        } else if (g < 0x67) {
            tileCount = 16;
            gfxOffset = (g - 0x52) * 0x0200 + 0x10000;
        } else if (g === 0x67) {
            // hiryuu body
            tileCount = 64;
            w = 32;
            h = 32;
            tiles = [0x00200000, 0x00200001, 0x10200001, 0x10200000,
                     0x00200010, 0x00200011, 0x10200011, 0x10200010,
                     0x00200002, 0x00200003, 0x10200003, 0x10200002,
                     0x00200012, 0x00200013, 0x10200013, 0x10200012];
            gfxOffset = 0x12A00;
            x -= 8;
            y -= 19;

        } else if (g === 0x68) {
            // hiryuu head
            p = 2 << 20; // force palette 2
            p |= (direction << 1); // direction * 2 gives tile offset
            tileCount = 32;
            tiles = [p, p + 1, p + 16, p + 17];
            gfxOffset = 0x136C0;
            y -= 15;
        }
        gfxOffset = gfxOffset << 1;

        // decode graphics
        let rawGraphics;
        if (this.rom.isSFC) {
            rawGraphics = this.rom.mapSpriteGraphics.data;
        } else {
            const rawGraphics1 = this.rom.mapSpriteGraphics1.data;
            const rawGraphics2 = this.rom.mapSpriteGraphics2.data;
            const rawGraphics3 = this.rom.mapSpriteGraphics3.data;
            rawGraphics = new Uint8Array(rawGraphics1.length + rawGraphics2.length + rawGraphics3.length);
            rawGraphics.set(rawGraphics1, 0);
            rawGraphics.set(rawGraphics2, rawGraphics1.length);
            rawGraphics.set(rawGraphics3, rawGraphics1.length + rawGraphics2.length);
        }
        const gfx = rawGraphics.slice(gfxOffset, gfxOffset + tileCount * 0x40);

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
        ppu.layers[0].tiles = tiles;
        ppu.layers[0].main = true;

        // draw the npc
        this.npcCanvas.width = w;
        this.npcCanvas.height = h;
        const npcContext = this.npcCanvas.getContext('2d');
        const imageData = npcContext.createImageData(w, h);
        ppu.renderPPU(imageData.data);
        npcContext.putImageData(imageData, 0, 0);

        const context = this.canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.globalCompositeOperation = 'source-over';
        npcRect = npcRect.offset(-this.mapRect.l, -this.mapRect.t);
        context.drawImage(this.npcCanvas, 0, 0, w, h, npcRect.l, npcRect.t, npcRect.w, npcRect.h);
    }
}

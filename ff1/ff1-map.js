//
// ff1-map.js
// created 10/27/2018
//

class FF1Map extends ROMEditor_ {
    constructor(rom) {
        super(rom);

        this.name = 'FF1Map';
        this.tileset = new FF1MapTileset(rom, this);

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
        this.l = 0; // selected layer
        this.zoom = 1.0; // zoom multiplier
        this.selection = {
            x: 0, y: 0, w: 1, h: 1,
            tilemap: new Uint8Array(1)
        };
        this.clickPoint = null;
        this.isDragging = false;
        this.layer = [new FF1MapLayer(rom)];
        this.selectedLayer = this.layer[0];
        this.triggers = [];
        this.showCursor = false;
        this.showBackground = true;
        this.showRooms = true;
        this.showTriggers = true;
        this.selectedTrigger = null;
        this.isWorld = false;
        this.ppu = new GFX.PPU();

        // mask layer stuff
        this.screenCanvas = document.createElement('canvas');
        this.screenCanvas.id = 'map-screen';
        this.screenCanvas.width = 256;
        this.screenCanvas.width = 256;
        this.scrollDiv.appendChild(this.screenCanvas);

        const self = this;
        this.div.onscroll = function() { self.scroll(); self.redraw(); };
        this.scrollDiv.onmousedown = function(e) { self.mouseDown(e); };
        this.scrollDiv.onmouseup = function(e) { self.mouseUp(e); };
        this.scrollDiv.onmousemove = function(e) { self.mouseMove(e); };
        this.scrollDiv.onmouseenter = function(e) { self.mouseEnter(e); };
        this.scrollDiv.onmouseleave = function(e) { self.mouseLeave(e); };
        this.scrollDiv.oncontextmenu = function(e) { self.openMenu(e); return false; };

        this.updateTilesetDefinitions();
    }

    updateTilesetDefinitions() {

        for (const tileset of this.rom.mapTileset.iterator()) {
            tileset.palette = [];
        }

        const mapStringTable = this.rom.stringTable.mapProperties;
        for (const mapProperties of this.rom.mapProperties.iterator()) {
            const m = mapProperties.i;
            const t = mapProperties.tileset.value;
            const name = mapStringTable.string[m].fString(40);
            const tileset = this.rom.mapTileset.item(t);
            tileset.palette.push({
                name: `${name} (Inside)`,
                path: `mapPalette[${m}]`,
                range: '32-48'
            });
            tileset.palette.push({
                name: `${name} (Outside)`,
                path: `mapPalette[${m}]`,
                range: '0-16'
            });
        }
    }

    show() {
        this.showControls();
        this.tileset.show();
        this.resize();
        super.show();
    }

    hide() {
        super.hide();
        this.mapProperties = null;
        this.tileset.hide();
    }

    selectObject(object) {

        if (this.mapProperties === object) return;

        this.mapProperties = object;

        if (object.key === 'worldMap') {
            this.isWorld = true;
            this.loadWorldMap();
            propertyList.select(null);
        } else {
            this.isWorld = false;
            this.m = object.i;
            this.loadMap();
        }
    }

    resetControls() {
        super.resetControls();

        const self = this;

        this.addTwoState('showBackground', function() {
            self.changeLayer('showBackground');
        }, 'Background', this.showBackground);
        this.addTwoState('showRooms', function() {
            self.changeLayer('showRooms');
        }, 'Rooms', this.showRooms);
        this.addTwoState('showTriggers', function() {
            self.changeLayer('showTriggers');
        }, 'Triggers', this.showTriggers);
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
        this.redraw();
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
                // clear trigger selection
                this.selectedTrigger = null;
                if (this.isWorld) {
                    // select world map battle
                    this.selectWorldBattle(this.clickPoint.x, this.clickPoint.y)
                } else {
                    // select map properties
                    propertyList.select(this.mapProperties);
                }
                this.isDragging = false;
            }
        } else if (this.clickPoint.button === 2) {
            this.selectTiles();
            this.isDragging = true;

        } else {
            this.beginAction(this.redraw);
    //        this.rom.pushAction(new ROMAction(this, this.redraw, null, 'Redraw Map'));
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

            if (this.selectedTrigger.x.value !== point.x || this.selectedTrigger.y.value !== point.y) {
                this.selectedTrigger.x.value = point.x;
                this.selectedTrigger.y.value = point.y;
                this.invalidateMap(this.rectForTrigger(this.selectedTrigger).scale(1 / this.zoom));
                this.redraw();
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
            this.rom.pushAction(new ROMAction(this, null, this.redraw, 'Redraw Map'));
            this.endAction();
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

        // make sure there are unused NPCs
        let isFull = true;
        const npcProperties = this.rom.mapNPC.item(this.m);
        for (const npc of npcProperties.iterator()) {
            if (npc.npcID.value == 0) {
                isFull = false;
                break;
            }
        }

        appendMenuItem('Insert NPC', (this.isWorld || isFull) ? null : function() {
            self.insertNPC()
        });
        appendMenuItem('Delete NPC', this.selectedTrigger ? function() {
            self.deleteNPC()
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
        this.redraw();
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

    selectTileProperties(t) {

        if (this.l !== 0) return;

        // select tile properties
        const tileProperties = this.tilePropertiesAtTile(t);
        if (tileProperties) propertyList.select(tileProperties);
    }

    tilePropertiesAtTile(t) {
        if (this.selectedLayer.type === FF1MapLayer.Type.layer1) {
            // layer 1 tile properties determined by graphics index
            const tp = this.mapProperties.tileset.value;
            return this.rom.mapTileProperties.item(tp).item(t);

        } else if (this.selectedLayer.type === FF1MapLayer.Type.world) {
            // set battle background
            const battleEditor = propertyList.getEditor('FF1Battle');
            battleEditor.bg = this.rom.worldBattleBackground.item(t).background.value;

            // world map tile properties
            return this.rom.worldTileProperties.item(t);
        }
        return null;
    }

    selectLayer(l) {
        // set the selected layer
        l = Number(l);
        if (isNumber(l)) this.l = l;

        if (this.isWorld) {
            this.selectedLayer = this.layer[0];
        } else {
            this.selectedLayer = this.layer[this.l]
        }

        this.showCursor = (this.l === 3);
        this.drawScreen();
        this.drawCursor();
    }

    selectWorldBattle(x, y) {
        if (!this.isWorld) return;
        x >>= 5;
        y >>= 5;
        x &= 7;
        y &= 7;

        const sector = x + (y << 3);
        const battleGroup = this.rom.battleGroup.item(sector);
        propertyList.select(battleGroup);
    }

    changeLayer(id) {
        this[id] = document.getElementById(id).checked;
        this.ppu.layers[0].main = this.showBackground;
        this.loadMap();
    }

    loadMap() {

        this.resetControls();
        this.observer.stopObservingAll();

        // get the tileset
        const t = this.mapProperties.tileset.value;
        const tileset = this.rom.mapTileset.item(t);
        const tilesetPalette = this.rom.tilesetPalette.item(t);

        // get the palette
        const paletteObject = this.rom.mapPalette.item(this.m);
        const palette = paletteObject.data.subarray(this.showRooms ? 32 : 0);

        // load graphics
        const gfx = this.rom.mapGraphics.item(t);

        this.observer.startObserving([
            this.mapProperties.tileset,
            tileset, tilesetPalette, paletteObject, gfx
        ], this.loadMap);

        // load the tile layout
        const layout = this.rom.mapLayout.item(this.m);
        this.layer[0].loadLayout({
            type: FF1MapLayer.Type.layer1,
            layout: layout,
            tileset: tileset.data,
            paletteAssignment: tilesetPalette.data,
            w: 64,
            h: 64
        });

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(palette);
        this.ppu.height = 64 * 16;
        this.ppu.width = 64 * 16;
        this.ppu.back = true;
        this.ppu.subtract = false;

        // layer 1
        this.ppu.layers[0].cols = this.layer[0].w * 2;
        this.ppu.layers[0].rows = this.layer[0].h * 2;
        this.ppu.layers[0].z[0] = GFX.Z.top;
        this.ppu.layers[0].gfx = gfx.data;
        this.ppu.layers[0].tiles = this.layer[0].tiles;
        this.ppu.layers[0].main = this.showBackground; // layer 1 always in main screen

        this.scrollDiv.style.width = `${this.ppu.width * this.zoom}px`;
        this.scrollDiv.style.height = `${this.ppu.height * this.zoom}px`;
        this.mapCanvas.width = this.ppu.width;
        this.mapCanvas.height = this.ppu.height;

        this.invalidateMap();
        this.selectedTrigger = null;
        this.loadTriggers();
        this.scroll();
        this.redraw();

        this.tileset.loadMap();
    }

    loadWorldMap() {

        this.resetControls();

        this.observer.stopObservingAll();
        this.mapProperties = null;
        propertyList.select(null);

        // load graphics and layout
        const size = 256;
        const gfx = this.rom.worldGraphics;
        const pal = this.rom.worldPalette;
        const paletteAssignment = this.rom.worldPaletteAssignment;
        const tileset = this.rom.worldTileset;
        const layout = [];
        for (let i = 0; i < size; i++) layout.push(rom.worldLayout.item(i));
        this.layer[0].loadLayout({
            type: FF1MapLayer.Type.world,
            layout: layout,
            tileset: tileset.data,
            w: size,
            h: size,
            paletteAssignment:
            paletteAssignment.data
        });

        this.observer.startObserving([
            gfx, pal, paletteAssignment, tileset
        ], this.loadWorldMap);

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(pal.data);
        this.ppu.width = size * 16;
        this.ppu.height = size * 16;
        this.ppu.back = true;

        // layer 1
        this.ppu.layers[0].cols = size * 2;
        this.ppu.layers[0].rows = size * 2;
        this.ppu.layers[0].z[0] = GFX.Z.top;
        this.ppu.layers[0].gfx = gfx.data;
        this.ppu.layers[0].tiles = this.layer[0].tiles;
        this.ppu.layers[0].main = this.showBackground; // layer 1 always in main screen

        this.scrollDiv.style.width = `${this.ppu.width * this.zoom}px`;
        this.scrollDiv.style.height = `${this.ppu.height * this.zoom}px`;
        this.mapCanvas.width = this.ppu.width;
        this.mapCanvas.height = this.ppu.height;

        this.invalidateMap();
        this.selectedTrigger = null;
        this.loadTriggers();
        this.scroll();
        this.redraw();

        this.tileset.loadMap();
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

    resize() {
        this.scroll();
    }

    redraw() {
        this.drawMap();
        this.drawTriggers();
        this.drawScreen();
        this.drawCursor();
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
        // this.drawTriggers();
        // this.drawScreen();
        // this.drawCursor();
    }

    drawScreen() {

        this.screenCanvas.style.display = 'none';
        if (!this.showScreen) return;

        // calculate the screen rect
        const x = ((this.selection.x * 16) - this.ppu.layers[this.l].x) & (this.ppu.width - 1);
        const y = ((this.selection.y * 16) - this.ppu.layers[this.l].y) & (this.ppu.height - 1);
        let screenRect = new Rect(x - 7 * 16, x + 9 * 16, y - 7 * 16, y + 8 * 16);

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
            c = 'rgba(128, 128, 128, 1.0)';
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
        this.redraw();
    }

    loadTriggers() {

        this.triggers = [];
        if (this.isWorld) return;

        // load npcs
        const mapNPC = this.rom.mapNPC.item(this.m);
        for (const npc of mapNPC.iterator()) {
            if (npc.npcID.value === 0) continue;
            const id = npc.npcID.value;
            const npcProperties = this.rom.npcProperties.item(id);
            this.observer.startObserving([
                npc.x,
                npc.y,
                npc.npcID,
                npc.inRooms,
                npcProperties.graphics
            ], this.reloadTriggers);
            this.triggers.push(npc);
        }
    }

    insertNPC() {
        this.closeMenu();

        // get the npc properties
        if (this.isWorld) return;
        const mapNPC = this.rom.mapNPC.item(this.m);

        // find the first unused npc
        let newNPC;
        for (const npc of mapNPC.iterator()) {
            if (npc.npcID.value != 0) continue;
            newNPC = npc;
            break;
        }
        if (!newNPC) return;

        this.beginAction(this.reloadTriggers);
        newNPC.x.setValue(this.clickPoint.x);
        newNPC.y.setValue(this.clickPoint.y);
        newNPC.npcID.setValue(1);
        this.endAction(this.reloadTriggers);

        this.selectedTrigger = newNPC;
        propertyList.select(newNPC);
    }

    deleteNPC() {

        this.closeMenu();
        const npc = this.selectedTrigger;
        if (!npc) return;
        const npcArray = npc.parent;
        const index = npcArray.array.indexOf(npc);
        if (index === -1) return;

        this.beginAction(this.reloadTriggers);
        npc.x.setValue(0);
        npc.y.setValue(0);
        npc.npcID.setValue(0);
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
            const c = 'rgba(128, 128, 128, 0.5)';
            const x = trigger.x.value * this.zoom * 16 + 2 - 0.5 - xClient;
            const y = trigger.y.value * this.zoom * 16 + 2 - 0.5 - yClient;
            this.drawTriggerRect(x, y, c, context);
            this.drawNPC(trigger);
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

        if (npc.inRooms.value && !this.showRooms) return;

        const x = npc.x.value * 16;
        const y = npc.y.value * 16 - 3;
        const w = 16;
        const h = 16;

        const index = npc.npcID.value;
        const g = this.rom.npcProperties.item(index).graphics.value;
        const gfx = this.rom.mapSpriteGraphics.item(g).data;
        const pal = this.rom.mapPalette.item(this.m).data.subarray(24);
        const tileData = new Uint32Array([
            0x00000000, 0x00000001,
            0x00040002, 0x00040003
        ]);

        let npcRect = new Rect(x, x + w, y, y + h);
        npcRect = npcRect.scale(this.zoom);
        if (this.mapRect.intersect(npcRect).isEmpty()) return;

        // set up the ppu
        const ppu = new GFX.PPU();
        ppu.pal = this.rom.gammaCorrectedPalette(pal);
        ppu.width = w;
        ppu.height = h;

        // layer 1
        ppu.layers[0].cols = 2;
        ppu.layers[0].rows = 2;
        ppu.layers[0].z[0] = GFX.Z.top;
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

        const context = this.canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.globalCompositeOperation = 'source-over';
        npcRect = npcRect.offset(-this.mapRect.l, -this.mapRect.t);
        context.drawImage(this.npcCanvas, 0, 0, w, h, npcRect.l, npcRect.t, npcRect.w, npcRect.h);

    }
}

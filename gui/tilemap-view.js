//
// tilemap-view.js
// created 9/4/2020
//

class ROMTilemapView extends ROMEditor {

    constructor(rom) {
        super(rom);

        this.name = 'ROMTilemapView';
        this.graphicsView = new ROMGraphicsView(rom, this);
        this.graphicsView.backColor = 0xFF000000;
        this.paletteView = this.graphicsView.paletteView;
        this.paletteView.tilemapView = this;
        this.toolbox = this.paletteView.toolbox;

        // this.div = document.createElement('div');
        this.div.classList.add('map-edit');
        // this.div.id = 'map-edit';
        this.div.tabIndex = 0;
        this.div.style.outline = 'none';

        this.zoom = 2.0;
        this.width = 16; // width in tiles
        this.height = 16; // height in tiles
        this.tileWidth = 8; // tile width in pixels
        this.tileHeight = 8; // tile height in pixels
        this.backColor = false;
        this.object = null;
        this.tilemap = new Uint32Array();
        this.format = GFX.tileFormat.defaultTile;
        this.canvas = document.createElement('canvas');
        this.div.appendChild(this.canvas);
        this.layoutCanvas = document.createElement('canvas');
        this.cursorCanvas = document.createElement('canvas');
        this.cursorCanvas.id = 'map-cursor';
        this.cursorCanvas.width = 8;
        this.cursorCanvas.height = 8;
        this.div.appendChild(this.cursorCanvas);

        this.selection = { x: 0, y: 0, w: 1, h: 1, tilemap: new Uint32Array(1) };
        this.clickPoint = null;
        this.mousePoint = { x: 0, y: 0 };
        this.isDragging = false;
        this.showCursor = false;
        this.showPalette = true;
        this.showGraphics = true;

        this.tileMask = ROMTilemapView.TileMasks.none.key;

        const self = this;
        this.canvas.onmousedown = function(e) { self.mouseDown(e); };
        this.canvas.onmousemove = function(e) { self.mouseMove(e); };
        this.canvas.onmouseup = function(e) { self.mouseUp(e); };
        this.canvas.onmouseenter = function(e) { self.mouseEnter(e); };
        this.canvas.onmouseleave = function(e) { self.mouseLeave(e); };
        this.canvas.oncontextmenu = function(e) { return false; };
        this.resizeSensor = null;

        this.observer = new ROMObserver(rom, this);
    }

    selectObject(object) {

        this.object = object || this.object;
        if (!this.object) return;

        // get the tile format
        let formatKey = this.object.format;

        // for assemblies with multiple formats, the tile format is the first one
        if (isArray(formatKey)) formatKey = formatKey[0];

        // ignore format parameters
        if (formatKey.includes('(')) {
            formatKey = formatKey.substring(0, formatKey.indexOf('('));
        }
        this.format = GFX.tileFormat[formatKey] || GFX.tileFormat.defaultTile;

        this.loadTilemap();
        this.resetControls();
    }

    show() {
        this.showControls();
        this.closeList();

        // update the toolbox div
        this.toolbox.div.innerHTML = '';
        this.toolbox.div.appendChild(this.graphicsView.div);
        this.toolbox.div.appendChild(this.paletteView.div);
        this.toolbox.show(false);

        // notify on resize
        const self = this;
        this.resizeSensor = new ResizeSensor(this.toolbox.paneTop, function() {
            self.resize();
        });

        this.div.focus();
    }

    hide() {
        this.observer.stopObservingAll();
        if (this.resizeSensor) {
            this.resizeSensor.detach(document.getElementById('toolbox'));
            this.resizeSensor = null;
        }

        this.toolbox.hide();
    }

    resetControls() {
        super.resetControls();

        const self = this;

        // // add controls to show/hide the palette and graphics
        // this.addTwoState('showPalette', function(show) {
        //     self.showPalette = show;
        //     self.updateToolbox();
        // }, 'Palette', this.showPalette);
        // this.addTwoState('showGraphics', function(show) {
        //     self.showGraphics = show;
        //     self.updateToolbox();
        // }, 'Graphics', this.showGraphics);

        // add tile mask button
        const maskKeys = [ROMTilemapView.TileMasks.none.key];
        if (!this.object.disableVFlip && this.format.vFlip) {
            maskKeys.push(ROMTilemapView.TileMasks.vFlip.key);
        }
        if (!this.object.disableHFlip && this.format.hFlip) {
            maskKeys.push(ROMTilemapView.TileMasks.hFlip.key);
        }
        if (!this.object.disableZLevel && this.format.maxZ) {
            maskKeys.push(ROMTilemapView.TileMasks.zLevel.key);
        }
        if (maskKeys.length > 1) {
            const maskNames = [];
            for (const key of maskKeys) {
                maskNames.push(ROMTilemapView.TileMasks[key].name);
            }

            // select the current tile mask if it is valid
            if (!maskKeys.includes(this.tileMask)) {
                this.tileMask = ROMTilemapView.TileMasks.none;
            }

            function onChangeMask(mask) {
                self.tileMask = maskKeys[mask];
                self.redraw();
            };

            function maskSelected(mask) {
                return self.tileMask === maskKeys[mask];
            };
            this.addList('showMask', 'Mask',
                maskNames, onChangeMask, maskSelected);
        }

        // add a zoom control
        this.addZoom(this.zoom, function() {
            self.changeZoom();
        }, 0, 4);

        // this.updateToolbox();
        this.toolbox.show(false);
        this.div.focus();
    }

    changeZoom() {
        // update zoom
        const zoomControl = document.getElementById('zoom');
        const z = Number(zoomControl.value);
        this.zoom = Math.pow(2, z);
        const zoomValue = document.getElementById('zoom-value');
        zoomValue.innerHTML = `${this.zoom * 100}%`;

        this.redraw();
    }

    mouseDown(e) {
        this.closeList();

        this.clickPoint = {
            x: Math.floor(e.offsetX / this.zoom / this.tileWidth),
            y: Math.floor(e.offsetY / this.zoom / this.tileHeight),
            button: e.button
        };
        this.mousePoint = {
            x: this.clickPoint.x,
            y: this.clickPoint.y
        }

        if (this.clickPoint.button === 2) {
            this.selection.x = this.clickPoint.x;
            this.selection.y = this.clickPoint.y;
            this.selectTiles();
            this.isDragging = true;
        } else {
            this.setTiles();
            this.isDragging = true;
        }

        this.drawCursor();

        // this doesn't work properly for e.g. ff4 battle backgrounds
        // // select the tilemap object
        // if (this.object) {
        //     propertyList.select(this.object);
        // }
    }

    mouseMove(e) {
        let x = Math.floor(e.offsetX / this.zoom / this.tileWidth);
        let y = Math.floor(e.offsetY / this.zoom / this.tileHeight);
        x = Math.min(Math.max(x, 0), this.width - 1);
        y = Math.min(Math.max(y, 0), this.height - 1);

        // update the displayed coordinates
        const coordinates = document.getElementById('coordinates');
        coordinates.innerHTML = `(${x}, ${y})`;

        // return if the cursor position didn't change
        if (this.mousePoint.x === x && this.mousePoint.y === y) return;

        this.mousePoint = {
            x: x,
            y: y
        };

        // update the selection position
        this.selection.x = x;
        this.selection.y = y;

        if (this.isDragging && this.clickPoint) {
            if (this.clickPoint.button === 0) this.setTiles();
            if (this.clickPoint.button === 2) this.selectTiles();
        }

        // update the cursor
        this.drawCursor();
    }

    mouseUp(e) {
        if (this.isDragging) this.setTilemap();

        this.isDragging = false;
        this.clickPoint = null;
        this.mouseMove(e);
    }

    mouseEnter(e) {
        // show the cursor
        this.showCursor = true;
        this.drawCursor();
        this.mouseUp(e);
    }

    mouseLeave(e) {
        // hide the cursor
        this.showCursor = false;
        this.drawCursor();
        this.mouseUp(e);
    }

    setTiles() {
        let x = this.selection.x;
        let y = this.selection.y;
        let w = this.selection.w;
        let h = this.selection.h;

        x = x % this.width;
        y = y % this.height;
        const clippedW = Math.min(w, this.width - x);
        const clippedH = Math.min(h, this.height - y);

        for (let r = 0; r < clippedH; r++) {
            const ls = r * w;
            const ld = x + (y + r) * this.width;
            if (ld + clippedW > this.tilemap.length) break;
            for (let c = 0; c < clippedW; c++) {
                if (this.selection.tilemap[ls + c] === 0xFFFFFFFF) continue;
                this.tilemap[ld + c] = this.selection.tilemap[ls + c];
            }
        }

        this.redraw();
    }

    selectTiles() {
        var col = this.selection.x;
        var row = this.selection.y;
        var cols = Math.abs(col - this.clickPoint.x) + 1;
        var rows = Math.abs(row - this.clickPoint.y) + 1;
        col = Math.min(col, this.clickPoint.x);
        row = Math.min(row, this.clickPoint.y);

        // limit the selection rectangle to the size of the layer
        var clippedCol = col % this.width;
        var clippedRow = row % this.height;
        cols = Math.min(cols, this.width - clippedCol);
        rows = Math.min(rows, this.height - clippedRow);

        // create the tile selection
        this.selection.x = col;
        this.selection.y = row;
        this.selection.w = cols;
        this.selection.h = rows;
        this.selection.tilemap = new Uint32Array(cols * rows);

        for (var y = 0; y < rows; y++) {
            var begin = col + (row + y) * this.width;
            var end = begin + cols;
            var line = this.tilemap.subarray(begin, end);
            this.selection.tilemap.set(line, y * cols);
        }

        if (this.selection.tilemap.length === 1) {
            // select tile in graphics and palette views
            var tile = this.selection.tilemap[0];
            var p = (tile & 0x00FF0000) >> 16;
            this.paletteView.p = Math.round(p / this.paletteView.colorsPerPalette);
            this.paletteView.redraw();

            this.graphicsView.selectTile(tile);
        } else {
            // clear the graphics view selection
            this.graphicsView.selection = {
                x: 0, y: 0, w: 0, h: 0,
                tilemap: new Uint32Array(0)
            };
            this.graphicsView.redraw();
        }
    }

    selectPalette(p) {
        for (let t = 0; t < this.selection.tilemap.length; t++) {
            this.selection.tilemap[t] &= 0xFF00FFFF;
            this.selection.tilemap[t] |= (p << 16);
        }

        // change per graphics tile color offset
        this.setPerTileColorOffset(this.object.colorOffset, p);
    }

    toggleSelectionVFlip() {
        const w = this.selection.w;
        const h = this.selection.h;

        const tilemap = new Uint32Array(this.selection.tilemap);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const tile = tilemap[x + (h - y - 1) * w] ^ 0x20000000;
                this.selection.tilemap[x + y * w] = tile;
            }
        }
    }

    toggleSelectionHFlip() {
        const w = this.selection.w;
        const h = this.selection.h;

        const tilemap = new Uint32Array(this.selection.tilemap);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const tile = tilemap[(w - x - 1) + y * w] ^ 0x10000000;
                this.selection.tilemap[x + y * w] = tile;
            }
        }
    }

    setSelectionZ(z) {
        const w = this.selection.w;
        const h = this.selection.h;

        const tilemap = new Uint32Array(this.selection.tilemap);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let tile = this.selection.tilemap[x + y * w];
                tile &= 0xF0FFFFFF;
                tile |= z << 24;
                this.selection.tilemap[x + y * w] = tile;
            }
        }
    }

    loadTilemap() {
        // return if nothing selected
        if (!this.object) return;

        this.observer.stopObservingAll();
        this.observer.startObserving(this.object, this.loadTilemap);

        // update tile layout parameters
        this.width = this.object.width || 32;
        this.height = this.object.height || 32;
        this.backColor = this.object.backColor;

        // update graphics and palette
        this.graphicsView.loadDefinition(this.object.graphics);
        this.paletteView.loadDefinition(this.object.palette);
        this.paletteView.updateToolbox();
        this.graphicsView.updateToolbox();

        this.graphicsView.updateTilemap();
        this.graphicsView.redraw();
        this.paletteView.redraw();

        // use the tile size from the graphics view
        this.tileWidth = this.graphicsView.tileWidth;
        this.tileHeight = this.graphicsView.tileHeight;

        // copy the tilemap
        this.tilemap = new Uint32Array(this.height * this.width);
        if (this.object.data) {
            this.tilemap.set(this.object.data.subarray(0, this.tilemap.length));
        }

        // load data from definition
        this.loadTileOffset(this.object.tileOffset);
        this.loadColorOffset(this.object.colorOffset);
        this.loadFlip(this.object.vFlip, true);
        this.loadFlip(this.object.hFlip, false);

        this.redraw();
    }

    setTilemap() {
        // return if nothing selected
        if (!this.object) return;

        // make a copy of the current tiles
        const newData = this.tilemap.slice(0, this.object.data.length);

        this.rom.beginAction();
        this.observer.sleep();

        // copy the tilemap and extract tile offset, color offset, v/h-flip
        this.setTileOffset(this.object.tileOffset, newData);
        this.setColorOffset(this.object.colorOffset, newData);
        this.setFlip(this.object.vFlip, true, newData);
        this.setFlip(this.object.hFlip, false, newData);

        // set tilemap object data
        this.object.setData(newData);

        this.observer.wake();
        this.rom.endAction();
    }

    resize() {
        // resize graphics based on full toolbox width with no scrollbar
        this.graphicsView.resize(this.toolbox.div.offsetWidth);

        // set toolbox height
        const scrollHeight = this.paletteView.div.scrollHeight + this.graphicsView.div.scrollHeight;
        this.toolbox.setHeight(scrollHeight);

        // get visible toolbox height and check for overflow
        const toolboxHeight = this.toolbox.div.clientHeight;
        let graphicsHeight = this.graphicsView.div.scrollHeight;
        if (scrollHeight > toolboxHeight) {
            // min toolbox height assuming graphics height is zero
            const minHeight = scrollHeight - this.graphicsView.canvasDiv.scrollHeight;
            const minGraphicsHeight = minHeight - this.paletteView.div.scrollHeight;

            // height available for graphics div
            graphicsHeight = toolboxHeight - this.paletteView.div.scrollHeight;
            if (graphicsHeight < minGraphicsHeight) {
                this.toolbox.setHeight(minHeight);
                graphicsHeight = minGraphicsHeight;
            } else {
                this.toolbox.div.style.overflowY = '';
            }
        }

        // resize graphics and palette based on actual width
        this.graphicsView.resize(this.toolbox.div.clientWidth, graphicsHeight);
        this.graphicsView.redraw();
        this.paletteView.resize(this.toolbox.div.clientWidth);
        this.paletteView.redraw();
    }

    redraw() {
        this.drawTilemap();
        this.drawMask();
        this.drawCursor();
    }

    drawTilemap() {
        const ppu = new GFX.PPU();

        // create the palette
        const palette = new Uint32Array(this.paletteView.palette);
        if (this.backColor) {
            // use first palette color as back color
            palette[0] = this.paletteView.palette[0];
            ppu.back = true;
        } else {
            // transparent background
            palette[0] = 0;
            ppu.back = false;
        }

        // set up the ppu
        ppu.pal = this.rom.gammaCorrectedPalette(palette);
        ppu.width = this.width * this.tileWidth;
        ppu.height = this.height * this.tileHeight;

        // layer 1
        ppu.layers[0].format = null;
        ppu.layers[0].cols = this.width;
        ppu.layers[0].rows = this.height;
        ppu.layers[0].z[0] = GFX.Z.top;
        ppu.layers[0].z[1] = GFX.Z.top;
        ppu.layers[0].z[2] = GFX.Z.top;
        ppu.layers[0].z[3] = GFX.Z.top;
        ppu.layers[0].gfx = this.graphicsView.graphics;
        ppu.layers[0].tiles = this.tilemap;
        ppu.layers[0].tileWidth = this.tileWidth;
        ppu.layers[0].tileHeight = this.tileHeight;
        ppu.layers[0].main = true;

        // draw tilemap image
        this.layoutCanvas.width = ppu.width;
        this.layoutCanvas.height = ppu.height;
        let ctx = this.layoutCanvas.getContext('2d');
        const imageData = ctx.createImageData(ppu.width, ppu.height);
        ppu.renderPPU(imageData.data, 0, 0, ppu.width, ppu.height);
        ctx.putImageData(imageData, 0, 0);

        // scale image to zoom setting
        this.canvas.width = ppu.width * this.zoom;
        this.canvas.height = ppu.height * this.zoom;
        ctx = this.canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.layoutCanvas,
            0, 0, this.layoutCanvas.width, this.layoutCanvas.height,
            0, 0, this.canvas.width, this.canvas.height);
    }

    drawMask() {
        if (this.tileMask === ROMTilemapView.TileMasks.none.key) return;

        const ctx = this.canvas.getContext('2d');
        ctx.globalCompositeOperation = 'source-over';

        // draw the mask at each tile
        const w = this.tileWidth * this.zoom;
        const h = this.tileHeight * this.zoom;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {

                const color = this.maskColorForTile(x, y);
                if (!color) continue;
                ctx.fillStyle = color;

                const l = x * this.tileWidth * this.zoom;
                const t = y * this.tileHeight * this.zoom;
                ctx.fillRect(l, t, w, h);
            }
        }
    }

    maskColorForTile(x, y) {
        const tile = this.tilemap[x + y * this.width];
        const yellow = 'rgba(255,255,0,0.5)';
        const green = 'rgba(0,255,0,0.5)';
        const blue = 'rgba(0,0,255,0.5)';
        if (this.tileMask === ROMTilemapView.TileMasks.vFlip.key) {
            if (tile & 0x20000000) return yellow;
        } else if (this.tileMask === ROMTilemapView.TileMasks.hFlip.key) {
            if (tile & 0x10000000) return yellow;
        } else if (this.tileMask === ROMTilemapView.TileMasks.zLevel.key) {
            var z = (tile >> 24) & 0x0F;
            if (z === 0) return green;
            if (z === 1) return blue;
        }
        return null;
    }

    drawCursor() {
        this.cursorCanvas.style.display = 'none';
        if (!this.showCursor) return;

        // get the cursor geometry
        const l = Math.floor(this.selection.x * this.tileWidth * this.zoom);
        const t = Math.floor(this.selection.y * this.tileHeight * this.zoom);
        const r = Math.ceil((this.selection.x + this.selection.w) * this.tileWidth * this.zoom);
        const b = Math.ceil((this.selection.y + this.selection.h) * this.tileHeight * this.zoom);
        let x = l;
        let y = t
        let w = r - l;
        let h = b - t;

        // clip the cursor to the tilemap size
        w = Math.min(this.width * this.tileWidth * this.zoom - x, w);
        h = Math.min(this.height * this.tileHeight * this.zoom - y, h);
        if (w <= 0 || h <= 0) return;

        // set up the cursor canvas
        this.cursorCanvas.width = w;
        this.cursorCanvas.height = h;
        this.cursorCanvas.style.left = `${x}px`;
        this.cursorCanvas.style.top = `${y}px`;
        this.cursorCanvas.style.display = 'block';
        var ctx = this.cursorCanvas.getContext('2d');

        // convert the selection to screen coordinates
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'black';
        x = 0.5; y = 0.5; w--; h--;
        ctx.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        ctx.strokeStyle = 'hsl(210, 100%, 50%)';
        ctx.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        ctx.strokeStyle = 'white';
        ctx.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        ctx.strokeStyle = 'black';
        ctx.strokeRect(x, y, w, h);
    }

    loadTileOffset(definition) {
        if (!definition) return;

        // recursively load array definitions
        if (isArray(definition)) {
            for (const def of definition) this.loadTileOffset(def);
            return;
        }

        const r = this.parseDefinition(definition);

        if (r.object) this.observer.startObserving(r.object, this.loadTilemap);

        if (isNumber(r.value)) {
            for (let t = r.offset; t < this.tilemap.length; t++) {
                let tile = this.tilemap[t] & 0x0000FFFF;
                tile += r.value * r.multiplier;
                this.tilemap[t] &= 0xFFFF0000;
                this.tilemap[t] |= (tile & 0x0000FFFF);
            }

        } else if (r.data) {
            for (let t = r.offset; t < this.tilemap.length; t++) {
                let tile = this.tilemap[t] & 0x0000FFFF;
                tile += r.data[t] * r.multiplier;
                this.tilemap[t] &= 0xFFFF0000;
                this.tilemap[t] |= (tile & 0x0000FFFF);
            }
        } else if (r.object instanceof  ROMArray) {
            for (let t = r.offset; t < this.tilemap.length; t++) {
                let tile = this.tilemap[t] & 0x0000FFFF;
                const arrayElement = r.object.item(t);
                if (!arrayElement) continue;
                var value = arrayElement[r.key].value;
                tile += value;
                this.tilemap[t] &= 0xFFFF0000;
                this.tilemap[t] |= (tile & 0x0000FFFF);
            }
        }
    }

    setTileOffset(definition, tilemap) {
        if (!definition) return;

        // recursively load array definitions
        if (isArray(definition)) {
            for (const def of definition) this.setTileOffset(def, tilemap);
            return;
        }

        const r = this.parseDefinition(definition);

        // subtract out the tile offset
        if (isNumber(r.value)) {
            for (let t = r.offset; t < tilemap.length; t++) {
                let tile = tilemap[t];
                tile &= 0xFFFF;
                tile -= r.value * r.multiplier;
                if (tile < 0) tile = 0;
                tilemap[t] &= 0xFFFF0000;
                tilemap[t] |= tile;
            }

        } else if (r.data) {
            for (let t = r.offset; t < tilemap.length; t++) {
                let tile = tilemap[t];
                tile &= 0xFFFF;
                tile -= r.data[t] * r.multiplier;
                if (tile < 0) tile = 0;
                tilemap[t] &= 0xFFFF0000;
                tilemap[t] |= tile;
            }
        } else if (r.object instanceof  ROMArray) {
            for (let t = r.offset; t < tilemap.length; t++) {
                const arrayElement = r.object.item(t);
                if (!arrayElement) continue;
                const value = arrayElement[r.key].value;
                let tile = tilemap[t];
                tile &= 0xFFFF;
                tile -= value;
                if (tile < 0) tile = 0;
                tilemap[t] &= 0xFFFF0000;
                tilemap[t] |= tile;
            }
        }
    }

    loadColorOffset(definition) {
        if (!definition) return;

        // recursively load array definitions
        if (isArray(definition)) {
            for (const def of definition) this.loadColorOffset(def);
            return;
        }

        const r = this.parseDefinition(definition);

        if (r.object) this.observer.startObserving(r.object, this.loadTilemap);

        if (isNumber(r.value)) {
            for (let t = r.offset; t < this.tilemap.length; t++) {
                let tile = this.tilemap[t];
                let p = tile & 0x00FF0000;
                p += (r.value * r.multiplier) << 16;
                tile &= 0xFF00FFFF;
                tile |= p & 0x00FF0000;
                this.tilemap[t] = tile;
            }

        } else if (r.data) {
            for (let t = r.offset; t < this.tilemap.length; t++) {
                let tile = this.tilemap[t];
                let p = tile & 0x00FF0000;
                const d = r.perTile ? (tile & 0x0000FFFF) : t;
                p += (r.data[d] * r.multiplier) << 16;
                tile &= 0xFF00FFFF;
                tile |= p & 0x00FF0000;
                this.tilemap[t] = tile;
            }
        } else if (r.object instanceof ROMArray) {
            for (let t = r.offset; t < this.tilemap.length; t++) {
                let tile = this.tilemap[t];
                let p = tile & 0x00FF0000;
                const d = r.perTile ? (tile & 0x0000FFFF) : t;
                const arrayElement = r.object.item(d);
                if (!arrayElement) continue;
                const value = arrayElement[r.key].value;
                p += value << 16;
                tile &= 0xFF00FFFF;
                tile |= p & 0x00FF0000;
                this.tilemap[t] = tile;
            }
        }
    }

    setPerTileColorOffset(definition, p) {
        if (!definition) return;

        // recursively load array definitions
        if (isArray(definition)) {
            for (const def of definition) this.setPerTileColorOffset(def, p);
            return;
        }

        const r = this.parseDefinition(definition);
        if (!r.perTile || !r.data) return;
        let data = r.data.slice();
        const colorOffset = p / r.multiplier;
        for (let t = 0; t < this.selection.tilemap.length; t++) {
            const tile = this.selection.tilemap[t] & 0xFFFF;
            data[tile] = colorOffset;
        }
        r.object.setData(data);
    }

    setColorOffset(definition, tilemap) {
        if (!definition) return;

        // recursively load array definitions
        if (isArray(definition)) {
            for (const def of definition) this.setColorOffset(def, tilemap);
            return;
        }

        const r = this.parseDefinition(definition);

        if (isNumber(r.value)) {
            for (let t = r.offset; t < tilemap.length; t++) {
                let tile = tilemap[t];
                tile &= 0x00FF0000;
                tile -= (r.value * r.multiplier) << 16;
                if (tile < 0) tile = 0;
                tilemap[t] &= 0xFF00FFFF;
                tilemap[t] |= tile;
            }

        } else if (r.data) {
            var data = r.data.slice();
            for (let t = r.offset; t < tilemap.length; t++) {
                let tile = tilemap[t];
                let p = tile & 0x00FF0000;
                if (r.perTile) {
                    const d = tile & 0x0000FFFF;
                    p -= (r.data[d] * r.multiplier) << 16;
                    if (p < 0) p = 0;
                    tilemap[t] &= 0xFF00FFFF;
                    tilemap[t] |= p;
                } else {
                    data[t] = (p >> 16) / r.multiplier;
                    p = 0;
                    tilemap[t] &= 0xFF00FFFF;
                }
                tilemap[t] |= p;
            }
            r.object.setData(data);

        } else if (r.object instanceof ROMArray) {
            for (let t = r.offset; t < tilemap.length; t++) {
                let tile = tilemap[t];
                const d = r.perTile ? (tile & 0x0000FFFF) : t;
                const arrayElement = r.object.item(d);
                if (!arrayElement) continue;
                const value = arrayElement[r.key].value;
                tile &= 0x00FF0000;
                tile -= value << 16;
                if (tile < 0) tile = 0;
                tilemap[t] &= 0xFF00FFFF;
                tilemap[t] |= tile;
            }
        }
    }

    loadFlip(definition, v) {
        if (!definition) return;

        // recursively load array definitions
        if (isArray(definition)) {
            for (const def of definition) this.loadFlip(def, v);
            return;
        }

        const r = this.parseDefinition(definition);

        if (r.object) this.observer.startObserving(r.object, this.loadTilemap);

        const mask = v ? 0x20000000 : 0x10000000;
        if (isNumber(r.value)) {
            for (let t = r.offset; t < this.tilemap.length; t++) {
                r.value ? (this.tilemap[t] |= mask) : (this.tilemap[t] &= ~mask);
            }

        } else if (r.data) {
            for (let t = r.offset; t < this.tilemap.length; t++) {
                r.data[t] ? (this.tilemap[t] |= mask) : (this.tilemap[t] &= ~mask);
            }
        }
    }

    setFlip(definition, v, tilemap) {
        if (!definition) return;

        // recursively load array definitions
        if (isArray(definition)) {
            for (const def of definition) this.setFlip(def, v, tilemap);
            return;
        }

        const r = this.parseDefinition(definition);

        const mask = v ? 0x20000000 : 0x10000000;

        if (r.data) {
            const data = r.data.slice();
            for (let t = r.offset; t < tilemap.length; t++) {
                data[t] = (tilemap[t] & mask) ? 1 : 0;
                tilemap[t] &= ~mask;
            }
            r.object.setData(data);
        }
    }

    observeDefinitionObject(definition, callback) {
        if (!definition) return;

        // recursively load array definitions
        if (isArray(definition)) {
            for (const def of definition) this.observeDefinitionObject(def, callback);
            return;
        }

        var r = this.parseDefinition(definition);
        if (r.object && r.object.addObserver) this.observer.startObserving(r.object, callback);
    }

    parseDefinition(definition) {
        const r = {};
        if (!definition) return r;

        // parse constant value
        const num = Number(definition);
        if (isNumber(num)) {
            r.offset = 0;
            r.multiplier = 1;
            r.value = num;
            return r;
        }

        // parse object
        if (isString(definition)) {
            r.object = this.rom.parsePath(definition, this.rom, this.object.i);
        } else if (isString(definition.path)) {
            r.object = this.rom.parsePath(definition.path, this.rom, this.object.i);
        }

        // parse offset
        r.offset = Number(definition.offset) || 0;

        // parse multiplier
        r.multiplier = Number(definition.multiplier) || 1;

        // values are per graphics tile or per layout tile
        r.perTile = definition.perTile;

        if (r.object instanceof ROMProperty) {
            // parse object value
            r.value = r.object.value;

        } else if (r.object instanceof ROMArray) {
            // parse array
            r.key = definition.key;

        } else if (r.object && r.object.data) {
            // parse object data
            r.data = r.object.data;

            // parse data range
            if (definition.range) {
                r.range = ROMRange.parse(definition.range);
                r.data = r.data.subarray(r.range.begin, r.range.end);
            } else {
                r.range = new ROMRange(0, r.data.length);
            }
        }

        return r;
    }

    exportTilemap() {
        // create an indexed png file from the tilemap
        const ppu = new GFX.PPU();

        // create the palette
        const palette = new Uint32Array(this.paletteView.palette);
        if (this.backColor) {
            // use first palette color as back color
            palette[0] = this.paletteView.palette[0];
            ppu.back = true;
        } else {
            // transparent background
            palette[0] = 0;
            ppu.back = false;
        }

        // set up the ppu
        ppu.pal = this.rom.gammaCorrectedPalette(palette);
        ppu.width = this.width * this.tileWidth;
        ppu.height = this.height * this.tileHeight;

        // layer 1
        ppu.layers[0].format = null;
        ppu.layers[0].cols = this.width;
        ppu.layers[0].rows = this.height;
        ppu.layers[0].z[0] = GFX.Z.top;
        ppu.layers[0].z[1] = GFX.Z.top;
        ppu.layers[0].z[2] = GFX.Z.top;
        ppu.layers[0].z[3] = GFX.Z.top;
        ppu.layers[0].gfx = this.graphicsView.graphics;
        ppu.layers[0].tiles = this.tilemap;
        ppu.layers[0].tileWidth = this.tileWidth;
        ppu.layers[0].tileHeight = this.tileHeight;
        ppu.layers[0].main = true;

        const image = ppu.createPNG(0, 0, this.width * this.tileWidth, this.height * this.tileHeight);
        const blob = new Blob([image.buffer]);
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.style = "display: none";
        document.body.appendChild(a);

        a.href = url;
        a.download = 'image.png';
        a.click();

        // release the reference to the file by revoking the Object URL
        window.URL.revokeObjectURL(url);
    }
}

ROMTilemapView.TileMasks = {
    none: {
        key: "none",
        name: "None"
    },
    vFlip: {
        key: "vFlip",
        name: "V-Flip"
    },
    hFlip: {
        key: "hFlip",
        name: "H-Flip"
    },
    zLevel: {
        key: "zLevel",
        name: "Priority"
    // },
    // "tileIndex": {
    //     "key": "tileIndex",
    //     "name": "Tile Index"
    }
}

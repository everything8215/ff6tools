//
// graphics-view.js
// created 9/4/2020
//

class ROMGraphicsView extends ROMEditor_ {
    constructor(rom, tilemapView) {
        super(rom);

        this.name = 'ROMGraphicsView';
        this.tilemapView = tilemapView;
        this.paletteView = new ROMPaletteView(rom, this);
        this.toolbox = this.paletteView.toolbox;
        this.editorMode = false;
        this.toolboxMode = false;
        this.previewMode = false;

        this.zoom = 2.0;
        this.width = 16; // width in tiles
        this.height = 16; // height in tiles
        this.tileWidth = 8; // tile width in pixels
        this.tileHeight = 8; // tile height in pixels
        this.maxHeight = 256; // max visible height in toolbox mode
        this.bytesPerTile = this.tileWidth * this.tileHeight;
        this.backColor = false;
        this.graphics = new Uint8Array(this.bytesPerTile);
        this.tilemap = new Uint32Array();
        this.spriteSheet = null;
        this.ss = 0; // sprite sheet index
        this.object = null;
        this.definition = null;
        this.format = GFX.graphicsFormat.linear8bpp;
        this.page = 0;
        this.hFlip = false;
        this.vFlip = false;
        this.z = 0;

        this.clickPoint = null;
        this.selection = {
            x: 0, y: 0, w: 0, h: 0,
            tilemap: new Uint32Array()
        };

        // off-screen canvas for graphics at 1x zoom
        this.graphicsCanvas = document.createElement('canvas');
        this.ppu = new GFX.PPU();

        // on-screen canvas for graphics and cursor
        this.canvas = document.createElement('canvas');
        this.canvas.classList.add('tileset-canvas');
        this.cursorCanvas = document.createElement('canvas');
        this.cursorCanvas.classList.add('cursor-canvas');

        this.canvasDiv = document.createElement('div');
        this.canvasDiv.classList.add('graphics-canvas-div');
        this.canvasDiv.classList.add('background-gradient');
        this.canvasDiv.appendChild(this.canvas);
        this.canvasDiv.appendChild(this.cursorCanvas);

        // this.div = document.createElement('div');
        this.div.classList.add('graphics-div');

        // add message handlers
        const self = this;
        this.canvas.onmousedown = function(e) { self.mouseDown(e); };
        this.canvas.onmouseup = function(e) { self.mouseUp(e); };
        this.canvas.onmousemove = function(e) { self.mouseMove(e); };
        this.canvas.onmouseout = function(e) { self.mouseOut(e); };
        this.canvas.oncontextmenu = function() { return false; };
    }

    show() {

        this.showControls();
        this.closeList();

        // update the toolbox div
        this.toolbox.div.innerHTML = '';
        this.toolbox.div.appendChild(this.paletteView.div);
        this.toolbox.show(false);

        // notify on resize
        const self = this;
        this.resizeSensor = new ResizeSensor(this.toolbox.paneTop, function() {
            self.toolbox.setHeight(self.paletteView.div.scrollHeight);
            self.paletteView.resize();
            self.paletteView.redraw();
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

        // add a control to select the sprite sheet
        if (this.object && this.object.spriteSheet) {
            function onChangeSpriteSheet(ss) {
                self.ss = ss;
                self.updateTilemap();
                self.resize();
                self.drawGraphics();
            }
            function spriteSheetSelected(ss) {
                return (ss === self.ss);
            }

            // create a list of tilemap options
            const spriteSheetList = [];
            if (isArray(this.object.spriteSheet)) {
                for (const [i, ss] of this.object.spriteSheet.entries()) {
                    spriteSheetList.push(ss.name || `Sprite Sheet ${i}`);
                }
            } else {
                spriteSheetList.push(this.object.spriteSheet.name || 'Default');
            }

            // select the first available tilemap if the current selection is unavailable
            if (this.ss >= spriteSheetList.length) this.ss = 0;

            // no tilemap is always the last option
            spriteSheetList.push('None');
            this.addList('changeSpriteSheet', 'Sprite Sheet',
                spriteSheetList, onChangeSpriteSheet, spriteSheetSelected);

        } else {
            this.ss = 0;
        }

        this.addZoom(this.zoom, function() {
            self.changeZoom();
        }, 0, 4);
    }

    changeZoom() {
        // this only applies in editor mode
        if (!this.editorMode) return;

        // update zoom
        const zoomControl = document.getElementById('zoom');
        const z = Number(zoomControl.value);
        this.zoom = Math.pow(2, z);
        const zoomValue = document.getElementById('zoom-value');
        zoomValue.innerHTML = `${this.zoom * 100}%`;

        this.resize();
        this.redraw();
    }

    mouseDown(e) {
        this.closeList();
        let x = Math.floor(e.offsetX / this.zoom / this.tileWidth);
        let y = Math.floor(e.offsetY / this.zoom / this.tileHeight);
        x = Math.min(Math.max(x, 0), this.width - 1);
        y = Math.min(Math.max(y, 0), this.height - 1);
        this.clickPoint = { x: x, y: y };
        this.mouseMove(e);

        // select the graphics object in editor mode
        if (this.editorMode && this.object) {
            propertyList.select(this.object);
        }
    }

    mouseUp(e) {
        this.clickPoint = null;
    }

    mouseOut(e) {
        this.mouseUp(e);
    }

    mouseMove(e) {

        let x = Math.floor(e.offsetX / this.zoom / this.tileWidth);
        let y = Math.floor(e.offsetY / this.zoom / this.tileHeight);
        x = Math.min(Math.max(x, 0), this.width - 1);
        y = Math.min(Math.max(y, 0), this.height - 1);

        // update the displayed coordinates (editor mode only)
        if (this.editorMode) {
            const coordinates = document.getElementById('coordinates');
            coordinates.innerHTML = `(${x}, ${y})`;
        }

        // return unless dragging
        if (!this.clickPoint) return;

        const w = Math.abs(x - this.clickPoint.x) + 1;
        const h = Math.abs(y - this.clickPoint.y) + 1;
        x = Math.min(x, this.clickPoint.x);
        y = Math.min(y, this.clickPoint.y);

        // create the tile selection
        this.selection.x = x;
        this.selection.y = y;
        this.selection.w = w;
        this.selection.h = h;
        this.selection.tilemap = new Uint32Array(w * h);
        for (let r = 0; r < h; r++) {
            const begin = x + (y + r) * this.width;
            const end = begin + w;
            const line = this.tilemap.subarray(begin, end);
            this.selection.tilemap.set(line, r * w);
        }

        // redraw the cursor and notify the tilemap view
        this.drawCursor();
        if (this.tilemapView) {
            this.tilemapView.selection = {
                x: 0, y: 0, w: w, h: h,
                tilemap: new Uint32Array(this.selection.tilemap)
            };
        }
    }

    selectTile(tile) {

        // select a single tile from the tilemap view
        const t = tile & 0xFFFF;
        const v = tile & 0x20000000;
        const h = tile & 0x10000000;
        const z = tile & 0x0F000000;

        let x = t % this.width;
        let y = Math.floor(t / this.width);

        this.hFlip = h ? true : false;
        this.vFlip = v ? true : false;

        if (this.hFlip) x = this.width - x - 1;
        if (this.vFlip) y = this.height - y - 1;

        this.selection = {
            x: x, y: y, w: 1, h: 1,
            tilemap: new Uint32Array(1)
        };
        this.updateTilemap();
        this.scrollToSelection();
        this.redraw();

        const vButton = document.getElementById('graphics-v-flip');
        if (vButton) {
            vButton.checked = this.vFlip;
            twoState(vButton);
        }

        const hButton = document.getElementById('graphics-h-flip');
        if (hButton) {
            hButton.checked = this.hFlip;
            twoState(hButton);
        }

        const zControl = document.getElementById('graphics-z-level');
        if (zControl) {
            zControl.value = z >> 24;
        }
    }

    updateTilemap() {
        if (this.object && this.object.spriteSheet) {
            let spriteSheetArray = this.object.spriteSheet;
            if (!isArray(spriteSheetArray)) spriteSheetArray = [spriteSheetArray];
            this.spriteSheet = spriteSheetArray[this.ss];
        }

        let p = (this.paletteView.p * this.paletteView.colorsPerPalette) << 16;
        let tileCount;
        if (this.toolboxMode) {

            // never use a sprite sheet in toolbox mode
            this.spriteSheet = null;
            tileCount = Math.floor(this.graphics.length / this.bytesPerTile);

            this.tilemap = new Uint32Array(this.height * this.width);
            this.tilemap.fill(0xFFFFFFFF);

            for (let t = 0; t < tileCount; t++) this.tilemap[t] = t | p;

        } else if (this.spriteSheet) {
            // use a sprite sheet
            this.width = this.spriteSheet.width || this.width;
            this.height = this.spriteSheet.height || Math.ceil(this.graphics.length / this.bytesPerTile / this.width);
            tileCount = this.width * this.height;
            this.tilemap = new Uint32Array(tileCount);
            this.tilemap.fill(0xFFFFFFFF);
            if (this.spriteSheet.fixedPalette) p = 0;
            for (let t = 0; t < this.tilemap.length; t++) {
                var tile = Number(this.spriteSheet.tilemap[t]);
                if (isNumber(tile) && tile !== -1) this.tilemap[t] = tile | p;
            }

        } else {
            // no sprite sheet
            if (this.object) this.width = this.object.width || 16;
            this.height = Math.ceil(this.graphics.length / this.bytesPerTile / this.width) || 1;
            tileCount = this.height * this.width;
            this.tilemap = new Uint32Array(tileCount);
            this.tilemap.fill(0xFFFFFFFF);
            for (let t = 0; t < this.tilemap.length; t++) this.tilemap[t] = t | p;
        }

        // apply v-flip
        if (this.vFlip) {
            const vTilemap = new Uint32Array(this.tilemap.length);
            let t = 0;
            while (t < tileCount) {
                for (let y = 0; y < this.height; y++) {
                    for (let x = 0; x < this.width; x++) {
                        const t1 = x + (this.height - y - 1) * this.width;
                        vTilemap[t1] = this.tilemap[t++] ^ 0x20000000;
                    }
                }
            }
            this.tilemap = vTilemap;
        }

        // apply h-flip
        if (this.hFlip) {
            const hTilemap = new Uint32Array(this.tilemap.length);
            let t = 0;
            while (t < tileCount) {
                for (let y = 0; y < this.height; y++) {
                    for (let x = 0; x < this.width; x++) {
                        const t1 = (this.width - x - 1) + y * this.width;
                        hTilemap[t1] = this.tilemap[t++] ^ 0x10000000;
                    }
                }
            }
            this.tilemap = hTilemap;
        }

        // update ppu and off-screen canvas size
        this.ppu.width = this.width * this.tileWidth;
        this.ppu.height = this.height * this.tileHeight;
        this.graphicsCanvas.width = this.ppu.width;
        this.graphicsCanvas.height = this.ppu.height;

        // set up ppu layer
        this.ppu.layers[0].format = null;
        this.ppu.layers[0].cols = this.width;
        this.ppu.layers[0].rows = this.height;
        this.ppu.layers[0].z[0] = GFX.Z.top;
        this.ppu.layers[0].z[1] = GFX.Z.top;
        this.ppu.layers[0].z[2] = GFX.Z.top;
        this.ppu.layers[0].z[3] = GFX.Z.top;
        this.ppu.layers[0].gfx = this.graphics;
        this.ppu.layers[0].tiles = this.tilemap;
        this.ppu.layers[0].tileWidth = this.tileWidth;
        this.ppu.layers[0].tileHeight = this.tileHeight;
        this.ppu.layers[0].main = true;
    }

    scrollToSelection() {
        var selectionHeight = this.selection.h * this.tileHeight * this.zoom;
        var clientHeight = this.canvasDiv.clientHeight;

        var selectionTop = this.selection.y * this.tileWidth * this.zoom;
        var selectionBottom = selectionTop + selectionHeight;
        var visibleTop = this.canvasDiv.scrollTop;
        var visibleBottom = visibleTop + clientHeight;

        // return if the selection is visible
        if (selectionTop >= visibleTop && selectionBottom <= visibleBottom) return;

        // scroll so that the selection is centered vertically in the div
        var scrollCenter = selectionTop + selectionHeight * 0.5;
        var scrollBottom = Math.min(scrollCenter + clientHeight * 0.5, this.canvas.height);
        var scrollTop = Math.max(0, scrollBottom - clientHeight);
        this.canvasDiv.scrollTop = scrollTop;
    }

    resize(clientWidth, clientHeight) {

        if (this.toolboxMode) {

            if (!isNumber(clientWidth)) {
                clientWidth = this.div.scrollWidth;
            }

            // calculate zoom assuming no scroll bar
            this.canvasDiv.style.overflowY = 'hidden';
            this.canvasDiv.style.width = `${clientWidth}px`;
            this.zoom = this.canvasDiv.clientWidth / this.ppu.width;
            if (this.zoom > 4.0) this.zoom = 4.0;
            this.canvasDiv.style.height = `${this.ppu.height * this.zoom}px`;

            if (!isNumber(clientHeight)) {
                clientHeight = this.div.scrollHeight;
            }

            const divHeight = this.div.scrollHeight;
            const canvasHeight = this.canvasDiv.scrollHeight;
            const otherHeight = divHeight - canvasHeight;
            if (divHeight > clientHeight) {

                // add a scroll bar if graphics is too tall
                const canvasHeight = clientHeight - otherHeight;
                this.canvasDiv.style.height = `${canvasHeight}px`;
                this.canvasDiv.style.overflowY = 'scroll';

                // recalculate zoom based on client width (max 4)
                this.zoom = this.canvasDiv.clientWidth / this.ppu.width;
                if (this.zoom > 4.0) this.zoom = 4.0;
            }

        } else {

            // update canvas div size
            const w = Math.ceil(this.ppu.width * this.zoom);
            const h = Math.ceil(this.ppu.height * this.zoom);
            this.canvasDiv.style.overflowY = 'hidden';
            this.canvasDiv.style.width = `${w}px`;
            this.canvasDiv.style.height = `${h}px`;
        }
    }

    redraw() {
        this.drawGraphics();
        this.drawCursor();
    }

    drawGraphics() {

        if (this.ppu.height === 0) return;

        // create the color palette
        const palette = new Uint32Array(this.paletteView.palette);
        this.ppu.pal = this.rom.gammaCorrectedPalette(palette);
        this.ppu.back = this.backColor;

        // draw layout image
        let context = this.graphicsCanvas.getContext('2d');
        const imageData = context.createImageData(this.ppu.width, this.ppu.height);
        this.ppu.renderPPU(imageData.data, 0, 0, this.ppu.width, this.ppu.height);
        context.putImageData(imageData, 0, 0);

        // update canvas size
        const w = this.ppu.width * this.zoom;
        const h = this.ppu.height * this.zoom;
        this.canvas.width = w;
        this.canvas.height = h;

        // scale image to zoom setting
        context = this.canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.drawImage(this.graphicsCanvas,
            0, 0, this.graphicsCanvas.width, this.graphicsCanvas.height,
            0, 0, w, h);
    }

    drawCursor() {

        // update canvas size
        this.cursorCanvas.width = this.ppu.width * this.zoom;
        this.cursorCanvas.height = this.ppu.height * this.zoom;

        // clear the cursor canvas
        var ctx = this.cursorCanvas.getContext('2d');

        // return if trigger layer is selected
        if (!this.selection.tilemap.length) return;

        // get the cursor geometry
        const l = Math.floor(this.selection.x * this.tileWidth * this.zoom);
        const t = Math.floor(this.selection.y * this.tileHeight * this.zoom);
        const r = Math.ceil((this.selection.x + this.selection.w) * this.tileWidth * this.zoom);
        const b = Math.ceil((this.selection.y + this.selection.h) * this.tileHeight * this.zoom);
        let x = l;
        let y = t
        let w = r - l;
        let h = b - t;

        // draw the cursor
        if (x > this.width * this.tileWidth * this.zoom ||
            y > this.height * this.tileHeight * this.zoom) return;
        if (w <= 0 || h <= 0) return;

        // convert the selection to screen coordinates
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'black';
        x += 0.5; y += 0.5; w--; h--;
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

    selectObject(object) {

        // this is only valid in editor mode
        this.editorMode = true;

        this.div.innerHTML = '';
        this.div.classList.add('map-edit');
        // this.div.id = 'map-edit';
        this.div.tabIndex = 0;
        this.div.style.outline = 'none';
        this.div.appendChild(this.canvasDiv);

        // select an object with this view as the editor
        if (!(object instanceof ROMGraphics)) return;

        // start observing the graphics object
        this.observer.stopObservingAll();

        this.object = object;
        this.graphics = object.data;
        this.definition = null;
        this.width = object.width || 16;
        this.height = object.height || 16;
        this.tileWidth = object.tileWidth || 8;
        this.tileHeight = object.tileHeight || 8;
        this.bytesPerTile = this.tileWidth * this.tileHeight;
        this.backColor = object.backColor;
        this.selection = {
            x: 0, y: 0, w: 0, h: 0,
            tilemap: new Uint32Array()
        };
        this.spriteSheet = null;

        // get the graphics format
        let formatKey = this.object.format;

        // for assemblies with multiple formats, the graphics format is the first one
        if (isArray(formatKey)) formatKey = formatKey[0];

        // ignore format parameters
        if (formatKey.includes('(')) {
            formatKey = formatKey.substring(0, formatKey.indexOf('('));
        }
        this.format = GFX.graphicsFormat[formatKey];

        const self = this;
        this.observer.startObserving(object, function() {
            self.selectObject(object);
            self.redraw();
        });

        // load the palette
        this.paletteView.loadDefinition(object.palette);
        this.paletteView.updateToolbox();
        this.toolbox.setHeight(this.paletteView.div.scrollHeight);
        this.paletteView.resize();
        this.paletteView.redraw();

        this.resetControls();
        this.updateTilemap();
        this.resize();
        this.redraw();
    }

    loadDefinition(definition) {

        // this is only valid in toolbox mode
        this.toolboxMode = true;

        // load graphics from a definition (via ROMTilemapView)
        this.definition = definition;
        this.format = this.tilemapView.format;
        this.backColor = this.tilemapView.backColor;
        this.graphicsArray = [];
        // this.canvasDiv.classList.add("background-gradient");

        this.observer.stopObservingAll();

        // clear the graphics
        this.graphics = new Uint8Array();
        this.width = null;
        this.height = null;

        // load graphics from the definition
        this.loadGraphics(definition);
        if (!this.tileWidth) this.tileWidth = 8;
        if (!this.tileHeight) this.tileHeight = 8;
        this.bytesPerTile = this.tileWidth * this.tileHeight;
        if (!this.width) this.width = 16;
        if (!this.height) {
            this.height = Math.ceil(this.graphics.length / this.bytesPerTile / this.width);
        }
    }

    loadGraphics(definition) {
        if (!definition) return;

        // multiple choice of graphics (outer array)
        if (isArray(definition)) {
            if (definition.length === 0) return;
            if (definition.length > 1) {
                for (const def of definition) this.graphicsArray.push(def);
            }
            // load the first array element as a placeholder
            definition = definition[0];
        }

        // recursively load multiple graphics (inner array)
        if (isArray(definition)) {
            for (const def of definition) this.loadGraphics(def);
            return;
        }

        // get path
        var path = isString(definition) ? definition : definition.path;
        if (!path) return;

        // parse object
        var index = 0;
        if (this.tilemapView) {
            index = this.tilemapView.object.i;
        }
        var object = this.rom.parsePath(path, this.rom, index);

        // load ROMArray objects as multiple choice
        if (object instanceof ROMArray) {
            this.graphicsArray.push(definition);

            // load the first array item as a placeholder
            object = object.item(0);
        }

        // get object data
        if (!object || !object.data) return;
        let data = object.data;

        if (object.width) this.width = object.width;
        if (object.height) this.height = object.height;
        if (object.tileWidth) this.tileWidth = object.tileWidth;
        if (object.tileHeight) this.tileHeight = object.tileHeight;

        const self = this;
        this.observer.startObserving(object, function() {

            // reload the graphics
            self.loadDefinition(self.definition);

            // reload the multiple choice selection
            const graphicsSelectControl = document.getElementById('graphics-select-control');
            if (graphicsSelectControl) {
                self.loadGraphics(JSON.parse(graphicsSelectControl.value));
            }

            // redraw everything
            self.updateTilemap();
            self.redraw();
            if (self.tilemapView) self.tilemapView.redraw();
        });

        // parse data range
        let range;
        if (definition.range) {
            range = ROMRange.parse(definition.range);
            data = data.subarray(range.begin, range.end);
        } else {
            range = new ROMRange(0, data.length);
        }

        // parse offset
        const offset = Number(definition.offset) || 0;

        if (this.graphics.length < (offset + data.length)) {
            // increase the size of the graphics buffer
            const newGraphics = new Uint8Array(offset + data.length);
            newGraphics.set(this.graphics);
            this.graphics = newGraphics;
        }
        this.graphics.set(data, offset);
    }

    importGraphics(graphics, offset = 0) {
        if ((graphics.length + offset) > this.graphics.length) {
            // trim the graphics to fit
            graphics = graphics.subarray(0, this.graphics.length - offset);
        }

        // copy imported data to the current graphics
        this.graphics.set(graphics, offset);

        // set graphics data
        this.observer.sleep();
        if (isArray(this.definition)) {
            if (this.definition.length === 1) this.saveGraphics(this.definition[0]);
        } else {
            this.saveGraphics(this.definition);
        }

        const graphicsSelectControl = document.getElementById('graphics-select-control');
        if (graphicsSelectControl) {
            this.saveGraphics(JSON.parse(graphicsSelectControl.value));
        }
        this.observer.wake();

        // redraw the view
        this.redraw();
        if (this.tilemapView) this.tilemapView.redraw();
    }

    saveGraphics(definition) {
        if (!definition) return;

        // recursively save graphics
        if (isArray(definition)) {
            for (const def of definition) this.saveGraphics(def);
            return;
        }

        // get path
        const path = isString(definition) ? definition : definition.path;
        if (!path) return;

        // parse object
        let index = 0;
        if (this.tilemapView) {
            index = this.tilemapView.object.i;
        }
        const object = this.rom.parsePath(path, this.rom, index);

        // ignore ROMArray objects for now
        if (object instanceof ROMArray) return;

        // // get object data
        // if (!object || !object.data) return;
        // let data = object.data;

        // parse data range
        let range;
        if (definition.range) {
            range = ROMRange.parse(definition.range);
        } else {
            range = new ROMRange(0, data.length);
        }

        // parse offset
        const offset = Number(definition.offset) || 0;

        let graphics = this.graphics.subarray(offset, offset + range.length);

        // convert to and from the native format to validate the data
        if (object.format) {
            // get the graphics format
            let formatKey = object.format;

            // for assemblies with multiple formats, the graphics format is the first one
            if (isArray(formatKey)) formatKey = formatKey[0];

            // ignore format parameters
            if (formatKey.includes('(')) {
                formatKey = formatKey.substring(0, formatKey.indexOf('('));
            }
            const format = GFX.graphicsFormat[formatKey];

            if (format) graphics = format.decode(format.encode(graphics)[0])[0];
        }

        if (range.begin + graphics.length > object.data.length) {
            graphics = graphics.subarray(0, object.data.length - range.begin);
        }
        object.setData(graphics, range.begin);
    }

    updateToolbox() {
        var self = this;
        this.div.innerHTML = '';

        function valueForDefinition(definition, index) {

            if (!definition) return null;
            var path = definition.path || definition;
            if (!isString(path)) return null;

            if (isNumber(index)) path += `[${index}]`;

            if (isString(definition)) return JSON.stringify({path: path});

            var value = {};
            Object.assign(value, definition);
            value.path = path;
            return JSON.stringify(value);
        }

        if (this.graphicsArray.length) {
            // create a dropdown for array graphics
            var graphicsSelectDiv = document.createElement('div');
            graphicsSelectDiv.classList.add('property-div');
            this.div.appendChild(graphicsSelectDiv);

            var graphicsSelectControl = document.createElement('select');
            graphicsSelectControl.classList.add('property-control');
            graphicsSelectControl.id = 'graphics-select-control';
            graphicsSelectDiv.appendChild(graphicsSelectControl);

            var option;
            var index = 0;
            if (this.tilemapView) {
                index = this.tilemapView.object.i;
            }
            var selectedValue = null;
            for (var i = 0; i < this.graphicsArray.length; i++) {
                var graphicsDefinition = this.graphicsArray[i];
                if (!graphicsDefinition) continue;
                var graphicsPath = graphicsDefinition.path || graphicsDefinition;
                if (!isString(graphicsPath)) continue;
                graphicsPath = this.rom.parseIndex(graphicsPath, index);
                var graphicsObject = this.rom.parsePath(graphicsPath);
                if (!graphicsObject) continue;

                if (graphicsObject instanceof ROMArray) {
                    for (var j = 0; j < graphicsObject.arrayLength; j++) {
                        var value = valueForDefinition(graphicsDefinition, j);
                        if (!value) continue;
                        option = document.createElement('option');
                        option.value = value;
                        if (graphicsDefinition.name) {
                            option.innerHTML = graphicsDefinition.name;
                        } else if (graphicsObject.stringTable) {
                            var stringTable = this.rom.stringTable[graphicsObject.stringTable];
                            var string = stringTable.string[j];
                            if (string) {
                                option.innerHTML = `${j}: ${string.fString(40)}`;
                            } else {
                                option.innerHTML = `${j}: ${graphicsObject.name} ${j}`;
                            }
                        } else {
                            option.innerHTML = `${j}: ${graphicsObject.name} ${j}`;
                        }
                        if (!selectedValue) selectedValue = option.value;
                        if (option.value === this.selectedValue) selectedValue = option.value;
                        graphicsSelectControl.appendChild(option);
                    }
                } else if (graphicsObject instanceof ROMAssembly) {
                    var value = valueForDefinition(graphicsDefinition);
                    if (!value) continue;
                    option = document.createElement('option');
                    option.value = value;
                    if (graphicsDefinition.name) {
                        option.innerHTML = graphicsDefinition.name;
                    } else if (isNumber(graphicsObject.i)) {
                        if (graphicsObject.parent.stringTable) {
                            var stringTable = this.rom.stringTable[graphicsObject.parent.stringTable];
                            var string = stringTable.string[graphicsObject.i];
                            if (string) {
                                option.innerHTML = string.fString(40);
                            } else {
                                option.innerHTML = `${graphicsObject.name} ${graphicsObject.i}`;
                            }
                        } else {
                            option.innerHTML = `${graphicsObject.name} ${graphicsObject.i}`;
                        }
                    } else {
                        option.innerHTML = graphicsObject.name;
                    }
                    if (!selectedValue) selectedValue = option.value;
                    if (option.value === this.selectedValue) selectedValue = option.value;
                    graphicsSelectControl.appendChild(option);
                }
            }
            graphicsSelectControl.value = selectedValue;
            this.loadGraphics(JSON.parse(selectedValue));
            this.selectedValue = selectedValue;

            var self = this;
            graphicsSelectControl.onchange = function() {

                self.loadGraphics(JSON.parse(this.value));
                self.selectedValue = this.value;
                self.redraw();
                if (self.tilemapView) self.tilemapView.redraw();
            }
        }

        var showZLevelControl = this.format.maxZ && !this.tilemapView.object.disableZLevel;
        var showVFlipControl = this.format.vFlip && !this.tilemapView.object.disableVFlip;
        var showHFlipControl = this.format.hFlip && !this.tilemapView.object.disableHFlip;

        // add controls for v/h flip, z-level
        if (showZLevelControl || showVFlipControl || showHFlipControl) {

            var graphicsControlsDiv = document.createElement('div');
            graphicsControlsDiv.classList.add('graphics-controls');
            this.div.appendChild(graphicsControlsDiv);
        }

        if (showVFlipControl) {
            var vLabel = document.createElement('label');
            vLabel.classList.add('two-state');
            vLabel.style.display = 'inline-block';
            if (this.vFlip) vLabel.classList.add('checked');
            graphicsControlsDiv.appendChild(vLabel);

            var vInput = document.createElement('input');
            vInput.type = 'checkbox';
            vInput.checked = this.vFlip;
            vInput.id = 'graphics-v-flip';
            vInput.onclick = function() {
                twoState(this);
                self.vFlip = this.checked;
                self.tilemapView.toggleSelectionVFlip();
                self.selection.y = self.height - self.selection.y - self.selection.h;
                self.updateTilemap();
                self.scrollToSelection();
                self.redraw();
            };
            vLabel.appendChild(vInput);

            var vText = document.createElement('p');
            vText.innerHTML = 'V-Flip';
            vLabel.appendChild(vText);
        }

        if (showHFlipControl) {
            var hLabel = document.createElement('label');
            hLabel.classList.add('two-state');
            hLabel.style.display = 'inline-block';
            if (this.hFlip) hLabel.classList.add('checked');
            graphicsControlsDiv.appendChild(hLabel);

            var hInput = document.createElement('input');
            hInput.type = 'checkbox';
            hInput.checked = this.hFlip;
            hInput.id = 'graphics-h-flip';
            hInput.onclick = function() {
                twoState(this);
                self.hFlip = this.checked;
                self.tilemapView.toggleSelectionHFlip();
                self.selection.x = self.width - self.selection.x - self.selection.w;
                self.updateTilemap();
                self.scrollToSelection();
                self.redraw();
            };
            hLabel.appendChild(hInput);

            var hText = document.createElement('p');
            hText.innerHTML = 'H-Flip';
            hLabel.appendChild(hText);
        }

        if (showZLevelControl) {
            var zLabel = document.createElement('label');
            zLabel.innerHTML = 'Z-Level:';
            zLabel.style.display = 'inline-block';
            zLabel.style.padding = '2px 10px';
            zLabel.style.margin = '4px 3px';
            zLabel.htmlFor = 'graphics-z-level';
            graphicsControlsDiv.appendChild(zLabel);

            var zInput = document.createElement('input');
            zInput.id = 'graphics-z-level';
            zInput.type = 'number';
            zInput.classList.add('property-control');
            zInput.style.width = '3em';
            zInput.value = 0;
            zInput.min = 0;
            zInput.max = this.format.maxZ - 1;
            zInput.onchange = function() {
                self.z = Number(this.value);
                self.tilemapView.setSelectionZ(self.z);
                self.updateTilemap();
                self.scrollToSelection();
                self.redraw();
            };
            graphicsControlsDiv.appendChild(zInput);
        }

        // show the graphics canvas
        this.div.appendChild(this.canvasDiv);

        // add graphics import/export buttons
        var importExportDiv = document.createElement('div');
        importExportDiv.classList.add('property-div');
        this.div.appendChild(importExportDiv);

        var exportButton = document.createElement('button');
        exportButton.innerHTML = 'Export Graphics';
        exportButton.onclick = function() {
            var exporter = new ROMGraphicsExporter();
            exporter.export({
                tilemap: self.tilemap,
                graphics: self.graphics,
                palette: self.paletteView.palette,
                width: self.width,
                tileWidth: self.tileWidth,
                tileHeight: self.tileHeight,
                backColor: self.backColor
            });
        };
        importExportDiv.appendChild(exportButton);

        var importButton = document.createElement('button');
        importButton.innerHTML = 'Import Graphics';
        importButton.onclick = function() {
            function callback(graphics, palette) {
                // set the new graphics/palette data
                self.rom.beginAction();
                if (graphics) self.importGraphics(graphics);
                if (palette) self.paletteView.importPalette(palette);
                self.rom.endAction();
            }
            var importer = new ROMGraphicsImporter(rom, self, callback);
        };
        importExportDiv.appendChild(importButton);
    }
}

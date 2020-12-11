//
// ff4-map-gba-tileset.js
// created 9/9/2020
//

class FF4MapGBATileset extends ROMToolbox {

    constructor(rom, map) {
        super(rom);
        this.map = map;

        // off-screen canvas
        this.tilesetCanvas = document.createElement('canvas');
        this.tilesetCanvas.width = 256;
        this.tilesetCanvas.height = 256;

        // on-screen canvas for tileset and cursor
        this.canvas = document.createElement('canvas');
        this.canvas.classList.add('tileset-canvas');
        this.canvas.classList.add('background-gradient');
        this.cursorCanvas = document.createElement('canvas');
        this.cursorCanvas.classList.add('cursor-canvas');

        // div for tile properties in toolbox
        this.tileDiv = document.createElement('div');
        this.tileDiv.id = 'tile-div';

        this.layer = [new FF4MapGBALayer(rom, FF4MapGBALayer.Type.layer1),
                      new FF4MapGBALayer(rom, FF4MapGBALayer.Type.layer2)];

        this.selection = {
            x: 0, y: 0, w: 1, h: 1,
            tilemap: new Uint8Array(1)
        };
        this.clickPoint = null;

        this.ppu = new GFX.PPU();

        // add message handlers
        const self = this;
        this.canvas.onmousedown = function(e) { self.mouseDown(e); };
        this.canvas.onmouseup = function(e) { self.mouseUp(e); };
        this.canvas.onmousemove = function(e) { self.mouseMove(e); };
        this.canvas.onmouseout = function(e) { self.mouseOut(e); };
        this.canvas.oncontextmenu = function() { return false; };
    }

    show() {
        // init the toolbox
        this.addButtons();
        const self = this;
        this.buttons[0].onclick = function() { self.selectLayer(0); };
        this.buttons[1].onclick = function() { self.selectLayer(1); };
        this.buttons[2].onclick = function() { self.selectLayer(2); };
        this.buttons[3].onclick = function() { self.selectLayer(3); };
        this.selectButton(this.map.l);
        this.div.innerHTML = '';
        this.div.appendChild(this.canvas);
        this.div.appendChild(this.cursorCanvas);
        this.div.appendChild(this.tileDiv);

        super.show();
    }

    resize() {
        // hide tileset if triggers are selected
        if (this.map.l === 3) {
            this.setHeight(0);

        } else if (this.map.l === 2) {
            // adjust the pane dimensions
            this.setHeight(this.tileDiv.scrollHeight);

        } else {
            // calculate zoom assuming no scrollbars
            this.zoom = Math.min(this.div.offsetWidth / this.ppu.width, 4.0);

            // adjust the pane dimensions
            this.setHeight(Math.floor(this.ppu.height * this.zoom));

            // recalculate zoom with possible scrollbar
            this.zoom = Math.min(this.div.clientWidth / this.ppu.width, 4.0);
        }
    }

    mouseDown(e) {
        let x = Math.floor(e.offsetX / this.zoom / 16);
        x = Math.min(Math.max(x, 0), 15);
        let y = Math.floor(e.offsetY / this.zoom / 16);
        y = Math.min(Math.max(y, 0), 15);
        this.clickPoint = { x: x, y: y };
        this.mouseMove(e);

        if (this.map.l === 2) {
            // select normal map properties
            const mask = this.clickPoint.x >> 1;
            const maskType = this.getMaskType(mask);
            if (maskType) {
                this.selection = {
                    x: 0, y: maskType.index, w: 1, h: 1,
                    tilemap: new Uint8Array([maskType.value])
                }
                this.drawCursor();
                this.map.selection = {
                    x: 0, y: 0, w: 1, h: 1,
                    tilemap: new Uint8Array([maskType.value])
                }
            }
        } else if (this.map.isWorld && this.map.w !== 2 && this.map.l < 2) {
            // select world map properties
            this.map.selectWorldTileProperties(x + y * 16);
        }
    }

    mouseUp(e) {
        this.clickPoint = null;
    }

    mouseOut(e) {
        this.mouseUp(e);
    }

    mouseMove(e) {
        // return unless dragging (except if trigger layer selected)
        if (!this.clickPoint || this.map.l >= 2) return;

        let x = Math.floor(e.offsetX / this.zoom / 16);
        x = Math.min(Math.max(x, 0), 15);
        let y = Math.floor(e.offsetY / this.zoom / 16);
        y = Math.min(Math.max(y, 0), 15);

        const w = Math.abs(x - this.clickPoint.x) + 1;
        const h = Math.abs(y - this.clickPoint.y) + 1;
        x = Math.min(x, this.clickPoint.x);
        y = Math.min(y, this.clickPoint.y);

        // create the tile selection
        this.selection = {
            x: x, y: y, w: w, h: h,
            tilemap: new Uint8Array(w * h)
        };

        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                this.selection.tilemap[c + r * w] = x + c + (y + r) * 16;
            }
        }

        // redraw the cursor and notify the map
        this.drawCursor();
        this.map.selection = {
            x: 0, y: 0, w: w, h: h,
            tilemap: this.selection.tilemap.slice()
        }
    }

    loadMap(m) {
        // create a sequential tile layout
        const layout = new Uint8Array(256);
        for (let i = 0; i < 256; i++) layout[i] = i;

        // set up the ppu
        this.ppu.pal = this.map.ppu.pal;
        this.ppu.width = 256;
        this.ppu.height = 256;

        this.layer[0].loadLayout({
            type: this.map.layer[0].type,
            layout: layout,
            tileset: this.map.layer[0].tileset,
            w: 16, h: 16
        });
        this.layer[1].loadLayout({
            type: this.map.layer[1].type,
            layout: layout,
            tileset: this.map.layer[1].tileset,
            w: 16, h: 16
        });

        // layer 1
        this.ppu.layers[0].format = GFX.TileFormat.gba4bppTile;
        this.ppu.layers[0].rows = 32;
        this.ppu.layers[0].cols = 32;
        this.ppu.layers[0].z[0] = GFX.Z.snes1L;
        this.ppu.layers[0].z[1] = GFX.Z.snes1H;
        this.ppu.layers[0].gfx = this.map.ppu.layers[0].gfx;
        this.ppu.layers[0].tiles = this.layer[0].tiles;

        // layer 2
        this.ppu.layers[1].format = GFX.TileFormat.gba4bppTile;
        this.ppu.layers[1].rows = 32;
        this.ppu.layers[1].cols = 32;
        this.ppu.layers[1].z[0] = GFX.Z.snes2L;
        this.ppu.layers[1].z[1] = GFX.Z.snes2H;
        this.ppu.layers[1].gfx = this.map.ppu.layers[1].gfx;
        this.ppu.layers[1].tiles = this.layer[1].tiles;

        // disable layer 3 button on world map
        if (this.map.isWorld && this.map.w !== 2) {
            if (this.map.l === 2) this.map.l = 0;
            this.buttons[2].disabled = true;
        } else {
            this.buttons[2].disabled = false;
        }

        this.selectLayer(this.map.l);
    }

    selectLayer(l) {
        this.selectButton(l);

        // set the selected layer
        this.map.selectLayer(l);

        // turn on only the selected layer
        this.ppu.layers[0].main = false;
        this.ppu.layers[1].main = false;
        if (this.map.l === 3) {
            this.canvas.classList.add('hidden');
            this.cursorCanvas.classList.add('hidden');
            this.tileDiv.classList.add('hidden');

        } else if (this.map.l === 2) {
            this.canvas.classList.add('hidden');
            this.cursorCanvas.classList.add('hidden');
            this.tileDiv.classList.remove('hidden');
            this.updateTileDiv();

        } else {
            this.canvas.classList.remove('hidden');
            this.cursorCanvas.classList.remove('hidden');
            this.tileDiv.classList.add('hidden');
            this.ppu.layers[this.map.l].main = true;
        }

        this.resize();
        this.redraw();
    }

    redraw() {
        // don't draw if triggers are selected
        if (this.map.l >= 2) return;

        this.drawTileset();
        this.drawCursor();
    }

    drawTileset() {
        // draw tileset to offscreen canvas
        const tilesetCtx = this.tilesetCanvas.getContext('2d');
        tilesetCtx.globalCompositeOperation = 'copy';
        const imageData = tilesetCtx.createImageData(this.ppu.width, this.ppu.height);
        this.ppu.renderPPU(imageData.data);
        tilesetCtx.putImageData(imageData, 0, 0);

        // update canvas size
        const w = this.ppu.width * this.zoom;
        const h = this.ppu.height * this.zoom;
        this.canvas.width = w;
        this.canvas.height = h;

        // draw tileset image
        const ctx = this.canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.globalCompositeOperation = 'copy';
        ctx.drawImage(this.tilesetCanvas, 0, 0, w, h);
    }

    drawCursor() {
        // update canvas size
        this.cursorCanvas.width = this.ppu.width * this.zoom;
        this.cursorCanvas.height = this.ppu.height * this.zoom;

        const ctx = this.cursorCanvas.getContext('2d');

        // return if trigger layer is selected
        if (this.map.l === 3 || !this.selection) return;

        // get the cursor geometry
        const l = Math.floor(this.selection.x * 16 * this.zoom);
        const t = Math.floor(this.selection.y * 16 * this.zoom);
        const r = Math.ceil((this.selection.x + this.selection.w) * 16 * this.zoom);
        const b = Math.ceil((this.selection.y + this.selection.h) * 16 * this.zoom);
        let x = l;
        let y = t
        let w = r - l;
        let h = b - t;

        // return if cursor size is invalid
        if (w <= 0 || h <= 0) return;

        // draw the cursor
        const colors = ['green', 'blue', 'red', 'white'];
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'black';
        x += 0.5; y += 0.5; w--; h--;
        ctx.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        ctx.strokeStyle = colors[this.map.l];
        ctx.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        ctx.strokeStyle = 'white';
        ctx.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        ctx.strokeStyle = 'black';
        ctx.strokeRect(x, y, w, h);
    }

    updateTileDiv() {

        const self = this;
        this.tileDiv.innerHTML = '';

        const headingDiv = document.createElement('div');
        headingDiv.classList.add('property-heading');
        this.tileDiv.appendChild(headingDiv);

        const heading = document.createElement('p');
        heading.innerHTML = `Tile Properties (${this.selection.x}, ${this.selection.y}) ${this.map.z}`;
        headingDiv.appendChild(heading);

        // tile type
        const tileTypeDiv = document.createElement('div');
        tileTypeDiv.classList.add('property-div');
        this.tileDiv.appendChild(tileTypeDiv);

        const tileTypeLabel = document.createElement('p');
        tileTypeLabel.classList.add('property-label');
        tileTypeLabel.innerHTML = 'Type:';
        tileTypeLabel.htmlFor = 'tile-type-control';
        tileTypeDiv.appendChild(tileTypeLabel);

        const tileTypeControlDiv = document.createElement('div');
        tileTypeControlDiv.classList.add('property-control-div');
        tileTypeDiv.appendChild(tileTypeControlDiv);

        const tileTypeControl = document.createElement('select');
        tileTypeControl.classList.add('property-control');
        tileTypeControl.id = 'tile-type-control';
        tileTypeControlDiv.appendChild(tileTypeControl);

        const currentTile = this.selection.tilemap[0];
        for (const key in FF4MapGBATileset.MaskType) {
            const maskType = FF4MapGBATileset.MaskType[key];
            const option = document.createElement('option');
            option.value = maskType.value;
            option.innerHTML = maskType.name;
            tileTypeControl.appendChild(option);
            if (this.getMaskType(currentTile) === maskType) {
                tileTypeControl.value = maskType.value;
            }
        }

        function callback() {
            self.map.drawMap();
            self.updateTileDiv();
        }

        tileTypeControl.onchange = function() {
            self.selection.tilemap[0] = Number(this.value);
            self.map.beginAction(callback);
            self.map.selection = self.selection;
            self.map.setTiles();
            self.map.endAction(callback);
        }

        if (this.map.w === 2 && currentTile & 0x40) {
            // moon exit
            const exitDiv = this.createMoonExitDiv();
            if (exitDiv) this.tileDiv.appendChild(exitDiv);
        } else if (currentTile & 0x20) {
            // treasure index
            const treasureDiv = this.createTreasureDiv();
            if (treasureDiv) this.tileDiv.appendChild(treasureDiv);
        } else if (currentTile & 0x40) {
            // exit index
            const exitDiv = this.createExitDiv();
            if (exitDiv) this.tileDiv.appendChild(exitDiv);
        }

        propertyList.updateLabels();
        this.resize();
    }

    createTreasureDiv() {

        const self = this;
        const treasureDiv = document.createElement('div');
        treasureDiv.classList.add('property-div');

        const treasureLabel = document.createElement('p');
        treasureLabel.classList.add('property-label');
        treasureLabel.innerHTML = 'Treasure:';
        treasureLabel.htmlFor = 'tile-treasure-control';
        treasureDiv.appendChild(treasureLabel);

        const treasureControlDiv = document.createElement('div');
        treasureControlDiv.classList.add('property-control-div');
        treasureDiv.appendChild(treasureControlDiv);

        const treasureControl = document.createElement('select');
        treasureControl.classList.add('property-control');
        treasureControl.id = 'tile-treasure-control';
        treasureControlDiv.appendChild(treasureControl);

        const triggerIndex = this.map.mapProperties.treasures.value;
        const treasurePointers = this.rom.mapTriggerPointers.item(triggerIndex);
        const treasures = treasurePointers.triggerPointer.target;
        for (let t = 0; t < treasures.array.length; t++) {
            const treasure = treasures.item(t);
            const option = document.createElement('option');
            option.value = t;
            option.innerHTML = `${treasure.name} ${t}`;
            treasureControl.appendChild(option);
        }
        const sel = this.selection.tilemap[0] & 0x1F;
        treasureControl.value = sel;
        propertyList.select(treasures.item(sel));

        function callback() {
            self.map.drawMap();
            self.updateTileDiv();
        }

        treasureControl.onchange = function() {
            const t = Number(this.value);
            self.selection.tilemap[0] = 0x20 | t;
            self.map.beginAction(callback);
            self.map.selection = self.selection;
            self.map.setTiles();
            self.map.endAction(callback);
            propertyList.select(treasures.item(t))
        }

        return treasureDiv;
    }

    createExitDiv() {

        const self = this;
        const exitDiv = document.createElement('div');
        exitDiv.classList.add('property-div');

        const exitLabel = document.createElement('p');
        exitLabel.classList.add('property-label');
        exitLabel.innerHTML = 'Exit:';
        exitLabel.htmlFor = 'tile-exit-control';
        exitDiv.appendChild(exitLabel);

        const exitControlDiv = document.createElement('div');
        exitControlDiv.classList.add('property-control-div');
        exitDiv.appendChild(exitControlDiv);

        const exitControl = document.createElement('select');
        exitControl.classList.add('property-control');
        exitControl.id = 'tile-exit-control';
        exitControlDiv.appendChild(exitControl);

        const exits = this.map.mapProperties.exitPointer.target;
        if (exits && exits.array) {
            for (let e = 0; e < exits.array.length; e++) {
                const exit = exits.item(e);
                const option = document.createElement('option');
                option.value = e;
                option.innerHTML = `${exit.name} ${e}`;
                exitControl.appendChild(option);
            }
            const sel = this.selection.tilemap[0] & 0x1F;
            exitControl.value = sel;
            propertyList.select(exits.item(sel));
        }

        function callback() {
            self.map.drawMap();
            self.updateTileDiv();
        }

        exitControl.onchange = function() {
            const e = Number(this.value);
            self.selection.tilemap[0] = 0x40 | e;
            self.map.beginAction(callback);
            self.map.selection = self.selection;
            self.map.setTiles();
            self.map.endAction(callback);
            propertyList.select(exits.item(e))
        }

        return exitDiv;
    }

    createMoonExitDiv() {

        const self = this;
        const exitDiv = document.createElement('div');
        exitDiv.classList.add('property-div');

        const exitLabel = document.createElement('p');
        exitLabel.classList.add('property-label');
        exitLabel.innerHTML = 'Exit:';
        exitLabel.htmlFor = 'tile-exit-control';
        exitDiv.appendChild(exitLabel);

        const exitControlDiv = document.createElement('div');
        exitControlDiv.classList.add('property-control-div');
        exitDiv.appendChild(exitControlDiv);

        const exitControl = document.createElement('select');
        exitControl.classList.add('property-control');
        exitControl.id = 'tile-exit-control';
        exitControlDiv.appendChild(exitControl);

        const exits = this.rom.worldExit;
        for (let e = 0; e < (exits.array.length - 37); e++) {
            const exit = exits.item(e + 37);
            const option = document.createElement('option');
            option.value = e;
            option.innerHTML = `${exit.name} ${e}`;
            exitControl.appendChild(option);
        }

        function callback() {
            self.map.drawMap();
            self.updateTileDiv();
        }

        exitControl.onchange = function() {
            const e = Number(this.value);
            self.selection.tilemap[0] = 0x40 | e;
            self.map.beginAction(callback);
            self.map.selection = self.selection;
            self.map.setTiles();
            self.map.endAction(callback);
            propertyList.select(exits.item(e + 37))
        }
        const sel = this.selection.tilemap[0] & 0x1F
        exitControl.value = sel;
        propertyList.select(exits.item(sel + 37))

        return exitDiv;
    }

    getMaskType(value) {

        if (value === 0x00) return FF4MapGBATileset.MaskType.passable;
        if (value === 0x01) return FF4MapGBATileset.MaskType.impassable;
        if (value === 0x02) return FF4MapGBATileset.MaskType.zLevelChange;
        if (value === 0x03) return FF4MapGBATileset.MaskType.zLevelChange;
        if (value === 0x04) return FF4MapGBATileset.MaskType.spriteHidden;
        if (value === 0x05) return FF4MapGBATileset.MaskType.bridge;
        if (value === 0x06) return FF4MapGBATileset.MaskType.damageTile;
        if (value === 0x07) return FF4MapGBATileset.MaskType.unknown7;
        if (value === 0x10) return FF4MapGBATileset.MaskType.bottomTransparent;
        if (value === 0x11) return FF4MapGBATileset.MaskType.bottomHidden;
        if (value === 0x12) return FF4MapGBATileset.MaskType.unknown12;
        if (value === 0x13) return FF4MapGBATileset.MaskType.secretPassage;
        if (value & 0x20) return FF4MapGBATileset.MaskType.treasure;
        if (value & 0x40) return FF4MapGBATileset.MaskType.exit;

        return null;
    }

}

FF4MapGBATileset.MaskType = {
    passable: {
        name: 'Passable',
        color: 'rgba(0, 0, 0, 0.0)',
        value: 0x00,
        index: 0
    },
    impassable: {
        name: 'Impassable',
        color: 'rgba(0, 0, 255, 0.5)',
        value: 0x01,
        index: 1
    },
    spriteHidden: {
        name: 'Sprite Hidden',
        color: 'rgba(0, 255, 0, 0.5)',
        value: 0x04,
        index: 2
    },
    zLevelChange: {
        name: 'Z-Level Change',
        color: 'rgba(0, 255, 255, 0.5)',
        value: 0x02,
        index: 3
    },
    exit: {
        name: 'Exit',
        color: 'rgba(255, 0, 0, 0.5)',
        value: 0x40,
        index: 4
    },
    bridge: {
        name: 'Bridge',
        color: 'rgba(255, 0, 255, 0.5)',
        value: 0x05,
        index: 5
    },
    treasure: {
        name: 'Treasure',
        color: 'rgba(255, 255, 0, 0.5)',
        value: 0x20,
        index: 6
    },
    damageTile: {
        name: 'Damage Tile',
        color: 'rgba(0, 0, 0, 0.5)',
        value: 0x06,
        index: 7
    },
    unknown7: {
        name: 'Unknown (0x07)',
        color: 'rgba(255, 255, 255, 0.5)',
        value: 0x07,
        index: 8
    },
    bottomHidden: {
        name: 'Bottom Half Hidden',
        color: 'rgba(255, 255, 255, 0.5)',
        value: 0x11,
        index: 9
    },
    bottomTransparent: {
        name: 'Bottom Half Transparent',
        color: 'rgba(255, 255, 255, 0.5)',
        value: 0x10,
        index: 10
    },
    unknown12: {
        name: 'Unknown (0x12)',
        color: 'rgba(255, 255, 255, 0.5)',
        value: 0x12,
        index: 11
    },
    secretPassage: {
        name: 'Secret Passage',
        color: 'rgba(255, 255, 255, 0.5)',
        value: 0x13,
        index: 12
    }
}

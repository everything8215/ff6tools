//
// ff4-map-tileset.js
// created 9/9/2020
//

class FF4MapTileset extends ROMToolbox {

    constructor(rom, map) {
        super(rom);
        this.map = map;

        // off-screen canvas
        this.tilesetCanvas = document.createElement('canvas');
        this.tilesetCanvas.width = 256;
        this.tilesetCanvas.height = 128;

        // on-screen canvas for tileset and cursor
        this.canvas = document.createElement('canvas');
        this.canvas.classList.add('tileset-canvas');
        this.canvas.classList.add('background-gradient');
        this.cursorCanvas = document.createElement("canvas");
        this.cursorCanvas.classList.add('cursor-canvas');

        this.layer = [new FF4MapLayer(rom, FF4MapLayer.Type.layer1),
                      new FF4MapLayer(rom, FF4MapLayer.Type.layer2)];

        this.selection = new Uint8Array([0x73, 0, 0, 1, 1, 0]);
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
        this.buttons[2].disabled = true;
        this.buttons[3].onclick = function() { self.selectLayer(3); };
        this.selectButton(this.map.l);
        this.div.innerHTML = '';
        this.div.appendChild(this.canvas);
        this.div.appendChild(this.cursorCanvas);

        super.show();
    }

    resize() {
        // hide tileset if triggers are selected
        if (this.map.l === 3) {
            this.setHeight(0);

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
        y = Math.min(Math.max(y, 0), 7);
        this.clickPoint = { x: x, y: y };
        this.mouseMove(e);

        if (this.map.l === 0) this.map.selectTileProperties(x + y * 16);
    }

    mouseUp(e) {
        this.clickPoint = null;
    }

    mouseOut(e) {
        this.mouseUp(e);
    }

    mouseMove(e) {
        // return unless dragging (except if trigger layer selected)
        if (!this.clickPoint || (this.map.l === 3)) return;

        let x = Math.floor(e.offsetX / this.zoom / 16);
        x = Math.min(Math.max(x, 0), 15);
        let y = Math.floor(e.offsetY / this.zoom / 16);
        y = Math.min(Math.max(y, 0), 7);

        const w = Math.abs(x - this.clickPoint.x) + 1;
        const h = Math.abs(y - this.clickPoint.y) + 1;
        x = Math.min(x, this.clickPoint.x);
        y = Math.min(y, this.clickPoint.y);

        // create the tile selection
        this.selection = new Uint8Array(5 + w * h);
        this.selection.set([0x73, x, y, w, h]);
        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                this.selection[5 + c + r * w] = x + c + (y + r) * 16;
            }
        }

        // redraw the cursor and notify the map
        this.drawCursor();
        this.map.selection = new Uint8Array(this.selection);
    }

    loadMap(m) {

        // create a sequential tile layout
        const layout = new Uint8Array(128);
        for (let i = 0; i < 128; i++) layout[i] = i;

        // set up the ppu
        this.ppu.pal = this.map.ppu.pal;
        this.ppu.width = 256;
        this.ppu.height = 128;

        if (this.map.isWorld) {
            // world map
            this.buttons[1].disabled = true;
            this.layer[0].type = FF4MapLayer.Type.world;
            this.layer[0].loadLayout({
                layout: layout,
                tileset: this.map.layer[0].tileset,
                w: 16, h: 8,
                paletteAssignment: this.map.layer[0].paletteAssignment
            });

            // disable the layer 2 button
            this.buttons[1].enabled = false;

        } else {
            // normal map
            this.buttons[1].disabled = false;
            this.layer[0].type = FF4MapLayer.Type.layer1;
            this.layer[0].loadLayout({
                layout: layout,
                tileset: this.map.layer[0].tileset,
                w: 16, h: 8
            });
            this.layer[0].type = FF4MapLayer.Type.layer2;
            this.layer[1].loadLayout({
                layout: layout,
                tileset: this.map.layer[1].tileset,
                w: 16, h: 8
            });

            // enable the layer 2 button
            this.buttons[1].enabled = true;
        }

        // layer 1
        this.ppu.layers[0].rows = 16;
        this.ppu.layers[0].cols = 32;
        this.ppu.layers[0].z[0] = GFX.Z.snes1L;
        this.ppu.layers[0].z[1] = GFX.Z.snes1H;
        this.ppu.layers[0].gfx = this.map.ppu.layers[0].gfx;
        this.ppu.layers[0].tiles = this.layer[0].tiles;

        // layer 2
        this.ppu.layers[1].rows = 16;
        this.ppu.layers[1].cols = 32;
        this.ppu.layers[1].z[0] = GFX.Z.snes2L;
        this.ppu.layers[1].z[1] = GFX.Z.snes2H;
        this.ppu.layers[1].gfx = this.map.ppu.layers[1].gfx;
        this.ppu.layers[1].tiles = this.layer[1].tiles;

        this.selectLayer(this.map.l);
    }

    selectLayer(l) {
        this.selectButton(l);

        // set the selected layer
        this.map.selectLayer(l);

        // turn on only the selected layer
        for (let l = 0; l < 2; l++) {
            this.ppu.layers[l].main = (l === this.map.l);
        }

        this.resize();
        this.redraw();
    }

    redraw() {
        // don't draw if triggers are selected
        if (this.map.l === 3) return;

        this.drawTileset();
        this.drawMask();
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
        ctx.webkitImageSmoothingEnabled = false;
        ctx.globalCompositeOperation = 'copy';
        ctx.drawImage(this.tilesetCanvas, 0, 0, w, h);
    }

    drawMask() {
        if (this.map.l !== 0) return; // only for layer 1
        if (this.map.tileMask === FF4Map.TileMasks.none) return;

        const ctx = this.canvas.getContext('2d');
        ctx.globalCompositeOperation = 'source-over';

        // draw the mask at each tile
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {

                const tile = x + y * 16;
                const color = this.map.maskColorAtTile(tile);
                if (!color) continue;
                ctx.fillStyle = color;

                const left = (x * 16) * this.zoom;
                const top = (y * 16) * this.zoom;
                const size = 16 * this.zoom;

                ctx.fillRect(left, top, size, size);
            }
        }
    }

    drawCursor() {
        // update canvas size
        this.cursorCanvas.width = this.ppu.width * this.zoom;
        this.cursorCanvas.height = this.ppu.height * this.zoom;

        const ctx = this.cursorCanvas.getContext('2d');

        // return if trigger layer is selected
        if (this.map.l === 3 || !this.selection) return;

        // get the cursor geometry
        const l = Math.floor(this.selection[1] * 16 * this.zoom);
        const t = Math.floor(this.selection[2] * 16 * this.zoom);
        const r = Math.ceil((this.selection[1] + this.selection[3]) * 16 * this.zoom);
        const b = Math.ceil((this.selection[2] + this.selection[4]) * 16 * this.zoom);
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
}

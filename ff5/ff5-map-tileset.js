//
// ff5-map-tileset.js
// created 9/9/2020
//

class FF5MapTileset extends ROMToolbox {
    constructor(rom, map) {
        super(rom);
        this.map = map;

        // off-screen canvas
        this.tilesetCanvas = document.createElement('canvas');

        // on-screen canvas for tileset and cursor
        this.canvas = document.createElement('canvas');
        this.canvas.classList.add('tileset-canvas');
        this.canvas.classList.add('background-gradient');
        this.cursorCanvas = document.createElement('canvas');
        this.cursorCanvas.classList.add('cursor-canvas');

        this.layer = [new FF5MapLayer(rom, FF5MapLayer.Type.layer1),
                      new FF5MapLayer(rom, FF5MapLayer.Type.layer2),
                      new FF5MapLayer(rom, FF5MapLayer.Type.layer3)];

        this.zoom = 1.0;
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
        y = Math.min(Math.max(y, 0), 15);
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
        // set up the ppu
        this.ppu.pal = this.map.ppu.pal;

        if (this.map.m < 5) {
            // create a sequential tile layout
            const layout = new Uint8Array(192);
            for (let i = 0; i < layout.length; i++) layout[i] = i;

            this.ppu.width = 256;
            this.ppu.height = 192;
            this.layer[0].loadLayout({
                type: FF5MapLayer.Type.world,
                layout: layout,
                tileset: this.map.layer[0].tileset,
                paletteAssignment: this.map.layer[0].paletteAssignment,
                w: 16, h: 12
            });

            // layer 1
            this.ppu.layers[0].rows = 24;
            this.ppu.layers[0].cols = 32;
            this.ppu.layers[0].z[0] = GFX.Z.snes1L;
            this.ppu.layers[0].z[1] = GFX.Z.snes1H;
            this.ppu.layers[0].gfx = this.map.ppu.layers[0].gfx;
            this.ppu.layers[0].tiles = this.layer[0].tiles;

            if (this.map.l === 1 || this.map.l === 2) this.map.l = 0;
            this.buttons[1].disabled = true;
            this.buttons[2].disabled = true;

        } else {
            // create a sequential tile layout
            const layout = new Uint8Array(256);
            for (let i = 0; i < layout.length; i++) layout[i] = i;

            this.ppu.width = 256;
            this.ppu.height = 256;
            this.layer[0].loadLayout({
                type: FF5MapLayer.Type.layer1,
                layout: layout,
                tileset: this.map.layer[0].tileset,
                w: 16, h: 16,
                tilePriority: this.map.layer[0].tilePriority
            });
            this.layer[1].loadLayout({
                type: FF5MapLayer.Type.layer2,
                layout: layout,
                tileset: this.map.layer[1].tileset,
                w: 16, h: 16,
                tilePriority: this.map.layer[1].tilePriority
            });
            this.layer[2].loadLayout({
                type: FF5MapLayer.Type.layer3,
                layout: layout,
                tileset: this.map.layer[2].tileset,
                w: 16, h: 16,
                tilePriority: this.map.layer[2].tilePriority
            });

            // layer 1
            this.ppu.layers[0].rows = 32;
            this.ppu.layers[0].cols = 32;
            this.ppu.layers[0].z[0] = GFX.Z.snes1L;
            this.ppu.layers[0].z[1] = GFX.Z.snes1H;
            this.ppu.layers[0].gfx = this.map.ppu.layers[0].gfx;
            this.ppu.layers[0].tiles = this.layer[0].tiles;

            // layer 2
            this.ppu.layers[1].rows = 32;
            this.ppu.layers[1].cols = 32;
            this.ppu.layers[1].z[0] = GFX.Z.snes2L;
            this.ppu.layers[1].z[1] = GFX.Z.snes2H;
            this.ppu.layers[1].gfx = this.map.ppu.layers[1].gfx;
            this.ppu.layers[1].tiles = this.layer[1].tiles;

            // layer 3
            this.ppu.layers[2].rows = 32;
            this.ppu.layers[2].cols = 32;
            this.ppu.layers[2].z[0] = GFX.Z.snes3L;
            this.ppu.layers[2].z[1] = GFX.Z.snes3P;
            this.ppu.layers[2].gfx = this.map.ppu.layers[2].gfx;
            this.ppu.layers[2].tiles = this.layer[2].tiles;

            this.buttons[1].disabled = false;
            this.buttons[2].disabled = false;
        }

        this.tilesetCanvas.width = this.ppu.width;
        this.tilesetCanvas.height = this.ppu.height;
        this.selectLayer(this.map.l);
    }

    selectLayer(l) {
        if (this.map.isWorld && (l === 1 || l === 2)) l = 0;
        this.selectButton(l);

        // set the selected layer
        this.map.selectLayer(l);

        // turn on only the selected layer
        for (let l = 0; l < 3; l++) {
            this.ppu.layers[l].main = (l === this.map.l);
        }

        this.resize();
        this.redraw();
    }

    redraw() {
        // don't draw if triggers are selected
        if (this.map.l === 3) return;

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
}

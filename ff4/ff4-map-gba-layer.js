//
// ff4-map-gba-layer.js
// created 12/9/2020
//

class FF4MapGBALayer {
    constructor(rom, type) {
        this.rom = rom;
        this.type = type;
        this.tileset = null;
    }

    loadLayout(definition) {

        if (definition.type) this.type = definition.type;
        this.layout = definition.layout;
        this.tileset = definition.tileset;
        this.w = definition.w;
        this.h = definition.h;

        // update tiles for the entire map
        this.tiles = new Uint16Array(this.w * this.h * 4);
        this.decodeLayout();
    }

    setLayout(selection) {

        // layout 0 is always blank
        if (!this.layout.data && this.type !== FF4MapGBALayer.Type.world) return;

        let x = selection.x;
        let y = selection.y;
        let w = selection.w;
        let h = selection.h;

        x = x % this.w;
        y = y % this.h;
        let clippedW = Math.min(w, this.w - x);
        let clippedH = Math.min(h, this.h - y);

        for (let row = 0; row < clippedH; row++) {
            let ls = row * w;
            let ld = x + (y + row) * this.w;
            if (this.type === FF4MapGBALayer.Type.world) {
                if (ld + clippedW > this.layout.data.length) break;
                this.layout.setData(selection.tilemap.slice(ls, ls + clippedW), ld);
            } else {
                if (ld + clippedW > this.layout.data.length) break;
                if (this.type === FF4MapGBALayer.Type.layer1) {
                    ld += 4;
                } else if (this.type === FF4MapGBALayer.Type.layer2) {
                    ld += this.w * this.h + 4;
                } else if (this.type === FF4MapGBALayer.Type.mask2) {
                    ld += this.w * this.h; // z-level 2
                }
                if (ld + clippedW >= this.layout.data.length) break;
                this.layout.setData(selection.tilemap.slice(ls, ls + clippedW), ld);
            }
        }
        this.decodeLayout(x, y, clippedW, clippedH);
    }

    getLayout(col, row, cols, rows) {

        // limit the selection rectangle to the size of the layer
        let clippedCol = col % this.w;
        let clippedRow = row % this.h;
        cols = Math.min(cols, this.w - clippedCol);
        rows = Math.min(rows, this.h - clippedRow);

        // create the tile selection
        let layout = this.layout.data || this.layout;
        const selection = {
            x: col,
            y: row,
            w: cols, h: rows,
            tilemap: new Uint8Array(cols * rows)
        };
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (this.type === FF4MapGBALayer.Type.world) {
                    selection.tilemap[x + y * cols] = layout[x + clippedCol + (y + clippedRow) * this.w];
                } else {
                    let offset = 0;
                    if (this.type === FF4MapGBALayer.Type.layer1) {
                        offset = 4;
                    } else if (this.type === FF4MapGBALayer.Type.layer2) {
                        offset = this.w * this.h + 4;
                    } else if (this.type === FF4MapGBALayer.Type.mask2) {
                        offset = this.w * this.h; // z-level 2
                    }
                    selection.tilemap[x + y * cols] = layout[x + clippedCol + (y + clippedRow) * this.w + offset];
                }
            }
        }
        return selection;
    }

    decodeLayout(x, y, w, h) {

        x = x || 0;
        y = y || 0;
        x %= this.w;
        y %= this.h;
        w = w || this.w;
        h = h || this.h;
        w = Math.min(w, this.w - x);
        h = Math.min(h, this.h - y);

        switch (this.type) {
            case FF4MapGBALayer.Type.layer1:
            case FF4MapGBALayer.Type.layer2:
                this.decodeMapLayout(x, y, w, h);
                break;
            case FF4MapGBALayer.Type.world:
                this.decodeWorldLayout(x, y, w, h);
                break;
            default:
                break;
        }
    }

    decodeMapLayout(x, y, w, h) {

        let layout = this.layout.data || this.layout;
        let l = x + y * this.w;
        let t = x * 2 + y * this.w * 4;

        if (this.layout instanceof Uint8Array) {
            layout = this.layout;
        } else {
            const lw = this.layout.data[0] | (this.layout.data[1] << 8);
            const lh = this.layout.data[2] | (this.layout.data[3] << 8);
            if (this.type === FF4MapGBALayer.Type.layer1) {
                layout = this.layout.data.subarray(4, 4 + lw * lh);
            } else {
                layout = this.layout.data.subarray(4 + lw * lh, 4 + lw * lh * 2);
            }
        }

        const tileset = new Uint8Array(this.tileset);

        for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
                let tile = layout[l + col];
                let t1 = (tile & 0x0F) * 8 + (tile & 0xF0) * 8;
                let i = t + col * 2;
                if (i > this.tiles.length) return;
                this.tiles[i + 0] = tileset[t1 + 0x0000] | (tileset[t1 + 0x0001] << 8);
                this.tiles[i + 1] = tileset[t1 + 0x0002] | (tileset[t1 + 0x0003] << 8);
                i += this.w * 2;
                this.tiles[i + 0] = tileset[t1 + 0x0004] | (tileset[t1 + 0x0005] << 8);
                this.tiles[i + 1] = tileset[t1 + 0x0006] | (tileset[t1 + 0x0007] << 8);
            }
            t += this.w * 4;
            l += this.w;
        }
    }

    decodeWorldLayout(x, y, w, h) {

        let l = x + y * this.w;
        let t = x * 2 + y * this.w * 4;
        const layout = this.layout.data || this.layout;

        for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
                let tile = layout[l + col] * 4;
                let i = t + col * 2;
                if (i > this.tiles.length) return;
                this.tiles[i + 0] = this.tileset[tile + 0];
                this.tiles[i + 1] = this.tileset[tile + 1];
                i += this.w * 2;
                this.tiles[i + 0] = this.tileset[tile + 2];
                this.tiles[i + 1] = this.tileset[tile + 3];
            }
            t += this.w * 4;
            l += this.w;
        }
    }
}

FF4MapGBALayer.Type = {
    layer1: 'layer1',
    layer2: 'layer2',
    world: 'world',
    mask1: 'mask1',
    mask2: 'mask2'
}

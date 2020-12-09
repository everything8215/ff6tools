//
// ff4-map-layer.js
// created 12/8/2020
//

class FF4MapLayer {
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
        this.paletteAssignment = definition.paletteAssignment; // world map only

        // update tiles for the entire map
        this.tiles = new Uint32Array(this.w * this.h * 4);
        this.decodeLayout();
    }

    setLayout(selection) {

        // layout 0 is always blank
        if (!this.layout.data && this.type !== FF4MapLayer.Type.world) return;

        const x = selection.x % this.w;
        const y = selection.y % this.h;
        const w = selection.w;
        const h = selection.h;

        const clippedW = Math.min(w, this.w - x);
        const clippedH = Math.min(h, this.h - y);

        for (let r = 0; r < clippedH; r++) {
            const ls = r * w;
            const ld = x + (y + r) * this.w;
            if (this.type === FF4MapLayer.Type.world) {
                if (y + r > 256) break;
                this.layout[y + r].setData(selection.tilemap.slice(ls, ls + clippedW), x);
            } else {
                if (ld + clippedW > this.layout.data.length) break;
                this.layout.setData(selection.tilemap.slice(ls, ls + clippedW), ld);
            }
        }
        this.decodeLayout(x, y, clippedW, clippedH);
    }

    getLayout(x, y, w, h) {

        // limit the selection rectangle to the size of the layer
        const clippedX = x % this.w;
        const clippedY = y % this.h;
        w = Math.min(w, this.w - clippedX);
        h = Math.min(h, this.h - clippedY);

        // create the tile selection
        const layout = this.layout.data || this.layout;
        const selection = {
            x: x, y: y, w: w, h: h,
            tilemap: new Uint8Array(w * h)
        };
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (this.type === FF4MapLayer.Type.world) {
                    const tile = layout[y + clippedY].data[x + clippedX];
                    selection.tilemap[x + y * w] = tile;
                } else {
                    const tile = layout[x + clippedX + (y + clippedY) * this.w];
                    selection.tilemap[x + y * w] = tile;
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
            case FF4MapLayer.Type.layer1:
            case FF4MapLayer.Type.layer2:
                this.decodeMapLayout(x, y, w, h);
                break;
            case FF4MapLayer.Type.world:
                this.decodeWorldLayout(x, y, w, h);
                break;
            default:
                break;
        }
    }

    decodeMapLayout(x, y, w, h) {

        const layout = this.layout.data || this.layout;
        let l = x + y * this.w;
        let t = x * 2 + y * this.w * 4;

        for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
                let tile = layout[l + col];
                tile = ((tile & 0x70) << 2) | ((tile & 0x0F) << 1);
                let i = t + col * 2;
                if (i > this.tiles.length) return;

                if (i > this.tiles.length) return;
                this.tiles[i + 0] = this.tileset[tile];
                this.tiles[i + 1] = this.tileset[tile + 1];
                i += this.w * 2;
                tile += 32;
                this.tiles[i + 0] = this.tileset[tile];
                this.tiles[i + 1] = this.tileset[tile + 1];
            }
            t += this.w * 4;
            l += this.w;
        }
    }

    decodeWorldLayout(x, y, w, h) {

        const tileset = new Uint32Array(512);
        for (let i = 0; i < 512; i++) {
            const t = this.tileset[i];
            const p = this.paletteAssignment[t] << 16;
            tileset[i] = t | p;
        }
        let layout = this.layout;
        if (layout[0] instanceof ROMAssembly) {
            layout = new Uint8Array(0x10000);
            for (let i = 0; i < this.h; i++) {
                layout.set(this.layout[i].data, i * this.w);
            }
        }

        let l = x + y * this.w;
        let t = x * 2 + y * this.w * 4;

        for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
                let tile = layout[l + col];
                if (tile > 0x7F) tile = 0;
                tile = ((tile & 0x70) << 2) | ((tile & 0x0F) << 1);

                let i = t + col * 2;
                if (i > this.tiles.length) return;
                this.tiles[i + 0] = tileset[tile];
                this.tiles[i + 1] = tileset[tile + 1];
                i += this.w * 2;
                tile += 32;
                this.tiles[i + 0] = tileset[tile];
                this.tiles[i + 1] = tileset[tile + 1];
            }
            t += this.w * 4;
            l += this.w;
        }
    }
}

FF4MapLayer.Type = {
    layer1: 'layer1',
    layer2: 'layer2',
    world: 'world'
}

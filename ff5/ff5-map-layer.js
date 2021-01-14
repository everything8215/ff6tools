//
// ff5-map-layer.js
// created 10/18/2020
//

class FF5MapLayer {
    constructor(rom) {
        this.rom = rom;
    }

    loadLayout(definition) {

        this.type = definition.type;
        this.layout = definition.layout;
        this.tileset = definition.tileset;
        this.w = definition.w;
        this.h = definition.h;
        this.paletteAssignment = definition.paletteAssignment; // world map only
        this.tilePriority = definition.tilePriority; // gba only

        // update tiles for the entire map
        this.tiles = new Uint32Array(this.w * this.h * 4);
        this.decodeLayout();
    }

    setLayout(selection) {

        // layout 0 is always blank
        if (!this.layout.data && this.type !== FF5MapLayer.Type.world) return;

        const x = selection.x % this.w;
        const y = selection.y % this.h;
        const w = selection.w;
        const h = selection.h;

        const clippedW = Math.min(w, this.w - x);
        const clippedH = Math.min(h, this.h - y);

        if (this.type === FF5MapLayer.Type.world) {
            for (let r = 0; r < clippedH; r++) {
                const ls = r * w;
                if (y + r > 256) break;
                this.layout[y + r].replaceData(selection.tilemap.slice(ls, ls + clippedW), x);
            }
        } else {
            const layoutData = this.layout.data.slice();
            for (let r = 0; r < clippedH; r++) {
                const ls = r * w;
                const ld = x + (y + r) * this.w;
                if (ld + clippedW > this.layout.data.length) break;
                layoutData.set(selection.tilemap.slice(ls, ls + clippedW), ld);
            }
            this.layout.setData(layoutData);
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
                if (this.type === FF5MapLayer.Type.world) {
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
            case FF5MapLayer.Type.layer1:
            case FF5MapLayer.Type.layer2:
            case FF5MapLayer.Type.layer3:
                this.decodeMapLayout(x, y, w, h);
                break;
            case FF5MapLayer.Type.world:
                this.decodeWorldLayout(x, y, w, h);
                break;
            default:
                break;
        }
    }

    decodeMapLayout(x, y, w, h) {

        const layout = this.layout.data || this.layout;
        const tileset = this.tileset.slice();
        if (this.tilePriority) {
            // apply tile priority bit (GBA only)
            for (let i = 0; i < tileset.length; i++) {
                const p = this.tilePriority.data[i] << 24;
                tileset[i] |= p;
            }
        }

        let l = x + y * this.w;
        let t = x * 2 + y * this.w * 4;
        for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
                let tile = layout[l + col];
                tile = ((tile & 0xF0) << 2) | ((tile & 0x0F) << 1);
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

    decodeWorldLayout(x, y, w, h) {

        // apply palette assignment (SFC only)
        const tileset = this.tileset.slice();
        if (this.paletteAssignment) {
            for (let i = 0; i < 768; i++) {
                const t = tileset[i] & 0xFF;
                const p = this.paletteAssignment.data[t] << 16;
                tileset[i] |= p;
            }
        }

        // copy array of rows to a single array
        let layout = this.layout;
        if (layout[0] instanceof ROMAssembly) {
            layout = new Uint8Array(0x10000);
            for (let i = 0; i < 256; i++) {
                layout.set(this.layout[i].data, i * 256);
            }
        }

        let l = x + y * this.w;
        let t = x * 2 + y * this.w * 4;
        for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
                let tile = layout[l + col];
                tile = ((tile & 0xF0) << 2) | ((tile & 0x0F) << 1);
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

FF5MapLayer.Type = {
    layer1: 'layer1',
    layer2: 'layer2',
    layer3: 'layer3',
    world: 'world'
}

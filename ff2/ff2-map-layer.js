//
// ff2-map-layer.js
// created 11/1/2021
//

class FF2MapLayer {
    constructor(rom) {
        this.rom = rom;
    }

    loadLayout(definition) {

        this.type = definition.type;
        this.layout = definition.layout;
        this.tileset16 = definition.tileset16;
        this.tileset32 = definition.tileset32;
        this.w = definition.w;
        this.h = definition.h;
        this.paletteAssignment = definition.paletteAssignment;

        // update tiles for the entire map
        const nSubTiles = (this.type === FF2MapLayer.Type.world) ? 4 : 16
        this.tiles = new Uint32Array(this.w * this.h * nSubTiles);
        this.decodeLayout();
    }

    setLayout(selection) {

        // layout 0 is always blank
        if (!this.layout.data && this.type !== FF2MapLayer.Type.world) return;

        const x = selection.x % this.w;
        const y = selection.y % this.h;
        const w = selection.w;
        const h = selection.h;

        const clippedW = Math.min(w, this.w - x);
        const clippedH = Math.min(h, this.h - y);

        for (let r = 0; r < clippedH; r++) {
            const ls = r * w;
            const ld = x + (y + r) * this.w;
            if (this.type === 'world') {
                if (y + r > 256) break;
                this.layout[y + r].replaceData(selection.tilemap.slice(ls, ls + clippedW), x);
            } else {
                if (ld + clippedW > this.layout.data.length) break;
                this.layout.replaceData(selection.tilemap.slice(ls, ls + clippedW), ld);
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
                if (this.type === FF2MapLayer.Type.world) {
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
            case FF2MapLayer.Type.layer1:
                this.decodeMapLayout(x, y, w, h);
                break;
            case FF2MapLayer.Type.world:
                this.decodeWorldLayout(x, y, w, h);
                break;
            default:
                break;
        }
    }

    decodeMapLayout(x, y, w, h) {

        const layout = this.layout.data || this.layout;
        let l = x + y * this.w;
        let t = x * 4 + y * this.w * 16;

        for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
                let i = t + col * 4;
                if (i > this.tiles.length) return;
                let tile32 = layout[l + col];
                tile32 = ((tile32 & 0xF0) << 2) | ((tile32 & 0x0F) << 1);
                let tile16_0 = this.tileset32[tile32 + 0];
                let tile16_1 = this.tileset32[tile32 + 1];
                let tile16_2 = this.tileset32[tile32 + 32];
                let tile16_3 = this.tileset32[tile32 + 33];
                tile16_0 = ((tile16_0 & 0xF0) << 2) | ((tile16_0 & 0x0F) << 1);
                tile16_1 = ((tile16_1 & 0xF0) << 2) | ((tile16_1 & 0x0F) << 1);
                tile16_2 = ((tile16_2 & 0xF0) << 2) | ((tile16_2 & 0x0F) << 1);
                tile16_3 = ((tile16_3 & 0xF0) << 2) | ((tile16_3 & 0x0F) << 1);
                const pal_0 = this.paletteAssignment[tile16_0] << 18;
                const pal_1 = this.paletteAssignment[tile16_1] << 18;
                const pal_2 = this.paletteAssignment[tile16_2] << 18;
                const pal_3 = this.paletteAssignment[tile16_3] << 18;
                this.tiles[i + 0] = this.tileset16[tile16_0 + 0] | pal_0;
                this.tiles[i + 1] = this.tileset16[tile16_0 + 1] | pal_0;
                this.tiles[i + 2] = this.tileset16[tile16_1 + 0] | pal_1;
                this.tiles[i + 3] = this.tileset16[tile16_1 + 1] | pal_1;
                i += this.w * 4;
                this.tiles[i + 0] = this.tileset16[tile16_0 + 32] | pal_0;
                this.tiles[i + 1] = this.tileset16[tile16_0 + 33] | pal_0;
                this.tiles[i + 2] = this.tileset16[tile16_1 + 32] | pal_1;
                this.tiles[i + 3] = this.tileset16[tile16_1 + 33] | pal_1;
                i += this.w * 4;
                this.tiles[i + 0] = this.tileset16[tile16_2 + 0] | pal_2;
                this.tiles[i + 1] = this.tileset16[tile16_2 + 1] | pal_2;
                this.tiles[i + 2] = this.tileset16[tile16_3 + 0] | pal_3;
                this.tiles[i + 3] = this.tileset16[tile16_3 + 1] | pal_3;
                i += this.w * 4;
                this.tiles[i + 0] = this.tileset16[tile16_2 + 32] | pal_2;
                this.tiles[i + 1] = this.tileset16[tile16_2 + 33] | pal_2;
                this.tiles[i + 2] = this.tileset16[tile16_3 + 32] | pal_3;
                this.tiles[i + 3] = this.tileset16[tile16_3 + 33] | pal_3;
            }
            t += this.w * 16;
            l += this.w;
        }
    }

    decodeWorldLayout(x, y, w, h) {

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
                tile = ((tile & 0x70) << 2) | ((tile & 0x0F) << 1);
                if (tile >= 512) tile = 0;
                let i = t + col * 2;
                if (i > this.tiles.length) return;
                const pal = this.paletteAssignment[tile] << 18;
                this.tiles[i + 0] = this.tileset16[tile + 0] | pal;
                this.tiles[i + 1] = this.tileset16[tile + 1] | pal;
                i += this.w * 2;
                this.tiles[i + 0] = this.tileset16[tile + 32] | pal;
                this.tiles[i + 1] = this.tileset16[tile + 33] | pal;
            }
            t += this.w * 4;
            l += this.w;
        }
    }
}

FF2MapLayer.Type = {
    layer1: 'layer1',
    world: 'world'
}

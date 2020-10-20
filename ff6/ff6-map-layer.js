//
// ff6-map-layer.js
// created 9/15/2020
//

class FF6MapLayer {
    constructor(rom, type) {
        this.rom = rom;
        this.type = type;
        this.tileset = null;
        this.priority = false;
    }

    loadLayout(definition) {
        this.layout = definition.layout;
        this.tileset = definition.tileset;
        this.w = definition.w;
        this.h = definition.h;
        this.priority = definition.priority; // layer 3 only
        this.paletteAssignment = definition.paletteAssignment; // world map only
        const overlayTiles = definition.overlayTiles;
        if (overlayTiles) {
            this.overlayTiles = new Uint16Array(overlayTiles.buffer, overlayTiles.byteOffset, overlayTiles.byteLength >> 1);
        }

        // update tiles for the entire map
        this.tiles = new Uint32Array(this.w * this.h * 4);
        this.decodeLayout();
    }

    setLayout(selection) {

        // layout 0 is always blank
        if (!this.layout.data) return;

        const x = selection.x % this.w;
        const y = selection.y % this.h;
        const w = selection.w;
        const h = selection.h;

        const clippedW = Math.min(w, this.w - x);
        const clippedH = Math.min(h, this.h - y);

        const layoutData = this.layout.data.slice();
        for (let r = 0; r < clippedH; r++) {
            const ls = r * w;
            const ld = x + (y + r) * this.w;
            if (ld + clippedW > this.layout.data.length) break;
            layoutData.set(selection.tilemap.slice(ls, ls + clippedW), ld);
        }
        this.layout.setData(layoutData);
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
        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                const tile = layout[c + clippedX + (r + clippedY) * this.w];
                selection.tilemap[c + r * w] = tile;
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

        // layout 0 is always blank
        if (this.layout.data && this.layout.i === 0) return;

        switch (this.type) {
            case FF6MapLayer.Type.layer1:
            case FF6MapLayer.Type.layer2:
                this.decodeMapLayout(x, y, w, h);
                break;
            case FF6MapLayer.Type.layer3:
                this.decodeLayer3Layout(x, y, w, h);
                break;
            case FF6MapLayer.Type.overlay:
                this.decodeOverlayLayout(x, y, w, h);
                break;
            case FF6MapLayer.Type.world:
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
                tile = ((tile & 0xF0) << 2) | ((tile & 0x0F) << 1);
                let i = t + col * 2;
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

    decodeLayer3Layout(x, y, w, h) {

        const layout = this.layout.data || this.layout;
        let l = x + y * this.w;
        let t = x * 2 + y * this.w * 4;

        for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {

                let tile = layout[l + col];
                let hiByte = tile & 0xC0;
                let hf, vf;
                tile &= 0x3F;
                if (this.rom.isSFC) {
                    hiByte |= this.tileset[tile] & 0x1C;
                    if (this.priority) hiByte |= 0x20;
                    tile = (tile << 2) | (hiByte << 8);
                    hf = (tile & 0x4000) ? 1 : 0;
                    vf = (tile & 0x8000) ? 2 : 0;
                } else {
                    hiByte >>= 4;
                    hiByte |= this.tileset[tile] & 0x70;
                    if (this.priority) hiByte |= 0x80;
                    tile = (tile << 2) | (hiByte << 8);
                    hf = (tile & 0x0400) ? 1 : 0;
                    vf = (tile & 0x0800) ? 2 : 0;
                }

                let i = t + col * 2;
                if (i > this.tiles.length) return;
                this.tiles[i + 0] = tile++ + hf + vf;
                this.tiles[i + 1] = tile++ - hf + vf;
                i += this.w * 2;
                this.tiles[i + 0] = tile++ + hf - vf;
                this.tiles[i + 1] = tile - hf - vf;
            }
            t += this.w * 4;
            l += this.w;
        }
    }

    decodeOverlayLayout(x, y, w, h) {

        const layout = this.layout.data || this.layout;
        let l = x + y * this.w;
        let t = x * 2 + y * this.w * 4;

        for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {

                let bg1Tile = layout[l + col];
                let tile = this.tileset[bg1Tile + 16];
                if (tile === 0xFF) continue;
                let flip = (tile & 0xC0) << 22;
                tile = this.tileset[((tile & 0x20) >> 2) | ((tile & 0x0E) >> 1)];
                if (tile === 0xFF) continue;
                tile <<= 2;
                let hf = (flip & 0x10000000) ? 1 : 0;
                let vf = (flip & 0x20000000) ? 2 : 0;

                let i = t + col * 2;
                if (i > this.tiles.length) return;
                this.tiles[i + 0] = ((this.overlayTiles[tile++ + hf + vf] >> 3) + 1) | flip;
                this.tiles[i + 1] = ((this.overlayTiles[tile++ - hf + vf] >> 3) + 1) | flip;
                i += this.w * 2;
                this.tiles[i + 0] = ((this.overlayTiles[tile++ + hf - vf] >> 3) + 1) | flip;
                this.tiles[i + 1] = ((this.overlayTiles[tile++ - hf - vf] >> 3) + 1) | flip;
            }
            t += this.w * 4;
            l += this.w;
        }
    }

    decodeWorldLayout(x, y, w, h) {

        const tileset = new Uint32Array(1024);
        for (let i = 0; i < 1024; i++) {
            let t = this.tileset[i];
            if (this.paletteAssignment) {
                const p = this.paletteAssignment[t];
                t |= (p << 20);
            }
            tileset[i] = t;
        }

        const layout = this.layout.data || this.layout;
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

FF6MapLayer.Type = {
    layer1: 'layer1',
    layer2: 'layer2',
    layer3: 'layer3',
    overlay: 'overlay',
    world: 'world'
}

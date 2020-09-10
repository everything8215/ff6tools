//
// ff4-battle-vram.js
// created 9/7/2020
//

class FF4BattleVRAM extends ROMToolbox {
    constructor(rom, battle) {
        super(rom);
        this.battle = battle;
        this.name = 'FF4BattleVRAM';

        // on-screen canvas
        this.canvas = document.createElement('canvas');
        this.canvas.classList.add('background-gradient');

        // off-screen canvas
        this.vramCanvas = document.createElement('canvas');
        this.vramCanvas.width = 256;
        this.vramCanvas.height = 512;

        this.ppu = new GFX.PPU();
        this.zoom = 2.0;

        // vram slots
        this.vramSlots = [];

        // add message handlers
        const self = this;
        this.canvas.onmousedown = function(e) { self.mouseDown(e) };
    }

    show() {
        this.div.innerHTML = '';
        this.div.appendChild(this.canvas);
        super.show(false);
    }

    resize() {
        // hide vram if not shown
        if (!this.battle.showVRAM) {
            this.setHeight(0);
            return;
        }

        // calculate zoom assuming no scrollbars
        this.zoom = Math.min(this.div.offsetWidth / this.ppu.width, 4.0);

        // adjust the pane dimensions
        this.setHeight(Math.floor(this.ppu.height * this.zoom));

        // recalculate zoom with possible scrollbar
        this.zoom = Math.min(this.div.clientWidth / this.ppu.width, 4.0);
    }

    mouseDown(e) {
        const x = Math.floor(e.offsetX / this.zoom);
        const y = Math.floor(e.offsetY / this.zoom);

        const clickedSlot = this.slotAtPoint(x, y);
        if (!clickedSlot) return;

        const monster = this.battle.firstMonsterInVRAMSlot(clickedSlot.s);
        if (!monster) return;

        this.battle.selectedMonster = monster;
        this.battle.selectedCharacter = null;
        propertyList.select(this.rom.monsterProperties.item(monster.m));

        this.battle.drawBattle();
    }

    slotAtPoint(x, y) {
        for (const slot of this.vramSlots) {
            if (slot.rect.containsPoint(x, y)) return slot;
        }
        return null;
    }

    loadVRAM() {
        // load vram properties
        const v = this.battle.battleProperties.vramMap.value;
        this.bossTileCount = this.rom.battleVRAMMap.bossTileCount.item(v);
        this.vramOffset = this.rom.battleVRAMMap.vramOffset.item(v);
        this.tileData1 = this.rom.battleVRAMMap.tileData1.item(v);
        this.tileData2 = this.rom.battleVRAMMap.tileData2.item(v);

        const palette = new Uint32Array(0x100);
        const graphics = new Uint8Array(0x8000);
        const tiles = new Uint16Array(16 * 32);
        tiles.fill(0x01FF);
        let height = 0;
        this.vramSlots = [];

        // load the 3 monster types
        for (let s = 1; s <= 3; s++) {

            // load slot
            const slot = this.loadSlot(s);
            this.vramSlots.push(slot);

            // increase the vram height
            height = Math.max(height, slot.rect.b);

            // load palette, graphics, and tiles
            if (slot.palette) palette.set(slot.palette, slot.paletteOffset);
            if (slot.graphics) graphics.set(slot.graphics, slot.graphicsOffset);
            if (slot.tiles) tiles.set(slot.tiles, slot.tileOffset);
        }

        // init ppu
        this.ppu.pal = this.rom.gammaCorrectedPalette(palette);
        this.ppu.width = 128;
        this.ppu.height = height;
        this.ppu.layers[0].cols = 16;
        this.ppu.layers[0].rows = height >> 3;
        this.ppu.layers[0].z[0] = GFX.Z.snesS0;
        this.ppu.layers[0].z[1] = GFX.Z.snesS1;
        this.ppu.layers[0].gfx = graphics;
        this.ppu.layers[0].tiles = GFX.tileFormat.snes4bppTile.decode(tiles)[0];
        this.ppu.layers[0].main = true;

        this.resize();
        this.redraw();
    }

    loadSlot(s) {
        const slot = {};
        slot.key = `monster${s}`;
        slot.s = s;
        slot.m = this.battle.battleProperties[slot.key].value;

        // get vram slot properties
        if (slot.m !== 255) {
            slot.gfxProperties = this.rom.monsterGraphicsProperties.item(slot.m);
        }
        slot.vramOffset = this.vramOffset[slot.key].value;
        slot.tileCount = this.bossTileCount[slot.key].value;
        slot.graphicsOffset = slot.vramOffset ? (slot.vramOffset - 0x2000) * 4 : 0;
        slot.tileOffset = slot.graphicsOffset >> 6;
        slot.paletteOffset = (s + 2) * 16;

        const tileData1 = this.tileData1[slot.key].value;
        const tileData2 = this.tileData2[slot.key].value;
        slot.tileFlags = (tileData1 << 8) | tileData2;

        // get vram rect
        if (slot.vramOffset === 0) {
            slot.rect = Rect.emptyRect;
        } else {
            const t = slot.graphicsOffset >> 7;
            const h = (slot.tileCount + 1) >> 1;
            slot.rect = new Rect(0, 128, t, t + h);

            // set tiles
            slot.tiles = new Uint16Array(slot.tileCount);
            for (let t = 0; t < slot.tileCount; t++) {
                slot.tiles[t] = t | slot.tileFlags;
            }
        }

        // return if there is no monster in the slot
        if (slot.m === 255) return slot;

        if (slot.gfxProperties.isCharacter.value) {

            // load graphics
            const c = slot.gfxProperties.characterIndex.value;
            const characterGraphics = this.rom.characterGraphics;
            if (slot.vramOffset !== 0 && c <= characterGraphics.arrayLength) {
                slot.graphics = characterGraphics.item(c).data;
            }

            // load palette
            const p = slot.gfxProperties.palette.value;
            if (p <= this.rom.characterPalette.arrayLength) {
                slot.palette = this.rom.characterPalette.item(p).data;
            }

        } else if (slot.gfxProperties.isBoss.value) {

            // load palette
            const b = slot.gfxProperties.bossProperties.value;
            const bossProperties = this.rom.monsterBossProperties.item(b);
            const p = bossProperties.palette.value;
            slot.palette = new Uint32Array(16);
            slot.palette.set(this.rom.monsterPalette.item(p).data);
            if (this.rom.isGBA || !slot.gfxProperties.is3bpp.value) {
                slot.palette.set(this.rom.monsterPalette.item(p + 1).data, 8);
            }

            // decode the graphics
            if (slot.vramOffset !== 0) {
                const format = slot.gfxProperties.is3bpp.value ? GFX.graphicsFormat.snes3bpp : GFX.graphicsFormat.snes4bpp;
                const bytesPerTile = slot.gfxProperties.is3bpp.value ? 24 : 32;
                const begin = this.rom.monsterGraphics.range.begin + slot.gfxProperties.graphicsPointer.value;
                const end = begin + slot.tileCount * bytesPerTile;
                slot.graphics = format.decode(this.rom.data.subarray(begin, end))[0];
            }

        } else {

            // load palette
            const p = slot.gfxProperties.palette.value;
            slot.palette = new Uint32Array(16);
            slot.palette.set(this.rom.monsterPalette.item(p).data);
            if (this.rom.isGBA || !slot.gfxProperties.is3bpp.value) {
                slot.palette.set(this.rom.monsterPalette.item(p + 1).data, 8);
            }

            // decode the graphics
            if (slot.vramOffset !== 0) {
                const format = slot.gfxProperties.is3bpp.value ? GFX.graphicsFormat.snes3bpp : GFX.graphicsFormat.snes4bpp;
                const bytesPerTile = slot.gfxProperties.is3bpp.value ? 24 : 32;
                const begin = this.rom.monsterGraphics.range.begin + slot.gfxProperties.graphicsPointer.value;
                const size = this.rom.monsterSize.item(slot.gfxProperties.size.value);
                const w = size.width.value * 8;
                const h = size.height.value * 8;
                const end = begin + w * h * bytesPerTile / 64;
                slot.graphics = format.decode(this.rom.data.subarray(begin, end))[0];
            }
        }

        return slot;
    }

    redraw() {
        this.drawVRAM();
        for (const slot of this.vramSlots) this.drawSlot(slot);
    }

    drawVRAM() {

        if (!this.battle.showVRAM) return;

        // update the off-screen canvas size
        this.vramCanvas.width = this.ppu.width;
        this.vramCanvas.height = this.ppu.height;

        // draw the monsters to the off-screen canvas
        const vramContext = this.vramCanvas.getContext('2d');
        const imageData = vramContext.createImageData(this.ppu.width, this.ppu.height);
        this.ppu.renderPPU(imageData.data);
        vramContext.putImageData(imageData, 0, 0);

        for (const slot of this.vramSlots) {

            // make hidden monsters transparent
            if (this.battle.typeHidden(slot.s)) {
                this.transparentRect(this.vramCanvas, slot.rect);
            }

            // tint the selected monster
            const selectedMonster = this.battle.selectedMonster;
            const selectedSlot = selectedMonster ? selectedMonster.vramSlot : 0;
            if (slot.s === selectedSlot) {
                this.tintRect(this.vramCanvas, 'hsla(210, 100%, 50%, 0.5)', slot.rect);
            }
        }

        // update the on-screen canvas size
        const w = this.ppu.width * this.zoom;
        const h = this.ppu.height * this.zoom;
        this.canvas.width = w;
        this.canvas.height = h;

        // copy the monsters to the on-screen canvas
        const context = this.canvas.getContext('2d');
        // context.fillStyle = 'black';
        // context.fillRect(0, 0, w, h);
        context.imageSmoothingEnabled = false;
        context.webkitImageSmoothingEnabled = false;
        context.globalCompositeOperation = 'source-over';
        context.drawImage(this.vramCanvas, 0, 0, w, h);
    }

    drawSlot(slot) {
        if (slot.rect.isEmpty()) return;

        const context = this.canvas.getContext('2d');
        context.font = `bold ${24 * this.zoom}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // get the on-screen vram rect
        const slotRect = slot.rect.scale(this.zoom);

        // draw the slot border
        const l = Math.floor(slotRect.l) + 0.5;
        const r = Math.ceil(slotRect.r) - 0.5;
        const t = Math.floor(slotRect.t) + 0.5;
        const b = Math.ceil(slotRect.b) - 0.5;
        context.rect(l, t, r - l, b - t);
        context.lineWidth = 1;
        context.strokeStyle = 'gray';
        context.stroke();

        // draw the slot number
        const selectedMonster = this.battle.selectedMonster;
        const selectedSlot = selectedMonster ? selectedMonster.vramSlot : 0;
        if (slot.s === selectedSlot) {
            context.fillStyle = 'hsla(210, 100%, 50%, 0.5)';
        } else {
            context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        }
        context.fillText(`${slot.s}`, slotRect.centerX, slotRect.centerY);
        context.strokeStyle = 'white';
        context.strokeText(`${slot.s}`, slotRect.centerX, slotRect.centerY);
    }

    tintRect(canvas, tintColor, rect = null) {
        rect = rect || new ROMRect(0, 0, canvas.width, canvas.height);

        // create an offscreen canvas filled with the color
        const tintCanvas = document.createElement('canvas');
        tintCanvas.width = canvas.width;
        tintCanvas.height = canvas.height;
        const tintContext = tintCanvas.getContext('2d');
        tintContext.fillStyle = tintColor;
        tintContext.fillRect(rect.l, rect.t, rect.w, rect.h);

        // draw the tinted rect over the canvas
        const context = canvas.getContext('2d');
        context.globalCompositeOperation = 'source-atop';
        context.drawImage(tintCanvas, 0, 0);
    }

    transparentRect(canvas, rect = null) {
        rect = rect || new ROMRect(0, 0, canvas.width, canvas.height);

        // create an offscreen canvas filled with the color
        const transparentCanvas = document.createElement('canvas');
        transparentCanvas.width = canvas.width;
        transparentCanvas.height = canvas.height;
        const transparentContext = transparentCanvas.getContext('2d');
        transparentContext.fillStyle = 'rgba(255, 255, 255, 0.5)';
        transparentContext.fillRect(rect.l, rect.t, rect.w, rect.h);

        // draw the transparent rect over the canvas
        const context = canvas.getContext('2d');
        context.globalCompositeOperation = 'destination-out';
        context.drawImage(transparentCanvas, 0, 0);
    }
}

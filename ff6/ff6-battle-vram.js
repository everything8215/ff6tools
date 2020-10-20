//
// ff6-battle-vram.js
// created 9/9/2020
//

class FF6BattleVRAM extends ROMToolbox {
    constructor(rom, battle) {
        super(rom);
        this.battle = battle;
        this.name = 'FF6BattleVRAM';

        // off-screen canvas
        this.vramCanvas = document.createElement('canvas');
        this.vramCanvas.width = 128;
        this.vramCanvas.height = 128;

        // on-screen canvas
        this.canvas = document.createElement('canvas');
        this.canvas.classList.add('tileset-canvas');
        this.canvas.classList.add('background-gradient');

        this.ppu = new GFX.PPU();
        this.ppu.width = 128;
        this.ppu.height = 128;
        this.zoom = 2.0;

        // add message handlers
        const self = this;
        this.canvas.onmousedown = function(e) { self.mouseDown(e) };
        this.resizeSensor = null;
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

        const monster = this.battle.monsterInSlot(clickedSlot);
        this.battle.selectedMonster = monster;
        this.battle.selectedCharacter = null;
        if (monster) {
            propertyList.select(monster.properties);
        } else {
            propertyList.select(this.battle.battleProperties);
        }

        this.battle.drawBattle();
    }

    rectForSlot(slot) {
        const v = this.battle.battleProperties.vramMap.value;
        const vramMap = this.rom.battleVRAMMap.item(v);
        if (slot > vramMap.arrayLength) { return Rect.emptyRect; }
        const vramMapData = vramMap.item(slot - 1);

        // monster slot, get vram map data
        const vramAddress = vramMapData.vramAddress.value;
        const w = vramMapData.width.value;
        const h = vramMapData.height.value;
        const l = (vramAddress & 0x01E0) >> 5;
        const t = (vramAddress & 0xFE00) >> 9;
        const r = l + w;
        const b = t + h;
        const slotRect = new Rect(l, r, t, b);
        return slotRect.scale(8);
    }

    slotAtPoint(x, y) {
        for (let slot = 1; slot <= 6; slot++) {
            if (this.rectForSlot(slot).containsPoint(x, y)) return slot;
        }
        return null;
    }

    redraw() {
        this.drawVRAM();
        for (let s = 1; s <= 6; s++) this.drawSlot(s);
        // for (const slot of this.vramSlots) this.drawSlot(slot);
    }

    drawVRAM() {
        if (!this.battle.showVRAM) return;

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

        // get the on-screen vram rect
        const slotRect = this.rectForSlot(slot).scale(this.zoom);
        if (slotRect.isEmpty()) return;

        const x = slotRect.l + 0.5;
        const y = slotRect.t + 0.5;
        const w = slotRect.w - 1;
        const h = slotRect.h - 1;

        const context = this.canvas.getContext('2d');
        context.font = `bold ${24 * this.zoom}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // draw the vram slot
        context.rect(x, y, w, h);
        context.lineWidth = 1;
        context.strokeStyle = 'gray';
        context.stroke();

        // draw the slot number
        const selectedMonster = this.battle.selectedMonster;
        const selectedSlot = selectedMonster ? selectedMonster.slot : 0;
        if (slot === selectedSlot) {
            context.fillStyle = 'hsla(210, 100%, 50%, 0.5)';
        } else {
            context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        }
        context.fillText(`${slot}`, slotRect.centerX, slotRect.centerY);
        context.strokeStyle = 'white';
        context.strokeText(`${slot}`, slotRect.centerX, slotRect.centerY);
    }
}

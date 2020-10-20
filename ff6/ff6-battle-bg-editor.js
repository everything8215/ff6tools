//
// ff6-battle-bg-editor.js
// created 9/30/2020
//

class FF6BattleBackgroundEditor extends ROMTilemapView {

    constructor(rom) {
        super(rom);
        this.name = 'FF6BattleBackgroundEditor';
        this.bgProperties = null;
        this.layout = null;
    }

    selectObject(object) {
        this.bgProperties = object;
        const l = this.bgProperties.layout1.value;
        this.layout = this.rom.battleBackgroundLayout.item(l);
        super.selectObject(this.layout);
    }

    loadTilemap() {
        const l = this.bgProperties.layout1.value;
        this.layout = this.rom.battleBackgroundLayout.item(l);
        this.layout.graphics = [[]];
        this.object = this.layout;

        // create graphics definition
        const g1 = this.bgProperties.graphics1;
        const g2 = this.bgProperties.graphics2.value;
        const g3 = this.bgProperties.graphics3.value;
        if (g1.getSpecialValue() !== 0xFF) this.layout.graphics[0].push({
            path: this.graphicsPath(g1.g.value),
            offset: this.rom.isSFC ? '0x0000' : '0x4000'
        });
        if (g2 !== 0xFF) this.layout.graphics[0].push({
            path: this.graphicsPath(g2),
            offset: this.rom.isSFC ? '0x2000' : '0x6000'
        });
        if (g3 !== 0xFF) this.layout.graphics[0].push({
            path: this.graphicsPath(g3),
            offset: this.rom.isSFC ? '0xE000' : '0x2000'
        });

        // create palette definition
        const p = this.bgProperties.palette.value;
        this.layout.palette = {
            path: `battleBackgroundPalette[${p}]`,
            offset: '0x50'
        };

        super.loadTilemap();
        this.observer.startObservingSub(this.bgProperties, this.loadTilemap);
    }

    graphicsPath(g) {
        const bgGraphics = this.rom.battleBackgroundGraphics;
        if (bgGraphics.item(g) && bgGraphics.item(g).data.length) {
            return `battleBackgroundGraphics[${g}]`;
        }

        // find map graphics with a matching pointer
        // todo: combine map and battle bg graphics into a fragmented array ???
        const pointer = bgGraphics.createPointer(g);
        let mappedAddress = this.rom.mapAddress(pointer.value);
        const mapGraphics = this.rom.mapGraphics;
        if (this.rom.isGBA) {
            const offset = Number(this.rom.mapGraphics.pointerOffset);
            pointer.options.offset = this.rom.mapAddress(offset);
            mappedAddress = pointer.value & 0x7FFFFF;
        }

        for (let i = 0; i < mapGraphics.arrayLength; i++) {
            const mapGraphicsPointer = mapGraphics.createPointer(i);
            if (mappedAddress === mapGraphicsPointer.value) {
                return `mapGraphics[${i}]`;
            }
        }

        return null;
    }
}

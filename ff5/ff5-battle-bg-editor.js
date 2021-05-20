//
// ff5-battle-bg-editor.js
// created 9/11/2020
//

class FF5BattleBackgroundEditor extends ROMTilemapView {

    constructor(rom) {
        super(rom);
        this.name = 'FF5BattleBackgroundEditor';
        this.bgProperties = null;
        this.layout = null;
    }

    selectObject(object) {
        this.bgProperties = object;
        if (this.rom.isGBA) {
            this.updateBackgroundLayoutGBA();
            this.format = GFX.tileFormat.gba4bppTile;
        } else {
            const l = this.bgProperties.layout.value;
            this.layout = this.rom.battleBackgroundLayout.item(l);
            super.selectObject(this.layout);
        }
    }

    loadTilemap() {
        if (this.rom.isGBA) {
            this.updateBackgroundLayoutGBA();
            return;
        }

        const l = this.bgProperties.layout.value;
        this.layout = this.rom.battleBackgroundLayout.item(l);
        this.object = this.layout;

        // create graphics definition
        const g = this.bgProperties.graphics.value;
        const gfxPointer = this.rom.battleBackgroundGraphicsPointer.item(g);
        const gfxObject = gfxPointer.pointer.target;
        this.layout.graphics = `battleBackgroundGraphics[${gfxObject.i}]`;

        const graphicsOffset = this.rom.battleBackgroundGraphicsOffset.item(g);
        this.layout.tileOffset = graphicsOffset.offset.value;

        // create palette definition
        this.layout.palette = [[]];
        const p1 = this.bgProperties.palette1.value;
        const p2 = this.bgProperties.palette2.value;
        this.layout.palette[0].push({
            path: `battleBackgroundPalette[${p1}]`,
            offset: '0x00'
        });
        this.layout.palette[0].push({
            path: `battleBackgroundPalette[${p2}]`,
            offset: '0x10'
        });

        // create hFlip and vFlip definitions
        const vFlip = this.bgProperties.vFlip.value;
        if (vFlip === 0xFF) {
            this.layout.disableVFlip = true;
        } else {
            this.layout.vFlip = `battleBackgroundTileFlip[${vFlip}]`;
            this.layout.disableVFlip = false;
        }
        const hFlip = this.bgProperties.hFlip.value;
        if (hFlip === 0xFF) {
            this.layout.disableHFlip = true;
        } else {
            this.layout.hFlip = `battleBackgroundTileFlip[${hFlip}]`;
            this.layout.disableHFlip = false;
        }

        super.loadTilemap();
        this.observer.startObservingSub(gfxPointer, this.loadTilemap);
        this.observer.startObservingSub(this.bgProperties, this.loadTilemap);
    }

    updateBackgroundLayoutGBA() {
        const bg = this.bgProperties.i * 3;

        // load layout
        const layout = this.rom.battleBackgroundGraphics.item(bg + 1);
        if (!layout.format) {
            layout.format = ['gba4bppTile', 'tose-layout'];
            layout.width = 32;
            layout.height = 17;
            layout.disassemble(layout.parent.data);
        }
        this.layout = layout;
        this.object = this.layout;

        // create graphics definition
        const graphicsData = this.rom.battleBackgroundGraphics.item(bg);
        graphicsData.width = 32;
        if (!graphicsData.format) {
            graphicsData.format = ['linear4bpp', 'tose-graphics', 'gba-lzss'];
            graphicsData.disassemble(graphicsData.parent.data);
        }
        this.layout.graphics = {
            path: `battleBackgroundGraphics[${bg}]`
        };

        // create palette definition
        const paletteData = this.rom.battleBackgroundGraphics.item(bg + 2);
        if (!paletteData.format) {
            paletteData.format = ['bgr555', 'tose-palette'];
            paletteData.disassemble(paletteData.parent.data);
        }
        this.layout.palette = `battleBackgroundGraphics[${bg + 2}]`;
        super.loadTilemap();
    }
}

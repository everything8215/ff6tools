//
// ff4-battle-bg-editor.js
// created 9/11/2020
//

// sfc only
class FF4BattleBackgroundEditor extends ROMTilemapView {
    constructor(rom) {
        super(rom);
        this.name = "FF4BattleBackgroundEditor";
        this.bgProperties = null;
        this.altPalette = false;
        this.showRegions = false;
    }

    selectObject(object) {
        this.bgProperties = object;

        // update the tilemap
        this.updateTilemapDefinition();

        // call the default method
        super.selectObject(this.topTiles);
    }

    resetControls() {
        super.resetControls();

        const self = this;

        // add a control to use the alternate palette
        this.addTwoState('useAltPalette', function(checked) {
            self.altPalette = checked;
            self.updateTilemapDefinition();
            self.paletteView.redraw();
            self.graphicsView.redraw();
        }, 'Alt. Palette', this.altPalette);

        // add a control to show tilemap regions
        this.addTwoState('showRegions', function(checked) {
            self.showRegions = checked;
            self.redraw();
        }, 'Regions', this.showRegions);
    }

    updateTilemapDefinition() {
        const i = this.bgProperties.i;
        const top = this.bgProperties.top.value;
        const middle = this.bgProperties.middle.value;
        const bottom = this.bgProperties.bottom.value;

        // start observing tile layout and definition objects
        this.observer.stopObservingAll();
        this.observer.startObservingSub(this.bgProperties, this.updateTilemapDefinition);

        this.topTiles = this.rom.battleBackgroundLayoutUpper.item(top);
        this.observer.startObserving(this.topTiles, this.updateTilemapDefinition);
        if (middle) {
            this.middleTiles = this.rom.battleBackgroundLayoutUpper.item(middle);
            this.observer.startObserving(this.middleTiles, this.updateTilemapDefinition);
        } else {
            this.middleTiles = null;
        }
        this.bottomTiles = this.rom.battleBackgroundLayoutLower.item(bottom);
        this.observer.startObserving(this.bottomTiles, this.updateTilemapDefinition);

        this.object = this.topTiles;

        // get the tile format
        let formatKey = this.object.format;

        // for assemblies with multiple formats, the graphics format is the first one
        if (isArray(formatKey)) formatKey = formatKey[0];

        // ignore format parameters
        if (formatKey.includes('(')) {
            formatKey = formatKey.substring(0, formatKey.indexOf('('));
        }
        this.format = GFX.tileFormat[formatKey] || GFX.tileFormat.defaultTile;

        // create graphics definition
        const graphics = this.rom.battleBackgroundGraphics.item(i);
        const graphicsDefinition = [[{
            path: `battleBackgroundGraphics[${i}]`
        }]];
        if (i < 15 && graphics.data.length < 0x0A00) graphicsDefinition[0].push({
            path: `battleBackgroundGraphics[${i + 1}]`,
            offset: graphics.data.length,
            range: `0-${0x0A00 - graphics.data.length}`
        });
        this.topTiles.graphics = graphicsDefinition;
        if (this.middleTiles) this.middleTiles.graphics = graphicsDefinition;
        this.bottomTiles.graphics = graphicsDefinition;

        // create palette definition
        const p = this.altPalette ? (FF4Battle.altPalette[i] || i) : i;
        var paletteDefinition = `battleBackgroundPalette[${p}]`;
        this.topTiles.palette = paletteDefinition
        if (this.middleTiles) this.middleTiles.palette = paletteDefinition;
        this.bottomTiles.palette = paletteDefinition;

        // create tile offset definition (bottom tiles only)
        const tileOffsetDefinition = {
            path: `battleBackgroundProperties[${i}].offset`,
            offset: middle ? 0x200 : 0x100
        }
        this.bottomTiles.tileOffset = tileOffsetDefinition;

        this.loadTilemap();
    }

    drawMask() {
        super.drawMask();

        if (!this.showRegions) return;

        const context = this.canvas.getContext('2d');
        context.globalCompositeOperation = 'source-over';
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.font = `${12 * this.zoom}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // draw the top region
        context.rect(0, 0, 256 * this.zoom, 64 * this.zoom);
        context.strokeStyle = 'gray';
        context.stroke();
        context.fillText('Top Tilemap', 128 * this.zoom, 32 * this.zoom);
        context.strokeStyle = 'white';
        context.strokeText('Top Tilemap', 128 * this.zoom, 32 * this.zoom);

        if (this.middleTiles) {
            // draw the middle region
            context.rect(0, 64 * this.zoom, 256 * this.zoom, 64 * this.zoom);
            context.strokeStyle = 'gray';
            context.stroke();
            context.fillText('Middle Tilemap', 128 * this.zoom, 96 * this.zoom);
            context.strokeStyle = 'white';
            context.strokeText('Middle Tilemap', 128 * this.zoom, 96 * this.zoom);

            // draw the bottom region
            context.rect(0, 128 * this.zoom, 256 * this.zoom, 16 * this.zoom);
            context.strokeStyle = 'gray';
            context.stroke();
            context.fillText('Bottom Tilemap', 128 * this.zoom, 136 * this.zoom);
            context.strokeStyle = 'white';
            context.strokeText('Bottom Tilemap', 128 * this.zoom, 136 * this.zoom);
        } else {
            // draw the bottom region
            context.rect(0, 64 * this.zoom, 256 * this.zoom, 16 * this.zoom);
            context.strokeStyle = 'gray';
            context.stroke();
            context.fillText('Bottom Tilemap', 128 * this.zoom, 72 * this.zoom);
            context.strokeStyle = 'white';
            context.strokeText('Bottom Tilemap', 128 * this.zoom, 72 * this.zoom);

            // draw the repeated bottom region
            context.fillRect(0, 80 * this.zoom, 256 * this.zoom, 64 * this.zoom);
            context.rect(0, 80 * this.zoom, 256 * this.zoom, 64 * this.zoom);
            context.strokeStyle = 'gray';
            context.stroke();
            context.strokeStyle = 'white';
            context.strokeText('Bottom Tilemap (Repeated)', 128 * this.zoom, 112 * this.zoom);
        }
    }

    loadTilemap() {
        this.width = 32;
        this.height = 18;
        this.backColor = true;

        // update graphics and palette
        this.graphicsView.loadDefinition(this.object.graphics);
        this.paletteView.loadDefinition(this.object.palette);
        this.paletteView.updateToolbox();
        this.graphicsView.updateToolbox();

        this.graphicsView.updateTilemap();
        this.graphicsView.redraw();
        this.paletteView.redraw();

        this.tilemap = new Uint32Array(0x480);

        this.tilemap.set(this.topTiles.data);
        if (this.middleTiles) {
            this.tilemap.set(this.middleTiles.data, 0x100);
        } else {
            this.tilemap.set(this.bottomTiles.data, 0x100);
            this.tilemap.set(this.bottomTiles.data, 0x140);
            this.tilemap.set(this.bottomTiles.data, 0x180);
            this.tilemap.set(this.bottomTiles.data, 0x1C0);
        }
        this.tilemap.set(this.bottomTiles.data, 0x200);

        this.loadTileOffset(this.bottomTiles.tileOffset);

        this.redraw();
    }

    setTilemap() {
        // return if nothing selected
        if (!this.tilemap) return;

        this.rom.beginAction();
        this.observer.sleep();

        const topTiles = this.tilemap.slice(0x0000, 0x0100);
        this.topTiles.setData(topTiles);

        const begin = this.middleTiles ? 0x200 : 0x100;
        const bottomTiles = this.tilemap.slice(begin, begin + 0x40);
        const index = this.bgProperties.i;

        if (this.middleTiles) {
            const middleTiles = this.tilemap.slice(0x0100, 0x0200);
            this.middleTiles.setData(middleTiles);
        } else {
            // copy bottom tiles to lower rows
            this.tilemap.set(bottomTiles, 0x140);
            this.tilemap.set(bottomTiles, 0x180);
            this.tilemap.set(bottomTiles, 0x1C0);
            this.tilemap.set(bottomTiles, 0x200);
            this.redraw();
        }

        this.setTileOffset(this.bottomTiles.tileOffset.path, bottomTiles);
        this.bottomTiles.setData(bottomTiles);

        this.observer.wake();
        this.rom.endAction();
    }
}

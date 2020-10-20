//
// palette-view.js
// created 9/4/2020
//

class ROMPaletteView {

    constructor(rom, graphicsView) {
        this.rom = rom;
        this.graphicsView = graphicsView; // associated graphics view
        this.tilemapView = null; // associated tilemap view
        this.toolbox = new ROMToolbox(rom); // toolbox

        this.div = document.createElement('div');
        this.div.classList.add('palette-div');

        this.canvas = document.createElement('canvas');
        this.canvas.width = 256;
        this.canvas.height = 24;

        this.paletteSelectControl = null;

        this.definition = null;
        this.palette = new Uint32Array(16);
        this.p = 0; // selected palette index
        this.colorsPerPalette = 16; // number of colors per palette
        this.rowsPerPalette = 1; // number of rows per palette
        this.colorsPerRow = 16; // number of colors per row
        this.rows = 1;
        this.paletteCount = 1;
        this.colorHeight = 24;
        this.showCursor = true;

        this.observer = new ROMObserver(rom, this);

        // add event handlers
        const self = this;
        this.canvas.onmousedown = function(e) { self.mouseDown(e); };
    }

    show() {}

    hide() {
        this.observer.stopObservingAll();
    }

    mouseDown(e) {
        let row = Math.floor(e.offsetY / this.colorHeight);
        row = Math.min(Math.max(row, 0), this.rows - 1);
        this.p = Math.floor(row / this.rowsPerPalette);
        this.redraw();
        this.graphicsView.updateTilemap();
        this.graphicsView.redraw();
        if (this.graphicsView.tilemapView) {
            this.graphicsView.tilemapView.selectPalette(this.p * this.colorsPerPalette);
            this.graphicsView.tilemapView.redraw();
        }
    }

    resize(clientWidth) {

        // calculate the total number of rows
        this.paletteCount = Math.ceil(this.palette.length / this.colorsPerPalette);
        if (this.paletteCount > 1) {
            this.rows = this.paletteCount * this.rowsPerPalette;
        } else {
            this.rows = Math.ceil(this.palette.length / this.colorsPerRow);
        }
        this.rows = Math.min(this.rows, 16); // max of 16 palettes

        if (!isNumber(clientWidth)) clientWidth = this.toolbox.div.clientWidth;

        // recalculate element sizes
        this.colorWidth = clientWidth / this.colorsPerRow;
        this.canvas.width = clientWidth;
        this.canvas.height = this.rows * this.colorHeight;
    }

    redraw() {
        this.drawPalette();
        this.drawCursor();
    }

    drawPalette() {
        // clear the canvas with black
        const ctx = this.canvas.getContext('2d');
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // do gamma correction
        const palette = this.rom.gammaCorrectedPalette(this.palette);

        let c = 0; // color index
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.colorsPerRow; x++) {
                const color = palette[c++] || 0;
                // if (!isNumber(color)) color = 0;
                const r = (color & 0xFF);
                const g = (color & 0xFF00) >> 8;
                const b = (color & 0xFF0000) >> 16;
                ctx.fillStyle = `rgb(${r},${g},${b})`;

                const xStart = Math.round(x * this.colorWidth);
                const xEnd = Math.round((x + 1) * this.colorWidth);
                ctx.fillRect(xStart, y * this.colorHeight,
                    xEnd - xStart, this.colorHeight);
            }
        }
    }

    drawCursor() {
        if (!this.showCursor) return;

        // draw the cursor
        let w = this.canvas.width;
        let h = this.colorHeight * this.rowsPerPalette;
        let x = 0;
        let y = this.p * h;
        if (y + h > this.canvas.height) h = this.canvas.height - y;

        const ctx = this.canvas.getContext('2d');
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'black';
        x += 0.5; y += 0.5; w--; h--;
        ctx.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        ctx.strokeStyle = 'hsl(210, 100%, 50%)';
        ctx.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        ctx.strokeStyle = 'white';
        ctx.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        ctx.strokeStyle = 'black';
        ctx.strokeRect(x, y, w, h);
    }

    loadDefinition(definition) {

        definition = definition || 'grayscale';

        this.definition = definition;
        this.paletteArray = [];
        this.observer.stopObservingAll();

        // recalculate number of rows per palette
        if (this.graphicsView.format) {
            this.colorsPerPalette = this.graphicsView.format.colorsPerPalette;
        } else {
            // default to 16 colors per palette
            this.colorsPerPalette = 16;
        }

        // max 16 colors per row
        this.colorsPerRow = Math.min(this.colorsPerPalette, 16);
        this.rowsPerPalette = Math.ceil(this.colorsPerPalette / this.colorsPerRow);

        // clear the palette
        this.palette = new Uint32Array();

        // load a palette from the definition
        this.loadPalette(definition);

        // resize the palette
        this.resize();

        // validate the selected palette index
        if (this.p >= this.paletteCount) this.p = 0;
    }

    loadPalette(definition) {

        if (!definition) {
            return;
        } else if (definition === 'grayscale') {
            // default grayscale palette
            this.palette = GFX.makeGrayPalette(this.colorsPerPalette, false);
            return;
        } else if (definition === 'inverseGrayscale') {
            // default inverse grayscale palette
            this.palette = GFX.makeGrayPalette(this.colorsPerPalette, true);
            return;
        }

        // multiple choice of palettes (outer array)
        if (isArray(definition)) {
            if (definition.length === 0) return;
            if (definition.length > 1) {
                for (const def of definition) this.paletteArray.push(def);
            }

            // load the first array element as a placeholder
            definition = definition[0];
        }

        // recursively load multiple palettes (inner array)
        if (isArray(definition)) {
            for (const def of definition) this.loadPalette(def);
            return;
        }

        // get path
        const path = isString(definition) ? definition : definition.path;
        if (!path) return;

        // parse object path
        let index = 0;
        if (this.tilemapView) {
            index = this.tilemapView.object.i;
        } else if (this.graphicsView.object) {
            index = this.graphicsView.object.i;
        }
        let object = this.rom.parsePath(path, this.rom, index);

        // load ROMArray objects as multiple choice
        if (object instanceof ROMArray) {
            if (!this.paletteArray.includes(definition)) this.paletteArray.push(definition);

            // load the first array item as a placeholder
            object = object.item(0);
        }

        // get object data (must be 32-bit)
        if (!object || !object.data) return;
        let data = new Uint32Array(object.data.buffer);

        // observe the palette object
        const self = this;
        this.observer.startObserving(object, function() {

            // reload the palette
            self.loadDefinition(self.definition);

            // reload the multiple choice selection
            if (self.paletteSelectControl) {
                self.loadPalette(JSON.parse(self.paletteSelectControl.value));
            }

            // redraw everything
            self.redraw();
            self.graphicsView.redraw();
            if (self.tilemapView) self.tilemapView.redraw();
        });

        // parse data range
        let range;
        if (definition.range) {
            range = ROMRange.parse(definition.range);
            data = data.subarray(range.begin, range.end);
        } else {
            range = new ROMRange(0, data.length);
        }

        // parse offset
        const offset = Number(definition.offset) || 0;

        if ((offset + data.length) > this.palette.length) {
            // increase the size of the palette buffer
            const newPalette = new Uint32Array(offset + data.length);
            newPalette.fill(0xFF000000);
            newPalette.set(this.palette);
            this.palette = newPalette;
        }
        this.palette.set(data, offset);
    }

    importPalette(palette, offset = 0) {
        if ((palette.length + offset) > this.palette.length) {
            // trim the palette to fit
            palette = palette.subarray(0, this.palette.length - offset);
        }

        // copy imported data to the current palette
        this.palette.set(palette, offset);

        // set palette data
        this.observer.sleep();
        if (isArray(this.definition)) {
            if (this.definition.length === 1) this.savePalette(this.definition[0]);
        } else {
            this.savePalette(this.definition);
        }

        // overwrite currently selected multiple choice palette
        if (self.paletteSelectControl) {
            this.savePalette(JSON.parse(self.paletteSelectControl.value));
        }
        this.observer.wake();

        // redraw the view
        this.redraw();
        this.graphicsView.redraw();
        if (this.tilemapView) this.tilemapView.redraw();
    }

    savePalette(definition) {

        if (!definition ||
            definition === 'grayscale' ||
            definition === 'inverseGrayscale') {
            return;
        }

        // recursively save palettes
        if (isArray(definition)) {
            for (const def of definition) this.savePalette(def);
            return;
        }

        // get path
        const path = isString(definition) ? definition : definition.path;
        if (!path) return;

        // parse object
        let index = 0;
        if (this.tilemapView) {
            index = this.tilemapView.object.i;
        } else if (this.graphicsView.object) {
            index = this.graphicsView.object.i;
        }
        const object = this.rom.parsePath(path, this.rom, index);

        // ignore ROMArray objects for now
        if (object instanceof ROMArray) return;

        // // get object data (must be 32-bit)
        // if (!object || !object.data) return;
        // let data = new Uint32Array(data.buffer);

        // parse data range
        let range;
        if (definition.range) {
            range = ROMRange.parse(definition.range);
            // data = data.subarray(range.begin, range.end);
        } else {
            range = new ROMRange(0, data.length);
        }

        // parse offset
        const offset = Number(definition.offset) || 0;

        let palette = this.palette.subarray(offset, offset + range.length);

        // convert to and from the native format to validate the data
        if (object.format) {
            // get the graphics format
            let formatKey = object.format;

            // for assemblies with multiple formats, the graphics format is the first one
            if (isArray(formatKey)) formatKey = formatKey[0];

            // ignore format parameters
            if (formatKey.includes('(')) {
                formatKey = formatKey.substring(0, formatKey.indexOf('('));
            }
            const format = GFX.paletteFormat[formatKey];

            if (format) palette = format.decode(format.encode(palette)[0])[0];
        }

        if (range.begin + palette.length > object.data.length) {
            palette = palette.subarray(0, object.data.length - range.begin);
        }
        object.setData(palette, range.begin);
    }

    updateToolbox() {
        this.div.innerHTML = '';

        // heading div
        const paletteHeadingDiv = document.createElement('div');
        paletteHeadingDiv.classList.add('property-heading');
        this.div.appendChild(paletteHeadingDiv);

        const paletteHeading = document.createElement('p');
        paletteHeading.innerHTML = 'Palette';
        paletteHeadingDiv.appendChild(paletteHeading);

        // generate a JSON string to represent a palette definition
        function valueForDefinition(definition, index) {

            if (!definition) return null;
            let path = definition.path || definition;
            if (!isString(path)) return null;

            // add an array subscript
            if (isNumber(index)) path += `[${index}]`;

            if (isString(definition)) return JSON.stringify({path: path});

            // assign definition members to an object and stringify
            const value = {};
            Object.assign(value, definition);
            value.path = path;
            return JSON.stringify(value);
        }

        this.paletteSelectControl = null;

        if (this.paletteArray.length) {
            // create a dropdown for array palettes
            const paletteSelectDiv = document.createElement('div');
            paletteSelectDiv.classList.add('property-div');
            this.div.appendChild(paletteSelectDiv);

            this.paletteSelectControl = document.createElement('select');
            this.paletteSelectControl.classList.add('property-control');
            this.paletteSelectControl.id = 'palette-select-control';
            paletteSelectDiv.appendChild(this.paletteSelectControl);

            let option;
            let index = 0;
            if (this.tilemapView) {
                index = this.tilemapView.object.i;
            } else if (this.graphicsView.object) {
                index = this.graphicsView.object.i;
            }
            let selectedValue = null;
            for (let i = 0; i < this.paletteArray.length; i++) {
                const paletteDefinition = this.paletteArray[i];
                if (!paletteDefinition) continue;
                let palettePath = paletteDefinition.path || paletteDefinition;
                if (!isString(palettePath)) continue;
                palettePath = this.rom.parseIndex(palettePath, index);
                const paletteObject = this.rom.parsePath(palettePath);
                if (!paletteObject) continue;

                if (paletteObject instanceof ROMArray) {
                    const optionGroup = document.createElement('optgroup');
                    const name = paletteDefinition.name ||
                        paletteObject.name || 'Unnamed Palette';
                    optionGroup.setAttribute('label', name);
                    for (let j = 0; j < paletteObject.arrayLength; j++) {
                        const value = valueForDefinition(paletteDefinition, j);
                        if (!value) continue;
                        option = document.createElement('option');
                        option.value = value;
                        if (paletteDefinition.name) {
                            option.innerHTML = paletteDefinition.name;
                        } else if (paletteObject.stringTable) {
                            const stringTable = this.rom.stringTable[paletteObject.stringTable];
                            const string = stringTable.string[j];
                            if (string) {
                                option.innerHTML = `${j}: ${string.fString(40)}`;
                            } else {
                                option.innerHTML = `${j}: ${paletteObject.name} ${j}`;
                            }
                        } else {
                            option.innerHTML = `${j}: ${paletteObject.name} ${j}`;
                        }
                        if (!selectedValue) selectedValue = option.value;
                        if (option.value === this.selectedValue) selectedValue = option.value;
                        optionGroup.appendChild(option);
                    }
                    this.paletteSelectControl.appendChild(optionGroup);
                } else if (paletteObject instanceof ROMAssembly) {
                    const value = valueForDefinition(paletteDefinition);
                    if (!value) continue;
                    option = document.createElement('option');
                    option.value = value;
                    if (paletteDefinition.name) {
                        option.innerHTML = paletteDefinition.name;
                    } else if (isNumber(paletteObject.i)) {
                        if (paletteObject.parent.stringTable) {
                            const stringTable = this.rom.stringTable[paletteObject.parent.stringTable];
                            const string = stringTable.string[paletteObject.i];
                            if (string) {
                                option.innerHTML = string.fString(40);
                            } else {
                                option.innerHTML = `${paletteObject.name} ${paletteObject.i}`;
                            }
                        } else {
                            option.innerHTML = `${paletteObject.name} ${paletteObject.i}`;
                        }
                    } else {
                        option.innerHTML = paletteObject.name;
                    }
                    if (!selectedValue) selectedValue = option.value;
                    if (option.value === this.selectedValue) selectedValue = option.value;
                    this.paletteSelectControl.appendChild(option);
                }
            }
            if (!selectedValue) selectedValue = JSON.stringify({path: 'grayscale'});
            this.paletteSelectControl.value = selectedValue;
            this.loadPalette(JSON.parse(selectedValue));
            this.selectedValue = selectedValue;

            const self = this;
            this.paletteSelectControl.onchange = function() {
                self.loadPalette(JSON.parse(this.value));
                self.selectedValue = this.value;
                self.redraw();
                self.graphicsView.redraw();
                if (self.tilemapView) self.tilemapView.redraw();
            }
        }

        // show the palette canvas
        this.div.appendChild(this.canvas);

        // TODO: implement palette import/export

        // // add palette import/export buttons
        // const importExportDiv = document.createElement('div');
        // importExportDiv.classList.add('property-div');
        // // this.div.appendChild(importExportDiv);
        //
        // const exportButton = document.createElement('button');
        // exportButton.innerHTML = 'Export Palette';
        // exportButton.disabled = true;
        // exportButton.onclick = function() {
        // };
        // importExportDiv.appendChild(exportButton);
        //
        // const importButton = document.createElement('button');
        // importButton.innerHTML = 'Import Palette';
        // importButton.disabled = true;
        // importButton.onclick = function() {
        // };
        // importExportDiv.appendChild(importButton);

        this.resize();
    }
}

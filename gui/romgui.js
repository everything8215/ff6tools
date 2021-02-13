//
// romgui.js
// created 2/26/2019
//

function ROMGraphicsExporter() {}

ROMGraphicsExporter.prototype.export = function(options) {
    if (!options) return;
    this.graphics = new Uint8Array(options.graphics || 0);
    this.palette = new Uint32Array(options.palette || 0);
    this.tilemap = new Uint32Array(options.tilemap || 0);
    this.width = options.width || 16;
    this.height = options.height || Math.ceil(this.tilemap.length / this.width);
    this.tileWidth = options.tileWidth || 8;
    this.tileHeight = options.tileHeight || 8;
    if (!options.backColor) this.palette[0] = 0;

    // open a dialog box
    var content = openModal("Export Graphics");

    // dropdown list of image formats
    var formatDiv = document.createElement('div');
    formatDiv.classList.add("property-div");
    content.appendChild(formatDiv);

    var formatListDiv = document.createElement('div');
    formatListDiv.classList.add("property-control-div");

    var formatList = document.createElement('select');
    formatList.id = "export-format-list";
    formatListDiv.appendChild(formatList);

    var formatLabel = document.createElement('label');
    formatLabel.innerHTML = "Image Format:";
    formatLabel.classList.add("property-label");
    formatLabel.htmlFor = "import-format-list";

    formatDiv.appendChild(formatLabel);
    formatDiv.appendChild(formatListDiv);

    var option = document.createElement('option');
    option.id = "export-indexed";
    option.innerHTML = "PNG (indexed)";
    option.value = "indexed";
    formatList.appendChild(option);

    var option = document.createElement('option');
    option.id = "export-png";
    option.innerHTML = "PNG (RGB)";
    option.value = "png";
    formatList.appendChild(option);

    var option = document.createElement('option');
    option.id = "export-jpeg";
    option.innerHTML = "JPEG (lossless)";
    option.value = "jpeg";
    formatList.appendChild(option);

    var keys = Object.keys(GFX.graphicsFormat);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var imageFormat = GFX.graphicsFormat[key];

        // skip formats that don't have enough color depth
        if (this.colorsPerPalette > imageFormat.colorsPerPalette) continue;

        var option = document.createElement('option');
        option.id = "export-" + imageFormat.key;
        option.innerHTML = imageFormat.name;
        // if (this.format.startsWith(imageFormat.key)) option.innerHTML += " (Native)";
        option.value = imageFormat.key;
        formatList.appendChild(option);
    }

    formatList.value = "indexed";

    var exporter = this;
    var okayButton = document.createElement('button');
    okayButton.innerHTML = "Okay";
    okayButton.onclick = function() {
        closeModal();
        exporter.exportGraphics(formatList.value);
    };
    content.appendChild(okayButton);

    var cancelButton = document.createElement('button');
    cancelButton.innerHTML = "Cancel";
    cancelButton.onclick = function() { closeModal(); };
    content.appendChild(cancelButton);
}

ROMGraphicsExporter.prototype.exportGraphics = function(formatKey) {

    var url;
    var extension = "bin";

    var ppu = new GFX.PPU();
    ppu.pal = this.palette;
    ppu.width = this.width * this.tileWidth;
    ppu.height = this.height * this.tileHeight;
    ppu.back = true;
    ppu.layers[0].cols = this.width;
    ppu.layers[0].rows = this.height;
    ppu.layers[0].z[0] = GFX.Z.top;
    ppu.layers[0].gfx = this.graphics;
    ppu.layers[0].tiles = this.tilemap;
    ppu.layers[0].tileWidth = this.tileWidth;
    ppu.layers[0].tileHeight = this.tileHeight;
    ppu.layers[0].main = true;

    if (formatKey === "indexed") {
        // indexed png
        var image = ppu.createPNG(0, 0, ppu.width, ppu.height);
        var blob = new Blob([image.buffer]);
        url = window.URL.createObjectURL(blob);
        extension = "png";

    } else if (formatKey === "png" || formatKey === "jpeg") {
        // non-indexed png or lossless jpeg
        var canvas = document.createElement('canvas');
        canvas.width = ppu.width;
        canvas.height = ppu.height;
        var context = canvas.getContext('2d');
        var imageData = context.createImageData(ppu.width, ppu.height);
        ppu.renderPPU(imageData.data, 0, 0, ppu.width, ppu.height);
        context.putImageData(imageData, 0, 0);
        if (formatKey === "png") {
            url = canvas.toDataURL("image/png");
            extension = "png";
        } else if (formatKey === "jpeg") {
            url = canvas.toDataURL("image/jpeg", 1.0);
            extension = "jpeg";
        }

    } else {
        // raw graphics (ignores tilemap)
        var graphicsFormat = GFX.graphicsFormat[formatKey];
        var data = graphicsFormat.encode(this.graphics);
        var blob = new Blob([data[0].buffer]);
        url = window.URL.createObjectURL(blob);
    }

    if (!url) return;

    // create a link element, hide it, direct it towards the blob,
    // and then 'click' it programatically
    var a = document.createElement("a");
    a.style = "display: none";
    document.body.appendChild(a);

    a.href = url;
    a.download = `image.${extension}`;
    a.click();

    // release the reference to the file by revoking the Object URL
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function ROMGraphicsImporter(rom, graphicsView, callback) {
    this.rom = rom;
    this.data = null;
    this.oldPalette = graphicsView.paletteView.palette;
    this.oldGraphics = graphicsView.graphics;
    this.includePalette = false;
    this.includeGraphics = false;
    this.ignoreBlankTiles = false;

    this.graphicsLeft = new ROMGraphicsView(rom);
    this.graphicsLeft.previewMode = true;
    this.graphicsLeft.zoom = 1.0;
    this.graphicsLeft.format = graphicsView.format;
    this.graphicsLeft.backColor = graphicsView.backColor;
    this.graphicsLeft.width = graphicsView.width || 16;
    this.graphicsLeft.height = graphicsView.height || 16;
    this.graphicsLeft.tileWidth = graphicsView.tileWidth || 8;
    this.graphicsLeft.tileHeight = graphicsView.tileHeight || 8;
    this.graphicsLeft.bytesPerTile = this.graphicsLeft.tileWidth * this.graphicsLeft.tileHeight;
    this.graphicsLeft.graphics = new Uint8Array(this.graphicsLeft.width * this.graphicsLeft.height * this.graphicsLeft.bytesPerTile);
    this.graphicsLeft.tilemap = null;
    this.graphicsLeft.spriteSheet = null;
    // this.graphicsLeft.canvasDiv.classList.add("background-gradient");
    if (graphicsView.selection.tilemap.length > 1) {
        this.graphicsLeft.selection = {
            x: 0, y: 0,
            w: graphicsView.selection.w,
            h: graphicsView.selection.h,
            tilemap: new Uint32Array(this.graphicsLeft.width * this.graphicsLeft.height)
        };
    } else {
        this.graphicsLeft.selection = {
            x: 0, y: 0,
            w: this.graphicsLeft.width,
            h: this.graphicsLeft.height,
            tilemap: new Uint32Array(this.graphicsLeft.width * this.graphicsLeft.height)
        };
    }
    this.graphicsLeft.canvas.onmousedown = function(e) {
        importer.graphicsLeft.mouseDown(e);
        importer.validateSelection();
        importer.updateImportPreview();
    };
    this.graphicsLeft.canvas.onmousemove = function(e) {
        importer.graphicsLeft.mouseMove(e);
        importer.validateSelection();
        importer.updateImportPreview();
    };

    this.paletteLeft = this.graphicsLeft.paletteView;
    this.paletteLeft.palette = new Uint32Array(this.oldPalette.length);
    this.paletteLeft.palette.fill(0xFF000000);
    this.paletteLeft.p = 0;
    this.paletteLeft.colorsPerPalette = graphicsView.paletteView.colorsPerPalette;
    this.paletteLeft.colorsPerRow = graphicsView.paletteView.colorsPerRow;
    this.paletteLeft.rowsPerPalette = graphicsView.paletteView.rowsPerPalette;
    // this.paletteLeft.showCursor = false;
    this.paletteLeft.canvas.onmousedown = function(e) { importer.paletteLeftMouseDown(e) };

    this.graphicsRight = new ROMGraphicsView(rom);
    this.graphicsLeft.previewMode = true;
    this.graphicsRight.zoom = 1.0;
    this.graphicsRight.graphics = this.oldGraphics;
    this.graphicsRight.format = graphicsView.format;
    this.graphicsRight.backColor = graphicsView.backColor;
    this.graphicsRight.width = graphicsView.width || 16;
    this.graphicsRight.height = graphicsView.height || 16;
    this.graphicsRight.tileWidth = graphicsView.tileWidth || 8;
    this.graphicsRight.tileHeight = graphicsView.tileHeight || 8;
    this.graphicsRight.bytesPerTile = this.graphicsRight.tileWidth * this.graphicsRight.tileHeight;
    this.graphicsRight.tilemap = graphicsView.tilemap;
    this.graphicsRight.spriteSheet = graphicsView.spriteSheet;
    // this.graphicsRight.canvasDiv.classList.add("background-gradient");
    if (graphicsView.selection.tilemap.length > 1) {
        this.graphicsRight.selection = {
            x: graphicsView.selection.x,
            y: graphicsView.selection.y,
            w: graphicsView.selection.w,
            h: graphicsView.selection.h,
            tilemap: new Uint32Array(this.graphicsRight.width * this.graphicsRight.height)
        };
    } else {
        this.graphicsRight.selection = {
            x: 0, y: 0,
            w: this.graphicsLeft.width,
            h: this.graphicsLeft.height,
            tilemap: new Uint32Array(this.graphicsRight.width * this.graphicsRight.height)
        };
    }
    this.graphicsRight.canvas.onmousedown = function(e) {
        importer.graphicsRight.mouseDown(e);
        importer.validateSelection();
        importer.updateImportPreview();
    };
    this.graphicsRight.canvas.onmousemove = null;

    this.paletteRight = this.graphicsRight.paletteView;
    this.paletteRight.palette = this.oldPalette;
    this.paletteRight.p = graphicsView.paletteView.p;
    this.paletteRight.colorsPerPalette = graphicsView.paletteView.colorsPerPalette;
    this.paletteRight.colorsPerRow = graphicsView.paletteView.colorsPerRow;
    this.paletteRight.rowsPerPalette = graphicsView.paletteView.rowsPerPalette;
    this.paletteRight.canvas.onmousedown = function(e) { importer.paletteRightMouseDown(e) };

    this.callback = callback;

    // open a dialog box
    this.content = openModal("Import Graphics");
    var importer = this;

    // file select button
    var input = document.createElement('input');
    input.type = "file";
    this.content.appendChild(input);
    input.onchange = function() {
        // upload user image file
        if (!this.files || !this.files[0]) return;
        var file = this.files[0];
        var filereader = new FileReader();
        filereader.readAsArrayBuffer(file);
        importer.includeGraphics = true;
        importer.includePalette = true;
        filereader.onload = function() {
            importer.data = new Uint8Array(filereader.result);
            importer.updateImportPreview();
        }
    }

    // dropdown list of image formats
    var formatDiv = document.createElement('div');
    formatDiv.classList.add("property-div");
    this.content.appendChild(formatDiv);

    var formatListDiv = document.createElement('div');
    formatListDiv.classList.add("property-control-div");

    var formatList = document.createElement('select');
    // formatList.classList.add("property-control");
    formatList.id = "import-format-list";
    formatList.onchange = function() {
        importer.updateImportPreview();
    }
    formatListDiv.appendChild(formatList);

    var formatLabel = document.createElement('label');
    formatLabel.innerHTML = "Image Format:";
    formatLabel.classList.add("property-label");
    formatLabel.htmlFor = "import-format-list";

    formatDiv.appendChild(formatLabel);
    formatDiv.appendChild(formatListDiv);

    // add options for png and jpeg
    option = document.createElement('option');
    option.id = "import-indexed";
    option.innerHTML = "PNG (indexed)";
    option.value = "indexed";
    formatList.appendChild(option);
    formatList.value = "indexed"; // default format

    option = document.createElement('option');
    option.id = "import-png";
    option.innerHTML = "PNG (RGB)";
    option.value = "png";
    formatList.appendChild(option);

    option = document.createElement('option');
    option.id = "import-jpeg";
    option.innerHTML = "JPEG";
    option.value = "jpeg";
    formatList.appendChild(option);

    // add options for native formats
    var keys = Object.keys(GFX.graphicsFormat);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var imageFormat = GFX.graphicsFormat[key];

        // skip formats that don't have enough color depth
        if (imageFormat.colorsPerPalette > this.graphicsRight.format.colorsPerPalette) continue;

        option = document.createElement('option');
        option.id = "import-" + imageFormat.key;
        option.innerHTML = imageFormat.name;
        if (this.graphicsRight.format.key === imageFormat.key) option.innerHTML += " (Native)";
        option.value = imageFormat.key;
        formatList.appendChild(option);
    }

    // ignore blank tiles check box
    var ignoreCheckDiv = document.createElement('div');
    this.content.appendChild(ignoreCheckDiv);

    var ignoreCheck = document.createElement('input');
    ignoreCheckDiv.appendChild(ignoreCheck);
    ignoreCheck.id = "import-ignore-check";
    ignoreCheck.type = 'checkbox';
    ignoreCheck.checked = false;
    ignoreCheck.onchange = function() {
        importer.ignoreBlankTiles = this.checked;
        importer.updateImportPreview();
    }

    var ignoreCheckLabel = document.createElement('label');
    ignoreCheckDiv.appendChild(ignoreCheckLabel);
    ignoreCheckLabel.innerHTML = "Ignore Blank Tiles";
    ignoreCheckLabel.htmlFor = "import-ignore-check";

    // number of palette colors
    var quantizeDiv = document.createElement('div');
    quantizeDiv.id = "import-quantize-div";
    quantizeDiv.style.display = "none";
    this.content.appendChild(quantizeDiv);

    var quantizeCheck = document.createElement('input');
    quantizeDiv.appendChild(quantizeCheck);
    quantizeCheck.id = "import-quantize-check";
    quantizeCheck.type = 'checkbox';
    quantizeCheck.checked = true;
    quantizeCheck.onchange = function() {
        importer.updateImportPreview();
    }

    var quantizeLabel = document.createElement('label');
    quantizeDiv.appendChild(quantizeLabel);
    quantizeLabel.innerHTML = "Quantize Image ";
    quantizeLabel.htmlFor = "import-quantize-check";

    var quantizeValue = document.createElement('input');
    quantizeDiv.appendChild(quantizeValue);
    quantizeValue.id = "import-quantize-value";
    quantizeValue.type = 'number';
    quantizeValue.min = 1;
    quantizeValue.max = 256;
    quantizeValue.value = this.graphicsRight.format.colorsPerPalette;
    quantizeValue.onchange = function() {
        importer.updateImportPreview();
    }

    var quantizeLabel2 = document.createElement('label');
    quantizeDiv.appendChild(quantizeLabel2);
    quantizeLabel2.innerHTML = "Colors";

    // import preview
    this.graphicsPreview = document.createElement('div');
    this.graphicsPreview.classList.add("import-preview");
    this.content.appendChild(this.graphicsPreview);

    this.graphicsPreviewLeft = document.createElement('div');
    this.graphicsPreviewLeft.style.overflowY = "scroll";
    this.graphicsPreviewLeft.style.flexGrow = 1;
    this.graphicsPreviewLeft.appendChild(this.graphicsLeft.canvasDiv);

    this.graphicsPreviewRight = document.createElement('div');
    this.graphicsPreviewRight.style.overflowY = "scroll";
    this.graphicsPreviewRight.style.flexGrow = 1;
    this.graphicsPreviewRight.appendChild(this.graphicsRight.canvasDiv);

    this.graphicsButtonDiv = document.createElement('div');
    this.graphicsButtonDiv.style.flexGrow = 0;
    this.graphicsButtonDiv.setAttribute("aria-label", "Toggle Graphics Import");
    this.graphicsButtonDiv.setAttribute("data-balloon-pos", "down");

    this.graphicsButton = document.createElement('button');
    this.graphicsButton.classList.add("icon-btn", "fas", "fa-arrow-right", "disabled");
    this.graphicsButton.disabled = true;
    this.graphicsButton.onclick = function() {
        importer.includeGraphics = !importer.includeGraphics;
        importer.updateImportPreview();
    };
    this.graphicsButtonDiv.appendChild(this.graphicsButton);

    this.graphicsPreview.appendChild(this.graphicsPreviewLeft);
    this.graphicsPreview.appendChild(this.graphicsButtonDiv);
    this.graphicsPreview.appendChild(this.graphicsPreviewRight);

    this.palettePreview = document.createElement('div');
    this.palettePreview.classList.add("import-preview");
    this.content.appendChild(this.palettePreview);

    this.paletteButtonDiv = document.createElement('div');
    this.paletteButtonDiv.style.flexGrow = 0;
    this.paletteButtonDiv.setAttribute("aria-label", "Toggle Palette Import");
    this.paletteButtonDiv.setAttribute("data-balloon-pos", "down");

    this.paletteButton = document.createElement('button');
    this.paletteButton.classList.add("icon-btn", "fas", "fa-arrow-right", "disabled");
    this.paletteButton.disabled = true;
    this.paletteButton.onclick = function() {
        importer.includePalette = !importer.includePalette;
        importer.updateImportPreview();
    };
    this.paletteButtonDiv.appendChild(this.paletteButton);

    this.palettePreview.appendChild(this.paletteLeft.canvas);
    this.palettePreview.appendChild(this.paletteButtonDiv);
    this.palettePreview.appendChild(this.paletteRight.canvas);

    // draw the preview
    this.resize();
    this.drawImportPreview();

    // okay button
    var okayButton = document.createElement('button');
    okayButton.id = "import-okay";
    okayButton.disabled = true;
    okayButton.innerHTML = "Import";
    okayButton.onclick = function() {
        closeModal();

        var graphics = importer.includeGraphics ? importer.graphicsRight.graphics : null;
        var palette = importer.includePalette ? importer.paletteRight.palette : null;

        if (graphics || palette) importer.callback(graphics, palette);
    };
    this.content.appendChild(okayButton);

    // cancel button
    var cancelButton = document.createElement('button');
    cancelButton.id = "import-cancel";
    cancelButton.innerHTML = "Cancel";
    cancelButton.onclick = function() {
        importer.graphicsRight.graphics = null;
        importer.paletteRight.palette = null;
        closeModal();
    };
    this.content.appendChild(cancelButton);

    if (ROMGraphicsImporter.resizeSensor) {
        ROMGraphicsImporter.resizeSensor.detach(this.content);
        ROMGraphicsImporter.resizeSensor = null;
    }
    ROMGraphicsImporter.resizeSensor = new ResizeSensor(this.content, function() {
        importer.resize();
        importer.drawImportPreview();
    });
}

ROMGraphicsImporter.resizeSensor = null;

ROMGraphicsImporter.prototype.paletteRightMouseDown = function(e) {
    var row = Math.floor(e.offsetY / this.paletteRight.colorHeight);
    this.paletteRight.p = Math.floor(row / this.paletteRight.rowsPerPalette);
    this.updateImportPreview();
}

ROMGraphicsImporter.prototype.paletteLeftMouseDown = function(e) {
    var row = Math.floor(e.offsetY / this.paletteLeft.colorHeight);
    this.paletteLeft.p = Math.floor(row / this.paletteLeft.rowsPerPalette);
    this.updateImportPreview();
}

ROMGraphicsImporter.prototype.resize = function() {

    // update element sizes
    this.graphicsPreview.style.width = this.content.clientWidth + "px";
    this.palettePreview.style.width = this.content.clientWidth + "px";
    var width = (this.content.offsetWidth - 40) / 2;

    this.graphicsPreviewLeft.style.width = width + "px";
    this.graphicsPreviewLeft.style.overflowX = "hidden";
    if (this.graphicsLeft.height * this.graphicsLeft.tileHeight > this.graphicsLeft.width * this.graphicsLeft.tileWidth) {
        // show scroll bars (height > width)
        this.graphicsPreviewLeft.style.overflowY = "scroll";
        this.graphicsLeft.zoom = Math.min(this.graphicsPreviewLeft.clientWidth / this.graphicsLeft.width / this.graphicsLeft.tileWidth, 4.0);
        this.graphicsPreviewLeft.style.height = this.graphicsLeft.width * this.graphicsLeft.tileWidth * this.graphicsLeft.zoom + "px";
    } else {
        // no scroll bars
        this.graphicsPreviewLeft.style.overflowY = "hidden";
        this.graphicsLeft.zoom = Math.min(this.graphicsPreviewLeft.clientWidth / this.graphicsLeft.width / this.graphicsLeft.tileWidth, 4.0);
        this.graphicsPreviewLeft.style.height = this.graphicsLeft.height * this.graphicsLeft.tileHeight * this.graphicsLeft.zoom + "px";
    }
    this.graphicsLeft.canvasDiv.style.height = this.graphicsLeft.height * this.graphicsLeft.tileHeight * this.graphicsLeft.zoom + "px";
    this.graphicsLeft.canvasDiv.style.width = this.graphicsLeft.width * this.graphicsLeft.tileWidth * this.graphicsLeft.zoom + "px";

    this.graphicsPreviewRight.style.width = width + "px";
    this.graphicsPreviewRight.style.overflowX = "hidden";
    if (this.graphicsRight.height * this.graphicsRight.tileHeight > this.graphicsRight.width * this.graphicsRight.tileWidth) {
        // show scroll bars (height > width)
        this.graphicsPreviewRight.style.overflowY = "scroll";
        this.graphicsRight.zoom = Math.min(this.graphicsPreviewRight.clientWidth / this.graphicsRight.width / this.graphicsRight.tileWidth, 4.0);
        this.graphicsPreviewRight.style.height = this.graphicsRight.width * this.graphicsRight.tileWidth * this.graphicsRight.zoom + "px";
    } else {
        // no scroll bars
        this.graphicsPreviewRight.style.overflowY = "hidden";
        this.graphicsRight.zoom = Math.min(this.graphicsPreviewRight.clientWidth / this.graphicsRight.width / this.graphicsRight.tileWidth, 4.0);
        this.graphicsPreviewRight.style.height = this.graphicsRight.height * this.graphicsRight.tileHeight * this.graphicsRight.zoom + "px";
    }
    this.graphicsRight.canvasDiv.style.height = this.graphicsRight.height * this.graphicsRight.tileHeight * this.graphicsRight.zoom + "px";
    this.graphicsRight.canvasDiv.style.width = this.graphicsRight.width * this.graphicsRight.tileWidth * this.graphicsRight.zoom + "px";

    this.paletteLeft.resize(width);
    this.paletteRight.resize(width);
}

ROMGraphicsImporter.prototype.validateSelection = function() {

    // make sure the left selection fits
    var leftSelection = this.graphicsLeft.selection;
    if (leftSelection.x >= this.graphicsLeft.width) {
        leftSelection.x = this.graphicsLeft.width - 1;
        leftSelection.w = 1;
    } else if (leftSelection.x + leftSelection.w > this.graphicsLeft.width) {
        leftSelection.w = this.graphicsLeft.width - leftSelection.x;
    }

    if (leftSelection.y >= this.graphicsLeft.height) {
        leftSelection.y = this.graphicsLeft.height - 1;
        leftSelection.h = 1;
    } else if (leftSelection.y + leftSelection.h > this.graphicsLeft.height) {
        leftSelection.h = this.graphicsLeft.height - leftSelection.y;
    }
    leftSelection.tilemap = new Uint32Array(leftSelection.h * leftSelection.w);

    // make sure the left palette index is valid
    var palCount = Math.ceil(this.paletteLeft.palette.length / this.paletteLeft.colorsPerPalette);
    if (this.paletteLeft.p >= palCount) this.paletteLeft.p = 0;

    // make sure the right selection fits
    var rightSelection = this.graphicsRight.selection;
    rightSelection.w = leftSelection.w;
    if (rightSelection.x >= this.graphicsRight.width) {
        rightSelection.x = this.graphicsRight.width - 1;
        rightSelection.w = 1;
    } else if (rightSelection.x + rightSelection.w > this.graphicsRight.width) {
        rightSelection.w = this.graphicsRight.width - rightSelection.x;
    }

    rightSelection.h = leftSelection.h;
    if (rightSelection.y >= this.graphicsRight.height) {
        rightSelection.y = this.graphicsRight.height - 1;
        rightSelection.h = 1;
    } else if (rightSelection.y + rightSelection.h > this.graphicsRight.height) {
        rightSelection.h = this.graphicsRight.height - rightSelection.y;
    }
    rightSelection.tilemap = new Uint32Array(rightSelection.h * rightSelection.w);
}

ROMGraphicsImporter.prototype.updateImportPreview = function() {
    var okayButton = document.getElementById("import-okay");
    okayButton.disabled = true;
    this.graphicsButton.disabled = true;
    this.paletteButton.disabled = true;
    if (!this.data) {
        this.validateSelection();
        this.drawImportPreview();
        return;
    }
    okayButton.disabled = false;
    this.graphicsButton.disabled = false;

    var quantizeDiv = document.getElementById('import-quantize-div');
    quantizeDiv.style.display = "none";

    var list = document.getElementById("import-format-list");
    var formatKey = list.value;

    if (formatKey === "png" || formatKey === "jpeg") {
        quantizeDiv.style.display = "block";
        this.paletteButton.disabled = false;
        var importer = this;
        let blob = new Blob([this.data], {
            type: `image/${formatKey}`
        });
        var url = window.URL.createObjectURL(blob);
        var img = new Image();
        // img.decode = "sync"; // load synchronously
        img.onload = function() {
            importer.quantizeImage(img);
            importer.resize();
            importer.validateSelection();
            importer.copySpriteSheet();
            importer.copyPalette();
            importer.drawImportPreview();
            img.onload = null;
            img.onerror = null;
            img.src = '';
            window.URL.revokeObjectURL(url);
        }
        img.onerror = function() {
            importer.paletteLeft.palette = new Uint32Array(importer.oldPalette.length);
            importer.paletteLeft.palette.fill(0xFF000000);
            importer.graphicsLeft.width = importer.graphicsRight.width;
            importer.graphicsLeft.height = importer.graphicsRight.height;
            importer.graphicsLeft.graphics = new Uint8Array(importer.graphicsLeft.width * importer.graphicsLeft.height * this.graphicsLeft.bytesPerTile);

            importer.resize();
            importer.validateSelection();
            importer.drawImportPreview();

            img.onload = null;
            img.onerror = null;
            img.src = '';
            window.URL.revokeObjectURL(url);
        }
        img.src = url;

    } else if (formatKey === "indexed") {
        this.paletteButton.disabled = false;
        var indexed = pzntg.getIndexed(this.data);

        if (indexed.palette) {
            // get new palette
            this.paletteLeft.palette = new Uint32Array(indexed.palette.buffer);

            // set alpha channel to max for all colors
            for (var c = 0; c < this.paletteLeft.palette.length; c++) {
                this.paletteLeft.palette[c] |= 0xFF000000;
            }
        } else {
            this.paletteLeft.palette = new Uint32Array(this.oldPalette.length);
            this.paletteLeft.palette.fill(0xFF000000);
        }

        // get new graphics
        if (indexed.graphics) {
            // modulo colors by the color depth
            var graphics = indexed.graphics;
            var colorDepth = this.graphicsLeft.format.colorsPerPalette;
            for (var i = 0; i < graphics.length; i++) graphics[i] %= colorDepth;
            this.graphicsLeft.graphics = graphics;

            this.graphicsLeft.width = Math.floor(indexed.width / this.graphicsLeft.tileWidth);
            this.graphicsLeft.height = Math.floor(indexed.height / this.graphicsLeft.tileHeight);

            this.graphicsLeft.graphics = ROM.dataFormat.interlace.decode(graphics,
                this.graphicsLeft.tileWidth, this.graphicsLeft.tileHeight,
                this.graphicsLeft.width)[0];

            this.resize();
            this.validateSelection();
            this.copySpriteSheet();
            this.copyPalette();
            this.drawImportPreview();
        } else {
            this.graphicsLeft.width = this.graphicsRight.width;
            this.graphicsLeft.height = this.graphicsRight.height;
            this.graphicsLeft.graphics = new Uint8Array(this.graphicsLeft.width * this.graphicsLeft.height * this.graphicsLeft.bytesPerTile);

            this.resize();
            this.validateSelection();
            this.drawImportPreview();
        }

    } else if (GFX.graphicsFormat[formatKey]) {
        this.paletteButton.disabled = true;
        this.includePalette = false;

        // decode native format graphics
        this.graphicsLeft.graphics = GFX.graphicsFormat[formatKey].decode(this.data)[0];
        this.graphicsLeft.width = this.graphicsRight.width;
        this.paletteLeft.palette = this.oldPalette;

        this.resize();
        this.validateSelection();
        this.copyGraphics();
        this.copyPalette();
        this.drawImportPreview();

    } else {
        this.paletteButton.disabled = true;
        this.includePalette = false;
        this.graphicsLeft.graphics = this.data;
        this.graphicsLeft.width = this.graphicsRight.width;
        this.paletteLeft.palette = this.oldPalette;

        this.resize();
        this.validateSelection();
        this.copyGraphics();
        this.copyPalette();
        this.drawImportPreview();
    }
}

ROMGraphicsImporter.prototype.drawImportPreview = function() {

    // update graphics and palette buttons
    if (this.includeGraphics) {
        this.graphicsButton.classList.add("selected");
    } else {
        this.graphicsButton.classList.remove("selected");
    }

    if (this.includePalette) {
        this.paletteButton.classList.add("selected");
    } else {
        this.paletteButton.classList.remove("selected");
    }

    // redraw palettes
    this.paletteLeft.redraw();
    this.paletteRight.redraw();

    // update left tilemap to account for changed size
    this.graphicsLeft.updateTilemap();
    this.graphicsRight.updateTilemap();

    // redraw graphics previews
    this.graphicsLeft.redraw();
    this.graphicsRight.redraw();
}

ROMGraphicsImporter.prototype.copyGraphics = function() {

    // start with the old graphics
    this.graphicsRight.graphics = this.oldGraphics.slice();

    if (!this.includeGraphics) return;

    // blank tile for comparison
    var blankTile = new Uint8Array(this.graphicsLeft.bytesPerTile);

    // set the graphics on the right
    var colorDepth = this.graphicsRight.format.colorsPerPalette;
    for (var y = 0; y < this.graphicsLeft.selection.h; y++) {
        if (this.graphicsRight.selection.y + y >= this.graphicsRight.height) break;
        for (var x = 0; x < this.graphicsLeft.selection.w; x++) {
            if (this.graphicsRight.selection.x + x >= this.graphicsRight.width) break;

            // get the tile
            var begin = this.graphicsLeft.selection.x + x;
            begin += (this.graphicsLeft.selection.y + y) * this.graphicsLeft.width;
            begin *= this.graphicsLeft.bytesPerTile;
            var end = begin + this.graphicsLeft.bytesPerTile;
            var tile = this.graphicsLeft.graphics.subarray(begin, end);

            // modulo colors by the color depth
            for (var i = 0; i < tile.length; i++) tile[i] %= colorDepth;

            // skip blank tiles
            if (this.ignoreBlankTiles && compareTypedArrays(tile, blankTile)) continue;

            var offset = this.graphicsRight.selection.x + x;
            offset += (this.graphicsRight.selection.y + y) * this.graphicsRight.width;
            offset *= this.graphicsLeft.bytesPerTile;
            if ((offset + tile.length) >= this.graphicsRight.graphics.length) break;
            this.graphicsRight.graphics.set(tile, offset);
        }
    }
}

ROMGraphicsImporter.prototype.copySpriteSheet = function() {

    // copy graphics if there is no sprite sheet
    var spriteSheet = this.graphicsRight.spriteSheet;
    if (!spriteSheet) {
        this.copyGraphics();
        return;
    }

    // start with the old graphics
    this.graphicsRight.graphics = this.oldGraphics.slice();

    if (!this.includeGraphics) return;

    // blank tile for comparison
    var blankTile = new Uint8Array(this.graphicsLeft.bytesPerTile);

    // find the first instance of each tile
    var tileGraphics = [];
    for (var y = 0; y < this.graphicsLeft.selection.h; y++) {
        if (this.graphicsRight.selection.y + y >= this.graphicsRight.height) break;
        for (var x = 0; x < this.graphicsLeft.selection.w; x++) {
            if (this.graphicsRight.selection.x + x >= this.graphicsRight.width) break;

            var s = x + this.graphicsRight.selection.x;
            s += (y + this.graphicsRight.selection.y) * spriteSheet.width;
            var t = spriteSheet.tilemap[s];

            // skip unused tiles
            if (t === -1) continue;
            var hFlip = t & 0x10000000;
            var vFlip = t & 0x20000000;
            t &= 0xFFFF;

            // skip tiles multiple instances of the same tile
            if (tileGraphics[t]) continue;

            // get the tile
            var xLeft = this.graphicsLeft.selection.x + x;
            if (xLeft >= this.graphicsLeft.width) continue;
            var yLeft = this.graphicsLeft.selection.y + y;
            if (yLeft >= this.graphicsLeft.height) continue;

            var begin = (xLeft + yLeft * this.graphicsLeft.width) * this.graphicsLeft.bytesPerTile;
            var end = begin + this.graphicsLeft.bytesPerTile;
            var tile = this.graphicsLeft.graphics.slice(begin, end);

            // modulo colors by the color depth
            for (var i = 0; i < tile.length; i++) tile[i] %= this.graphicsRight.format.colorsPerPalette;

            // skip blank tiles
            if (this.ignoreBlankTiles && compareTypedArrays(tile, blankTile)) continue;

            if (hFlip) {
                // todo: flip tile
            }

            if (vFlip) {
                // todo: flip tile
            }

            // save the tile
            tileGraphics[t] = tile;
        }
    }

    // copy tiles to right graphics
    var maxTiles = Math.floor(this.graphicsRight.graphics.length / this.graphicsRight.bytesPerTile);
    for (var t = 0; t < tileGraphics.length; t++) {
        // skip tiles that were not found
        if (!tileGraphics[t]) continue;

        // skip tiles that don't fit
        if (t >= maxTiles) continue;

        // copy the tile
        this.graphicsRight.graphics.set(tileGraphics[t], t * this.graphicsRight.bytesPerTile);
    }
}

ROMGraphicsImporter.prototype.copyPalette = function() {

    // start with the old palette
    this.paletteRight.palette = this.oldPalette.slice();

    if (!this.includePalette) return;

    // get the palette from the left
    var begin = this.paletteLeft.p * this.paletteLeft.colorsPerPalette;
    var end = begin + this.paletteLeft.colorsPerPalette;
    var palette = this.paletteLeft.palette.subarray(begin, end);

    var offset = this.paletteRight.p * this.paletteRight.colorsPerPalette;

    // trim to fit if needed
    if (palette.length + offset > this.oldPalette.length) {
        palette = palette.subarray(0, this.oldPalette.length - offset);
    }

    // set the palette on the right
    this.paletteRight.palette.set(palette, offset);
}

ROMGraphicsImporter.prototype.quantizeImage = function(img) {

    var quantizeCheck = document.getElementById('import-quantize-check');

    var quantPalette = [];
    var colorDepth;
    if (quantizeCheck.checked) {
        var quantizeValue = document.getElementById('import-quantize-value');
        colorDepth = Number(quantizeValue.value);
    } else {
        // start with the old palette
        colorDepth = this.paletteRight.colorsPerPalette;
        var offset = this.paletteRight.p * colorDepth;
        for (var p = 0; p < colorDepth; p++) {

            // skip transparent color
            if (p === 0 && !this.graphicsRight.backColor) continue;

            var r = this.oldPalette[p + offset] & 0xFF;
            var g = (this.oldPalette[p + offset] & 0xFF00) >> 8;
            var b = (this.oldPalette[p + offset] & 0xFF0000) >> 16;
            quantPalette.push([r,g,b]);
        }
    }

    if (!this.graphicsRight.backColor) colorDepth--;

    var options = {
        colors: colorDepth,      // desired palette size
        method: 2,               // histogram method, 2: min-population threshold within subregions; 1: global top-population
        boxSize: [this.graphicsRight.tileWidth, this.graphicsRight.tileHeight],          // subregion dims (if method = 2)
        boxPxls: 2,              // min-population threshold (if method = 2)
        initColors: 4096,        // # of top-occurring colors  to start with (if method = 1)
        minHueCols: 0,           // # of colors per hue group to evaluate regardless of counts, to retain low-count hues
        dithKern: null,          // dithering kernel name, see available kernels in docs below
        dithDelta: 0,            // dithering threshhold (0-1) e.g: 0.05 will not dither colors with <= 5% difference
        dithSerp: false,         // enable serpentine pattern dithering
        palette: quantPalette,   // a predefined palette to start with in r,g,b tuple format: [[r,g,b],[r,g,b]...]
        reIndex: false,          // affects predefined palettes only. if true, allows compacting of sparsed palette once target palette size is reached. also enables palette sorting.
        useCache: true,          // enables caching for perf usually, but can reduce perf in some cases, like pre-def palettes
        cacheFreq: 10,           // min color occurance count needed to qualify for caching
        colorDist: "euclidean",  // method used to determine color distance, can also be "manhattan"
    }

    // quantize the image
    var q = new RgbQuant(options);
    q.sample(img);

    // get the palette (false to get an array instead of tuples)
    var quantPalette32 = new Uint32Array(q.palette(false).buffer);
    if (this.graphicsRight.backColor) {
        this.paletteLeft.palette = new Uint32Array(quantPalette32.length);
        this.paletteLeft.palette.set(quantPalette32, 0);
    } else {
        this.paletteLeft.palette = new Uint32Array(quantPalette32.length + 1);
        this.paletteLeft.palette.set(quantPalette32, 1);
    }

    // get the indexed color data
    var graphicsARGB = new Uint8Array(q.reduce(img, 1));
    var graphics = new Uint8Array(q.reduce(img, 2));

    // if there is a transparent color, increment every color index
    if (!this.graphicsRight.backColor) {
        for (var i = 0; i < graphics.length; i++) {
            if (graphicsARGB[i * 4 + 3]) {
                graphics[i]++;
            }
        }
    }

    this.graphicsLeft.width = Math.floor(img.width / this.graphicsLeft.tileWidth);
    this.graphicsLeft.height = Math.floor(img.height / this.graphicsLeft.tileHeight);

    // interlace to convert to 8x8 tiles
    this.graphicsLeft.graphics = ROM.dataFormat.interlace.decode(graphics,
        this.graphicsLeft.tileWidth, this.graphicsLeft.tileHeight,
        this.graphicsLeft.width)[0];
}

//
// ff1-map.js
// created 10/27/2018
//

function FF1Map(rom) {
    ROMEditor.call(this, rom);
    this.name = "FF1Map";
    this.tileset = new FF1MapTileset(rom, this);

    this.div = document.createElement('div');
    this.div.id = 'map-edit';

    this.scrollDiv = document.createElement('div');
    this.scrollDiv.classList.add('no-select');
    this.div.appendChild(this.scrollDiv);

    this.canvas = document.createElement('canvas');
    this.canvas.id = "map";
    this.canvas.width = 256;
    this.canvas.height = 256;
    this.scrollDiv.appendChild(this.canvas);

    this.cursorCanvas = document.createElement('canvas');
    this.cursorCanvas.id = "map-cursor";
    this.cursorCanvas.width = 16;
    this.cursorCanvas.height = 16;
    this.scrollDiv.appendChild(this.cursorCanvas);

    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.width = 256;
    this.mapCanvas.height = 256;
    this.mapSectors = [];
    this.dirtyRect = null;
    this.mapRect = new Rect(0, 0, 256, 256);
    this.npcCanvas = document.createElement('canvas');
    this.menu = document.getElementById("menu");

    this.mapProperties = null;
    this.m = null; // map index
    this.l = 0; // selected layer
    this.zoom = 1.0; // zoom multiplier
    this.selection = new Uint8Array([0x73, 0, 0, 1, 1, 0]);
    this.clickedCol = null;
    this.clickedRow = null;
    this.clickButton = null;
    this.isDragging = false;
    this.layer = [new FF1MapLayer(rom, FF1MapLayer.Type.layer1)];
    this.selectedLayer = this.layer[0];
    this.worldLayer = new FF1MapLayer(rom, FF1MapLayer.Type.world);
    this.triggers = [];
    this.showCursor = false;
    this.showBackground = true;
    this.showRooms = true;
    this.showTriggers = true;
    this.selectedTrigger = null;
    this.isWorld = false;
    this.observer = new ROMObserver(rom, this);
    this.ppu = new GFX.PPU();

    // mask layer stuff
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.id = "map-screen";
    this.screenCanvas.width = 256;
    this.screenCanvas.width = 256;
    this.scrollDiv.appendChild(this.screenCanvas);

    var map = this;
    this.div.onscroll = function() { map.scroll() };
    this.scrollDiv.onmousedown = function(e) { map.mouseDown(e) };
    this.scrollDiv.onmouseup = function(e) { map.mouseUp(e) };
    this.scrollDiv.onmousemove = function(e) { map.mouseMove(e) };
    this.scrollDiv.onmouseenter = function(e) { map.mouseEnter(e) };
    this.scrollDiv.onmouseleave = function(e) { map.mouseLeave(e) };
    this.scrollDiv.oncontextmenu = function(e) { map.openMenu(e); return false; };
    this.resizeSensor = null;

    this.updateTilesets();
}

FF1Map.prototype = Object.create(ROMEditor.prototype);
FF1Map.prototype.constructor = FF1Map;

FF1Map.prototype.beginAction = function(callback) {
    this.rom.beginAction();
    this.rom.doAction(new ROMAction(this.observer, this.observer.wake, this.observer.sleep));
    if (callback) this.rom.doAction(new ROMAction(this, callback, null));
}

FF1Map.prototype.endAction = function(callback) {
    if (callback) this.rom.doAction(new ROMAction(this, null, callback));
    this.rom.doAction(new ROMAction(this.observer, this.observer.sleep, this.observer.wake));
    this.rom.endAction();
}

FF1Map.prototype.updateTilesets = function() {

    for (var t = 0; t < this.rom.mapTileset.arrayLength; t++) {
        var tileset = this.rom.mapTileset.item(t);
        tileset.palette = [];
    }

    var mapStringTable = this.rom.stringTable.mapProperties;
    for (var m = 0; m < this.rom.mapProperties.arrayLength; m++) {
        var mapProperties = this.rom.mapProperties.item(m);
        var t = mapProperties.tileset.value;

        var name = mapStringTable.string[m].fString(40);

        var paletteDefinition1 = {
            name: name + " (Inside)",
            path: "mapPalette[" + m + "]",
            range: "32-48"
        };
        var paletteDefinition2 = {
            name: name + " (Outside)",
            path: "mapPalette[" + m + "]",
            range: "0-16"
        };

        var tileset = this.rom.mapTileset.item(t);
        tileset.palette.push(paletteDefinition1);
        tileset.palette.push(paletteDefinition2);
    }
}

FF1Map.prototype.changeZoom = function() {

    // save the old scroll location
    var l = this.div.scrollLeft;
    var t = this.div.scrollTop;
    var w = this.div.clientWidth;
    var h = this.div.clientHeight;
    var oldRect = new Rect(l, l + w, t, t + h);
    var x = Math.round(oldRect.centerX / this.zoom);
    var y = Math.round(oldRect.centerY / this.zoom);

    // update zoom
    this.zoom = Math.pow(2, Number(document.getElementById("zoom").value));
    var zoomValue = document.getElementById("zoom-value");
    zoomValue.innerHTML = (this.zoom * 100).toString() + "%";

    // update the scroll div size
    var parentWidth = this.ppu.width * this.zoom;
    var parentHeight = this.ppu.height * this.zoom;
    this.scrollDiv.style.width = parentWidth.toString() + "px";
    this.scrollDiv.style.height = parentHeight.toString() + "px";

    // calculate the new scroll location
    x *= this.zoom; y *= this.zoom;
    var newRect = new Rect(x - w / 2, x + w / 2, y - h / 2, y + h / 2);
    if (newRect.r > parentWidth) newRect = newRect.offset(parentWidth - newRect.r, 0);
    if (newRect.b > parentHeight) newRect = newRect.offset(0, parentHeight - newRect.b);
    if (newRect.l < 0) newRect = newRect.offset(-newRect.l, 0);
    if (newRect.t < 0) newRect = newRect.offset(0, -newRect.t);

    // set the new scroll location and redraw
    this.div.scrollLeft = newRect.l;
    this.div.scrollTop = newRect.t;
    this.scroll();
}

FF1Map.prototype.scroll = function() {

    this.closeMenu();

    // get the visible dimensions
    var x = this.div.scrollLeft;
    var y = this.div.scrollTop;
    var w = this.div.clientWidth;
    var h = this.div.clientHeight;

    var margin = Math.max(w, h) >> 2;
    this.mapRect.r = Math.min(x + w + margin, this.ppu.width * this.zoom);
    this.mapRect.l = Math.max(0, Math.min(x - margin, this.mapRect.r - w));
    this.mapRect.b = Math.min(y + h + margin, this.ppu.height * this.zoom);
    this.mapRect.t = Math.max(0, Math.min(y - margin, this.mapRect.b - h));

    this.canvas.style.left = this.mapRect.l.toString() + "px";
    this.canvas.style.top = this.mapRect.t.toString() + "px";
    this.canvas.width = this.mapRect.w;
    this.canvas.height = this.mapRect.h;

    this.drawMap();
}

FF1Map.prototype.mouseDown = function(e) {

    this.closeMenu();
    this.clickedCol = ((e.offsetX / this.zoom + this.ppu.layers[this.l].x) % this.ppu.width) >> 4;
    this.clickedRow = ((e.offsetY / this.zoom + this.ppu.layers[this.l].y) % this.ppu.height) >> 4;
    this.clickButton = e.button;

    // update the selection position
    this.selection[1] = this.clickedCol;
    this.selection[2] = this.clickedRow;

    if (this.l === 3) {
        var triggers = this.triggersAt(e.offsetX, e.offsetY);
        var index = triggers.indexOf(this.selectedTrigger);
        if (index !== -1) {
            // select the next trigger in a stack
            var t = (index + 1) % triggers.length;
            this.selectTrigger(triggers[t]);
            this.isDragging = true;
        } else if (triggers.length !== 0) {
            // select the first trigger
            this.selectTrigger(triggers[0]);
            this.isDragging = true;
        } else {
            // clear trigger selection
            this.selectedTrigger = null;
            if (this.isWorld) {
                // select world map battle
                this.selectWorldBattle(this.clickedCol, this.clickedRow);
            } else {
                // select map properties
                propertyList.select(this.mapProperties);
            }
            this.isDragging = false;
        }
    } else if (this.clickButton === 2) {
        this.selectTiles();
        this.isDragging = true;
    } else {
        this.beginAction(this.drawMap);
//        this.rom.pushAction(new ROMAction(this, this.drawMap, null, "Redraw Map"));
        this.rom.doAction(new ROMAction(this.selectedLayer, this.selectedLayer.decodeLayout, null, "Decode Layout"));
        this.setTiles();
        this.isDragging = true;
    }

    this.drawScreen();
    this.drawCursor();
}

FF1Map.prototype.mouseUp = function(e) {

    if (this.l === 3 && this.selectedTrigger && this.isDragging) {
        // save the new trigger position
        var col = this.selectedTrigger.x.value;
        var row = this.selectedTrigger.y.value;

        if (col != this.clickedCol || row !== this.clickedRow) {
            // move the trigger back to its old position
            this.selectedTrigger.x.value = this.clickedCol;
            this.selectedTrigger.y.value = this.clickedRow;

            // set the new trigger position (and trigger undo)
            this.beginAction(this.reloadTriggers);
            this.selectedTrigger.x.setValue(col);
            this.selectedTrigger.y.setValue(row);
            this.endAction(this.reloadTriggers);
        }
    } else if (this.rom.action && this.isDragging) {
        this.rom.doAction(new ROMAction(this.selectedLayer, null, this.selectedLayer.decodeLayout, "Decode Layout"));
        this.rom.pushAction(new ROMAction(this, null, this.drawMap, "Redraw Map"));
        this.endAction();
    }

    this.isDragging = false;
    this.clickButton = null;
}

FF1Map.prototype.mouseMove = function(e) {

    // return if the menu is open
    if (this.menu.classList.contains("active")) return;

    var col = ((e.offsetX / this.zoom + this.ppu.layers[this.l].x) % this.ppu.width) >> 4;
    var row = ((e.offsetY / this.zoom + this.ppu.layers[this.l].y) % this.ppu.height) >> 4;

    // update the displayed coordinates
    var coordinates = document.getElementById("coordinates");
    coordinates.innerHTML = "(" + col + ", " + row + ")";

    // return if the cursor position didn't change
    if (this.selection[1] === col && this.selection[2] === row) return;

    // update the selection position
    this.selection[1] = col;
    this.selection[2] = row;

    if (!this.isDragging) {
        // update the cursor
        this.drawScreen();
        this.drawCursor();
        return;
    }

    if (this.l === 3 && this.selectedTrigger) {

        if (this.selectedTrigger.x.value !== col || this.selectedTrigger.y.value !== row) {
            this.selectedTrigger.x.value = col;
            this.selectedTrigger.y.value = row;
            this.invalidateMap(this.rectForTrigger(this.selectedTrigger).scale(1 / this.zoom));
            this.drawMap();
        }
    } else if (this.clickButton === 2) {
        this.selectTiles();
    } else {
        this.setTiles();
    }

    // update the cursor
    this.drawScreen();
    this.drawCursor();
}

FF1Map.prototype.mouseEnter = function(e) {

    // show the cursor
    this.showCursor = true;
    this.drawScreen();
    this.drawCursor();

    this.mouseUp(e);
}

FF1Map.prototype.mouseLeave = function(e) {

    // hide the cursor
    this.showCursor = (this.l === 3);
    this.drawScreen();
    this.drawCursor();

    this.mouseUp(e);
}

FF1Map.prototype.updateMenu = function() {
    this.menu.innerHTML = "";

    var self = this;
    function appendMenuItem(label, onclick) {
        var li = document.createElement('li');
        li.classList.add("menu-item");
        li.innerHTML = label;
        if (onclick) {
            li.onclick = onclick;
        } else {
            li.classList.add("menu-item-disabled");
        }
        self.menu.appendChild(li);
    }

    // make sure there are unused NPCs
    var isFull = true;
    var npcProperties = this.rom.mapNPC.item(this.m);
    for (var n = 0; n < npcProperties.arrayLength; n++) {
        if (npcProperties.item(n).npcID.value == 0) {
            isFull = false;
            break;
        }
    }

    appendMenuItem("Insert NPC", (this.isWorld || isFull) ? null : function() { self.insertNPC() });
    appendMenuItem("Delete NPC", !this.selectedTrigger ? null : function() { self.deleteTrigger() });
}

FF1Map.prototype.openMenu = function(e) {
    if (this.l !== 3) return; // no menu unless editing triggers
    this.updateMenu();

    this.clickedCol = ((e.offsetX / this.zoom + this.ppu.layers[this.l].x) % this.ppu.width) >> 4;
    this.clickedRow = ((e.offsetY / this.zoom + this.ppu.layers[this.l].y) % this.ppu.height) >> 4;

    this.menu.classList.add("menu-active");
    this.menu.style.left = e.x + "px";
    this.menu.style.top = e.y + "px";
}

FF1Map.prototype.closeMenu = function() {
    this.menu.classList.remove("menu-active");
}

FF1Map.prototype.setTiles = function() {
    // return if not dragging
    if (!isNumber(this.clickedCol) || !isNumber(this.clickedRow)) return;

    var col = this.selection[1];
    var row = this.selection[2];
    var cols = this.selection[3];
    var rows = this.selection[4];

    var l = ((col << 4) - this.ppu.layers[this.l].x) & (this.ppu.width - 1);
    var r = l + (cols << 4);
    var t = ((row << 4) - this.ppu.layers[this.l].y) & (this.ppu.height - 1);
    var b = t + (rows << 4);
    var rect = new Rect(l, r, t, b);

    function invalidate() { this.invalidateMap(rect); }
    this.selectedLayer.setLayout(this.selection);
    this.rom.doAction(new ROMAction(this, invalidate, invalidate, "Invalidate Map"));
    this.drawMap();
}

FF1Map.prototype.selectTrigger = function(trigger) {
    this.selectedTrigger = trigger;
    propertyList.select(trigger);
    if (!trigger) return;
    this.clickedCol = this.selectedTrigger.x.value;
    this.clickedRow = this.selectedTrigger.y.value;
}

FF1Map.prototype.selectTiles = function() {
    // return if not dragging
    if (!isNumber(this.clickedCol) || !isNumber(this.clickedRow)) return;

    var col = this.selection[1];
    var row = this.selection[2];
    var cols = Math.abs(col - this.clickedCol) + 1;
    var rows = Math.abs(row - this.clickedRow) + 1;
    col = Math.min(col, this.clickedCol);
    row = Math.min(row, this.clickedRow);

    this.selection = this.selectedLayer.getLayout(col, row, cols, rows);
    this.selection[2] |= this.l << 6;

    if (rows !== 1 || cols !== 1) {
        this.tileset.selection = null;
    } else {
        // select a single tile in the tileset view
        var tile = this.selection[5];
        this.tileset.selection = new Uint8Array([0x73, tile & 0x0F, tile >> 4, 1, 1, tile]);
        this.selectTileProperties(tile);
    }
    this.tileset.drawCursor();
}

FF1Map.prototype.selectTileProperties = function(t) {
    // select tile properties
    var tileProperties;
    if (this.selectedLayer.type === FF1MapLayer.Type.layer1) {
        // layer 1 tile properties determined by graphics index
        tileProperties = this.rom.mapTileProperties.item(this.mapProperties.tileset.value);
    } else if (this.selectedLayer.type === FF1MapLayer.Type.world) {
        // world map tile properties
        tileProperties = this.rom.worldTileProperties;
        var battleEditor = propertyList.getEditor("FF1Battle");
        battleEditor.bg = this.rom.worldBattleBackground.item(t).background.value;
    } else {
        // return if layer 2
        return;
    }
    propertyList.select(tileProperties.item(t));
}

FF1Map.prototype.selectLayer = function(l) {
    // set the selected layer
    if (isNumber(l)) this.l = l;

    if (this.isWorld) {
        this.selectedLayer = this.worldLayer;
    } else {
        this.selectedLayer = this.layer[this.l]
    }

    this.showCursor = (this.l === 3);
    this.drawScreen();
    this.drawCursor();
}

FF1Map.prototype.selectWorldBattle = function(x, y) {
    x >>= 5;
    y >>= 5;
    x &= 7;
    y &= 7;
    var sector = x + (y << 3);

    var battleGroup = this.rom.battleGroup.item(sector);
    propertyList.select(battleGroup);
}

FF1Map.prototype.changeLayer = function(id) {
    this[id] = document.getElementById(id).checked;
//    this.showRooms = this.showLayer2;
//    var map = this.rom.mapProperties.item(this.m);
    this.ppu.layers[0].main = this.showBackground;
    this.loadMap();
}


FF1Map.prototype.drawScreen = function() {

    this.screenCanvas.style.display = "none";
    if (!this.showScreen) return;

    // calculate the screen rect
    var x = ((this.selection[1] * 16) - this.ppu.layers[this.l].x) & (this.ppu.width - 1);
    var y = ((this.selection[2] * 16) - this.ppu.layers[this.l].y) & (this.ppu.height - 1);
    var screenRect;
    screenRect = new Rect(x - 7 * 16, x + 9 * 16, y - 7 * 16, y + 8 * 16);

    screenRect.l = Math.max(0, screenRect.l);
    screenRect.r = Math.min(this.ppu.width, screenRect.r);
    screenRect.t = Math.max(0, screenRect.t);
    screenRect.b = Math.min(this.ppu.height, screenRect.b);

    // scale and offset to match the map rect
    screenRect = screenRect.scale(this.zoom).offset(-this.mapRect.l, -this.mapRect.t);

    // draw the screen mask
    this.screenCanvas.width = this.mapRect.w;
    this.screenCanvas.height = this.mapRect.h;
    this.screenCanvas.style.left = this.mapRect.l.toString() + "px";
    this.screenCanvas.style.top = this.mapRect.t.toString() + "px";
    this.screenCanvas.style.display = "block";
    var ctx = this.screenCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, this.screenCanvas.width, this.screenCanvas.height);
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';
    ctx.fillRect(screenRect.l, screenRect.t, screenRect.w, screenRect.h);
}

FF1Map.prototype.drawCursor = function() {

    this.cursorCanvas.classList.add('hidden');
    if (!this.showCursor) return;

    var col = this.selection[1];
    var row = this.selection[2];

    // get the cursor geometry and color
    var x = ((col << 4) - this.ppu.layers[this.l].x) & (this.ppu.width - 1);
    x *= this.zoom;
    var y = ((row << 4) - this.ppu.layers[this.l].y) & (this.ppu.height - 1);
    y *= this.zoom;
    var w = this.selection[3] << 4;
    w *= this.zoom;
    var h = this.selection[4] << 4;
    h *= this.zoom;
    var colors = ["green", "blue", "red", "white"];
    var c = colors[this.l];

    // draw the cursor around the selected trigger
    if (this.l === 3) {
        if (!this.selectedTrigger || this.triggers.indexOf(this.selectedTrigger) === -1) return;
        x = this.selectedTrigger.x.value * 16 * this.zoom;
        y = this.selectedTrigger.y.value * 16 * this.zoom;
        w = 16 * this.zoom;
        h = 16 * this.zoom;
        c = "rgba(128, 128, 128, 1.0)";
    }

    // draw the cursor
    w = Math.min(this.ppu.width * this.zoom - x, w);
    h = Math.min(this.ppu.height * this.zoom - y, h);
    if (w <= 0 || h <= 0) return;

    // set up the cursor canvas
    this.cursorCanvas.width = w;
    this.cursorCanvas.height = h;
    this.cursorCanvas.style.left = x.toString() + "px";
    this.cursorCanvas.style.top = y.toString() + "px";
    this.cursorCanvas.classList.remove('hidden');
    var ctx = this.cursorCanvas.getContext('2d');

    // convert the selection to screen coordinates
    ctx.lineWidth = 1;
    ctx.strokeStyle = "black";
    x = 0.5; y = 0.5; w--; h--;
    ctx.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    ctx.strokeStyle = c;
    ctx.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    ctx.strokeStyle = "white";
    ctx.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    ctx.strokeStyle = "black";
    ctx.strokeRect(x, y, w, h);
}

FF1Map.prototype.selectObject = function(object) {
    if (object.key === "worldMap") {
        this.isWorld = true;
        this.loadWorldMap();
    } else {
        this.isWorld = false;
        this.loadMap(object.i);
    }
}

FF1Map.prototype.show = function() {
    var map = this;

    this.resetControls();
    this.showControls();
    this.addTwoState("showBackground", function() { map.changeLayer("showBackground"); }, "Background", this.showBackground);
    this.addTwoState("showRooms", function() { map.changeLayer("showRooms"); }, "Rooms", this.showRooms);
    this.addTwoState("showTriggers", function() { map.changeLayer("showTriggers"); }, "Triggers", this.showTriggers);
    this.addTwoState("showScreen", function() { map.changeLayer("showScreen"); }, "Screen", this.showScreen);
    this.addZoom(this.zoom, function() { map.changeZoom(); });

    const editTop = document.getElementById("edit-top");
    if (!this.resizeSensor) {
        this.resizeSensor = new ResizeSensor(editTop, function() {
            map.scroll();
        });
    }
    this.tileset.show();
}

FF1Map.prototype.hide = function() {
    this.observer.stopObservingAll();
    if (this.resizeSensor) {
        this.resizeSensor.detach(document.getElementById("edit-top"));
        this.resizeSensor = null;
    }
    this.tileset.hide();
}

FF1Map.prototype.loadMap = function(m) {

    // set the map index
    if (!isNumber(m)) m = this.m;

    if (this.isWorld) {
        this.loadWorldMap();
        return;
    }

    this.m = m;
    this.isWorld = false;
    this.mapProperties = this.rom.mapProperties.item(this.m);
    this.observer.stopObservingAll();

    // get the tileset
    var t = this.mapProperties.tileset.value;
    var tileset = this.rom.mapTileset.item(t);
    var tilesetPalette = this.rom.tilesetPalette.item(t);

    // get the palette
    var paletteObject = this.rom.mapPalette.item(this.m);
    var palette = paletteObject.data.subarray(this.showRooms ? 32 : 0);

    // load graphics
    var gfx = this.rom.mapGraphics.item(t);

    this.observer.startObserving([
        this.mapProperties.tileset,
        tileset, tilesetPalette, paletteObject, gfx
    ], this.loadMap);

    // load the tile layout
    var layout = this.rom.mapLayout.item(this.m);
    this.layer[0].loadLayout({layout: layout, tileset: tileset.data, paletteAssignment: tilesetPalette.data, w: 64, h: 64});

    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = this.rom.gammaCorrectedPalette(palette);
    this.ppu.height = 64 * 16;
    this.ppu.width = 64 * 16;
    this.ppu.back = true;
    this.ppu.subtract = false;

    // layer 1
    this.ppu.layers[0].cols = this.layer[0].w * 2;
    this.ppu.layers[0].rows = this.layer[0].h * 2;
    this.ppu.layers[0].z[0] = GFX.Z.top;
    this.ppu.layers[0].gfx = gfx.data;
    this.ppu.layers[0].tiles = this.layer[0].tiles;
    this.ppu.layers[0].main = this.showBackground; // layer 1 always in main screen

    this.scrollDiv.style.width = (this.ppu.width * this.zoom).toString() + "px";
    this.scrollDiv.style.height = (this.ppu.height * this.zoom).toString() + "px";
    this.mapCanvas.width = this.ppu.width;
    this.mapCanvas.height = this.ppu.height;

    this.invalidateMap();
    this.selectedTrigger = null;
    this.loadTriggers();
    this.scroll();

    this.tileset.loadMap();
}

FF1Map.prototype.loadWorldMap = function() {

    this.isWorld = true;
    this.m = -1;

    if (this.selectedLayer && this.selectedLayer.type === "layer2") {
        this.selectLayer(0);
    }

    this.observer.stopObservingAll();
    this.mapProperties = null;
    propertyList.select(null);

    // load graphics and layout
    var size = 256;
    var gfx = this.rom.worldGraphics;
    var pal = this.rom.worldPalette;
    var paletteAssignment = this.rom.worldPaletteAssignment;
    var tileset = this.rom.worldTileset;
    var layout = [];
    for (var i = 0; i < size; i++) layout.push(rom.worldLayout.item(i));
    this.worldLayer.loadLayout({layout: layout, tileset: tileset.data, w: 256, h: size, paletteAssignment: paletteAssignment.data});

    this.observer.startObserving([
        gfx, pal, paletteAssignment, tileset
    ], this.loadWorldMap);

    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = this.rom.gammaCorrectedPalette(pal.data);
    this.ppu.width = size * 16;
    this.ppu.height = size * 16;
    this.ppu.back = true;

    // layer 1
    this.ppu.layers[0].cols = size * 2;
    this.ppu.layers[0].rows = size * 2;
    this.ppu.layers[0].z[0] = GFX.Z.top;
    this.ppu.layers[0].gfx = gfx.data;
    this.ppu.layers[0].tiles = this.worldLayer.tiles;
    this.ppu.layers[0].main = this.showBackground; // layer 1 always in main screen

    this.scrollDiv.style.width = (this.ppu.width * this.zoom).toString() + "px";
    this.scrollDiv.style.height = (this.ppu.height * this.zoom).toString() + "px";
    this.mapCanvas.width = this.ppu.width;
    this.mapCanvas.height = this.ppu.height;

    this.invalidateMap();
    this.selectedTrigger = null;
    this.loadTriggers();
    this.scroll();

    this.tileset.loadMap();
}

FF1Map.prototype.invalidateMap = function(rect) {
    if (!rect) {
        // invalidate all sectors
        var sectorCount = (this.ppu.width >> 8) * (this.ppu.height >> 8);
        this.mapSectors = new Array(sectorCount);
        this.dirtyRect = null;
    } else if (this.dirtyRect) {
        // combine dirty areas
        var left = Math.min(this.dirtyRect.l, rect.l);
        var top = Math.min(this.dirtyRect.t, rect.t);
        var right = Math.max(this.dirtyRect.r, rect.r);
        var bottom = Math.max(this.dirtyRect.b, rect.b);
        this.dirtyRect = new Rect(left, right, top, bottom);
    } else {
        // set a new dirty area
        this.dirtyRect = rect;
    }
}

FF1Map.prototype.drawMap = function() {

    // update the map canvas
    var mapContext = this.mapCanvas.getContext('2d');
    var imageData;

    // draw all visible sectors
    for (var s = 0; s < this.mapSectors.length; s++) {
        // continue if this sector is already drawn
        if (this.mapSectors[s]) continue;

        // continue if this sector is not visible
        var col = s % (this.ppu.width >> 8);
        var row = Math.floor(s / (this.ppu.width >> 8));
        var l = col << 8;
        var r = l + 256;
        var t = row << 8;
        var b = t + 256;
        var sectorRect = new Rect(l, r, t, b);
        if (this.mapRect.intersect(sectorRect.scale(this.zoom)).isEmpty()) continue;

        // draw the sector (256 x 256 pixels)
        imageData = mapContext.createImageData(256, 256);
        this.ppu.renderPPU(imageData.data, sectorRect.l, sectorRect.t, 256, 256);
        mapContext.putImageData(imageData, sectorRect.l, sectorRect.t);

        // validate the sector
        this.mapSectors[s] = true;
    }

    // redraw dirty portions of the map
    if (this.dirtyRect) {

        var rect = this.dirtyRect;
        this.dirtyRect = null;

        // render the image on the map canvas
        imageData = mapContext.createImageData(rect.w, rect.h);
        this.ppu.renderPPU(imageData.data, rect.l, rect.t, rect.w, rect.h);
        mapContext.putImageData(imageData, rect.l, rect.t);
    }

    var ctx = this.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'copy';
    var scaledRect = this.mapRect.scale(1 / this.zoom);
    ctx.drawImage(this.mapCanvas, scaledRect.l, scaledRect.t, scaledRect.w, scaledRect.h, 0, 0, this.mapRect.w, this.mapRect.h);

    this.drawTriggers();
    this.drawScreen();
    this.drawCursor();
}

FF1Map.prototype.reloadTriggers = function() {
    this.loadTriggers();
    this.drawMap();
}

FF1Map.prototype.loadTriggers = function() {

    this.triggers = [];
    if (this.isWorld) return;

    // load npcs
    var mapNPC = this.rom.mapNPC.item(this.m);

    for (var i = 0; i < mapNPC.arrayLength; i++) {
        var npc = mapNPC.item(i);
        if (npc.npcID.value === 0) continue;
        const id = npc.npcID.value;
        const npcProperties = this.rom.npcProperties.item(id);
        this.observer.startObserving([
            npc.x,
            npc.y,
            npc.npcID,
            npc.inRooms,
            npcProperties.graphics
        ], this.reloadTriggers);
        this.triggers.push(npc);
    }
}

FF1Map.prototype.insertNPC = function() {
    this.closeMenu();

    // get the npc properties
    if (this.isWorld) return;
    var npcProperties = this.rom.mapNPC.item(this.m);

    // find the first unused npc
    var npc;
    for (var n = 0; n < npcProperties.arrayLength; n++) {
        npc = npcProperties.item(n);
        if (npc.npcID.value == 0) break;
        npc = null;
    }
    if (!npc) return;

    this.beginAction(this.reloadTriggers);
    npc.x.setValue(this.clickedCol);
    npc.y.setValue(this.clickedRow);
    npc.npcID.setValue(1);
    this.endAction(this.reloadTriggers);

    this.selectedTrigger = npc;
    propertyList.select(npc);
}

FF1Map.prototype.deleteTrigger = function() {

    this.closeMenu();
    var trigger = this.selectedTrigger;
    if (!trigger) return;
    var triggers = trigger.parent;
    var index = triggers.array.indexOf(trigger);
    if (index === -1) return;

    this.beginAction(this.reloadTriggers);
    triggers.removeAssembly(index);
    this.endAction(this.reloadTriggers);

    this.selectedTrigger = null;
    propertyList.select(null);
}

FF1Map.prototype.drawTriggers = function() {

    var zoom = this.zoom;
    var xClient = this.mapRect.l;
    var yClient = this.mapRect.t;
    var ctx = this.canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';

    // function for drawing trigger rectangles with rounded corners
    function drawTriggerRect(x, y, fill) {

        var r = zoom * 2;
        var s = zoom * 16 - 4 + 1;
        x = x * zoom * 16 + 2 - 0.5 - xClient;
        y = y * zoom * 16 + 2 - 0.5 - yClient;

        ctx.lineWidth = 1;
        ctx.strokeStyle = "white";
        ctx.fillStyle = fill;

        ctx.beginPath();
        ctx.moveTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.lineTo(x + s - r, y);
        ctx.arcTo(x + s, y, x + s, y + r, r);
        ctx.lineTo(x + s, y + s - r);
        ctx.arcTo(x + s, y + s, x + s - r, y + s, r);
        ctx.lineTo(x + r, y + s);
        ctx.arcTo(x, y + s, x, y + s - r, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    if (!this.showTriggers) return;
    for (var i = 0; i < this.triggers.length; i++) {
        var trigger = this.triggers[i];
        var triggerRect = this.rectForTrigger(trigger);
        if (this.mapRect.intersect(triggerRect).isEmpty()) continue;
        var c = "rgba(128, 128, 128, 0.5)";
        drawTriggerRect(trigger.x.value, trigger.y.value, c);
        this.drawNPC(trigger);
    }
}

FF1Map.prototype.triggerAt = function(x, y) {

    var triggers = this.triggersAt(x, y);
    if (triggers.length === 0) return null;
    return triggers[0];
}

FF1Map.prototype.triggersAt = function (x, y) {
    var left, right, top, bottom;
    var zoom = this.zoom;
    var triggers = [];

    for (var i = 0; i < this.triggers.length; i++) {
        var trigger = this.triggers[i];
        left = trigger.x.value * 16 * zoom;
        right = left + 16 * zoom;
        top = trigger.y.value * 16 * zoom;
        bottom = top + 16 * zoom;

        if (x >= left && x < right && y >= top && y < bottom)
            triggers.push(trigger);
    }
    return triggers;
}

FF1Map.prototype.rectForTrigger = function(trigger) {
    var l = trigger.x.value * 16 * this.zoom;
    var r = l + 16 * this.zoom;
    var t = trigger.y.value * 16 * this.zoom;
    var b = t + 16 * this.zoom;

    return new Rect(l, r, t, b);
}

FF1Map.prototype.drawNPC = function(npc) {

    if (npc.inRooms.value && !this.showRooms) return;

    var x = npc.x.value * 16;
    var y = npc.y.value * 16;
    var w = 16;
    var h = 16;

    var index = npc.npcID.value;
    var g = this.rom.npcProperties.item(index).graphics.value;
    var gfx = this.rom.mapSpriteGraphics.item(g).data;
    var pal = this.rom.mapPalette.item(this.m).data.subarray(24);
    var tileData = new Uint32Array([0x00000000, 0x00000001, 0x00040002, 0x00040003]);

    var npcRect = new Rect(x, x + w, y - 3, y + h - 3);
    npcRect = npcRect.scale(this.zoom);
    if (this.mapRect.intersect(npcRect).isEmpty()) return;

    // set up the ppu
    var ppu = new GFX.PPU();
    ppu.pal = this.rom.gammaCorrectedPalette(pal);
    ppu.width = w;
    ppu.height = h;

    // layer 1
    ppu.layers[0].cols = 2;
    ppu.layers[0].rows = 2;
    ppu.layers[0].z[0] = GFX.Z.top;
    ppu.layers[0].gfx = gfx;
    ppu.layers[0].tiles = tileData;
    ppu.layers[0].main = true;

    // draw the npc
    this.npcCanvas.width = w;
    this.npcCanvas.height = h;
    var npcContext = this.npcCanvas.getContext('2d');
    var imageData = npcContext.createImageData(w, h);
    ppu.renderPPU(imageData.data);
    npcContext.putImageData(imageData, 0, 0);

    var ctx = this.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
    npcRect = npcRect.offset(-this.mapRect.l, -this.mapRect.t);
    ctx.drawImage(this.npcCanvas, 0, 0, w, h, npcRect.l, npcRect.t, npcRect.w, npcRect.h);

}

// FF1MapLayer
function FF1MapLayer(rom, type) {
    this.rom = rom;
    this.type = type;
    this.tileset = null;
}

FF1MapLayer.Type = {
    layer1: "layer1",
    world: "world"
}

FF1MapLayer.prototype.loadLayout = function(definition) {

    this.layout = definition.layout;
    this.tileset = definition.tileset;
    this.w = definition.w;
    this.h = definition.h;
    this.paletteAssignment = definition.paletteAssignment;

    // update tiles for the entire map
    this.tiles = new Uint32Array(this.w * this.h * 4);
    this.decodeLayout();
}

FF1MapLayer.prototype.setLayout = function(layout) {

    // layout 0 is always blank
    if (!this.layout.data && this.type !== "world") return;

    var x = layout[1];
    var y = layout[2];
    var w = layout[3];
    var h = layout[4];

    x = x % this.w;
    y = y % this.h;
    var clippedW = Math.min(w, this.w - x);
    var clippedH = Math.min(h, this.h - y);

    for (var row = 0; row < clippedH; row++) {
        var ls = 5 + row * w;
        var ld = x + (y + row) * this.w;
        if (this.type === "world") {
            if (y + row > 256) break;
            this.layout[y + row].setData(layout.slice(ls, ls + clippedW), x);
        } else {
            if (ld + clippedW > this.layout.data.length) break;
            this.layout.setData(layout.slice(ls, ls + clippedW), ld);
        }
    }
    this.decodeLayout(x, y, clippedW, clippedH);
}

FF1MapLayer.prototype.getLayout = function(col, row, cols, rows) {

    // limit the selection rectangle to the size of the layer
    var clippedCol = col % this.w;
    var clippedRow = row % this.h;
    cols = Math.min(cols, this.w - clippedCol);
    rows = Math.min(rows, this.h - clippedRow);

    // create the tile selection
    var layout = this.layout.data || this.layout;
    var selection = new Uint8Array(5 + cols * rows);
    selection.set([0x73, col, row, cols, rows]);
    for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
            if (this.type === "world") {
                selection[5 + x + y * cols] = layout[y + clippedRow].data[x + clippedCol];
            } else {
                selection[5 + x + y * cols] = layout[x + clippedCol + (y + clippedRow) * this.w];
            }
        }
    }
    return selection;
}

FF1MapLayer.prototype.decodeLayout = function(x, y, w, h) {

    x = x || 0;
    y = y || 0;
    x %= this.w;
    y %= this.h;
    w = w || this.w;
    h = h || this.h;
    w = Math.min(w, this.w - x);
    h = Math.min(h, this.h - y);

    switch (this.type) {
        case FF1MapLayer.Type.layer1:
            this.decodeMapLayout(x, y, w, h);
            break;
        case FF1MapLayer.Type.world:
            this.decodeWorldLayout(x, y, w, h);
            break;
        default:
            break;
    }
}

FF1MapLayer.prototype.decodeMapLayout = function(x, y, w, h) {

    var layout = this.layout.data || this.layout;
    var l = x + y * this.w;
    var t = x * 2 + y * this.w * 4;
    var row, col, tile, i, pal;

    for (row = 0; row < h; row++) {
        for (col = 0; col < w; col++) {
            i = t + col * 2;
            if (i > this.tiles.length) return;
            tile = layout[l + col];
            tile = ((tile & 0x70) << 2) | ((tile & 0x0F) << 1);
            pal = this.paletteAssignment[tile] << 18;
            this.tiles[i + 0] = this.tileset[tile + 0] | pal;
            this.tiles[i + 1] = this.tileset[tile + 1] | pal;
            i += this.w * 2;
            this.tiles[i + 0] = this.tileset[tile + 32] | pal;
            this.tiles[i + 1] = this.tileset[tile + 33] | pal;
        }
        t += this.w * 4;
        l += this.w;
    }
}

FF1MapLayer.prototype.decodeWorldLayout = function(x, y, w, h) {

    var layout = this.layout;
    if (layout[0] instanceof ROMAssembly) {
        layout = new Uint8Array(0x10000);
        for (var i = 0; i < this.h; i++) {
            layout.set(this.layout[i].data, i * this.w);
        }
    }
    var l = x + y * this.w;
    var t = x * 2 + y * this.w * 4;
    var row, col, tile, pal;

    for (row = 0; row < h; row++) {
        for (col = 0; col < w; col++) {
            tile = layout[l + col];
            tile = ((tile & 0x70) << 2) | ((tile & 0x0F) << 1);
            if (tile >= 512) tile = 0;
            i = t + col * 2;
            if (i > this.tiles.length) return;
            pal = this.paletteAssignment[tile] << 18;
            this.tiles[i + 0] = this.tileset[tile + 0] | pal;
            this.tiles[i + 1] = this.tileset[tile + 1] | pal;
            i += this.w * 2;
            this.tiles[i + 0] = this.tileset[tile + 32] | pal;
            this.tiles[i + 1] = this.tileset[tile + 33] | pal;
        }
        t += this.w * 4;
        l += this.w;
    }
}

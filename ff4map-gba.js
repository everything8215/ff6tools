//
// ff4map-gba.js
// created 3/21/2020
//

function FF4MapGBA(rom) {
    ROMEditor.call(this, rom);
    this.name = "FF4MapGBA";
    this.tileset = new FF4MapGBATileset(rom, this);
    
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
    this.layer = [new FF4MapGBALayer(rom, FF4MapGBALayer.Type.layer1),
                  new FF4MapGBALayer(rom, FF4MapGBALayer.Type.layer2),
                  new FF4MapGBALayer(rom, FF4MapGBALayer.Type.mask)];
    this.selectedLayer = this.layer[0];
    this.mask = 0;
    this.triggers = [];
    this.showCursor = false;
    this.showLayer1 = true;
    this.showLayer2 = true;
    this.showTriggers = true;
    this.showScreen = false;
    this.selectedTrigger = null;
    this.isWorld = false;
    this.observer = new ROMObserver(rom, this, {sub: true, link: true, array: true});
    this.ppu = new GFX.PPU();

    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.id = "map-screen";
    this.screenCanvas.width = 256;
    this.screenCanvas.width = 256;
    this.scrollDiv.appendChild(this.screenCanvas);

    var map = this;
    this.div.onscroll = function() { map.scroll() };
//    window.addEventListener("resize", map.scroll, false);
    this.scrollDiv.onmousedown = function(e) { map.mouseDown(e) };
    this.scrollDiv.onmouseup = function(e) { map.mouseUp(e) };
    this.scrollDiv.onmousemove = function(e) { map.mouseMove(e) };
    this.scrollDiv.onmouseenter = function(e) { map.mouseEnter(e) };
    this.scrollDiv.onmouseleave = function(e) { map.mouseLeave(e) };
    this.scrollDiv.oncontextmenu = function(e) { map.openMenu(e); return false; };
    
    this.rom.mapTriggers;
    this.rom.mapExit;
    this.rom.worldGraphics1;
    this.rom.worldGraphics2;
    this.rom.worldPalette;
    this.rom.worldTileset;
    this.rom.worldTileset2;
    this.rom.worldLayout;
    this.rom.worldLayout2;
    
    this.initMapGraphicsData();
}

FF4MapGBA.prototype = Object.create(ROMEditor.prototype);
FF4MapGBA.prototype.constructor = FF4MapGBA;

FF4MapGBA.prototype.initMapGraphicsData = function() {
    
    // initialize all map graphics data with the proper encoding format
    var mapGraphicsData = this.rom.mapGraphicsData;
    var mapGraphicsDataStringTable = this.rom.stringTable.mapGraphicsData;
    
    // map layouts and tile properties
    for (var m = 3; m < this.rom.mapProperties.arrayLength; m++) {
        if (m === 350) continue; // skip overworld from cid's trial
        var mapProperties = this.rom.mapProperties.item(m);
        
        var mapLayoutStringTable = this.rom.stringTable["mapProperties.layout"];
        var l = mapProperties.layout.value;
        var layout = mapGraphicsData.item(l);
        mapLayoutStringTable.setString(l, "Map Layout " + l);
        layout.format = "tose-70";
        layout.disassemble(this.rom.data);
        mapGraphicsDataStringTable.string[l].value += " (Map Layout)";

        var tp = mapProperties.tileProperties.tp.value;
        if (tp === 0) {
            // for map 52, set tile properties to 0xFFFF
            mapProperties.tileProperties.data = new Uint8Array([0xFF, 0xFF]);
        }
        var tilePropertiesStringTable = this.rom.stringTable["mapProperties.tileProperties.tp"];
        if (mapProperties.tileProperties.getSpecialValue() !== 0xFFFF) {
            var tileProperties = mapGraphicsData.item(tp);
            tilePropertiesStringTable.setString(tp, "Tile Properties " + tp);
            tileProperties.format = "tose-70";
            tileProperties.disassemble(this.rom.data);
            mapGraphicsDataStringTable.string[tp].value += " (Tile Properties)";
        }
    }
    
    // tileset palettes, graphics, and layouts
    for (var t = 0; t < this.rom.mapTileset.arrayLength; t++) {
        var mapTileset = this.rom.mapTileset.item(t);
        
        var p = mapTileset.palette.value;
        var mapPaletteStringTable = this.rom.stringTable["mapTileset.palette"];
        var palette = mapGraphicsData.item(p);
        mapPaletteStringTable.setString(p, "Map Palette " + p);
        palette.format = "bgr555";
        palette.disassemble(this.rom.data);
        mapGraphicsDataStringTable.string[p].value += " (Palette)";
        
        var g = mapTileset.graphics.value;
        var mapGraphicsStringTable = this.rom.stringTable["mapTileset.graphics"];
        var graphics = mapGraphicsData.item(g);
        mapGraphicsStringTable.setString(g, "Map Graphics " + g);
        graphics.format = ["linear4bpp", "tose-70"];
        graphics.disassemble(this.rom.data);
        mapGraphicsDataStringTable.string[g].value += " (Map Graphics)";
        
        var mapTileLayoutStringTable = this.rom.stringTable["mapTileset.layout"];
        var tl = mapTileset.layout.value;
        var tileLayout = mapGraphicsData.item(tl);
        mapTileLayoutStringTable.setString(tl, "Map Tileset Layout " + tl);
        tileLayout.disassemble(this.rom.data);
        mapGraphicsDataStringTable.string[tl].value += " (Tile Layout)";
    }
}

FF4MapGBA.prototype.beginAction = function(callback) {
    this.rom.beginAction();
    this.rom.doAction(new ROMAction(this.observer, this.observer.wake, this.observer.sleep));
    if (callback) this.rom.doAction(new ROMAction(this, callback, null));
}

FF4MapGBA.prototype.endAction = function(callback) {
    if (callback) this.rom.doAction(new ROMAction(this, null, callback));
    this.rom.doAction(new ROMAction(this.observer, this.observer.sleep, this.observer.wake));
    this.rom.endAction();
}

FF4MapGBA.prototype.changeZoom = function() {
    
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

FF4MapGBA.prototype.scroll = function() {
    
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

FF4MapGBA.prototype.mouseDown = function(e) {

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
        if (this.rom.isGBA && this.selectedTrigger) {
            if (this.selectedTrigger.key === "treasureProperties") this.isDragging = false;
            if (this.selectedTrigger.key === "entranceTriggers") this.isDragging = false;
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

FF4MapGBA.prototype.mouseUp = function(e) {

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

FF4MapGBA.prototype.mouseMove = function(e) {
    
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

FF4MapGBA.prototype.mouseEnter = function(e) {
    
    // show the cursor
    this.showCursor = true;
    this.drawScreen();
    this.drawCursor();

    this.mouseUp(e);
}

FF4MapGBA.prototype.mouseLeave = function(e) {
    
    // hide the cursor
    this.showCursor = (this.l === 3);
    this.drawCursor();
    
    this.mouseUp(e);
}

FF4MapGBA.prototype.updateMenu = function() {
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
    
    appendMenuItem("Insert Entrance Trigger", function() {self.insertTrigger()});
    appendMenuItem("Insert Event Trigger", function() {self.insertTrigger('eventTriggers')});
    appendMenuItem("Insert Treasure", this.isWorld ? null : function() {self.insertTrigger('treasureProperties')});
    appendMenuItem("Insert NPC", this.isWorld ? null : function() {self.insertNPC()});
    appendMenuItem("Delete Trigger", !this.selectedTrigger ? null : function() {self.deleteTrigger()});
}

FF4MapGBA.prototype.openMenu = function(e) {
    if (this.rom.isGBA) return;
    if (this.l !== 3) return; // no menu unless editing triggers
    this.updateMenu();
    
    this.clickedCol = ((e.offsetX / this.zoom + this.ppu.layers[this.l].x) % this.ppu.width) >> 4;
    this.clickedRow = ((e.offsetY / this.zoom + this.ppu.layers[this.l].y) % this.ppu.height) >> 4;

    this.menu.classList.add("menu-active");
    this.menu.style.left = e.x + "px";
    this.menu.style.top = e.y + "px";
}

FF4MapGBA.prototype.closeMenu = function() {
    this.menu.classList.remove("menu-active");
}

FF4MapGBA.prototype.setTiles = function() {
    // return if not dragging
    if (!isNumber(this.clickedCol) || !isNumber(this.clickedRow)) return;

    var col = this.selection[1];
    var row = this.selection[2];
    var cols = this.selection[3];
    var rows = this.selection[4];
    
    var l = (col << 4) - this.ppu.layers[this.l].x;
    var r = l + (cols << 4);
    var t = (row << 4) - this.ppu.layers[this.l].y;
    var b = t + (rows << 4);
    var rect = new Rect(l, r, t, b);

    function invalidate() { this.invalidateMap(rect); }
    this.selectedLayer.setLayout(this.selection);
    this.rom.doAction(new ROMAction(this, invalidate, invalidate, "Invalidate Map"));
    this.drawMap();
}

FF4MapGBA.prototype.selectTrigger = function(trigger) {
    this.selectedTrigger = trigger;
    propertyList.select(trigger);
    if (!trigger) return;
    this.clickedCol = this.selectedTrigger.x.value;
    this.clickedRow = this.selectedTrigger.y.value;

    if (this.selectedTrigger.key === "npcProperties") {
        var script = this.rom.npcScript.item(trigger.switch.value);
        propertyList.select(script);
    } else if (this.selectedTrigger instanceof ROMCommand) {
        var script = this.selectedTrigger.parent;
        propertyList.select(script);
        scriptList.selectCommand(this.selectedTrigger);
    } else if (this.selectedTrigger.object) {
        trigger = this.selectedTrigger.object;
    }
    propertyList.select(trigger);
}

FF4MapGBA.prototype.selectTiles = function() {
    // return if not dragging
    if (!isNumber(this.clickedCol) || !isNumber(this.clickedRow)) return;
    
    var col = this.selection[1];
    var row = this.selection[2];
    var cols = Math.abs(col - this.clickedCol) + 1;
    var rows = Math.abs(row - this.clickedRow) + 1;
    col = Math.min(col, this.clickedCol);
    row = Math.min(row, this.clickedRow);

    this.selection = this.selectedLayer.getLayout(col, row, cols, rows);
//    this.selection[2] |= this.l << 6;
    
    if (rows !== 1 || cols !== 1) {
        this.tileset.selection = null;
    } else {
        // select a single tile in the tileset view
        var tile = this.selection[5];
        this.tileset.selection = new Uint8Array([0x73, tile & 0x0F, tile >> 4, 1, 1, tile]);
        this.selectTileProperties(col, row);
    }
    this.tileset.drawCursor();
}

FF4MapGBA.prototype.selectTileProperties = function(x, y) {
    
    var tileProperties = this.tilePropertiesAtTile(x, y);
    
    if (this.isWorld) {
        propertyList.select(tileProperties);
    } else if (tileProperties & 0x40) {
        propertyList.select(this.mapProperties.exitPointer.value.item(tileProperties & 0x0F));
    } else if (tileProperties & 0x4000) {
        propertyList.select(this.mapProperties.exitPointer.value.item((tileProperties >> 8) & 0x0F));
    }
    
//    rom.log("(" + x + "," + y + "): " + hexString(tileProperties, 4, "0x"));
}

FF4MapGBA.prototype.tilePropertiesAtTile = function(x, y) {
    var tileProperties;
    
    var tp, tile, layout;
    var w = this.layer[0].w;
    var h = this.layer[0].h;
    var t = x + y * w;
    if (this.isWorld && this.w === 2) {
        // moon tile properties
        layout = this.rom.moonTileProperties;
        return layout.data[t] | (layout.data[t + w * h] << 8);
        
    } else if (this.isWorld) {
        // world tile properties
        if (this.w === 1) {
            tp = this.rom.worldTileProperties.item(1);
        } else {
            tp = this.rom.worldTileProperties.item(0);
        }
        tile = this.layer[0].layout.data[t] || this.layer[1].layout.data[t]
        return tp.item(tile);

    } else if (this.layer[2].layout instanceof ROMAssembly) {
        // normal map tile properties
        layout = this.layer[2].layout;
        return layout.data[t] | (layout.data[t + w * h] << 8);
    }
    return 0;
}

FF4MapGBA.prototype.selectLayer = function(l) {
    // set the selected layer
    l = Number(l);
    if (isNumber(l)) this.l = l;
    
    this.selectedLayer = this.layer[this.l]
    
    this.showCursor = (this.l === 3);
    this.drawScreen();
    this.drawCursor();
}

FF4MapGBA.prototype.selectWorldBattle = function(x, y) {
    
    if (this.rom.isGBA) return;
    
    x >>= 5;
    y >>= 5;

    var sector;
    if (this.m === 251) {
        // overworld
        x &= 7;
        y &= 7;
        sector = x + (y << 3);
    } else if (this.m === 252) {
        // underground
        offset = 64;
        x &= 3;
        y &= 3;
        sector = x + (y << 2) + 64;
    } else if (this.m === 253) {
        // moon
        offset = 80;
        x &= 1;
        y &= 1;
        sector = x + (y << 1) + 80;
    }
    
    var battleGroup = this.rom.worldBattle.item(sector);
    propertyList.select(battleGroup);
}

FF4MapGBA.prototype.changeLayer = function(id) {
    this[id] = document.getElementById(id).checked;
    var map = this.rom.mapProperties.item(this.m);
    this.ppu.layers[0].main = this.showLayer1;
    if (!this.isWorld && this.rom.isSFC) {
        this.ppu.layers[0].sub = this.showLayer1 && this.mapProperties.addition.value;
        this.ppu.layers[1].main = this.showLayer2;
    } else if (this.rom.isGBA && this.ppu.layers[1].tiles) {
        this.ppu.layers[1].main = this.showLayer2;
    }
    this.invalidateMap();
    this.drawMap();
}

FF4MapGBA.prototype.drawScreen = function() {

    this.screenCanvas.style.display = "none";
    if (!this.showScreen) return;

    // calculate the screen rect
    var x = (this.selection[1] * 16) - this.ppu.layers[this.l].x;
    var y = (this.selection[2] * 16) - this.ppu.layers[this.l].y;
    var screenRect;
    screenRect = new Rect(x - 7 * 16 + 1, x + 9 * 16 - 1, y - 7 * 16 + 1, y + 7 * 16 + 1);

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

FF4MapGBA.prototype.drawMask = function() {

    if (this.mask === 0) return;

    // calculate coordinates on the map rect
    var xStart = (this.mapRect.l / this.zoom) >> 4;
    var xEnd = (this.mapRect.r / this.zoom) >> 4;
    var yStart = (this.mapRect.t / this.zoom) >> 4;
    var yEnd = (this.mapRect.b / this.zoom) >> 4;
    var xOffset = (this.mapRect.l / this.zoom) % 16;
    var yOffset = (this.mapRect.t / this.zoom) % 16;
    
    var ctx = this.canvas.getContext('2d');

    // draw the mask at each tile
    for (var y = yStart; y <= yEnd; y++) {
        for (var x = xStart; x <= xEnd; x++) {
            var tp = this.tilePropertiesAtTile(x, y);
            if (this.mask === 1) tp &= 0xFF;
            if (this.mask === 2) tp >>= 8;
            
            if (tp === 0) {
                continue;
            } else if (tp === 1) {
                ctx.fillStyle = 'rgba(0, 0, 255, 0.5)'; // impassable
            } else if (tp === 2) {
                ctx.fillStyle = 'rgba(0, 255, 255, 0.5)'; // transition 1 -> 2
            } else if (tp === 3) {
                ctx.fillStyle = 'rgba(0, 255, 255, 0.5)'; // transition 2 -> 1
            } else if (tp === 4) {
                ctx.fillStyle = 'rgba(0, 255, 0, 0.5)'; // entire sprite hidden
            } else if (tp === 5) {
                ctx.fillStyle = 'rgba(255, 0, 255, 0.5)'; // bridge
            } else if (tp === 6) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; // damage tile
            } else if (tp & 0x10) {
                continue; // bottom of sprite transparent
            } else if (tp & 0x20) {
                ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'; // treasure
            } else if (tp & 0x40) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; // exit
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            }
            
            var left = (((x - xStart) << 4) - xOffset) * this.zoom;
            var top = (((y - yStart) << 4) - yOffset) * this.zoom;
            var size = 16 * this.zoom;
            
            ctx.fillRect(left, top, size, size);
        }
    }
}

FF4MapGBA.prototype.drawCursor = function() {
    
    this.cursorCanvas.style.display = "none";
    if (!this.showCursor) return;
    
    var col = this.selection[1];
    var row = this.selection[2];

    // get the cursor geometry and color
    var x = (col << 4) - this.ppu.layers[this.l].x;
    x *= this.zoom;
    var y = (row << 4) - this.ppu.layers[this.l].y;
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

        if (this.selectedTrigger.width) w *= this.selectedTrigger.width.value;
        if (this.selectedTrigger.height) h *= this.selectedTrigger.height.value;

        switch (this.selectedTrigger.key) {
            case "jumpPosition":
            case "jumpPositionShort":
            case "selectDeleteTrigger":
            case "createObject":
                c = "rgba(0, 0, 255, 1.0)";
                break;
            case "worldTriggers":
            case "entranceTriggers":
                c = "rgba(255, 0, 0, 1.0)";
                break;
            case "treasureProperties":
                c = "rgba(255, 255, 0, 1.0)";
                break;
            case "mapTriggers":
                c = "rgba(128, 128, 128, 1.0)";
                break;
        }
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
    this.cursorCanvas.style.display = "block";
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

FF4MapGBA.prototype.selectObject = function(object) {
    this.show();
    this.tileset.show();
    this.loadMap(object.i);
}

FF4MapGBA.prototype.show = function() {

    var map = this;

    this.resetControls();
    this.showControls();
    this.addTwoState("showLayer1", function() { map.changeLayer("showLayer1"); }, "Layer 1", this.showLayer1);
    this.addTwoState("showLayer2", function() { map.changeLayer("showLayer2"); }, "Layer 2", this.showLayer2);
    this.addTwoState("showTriggers", function() { map.changeLayer("showTriggers"); }, "Triggers", this.showTriggers);
    
    var onChangeMask = function(mask) {
        map.mask = mask;
        map.drawMap();
        if (map.l === 2) {
            map.selection[0] = (mask !== 2) ? 0x73 : 0x74;
        }
    }
    var maskSelected = function(mask) { return map.mask === mask; }
    this.addList("showMask", "Mask", ["None", "Z-Level 1", "Z-Level 2"], onChangeMask, maskSelected);

    this.addTwoState("showScreen", function() { map.changeLayer("showScreen"); }, "Screen", this.showScreen);
    
    this.addZoom(this.zoom, function() { map.changeZoom(); });
}

FF4MapGBA.prototype.hide = function() {
    this.observer.stopObservingAll();
}

FF4MapGBA.prototype.loadMap = function(m) {
    
    var layerButtons = document.getElementsByClassName("toolbox-button");
    layerButtons[1].disabled = false;
    layerButtons[2].disabled = false;

    // set the map index
    m = Number(m);
    
    if (isNumber(m) && this.m !== m) {
        // map changed
        this.m = m;
        this.observer.stopObservingAll();
        this.isWorld = false;
        this.mapProperties = this.rom.mapProperties.item(this.m);
        this.observer.startObserving(this.mapProperties, this.loadMap);
    }

    if (this.m < 3 || this.m === 0x015E) {
        this.isWorld = true;
        this.loadWorldMap(this.m);
        return;
    }

    // get map properties
    var map = this.mapProperties;
    if (!map) return;

    var mapTileset = this.rom.mapTileset.item(this.mapProperties.tileset.value);
    if (!mapTileset) return;

    // set the map background
//    var battleEditor = propertyList.getEditor("FF4Battle");
//    battleEditor.bg = map.battleBackground.value;
//    battleEditor.altPalette = map.battleBackgroundPalette.value;

    // load graphics
    var gfx = new Uint32Array(0x100000);
    var graphicsData = this.rom.mapGraphicsData.item(mapTileset.graphics.value);
    gfx.set(graphicsData.data, 0);
    gfx.set(graphicsData.data, 0x8000);

    // load palette
    var pal = new Uint32Array(512);
    var paletteData = this.rom.mapGraphicsData.item(mapTileset.palette.value);
    pal.set(paletteData.data, 16);
    pal[0] = 0xFF000000; // set background color to black

    var layout, tileset, w, h;
    var tileset = this.rom.mapGraphicsData.item(mapTileset.layout.value);

    // load and de-interlace tile layouts
    layout = this.rom.mapGraphicsData.item(map.layout.value);
    w = layout.data[0] | (layout.data[1] << 8);
    h = layout.data[2] | (layout.data[3] << 8);
    
    // load first layer
    this.layer[0].loadLayout({type: FF4MapGBALayer.Type.layer1, layout: layout, tileset: tileset.data, w: w, h: h});

    // load second layer
    if (layout.data && layout.data.length < (4 + w * h * 2)) {
        // no second layer
        layout = new Uint8Array(w * h);
    }
    this.layer[1].loadLayout({type: FF4MapGBALayer.Type.layer2, layout: layout, tileset: tileset.data, w: w, h: h});
    
    // load mask layer
    var tp = map.tileProperties;
    if (tp.getSpecialValue() !== 0xFFFF) {
        layout = this.rom.mapGraphicsData.item(tp.tp.value);
    } else {
        layout = new Uint8Array(w * h);
    }
    this.layer[2].loadLayout({type: FF4MapGBALayer.Type.mask, layout: layout, w: w, h: h});

    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = pal;
    this.ppu.width = w * 16;
    this.ppu.height = h * 16;
    this.ppu.back = true;
    this.ppu.subtract = false;

    // layer 1
    this.ppu.layers[0].format = GFX.TileFormat.gba4bppTile;
    this.ppu.layers[0].cols = w * 2;
    this.ppu.layers[0].rows = h * 2;
    this.ppu.layers[0].z[0] = GFX.Z.snes2L;
    this.ppu.layers[0].z[1] = GFX.Z.snes2H;
    this.ppu.layers[0].gfx = gfx;
    this.ppu.layers[0].tiles = this.layer[0].tiles;
    this.ppu.layers[0].main = this.showLayer1; // layer 1 always in main screen

    // layer 2
    this.ppu.layers[1].format = GFX.TileFormat.gba4bppTile;
    this.ppu.layers[1].cols = w * 2;
    this.ppu.layers[1].rows = h * 2;
    this.ppu.layers[1].z[0] = GFX.Z.snes1L;
    this.ppu.layers[1].z[1] = GFX.Z.snes1H;
    this.ppu.layers[1].gfx = gfx;
    this.ppu.layers[1].tiles = this.layer[1].tiles;
    this.ppu.layers[1].main = this.showLayer2;

    this.scrollDiv.style.width = (this.ppu.width * this.zoom).toString() + "px";
    this.scrollDiv.style.height = (this.ppu.height * this.zoom).toString() + "px";
    this.mapCanvas.width = w * 16;
    this.mapCanvas.height = h * 16;

    this.invalidateMap();
    this.selectedTrigger = null;
    this.loadTriggers();
    this.scroll();
    
    this.tileset.loadMap(this.m);
}

FF4MapGBA.prototype.loadWorldMap = function(m) {
    
    this.w = m;
    if (m === 0x015E) this.w = 3; // overworld map for cid's trial
    
    var layerButtons = document.getElementsByClassName("toolbox-button");
    layerButtons[1].disabled = false;
    layerButtons[2].disabled = false;

    this.observer.stopObservingAll();
    this.mapProperties = this.rom.worldProperties.item(this.w);
    this.observer.startObserving(this.mapProperties, this.loadMap);
    propertyList.select(this.mapProperties);
    
    var width = this.mapProperties.width.value >> 4;
    var height = this.mapProperties.height.value >> 4;

    // load graphics
    var gfx = new Uint8Array(0x10000);
    var graphics1 = this.mapProperties.graphics1.value;
    if (graphics1) gfx.set(graphics1.data.subarray(8));
    var graphics2 = this.mapProperties.graphics2.value;
    if (graphics2) gfx.set(graphics2.data.subarray(8), 0x4000);
    
    // load palette
    var pal = new Uint32Array(0x200);
    var palette = this.mapProperties.palette.value;
    if (palette) pal.set(palette.data.subarray(4));
    pal[0] = 0xFF000000;

    // load tileset
    var tileset1 = this.mapProperties.tileset1.value.data;
    var layout1 = this.mapProperties.layout1.value
    if (layout1 && tileset1) {
        if (layout1.range.length !== width * height) {
            layout1.range.length = width * height;
            layout1.disassemble(this.rom.data);
        }
        this.layer[0].loadLayout({type: FF4MapGBALayer.Type.world, layout: layout1, tileset: tileset1, w: width, h: height});
    }

    var tileset2 = this.mapProperties.tileset2.value;
    if (tileset2) tileset2 = tileset2.data;
    var layout2 = this.mapProperties.layout2.value
    if (tileset2 && layout2) {
        if (layout2.range.length !== width * height) {
            layout2.range.length = width * height;
            layout2.disassemble(this.rom.data);
        }
        this.layer[1].loadLayout({type: FF4MapGBALayer.Type.world, layout: layout2, tileset: tileset2, w: width, h: height});
    }
    
    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = pal;
    this.ppu.width = width * 16;
    this.ppu.height = height * 16;
    this.ppu.back = true;

    // layer 1
    this.ppu.layers[0].format = GFX.TileFormat.gba8bppTile;
    this.ppu.layers[0].cols = width * 2;
    this.ppu.layers[0].rows = height * 2;
    this.ppu.layers[0].z[0] = GFX.Z.snes1L;
    this.ppu.layers[0].z[1] = GFX.Z.snes1H;
    this.ppu.layers[0].gfx = gfx.subarray(0x0000);
    this.ppu.layers[0].tiles = this.layer[0].tiles;
    this.ppu.layers[0].main = this.showLayer1 && layout1 && tileset1; // layer 1 always in main screen

    this.ppu.layers[1].format = GFX.TileFormat.gba8bppTile;
    this.ppu.layers[1].cols = width * 2;
    this.ppu.layers[1].rows = height * 2;
    this.ppu.layers[1].z[0] = GFX.Z.snes2L;
    this.ppu.layers[1].z[1] = GFX.Z.snes2H;
    this.ppu.layers[1].gfx = gfx.subarray(0x4000);
    this.ppu.layers[1].tiles = this.layer[1].tiles;
    this.ppu.layers[1].main = this.showLayer2 && layout2 && tileset2;
    
    this.scrollDiv.style.width = (this.ppu.width * this.zoom).toString() + "px";
    this.scrollDiv.style.height = (this.ppu.height * this.zoom).toString() + "px";
    this.mapCanvas.width = this.ppu.width;
    this.mapCanvas.height = this.ppu.height;
    
    this.invalidateMap();
    this.selectedTrigger = null;
    this.triggers = [];
    this.loadTriggers();
    this.scroll();

    this.tileset.loadMap(m);
}

FF4MapGBA.prototype.invalidateMap = function(rect) {
    if (!rect) {
        // invalidate all sectors
        var sectorCount = Math.ceil(this.ppu.width / 256) * Math.ceil(this.ppu.height / 256);
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

FF4MapGBA.prototype.drawMap = function() {
        
    // update the map canvas
    var mapContext = this.mapCanvas.getContext('2d');
    var imageData;

    // draw all visible sectors
    for (var s = 0; s < this.mapSectors.length; s++) {
        // continue if this sector is already drawn
        if (this.mapSectors[s]) continue;
        
        // continue if this sector is not visible
        var col = s % Math.ceil(this.ppu.width / 256);
        var row = Math.floor(s / Math.ceil(this.ppu.width / 256));
        var l = col << 8;
        var r = l + 256;
        var t = row << 8;
        var b = t + 256;
        var sectorRect = new Rect(l, r, t, b);
//        sectorRect = this.mapRect.scale(1 / this.zoom).intersect(sectorRect);
//        if (sectorRect.isEmpty()) continue;
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
    var scaledRect = this.mapRect.scale(1 / this.zoom);
    ctx.drawImage(this.mapCanvas, scaledRect.l, scaledRect.t, scaledRect.w, scaledRect.h, 0, 0, this.mapRect.w, this.mapRect.h);
    
    this.drawMask();
    this.drawTriggers();
    this.drawScreen();
    this.drawCursor();
}

FF4MapGBA.prototype.reloadTriggers = function() {
    this.loadTriggers();
    this.drawMap();
}

FF4MapGBA.prototype.loadTriggers = function() {
    this.triggers = [];
    this.loadedEvents = [];

    if (this.isWorld) {
        (this.m !== 2) ? this.loadWorldTriggers() : this.loadMoonTriggers();
        return;
    }

    var i;
    // load triggers
    var triggers = this.rom.mapTriggerPointers.item(this.mapProperties.events.value).triggerPointer.value;
    this.observer.startObserving(triggers, this.reloadTriggers);
    for (i = 0; i < triggers.arrayLength; i++) {
        var trigger = triggers.item(i);
        if (trigger.triggerType.value === 0) {
            // map event
            this.loadEvent(trigger);
            this.fixEvent(trigger);
            
            var e = trigger.event2.value;
            if (e === -1) e = trigger.event.value; // no script pointer
            if (e === -1) continue; // no event
            
//            scriptList.selectScript(this.rom.eventScript.item(e));
            
        } else {
            // npc
            this.fixNPC(trigger);
            this.triggers.push(trigger);
        }
    }
    
    // load tile properties triggers
    var treasures = this.rom.mapTriggerPointers.item(this.mapProperties.treasures.value).triggerPointer.value;
    var exits = this.mapProperties.exitPointer.value;
    for (var y = 0; y < this.layer[0].h; y++) {
        for (var x = 0; x < this.layer[0].w; x++) {
            var tp = this.tilePropertiesAtTile(x, y);
            var object = null;
            var key;
            if (tp & 0x0040) {
                // exit (upper z-level)
                if (!exits) continue;
                object = exits.item(tp & 0x0F);
                if (!object) continue;
                key = "entranceTriggers";
            } else if (tp & 0x4000) {
                // exit (lower z-level)
                if (!exits) continue;
                object = exits.item((tp & 0x0F00) >> 8);
                if (!object) continue;
                key = "entranceTriggers";
            } else if (tp & 0x0020) {
                // treasure (upper z-level)
                if (!treasures) continue;
                object = treasures.item(tp & 0x0F);
                if (!object) continue;
                this.fixTreasure(object);
                key = "treasureProperties";
            } else if (tp & 0x2000) {
                // treasure (lower z-level)
                if (!treasures) continue;
                object = treasures.item((tp & 0x0F00) >> 8);
                if (!object) continue;
                this.fixTreasure(object);
                key = "treasureProperties";
            } else {
                continue;
            }
            this.triggers.push({
                key: key,
                x: {value: x},
                y: {value: y},
                object: object
            });
        }
    }
}

FF4MapGBA.prototype.loadWorldTriggers = function() {

//    // load world map events
//    var event = this.rom.eventScript.item(66);
//    if (!event) return;
//
//    for (var c = 0; c < event.command.length; c++) {
//        var command = event.command[c];
//        if (command.key === "createObject") {
//            this.observer.startObserving(command, this.reloadTriggers);
//            this.triggers.push(command);
//        } else if (command.key === "jumpPosition") {
//            this.observer.startObserving(command, this.reloadTriggers);
//            this.triggers.push(command);
//        }
//
//        if (command.scriptPointer && command.event2) {
//            // load nested events
//            this.loadEvent(command);
//        }
//    }

    // load triggers
    var worldTriggersIndex = 0;
    if (this.w === 1) worldTriggersIndex = 1;
    if (this.w === 3) worldTriggersIndex = 2;
    var triggers = this.rom.worldTriggers;
    this.observer.startObserving(triggers, this.reloadTriggers);
    
    var currentIndex = 0;
    for (var i = 0; i < triggers.arrayLength; i++) {
        var trigger = triggers.item(i);
        if (trigger.data[0] === 0) {
            currentIndex++;
            continue;
        }
        if (worldTriggersIndex !== currentIndex) continue;
        this.triggers.push(trigger);
    }
}

FF4MapGBA.prototype.loadMoonTriggers = function() {

    // load tile properties triggers
    var exits = this.rom.worldExit;
    for (var y = 0; y < this.layer[0].h; y++) {
        for (var x = 0; x < this.layer[0].w; x++) {
            var tp = this.tilePropertiesAtTile(x, y);
            var object = null;
            var key;
            if (tp & 0x0040) {
                // exit (upper z-level)
                if (!exits) continue;
                tp = tp & 0x0F;
                object = exits.item(tp + 37);
                if (!object) continue;
                key = "entranceTriggers";
            } else if (tp & 0x4000) {
                // exit (lower z-level)
                if (!exits) continue;
                tp = (tp & 0x0F00) >> 8;
                object = exits.item(tp + 37);
                if (!object) continue;
                key = "entranceTriggers";
            } else {
                continue;
            }
            this.triggers.push({
                key: key,
                x: {value: x},
                y: {value: y},
                object: object
            });
        }
    }
}

FF4MapGBA.prototype.fixTreasure = function(trigger) {
    trigger.triggerType.invalid = true;
    trigger.graphics.invalid = true;
    trigger.triggerType.invalid = true;
    trigger.x.invalid = true;
    trigger.y.invalid = true;
    trigger.direction.invalid = true;
    trigger.unknown_5.invalid = true;
    trigger.speed.invalid = true;
    trigger.unknown_7.invalid = true;
    trigger.event.invalid = true;
    trigger.event2.invalid = true;
    trigger.scriptPointer.invalid = true;
}

FF4MapGBA.prototype.fixNPC = function(trigger) {
    trigger.eventSwitch.invalid = true;
    trigger.item.invalid = true;
    trigger.battle.invalid = true;
    trigger.gil.invalid = true;
    trigger.openTile.invalid = true;
}

FF4MapGBA.prototype.fixEvent = function(trigger) {
    trigger.eventSwitch.invalid = true;
    trigger.item.invalid = true;
    trigger.battle.invalid = true;
    trigger.gil.invalid = true;
    trigger.openTile.invalid = true;
    trigger.triggerType.invalid = true;
    trigger.graphics.invalid = true;
    trigger.triggerType.invalid = true;
    trigger.x.invalid = true;
    trigger.y.invalid = true;
    trigger.direction.invalid = true;
    trigger.unknown_5.invalid = true;
    trigger.speed.invalid = true;
    trigger.unknown_7.invalid = true;
    trigger.event2.invalid = true;
    trigger.scriptPointer.invalid = true;
}

FF4MapGBA.prototype.loadEvent = function(object) {
    
    var e = object.event2.value;
    if (e === 0xFFFE) return; // current event
    if (e === -1) e = object.event.value; // no script pointer
    if (e === -1) return; // no event
    if (this.loadedEvents.includes(e)) return; // event already loaded
    this.loadedEvents.push(e);
    
    var event = this.rom.eventScript.item(e);
    if (!event) return;
    
    for (var c = 0; c < event.command.length; c++) {
        var command = event.command[c];
        if (command.key === "createObject") {
            this.observer.startObserving(command, this.reloadTriggers);
            this.triggers.push(command);
        } else if (command.key === "jumpPosition") {
            this.observer.startObserving(command, this.reloadTriggers);
            this.triggers.push(command);
        } else if (command.key === "jumpPositionShort") {
            this.observer.startObserving(command, this.reloadTriggers);
            this.triggers.push(command);
        } else if (command.key === "selectDeleteTrigger") {
            this.observer.startObserving(command, this.reloadTriggers);
            this.triggers.push(command);
        }
        
        if (command.scriptPointer && command.event2) {
            // load nested events
            this.loadEvent(command);
        }
    }
}

FF4MapGBA.prototype.insertTrigger = function(type) {
    
    this.closeMenu();
    
    var triggers = this.rom.mapTriggers.item(this.m);
    if (this.isWorld) triggers = this.rom.worldTriggers.item(this.m - 0xFB);

    var trigger = triggers.blankAssembly();

    this.beginAction(this.reloadTriggers);
    trigger.x.setValue(this.clickedCol);
    trigger.y.setValue(this.clickedRow);
    if (type === "treasureProperties") {
        trigger.map.setValue(0xFE);
        
        // treasures have to come first
        var i = 0;
        while (i < triggers.arrayLength && triggers.item(i).map.value === 0xFE) i++;
        triggers.insertAssembly(trigger, i);
//        this.logTreasures();
        this.updateTreasures();
//        this.logTreasures();
        
    } else if (type === "eventTriggers") {
        trigger.map.setValue(0xFF);
        triggers.insertAssembly(trigger);
    } else {
        triggers.insertAssembly(trigger);
    }
    this.endAction(this.reloadTriggers);
    
    this.selectedTrigger = trigger;
    propertyList.select(trigger);
}

FF4MapGBA.prototype.updateTreasures = function() {
    var t = 0;
    for (var m = 0; m < this.rom.mapProperties.arrayLength; m++) {
        if (m === 256) t = 0; // reset to zero for underground/moon treasures
        this.rom.mapProperties.item(m).treasure.setValue(t);
        var triggers = this.rom.mapTriggers.item(m);
        triggers.array.forEach(function(trigger) {
            if (trigger.map.value === 0xFE) t++;
        });
    }
}

FF4MapGBA.prototype.insertNPC = function() {
    this.closeMenu();
    
    // get the npc properties
    if (this.isWorld) return;
    var npcIndex = this.mapProperties.npc.value;
    if (npcIndex === 0 && this.m !== 0) return;
    var npcProperties = this.rom.npcProperties.item(npcIndex);

    var npc = npcProperties.blankAssembly();

    this.beginAction(this.reloadTriggers);
    npc.x.setValue(this.clickedCol);
    npc.y.setValue(this.clickedRow);
    npc.switch.setValue(1);
    npcProperties.insertAssembly(npc);
    this.endAction(this.reloadTriggers);
    
    this.selectedTrigger = npc;
    propertyList.select(npc);
}

FF4MapGBA.prototype.deleteTrigger = function() {
    
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

FF4MapGBA.prototype.drawTriggers = function() {
    
    var zoom = this.zoom;
    var xClient = this.mapRect.l;
    var yClient = this.mapRect.t;
    var ctx = this.canvas.getContext('2d');
    
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
        var c = "purple";
        switch (trigger.key) {
            case "jumpPosition":
            case "jumpPositionShort":
                c = "rgba(0, 0, 255, 0.5)";
                for (var y = 0; y < trigger.height.value; y++) {
                    for (var x = 0; x < trigger.width.value; x++) {
                        drawTriggerRect(trigger.x.value + x, trigger.y.value + y, c);
                    }
                }
                continue;
            case "createObject":
            case "selectDeleteTrigger":
                c = "rgba(0, 0, 255, 0.5)";
                break;
            case "worldTriggers":
                for (var y = 0; y < trigger.height.value; y++) {
                    for (var x = 0; x < trigger.width.value; x++) {
                        var tp = this.tilePropertiesAtTile(trigger.x.value + x, trigger.y.value + y);
                        if (tp.tileType.value === 1) {
                            c = "rgba(255, 0, 0, 0.5)"; // forest
                        } else if (tp.tileType.value > 3 && tp.tileType.value !== 0xFF) {
                            c = "rgba(255, 0, 0, 0.5)"; // trigger tile
                        } else {
                            c = "rgba(0, 0, 0, 0)"; // not a trigger tile
                        }
                        drawTriggerRect(trigger.x.value + x, trigger.y.value + y, c);
                    }
                }
                continue;
            case "entranceTriggers":
                c = "rgba(255, 0, 0, 0.5)";
                break;
            case "treasureProperties":
                c = "rgba(255, 255, 0, 0.5)";
                break;
            case "mapTriggers":
            case "npcProperties":
                c = "rgba(128, 128, 128, 0.5)";
                break;
        }
        drawTriggerRect(trigger.x.value, trigger.y.value, c);
    }
    
    for (i = 0; i < this.triggers.length; i++) {
        var npc = this.triggers[i];
        if (npc.graphics && npc.graphics.value) this.drawNPC(npc);
    }
}

FF4MapGBA.prototype.triggerAt = function(x, y) {
    
    var triggers = this.triggersAt(x, y);
    if (triggers.length === 0) return null;
    return triggers[0];
}

FF4MapGBA.prototype.triggersAt = function (x, y) {
    var left, right, top, bottom, length;
    var zoom = this.zoom;
    var triggers = [];
    
    for (var i = 0; i < this.triggers.length; i++) {
        var trigger = this.triggers[i];
        left = trigger.x.value * 16 * zoom;
        right = left + 16 * zoom;
        top = trigger.y.value * 16 * zoom;
        bottom = top + 16 * zoom;
        
        if (trigger.width) right = left + 16 * zoom * trigger.width.value;
        if (trigger.height) bottom = top + 16 * zoom * trigger.height.value;
        
        if (x >= left && x < right && y >= top && y < bottom)
            triggers.push(trigger);        
    }
    return triggers;
}

FF4MapGBA.prototype.rectForTrigger = function(trigger) {
    var l = trigger.x.value * 16 * this.zoom;
    var r = l + 16 * this.zoom;
    var t = trigger.y.value * 16 * this.zoom;
    var b = t + 16 * this.zoom;
    
    if (trigger.width && trigger.height) {
        var width = trigger.width.value;
        var height = trigger.height.value;
    }

    return new Rect(l, r, t, b);
}

FF4MapGBA.prototype.drawNPC = function(npc) {
        
    var x = npc.x.value * 16;
    var y = npc.y.value * 16;
    var w = 16;
    var h = 16;
    
    var spriteProperties = this.rom.mapSpriteProperties.item(npc.graphics.value);
    var offset = spriteProperties.offset.value - 0x0400;
    var size = spriteProperties.size.value;
    
    // load palette
    var paletteData = this.rom.mapSpriteGraphics.item(offset);
    if (!paletteData.format) {
        paletteData.format = "bgr555";
        paletteData.disassemble(paletteData.parent.data);
    }
    
    var direction = npc.direction.value;
    var tiles = new Uint16Array(size);
    for (var t = 0; t < size; t++) tiles[t] = t;
    var g = offset + 1;
    if (size === 16) {
        w = 32;
        h = 32;
        y -= 16;
    } else if (direction === 0) {
        // facing up
        g = offset + 3;
    } else if (direction === 2) {
        // facing right
        g = offset + 5;
        tiles[0] = 0x0401;
        tiles[1] = 0x0400;
        tiles[2] = 0x0403;
        tiles[3] = 0x0402;
    } else if (direction === 4) {
        // facing down
        g = offset + 1;
    } else if (direction === 6) {
        // facing left
        g = offset + 5;
    }
    
    // load graphics    
    var graphicsData = this.rom.mapSpriteGraphics.item(g);
    if (!graphicsData.format) {
        graphicsData.format = "linear4bpp";
        graphicsData.disassemble(graphicsData.parent.data);
    }
        
    var npcRect = new Rect(x, x + w, y - 2, y + h - 2);
    npcRect = npcRect.scale(this.zoom);
    if (this.mapRect.intersect(npcRect).isEmpty()) return;

    // set up the ppu
    var ppu = new GFX.PPU();
    ppu.pal = paletteData.data;
    ppu.width = w;
    ppu.height = h;

    // layer 1
    ppu.layers[0].format = GFX.TileFormat.gba4bppTile;
    ppu.layers[0].cols = w >> 3;
    ppu.layers[0].rows = h >> 3;
    ppu.layers[0].z[0] = GFX.Z.snesS0;
    ppu.layers[0].z[1] = GFX.Z.snesS1;
    ppu.layers[0].z[2] = GFX.Z.snesS2;
    ppu.layers[0].z[3] = GFX.Z.snesS3;
    ppu.layers[0].gfx = graphicsData.data;
    ppu.layers[0].tiles = tiles;
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
    npcRect = npcRect.offset(-this.mapRect.l, -this.mapRect.t);
    ctx.drawImage(this.npcCanvas, 0, 0, w, h, npcRect.l, npcRect.t, npcRect.w, npcRect.h);

}

// FF4MapGBATileset
function FF4MapGBATileset(rom, map) {

    this.rom = rom;
    this.map = map;

    this.canvas = document.createElement('canvas');
    this.canvas.id = "tileset";
    this.canvas.width = 256;
    this.canvas.height = 256;
    
    this.cursorCanvas = document.createElement("canvas");
    this.cursorCanvas.id = "tileset-cursor";
    this.cursorCanvas.width = 256;
    this.cursorCanvas.height = 256;

    this.layer = [new FF4MapGBALayer(rom, FF4MapGBALayer.Type.layer1),
                  new FF4MapGBALayer(rom, FF4MapGBALayer.Type.layer2)];

    this.selection = new Uint8Array([0x73, 0, 0, 1, 1, 0]);
    this.clickedCol = null;
    this.clickedRow = null;
    
    this.ppu = new GFX.PPU();

    var tileset = this;
    this.canvas.onmousedown = function(e) { tileset.mouseDown(e) };
    this.canvas.onmouseup = function(e) { tileset.mouseUp(e) };
    this.canvas.onmousemove = function(e) { tileset.mouseMove(e) };
    this.canvas.onmouseout = function(e) { tileset.mouseOut(e) };
    this.canvas.oncontextmenu = function() { return false; };
    var tilesetButtons = document.getElementsByClassName("toolbox-button")
    for (var i = 0; i < tilesetButtons.length; i++) {
        var button = tilesetButtons[i];
        button.onclick = function() { tileset.selectLayer(this.value); };
//        button.addEventListener("click", function() { tileset.selectLayer(this.value); });
    }
}

FF4MapGBATileset.prototype.show = function() {
    this.div = document.getElementById('toolbox-div');
    this.div.innerHTML = "";
    this.div.classList.remove('hidden');
    this.div.appendChild(this.canvas);
    this.div.appendChild(this.cursorCanvas);

    this.cursorCanvas.classList.remove('hidden');
    document.getElementById("toolbox-buttons").classList.remove('hidden');
}

FF4MapGBATileset.prototype.mouseDown = function(e) {
    var x = e.offsetX;
    var y = e.offsetY;
    this.clickedCol = x >> 4;
    this.clickedRow = y >> 4;
    this.mouseMove(e);
    
    if (this.map.l === 2) {
        var mask = this.clickedRow >> 1;
        var zLevel = (this.map.mask !== 2) ? 0x73 : 0x74;
        this.selection = new Uint8Array([zLevel, 0, mask, 1, 1, FF4MapGBATileset.maskType[mask].value]);
        this.drawCursor();
        this.map.selection = new Uint8Array([zLevel, 0, 0, 1, 1, FF4MapGBATileset.maskType[mask].value]);
    }
}

FF4MapGBATileset.prototype.mouseUp = function(e) {
    this.clickedCol = null;
    this.clickedRow = null;
}

FF4MapGBATileset.prototype.mouseOut = function(e) {
    this.mouseUp(e);
}

FF4MapGBATileset.prototype.mouseMove = function(e) {

    // return unless dragging (except if trigger layer selected)
    if (!isNumber(this.clickedCol) || !isNumber(this.clickedRow) || this.map.l >= 2) return;

    var col = Math.min(e.offsetX, this.ppu.width - 1) >> 4;
    var row = Math.min(e.offsetY, this.ppu.height - 1) >> 4;
    var cols = Math.abs(col - this.clickedCol) + 1;
    var rows = Math.abs(row - this.clickedRow) + 1;
    col = Math.min(col, this.clickedCol);
    row = Math.min(row, this.clickedRow);

    // create the tile selection
    this.selection = new Uint8Array(5 + cols * rows);
    this.selection.set([0x73, col, row, cols, rows]);
    for (var i = 0; i < cols; i++) {
        for (var j = 0; j < rows; j++) {
            this.selection[5 + i + j * cols] = col + i + (row + j) * 16;
        }
    }
    
    // redraw the cursor and notify the map
    this.drawCursor();
    this.map.selection = new Uint8Array(this.selection);
//    if (cols === 1 && rows === 1) this.map.selectTileProperties(this.selection[5]);
}

FF4MapGBATileset.prototype.selectLayer = function(l) {
    
    // update layer buttons
    var layerButtons = document.getElementsByClassName("toolbox-button");
    for (var i = 0; i < layerButtons.length; i++) {
        // deselect all layer buttons
        layerButtons[i].classList.remove("selected")
    }
    // select the clicked layer
    layerButtons[l].classList.add("selected")

    // set the selected layer
    this.map.selectLayer(l);

    // turn on the selected layer
    this.ppu.layers[0].main = false;
    this.ppu.layers[1].main = false;
    this.ppu.layers[2].main = false;
    
    // render the image on the canvas
    this.canvas.width = this.ppu.width;
    this.canvas.height = this.ppu.height;
    this.cursorCanvas.width = this.ppu.width;
    this.cursorCanvas.height = this.ppu.height;
    var ctx = this.canvas.getContext('2d');
    if (this.map.l === 3) {
        this.canvas.style.display = "none";
        this.cursorCanvas.style.display = "none";
        this.canvas.parentElement.style.height = "0px";
    } else if (this.map.l === 2) {
        this.canvas.style.display = "block";
        this.cursorCanvas.style.display = "block";
        this.canvas.parentElement.style.height = this.ppu.height.toString() + "px";
        this.drawMask();
    } else {
        this.canvas.style.display = "block";
        this.cursorCanvas.style.display = "block";
        this.canvas.parentElement.style.height = this.ppu.height.toString() + "px";
        var imageData = ctx.createImageData(this.ppu.width, this.ppu.height);
        this.ppu.layers[this.map.l].main = true;
        this.ppu.renderPPU(imageData.data);
        ctx.putImageData(imageData, 0, 0);
    }
    
    this.drawCursor();
    this.map.selection = new Uint8Array(this.selection);
}

FF4MapGBATileset.maskType = [
    {
        name: "Passable",
        color: "rgba(0, 0, 0, 0.0)",
        value: 0x00
    }, {
        name: "Impassable",
        color: "rgba(0, 0, 255, 0.5)",
        value: 0x01
    }, {
        name: "Sprite Hidden",
        color: "rgba(0, 255, 0, 0.5)",
        value: 0x04
    }, {
        name: "Z-Level Change",
        color: "rgba(0, 255, 255, 0.5)",
        value: 0x02
    }, {
        name: "Exit",
        color: "rgba(255, 0, 0, 0.5)",
        value: 0x40
    }, {
        name: "Bridge",
        color: "rgba(255, 0, 255, 0.5)",
        value: 0x05
    }, {
        name: "Treasure",
        color: "rgba(255, 255, 0, 0.5)",
        value: 0x20
    }, {
        name: "Damage Tile",
        color: "rgba(255, 255, 255, 0.5)",
        value: 0x06
    }
]

FF4MapGBATileset.prototype.drawMask = function() {
    var ctx = this.canvas.getContext('2d');
    
    var maskCount = FF4MapGBATileset.maskType.length;
    this.canvas.width = 256;
    this.canvas.height = 32 * maskCount;
    this.cursorCanvas.width = 256;
    this.cursorCanvas.height = 32 * maskCount;
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'medium sans-serif';
    for (var m = 0; m < maskCount; m++) {
        var maskRect = new Rect(0, 256, m * 32, (m + 1) * 32);
        ctx.fillStyle = FF4MapGBATileset.maskType[m].color;
        ctx.fillRect(maskRect.l, maskRect.t, 32, 32);
        ctx.fillStyle = "black";
        ctx.fillText(FF4MapGBATileset.maskType[m].name, maskRect.l + 40, maskRect.t + 17, maskRect.w - 36);
    }
}

FF4MapGBATileset.prototype.drawCursor = function() {
    
    // return if trigger layer is selected
    if (this.map.l === 3) return;
    if (!this.selection) return;
    
    // clear the cursor canvas
    var ctx = this.cursorCanvas.getContext('2d');
    ctx.clearRect(0, 0, this.ppu.width, this.ppu.height);

    // get the cursor geometry
    var x = this.selection[1] << 4;
    var y = this.selection[2] << 4;
    var w = this.selection[3] << 4;
    var h = this.selection[4] << 4;

    if (this.map.l === 2) {
        x = 0;
        y = this.selection[2] * 32;
        w = 256;
        h = 32;
    }
    
    // draw the cursor
    if (w <= 0 || h <= 0) return;
    
    // convert the selection to screen coordinates
    var colors = ["green", "blue", "red", "white"];
    ctx.lineWidth = 1;
    ctx.strokeStyle = "black";
    x += 0.5; y += 0.5; w--; h--;
    ctx.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    ctx.strokeStyle = colors[this.map.l];
    ctx.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    ctx.strokeStyle = "white";
    ctx.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    ctx.strokeStyle = "black";
    ctx.strokeRect(x, y, w, h);
}

FF4MapGBATileset.prototype.loadMap = function(m) {

    // create a sequential tile layout
    var layout = new Uint8Array(256);
    for (var i = 0; i < 256; i++) {
        layout[i] = i;
    }

    var w = 256;
    var h = 256;

    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = this.map.ppu.pal;
    this.ppu.width = w;
    this.ppu.height = h;
    this.ppu.back = true;

    this.layer[0].loadLayout({type: this.map.layer[0].type, layout: layout, tileset: this.map.layer[0].tileset, w: 16, h: 16});
    this.layer[1].loadLayout({type: this.map.layer[1].type, layout: layout, tileset: this.map.layer[1].tileset, w: 16, h: 16});

    // layer 1
    this.ppu.layers[0].format = GFX.TileFormat.gba4bppTile;
    this.ppu.layers[0].rows = 32;
    this.ppu.layers[0].cols = 32;
    this.ppu.layers[0].z[0] = GFX.Z.snes1L;
    this.ppu.layers[0].z[1] = GFX.Z.snes1H;
    this.ppu.layers[0].gfx = this.map.ppu.layers[0].gfx;
    this.ppu.layers[0].tiles = this.layer[0].tiles;

    // layer 2
    this.ppu.layers[1].format = GFX.TileFormat.gba4bppTile;
    this.ppu.layers[1].rows = 32;
    this.ppu.layers[1].cols = 32;
    this.ppu.layers[1].z[0] = GFX.Z.snes2L;
    this.ppu.layers[1].z[1] = GFX.Z.snes2H;
    this.ppu.layers[1].gfx = this.map.ppu.layers[1].gfx;
    this.ppu.layers[1].tiles = this.layer[1].tiles;
     
    this.selectLayer(this.map.l);
}

// FF4MapGBALayer
function FF4MapGBALayer(rom, type) {
    this.rom = rom;
    this.type = type;
    this.tileset = null;
}

FF4MapGBALayer.Type = {
    layer1: "layer1",
    layer2: "layer2",
    world: "world",
    mask: "mask"
}

FF4MapGBALayer.prototype.loadLayout = function(definition) {

    if (definition.type) this.type = definition.type;
    this.layout = definition.layout;
    this.tileset = definition.tileset;
    this.w = definition.w;
    this.h = definition.h;

    // update tiles for the entire map
    this.tiles = new Uint16Array(this.w * this.h * 4);
    this.decodeLayout();
}

FF4MapGBALayer.prototype.setLayout = function(layout) {

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
            if (ld + clippedW > this.layout.data.length) break;
            this.layout.setData(layout.slice(ls, ls + clippedW), ld);
        } else {
            if (ld + clippedW > this.layout.data.length) break;
            if (this.type === FF4MapGBALayer.Type.layer1) {
                ld += 4;
            } else if (this.type === FF4MapGBALayer.Type.layer2) {
                ld += this.w * this.h + 4;
            } else if (this.type === FF4MapGBALayer.Type.mask && layout[0] !== 0x73) {
                ld += this.w * this.h; // z-level 2
            }
            this.layout.setData(layout.slice(ls, ls + clippedW), ld);
        }
    }
    this.decodeLayout(x, y, clippedW, clippedH);
}

FF4MapGBALayer.prototype.getLayout = function(col, row, cols, rows) {
    
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
                selection[5 + x + y * cols] = layout[x + clippedCol + (y + clippedRow) * this.w];
            } else {
                var offset = 0;
                if (this.type === FF4MapGBALayer.Type.layer1) {
                    offset = 4;
                } else if (this.type === FF4MapGBALayer.Type.layer2) {
                    offset = this.w * this.h + 4;
//                } else if (this.type === FF4MapGBALayer.Type.mask) {
//                    offset = this.w * this.h; // z-level 2
                }
                selection[5 + x + y * cols] = layout[x + clippedCol + (y + clippedRow) * this.w + offset];
            }
        }
    }
    return selection;
}

FF4MapGBALayer.prototype.decodeLayout = function(x, y, w, h) {
    
    x = x || 0;
    y = y || 0;
    x %= this.w;
    y %= this.h;
    w = w || this.w;
    h = h || this.h;
    w = Math.min(w, this.w - x);
    h = Math.min(h, this.h - y);
    
    switch (this.type) {
        case FF4MapGBALayer.Type.layer1:
        case FF4MapGBALayer.Type.layer2:
            this.decodeMapLayout(x, y, w, h);
            break;
        case FF4MapGBALayer.Type.world:
            this.decodeWorldLayout(x, y, w, h);
            break;
        default:
            break;
    }
}

FF4MapGBALayer.prototype.decodeMapLayout = function(x, y, w, h) {
    
    var layout = this.layout.data || this.layout;
    var l = x + y * this.w;
    var t = x * 2 + y * this.w * 4;
    var row, col, tile, i;
        
    if (this.layout instanceof Uint8Array) {
        layout = this.layout;
    } else {
        var w = this.layout.data[0] | (this.layout.data[1] << 8);
        var h = this.layout.data[2] | (this.layout.data[3] << 8);
        if (this.type === FF4MapGBALayer.Type.layer1) {
            layout = this.layout.data.subarray(4, 4 + w * h);
        } else {
            layout = this.layout.data.subarray(4 + w * h, 4 + w * h * 2);
        }
    }

    var tileset = new Uint8Array(this.tileset);

    for (row = 0; row < h; row++) {
        for (col = 0; col < w; col++) {
            tile = layout[l + col];
            t1 = (tile & 0x0F) * 8 + (tile & 0xF0) * 8;
            i = t + col * 2;
            if (i > this.tiles.length) return;
            this.tiles[i + 0] = tileset[t1 + 0x0000] | (tileset[t1 + 0x0001] << 8);
            this.tiles[i + 1] = tileset[t1 + 0x0002] | (tileset[t1 + 0x0003] << 8);
            i += this.w * 2;
            this.tiles[i + 0] = tileset[t1 + 0x0004] | (tileset[t1 + 0x0005] << 8);
            this.tiles[i + 1] = tileset[t1 + 0x0006] | (tileset[t1 + 0x0007] << 8);
        }
        t += this.w * 4;
        l += this.w;
    }
}

FF4MapGBALayer.prototype.decodeWorldLayout = function(x, y, w, h) {

    var l = x + y * this.w;
    var t = x * 2 + y * this.w * 4;
    var row, col, tile, i;
    var layout = this.layout.data || this.layout;

    for (row = 0; row < h; row++) {
        for (col = 0; col < w; col++) {
            tile = layout[l + col] * 4;
            i = t + col * 2;
            if (i > this.tiles.length) return;
            this.tiles[i + 0] = this.tileset[tile + 0];
            this.tiles[i + 1] = this.tileset[tile + 1];
            i += this.w * 2;
            this.tiles[i + 0] = this.tileset[tile + 2];
            this.tiles[i + 1] = this.tileset[tile + 3];
        }
        t += this.w * 4;
        l += this.w;
    }
}

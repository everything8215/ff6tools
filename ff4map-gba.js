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
    this.clickPoint = null;
    this.triggerPoint = null;
    this.isDragging = false;
    this.layer = [new FF4MapGBALayer(rom, FF4MapGBALayer.Type.layer1),
                  new FF4MapGBALayer(rom, FF4MapGBALayer.Type.layer2),
                  new FF4MapGBALayer(rom, FF4MapGBALayer.Type.mask1),
                  new FF4MapGBALayer(rom, FF4MapGBALayer.Type.mask2)];
    this.selectedLayer = this.layer[0];
    this.z = FF4MapGBA.ZLevel.upper;
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
        mapGraphicsDataStringTable.string[l].value += " (Layout)";

        var tp = mapProperties.tileProperties.tp.value;
        if (tp === 0) {
            // for map 52, set tile properties to 0xFFFF
            mapProperties.tileProperties.data = new Uint8Array([0xFF, 0xFF]);
        }
        var tilePropertiesStringTable = this.rom.stringTable["mapProperties.tileProperties.tp"];
        if (mapProperties.tileProperties.getSpecialValue() !== 0xFFFF) {
            var tileProperties = mapGraphicsData.item(tp);
            tilePropertiesStringTable.setString(tp, "Map Tile Properties " + tp);
            tileProperties.format = "tose-70";
            tileProperties.disassemble(this.rom.data);
            mapGraphicsDataStringTable.string[tp].value += " (Tile Properties)";
        }
    }

    // tileset palettes, graphics, and layouts
    var mapPaletteStringTable = this.rom.stringTable["mapTileset.palette"];
    var mapGraphicsStringTable = this.rom.stringTable["mapTileset.graphics"];
    var mapTilesetLayoutStringTable = this.rom.stringTable["mapTileset.layout"];
    for (var t = 0; t < this.rom.mapTileset.arrayLength; t++) {
        var mapTileset = this.rom.mapTileset.item(t);

        var p = mapTileset.palette.value;
        var palette = mapGraphicsData.item(p);
        mapPaletteStringTable.setString(p, "Map Palette " + p);
        palette.format = "bgr555";
        palette.disassemble(this.rom.data);
        mapGraphicsDataStringTable.string[p].value += " (Palette)";

        var g = mapTileset.graphics.value;
        var graphics = mapGraphicsData.item(g);
        mapGraphicsStringTable.setString(g, "Map Graphics " + g);
        graphics.format = ["linear4bpp", "tose-70"];
        graphics.disassemble(this.rom.data);
        mapGraphicsDataStringTable.string[g].value += " (Graphics)";

        var tl = mapTileset.layout.value;
        var tilesetLayout = mapGraphicsData.item(tl);
        mapTilesetLayoutStringTable.setString(tl, "Map Tileset Layout " + tl);
        if (tilesetLayout.range.length > 0x0800) tilesetLayout.range.length = 0x0800;
        tilesetLayout.disassemble(this.rom.data);
        mapGraphicsDataStringTable.string[tl].value += " (Tileset Layout)";
    }

    // treasures and events
    for (var t = 0; t < this.rom.mapTriggerPointers.arrayLength; t++) {
        var triggers = this.rom.mapTriggerPointers.item(t).triggerPointer.target;
        if (t < 402) {
            triggers.name = "Trigger";
        } else {
            triggers.name = "Treasure";
        }
        for (var i = 0; i < triggers.arrayLength; i++) {
            var trigger = triggers.item(i);
            if (t >= 402) {
                this.fixTreasure(trigger);
            } else if (trigger.triggerType.value === 0) {
                this.fixEvent(trigger);
            } else {
                this.fixNPC(trigger);
            }
        }
    }

    // world layouts
    for (var w = 0; w < this.rom.worldProperties.arrayLength; w++) {
        var worldProperties = this.rom.worldProperties.item(w);
        var width = worldProperties.width.value >> 4;
        var height = worldProperties.height.value >> 4;
        var layout1 = worldProperties.layout1.target;
        if (layout1) {
            layout1.range.length = width * height;
            layout1.disassemble(this.rom.data);
        }
        var layout2 = worldProperties.layout2.target;
        if (layout2) {
            layout2.range.length = width * height;
            layout2.disassemble(this.rom.data);
        }
    }

    // world tile properties
    var tp = this.rom.worldTileProperties.item(0);
    tp.assembly.assembly.tileValue.stringTable = "worldTileType";
    tp.assembly.assembly.tileValue.bool = false;
    tp.isLoaded = false;
    tp = this.rom.worldTileProperties.item(1);
    tp.assembly.assembly.tileValue.stringTable = "worldTileType";
    tp.assembly.assembly.tileValue.bool = false;
    tp.isLoaded = false;
    tp = this.rom.worldTileProperties.item(3);
    tp.assembly.assembly.tileValue.stringTable = "worldTileType";
    tp.assembly.assembly.tileValue.bool = false;
    tp.isLoaded = false;
    tp = this.rom.worldTileProperties.item(9);
    tp.assembly.assembly.tileValue.stringTable = "worldTileType";
    tp.assembly.assembly.tileValue.bool = false;
    tp.isLoaded = false;
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
    this.clickPoint = {
        x: ((e.offsetX / this.zoom + this.ppu.layers[this.l].x) % this.ppu.width) >> 4,
        y: ((e.offsetY / this.zoom + this.ppu.layers[this.l].y) % this.ppu.height) >> 4,
        button: e.button
    };

    // update the selection position
    this.selection[1] = this.clickPoint.x;
    this.selection[2] = this.clickPoint.y;

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
//                this.selectWorldBattle(this.clickedCol, this.clickedRow);
                this.selectWorldBattle(this.clickPoint.x, this.clickPoint.y);
            } else {
                // select map properties
                propertyList.select(this.mapProperties);
            }
            this.isDragging = false;
        }
//        if (this.rom.isGBA && this.selectedTrigger) {
//            if (this.selectedTrigger.key === "treasureProperties") this.isDragging = false;
//            if (this.selectedTrigger.key === "entranceTriggers") this.isDragging = false;
//        }
    } else if (this.clickPoint && this.clickPoint.button === 2) {
        this.selectTiles();
        this.isDragging = true;
    } else if (this.clickPoint && this.clickPoint.button === 0) {
        this.beginAction(this.drawMap);
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

        if (col != this.clickPoint.x || row !== this.clickPoint.y) {
            // move the trigger back to its old position
            this.selectedTrigger.x.value = this.triggerPoint.x;
            this.selectedTrigger.y.value = this.triggerPoint.y;

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
    this.clickPoint = null;
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
    } else if (this.clickPoint && this.clickPoint.button === 2) {
        this.selectTiles();
    } else if (this.clickPoint && this.clickPoint.button === 0) {
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

    this.clickPoint = {
        x: ((e.offsetX / this.zoom + this.ppu.layers[this.l].x) % this.ppu.width) >> 4,
        y: ((e.offsetY / this.zoom + this.ppu.layers[this.l].y) % this.ppu.height) >> 4,
        button: e.button
    };

    this.menu.classList.add("menu-active");
    this.menu.style.left = e.x + "px";
    this.menu.style.top = e.y + "px";
}

FF4MapGBA.prototype.closeMenu = function() {
    this.menu.classList.remove("menu-active");
}

FF4MapGBA.prototype.setTiles = function() {

    // fix z-level change tiles
    if (this.l === 2) {
        for (var t = 5; t < this.selection.length; t++) {
            if (this.selection[t] === 2 && this.z === FF4MapGBA.ZLevel.lower) this.selection[t] = 3;
            if (this.selection[t] === 3 && this.z === FF4MapGBA.ZLevel.upper) this.selection[t] = 2;
        }
    }

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
    this.triggerPoint = {
        x: this.selectedTrigger.x.value,
        y: this.selectedTrigger.y.value
    };

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

    var col = this.selection[1];
    var row = this.selection[2];
    var cols = Math.abs(col - this.clickPoint.x) + 1;
    var rows = Math.abs(row - this.clickPoint.y) + 1;
    col = Math.min(col, this.clickPoint.x);
    row = Math.min(row, this.clickPoint.y);

    this.selection = this.selectedLayer.getLayout(col, row, cols, rows);

    if (rows !== 1 || cols !== 1) {
        this.tileset.selection = null;
    } else {
        // select a single tile in the tileset view
        var tile = this.selection[5];
        this.tileset.selection = new Uint8Array([0x73, tile & 0x0F, tile >> 4, 1, 1, tile]);
        if (this.isWorld && this.m !== 2) {
            var w = this.layer[0].w;
            var h = this.layer[0].h;
            var t1 = this.layer[0].getLayout(col, row, 1, 1)[5];
            var t2 = this.layer[1].getLayout(col, row, 1, 1)[5];
            if (this.l === 1 && t1 !== 0) tile = t1;
            if (t1 === 0 && t2 !== 0) tile = t2;
            this.selectWorldTileProperties(tile);
        } else if (this.l === 2) {
            this.tileset.selection[1] = col;
            this.tileset.selection[2] = row;
            this.tileset.updateTileDiv();
        }
        var tp = this.tilePropertiesAtTile(col, row);
        this.rom.log("(" + col + "," + row + "): " + hexString(tp, 4, "0x"));
    }
    this.tileset.drawCursor();
}

FF4MapGBA.prototype.selectWorldTileProperties = function(tile) {

    var definition;
    if (this.m !== 1) {
        definition = {
            "key": "worldTile",
            "type": "data",
            "assembly": {
                "tileType": {
                    "type": "assembly",
                    "name": "Tile Type",
                    "external": "worldTileProperties[0][" + tile + "].tileValue"
                },
                "cidsTrial": {
                    "type": "assembly",
                    "name": "Cid's Trial",
                    "external": "worldTileProperties[9][" + tile + "].tileValue"
                },
                "airship": {
                    "type": "assembly",
                    "name": "Chocobo",
                    "external": "worldTileProperties[1][" + tile + "].tileValue"
                },
                "blackChocobo": {
                    "type": "assembly",
                    "name": "Black Chocobo",
                    "external": "worldTileProperties[2][" + tile + "].tileValue"
                }
            }
        }
    } else {
        definition = {
            "key": "worldTile",
            "type": "data",
            "assembly": {
                "tileType": {
                    "type": "assembly",
                    "name": "Tile Type",
                    "external": "worldTileProperties[3][" + tile + "].tileValue"
                },
                "airship1": {
                    "type": "assembly",
                    "name": "Airship Can Fly (No Lava)",
                    "external": "worldTileProperties[4][" + tile + "].tileValue"
                },
                "airship2": {
                    "type": "assembly",
                    "name": "Airship Can Fly (Lava OK)",
                    "external": "worldTileProperties[5][" + tile + "].tileValue"
                },
                "airship3": {
                    "type": "assembly",
                    "name": "Passable Upstairs",
                    "external": "worldTileProperties[6][" + tile + "].tileValue"
                },
                "airship4": {
                    "type": "assembly",
                    "name": "Passable Downstairs",
                    "external": "worldTileProperties[7][" + tile + "].tileValue"
                }
            }
        }
    }

    var tpObject = new ROMData(this.rom, definition, this.rom);
    propertyList.select(tpObject);

}

FF4MapGBA.prototype.tilePropertiesAtTile = function(x, y) {
    var tileProperties;

    var tp, tile, layout;
    var w = this.layer[0].w;
    var h = this.layer[0].h;
    var t = x + y * w;
    if (this.isWorld && this.w !== 2) {
        // world tile properties
        if (this.w !== 1) {
            tp = this.rom.worldTileProperties.item(0);
        } else {
            tp = this.rom.worldTileProperties.item(3);
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
    if (this.l !== 2) {
        this.selectedLayer = this.layer[this.l]
    } else {
        // tile properties
        if (this.z === FF4MapGBA.ZLevel.upper) this.selectedLayer = this.layer[2];
        if (this.z === FF4MapGBA.ZLevel.lower) this.selectedLayer = this.layer[3];
    }

    this.showCursor = (this.l === 3);
    this.drawMap();
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
    if (this.ppu.layers[1].tiles) {
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
    screenRect = new Rect(x - 7 * 16, x + 8 * 16, y - 4.5 * 16, y + 5.5 * 16);

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

FF4MapGBA.ZLevel = {
    "upper": "upper",
    "lower": "lower"
}

FF4MapGBA.WorldTileMasks = {
    "none": "None",
    "passability": "Passability"
}

FF4MapGBA.prototype.drawMask = function() {

    if (this.l !== 2) return;

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
            var color = this.maskColorAtTile(x, y);
            if (!color) continue;
            ctx.fillStyle = color;

            var left = (((x - xStart) << 4) - xOffset) * this.zoom;
            var top = (((y - yStart) << 4) - yOffset) * this.zoom;
            var size = 16 * this.zoom;

            ctx.fillRect(left, top, size, size);
        }
    }
}

FF4MapGBA.prototype.maskColorAtTile = function(x, y) {
    var tp = this.tilePropertiesAtTile(x, y);
    if (!tp) return null;

    if (this.tileMask === FF4MapGBA.WorldTileMasks.passability) {
        if (tp.tileValue.value === 0) {
            return 'rgba(0, 0, 255, 0.5)'; // impassable
        } else {
            return null; // passable
        }
    }

    if (this.z === FF4MapGBA.ZLevel.upper) tp &= 0xFF;
    if (this.z === FF4MapGBA.ZLevel.lower) tp >>= 8;

    if (tp === 0) {
        return null;
    } else if (tp === 0x01) {
        return 'rgba(0, 0, 255, 0.5)'; // impassable
    } else if (tp === 0x02) {
        return 'rgba(0, 255, 255, 0.5)'; // transition 1 -> 2
    } else if (tp === 0x03) {
        return 'rgba(0, 255, 255, 0.5)'; // transition 2 -> 1
    } else if (tp === 0x04) {
        return 'rgba(0, 255, 0, 0.5)'; // entire sprite hidden
    } else if (tp === 0x05) {
        return 'rgba(255, 0, 255, 0.5)'; // bridge
    } else if (tp === 0x06) {
        return 'rgba(0, 0, 0, 0.5)'; // damage tile
    } else if (tp == 0x10) {
        return 'rgba(255, 255, 255, 0.5)'; // bottom of sprite transparent
    } else if (tp == 0x11) {
        return 'rgba(255, 255, 255, 0.5)'; // bottom of sprite hidden
//    } else if (tp == 0x12) {
//        return 'rgba(255, 255, 255, 0.5)'; // not sure
    } else if (tp & 0x20) {
        return 'rgba(255, 255, 0, 0.5)'; // treasure
    } else if (tp & 0x40) {
        return 'rgba(255, 0, 0, 0.5)'; // exit
    } else {
        return 'rgba(255, 255, 255, 0.5)';
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
//            case "entranceTriggers":
                c = "rgba(255, 0, 0, 1.0)";
                break;
//            case "treasureProperties":
//                c = "rgba(255, 255, 0, 1.0)";
//                break;
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
    this.resetControls();
    this.showControls();
    this.tileset.show();
    this.loadMap(object.i);
}

FF4MapGBA.prototype.resetControls = function() {

    ROMEditor.prototype.resetControls.call(this);

    var map = this;

    this.addTwoState("showLayer1", function() { map.changeLayer("showLayer1"); }, "Layer 1", this.showLayer1);
    this.addTwoState("showLayer2", function() { map.changeLayer("showLayer2"); }, "Layer 2", this.showLayer2);
    this.addTwoState("showTriggers", function() { map.changeLayer("showTriggers"); }, "Triggers", this.showTriggers);

    // control to change selected z-level
    if (this.isWorld && this.m !== 2) {
        // world map

    } else {
        // normal map or moon
        var onChangeZ = function(z) {
            if (z === 0) {
                map.z = FF4MapGBA.ZLevel.upper;
                if (map.l === 2) map.selectedLayer = map.layer[2];
            } else if (z === 1) {
                map.z = FF4MapGBA.ZLevel.lower;
                if (map.l === 2) map.selectedLayer = map.layer[3];
            }
            map.drawMap();
        }
        var zSelected = function(z) {
            if (z === 0 && map.z === FF4MapGBA.ZLevel.upper) return true;
            if (z === 1 && map.z === FF4MapGBA.ZLevel.lower) return true;
            return false;
        }
        this.addList("changeZ", "Z-Level", ["Upper Z-Level", "Lower Z-Level"], onChangeZ, zSelected);
    }

    this.addTwoState("showScreen", function() { map.changeLayer("showScreen"); }, "Screen", this.showScreen);
    this.addZoom(this.zoom, function() { map.changeZoom(); });
}

//FF4MapGBA.prototype.show = function() {
//
//    var map = this;
//
//    this.resetControls();
//    this.showControls();
//    this.addTwoState("showLayer1", function() { map.changeLayer("showLayer1"); }, "Layer 1", this.showLayer1);
//    this.addTwoState("showLayer2", function() { map.changeLayer("showLayer2"); }, "Layer 2", this.showLayer2);
//    this.addTwoState("showTriggers", function() { map.changeLayer("showTriggers"); }, "Triggers", this.showTriggers);
//
//    var onChangeMask = function(mask) {
//        map.mask = mask;
//        map.drawMap();
//        if (map.l === 2) {
//            map.selection[0] = (mask !== 2) ? 0x73 : 0x74;
//        }
//    }
//    var maskSelected = function(mask) { return map.mask === mask; }
//    this.addList("showMask", "Mask", ["None", "Z-Level 1", "Z-Level 2"], onChangeMask, maskSelected);
//
//    this.addTwoState("showScreen", function() { map.changeLayer("showScreen"); }, "Screen", this.showScreen);
//
//    this.addZoom(this.zoom, function() { map.changeZoom(); });
//}

FF4MapGBA.prototype.hide = function() {
    this.observer.stopObservingAll();
}

FF4MapGBA.prototype.loadMap = function(m) {

    var layerButtons = document.getElementsByClassName("toolbox-button");
    layerButtons[0].disabled = false;
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
    this.resetControls();

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
    this.layer[2].loadLayout({type: FF4MapGBALayer.Type.mask1, layout: layout, w: w, h: h});
    this.layer[3].loadLayout({type: FF4MapGBALayer.Type.mask2, layout: layout, w: w, h: h});

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
    layerButtons[0].disabled = false;
    layerButtons[1].disabled = false;
    if (this.w !== 2) {
        if (this.selectedLayer && (this.l === 2)) this.selectLayer(0);
        layerButtons[2].disabled = true;
    } else {
        layerButtons[2].disabled = false;
    }
    this.resetControls();

    this.observer.stopObservingAll();
    this.mapProperties = this.rom.worldProperties.item(this.w);
    this.observer.startObserving(this.mapProperties, this.loadMap);
    propertyList.select(this.mapProperties);

    var width = this.mapProperties.width.value >> 4;
    var height = this.mapProperties.height.value >> 4;

    // load graphics
    var gfx = new Uint8Array(0x10000);
    var graphics1 = this.mapProperties.graphics1.target;
    if (graphics1) gfx.set(graphics1.data);
    var graphics2 = this.mapProperties.graphics2.target;
    if (graphics2) gfx.set(graphics2.data, 0x4000);

    // load palette
    var pal = new Uint32Array(0x200);
    var palette = this.mapProperties.palette.target;
    if (palette) pal.set(palette.data);
    pal[0] = 0xFF000000;

    // load tileset
    var tileset1 = this.mapProperties.tileset1.target.data;
    var layout1 = this.mapProperties.layout1.target
    if (layout1 && tileset1) {
        if (layout1.range.length !== width * height) {
            layout1.range.length = width * height;
            layout1.disassemble(this.rom.data);
        }
        this.layer[0].loadLayout({type: FF4MapGBALayer.Type.world, layout: layout1, tileset: tileset1, w: width, h: height});
    }

    var tileset2 = this.mapProperties.tileset2.target;
    if (tileset2) tileset2 = tileset2.data;
    var layout2 = this.mapProperties.layout2.target
    if (tileset2 && layout2) {
        if (layout2.range.length !== width * height) {
            layout2.range.length = width * height;
            layout2.disassemble(this.rom.data);
        }
        this.layer[1].loadLayout({type: FF4MapGBALayer.Type.world, layout: layout2, tileset: tileset2, w: width, h: height});
    }

    // load tile properties layer (moon only)
    if (this.m === 2) {
    var tp = map.tileProperties;
        this.layer[2].loadLayout({type: FF4MapGBALayer.Type.mask1, layout: this.rom.moonTileProperties, w: width, h: height});
        this.layer[3].loadLayout({type: FF4MapGBALayer.Type.mask2, layout: this.rom.moonTileProperties, w: width, h: height});
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
        if (this.m !== 2) this.loadWorldTriggers();
        return;
    }

//    if (this.isWorld) {
//        (this.m !== 2) ? this.loadWorldTriggers() : this.loadMoonTriggers();
//        return;
//    }

    var i;
    // load triggers
    var triggers = this.rom.mapTriggerPointers.item(this.mapProperties.events.value).triggerPointer.target;
    this.observer.startObserving(triggers, this.reloadTriggers);
    for (i = 0; i < triggers.arrayLength; i++) {
        var trigger = triggers.item(i);
        if (trigger.triggerType.value === 0) {
            // map event
            this.loadEvent(trigger);
//            this.fixEvent(trigger);

            var e = trigger.event2.value;
            if (e === -1) e = trigger.event.value; // no script pointer
            if (e === -1) continue; // no event

//            scriptList.selectScript(this.rom.eventScript.item(e));

        } else {
            // npc
//            this.fixNPC(trigger);
            this.triggers.push(trigger);
        }
    }

//    // load tile properties triggers
//    var treasures = this.rom.mapTriggerPointers.item(this.mapProperties.treasures.value).triggerPointer.target;
//    var exits = this.mapProperties.exitPointer.target;
//    for (var y = 0; y < this.layer[0].h; y++) {
//        for (var x = 0; x < this.layer[0].w; x++) {
//            var tp = this.tilePropertiesAtTile(x, y);
//            var object = null;
//            var key;
//            if (tp & 0x0040) {
//                // exit (upper z-level)
//                if (!exits) continue;
//                object = exits.item(tp & 0x1F);
//                if (!object) continue;
//                key = "entranceTriggers";
//            } else if (tp & 0x4000) {
//                // exit (lower z-level)
//                if (!exits) continue;
//                object = exits.item((tp & 0x1F00) >> 8);
//                if (!object) continue;
//                key = "entranceTriggers";
//            } else if (tp & 0x0020) {
//                // treasure (upper z-level)
//                if (!treasures) continue;
//                object = treasures.item(tp & 0x1F);
//                if (!object) continue;
//                this.fixTreasure(object);
//                key = "treasureProperties";
//            } else if (tp & 0x2000) {
//                // treasure (lower z-level)
//                if (!treasures) continue;
//                object = treasures.item((tp & 0x1F00) >> 8);
//                if (!object) continue;
//                this.fixTreasure(object);
//                key = "treasureProperties";
//            } else {
//                continue;
//            }
//            this.triggers.push({
//                key: key,
//                x: {value: x},
//                y: {value: y},
//                object: object
//            });
//        }
//    }
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

//FF4MapGBA.prototype.loadMoonTriggers = function() {
//
//    // load tile properties triggers
//    var exits = this.rom.worldExit;
//    for (var y = 0; y < this.layer[0].h; y++) {
//        for (var x = 0; x < this.layer[0].w; x++) {
//            var tp = this.tilePropertiesAtTile(x, y);
//            var object = null;
//            var key;
//            if (tp & 0x0040) {
//                // exit (upper z-level)
//                if (!exits) continue;
//                tp = tp & 0x1F;
//                object = exits.item(tp + 37);
//                if (!object) continue;
//                key = "entranceTriggers";
//            } else if (tp & 0x4000) {
//                // exit (lower z-level)
//                if (!exits) continue;
//                tp = (tp & 0x1F00) >> 8;
//                object = exits.item(tp + 37);
//                if (!object) continue;
//                key = "entranceTriggers";
//            } else {
//                continue;
//            }
//            this.triggers.push({
//                key: key,
//                x: {value: x},
//                y: {value: y},
//                object: object
//            });
//        }
//    }
//}

FF4MapGBA.prototype.fixTreasure = function(trigger) {
    trigger.name = "Treasure";
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
    trigger.name = "NPC";
    trigger.eventSwitch.invalid = true;
    trigger.item.invalid = true;
    trigger.battle.invalid = true;
    trigger.gil.invalid = true;
    trigger.openTile.invalid = true;
}

FF4MapGBA.prototype.fixEvent = function(trigger) {
    trigger.name = "Event";
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
    trigger.x.setValue(this.clickPoint.x);
    trigger.y.setValue(this.clickPoint.y);
//    trigger.x.setValue(this.clickedCol);
//    trigger.y.setValue(this.clickedRow);
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
    npc.x.setValue(this.clickPoint.x);
    npc.y.setValue(this.clickPoint.y);
//    npc.x.setValue(this.clickedCol);
//    npc.y.setValue(this.clickedRow);
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
                        if (tp.tileValue.value === 2) {
                            c = "rgba(255, 0, 0, 0.5)"; // forest
                        } else if (tp.tileValue.value > 4 && tp.tileValue.value !== 0) {
                            c = "rgba(255, 0, 0, 0.5)"; // trigger tile
                        } else {
                            c = "rgba(0, 0, 0, 0)"; // not a trigger tile
                        }
                        drawTriggerRect(trigger.x.value + x, trigger.y.value + y, c);
                    }
                }
                continue;
//            case "entranceTriggers":
//                c = "rgba(255, 0, 0, 0.5)";
//                break;
//            case "treasureProperties":
//                c = "rgba(255, 255, 0, 0.5)";
//                break;
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

    this.tileDiv = document.createElement('div');
    this.tileDiv.id = "tile-div";

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
    this.div.appendChild(this.tileDiv);

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
        var maskType = this.getMaskType(mask);
        if (maskType) {
            this.selection = new Uint8Array([0x73, 0, maskType.index, 1, 1, maskType.value]);
            this.drawCursor();
            this.map.selection = new Uint8Array([0x73, 0, 0, 1, 1, maskType.value]);
        }
    } else if (this.map.isWorld && this.map.m !== 2) {
        this.map.selectWorldTileProperties(this.clickedCol + (this.clickedRow * 16));
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
        this.tileDiv.style.display = "none";
        this.canvas.parentElement.style.height = "0px";
    } else if (this.map.l === 2) {
        this.canvas.style.display = "none";
        this.cursorCanvas.style.display = "none";
        this.tileDiv.style.display = "block";
        this.canvas.parentElement.style.height = "auto";
        this.updateTileDiv();
    } else {
        this.canvas.style.display = "block";
        this.cursorCanvas.style.display = "block";
        this.tileDiv.style.display = "none";
        this.canvas.parentElement.style.height = this.ppu.height.toString() + "px";
        var imageData = ctx.createImageData(this.ppu.width, this.ppu.height);
        this.ppu.layers[this.map.l].main = true;
        this.ppu.renderPPU(imageData.data);
        ctx.putImageData(imageData, 0, 0);
    }

    this.drawCursor();
    this.map.selection = new Uint8Array(this.selection);
}

FF4MapGBATileset.MaskType = {
    passable: {
        name: "Passable",
        color: "rgba(0, 0, 0, 0.0)",
        value: 0x00,
        index: 0
    },
    impassable: {
        name: "Impassable",
        color: "rgba(0, 0, 255, 0.5)",
        value: 0x01,
        index: 1
    },
    spriteHidden: {
        name: "Sprite Hidden",
        color: "rgba(0, 255, 0, 0.5)",
        value: 0x04,
        index: 2
    },
    zLevelChange: {
        name: "Z-Level Change",
        color: "rgba(0, 255, 255, 0.5)",
        value: 0x02,
        index: 3
    },
    exit: {
        name: "Exit",
        color: "rgba(255, 0, 0, 0.5)",
        value: 0x40,
        index: 4
    },
    bridge: {
        name: "Bridge",
        color: "rgba(255, 0, 255, 0.5)",
        value: 0x05,
        index: 5
    },
    treasure: {
        name: "Treasure",
        color: "rgba(255, 255, 0, 0.5)",
        value: 0x20,
        index: 6
    },
    damageTile: {
        name: "Damage Tile",
        color: "rgba(0, 0, 0, 0.5)",
        value: 0x06,
        index: 7
    },
    unknown7: {
        name: "Unknown (0x07)",
        color: "rgba(255, 255, 255, 0.5)",
        value: 0x07,
        index: 8
    },
    bottomHidden: {
        name: "Bottom Half Hidden",
        color: "rgba(255, 255, 255, 0.5)",
        value: 0x11,
        index: 9
    },
    bottomTransparent: {
        name: "Bottom Half Transparent",
        color: "rgba(255, 255, 255, 0.5)",
        value: 0x10,
        index: 10
    },
    unknown12: {
        name: "Unknown (0x12)",
        color: "rgba(255, 255, 255, 0.5)",
        value: 0x12,
        index: 11
    },
    unknown13: {
        name: "Unknown (0x13)",
        color: "rgba(255, 255, 255, 0.5)",
        value: 0x13,
        index: 12
    }
}

FF4MapGBATileset.prototype.getMaskType = function(value) {

    if (value === 0x00) return FF4MapGBATileset.MaskType.passable;
    if (value === 0x01) return FF4MapGBATileset.MaskType.impassable;
    if (value === 0x02) return FF4MapGBATileset.MaskType.zLevelChange;
    if (value === 0x03) return FF4MapGBATileset.MaskType.zLevelChange;
    if (value === 0x04) return FF4MapGBATileset.MaskType.spriteHidden;
    if (value === 0x05) return FF4MapGBATileset.MaskType.bridge;
    if (value === 0x06) return FF4MapGBATileset.MaskType.damageTile;
    if (value === 0x07) return FF4MapGBATileset.MaskType.unknown7;
    if (value === 0x10) return FF4MapGBATileset.MaskType.bottomTransparent;
    if (value === 0x11) return FF4MapGBATileset.MaskType.bottomHidden;
    if (value === 0x12) return FF4MapGBATileset.MaskType.unknown12;
    if (value === 0x13) return FF4MapGBATileset.MaskType.unknown13;
    if (value & 0x20) return FF4MapGBATileset.MaskType.treasure;
    if (value & 0x40) return FF4MapGBATileset.MaskType.exit;

    return null;
}

FF4MapGBATileset.prototype.updateTileDiv = function() {

    var tileset = this;
    this.tileDiv.innerHTML = "";

    var headingDiv = document.createElement('div');
    headingDiv.classList.add("property-heading");
    this.tileDiv.appendChild(headingDiv);

    var heading = document.createElement('p');
    heading.innerHTML = "Tile Properties (" + this.selection[1] + "," + this.selection[2] + ") " + this.map.z;
    headingDiv.appendChild(heading);

    // tile type
    var tileTypeDiv = document.createElement('div');
    tileTypeDiv.classList.add("property-div");
    this.tileDiv.appendChild(tileTypeDiv);

    var tileTypeLabel = document.createElement('p');
    tileTypeLabel.classList.add("property-label");
    tileTypeLabel.innerHTML = "Type:";
    tileTypeLabel.htmlFor = "tile-type-control";
    tileTypeDiv.appendChild(tileTypeLabel);

    var tileTypeControlDiv = document.createElement('div');
    tileTypeControlDiv.classList.add("property-control-div");
    tileTypeDiv.appendChild(tileTypeControlDiv);

    var tileTypeControl = document.createElement('select');
    tileTypeControl.classList.add("property-control");
    tileTypeControl.id = "tile-type-control";
    tileTypeControlDiv.appendChild(tileTypeControl);

    var currentTile = this.selection[5];
    var keys = Object.keys(FF4MapGBATileset.MaskType);
    for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var maskType = FF4MapGBATileset.MaskType[key];
        var option = document.createElement('option');
        option.value = maskType.value;
        option.innerHTML = maskType.name;
        tileTypeControl.appendChild(option);
        if (this.getMaskType(currentTile) === maskType) tileTypeControl.value = maskType.value;
    }

    var callback = function() {
        tileset.map.drawMap();
        tileset.updateTileDiv();
    }

    tileTypeControl.onchange = function() {
        tileset.selection[5] = Number(this.value);
        tileset.map.beginAction(callback);
        tileset.map.selection = tileset.selection;
        tileset.map.setTiles();
        tileset.map.endAction(callback);
    }

    if (this.map.m === 2 && currentTile & 0x40) {
        // moon exit
        var exitDiv = this.createMoonExitDiv();
        if (exitDiv) this.tileDiv.appendChild(exitDiv);
    } else if (currentTile & 0x20) {
        // treasure index
        var treasureDiv = this.createTreasureDiv();
        if (treasureDiv) this.tileDiv.appendChild(treasureDiv);
    } else if (currentTile & 0x40) {
        // exit index
        var exitDiv = this.createExitDiv();
        if (exitDiv) this.tileDiv.appendChild(exitDiv);
    }

    propertyList.updateLabels();
}

FF4MapGBATileset.prototype.createTreasureDiv = function() {

    var tileset = this;
    var treasureDiv = document.createElement('div');
    treasureDiv.classList.add("property-div");

    var treasureLabel = document.createElement('p');
    treasureLabel.classList.add("property-label");
    treasureLabel.innerHTML = "Treasure:";
    treasureLabel.htmlFor = "tile-treasure-control";
    treasureDiv.appendChild(treasureLabel);

    var treasureControlDiv = document.createElement('div');
    treasureControlDiv.classList.add("property-control-div");
    treasureDiv.appendChild(treasureControlDiv);

    var treasureControl = document.createElement('select');
    treasureControl.classList.add("property-control");
    treasureControl.id = "tile-treasure-control";
    treasureControlDiv.appendChild(treasureControl);

    var treasures = this.rom.mapTriggerPointers.item(this.map.mapProperties.treasures.value).triggerPointer.target;
    for (var t = 0; t < treasures.array.length; t++) {
        var treasure = treasures.item(t);
        var option = document.createElement('option');
        option.value = t;
        option.innerHTML = treasure.name + " " + t.toString();
        treasureControl.appendChild(option);
    }
    t = tileset.selection[5] & 0x1F;
    treasureControl.value = t;
    propertyList.select(treasures.item(t));

    var callback = function() {
        tileset.map.drawMap();
        tileset.updateTileDiv();
    }

    treasureControl.onchange = function() {
        var t = Number(this.value);
        tileset.selection[5] = 0x20 | t;
        tileset.map.beginAction(callback);
        tileset.map.selection = tileset.selection;
        tileset.map.setTiles();
        tileset.map.endAction(callback);
        propertyList.select(treasures.item(t))
    }

    return treasureDiv;
}

FF4MapGBATileset.prototype.createExitDiv = function() {

    var tileset = this;
    var exitDiv = document.createElement('div');
    exitDiv.classList.add("property-div");

    var exitLabel = document.createElement('p');
    exitLabel.classList.add("property-label");
    exitLabel.innerHTML = "Exit:";
    exitLabel.htmlFor = "tile-exit-control";
    exitDiv.appendChild(exitLabel);

    var exitControlDiv = document.createElement('div');
    exitControlDiv.classList.add("property-control-div");
    exitDiv.appendChild(exitControlDiv);

    var exitControl = document.createElement('select');
    exitControl.classList.add("property-control");
    exitControl.id = "tile-exit-control";
    exitControlDiv.appendChild(exitControl);

    var exits = this.map.mapProperties.exitPointer.target;
    if (exits && exits.array) {
        for (var e = 0; e < exits.array.length; e++) {
            var exit = exits.item(e);
            var option = document.createElement('option');
            option.value = e;
            option.innerHTML = exit.name + " " + e.toString();
            exitControl.appendChild(option);
        }
        e = tileset.selection[5] & 0x1F;
        exitControl.value = e;
        propertyList.select(exits.item(e));
    }

    var callback = function() {
        tileset.map.drawMap();
        tileset.updateTileDiv();
    }

    exitControl.onchange = function() {
        var e = Number(this.value);
        tileset.selection[5] = 0x40 | e;
        tileset.map.beginAction(callback);
        tileset.map.selection = tileset.selection;
        tileset.map.setTiles();
        tileset.map.endAction(callback);
        propertyList.select(exits.item(e))
    }

    return exitDiv;
}

FF4MapGBATileset.prototype.createMoonExitDiv = function() {

    var tileset = this;
    var exitDiv = document.createElement('div');
    exitDiv.classList.add("property-div");

    var exitLabel = document.createElement('p');
    exitLabel.classList.add("property-label");
    exitLabel.innerHTML = "Exit:";
    exitLabel.htmlFor = "tile-exit-control";
    exitDiv.appendChild(exitLabel);

    var exitControlDiv = document.createElement('div');
    exitControlDiv.classList.add("property-control-div");
    exitDiv.appendChild(exitControlDiv);

    var exitControl = document.createElement('select');
    exitControl.classList.add("property-control");
    exitControl.id = "tile-exit-control";
    exitControlDiv.appendChild(exitControl);

    var exits = this.rom.worldExit;
    for (var e = 0; e < (exits.array.length - 37); e++) {
        var exit = exits.item(e + 37);
        var option = document.createElement('option');
        option.value = e;
        option.innerHTML = exit.name + " " + e.toString();
        exitControl.appendChild(option);
    }

    var callback = function() {
        tileset.map.drawMap();
        tileset.updateTileDiv();
    }

    exitControl.onchange = function() {
        var e = Number(this.value);
        tileset.selection[5] = 0x40 | e;
        tileset.map.beginAction(callback);
        tileset.map.selection = tileset.selection;
        tileset.map.setTiles();
        tileset.map.endAction(callback);
        propertyList.select(exits.item(e + 37))
    }
    e = tileset.selection[5] & 0x1F
    exitControl.value = e;
    propertyList.select(exits.item(e + 37))

    return exitDiv;
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
    mask1: "mask1",
    mask2: "mask2"
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
            } else if (this.type === FF4MapGBALayer.Type.mask2) {
                ld += this.w * this.h; // z-level 2
            }
            if (ld + clippedW >= this.layout.data.length) break;
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
                } else if (this.type === FF4MapGBALayer.Type.mask2) {
                    offset = this.w * this.h; // z-level 2
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

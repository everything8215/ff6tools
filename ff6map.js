//
// ff6map.js
// created 1/11/2018
//

function FF6Map(rom) {
    ROMEditor.call(this, rom);
    this.name = "FF6Map";
    this.tileset = new FF6MapTileset(rom, this);
    
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
    this.isWorld = false;
    this.m = null; // map index
    this.l = 0; // selected layer
    this.zoom = 1.0; // zoom multiplier
    this.selection = new Uint8Array([0x73, 0, 0, 1, 1, 0]);
    this.clickPoint = null;
    this.triggerPoint = null;
    this.isDragging = false;
    this.layer = [new FF6MapLayer(rom, FF6MapLayer.Type.layer1),
                  new FF6MapLayer(rom, FF6MapLayer.Type.layer2),
                  new FF6MapLayer(rom, FF6MapLayer.Type.layer3),
                  new FF6MapLayer(rom, FF6MapLayer.Type.overlay)];
    this.selectedLayer = this.layer[0];
    this.worldLayer = new FF6MapLayer(rom, FF6MapLayer.Type.world);
    this.showCursor = true;
    this.showLayer1 = true;
    this.showLayer2 = true;
    this.showLayer3 = true;
    this.showTriggers = true;
    this.showScreen = false;
    this.triggers = [];
    this.showCursor = false;
    this.selectedTrigger = null;
    this.observer = new ROMObserver(rom, this, {sub: true, link: true, array: true});
    this.ppu = new GFX.PPU();
    
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.id = "map-screen";
    this.screenCanvas.width = 256;
    this.screenCanvas.width = 256;
    this.scrollDiv.appendChild(this.screenCanvas);

    // mask layer/overlay stuff
    this.tileMask = FF6Map.TileMasks.none;
    this.overlayCanvas = document.createElement('canvas');
    this.overlayPPU = new GFX.PPU();

    // add event listeners
    var map = this;
    this.scrollDiv.parentElement.onscroll = function() { map.scroll() };
//    window.addEventListener("resize", map.scroll, false);
    this.scrollDiv.onmousedown = function(e) { map.mouseDown(e) };
    this.scrollDiv.onmouseup = function(e) { map.mouseUp(e) };
    this.scrollDiv.onmousemove = function(e) { map.mouseMove(e) };
    this.scrollDiv.onmouseenter = function(e) { map.mouseEnter(e) };
    this.scrollDiv.onmouseleave = function(e) { map.mouseLeave(e) };
    this.scrollDiv.oncontextmenu = function(e) { map.openMenu(e); return false; };

    // check if GBA triggers have already been fixed
    if (this.rom.isGBA && (rom.eventTriggersAdvance instanceof ROMArray || rom.npcPropertiesAdvance instanceof ROMArray)) {

        // prompt the user to see if they want to fix the triggers
        var content = openModal("Fix GBA Triggers");

        var p = document.createElement('p');
        p.innerHTML = "Some triggers in FF6 Advance are stored separately from the others. It is recommended to consolidate these triggers if you plan to modify any triggers. This will result in some data being relocated. Would you like FF6Tools to move these triggers?";
        content.appendChild(p);

        var yesButton = document.createElement('button');
        yesButton.innerHTML = "Yes";
        yesButton.onclick = function() {
            closeModal();
            rom.beginAction();
            map.fixGBATriggers(rom.eventTriggers, rom.eventTriggersAdvance);
            map.fixGBATriggers(rom.npcProperties, rom.npcPropertiesAdvance);
            rom.endAction();
        };
        content.appendChild(yesButton);

        var noButton = document.createElement('button');
        noButton.innerHTML = "No";
        noButton.onclick = function() { closeModal(); };
        content.appendChild(noButton);
    }
}

FF6Map.prototype = Object.create(ROMEditor.prototype);
FF6Map.prototype.constructor = FF6Map;

FF6Map.prototype.beginAction = function(callback) {
    this.rom.beginAction();
    this.rom.doAction(new ROMAction(this.observer, this.observer.wake, this.observer.sleep));
    if (callback) this.rom.doAction(new ROMAction(this, callback, null));
}

FF6Map.prototype.endAction = function(callback) {
    if (callback) this.rom.doAction(new ROMAction(this, null, callback));
    this.rom.doAction(new ROMAction(this.observer, this.observer.sleep, this.observer.wake));
    this.rom.endAction();
}

FF6Map.prototype.fixGBATriggers = function(triggers, triggersGBA) {

    // return if trigger arrays are invalid
    if (!triggers || !triggersGBA) return;
    
    // return if GBA triggers are already fixed
    if (triggersGBA.type === ROMObject.Type.assembly) return;
    
    // create new trigger arrays for the GBA maps
    var mapCount = this.rom.mapProperties.arrayLength;
    while (triggers.arrayLength < mapCount) {
        // add a blank trigger array for each map
        var newArray = triggers.blankAssembly();
        triggers.insertAssembly(newArray);
    }

    // copy all GBA triggers to the normal trigger array
    for (var t = 0; t < triggersGBA.arrayLength; t++) {

        var oldTrigger = triggersGBA.item(t);
        var m = oldTrigger.map.value;
        var mapTriggers = triggers.item(m);
        var newTrigger = mapTriggers.blankAssembly();

        // copy all trigger properties
        var keys = Object.keys(newTrigger.assembly);
        for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            newTrigger[key].setValue(oldTrigger[key].value);
        }
        
        // add the trigger to the map's trigger array
        mapTriggers.insertAssembly(newTrigger);
    }

    // replace the GBA triggers with a 2-byte null terminator
    var definition = triggersGBA.definition;
    definition.type = "assembly";
    delete definition.assembly;
    delete definition.pointerTable;
    definition.name += " Placeholder";
    var placeholder = this.rom.addAssembly(definition);
    placeholder.disassemble(this.rom.data);
    placeholder.data = new Uint8Array(2);
    placeholder.markAsDirty();
}

FF6Map.prototype.changeZoom = function() {
    
    // save the old scroll location
    var x = this.div.scrollLeft;
    var y = this.div.scrollTop;
    var w = this.div.clientWidth;
    var h = this.div.clientHeight;
    x = (x + w / 2) / this.zoom;
    y = (y + h / 2) / this.zoom;
    
    this.zoom = Math.pow(2, Number(document.getElementById("zoom").value));
    
    var zoomValue = document.getElementById("zoom-value");
    zoomValue.innerHTML = (this.zoom * 100).toString() + "%";
    
    this.div.scrollLeft = x * this.zoom - (w >> 1);
    this.div.scrollTop = y * this.zoom - (h >> 1);

    this.scrollDiv.style.width = (this.ppu.width * this.zoom).toString() + "px";
    this.scrollDiv.style.height = (this.ppu.height * this.zoom).toString() + "px";

    this.scroll();
}

FF6Map.prototype.scroll = function() {
    
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

FF6Map.prototype.mouseDown = function(e) {
    
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
            this.selectedTrigger = triggers[(index + 1) % triggers.length];
            propertyList.select(this.selectedTrigger);
            this.isDragging = true;
            this.triggerPoint = {
                x: this.selectedTrigger.x.value,
                y: this.selectedTrigger.y.value
            };
        } else if (triggers.length !== 0) {
            // select the first trigger
            this.selectedTrigger = triggers[0];
            propertyList.select(this.selectedTrigger);
            this.isDragging = true;
            this.triggerPoint = {
                x: this.selectedTrigger.x.value,
                y: this.selectedTrigger.y.value
            };
        } else {
            // clear trigger selection
            this.selectedTrigger = null;
            if (this.m < 3) {
                // select world map battle
                this.selectWorldBattle(this.clickPoint.x, this.clickPoint.y) 
            } else {
                // select map properties
                propertyList.select(this.mapProperties);
            }
            this.isDragging = false;
        }
    } else if (this.clickPoint && this.clickPoint.button === 2) {
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

FF6Map.prototype.mouseMove = function(e) {
    
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
    } else {
        this.setTiles();
    }

    // update the cursor
    this.drawScreen();
    this.drawCursor();
}

FF6Map.prototype.mouseUp = function(e) {
    
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
}

FF6Map.prototype.mouseEnter = function(e) {
    
    // show the cursor
    this.showCursor = true;
    this.drawScreen();
    this.drawCursor();

    this.mouseUp(e);
}

FF6Map.prototype.mouseLeave = function(e) {
    
    // hide the cursor
    this.showCursor = (this.l === 3);
    this.drawScreen();
    this.drawCursor();
    
    this.mouseUp(e);
}

FF6Map.prototype.updateMenu = function() {
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
    
    appendMenuItem("Insert Entrance Trigger (Single-Tile)", function() {self.insertTrigger('entranceTriggersSingle')});
    appendMenuItem("Insert Entrance Trigger (Multi-Tile)", this.m < 3 ? null : function() {self.insertTrigger('entranceTriggersMulti')});
    appendMenuItem("Insert Event Trigger", function() {self.insertTrigger('eventTriggers')});
    appendMenuItem("Insert Treasure", this.m < 3 ? null : function() {self.insertTrigger('treasureProperties')});
    appendMenuItem("Insert NPC", this.m < 3 ? null : function() {self.insertTrigger('npcProperties')});
    appendMenuItem("Delete Trigger", !this.selectedTrigger ? null : function() {self.deleteTrigger()});
}

FF6Map.prototype.openMenu = function(e) {
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

FF6Map.prototype.closeMenu = function() {
    this.menu.classList.remove("menu-active");
}
 
FF6Map.prototype.setTiles = function() {
    // return if not dragging
    if (!this.clickPoint) return;

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
    if (this.selectedLayer.type === FF6MapLayer.Type.layer1) {
        // update overlay layout
        this.layer[3].setLayout(this.selection);
    }
    this.rom.doAction(new ROMAction(this, invalidate, invalidate, "Invalidate Map"));
    this.drawMap();
}

FF6Map.prototype.selectTiles = function() {
    // return if not dragging
    if (!this.clickPoint) return;
    
    var col = this.selection[1];
    var row = this.selection[2];
    var cols = Math.abs(col - this.clickPoint.x) + 1;
    var rows = Math.abs(row - this.clickPoint.y) + 1;
    col = Math.min(col, this.clickPoint.x);
    row = Math.min(row, this.clickPoint.y);

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

FF6Map.prototype.tilePropertiesAtTile = function(t) {
    if (this.isWorld) {
        // world map tile properties
        if (this.m === 2) return null;
        return this.rom.worldTileProperties.item(this.m).item(t);
    } else {
        // layer 1 tile properties determined by graphics index
        return this.rom.mapTileProperties.item(this.mapProperties.tileProperties.value).item(t);
    }
}

FF6Map.prototype.selectTileProperties = function(t) {
    
    if (!this.isWorld && this.selectedLayer && this.selectedLayer.type !== FF6MapLayer.Type.layer1) return;
    
    // select tile properties
    var tileProperties = this.tilePropertiesAtTile(t);
    if (tileProperties) propertyList.select(tileProperties);
//    if (this.selectedLayer.type === FF6MapLayer.Type.layer1) {
//        // layer 1 tile properties determined by graphics index
//        tileProperties = this.rom.mapTileProperties.item(this.mapProperties.tileProperties.value);
//    } else if (this.selectedLayer.type === FF6MapLayer.Type.world) {
//        // world map tile properties
//        if (this.m === 2) return;
//        tileProperties = this.rom.worldTileProperties.item(this.m);
//    } else {
//        // return if layer 2
//        return;
//    }
//    propertyList.select(tileProperties.item(t));
}

FF6Map.prototype.selectLayer = function(l) {
    // set the selected layer
    l = Number(l);
    if (isNumber(l)) this.l = l;
    
    if (this.m > 2) {
        this.selectedLayer = this.layer[this.l]
    } else {
        this.selectedLayer = this.worldLayer;
    }
    
    this.showCursor = (this.l === 3);
    this.drawScreen();
    this.drawCursor();
}

FF6Map.prototype.selectWorldBattle = function(x, y) {
    if (this.m > 1) return;
    
    x >>= 5;
    y >>= 5;
    
    var sector = x | (y << 3) | (this.m << 6);
    var battleGroup = this.rom.worldBattleGroup.item(sector);
    propertyList.select(battleGroup);
}

FF6Map.prototype.changeLayer = function(id) {
    this[id] = document.getElementById(id).checked;
    var map = this.rom.mapProperties.item(this.m);
    var colorMath = this.rom.mapColorMath.item(map.colorMath.value);
    this.ppu.layers[0].main = this.showLayer1;
    if (this.m > 2) {
        this.ppu.layers[0].sub = this.showLayer1 && (colorMath.subscreen.value & 0x01);
        this.ppu.layers[1].main = this.showLayer2 && (colorMath.mainscreen.value & 0x02);
        this.ppu.layers[1].sub = this.showLayer2 && (colorMath.subscreen.value & 0x02);
        this.ppu.layers[2].main = this.showLayer3 && (colorMath.mainscreen.value & 0x04);
        this.ppu.layers[2].sub = this.showLayer3 && (colorMath.subscreen.value & 0x04);
    }
    this.invalidateMap();
    this.drawMap();
}

FF6Map.TileMasks = {
    "none": "None",
    "overlay": "Sprite Overlay",
    "zUpper": "Upper Z-Level",
    "zLower": "Lower Z-Level",
    "npcPassability": "NPC Passability",
    "spritePriority": "Sprite Priority",
    "misc": "Misc."
}

FF6Map.prototype.drawMask = function() {
    
    if (this.isWorld) return; // world map not implemented yet
    if (this.tileMask === FF6Map.TileMasks.none) return;
    if (this.tileMask === FF6Map.TileMasks.overlay) return;

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
            
            var tile = this.layer[0].layout.data[x % this.layer[0].w + (y % this.layer[0].h) * this.layer[0].w];
            var tp = this.tilePropertiesAtTile(tile);
            if (!tp) continue;
            
            if (this.tileMask === FF6Map.TileMasks.zUpper) {
                if (tp.getSpecialValue() === 0xFFF7 || tp.getSpecialValue() === 0x0007) {
                    ctx.fillStyle = 'rgba(0, 0, 255, 0.5)'; // impassable
                } else if (tp.zLevel.value & 1) {
                    continue;
                } else if (tp.zLevel.value === 4) {
                    ctx.fillStyle = 'rgba(0, 255, 255, 0.5)'; // bridge
                } else {
                    ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
                }
            } else if (this.tileMask === FF6Map.TileMasks.zLower) {
                if (tp.getSpecialValue() === 0xFFF7 || tp.getSpecialValue() === 0x0007) {
                    ctx.fillStyle = 'rgba(0, 0, 255, 0.5)'; // impassable
                } else if (tp.zLevel.value & 2) {
                    continue;
                } else if (tp.zLevel.value === 4) {
                    ctx.fillStyle = 'rgba(0, 255, 255, 0.5)'; // bridge
                } else {
                    ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
                }
            } else if (this.tileMask === FF6Map.TileMasks.npcPassability) {
                if (tp.getSpecialValue() === 0xFFF7 || tp.getSpecialValue() === 0x0007) {
                    ctx.fillStyle = 'rgba(0, 0, 255, 0.5)'; // impassable
                } else if (tp.flags.value & 0x1000) {
                    continue;
                } else {
                    ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
                }
            } else if (this.tileMask === FF6Map.TileMasks.spritePriority) {
                if (tp.getSpecialValue() === 0xFFF7 || tp.getSpecialValue() === 0x0007) {
                    continue;
                } else if (tp.flags.value & 0x0001) {
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.5)'; // top sprite priority
                } else if (tp.flags.value & 0x0002) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; // bottom sprite priority
                } else {
                    continue;
                }
            } else if (this.tileMask === FF6Map.TileMasks.misc) {
                if (tp.getSpecialValue() === 0xFFF7 || tp.getSpecialValue() === 0x0007) {
                    continue;
                } else if (tp.flags.value & 0x0004) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; // door
                } else if (tp.flags.value & 0x0018) {
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.5)'; // stairs
                } else if (tp.flags.value & 0x0800) {
                    ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'; // ladder
                } else {
                    continue;
                }
            }

            
            var left = (((x - xStart) << 4) - xOffset) * this.zoom;
            var top = (((y - yStart) << 4) - yOffset) * this.zoom;
            var size = 16 * this.zoom;
            
            ctx.fillRect(left, top, size, size);
        }
    }
}

FF6Map.prototype.drawScreen = function() {

    this.screenCanvas.style.display = "none";
    if (!this.showScreen) return;

    // calculate the screen rect
    var x = ((this.selection[1] * 16) - this.ppu.layers[this.l].x) & (this.ppu.width - 1);
    var y = ((this.selection[2] * 16) - this.ppu.layers[this.l].y) & (this.ppu.height - 1);
    var screenRect;
    if (this.rom.isSFC) {
        screenRect = new Rect(x - 7 * 16, x + 8 * 16, y - 6.5 * 16, y + 6.5 * 16);
    } else {
        screenRect = new Rect(x - 7 * 16, x + 8 * 16, y - 5 * 16, y + 5 * 16);
    }

    if (this.m >= 3) {
        // adjust the screen based on the map width
        if (this.mapProperties.width.value !== 0) {
            var maxWidth = this.mapProperties.width.value * 16 + 16;
            if (screenRect.l <= 16) screenRect = screenRect.offset(16 - screenRect.l, 0);
            if (screenRect.r > maxWidth) screenRect = screenRect.offset(maxWidth - screenRect.r, 0);
        }

        // adjust the screen based on the map height
        if (this.mapProperties.height.value !== 0) {
            var minHeight = this.rom.isSFC ? 8 : 16;
            var maxHeight = this.mapProperties.height.value * 16 - (this.rom.isSFC ? 8 : 0);
            if (screenRect.t <= minHeight) screenRect = screenRect.offset(0, minHeight - screenRect.t);
            if (screenRect.b > maxHeight) screenRect = screenRect.offset(0, maxHeight - screenRect.b);
        }
        screenRect.l = Math.max(0, screenRect.l);
        screenRect.r = Math.min(this.ppu.width, screenRect.r);
        screenRect.t = Math.max(0, screenRect.t);
        screenRect.b = Math.min(this.ppu.height, screenRect.b);
    }

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
    
    if (this.m < 3 && this.rom.isGBA) {
        screenRect.l += 16 * this.zoom;
        screenRect.r -= 16 * this.zoom;
        screenRect.t += 5 * this.zoom;
        screenRect.b -= 35 * this.zoom;
        ctx.beginPath();
        ctx.moveTo(screenRect.l, screenRect.t);
        ctx.lineTo(screenRect.l + 29 * this.zoom, screenRect.b);
        ctx.lineTo(screenRect.r - 29 * this.zoom, screenRect.b);
        ctx.lineTo(screenRect.r, screenRect.t);
        ctx.lineTo(screenRect.l, screenRect.t);
        ctx.fill();
    } else if (this.m < 3 && this.rom.isSFC) {
        screenRect.t -= 9 * this.zoom;
        screenRect.b -= 42 * this.zoom;
        ctx.beginPath();
        ctx.moveTo(screenRect.l, screenRect.t);
        ctx.lineTo(screenRect.l + 52 * this.zoom, screenRect.b);
        ctx.lineTo(screenRect.r - 52 * this.zoom, screenRect.b);
        ctx.lineTo(screenRect.r, screenRect.t);
        ctx.lineTo(screenRect.l, screenRect.t);
        ctx.fill();
    } else {
        ctx.fillRect(screenRect.l, screenRect.t, screenRect.w, screenRect.h);
    }    
}

FF6Map.prototype.drawCursor = function() {
    
    this.cursorCanvas.style.display = "none";
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

        if (this.selectedTrigger.vertical) {
            var length = this.selectedTrigger.length.value;
            var vertical = this.selectedTrigger.vertical.value;
            if (vertical) {
                h = 16 * this.zoom * (length);
            } else {
                w = 16 * this.zoom * (length);
            }
        }

        switch (this.selectedTrigger.key) {
            case "eventTriggers":
            case "eventTriggersAdvance":
                c = "rgba(0, 0, 255, 1.0)"; break;
            case "entranceTriggersSingle": c = "rgba(255, 0, 0, 1.0)"; break;
            case "entranceTriggersMulti": c = "rgba(0, 128, 0, 1.0)"; break;
            case "treasureProperties": c = "rgba(255, 255, 0, 1.0)"; break;
            case "npcProperties":
            case "npcPropertiesAdvance":
                c = "rgba(128, 128, 128, 1.0)"; break;
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

FF6Map.prototype.selectObject = function(object) {
    this.show();
    this.tileset.show();
    this.loadMap(object.i);
}

FF6Map.prototype.show = function() {
    
    var map = this;

    this.resetControls();
    this.showControls();
    this.addTwoState("showLayer1", function() { map.changeLayer("showLayer1"); }, "Layer 1", this.showLayer1);
    this.addTwoState("showLayer2", function() { map.changeLayer("showLayer2"); }, "Layer 2", this.showLayer2);
    this.addTwoState("showLayer3", function() { map.changeLayer("showLayer3"); }, "Layer 3", this.showLayer3);
    this.addTwoState("showTriggers", function() { map.changeLayer("showTriggers"); }, "Triggers", this.showTriggers);
    
    var maskKeys = Object.keys(FF6Map.TileMasks);
    var maskNames = [];
    for (var i = 0; i < maskKeys.length; i++) maskNames[i] = FF6Map.TileMasks[maskKeys[i]];
    var onChangeMask = function(mask) {
        map.tileMask = FF6Map.TileMasks[maskKeys[mask]];
        map.drawMap();
        map.tileset.selectLayer(map.l);
    }
    var maskSelected = function(mask) { return map.tileMask === FF6Map.TileMasks[maskKeys[mask]]; }
    this.addList("showMask", "Mask", maskNames, onChangeMask, maskSelected);

    this.addTwoState("showScreen", function() { map.changeLayer("showScreen"); }, "Screen", this.showScreen);
    this.addZoom(this.zoom, function() { map.changeZoom(); });
}

FF6Map.prototype.hide = function() {
    this.observer.stopObservingAll();
}

FF6Map.prototype.loadMap = function(m) {
    
    var layerButtons = document.getElementsByClassName("toolbox-button");
    layerButtons[1].disabled = false;
    layerButtons[2].disabled = false;

    // set the map index
    m = Number(m);
    if (isNumber(m) && this.m !== m) {
        this.m = m;
        this.observer.stopObservingAll();
        if (this.m < 3) {
            this.loadWorldMap(this.m);
            return;
        }
        this.mapProperties = this.rom.mapProperties.item(this.m);
        this.observer.startObserving(this.mapProperties, this.loadMap);
        
        // set the default battle background
        var battleEditor = propertyList.getEditor("FF6Battle");
        if (battleEditor) battleEditor.bg = this.mapProperties.battleBackground.value;
    }

    // get map properties
    this.isWorld = false;
    var map = this.mapProperties;
    if (!map) return;
    
    // load graphics
    var gfx = new Uint8Array(0x10000);
    gfx.set(this.rom.mapGraphics.item(map.gfx1.value).data, 0x0000);
    gfx.set(this.rom.mapGraphics.item(map.gfx2.value).data, 0x4000);
    gfx.set(this.rom.mapGraphics.item(map.gfx3.value).data, 0x6000);
    if (map.gfx3 != map.gfx4) {
        gfx.set(this.rom.mapGraphics.item(map.gfx4.value).data, 0x8000);
    }

    // load animation graphics
    var animGfx = this.rom.mapAnimationGraphics.data;
    var anim = this.rom.mapAnimationProperties.item(map.animation.value);
    for (i = 0; i < anim.arrayLength; i++) {
        var f = anim.item(i).frame1.value * 2;
        gfx.set(animGfx.subarray(f, f + 0x100), 0xA000 + i * 0x0100);
    }

    // load layer 3 graphics
    var graphicsLayer3 = this.rom.mapGraphicsLayer3.item(map.gfxLayer3.value);
    gfx.set(graphicsLayer3.graphics.data, 0xC000);

    // load layer 3 animation graphics
    if (map.animationLayer3.value != 0) {
        animGfx = this.rom.mapAnimationGraphicsLayer3.item(map.animationLayer3.value - 1).data;
        var anim = this.rom.mapAnimationPropertiesLayer3.item(map.animationLayer3.value - 1);
        var size = anim.size.value * (this.rom.isGBA ? 2 : 4);
        var f = anim.frame1.value * (this.rom.isGBA ? 2 : 4);
        gfx.set(animGfx.subarray(f, f + size), 0xC000);
    }

    // load palette
    var pal = new Uint32Array(this.rom.mapPalettes.item(map.palette.value).data);
    pal[0] = 0xFF000000; // set background color to black

    var layout, tileset;
    var mapSizes = [16, 32, 64, 128];

    // load and de-interlace tile layouts
    var height1 = mapSizes[map.vSize1.value];
    var width1 = mapSizes[map.hSize1.value];
    layout = this.rom.mapLayouts.item(map.layout1.value)
    tileset = this.rom.mapTilesets.item(map.tileset1.value).data;
    this.layer[0].loadLayout({layout: layout, tileset: tileset, w: width1, h: height1});

    var height2 = mapSizes[map.vSize2.value];
    var width2 = mapSizes[map.hSize2.value];
    layout = this.rom.mapLayouts.item(map.layout2.value)
    tileset = this.rom.mapTilesets.item(map.tileset2.value).data;
    this.layer[1].loadLayout({layout: layout, tileset: tileset, w: width2, h: height2});

    var height3 = mapSizes[map.vSize3.value];
    var width3 = mapSizes[map.hSize3.value];
    layout = this.rom.mapLayouts.item(map.layout3.value)
    tileset = graphicsLayer3.tileset.data;
    this.layer[2].loadLayout({layout: layout, tileset: tileset, w: width3, h: height3, priority: map.layer3Priority.value});

    // load overlay layout
    var overlayProperties = this.rom.mapOverlayProperties.item(map.overlay.value);
    var overlayGraphics = new Uint8Array(0x10000);
    overlayGraphics.set(this.rom.mapOverlayGraphics.data, 64);
    this.layer[3].loadLayout({layout: this.layer[0].layout, tileset: overlayProperties.data, overlayTiles: this.rom.mapOverlayLayout.data, w: width1, h: height1});
    
    // get color math properties
    var colorMath = this.rom.mapColorMath.item(map.colorMath.value);

    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = pal;
    this.ppu.height = Math.max(height1, height2, height3) * 16;
    this.ppu.width = Math.max(width1, width2, width3) * 16;
    this.ppu.back = true;
    this.ppu.subtract = colorMath.subtract.value;
    this.ppu.half = colorMath.half.value;

    // layer 1
    var format = this.rom.isSFC ? GFX.TileFormat.snes4bppTile : GFX.TileFormat.gba4bppTile;
    this.ppu.layers[0].format = format;
    this.ppu.layers[0].cols = this.layer[0].w * 2;
    this.ppu.layers[0].rows = this.layer[0].h * 2;
    this.ppu.layers[0].z[0] = GFX.Z.snes1L;
    this.ppu.layers[0].z[1] = GFX.Z.snes1H;
    this.ppu.layers[0].gfx = gfx;
    this.ppu.layers[0].tiles = this.layer[0].tiles;
    this.ppu.layers[0].main = this.showLayer1; // layer 1 always in main screen
    this.ppu.layers[0].sub = this.showLayer1 && (colorMath.subscreen.value & 0x01);
    this.ppu.layers[0].math = (colorMath.mathLayers.value & 0x01);

    // layer 2
    this.ppu.layers[1].format = format;
    this.ppu.layers[1].cols = this.layer[1].w * 2;
    this.ppu.layers[1].rows = this.layer[1].h * 2;
    this.ppu.layers[1].x = map.hOffset2.value * 16;
    this.ppu.layers[1].y = map.vOffset2.value * 16;
    this.ppu.layers[1].z[0] = GFX.Z.snes2L;
    this.ppu.layers[1].z[1] = GFX.Z.snes2H;
    this.ppu.layers[1].gfx = gfx;
    this.ppu.layers[1].tiles = this.layer[1].tiles;
    this.ppu.layers[1].main = this.showLayer2 && (colorMath.mainscreen.value & 0x02);
    this.ppu.layers[1].sub = this.showLayer2 && (colorMath.subscreen.value & 0x02);
    this.ppu.layers[1].math = (colorMath.mathLayers.value & 0x02);

    // layer 3
    var format = this.rom.isSFC ? GFX.TileFormat.snes2bppTile : GFX.TileFormat.gba2bppTile;
    this.ppu.layers[2].format = format;
    this.ppu.layers[2].cols = this.layer[2].w * 2;
    this.ppu.layers[2].rows = this.layer[2].h * 2;
    this.ppu.layers[2].x = map.hOffset3.value * 16;
    this.ppu.layers[2].y = map.vOffset3.value * 16;
    this.ppu.layers[2].z[0] = GFX.Z.snes3L;
    this.ppu.layers[2].z[1] = GFX.Z.snes3P; // always high priority layer 3
    this.ppu.layers[2].gfx = gfx.subarray(0xC000);
    this.ppu.layers[2].tiles = this.layer[2].tiles;
    this.ppu.layers[2].main = this.showLayer3 && (colorMath.mainscreen.value & 0x04);
    this.ppu.layers[2].sub = this.showLayer3 && (colorMath.subscreen.value & 0x04);
    this.ppu.layers[2].math = (colorMath.mathLayers.value & 0x04);

    // set up the overlay ppu
    this.overlayPPU = new GFX.PPU();
    this.overlayPPU.pal = new Uint32Array(4);
    this.overlayPPU.pal[0] = "0xFF000000";
    this.overlayPPU.pal[1] = "0xA0FFFFFF";
    this.overlayPPU.width = this.ppu.width;
    this.overlayPPU.height = this.ppu.width;

    // overlay layer
    this.overlayPPU.layers[0].format = GFX.TileFormat.snes2bppTile;
    this.overlayPPU.layers[0].cols = this.ppu.layers[0].cols;
    this.overlayPPU.layers[0].rows = this.ppu.layers[0].rows;
    this.overlayPPU.layers[0].z[0] = GFX.Z.top;
    this.overlayPPU.layers[0].z[1] = GFX.Z.top;
    this.overlayPPU.layers[0].gfx = overlayGraphics;
    this.overlayPPU.layers[0].tiles = this.layer[3].tiles;
    this.overlayPPU.layers[0].main = true;

    this.scrollDiv.style.width = (this.ppu.width * this.zoom).toString() + "px";
    this.scrollDiv.style.height = (this.ppu.height * this.zoom).toString() + "px";
    this.mapCanvas.width = this.ppu.width;
    this.mapCanvas.height = this.ppu.height;
    this.overlayCanvas.width = this.ppu.width;
    this.overlayCanvas.height = this.ppu.height;

    this.invalidateMap();
    this.selectedTrigger = null;
    this.loadTriggers();
    this.scroll();
    
    this.tileset.loadMap(m);
}

FF6Map.prototype.loadWorldMap = function(m) {
    
    if (this.selectedLayer && (this.selectedLayer.type === "layer2" || this.selectedLayer.type === "layer3")) {
        this.selectLayer(0);
    }
    var layerButtons = document.getElementsByClassName("toolbox-button");
    layerButtons[1].disabled = true;
    layerButtons[2].disabled = true;

    this.mapProperties = null;
    this.isWorld = true;
    propertyList.select(null);

    // load graphics and layout
    var layout = this.rom["worldLayout" + (m + 1)];
    var pal = this.rom["worldPalette" + (m + 1)].data;
    var graphicsData = this.rom["worldGraphics" + (m + 1)];
    var tileset = graphicsData.tileset.data;
    var gfx = graphicsData.graphics.data;
    var paletteAssignment = (this.rom.isSFC) ? graphicsData.paletteAssignment.data : null;
    var size = (m === 2) ? 128 : 256;
    
    // fix serpent trench map layout (ff6 advance)
    if (this.rom.isGBA && m === 2 && layout.data.length !== (size * size)) {
        layout.data = layout.data.subarray(0, (size * size));
    }
    
    this.worldLayer.loadLayout({layout: layout, tileset: tileset, w: size, h: size, paletteAssignment: paletteAssignment});
    
    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = pal;
    this.ppu.width = size * 16;
    this.ppu.height = size * 16;
    this.ppu.back = true;

    // layer 1
    var format = this.rom.isSFC ? GFX.TileFormat.snes4bppTile : GFX.TileFormat.gba4bppTile;
    this.ppu.layers[0].format = format;
    this.ppu.layers[0].cols = size * 2;
    this.ppu.layers[0].rows = size * 2;
    this.ppu.layers[0].z[0] = GFX.Z.snes1L;
    this.ppu.layers[0].z[1] = GFX.Z.snes1H;
    this.ppu.layers[0].gfx = gfx;
    this.ppu.layers[0].tiles = this.worldLayer.tiles;
    this.ppu.layers[0].main = this.showLayer1; // layer 1 always in main screen

    this.scrollDiv.style.width = (this.ppu.width * this.zoom).toString() + "px";
    this.scrollDiv.style.height = (this.ppu.height * this.zoom).toString() + "px";
    this.mapCanvas.width = this.ppu.width;
    this.mapCanvas.height = this.ppu.height;
    
    this.invalidateMap();
    this.selectedTrigger = null;
    this.loadTriggers();
    this.scroll();

    this.tileset.loadMap(m);
}

FF6Map.prototype.invalidateMap = function(rect) {
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

FF6Map.prototype.drawMap = function() {
        
    // update the map canvas
    var mapContext = this.mapCanvas.getContext('2d');
    var overlayContext = this.overlayCanvas.getContext('2d');
    var imageData;

    // draw all visible sectors
    for (var s = 0; s < this.mapSectors.length; s++) {
        // continue if this sector is already drawn
        if (this.mapSectors[s]) continue;
        
        // continue if this sector is not visible
        var col = s % (this.ppu.width >> 8);
        var row = (s / (this.ppu.width >> 8)) | 0;
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

        if (!this.isWorld) {
            imageData = overlayContext.createImageData(256, 256);
            this.overlayPPU.renderPPU(imageData.data, sectorRect.l, sectorRect.t, 256, 256);
            overlayContext.putImageData(imageData, sectorRect.l, sectorRect.t);
        }
        
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
        
        if (!this.isWorld) {
            imageData = overlayContext.createImageData(rect.w, rect.h);
            this.overlayPPU.renderPPU(imageData.data, rect.l, rect.t, rect.w, rect.h);
            overlayContext.putImageData(imageData, rect.l, rect.t);
        }
    }

    var ctx = this.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    var scaledRect = this.mapRect.scale(1 / this.zoom);
    ctx.drawImage(this.mapCanvas, scaledRect.l, scaledRect.t, scaledRect.w, scaledRect.h, 0, 0, this.mapRect.w, this.mapRect.h);
    
    this.drawMask();
    if (!this.isWorld && this.tileMask === FF6Map.TileMasks.overlay) {
        ctx.drawImage(this.overlayCanvas, scaledRect.l, scaledRect.t, scaledRect.w, scaledRect.h, 0, 0, this.mapRect.w, this.mapRect.h);
    }
    this.drawTriggers();
    this.drawScreen();
    this.drawCursor();
}

FF6Map.prototype.reloadTriggers = function() {
    this.loadTriggers();
    this.drawMap();
}

FF6Map.prototype.loadTriggers = function() {

    var i;
    this.triggers = [];
    
    // event triggers
    var triggers = this.rom.eventTriggers.item(this.m);
    if (triggers) {
        this.observer.startObserving(triggers, this.reloadTriggers);
        for (i = 0; i < triggers.arrayLength; i++) {
            this.triggers.push(triggers.item(i));
        }
    }
    
    triggers = this.rom.eventTriggersAdvance;
    if (this.rom.isGBA && triggers instanceof ROMArray) {
        for (i = 0; i < triggers.arrayLength; i++) {
            var trigger = triggers.item(i);
            if (trigger.map.value !== this.m) continue;
            this.observer.startObserving(trigger, this.reloadTriggers);
            this.triggers.push(trigger);
        }
    }
    
    // single-tile entrance triggers
    triggers = this.rom.entranceTriggersSingle.item(this.m);
    if (triggers) {
        this.observer.startObserving(triggers, this.reloadTriggers);
        for (i = 0; i < triggers.arrayLength; i++) {
            this.triggers.push(triggers.item(i));
        }
    }
    
    // return if a world map
    if (this.m < 3) return;
    
    // multi-tile entrance triggers
    triggers = this.rom.entranceTriggersMulti.item(this.m);
    if (triggers) {
        this.observer.startObserving(triggers, this.reloadTriggers);
        for (i = 0; i < triggers.arrayLength; i++) {
            this.triggers.push(triggers.item(i));
        }
    }
    
    triggers = this.rom.treasureProperties.item(this.m);
    if (triggers) {
        this.observer.startObserving(triggers, this.reloadTriggers);
        for (i = 0; i < triggers.arrayLength; i++) {
            this.triggers.push(triggers.item(i));
        }
    }
    
    // npcs
    triggers = this.rom.npcProperties.item(this.m);
    if (triggers) {
        this.observer.startObserving(triggers, this.reloadTriggers);
        for (i = 0; i < triggers.arrayLength; i++) {

            var npc = triggers.item(i);
            if (npc.vehicle.value === 0 && npc.specialNPC.value) {
                // special npc
                npc.scriptPointer.invalid = true;
                npc.showRider.invalid = true;
                npc.specialNPC.invalid = true;
                npc.vehicle.invalid = true;
                npc.reaction.invalid = true;
                npc.name = "Special NPC Properties";
            } else {
                // normal npc
                npc.vramAddress.invalid = true;
                npc.hFlip.invalid = true;
                npc.offset.invalid = true;
                npc.master.invalid = true;
                npc.offsetDirection.invalid = true;
                npc.slave.invalid = true;
                npc.specialNPC.invalid = true;
                npc.is32x32.invalid = true;
                npc.name = "NPC Properties";
            }

            this.triggers.push(triggers.item(i));
        }
    }
    
    triggers = this.rom.npcPropertiesAdvance;
    if (this.rom.isGBA && triggers instanceof ROMArray) {
        for (i = 0; i < triggers.arrayLength; i++) {
            var trigger = triggers.item(i);
            if (trigger.map.value !== this.m) continue;
            this.observer.startObserving(trigger, this.reloadTriggers);
            this.triggers.push(trigger);
        }
    }
    
    // map start-up event
    if (this.rom.isGBA) {
        var mapProperties = this.rom.mapProperties.item(this.m);
        var startupEvents = this.rom.mapStartupEventGBA;
        for (i = 0; i < startupEvents.arrayLength; i++) {
            var event = startupEvents.item(i);
            if (event.map.value !== this.m) continue;
            mapProperties.assembly.scriptPointerGBA.invalid = false;
            mapProperties.assembly.scriptPointerGBA.external = "mapStartupEventGBA[" + i.toString() + "].scriptPointer";
            break;
        }
    }
}

FF6Map.prototype.insertTrigger = function(type) {
    
    this.closeMenu();    
    var triggers = this.rom[type].item(this.m);
    var trigger = triggers.blankAssembly();

    this.beginAction(this.reloadTriggers);
    triggers.insertAssembly(trigger);
    trigger.x.setValue(this.clickPoint.x);
    trigger.y.setValue(this.clickPoint.y);
    this.endAction(this.reloadTriggers);

    this.selectedTrigger = trigger;
    propertyList.select(trigger);
}

FF6Map.prototype.deleteTrigger = function() {
    
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

FF6Map.prototype.drawTriggers = function() {
    
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
            case "eventTriggers":
            case "eventTriggersAdvance":
                c = "rgba(0, 0, 255, 0.5)";
                break;
            case "entranceTriggersSingle":
                c = "rgba(255, 0, 0, 0.5)";
                break;
            case "entranceTriggersMulti":
                c = "rgba(0, 128, 0, 0.5)";
                var length = trigger.length.value;
                var v = trigger.vertical.value;
                for (var t = 0; t < length; t++) {
                    drawTriggerRect(trigger.x.value + (v ? 0 : t), trigger.y.value + (v ? t : 0), c)
                }
                continue;
            case "treasureProperties":
                c = "rgba(255, 255, 0, 0.5)";
                break;
            case "npcProperties":
            case "npcPropertiesAdvance":
                c = "rgba(128, 128, 128, 0.5)";
                break;
        }
        drawTriggerRect(trigger.x.value, trigger.y.value, c);
    }
    
    // draw npcs (sort by y-coordinate and sprite priority)
    var npcs = this.triggers.filter(function(trigger) {
        return (trigger.key.startsWith("npcProperties"));
    });
    npcs = npcs.sort(function(trigger1, trigger2) {
        var y1 = trigger1.y.value;
        var y2 = trigger2.y.value;
        if (y1 !== y2) return y1 - y2;
        return trigger1.spritePriority.value - trigger2.spritePriority.value;
    });
    for (i = 0; i < npcs.length; i++) {
        var npc = npcs[i];
        this.drawNPC(npc);
    }
}

FF6Map.prototype.triggerAt = function(x, y) {
    
    var triggers = this.triggersAt(x, y);
    if (triggers.length === 0) return null;
    return triggers[0];
}

FF6Map.prototype.triggersAt = function (x, y) {
    var left, right, top, bottom, length, vertical;
    var zoom = this.zoom;
    var triggers = [];
    
    for (var i = 0; i < this.triggers.length; i++) {
        var trigger = this.triggers[i];
        left = trigger.x.value * 16 * zoom;
        right = left + 16 * zoom;
        top = trigger.y.value * 16 * zoom;
        bottom = top + 16 * zoom;
        
        if (trigger.vertical) {
            length = trigger.length.value;
            vertical = trigger.vertical.value;
            if (vertical) {
                bottom = top + 16 * zoom * (length);
            } else {
                right = left + 16 * zoom * (length);
            }
        }
        
        if (x >= left && x < right && y >= top && y < bottom)
            triggers.push(trigger);        
    }
    return triggers;
}

FF6Map.prototype.rectForTrigger = function(trigger) {
    var l = trigger.x.value * 16 * this.zoom;
    var r = l + 16 * this.zoom;
    var t = trigger.y.value * 16 * this.zoom;
    var b = t + 16 * this.zoom;
    
    if (trigger.vertical) {
        var length = trigger.length.value;
        var vertical = trigger.vertical.value;
        if (vertical) {
            b = t + 16 * this.zoom * (length + 1);
        } else {
            r = l + 16 * this.zoom * (length + 1);
        }
    }

    return new Rect(l, r, t, b);
}

FF6Map.prototype.drawNPC = function(npc) {
    
    var x = npc.x.value * 16;
    var y = npc.y.value * 16 - 16;
    var w = 16;
    var h = 24;

    var vehicle = npc.vehicle.value;
    var showRider = npc.showRider.value;
    var direction = npc.direction.value;
    var animation = npc.animation.value;
    var frameIndex = 0;
    var tileCount = 6;
    var is32x32 = false;
    var hFlip = false;
    var specialNPC = (vehicle === 0 && npc.specialNPC.value);

    if (specialNPC) {
        // special npc
        is32x32 = npc.is32x32.value;
        hFlip = npc.hFlip.value;
        var offset = 0;
        
        offset = npc.offset.value * 2;
        if (npc.slave.value) {
            var m = npc.master.value;
            if (!npc.parent.array || m >= npc.parent.arrayLength) {
                this.rom.log("Invalid Master NPC");
            } else {
                var master = npc.parent.array[m];
                x = master.x.value * 16;
                y = master.y.value * 16 - 16;
                offset = npc.offset.value * 16;
            }
        }
        
        if (npc.offsetDirection.value) {
            y += offset;
        } else {
            x += offset;
        }
        y += 8;
        
        if (is32x32) {
            tileCount = 16;
            w = 32; h = 32;
        } else {
            tileCount = 4;
            w = 16; h = 16;
        }
    } else if (animation === 0) {
        // normal npc
        var facingFrames = [0x04, 0x47, 0x01, 0x07];
        if ((vehicle === 1) || (vehicle === 2)) {
            // show riding frame when facing left or right on a vehicle (except raft)
            facingFrames[1] = 0x6E;
            facingFrames[3] = 0x2E;
        }
        frameIndex = facingFrames[direction];
        if (frameIndex & 0x40) hFlip = true;
    } else if (animation === 2) {
        frameIndex = 0x32;
    } else if (animation === 3) {
        frameIndex = 0x28;
    }
    
    // get the sprite tile layout
    var tileLayout = this.rom.mapSpriteLayouts.item(frameIndex & 0x3F);

    // get a pointer to the sprite graphics
//    var gfxPointerLo = this.rom.mapSpritePointersLo.item(npc.graphics.value).pointer.value;
//    var gfxPointerHi = this.rom.mapSpritePointersHi.item(npc.graphics.value).pointer.value;
//    var gfxPointer = gfxPointerLo | (gfxPointerHi << 16);
//    gfxPointer &= 0x00FFFFFF;
//    if (this.rom.isSFC) {
//        gfxPointer -= this.rom.unmapAddress(this.rom.mapSpriteGraphics.range.begin);
//    } else {
//        gfxPointer -= 0xF60000;
//    }

    // decode graphics
    var p = npc.palette.value << 9;
    var gfx = new Uint8Array(0x8000);
    var tileData = new Uint16Array(tileCount);
    for (var t = 0; t < tileCount; t++) {
        var tileOffset = (specialNPC ? t * 0x20 : tileLayout["tile" + (t + 1)].value) * 2;
        var rawGraphics = this.rom.mapSpriteGraphics.item(npc.graphics.value).data.subarray(tileOffset, tileOffset + 0x40);
        gfx.set(rawGraphics, t * 0x40);
        if (hFlip) {
            tileData[t ^ (is32x32 ? 3 : 1)] = t | p | 0x4000;
        } else {
            tileData[t] = t | p;
        }
    }

    // load palette
    var pal = new Uint32Array(0x80);
    pal.set(this.rom.mapSpritePalettes.item(0).data, 0x00);
    pal.set(this.rom.mapSpritePalettes.item(1).data, 0x10);
    pal.set(this.rom.mapSpritePalettes.item(2).data, 0x20);
    pal.set(this.rom.mapSpritePalettes.item(3).data, 0x30);
    pal.set(this.rom.mapSpritePalettes.item(4).data, 0x40);
    pal.set(this.rom.mapSpritePalettes.item(5).data, 0x50);
    pal.set(this.rom.mapSpritePalettes.item(6).data, 0x60);
    pal.set(this.rom.mapSpritePalettes.item(7).data, 0x70);

    function drawVehicle() {
        if (vehicle === 0) return;
        if (specialNPC) return;
        if (animation) return;

        var vx = x;
        var vy = y;
        var vw = 32;
        var vh = 32;
        var vp = 7; // vehicle palette
        
        // get the vehicle tile layout
        var vehicleTiles = new Uint16Array(16);
        if (vehicle === 1) {
            // chocobo
            switch (direction) {

                case 0: // up
                    vehicleTiles.set([
                        0x2F4C, 0x2F4D,
                        0x2F5C, 0x2F5D,
                        0x2F4E, 0x2F4F,
                        0x2F5E, 0x2F5F]);
                    vw = 16;
                    h = 16;
                    y -= 3;
                    break;

                case 1: // right
                    vehicleTiles.set([
                        0x6F69, 0x6F68, 0x6F65, 0x6F64,
                        0x6F79, 0x6F78, 0x6F75, 0x6F74,
                        0x6F6B, 0x6F6A, 0x6F67, 0x6F66,
                        0x6F7B, 0x6F7A, 0x6F77, 0x6F76]);
                    vx -= 8;
                    x -= 3;
                    y -= 4;
                    break;

                case 2: // down
                    vehicleTiles.set([
                        0x2F42, 0x2F43,
                        0x2F52, 0x2F53,
                        0x2F44, 0x2F45,
                        0x2F54, 0x2F55]);
                    vw = 16;
                    h = 16;
                    y -= 5;
                    break;

                case 3: // left
                    vehicleTiles.set([
                        0x2F64, 0x2F65, 0x2F68, 0x2F69,
                        0x2F74, 0x2F75, 0x2F78, 0x2F79,
                        0x2F66, 0x2F67, 0x2F6A, 0x2F6B,
                        0x2F76, 0x2F77, 0x2F7A, 0x2F7B]);
                    vx -= 8;
                    x += 3;
                    y -= 4;
                    break;
            }

        } else if (vehicle === 2) {
            // magitek
            vx -= 8;
            h = 16;
            y -= 6;

            switch (direction) {
                case 0:
                    vehicleTiles.set([
                    0x2FAC, 0x2FAD, 0x6FAD, 0x6FAC,
                    0x2FBC, 0x2FBD, 0x6FBD, 0x6FBC,
                    0x2FAE, 0x2FAF, 0x6FAF, 0x6FAE,
                    0x2FBE, 0x2FBF, 0x6FBF, 0x6FBE]);
                    break;

                case 1:
                    vehicleTiles.set([
                    0x6FCB, 0x6FCA, 0x6FC9, 0x6FC8,
                    0x6FDB, 0x6FDA, 0x6FD9, 0x6FD8,
                    0x6FCF, 0x6FCE, 0x6FCD, 0x6FCC,
                    0x6FDF, 0x6FDE, 0x6FDD, 0x6FDC]);
                    break;

                case 2:
                    vehicleTiles.set([
                    0x2FA0, 0x2FA1, 0x6FA1, 0x6FA0,
                    0x2FB0, 0x2FB1, 0x6FB1, 0x6FB0,
                    0x2FA2, 0x2FA3, 0x6FA3, 0x6FA2,
                    0x2FB2, 0x2FB3, 0x6FB3, 0x6FB2]);
                    break;

                case 3:
                    vehicleTiles.set([
                    0x2FC8, 0x2FC9, 0x2FCA, 0x2FCB,
                    0x2FD8, 0x2FD9, 0x2FDA, 0x2FDB,
                    0x2FCC, 0x2FCD, 0x2FCE, 0x2FCF,
                    0x2FDC, 0x2FDD, 0x2FDE, 0x2FDF]);
                    break;
            }

        } else if (vehicle === 3) {
            // raft
            vx -= 8;
            y -= 8;
            vp = 11;
            
            switch (direction) {
                case 0:
                case 2:
                    vehicleTiles.set([
                    0x2F20, 0x2F21, 0x2F24, 0x2F25,
                    0x2F30, 0x2F31, 0x2F34, 0x2F35,
                    0x2F22, 0x2F23, 0x2F26, 0x2F27,
                    0x2F32, 0x2F33, 0x2F36, 0x2F37]);
                    break;

                case 1:
                case 3:
                    vehicleTiles.set([
                    0x2F28, 0x2F29, 0x2F2C, 0x2F2D,
                    0x2F38, 0x2F39, 0x2F3C, 0x2F3D,
                    0x2F2A, 0x2F2B, 0x2F2E, 0x2F2F,
                    0x2F3A, 0x2F3B, 0x2F3E, 0x2F3F]);
                    break;
            }
        }
        
        var vehicleRect = new Rect(vx, vx + vw, vy, vy + vh);
        vehicleRect = vehicleRect.scale(this.zoom);
        if (this.mapRect.intersect(vehicleRect).isEmpty()) return;

        // load vehicle graphics
        var vehicleGraphics = this.rom.vehicleGraphics.data.subarray(0, 0x3800);
        gfx.set(vehicleGraphics, 0x4800);

        // load vehicle palette
        pal.set(this.rom.mapSpritePalettes.item(vp).data, 0x70);

        // set up the ppu
        var ppu = new GFX.PPU();
        ppu.pal = pal;
        ppu.width = vw;
        ppu.height = vh;

        // layer 1
        ppu.layers[0].format = GFX.TileFormat.snesSpriteTile;
        ppu.layers[0].cols = vw >> 3;
        ppu.layers[0].rows = vh >> 3;
        ppu.layers[0].z[0] = GFX.Z.snesS0;
        ppu.layers[0].z[1] = GFX.Z.snesS1;
        ppu.layers[0].z[2] = GFX.Z.snesS2;
        ppu.layers[0].z[3] = GFX.Z.snesS3;
        ppu.layers[0].gfx = gfx;
        ppu.layers[0].tiles = vehicleTiles;
        ppu.layers[0].main = true;

        // draw the vehicle
        this.npcCanvas.width = vw;
        this.npcCanvas.height = vh;
        var npcContext = this.npcCanvas.getContext('2d');
        var imageData = npcContext.createImageData(vw, vh);
        ppu.renderPPU(imageData.data);
        npcContext.putImageData(imageData, 0, 0);

        var ctx = this.canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        vehicleRect = vehicleRect.offset(-this.mapRect.l, -this.mapRect.t);
        ctx.drawImage(this.npcCanvas, 0, 0, vw, vh, vehicleRect.l, vehicleRect.t, vehicleRect.w, vehicleRect.h);
    }
    
    function drawSprite() {
        
        if (vehicle && !showRider && !specialNPC && !animation) return;
        
        var npcRect = new Rect(x, x + w, y, y + h);
        npcRect = npcRect.scale(this.zoom);
        if (this.mapRect.intersect(npcRect).isEmpty()) return;

        // set up the ppu
        var ppu = new GFX.PPU();
        ppu.pal = pal;
        ppu.width = w;
        ppu.height = h;

        // layer 1
        ppu.layers[0].format = GFX.TileFormat.snesSpriteTile;
        ppu.layers[0].cols = w >> 3;
        ppu.layers[0].rows = h >> 3;
        ppu.layers[0].z[0] = GFX.Z.snesS0;
        ppu.layers[0].z[1] = GFX.Z.snesS1;
        ppu.layers[0].z[2] = GFX.Z.snesS2;
        ppu.layers[0].z[3] = GFX.Z.snesS3;
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
        npcRect = npcRect.offset(-this.mapRect.l, -this.mapRect.t);
        ctx.drawImage(this.npcCanvas, 0, 0, w, h, npcRect.l, npcRect.t, npcRect.w, npcRect.h);
    }
    
    function drawTail() {
        if (vehicle !== 1) return;
        if (animation) return;

        var tx = x;
        var ty = y + 12;
        var tw = 16;
        var th = 16;
        
        // get the tail/head tile layout
        var tailTiles = new Uint16Array(4);
        switch (direction) {

            case 0: // up
                tailTiles.set([
                    0x2F4A, 0x2F4B,
                    0x2F5A, 0x2F5B]);
                ty += 1;
                break;

            case 2: // down
                tailTiles.set([
                    0x2F40, 0x2F41,
                    0x2F50, 0x2F51]);
                break;

            default: return;
        }

        var tailRect = new Rect(tx, tx + tw, ty, ty + th);
        tailRect = tailRect.scale(this.zoom);
        if (this.mapRect.intersect(tailRect).isEmpty()) return;

        // set up the ppu
        var ppu = new GFX.PPU();
        ppu.pal = pal;
        ppu.width = tw;
        ppu.height = th;

        // layer 1
        ppu.layers[0].format = GFX.TileFormat.snesSpriteTile;
        ppu.layers[0].cols = 2;
        ppu.layers[0].rows = 2;
        ppu.layers[0].z[0] = GFX.Z.snesS0;
        ppu.layers[0].z[1] = GFX.Z.snesS1;
        ppu.layers[0].z[2] = GFX.Z.snesS2;
        ppu.layers[0].z[3] = GFX.Z.snesS3;
        ppu.layers[0].gfx = gfx;
        ppu.layers[0].tiles = tailTiles;
        ppu.layers[0].main = true;

        // draw the vehicle
        this.npcCanvas.width = tw;
        this.npcCanvas.height = th;
        var npcContext = this.npcCanvas.getContext('2d');
        var imageData = npcContext.createImageData(tw, th);
        ppu.renderPPU(imageData.data);
        npcContext.putImageData(imageData, 0, 0);

        var ctx = this.canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        tailRect = tailRect.offset(-this.mapRect.l, -this.mapRect.t);
        ctx.drawImage(this.npcCanvas, 0, 0, tw, th, tailRect.l, tailRect.t, tailRect.w, tailRect.h);
    }

    drawVehicle.call(this);
    drawSprite.call(this);
    drawTail.call(this);
}

// FF6MapTileset
function FF6MapTileset(rom, map) {

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

    this.layer = [new FF6MapLayer(rom, FF6MapLayer.Type.layer1),
                  new FF6MapLayer(rom, FF6MapLayer.Type.layer2),
                  new FF6MapLayer(rom, FF6MapLayer.Type.layer3),
                  new FF6MapLayer(rom, FF6MapLayer.Type.overlay)];
    this.worldLayer = new FF6MapLayer(rom, FF6MapLayer.Type.world);

    this.selection = new Uint8Array([0x73, 0, 0, 1, 1, 0]);
    this.clickedCol = null;
    this.clickedRow = null;
    
    this.ppu = new GFX.PPU();
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.width = 256;
    this.overlayCanvas.height = 256;
    this.overlayPPU = new GFX.PPU();

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

FF6MapTileset.prototype.show = function() {
    this.div = document.getElementById('toolbox-div');
    this.div.innerHTML = "";
    this.div.classList.remove('hidden');
    this.div.appendChild(this.canvas);
    this.div.appendChild(this.cursorCanvas);

    this.cursorCanvas.classList.remove('hidden');
    document.getElementById("toolbox-buttons").classList.remove('hidden');
}

FF6MapTileset.prototype.mouseDown = function(e) {
    var x = e.offsetX;
    var y = e.offsetY;
    this.clickedCol = x >> 4;
    this.clickedRow = y >> 4;
    this.mouseMove(e);
}

FF6MapTileset.prototype.mouseUp = function(e) {
    this.clickedCol = null;
    this.clickedRow = null;
}

FF6MapTileset.prototype.mouseOut = function(e) {
    this.mouseUp(e);
}

FF6MapTileset.prototype.mouseMove = function(e) {

    // return unless dragging (except if trigger layer selected)
    if (!isNumber(this.clickedCol) || !isNumber(this.clickedRow) || this.map.l === 3) return;

    var col = e.offsetX >> 4;
    var row = e.offsetY >> 4;
    var col = Math.min(e.offsetX >> 4, 15);
    var row = Math.min(e.offsetY >> 4, 15);
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
    if (cols === 1 && rows === 1) this.map.selectTileProperties(this.selection[5]);
}

FF6MapTileset.prototype.selectLayer = function(l) {
    
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
    
    if (this.map.l === 3) {
        // hide the canvas is the trigger layer is selected
//        this.canvas.classList.add("hidden");
//        this.cursorCanvas.classList.add("hidden");
        this.canvas.parentElement.style.height = "0px";
        this.canvas.parentElement.classList.add("hidden");
        return;
    }
    
    // render the image on the canvas
    this.canvas.height = 256;
    this.canvas.width = 256;
    this.cursorCanvas.height = 256;
    this.cursorCanvas.width = 256;
//    this.canvas.style.display = "block";
//    this.cursorCanvas.style.display = "block";
    this.canvas.parentElement.style.height = "256px";
    this.canvas.parentElement.classList.remove("hidden");

    var ctx = this.canvas.getContext('2d');
    var imageData = ctx.createImageData(this.ppu.width, this.ppu.height);
    this.ppu.layers[this.map.l].main = true;
    this.ppu.renderPPU(imageData.data);
    ctx.putImageData(imageData, 0, 0);
    if (this.map.selectedLayer.type === FF6MapLayer.Type.layer1 && this.map.tileMask === FF6Map.TileMasks.overlay) {
        var overlayCtx = this.overlayCanvas.getContext('2d');
        imageData = overlayCtx.createImageData(this.overlayPPU.width, this.overlayPPU.height);
        this.overlayPPU.renderPPU(imageData.data);
        overlayCtx.putImageData(imageData, 0, 0);
        ctx.drawImage(this.overlayCanvas, 0, 0);
    }
    this.drawMask();
    this.drawCursor();
}

FF6MapTileset.prototype.drawCursor = function() {
    
    // clear the cursor canvas
    var ctx = this.cursorCanvas.getContext('2d');
    ctx.clearRect(0, 0, this.ppu.width, this.ppu.height);

    // return if trigger layer is selected
    if (this.map.l === 3) return;
    if (!this.selection) return;
    
    // get the cursor geometry
    var x = this.selection[1] << 4;
    var y = this.selection[2] << 4;
    var w = this.selection[3] << 4;
    var h = this.selection[4] << 4;

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

FF6MapTileset.prototype.drawMask = function() {
    
    if (this.map.isWorld) return; // world map not implemented yet
    if (this.map.l !== 0) return; // only for layer 1
    if (this.map.tileMask === FF6Map.TileMasks.none) return;
    if (this.map.tileMask === FF6Map.TileMasks.overlay) return;

    var ctx = this.canvas.getContext('2d');

    // draw the mask at each tile
    for (var y = 0; y < 16; y++) {
        for (var x = 0; x < 16; x++) {
            
            var tile = x + y * 16;
            var tp = this.map.tilePropertiesAtTile(tile);
            if (!tp) continue;
            
            if (this.map.tileMask === FF6Map.TileMasks.zUpper) {
                if (tp.getSpecialValue() === 0xFFF7 || tp.getSpecialValue() === 0x0007) {
                    ctx.fillStyle = 'rgba(0, 0, 255, 0.5)'; // impassable
                } else if (tp.zLevel.value & 1) {
                    continue;
                } else if (tp.zLevel.value === 4) {
                    ctx.fillStyle = 'rgba(0, 255, 255, 0.5)'; // bridge
                } else {
                    ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
                }
            } else if (this.map.tileMask === FF6Map.TileMasks.zLower) {
                if (tp.getSpecialValue() === 0xFFF7 || tp.getSpecialValue() === 0x0007) {
                    ctx.fillStyle = 'rgba(0, 0, 255, 0.5)'; // impassable
                } else if (tp.zLevel.value & 2) {
                    continue;
                } else if (tp.zLevel.value === 4) {
                    ctx.fillStyle = 'rgba(0, 255, 255, 0.5)'; // bridge
                } else {
                    ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
                }
            } else if (this.map.tileMask === FF6Map.TileMasks.npcPassability) {
                if (tp.getSpecialValue() === 0xFFF7 || tp.getSpecialValue() === 0x0007) {
                    ctx.fillStyle = 'rgba(0, 0, 255, 0.5)'; // impassable
                } else if (tp.flags.value & 0x1000) {
                    continue;
                } else {
                    ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
                }
            } else if (this.map.tileMask === FF6Map.TileMasks.spritePriority) {
                if (tp.getSpecialValue() === 0xFFF7 || tp.getSpecialValue() === 0x0007) {
                    continue;
                } else if (tp.flags.value & 0x0001) {
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.5)'; // top sprite priority
                } else if (tp.flags.value & 0x0002) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; // bottom sprite priority
                } else {
                    continue;
                }
            } else if (this.map.tileMask === FF6Map.TileMasks.misc) {
                if (tp.getSpecialValue() === 0xFFF7 || tp.getSpecialValue() === 0x0007) {
                    continue;
                } else if (tp.flags.value & 0x0004) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; // door
                } else if (tp.flags.value & 0x0018) {
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.5)'; // stairs
                } else if (tp.flags.value & 0x0800) {
                    ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'; // ladder
                } else {
                    continue;
                }
            }

            
            var left = x << 4;
            var top = y << 4;
            var size = 16;
            
            ctx.fillRect(left, top, size, size);
        }
    }
}

FF6MapTileset.prototype.loadMap = function(m) {

    // create a sequential tile layout
    var layout = new Uint8Array(256);
    for (var i = 0; i < 256; i++) {
        layout[i] = i;
    }
    
    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = this.map.ppu.pal;
    this.ppu.height = 256;
    this.ppu.width = 256;
    this.ppu.back = true;

    if (this.map.m > 2) {
        this.layer[0].loadLayout({layout: layout, tileset: this.map.layer[0].tileset, w: 16, h: 16});
        this.layer[1].loadLayout({layout: layout, tileset: this.map.layer[1].tileset, w: 16, h: 16});
        this.layer[2].loadLayout({layout: layout, tileset: this.map.layer[2].tileset, w: 16, h: 16, priority: true});
        this.layer[3].loadLayout({layout: layout, tileset: this.map.layer[3].tileset, w: 16, h: 16, overlayTiles: this.rom.mapOverlayLayout.data});
        
        // layer 1
        this.ppu.layers[0].format = this.map.ppu.layers[0].format;
        this.ppu.layers[0].rows = 32;
        this.ppu.layers[0].cols = 32;
        this.ppu.layers[0].z[0] = GFX.Z.snes1L;
        this.ppu.layers[0].z[1] = GFX.Z.snes1H;
        this.ppu.layers[0].gfx = this.map.ppu.layers[0].gfx;
        this.ppu.layers[0].tiles = this.layer[0].tiles;

        // layer 2
        this.ppu.layers[1].format = this.map.ppu.layers[1].format;
        this.ppu.layers[1].rows = 32;
        this.ppu.layers[1].cols = 32;
        this.ppu.layers[1].z[0] = GFX.Z.snes2L;
        this.ppu.layers[1].z[1] = GFX.Z.snes2H;
        this.ppu.layers[1].gfx = this.map.ppu.layers[1].gfx;
        this.ppu.layers[1].tiles = this.layer[1].tiles;

        // layer 3
        this.ppu.layers[2].format = this.map.ppu.layers[2].format;
        this.ppu.layers[2].rows = 32;
        this.ppu.layers[2].cols = 32;
        this.ppu.layers[2].z[0] = GFX.Z.snes3L;
        this.ppu.layers[2].z[1] = GFX.Z.snes3P;
        this.ppu.layers[2].gfx = this.map.ppu.layers[2].gfx;
        this.ppu.layers[2].tiles = this.layer[2].tiles;

        // overlay layer
        this.overlayPPU = new GFX.PPU();
        this.overlayPPU.pal = this.map.overlayPPU.pal;
        this.overlayPPU.height = 256;
        this.overlayPPU.width = 256;
        this.overlayPPU.layers[0].format = GFX.TileFormat.snes2bppTile;
        this.overlayPPU.layers[0].rows = 32;
        this.overlayPPU.layers[0].cols = 32;
        this.overlayPPU.layers[0].z[0] = GFX.Z.top;
        this.overlayPPU.layers[0].z[1] = GFX.Z.top;
        this.overlayPPU.layers[0].gfx = this.map.overlayPPU.layers[0].gfx;
        this.overlayPPU.layers[0].tiles = this.layer[3].tiles;
        this.overlayPPU.layers[0].main = true;

    } else {
        this.worldLayer.loadLayout({layout: layout, tileset: this.map.worldLayer.tileset, w: 16, h: 16, paletteAssignment: this.map.worldLayer.paletteAssignment})
        
        // layer 1
        this.ppu.layers[0].format = this.map.ppu.layers[0].format;
        this.ppu.layers[0].rows = 32;
        this.ppu.layers[0].cols = 32;
        this.ppu.layers[0].z[0] = GFX.Z.snes1L;
        this.ppu.layers[0].z[1] = GFX.Z.snes1H;
        this.ppu.layers[0].gfx = this.map.ppu.layers[0].gfx;
        this.ppu.layers[0].tiles = this.worldLayer.tiles;
    }
    
    this.selectLayer(this.map.l);
}

// FF6MapLayer
function FF6MapLayer(rom, type) {
    this.rom = rom;
    this.type = type;
    this.tileset = null;
    this.priority = false;
    
}

FF6MapLayer.Type = {
    layer1: "layer1",
    layer2: "layer2",
    layer3: "layer3",
    overlay: "overlay",
    world: "world"
}

FF6MapLayer.prototype.loadLayout = function(definition) {

    this.layout = definition.layout;
    this.tileset = definition.tileset;
    this.w = definition.w;
    this.h = definition.h;
    this.priority = definition.priority; // layer 3 only
    this.paletteAssignment = definition.paletteAssignment; // world map only
    if (definition.overlayTiles) {
        this.overlayTiles = new Uint16Array(definition.overlayTiles.buffer, definition.overlayTiles.byteOffset, definition.overlayTiles.byteLength >> 1);
    }

    // update tiles for the entire map
    this.tiles = new Uint16Array(this.w * this.h * 4);
    this.decodeLayout();
}

FF6MapLayer.prototype.setLayout = function(layout) {

    // layout 0 is always blank
    if (!this.layout.data) return;

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
        if (ld + clippedW > this.layout.data.length) break;
        this.layout.setData(layout.slice(ls, ls + clippedW), ld);
    }
    this.decodeLayout(x, y, clippedW, clippedH);
}

FF6MapLayer.prototype.getLayout = function(col, row, cols, rows) {
    
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
            var tile = layout[x + clippedCol + (y + clippedRow) * this.w];
            selection[5 + x + y * cols] = tile;
        }
    }
    return selection;
}

FF6MapLayer.prototype.decodeLayout = function(x, y, w, h) {
    
    x = x || 0;
    y = y || 0;
    x %= this.w;
    y %= this.h;
    w = w || this.w;
    h = h || this.h;
    w = Math.min(w, this.w - x);
    h = Math.min(h, this.h - y);
    
    // layout 0 is always blank
    if (this.layout.data && this.layout.i === 0) return;
    
    switch (this.type) {
        case FF6MapLayer.Type.layer1:
        case FF6MapLayer.Type.layer2:
            this.decodeMapLayout(x, y, w, h);
            break;
        case FF6MapLayer.Type.layer3:
            this.decodeLayer3Layout(x, y, w, h);
            break;
        case FF6MapLayer.Type.overlay:
            this.decodeOverlayLayout(x, y, w, h);
            break;
        case FF6MapLayer.Type.world:
            this.decodeWorldLayout(x, y, w, h);
            break;
        default:
            break;
    }
}

FF6MapLayer.prototype.decodeMapLayout = function(x, y, w, h) {
    
    var layout = this.layout.data || this.layout;
    var l = x + y * this.w;
    var t = x * 2 + y * this.w * 4;
    var row, col, tile, i;

    for (row = 0; row < h; row++) {
        for (col = 0; col < w; col++) {
            tile = layout[l + col];   
            i = t + col * 2;
            if (i > this.tiles.length) return;
            this.tiles[i + 0] = this.tileset[tile + 0x0000] | (this.tileset[tile + 0x0400] << 8);
            this.tiles[i + 1] = this.tileset[tile + 0x0100] | (this.tileset[tile + 0x0500] << 8);
            i += this.w * 2;
            this.tiles[i + 0] = this.tileset[tile + 0x0200] | (this.tileset[tile + 0x0600] << 8);
            this.tiles[i + 1] = this.tileset[tile + 0x0300] | (this.tileset[tile + 0x0700] << 8);
        }
        t += this.w * 4;
        l += this.w;
    }
}

FF6MapLayer.prototype.decodeLayer3Layout = function(x, y, w, h) {
    
    var layout = this.layout.data || this.layout;
    var l = x + y * this.w;
    var t = x * 2 + y * this.w * 4;
    var row, col, tile, hiByte, hf, vf, i;

    for (row = 0; row < h; row++) {
        for (col = 0; col < w; col++) {
            
            tile = layout[l + col];
            hiByte = tile & 0xC0;
            tile &= 0x3F;
            if (this.rom.isSFC) {
                hiByte |= this.tileset[tile] & 0x1C;
                if (this.priority) hiByte |= 0x20;
                tile = (tile << 2) | (hiByte << 8);
                hf = (tile & 0x4000) ? 1 : 0;
                vf = (tile & 0x8000) ? 2 : 0;
            } else {
                hiByte >>= 4;
                hiByte |= this.tileset[tile] & 0x70;
                if (this.priority) hiByte |= 0x80;
                tile = (tile << 2) | (hiByte << 8);
                hf = (tile & 0x0400) ? 1 : 0;
                vf = (tile & 0x0800) ? 2 : 0;
            }

            i = t + col * 2;
            if (i > this.tiles.length) return;
            this.tiles[i + 0] = tile++ + hf + vf;
            this.tiles[i + 1] = tile++ - hf + vf;
            i += this.w * 2;
            this.tiles[i + 0] = tile++ + hf - vf;
            this.tiles[i + 1] = tile - hf - vf;
        }
        t += this.w * 4;
        l += this.w;
    }
}

FF6MapLayer.prototype.decodeOverlayLayout = function(x, y, w, h) {
    
    var layout = this.layout.data || this.layout;
    var l = x + y * this.w;
    var t = x * 2 + y * this.w * 4;
    var row, col, tile, bg1Tile, hf, vf, i;
    
    for (row = 0; row < h; row++) {
        for (col = 0; col < w; col++) {
            
            bg1Tile = layout[l + col];
            tile = this.tileset[bg1Tile + 16];
            if (tile === 0xFF) continue;
            var flip = (tile & 0xC0) << 8;
            tile = this.tileset[((tile & 0x20) >> 2) | ((tile & 0x0E) >> 1)];
            if (tile === 0xFF) continue;
            tile <<= 2;
            hf = (flip & 0x4000) ? 1 : 0;
            vf = (flip & 0x8000) ? 2 : 0;

            i = t + col * 2;
            if (i > this.tiles.length) return;
            this.tiles[i + 0] = ((this.overlayTiles[tile++ + hf + vf] >> 3) + 1) | flip;
            this.tiles[i + 1] = ((this.overlayTiles[tile++ - hf + vf] >> 3) + 1) | flip;
            i += this.w * 2;
            this.tiles[i + 0] = ((this.overlayTiles[tile++ + hf - vf] >> 3) + 1) | flip;
            this.tiles[i + 1] = ((this.overlayTiles[tile++ - hf - vf] >> 3) + 1) | flip;
        }
        t += this.w * 4;
        l += this.w;
    }
}

FF6MapLayer.prototype.decodeWorldLayout = function(x, y, w, h) {

    var tileset = new Uint16Array(1024);
    for (var i = 0; i < 1024; i++) {
        var t = this.tileset[i];
        if (this.paletteAssignment) {
            var p = this.paletteAssignment[t >> 1];
            if (t & 1) p >>= 4;
            p &= 0x0F; p <<= 10;
            t |= p;
        }
        tileset[i] = t;
    }
    
    var layout = this.layout.data || this.layout;
    var l = x + y * this.w;
    var t = x * 2 + y * this.w * 4;
    var row, col, tile;

    for (row = 0; row < h; row++) {
        for (col = 0; col < w; col++) {
            tile = layout[l + col] * 4;
            
            i = t + col * 2;
            if (i > this.tiles.length) return;
            this.tiles[i + 0] = tileset[tile++];
            this.tiles[i + 1] = tileset[tile++];
            i += this.w * 2;
            this.tiles[i + 0] = tileset[tile++];
            this.tiles[i + 1] = tileset[tile];
        }
        t += this.w * 4;
        l += this.w;
    }
}

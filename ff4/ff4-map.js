//
// ff4-map.js
// created 3/17/2018
//

// Jap translations: http://ff4.wikidot.com/weapons

function FF4Map(rom) {
    ROMEditor.call(this, rom);
    this.name = "FF4Map";
    this.tileset = new FF4MapTileset(rom, this);

    this.div.classList.add('map-edit');

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
    this.w = 0; // world index
    this.l = 0; // selected layer
    this.zoom = 1.0; // zoom multiplier
    this.selection = new Uint8Array([0x73, 0, 0, 1, 1, 0]);
    this.clickedCol = null;
    this.clickedRow = null;
    this.clickButton = null;
    this.isDragging = false;
    this.layer = [new FF4MapLayer(rom, FF4MapLayer.Type.layer1),
                  new FF4MapLayer(rom, FF4MapLayer.Type.layer2)];
    this.selectedLayer = this.layer[0];
    // this.worldLayer = new FF4MapLayer(rom, FF4MapLayer.Type.world);
    this.triggers = [];
    this.showCursor = false;
    this.showLayer1 = true;
    this.showLayer2 = true;
    this.showTriggers = true;
    this.showScreen = false;
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

    this.initBattleGroups();
    this.updateTilesets();
}

FF4Map.prototype = Object.create(ROMEditor.prototype);
FF4Map.prototype.constructor = FF4Map;

FF4Map.prototype.initBattleGroups = function() {

    // set the battle offset for underground and moon maps
    for (var m = 256; m < 512; m++) {
        var b = this.rom.mapBattle.item(m).battleGroup.value;
        if (b === 0) continue;
        var battleGroup = this.rom.battleGroup.item(b);
        for (var i = 1; i <= 8; i++) {
            var battle = battleGroup["battle" + i.toString()];
            if (battle.offset === 256) continue;
            battle.offset = 256;
            battle.value += 256;
        }
    }

    for (m = 64; m < 84; m++) {
        var b = this.rom.worldBattle.item(m).battleGroup.value;
        if (b === 0) continue;
        var battleGroup = this.rom.battleGroupWorld.item(b);
        for (var i = 1; i <= 8; i++) {
            var battle = battleGroup["battle" + i.toString()];
            if (battle.offset === 256) continue;
            battle.offset = 256;
            battle.value += 256;
        }
    }
}

FF4Map.prototype.updateTilesets = function() {

    for (var t = 0; t < this.rom.mapTilesets.arrayLength; t++) {
        var tileset = this.rom.mapTilesets.item(t);
        var graphics = this.rom.mapGraphics.item(t);

        if (t === 0 || t === 15) {
            graphics.format = "snes4bpp";
            graphics.disassemble(graphics.parent.data);
            tileset.graphics = "mapGraphics[" + t + "]";
            continue;
        } else if (t === 14) {
            tileset.graphics = "mapGraphics[" + t + "]";
            continue;
        }

        tileset.graphics = ["mapGraphics[" + t + "]"];
        var length1 = graphics.data.length;
        var length2 = 0x6000 - graphics.data.length;
        if (length2 <= 0) continue;
        tileset.graphics.push({
            path: "mapGraphics[" + (t + 1) + "]",
            offset: length1,
            range: "0-" + length2
        });
    }

    for (var m = 0; m < this.rom.mapProperties.arrayLength; m++) {
        var mapProperties = this.rom.mapProperties.item(m);
        var g = mapProperties.graphics.value;
        var p = mapProperties.palette.value;

        var tileset = this.rom.mapTilesets.item(g);

        var paletteDefinition = [
            {
                path: "mapPalettes[" + p + "]",
                range: "0-8",
                offset: 16
            }, {
                path: "mapPalettes[" + p + "]",
                range: "8-16",
                offset: 32
            }, {
                path: "mapPalettes[" + p + "]",
                range: "16-24",
                offset: 48
            }, {
                path: "mapPalettes[" + p + "]",
                range: "24-32",
                offset: 64
            }, {
                path: "mapPalettes[" + p + "]",
                range: "32-40",
                offset: 80
            }, {
                path: "mapPalettes[" + p + "]",
                range: "40-48",
                offset: 96
            }, {
                path: "mapPalettes[" + p + "]",
                range: "48-56",
                offset: 112
            }
        ];

        if (g === 0 || g === 15) {
            paletteDefinition = paletteDefinition.concat([
                {
                    path: "mapPalettes[" + (p + 1) + "]",
                    range: "0-8",
                    offset: 24
                }, {
                    path: "mapPalettes[" + (p + 1) + "]",
                    range: "8-16",
                    offset: 40
                }, {
                    path: "mapPalettes[" + (p + 1) + "]",
                    range: "16-24",
                    offset: 56
                }, {
                    path: "mapPalettes[" + (p + 1) + "]",
                    range: "24-32",
                    offset: 72
                }, {
                    path: "mapPalettes[" + (p + 1) + "]",
                    range: "32-40",
                    offset: 88
                }, {
                    path: "mapPalettes[" + (p + 1) + "]",
                    range: "40-48",
                    offset: 104
                }, {
                    path: "mapPalettes[" + (p + 1) + "]",
                    range: "48-56",
                    offset: 120
                }]
            );
        }
        tileset.palette = [paletteDefinition];
    }
}

FF4Map.prototype.changeZoom = function() {

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

FF4Map.prototype.scroll = function() {

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

FF4Map.prototype.mouseDown = function(e) {

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

FF4Map.prototype.mouseUp = function(e) {

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

FF4Map.prototype.mouseMove = function(e) {

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

FF4Map.prototype.mouseEnter = function(e) {

    // show the cursor
    this.showCursor = true;
    this.drawScreen();
    this.drawCursor();

    this.mouseUp(e);
}

FF4Map.prototype.mouseLeave = function(e) {

    // hide the cursor
    this.showCursor = (this.l === 3);
    this.drawCursor();

    this.mouseUp(e);
}

FF4Map.prototype.updateMenu = function() {
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

FF4Map.prototype.openMenu = function(e) {
    if (this.l !== 3) return; // no menu unless editing triggers
    this.updateMenu();

    this.clickedCol = ((e.offsetX / this.zoom + this.ppu.layers[this.l].x) % this.ppu.width) >> 4;
    this.clickedRow = ((e.offsetY / this.zoom + this.ppu.layers[this.l].y) % this.ppu.height) >> 4;

    this.menu.classList.add("menu-active");
    this.menu.style.left = e.x + "px";
    this.menu.style.top = e.y + "px";
}

FF4Map.prototype.closeMenu = function() {
    this.menu.classList.remove("menu-active");
}

FF4Map.prototype.setTiles = function() {
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

FF4Map.prototype.selectTrigger = function(trigger) {
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

FF4Map.prototype.selectTiles = function() {
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

FF4Map.prototype.selectTileProperties = function(t) {
    // select tile properties
    var tileProperties;
    if (this.selectedLayer.type === FF4MapLayer.Type.layer1) {
        // layer 1 tile properties determined by graphics index
        tileProperties = this.rom.mapTileProperties.item(this.mapProperties.graphics.value);
    } else if (this.selectedLayer.type === FF4MapLayer.Type.world) {
        // world map tile properties
        tileProperties = this.rom.worldTileProperties.item(this.w);
    } else {
        // return if layer 2
        return;
    }
    propertyList.select(tileProperties.item(t));
}

FF4Map.prototype.tilePropertiesAtTile = function(t) {
    var tileProperties;

    if (this.isWorld) {
        tileProperties = this.rom.worldTileProperties.item(this.w).item(t);
    } else {
        tileProperties = this.rom.mapTileProperties.item(this.mapProperties.graphics.value).item(t);
    }

    if (!tileProperties) return 0;

    return (tileProperties.byte1.value | tileProperties.byte2.value << 8);
}

FF4Map.prototype.selectLayer = function(l) {
    // set the selected layer
    l = Number(l);
    if (isNumber(l)) this.l = l;

    // if (this.isWorld) {
    //     this.selectedLayer = this.worldLayer;
    // } else {
        this.selectedLayer = this.layer[this.l]
    // }

    this.showCursor = (this.l === 3);
    this.drawScreen();
    this.drawCursor();
}

FF4Map.prototype.selectWorldBattle = function(x, y) {

    x >>= 5;
    y >>= 5;

    var sector;
    if (this.w === 0) {
        // overworld
        x &= 7;
        y &= 7;
        sector = x + (y << 3);
    } else if (this.w === 1) {
        // underground
        offset = 64;
        x &= 3;
        y &= 3;
        sector = x + (y << 2) + 64;
    } else if (this.w === 2) {
        // moon
        offset = 80;
        x &= 1;
        y &= 1;
        sector = x + (y << 1) + 80;
    }

    var battleGroup = this.rom.worldBattle.item(sector);
    propertyList.select(battleGroup);
}

FF4Map.prototype.changeLayer = function(id) {
    this[id] = document.getElementById(id).checked;
    var map = this.rom.mapProperties.item(this.m);
    this.ppu.layers[0].main = this.showLayer1;
    if (!this.isWorld) {
        this.ppu.layers[0].sub = this.showLayer1 && this.mapProperties.addition.value;
        this.ppu.layers[1].main = this.showLayer2;
    }
    this.invalidateMap();
    this.drawMap();
}

FF4Map.TileMasks = {
    "none": "None",
    "zUpper": "Passable on Upper Z-Level",
    "zLower": "Passable on Lower Z-Level",
    "triggers": "Trigger Tiles",
    "battle": "Enable Random Battles",
    "spriteVisibility": "Sprite Visibility"
}

FF4Map.WorldTileMasks = {
    "none": "None",
    "zUpper": "Passable on Upper Z-Level",
    "zLower": "Passable on Lower Z-Level",
    "triggers": "Trigger Tiles",
    "chocoboNoLava": "Chocobo Can Move/Lava",
    "blackChocoboFly": "Black Chocobo Can Fly",
    "blackChocoboLand": "Black Chocobo Can Land",
    "hovercraft": "Hovercraft Can Move",
    "airshipFly": "Airship Can Fly (No Lava)",
    "airshipLand": "Airship Can Land",
    "lunarWhale": "Lunar Whale Can Fly",
    "battle": "Enable Random Battles",
    "forest": "Hide Bottom of Sprite",
    "unknown": "Unknown 1.2"
}

FF4Map.prototype.drawMask = function() {

    if (this.tileMask === FF4Map.TileMasks.none) return;
    if (this.tileMask === FF4Map.TileMasks.overlay) return;

    // calculate coordinates on the map rect
    var xStart = (this.mapRect.l / this.zoom) >> 4;
    var xEnd = (this.mapRect.r / this.zoom) >> 4;
    var yStart = (this.mapRect.t / this.zoom) >> 4;
    var yEnd = (this.mapRect.b / this.zoom) >> 4;
    var xOffset = (this.mapRect.l / this.zoom) % 16;
    var yOffset = (this.mapRect.t / this.zoom) % 16;

    var ctx = this.canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';

    // draw the mask at each tile
    var layout, tile;
    var w = this.layer[0].w;
    var h = this.layer[0].h;
    if (!this.isWorld) layout = this.layer[0].layout;
    for (var y = yStart; y < yEnd; y++) {
        // for world maps, get the next strip
        if (this.isWorld) layout = this.layer[0].layout[y % h];
        for (var x = xStart; x < xEnd; x++) {
            if (this.isWorld) {
                tile = layout.data[x % w];
            } else {
                tile = layout.data[x % w + (y % h) * w];
            }
            var color = this.maskColorAtTile(tile);
            if (!color) continue;
            ctx.fillStyle = color;

            var left = (((x - xStart) << 4) - xOffset) * this.zoom;
            var top = (((y - yStart) << 4) - yOffset) * this.zoom;
            var size = 16 * this.zoom;

            ctx.fillRect(left, top, size, size);
        }
    }
}

FF4Map.prototype.maskColorAtTile = function(t) {
    var tp = this.tilePropertiesAtTile(t);
    if (!tp) return null;

    if (this.isWorld) {
        if (this.tileMask === FF4Map.WorldTileMasks.zUpper) {
            if (!(tp & 0x40)) {
                return 'rgba(0, 0, 255, 0.5)';
            }
        } else if (this.tileMask === FF4Map.WorldTileMasks.zLower) {
            if (!(tp & 1)) {
                return 'rgba(0, 0, 255, 0.5)';
            }
        } else if (this.tileMask === FF4Map.WorldTileMasks.triggers) {
            if (tp & 0x1000) {
                return 'rgba(0, 255, 255, 0.5)'; // trigger (cyan)
            }
        } else if (this.tileMask === FF4Map.WorldTileMasks.battle) {
            if (tp & 0x0800) {
                return 'rgba(255, 0, 0, 0.5)';
            }
        } else if (this.tileMask === FF4Map.WorldTileMasks.forest) {
            if (tp & 0x0100) {
                return 'rgba(255, 255, 0, 0.5)'; // bottom half hidden (yellow)
            }
        } else if (this.tileMask === FF4Map.WorldTileMasks.chocoboNoLava) {
            if (tp & 0x02) {
                return 'rgba(255, 255, 0, 0.5)'; // chocobo/no lava (yellow)
            }
        } else if (this.tileMask === FF4Map.WorldTileMasks.blackChocoboFly) {
            if (tp & 0x04) {
                return 'rgba(255, 255, 0, 0.5)'; // yellow
            }
        } else if (this.tileMask === FF4Map.WorldTileMasks.blackChocoboLand) {
            if (tp & 0x08) {
                return 'rgba(255, 255, 0, 0.5)'; // yellow
            }
        } else if (this.tileMask === FF4Map.WorldTileMasks.hovercraft) {
            if (tp & 0x10) {
                return 'rgba(255, 255, 0, 0.5)'; // yellow
            }
        } else if (this.tileMask === FF4Map.WorldTileMasks.airshipFly) {
            if (tp & 0x20) {
                return 'rgba(255, 255, 0, 0.5)'; // yellow
            }
        } else if (this.tileMask === FF4Map.WorldTileMasks.airshipLand) {
            if (tp & 0x0200) {
                return 'rgba(255, 255, 0, 0.5)'; // yellow
            }
        } else if (this.tileMask === FF4Map.WorldTileMasks.lunarWhale) {
            if (tp & 0x80) {
                return 'rgba(255, 255, 0, 0.5)'; // yellow
            }
        } else if (this.tileMask === FF4Map.WorldTileMasks.unknown) {
            if (tp & 0x0400) {
                return 'rgba(255, 255, 0, 0.5)'; // yellow
            }
        }
    } else {
        if (this.tileMask === FF4Map.TileMasks.zUpper) {
            if (tp & 0x04) {
                return 'rgba(0, 255, 255, 0.5)'; // bridge
            } else if (!(tp & 0x01)) {
                return 'rgba(0, 0, 255, 0.5)';
            }
        } else if (this.tileMask === FF4Map.TileMasks.zLower) {
            if (tp & 0x04) {
                return 'rgba(0, 255, 255, 0.5)'; // bridge
            } else if (!(tp & 0x02)) {
                return 'rgba(0, 0, 255, 0.5)';
            }
        } else if (this.tileMask === FF4Map.TileMasks.triggers) {
            if (tp & 0x0008) {
                return 'rgba(0, 255, 0, 0.5)'; // save point (green)
            } else if (tp & 0x0010) {
                return 'rgba(0, 0, 255, 0.5)'; // door (blue)
            } else if (tp & 0x1000) {
                return 'rgba(255, 255, 0, 0.5)'; // exit (yellow)
            } else if (tp & 0x2000) {
                return 'rgba(255, 0, 255, 0.5)'; // through-tile (magenta)
            } else if (tp & 0x8000) {
                return 'rgba(0, 255, 255, 0.5)'; // trigger (cyan)
            } else if (tp & 0x0100) {
                return 'rgba(255, 0, 0, 0.5)'; // damage (red)
            } else if (tp & 0x0200) {
                return 'rgba(0, 255, 255, 0.5)'; // unknown (white)
            }
        } else if (this.tileMask === FF4Map.TileMasks.battle) {
            if (tp & 0x4000) {
                return 'rgba(255, 0, 0, 0.5)';
            }
        } else if (this.tileMask === FF4Map.TileMasks.spriteVisibility) {
            if (tp & 0x0400) {
                return 'rgba(0, 0, 255, 0.5)'; // entire sprite hidden (blue)
            } else if (tp & 0x0800) {
                return 'rgba(255, 255, 0, 0.5)'; // bottom half hidden (yellow)
            }
        }
    }

    return null;
}

FF4Map.prototype.drawScreen = function() {

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

FF4Map.prototype.drawCursor = function() {

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
            case "eventTriggers":
            case "mapTriggers":
                c = "rgba(0, 0, 255, 1.0)";
                break;
            case "worldTriggers":
            case "entranceTriggers":
                c = "rgba(255, 0, 0, 1.0)";
                break;
            case "treasureProperties":
                c = "rgba(255, 255, 0, 1.0)";
                break;
            case "npcProperties":
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

FF4Map.prototype.selectObject = function(object) {
    this.loadMap(object.i);
}

FF4Map.prototype.show = function() {
    this.resetControls();
    this.showControls();
    this.tileset.show();

    // notify on resize
    const self = this;
    const editTop = document.getElementById('edit-top');
    if (!this.resizeSensor) {
        this.resizeSensor = new ResizeSensor(editTop, function() {
            self.scroll();
        });
    }
}

FF4Map.prototype.hide = function() {
    this.observer.stopObservingAll();
    if (this.resizeSensor) {
        this.resizeSensor.detach(document.getElementById("edit-top"));
        this.resizeSensor = null;
    }
    this.tileset.hide();
}

FF4Map.prototype.resetControls = function() {

    ROMEditor.prototype.resetControls.call(this);

    var map = this;

    // add layer toggle buttons
    this.addTwoState("showLayer1", function() { map.changeLayer("showLayer1"); }, "Layer 1", this.showLayer1);
    this.addTwoState("showLayer2", function() { map.changeLayer("showLayer2"); }, "Layer 2", this.showLayer2);
    this.addTwoState("showTriggers", function() { map.changeLayer("showTriggers"); }, "Triggers", this.showTriggers);

    // add tile mask button
    var maskArray = this.isWorld ? FF4Map.WorldTileMasks : FF4Map.TileMasks
    var maskKeys = Object.keys(maskArray);
    var maskNames = [];
    for (var i = 0; i < maskKeys.length; i++) maskNames[i] = maskArray[maskKeys[i]];
    if (!maskNames.includes(this.tileMask)) this.tileMask = FF4Map.TileMasks.none;
    var onChangeMask = function(mask) {
        map.tileMask = maskArray[maskKeys[mask]];
        map.drawMap();
        map.tileset.selectLayer(map.l);
    };
    var maskSelected = function(mask) { return map.tileMask === maskArray[maskKeys[mask]]; };
    this.addList("showMask", "Mask", maskNames, onChangeMask, maskSelected);

    // add screen mask button
    this.addTwoState("showScreen", function() { map.changeLayer("showScreen"); }, "Screen", this.showScreen);
    this.addZoom(this.zoom, function() { map.changeZoom(); });
}

FF4Map.prototype.loadMap = function(m) {

    // set the map index
    if (!isNumber(m)) m = this.m;

    if ([0xFB, 0xFC, 0xFD].includes(m & 0xFF)) {
        this.loadWorldMap(m & 0xFF);
        return;
    }

    this.m = m;
    this.observer.stopObservingAll();
    this.isWorld = false;
    this.mapProperties = this.rom.mapProperties.item(this.m);

    // get map properties
    var map = this.mapProperties;
    if (!map) return;
    this.observer.startObserving([
        map.graphics,
        map.palette,
        map.layout1,
        map.layout2,
        map.layoutMSB,
        map.addition
    ], this.loadMap);

    // observe tile properties (redraw map and tileset, don't reload)
    var self = this;
    const g = this.mapProperties.graphics.value;
    var tileProperties = this.rom.mapTileProperties.item(g);
    for (const tp of tileProperties.iterator()) {
        this.observer.startObservingSub(tp, function() {
            self.drawMap();
            self.tileset.redraw();
        });
    }

    // set the battle background
    var battleEditor = propertyList.getEditor("FF4Battle");
    battleEditor.bg = map.battleBackground.value;
    battleEditor.altPalette = map.battleBackgroundPalette.value;

    // load graphics
    var gfx = new Uint8Array(0x10000);
    if ((g === 0) || (g === 15)) {
        // 4bpp graphics
        var graphics1 = this.rom[`mapGraphics${g}`];
        this.observer.startObserving(graphics1, this.loadMap);
        gfx.set(graphics1.data);
    } else {
        // 3bpp graphics
        var graphics1 = this.rom[`mapGraphics${g}`];
        var graphics2 = this.rom[`mapGraphics${g + 1}`];
        this.observer.startObserving(graphics1, this.loadMap);
        this.observer.startObserving(graphics2, this.loadMap);
        gfx.set(graphics1.data);
        gfx.set(graphics2.data, graphics1.data.length);
    }

    // load animation graphics
    var animTable = [0, 0, 0, 2, 3, 6, 7, 10, 10, 10, 10, 10, 13, 13, 13, 16];
    var animGfx = this.rom.mapAnimationGraphics.data;
    for (var i = 0; i < 4; i++) {
        var a = animTable[g] + i;
        var start = a * 0x0400;
        var end = start + 0x0100;
        gfx.set(animGfx.subarray(start, end), 0x4800 + i * 0x0100);
    }

    // load palette
    var pal = new Uint32Array(128);
    if ((g === 0) || (g === 15)) {
        // 4bpp graphics
        var pal1 = this.rom.mapPalettes.item(map.palette.value);
        var pal2 = this.rom.mapPalettes.item(map.palette.value + 1);
        this.observer.startObserving(pal1, this.loadMap);
        this.observer.startObserving(pal2, this.loadMap);
        for (var p = 0; p < 7; p++) {
            pal.set(pal1.data.subarray(p * 8, p * 8 + 8), (p + 1) * 16);
            pal.set(pal2.data.subarray(p * 8, p * 8 + 8), (p + 1) * 16 + 8);
        }
    } else {
        // 3bpp graphics
        var pal1 = this.rom.mapPalettes.item(map.palette.value);
        this.observer.startObserving(pal1, this.loadMap);
        for (var p = 0; p < 7; p++) {
            pal.set(pal1.data.subarray(p * 8, p * 8 + 8), (p + 1) * 16);
        }
    }
    pal[0] = 0xFF000000; // set background color to black

    var layout, tileset;
    var tileset = this.rom.mapTilesets.item(g);
    this.observer.startObserving(tileset, this.loadMap);

    // load and de-interlace tile layouts
    var l1 = map.layout1.value;
    if (map.layoutMSB.value || this.m >= 256) {
        layout = this.rom.mapLayouts.undergroundMoonLayouts.item(l1);
    } else {
        layout = this.rom.mapLayouts.overworldLayouts.item(l1);
    }
    if (!layout) {
        layout = new Uint8Array(0x0400);
        layout.fill(map.fill);
    }
    this.layer[0].type = FF4MapLayer.Type.layer1;
    this.layer[0].loadLayout({layout: layout, tileset: tileset.data, w: 32, h: 32});

    var l2 = map.layout2.value;
    if (map.layoutMSB.value || this.m >= 256) {
        layout = this.rom.mapLayouts.undergroundMoonLayouts.item(l2);
    } else {
        layout = this.rom.mapLayouts.overworldLayouts.item(l2);
    }
    if (!layout) {
        layout = new Uint8Array(0x0400);
        layout.fill(map.fill);
    }
    this.layer[1].loadLayout({layout: layout, tileset: tileset.data, w: 32, h: 32});

    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = this.rom.gammaCorrectedPalette(pal);
    this.ppu.height = 32 * 16;
    this.ppu.width = 32 * 16;
    this.ppu.back = true;
    this.ppu.subtract = false;
    this.ppu.half = map.addition.value;

    // layer 1
    this.ppu.layers[0].cols = this.layer[0].w * 2;
    this.ppu.layers[0].rows = this.layer[0].h * 2;
    this.ppu.layers[0].z[0] = GFX.Z.snes1L;
    this.ppu.layers[0].z[1] = GFX.Z.snes1H;
    this.ppu.layers[0].gfx = gfx;
    this.ppu.layers[0].tiles = this.layer[0].tiles;
    this.ppu.layers[0].main = this.showLayer1; // layer 1 always in main screen
    this.ppu.layers[0].sub = this.showLayer1 && map.addition.value;
    this.ppu.layers[0].math = map.addition.value;

    // layer 2
    this.ppu.layers[1].cols = this.layer[1].w * 2;
    this.ppu.layers[1].rows = this.layer[1].h * 2;
    this.ppu.layers[1].z[0] = GFX.Z.snes2L;
    this.ppu.layers[1].z[1] = GFX.Z.snes2H;
    this.ppu.layers[1].gfx = gfx;
    this.ppu.layers[1].tiles = this.layer[1].tiles;
    this.ppu.layers[1].main = this.showLayer2;
    this.ppu.layers[1].sub = false;
    this.ppu.layers[1].math = map.addition.value;

    this.scrollDiv.style.width = (this.ppu.width * this.zoom).toString() + "px";
    this.scrollDiv.style.height = (this.ppu.height * this.zoom).toString() + "px";
    this.mapCanvas.width = this.ppu.width;
    this.mapCanvas.height = this.ppu.height;

    this.invalidateMap();
    this.selectedTrigger = null;
    this.loadTriggers();
    this.scroll();

    this.tileset.loadMap(this.m);
}

FF4Map.prototype.loadWorldMap = function(m) {

    this.isWorld = true;
    if (!isNumber(m)) m = this.m;
    this.m = m;

    if (this.selectedLayer && this.selectedLayer.type === "layer2") {
        this.selectLayer(0);
    }

    this.observer.stopObservingAll();
    this.mapProperties = null;
    propertyList.select(null);

    // set the map background
    var battleEditor = propertyList.getEditor("FF4Battle");
    var size = 256;
    if (this.m === 251) {
        this.w = 0; // overworld
        battleEditor.bg = 0;
    } else if (this.m === 252) {
        this.w = 1; // underground
        battleEditor.bg = 15;
    } else if (this.m === 253) {
        this.w = 2; // moon
        battleEditor.bg = 5;
        size = 64;
    }
    battleEditor.altPalette = false;

    var graphics = this.rom.worldGraphics.item(this.w);
    var palette = this.rom.worldPalettes.item(this.w);
    var paletteAssignment = this.rom.worldPaletteAssignments.item(this.w);
    var tileset = this.rom.worldTilesets.item(this.w);
    var tileProperties = this.rom.worldTileProperties.item(this.w);

    var self = this;
    this.observer.startObserving([
        graphics,
        palette,
        paletteAssignment,
        tileset
    ], this.loadMap);
    for (const tp of tileProperties.iterator()) {
        this.observer.startObservingSub(tp, function() {
            self.drawMap();
            self.tileset.redraw();
        });
    }

    var layout = [];
    for (var i = 0; i < size; i++) {
        layout.push(rom["worldLayout" + this.w].item(i));
    }

    this.layer[0].type = FF4MapLayer.Type.world;
    this.layer[0].loadLayout({
        layout: layout,
        tileset: tileset.data,
        w: size,
        h: size,
        paletteAssignment: paletteAssignment.data
    });

    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = this.rom.gammaCorrectedPalette(palette.data);
    this.ppu.width = size * 16;
    this.ppu.height = size * 16;
    this.ppu.back = true;

    // layer 1
    this.ppu.layers[0].cols = size * 2;
    this.ppu.layers[0].rows = size * 2;
    this.ppu.layers[0].z[0] = GFX.Z.snes1L;
    this.ppu.layers[0].z[1] = GFX.Z.snes1H;
    this.ppu.layers[0].gfx = graphics.data;
    this.ppu.layers[0].tiles = this.layer[0].tiles;
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

FF4Map.prototype.invalidateMap = function(rect) {
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

FF4Map.prototype.drawMap = function() {

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
    ctx.globalCompositeOperation = 'copy';
    var scaledRect = this.mapRect.scale(1 / this.zoom);
    ctx.drawImage(this.mapCanvas, scaledRect.l, scaledRect.t, scaledRect.w, scaledRect.h, 0, 0, this.mapRect.w, this.mapRect.h);

    this.drawMask();
    this.drawTriggers();
    this.drawScreen();
    this.drawCursor();
}

FF4Map.prototype.reloadTriggers = function() {
    this.loadTriggers();
    this.drawMap();
}

FF4Map.prototype.loadTriggers = function() {

    var i;
    this.triggers = [];

    // load triggers
    var triggers = this.rom.mapTriggers.item(this.m);
    if (this.isWorld) triggers = this.rom.worldTriggers.item(this.m - 0xFB);
    for (i = 0; i < triggers.arrayLength; i++) {
        var trigger = triggers.item(i);
        if (trigger.map.value === 0xFE) {
            trigger.key = "treasureProperties";
            trigger.name = "Treasure Properties";
            if (this.m >= 256 && trigger.battle.offset !== 0x01E0) {
                trigger.battle.value += 32;
                trigger.battle.offset = 0x01E0;
            }
        } else if (trigger.map.value === 0xFF) {
            trigger.key = "eventTriggers";
            trigger.name = "Event Trigger";
        } else {
            trigger.key = "entranceTriggers";
            trigger.name = "Entrance Trigger";
            if (this.m >= 252 && trigger.map.offset !== 256) {
                trigger.map.value += 256;
                trigger.map.offset = 256;
            }
        }
        this.observer.startObservingSub([trigger.x, trigger.y], this.reloadTriggers);
        this.triggers.push(trigger);
    }

    // load npcs
    if (this.isWorld) return;
    var npcIndex = this.mapProperties.npc.value;
    if (npcIndex === 0 && this.m !== 0) return;
    var offset = 0;
    if (this.mapProperties.npcMSB.value || this.m >= 256) {
        npcIndex += 256;
        offset = 256;
    }
    var npcProperties = this.rom.npcProperties.item(npcIndex);
    var npcGraphics = this.rom.npcGraphicsProperties;
    this.observer.startObserving([
        this.mapProperties.npc,
        this.mapProperties.npcMSB,
        this.mapProperties.npcPalette1,
        this.mapProperties.npcPalette2
    ], this.reloadTriggers);

    for (i = 0; i < npcProperties.arrayLength; i++) {
        var npc = npcProperties.item(i);
        if (npc.switch.offset !== offset) {
            npc.switch.value += offset;
            npc.switch.offset = offset;
        }
        const graphics = npcGraphics.item(npc.switch.value).graphics;
        this.observer.startObserving([
            graphics,
            npc.palette,
            npc.switch,
            npc.direction,
            npc.x,
            npc.y
        ], this.reloadTriggers);
        this.triggers.push(npc);
    }
}

FF4Map.prototype.insertTrigger = function(type) {

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

FF4Map.prototype.updateTreasures = function() {
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

//FF4Map.prototype.logTreasures = function() {
//    for (var m = 0; m < this.rom.mapProperties.arrayLength; m++) {
//        if (m === 256) t = 0; // reset to zero for underground/moon treasures
//        var t = this.rom.mapProperties.item(m).treasure.value;
//        var name = this.rom.stringTable["mapProperties"].string[m];
//        var triggers = this.rom.mapTriggers.item(m);
//        triggers.array.forEach(function(trigger) {
//            if (trigger.map.value !== 0xFE) return;
//            console.log(t + ": " + name);
//            t++;
//        });
//    }
//}

FF4Map.prototype.insertNPC = function() {
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

FF4Map.prototype.deleteTrigger = function() {

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

FF4Map.prototype.drawTriggers = function() {

    if (!this.showTriggers) return;

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

    for (var i = 0; i < this.triggers.length; i++) {
        var trigger = this.triggers[i];
        var triggerRect = this.rectForTrigger(trigger);
        if (this.mapRect.intersect(triggerRect).isEmpty()) continue;
        var c = "purple";
        switch (trigger.key) {
            case "eventTriggers": c = "rgba(0, 0, 255, 0.5)"; break;
            case "entranceTriggers": c = "rgba(255, 0, 0, 0.5)"; break;
            case "treasureProperties": c = "rgba(255, 255, 0, 0.5)"; break;
            case "npcProperties": c = "rgba(128, 128, 128, 0.5)"; break;
        }
        drawTriggerRect(trigger.x.value, trigger.y.value, c);
    }

    // draw npcs (sort by y-coordinate and sprite priority)
    var npcs = this.triggers.filter(function(trigger) {
        return (trigger.key === "npcProperties");
    });
    npcs = npcs.sort(function(trigger1, trigger2) {
        var y1 = trigger1.y.value;
        var y2 = trigger2.y.value;
        return y1 - y2;
    });
    for (i = 0; i < npcs.length; i++) {
        var npc = npcs[i];
        this.drawNPC(npc);
    }
}

FF4Map.prototype.triggerAt = function(x, y) {

    var triggers = this.triggersAt(x, y);
    if (triggers.length === 0) return null;
    return triggers[0];
}

FF4Map.prototype.triggersAt = function (x, y) {
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

FF4Map.prototype.rectForTrigger = function(trigger) {
    var l = trigger.x.value * 16 * this.zoom;
    var r = l + 16 * this.zoom;
    var t = trigger.y.value * 16 * this.zoom;
    var b = t + 16 * this.zoom;

    return new Rect(l, r, t, b);
}

FF4Map.prototype.drawNPC = function(npc) {

    var x = npc.x.value * 16;
    var y = npc.y.value * 16;
    var w = 16;
    var h = 16;

    var index = npc.switch.value;
    var g = this.rom.npcPointers.item(index).graphics.graphics.value;
    var direction = npc.direction.value;
    var p = npc.palette.value;

    // decode palette
    var pal = new Uint32Array(0x80);
    var p1 = this.mapProperties.npcPalette1.value * 2;
    var p2 = this.mapProperties.npcPalette2.value * 2;
    pal.set(this.rom.mapSpritePalettes.item(0).data, 0x00);
    pal.set(this.rom.mapSpritePalettes.item(1).data, 0x10);
    pal.set(this.rom.mapSpritePalettes.item(2).data, 0x20);
    pal.set(this.rom.mapSpritePalettes.item(3).data, 0x30);
    pal.set(this.rom.npcPalettes.item(p1).data, 0x40);
    pal.set(this.rom.npcPalettes.item(p1 + 1).data, 0x50);
    pal.set(this.rom.npcPalettes.item(p2).data, 0x60);
    pal.set(this.rom.npcPalettes.item(p2 + 1).data, 0x70);
    if (g < 14) {
        // character palette
        var characterPalettes = [0, 0, 1, 2, 2, 2, 0, 1, 1, 3, 0, 1, 0, 0, 0, 0, 0, 0];
        p = characterPalettes[g] << 20;
    } else {
        // npc palette
        p += 4;
        p <<= 20;
    }

    var spriteGraphics = this.rom.mapSpriteGraphics.item(g).data;
    var tileCount = spriteGraphics.length >> 6;
    var begin = 0;

    var tileData = new Uint32Array([0 | p, 1 | p, 2 | p, 3 | p]);
    if (direction === 0 && tileCount > 1) {
        // up
        begin = 0x100;
    } else if (direction === 1 && tileCount > 2) {
        // right
        begin = 0x200;
        p |= 0x10000000;
        tileData = new Uint32Array([1 | p, 0 | p, 3 | p, 2 | p]);
    } else if (direction === 2) {
        // down
        begin = 0;
    } else if (direction === 3 && tileCount > 2) {
        // left
        begin = 0x200;
    }

    var end = begin + 0x100;
    var gfx = spriteGraphics.subarray(begin, end);

    var npcRect = new Rect(x, x + w, y - 2, y + h - 2);
    npcRect = npcRect.scale(this.zoom);
    if (this.mapRect.intersect(npcRect).isEmpty()) return;

    // set up the ppu
    var ppu = new GFX.PPU();
    ppu.pal = this.rom.gammaCorrectedPalette(pal);
    ppu.width = w;
    ppu.height = h;

    // layer 1
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
    ctx.globalCompositeOperation = 'source-over';
    npcRect = npcRect.offset(-this.mapRect.l, -this.mapRect.t);
    ctx.drawImage(this.npcCanvas, 0, 0, w, h, npcRect.l, npcRect.t, npcRect.w, npcRect.h);
}

// FF4MapLayer
function FF4MapLayer(rom, type) {
    this.rom = rom;
    this.type = type;
    this.tileset = null;
}

FF4MapLayer.Type = {
    layer1: "layer1",
    layer2: "layer2",
    world: "world"
}

FF4MapLayer.prototype.loadLayout = function(definition) {

    if (definition.type) this.type = definition.type;
    this.layout = definition.layout;
    this.tileset = definition.tileset;
    this.w = definition.w;
    this.h = definition.h;
    this.paletteAssignment = definition.paletteAssignment; // world map only

    // update tiles for the entire map
    this.tiles = new Uint32Array(this.w * this.h * 4);
    this.decodeLayout();
}

FF4MapLayer.prototype.setLayout = function(layout) {

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

FF4MapLayer.prototype.getLayout = function(col, row, cols, rows) {

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

FF4MapLayer.prototype.decodeLayout = function(x, y, w, h) {

    x = x || 0;
    y = y || 0;
    x %= this.w;
    y %= this.h;
    w = w || this.w;
    h = h || this.h;
    w = Math.min(w, this.w - x);
    h = Math.min(h, this.h - y);

    switch (this.type) {
        case FF4MapLayer.Type.layer1:
        case FF4MapLayer.Type.layer2:
            this.decodeMapLayout(x, y, w, h);
            break;
        case FF4MapLayer.Type.world:
            this.decodeWorldLayout(x, y, w, h);
            break;
        default:
            break;
    }
}

FF4MapLayer.prototype.decodeMapLayout = function(x, y, w, h) {

    var layout = this.layout.data || this.layout;
    var l = x + y * this.w;
    var t = x * 2 + y * this.w * 4;
    var row, col, tile, i;

    for (row = 0; row < h; row++) {
        for (col = 0; col < w; col++) {
            tile = layout[l + col];
            tile = ((tile & 0x70) << 2) | ((tile & 0x0F) << 1);
            i = t + col * 2;
            if (i > this.tiles.length) return;

            if (i > this.tiles.length) return;
            this.tiles[i + 0] = this.tileset[tile];
            this.tiles[i + 1] = this.tileset[tile + 1];
            i += this.w * 2;
            tile += 32;
            this.tiles[i + 0] = this.tileset[tile];
            this.tiles[i + 1] = this.tileset[tile + 1];
            // this.tiles[i + 0] = this.tileset[tile + 0x0000] | (this.tileset[tile + 0x0001] << 8);
            // this.tiles[i + 1] = this.tileset[tile + 0x0100] | (this.tileset[tile + 0x0101] << 8);
            // i += this.w * 2;
            // this.tiles[i + 0] = this.tileset[tile + 0x0200] | (this.tileset[tile + 0x0201] << 8);
            // this.tiles[i + 1] = this.tileset[tile + 0x0300] | (this.tileset[tile + 0x0301] << 8);
        }
        t += this.w * 4;
        l += this.w;
    }
}

FF4MapLayer.prototype.decodeWorldLayout = function(x, y, w, h) {

    var tileset = new Uint32Array(512);
    for (var i = 0; i < 512; i++) {
        var t = this.tileset[i];
        var p = this.paletteAssignment[t] << 16;
        tileset[i] = t | p;
    }
    var layout = this.layout;
    if (layout[0] instanceof ROMAssembly) {
        layout = new Uint8Array(0x10000);
        for (var i = 0; i < this.h; i++) {
            layout.set(this.layout[i].data, i * this.w);
        }
    }

    var l = x + y * this.w;
    var t = x * 2 + y * this.w * 4;
    var row, col, tile;

    for (row = 0; row < h; row++) {
        for (col = 0; col < w; col++) {
            tile = layout[l + col];
            if (tile > 0x7F) tile = 0;
            tile = ((tile & 0x70) << 2) | ((tile & 0x0F) << 1);

            i = t + col * 2;
            if (i > this.tiles.length) return;
            this.tiles[i + 0] = tileset[tile];
            this.tiles[i + 1] = tileset[tile + 1];
            i += this.w * 2;
            tile += 32;
            this.tiles[i + 0] = tileset[tile];
            this.tiles[i + 1] = tileset[tile + 1];
        }
        t += this.w * 4;
        l += this.w;
    }
}

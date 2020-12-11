//
// ff4map-gba.js
// created 3/21/2020
//

class FF4MapGBA extends ROMEditor {
    constructor(rom) {
        super(rom);

        this.name = 'FF4MapGBA';
        this.tileset = new FF4MapGBATileset(rom, this);

        this.div.classList.add('map-edit');

        this.scrollDiv = document.createElement('div');
        this.scrollDiv.classList.add('no-select');
        this.div.appendChild(this.scrollDiv);

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'map';
        this.canvas.width = 256;
        this.canvas.height = 256;
        this.scrollDiv.appendChild(this.canvas);

        this.cursorCanvas = document.createElement('canvas');
        this.cursorCanvas.id = 'map-cursor';
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
        this.menu = document.getElementById('menu');

        this.mapProperties = null;
        this.m = null; // map index
        this.l = 0; // selected layer
        this.zoom = 1.0; // zoom multiplier
        this.selection = {
            x: 0, y: 0, w: 1, h: 1,
            tilemap: new Uint8Array(1)
        };
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
        this.observer = new ROMObserver(rom, this);
        this.ppu = new GFX.PPU();

        this.screenCanvas = document.createElement('canvas');
        this.screenCanvas.id = 'map-screen';
        this.screenCanvas.width = 256;
        this.screenCanvas.width = 256;
        this.scrollDiv.appendChild(this.screenCanvas);

        const self = this;
        this.div.onscroll = function() { self.scroll(); };
        this.scrollDiv.onmousedown = function(e) { self.mouseDown(e); };
        this.scrollDiv.onmouseup = function(e) { self.mouseUp(e); };
        this.scrollDiv.onmousemove = function(e) { self.mouseMove(e); };
        this.scrollDiv.onmouseenter = function(e) { self.mouseEnter(e); };
        this.scrollDiv.onmouseleave = function(e) { self.mouseLeave(e); };
        this.scrollDiv.oncontextmenu = function(e) { self.openMenu(e); return false; };
        this.resizeSensor = null;

        this.initMapGraphicsData();
    }

    initMapGraphicsData() {

        // initialize all map graphics data with the proper encoding format
        const mapGraphicsData = this.rom.mapGraphicsData;
        const mapGraphicsDataStringTable = this.rom.stringTable.mapGraphicsData;

        // map layouts and tile properties
        for (let m = 3; m < this.rom.mapProperties.arrayLength; m++) {
            if (m === 350) continue; // skip overworld from cid's trial
            const mapProperties = this.rom.mapProperties.item(m);

            const mapLayoutStringTable = this.rom.stringTable['mapProperties.layout'];
            const l = mapProperties.layout.value;
            const layout = mapGraphicsData.item(l);
            mapLayoutStringTable.setString(l, `Map Layout ${l}`);
            layout.format = 'tose-70';
            layout.disassemble(this.rom.data);
            mapGraphicsDataStringTable.string[l].value += ' (Layout)';

            const tp = mapProperties.tileProperties.tp.value;
            if (tp === 0) {
                // for map 52, set tile properties to 0xFFFF
                mapProperties.tileProperties.data = new Uint8Array([0xFF, 0xFF]);
            }
            const tilePropertiesStringTable = this.rom.stringTable['mapProperties.tileProperties.tp'];
            if (mapProperties.tileProperties.getSpecialValue() !== 0xFFFF) {
                const tileProperties = mapGraphicsData.item(tp);
                tilePropertiesStringTable.setString(tp, `Map Tile Properties ${tp}`);
                tileProperties.format = 'tose-70';
                tileProperties.disassemble(this.rom.data);
                mapGraphicsDataStringTable.string[tp].value += ' (Tile Properties)';
            }
        }

        // tileset palettes, graphics, and layouts
        const mapPaletteStringTable = this.rom.stringTable['mapTileset.palette'];
        const mapGraphicsStringTable = this.rom.stringTable['mapTileset.graphics'];
        const mapTilesetLayoutStringTable = this.rom.stringTable['mapTileset.layout'];
        for (let t = 0; t < this.rom.mapTileset.arrayLength; t++) {
            const mapTileset = this.rom.mapTileset.item(t);

            const p = mapTileset.palette.value;
            const palette = mapGraphicsData.item(p);
            mapPaletteStringTable.setString(p, `Map Palette ${p}`);
            palette.format = 'bgr555';
            palette.disassemble(this.rom.data);
            mapGraphicsDataStringTable.string[p].value += ' (Palette)';

            const g = mapTileset.graphics.value;
            const graphics = mapGraphicsData.item(g);
            mapGraphicsStringTable.setString(g, `Map Graphics ${g}`);
            graphics.format = ['linear4bpp', 'tose-70'];
            graphics.disassemble(this.rom.data);
            mapGraphicsDataStringTable.string[g].value += ' (Graphics)';

            const tl = mapTileset.layout.value;
            const tilesetLayout = mapGraphicsData.item(tl);
            mapTilesetLayoutStringTable.setString(tl, `Map Tileset Layout ${tl}`);
            if (tilesetLayout.range.length > 0x0800) tilesetLayout.range.length = 0x0800;
            tilesetLayout.disassemble(this.rom.data);
            mapGraphicsDataStringTable.string[tl].value += ' (Tileset Layout)';
        }

        // treasures and events
        for (let t = 0; t < this.rom.mapTriggerPointers.arrayLength; t++) {
            const triggers = this.rom.mapTriggerPointers.item(t).triggerPointer.target;
            if (t < 402) {
                triggers.name = 'Trigger';
            } else {
                triggers.name = 'Treasure';
            }
            for (let i = 0; i < triggers.arrayLength; i++) {
                const trigger = triggers.item(i);
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
        for (let w = 0; w < this.rom.worldProperties.arrayLength; w++) {
            const worldProperties = this.rom.worldProperties.item(w);
            const width = worldProperties.width.value >> 4;
            const height = worldProperties.height.value >> 4;
            const layout1 = worldProperties.layout1.target;
            if (layout1) {
                layout1.range.length = width * height;
                layout1.disassemble(this.rom.data);
            }
            const layout2 = worldProperties.layout2.target;
            if (layout2) {
                layout2.range.length = width * height;
                layout2.disassemble(this.rom.data);
            }
        }

        // world tile properties
        let tp = this.rom.worldTileProperties.item(0);
        tp.assembly.assembly.tileValue.stringTable = 'worldTileType';
        tp.assembly.assembly.tileValue.bool = false;
        tp.isLoaded = false;
        tp = this.rom.worldTileProperties.item(1);
        tp.assembly.assembly.tileValue.stringTable = 'worldTileType';
        tp.assembly.assembly.tileValue.bool = false;
        tp.isLoaded = false;
        tp = this.rom.worldTileProperties.item(3);
        tp.assembly.assembly.tileValue.stringTable = 'worldTileType';
        tp.assembly.assembly.tileValue.bool = false;
        tp.isLoaded = false;
        tp = this.rom.worldTileProperties.item(9);
        tp.assembly.assembly.tileValue.stringTable = 'worldTileType';
        tp.assembly.assembly.tileValue.bool = false;
        tp.isLoaded = false;
    }

    show() {
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

    hide() {
        this.observer.stopObservingAll();
        if (this.resizeSensor) {
            const editTop = document.getElementById('edit-top');
            this.resizeSensor.detach(editTop);
            this.resizeSensor = null;
        }
        this.tileset.hide();
    }

    selectObject(object) {
        if (this.mapProperties === object) return;

        this.mapProperties = object;
        this.m = object.i;

        if (this.m < 3 || this.m === 0x015E) {
            this.w = this.m;
            if (this.m === 0x015E) this.w = 3; // overworld map for cid's trial
            this.isWorld = true;
            this.loadWorldMap();
        } else {
            this.w = -1;
            this.isWorld = false;
            this.loadMap();
        }
    }

    resetControls() {

        super.resetControls();

        const self = this;

        this.addTwoState('showLayer1', function() {
            self.changeLayer('showLayer1');
        }, 'Layer 1', this.showLayer1);
        this.addTwoState('showLayer2', function() {
            self.changeLayer('showLayer2');
        }, 'Layer 2', this.showLayer2);
        this.addTwoState('showTriggers', function() {
            self.changeLayer('showTriggers');
        }, 'Triggers', this.showTriggers);

        // control to change selected z-level
        if (this.isWorld && this.w !== 2) {
            // world map

        } else {
            // normal map or moon
            function onChangeZ(z) {
                if (z === 0) {
                    self.z = FF4MapGBA.ZLevel.upper;
                    if (self.l === 2) self.selectedLayer = self.layer[2];
                } else if (z === 1) {
                    self.z = FF4MapGBA.ZLevel.lower;
                    if (self.l === 2) self.selectedLayer = self.layer[3];
                }
                self.drawMap();
            }
            function zSelected(z) {
                if (z === 0 && self.z === FF4MapGBA.ZLevel.upper) return true;
                if (z === 1 && self.z === FF4MapGBA.ZLevel.lower) return true;
                return false;
            }
            this.addList('changeZ', 'Z-Level', ['Upper Z-Level', 'Lower Z-Level'], onChangeZ, zSelected);
        }

        this.addTwoState('showScreen', function() {
            self.changeLayer('showScreen');
        }, 'Screen', this.showScreen);
        this.addZoom(this.zoom, function() {
            self.changeZoom();
        });
    }

    changeZoom() {

        // save the old scroll location
        const l = this.div.scrollLeft;
        const t = this.div.scrollTop;
        const w = this.div.clientWidth;
        const h = this.div.clientHeight;
        const oldRect = new Rect(l, l + w, t, t + h);
        const oldZoom = this.zoom;

        // update zoom
        this.zoom = Math.pow(2, Number(document.getElementById('zoom').value));
        const zoomValue = document.getElementById('zoom-value');
        zoomValue.innerHTML = `${this.zoom * 100}%`;

        // update the scroll div size
        const parentWidth = this.ppu.width * this.zoom;
        const parentHeight = this.ppu.height * this.zoom;
        this.scrollDiv.style.width = `${parentWidth}px`;
        this.scrollDiv.style.height = `${parentHeight}px`;

        // calculate the new scroll location
        const x = Math.round(oldRect.centerX / oldZoom) * this.zoom;
        const y = Math.round(oldRect.centerY / oldZoom) * this.zoom;
        let newRect = new Rect(x - w / 2, x + w / 2, y - h / 2, y + h / 2);
        if (newRect.r > parentWidth) newRect = newRect.offset(parentWidth - newRect.r, 0);
        if (newRect.b > parentHeight) newRect = newRect.offset(0, parentHeight - newRect.b);
        if (newRect.l < 0) newRect = newRect.offset(-newRect.l, 0);
        if (newRect.t < 0) newRect = newRect.offset(0, -newRect.t);

        // set the new scroll location and redraw
        this.div.scrollLeft = newRect.l;
        this.div.scrollTop = newRect.t;
        this.scroll();
    }

    scroll() {

        this.closeMenu();

        // get the visible dimensions
        const x = this.div.scrollLeft;
        const y = this.div.scrollTop;
        const w = this.div.clientWidth;
        const h = this.div.clientHeight;

        const margin = Math.max(w, h) >> 2;
        this.mapRect.r = Math.min(x + w + margin, this.ppu.width * this.zoom);
        this.mapRect.l = Math.max(0, Math.min(x - margin, this.mapRect.r - w));
        this.mapRect.b = Math.min(y + h + margin, this.ppu.height * this.zoom);
        this.mapRect.t = Math.max(0, Math.min(y - margin, this.mapRect.b - h));

        this.canvas.style.left = `${this.mapRect.l}px`;
        this.canvas.style.top = `${this.mapRect.t}px`;
        this.canvas.width = this.mapRect.w;
        this.canvas.height = this.mapRect.h;

        this.drawMap();
    }

    getEventPoint(e) {
        // convert screen coordinates to ppu coordinates
        const x = (e.offsetX / this.zoom + this.ppu.layers[this.l].x) % this.ppu.width;
        const y = (e.offsetY / this.zoom + this.ppu.layers[this.l].y) % this.ppu.height;

        // get the tile (x,y) position on the selected layer
        let col = x >> 4;
        let row = y >> 4;
        if (this.l !== 3) {
            col %= this.ppu.layers[this.l].cols;
            row %= this.ppu.layers[this.l].rows;
            while (col < 0) col += this.ppu.layers[this.l].cols;
            while (row < 0) row += this.ppu.layers[this.l].rows;
        }

        return {
            x: col, y: row,
            button: e.button
        }
    }

    mouseDown(e) {

        this.closeMenu();
        this.clickPoint = this.getEventPoint(e);

        // update the selection position
        this.selection.x = this.clickPoint.x;
        this.selection.y = this.clickPoint.y;

        if (this.l === 3) {
            const triggers = this.triggersAt(e.offsetX, e.offsetY);
            const index = triggers.indexOf(this.selectedTrigger);
            if (index !== -1) {
                // select the next trigger in a stack
                const t = (index + 1) % triggers.length;
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
                    this.selectWorldBattle(this.clickPoint.x, this.clickPoint.y);
                } else {
                    // select map properties
                    propertyList.select(this.mapProperties);
                }
                this.isDragging = false;
            }
        } else if (this.clickPoint && this.clickPoint.button === 2) {
            this.selectTiles();
            this.isDragging = true;
        } else if (this.clickPoint && this.clickPoint.button === 0) {
            this.beginAction(this.drawMap);
            this.rom.doAction(new ROMAction(this.selectedLayer, this.selectedLayer.decodeLayout, null, 'Decode Layout'));
            this.setTiles();
            this.isDragging = true;
        }

        this.drawScreen();
        this.drawCursor();
    }

    mouseMove(e) {

        // return if the menu is open
        if (this.menu.classList.contains('active')) return;

        const point = this.getEventPoint(e);

        // update the displayed coordinates
        const coordinates = document.getElementById('coordinates');
        coordinates.innerHTML = `(${point.x}, ${point.y})`;

        // return if the cursor position didn't change
        if (this.selection.x === point.x && this.selection.y === point.y) return;

        // update the selection position
        this.selection.x = point.x;
        this.selection.y = point.y;

        if (!this.isDragging) {
            // update the cursor
            this.drawScreen();
            this.drawCursor();
            return;
        }

        if (this.l === 3 && this.selectedTrigger) {

            if (this.selectedTrigger.x.value !== point.x || this.selectedTrigger.y.value !== point.y) {
                this.selectedTrigger.x.value = point.x;
                this.selectedTrigger.y.value = point.y;
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

    mouseUp(e) {

        if (this.l === 3 && this.selectedTrigger && this.isDragging) {
            // save the new trigger position
            const x = this.selectedTrigger.x.value;
            const y = this.selectedTrigger.y.value;

            if (x != this.clickPoint.x || y !== this.clickPoint.y) {
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
            this.rom.doAction(new ROMAction(this.selectedLayer, null, this.selectedLayer.decodeLayout, 'Decode Layout'));
            this.rom.pushAction(new ROMAction(this, null, this.drawMap, 'Redraw Map'));
            this.endAction();
        }

        this.isDragging = false;
        // this.clickPoint = null;
    }

    mouseEnter(e) {

        // show the cursor
        this.showCursor = true;
        this.drawScreen();
        this.drawCursor();

        this.mouseUp(e);
    }

    mouseLeave(e) {

        // hide the cursor
        this.showCursor = (this.l === 3);
        this.drawCursor();

        this.mouseUp(e);
    }

    openMenu(e) {

        // trigger menu is not implemented yet
        return;

        // if (this.l !== 3) return; // no menu unless editing triggers
        // this.updateMenu();
        //
        // this.clickPoint = this.getEventPoint(e);
        //
        // this.menu.classList.add('menu-active');
        // this.menu.style.left = `${e.x}px`;
        // this.menu.style.top = `${e.y}px`;
    }

    closeMenu() {
        this.menu.classList.remove('menu-active');
    }

    updateMenu() {
        this.menu.innerHTML = '';

        // const self = this;
        // function appendMenuItem(label, onclick) {
        //     const li = document.createElement('li');
        //     li.classList.add('menu-item');
        //     li.innerHTML = label;
        //     if (onclick) {
        //         li.onclick = onclick;
        //     } else {
        //         li.classList.add('menu-item-disabled');
        //     }
        //     self.menu.appendChild(li);
        // }
        //
        // appendMenuItem('Insert Entrance Trigger', function() {
        //     self.insertTrigger()
        // });
        // appendMenuItem('Insert Event Trigger', function() {
        //     self.insertTrigger('eventTriggers')
        // });
        // appendMenuItem('Insert Treasure', this.isWorld ? null : function() {
        //     self.insertTrigger('treasureProperties')
        // });
        // appendMenuItem('Insert NPC', this.isWorld ? null : function() {
        //     self.insertNPC()
        // });
        // appendMenuItem('Delete Trigger', this.selectedTrigger ? function() {
        //     self.deleteTrigger()
        // } : null);
    }

    setTiles() {
        // return if not dragging
        if (!this.clickPoint) return;

        // fix z-level change tiles
        if (this.l === 2) {
            for (let tile = 0; tile < this.selection.tilemap.length; tile++) {
                if (this.selection.tilemap[tile] === 2 && this.z === FF4MapGBA.ZLevel.lower) {
                        this.selection.tilemap[tile] = 3;
                } else if (this.selection.tilemap[tile] === 3 && this.z === FF4MapGBA.ZLevel.upper) {
                    this.selection.tilemap[tile] = 2;
                }
            }
        }

        const x = this.selection.x;
        const y = this.selection.y;
        const w = this.selection.w;
        const h = this.selection.h;

        const l = ((x << 4) - this.ppu.layers[this.l].x) % this.ppu.width;
        const r = l + (w << 4);
        const t = ((y << 4) - this.ppu.layers[this.l].y) % this.ppu.height;
        const b = t + (h << 4);
        const rect = new Rect(l, r, t, b);

        this.selectedLayer.setLayout(this.selection);
        const self = this;
        function invalidate() {
            self.invalidateMap(rect);
        }
        this.rom.doAction(new ROMAction(this, invalidate, invalidate, 'Invalidate Map'));
        this.drawMap();
    }

    selectTiles() {

        const x = Math.min(this.selection.x, this.clickPoint.x);
        const y = Math.min(this.selection.y, this.clickPoint.y);
        const w = Math.abs(this.selection.x - this.clickPoint.x) + 1;
        const h = Math.abs(this.selection.y - this.clickPoint.y) + 1;

        this.selection = this.selectedLayer.getLayout(x, y, w, h);

        if (w !== 1 || h !== 1) {
            this.tileset.selection = null;
        } else {
            // select a single tile in the tileset view
            let tile = this.selection.tilemap[0];
            this.tileset.selection = {
                x: tile & 0x0F,
                y: tile >> 4,
                w: 1, h: 1,
                tilemap: new Uint8Array([tile])
            };
            if (this.isWorld && this.w !== 2) {
                const w = this.layer[0].w;
                const h = this.layer[0].h;
                const t1 = this.layer[0].getLayout(x, y, 1, 1).tilemap[0];
                const t2 = this.layer[1].getLayout(x, y, 1, 1).tilemap[0];
                if (this.l === 1 && t1 !== 0) tile = t1;
                if (t1 === 0 && t2 !== 0) tile = t2;
                this.selectWorldTileProperties(tile);
            } else if (this.l === 2) {
                this.tileset.selection.x = x;
                this.tileset.selection.y = y;
                this.tileset.updateTileDiv();
            }
        }
        this.tileset.drawCursor();
    }

    selectWorldBattle(x, y) {

        // not implemented

        // x >>= 5;
        // y >>= 5;
        //
        // var sector;
        // if (this.m === 251) {
        //     // overworld
        //     x &= 7;
        //     y &= 7;
        //     sector = x + (y << 3);
        // } else if (this.m === 252) {
        //     // underground
        //     offset = 64;
        //     x &= 3;
        //     y &= 3;
        //     sector = x + (y << 2) + 64;
        // } else if (this.m === 253) {
        //     // moon
        //     offset = 80;
        //     x &= 1;
        //     y &= 1;
        //     sector = x + (y << 1) + 80;
        // }
        //
        // var battleGroup = this.rom.worldBattle.item(sector);
        // propertyList.select(battleGroup);
    }

    selectWorldTileProperties(tile) {

        let definition;
        if (this.m !== 1) {
            definition = {
                key: 'worldTile',
                type: 'data',
                assembly: {
                    tileType: {
                        type: 'assembly',
                        name: 'Tile Type',
                        external: `worldTileProperties[0][${tile}].tileValue`
                    },
                    cidsTrial: {
                        type: 'assembly',
                        name: `Cid's Trial`,
                        external: `worldTileProperties[9][${tile}].tileValue`
                    },
                    airship: {
                        type: 'assembly',
                        name: 'Chocobo',
                        external: `worldTileProperties[1][${tile}].tileValue`
                    },
                    blackChocobo: {
                        type: 'assembly',
                        name: 'Black Chocobo',
                        external: `worldTileProperties[2][${tile}].tileValue`
                    }
                }
            }
        } else {
            definition = {
                key: 'worldTile',
                type: 'data',
                assembly: {
                    tileType: {
                        type: 'assembly',
                        name: 'Tile Type',
                        external: `worldTileProperties[3][${tile}].tileValue`
                    },
                    airship1: {
                        type: 'assembly',
                        name: 'Airship Can Fly (No Lava)',
                        external: `worldTileProperties[4][${tile}].tileValue`
                    },
                    airship2: {
                        type: 'assembly',
                        name: 'Airship Can Fly (Lava OK)',
                        external: `worldTileProperties[5][${tile}].tileValue`
                    },
                    airship3: {
                        type: 'assembly',
                        name: 'Passable Upstairs',
                        external: `worldTileProperties[6][${tile}].tileValue`
                    },
                    airship4: {
                        type: 'assembly',
                        name: 'Passable Downstairs',
                        external: `worldTileProperties[7][${tile}].tileValue`
                    }
                }
            }
        }

        const tpObject = new ROMData(this.rom, definition, this.rom);
        propertyList.select(tpObject);

    }

    tilePropertiesAtTile(x, y) {
        const w = this.layer[0].w;
        const h = this.layer[0].h;
        const t = x + y * w;
        if (this.isWorld && this.w !== 2) {
            // world tile properties
            let tp;
            if (this.w !== 1) {
                tp = this.rom.worldTileProperties.item(0);
            } else {
                tp = this.rom.worldTileProperties.item(3);
            }
            const tile = this.layer[0].layout.data[t] || this.layer[1].layout.data[t]
            return tp.item(tile);

        } else if (this.layer[2].layout instanceof ROMAssembly) {
            // normal map tile properties
            const layout = this.layer[2].layout;
            return layout.data[t] | (layout.data[t + w * h] << 8);
        }
        return 0;
    }

    selectLayer(l) {
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

    changeLayer(id) {
        this[id] = document.getElementById(id).checked;
        this.ppu.layers[0].main = this.showLayer1;
        if (this.ppu.layers[1].tiles) {
            this.ppu.layers[1].main = this.showLayer2;
        }
        this.invalidateMap();
        this.drawMap();
    }

    loadMap(m) {

        // get map properties
        this.resetControls();
        this.observer.stopObservingAll();
        const mp = this.mapProperties;
        if (!mp) return;
        this.observer.startObserving([
            mp.tileset,
            mp.layout,
            mp.tileProperties
        ], this.loadMap);

        const mapTileset = this.rom.mapTileset.item(this.mapProperties.tileset.value);
        if (!mapTileset) return;
        this.observer.startObserving([
            mapTileset.graphics,
            mapTileset.palette,
            mapTileset.layout
        ], this.loadMap);

        // set the map background
    //    var battleEditor = propertyList.getEditor('FF4Battle');
    //    battleEditor.bg = map.battleBackground.value;
    //    battleEditor.altPalette = map.battleBackgroundPalette.value;

        // load graphics
        const gfx = new Uint32Array(0x100000);
        const graphicsData = this.rom.mapGraphicsData.item(mapTileset.graphics.value);
        gfx.set(graphicsData.data, 0);
        gfx.set(graphicsData.data, 0x8000);

        // load palette
        const pal = new Uint32Array(512);
        const paletteData = this.rom.mapGraphicsData.item(mapTileset.palette.value);
        pal.set(paletteData.data, 16);
        pal[0] = 0xFF000000; // set background color to black

        const tileset = this.rom.mapGraphicsData.item(mapTileset.layout.value);
        this.observer.startObserving([
            graphicsData,
            paletteData,
            tileset
        ], this.loadMap);

        // load and de-interlace tile layouts
        let layout = this.rom.mapGraphicsData.item(mp.layout.value);
        const w = layout.data[0] | (layout.data[1] << 8);
        const h = layout.data[2] | (layout.data[3] << 8);

        // load first layer
        this.layer[0].loadLayout({type: FF4MapGBALayer.Type.layer1, layout: layout, tileset: tileset.data, w: w, h: h});

        // load second layer
        if (layout.data && layout.data.length < (4 + w * h * 2)) {
            // no second layer
            layout = new Uint8Array(w * h);
        }
        this.layer[1].loadLayout({type: FF4MapGBALayer.Type.layer2, layout: layout, tileset: tileset.data, w: w, h: h});

        // load mask layer
        const tp = mp.tileProperties;
        if (tp.getSpecialValue() !== 0xFFFF) {
            layout = this.rom.mapGraphicsData.item(tp.tp.value);
        } else {
            layout = new Uint8Array(w * h);
        }
        this.layer[2].loadLayout({type: FF4MapGBALayer.Type.mask1, layout: layout, w: w, h: h});
        this.layer[3].loadLayout({type: FF4MapGBALayer.Type.mask2, layout: layout, w: w, h: h});

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(pal);
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

        // tile properties layer
        this.ppu.layers[2].cols = w * 2;
        this.ppu.layers[2].rows = h * 2;

        this.scrollDiv.style.width = `${this.ppu.width * this.zoom}px`;
        this.scrollDiv.style.height = `${this.ppu.height * this.zoom}px`;
        this.mapCanvas.width = w * 16;
        this.mapCanvas.height = h * 16;

        this.invalidateMap();
        this.selectedTrigger = null;
        this.loadTriggers();
        this.scroll();

        this.tileset.loadMap(this.m);
    }

    loadWorldMap(m) {

        // this.isWorld = true;
        // if (!isNumber(m)) m = this.m;
        // this.w = m;
        // this.m = m;
        // if (m === 0x015E) this.w = 3; // overworld map for cid's trial

        this.resetControls();
        this.observer.stopObservingAll();
        this.mapProperties = this.rom.worldProperties.item(this.w);
        this.observer.startObserving([
            this.mapProperties.width,
            this.mapProperties.height,
            this.mapProperties.graphics1,
            this.mapProperties.graphics2,
            this.mapProperties.palette,
            this.mapProperties.tileset1,
            this.mapProperties.layout1,
            this.mapProperties.tileset2,
            this.mapProperties.layout2
        ], this.loadMap);
        propertyList.select(this.mapProperties);

        const width = this.mapProperties.width.value >> 4;
        const height = this.mapProperties.height.value >> 4;

        // load graphics
        const gfx = new Uint8Array(0x10000);
        const graphics1 = this.mapProperties.graphics1.target;
        if (graphics1) gfx.set(graphics1.data);
        const graphics2 = this.mapProperties.graphics2.target;
        if (graphics2) gfx.set(graphics2.data, 0x4000);

        // load palette
        const pal = new Uint32Array(0x200);
        const palette = this.mapProperties.palette.target;
        if (palette) pal.set(palette.data);
        pal[0] = 0xFF000000;

        // load tileset
        let tileset1 = this.mapProperties.tileset1.target;
        if (tileset1) tileset1 = tileset1.data;
        const layout1 = this.mapProperties.layout1.target;
        if (layout1 && tileset1) {
            if (layout1.range.length !== width * height) {
                layout1.range.length = width * height;
                layout1.disassemble(this.rom.data);
            }
            this.layer[0].loadLayout({type: FF4MapGBALayer.Type.world, layout: layout1, tileset: tileset1, w: width, h: height});
        }

        let tileset2 = this.mapProperties.tileset2.target;
        if (tileset2) tileset2 = tileset2.data;
        const layout2 = this.mapProperties.layout2.target
        if (tileset2 && layout2) {
            if (layout2.range.length !== width * height) {
                layout2.range.length = width * height;
                layout2.disassemble(this.rom.data);
            }
            this.layer[1].loadLayout({type: FF4MapGBALayer.Type.world, layout: layout2, tileset: tileset2, w: width, h: height});
        }

        // load tile properties layer (moon only)
        if (this.w === 2) {
            const tp = map.tileProperties;
            this.layer[2].loadLayout({type: FF4MapGBALayer.Type.mask1, layout: this.rom.moonTileProperties, w: width, h: height});
            this.layer[3].loadLayout({type: FF4MapGBALayer.Type.mask2, layout: this.rom.moonTileProperties, w: width, h: height});
        }

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(pal);
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

        this.scrollDiv.style.width = `${this.ppu.width * this.zoom}px`;
        this.scrollDiv.style.height = `${this.ppu.height * this.zoom}px`;
        this.mapCanvas.width = this.ppu.width;
        this.mapCanvas.height = this.ppu.height;

        this.invalidateMap();
        this.selectedTrigger = null;
        this.triggers = [];
        this.loadTriggers();
        this.scroll();

        this.tileset.loadMap(m);
    }

    invalidateMap(rect) {
        const clipX = Math.ceil(this.ppu.width / 256);
        const clipY = Math.ceil(this.ppu.height / 256);
        if (!rect) {
            // invalidate all sectors
            const sectorCount = clipX * clipY;
            this.mapSectors = new Array(sectorCount);
            this.dirtyRect = null;
        } else if (this.dirtyRect) {
            // combine dirty areas
            const left = Math.min(this.dirtyRect.l, rect.l);
            const top = Math.min(this.dirtyRect.t, rect.t);
            const right = Math.max(this.dirtyRect.r, rect.r);
            const bottom = Math.max(this.dirtyRect.b, rect.b);
            this.dirtyRect = new Rect(left, right, top, bottom);
        } else {
            // set a new dirty area
            this.dirtyRect = rect;
        }
    }

    drawMap() {

        // update the map canvas
        const mapContext = this.mapCanvas.getContext('2d');
        const clip = Math.ceil(this.ppu.width / 256);

        // draw all visible sectors
        for (let s = 0; s < this.mapSectors.length; s++) {
            // continue if this sector is already drawn
            if (this.mapSectors[s]) continue;

            // continue if this sector is not visible
            const col = s % clip;
            const row = Math.floor(s / clip);
            const l = col * 256;
            const r = l + 256;
            const t = row * 256;
            const b = t + 256;
            const sectorRect = new Rect(l, r, t, b);
            if (this.mapRect.intersect(sectorRect.scale(this.zoom)).isEmpty()) continue;

            // draw the sector (256 x 256 pixels)
            const imageData = mapContext.createImageData(256, 256);
            this.ppu.renderPPU(imageData.data, sectorRect.l, sectorRect.t, 256, 256);
            mapContext.putImageData(imageData, sectorRect.l, sectorRect.t);

            // validate the sector
            this.mapSectors[s] = true;
        }

        // redraw dirty portions of the map
        if (this.dirtyRect) {

            const rect = this.dirtyRect;
            this.dirtyRect = null;

            // render the image on the map canvas
            const imageData = mapContext.createImageData(rect.w, rect.h);
            this.ppu.renderPPU(imageData.data, rect.l, rect.t, rect.w, rect.h);
            mapContext.putImageData(imageData, rect.l, rect.t);
        }

        const context = this.canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.globalCompositeOperation = 'copy';
        const scaledRect = this.mapRect.scale(1 / this.zoom);
        context.drawImage(this.mapCanvas,
            scaledRect.l, scaledRect.t, scaledRect.w, scaledRect.h,
            0, 0, this.mapRect.w, this.mapRect.h
        );

        this.drawMask();
        this.drawTriggers();
        this.drawScreen();
        this.drawCursor();
    }

    drawScreen() {

        this.screenCanvas.style.display = 'none';
        if (!this.showScreen) return;

        // calculate the screen rect
        const x = ((this.selection.x * 16) - this.ppu.layers[this.l].x) % this.ppu.width;
        const y = ((this.selection.y * 16) - this.ppu.layers[this.l].y) % this.ppu.height;
        let screenRect = new Rect(x - 7 * 16, x + 8 * 16, y - 4.5 * 16, y + 5.5 * 16);

        screenRect.l = Math.max(0, screenRect.l);
        screenRect.r = Math.min(this.ppu.width, screenRect.r);
        screenRect.t = Math.max(0, screenRect.t);
        screenRect.b = Math.min(this.ppu.height, screenRect.b);

        // scale and offset to match the map rect
        screenRect = screenRect.scale(this.zoom).offset(-this.mapRect.l, -this.mapRect.t);

        // draw the screen mask
        this.screenCanvas.width = this.mapRect.w;
        this.screenCanvas.height = this.mapRect.h;
        this.screenCanvas.style.left = `${this.mapRect.l}px`;
        this.screenCanvas.style.top = `${this.mapRect.t}px`;
        this.screenCanvas.style.display = 'block';
        const ctx = this.screenCanvas.getContext('2d');
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, this.screenCanvas.width, this.screenCanvas.height);
        ctx.globalCompositeOperation = 'destination-out'
        ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';
        ctx.fillRect(screenRect.l, screenRect.t, screenRect.w, screenRect.h);
    }

    drawMask() {

        if (this.l !== 2) return;

        // calculate coordinates on the map rect
        const xStart = (this.mapRect.l / this.zoom) >> 4;
        const xEnd = (this.mapRect.r / this.zoom) >> 4;
        const yStart = (this.mapRect.t / this.zoom) >> 4;
        const yEnd = (this.mapRect.b / this.zoom) >> 4;
        const xOffset = (this.mapRect.l / this.zoom) % 16;
        const yOffset = (this.mapRect.t / this.zoom) % 16;

        const ctx = this.canvas.getContext('2d');
        ctx.globalCompositeOperation = 'source-over';

        // draw the mask at each tile
        for (let y = yStart; y <= yEnd; y++) {
            for (let x = xStart; x <= xEnd; x++) {
                const color = this.maskColorAtTile(x, y);
                if (!color) continue;
                ctx.fillStyle = color;

                const left = (((x - xStart) << 4) - xOffset) * this.zoom;
                const top = (((y - yStart) << 4) - yOffset) * this.zoom;
                const size = 16 * this.zoom;

                ctx.fillRect(left, top, size, size);
            }
        }
    }

    maskColorAtTile(x, y) {
        let tp = this.tilePropertiesAtTile(x, y);
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
        } else if (tp == 0x13) {
            return 'rgba(255, 255, 255, 0.5)'; // seret passage
        } else if (tp & 0x20) {
            return 'rgba(255, 255, 0, 0.5)'; // treasure
        } else if (tp & 0x40) {
            return 'rgba(255, 0, 0, 0.5)'; // exit
        } else {
            return 'rgba(255, 255, 255, 0.5)';
        }
    }

    drawCursor() {

        this.cursorCanvas.style.display = 'none';
        if (!this.showCursor) return;

        const col = this.selection.x;
        const row = this.selection.y;

        // get the cursor geometry and color
        let x = ((col << 4) - this.ppu.layers[this.l].x) % this.ppu.width;
        x *= this.zoom;
        let y = ((row << 4) - this.ppu.layers[this.l].y) % this.ppu.height;
        y *= this.zoom;
        let w = this.selection.w * 16;
        w *= this.zoom;
        let h = this.selection.h * 16;
        h *= this.zoom;
        const colors = ['green', 'blue', 'red', 'white'];
        let c = colors[this.l];

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
                case 'jumpPosition':
                case 'jumpPositionShort':
                case 'selectDeleteTrigger':
                case 'createObject':
                    c = 'rgba(0, 0, 255, 1.0)';
                    break;
                case 'worldTriggers':
    //            case 'entranceTriggers':
                    c = 'rgba(255, 0, 0, 1.0)';
                    break;
    //            case 'treasureProperties':
    //                c = 'rgba(255, 255, 0, 1.0)';
    //                break;
                case 'mapTriggers':
                    c = 'rgba(128, 128, 128, 1.0)';
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
        this.cursorCanvas.style.left = `${x}px`;
        this.cursorCanvas.style.top = `${y}px`;
        this.cursorCanvas.style.display = 'block';
        const ctx = this.cursorCanvas.getContext('2d');

        // convert the selection to screen coordinates
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'black';
        x = 0.5; y = 0.5; w--; h--;
        ctx.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        ctx.strokeStyle = c;
        ctx.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        ctx.strokeStyle = 'white';
        ctx.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        ctx.strokeStyle = 'black';
        ctx.strokeRect(x, y, w, h);
    }

    reloadTriggers() {
        this.loadTriggers();
        this.drawMap();
    }

    loadTriggers() {
        this.triggers = [];
        this.loadedEvents = [];

        if (this.isWorld) {
            if (this.w !== 2) this.loadWorldTriggers();
            return;
        }

        // load triggers
        const triggers = this.rom.mapTriggerPointers.item(this.mapProperties.events.value).triggerPointer.target;
        for (let i = 0; i < triggers.arrayLength; i++) {
            const trigger = triggers.item(i);
            if (trigger.triggerType.value === 0) {
                // map event
                this.loadEvent(trigger);

                let e = trigger.event2.value;
                if (e === -1) e = trigger.event.value; // no script pointer
                if (e === -1) continue; // no event

            } else {
                // npc
                this.observer.startObservingSub(trigger, this.reloadTriggers);
                this.triggers.push(trigger);
            }
        }
    }

    loadWorldTriggers() {

        // load triggers
        let worldTriggersIndex = 0;
        if (this.w === 1) worldTriggersIndex = 1;
        if (this.w === 3) worldTriggersIndex = 2;
        const triggers = this.rom.worldTriggers;
        this.observer.startObserving(triggers, this.reloadTriggers);

        let currentIndex = 0;
        for (let i = 0; i < triggers.arrayLength; i++) {
            const trigger = triggers.item(i);
            if (trigger.data[0] === 0) {
                currentIndex++;
                continue;
            }
            if (worldTriggersIndex !== currentIndex) continue;
            this.observer.startObservingSub(trigger, this.reloadTriggers);
            this.triggers.push(trigger);
        }
    }

    fixTreasure(trigger) {
        trigger.name = 'Treasure';
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

    fixNPC(trigger) {
        trigger.name = 'NPC';
        trigger.eventSwitch.invalid = true;
        trigger.item.invalid = true;
        trigger.battle.invalid = true;
        trigger.gil.invalid = true;
        trigger.openTile.invalid = true;
    }

    fixEvent(trigger) {
        trigger.name = 'Event';
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

    loadEvent(object) {

        let e = object.event2.value;
        if (e === 0xFFFE) return; // current event
        if (e === -1) e = object.event.value; // no script pointer
        if (e === -1) return; // no event
        if (this.loadedEvents.includes(e)) return; // event already loaded
        this.loadedEvents.push(e);

        const event = this.rom.eventScript.item(e);
        if (!event) return;

        for (let c = 0; c < event.command.length; c++) {
            const command = event.command[c];
            if (command.key === 'createObject') {
                this.observer.startObservingSub(command, this.reloadTriggers);
                this.triggers.push(command);
            } else if (command.key === 'jumpPosition') {
                this.observer.startObservingSub(command, this.reloadTriggers);
                this.triggers.push(command);
            } else if (command.key === 'jumpPositionShort') {
                this.observer.startObservingSub(command, this.reloadTriggers);
                this.triggers.push(command);
            } else if (command.key === 'selectDeleteTrigger') {
                this.observer.startObservingSub(command, this.reloadTriggers);
                this.triggers.push(command);
            }

            if (command.scriptPointer && command.event2) {
                // load nested events
                this.loadEvent(command);
            }
        }
    }

    selectTrigger(trigger) {
        this.selectedTrigger = trigger;
        propertyList.select(trigger);
        if (!trigger) return;
        this.triggerPoint = {
            x: this.selectedTrigger.x.value,
            y: this.selectedTrigger.y.value
        };

        if (this.selectedTrigger.key === 'npcProperties') {
            const script = this.rom.npcScript.item(trigger.switch.value);
            propertyList.select(script);
        } else if (this.selectedTrigger instanceof ROMCommand) {
            const script = this.selectedTrigger.parent;
            propertyList.select(script);
            scriptList.selectCommand(this.selectedTrigger);
        } else if (this.selectedTrigger.object) {
            trigger = this.selectedTrigger.object;
        }
        propertyList.select(trigger);
    }

    insertTrigger(type) {

        this.closeMenu();

        const triggers = this.rom.mapTriggers.item(this.m);
        if (this.isWorld) triggers = this.rom.worldTriggers.item(this.m - 0xFB);

        const trigger = triggers.blankAssembly();

        this.beginAction(this.reloadTriggers);
        trigger.x.setValue(this.clickPoint.x);
        trigger.y.setValue(this.clickPoint.y);
        if (type === 'treasureProperties') {
            trigger.map.setValue(0xFE);

            // treasures have to come first
            let i = 0;
            while (i < triggers.arrayLength && triggers.item(i).map.value === 0xFE) i++;
            triggers.insertAssembly(trigger, i);
    //        this.logTreasures();
            this.updateTreasures();
    //        this.logTreasures();

        } else if (type === 'eventTriggers') {
            trigger.map.setValue(0xFF);
            triggers.insertAssembly(trigger);
        } else {
            triggers.insertAssembly(trigger);
        }
        this.endAction(this.reloadTriggers);

        this.selectedTrigger = trigger;
        propertyList.select(trigger);
    }

    updateTreasures() {
        let t = 0;
        for (let m = 0; m < this.rom.mapProperties.arrayLength; m++) {
            if (m === 256) t = 0; // reset to zero for underground/moon treasures
            this.rom.mapProperties.item(m).treasure.setValue(t);
            const triggers = this.rom.mapTriggers.item(m);
            for (const trigger of triggers.iterator()) {
                if (trigger.map.value === 0xFE) t++;
            }
        }
    }

    insertNPC() {
        this.closeMenu();

        // get the npc properties
        if (this.isWorld) return;
        const npcIndex = this.mapProperties.npc.value;
        if (npcIndex === 0 && this.m !== 0) return;
        const npcProperties = this.rom.npcProperties.item(npcIndex);

        const npc = npcProperties.blankAssembly();

        this.beginAction(this.reloadTriggers);
        npc.x.setValue(this.clickPoint.x);
        npc.y.setValue(this.clickPoint.y);
        npc.switch.setValue(1);
        npcProperties.insertAssembly(npc);
        this.endAction(this.reloadTriggers);

        this.selectedTrigger = npc;
        propertyList.select(npc);
    }

    deleteTrigger() {

        this.closeMenu();
        const trigger = this.selectedTrigger;
        if (!trigger) return;
        const triggers = trigger.parent;
        const index = triggers.array.indexOf(trigger);
        if (index === -1) return;

        this.beginAction(this.reloadTriggers);
        triggers.removeAssembly(index);
        this.endAction(this.reloadTriggers);

        this.selectedTrigger = null;
        propertyList.select(null);
    }

    drawTriggerRect(x, y, color, context) {

        // function for drawing trigger rectangles with rounded corners
        const r = this.zoom * 2;
        const s = this.zoom * 16 - 4 + 1;

        context.lineWidth = 1;
        context.strokeStyle = 'white';
        context.fillStyle = color;

        context.beginPath();
        context.moveTo(x, y + r);
        context.arcTo(x, y, x + r, y, r);
        context.lineTo(x + s - r, y);
        context.arcTo(x + s, y, x + s, y + r, r);
        context.lineTo(x + s, y + s - r);
        context.arcTo(x + s, y + s, x + s - r, y + s, r);
        context.lineTo(x + r, y + s);
        context.arcTo(x, y + s, x, y + s - r, r);
        context.closePath();
        context.fill();
        context.stroke();
    }

    drawTriggers() {

        if (!this.showTriggers) return;
        const xClient = this.mapRect.l;
        const yClient = this.mapRect.t;
        const ctx = this.canvas.getContext('2d');
        ctx.globalCompositeOperation = 'source-over';

        for (let i = 0; i < this.triggers.length; i++) {
            const trigger = this.triggers[i];
            const triggerRect = this.rectForTrigger(trigger);
            if (this.mapRect.intersect(triggerRect).isEmpty()) continue;
            let c = 'purple';
            switch (trigger.key) {
                case 'jumpPosition':
                case 'jumpPositionShort':
                    c = 'rgba(0, 0, 255, 0.5)';
                    for (let y = 0; y < trigger.height.value; y++) {
                        for (let x = 0; x < trigger.width.value; x++) {
                            this.drawTriggerRect((trigger.x.value + x) * this.zoom * 16 + 2 - 0.5 - xClient, (trigger.y.value + y) * this.zoom * 16 + 2 - 0.5 - yClient, c, ctx);
                        }
                    }
                    continue;
                case 'createObject':
                case 'selectDeleteTrigger':
                    c = 'rgba(0, 0, 255, 0.5)';
                    break;
                case 'worldTriggers':
                    for (let y = 0; y < trigger.height.value; y++) {
                        for (let x = 0; x < trigger.width.value; x++) {
                            const tp = this.tilePropertiesAtTile(trigger.x.value + x, trigger.y.value + y);
                            if (tp.tileValue.value === 2) {
                                c = 'rgba(255, 0, 0, 0.5)'; // forest
                            } else if (tp.tileValue.value > 4 && tp.tileValue.value !== 0) {
                                c = 'rgba(255, 0, 0, 0.5)'; // trigger tile
                            } else {
                                c = 'rgba(0, 0, 0, 0)'; // not a trigger tile
                            }
                            this.drawTriggerRect((trigger.x.value + x) * this.zoom * 16 + 2 - 0.5 - xClient, (trigger.y.value + y) * this.zoom * 16 + 2 - 0.5 - yClient, c, ctx);
                        }
                    }
                    continue;
    //            case 'entranceTriggers':
    //                c = 'rgba(255, 0, 0, 0.5)';
    //                break;
    //            case 'treasureProperties':
    //                c = 'rgba(255, 255, 0, 0.5)';
    //                break;
                case 'mapTriggers':
                case 'npcProperties':
                    c = 'rgba(128, 128, 128, 0.5)';
                    break;
            }
            this.drawTriggerRect(trigger.x.value * this.zoom * 16 + 2 - 0.5 - xClient, trigger.y.value * this.zoom * 16 + 2 - 0.5 - yClient, c, ctx);
        }

        for (let i = 0; i < this.triggers.length; i++) {
            const npc = this.triggers[i];
            if (npc.graphics && npc.graphics.value) this.drawNPC(npc);
        }
    }

    triggerAt(x, y) {

        const triggers = this.triggersAt(x, y);
        if (triggers.length === 0) return null;
        return triggers[0];
    }

    triggersAt(x, y) {
        const triggers = [];

        for (const trigger of this.triggers) {
            const rect = this.rectForTrigger(trigger);
            if (rect.containsPoint(x, y)) triggers.push(trigger);
        }
        return triggers;
    }

    rectForTrigger(trigger) {
        let l = trigger.x.value * 16 * this.zoom;
        let r = l + 16 * this.zoom;
        let t = trigger.y.value * 16 * this.zoom;
        let b = t + 16 * this.zoom;

        if (trigger.width && trigger.height) {
            r = l + 16 * this.zoom * (trigger.width.value + 1);
            b = t + 16 * this.zoom * (trigger.height.value + 1);
        }

        return new Rect(l, r, t, b);
    }

    drawNPC(npc) {

        let x = npc.x.value * 16;
        let y = npc.y.value * 16;
        let w = 16;
        let h = 16;

        const spriteProperties = this.rom.mapSpriteProperties.item(npc.graphics.value);
        const offset = spriteProperties.offset.value - 0x0400;
        const size = spriteProperties.size.value;

        // load palette
        const paletteData = this.rom.mapSpriteGraphics.item(offset);
        if (!paletteData.format) {
            paletteData.format = 'bgr555';
            paletteData.disassemble(paletteData.parent.data);
        }

        const direction = npc.direction.value;
        const tiles = new Uint16Array(size);
        for (let t = 0; t < size; t++) tiles[t] = t;
        let g = offset + 1;
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
        const graphicsData = this.rom.mapSpriteGraphics.item(g);
        if (!graphicsData.format) {
            graphicsData.format = 'linear4bpp';
            graphicsData.disassemble(graphicsData.parent.data);
        }

        let npcRect = new Rect(x, x + w, y - 2, y + h - 2);
        npcRect = npcRect.scale(this.zoom);
        if (this.mapRect.intersect(npcRect).isEmpty()) return;

        // set up the ppu
        const ppu = new GFX.PPU();
        ppu.pal = this.rom.gammaCorrectedPalette(paletteData.data);
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
        const npcContext = this.npcCanvas.getContext('2d');
        const imageData = npcContext.createImageData(w, h);
        ppu.renderPPU(imageData.data);
        npcContext.putImageData(imageData, 0, 0);

        const ctx = this.canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.globalCompositeOperation = 'source-over';
        npcRect = npcRect.offset(-this.mapRect.l, -this.mapRect.t);
        ctx.drawImage(this.npcCanvas, 0, 0, w, h, npcRect.l, npcRect.t, npcRect.w, npcRect.h);

    }
}

FF4MapGBA.ZLevel = {
    upper: 'upper',
    lower: 'lower'
}

FF4MapGBA.WorldTileMasks = {
    none: 'None',
    passability: 'Passability'
}

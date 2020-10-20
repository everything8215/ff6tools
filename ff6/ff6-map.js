//
// ff6-map.js
// created 1/11/2018
//

class FF6Map extends ROMEditor_ {
    constructor(rom) {
        super(rom);

        this.name = 'FF6Map';
        this.tileset = new FF6MapTileset(rom, this);

        this.div = document.createElement('div');
        this.div.id = 'map-edit';

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
        this.isWorld = false;
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
        this.layer = [
            new FF6MapLayer(rom, FF6MapLayer.Type.layer1),
            new FF6MapLayer(rom, FF6MapLayer.Type.layer2),
            new FF6MapLayer(rom, FF6MapLayer.Type.layer3),
            new FF6MapLayer(rom, FF6MapLayer.Type.overlay)
        ];
        this.selectedLayer = this.layer[0];
        this.showCursor = true;
        this.showLayer1 = true;
        this.showLayer2 = true;
        this.showLayer3 = true;
        this.showTriggers = true;
        this.showScreen = false;
        this.showCursor = false;
        this.triggers = [];
        this.selectedTrigger = null;
        this.observer = new ROMObserver(rom, this);
        this.ppu = new GFX.PPU();

        this.screenCanvas = document.createElement('canvas');
        this.screenCanvas.id = 'map-screen';
        this.screenCanvas.width = 256;
        this.screenCanvas.width = 256;
        this.scrollDiv.appendChild(this.screenCanvas);

        // mask layer/overlay stuff
        this.tileMask = FF6Map.TileMasks.none;
        this.overlayCanvas = document.createElement('canvas');
        this.overlayPPU = new GFX.PPU();

        // add event listeners
        const self = this;
        this.scrollDiv.parentElement.onscroll = function() { self.scroll(); };
        this.scrollDiv.onmousedown = function(e) { self.mouseDown(e); };
        this.scrollDiv.onmouseup = function(e) { self.mouseUp(e); };
        this.scrollDiv.onmousemove = function(e) { self.mouseMove(e); };
        this.scrollDiv.onmouseenter = function(e) { self.mouseEnter(e); };
        this.scrollDiv.onmouseleave = function(e) { self.mouseLeave(e); };
        this.scrollDiv.oncontextmenu = function(e) { self.openMenu(e); return false; };
        this.resizeSensor = null;

        this.updateTilesetDefinitions();

        // check if GBA triggers have already been fixed
        if (this.rom.isGBA) {
            const eventTriggersGBA = this.rom.eventTriggersAdvance;
            const npcPropertiesGBA = this.rom.npcPropertiesAdvance;
            if (eventTriggersGBA instanceof ROMArray ||
                npcPropertiesGBA instanceof ROMArray) {
                this.showFixGBATriggersDialog();
            }
        }
    }

    showFixGBATriggersDialog() {
        const self = this;

        // prompt the user to see if they want to fix the triggers
        const content = openModal('Fix GBA Triggers');

        const p = document.createElement('p');
        p.innerHTML = 'Some triggers in FF6 Advance are stored separately ' +
            'from the others. It is recommended to consolidate all of the ' +
            'triggers if you plan to modify any triggers. This will result ' +
            'in some data being relocated. Would you like FF6Tools to do this?';
        content.appendChild(p);

        const yesButton = document.createElement('button');
        yesButton.innerHTML = 'Yes';
        yesButton.onclick = function() {
            closeModal();
            self.rom.beginAction();
            self.fixGBATriggers(self.rom.eventTriggers, self.rom.eventTriggersAdvance);
            self.fixGBATriggers(self.rom.npcProperties, self.rom.npcPropertiesAdvance);
            self.rom.endAction();
        };
        content.appendChild(yesButton);

        const noButton = document.createElement('button');
        noButton.innerHTML = 'No';
        noButton.onclick = function() { closeModal(); };
        content.appendChild(noButton);
    }

    fixGBATriggers(triggers, triggersGBA) {

        // return if trigger arrays are invalid
        if (!triggers || !triggersGBA) return;

        // return if GBA triggers are already fixed
        if (triggersGBA.type === ROMObject.Type.assembly) return;

        // create new trigger arrays for the GBA maps
        const mapCount = this.rom.mapProperties.arrayLength;
        while (triggers.arrayLength < mapCount) {
            // add a blank trigger array for each map
            triggers.insertAssembly(triggers.blankAssembly());
        }

        // copy all GBA triggers to the normal trigger array
        for (const oldTrigger of triggersGBA.iterator()) {
            const m = oldTrigger.map.value;
            const mapTriggers = triggers.item(m);
            const newTrigger = mapTriggers.blankAssembly();

            // copy all trigger properties
            for (const key in newTrigger.assembly) {
                // skip categories
                if (!newTrigger[key]) continue;
                newTrigger[key].setValue(oldTrigger[key].value);
            }

            // add the trigger to the map's trigger array
            mapTriggers.insertAssembly(newTrigger);
        }

        // replace the GBA triggers with a 2-byte null terminator
        const definition = triggersGBA.definition;
        definition.type = 'assembly';
        delete definition.assembly;
        delete definition.pointerTable;
        definition.name += ' Placeholder';
        const placeholder = this.rom.addAssembly(definition);
        const placeholderData = new Uint8Array(2);
        placeholder.disassemble(this.rom.data);
        placeholder.setData(placeholderData);
        placeholder.markAsDirty();
    }

    updateTilesetDefinitions() {

        for (const tileset of this.rom.mapTilesets.iterator()) {
            tileset.palette = [];
            tileset.graphics = [];
        }

        for (let m = 3; m < this.rom.mapProperties.arrayLength; m++) {
            const mp = this.rom.mapProperties.item(m);
            const t1 = mp.tileset1.value;
            const t2 = mp.tileset2.value;
            const g1 = mp.gfx1.value;
            const g2 = mp.gfx2.value;
            const g3 = mp.gfx3.value;
            const g4 = mp.gfx4.value;
            const p = mp.palette.value;

            // skip dummy maps
            if (g1 + g2 + g3 + g4 === 0) continue;

            const graphicsDefinition = [
                {
                    path: `mapGraphics[${g1}]`,
                    offset: 0x0000
                }, {
                    path: `mapGraphics[${g2}]`,
                    offset: 0x4000
                }, {
                    path: `mapGraphics[${g3}]`,
                    offset: 0x6000
                }
            ];

            if (g3 !== g4) graphicsDefinition.push({
                path: `mapGraphics[${g4}]`,
                offset: 0x8000
            });

            const paletteDefinition = `mapPalettes[${p}]`;

            const tileset1 = this.rom.mapTilesets.item(t1);
            const tileset2 = this.rom.mapTilesets.item(t2);

            if (!tileset1.graphics.length) {
                tileset1.graphics.push(graphicsDefinition);
            }
            if (!tileset2.graphics.length) {
                tileset2.graphics.push(graphicsDefinition);
            }
            if (!tileset1.palette.includes(paletteDefinition)) {
                tileset1.palette.push(paletteDefinition);
            }
            if (!tileset2.palette.includes(paletteDefinition)) {
                tileset2.palette.push(paletteDefinition);
            }
        }
    }

    show() {
        this.showControls();
        this.tileset.show();
    }

    hide() {
        this.observer.stopObservingAll();
        if (this.resizeSensor) {
            this.resizeSensor.detach(document.getElementById('edit-top'));
            this.resizeSensor = null;
        }
        this.tileset.hide();
    }

    selectObject(object) {

        if (this.mapProperties === object) return;

        this.mapProperties = object;
        this.m = object.i;

        if (this.m < 3) {
            // world map
            this.isWorld = true;
            this.loadWorldMap();
            propertyList.select(null);
        } else {
            // normal map
            this.isWorld = false;
            this.loadMap();
        }
    }

    resetControls() {

        super.resetControls();

        const self = this;

        // add layer toggle buttons
        this.addTwoState('showLayer1', function() {
            self.changeLayer('showLayer1');
        }, 'Layer 1', this.showLayer1);
        this.addTwoState('showLayer2', function() {
            self.changeLayer('showLayer2');
        }, 'Layer 2', this.showLayer2);
        this.addTwoState('showLayer3', function() {
            self.changeLayer('showLayer3');
        }, 'Layer 3', this.showLayer3);
        this.addTwoState('showTriggers', function() {
            self.changeLayer('showTriggers');
        }, 'Triggers', this.showTriggers);

        // add tile mask button
        const maskArray = this.isWorld ? FF6Map.WorldTileMasks : FF6Map.TileMasks;
        const maskKeys = Object.keys(maskArray);
        const maskNames = [];
        for (let i = 0; i < maskKeys.length; i++) {
            maskNames[i] = maskArray[maskKeys[i]];
        }
        if (!maskNames.includes(this.tileMask)) {
            this.tileMask = FF6Map.TileMasks.none;
        }
        function onChangeMask(mask) {
            self.tileMask = maskArray[maskKeys[mask]];
            self.drawMap();
            self.tileset.redraw();
        };
        function maskSelected(mask) {
            return self.tileMask === maskArray[maskKeys[mask]];
        };
        this.addList('showMask', 'Mask', maskNames, onChangeMask, maskSelected);

        // add screen mask button
        this.addTwoState('showScreen', function() {
            self.changeLayer('showScreen');
        }, 'Screen', this.showScreen);

        // add zoom control
        this.addZoom(this.zoom, function() {
            self.changeZoom();
        });

        // notify on resize
        const editTop = document.getElementById('edit-top');
        if (!this.resizeSensor) {
            this.resizeSensor = new ResizeSensor(editTop, function() {
                self.scroll();
            });
        }
    }

    changeZoom() {

        // save the old scroll location
        const l = this.div.scrollLeft;
        const t = this.div.scrollTop;
        const w = this.div.clientWidth;
        const h = this.div.clientHeight;
        const oldRect = new Rect(l, l + w, t, t + h);

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
        const x = Math.round(oldRect.centerX / this.zoom) * this.zoom;
        const y = Math.round(oldRect.centerY / this.zoom) * this.zoom;
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
        const x = e.offsetX / this.zoom + this.ppu.layers[this.l].x;
        const y = e.offsetY / this.zoom + this.ppu.layers[this.l].y;

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
                if (this.isWorld) {
                    // select world map battle
                    this.selectWorldBattle(this.clickPoint.x, this.clickPoint.y);
                } else {
                    // select map properties
                    propertyList.select(this.mapProperties);
                }
                this.isDragging = false;
            }
        } else if (this.clickPoint.button === 2) {
            // right mouse button down - select tiles
            this.selectTiles();
            this.isDragging = true;

        } else {
            // left mouse button down - draw tiles
            this.beginAction(this.drawMap);
            this.rom.doAction(new ROMAction(this.selectedLayer, this.selectedLayer.decodeLayout, null, 'Decode Layout'));
            if (!this.isWorld && this.l === 0) {
                this.rom.doAction(new ROMAction(this.layer[3], this.layer[3].decodeLayout, null, 'Decode Overlay Layout'));
            }
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
        // const x = ((e.offsetX / this.zoom + this.ppu.layers[this.l].x) % this.ppu.width) >> 4;
        // const y = ((e.offsetY / this.zoom + this.ppu.layers[this.l].y) % this.ppu.height) >> 4;

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
        } else {
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
                this.selectedTrigger.x.setValue(x);
                this.selectedTrigger.y.setValue(y);
                this.endAction(this.reloadTriggers);
            }
        } else if (this.rom.action && this.isDragging) {
            this.rom.doAction(new ROMAction(this.selectedLayer, null, this.selectedLayer.decodeLayout, 'Decode Layout'));
            if (!this.isWorld && this.l === 0) {
                this.rom.doAction(new ROMAction(this.layer[3], null, this.layer[3].decodeLayout, 'Decode Overlay Layout'));
            }
            this.rom.pushAction(new ROMAction(this, null, this.drawMap, 'Redraw Map'));
            this.endAction();
        }

        this.isDragging = false;
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
        this.drawScreen();
        this.drawCursor();

        this.mouseUp(e);
    }

    openMenu(e) {
        if (this.l !== 3) return; // no menu unless editing triggers
        this.updateMenu();

        this.clickPoint = {
            x: ((e.offsetX / this.zoom + this.ppu.layers[this.l].x) % this.ppu.width) >> 4,
            y: ((e.offsetY / this.zoom + this.ppu.layers[this.l].y) % this.ppu.height) >> 4,
            button: e.button
        };

        this.menu.classList.add('menu-active');
        this.menu.style.left = `${e.x}px`;
        this.menu.style.top = `${e.y}px`;
    }

    closeMenu() {
        this.menu.classList.remove('menu-active');
    }

    updateMenu() {
        this.menu.innerHTML = '';

        const self = this;
        function appendMenuItem(label, onclick) {
            const li = document.createElement('li');
            li.classList.add('menu-item');
            li.innerHTML = label;
            if (onclick) {
                li.onclick = onclick;
            } else {
                li.classList.add('menu-item-disabled');
            }
            self.menu.appendChild(li);
        }

        appendMenuItem('Insert Entrance Trigger (Single-Tile)', function() {
            self.insertTrigger('entranceTriggersSingle');
        });
        appendMenuItem('Insert Entrance Trigger (Multi-Tile)', this.isWorld ? null : function() {
            self.insertTrigger('entranceTriggersMulti');
        });
        appendMenuItem('Insert Event Trigger', function() {
            self.insertTrigger('eventTriggers');
        });
        appendMenuItem('Insert Treasure', this.isWorld ? null : function() {
            self.insertTrigger('treasureProperties');
        });
        appendMenuItem('Insert NPC', this.isWorld ? null : function() {
            self.insertTrigger('npcProperties');
        });
        appendMenuItem('Delete Trigger', !this.selectedTrigger ? null : function() {
            self.deleteTrigger();
        });
    }

    setTiles() {
        // return if not dragging
        if (!this.clickPoint) return;

        const x = this.selection.x;
        const y = this.selection.y;
        const w = this.selection.w;
        const h = this.selection.h;

        const l = ((x << 4) - this.ppu.layers[this.l].x) & (this.ppu.width - 1);
        const r = l + (w << 4);
        const t = ((y << 4) - this.ppu.layers[this.l].y) & (this.ppu.height - 1);
        const b = t + (h << 4);
        const rect = new Rect(l, r, t, b);

        this.selectedLayer.setLayout(this.selection);
        if (!this.isWorld && this.l === 0) {
            // update overlay layout
            this.layer[3].setLayout(this.selection);
        }
        const self = this;
        function invalidate() { self.invalidateMap(rect); };
        this.rom.doAction(new ROMAction(this, invalidate, invalidate, 'Invalidate Map'));
        this.drawMap();
    }

    selectTiles() {
        // return if not dragging
        if (!this.clickPoint) return;

        const x = Math.min(this.selection.x, this.clickPoint.x);
        const y = Math.min(this.selection.y, this.clickPoint.y);
        const w = Math.abs(this.selection.x - this.clickPoint.x) + 1;
        const h = Math.abs(this.selection.y - this.clickPoint.y) + 1;

        this.selection = this.selectedLayer.getLayout(x, y, w, h);

        if (w === 1 && h === 1) {
            // select a single tile in the tileset view
            const tile = this.selection.tilemap[0];
            this.tileset.selection = {
                x: tile & 0x0F,
                y: tile >> 4,
                w: 1, h: 1,
                tilemap: new Uint8Array([tile])
            };
            this.selectTileProperties(tile);
        } else {
            this.tileset.selection = null;
        }
        this.tileset.drawCursor();
    }

    selectWorldBattle(x, y) {
        if (this.m > 1) return;

        x >>= 5;
        y >>= 5;

        const sector = x | (y << 3) | (this.m << 6);
        const battleGroup = this.rom.worldBattleGroup.item(sector);
        propertyList.select(battleGroup);
    }

    selectTileProperties(t) {

        if (this.l !== 0) return;

        // select tile properties
        const tileProperties = this.tilePropertiesAtTile(t);
        if (tileProperties) propertyList.select(tileProperties);
    }

    tilePropertiesAtTile(t) {
        if (this.isWorld) {
            // world map tile properties
            if (this.m === 2) return null;
            return this.rom.worldTileProperties.item(this.m).item(t);
        } else {
            // layer 1 tile properties determined by graphics index
            const tp = this.mapProperties.tileProperties.value;
            return this.rom.mapTileProperties.item(tp).item(t);
        }
    }

    selectLayer(l) {
        // set the selected layer
        l = Number(l);
        if (isNumber(l)) this.l = l;

        if (this.isWorld) {
            this.selectedLayer = this.layer[0]
        } else {
            this.selectedLayer = this.layer[this.l]
        }

        this.showCursor = (this.l === 3);
        this.drawScreen();
        this.drawCursor();
    }

    changeLayer(id) {
        this[id] = document.getElementById(id).checked;
        this.ppu.layers[0].main = this.showLayer1;
        if (!this.isWorld) {
            const mp = this.mapProperties;
            const colorMath = this.rom.mapColorMath.item(mp.colorMath.value);
            const subscreen = colorMath.subscreen.value;
            const mainscreen = colorMath.mainscreen.value;
            this.ppu.layers[0].sub = this.showLayer1 && (subscreen & 0x01);
            this.ppu.layers[1].main = this.showLayer2 && (mainscreen & 0x02);
            this.ppu.layers[1].sub = this.showLayer2 && (subscreen & 0x02);
            this.ppu.layers[2].main = this.showLayer3 && (mainscreen & 0x04);
            this.ppu.layers[2].sub = this.showLayer3 && (subscreen & 0x04);
        }
        this.invalidateMap();
        this.drawMap();
    }

    loadMap(m) {

        this.resetControls();
        this.observer.stopObservingAll();
        const mp = this.mapProperties;

        // start observing relevant map properties
        this.observer.startObserving([
            mp.gfx1, mp.gfx2, mp.gfx3, mp.gfx4,
            mp.tileProperties,
            mp.animation,
            mp.gfxLayer3,
            mp.animationLayer3,
            mp.layer3Priority,
            mp.palette,
            mp.overlay,
            mp.tileset1, mp.tileset2,
            mp.layout1, mp.layout2, mp.layout3,
            mp.vSize1, mp.hSize1,
            mp.vSize2, mp.hSize2,
            mp.vSize3, mp.hSize3,
            mp.hOffset2, mp.vOffset2,
            mp.hOffset3, mp.vOffset3,
            mp.width, mp.height,
            mp.colorMath
        ], this.loadMap);

        // observe tile properties (redraw map and tileset, don't reload map)
        const self = this;
        const tp = this.rom.mapTileProperties.item(mp.tileProperties.value);
        for (const tile of tp.iterator()) {
            this.observer.startObservingSub(tile, function() {
                self.drawMap();
                self.tileset.redraw();
            });
        }

        // set the default battle background
        const battleEditor = propertyList.getEditor('FF6Battle');
        if (battleEditor) battleEditor.bg = this.mapProperties.battleBackground.value;

        // load graphics
        const gfx = new Uint8Array(0x10000);
        const g1 = mp.gfx1.value;
        const g2 = mp.gfx2.value;
        const g3 = mp.gfx3.value;
        const g4 = mp.gfx4.value;

        const graphics1 = this.rom.mapGraphics.item(g1);
        this.observer.startObserving(graphics1, this.loadMap);
        gfx.set(graphics1.data, 0x0000);

        const graphics2 = this.rom.mapGraphics.item(g2);
        this.observer.startObserving(graphics2, this.loadMap);
        gfx.set(graphics2.data, 0x4000);

        const graphics3 = this.rom.mapGraphics.item(g3);
        this.observer.startObserving(graphics3, this.loadMap);
        gfx.set(graphics3.data, 0x6000);

        if (g3 !== g4) {
            const graphics4 = this.rom.mapGraphics.item(g4);
            this.observer.startObserving(graphics4, this.loadMap);
            gfx.set(graphics4.data, 0x8000);
        }

        // load animation graphics
        const animGfx = this.rom.mapAnimationGraphics;
        this.observer.startObserving(animGfx, this.loadMap);
        const anim = this.rom.mapAnimationProperties.item(mp.animation.value);
        for (let i = 0; i < anim.arrayLength; i++) {
            const f = anim.item(i).frame1.value * 2;
            gfx.set(animGfx.data.subarray(f, f + 0x100), 0xA000 + i * 0x0100);
        }

        // load layer 3 graphics
        const graphicsLayer3 = this.rom.mapGraphicsLayer3.item(mp.gfxLayer3.value);
        this.observer.startObserving(graphicsLayer3.graphics, this.loadMap);
        gfx.set(graphicsLayer3.graphics.data, 0xC000);

        // load layer 3 animation graphics
        const a3 = mp.animationLayer3.value;
        if (a3 !== 0) {
            const animGfx3 = this.rom.mapAnimationGraphicsLayer3.item(a3 - 1);
            this.observer.startObserving(animGfx3, this.loadMap);
            const anim = this.rom.mapAnimationPropertiesLayer3.item(a3 - 1);
            const size = anim.size.value * (this.rom.isGBA ? 2 : 4);
            const f = anim.frame1.value * (this.rom.isGBA ? 2 : 4);
            gfx.set(animGfx3.data.subarray(f, f + size), 0xC000);
        }

        // load palette
        const paletteObject = this.rom.mapPalettes.item(mp.palette.value);
        this.observer.startObserving(paletteObject, this.loadMap);
        const pal = new Uint32Array(paletteObject.data);
        pal[0] = 0xFF000000; // set background color to black

        const mapSizes = [16, 32, 64, 128];

        // load and de-interlace tile layouts
        const height1 = mapSizes[mp.vSize1.value];
        const width1 = mapSizes[mp.hSize1.value];
        const layout1 = this.rom.mapLayouts.item(mp.layout1.value)
        const tileset1 = this.rom.mapTilesets.item(mp.tileset1.value).data;
        this.layer[0].type = FF6MapLayer.Type.layer1;
        this.layer[0].loadLayout({
            layout: layout1,
            tileset: tileset1,
            w: width1,
            h: height1
        });

        const height2 = mapSizes[mp.vSize2.value];
        const width2 = mapSizes[mp.hSize2.value];
        const layout2 = this.rom.mapLayouts.item(mp.layout2.value)
        const tileset2 = this.rom.mapTilesets.item(mp.tileset2.value).data;
        this.layer[1].loadLayout({
            layout: layout2,
            tileset: tileset2,
            w: width2,
            h: height2
        });

        const height3 = mapSizes[mp.vSize3.value];
        const width3 = mapSizes[mp.hSize3.value];
        const layout3 = this.rom.mapLayouts.item(mp.layout3.value)
        const tileset3 = graphicsLayer3.tileset.data;
        this.layer[2].loadLayout({
            layout: layout3,
            tileset: tileset3,
            w: width3,
            h: height3,
            priority: mp.layer3Priority.value
        });

        // load overlay graphics and layout
        const overlayProperties = this.rom.mapOverlayProperties.item(mp.overlay.value);
        const overlayGraphics = new Uint8Array(0x10000);
        overlayGraphics.set(this.rom.mapOverlayGraphics.data, 64);
        this.layer[3].loadLayout({
            layout: layout1,
            tileset: overlayProperties.data,
            overlayTiles: this.rom.mapOverlayLayout.data,
            w: width1,
            h: height1
        });

        // get color math properties
        const colorMath = this.rom.mapColorMath.item(mp.colorMath.value);
        this.observer.startObserving([
            colorMath.subtract,
            colorMath.half,
            colorMath.mathLayers,
            colorMath.mainscreen,
            colorMath.subscreen
        ], this.loadMap);

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(pal);
        this.ppu.height = Math.max(height1, height2, height3) * 16;
        this.ppu.width = Math.max(width1, width2, width3) * 16;
        this.ppu.back = true;
        this.ppu.subtract = colorMath.subtract.value;
        this.ppu.half = colorMath.half.value;

        // layer 1
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
        this.ppu.layers[1].cols = this.layer[1].w * 2;
        this.ppu.layers[1].rows = this.layer[1].h * 2;
        this.ppu.layers[1].x = mp.hOffset2.value * 16;
        this.ppu.layers[1].y = mp.vOffset2.value * 16;
        this.ppu.layers[1].z[0] = GFX.Z.snes2L;
        this.ppu.layers[1].z[1] = GFX.Z.snes2H;
        this.ppu.layers[1].gfx = gfx;
        this.ppu.layers[1].tiles = this.layer[1].tiles;
        this.ppu.layers[1].main = this.showLayer2 && (colorMath.mainscreen.value & 0x02);
        this.ppu.layers[1].sub = this.showLayer2 && (colorMath.subscreen.value & 0x02);
        this.ppu.layers[1].math = (colorMath.mathLayers.value & 0x02);

        // layer 3
        const format = this.rom.isSFC ? GFX.TileFormat.snes2bppTile : GFX.TileFormat.gba2bppTile;
        this.ppu.layers[2].format = format;
        this.ppu.layers[2].cols = this.layer[2].w * 2;
        this.ppu.layers[2].rows = this.layer[2].h * 2;
        this.ppu.layers[2].x = mp.hOffset3.value * 16;
        this.ppu.layers[2].y = mp.vOffset3.value * 16;
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
        this.overlayPPU.pal[0] = '0xFF000000';
        this.overlayPPU.pal[1] = '0xA0FFFFFF';
        this.overlayPPU.width = this.ppu.width;
        this.overlayPPU.height = this.ppu.width;

        // overlay layer
        this.overlayPPU.layers[0].cols = this.ppu.layers[0].cols;
        this.overlayPPU.layers[0].rows = this.ppu.layers[0].rows;
        this.overlayPPU.layers[0].z[0] = GFX.Z.top;
        this.overlayPPU.layers[0].z[1] = GFX.Z.top;
        this.overlayPPU.layers[0].gfx = overlayGraphics;
        this.overlayPPU.layers[0].tiles = this.layer[3].tiles;
        this.overlayPPU.layers[0].main = true;

        this.scrollDiv.style.width = `${this.ppu.width * this.zoom}px`;
        this.scrollDiv.style.height = `${this.ppu.height * this.zoom}px`;
        this.mapCanvas.width = this.ppu.width;
        this.mapCanvas.height = this.ppu.height;
        this.overlayCanvas.width = this.ppu.width;
        this.overlayCanvas.height = this.ppu.height;

        this.invalidateMap();
        this.selectedTrigger = null;
        this.loadTriggers();
        this.scroll();

        this.tileset.loadMap();
    }

    loadWorldMap(m) {

        this.resetControls();
        this.observer.stopObservingAll();
        this.mapProperties = null;

        // load graphics and layout
        const layout = this.rom[`worldLayout${this.m + 1}`];
        const paletteObject = this.rom[`worldPalette${this.m + 1}`];
        const graphicsData = this.rom[`worldGraphics${this.m + 1}`];
        const tileset = graphicsData.tileset.data;
        const gfx = graphicsData.graphics.data;
        const paletteAssignment = this.rom.isSFC ? graphicsData.paletteAssignment.data : null;
        const size = (this.m === 2) ? 128 : 256;

        // reload map if graphics or palette changes
        this.observer.startObserving(layout, this.loadMap);
        this.observer.startObserving(paletteObject, this.loadMap);
        this.observer.startObserving(graphicsData.graphics, this.loadMap);
        this.observer.startObserving(graphicsData.tileset, this.loadMap);

        // redraw map and tileset if tile properties change
        const self = this;
        if (this.m !== 2) {
            const tileProperties = this.rom.worldTileProperties.item(this.m);
            for (const tp of tileProperties.iterator()) {
                this.observer.startObservingSub(tp, function() {
                    self.drawMap();
                    self.tileset.redraw();
                });
            }
        }

        // fix serpent trench map layout (ff6 advance)
        if (this.rom.isGBA && m === 2 && layout.data.length !== (size * size)) {
            layout.data = layout.data.subarray(0, (size * size));
        }

        this.layer[0].type = FF6MapLayer.Type.world;
        this.layer[0].loadLayout({layout: layout, tileset: tileset, w: size, h: size, paletteAssignment: paletteAssignment});

        // set up the ppu
        this.ppu = new GFX.PPU();
        this.ppu.pal = this.rom.gammaCorrectedPalette(paletteObject.data);
        this.ppu.width = size * 16;
        this.ppu.height = size * 16;
        this.ppu.back = true;

        // layer 1
        this.ppu.layers[0].cols = size * 2;
        this.ppu.layers[0].rows = size * 2;
        this.ppu.layers[0].z[0] = GFX.Z.snes1L;
        this.ppu.layers[0].z[1] = GFX.Z.snes1H;
        this.ppu.layers[0].gfx = gfx;
        this.ppu.layers[0].tiles = this.layer[0].tiles;
        this.ppu.layers[0].main = this.showLayer1; // layer 1 always in main screen

        this.scrollDiv.style.width = `${this.ppu.width * this.zoom}px`;
        this.scrollDiv.style.height = `${this.ppu.height * this.zoom}px`;
        this.mapCanvas.width = this.ppu.width;
        this.mapCanvas.height = this.ppu.height;

        this.invalidateMap();
        this.selectedTrigger = null;
        this.loadTriggers();
        this.scroll();

        this.tileset.loadMap();
    }

    invalidateMap(rect) {
        const clipX = Math.floor(this.ppu.width / 256);
        const clipY = Math.floor(this.ppu.height / 256);
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
        const overlayContext = this.overlayCanvas.getContext('2d');
        const clip = Math.floor(this.ppu.width / 256);

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

            if (!this.isWorld) {
                const imageData = overlayContext.createImageData(256, 256);
                this.overlayPPU.renderPPU(imageData.data, sectorRect.l, sectorRect.t, 256, 256);
                overlayContext.putImageData(imageData, sectorRect.l, sectorRect.t);
            }

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

            if (!this.isWorld) {
                const imageData = overlayContext.createImageData(rect.w, rect.h);
                this.overlayPPU.renderPPU(imageData.data, rect.l, rect.t, rect.w, rect.h);
                overlayContext.putImageData(imageData, rect.l, rect.t);
            }
        }

        const context = this.canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.webkitImageSmoothingEnabled = false;
        context.globalCompositeOperation = 'copy';
        const scaledRect = this.mapRect.scale(1 / this.zoom);
        context.drawImage(this.mapCanvas,
            scaledRect.l, scaledRect.t, scaledRect.w, scaledRect.h,
            0, 0, this.mapRect.w, this.mapRect.h
        );

        this.drawMask();
        this.drawTriggers();
        this.drawNPCs();
        this.drawScreen();
        this.drawCursor();
    }

    drawMask() {

        if (this.tileMask === FF6Map.TileMasks.none) return;

        const context = this.canvas.getContext('2d');
        context.globalCompositeOperation = 'source-over';

        if (this.tileMask === FF6Map.TileMasks.overlay) {
            // draw the sprite overlay
            const scaledRect = this.mapRect.scale(1 / this.zoom);
            context.drawImage(this.overlayCanvas,
                scaledRect.l, scaledRect.t, scaledRect.w, scaledRect.h,
                0, 0, this.mapRect.w, this.mapRect.h
            );
            return;
        }

        // calculate coordinates on the map rect
        const xStart = (this.mapRect.l / this.zoom) >> 4;
        const xEnd = (this.mapRect.r / this.zoom) >> 4;
        const yStart = (this.mapRect.t / this.zoom) >> 4;
        const yEnd = (this.mapRect.b / this.zoom) >> 4;
        const xOffset = (this.mapRect.l / this.zoom) % 16;
        const yOffset = (this.mapRect.t / this.zoom) % 16;
        const w = this.layer[0].w;
        const h = this.layer[0].h;

        // draw the mask at each tile
        for (let y = yStart; y <= yEnd; y++) {
            for (let x = xStart; x <= xEnd; x++) {

                const t = (x % w) + (y % h) * w;
                const tile = this.layer[0].layout.data[t];
                const color = this.maskColorAtTile(tile);
                if (!color) continue;
                context.fillStyle = color;

                const left = (((x - xStart) << 4) - xOffset) * this.zoom;
                const top = (((y - yStart) << 4) - yOffset) * this.zoom;
                const size = 16 * this.zoom;

                context.fillRect(left, top, size, size);
            }
        }
    }

    maskColorAtTile(t) {
        const tp = this.tilePropertiesAtTile(t);
        if (!tp) return null;

        if (this.tileMask === FF6Map.TileMasks.zUpper) {
            if (tp.getSpecialValue() === 0xFFF7 || tp.getSpecialValue() === 0x0007) {
                return 'rgba(0, 0, 255, 0.5)'; // impassable
            } else if (tp.zLevel.value & 1) {
                return null;
            } else if (tp.zLevel.value === 4) {
                return 'rgba(0, 255, 255, 0.5)'; // bridge
            } else {
                return 'rgba(0, 0, 255, 0.5)';
            }
        } else if (this.tileMask === FF6Map.TileMasks.zLower) {
            if (tp.getSpecialValue() === 0xFFF7 || tp.getSpecialValue() === 0x0007) {
                return 'rgba(0, 0, 255, 0.5)'; // impassable
            } else if (tp.zLevel.value & 2) {
                return null;
            } else if (tp.zLevel.value === 4) {
                return 'rgba(0, 255, 255, 0.5)'; // bridge
            } else {
                return 'rgba(0, 0, 255, 0.5)';
            }
        } else if (this.tileMask === FF6Map.TileMasks.npcPassability) {
            if (tp.getSpecialValue() === 0xFFF7 || tp.getSpecialValue() === 0x0007) {
                return 'rgba(0, 0, 255, 0.5)'; // impassable
            } else if (tp.flags.value & 0x1000) {
                return null;
            } else {
                return 'rgba(0, 0, 255, 0.5)';
            }
        } else if (this.tileMask === FF6Map.TileMasks.spritePriority) {
            if (tp.getSpecialValue() === 0xFFF7 || tp.getSpecialValue() === 0x0007) {
                return null;
            } else if (tp.flags.value & 0x0001) {
                return 'rgba(0, 255, 0, 0.5)'; // top sprite priority
            } else if (tp.flags.value & 0x0002) {
                return 'rgba(255, 0, 0, 0.5)'; // bottom sprite priority
            } else {
                return null;
            }
        } else if (this.tileMask === FF6Map.TileMasks.misc) {
            if (tp.getSpecialValue() === 0xFFF7 || tp.getSpecialValue() === 0x0007) {
                return null;
            } else if (tp.flags.value & 0x0004) {
                return 'rgba(255, 0, 0, 0.5)'; // door
            } else if (tp.flags.value & 0x0018) {
                return 'rgba(0, 255, 0, 0.5)'; // stairs
            } else if (tp.flags.value & 0x0800) {
                return 'rgba(255, 255, 0, 0.5)'; // ladder
            } else {
                return null;
            }
        } else if (this.tileMask === FF6Map.WorldTileMasks.passability) {
            if (tp.flags.value & 0x10) {
                return 'rgba(0, 0, 255, 0.5)';
            } else {
                return null;
            }
        } else if (this.tileMask === FF6Map.WorldTileMasks.chocoboPassability) {
            if (tp.flags.value & 0x01) {
                return 'rgba(0, 0, 255, 0.5)';
            } else {
                return null;
            }
        } else if (this.tileMask === FF6Map.WorldTileMasks.airshipPassability) {
            if (tp.flags.value & 0x02) {
                return 'rgba(0, 0, 255, 0.5)';
            } else {
                return null;
            }
        } else if (this.tileMask === FF6Map.WorldTileMasks.battle) {
            if (tp.flags.value & 0x40) {
                return 'rgba(255, 0, 0, 0.5)';
            } else {
                return null;
            }
        } else if (this.tileMask === FF6Map.WorldTileMasks.misc) {
            if (tp.flags.value & 0x20) {
                return 'rgba(0, 255, 0, 0.5)'; // forest (green)
            } else if (tp.flags.value & 0x2000) {
                return 'rgba(255, 255, 0, 0.5)'; // veldt (yellow)
            } else if (tp.flags.value & 0x4000) {
                return 'rgba(255, 0, 0, 0.5)'; // phoenix cave (red)
            } else if (tp.flags.value & 0x8000) {
                return 'rgba(255, 0, 255, 0.5)'; // kefka's tower (magenta)
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    drawScreen() {

        this.screenCanvas.style.display = 'none';
        if (!this.showScreen) return;

        // calculate the screen rect
        const x = ((this.selection.x * 16) - this.ppu.layers[this.l].x) & (this.ppu.width - 1);
        const y = ((this.selection.y * 16) - this.ppu.layers[this.l].y) & (this.ppu.height - 1);
        let screenRect;
        if (this.rom.isSFC) {
            screenRect = new Rect(x - 7 * 16, x + 8 * 16, y - 6.5 * 16, y + 6.5 * 16);
        } else {
            screenRect = new Rect(x - 7 * 16, x + 8 * 16, y - 5 * 16, y + 5 * 16);
        }

        if (this.m >= 3) {
            // adjust the screen based on the map width
            const w = this.mapProperties.width.value;
            if (w !== 0) {
                const maxWidth = w * 16 + 16;
                if (screenRect.l <= 16) {
                    screenRect = screenRect.offset(16 - screenRect.l, 0);
                }
                if (screenRect.r > maxWidth) {
                    screenRect = screenRect.offset(maxWidth - screenRect.r, 0);
                }
            }

            // adjust the screen based on the map height
            const h = this.mapProperties.height.value;
            if (h !== 0) {
                const minHeight = this.rom.isSFC ? 8 : 16;
                const maxHeight = h * 16 - (this.rom.isSFC ? 8 : 0);
                if (screenRect.t <= minHeight) {
                    screenRect = screenRect.offset(0, minHeight - screenRect.t);
                }
                if (screenRect.b > maxHeight) {
                    screenRect = screenRect.offset(0, maxHeight - screenRect.b);
                }
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
        this.screenCanvas.style.left = `${this.mapRect.l}px`;
        this.screenCanvas.style.top = `${this.mapRect.t}px`;
        this.screenCanvas.style.display = 'block';
        const context = this.screenCanvas.getContext('2d');
        context.globalCompositeOperation = 'source-over'
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, this.screenCanvas.width, this.screenCanvas.height);
        context.globalCompositeOperation = 'destination-out'
        context.fillStyle = 'rgba(0, 0, 0, 1.0)';

        if (this.isWorld && this.rom.isGBA) {
            screenRect.l += 16 * this.zoom;
            screenRect.r -= 16 * this.zoom;
            screenRect.t += 5 * this.zoom;
            screenRect.b -= 35 * this.zoom;
            context.beginPath();
            context.moveTo(screenRect.l, screenRect.t);
            context.lineTo(screenRect.l + 29 * this.zoom, screenRect.b);
            context.lineTo(screenRect.r - 29 * this.zoom, screenRect.b);
            context.lineTo(screenRect.r, screenRect.t);
            context.lineTo(screenRect.l, screenRect.t);
            context.fill();
        } else if (this.isWorld && this.rom.isSFC) {
            screenRect.t -= 9 * this.zoom;
            screenRect.b -= 42 * this.zoom;
            context.beginPath();
            context.moveTo(screenRect.l, screenRect.t);
            context.lineTo(screenRect.l + 52 * this.zoom, screenRect.b);
            context.lineTo(screenRect.r - 52 * this.zoom, screenRect.b);
            context.lineTo(screenRect.r, screenRect.t);
            context.lineTo(screenRect.l, screenRect.t);
            context.fill();
        } else {
            context.fillRect(screenRect.l, screenRect.t, screenRect.w, screenRect.h);
        }
    }

    drawCursor() {

        this.cursorCanvas.style.display = 'none';
        if (!this.showCursor) return;

        const col = this.selection.x;
        const row = this.selection.y;

        // get the cursor geometry and color
        let x = ((col << 4) - this.ppu.layers[this.l].x) & (this.ppu.width - 1);
        x *= this.zoom;
        let y = ((row << 4) - this.ppu.layers[this.l].y) & (this.ppu.height - 1);
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

            if (this.selectedTrigger.vertical) {
                const length = this.selectedTrigger.length.value;
                const vertical = this.selectedTrigger.vertical.value;
                if (vertical) {
                    h = 16 * this.zoom * (length);
                } else {
                    w = 16 * this.zoom * (length);
                }
            }

            switch (this.selectedTrigger.key) {
                case 'eventTriggers':
                case 'eventTriggersAdvance':
                    c = 'rgba(0, 0, 255, 1.0)'; break;
                case 'entranceTriggersSingle': c = 'rgba(255, 0, 0, 1.0)'; break;
                case 'entranceTriggersMulti': c = 'rgba(0, 128, 0, 1.0)'; break;
                case 'treasureProperties': c = 'rgba(255, 255, 0, 1.0)'; break;
                case 'npcProperties':
                case 'npcPropertiesAdvance':
                    c = 'rgba(128, 128, 128, 1.0)'; break;
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
        const context = this.cursorCanvas.getContext('2d');

        // convert the selection to screen coordinates
        context.lineWidth = 1;
        context.strokeStyle = 'black';
        x = 0.5; y = 0.5; w--; h--;
        context.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        context.strokeStyle = c;
        context.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        context.strokeStyle = 'white';
        context.strokeRect(x, y, w, h);
        x++; y++; w -= 2; h -= 2;
        context.strokeStyle = 'black';
        context.strokeRect(x, y, w, h);
    }

    reloadTriggers() {
        this.loadTriggers();
        this.drawMap();
    }

    loadTriggers() {

        this.triggers = [];

        // event triggers
        let triggers = this.rom.eventTriggers.item(this.m);
        if (triggers) {
            for (const trigger of triggers.iterator()) {
                this.observer.startObservingSub(trigger, this.reloadTriggers);
                this.triggers.push(trigger);
            }
        }

        triggers = this.rom.eventTriggersAdvance;
        if (this.rom.isGBA && triggers instanceof ROMArray) {
            for (const trigger of triggers.iterator()) {
                if (trigger.map.value !== this.m) continue;
                this.observer.startObservingSub(trigger, this.reloadTriggers);
                this.triggers.push(trigger);
            }
        }

        // single-tile entrance triggers
        triggers = this.rom.entranceTriggersSingle.item(this.m);
        if (triggers) {
            for (const trigger of triggers.iterator()) {
                this.observer.startObservingSub(trigger, this.reloadTriggers);
                this.triggers.push(trigger);
            }
        }

        // return if a world map
        if (this.isWorld) return;

        // multi-tile entrance triggers
        triggers = this.rom.entranceTriggersMulti.item(this.m);
        if (triggers) {
            for (const trigger of triggers.iterator()) {
                this.observer.startObservingSub(trigger, this.reloadTriggers);
                this.triggers.push(trigger);
            }
        }

        triggers = this.rom.treasureProperties.item(this.m);
        if (triggers) {
            for (const trigger of triggers.iterator()) {
                this.observer.startObservingSub(trigger, this.reloadTriggers);
                this.triggers.push(trigger);
            }
        }

        // npcs
        triggers = this.rom.npcProperties.item(this.m);
        if (triggers) {
            for (const npc of triggers.iterator()) {
                this.observer.startObservingSub(npc, this.reloadTriggers);
                this.triggers.push(npc);
            }
        }

        triggers = this.rom.npcPropertiesAdvance;
        if (this.rom.isGBA && triggers instanceof ROMArray) {
            for (const trigger of triggers.iterator()) {
                if (trigger.map.value !== this.m) continue;
                this.observer.startObservingSub(trigger, this.reloadTriggers);
                this.triggers.push(trigger);
            }
        }

        // map start-up event
        if (this.rom.isGBA) {
            const mapProperties = this.rom.mapProperties.item(this.m);
            for (event of this.rom.mapStartupEventGBA.iterator()) {
                if (event.map.value !== this.m) continue;
                mapProperties.assembly.scriptPointerGBA.invalid = false;
                mapProperties.assembly.scriptPointerGBA.external = `mapStartupEventGBA[${event.i}].scriptPointer`;
                break;
            }
        }
    }

    insertTrigger(type) {

        this.closeMenu();
        const triggers = this.rom[type].item(this.m);
        const newTrigger = triggers.blankAssembly();

        this.beginAction(this.reloadTriggers);
        triggers.insertAssembly(newTrigger);
        newTrigger.x.setValue(this.clickPoint.x);
        newTrigger.y.setValue(this.clickPoint.y);
        this.endAction(this.reloadTriggers);

        this.selectedTrigger = newTrigger;
        propertyList.select(newTrigger);
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
        const l = trigger.x.value * 16 * this.zoom;
        const r = l + 16 * this.zoom;
        const t = trigger.y.value * 16 * this.zoom;
        const b = t + 16 * this.zoom;
        const rect = new Rect(l, r, t, b);

        if (trigger.vertical) {
            const length = trigger.length.value;
            if (trigger.vertical.value) {
                rect.b = t + 16 * this.zoom * (length + 1);
            } else {
                rect.r = l + 16 * this.zoom * (length + 1);
            }
        }

        return rect;
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
        const context = this.canvas.getContext('2d');
        context.globalCompositeOperation = 'source-over';

        for (const trigger of this.triggers) {
            const triggerRect = this.rectForTrigger(trigger);
            if (this.mapRect.intersect(triggerRect).isEmpty()) continue;
            let color = 'purple';
            switch (trigger.key) {
                case 'eventTriggers':
                case 'eventTriggersAdvance':
                    color = 'rgba(0, 0, 255, 0.5)';
                    break;
                case 'entranceTriggersSingle':
                    color = 'rgba(255, 0, 0, 0.5)';
                    break;
                case 'entranceTriggersMulti':
                    color = 'rgba(0, 128, 0, 0.5)';
                    const length = trigger.length.value;
                    const v = trigger.vertical.value;
                    for (let t = 0; t < length; t++) {
                        const x = (trigger.x.value + (v ? 0 : t)) * this.zoom * 16 + 2 - 0.5 - xClient;
                        const y = (trigger.y.value + (v ? t : 0)) * this.zoom * 16 + 2 - 0.5 - yClient;
                        this.drawTriggerRect(x, y, color, context);
                    }
                    continue;
                case 'treasureProperties':
                    color = 'rgba(255, 255, 0, 0.5)';
                    break;
                case 'npcProperties':
                case 'npcPropertiesAdvance':
                    color = 'rgba(128, 128, 128, 0.5)';
                    break;
                default:
                    break;
            }
            const x = trigger.x.value * this.zoom * 16 + 2 - 0.5 - xClient;
            const y = trigger.y.value * this.zoom * 16 + 2 - 0.5 - yClient;
            this.drawTriggerRect(x, y, color, context);
        }
    }

    drawNPCs() {
        if (!this.showTriggers) return;

        // filter and sort npcs
        const npcs = this.triggers.filter(function(trigger) {
            return (trigger.key.startsWith('npcProperties'));
        }).sort(function(trigger1, trigger2) {
            // sort by y-coordinate
            const y1 = trigger1.y.value;
            const y2 = trigger2.y.value;
            if (y1 !== y2) return y1 - y2;

            // if same y-coordinate, sort by sprite priority
            const p1 = trigger1.spritePriority.value;
            const p2 = trigger2.spritePriority.value;
            return p1 - p2;
        });

        // draw npcs
        for (const npc of npcs) {
            const v = npc.vehicle.value;
            const special = npc.specialNPC.value;
            const showRider = npc.showRider.value;
            const animation = npc.animation.value;

            if (v === 0 && special) {
                // sprite
                this.drawSprite(npc);

            } else if (v === 0 || animation !== 0) {
                // no vehicle or animated npc
                this.drawNPC(npc);

            } else if (v === 1) {
                // chocobo
                this.drawVehicle(npc);
                if (showRider) this.drawNPC(npc);
                this.drawVehicle(npc, true); // draw tail/head

            } else if (v === 2) {
                // magitek
                this.drawVehicle(npc);
                if (showRider) this.drawNPC(npc);

            } else if (v === 3) {
                // raft
                this.drawVehicle(npc);
                if (showRider) this.drawNPC(npc);
            }
        }
    }

    drawSprite(npc) {
        let x = npc.x.value * 16;
        let y = npc.y.value * 16 - 8;
        let w = 16;
        let h = 16;

        const is32x32 = npc.is32x32.value;
        const hFlip = npc.hFlip.value;
        let offset = npc.offset.value * 2;
        if (npc.slave.value) {
            const m = npc.master.value;
            if (!npc.parent.array || m >= npc.parent.arrayLength) {
                this.rom.log('Invalid Master NPC');
            } else {
                const master = npc.parent.item(m);
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

        if (is32x32) {
            w = 32; h = 32;
        }

        let rect = new Rect(x, x + w, y, y + h);
        rect = rect.scale(this.zoom);
        if (this.mapRect.intersect(rect).isEmpty()) return;
        rect = rect.offset(-this.mapRect.l, -this.mapRect.t);

        // decode graphics
        const graphics = new Uint8Array(w * h);
        const g = npc.graphics.value;
        const spriteGraphics = this.rom.mapSpriteGraphics.item(g);
        const tileCount = w * h / 0x40;
        const tilemap = new Uint32Array(tileCount);
        for (let t = 0; t < tileCount; t++) {
            const begin = t * 0x40;
            const end = begin + 0x40;
            const tile = spriteGraphics.data.subarray(begin, end);
            graphics.set(tile, t * 0x40);
            if (hFlip) {
                tilemap[t ^ (is32x32 ? 3 : 1)] = t | 0x10000000;
            } else {
                tilemap[t] = t;
            }
        }

        // load palette
        const p = npc.palette.value;
        const palette = this.rom.mapSpritePalettes.item(p);

        // set up the ppu
        const ppu = new GFX.PPU();
        ppu.pal = this.rom.gammaCorrectedPalette(palette.data);
        ppu.width = w;
        ppu.height = h;

        // layer 1
        ppu.layers[0].cols = w >> 3;
        ppu.layers[0].rows = h >> 3;
        ppu.layers[0].z[0] = GFX.Z.snesS0;
        ppu.layers[0].z[1] = GFX.Z.snesS1;
        ppu.layers[0].z[2] = GFX.Z.snesS2;
        ppu.layers[0].z[3] = GFX.Z.snesS3;
        ppu.layers[0].gfx = graphics;
        ppu.layers[0].tiles = tilemap;
        ppu.layers[0].main = true;

        // draw the npc
        this.npcCanvas.width = w;
        this.npcCanvas.height = h;
        const npcContext = this.npcCanvas.getContext('2d');
        const imageData = npcContext.createImageData(w, h);
        ppu.renderPPU(imageData.data);
        npcContext.putImageData(imageData, 0, 0);

        const context = this.canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.webkitImageSmoothingEnabled = false;
        context.globalCompositeOperation = 'source-over';
        context.drawImage(this.npcCanvas, 0, 0, w, h, rect.l, rect.t, rect.w, rect.h);
    }

    drawNPC(npc) {
        let x = npc.x.value * 16;
        let y = npc.y.value * 16 - 16;
        let w = 16;
        let h = 24;
        let direction = npc.direction.value;

        const vehicle = npc.vehicle.value;
        const showRider = npc.showRider.value;
        const animation = npc.animation.value;

        const facingFrames = [0x04, 0x47, 0x01, 0x07];
        if (animation === 1) {
            facingFrames[0] = 0;
            direction = 0;

        } else if (animation === 2) {
            // animation 2 (special)
            facingFrames[0] = 0x32;
            direction = 0;

        } else if (animation === 3) {
            // animation 3 (knocked out)
            facingFrames[0] = 0x28;
            direction = 0;

        } else if (vehicle === 1) {
            // chocobo
            facingFrames[1] = 0x6E;
            facingFrames[3] = 0x2E;
            if (direction === 0) {
                h = 16;
                y -= 3;

            } else if (direction === 1) {
                y -= 4;
                x -= 3;

            } else if (direction === 2) {
                h = 16;
                y -= 5;

            } else if (direction === 3) {
                y -= 4;
                x += 3;
            }

        } else if (vehicle === 2) {
            // magitek
            facingFrames[1] = 0x6E;
            facingFrames[3] = 0x2E;
            h = 16;
            y -= 6;

        } else if (vehicle === 3) {
            // raft
            y -= 8;
        }

        // get the npc rect, return if not visible
        let rect = new Rect(x, x + w, y, y + h);
        rect = rect.scale(this.zoom);
        if (this.mapRect.intersect(rect).isEmpty()) return;
        rect = rect.offset(-this.mapRect.l, -this.mapRect.t);

        // get the sprite tile layout
        const frame = facingFrames[direction];
        const tileLayout = this.rom.mapSpriteLayouts.item(frame & 0x3F);
        const hFlip = (frame & 0x40);

        // get graphics and tilemap
        const graphics = new Uint8Array(w * h);
        const g = npc.graphics.value;
        const spriteGraphics = this.rom.mapSpriteGraphics.item(g);
        const tileCount = w * h / 0x40;
        const tilemap = new Uint32Array(tileCount);
        for (let t = 0; t < tileCount; t++) {
            const begin = tileLayout[`tile${t + 1}`].value * 2;
            const end = begin + 0x40;
            const tile = spriteGraphics.data.subarray(begin, end);
            graphics.set(tile, t * 0x40);
            if (hFlip) {
                tilemap[t ^ 1] = t | 0x10000000;
            } else {
                tilemap[t] = t;
            }
        }

        // load palette
        const p = npc.palette.value;
        const palette = this.rom.mapSpritePalettes.item(p);

        // if (vehicle && !showRider && !specialNPC && !animation) return;

        // set up the ppu
        const ppu = new GFX.PPU();
        ppu.pal = palette.data;
        ppu.width = w;
        ppu.height = h;

        // layer 1
        ppu.layers[0].cols = w >> 3;
        ppu.layers[0].rows = h >> 3;
        ppu.layers[0].z[0] = GFX.Z.snesS0;
        ppu.layers[0].z[1] = GFX.Z.snesS1;
        ppu.layers[0].z[2] = GFX.Z.snesS2;
        ppu.layers[0].z[3] = GFX.Z.snesS3;
        ppu.layers[0].gfx = graphics;
        ppu.layers[0].tiles = tilemap;
        ppu.layers[0].main = true;

        // draw the npc
        this.npcCanvas.width = w;
        this.npcCanvas.height = h;
        const npcContext = this.npcCanvas.getContext('2d');
        const imageData = npcContext.createImageData(w, h);
        ppu.renderPPU(imageData.data);
        npcContext.putImageData(imageData, 0, 0);

        const context = this.canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.webkitImageSmoothingEnabled = false;
        context.globalCompositeOperation = 'source-over';
        context.drawImage(this.npcCanvas, 0, 0, w, h, rect.l, rect.t, rect.w, rect.h);
    }

    drawVehicle(npc, headTail) {
        let x = npc.x.value * 16;
        let y = npc.y.value * 16 - 16;
        let w = 32;
        let h = 32;
        let p = 7; // palette index

        const vehicle = npc.vehicle.value;
        const direction = npc.direction.value;

        // get the vehicle tile layout
        const tilemap = new Uint16Array(16);
        if (headTail) {
            // chocobo tail/head
            if (direction === 0) {
                // facing up (show tail)
                tilemap.set([
                    0x214A, 0x214B,
                    0x215A, 0x215B
                ]);
                y += 9;
                w = 16; h = 16;

            } else if (direction === 2) {
                // facing down (show head)
                tilemap.set([
                    0x2140, 0x2141,
                    0x2150, 0x2151
                ]);
                y += 7;
                w = 16; h = 16;

            } else {
                return;
            }

        } else if (vehicle === 1) {
            // chocobo
            if (direction === 0) {
                tilemap.set([
                    0x214C, 0x214D,
                    0x215C, 0x215D,
                    0x214E, 0x214F,
                    0x215E, 0x215F
                ]);
                w = 16;

            } else if (direction === 1) {
                tilemap.set([
                    0x6169, 0x6168, 0x6165, 0x6164,
                    0x6179, 0x6178, 0x6175, 0x6174,
                    0x616B, 0x616A, 0x6167, 0x6166,
                    0x617B, 0x617A, 0x6177, 0x6176
                ]);
                x -= 8;

            } else if (direction === 2) {
                tilemap.set([
                    0x2142, 0x2143,
                    0x2152, 0x2153,
                    0x2144, 0x2145,
                    0x2154, 0x2155
                ]);
                w = 16;

            } else if (direction === 3) {
                tilemap.set([
                    0x2164, 0x2165, 0x2168, 0x2169,
                    0x2174, 0x2175, 0x2178, 0x2179,
                    0x2166, 0x2167, 0x216A, 0x216B,
                    0x2176, 0x2177, 0x217A, 0x217B
                ]);
                x -= 8;
            }

        } else if (vehicle === 2) {
            // magitek
            x -= 8;
            if (direction === 0) {
                tilemap.set([
                    0x21AC, 0x21AD, 0x61AD, 0x61AC,
                    0x21BC, 0x21BD, 0x61BD, 0x61BC,
                    0x21AE, 0x21AF, 0x61AF, 0x61AE,
                    0x21BE, 0x21BF, 0x61BF, 0x61BE
                ]);

            } else if (direction === 1) {
                tilemap.set([
                    0x61CB, 0x61CA, 0x61C9, 0x61C8,
                    0x61DB, 0x61DA, 0x61D9, 0x61D8,
                    0x61CF, 0x61CE, 0x61CD, 0x61CC,
                    0x61DF, 0x61DE, 0x61DD, 0x61DC
                ]);

            } else if (direction === 2) {
                tilemap.set([
                    0x21A0, 0x21A1, 0x61A1, 0x61A0,
                    0x21B0, 0x21B1, 0x61B1, 0x61B0,
                    0x21A2, 0x21A3, 0x61A3, 0x61A2,
                    0x21B2, 0x21B3, 0x61B3, 0x61B2
                ]);

            } else if (direction === 3) {
                tilemap.set([
                    0x21C8, 0x21C9, 0x21CA, 0x21CB,
                    0x21D8, 0x21D9, 0x21DA, 0x21DB,
                    0x21CC, 0x21CD, 0x21CE, 0x21CF,
                    0x21DC, 0x21DD, 0x21DE, 0x21DF
                ]);
            }

        } else if (vehicle === 3) {
            // raft
            x -= 8;
            p = 11;
            if (direction === 0 || direction === 2) {
                tilemap.set([
                    0x2120, 0x2121, 0x2124, 0x2125,
                    0x2130, 0x2131, 0x2134, 0x2135,
                    0x2122, 0x2123, 0x2126, 0x2127,
                    0x2132, 0x2133, 0x2136, 0x2137
                ]);

            } else if (direction === 1 || direction === 3) {
                tilemap.set([
                    0x2128, 0x2129, 0x212C, 0x212D,
                    0x2138, 0x2139, 0x213C, 0x213D,
                    0x212A, 0x212B, 0x212E, 0x212F,
                    0x213A, 0x213B, 0x213E, 0x213F
                ]);
            }

        }

        // get the chocobo rect, return if not visible
        let rect = new Rect(x, x + w, y, y + h);
        rect = rect.scale(this.zoom);
        if (this.mapRect.intersect(rect).isEmpty()) return;
        rect = rect.offset(-this.mapRect.l, -this.mapRect.t);

        // load vehicle graphics
        const graphics = new Uint8Array(0x8000);
        const vehicleGraphics = this.rom.vehicleGraphics;
        graphics.set(vehicleGraphics.data.subarray(0, 0x3800), 0x4800);

        // load vehicle palette
        const palette = this.rom.mapSpritePalettes.item(p);

        // set up the ppu
        const ppu = new GFX.PPU();
        ppu.pal = this.rom.gammaCorrectedPalette(palette.data);
        ppu.width = w;
        ppu.height = h;

        // layer 1
        ppu.layers[0].cols = w >> 3;
        ppu.layers[0].rows = h >> 3;
        ppu.layers[0].z[0] = GFX.Z.snesS0;
        ppu.layers[0].z[1] = GFX.Z.snesS1;
        ppu.layers[0].z[2] = GFX.Z.snesS2;
        ppu.layers[0].z[3] = GFX.Z.snesS3;
        ppu.layers[0].gfx = graphics;
        ppu.layers[0].tiles = GFX.tileFormat.snesSpriteTile.decode(tilemap)[0];
        ppu.layers[0].main = true;

        // draw the vehicle
        this.npcCanvas.width = w;
        this.npcCanvas.height = h;
        const npcContext = this.npcCanvas.getContext('2d');
        const imageData = npcContext.createImageData(w, h);
        ppu.renderPPU(imageData.data);
        npcContext.putImageData(imageData, 0, 0);

        const context = this.canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.webkitImageSmoothingEnabled = false;
        context.globalCompositeOperation = 'source-over';
        context.drawImage(this.npcCanvas, 0, 0, w, h, rect.l, rect.t, rect.w, rect.h);
    }
}

FF6Map.TileMasks = {
    none: 'None',
    overlay: 'Sprite Overlay',
    zUpper: 'Upper Z-Level',
    zLower: 'Lower Z-Level',
    npcPassability: 'NPC Passability',
    spritePriority: 'Sprite Priority',
    misc: 'Misc.'
}

FF6Map.WorldTileMasks = {
    none: 'None',
    passability: 'Passability',
    chocoboPassability: 'Chocobo Passability',
    airshipPassability: 'Airship Can Land',
    battle: 'Battles Enabled',
    misc: `Forest/Veldt/Kefka's Tower/Phoenix Cave`
}

//
// romgui.js
// created 2/26/2019
//

var romNavigator;
var propertyList;
var scriptList;

// ROMScriptList
function ROMScriptList(rom) {
    this.rom = rom;
    this.scriptList = document.getElementById("script-list");
    this.scriptList.innerHTML = "";
    this.container = this.scriptList.parentElement;
    this.script = null;
    this.selection = []; // selected commands
    this.node = []; // command nodes by ref

    this.blockSize = 50; // number of commands per block
    this.blockStart = 0; // starting location of first block
    this.numBlocks = 3; // number of blocks visible at one time
    this.rowHeight = 17;

    this.observer = new ROMObserver(rom, this, {sub: true});

    var self = this;
    this.scriptList.parentElement.onscroll = function() { self.scroll(); };
    this.menu = document.getElementById('menu');
    this.scriptList.parentElement.oncontextmenu = function(e) { self.openMenu(e); return false; };

    var insertButton = document.getElementById("script-insert");
    insertButton.onclick = function(e) { self.openMenu(e); };
}

ROMScriptList.prototype.scroll = function() {

    if (!this.script) return;
    this.closeMenu();

    var topSpace = this.scriptList.firstChild;
    var bottomSpace = this.scriptList.lastChild;
    if (!topSpace || !bottomSpace) return;

    if (this.container.scrollTop < topSpace.offsetHeight) {
        // scrolled off the top
        var index = Math.floor(this.blockStart - (topSpace.offsetHeight - this.container.scrollTop) / this.rowHeight);

        // save the scroll position for the top command
        var topCommand = this.script.command[this.blockStart];
        var commandNode = this.node[topCommand.ref];
        var oldOffset, newOffset;
        if (commandNode) oldOffset = commandNode.offsetTop;

        // change blockStart so that the previous blocks are visible
        index = index - index % this.blockSize - this.blockSize * (this.numBlocks - 2);
        this.blockStart = Math.max(index, 0);
        this.update();

        // recalculate the scroll position so that the first command stays in the same spot
        commandNode = this.node[topCommand.ref];
        if (commandNode && oldOffset) {
            newOffset = commandNode.offsetTop;
            this.scriptList.parentElement.scrollTop += newOffset - oldOffset;
        }

    } else if ((this.container.scrollTop + this.container.offsetTop + this.container.offsetHeight) > bottomSpace.offsetTop) {
        // scrolled off the bottom
        var index = Math.floor(this.blockStart + (this.container.scrollTop + this.container.offsetTop + this.container.offsetHeight - bottomSpace.offsetTop) / this.rowHeight);

        // save the scroll position for the bottom command
        var bottomIndex = Math.min(this.blockStart + this.blockSize * this.numBlocks - 1, this.script.command.length - 1);
        var bottomCommand = this.script.command[bottomIndex];
        var commandNode = this.node[bottomCommand.ref];
        var oldOffset, newOffset;
        if (commandNode) oldOffset = commandNode.offsetTop;

        // change blockStart so that the next blocks are visible
        index = index - index % this.blockSize + this.blockSize * (this.numBlocks - 2);
        var maxStart = this.script.command.length - this.blockSize * this.numBlocks;
        maxStart = Math.max(maxStart + this.blockSize - (maxStart % this.blockSize), 0);
        this.blockStart = Math.min(index, maxStart);
        this.update();

        // recalculate the scroll position so that the first command stays in the same spot
        commandNode = this.node[bottomCommand.ref];
        if (commandNode && oldOffset) {
            newOffset = commandNode.offsetTop;
            this.scriptList.parentElement.scrollTop += newOffset - oldOffset;
        }
    }
}

ROMScriptList.prototype.selectScript = function(script) {
    document.getElementById("edit-bottom").classList.remove("hidden");

    if (this.script === script) return;
    this.deselectAll();
    this.script = script;

    // populate the list
    this.blockStart = 0;
    this.update();
}

ROMScriptList.prototype.selectCommand = function(command) {

    this.closeMenu();

    // clear the old selection
    this.deselectAll();

    if (!command) {
        this.selection = [];
        return;
    }
    this.selection = [command];

    // select the command in the rom
    propertyList.select(command);

    if (!this.node[command.ref]) {
        // node is not in the current block
        var index = this.script.command.indexOf(command);
        this.blockStart = Math.max(index - index % this.blockSize - this.blockSize, 0);
        this.update();
    }

    var node = this.node[command.ref];
    if (!node) return;
    node.classList.add("selected");

    // center the node in the list
    var nodeTop = node.offsetTop - this.container.offsetTop;
    var nodeBottom = nodeTop + node.offsetHeight;
    if ((this.scriptList.parentElement.scrollTop > nodeTop) || ((this.scriptList.parentElement.scrollTop + this.container.offsetHeight) < nodeBottom)) this.scriptList.parentElement.scrollTop = nodeTop - Math.floor(this.container.offsetHeight - node.offsetHeight) / 2;
}

ROMScriptList.prototype.selectRef = function(ref) {
    this.selectCommand(this.script.ref[ref]);
}

ROMScriptList.prototype.deselectAll = function() {
    for (var c = 0; c < this.selection.length; c++) {
        var command = this.selection[c];
        if (!command) continue;
        var node = this.node[command.ref];
        if (!node) continue;
        node.classList.remove("selected");
    }
    this.selection = [];
}

ROMScriptList.prototype.insert = function(identifier) {
    if (!this.script) return;

    this.closeMenu();

    var command = this.script.blankCommand(identifier);

    var firstCommand = this.selection[0];
    var lastCommand = this.selection[this.selection.length - 1];
    var end = this.script.command.indexOf(lastCommand);
//    if (end === this.script.command.length - 1) return;
    var nextCommand = this.script.command[end + 1];

    this.rom.beginAction();
    var self = this;
    this.rom.pushAction(new ROMAction(this, function() {
        this.script.updateOffsets();
        this.selectCommand(lastCommand);
        this.update();
    }, null, "Update Script"));
    this.script.insertCommand(command, nextCommand.ref);
    this.rom.doAction(new ROMAction(this, null, function() {
        this.script.updateOffsets();
        this.selectCommand(command);
        this.update();
    }, "Update Script"));
    this.rom.endAction();
}

ROMScriptList.prototype.delete = function() {
    // return if nothing is selected
    if (!this.script) return;
    if (this.selection.length === 0) return;
    this.closeMenu();

    var lastCommand = this.selection[this.selection.length - 1];
    var i = this.script.command.indexOf(lastCommand);
    var nextCommand = this.script.command[i + 1] || this.script.command[this.script.command.length - 2];

    this.rom.beginAction();
    var self = this;
    this.rom.pushAction(new ROMAction(this, function() {
        this.script.updateOffsets();
        this.selectCommand(lastCommand);
        this.update();
    }, null, "Update Script"));
    this.selection.forEach(function(command) {
        self.script.removeCommand(command);
    });
    this.rom.doAction(new ROMAction(this, null, function() {
        this.script.updateOffsets();
        this.selectCommand(nextCommand);
        this.update();
    }, "Update Script"));
    this.rom.endAction();
}

ROMScriptList.prototype.moveUp = function() {
    // return if nothing is selected
    if (!this.script) return;
    if (this.selection.length === 0) return;
    this.closeMenu();

    var firstCommand = this.selection[0];
    var start = this.script.command.indexOf(firstCommand);
    if (start === 0) return;
    var previousCommand = this.script.command[start - 1];
    var lastCommand = this.selection[this.selection.length - 1];
    var end = this.script.command.indexOf(lastCommand);
    if (end === this.script.command.length - 1) return;
    var nextCommand = this.script.command[end + 1];

    function updateScript() {
        this.script.updateOffsets();
        this.selectCommand(firstCommand);
        this.update();
    }

    this.rom.beginAction();
    var self = this;
    this.rom.pushAction(new ROMAction(this, updateScript, null, "Update Script"));
    this.script.removeCommand(previousCommand);
    this.script.insertCommand(previousCommand, nextCommand.ref);
    this.rom.doAction(new ROMAction(this, null, updateScript, "Update Script"));
    this.rom.endAction();
}

ROMScriptList.prototype.moveDown = function() {
    // return if nothing is selected
    if (!this.script) return;
    if (this.selection.length === 0) return;
    this.closeMenu();

    var firstCommand = this.selection[0];
    var start = this.script.command.indexOf(firstCommand);
    if (start === 0) return;
    var previousCommand = this.script.command[start - 1];
    var lastCommand = this.selection[this.selection.length - 1];
    var end = this.script.command.indexOf(lastCommand);
    if (end === this.script.command.length - 1) return;
    var nextCommand = this.script.command[end + 1];

    function updateScript() {
        this.script.updateOffsets();
        this.selectCommand(firstCommand);
        this.update();
    }

    this.rom.beginAction();
    var self = this;
    this.rom.pushAction(new ROMAction(this, updateScript, null, "Update Script"));
    this.script.removeCommand(nextCommand);
    this.script.insertCommand(nextCommand, firstCommand.ref);
    this.rom.doAction(new ROMAction(this, null, updateScript, "Update Script"));
    this.rom.endAction();
}

ROMScriptList.prototype.update = function() {

    if (!this.script) return;

    // recalculate top and bottom spacers

    // create a dummy li to determine the row height
    var dummy = document.createElement("li");
    dummy.innerHTML = "Dummy"
    this.scriptList.appendChild(dummy);
    this.rowHeight = dummy.scrollHeight;
    this.scriptList.removeChild(dummy);

    var totalHeight = this.script.command.length * this.rowHeight;
    var blockTop = this.blockStart * this.rowHeight;
    var blockBottom = blockTop + this.blockSize * this.numBlocks * this.rowHeight;

    // stop observing current nodes
    this.observer.stopObservingAll();

    // remove all nodes
    this.node = [];
    this.scriptList.innerHTML = "";

    // create top space
    var topSpace = document.createElement('div');
    topSpace.className = "script-spacer";
    this.scriptList.appendChild(topSpace);

    // create nodes
    for (var c = 0; c < this.blockSize * this.numBlocks; c++) {
        var command = this.script.command[c + this.blockStart];
        if (!command) break;
        var li = this.liForCommand(command);
        this.node[command.ref] = li;
        this.scriptList.appendChild(li);
    }

    // start observing new nodes
    var self = this;
    this.node.forEach(function(li) {
        var command = self.script.ref[li.value];
        if (!command) return;
        self.observer.startObserving(command, self.update);
    });

    // create bottom space
    var bottomSpace = document.createElement('div');
    bottomSpace.className = "script-spacer";
    this.scriptList.appendChild(bottomSpace);

    // set top space height
    topSpace.style.height = blockTop + "px";
    bottomSpace.style.height = Math.max(totalHeight - blockBottom, 0) + "px";

    // highlight selected commands
    for (var c = 0; c < this.selection.length; c++) {
        var command = this.selection[c];
        var node = this.node[command.ref];
        if (!node) continue;
        node.className = "selected";
    }
}

ROMScriptList.prototype.liForCommand = function(command) {
    var li = document.createElement("li");
    li.value = command.ref;
    var list = this;
    li.onclick = function() {
        list.selectRef(this.value);
    };
    var span = document.createElement("span");
    span.classList.add("script-offset");
    if (command._label) span.classList.add("bold");
    span.innerHTML = command.label;
    li.appendChild(span);
    var p = document.createElement('p');
    p.innerHTML = command.description;
    li.appendChild(p);
    return li;
}

ROMScriptList.prototype.updateMenu = function() {

    this.menu.innerHTML = "";
    this.menu.classList.add('menu');

    // build the menu for the appropriate script commands
    if (isArray(this.script.encoding)) {
        for (var i = 0; i < this.script.encoding.length; i++) {
            var encodingName = this.script.encoding[i];
            var encoding = this.rom.scriptEncoding[encodingName];
            var subMenu = document.createElement("ul");
            subMenu.classList.add("menu-submenu");
            if (encoding) encoding.populateMenu(subMenu);
            var encodingLabel = document.createElement("li");
            encodingLabel.classList.add("menu-item");
            encodingLabel.innerHTML = encoding.name;
            encodingLabel.appendChild(subMenu);
            this.menu.appendChild(encodingLabel);
        }
    } else {
        var encoding = this.rom.scriptEncoding[this.script.encoding];
        if (encoding) encoding.populateMenu(this.menu);
    }
}

ROMScriptList.prototype.openMenu = function(e) {
    this.updateMenu();

    this.menu.classList.add("menu-active");
    this.menu.style.left = e.x + "px";
    this.menu.style.height = "";
    this.menu.style.overflowY = "visible";

    var top = e.y;
    var height = this.menu.clientHeight;
    if (height + top > window.innerHeight) {
        top = window.innerHeight - height;
    }
    if (top < 0) {
        this.menu.style.height = (window.innerHeight - 10) + "px";
        this.menu.style.overflowY = "auto";
        top = 0;
    }
    this.menu.style.top = top + "px";
}

ROMScriptList.prototype.closeMenu = function() {
    this.menu.classList.remove("menu-active");
}

// ROMEditor
function ROMEditor(rom) {
    this.rom = rom;
    this.editorControls = document.getElementById("edit-controls");
    this.menu = document.getElementById('menu');
    this.list = [];
}

ROMEditor.prototype.beginAction = function(callback) {
    this.rom.beginAction();
    this.rom.doAction(new ROMAction(this.observer, this.observer.wake, this.observer.sleep));
    if (callback) this.rom.doAction(new ROMAction(this, callback, null));
}

ROMEditor.prototype.endAction = function(callback) {
    if (callback) this.rom.doAction(new ROMAction(this, null, callback));
    this.rom.doAction(new ROMAction(this.observer, this.observer.sleep, this.observer.wake));
    this.rom.endAction();
}

ROMEditor.prototype.hideControls = function() {
    this.editorControls.classList.add("hidden");
}

ROMEditor.prototype.showControls = function() {
    this.editorControls.classList.remove("hidden");
}

ROMEditor.prototype.resetControls = function() {
    this.editorControls.innerHTML = "";
    this.list = [];
}

ROMEditor.prototype.addTwoState = function(id, onclick, labelText, checked) {
    var label = document.createElement("label");
    label.classList.add("two-state");
    if (checked) label.classList.add("checked");
//    label.classList.add("tooltip");
    label.style.display = "inline-block";
    this.editorControls.appendChild(label);

    var button = document.createElement("input");
    button.id = id;
    button.type = "checkbox";
    button.checked = checked;
    button.onclick = function() { onclick(this.checked); twoState(this); };
    label.appendChild(button);

    var p = document.createElement("p");
    p.innerHTML = labelText;
    label.appendChild(p);
}

ROMEditor.prototype.addZoom = function(zoom, onchange, min, max, step) {
    var zoomValue = document.createElement("div");
    zoomValue.id = "zoom-value";
    zoomValue.innerHTML = (zoom * 100).toString() + "%";
    this.editorControls.appendChild(zoomValue);

    if (!isNumber(min)) min = -2;
    if (!isNumber(max)) max = 2;
    if (!isNumber(step)) step = 1;

    var zoomRange = document.createElement("input");
    zoomRange.type = "range";
    zoomRange.id = "zoom";
    zoomRange.min = min.toString();
    zoomRange.max = max.toString();
    zoomRange.step = step.toString();
    zoomRange.value = Math.log2(zoom);
    zoomRange.onchange = function() { onchange(); };
    this.editorControls.appendChild(zoomRange);

    var zoomCoordinates = document.createElement("div");
    zoomCoordinates.id = "coordinates";
    zoomCoordinates.innerHTML = "(0,0)";
    this.editorControls.appendChild(zoomCoordinates);
}

ROMEditor.prototype.addList = function(id, labelText, listNames, onchange, selected) {
    this.list[id] = {
        names: listNames,
        onchange: onchange,
        selected: selected
    };

    var label = document.createElement("label");
    label.classList.add("two-state");
    label.classList.add("checked");
    label.style.display = "inline-block";
    this.editorControls.appendChild(label);

    var self = this;
    var button = document.createElement("input");
    button.id = id;
    button.type = "button";
    button.onclick = function(e) { self.openList(e, id); };
    label.appendChild(button);

    var p = document.createElement("p");
    p.innerHTML = labelText;
    label.appendChild(p);
}

ROMEditor.prototype.openList = function(e, id) {

    this.menu.innerHTML = "";
    this.menu.classList.add('menu');

    var list = this.list[id];
    if (!list || !isArray(list.names)) return;

    // build the menu for the list of options
    var self = this;
    for (var i = 0; i < list.names.length; i++) {
        var li = document.createElement('li');
        li.value = i;
        li.innerHTML = list.names[i];
        li.classList.add("menu-item");
        li.onclick = function() { self.closeList(); list.onchange(this.value); };
        if (list.selected(i)) li.classList.add("selected");
        menu.appendChild(li);
    }

    this.menu.classList.add("menu-active");
    this.menu.style.left = e.x + "px";
    this.menu.style.height = "";
    this.menu.style.overflowY = "visible";

    var top = e.y;
    var height = this.menu.clientHeight;
    if (height + top > window.innerHeight) {
        top = window.innerHeight - height;
    }
    if (top < 0) {
        this.menu.style.height = (window.innerHeight - 10) + "px";
        this.menu.style.overflowY = "auto";
        top = 0;
    }
    this.menu.style.top = top + "px";
}

ROMEditor.prototype.closeList = function() {
    this.menu.classList.remove("menu-active");
}

// ROMPaletteView
function ROMPaletteView(rom, graphicsView) {

    this.rom = rom;
    this.graphicsView = graphicsView; // associated graphics view
    this.tilemapView = null; // associated tilemap view

    this.div = document.createElement('div');
    this.div.classList.add("palette-div");

    this.canvas = document.createElement('canvas');
    this.canvas.id = "palette";
    this.canvas.width = 256;
    this.canvas.height = 24;

    this.palette = new Uint32Array();
    this.definition = null;
    this.p = 0; // selected palette index
    this.colorsPerPalette = 16; // number of colors per palette
    this.rowsPerPalette = 1; // number of rows per palette
    this.colorHeight = 24;
    this.showCursor = true;

    this.observer = new ROMObserver(rom, this);

    var paletteView = this;
    this.resizeSensor = null;
}

ROMPaletteView.prototype.updateToolbox = function() {

    this.div.innerHTML = "";

    // add controls to toolbox
    var toolbox = document.getElementById("toolbox");
    var toolboxDiv = document.getElementById("toolbox-div");

    // heading div
    var paletteHeadingDiv = document.createElement('div');
    paletteHeadingDiv.classList.add("property-heading");
    this.div.appendChild(paletteHeadingDiv);

    var paletteHeading = document.createElement('p');
    paletteHeading.innerHTML = "Palette";
    paletteHeadingDiv.appendChild(paletteHeading);

    function valueForDefinition(definition, index) {

        if (!definition) return null;
        var path = definition.path || definition;
        if (!isString(path)) return null;

        if (isNumber(index)) path += "[" + index + "]";

        if (isString(definition)) return JSON.stringify({path: path});

        var value = {};
        Object.assign(value, definition);
        value.path = path;
        return JSON.stringify(value);
    }

    if (this.paletteArray.length) {
        // create a dropdown for array palettes
        var paletteSelectDiv = document.createElement('div');
        paletteSelectDiv.classList.add("property-div");
        this.div.appendChild(paletteSelectDiv);

        var paletteSelectControl = document.createElement('select');
        paletteSelectControl.classList.add("property-control");
        paletteSelectControl.id = "palette-select-control";
        paletteSelectDiv.appendChild(paletteSelectControl);

        var option;
        var index = 0;
        if (this.tilemapView) {
            index = this.tilemapView.object.i;
        } else if (this.graphicsView.object) {
            index = this.graphicsView.object.i;
        }
        var selectedValue = null;
        for (var i = 0; i < this.paletteArray.length; i++) {
            var paletteDefinition = this.paletteArray[i];
            if (!paletteDefinition) continue;
            var palettePath = paletteDefinition.path || paletteDefinition;
            if (!isString(palettePath)) continue;
            palettePath = this.rom.parseIndex(palettePath, index);
            var paletteObject = this.rom.parsePath(palettePath);
            if (!paletteObject) continue;

            if (paletteObject instanceof ROMArray) {
                var optionGroup = document.createElement('optgroup');
                optionGroup.setAttribute("label", paletteDefinition.name || paletteObject.name || "Unnamed Palette");
                for (var j = 0; j < paletteObject.arrayLength; j++) {
                    var value = valueForDefinition(paletteDefinition, j);
                    if (!value) continue;
                    option = document.createElement('option');
                    option.value = value;
                    if (paletteDefinition.name) {
                        option.innerHTML = paletteDefinition.name;
                    } else if (paletteObject.stringTable) {
                        var stringTable = this.rom.stringTable[paletteObject.stringTable];
                        var string = stringTable.string[j];
                        if (string) {
                            option.innerHTML = j + ": " + string.fString(40);
                        } else {
                            option.innerHTML = j + ": " + paletteObject.name + " " + j;
                        }
                    } else {
                        option.innerHTML = j + ": " + paletteObject.name + " " + j;
                    }
                    if (!selectedValue) selectedValue = option.value;
                    if (option.value === this.selectedValue) selectedValue = option.value;
                    optionGroup.appendChild(option);
                }
                paletteSelectControl.appendChild(optionGroup);
            } else if (paletteObject instanceof ROMAssembly) {
                var value = valueForDefinition(paletteDefinition);
                if (!value) continue;
                option = document.createElement('option');
                option.value = value;
                if (paletteDefinition.name) {
                    option.innerHTML = paletteDefinition.name;
                } else if (isNumber(paletteObject.i)) {
                    if (paletteObject.parent.stringTable) {
                        var stringTable = this.rom.stringTable[paletteObject.parent.stringTable];
                        var string = stringTable.string[paletteObject.i];
                        if (string) {
                            option.innerHTML = string.fString(40);
                        } else {
                            option.innerHTML = paletteObject.name + " " + paletteObject.i;
                        }
                    } else {
                        option.innerHTML = paletteObject.name + " " + paletteObject.i;
                    }
                } else {
                    option.innerHTML = paletteObject.name;
                }
                if (!selectedValue) selectedValue = option.value;
                if (option.value === this.selectedValue) selectedValue = option.value;
                paletteSelectControl.appendChild(option);
            }
        }
        if (!selectedValue) selectedValue = JSON.stringify({path: "grayscale"});
        paletteSelectControl.value = selectedValue;
        this.loadPalette(JSON.parse(selectedValue));
        this.selectedValue = selectedValue;

        var self = this;
        paletteSelectControl.onchange = function() {

            self.loadPalette(JSON.parse(this.value));
            self.selectedValue = this.value;
            self.redraw();
            self.graphicsView.redraw();
            if (self.tilemapView) self.tilemapView.redraw();
        }
    }

    // show the palette canvas
    var width = toolbox.offsetWidth;
    toolboxDiv.style.width = width + "px";
    toolboxDiv.classList.remove("hidden");
    this.resize(width);
    this.div.appendChild(this.canvas);

    // add palette import/export buttons
    var importExportDiv = document.createElement('div');
    importExportDiv.classList.add("property-div");
    // this.div.appendChild(importExportDiv);

    var exportButton = document.createElement('button');
    exportButton.innerHTML = "Export Palette";
    exportButton.disabled = true;
    exportButton.onclick = function() {
    };
    importExportDiv.appendChild(exportButton);

    var importButton = document.createElement('button');
    importButton.innerHTML = "Import Palette";
    importButton.disabled = true;
    importButton.onclick = function() {
    };
    importExportDiv.appendChild(importButton);
}

ROMPaletteView.prototype.loadDefinition = function(definition) {

    definition = definition || "grayscale";

    this.format = this.graphicsView.format;
    this.colorsPerPalette = this.format.colorsPerPalette;
    var colorsPerRow = Math.min(this.colorsPerPalette, 16); // max 16 colors per row
    // this.rowsPerPalette = this.colorsPerPalette / colorsPerRow;
    this.definition = definition;
    this.paletteArray = [];

    this.observer.stopObservingAll();

    // clear the palette
    this.palette = new Uint32Array();

    // load a palette from the definition
    this.loadPalette(definition);

    // set the palette index to zero if it is greater than the number of palettes
    var paletteCount = Math.floor(this.palette.length / this.colorsPerPalette);
    if (this.p >= paletteCount) this.p = 0;
    this.resize();

    // add event handlers
    var self = this;
    this.canvas.onmousedown = function(e) { self.mouseDown(e) };
    this.resizeSensor = new ResizeSensor(document.getElementById("toolbox"), function() {
        var toolbox = document.getElementById("toolbox");
        var toolboxDiv = document.getElementById("toolbox-div");
        var width = toolbox.offsetWidth;
        toolboxDiv.style.width = width + "px";
        self.resize();
        self.redraw();
    });
}

ROMPaletteView.prototype.resize = function(width) {

    if (!width) {
        var toolbox = document.getElementById("toolbox");
        var width = toolbox.clientWidth;
    }

    // recalculate number of rows per palette
    if (this.graphicsView.format) {
        this.colorsPerPalette = this.graphicsView.format.colorsPerPalette;
    } else {
        // default to 16 colors per palette
        this.colorsPerPalette = 16;
    }
    this.colorsPerRow = Math.min(this.colorsPerPalette, 16); // max 16 colors per row
    this.rowsPerPalette = this.colorsPerPalette / this.colorsPerRow;

    // recalculate element sizes
    this.colorWidth = width / this.colorsPerRow;
    var paletteCount = Math.ceil(this.palette.length / this.colorsPerPalette);
    if (paletteCount > 1) {
        this.rows = Math.ceil(this.palette.length / this.colorsPerPalette) * this.rowsPerPalette;
    } else {
        this.rows = Math.ceil(this.palette.length / this.colorsPerRow);
    }
    this.rows = Math.min(this.rows, 16); // max of 16 palettes
    // toolboxDiv.style.width = width + "px";
    // toolboxDiv.classList.remove("hidden");
    this.canvas.width = width;
    this.canvas.height = this.rows * this.colorHeight;
}

ROMPaletteView.prototype.loadPalette = function(definition) {
    if (!definition) {
        return;
    } else if (definition === "grayscale") {
        this.palette = GFX.makeGrayPalette(this.colorsPerPalette, false);
        return;
    } else if (definition === "inverseGrayscale") {
        this.palette = GFX.makeGrayPalette(this.colorsPerPalette, true);
        return;
    }

    // multiple choice of palettes (outer array)
    if (isArray(definition)) {
        if (definition.length === 0) return;
        if (definition.length > 1) {
            for (var i = 0; i < definition.length; i++)  this.paletteArray.push(definition[i])
        }
        // load the first array element as a placeholder
        definition = definition[0];
    }

    // recursively load multiple palettes (inner array)
    if (isArray(definition)) {
        for (var i = 0; i < definition.length; i++) this.loadPalette(definition[i]);
        return;
    }

    // get path
    var path = isString(definition) ? definition : definition.path;
    if (!path) return;

    // parse object
    var index = 0;
    if (this.tilemapView) {
        index = this.tilemapView.object.i;
    } else if (this.graphicsView.object) {
        index = this.graphicsView.object.i;
    }
    var object = this.rom.parsePath(path, this.rom, index);

    // load ROMArray objects as multiple choice
    if (object instanceof ROMArray) {
        if (!this.paletteArray.includes(definition)) this.paletteArray.push(definition);

        // load the first array item as a placeholder
        object = object.item(0);
    }

    // get object data
    if (!object || !object.data) return;
    var data = object.data;

    var self = this;
    this.observer.startObserving(object, function() {
        self.loadDefinition(self.definition);
        var paletteSelectControl = document.getElementById('palette-select-control');
        if (paletteSelectControl) {
            self.loadPalette(JSON.parse(paletteSelectControl.value));
        }
        self.redraw();
        self.graphicsView.redraw();
        if (self.tilemapView) self.tilemapView.redraw();
    });

    // data must be 32-bit
    data = new Uint32Array(data.buffer, data.byteOffset, data.byteLength >> 2);

    // parse data range
    var range;
    if (definition.range) {
        range = ROMRange.parse(definition.range);
        data = data.subarray(range.begin, range.end);
    } else {
        range = new ROMRange(0, data.length);
    }

    // parse offset
    var offset = Number(definition.offset) || 0;

    if (this.palette.length < (offset + data.length)) {
        // increase the size of the graphics buffer
        var newPalette = new Uint32Array(offset + data.length);
        newPalette.fill(0xFF000000);
        newPalette.set(this.palette);
        this.palette = newPalette;
    }
    this.palette.set(data, offset);
}

ROMPaletteView.prototype.importPalette = function(palette, offset) {
    offset = offset || 0;
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

    var paletteSelectControl = document.getElementById('palette-select-control');
    if (paletteSelectControl) {
        this.savePalette(JSON.parse(paletteSelectControl.value));
    }
    this.observer.wake();

    // redraw the view
    this.redraw();
    this.graphicsView.redraw();
    if (this.tilemapView) this.tilemapView.redraw();
}

ROMPaletteView.prototype.savePalette = function(definition) {

    if (!definition || definition === "grayscale" || definition === "inverseGrayscale") {
        return;
    }

    // recursively save palettes
    if (isArray(definition)) {
        for (var i = 0; i < definition.length; i++) this.savePalette(definition[i]);
        return;
    }

    // get path
    var path = isString(definition) ? definition : definition.path;
    if (!path) return;

    // parse object
    var index = 0;
    if (this.tilemapView) {
        index = this.tilemapView.object.i;
    } else if (this.graphicsView.object) {
        index = this.graphicsView.object.i;
    }
    var object = this.rom.parsePath(path, this.rom, index);

    // ignore ROMArray objects for now
    if (object instanceof ROMArray) return;

    // get object data
    if (!object || !object.data) return;
    var data = object.data;

    // data must be 32-bit
    data = new Uint32Array(data.buffer, data.byteOffset, data.byteLength >> 2);

    // parse data range
    var range;
    if (definition.range) {
        range = ROMRange.parse(definition.range);
        // data = data.subarray(range.begin, range.end);
    } else {
        range = new ROMRange(0, data.length);
    }

    // parse offset
    var offset = Number(definition.offset) || 0;

    var palette = this.palette.subarray(offset, offset + range.length);

    // convert to and from the native format to validate the data
    if (object.format) {
        // get the graphics format
        var formatKey = object.format;

        // for assemblies with multiple formats, the graphics format is the first one
        if (isArray(formatKey)) formatKey = formatKey[0];

        // ignore format parameters
        if (formatKey.includes("(")) {
            formatKey = formatKey.substring(0, formatKey.indexOf("("));
        }
        var format = GFX.paletteFormat[formatKey];

        if (format) palette = format.decode(format.encode(palette)[0])[0];
    }

    object.setData(palette, range.begin);
}

ROMPaletteView.prototype.show = function() {
}

ROMPaletteView.prototype.hide = function() {
    this.observer.stopObservingAll();
    if (this.resizeSensor) {
        this.resizeSensor.detach(document.getElementById("toolbox"));
        this.resizeSensor = null;
    }
}

ROMPaletteView.prototype.mouseDown = function(e) {
    var row = Math.floor(e.offsetY / this.colorHeight);
    this.p = Math.floor(row / this.rowsPerPalette);
    this.redraw();
    this.graphicsView.updateTilemap();
    this.graphicsView.redraw();
    if (this.graphicsView.tilemapView) {
        this.graphicsView.tilemapView.selectPalette(this.p * this.colorsPerPalette);
        this.graphicsView.tilemapView.redraw();
    }
}

ROMPaletteView.prototype.redraw = function() {
    this.drawPalette();
    this.drawCursor();
}

ROMPaletteView.prototype.drawPalette = function() {

    // clear the canvas
    var ctx = this.canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    var palette = this.rom.gammaCorrectedPalette(this.palette);

    var c = 0;
    for (var y = 0; y < this.rows; y++) {
        for (var x = 0; x < this.colorsPerRow; x++) {
            var color = palette[c++];
            if (!isNumber(color)) color = 0;
            var r = (color & 0xFF);
            var g = (color & 0xFF00) >> 8;
            var b = (color & 0xFF0000) >> 16;
            ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")";

            var xStart = Math.round(x * this.colorWidth);
            var xEnd = Math.round((x + 1) * this.colorWidth);
            ctx.fillRect(xStart, y * this.colorHeight, xEnd - xStart, this.colorHeight);
        }
    }
}

ROMPaletteView.prototype.drawCursor = function() {

    if (!this.showCursor) return;

    // draw the cursor
    var w = this.canvas.width;
    var h = this.colorHeight * this.rowsPerPalette;
    var x = 0;
    var y = this.p * h;
    if (y + h > this.canvas.height) h = this.canvas.height - y;

    var ctx = this.canvas.getContext('2d');
    ctx.lineWidth = 1;
    ctx.strokeStyle = "black";
    x += 0.5; y += 0.5; w--; h--;
    ctx.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    ctx.strokeStyle = "hsl(210, 100%, 50%)";
    ctx.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    ctx.strokeStyle = "white";
    ctx.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    ctx.strokeStyle = "black";
    ctx.strokeRect(x, y, w, h);
}

// ROMGraphicsView
function ROMGraphicsView(rom, tilemapView) {
    ROMEditor.call(this, rom);
    this.name = "ROMGraphicsView";
    this.tilemapView = tilemapView;
    this.paletteView = new ROMPaletteView(rom, this);
    this.editorMode = false;
    this.toolboxMode = false;
    this.previewMode = false;

    this.zoom = 2.0;
    this.width = 16; // width in tiles
    this.height = 16; // height in tiles
    this.tileWidth = 8; // tile width in pixels
    this.tileHeight = 8; // tile height in pixels
    this.maxHeight = 256; // max visible height in toolbox mode
    this.bytesPerTile = this.tileWidth * this.tileHeight;
    this.backColor = false;
    this.graphics = new Uint8Array(this.bytesPerTile);
    this.tilemap = new Uint32Array();
    this.spriteSheet = null;
    this.ss = 0; // sprite sheet index
    this.object = null;
    this.definition = null;
    this.format = GFX.graphicsFormat.linear8bpp;
    this.page = 0;
    this.hFlip = false;
    this.vFlip = false;
    this.z = 0;
    this.canvas = document.createElement('canvas');
    this.graphicsCanvas = document.createElement('canvas');

    this.selection = {x: 0, y: 0, w: 0, h: 0, tilemap: new Uint32Array()};
    this.cursorCanvas = document.createElement("canvas");
    this.cursorCanvas.id = "tileset-cursor";

    this.clickedCol = null;
    this.clickedRow = null;

    this.canvasDiv = document.createElement('div');
    this.canvasDiv.classList.add("graphics-div");
    this.canvasDiv.classList.add("background-gradient");
    this.canvasDiv.appendChild(this.canvas);
    this.canvasDiv.appendChild(this.cursorCanvas);

    this.div = document.createElement('div');

    this.observer = new ROMObserver(rom, this);

    var self = this;
    this.canvas.onmousedown = function(e) { self.mouseDown(e) };
    this.canvas.onmouseup = function(e) { self.mouseUp(e) };
    this.canvas.onmousemove = function(e) { self.mouseMove(e) };
    this.canvas.onmouseout = function(e) { self.mouseOut(e) };
    this.canvas.oncontextmenu = function() { return false; };
}

ROMGraphicsView.prototype = Object.create(ROMEditor.prototype);
ROMGraphicsView.prototype.constructor = ROMGraphicsView;

ROMGraphicsView.prototype.selectObject = function(object) {

    this.editorMode = true;
    this.div.innerHTML = "";
    this.div.id = "map-edit";
    this.div.tabIndex = 0;
    this.div.style.outline = "none";
    this.div.appendChild(this.canvasDiv);

    // select an object with this view as the editor
    if (!(object instanceof ROMGraphics)) return;

    // start observing the graphics object
    this.observer.stopObservingAll();

    this.object = object;
    this.graphics = object.data;
    this.definition = null;
    this.width = object.width || 16;
    this.height = object.height || 16;
    this.tileWidth = object.tileWidth || 8;
    this.tileHeight = object.tileHeight || 8;
    this.bytesPerTile = this.tileWidth * this.tileHeight;
    this.backColor = object.backColor;
    this.selection = {x: 0, y: 0, w: 0, h: 0, tilemap: new Uint32Array};
    this.spriteSheet = null;

    // get the graphics format
    var formatKey = this.object.format;

    // for assemblies with multiple formats, the graphics format is the first one
    if (isArray(formatKey)) formatKey = formatKey[0];

    // ignore format parameters
    if (formatKey.includes("(")) {
        formatKey = formatKey.substring(0, formatKey.indexOf("("));
    }
    this.format = GFX.graphicsFormat[formatKey];

    var self = this;
    this.observer.startObserving(object, function() {
        self.selectObject(object);
        self.redraw();
    });

    this.show();
    this.updateTilemap();

    // load the palette
    this.paletteView.loadDefinition(object.palette);
    this.paletteView.updateToolbox();
    this.paletteView.redraw();
    this.redraw();
}

ROMGraphicsView.prototype.show = function() {

    this.resetControls();
    this.showControls();
    this.closeList();

    // update the toolbox div
    var toolboxDiv = document.getElementById('toolbox-div');
    toolboxDiv.innerHTML = "";
    toolboxDiv.classList.remove('hidden');
    toolboxDiv.style.height = "auto";
    toolboxDiv.appendChild(this.paletteView.div);

    document.getElementById("toolbox-layer-div").classList.add('hidden');

    this.div.focus();
}

ROMGraphicsView.prototype.resetControls = function() {
    ROMEditor.prototype.resetControls.call(this);

    var self = this;

    // add a control to select the sprite sheet
    if (this.object && this.object.spriteSheet) {
        var onChangeSpriteSheet = function(ss) {
            self.ss = ss;
            self.updateTilemap();
            self.drawGraphics();
        }
        var spriteSheetSelected = function(ss) {
            return (ss === self.ss);
        }

        // create a list of tilemap options
        var spriteSheetList = [];
        if (isArray(this.object.spriteSheet)) {
            for (var ss = 0; ss < this.object.spriteSheet.length; ss++) {
                spriteSheetList.push(this.object.spriteSheet[ss].name || ("Sprite Sheet " + ss));
            }
        } else {
            spriteSheetList.push(this.object.spriteSheet.name || "Default");
        }
        // select the first available tilemap if the current selection is unavailable
        if (this.ss >= spriteSheetList.length) this.ss = 0;

        // no tilemap is always the last option
        spriteSheetList.push("None");
        this.addList("changeSpriteSheet", "Sprite Sheet", spriteSheetList, onChangeSpriteSheet, spriteSheetSelected);

    } else {
        this.ss = 0;
    }

    this.addZoom(this.zoom, function() { self.changeZoom(); }, 0, 4);
}

ROMGraphicsView.prototype.hide = function() {
    this.observer.stopObservingAll();
    if (this.resizeSensor) {
        this.resizeSensor.detach(document.getElementById("toolbox"));
        this.resizeSensor = null;
    }

    this.paletteView.hide();
}

ROMGraphicsView.prototype.mouseDown = function(e) {
    this.closeList();
    this.clickedCol = Math.floor(e.offsetX / this.zoom / this.tileWidth);
    this.clickedRow = Math.floor(e.offsetY / this.zoom / this.tileHeight);
    this.mouseMove(e);

    // select the graphics object in editor mode
    if (this.editorMode && this.object) {
        propertyList.select(this.object);
    }
}

ROMGraphicsView.prototype.mouseUp = function(e) {
    this.clickedCol = null;
    this.clickedRow = null;
}

ROMGraphicsView.prototype.mouseOut = function(e) {
    this.mouseUp(e);
}

ROMGraphicsView.prototype.mouseMove = function(e) {

    var col = Math.floor(e.offsetX / this.zoom / this.tileWidth);
    var row = Math.floor(e.offsetY / this.zoom / this.tileHeight);
    col = Math.min(col, this.width - 1);
    row = Math.min(row, this.height - 1);

    // update the displayed coordinates (editor mode only)
    if (this.object) {
        var coordinates = document.getElementById("coordinates");
        coordinates.innerHTML = "(" + col + ", " + row + ")";
    }

    // return unless dragging (except if trigger layer selected)
    if (!isNumber(this.clickedCol) || !isNumber(this.clickedRow)) return;

    var cols = Math.abs(col - this.clickedCol) + 1;
    var rows = Math.abs(row - this.clickedRow) + 1;
    col = Math.min(col, this.clickedCol);
    row = Math.min(row, this.clickedRow);

    // create the tile selection
    this.selection.x = col;
    this.selection.y = row;
    this.selection.w = cols;
    this.selection.h = rows;
    this.selection.tilemap = new Uint32Array(cols * rows);
    for (var y = 0; y < rows; y++) {
        var begin = col + (row + y) * this.width;
        var end = begin + cols;
        var line = this.tilemap.subarray(begin, end);
        this.selection.tilemap.set(line, y * cols);
    }

    // redraw the cursor and notify the tilemap view
    this.drawCursor();
    if (this.tilemapView) {
        this.tilemapView.selection = {
            x: 0, y: 0, w: cols, h: rows,
            tilemap: new Uint32Array(this.selection.tilemap)
        };
    }
}

ROMGraphicsView.prototype.selectTile = function(tile) {
    // select a single tile from the tilemap view

    var t = tile & 0xFFFF;
    var v = tile & 0x20000000;
    var h = tile & 0x10000000;
    var z = tile & 0x0F000000;

    var x = t % this.width;
    var y = Math.floor(t / this.width);

    this.hFlip = h ? true : false;
    this.vFlip = v ? true : false;

    if (this.hFlip) x = this.width - x - 1;
    if (this.vFlip) y = this.height - y - 1;

    this.selection = {
        x: x, y: y, w: 1, h: 1,
        tilemap: new Uint32Array(1)
    };
    this.updateTilemap();
    this.scrollToSelection();
    this.redraw();

    var vButton = document.getElementById("graphics-v-flip");
    if (vButton) {
        vButton.checked = this.vFlip;
        twoState(vButton);
    }

    var hButton = document.getElementById("graphics-h-flip");
    if (hButton) {
        hButton.checked = this.hFlip;
        twoState(hButton);
    }

    var zControl = document.getElementById("graphics-z-level");
    if (zControl) {
        zControl.value = z >> 24;
    }
}

ROMGraphicsView.prototype.updateToolbox = function() {

    var self = this;
    this.div.innerHTML = "";

    function valueForDefinition(definition, index) {

        if (!definition) return null;
        var path = definition.path || definition;
        if (!isString(path)) return null;

        if (isNumber(index)) path += "[" + index + "]";

        if (isString(definition)) return JSON.stringify({path: path});

        var value = {};
        Object.assign(value, definition);
        value.path = path;
        return JSON.stringify(value);
    }

    if (this.graphicsArray.length) {
        // create a dropdown for array graphics
        var graphicsSelectDiv = document.createElement('div');
        graphicsSelectDiv.classList.add("property-div");
        this.div.appendChild(graphicsSelectDiv);

        var graphicsSelectControl = document.createElement('select');
        graphicsSelectControl.classList.add("property-control");
        graphicsSelectControl.id = "graphics-select-control";
        graphicsSelectDiv.appendChild(graphicsSelectControl);

        var option;
        var index = 0;
        if (this.tilemapView) {
            index = this.tilemapView.object.i;
        }
        var selectedValue = null;
        for (var i = 0; i < this.graphicsArray.length; i++) {
            var graphicsDefinition = this.graphicsArray[i];
            if (!graphicsDefinition) continue;
            var graphicsPath = graphicsDefinition.path || graphicsDefinition;
            if (!isString(graphicsPath)) continue;
            graphicsPath = this.rom.parseIndex(graphicsPath, index);
            var graphicsObject = this.rom.parsePath(graphicsPath);
            if (!graphicsObject) continue;

            if (graphicsObject instanceof ROMArray) {
                for (var j = 0; j < graphicsObject.arrayLength; j++) {
                    var value = valueForDefinition(graphicsDefinition, j);
                    if (!value) continue;
                    option = document.createElement('option');
                    option.value = value;
                    if (graphicsDefinition.name) {
                        option.innerHTML = graphicsDefinition.name;
                    } else if (graphicsObject.stringTable) {
                        var stringTable = this.rom.stringTable[graphicsObject.stringTable];
                        var string = stringTable.string[j];
                        if (string) {
                            option.innerHTML = j + ": " + string.fString(40);
                        } else {
                            option.innerHTML = j + ": " + graphicsObject.name + " " + j;
                        }
                    } else {
                        option.innerHTML = j + ": " + graphicsObject.name + " " + j;
                    }
                    if (!selectedValue) selectedValue = option.value;
                    if (option.value === this.selectedValue) selectedValue = option.value;
                    graphicsSelectControl.appendChild(option);
                }
            } else if (graphicsObject instanceof ROMAssembly) {
                var value = valueForDefinition(graphicsDefinition);
                if (!value) continue;
                option = document.createElement('option');
                option.value = value;
                if (graphicsDefinition.name) {
                    option.innerHTML = graphicsDefinition.name;
                } else if (isNumber(graphicsObject.i)) {
                    if (graphicsObject.parent.stringTable) {
                        var stringTable = this.rom.stringTable[graphicsObject.parent.stringTable];
                        var string = stringTable.string[graphicsObject.i];
                        if (string) {
                            option.innerHTML = string.fString(40);
                        } else {
                            option.innerHTML = graphicsObject.name + " " + graphicsObject.i;
                        }
                    } else {
                        option.innerHTML = graphicsObject.name + " " + graphicsObject.i;
                    }
                } else {
                    option.innerHTML = graphicsObject.name;
                }
                if (!selectedValue) selectedValue = option.value;
                if (option.value === this.selectedValue) selectedValue = option.value;
                graphicsSelectControl.appendChild(option);
            }
        }
        graphicsSelectControl.value = selectedValue;
        this.loadGraphics(JSON.parse(selectedValue));
        this.selectedValue = selectedValue;

        var self = this;
        graphicsSelectControl.onchange = function() {

            self.loadGraphics(JSON.parse(this.value));
            self.selectedValue = this.value;
            self.redraw();
            if (self.tilemapView) self.tilemapView.redraw();
        }
    }

    var showZLevelControl = this.format.maxZ && !this.tilemapView.object.disableZLevel;
    var showVFlipControl = this.format.vFlip && !this.tilemapView.object.disableVFlip;
    var showHFlipControl = this.format.hFlip && !this.tilemapView.object.disableHFlip;

    // add controls for v/h flip, z-level
    if (showZLevelControl || showVFlipControl || showHFlipControl) {

        var graphicsControlsDiv = document.createElement('div');
        graphicsControlsDiv.classList.add("graphics-controls");
        this.div.appendChild(graphicsControlsDiv);
    }

    if (showVFlipControl) {
        var vLabel = document.createElement('label');
        vLabel.classList.add("two-state");
        vLabel.style.display = "inline-block";
        if (this.vFlip) vLabel.classList.add("checked");
        graphicsControlsDiv.appendChild(vLabel);

        var vInput = document.createElement('input');
        vInput.type = 'checkbox';
        vInput.checked = this.vFlip;
        vInput.id = "graphics-v-flip";
        vInput.onclick = function() {
            twoState(this);
            self.vFlip = this.checked;
            self.tilemapView.toggleSelectionVFlip();
            self.selection.y = self.height - self.selection.y - self.selection.h;
            self.updateTilemap();
            self.scrollToSelection();
            self.redraw();
        };
        vLabel.appendChild(vInput);

        var vText = document.createElement('p');
        vText.innerHTML = "V-Flip";
        vLabel.appendChild(vText);
    }

    if (showHFlipControl) {
        var hLabel = document.createElement('label');
        hLabel.classList.add("two-state");
        hLabel.style.display = "inline-block";
        if (this.hFlip) hLabel.classList.add("checked");
        graphicsControlsDiv.appendChild(hLabel);

        var hInput = document.createElement('input');
        hInput.type = 'checkbox';
        hInput.checked = this.hFlip;
        hInput.id = "graphics-h-flip";
        hInput.onclick = function() {
            twoState(this);
            self.hFlip = this.checked;
            self.tilemapView.toggleSelectionHFlip();
            self.selection.x = self.width - self.selection.x - self.selection.w;
            self.updateTilemap();
            self.scrollToSelection();
            self.redraw();
        };
        hLabel.appendChild(hInput);

        var hText = document.createElement('p');
        hText.innerHTML = "H-Flip";
        hLabel.appendChild(hText);
    }

    if (showZLevelControl) {
        var zLabel = document.createElement('label');
        zLabel.innerHTML = "Z-Level:";
        zLabel.style.display = "inline-block";
        zLabel.style.padding = "2px 10px";
        zLabel.style.margin = "4px 3px";
        zLabel.htmlFor = "graphics-z-level";
        graphicsControlsDiv.appendChild(zLabel);

        var zInput = document.createElement('input');
        zInput.id = "graphics-z-level";
        zInput.type = 'number';
        zInput.classList.add("property-control");
        zInput.style.width = "3em";
        zInput.value = 0;
        zInput.min = 0;
        zInput.max = this.format.maxZ - 1;
        zInput.onchange = function() {
            self.z = Number(this.value);
            self.tilemapView.setSelectionZ(self.z);
            self.updateTilemap();
            self.scrollToSelection();
            self.redraw();
        };
        graphicsControlsDiv.appendChild(zInput);
    }

    // show the graphics canvas
    this.div.appendChild(this.canvasDiv);

    // add graphics import/export buttons
    var importExportDiv = document.createElement('div');
    importExportDiv.classList.add("property-div");
    this.div.appendChild(importExportDiv);

    var exportButton = document.createElement('button');
    exportButton.innerHTML = "Export Graphics";
    exportButton.onclick = function() {
        var exporter = new ROMGraphicsExporter();
        exporter.export({
            tilemap: self.tilemap,
            graphics: self.graphics,
            palette: self.paletteView.palette,
            width: self.width,
            tileWidth: self.tileWidth,
            tileHeight: self.tileHeight,
            backColor: self.backColor
        });
    };
    importExportDiv.appendChild(exportButton);

    var importButton = document.createElement('button');
    importButton.innerHTML = "Import Graphics";
    importButton.onclick = function() {
        function callback(graphics, palette) {
            // set the new graphics/palette data
            self.rom.beginAction();
            if (graphics) self.importGraphics(graphics);
            if (palette) self.paletteView.importPalette(palette);
            self.rom.endAction();
        }
        var importer = new ROMGraphicsImporter(rom, self, callback);
    };
    importExportDiv.appendChild(importButton);
}

ROMGraphicsView.prototype.changeZoom = function() {
    // this only applies in editor mode
    if (!this.editorMode) return;

    // update zoom
    this.zoom = Math.pow(2, Number(document.getElementById("zoom").value));
    var zoomValue = document.getElementById("zoom-value");
    zoomValue.innerHTML = (this.zoom * 100).toString() + "%";

    this.redraw();
}

ROMGraphicsView.prototype.loadDefinition = function(definition) {

    this.toolboxMode = true;

    // load graphics from a definition (via ROMTilemapView)
    this.definition = definition;
    this.format = this.tilemapView.format;
    this.backColor = this.tilemapView.backColor;
    this.graphicsArray = [];
    // this.canvasDiv.classList.add("background-gradient");

    this.observer.stopObservingAll();

    // clear the graphics
    this.graphics = new Uint8Array();
    this.width = null;
    this.height = null;

    // load graphics from the definition
    this.loadGraphics(definition);
    if (!this.tileWidth) this.tileWidth = 8;
    if (!this.tileHeight) this.tileHeight = 8;
    this.bytesPerTile = this.tileWidth * this.tileHeight;
    if (!this.width) this.width = 16;
    if (!this.height) {
        this.height = Math.ceil(this.graphics.length / this.bytesPerTile / this.width);
    }

    // notify on resize
    var self = this;
    this.resizeSensor = new ResizeSensor(document.getElementById("toolbox"), function() {
        // var toolbox = document.getElementById("toolbox");
        // var toolboxDiv = document.getElementById("toolbox-div");
        // var width = toolbox.offsetWidth;
        // toolboxDiv.style.width = width + "px";
        self.redraw();
    });
}

ROMGraphicsView.prototype.loadGraphics = function(definition) {
    if (!definition) return;

    // multiple choice of graphics (outer array)
    if (isArray(definition)) {
        if (definition.length === 0) return;
        if (definition.length > 1) {
            for (var i = 0; i < definition.length; i++)  this.graphicsArray.push(definition[i])
        }
        // load the first array element as a placeholder
        definition = definition[0];
    }

    // recursively load multiple graphics (inner array)
    if (isArray(definition)) {
        for (var i = 0; i < definition.length; i++) this.loadGraphics(definition[i]);
        return;
    }

    // get path
    var path = isString(definition) ? definition : definition.path;
    if (!path) return;

    // parse object
    var index = 0;
    if (this.tilemapView) {
        index = this.tilemapView.object.i;
    }
    var object = this.rom.parsePath(path, this.rom, index);

    // load ROMArray objects as multiple choice
    if (object instanceof ROMArray) {
        this.graphicsArray.push(definition);

        // load the first array item as a placeholder
        object = object.item(0);
    }

    // get object data
    if (!object) return;
    var data = object.data;
    if (!object.data) return;

    if (object.width) this.width = object.width;
    if (object.height) this.height = object.height;
    if (object.tileWidth) this.tileWidth = object.tileWidth;
    if (object.tileHeight) this.tileHeight = object.tileHeight;

    var self = this;
    this.observer.startObserving(object, function() {
        self.loadDefinition(self.definition);
        var graphicsSelectControl = document.getElementById('graphics-select-control');
        if (graphicsSelectControl) {
            self.loadGraphics(JSON.parse(graphicsSelectControl.value));
        }
        self.updateTilemap();
        self.redraw();
        if (self.tilemapView) self.tilemapView.redraw();
    });

    // parse data range
    var range;
    if (definition.range) {
        range = ROMRange.parse(definition.range);
        data = data.subarray(range.begin, range.end);
    } else {
        range = new ROMRange(0, data.length);
    }

    // parse offset
    var offset = Number(definition.offset) || 0;

    if (this.graphics.length < (offset + data.length)) {
        // increase the size of the graphics buffer
        var newGraphics = new Uint8Array(offset + data.length);
        newGraphics.set(this.graphics);
        this.graphics = newGraphics;
    }
    this.graphics.set(data, offset);
}

ROMGraphicsView.prototype.importGraphics = function(graphics, offset) {
    offset = offset || 0;
    if ((graphics.length + offset) > this.graphics.length) {
        // trim the palette to fit
        graphics = graphics.subarray(0, this.graphics.length - offset);
    }

    this.graphics.set(graphics, offset);

    this.observer.sleep();
    if (isArray(this.definition)) {
        if (this.definition.length === 1) this.saveGraphics(this.definition[0]);
    } else {
        this.saveGraphics(this.definition);
    }

    var graphicsSelectControl = document.getElementById('graphics-select-control');
    if (graphicsSelectControl) {
        this.saveGraphics(JSON.parse(graphicsSelectControl.value));
    }
    this.observer.wake();

    // redraw the view
    this.redraw();
    if (this.tilemapView) this.tilemapView.redraw();
}

ROMGraphicsView.prototype.saveGraphics = function(definition) {

    if (!definition) return;

    // recursively save graphics
    if (isArray(definition)) {
        for (var i = 0; i < definition.length; i++) this.saveGraphics(definition[i]);
        return;
    }

    // get path
    var path = isString(definition) ? definition : definition.path;
    if (!path) return;

    // parse object
    var index = 0;
    if (this.tilemapView) {
        index = this.tilemapView.object.i;
    }
    var object = this.rom.parsePath(path, this.rom, index);

    // ignore ROMArray objects for now
    if (object instanceof ROMArray) return;

    // get object data
    if (!object || !object.data) return;
    var data = object.data;

    // parse data range
    var range;
    if (definition.range) {
        range = ROMRange.parse(definition.range);
    } else {
        range = new ROMRange(0, data.length);
    }

    // parse offset
    var offset = Number(definition.offset) || 0;

    var graphics = this.graphics.subarray(offset, offset + range.length);

    // convert to and from the native format to validate the data
    if (object.format) {
        // get the palette format
        var formatKey = object.format;

        // for assemblies with multiple formats, the palette format is the first one
        if (isArray(formatKey)) formatKey = formatKey[0];

        // ignore format parameters
        if (formatKey.includes("(")) {
            formatKey = formatKey.substring(0, formatKey.indexOf("("));
        }
        var format = GFX.graphicsFormat[formatKey];

        if (format) graphics = format.decode(format.encode(graphics)[0])[0];
    }

    if (range.begin + graphics.length > object.data.length) {
        graphics = graphics.subarray(0, object.data.length - range.begin);
    }
    object.setData(graphics, range.begin);
}

ROMGraphicsView.prototype.updateTilemap = function() {

    if (this.object && this.object.spriteSheet) {
        var spriteSheetArray = this.object.spriteSheet;
        if (!isArray(spriteSheetArray)) spriteSheetArray = [spriteSheetArray];
        this.spriteSheet = spriteSheetArray[this.ss];
    }

    // never use a sprite sheet in toolbox mode
    if (this.toolboxMode) {

        this.spriteSheet = null;
        var tileCount = Math.floor(this.graphics.length / this.bytesPerTile);

        this.tilemap = new Uint32Array(this.height * this.width);
        this.tilemap.fill(0xFFFFFFFF);

        var p = (this.paletteView.p * this.paletteView.colorsPerPalette) << 16;
        for (var t = 0; t < tileCount; t++) this.tilemap[t] = t | p;

    } else if (this.spriteSheet) {
        // use a sprite sheet
        this.width = this.spriteSheet.width || this.width;
        this.height = this.spriteSheet.height || Math.ceil(this.graphics.length / this.bytesPerTile / this.width);
        this.tilemap = new Uint32Array(this.height * this.width);
        this.tilemap.fill(0xFFFFFFFF);
        var p = (this.paletteView.p * this.paletteView.colorsPerPalette) << 16;
        if (this.spriteSheet.fixedPalette) p = 0;
        for (var t = 0; t < this.tilemap.length; t++) {
            var tile = Number(this.spriteSheet.tilemap[t]);
            if (isNumber(tile) && tile !== -1) this.tilemap[t] = tile | p;
        }

    } else {
        // no sprite sheet
        if (this.object) this.width = this.object.width || 16;
        this.height = Math.ceil(this.graphics.length / this.bytesPerTile / this.width) || 1;
        this.tilemap = new Uint32Array(this.height * this.width);
        this.tilemap.fill(0xFFFFFFFF);
        var p = (this.paletteView.p * this.paletteView.colorsPerPalette) << 16;
        for (var t = 0; t < this.tilemap.length; t++) this.tilemap[t] = t | p;
    }

    if (this.vFlip) {
        var vTilemap = new Uint32Array(this.tilemap.length);
        var t = 0;
        while (t < tileCount) {
            for (var y = 0; y < this.height; y++) {
                for (var x = 0; x < this.width; x++) {
                    var t1 = x + (this.height - y - 1) * this.width; // + pageOffset;
                    vTilemap[t1] = this.tilemap[t++] ^ 0x20000000;
                }
            }
        }
        this.tilemap = vTilemap;
    }

    if (this.hFlip) {
        var hTilemap = new Uint32Array(this.tilemap.length);
        var t = 0;
        while (t < tileCount) {
            for (var y = 0; y < this.height; y++) {
                for (var x = 0; x < this.width; x++) {
                    var t1 = (this.width - x - 1) + y * this.width; // + pageOffset;
                    hTilemap[t1] = this.tilemap[t++] ^ 0x10000000;
                }
            }
        }
        this.tilemap = hTilemap;
    }
}

ROMGraphicsView.prototype.scrollToSelection = function() {
    var selectionHeight = this.selection.h * this.tileHeight * this.zoom;
    var clientHeight = this.canvasDiv.clientHeight;

    var selectionTop = this.selection.y * this.tileWidth * this.zoom;
    var selectionBottom = selectionTop + selectionHeight;
    var visibleTop = this.canvasDiv.scrollTop;
    var visibleBottom = visibleTop + clientHeight;

    // return if the selection is visible
    if (selectionTop >= visibleTop && selectionBottom <= visibleBottom) return;

    // scroll so that the selection is centered vertically in the div
    var scrollCenter = selectionTop + selectionHeight * 0.5;
    var scrollBottom = Math.min(scrollCenter + clientHeight * 0.5, this.canvas.height);
    var scrollTop = Math.max(0, scrollBottom - clientHeight);
    this.canvasDiv.scrollTop = scrollTop;
}

ROMGraphicsView.prototype.redraw = function() {
    this.drawGraphics();
    this.drawCursor();
}

ROMGraphicsView.prototype.drawGraphics = function() {

    var ppu = new GFX.PPU();
    ppu.back = this.backColor;

    // create the palette
    var palette = new Uint32Array(this.paletteView.palette);

    ppu.pal = this.rom.gammaCorrectedPalette(palette);
    ppu.width = this.width * this.tileWidth;
    ppu.height = this.height * this.tileHeight;
    if (ppu.height === 0) return;

    // layer 1
    ppu.layers[0].format = null;
    ppu.layers[0].cols = this.width;
    ppu.layers[0].rows = this.height;
    ppu.layers[0].z[0] = GFX.Z.top;
    ppu.layers[0].z[1] = GFX.Z.top;
    ppu.layers[0].z[2] = GFX.Z.top;
    ppu.layers[0].z[3] = GFX.Z.top;
    ppu.layers[0].gfx = this.graphics;
    ppu.layers[0].tiles = this.tilemap;
    ppu.layers[0].tileWidth = this.tileWidth;
    ppu.layers[0].tileHeight = this.tileHeight;
    ppu.layers[0].main = true;

    // draw layout image
    this.graphicsCanvas.width = ppu.width;
    this.graphicsCanvas.height = ppu.height;
    var context = this.graphicsCanvas.getContext('2d');
    imageData = context.createImageData(ppu.width, ppu.height);
    ppu.renderPPU(imageData.data, 0, 0, ppu.width, ppu.height);
    context.putImageData(imageData, 0, 0);

    if (this.toolboxMode) {
        // recalculate zoom based on toolbox width
        var toolbox = document.getElementById("toolbox");
        var toolboxDiv = document.getElementById("toolbox-div");

        // hide scroll bars before calculating zoom
        toolbox.style.overflowY = "hidden";
        toolboxDiv.style.width = toolbox.clientWidth + "px";

        // recalculate zoom without scroll bars
        this.zoom = toolboxDiv.clientWidth / ppu.width;

        // update canvas div size
        this.canvasDiv.style.width = ppu.width * this.zoom + "px";
        this.canvasDiv.style.height = ppu.height * this.zoom + "px";

        // check if scroll bars are needed
        if (toolbox.scrollHeight > toolbox.clientHeight) {

            // show scroll bars and recalculate zoom
            toolbox.style.overflowY = "scroll";
            toolboxDiv.style.width = toolbox.clientWidth + "px";
            this.zoom = toolboxDiv.clientWidth / ppu.width;

            this.canvasDiv.style.width = ppu.width * this.zoom + "px";
            this.canvasDiv.style.height = ppu.height * this.zoom + "px";
        }

        toolbox.style.overflowY = "";

    // } else if (this.previewMode) {

        // // show scroll bars before calculating zoom
        // this.canvasDiv.classList.add("toolbox-scroll");
        // this.zoom = this.canvasDiv.clientWidth / ppu.width;
        //
        // // update canvas div size
        // this.canvasDiv.width = ppu.width * this.zoom;
        // this.canvasDiv.height = ppu.height * this.zoom;
        //
        // if (this.canvasDiv.height > this.canvasDiv.width) {
        //     // max height same is 256 pixels in toolbox mode
        //     this.canvasDiv.height = this.canvasDiv.width;
        // } else {
        //     // hide scroll bars is less than max height
        //     this.canvasDiv.classList.remove("toolbox-scroll");
        // }
        //
        // // recalculate zoom to account for scroll bars
        // this.zoom = this.canvasDiv.clientWidth / ppu.width;

    } else {
        this.canvasDiv.width = ppu.width * this.zoom;
        this.canvasDiv.height = ppu.height * this.zoom;
    }

    // scale image to zoom setting
    this.canvas.width = ppu.width * this.zoom;
    this.canvas.height = ppu.height * this.zoom;
    this.cursorCanvas.width = this.canvas.width;
    this.cursorCanvas.height = this.canvas.height;
    context = this.canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.webkitImageSmoothingEnabled = false;
    context.drawImage(this.graphicsCanvas,
        0, 0, this.graphicsCanvas.width, this.graphicsCanvas.height,
        0, 0, this.canvas.width, this.canvas.height);
}

ROMGraphicsView.prototype.drawCursor = function() {
    // clear the cursor canvas
    var ctx = this.cursorCanvas.getContext('2d');
    ctx.clearRect(0, 0, this.cursorCanvas.width, this.cursorCanvas.height);

    // return if trigger layer is selected
    if (!this.selection.tilemap.length) return;

    // get the cursor geometry
    var x = Math.round((this.selection.x * this.tileWidth) * this.zoom);
    var y = Math.round((this.selection.y * this.tileHeight) * this.zoom);
    var w = Math.round((this.selection.w * this.tileWidth) * this.zoom);
    var h = Math.round((this.selection.h * this.tileHeight) * this.zoom);

    w = Math.min(w, this.width * this.tileWidth * this.zoom - x);
    h = Math.min(h, this.height * this.tileHeight * this.zoom - y);

    // draw the cursor
    if (x > this.width * this.tileWidth * this.zoom ||
        y > this.height * this.tileHeight * this.zoom) return;
    if (w <= 0 || h <= 0) return;

    // convert the selection to screen coordinates
    ctx.lineWidth = 1;
    ctx.strokeStyle = "black";
    x += 0.5; y += 0.5; w--; h--;
    ctx.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    ctx.strokeStyle = "hsl(210, 100%, 50%)";
    ctx.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    ctx.strokeStyle = "white";
    ctx.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    ctx.strokeStyle = "black";
    ctx.strokeRect(x, y, w, h);
}

// ROMTilemapView
function ROMTilemapView(rom) {
    ROMEditor.call(this, rom);
    this.name = "ROMTilemapView";

    this.graphicsView = new ROMGraphicsView(rom, this);
    this.graphicsView.backColor = 0xFF000000;
    this.paletteView = this.graphicsView.paletteView;
    this.paletteView.tilemapView = this;

    this.div = document.createElement('div');
    this.div.id = 'map-edit';
    this.div.tabIndex = 0;
    this.div.style.outline = "none";

    this.zoom = 2.0;
    this.width = 16; // width in tiles
    this.height = 16; // height in tiles
    this.tileWidth = 8; // tile width in pixels
    this.tileHeight = 8; // tile height in pixels
    this.backColor = false;
    this.object = null;
    this.tilemap = new Uint32Array();
    this.format = GFX.tileFormat.defaultTile;
    this.canvas = document.createElement('canvas');
    this.div.appendChild(this.canvas);
    this.layoutCanvas = document.createElement('canvas');
    this.cursorCanvas = document.createElement('canvas');
    this.cursorCanvas.id = "map-cursor";
    this.cursorCanvas.width = 8;
    this.cursorCanvas.height = 8;
    this.div.appendChild(this.cursorCanvas);

    this.selection = { x: 0, y: 0, w: 1, h: 1, tilemap: new Uint32Array(1) };
    this.clickPoint = null;
    this.mousePoint = { x: 0, y: 0 };
    this.isDragging = false;
    this.showCursor = false;
    this.showPalette = true;
    this.showGraphics = true;

    this.tileMask = ROMTilemapView.TileMasks.none.key;

    var self = this;
    this.canvas.onmousedown = function(e) { self.mouseDown(e) };
    this.canvas.onmousemove = function(e) { self.mouseMove(e) };
    this.canvas.onmouseup = function(e) { self.mouseUp(e) };
    this.canvas.onmouseenter = function(e) { self.mouseEnter(e) };
    this.canvas.onmouseleave = function(e) { self.mouseLeave(e) };
    this.canvas.oncontextmenu = function(e) { return false; };

    this.observer = new ROMObserver(rom, this);
}

ROMTilemapView.prototype = Object.create(ROMEditor.prototype);
ROMTilemapView.prototype.constructor = ROMTilemapView;

ROMTilemapView.prototype.selectObject = function(object) {

    this.object = object || this.object;

    // get the tile format
    var formatKey = this.object.format;

    // for assemblies with multiple formats, the graphics format is the first one
    if (isArray(formatKey)) formatKey = formatKey[0];

    // ignore format parameters
    if (formatKey.includes("(")) {
        formatKey = formatKey.substring(0, formatKey.indexOf("("));
    }
    this.format = GFX.tileFormat[formatKey] || GFX.tileFormat.defaultTile;

    this.closeList();
    this.resetControls();
    this.showControls();
    this.loadTilemap();
}

// ROMTilemapView.prototype.show = function() {
//     document.getElementById('toolbox-layer-div').classList.add("hidden");
//
//     // add controls to show/hide the palette and graphics
//     var self = this;
//     this.addTwoState("showPalette", function(show) {
//         self.showPalette = show;
//         self.updateToolbox();
//     }, "Palette", this.showPalette);
//     this.addTwoState("showGraphics", function(show) {
//         self.showGraphics = show;
//         self.updateToolbox();
//     }, "Graphics", this.showGraphics);
//
//     // add a mask menu
//
//     // add a zoom control
//     this.addZoom(this.zoom, function() { self.changeZoom(); }, 0, 4);
//
//     this.updateToolbox();
//     this.div.focus();
// }

ROMTilemapView.TileMasks = {
    "none": {
        "key": "none",
        "name": "None"
    },
    "vFlip": {
        "key": "vFlip",
        "name": "V-Flip"
    },
    "hFlip": {
        "key": "hFlip",
        "name": "H-Flip"
    },
    "zLevel": {
        "key": "zLevel",
        "name": "Z-Level"
    // },
    // "tileIndex": {
    //     "key": "tileIndex",
    //     "name": "Tile Index"
    }
}

ROMTilemapView.prototype.resetControls = function() {

    ROMEditor.prototype.resetControls.call(this);

    // hide the layer buttons
    document.getElementById('toolbox-layer-div').classList.add("hidden");

    var self = this;

    // add controls to show/hide the palette and graphics
    var self = this;
    this.addTwoState("showPalette", function(show) {
        self.showPalette = show;
        self.updateToolbox();
    }, "Palette", this.showPalette);
    this.addTwoState("showGraphics", function(show) {
        self.showGraphics = show;
        self.updateToolbox();
    }, "Graphics", this.showGraphics);

    // add tile mask button
    var maskKeys = [ROMTilemapView.TileMasks.none.key];
    if (!this.object.disableVFlip) maskKeys.push(ROMTilemapView.TileMasks.vFlip.key);
    if (!this.object.disableHFlip) maskKeys.push(ROMTilemapView.TileMasks.hFlip.key);
    if (!this.object.disableZLevel) maskKeys.push(ROMTilemapView.TileMasks.zLevel.key);
    if (maskKeys.length > 1) {
        var maskNames = [];
        for (var i = 0; i < maskKeys.length; i++) maskNames.push(ROMTilemapView.TileMasks[maskKeys[i]].name);
        if (!maskKeys.includes(this.tileMask)) this.tileMask = ROMTilemapView.TileMasks.none;
        var onChangeMask = function(mask) {
            self.tileMask = maskKeys[mask];
            self.redraw();
        };
        var maskSelected = function(mask) { return self.tileMask === maskKeys[mask]; };
        this.addList("showMask", "Mask", maskNames, onChangeMask, maskSelected);
    }

    // add a zoom control
    this.addZoom(this.zoom, function() { self.changeZoom(); }, 0, 4);

    this.updateToolbox();
    this.div.focus();
}

ROMTilemapView.prototype.hide = function() {
    this.observer.stopObservingAll();
    this.graphicsView.hide();
}

ROMTilemapView.prototype.changeZoom = function() {

    // update zoom
    var zoomControl = document.getElementById("zoom");
    var z = Number(zoomControl.value);
    this.zoom = Math.pow(2, z);
    var zoomValue = document.getElementById("zoom-value");
    zoomValue.innerHTML = (this.zoom * 100).toString() + "%";

    this.redraw();
}

ROMTilemapView.prototype.updateToolbox = function() {
    var toolboxDiv = document.getElementById("toolbox-div");
    toolboxDiv.innerHTML = "";
    toolboxDiv.style.height = "auto";
    if (this.showGraphics) toolboxDiv.appendChild(this.graphicsView.div);
    if (this.showPalette) toolboxDiv.appendChild(this.paletteView.div);
}

ROMTilemapView.prototype.mouseDown = function(e) {

    this.closeList();

    this.clickPoint = {
        x: Math.floor(e.offsetX / this.zoom / this.tileWidth),
        y: Math.floor(e.offsetY / this.zoom / this.tileHeight),
        button: e.button
    };
    this.mousePoint = {
        x: this.clickPoint.x,
        y: this.clickPoint.y
    }

    if (this.clickPoint.button === 2) {
        this.selection.x = this.clickPoint.x;
        this.selection.y = this.clickPoint.y;
        this.selectTiles();
        this.isDragging = true;
    } else {
        this.setTiles();
        this.isDragging = true;
    }

    this.drawCursor();

    // this doesn't work properly for e.g. ff4 battle backgrounds
    // // select the tilemap object
    // if (this.object) {
    //     propertyList.select(this.object);
    // }
}

ROMTilemapView.prototype.mouseMove = function(e) {

    var col = Math.floor(e.offsetX / this.zoom / this.tileWidth);
    col = Math.min(Math.max(0, col), this.width - 1);
    var row = Math.floor(e.offsetY / this.zoom / this.tileHeight);
    row = Math.min(Math.max(0, row), this.height - 1);

    // update the displayed coordinates
    var coordinates = document.getElementById("coordinates");
    coordinates.innerHTML = "(" + col + ", " + row + ")";

    // return if the cursor position didn't change
    if (this.mousePoint.x === col && this.mousePoint.y === row) return;

    this.mousePoint = {
        x: col,
        y: row
    };

    // update the selection position
    this.selection.x = col;
    this.selection.y = row;

    if (this.isDragging && this.clickPoint) {
        if (this.clickPoint.button === 0) this.setTiles();
        if (this.clickPoint.button === 2) this.selectTiles();
    }

    // update the cursor
    this.drawCursor();
}

ROMTilemapView.prototype.mouseUp = function(e) {
    if (this.isDragging) {
        this.setTilemap();
    }

    this.isDragging = false;
    this.clickPoint = null;
    this.mouseMove(e);
}

ROMTilemapView.prototype.mouseEnter = function(e) {

    // show the cursor
    this.showCursor = true;
    this.drawCursor();
    this.mouseUp(e);
}

ROMTilemapView.prototype.mouseLeave = function(e) {

    // hide the cursor
    this.showCursor = false;
    this.drawCursor();
    this.mouseUp(e);
}

ROMTilemapView.prototype.setTiles = function() {

    var col = this.selection.x;
    var row = this.selection.y;
    var cols = this.selection.w;
    var rows = this.selection.h;

    var l = (col * this.tileWidth);
    var r = l + (cols * this.tileWidth);
    var t = (row * this.tileHeight);
    var b = t + (rows * this.tileHeight);
    var rect = new Rect(l, r, t, b);

    var x = col;
    var y = row;
    var w = cols;
    var h = rows;

    x = x % this.width;
    y = y % this.height;
    var clippedW = Math.min(w, this.width - x);
    var clippedH = Math.min(h, this.height - y);

    for (var row = 0; row < clippedH; row++) {
        var ls = row * w;
        var ld = x + (y + row) * this.width;
        if (ld + clippedW > this.tilemap.length) break;
        for (var col = 0; col < clippedW; col++) {
            if (this.selection.tilemap[ls + col] === 0xFFFFFFFF) continue;
            this.tilemap[ld + col] = this.selection.tilemap[ls + col];
        }
    }

    this.redraw();
}

ROMTilemapView.prototype.selectTiles = function() {

    var col = this.selection.x;
    var row = this.selection.y;
    var cols = Math.abs(col - this.clickPoint.x) + 1;
    var rows = Math.abs(row - this.clickPoint.y) + 1;
    col = Math.min(col, this.clickPoint.x);
    row = Math.min(row, this.clickPoint.y);

    // limit the selection rectangle to the size of the layer
    var clippedCol = col % this.width;
    var clippedRow = row % this.height;
    cols = Math.min(cols, this.width - clippedCol);
    rows = Math.min(rows, this.height - clippedRow);

    // create the tile selection
    this.selection.x = col;
    this.selection.y = row;
    this.selection.w = cols;
    this.selection.h = rows;
    this.selection.tilemap = new Uint32Array(cols * rows);

    for (var y = 0; y < rows; y++) {
        var begin = col + (row + y) * this.width;
        var end = begin + cols;
        var line = this.tilemap.subarray(begin, end);
        this.selection.tilemap.set(line, y * cols);
    }

    if (this.selection.tilemap.length === 1) {
        // select tile in graphics and palette views
        var tile = this.selection.tilemap[0];
        var p = (tile & 0x00FF0000) >> 16;
        this.paletteView.p = Math.round(p / this.paletteView.colorsPerPalette);
        this.paletteView.redraw();

        this.graphicsView.selectTile(tile);
    } else {
        // clear the graphics view selection
        this.graphicsView.selection = {
            x: 0, y: 0, w: 0, h: 0,
            tilemap: new Uint32Array(0)
        };
        this.graphicsView.redraw();
    }
}

ROMTilemapView.prototype.selectPalette = function(p) {
    p <<= 16;
    for (var t = 0; t < this.selection.tilemap.length; t++) {
        this.selection.tilemap[t] &= 0xFF00FFFF;
        this.selection.tilemap[t] |= p;
    }
}

ROMTilemapView.prototype.toggleSelectionVFlip = function() {

    var w = this.selection.w;
    var h = this.selection.h;

    var tilemap = new Uint32Array(this.selection.tilemap);

    for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
            this.selection.tilemap[x + y * w] = tilemap[x + (h - y - 1) * w] ^ 0x20000000;
        }
    }
}

ROMTilemapView.prototype.toggleSelectionHFlip = function() {

    var w = this.selection.w;
    var h = this.selection.h;

    var tilemap = new Uint32Array(this.selection.tilemap);

    for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
            this.selection.tilemap[x + y * w] = tilemap[(w - x - 1) + y * w] ^ 0x10000000;
        }
    }
}

ROMTilemapView.prototype.setSelectionZ = function(z) {

    var w = this.selection.w;
    var h = this.selection.h;

    var tilemap = new Uint32Array(this.selection.tilemap);

    for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
            var tile = this.selection.tilemap[x + y * w];
            tile &= 0xF0FFFFFF;
            tile |= z << 24;
            this.selection.tilemap[x + y * w] = tile;
        }
    }
}

ROMTilemapView.prototype.loadTilemap = function() {

    // return if nothing selected
    if (!this.object) return;

    this.observer.stopObservingAll();
    this.observer.startObserving(this.object, this.loadTilemap);

    // update tile layout parameters
    this.width = this.object.width || 32;
    this.height = this.object.height || 32;
    this.backColor = this.object.backColor;

    // update graphics and palette
    this.graphicsView.loadDefinition(this.object.graphics);
    this.paletteView.loadDefinition(this.object.palette);
    this.paletteView.updateToolbox();
    this.graphicsView.updateToolbox();

    this.graphicsView.updateTilemap();
    this.graphicsView.redraw();
    this.paletteView.redraw();

    // use the tile size from the graphics view
    this.tileWidth = this.graphicsView.tileWidth;
    this.tileHeight = this.graphicsView.tileHeight;

    // copy the tilemap
    this.tilemap = new Uint32Array(this.height * this.width);
    if (this.object.data) {
        this.tilemap.set(this.object.data.subarray(0, this.tilemap.length));
    }

    // load data from definition
    this.loadTileOffset(this.object.tileOffset);
    this.loadColorOffset(this.object.colorOffset);
    this.loadFlip(this.object.vFlip, true);
    this.loadFlip(this.object.hFlip, false);

    this.redraw();
}

ROMTilemapView.prototype.setTilemap = function() {

    // return if nothing selected
    if (!this.object) return;

    // make a copy of the current tiles
    var newData = this.tilemap.slice(0, this.object.data.length);

    this.rom.beginAction();
    // this.rom.doAction(new ROMAction(this.observer, this.observer.wake, this.observer.sleep));
    // this.rom.pushAction(new ROMAction(this, this.loadTilemap, null));
    this.observer.sleep();

    // copy the tilemap and extract tile offset, color offset, v/h-flip
    this.setTileOffset(this.object.tileOffset, newData);
    this.setColorOffset(this.object.colorOffset, newData);
    this.setFlip(this.object.vFlip, true, newData);
    this.setFlip(this.object.hFlip, false, newData);

    // set tilemap object data
    this.object.setData(newData);

    // this.rom.pushAction(new ROMAction(this, null, this.loadTilemap));
    // this.rom.doAction(new ROMAction(this.observer, this.observer.sleep, this.observer.wake));
    this.observer.wake();
    this.rom.endAction();
}

ROMTilemapView.prototype.redraw = function() {
    this.drawTilemap();
    this.drawMask();
    this.drawCursor();
}

ROMTilemapView.prototype.drawTilemap = function() {

    var ppu = new GFX.PPU();

    // create the palette
    var palette = new Uint32Array(this.paletteView.palette);
    if (this.backColor) {
        // use first palette color as back color
        palette[0] = this.paletteView.palette[0];
        ppu.back = true;
    } else {
        // transparent background
        palette[0] = 0;
        ppu.back = false;
    }

    // set up the ppu
    ppu.pal = this.rom.gammaCorrectedPalette(palette);
    ppu.width = this.width * this.tileWidth;
    ppu.height = this.height * this.tileHeight;

    // layer 1
    ppu.layers[0].format = null;
    ppu.layers[0].cols = this.width;
    ppu.layers[0].rows = this.height;
    ppu.layers[0].z[0] = GFX.Z.top;
    ppu.layers[0].z[1] = GFX.Z.top;
    ppu.layers[0].z[2] = GFX.Z.top;
    ppu.layers[0].z[3] = GFX.Z.top;
    ppu.layers[0].gfx = this.graphicsView.graphics;
    ppu.layers[0].tiles = this.tilemap;
    ppu.layers[0].tileWidth = this.tileWidth;
    ppu.layers[0].tileHeight = this.tileHeight;
    ppu.layers[0].main = true;

    // draw tilemap image
    this.layoutCanvas.width = ppu.width;
    this.layoutCanvas.height = ppu.height;
    var context = this.layoutCanvas.getContext('2d');
    imageData = context.createImageData(ppu.width, ppu.height);
    ppu.renderPPU(imageData.data, 0, 0, ppu.width, ppu.height);
    context.putImageData(imageData, 0, 0);

    // scale image to zoom setting
    this.canvas.width = ppu.width * this.zoom;
    this.canvas.height = ppu.height * this.zoom;
    context = this.canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.webkitImageSmoothingEnabled = false;
    context.drawImage(this.layoutCanvas,
        0, 0, this.layoutCanvas.width, this.layoutCanvas.height,
        0, 0, this.canvas.width, this.canvas.height);
}

ROMTilemapView.prototype.drawMask = function() {

    if (this.tileMask === ROMTilemapView.TileMasks.none.key) return;

    var ctx = this.canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';

    // draw the mask at each tile
    var width = this.tileWidth * this.zoom;
    var height = this.tileHeight * this.zoom;
    for (var y = 0; y < this.height; y++) {
        for (var x = 0; x < this.width; x++) {

            var t = x + y * this.width;
            var color = this.maskColorAtTile(t);
            if (!color) continue;
            ctx.fillStyle = color;

            var left = x * this.tileWidth * this.zoom;
            var top = y * this.tileHeight * this.zoom;

            ctx.fillRect(left, top, width, height);
        }
    }
}

ROMTilemapView.prototype.maskColorAtTile = function(t) {
    var tile = this.tilemap[t];
    if (this.tileMask === ROMTilemapView.TileMasks.vFlip.key) {
        if (tile & 0x20000000) return "rgba(255,255,0,0.5)";
    } else if (this.tileMask === ROMTilemapView.TileMasks.hFlip.key) {
        if (tile & 0x10000000) return "rgba(255,255,0,0.5)";
    } else if (this.tileMask === ROMTilemapView.TileMasks.zLevel.key) {
        var z = (tile >> 24) & 0x0F;
        if (z === 0) return "rgba(0,255,0,0.5)";
        if (z === 1) return "rgba(0,0,255,0.5)";
    }
    return null;
}

ROMTilemapView.prototype.drawCursor = function() {
    this.cursorCanvas.style.display = "none";
    if (!this.showCursor) return;

    var col = this.selection.x;
    var row = this.selection.y;

    // get the cursor geometry and color
    var x = col * this.tileWidth * this.zoom;
    var y = row * this.tileHeight * this.zoom;
    var w = this.selection.w * this.tileWidth * this.zoom;
    var h = this.selection.h * this.tileHeight * this.zoom;

    // draw the cursor
    w = Math.min(this.width * this.tileWidth * this.zoom - x, w);
    h = Math.min(this.height * this.tileHeight * this.zoom - y, h);
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
    ctx.strokeStyle = "hsl(210, 100%, 50%)";
    ctx.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    ctx.strokeStyle = "white";
    ctx.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    ctx.strokeStyle = "black";
    ctx.strokeRect(x, y, w, h);
}

ROMTilemapView.prototype.loadTileOffset = function(definition) {
    if (!definition) return;

    // recursively load array definitions
    if (isArray(definition)) {
        for (var i = 0; i < definition.length; i++) this.loadTileOffset(definition[i]);
        return;
    }

    var r = this.parseDefinition(definition);

    if (r.object) this.observer.startObserving(r.object, this.loadTilemap);

    if (isNumber(r.value)) {
        for (var t = r.offset; t < this.tilemap.length; t++) {
            var tile = this.tilemap[t] & 0x0000FFFF;
            tile += r.value * r.multiplier;
            this.tilemap[t] &= 0xFFFF0000;
            this.tilemap[t] |= (tile & 0x0000FFFF);
        }

    } else if (r.data) {
        for (var t = r.offset; t < this.tilemap.length; t++) {
            var tile = this.tilemap[t] & 0x0000FFFF;
            tile += r.data[t] * r.multiplier;
            this.tilemap[t] &= 0xFFFF0000;
            this.tilemap[t] |= (tile & 0x0000FFFF);
        }
    } else if (r.object instanceof  ROMArray) {
        for (var t = r.offset; t < this.tilemap.length; t++) {
            var tile = this.tilemap[t] & 0x0000FFFF;
            var arrayElement = r.object.item(t);
            if (!arrayElement) continue;
            var value = arrayElement[r.key].value;
            tile += value;
            this.tilemap[t] &= 0xFFFF0000;
            this.tilemap[t] |= (tile & 0x0000FFFF);
        }
    }
}

ROMTilemapView.prototype.setTileOffset = function(definition, tilemap) {
    if (!definition) return;

    // recursively load array definitions
    if (isArray(definition)) {
        for (var i = 0; i < definition.length; i++) this.setTileOffset(tilemap, definition[i]);
        return;
    }

    var r = this.parseDefinition(definition);

    // subtract out the tile offset
    if (isNumber(r.value)) {
        for (var t = r.offset; t < tilemap.length; t++) {
            var tile = tilemap[t];
            tile &= 0xFFFF;
            tile -= r.value * r.multiplier;
            if (tile < 0) tile = 0;
            tilemap[t] &= 0xFFFF0000;
            tilemap[t] |= tile;
        }

    } else if (r.data) {
        for (var t = r.offset; t < tilemap.length; t++) {
            var tile = tilemap[t];
            tile &= 0xFFFF;
            tile -= r.data[t] * r.multiplier;
            if (tile < 0) tile = 0;
            tilemap[t] &= 0xFFFF0000;
            tilemap[t] |= tile;
        }
    } else if (r.object instanceof  ROMArray) {
        for (var t = r.offset; t < tilemap.length; t++) {
            var arrayElement = r.object.item(t);
            if (!arrayElement) continue;
            var value = arrayElement[r.key].value;
            var tile = tilemap[t];
            tile &= 0xFFFF;
            tile -= value;
            if (tile < 0) tile = 0;
            tilemap[t] &= 0xFFFF0000;
            tilemap[t] |= tile;
        }
    }
}

ROMTilemapView.prototype.loadColorOffset = function(definition) {
    if (!definition) return;

    // recursively load array definitions
    if (isArray(definition)) {
        for (var i = 0; i < definition.length; i++) this.loadColorOffset(definition[i]);
        return;
    }

    var r = this.parseDefinition(definition);

    if (r.object) this.observer.startObserving(r.object, this.loadTilemap);

    if (isNumber(r.value)) {
        for (var t = r.offset; t < this.tilemap.length; t++) {
            var tile = this.tilemap[t];
            var p = tile & 0x00FF0000;
            p += (r.value * r.multiplier) << 16;
            tile &= 0xFF00FFFF;
            tile |= p & 0x00FF0000;
            this.tilemap[t] = tile;
        }

    } else if (r.data) {
        for (var t = r.offset; t < this.tilemap.length; t++) {
            var tile = this.tilemap[t];
            var p = tile & 0x00FF0000;
            var d = r.perTile ? (tile & 0x0000FFFF) : t;
            p += (r.data[d] * r.multiplier) << 16;
            tile &= 0xFF00FFFF;
            tile |= p & 0x00FF0000;
            this.tilemap[t] = tile;
        }
    } else if (r.object instanceof ROMArray) {
        for (var t = r.offset; t < this.tilemap.length; t++) {
            var tile = this.tilemap[t];
            var p = tile & 0x00FF0000;
            var d = r.perTile ? (tile & 0x0000FFFF) : t;
            var arrayElement = r.object.item(d);
            if (!arrayElement) continue;
            var value = arrayElement[r.key].value;
            p += value << 16;
            tile &= 0xFF00FFFF;
            tile |= p & 0x00FF0000;
            this.tilemap[t] = tile;
        }
    }
}

ROMTilemapView.prototype.setColorOffset = function(definition, tilemap) {
    if (!definition) return;

    // recursively load array definitions
    if (isArray(definition)) {
        for (var i = 0; i < definition.length; i++) this.loadColorOffset(definition[i]);
        return;
    }

    var r = this.parseDefinition(definition);

    if (isNumber(r.value)) {
        for (var t = r.offset; t < tilemap.length; t++) {
            var tile = tilemap[t];
            tile &= 0x00FF0000;
            tile -= (r.value * r.multiplier) << 16;
            if (tile < 0) tile = 0;
            tilemap[t] &= 0xFF00FFFF;
            tilemap[t] |= tile;
        }

    } else if (r.data) {
        var data = r.data.slice();
        for (var t = r.offset; t < tilemap.length; t++) {
            var tile = tilemap[t];
            var p = tile & 0x00FF0000;
            if (r.perTile) {
                var d = tile & 0x0000FFFF;
                p -= (r.data[d] * r.multiplier) << 16;
                if (p < 0) p = 0;
                tilemap[t] &= 0xFF00FFFF;
                tilemap[t] |= p;
            } else {
                data[t] = (p >> 16) / r.multiplier;
                p = 0;
                tilemap[t] &= 0xFF00FFFF;
            }
            tilemap[t] |= p;
        }
        r.object.setData(data);

    } else if (r.object instanceof  ROMArray) {
        for (var t = r.offset; t < tilemap.length; t++) {
            var tile = tilemap[t];
            var d = r.perTile ? (tile & 0x0000FFFF) : t;
            var arrayElement = r.object.item(d);
            if (!arrayElement) continue;
            var value = arrayElement[r.key].value;
            tile &= 0x00FF0000;
            tile -= value << 16;
            if (tile < 0) tile = 0;
            tilemap[t] &= 0xFF00FFFF;
            tilemap[t] |= tile;
        }
    }
}

ROMTilemapView.prototype.loadFlip = function(definition, v) {
    if (!definition) return;

    // recursively load array definitions
    if (isArray(definition)) {
        for (var i = 0; i < definition.length; i++) this.loadFlip(definition[i], v);
        return;
    }

    var r = this.parseDefinition(definition);

    if (r.object) this.observer.startObserving(r.object, this.loadTilemap);

    var mask = v ? 0x20000000 : 0x10000000;
    if (isNumber(r.value)) {
        for (var t = r.offset; t < this.tilemap.length; t++) {
            r.value ? (this.tilemap[t] |= mask) : (this.tilemap[t] &= ~mask);
        }

    } else if (r.data) {
        for (var t = r.offset; t < this.tilemap.length; t++) {
            r.data[t] ? (this.tilemap[t] |= mask) : (this.tilemap[t] &= ~mask);
        }
    }
}

ROMTilemapView.prototype.setFlip = function(definition, v, tilemap) {
    if (!definition) return;

    // recursively load array definitions
    if (isArray(definition)) {
        for (var i = 0; i < definition.length; i++) this.loadColorOffset(definition[i]);
        return;
    }

    var r = this.parseDefinition(definition);

    var mask = v ? 0x20000000 : 0x10000000;

    if (r.data) {
        var data = r.data.slice();
        for (var t = r.offset; t < tilemap.length; t++) {
            data[t] = (tilemap[t] & mask) ? 1 : 0;
            tilemap[t] &= ~mask;
        }
        r.object.setData(data);
    }

    // // recursively load array definitions
    // if (isArray(definition)) {
    //     for (var i = 0; i < definition.length; i++) this.loadFlip(definition[i], vh);
    //     return;
    // }
    //
    // var r = this.parseDefinition(definition);
    //
    // if (r.data) {
    //     var newData = r.object.data.slice(r.range.begin, r.range.end);
    //     for (var t = r.offset; t < tilemap.length; t++) {
    //         var tile = tilemap[t];
    //         newData[t] = tile[vh] ? 1 : 0;
    //     }
    //     r.object.setData(newData, r.range.begin, r.range.end);
    // }
}

ROMTilemapView.prototype.observeDefinitionObject = function(definition, callback) {
    if (!definition) return;

    // recursively load array definitions
    if (isArray(definition)) {
        for (var i = 0; i < definition.length; i++) this.observeDefinitionObject(definition[i], callback);
        return;
    }

    var r = this.parseDefinition(definition);
    if (r.object && r.object.addObserver) this.observer.startObserving(r.object, callback);
}

ROMTilemapView.prototype.parseDefinition = function(definition) {

    var r = {};
    if (!definition) return r;

    // parse constant value
    var num = Number(definition);
    if (isNumber(num)) {
        r.offset = 0;
        r.multiplier = 1;
        r.value = num;
        return r;
    }

    // parse object
    var object;
    if (isString(definition)) {
        r.object = this.rom.parsePath(definition, this.rom, this.object.i);
    } else if (isString(definition.path)) {
        r.object = this.rom.parsePath(definition.path, this.rom, this.object.i);
    }

    // parse offset
    r.offset = Number(definition.offset) || 0;

    // parse multiplier
    r.multiplier = Number(definition.multiplier) || 1;

    // values are per graphics tile or per layout tile
    r.perTile = definition.perTile;

    if (r.object instanceof ROMProperty) {
        // parse object value
        r.value = r.object.value;

    } else if (r.object instanceof ROMArray) {
        // parse array
        r.key = definition.key;

    } else if (r.object && r.object.data) {
        // parse object data
        r.data = r.object.data;

        // parse data range
        if (definition.range) {
            r.range = ROMRange.parse(definition.range);
            r.data = r.data.subarray(r.range.begin, r.range.end);
        } else {
            r.range = new ROMRange(0, r.data.length);
        }
    }

    return r;
}

ROMTilemapView.prototype.exportTilemap = function() {
    // create an indexed png file from the tilemap
    ppu = new GFX.PPU();

    // create the palette
    var palette = new Uint32Array(this.paletteView.palette);
    if (this.backColor) {
        // use first palette color as back color
        palette[0] = this.paletteView.palette[0];
        ppu.back = true;
    } else {
        // transparent background
        palette[0] = 0;
        ppu.back = false;
    }

    // set up the ppu
    ppu.pal = this.rom.gammaCorrectedPalette(palette);
    ppu.width = this.width * this.tileWidth;
    ppu.height = this.height * this.tileHeight;

    // layer 1
    ppu.layers[0].format = null;
    ppu.layers[0].cols = this.width;
    ppu.layers[0].rows = this.height;
    ppu.layers[0].z[0] = GFX.Z.top;
    ppu.layers[0].z[1] = GFX.Z.top;
    ppu.layers[0].z[2] = GFX.Z.top;
    ppu.layers[0].z[3] = GFX.Z.top;
    ppu.layers[0].gfx = this.graphicsView.graphics;
    ppu.layers[0].tiles = this.tilemap;
    ppu.layers[0].tileWidth = this.tileWidth;
    ppu.layers[0].tileHeight = this.tileHeight;
    ppu.layers[0].main = true;

    var image = ppu.createPNG(0, 0, this.width * this.tileWidth, this.height * this.tileHeight);
    var blob = new Blob([image.buffer]);
    url = window.URL.createObjectURL(blob);

    var a = document.createElement("a");
    a.style = "display: none";
    document.body.appendChild(a);

    a.href = url;
    a.download = 'image.png';
    a.click();

    // release the reference to the file by revoking the Object URL
    window.URL.revokeObjectURL(url);
}

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
    a.download = 'image.' + extension;
    a.click();

    // release the reference to the file by revoking the Object URL
    window.URL.revokeObjectURL(url);
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
        var blob = new Blob([this.data], { type: 'image/' + formatKey });
        var url = URL.createObjectURL(blob);
        var img = new Image();
        img.decode = "sync"; // load synchronously
        img.src = url;
        img.onload = function() {
            URL.revokeObjectURL(blob);
            importer.quantizeImage(img);
            importer.resize();
            importer.validateSelection();
            importer.copySpriteSheet();
            importer.copyPalette();
            importer.drawImportPreview();
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
        }

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
            if (offset >= this.graphicsRight.graphics.length) break;
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

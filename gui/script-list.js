//
// script-list.js
// created 2/9/2021
//

class ROMScriptList {
    constructor(rom) {
        this.rom = rom;
        this.scriptList = document.getElementById('script-list');
        this.scriptList.innerHTML = '';
        this.container = this.scriptList.parentElement;
        this.script = null;
        this.selection = []; // selected commands
        this.node = []; // command nodes by ref

        this.blockSize = 50; // number of commands per block
        this.blockStart = 0; // starting location of first block
        this.numBlocks = 3; // number of blocks visible at one time
        this.rowHeight = 17;

        this.observer = new ROMObserver(rom, this);

        const self = this;
        this.scriptList.parentElement.onscroll = function() { self.scroll(); };
        this.menu = null;
        this.scriptList.parentElement.oncontextmenu = function(e) {
            self.openContextMenu(e);
            return false;
        };

        const insertButton = document.getElementById('script-insert');
        insertButton.onclick = function(e) { self.openInsertMenu(e); };
    }

    scroll() {
        if (!this.script) return;
        this.closeMenu();

        const topSpace = this.scriptList.firstChild;
        const bottomSpace = this.scriptList.lastChild;
        if (!topSpace || !bottomSpace) return;

        if (this.container.scrollTop < topSpace.offsetHeight) {
            // scrolled off the top
            var index = Math.floor(this.blockStart - (topSpace.offsetHeight - this.container.scrollTop) / this.rowHeight);

            // save the scroll position for the top command
            var topCommand = this.script.command[this.blockStart];
            var commandNode, oldOffset, newOffset;
            if (topCommand) commandNode = this.node[topCommand.ref];
            if (commandNode) oldOffset = commandNode.offsetTop;

            // change blockStart so that the previous blocks are visible
            index = index - index % this.blockSize - this.blockSize * (this.numBlocks - 2);
            this.blockStart = Math.max(index, 0);
            this.update();

            // recalculate the scroll position so that the first command stays in the same spot
            if (topCommand) commandNode = this.node[topCommand.ref];
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
            var commandNode, oldOffset, newOffset;
            if (bottomCommand) commandNode = this.node[bottomCommand.ref];
            if (commandNode) oldOffset = commandNode.offsetTop;

            // change blockStart so that the next blocks are visible
            index = index - index % this.blockSize + this.blockSize * (this.numBlocks - 2);
            var maxStart = this.script.command.length - this.blockSize * this.numBlocks;
            maxStart = Math.max(maxStart + this.blockSize - (maxStart % this.blockSize), 0);
            this.blockStart = Math.min(index, maxStart);
            this.update();

            // recalculate the scroll position so that the first command stays in the same spot
            if (bottomCommand) commandNode = this.node[bottomCommand.ref];
            if (commandNode && oldOffset) {
                newOffset = commandNode.offsetTop;
                this.scriptList.parentElement.scrollTop += newOffset - oldOffset;
            }
        }
    }

    selectScript(script) {
        document.getElementById('edit-bottom').classList.remove('hidden');

        if (this.script === script) return;
        this.deselectAll();
        this.script = script;

        // populate the list
        this.blockStart = 0;
        this.update();
    }

    selectCommands(selection) {
        for (const command of selection) {
            this.selectCommand(command);
        }
    }

    selectRef(ref) {
        const command = this.script.ref[ref];
        if (command) this.selectCommand(command);
    }

    selectCommand(command) {

        this.closeMenu();

        // return if no command, or if command is already selected
        if (!command || this.selection.includes(command)) return;

        // add the command to the selection and sort
        this.selection.push(command);
        this.selection.sort(function(a, b) {
            return a.i - b.i;
        });

        if (!this.node[command.ref]) {
            // node is not in the current block
            const index = this.script.command.indexOf(command);
            this.blockStart = Math.max(index - index % this.blockSize - this.blockSize, 0);
            this.update();
        }

        const node = this.node[command.ref];
        if (!node) return;
        node.classList.add('selected');

        // center the node in the list
        const nodeTop = node.offsetTop - this.container.offsetTop;
        const nodeBottom = nodeTop + node.offsetHeight;
        if ((this.scriptList.parentElement.scrollTop > nodeTop) ||
        ((this.scriptList.parentElement.scrollTop + this.container.offsetHeight) < nodeBottom)) {
            const offset = Math.floor(this.container.offsetHeight - node.offsetHeight);
            this.scriptList.parentElement.scrollTop = nodeTop - offset / 2;
        }
    }

    deselectCommand(command) {
        const i = this.selection.indexOf(command);
        if (i === -1) return;
        var node = this.node[command.ref];
        if (!node) return;
        node.classList.remove('selected');
        this.selection.splice(i, 1);
    }

    deselectAll() {
        for (var c = 0; c < this.selection.length; c++) {
            var command = this.selection[c];
            if (!command) continue;
            var node = this.node[command.ref];
            if (!node) continue;
            node.classList.remove('selected');
        }
        this.selection = [];
    }

    insert(identifier) {
        if (!this.script) return;

        this.closeMenu();

        const command = this.script.blankCommand(identifier);

        const firstCommand = this.selection[0];
        const lastCommand = this.selection[this.selection.length - 1];
        const end = this.script.command.indexOf(lastCommand);
        // if (end === this.script.command.length - 1) return;
        const nextCommand = this.script.command[end + 1];
        let ref = null;
        if (nextCommand) ref = nextCommand.ref;

        const script = this.script;
        this.rom.beginAction();
        this.rom.pushAction(new ROMAction(this, function() {
            this.selectScript(script);
            this.script.updateOffsets();
            this.deselectAll();
            if (lastCommand) {
                this.selectCommand(lastCommand);
                propertyList.select(lastCommand);
            }
            this.update();
        }, null, 'Update Script'));
        this.script.insertCommand(command, ref);
        this.rom.doAction(new ROMAction(this, null, function() {
            this.selectScript(script);
            this.script.updateOffsets();
            this.deselectAll();
            this.selectCommand(command);
            propertyList.select(command);
            this.update();
        }, 'Update Script'));
        this.rom.endAction();
    }

    delete() {
        // return if nothing is selected
        if (!this.script) return;
        if (this.selection.length === 0) return;
        this.closeMenu();

        const selection = this.selection.slice();
        const firstCommand = selection[0];
        const i = this.script.command.indexOf(firstCommand);

        this.rom.beginAction();
        this.rom.pushAction(new ROMAction(this, function() {
            this.script.updateOffsets();
            this.deselectAll();
            this.selectCommands(selection);
            propertyList.select(firstCommand);
            this.update();
        }, null, 'Update Script'));

        // remove the selected commands
        for (const command of selection) {
            this.script.removeCommand(command);
        }

        const script = this.script;
        this.rom.doAction(new ROMAction(this, null, function() {
            this.selectScript(script);
            this.script.updateOffsets();
            this.deselectAll();
            // deselect in property list if current selection was deleted
            if (selection.includes(propertyList.selection.current)) {
                propertyList.select(null);
            }
            this.update();
        }, 'Update Script'));
        this.rom.endAction();
    }

    moveUp() {
        // return if nothing is selected
        if (!this.script) return;
        if (this.selection.length === 0) return;

        // get the first selected command and the command before it
        const firstCommand = this.selection[0];
        const start = this.script.command.indexOf(firstCommand);
        if (start === 0) return;
        const previousCommand = this.script.command[start - 1];
        if (!previousCommand) return;

        // get the last selected command and the command after it
        const lastCommand = this.selection[this.selection.length - 1];
        const end = this.script.command.indexOf(lastCommand);
        const nextCommand = this.script.command[end + 1];
        let nextRef = null;
        if (nextCommand) nextRef = nextCommand.ref;

        const selection = this.selection.slice();
        const script = this.script;
        function updateScript() {
            this.selectScript(script);
            this.script.updateOffsets();
            this.deselectAll();
            this.selectCommands(selection);
            this.update();
        }

        this.rom.beginAction();
        this.rom.pushAction(new ROMAction(this, updateScript, null, 'Update Script'));
        this.script.removeCommand(previousCommand);
        this.script.insertCommand(previousCommand, nextRef);
        this.rom.doAction(new ROMAction(this, null, updateScript, 'Update Script'));
        this.rom.endAction();
    }

    moveDown() {
        // return if nothing is selected
        if (!this.script) return;
        if (this.selection.length === 0) return;

        // get the first selected command
        const firstCommand = this.selection[0];
        const start = this.script.command.indexOf(firstCommand);

        // get the last selected command and the command after it
        const lastCommand = this.selection[this.selection.length - 1];
        const end = this.script.command.indexOf(lastCommand);
        if (end === this.script.command.length - 1) return;
        const nextCommand = this.script.command[end + 1];
        if (!nextCommand) return;

        const selection = this.selection.slice();
        const script = this.script;
        function updateScript() {
            this.selectScript(script);
            this.script.updateOffsets();
            this.deselectAll();
            this.selectCommands(selection);
            this.update();
        }

        this.rom.beginAction();
        this.rom.pushAction(new ROMAction(this, updateScript, null, 'Update Script'));
        this.script.removeCommand(nextCommand);
        this.script.insertCommand(nextCommand, firstCommand.ref);
        this.rom.doAction(new ROMAction(this, null, updateScript, 'Update Script'));
        this.rom.endAction();
    }

    cut() {
        this.copy();
        this.delete();
    }

    copy() {
        // return if nothing is selected
        if (!this.script) return;
        if (this.selection.length === 0) return;

        const yaml = [];
        for (const command of this.selection) {
            if (!command.serialize) continue;
            yaml.push(command.serialize());
        }
        const text = jsyaml.safeDump(yaml, {
            indent: 4,
            skipInvalid: true
        });
        this.rom.clipboard = text;
        if (!navigator.permissions) return;
        navigator.permissions.query({name: "clipboard-write"}).then(function(result) {
            if (result.state == "granted" || result.state == "prompt") {
                navigator.clipboard.writeText(text);
            }
        });
    }

    paste() {
        if (!this.script) return;

        if (!navigator.permissions) {
            if (isString(this.rom.clipboard)) {
                this.pasteYAML(this.rom.clipboard);
            }
            return;
        }

        const self = this;
        navigator.permissions.query({name: "clipboard-read"}).then(function(result) {
            if (result.state == "granted" || result.state == "prompt") {
                navigator.clipboard.readText().then(function(text) {
                    self.pasteYAML(text);
                });
            } else if (isString(self.rom.clipboard)) {
                self.pasteYAML(self.rom.clipboard);
            }
        });
    }

    pasteYAML(text) {

        let yamlArray = jsyaml.safeLoad(text);
        if (!yamlArray) return;
        if (!isArray(yamlArray)) yamlArray = [yamlArray];
        if (!yamlArray.length) return;

        const lastCommand = this.selection[this.selection.length - 1];
        const end = this.script.command.indexOf(lastCommand);
        const nextCommand = this.script.command[end + 1];
        let ref = null;
        if (nextCommand) ref = nextCommand.ref;

        this.rom.beginAction();
        const newCommands = [];
        for (const yaml of yamlArray) {
            const identifier = `${yaml.encoding}.${yaml.key}`;
            const command = this.script.blankCommand(identifier);
            if (!command) continue;
            command.deserialize(yaml);
            newCommands.push(command);
        }

        const script = this.script;
        const selection = this.selection;
        this.rom.pushAction(new ROMAction(this, function() {
            this.selectScript(script);
            this.script.updateOffsets();
            this.deselectAll();
            for (const command of selection) {
                this.selectCommand(command);
            }
            if (newCommands.includes(propertyList.selection.current)) {
                propertyList.select(null);
            }
            this.update();
        }, null, 'Update Script'));
        for (const command of newCommands) {
            this.script.insertCommand(command, ref);
        }
        this.rom.doAction(new ROMAction(this, null, function() {
            this.selectScript(script);
            this.script.updateOffsets();
            this.deselectAll();
            for (const command of newCommands) {
                this.selectCommand(command);
            }
            propertyList.select(newCommands[0]);
            this.update();
        }, 'Update Script'));
        this.rom.endAction();
    }

    update() {

        if (!this.script) return;

        // recalculate top and bottom spacers

        // create a dummy li to determine the row height
        var dummy = document.createElement('li');
        dummy.innerHTML = 'Dummy'
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
        this.scriptList.innerHTML = '';

        // create top space
        var topSpace = document.createElement('div');
        topSpace.className = 'script-spacer';
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
            self.observer.startObservingSub(command, self.update);
        });

        // create bottom space
        var bottomSpace = document.createElement('div');
        bottomSpace.className = 'script-spacer';
        this.scriptList.appendChild(bottomSpace);

        // set top space height
        topSpace.style.height = `${blockTop}px`;
        bottomSpace.style.height = `${Math.max(totalHeight - blockBottom, 0)}px`;

        // highlight selected commands
        for (var c = 0; c < this.selection.length; c++) {
            var command = this.selection[c];
            var node = this.node[command.ref];
            if (!node) continue;
            node.className = 'selected';
        }
    }

    liForCommand(command) {
        const li = document.createElement('li');
        li.value = command.ref;
        const self = this;
        li.onclick = function(e) {
            const refCommand = self.script.ref[this.value];
            if (e.metaKey || e.ctrlKey) {

                if (self.selection.includes(refCommand)) {
                    // remove from selection
                    self.deselectCommand(refCommand);
                } else {
                    // append to selection
                    self.selectCommand(refCommand);
                    propertyList.select(refCommand);
                }

            } else if (e.shiftKey && self.selection.length) {
                // select a range of commands
                var firstCommand = self.selection[0];
                var lastCommand = self.selection[self.selection.length - 1];
                if (refCommand.i < firstCommand.i) {
                    self.selectCommands(self.script.command.slice(refCommand.i, firstCommand.i));
                } else if (command.i > lastCommand.i) {
                    self.selectCommands(self.script.command.slice(lastCommand.i + 1, refCommand.i + 1));
                } else {
                    self.selectCommand(refCommand);
                }
                propertyList.select(refCommand);

            } else {
                // select a single command
                self.deselectAll();
                self.selectCommand(refCommand);
                propertyList.select(refCommand);
            }
        };
        var span = document.createElement('span');
        span.classList.add('script-offset');
        if (command._label) span.classList.add('bold');
        span.innerHTML = command.label;
        li.appendChild(span);
        var p = document.createElement('p');
        p.innerHTML = command.description;
        li.appendChild(p);
        return li;
    }

    openContextMenu(e) {

        let refCommand = null;
        if (this.node.includes(e.target)) {
            refCommand = this.script.ref[e.target.value];
        } else if (this.node.includes(e.target.parentNode)) {
            refCommand = this.script.ref[e.target.parentNode.value];
        }

        if (refCommand) {
            propertyList.select(refCommand);
            if (!this.selection.includes(refCommand)) {
                this.deselectAll();
                this.selectCommand(refCommand);
            }
        }

        const self = this;
        this.menu = new ROMMenu();

        const liInsert = this.menu.createMenuItem(this.menu.topMenu, {
            name: 'Insert'
        });
        const ulInsert = this.menu.createSubMenu(liInsert);
        this.populateInsertMenu(ulInsert);

        this.menu.createMenuItem(this.menu.topMenu, {
            name: 'Delete',
            onclick: function() {
                self.delete();
                self.closeMenu();
            }
        });

        this.menu.createMenuItem(this.menu.topMenu, {
            name: 'Move Up',
            onclick: function() {
                self.moveUp();
                self.closeMenu();
            }
        });

        this.menu.createMenuItem(this.menu.topMenu, {
            name: 'Move Down',
            onclick: function() {
                self.moveDown();
                self.closeMenu();
            }
        });

        this.menu.createMenuItem(this.menu.topMenu, {
            name: 'Cut',
            onclick: function() {
                self.cut();
                self.closeMenu();
            }
        });

        this.menu.createMenuItem(this.menu.topMenu, {
            name: 'Copy',
            onclick: function() {
                self.copy();
                self.closeMenu();
            }
        });

        this.menu.createMenuItem(this.menu.topMenu, {
            name: 'Paste',
            onclick: function() {
                self.paste();
                self.closeMenu();
            }
        });

        this.menu.open(e.x, e.y);
    }

    openInsertMenu(e) {
        this.menu = new ROMMenu();

        this.populateInsertMenu(this.menu.topMenu);

        this.menu.open(e.x, e.y);
    }

    closeMenu() {
        if (this.menu) this.menu.close();
    }

    populateInsertMenu(menu) {
        // build the menu for the appropriate script commands
        if (isArray(this.script.encoding)) {
            // script has multiple encodings
            for (const key of this.script.encoding) {
                const encoding = this.rom.scriptEncoding[key];
                if (!encoding) continue;
                const li = this.menu.createMenuItem(menu, {
                    name: encoding.name
                });

                const ul = this.menu.createSubMenu(li);
                this.populateEncodingMenu(ul, encoding);
            }

        } else if (this.script.encoding) {
            // script has only one encoding
            const key = this.script.encoding;
            const encoding = this.rom.scriptEncoding[key];
            if (!encoding) return;
            this.populateEncodingMenu(menu, encoding);
        }
    }

    populateEncodingMenu(menu, encoding) {

        var hierarchy = {};
        var names = []; // list of names

        // go through all of the commands and pick out categories
        for (const key in encoding.command) {

            // only look at opcodes (encoding.command also contains keys)
            const opcode = Number(key);
            if (!isNumber(opcode)) continue;

            // get the command and its name
            const command = encoding.command[key];
            if (!command) continue;

            const name = command.name;
            const category = command.category;

            // skip commands with no name
            if (!name) continue;

            // skip if already included in names list
            if (names.includes(name)) continue;

            // add to list of names
            names.push(name);

            if (category) {
                // create a category if needed
                if (!hierarchy[category]) {
                    hierarchy[category] = {};
                }
                hierarchy[category][name] = command;
            } else {
                hierarchy[name] = command;
            }
        }

        this.populateCommandMenu(menu, hierarchy);
    }

    populateCommandMenu(menu, commands) {

        // sort alphabetically
        const keys = Object.keys(commands).sort();
        const self = this;
        for (const key of keys) {
            const command = commands[key];
            if (command.encoding) {
                // command
                this.menu.createMenuItem(menu, {
                    name: key,
                    value: `${command.encoding}.${command.key}`,
                    onclick: function() {
                        // here, "this" refers to the li
                        self.insert(this.getAttribute('data-value'));
                    }
                });
            } else {
                // category
                const li = this.menu.createMenuItem(menu, {
                    name: key
                });
                const ul = this.menu.createSubMenu(li);
                this.populateCommandMenu(ul, command);
            }
        }
    }
}

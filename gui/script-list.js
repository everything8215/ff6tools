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
        this.menu = document.getElementById('menu');
        this.scriptList.parentElement.oncontextmenu = function(e) {
            self.openMenu(e);
            return false;
        };

        const insertButton = document.getElementById('script-insert');
        insertButton.onclick = function(e) { self.openMenu(e); };
    }

    scroll() {
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

    selectCommand(command) {

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
        node.classList.add('selected');

        // center the node in the list
        var nodeTop = node.offsetTop - this.container.offsetTop;
        var nodeBottom = nodeTop + node.offsetHeight;
        if ((this.scriptList.parentElement.scrollTop > nodeTop) || ((this.scriptList.parentElement.scrollTop + this.container.offsetHeight) < nodeBottom)) this.scriptList.parentElement.scrollTop = nodeTop - Math.floor(this.container.offsetHeight - node.offsetHeight) / 2;
    }

    selectRef(ref) {
        this.selectCommand(this.script.ref[ref]);
    }

    deselectAll() {
        for (var c = 0; c < this.selection.length; c++) {
            var command = this.selection[c];
            if (!command) continue;
            var node = this.node[command.ref];
            if (!node) continue;
            node.classList.remove("selected");
        }
        this.selection = [];
    }

    insert(identifier) {
        if (!this.script) return;

        this.closeMenu();

        var command = this.script.blankCommand(identifier);

        var firstCommand = this.selection[0];
        var lastCommand = this.selection[this.selection.length - 1];
        var end = this.script.command.indexOf(lastCommand);
        // if (end === this.script.command.length - 1) return;
        var nextCommand = this.script.command[end + 1];
        var ref = null;
        if (nextCommand) ref = nextCommand.ref;

        this.rom.beginAction();
        var self = this;
        this.rom.pushAction(new ROMAction(this, function() {
            this.script.updateOffsets();
            if (lastCommand) this.selectCommand(lastCommand);
            this.update();
        }, null, 'Update Script'));
        this.script.insertCommand(command, ref);
        this.rom.doAction(new ROMAction(this, null, function() {
            this.script.updateOffsets();
            this.selectCommand(command);
            this.update();
        }, 'Update Script'));
        this.rom.endAction();
    }

    delete() {
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
            if (lastCommand) this.selectCommand(lastCommand);
            this.update();
        }, null, 'Update Script'));
        this.selection.forEach(function(command) {
            self.script.removeCommand(command);
        });
        this.rom.doAction(new ROMAction(this, null, function() {
            this.script.updateOffsets();
            if (nextCommand) this.selectCommand(nextCommand);
            this.update();
        }, 'Update Script'));
        this.rom.endAction();
    }

    moveUp() {
        // return if nothing is selected
        if (!this.script) return;
        if (this.selection.length === 0) return;
        this.closeMenu();

        var firstCommand = this.selection[0];
        var start = this.script.command.indexOf(firstCommand);
        if (start === 0) return;
        var previousCommand = this.script.command[start - 1];
        if (!previousCommand) return;
        var lastCommand = this.selection[this.selection.length - 1];
        var end = this.script.command.indexOf(lastCommand);
        var nextCommand = this.script.command[end + 1];
        var nextRef = null;
        if (nextCommand) nextRef = nextCommand.ref;

        function updateScript() {
            this.script.updateOffsets();
            this.selectCommand(firstCommand);
            this.update();
        }

        this.rom.beginAction();
        var self = this;
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
        this.closeMenu();

        var firstCommand = this.selection[0];
        var start = this.script.command.indexOf(firstCommand);
        var lastCommand = this.selection[this.selection.length - 1];
        var end = this.script.command.indexOf(lastCommand);
        if (end === this.script.command.length - 1) return;
        var nextCommand = this.script.command[end + 1];
        if (!nextCommand) return;

        function updateScript() {
            this.script.updateOffsets();
            this.selectCommand(firstCommand);
            this.update();
        }

        this.rom.beginAction();
        var self = this;
        this.rom.pushAction(new ROMAction(this, updateScript, null, 'Update Script'));
        this.script.removeCommand(nextCommand);
        this.script.insertCommand(nextCommand, firstCommand.ref);
        this.rom.doAction(new ROMAction(this, null, updateScript, 'Update Script'));
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
            self.observer.startObserving(command, self.update);
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
        var li = document.createElement('li');
        li.value = command.ref;
        var list = this;
        li.onclick = function() {
            list.selectRef(this.value);
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

    populateMenu(menu, encoding) {
        menu.innerHTML = '';
        menu.classList.add('menu');

        var hierarchy = {};
        var names = []; // commands that have already been sorted

        function createSubMenu(menu, commands) {
            var keys = Object.keys(commands).sort();
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var command = commands[key];
                var li = document.createElement('li');
                li.innerHTML = key;
                li.classList.add('menu-item');
                if (command.encoding) {
                    // command
                    li.id = `${command.encoding}.${command.key}`;
                    li.onclick = function() {
                        eval(`scriptList.insert("${this.id}")`);
                    };
                } else {
                    // category
                    var ul = document.createElement('ul');
                    ul.classList.add('menu-submenu');
                    ul.classList.add('menu');
                    createSubMenu(ul, command);
                    li.appendChild(ul);
                }
                menu.appendChild(li);
            }
        }

        // go through all of the commands and pick out categories
        var keys = Object.keys(encoding.command);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var opcode = Number(key);
            if (!isNumber(opcode)) continue;
            var command = encoding.command[key];
            if (!command.name) continue;
            if (names.indexOf(command.name) !== -1) continue;
            names.push(command.name);

            if (command.category) {
                // create a category if needed
                if (!hierarchy[command.category]) hierarchy[command.category] = {};
                hierarchy[command.category][command.name] = command;
            } else {
                hierarchy[command.name] = command;
            }
        }

        createSubMenu(menu, hierarchy);
    }

    updateMenu() {

        this.menu.innerHTML = '';
        this.menu.classList.add('menu');

        // build the menu for the appropriate script commands
        if (isArray(this.script.encoding)) {
            for (var i = 0; i < this.script.encoding.length; i++) {
                var encodingName = this.script.encoding[i];
                var encoding = this.rom.scriptEncoding[encodingName];
                var subMenu = document.createElement('ul');
                subMenu.classList.add('menu-submenu');
                if (encoding) this.populateMenu(subMenu, encoding);
                var encodingLabel = document.createElement('li');
                encodingLabel.classList.add('menu-item');
                encodingLabel.innerHTML = encoding.name;
                encodingLabel.appendChild(subMenu);
                this.menu.appendChild(encodingLabel);
            }
        } else {
            var encoding = this.rom.scriptEncoding[this.script.encoding];
            if (encoding) this.populateMenu(this.menu, encoding);
        }
    }

    openMenu(e) {
        this.updateMenu();

        this.menu.classList.add('menu-active');
        this.menu.style.left = `${e.x}px`;
        this.menu.style.height = '';
        this.menu.style.overflowY = 'visible';

        var top = e.y;
        var height = this.menu.clientHeight;
        if (height + top > window.innerHeight) {
            top = window.innerHeight - height;
        }
        if (top < 0) {
            this.menu.style.height = `${window.innerHeight - 10}px`;
            this.menu.style.overflowY = 'auto';
            top = 0;
        }
        this.menu.style.top = `${top}px`;
    }

    closeMenu() {
        this.menu.classList.remove('menu-active');
    }
}

//
// editor.js
// created 10/22/2020
//

class ROMEditor {
    constructor(rom) {
        this.rom = rom;
        this.div = document.createElement('div');
        this.editControls = document.getElementById('edit-controls');
        this.editTop = document.getElementById('edit-top');
        this.menu = null;
        this.list = [];
        this.observer = new ROMObserver(rom, this);
        this.resizeSensor = null;
    }

    beginAction(callback) {
        this.rom.beginAction();
        this.rom.doAction(new ROMAction(this.observer, this.observer.wake, this.observer.sleep));
        if (callback) this.rom.doAction(new ROMAction(this, callback, null));
    }

    endAction(callback) {
        if (callback) this.rom.doAction(new ROMAction(this, null, callback));
        this.rom.doAction(new ROMAction(this.observer, this.observer.sleep, this.observer.wake));
        this.rom.endAction();
    }

    show() {
        // notify on resize
        const self = this;
        if (!this.resizeSensor) {
            this.resizeSensor = new ResizeSensor(this.editTop, function() {
                self.resize();
                self.redraw();
            });
        }
    }

    hide() {
        // stop observing
        this.observer.stopObservingAll();

        // detach resize sensor
        if (this.resizeSensor) {
            this.resizeSensor.detach(this.editTop);
            this.resizeSensor = null;
        }
    }

    hideControls() {
        this.editControls.classList.add('hidden');
    }

    showControls() {
        this.editControls.classList.remove('hidden');
    }

    resetControls() {
        this.editControls.innerHTML = '';
        this.list = [];
    }

    resize() {}

    redraw() {}

    addTwoState(id, onclick, labelText, checked) {
        const label = document.createElement('label');
        label.classList.add('two-state');
        if (checked) label.classList.add('checked');
        label.style.display = 'inline-block';
        this.editControls.appendChild(label);

        const button = document.createElement('input');
        button.id = id;
        button.type = 'checkbox';
        button.checked = checked;
        button.onclick = function() {
            onclick(this.checked);
            twoState(this);
        };
        label.appendChild(button);

        const p = document.createElement('p');
        p.innerHTML = labelText;
        label.appendChild(p);
    }

    addZoom(zoom, onchange, min = -2, max = 2, step = 1) {
        const zoomValue = document.createElement('div');
        zoomValue.id = 'zoom-value';
        zoomValue.innerHTML = `${zoom * 100}%`;
        this.editControls.appendChild(zoomValue);

        const zoomRange = document.createElement('input');
        zoomRange.type = 'range';
        zoomRange.id = 'zoom';
        zoomRange.min = min;
        zoomRange.max = max;
        zoomRange.step = step;
        zoomRange.value = Math.log2(zoom);
        zoomRange.onchange = function() { onchange(); };
        this.editControls.appendChild(zoomRange);

        const zoomCoordinates = document.createElement('div');
        zoomCoordinates.id = 'coordinates';
        zoomCoordinates.innerHTML = '(0,0)';
        this.editControls.appendChild(zoomCoordinates);
    }

    addList(id, labelText, listNames, onchange, selected) {
        this.list[id] = {
            names: listNames,
            onchange: onchange,
            selected: selected
        };

        const label = document.createElement('label');
        label.classList.add('two-state');
        label.classList.add('checked');
        label.style.display = 'inline-block';
        this.editControls.appendChild(label);

        const self = this;
        const button = document.createElement('input');
        button.id = id;
        button.type = 'button';
        button.onclick = function(e) { self.openList(e, id); };
        label.appendChild(button);

        const p = document.createElement('p');
        p.innerHTML = labelText;
        label.appendChild(p);
    }

    openList(e, id) {

        const list = this.list[id];
        if (!list || !isArray(list.names)) return;

        // build the menu for the list of options
        this.menu = new ROMMenu();
        const self = this;
        for (const [i, name] of list.names.entries()) {
            const li = this.menu.createMenuItem(this.menu.topMenu, {
                name: name || '&nbsp;',
                value: i,
                selected: list.selected(i),
                onclick: function() {
                    self.closeList();
                    list.onchange(this.value);
                }
            });
        }
        this.menu.open(e.x, e.y);
    }

    closeList() {
        if (this.menu) this.menu.close();
    }
}

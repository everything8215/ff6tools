//
// navigator.js
// created 9/1/2019
//

class ROMNavigator {
    constructor(rom) {
        this.rom = rom;
        this.hierarchy = rom.hierarchy || ROMNavigator.defaultHierarchy;
        this.observer = new ROMObserver(rom, this);
        this.resetList();
    }

    resetList() {
        const leftPane = document.getElementById('left-pane');
        leftPane.innerHTML = null;

        // create the navigator root list
        const navRoot = document.createElement('ul');
        navRoot.classList.add('nav-list');
        leftPane.appendChild(navRoot);

        // add top-level categories
        for (let i = 0; i < this.hierarchy.length; i++) {
            const definition = this.hierarchy[i];
            const category = this.liForCategory(definition);
            if (category) navRoot.appendChild(category);
        }

        // reset the node and selection
        this.node = {};
        this.selectedNode = null;
    }

    liForCategory(definition) {
        const self = this;
        const category = document.createElement('li');
        let isLoaded = false;
        category.classList.add('nav-category');

        const p = document.createElement('p');
        p.onclick = function(e) {
            e.stopPropagation();
            category.classList.toggle('shown');

            if (isLoaded) return;

            const ul = document.createElement('ul');
            ul.classList.add('nav-list');
            category.appendChild(ul);

            for (const options of definition.list) {
                if (!options.path) continue;

                const object = self.rom.parsePath(options.path);
                if (!object) continue;

                let li;
                if (object instanceof ROMArray) {
                    li = self.liForArray(object, options);
                } else if (object instanceof ROMStringTable) {
                    li = self.liForStringTable(object, options);
                } else {
                    li = self.liForObject(object, options);
                }

                if (li) ul.appendChild(li);
            }
            isLoaded = true;
        }
        let name = definition.name;
        if (!isString(name)) name = 'Unnamed Category';
        if (!/\S/.test(name)) name = '&nbsp;';
        p.innerHTML = name;
        category.appendChild(p);

        return category;
    }

    liForObject(object, options) {

        const li = document.createElement('li');
        li.classList.add('nav-object');
        li.onclick = function(e) {
            e.stopPropagation();
            propertyList.select(object);
        }
        if (!this.node[object.path]) this.node[object.path] = li;

        const p = document.createElement('p');
        let name = options.name;
        if (!isString(name)) name = object.name;
        if (object instanceof ROMText) name = object.htmlText;
        if (!isString(name)) name = 'Unnamed Object';
        if (!/\S/.test(name)) name = '&nbsp;';
        p.innerHTML = name;
        li.appendChild(p);

        return li;
    }

    liForArray(array, options) {
        const li = document.createElement('li');
        li.classList.add('nav-array');

        const p = document.createElement('p');
        p.onclick = function(e) {
            e.stopPropagation();
            li.classList.toggle('shown');
        }
        let name = options.name;
        if (!isString(name)) name = array.name;
        if (!isString(name)) name = 'Unnamed Array';
        if (!/\S/.test(name)) name = '&nbsp;';
        p.innerHTML = name;
        li.appendChild(p);

        const ul = document.createElement('ul');
        ul.classList.add('nav-list');
        if (!this.node[array.path]) this.node[array.path] = ul;

        let pad = 2;
        let maxIndex = array.arrayLength - 1;
        while (maxIndex > 0xFF) {
            pad += 2;
            maxIndex >>= 8;
        }

        for (let i = 0; i < array.arrayLength; i++) {
            const liItem = this.liForArrayItem(array, i, pad);
            if (liItem) ul.appendChild(liItem);
        }
        li.appendChild(ul);

        return li;
    }

    liForArrayItem(array, i, pad) {

        const object = array.item(i);
        if (!object) return null;

        let options = {};

        options.name = `${array.name} ${rom.numToString(i, pad)}`;
        if (array.stringTable) {
            const stringTable = this.rom.stringTable[array.stringTable];
            if (stringTable && stringTable.string[i]) {
                options.name = stringTable.string[i].fString(40);
            }
        }

        const li = this.liForObject(object, options);
        const span = document.createElement('span');
        if (rom.numberBase === 16) span.classList.add(`hex${pad}`);
        span.classList.add('nav-object-index');
        span.innerHTML = rom.numToString(i, pad);
        li.insertBefore(span, li.firstChild);

        return li;
    }

    liForStringTable(stringTable, options) {
        const li = document.createElement('li');
        li.classList.add('nav-array');

        const p = document.createElement('p');
        p.onclick = function(e) {
            e.stopPropagation();
            li.classList.toggle('shown');
        }
        let name = options.name;
        if (!isString(name)) name = stringTable.name;
        if (!isString(name)) name = 'Unnamed String Table';
        if (!/\S/.test(name)) name = '&nbsp;';
        p.innerHTML = name;
        li.appendChild(p);

        const ul = document.createElement('ul');
        ul.classList.add('nav-list');
        const path = `stringTable.${stringTable.key}`;
        if (!this.node[path]) this.node[path] = ul;

        let pad = 2;
        let maxIndex = stringTable.string.length - 1;
        while (maxIndex > 0xFF) {
            pad += 2;
            maxIndex >>= 8;
        }

        for (let i = 0; i < stringTable.string.length; i++) {
            const item = this.liForString(stringTable, i, pad);
            if (item) ul.appendChild(item);
        }
        li.appendChild(ul);

        return li;
    }

    liForString(stringTable, i, pad) {

        if (!stringTable.string[i]) return null;

        const li = document.createElement('li');
        const span = document.createElement('span');
        span.innerHTML = rom.numToString(i, pad);
        span.classList.add('nav-object-index');
        if (rom.numberBase === 16) span.classList.add(`hex${pad}`);
        li.appendChild(span);

        li.classList.add('nav-object');
        li.onclick = function(e) {
            e.stopPropagation();
            propertyList.select(stringTable.string[i]);
        }

        const p = document.createElement('p');
        p.innerHTML = stringTable.string[i].htmlString();
        li.appendChild(p);

        return li;
    }

    selectObject(object) {

        // check if a node exists for the object
        const li = this.node[object.path];
        if (!li) return;

        let newSelection = null;
        if (isNumber(object.i)) {
            // select an array element
            newSelection = li.childNodes[object.i];
        } else {
            // select the object itself
            newSelection = li;
        }

        if (newSelection) {
            if (this.selectedNode) {
                this.selectedNode.classList.remove('selected');
            }
            this.selectedNode = newSelection;
            this.selectedNode.classList.add('selected');
        }
    }
}

ROMNavigator.defaultHierarchy = [
    {
        name: 'Map',
        list: [
            {
                name: 'Maps',
                path: 'mapProperties'
            }, {
                name: 'Map Titles',
                path: 'mapTitle'
            }, {
                name: 'Parallax',
                path: 'mapParallax'
            }, {
                name: 'Color Math',
                path: 'mapColorMath'
            }
        ]
    }, {
        name: 'Event',
        list: [
            {
                name: 'Event Script',
                path: 'eventScript'
            }, {
                name: 'Dialog',
                path: 'dialog'
            }, {
                name: 'NPC Switches',
                path: 'stringTable.npcSwitches'
            }, {
                name: 'Map Switches',
                path: 'stringTable.mapSwitches'
            }
        ]
    }, {
        name: 'Battle',
        list: [
            {
                name: 'Battles',
                path: 'battleProperties'
            }, {
                name: 'Monsters',
                path: 'monsterProperties'
            }
        ]
    }, {
        name: 'System',
        list: [
            {
                'name': 'SNES Header',
                'path': 'snesHeader'
            }
        ]
    }
]

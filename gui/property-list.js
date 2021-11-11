//
// property-list.js
// created 9/1/2019
//

class ROMPropertyList {
    constructor(rom) {
        this.rom = rom;
        this.observer = new ROMObserver(rom, this);
        this.selection = {
            current: null,
            previous: [],
            next: []
        };
        this.editors = {};
    }

    select(object) {

        // if the object is a string, try to parse it as an object
        if (isString(object)) {
            object = this.rom.parsePath(object);
            // return if it's an invalid link
            if (!object) return;
        }

        // update properties if the selection didn't change
        if (this.selection.current === object) {
            this.showProperties();
            return;
        }

        // deselect everything
        this.deselectAll();

        // select nothing
        if (!object) {
            this.selection.current = null;
            this.showProperties();
            return;
        }

        // select the object in the navigator
        romNavigator.selectObject(object);

        // select a script (this might be redundant)
        if (object instanceof ROMScript) {
            scriptList.selectScript(object);
            return;
        }

        // show the object's properties
        this.selection.current = object;

        // show the editor for this object
        this.showEditor(object);

        // show properties for this object
        this.showProperties();
    }

    selectPrevious() {
        const current = this.selection.current;
        const previous = this.selection.previous.pop();
        if (!previous) return;
        this.select(previous);
        this.selection.next.push(current);
    }

    selectNext() {
        const current = this.selection.current;
        const next = this.selection.next.pop();
        if (!next) return;
        this.select(next);
        this.selection.previous.push(current);
    }

    deselectAll() {
        // stop observing the previous selection
        if (this.selection.current) {
            this.selection.previous.push(this.selection.current);
            this.selection.next = [];
        }

        this.selection.current = null;
    }

    copy() {
        const obj = this.selection.current;
        if (!obj.serialize) return;
        const yaml = obj.serialize();
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
        const obj = this.selection.current;
        if (!obj.deserialize) return;

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
        const obj = this.selection.current;
        if (!obj.deserialize) return;

        const yaml = jsyaml.safeLoad(text);
        self.rom.beginAction();
        obj.deserialize(yaml);
        self.rom.endAction();
    }

    import() {

        const obj = this.selection.current;

        if (obj instanceof ROMGraphics) {
            this.graphicsImport();
            return;
        }
        if (!obj.deserialize) return;

        // create a dummy file input element
        const fileInput = document.createElement('input');
        document.body.appendChild(fileInput);
        fileInput.type = 'file';
        fileInput.style = 'display: none';
        fileInput.click();
        fileInput.onchange = function() {
            if (!fileInput || !fileInput.files[0]) {
                document.body.removeChild(fileInput);
                return;
            }
            const file = fileInput.files[0];
            const filereader = new FileReader();
            filereader.readAsText(file);
            filereader.onload = function() {
                // get the file as a byte array
                const textBuffer = filereader.result;
                let importObj = null;
                if (file.name.endsWith('yaml') || file.name.endsWith('yml')) {
                    importObj = jsyaml.safeLoad(textBuffer);
                } else {
                    importObj = JSON.parse(textBuffer);
                }

                self.rom.beginAction();
                obj.deserialize(importObj);
                self.rom.endAction();
                // self.showProperties();

                document.body.removeChild(fileInput);
            }
        }
    }

    export() {
        const obj = this.selection.current;

        if (obj instanceof ROMGraphics) {
            this.graphicsExport();
            return;
        }

        if (!obj.serialize) return;
        const yaml = obj.serialize();
        const text = jsyaml.safeDump(yaml, {
            indent: 4,
            skipInvalid: true
        });

        const blob = new Blob([text]);
        const name = obj.labelString ? obj.labelString.fString() : (obj.name || 'object');

        // create a link element, hide it, direct it towards the blob,
        // and then 'click' it programatically
        const a = document.createElement('a');
        a.style = 'display: none';
        document.body.appendChild(a);

        a.href = window.URL.createObjectURL(blob);
        a.download = `${name}.yml`;
        a.click();

        // release the reference to the file by revoking the Object URL
        window.URL.revokeObjectURL(a.href);
    }

    showProperties() {

        // stop observing eveything
        this.observer.stopObservingAll();

        const properties = document.getElementById('properties');
        properties.innerHTML = '';

        const object = this.selection.current;
        if (!object) return;

        // show heading
        if (object.name) {
            const headingDiv = document.createElement('div');
            properties.appendChild(headingDiv);
            headingDiv.classList.add('property-heading');

            // array list
            if (object.parent instanceof ROMArray) {
                const array = object.parent;
                const list = document.createElement('select');
                headingDiv.appendChild(list);
                list.onchange = function() {
                    const i = Number(list.value);
                    if (i === -1) {
                        propertyList.select(array)
                    } else {
                        propertyList.select(array.item(i))
                    }
                };

                // create an option to select the parent array
                const parentOption = document.createElement('option');
                parentOption.value = -1;
                parentOption.innerHTML = 'Select Parent Array';
                list.appendChild(parentOption);

                // create an option for each valid string in the table
                const stringTable = rom.stringTable[array.stringTable];
                for (let i = 0; i < array.arrayLength; i++) {

                    let optionString = `${rom.numToString(i)}: `;
                    if (stringTable && stringTable.string[i]) {
                        optionString += stringTable.string[i].fString(40);
                    } else {
                        optionString += `${array.name} ${i}`;
                    }

                    const option = document.createElement('option');
                    option.value = i;
                    option.innerHTML = optionString;
                    list.appendChild(option);
                }
                list.value = object.i;
            }

            // object name
            const heading = document.createElement('p');
            headingDiv.appendChild(heading);

            // add heading buttons
            const self = this;
            const buttonDiv = document.createElement('div');
            buttonDiv.classList.add('property-heading-button-div');
            heading.appendChild(buttonDiv);

            const copyButton = document.createElement('i');
            copyButton.classList.add('fas', 'fa-copy', 'property-heading-button');
            copyButton.onclick = function() { self.copy(); };
            buttonDiv.appendChild(copyButton);

            const pasteButton = document.createElement('i');
            pasteButton.classList.add('fas', 'fa-paste', 'property-heading-button');
            pasteButton.onclick = function() { self.paste(); };
            buttonDiv.appendChild(pasteButton);

            const exportButton = document.createElement('i');
            exportButton.classList.add('fas', 'fa-download', 'property-heading-button');
            exportButton.onclick = function() { self.export(); };
            buttonDiv.appendChild(exportButton);

            const importButton = document.createElement('i');
            importButton.classList.add('fas', 'fa-upload', 'property-heading-button');
            importButton.onclick = function() { self.import(); };
            buttonDiv.appendChild(importButton);

            if (isNumber(object.i)) {
                const headingString = object.name.replace('%i', rom.numToString(object.i));
                heading.appendChild(document.createTextNode(headingString));
            } else {
                heading.appendChild(document.createTextNode(object.name));
            }
        }

        // show object label (string table or script label)
        const labelHTML = this.labelHTML(object);
        if (labelHTML) {
            this.observer.startObserving(object.labelString, this.showProperties);
            properties.appendChild(labelHTML);
        }

        if (object instanceof ROMString && object.language) {
            // strings with multiple languages
            const language = object.language;
            for (const key in language) {
                const linkString = language[key].link.replace('%i', object.i);
                const link = this.rom.parsePath(linkString);
                if (!link) continue;
                const propertyHTML = this.propertyHTML(link, {
                    key: key, name: language[key].name
                });
                if (!propertyHTML) continue;
                properties.appendChild(propertyHTML);
                this.observer.startObserving(link, this.showProperties);
            }

        } else if (object instanceof ROMString && object.link) {
            // strings with only one languages
            const linkString = object.link.replace('%i', object.i);
            const link = this.rom.parsePath(linkString);
            if (!link) return;
            const propertyHTML = this.propertyHTML(link, {
                key: object.key, name: object.name
            });
            if (!propertyHTML) return;
            properties.appendChild(propertyHTML);
            this.observer.startObserving(link, this.showProperties);

        } else if (object instanceof ROMText) {
            // text object
            const propertyHTML = this.propertyHTML(object, { name: 'Text' });
            if (!propertyHTML) return;
            properties.appendChild(propertyHTML);
            this.observer.startObserving(object, this.showProperties);

        } else if ((object instanceof ROMProperty) ||
            (object instanceof ROMText) || (object instanceof ROMString)) {
            // object with a single property
            const propertyHTML = this.propertyHTML(object);
            if (!propertyHTML) return;
            properties.appendChild(propertyHTML);
            this.observer.startObserving(object, this.showProperties);

        } else if (object instanceof ROMData || object instanceof ROMCommand) {
            // object with sub-assemblies
            const assemblyHTML = this.assemblyHTML(object);
            for (const html of assemblyHTML) properties.appendChild(html);
            this.observer.startObserving(object, this.showProperties);

        } else if (object instanceof ROMArray) {
            // object is an array
            const arrayHTML = this.arrayHTML(object, { parentOnly: true });
            for (const html of arrayHTML) properties.appendChild(html);
            this.observer.startObserving(object, this.showProperties);

        } else if (object instanceof ROMGraphics) {
            // object is graphics
            const graphicsHTML = this.graphicsHTML(object);
            if (!graphicsHTML) return;
            properties.appendChild(graphicsHTML);
            this.observer.startObserving(object, this.showProperties);

        } else if (object instanceof ROMTilemap) {
            // object is a tilemap
            const tilemapHTML = this.tilemapHTML(object);
            if (!tilemapHTML) return;
            properties.appendChild(tilemapHTML);
            this.observer.startObserving(object, this.showProperties);

        } else if (object instanceof ROMAssembly) {
            // add a control to change the length of the data
            const controlDiv = this.propertyHTML(object, {
                name: 'Length',
                controlID: 'data-length'
            });
            properties.appendChild(controlDiv);
            this.observer.startObserving(object, this.showProperties);
            properties.appendChild(controlDiv);
            const interlaceDiv = this.interlaceDiv(object);
            properties.appendChild(interlaceDiv);

        }

        this.updateLabels();
    }

    assemblyHTML(object, options = {}) {

        // disable all properties if this object has a special value
        if (object.getSpecialValue() !== null) options.disabled = true;

        // we will return an array of html divs
        const divs = [];
        if (!object.assembly) return divs;

        for (const key in object.assembly) {

            // category name
            if (isString(object.assembly[key])) {
                const categoryDiv = document.createElement('div');
                categoryDiv.classList.add('property-category');
                divs.push(categoryDiv);

                const category = document.createElement('p');
                category.innerHTML = object.assembly[key];
                categoryDiv.appendChild(category);
                continue;
            }

            // don't show invalid assemblies
            if (object.assembly[key].invalid) continue;

            // subscript the object to force the assembly to load
            const assembly = object[key];
            if (!assembly) continue;

            if (assembly instanceof ROMArray) {
                // array of properties
                const arrayHTML = this.arrayHTML(assembly, {
                    name: object.assembly[key].name,
                    index: options.index,
                    key: key,
                    disabled: options.disabled
                });
                if (!arrayHTML) continue;
                divs.push(...arrayHTML);
                this.observer.startObserving(assembly, this.showProperties);

            } else if (assembly instanceof ROMData ||
                assembly instanceof ROMCommand) {
                // object with sub-assemblies
                const assemblyHTML = this.assemblyHTML(assembly, {
                    name: object.assembly[key].name,
                    index: options.index,
                    key: key,
                    disabled: options.disabled
                });
                if (!assemblyHTML) continue;
                divs.push(...assemblyHTML);
                this.observer.startObserving(assembly, this.showProperties);

            } else {
                // single property
                const propertyHTML = this.propertyHTML(assembly, {
                    name: object.assembly[key].name,
                    index: options.index,
                    key: key,
                    disabled: options.disabled
                });
                if (!propertyHTML) continue;
                divs.push(propertyHTML);
                this.observer.startObserving(assembly, this.showProperties);
            }
        }

        // create properties for each special value
        const specialHTML = this.propertyHTML(object, {
            controlID: object.key, index: options.index
        });
        if (specialHTML) divs.push(specialHTML);

        return divs;
    }

    labelHTML(object) {

        let string;
        let defaultString;
        if (object instanceof ROMCommand) {
            // command label
            string = object.label;
            defaultString = object.defaultLabel;
        } else {
            // object label (from a string table)
            string = object.labelString;
            if (!string || !string.parent) return null;
            defaultString = string.parent.defaultString;
            defaultString = defaultString.value || defaultString;
        }

        // create a div for the label
        const labelDiv = document.createElement('div');
        labelDiv.classList.add('property-div');
        labelDiv.id = `label-${object.key}`;
        const id = `label-control-${object.key}`;

        // create a label for the label
        const label = document.createElement('label');
        label.htmlFor = id;
        label.classList.add('property-label');
        label.innerHTML = 'Label:';
        labelDiv.appendChild(label);

        // create a div for the control(s)
        const controlDiv = document.createElement('div');
        labelDiv.appendChild(controlDiv);
        controlDiv.classList.add('property-control-div');

        // create a text box
        const input = document.createElement('input');
        controlDiv.appendChild(input);
        input.id = id;
        input.placeholder = defaultString;
        input.value = string.value || string;
        if (input.value === defaultString) input.value = '';
        input.classList.add('property-control');
        input.onchange = function() {
            if (object instanceof ROMCommand) {
                object.setLabel(input.value);
            } else if (input.value === '') {
                string.setValue(defaultString);
            } else {
                string.setValue(input.value);
            }
            document.getElementById(input.id).focus();
        };

        return labelDiv;
    }

    graphicsHTML(object, options) {
        const graphicsDiv = document.createElement('div');
        graphicsDiv.classList.add('property-div');

        const graphicsView = this.getEditor('ROMGraphicsView');
        const paletteView = graphicsView.paletteView;
        // const exportButton = document.createElement('button');
        // exportButton.innerHTML = 'Export Graphics';
        // exportButton.onclick = function() {
        //     const exporter = new ROMGraphicsExporter();
        //     exporter.export({
        //         tilemap: graphicsView.tilemap,
        //         graphics: graphicsView.graphics,
        //         palette: paletteView.palette,
        //         width: graphicsView.width,
        //         backColor: graphicsView.backColor,
        //         tileWidth: graphicsView.tileWidth,
        //         tileHeight: graphicsView.tileHeight
        //     });
        // };
        // graphicsDiv.appendChild(exportButton);
        //
        // const importButton = document.createElement('button');
        // importButton.innerHTML = 'Import Graphics';
        // importButton.onclick = function() {
        //     function callback(graphics, palette) {
        //
        //         graphicsView.rom.beginAction();
        //         if (graphics) {
        //             // trim the graphics to fit
        //             if (graphics.length > graphicsView.graphics.length) {
        //                 graphics = graphics.subarray(0, graphicsView.graphics.length);
        //             }
        //
        //             // set the new graphics data
        //             graphicsView.object.setData(graphics);
        //         }
        //
        //         if (palette) {
        //             paletteView.importPalette(palette);
        //         }
        //         graphicsView.rom.endAction();
        //     }
        //     const importer = new ROMGraphicsImporter(rom, graphicsView, callback);
        // };
        // graphicsDiv.appendChild(importButton);

        return graphicsDiv;
    }

    graphicsExport() {
        const graphicsView = this.getEditor('ROMGraphicsView');
        const paletteView = graphicsView.paletteView;
        const exporter = new ROMGraphicsExporter();
        exporter.export({
            tilemap: graphicsView.tilemap,
            graphics: graphicsView.graphics,
            palette: paletteView.palette,
            width: graphicsView.width,
            backColor: graphicsView.backColor,
            tileWidth: graphicsView.tileWidth,
            tileHeight: graphicsView.tileHeight
        });
    }

    graphicsImport() {
        const graphicsView = this.getEditor('ROMGraphicsView');
        const paletteView = graphicsView.paletteView;
        function callback(graphics, palette) {

            graphicsView.rom.beginAction();
            if (graphics) {
                // trim the graphics to fit
                if (graphics.length > graphicsView.graphics.length) {
                    graphics = graphics.subarray(0, graphicsView.graphics.length);
                }

                // set the new graphics data
                graphicsView.object.setData(graphics);
            }

            if (palette) {
                paletteView.importPalette(palette);
            }
            graphicsView.rom.endAction();
        }
        const importer = new ROMGraphicsImporter(rom, graphicsView, callback);
    }

    tilemapHTML(object, options) {
        const tilemapDiv = document.createElement('div');
        tilemapDiv.classList.add('property-div');

        const editor = this.getEditor('ROMTilemapView');
        const exportButton = document.createElement('button');
        exportButton.innerHTML = 'Export Tilemap';
        exportButton.onclick = function() { editor.exportTilemap(); };
        tilemapDiv.appendChild(exportButton);

        // const importButton = document.createElement('button');
        // importButton.innerHTML = 'Import Graphics';
        // // importButton.disabled = true;
        // importButton.onclick = function() { editor.showImportDialog(); };
        // graphicsDiv.appendChild(importButton);

        return tilemapDiv;
    }

    propertyHTML(object, options = {}) {
        if (object.hidden || object.invalid) return null;

        if (options.key && object.key) {
            options.key += `-${object.key}`;
        } else {
            options.key = object.key || 'undefined';
        }
        options.name = options.name || object.name;
        if (isNumber(options.index)) {
            options.name += ` ${options.index}`;
            options.key += `-${options.index}`;
        }
        options.propertyID = `property-${options.key}`;
        options.controlID = `property-control-${options.key}`;
        options.labelID = `property-label-${options.key}`;

        // create a label for the control
        let label;
        if (object instanceof ROMProperty && object.link) {
            // create a label with a link
            const link = object.parseIndex(object.link, object.value);
            label = document.createElement('a');
            label.href = `javascript:propertyList.select('${link}');`;

        } else if (object instanceof ROMProperty && object.script) {
            // create a label with a script link
            const script = object.parsePath(object.script);
            if (!script) return null;
            const command = script.ref[object.value] || script.command[0];
            label = document.createElement('a');
            const link = object.parseSubscripts(object.parseIndex(object.script));
            label.href = `javascript:propertyList.select('${link}');` +
                `scriptList.deselectAll();` +
                `scriptList.selectRef(${command.ref});`;

        } else if (object.target instanceof ROMAssembly) {
            // create a label with a link to the pointer target
            const target = object.target;
            label = document.createElement('a');
            if (target.parent instanceof ROMArray) {
                label.href = `javascript:propertyList.select('${target.parent.path}[${target.i}]');`;
            } else {
                label.href = `javascript:propertyList.select('${target.path}');`;
            }

        } else if (object instanceof ROMString && object.language) {
            label = document.createElement('a');
            label.href = `javascript:propertyList.select('stringTable.${object.parent.key}[${object.i}]');`;

        } else {
            // create a normal label
            label = document.createElement('label');
            label.htmlFor = options.controlID;
        }

        label.classList.add('property-label');
        label.id = options.labelID;
        if (options.name) label.innerHTML = options.name + ':';
        options.label = label;

        // create a div for the control(s)
        let controlDiv;
        if (object instanceof ROMProperty && object.bool) {
            controlDiv = this.boolControlHTML(object, options);

        } else if (object instanceof ROMProperty && object.flag) {
            controlDiv = this.flagControlHTML(object, options);

        } else if (object instanceof ROMProperty && object.stringTable) {
            controlDiv = this.listControlHTML(object, options);

        } else if (object instanceof ROMProperty && object.script) {
            controlDiv = this.scriptControlHTML(object, options);

        } else if (object instanceof ROMProperty && object.pointerTo) {
            controlDiv = this.pointerControlHTML(object, options);

        } else if (object instanceof ROMProperty) {
            controlDiv = this.numberControlHTML(object, options);

        } else if (object instanceof ROMText) {
            controlDiv = this.textControlHTML(object, options);

        } else if (object instanceof ROMString) {
            controlDiv = this.stringControlHTML(object, options);

        } else if (object instanceof ROMArray) {
            controlDiv = this.arrayLengthControlHTML(object, options);

        } else if (object instanceof ROMData || object instanceof ROMCommand) {
            controlDiv = this.specialControlHTML(object, options);
            label.innerHTML = '';
            if (!controlDiv) return null;

        } else if (object instanceof ROMAssembly) {
            controlDiv = this.dataLengthControlHTML(object, options);

        } else {
            return null;
        }

        // create a div for the property
        const propertyDiv = document.createElement('div');
        propertyDiv.classList.add('property-div');
        propertyDiv.id = options.propertyID;
        propertyDiv.appendChild(label);
        propertyDiv.appendChild(controlDiv);

        return propertyDiv;
    }

    boolControlHTML(object, options) {

        // create a div for the control
        const controlDiv = document.createElement('div');
        controlDiv.classList.add('property-control-div');

        // property with a single boolean checkbox
        const input = document.createElement('input');
        controlDiv.appendChild(input);
        input.id = options.controlID;
        input.type = 'checkbox';
        input.checked = object.value;
        input.disabled = object.disabled || options.disabled;
        input.classList.add('property-check');
        input.onchange = function() {
            const value = this.checked;
            object.setValue(value);
            document.getElementById(this.id).focus();
        };

        // move the label to the right of the check box
        if (options.label) {
            // move the label to the right of the check box
            options.label.innerHTML = '';
            const label = document.createElement('label');
            label.classList.add('property-check-label');
            label.htmlFor = input.id;
            label.innerHTML = options.name || '';
            controlDiv.appendChild(label);
        }

        return controlDiv;
    }

    flagControlHTML(object, options) {
        // create a div for the control
        const controlDiv = document.createElement('div');
        controlDiv.classList.add('property-control-div');

        // property with boolean flags
        const flagChecks = [];
        for (let i = 0, mask = 1; mask < (object.mask >> object.bit); i++, mask <<= 1) {

            // create the check box
            const check = document.createElement('input');
            check.classList.add('property-check');
            check.value = mask;
            check.type = 'checkbox';
            check.checked = object.value & mask;
            check.disabled = object.disabled || options.disabled;
            check.id = `${options.controlID}-${i}`;
            check.onchange = function() {
                let value = object.value;
                if (this.checked) {
                    // set bit
                    value |= this.value;
                } else {
                    // clear bit
                    value &= ~this.value;
                }
                object.setValue(value);
                document.getElementById(this.id).focus();
            }

            // create a label for the check box
            const label = document.createElement('label');
            label.classList.add('property-check-label');
            label.htmlFor = check.id;
            if (object.stringTable) {
                const stringTable = this.rom.stringTable[object.stringTable];
                if (!stringTable.string[i]) continue;
                label.innerHTML += stringTable.string[i].fString();
            } else {
                label.innerHTML = i;
            }

            // create a div to hold the label and control
            const flagDiv = document.createElement('div');
            flagDiv.classList.add('property-check-div');
            flagDiv.appendChild(check);
            flagDiv.appendChild(label);
            flagChecks.push(check);
            controlDiv.appendChild(flagDiv);
        }

        // add check boxes for special values
        const specialValues = Object.keys(object.special);
        for (let i = 0; i < specialValues.length; i++) {
            const special = document.createElement('input');
            special.classList.add('property-check');
            special.id = `${options.controlID}-special-${i}`;
            special.disabled = object.disabled || options.disabled;
            special.type = 'checkbox';
            special.checked = false;

            const key = specialValues[i];
            const value = Number(key);
            special.value = value;
            if (Number(object.value) === value) {
                flagChecks.forEach(function(div) {
                    div.disabled = true;
                });
                special.checked = true;
            }
            special.onchange = function() {
                if (this.checked) {
                    object.setValue(Number(this.value));
                } else {
                    object.setValue(object.min);
                }
                document.getElementById(this.id).focus();
            };

            // create a label for the check box
            const label = document.createElement('label');
            label.classList.add('property-check-label');
            label.htmlFor = special.id;
            label.innerHTML = object.special[key];

            // create a div to hold the label and control
            const specialDiv = document.createElement('div');
            specialDiv.classList.add('property-check-div');
            specialDiv.appendChild(special);
            specialDiv.appendChild(label);
            controlDiv.appendChild(specialDiv);
        }

        return controlDiv;
    }

    listControlHTML(object, options) {
        // create a div for the control
        const controlDiv = document.createElement('div');
        controlDiv.classList.add('property-control-div');

        // property with a drop down list of strings
        const input = document.createElement('select');
        controlDiv.appendChild(input);
        input.id = options.controlID;
        input.disabled = object.disabled || options.disabled;
        input.classList.add('property-control');
        input.onchange = function() {
            const value = Number(this.value);
            object.setValue(value);
            document.getElementById(this.id).focus();
        };

        // create an option for each valid string in the table
        const stringTable = this.rom.stringTable[object.stringTable];
        if (!stringTable) return null;

        const indexList = [];
        for (let key in stringTable.string) {
            key = Number(key);
            if (!isNumber(key)) continue;
            indexList.push(key);
        }

        for (let key in object.special) {
            key = Number(key);
            if (!isNumber(key)) continue;
            if (!indexList.includes(key)) indexList.push(key);
        }

        // sort the list from low to high
        indexList.sort(function(a,b) {return a - b;});

        for (const index of indexList) {
            let optionString = '';
            if (!stringTable.hideIndex) {
                optionString += `${rom.numToString(index)}: `;
            }
            if (object.special[index]) {
                optionString += object.special[index];
            } else if (stringTable.string[index]) {
                optionString += stringTable.string[index].fString(40);
            } else {
                continue;
            }

            const option = document.createElement('option');
            option.value = index;
            option.innerHTML = optionString;
            input.appendChild(option);
        }
        input.value = object.value;

        return controlDiv;
    }

    scriptControlHTML(object, options) {
        // create a div for the control
        const controlDiv = document.createElement('div');
        controlDiv.classList.add('property-control-div');

        // property linked to a script
        const script = object.parsePath(object.script);
        if (!script) return null;
        const command = script.ref[object.value] || script.command[0];
        const input = document.createElement('input');
        controlDiv.appendChild(input);
        input.classList.add('property-control');
        input.id = options.controlID;
        input.disabled = object.disabled || options.disabled;
        input.type = 'text';
        input.classList.add('property-control');
        input.value = command.label;
        input.onchange = function() {
            const command = script.label[this.value];
            if (!command) return;
            object.setValue(command.ref);
            document.getElementById(this.id).focus();
        };

        // refresh if the command's label changes
        this.observer.startObserving(command, this.showProperties);

        return controlDiv;
    }

    numberControlHTML(object, options) {
        // create a div for the control
        const controlDiv = document.createElement('div');
        controlDiv.classList.add('property-control-div');

        // property with a number only
        const input = document.createElement('input');
        controlDiv.appendChild(input);
        input.id = options.controlID;
        input.disabled = object.disabled || options.disabled;
        input.type = 'number';
        input.classList.add('property-control');
        input.value = object.value; // hex is not supported by normal controls
        input.step = object.multiplier;
        input.min = object.min * object.multiplier + object.offset;
        input.max = object.max * object.multiplier + object.offset;
        input.onchange = function() {
            let value = Number(this.value);
            value = Math.max(value, this.min);
            value = Math.min(value, this.max);
            value -= value % this.step;
            object.setValue(value);
            document.getElementById(this.id).focus();
        };

        // add check boxes for special values
        for (const key in object.special) {
            const value = (Number(key) + object.offset) * input.step;
            const specialDiv = document.createElement('div');
            specialDiv.classList.add('property-check-div');
            controlDiv.appendChild(specialDiv);
            const special = document.createElement('input');
            specialDiv.appendChild(special);
            special.classList.add('property-check');
            special.id = `${input.id}-special-${value}`;
            special.disabled = object.disabled || options.disabled;
            special.type = 'checkbox';
            special.checked = false;

            if (Number(object.value) === value) {
                input.disabled = true;
                special.checked = true;
            }
            special.onchange = function() {
                if (this.checked) {
                    object.setValue(value);
                } else {
                    object.setValue(object.min);
                }
                document.getElementById(this.id).focus();
            };

            // create a label for the check box
            const label = document.createElement('label');
            specialDiv.appendChild(label);
            label.classList.add('property-check-label');
            label.htmlFor = special.id;
            label.innerHTML = object.special[key];
        }

        return controlDiv;
    }

    textControlHTML(object, options) {
        // create a div for the control
        const controlDiv = document.createElement('div');
        controlDiv.classList.add('property-control-div');

        // create a text box
        const input = document.createElement(object.multiLine ? 'textarea' : 'input');
        controlDiv.appendChild(input);
        input.id = options.controlID;
        input.value = object.text;
        input.disabled = object.disabled || options.disabled;
        input.classList.add('property-control');
        input.classList.add(object.multiLine ? 'property-textarea' : 'property-text');
        input.onchange = function() {
            object.setText(this.value);
            document.getElementById(this.id).focus();
        };

        return controlDiv;
    }

    stringControlHTML(object, options) {
        // create a div for the control
        const controlDiv = document.createElement('div');
        controlDiv.classList.add('property-control-div');

        // create a div for the string
        const stringDiv = document.createElement('div');
        stringDiv.classList.add('property-control-div');
        stringDiv.innerHTML = object.fString();
        stringDiv.id = options.controlID;
        controlDiv.appendChild(stringDiv);

        return controlDiv;
    }

    pointerControlHTML(object, options) {
        // create a div for the control
        const controlDiv = document.createElement('div');
        controlDiv.classList.add('property-control-div');

        // property with a drop down list of strings
        const input = document.createElement('select');
        controlDiv.appendChild(input);
        input.id = options.controlID;
        input.disabled = object.disabled || options.disabled;
        input.classList.add('property-control');
        input.onchange = function() {
            const numberValue = Number(this.value);
            if (isNumber(numberValue)) {
                object.rom.beginAction();
                if (object.target) object.setTarget(null);
                object.setValue(value);
                object.rom.endAction();
            } else {
                const target = object.parsePath(this.value);
                if (target) object.setTarget(target);
            }
            document.getElementById(this.id).focus();
        };

        // create options for special values
        let value = null;
        for (const specialKey in object.special) {
            const specialValue = Number(specialKey);
            const option = document.createElement('option');
            if (object.value === specialValue) value = specialValue;
            option.value = specialValue;
            option.innerHTML = object.special[specialValue];
            input.appendChild(option);
        }

        // create an option for each valid pointer
        const targetObject = this.rom.parsePath(object.pointerTo);
        const stringTable = this.rom.stringTable[targetObject.stringTable];
        for (const arrayItem of targetObject.iterator()) {
            const i = arrayItem.i;
            const objectPath = `${targetObject.path}[${i}]`;
            if (object.target === arrayItem) value = objectPath;

            let optionString = (stringTable && stringTable.hideIndex) ? '' : `${rom.numToString(i)}: `;
            if (stringTable && stringTable.string[i]) {
                optionString += stringTable.string[i].fString(40);
            } else {
                optionString += `${arrayItem.name} ${i}`;
            }

            const option = document.createElement('option');
            option.value = objectPath;
            option.innerHTML = optionString;
            input.appendChild(option);
        }
        if (value !== null) input.value = value;

        return controlDiv;
    }

    dataLengthControlHTML(object, options) {
        // create a div for the control
        const controlDiv = document.createElement('div');
        controlDiv.classList.add('property-control-div');

        // length input
        const input = document.createElement('input');
        controlDiv.appendChild(input);
        input.id = options.controlID;
        input.type = 'number';
        input.classList.add('property-control');
        input.value = object.data.length;
        input.min = 0;
        input.onchange = function() {
            const length = Number(this.value);
            if (length === object.data.length) return;
            const newData = new Uint8Array(length);
            if (object.data.length > length) {
                // trim the previous data if needed
                newData.set(object.data.subarray(0, length));
            } else {
                // otherwise, append zeros to reach the new length
                newData.set(object.data);
            }
            object.setData(newData);
            document.getElementById(this.id).focus();
        };

        return controlDiv;
    }

    interlaceDiv(object) {
        const interlaceDiv = document.createElement('div');
        interlaceDiv.classList.add('property-div');

        const interlaceButton = document.createElement('button');
        interlaceButton.innerHTML = 'Interlace';
        interlaceButton.onclick = function() {
            // open a dialog box
            const content = openModal('Interlace Data');

            let word = 1;
            let layers = 1;
            let stride = 1;

            // control for interlace word size
            const wordDiv = document.createElement('div');
            wordDiv.classList.add('property-div');
            content.appendChild(wordDiv);

            const wordControlDiv = document.createElement('div');
            wordControlDiv.classList.add("property-control-div");

            const wordControl = document.createElement('input');
            wordControl.classList.add('property-control');
            wordControl.id = 'interlace-word';
            wordControl.type = 'number';
            wordControl.value = word;
            wordControl.min = 1;
            wordControl.max = object.data.length;
            wordControl.onchange = function() {
                word = Number(this.value);
                word = Math.max(word, this.min);
                word = Math.min(word, this.max);
            };
            wordControlDiv.appendChild(wordControl);

            const wordLabel = document.createElement('label');
            wordLabel.innerHTML = 'Word Size:';
            wordLabel.classList.add('property-label');
            wordLabel.htmlFor = 'interlace-word';

            wordDiv.appendChild(wordLabel);
            wordDiv.appendChild(wordControlDiv);
            content.appendChild(wordDiv);

            // control for number of interlace layers
            const layerDiv = document.createElement('div');
            layerDiv.classList.add('property-div');
            content.appendChild(layerDiv);

            const layerControlDiv = document.createElement('div');
            layerControlDiv.classList.add("property-control-div");

            const layerControl = document.createElement('input');
            layerControl.classList.add('property-control');
            layerControl.id = 'interlace-layer';
            layerControl.type = 'number';
            layerControl.value = layers;
            layerControl.min = 1;
            layerControl.max = object.data.length;
            layerControl.onchange = function() {
                layers = Number(this.value);
                layers = Math.max(layers, this.min);
                layers = Math.min(layers, this.max);
            };
            layerControlDiv.appendChild(layerControl);

            const layerLabel = document.createElement('label');
            layerLabel.innerHTML = 'Layers:';
            layerLabel.classList.add('property-label');
            layerLabel.htmlFor = 'interlace-layer';

            layerDiv.appendChild(layerLabel);
            layerDiv.appendChild(layerControlDiv);
            content.appendChild(layerDiv);

            // control for interlace stride
            const strideDiv = document.createElement('div');
            strideDiv.classList.add('property-div');
            content.appendChild(strideDiv);

            const strideControlDiv = document.createElement('div');
            strideControlDiv.classList.add("property-control-div");

            const strideControl = document.createElement('input');
            strideControl.classList.add('property-control');
            strideControl.id = 'interlace-stride';
            strideControl.type = 'number';
            strideControl.value = stride;
            strideControl.min = 1;
            strideControl.max = object.data.length;
            strideControl.onchange = function() {
                stride = Number(this.value);
                stride = Math.max(stride, this.min);
                stride = Math.min(stride, this.max);
            };
            strideControlDiv.appendChild(strideControl);

            const strideLabel = document.createElement('label');
            strideLabel.innerHTML = 'Stride:';
            strideLabel.classList.add('property-label');
            strideLabel.htmlFor = 'interlace-layer';

            strideDiv.appendChild(strideLabel);
            strideDiv.appendChild(strideControlDiv);
            content.appendChild(strideDiv);

            // okay and cancel buttons
            const okayButton = document.createElement('button');
            okayButton.innerHTML = 'Okay';
            okayButton.onclick = function() {
                closeModal();
                const format = `interlace(${word},${layers},${stride})`;
                const newData = ROMAssembly.encode(object.data, format);
                object.setData(newData[0]);
            };
            content.appendChild(okayButton);

            const cancelButton = document.createElement('button');
            cancelButton.innerHTML = 'Cancel';
            cancelButton.onclick = function() { closeModal(); };
            content.appendChild(cancelButton);
        };
        interlaceDiv.appendChild(interlaceButton);
        return interlaceDiv;
    }

    arrayLengthControlHTML(object, options) {
        // create a div for the control
        const controlDiv = document.createElement('div');
        controlDiv.classList.add('property-control-div');

        // length input
        const input = document.createElement('input');
        controlDiv.appendChild(input);
        input.id = options.controlID;
        input.type = 'number';
        input.classList.add('property-control');
        input.value = object.arrayLength.toString();
        input.min = object.min;
        input.max = object.max;
        input.onchange = function() {
            const value = Number(this.value);
            object.setLength(value);
            document.getElementById(this.id).focus();
        };

        return controlDiv;
    }

    arrayHTML(object, options = {}) {

        if (object.hidden || object.invalid) return null;

        if (options.key && object.key) {
            options.key += `-${object.key}`;
        } else {
            options.key = object.key || 'undefined';
        }
        if (isNumber(options.index)) options.key += `-${options.index}`;
        options.name = options.name || object.name;
        options.propertyID = `property-${options.key}`;
        options.controlID = `property-control-${options.key}`;
        options.labelID = `property-label-${options.key}`;

        const divs = [];

        // create the category (array heading)
        if (!options.parentOnly) {
            const categoryDiv = document.createElement('div');
            categoryDiv.classList.add('property-category');
            divs.push(categoryDiv);
            const category = document.createElement('p');
            if (!object.hideCategory) category.innerHTML = options.name;
            categoryDiv.appendChild(category);
        }

        // create the length control
        if (object.min !== object.max) {
            const lengthDiv = this.propertyHTML(object, {
                name: 'Array Size',
                index: options.index
            });
            divs.push(lengthDiv);
        }

        if (options.parentOnly) return divs;

        // create divs for each element in the array
        for (const element of object.iterator()) {
            const i = element.i;

            if (element instanceof ROMData) {
                const assemblyHTML = this.assemblyHTML(element, {
                    index: i, key: options.key
                });
                divs.push(...assemblyHTML);

            } else if (element instanceof ROMArray) {
                const arrayHTML = this.arrayHTML(element, {
                    index: i
                });
                divs.push(...arrayHTML);

            } else {
                const propertyHTML = this.propertyHTML(element, {
                    index: i, key: options.key
                });
                divs.push(propertyHTML);
            }
        }

        return divs;
    }

    specialControlHTML(object, options) {
        // create a div for the control
        const controlDiv = document.createElement('div');
        controlDiv.classList.add('property-control-div');

        // property with boolean flags
        const currentSpecial = object.getSpecialValue();

        if (!Object.keys(object.special).length) return null;
        for (const key in object.special) {
            const special = Number(key);
            if (!isNumber(special)) continue;
            const name = object.special[key];

            // create the check box
            const check = document.createElement('input');
            check.classList.add('property-check');
            check.value = special;
            check.type = 'checkbox';
            check.checked = (currentSpecial === special);
            check.id = `${options.controlID}-${special}`;
            check.onchange = function() {
                const valueArray = new Uint8Array(object.data.length);

                if (this.checked) {
                    // set value
                    for (let i = 0; i < 4; i++) valueArray[i] = this.value >> (i * 8);
                }
                object.setData(valueArray);
                document.getElementById(this.id).focus();
            }

            // create a label for the check box
            const label = document.createElement('label');
            label.classList.add('property-check-label');
            label.htmlFor = check.id;
            label.innerHTML = name;

            // create a div to hold the label and control
            const flagDiv = document.createElement('div');
            flagDiv.classList.add('property-check-div');
            flagDiv.appendChild(check);
            flagDiv.appendChild(label);
            controlDiv.appendChild(flagDiv);
        }

        return controlDiv;
    }

    updateLabels() {
        const labels = document.getElementsByClassName('property-label');
        let w = 0;
        let l;

        // reset all labels to their default size
        for (l = 0; l < labels.length; l++) labels[l].style.width = 'auto';

        // find the widest label
        for (l = 0; l < labels.length; l++) w = Math.max(w, labels[l].clientWidth);

        // make all labels the same width
        for (l = 0; l < labels.length; l++) labels[l].style.width = `${w}px`;

        // make all text controls the same height as the text
        const text = document.getElementsByClassName('property-textarea');
        for (const input of text) {
            input.style.height = `${input.scrollHeight}px`;
        }
    }

    getEditor(name) {
        if (this.editors[name]) return this.editors[name];

        const editorClass = eval(name);
        if (!editorClass) return null;
        const editor = new editorClass(this.rom);
        this.editors[name] = editor;
        return editor;
    }

    showEditor(object) {

        let editor;
        if (object.editor) {
            editor = this.getEditor(object.editor);
        } else if (object instanceof ROMGraphics) {
            editor = this.getEditor('ROMGraphicsView');
        } else if (object instanceof ROMTilemap) {
            editor = this.getEditor('ROMTilemapView');
        }
        if (!editor) return;

        // check if the editor is already active
        const editDiv = document.getElementById('edit-div');
        if (!editDiv.contains(editor.div)) {
            // hide the active editor
            this.hideEditor();

            // show the new editor
            this.activeEditor = editor;
            editDiv.innerHTML = '';
            editDiv.appendChild(editor.div);
            editor.show();
        }

        editor.selectObject(object);
    }

    hideEditor() {
        if (this.activeEditor && this.activeEditor.hide) this.activeEditor.hide();
    }
}

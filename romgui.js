// 
// romgui.js
// created 2/26/2019
// 

var romNavigator;
var propertyList;
var scriptList;

// ROMNavigator
function ROMNavigator(rom) {
    this.rom = rom;
    this.hierarchy = rom.hierarchy || ROMNavigator.defaultHierarchy;
    this.observer = new ROMObserver(this.rom, this, { sub: true, link: true, label: true });
    this.nav = document.getElementById("nav");
    this.updateList();
    this.node = {};
    this.selectedNode = null;
}

ROMNavigator.prototype.selectObject = function(object) {
    
    var li = this.node[object.path];
    if (!li) return;

    var newSelection = null;
    if (isNumber(object.i)) {
        newSelection = li.childNodes[object.i];
    } else {
        newSelection = li;
    }
    
    if (newSelection) {
        if (this.selectedNode) this.selectedNode.classList.remove("selected");
        this.selectedNode = newSelection;
        this.selectedNode.classList.add("selected");
    }
}

ROMNavigator.defaultHierarchy = [
    {
        "name": "Map",
        "list": [
            {
                "name": "Maps",
                "path": "mapProperties"
            }, {
                "name": "Map Titles",
                "path": "mapTitle"
            }, {
                "name": "Parallax",
                "path": "mapParallax"
            }, {
                "name": "Color Math",
                "path": "mapColorMath"
            }
        ]
    }, {
        "name": "Event",
        "list": [
            {
                "name": "Event Script",
                "path": "eventScript"
            }, {
                "name": "Dialog",
                "path": "dialog"
            }, {
                "name": "NPC Switches",
                "path": "stringTable.npcSwitches"
            }, {
                "name": "Map Switches",
                "path": "stringTable.mapSwitches"
            }
        ]
    }, {
        "name": "Battle",
        "list": [
            {
                "name": "Battles",
                "path": "battleProperties"
            }, {
                "name": "Monsters",
                "path": "monsterProperties"
            }
        ]
    }, {
        "name": "System",
        "list": [
            {
                "name": "SNES Header",
                "path": "snesHeader"
            }
        ]
    }
];

ROMNavigator.prototype.updateList = function() {
    this.nav.innerHTML = null;
    
    // create the main nav list
    var navList = document.createElement('ul');
    navList.classList.add("nav-list");
    this.nav.appendChild(navList);
    
    for (var i = 0; i < this.hierarchy.length; i++) {
        var definition = this.hierarchy[i];
        var category = this.liForCategory(definition);
        if (!category) continue;
        navList.appendChild(category);
    }
}

ROMNavigator.prototype.liForCategory = function(definition) {
    var self = this;
    var isLoaded = false;
    var category = document.createElement('li');
    category.classList.add("nav-category");
    category.onclick = function(e) {
        e.stopPropagation();
        this.classList.toggle("shown");
        
        if (isLoaded) return;
        
        var ul = document.createElement('ul');
        ul.classList.add('nav-list');
        category.appendChild(ul);

        for (var i = 0; i < definition.list.length; i++) {
            var options = definition.list[i] || {};

            if (!options.path) continue;

            var object = self.rom.parsePath(options.path);
            if (!object) continue;
            var li;
            if (object instanceof ROMArray) {
                li = self.liForArray(object, options);
            } else if (object instanceof ROMStringTable) {
                li = self.liForStringTable(object, options);
            } else {
                li = self.liForObject(object, options);
            }

            if (!li) continue;
            ul.appendChild(li);
        }
        isLoaded = true;
    }

    var p = document.createElement('p');
    var name = definition.name;
    if (!isString(name)) name = "Unnamed Category";
    if (!/\S/.test(name)) name = "&nbsp;";
    p.innerHTML = name;
    category.appendChild(p);
    
    return category;
}

ROMNavigator.prototype.liForObject = function(object, options) {

//    if (object instanceof ROMArray) return this.liForArray(object, options);
//    if (object instanceof ROMStringTable) return this.liForStringTable(object, options);
    
    var li = document.createElement("li");
    li.classList.add("nav-object")
    li.onclick = function(e) {
        e.stopPropagation();
        propertyList.select(object);
    }
    if (!this.node[object.path]) this.node[object.path] = li;
    
    var p = document.createElement('p');
    var name = options.name;
    if (!isString(name)) name = object.name;
//    if (!isString(name) && object instanceof ROMText) name = object.htmlText;
    if (object instanceof ROMText) name = object.htmlText;
    if (!isString(name)) name = "Unnamed Object";
    if (!/\S/.test(name)) name = "&nbsp;";
    p.innerHTML = name;
    li.appendChild(p);
        
    return li;
}

ROMNavigator.prototype.liForArray = function(array, options) {
    var li = document.createElement("li");
    li.classList.add("nav-array")
    li.onclick = function(e) {
        e.stopPropagation();
        this.classList.toggle("shown");
    }
    
    var p = document.createElement('p');
    var name = options.name;
    if (!isString(name)) name = array.name;
    if (!isString(name)) name = "Unnamed Array";
    if (!/\S/.test(name)) name = "&nbsp;";
    p.innerHTML = name;
    li.appendChild(p);
    
    var ul = document.createElement('ul');
    ul.classList.add("nav-list");
    if (!this.node[array.path]) this.node[array.path] = ul;
    
    for (var i = 0; i < array.array.length; i++) {
        var item = this.liForArrayItem(array, i);
        if (!item) continue;
        ul.appendChild(item);
    }
    li.appendChild(ul);

    return li;
}

ROMNavigator.prototype.liForArrayItem = function(array, i) {

    var object = array.item(i);
    if (!object) return null;
    
    var options = {};
    
    options.name = array.name + " " + i.toString();
    if (array.stringTable) {
        var stringTable = this.rom.stringTable[array.stringTable];
        if (stringTable && stringTable.string[i]) {
            options.name = stringTable.string[i].fString(40);
        }
    }
    
    var li = this.liForObject(object, options);
    
    var span = document.createElement('span');
    span.innerHTML = i.toString();
    span.classList.add("nav-object-index");
    li.insertBefore(span, li.firstChild);
//    var p = li.getElementsByTagName('p')[0];
//    p.insertBefore(span, p.firstChild);

    return li;
}

ROMNavigator.prototype.liForStringTable = function(stringTable, options) {
    var li = document.createElement("li");
    li.classList.add("nav-array")
    li.onclick = function(e) {
        e.stopPropagation();
        this.classList.toggle("shown");
    }

    var p = document.createElement('p');
    var name = options.name;
    if (!isString(name)) name = stringTable.name;
    if (!isString(name)) name = "Unnamed String Table";
    if (!/\S/.test(name)) name = "&nbsp;";
    p.innerHTML = name;
    li.appendChild(p);
    
    var ul = document.createElement('ul');
    ul.classList.add("nav-list");
    var path = "stringTable." + stringTable.key;
    if (!this.node[path]) this.node[path] = ul;
    
    for (var i = 0; i < stringTable.string.length; i++) {
        var item = this.liForString(stringTable, i);
        if (!item) continue;
        ul.appendChild(item);
    }
    li.appendChild(ul);

    return li;
}

ROMNavigator.prototype.liForString = function(stringTable, i) {
    
    if (!stringTable.string[i]) return null;
    
    var li = document.createElement("li");
    var span = document.createElement('span');
    span.innerHTML = i.toString();
    span.classList.add("nav-object-index");
    li.appendChild(span);
    
    li.classList.add("nav-object")
    li.onclick = function(e) {
        e.stopPropagation();
        propertyList.select(stringTable.string[i]);
    }
    
    var p = document.createElement('p');
    p.innerHTML = stringTable.string[i].htmlString();
    li.appendChild(p);
    
    return li;
}

// ROMPropertyList
function ROMPropertyList(rom) {
    this.rom = rom;
    this.observer = new ROMObserver(this.rom, this, { sub: true, link: true, label: true });
    this.selection = { current: null, previous: [], next: [] };
    this.editors = {};
}

ROMPropertyList.prototype.select = function(object) {

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

ROMPropertyList.prototype.selectPrevious = function() {
    var current = this.selection.current;
    var previous = this.selection.previous.pop();
    if (!previous) return;
    this.select(previous);
    this.selection.next.push(current);
}

ROMPropertyList.prototype.selectNext = function() {
    var current = this.selection.current;
    var next = this.selection.next.pop();
    if (!next) return;
    this.select(next);
    this.selection.previous.push(current);
}

ROMPropertyList.prototype.deselectAll = function() {
    // stop observing the previous selection
    if (this.selection.current) {
        this.selection.previous.push(this.selection.current);
        this.selection.next = [];
    }
    
    this.selection.current = null;
}

ROMPropertyList.prototype.showProperties = function() {
    
    // stop observing eveything
    this.observer.stopObservingAll();
    
    var properties = document.getElementById("properties");
    properties.innerHTML = "";
    
    var object = this.selection.current;
    if (!object) return;
    
    // show heading
    if (object.name) {
        var headingDiv = document.createElement('div');
        properties.appendChild(headingDiv);
        headingDiv.classList.add("property-heading");

        // array list
        if (object.parent instanceof ROMArray) {
            var array = object.parent;
            var list = document.createElement('select');
            headingDiv.appendChild(list);
            list.onchange = function() {
                var i = Number(list.value);
                propertyList.select(array.item(i))
            };

            // create an option for each valid string in the table
            var stringTable = rom.stringTable[array.stringTable];
            for (var i = 0; i < array.array.length; i++) {

                var optionString = i.toString() + ": ";
                if (stringTable && stringTable.string[i]) {
                    optionString += stringTable.string[i].fString(40);
                } else {
                    optionString += array.name + " " + i;
                }

                var option = document.createElement('option');
                option.value = i;
                option.innerHTML = optionString;
                list.appendChild(option);
            }
            list.value = object.i;
        }

        // object name
        var heading = document.createElement('p');
        headingDiv.appendChild(heading);
        heading.innerHTML = object.name.replace("%i", object.i);
    }
    
    // show object label (string table or script label)
    var labelHTML = this.labelHTML(object);
    if (labelHTML) {
        this.observer.startObserving(object.labelString, this.showProperties);
        properties.appendChild(labelHTML);
    }

    if (object instanceof ROMString && object.language) {
        // strings with multiple languages
        var language = object.language;
        var keys = Object.keys(language);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var linkString = language[key].link.replace("%i", object.i);
            var link = this.rom.parsePath(linkString);
            if (!link) continue;
            var propertyHTML = this.propertyHTML(link, {key: key, name: language[key].name});
            if (!propertyHTML) continue;
            properties.appendChild(propertyHTML);
            this.observer.startObserving(link, this.showProperties);
        }
        
    } else if (object instanceof ROMString && object.link) {
        // strings with only one languages
        var linkString = object.link.replace("%i", object.i);
        var link = this.rom.parsePath(linkString);
        if (!link) return;
        var propertyHTML = this.propertyHTML(link, {key: object.key, name: object.name});
        if (!propertyHTML) return;
        properties.appendChild(propertyHTML);
        this.observer.startObserving(link, this.showProperties);
        
    } else if ((object instanceof ROMProperty) || (object instanceof ROMText) || (object instanceof ROMString)) {
        // object with a single property
        var propertyHTML = this.propertyHTML(object);
        if (!propertyHTML) return;
        properties.appendChild(propertyHTML);
        this.observer.startObserving(object, this.showProperties);

    } else if (object instanceof ROMData || object instanceof ROMCommand) {
        // object with sub-assemblies
        var assemblyHTML = this.assemblyHTML(object);
        for (var i = 0; i < assemblyHTML.length; i++) {
            properties.appendChild(assemblyHTML[i]);
        }
        
    } else if (object instanceof ROMArray) {
        // object is an array
        var arrayHTML = this.arrayHTML(object);
        for (var i = 0; i < arrayHTML.length; i++) {
            properties.appendChild(arrayHTML[i]);
        }
        this.observer.startObserving(object, this.showProperties);
    }
    
    this.updateLabels();
}

ROMPropertyList.prototype.assemblyHTML = function(object, options) {
    
    options = options || {};
    
    var divs = [];
    if (!object.assembly) return divs;
    
    var keys = Object.keys(object.assembly);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];

        // category name
        if (isString(object.assembly[key])) {
            var categoryDiv = document.createElement('div');
            categoryDiv.classList.add("property-category");
            divs.push(categoryDiv);

            var category = document.createElement('p');
            category.innerHTML = object.assembly[key];
            categoryDiv.appendChild(category);
            continue;
        }

        if (object.assembly[key].invalid) continue;
        var assembly = object[key];
        if (!assembly) continue;

        if (assembly instanceof ROMArray) {
            // array of properties
            var arrayHTML = this.arrayHTML(assembly, {name: object.assembly[key].name, index: options.index});
            if (!arrayHTML) continue;
            divs = divs.concat(arrayHTML);
            this.observer.startObserving(assembly, this.showProperties);

        } else {
            // single property
            var propertyHTML = this.propertyHTML(assembly, {name: object.assembly[key].name, index: options.index});
            if (!propertyHTML) continue;
            divs.push(propertyHTML);
            this.observer.startObserving(assembly, this.showProperties);
        }
    }
    return divs;
}


ROMPropertyList.prototype.labelHTML = function(object) {
    
    var string;
    var defaultString;
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
    var labelDiv = document.createElement('div');
    labelDiv.classList.add("property-div");
    labelDiv.id = "label-" + object.key;
    var id = "label-control-" + object.key;
    
    // create a label for the label
    var label = document.createElement('label');
    label.htmlFor = id;
    label.classList.add("property-label");
    label.innerHTML = "Label:";
    labelDiv.appendChild(label);

    // create a div for the control(s)
    var controlDiv = document.createElement('div');
    labelDiv.appendChild(controlDiv);
    controlDiv.classList.add("property-control-div");
        
    // create a text box
    var input = document.createElement('input');
    controlDiv.appendChild(input);
    input.id = id;
    input.placeholder = defaultString;
    input.value = string.value || string;
    if (input.value === defaultString) input.value = "";
    input.classList.add("property-control");
    input.onchange = function() {
        if (object instanceof ROMCommand) {
            object.setLabel(input.value);
        } else if (input.value === "") {
            string.setValue(defaultString);
        } else {
            string.setValue(input.value);
        }
        document.getElementById(input.id).focus();
    };

    return labelDiv;
}

ROMPropertyList.prototype.propertyHTML = function(object, options) {
    if (object.hidden || object.invalid) return null;
    
    options = options || {};
    options.key = options.key || object.key || "undefined";
    options.name = options.name || object.name;
    if (options.index !== undefined) options.name += " " + options.index.toString();
    options.propertyID = "property-" + options.key;
    options.controlID = "property-control-" + options.key;
    options.labelID = "property-label-" + options.key;

    // create a label for the control
    var label;
    if (object instanceof ROMProperty && object.link) {
        // create a label with a link
        var link = object.link.replace("%i", object.value);
        label = document.createElement('a');
        label.href = "javascript:propertyList.select(\"" + link + "\");";
    } else if (object instanceof ROMProperty && object.script) {
        // create a label with a script link
        var script = this.rom[object.script];
        var command = script.ref[object.value];
        label = document.createElement('a');
        label.href = "javascript:propertyList.select(\"" + object.script + "\"); scriptList.selectRef(" + command.ref + ");";
    } else if (object instanceof ROMString && object.language) {
        label = document.createElement('a');
        label.href = "javascript:propertyList.select(\"stringTable." + object.parent.key + "[" + object.i + "]\");";
    } else {
        // create a normal label
        label = document.createElement('label');
        label.htmlFor = options.controlID;
    }
    label.classList.add("property-label");
    label.id = options.labelID;
    if (options.name) label.innerHTML = options.name + ":";
    options.label = label;

    // create a div for the control(s)
    var controlDiv;
    if (object instanceof ROMProperty && object.bool) {
        controlDiv = this.boolControlHTML(object, options);
        
    } else if (object instanceof ROMProperty && object.flag) {
        controlDiv = this.flagControlHTML(object, options);
        
    } else if (object instanceof ROMProperty && object.stringTable) {
        controlDiv = this.listControlHTML(object, options);
        
    } else if (object instanceof ROMProperty && object.script) {
        controlDiv = this.scriptControlHTML(object, options);
        
    } else if (object instanceof ROMProperty) {
        controlDiv = this.numberControlHTML(object, options);
        
    } else if (object instanceof ROMText) {
        controlDiv = this.textControlHTML(object, options);
        
    } else if (object instanceof ROMString) {
        controlDiv = this.stringControlHTML(object, options);
        
    } else if (object instanceof ROMArray) {
        controlDiv = this.arrayLengthControlHTML(object, options);
        
    } else {
        return null;
    }

    // create a div for the property
    var propertyDiv = document.createElement('div');
    propertyDiv.classList.add("property-div");
    propertyDiv.id = options.propertyID;
    propertyDiv.appendChild(label);
    propertyDiv.appendChild(controlDiv);
    
    return propertyDiv;
}

ROMPropertyList.prototype.boolControlHTML = function(object, options) {

    // create a div for the control
    var controlDiv = document.createElement('div');
    controlDiv.classList.add("property-control-div");

    // property with a single boolean checkbox
    var input = document.createElement('input');
    controlDiv.appendChild(input);
    input.id = options.controlID;
    input.type = "checkbox";
    input.checked = object.value;
    input.disabled = object.disabled;
    input.classList.add("property-check");
    input.onchange = function() {
        var value = this.checked;
        object.setValue(value);
        document.getElementById(this.id).focus();
    };
    
    // move the label to the right of the check box
    if (options.label) {
        // move the label to the right of the check box
        options.label.innerHTML = "";
        var label = document.createElement('label');
        label.classList.add("property-check-label");
        label.htmlFor = input.id;
        label.innerHTML = options.name || "";
        controlDiv.appendChild(label);
    }
    
    return controlDiv;
}

ROMPropertyList.prototype.flagControlHTML = function(object, options) {
    // create a div for the control
    var controlDiv = document.createElement('div');
    controlDiv.classList.add("property-control-div");

    // property with boolean flags
    var flagChecks = [];
    for (var i = 0, mask = 1; mask < (object.mask >> object.bit); i++, mask <<= 1) {

        // create the check box
        var check = document.createElement('input');
        check.classList.add("property-check");
        check.value = mask;
        check.type = "checkbox";
        check.checked = object.value & mask;
        check.disabled = object.disabled;
        check.id = options.controlID + "-" + i;
        check.onchange = function() {
            var value = object.value;
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
        var label = document.createElement('label');
        label.classList.add("property-check-label");
        label.htmlFor = check.id;
        if (object.stringTable) {
            var stringTable = this.rom.stringTable[object.stringTable];
            if (!stringTable.string[i]) continue;
            label.innerHTML += stringTable.string[i].fString();
        } else {
            label.innerHTML = i;
        }

        // create a div to hold the label and control
        var flagDiv = document.createElement('div');
        flagDiv.classList.add("property-check-div");
        flagDiv.appendChild(check);
        flagDiv.appendChild(label);
        flagChecks.push(check);
        controlDiv.appendChild(flagDiv);
    }

    // add check boxes for special values
    var specialValues = Object.keys(object.special);
    for (var i = 0; i < specialValues.length; i++) {
        var special = document.createElement('input');
        special.classList.add("property-check");
        special.id = options.controlID + "-special-" + i;
        special.disabled = object.disabled;
        special.type = "checkbox";
        special.checked = false;

        var key = specialValues[i];
        var value = Number(key);
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
        var label = document.createElement('label');
        label.classList.add("property-check-label");
        label.htmlFor = special.id;
        label.innerHTML = object.special[key];

        // create a div to hold the label and control
        var specialDiv = document.createElement('div');
        specialDiv.classList.add("property-check-div");
        specialDiv.appendChild(special);
        specialDiv.appendChild(label);
        controlDiv.appendChild(specialDiv);
    }
    
    return controlDiv;
}

ROMPropertyList.prototype.listControlHTML = function(object, options) {
    // create a div for the control
    var controlDiv = document.createElement('div');
    controlDiv.classList.add("property-control-div");

    // property with a drop down list of strings
    var input = document.createElement('select');
    controlDiv.appendChild(input);
    input.id = options.controlID;
    input.disabled = object.disabled;
    input.classList.add("property-control");
    input.onchange = function() {
        var value = Number(this.value);
        object.setValue(value);
        document.getElementById(this.id).focus();
    };

    // create an option for each valid string in the table
    var stringTable = this.rom.stringTable[object.stringTable];
    var min = (object.min * object.multiplier) + object.offset;
    var max = (object.max * object.multiplier) + object.offset;
    for (var i = min; i <= max; i += object.multiplier) {

        var optionString = "";
        if (!stringTable.hideIndex) {
            optionString += i.toString() + ": ";
        }
        if (object.special[i]) {
            optionString += object.special[i];
        } else if (stringTable.string[i]) {
            optionString += stringTable.string[i].fString(40);
        } else {
            continue;
        }

        var option = document.createElement('option');
        option.value = i;
        option.innerHTML = optionString;
        input.appendChild(option);
    }
    input.value = object.value;

    return controlDiv;
}

ROMPropertyList.prototype.scriptControlHTML = function(object, options) {
    // create a div for the control
    var controlDiv = document.createElement('div');
    controlDiv.classList.add("property-control-div");

    // property linked to a script
    var script = this.rom[object.script];
    var command = script.ref[object.value];
    var input = document.createElement('input');
    controlDiv.appendChild(input);
    input.classList.add("property-control");
    input.id = options.controlID;
    input.disabled = object.disabled;
    input.type = "text";
    input.classList.add("property-control");
    input.value = command.label;
    input.onchange = function() {
        var command = script.label[this.value];
        if (!command) return;
        object.setValue(command.ref);
        document.getElementById(this.id).focus();
    };

    return controlDiv;
}

ROMPropertyList.prototype.numberControlHTML = function(object, options) {
    // create a div for the control
    var controlDiv = document.createElement('div');
    controlDiv.classList.add("property-control-div");

    // property with a number only
    var input = document.createElement('input');
    controlDiv.appendChild(input);
    input.id = options.controlID;
    input.disabled = object.disabled;
    input.type = "number";
    input.classList.add("property-control");
    input.value = object.value.toString();
    input.step = object.multiplier;
    input.min = (object.min + object.offset) * object.multiplier;
    input.max = (object.max + object.offset) * object.multiplier;
    input.onchange = function() {
        var value = Number(this.value);
        value = Math.max(value, this.min);
        value = Math.min(value, this.max);
        value -= value % this.step;
        object.setValue(value);
        document.getElementById(this.id).focus();
    };

    // add check boxes for special values
    var specialValues = Object.keys(object.special);
    for (var i = 0; i < specialValues.length; i++) {
        var specialDiv = document.createElement('div');
        specialDiv.classList.add("property-check-div");
        controlDiv.appendChild(specialDiv);
        var special = document.createElement('input');
        specialDiv.appendChild(special);
        special.classList.add("property-check");
        special.id = input.id + "-special-" + i;
        special.disabled = object.disabled;
        special.type = "checkbox";
        special.checked = false;

        var key = specialValues[i];
        var value = (Number(key) + object.offset) * input.step;
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
        var label = document.createElement('label');
        specialDiv.appendChild(label);
        label.classList.add("property-check-label");
        label.htmlFor = special.id;
        label.innerHTML = object.special[key];
    }

    return controlDiv;
}

ROMPropertyList.prototype.textControlHTML = function(object, options) {
    // create a div for the control
    var controlDiv = document.createElement('div');
    controlDiv.classList.add("property-control-div");

    // create a text box
    var input = document.createElement(object.multiLine ? 'textarea' : 'input');
    controlDiv.appendChild(input);
    input.id = options.controlID;
    input.value = object.text;
    input.disabled = object.disabled;
    input.classList.add("property-control");
    input.classList.add(object.multiLine ? "property-textarea" : "property-text");
    input.onchange = function() {
        object.setText(this.value);
        document.getElementById(this.id).focus();
    };

    return controlDiv;
}

ROMPropertyList.prototype.stringControlHTML = function(object, options) {
    // create a div for the control
    var controlDiv = document.createElement('div');
    controlDiv.classList.add("property-control-div");

    // create a div for the string
    var stringDiv = document.createElement('div');
    stringDiv.classList.add("property-control-div");
    stringDiv.innerHTML = object.fString();
    stringDiv.id = options.controlID;
    controlDiv.appendChild(stringDiv);

    return controlDiv;
}

ROMPropertyList.prototype.arrayLengthControlHTML = function(object, options) {
    // create a div for the control
    var controlDiv = document.createElement('div');
    controlDiv.classList.add("property-control-div");

    // length input
    var input = document.createElement('input');
    controlDiv.appendChild(input);
    input.id = options.controlID;
    input.type = "number";
    input.classList.add("property-control");
    input.value = object.array.length.toString();
    input.min = object.min;
    input.max = object.max;
    input.onchange = function() {
        var value = Number(this.value);
        object.setLength(value);
        document.getElementById(this.id).focus();
    };
    
    return controlDiv;
}

ROMPropertyList.prototype.arrayHTML = function(object, options) {
    
    if (object.hidden || object.invalid) return null;
    
    options = options || {};
    options.key = options.key || object.key || "undefined";
    options.name = options.name || object.name;
    options.propertyID = "property-" + options.key;
    options.controlID = "property-control-" + options.key;
    options.labelID = "property-label-" + options.key;

    var divs = [];
    
    // create the category (array heading)
    var categoryDiv = document.createElement('div');
    categoryDiv.classList.add("property-category");
    divs.push(categoryDiv);
    var category = document.createElement('p');
    category.innerHTML = options.name;
    categoryDiv.appendChild(category);
    
    // create the length control
    if (object.min !== object.max) {
        var lengthDiv = this.propertyHTML(object, {name: "Array Size"});
        divs.push(lengthDiv);
    }
    
    // create divs for each element in the array
    for (var i = 0; i < object.array.length; i++) {
        var element = object.item(i);
        
        if (element instanceof ROMData) {
            var assemblyHTML = this.assemblyHTML(element, {index: i});
            divs = divs.concat(assemblyHTML);
            
        } else {
            var propertyHTML = this.propertyHTML(element, {index: i});
            divs.push(propertyHTML);
        }
    }

    return divs;
}

ROMPropertyList.prototype.updateLabels = function() {
    var labels = document.getElementsByClassName("property-label");
    var w = 0;
    var l;

    // reset all labels to their default size
    for (l = 0; l < labels.length; l++) labels[l].style.width = "auto";

    // find the widest label
    for (l = 0; l < labels.length; l++) w = Math.max(w, labels[l].clientWidth);

    // make all labels the same width
    for (l = 0; l < labels.length; l++) labels[l].style.width = w + "px";
    
    // make all text controls the same height as the text
    var text = document.getElementsByClassName("property-textarea");
    for (t = 0; t < text.length; t++) {
        var input = text[t];
        var height = input.scrollHeight;
        input.style.height = height + "px";
    }
}

ROMPropertyList.prototype.getEditor = function(name) {
    if (this.editors[name]) return this.editors[name];
    
    var editorClass = window[name];
    if (!editorClass) return null;
    editor = new editorClass(this.rom);
    this.editors[name] = editor;
    return editor;
}

ROMPropertyList.prototype.showEditor = function(object) {
    if (!object.editor) return;
    var editor = this.getEditor(object.editor);
    if (!editor) return;
    
    var editDiv = document.getElementById('edit-div');
    if (!editDiv.contains(editor.div)) {
        editDiv.innerHTML = "";
        editDiv.appendChild(editor.div);
    }

    editor.selectObject(object);
    
    // TODO: come up with a way to select any object in the navigator pane
//    if (object.editor.includes("Map")) {
//        selectMap(object.i);
//    } else if (object.editor.includes("Battle")) {
//        selectBattle(object.i);
//    }
}

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
//    this.menu.style.overflowY = "visible";
    
    var top = e.y;
    var height = this.menu.clientHeight;
    if (height + top > window.innerHeight) {
        top = window.innerHeight - height;
    }
    if (top < 0) {
        this.menu.style.height = (window.innerHeight - 10) + "px";
//        this.menu.style.overflowY = "auto";
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

ROMEditor.prototype.addZoom = function(zoom, onchange) {
    var zoomValue = document.createElement("div");
    zoomValue.id = "zoom-value";
    zoomValue.innerHTML = (zoom * 100).toString() + "%";
    this.editorControls.appendChild(zoomValue);

    var zoomRange = document.createElement("input");
    zoomRange.type = "range";
    zoomRange.id = "zoom";
    zoomRange.min = "-2";
    zoomRange.max = "2";
    zoomRange.step = "1";
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

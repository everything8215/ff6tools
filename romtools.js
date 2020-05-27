//
// romtools.js
// created 1/4/2018
//

// ROMObject
function ROMObject(rom, definition, parent) {

    this.rom = rom;
    this.type = definition.type;
    this.key = definition.key;
    this.name = definition.name;
    this.editor = definition.editor;
    this.parent = parent;
    this.observers = [];
}

ROMObject.Type = {
    array: "array",
    assembly: "assembly",
    command: "command",
    data: "data",
    graphics: "graphics",
    object: "object",
    property: "property",
    reference: "reference",
    rom: "rom",
    script: "script",
    scriptEncoding: "scriptEncoding",
    string: "string",
    stringTable: "stringTable",
    text: "text",
    textEncoding: "textEncoding"
};

// ROMObject factory method
ROMObject.create = function(rom, definition, parent) {
    switch (definition.type) {
    case ROMObject.Type.array:
        return new ROMArray(rom, definition, parent);
    case ROMObject.Type.assembly:
        return new ROMAssembly(rom, definition, parent);
    case ROMObject.Type.command:
        return new ROMCommand(rom, definition, parent);
    case ROMObject.Type.data:
        return new ROMData(rom, definition, parent);
    case ROMObject.Type.graphics:
        return new ROMGraphics(rom, definition, parent);
    case ROMObject.Type.property:
        return new ROMProperty(rom, definition, parent);
    case ROMObject.Type.reference:
        return new ROMReference(rom, definition, parent);
    case ROMObject.Type.rom:
        return new ROM(rom, definition, parent);
    case ROMObject.Type.script:
        return new ROMScript(rom, definition, parent);
    case ROMObject.Type.scriptEncoding:
        return new ROMScriptEncoding(rom, definition, parent);
    case ROMObject.Type.string:
        return new ROMString(rom, definition, parent);
    case ROMObject.Type.stringTable:
        return new ROMStringTable(rom, definition, parent);
    case ROMObject.Type.text:
        return new ROMText(rom, definition, parent);
    case ROMObject.Type.textEncoding:
        return new ROMTextEncoding(rom, definition, parent);
    default:
        return new ROMAssembly(rom, definition, parent);
    }
};

Object.defineProperty(ROMObject.prototype, "definition", { get: function() {
    var definition = {};

    definition.type = this.type;
    definition.key = this.key;
    definition.name = this.name;
    if (this.editor) definition.editor = this.editor;

    return definition;
}});

Object.defineProperty(ROMObject.prototype, "path", { get: function() {
    if (!this.parent || this.parent === this.rom) {
        return this.key;
    } else if (this.parent instanceof ROMArray) {
        return this.parent.path;
    } else if (this instanceof ROMCommand) {
        return "scriptEncoding." + this.encoding + "." + this.key;
    }
    return this.parent.path + "." + this.key;
}});

ROMObject.prototype.parseIndex = function(path, index) {
    if (!isNumber(index)) index = this.i;
    if (!isNumber(index)) index = this.value;
    if (isNumber(index)) path = path.replace(/%i/g, index.toString());
    return path;
}

ROMObject.prototype.parseSubscripts = function(path) {
    // parse array subscripts
    var subscripts = path.split("[");
    var parsedPath = "";
    for (var s = 0; s < subscripts.length; s++) {
        var subscript = subscripts[s];
        var end = subscript.indexOf(']');
        if (end === -1) {
            parsedPath += subscript;
            continue;
        }
        var subscriptString = subscript.substring(0, end);
        var i = Number(subscriptString);
        if (!isNumber(i)) i = this.parsePath(subscriptString);
        if (!isNumber(i)) {
            try {
                i = eval(subscriptString);
            } catch (e) {
                return null;
            }
        }
        parsedPath += "[" + i.toString() + "]" + subscript.substring(end + 1);
    }
    return parsedPath;
}

ROMObject.prototype.parsePath = function(path, relativeTo, index) {

    path = this.parseSubscripts(this.parseIndex(path, index));

    var object = relativeTo || this.rom;
    var components = path.split(".");
    for (var c = 0; c < components.length; c++) {

        var key = components[c];
        if (key === "this") {
            object = this;
            continue;
        } else if (!object) {
            return null;
        }

        var subStart = key.indexOf('[');
        var subEnd = key.indexOf(']');
        var subString = "";
        if (subStart !== -1) {
            subString = key.substring(subStart);
            key = key.substring(0, subStart);
        }

        object = object[key];
        if (!object) return null;

        // parse array subscripts
        while (true) {
            subStart = subString.indexOf('[');
            subEnd = subString.indexOf(']');
            if (subStart === -1 || subEnd < subStart) break;
            var sub = subString.substring(subStart + 1, subEnd);
            subString = subString.substring(subEnd + 1);
            var i = Number(sub);
//            if (!isNumber(i)) {
//                try {
//                    i = eval(sub);
//                } catch (e) {
//                    return null;
//                }
//            }
            if (object instanceof ROMArray) {
                // ROMArray entry
                object = object.item(i);
            } else if (object instanceof ROMStringTable) {
                // string table entry
                object = object.string[i];
            } else if (isArray(object)) {
                // js array
                object = object[i];
            } else {
                return null;
            }
        }
    }
    return object;
}

ROMObject.prototype.copy = function(parent) {
    return ROMObject.create(this.rom, this.definition, parent);
}

ROMObject.prototype.addObserver = function(object, callback, args) {
    if (this.getObserver(object)) return;
    this.observers.push({object: object, callback: callback, args: args, asleep: false});
}

ROMObject.prototype.removeObserver = function(object) {
    this.observers = this.observers.filter(function(observer) {
        return (observer.object !== object);
    });
}

ROMObject.prototype.notifyObservers = function() {
    this.observers.forEach(function(observer) {
        if (observer.asleep) return;
        observer.callback.apply(observer.object, observer.args);
    });
}

ROMObject.prototype.getObserver = function(object) {
    for (var o = 0; o < this.observers.length; o++) {
        if (this.observers[o].object === object) return this.observers[o];
    }
    return null;
}

// ROMAssembly
function ROMAssembly(rom, definition, parent) {

    ROMObject.call(this, rom, definition, parent);

    this.isLoaded = false;
    this.isDirty = false;

    // range
    this.range = ROMRange.parse(definition.range);

    // begin
    if (definition.begin) {
        var begin = Number(definition.begin);
        if (isNumber(begin)) {
            this.range.begin = begin;
            this.range.end = begin + 1;
        }
    }

    if (definition.end) {
        // end
        var end = Number(definition.end);
        if (isNumber(end)) {
            this.range.end = end;
        }

    } else if (definition.length) {
        // length
        var length = Number(definition.length);
        if (isNumber(length)) {
            this.range.end = this.range.begin + length;
        }
    }

    if (parent === rom) this.range = rom.mapRange(this.range);

    this.format = definition.format;
    this.external = definition.external;
    this.reference = definition.reference || [];
    this.align = Number(definition.align) || 1;
    this.canRelocate = definition.canRelocate || false;
    this._invalid = definition.invalid || false;
    this._hidden = definition.hidden || false;
    this._disabled = definition.disabled || false;
    this.pad = Number(definition.pad);
    if (!isNumber(this.pad)) this.pad = 0xFF;

    // create the string table
    if (isString(definition.stringTable)) {
        this.stringTable = definition.stringTable;
    } else if (definition.stringTable && rom !== this) {
        var stringTable = new ROMStringTable(this.rom, definition.stringTable);
        stringTable.key = this.path;
        if (!stringTable.name) stringTable.name = this.name;
        rom.stringTable[this.path] = stringTable;
        this.stringTable = this.path;
    }
}

ROMAssembly.prototype = Object.create(ROMObject.prototype);
ROMAssembly.prototype.constructor = ROMAssembly;

Object.defineProperty(ROMAssembly.prototype, "definition", { get: function() {
    var definition = Object.getOwnPropertyDescriptor(ROMObject.prototype, "definition").get.call(this);

    var range = this.range;
    if (this.parent === this.rom) range = this.rom.unmapRange(range);
    if (!range.isEmpty) definition.range = range.toString();

    if (this.stringTable) definition.stringTable = this.stringTable;
    if (this.format) definition.format = this.format;
    if (this.external) definition.external = this.external;
    if (this.align !== 1) definition.align = hexString(this.align);
    if (this.canRelocate) definition.canRelocate = true;
    if (this._invalid) definition.invalid = this._invalid;
    if (this._hidden) definition.hidden = this._hidden;
    if (this._disabled) definition.disabled = this._disabled;
    if (this.pad != 0xFF) { definition.pad = hexString(this.pad, 2); }

    definition.reference = [];
    for (var r = 0; r < this.reference.length; r++) {
        var reference = this.reference[r];
        // skip defined references (ones created automatically by scripts, etc.)
        if (reference instanceof ROMReference) continue;
        definition.reference.push(reference);
    }
    if (definition.reference.length === 0) delete definition.reference;

    return definition;
}});

Object.defineProperty(ROMAssembly.prototype, "assembledLength", { get: function() {

    // do a dummy assemble if lazy data is not valid
    if (!this.lazyData) this.assemble();

    return this.lazyData.length;
}});

Object.defineProperty(ROMAssembly.prototype, "labelString", { get: function() {
    if (!this.parent) return null;
    if (this.parent === this.rom) return null;
    var i = Number(this.i);
    if (!isNumber(i)) return null;
    if (!this.parent.stringTable) return null;
    var stringTable = this.rom.stringTable[this.parent.stringTable];
    if (!stringTable) return null;
    return stringTable.string[i];
}});

// invalid: assembly is not shown in property view and will not be assembled
Object.defineProperty(ROMAssembly.prototype, "invalid", { get: function() {
    if (isString(this._invalid)) return eval(this._invalid);
    return this._invalid;
}, set: function(invalid) {
    this._invalid = invalid;
}});

// hidden: assembly is not shown in property view but will still get assembled
Object.defineProperty(ROMAssembly.prototype, "hidden", { get: function() {
    if (isString(this._hidden)) return eval(this._hidden);
    return this._hidden;
}, set: function(hidden) {
    this._hidden = hidden;
}});

// disabled: assembly is disabled in property view and will not be assembled
Object.defineProperty(ROMAssembly.prototype, "disabled", { get: function() {
    if (isString(this._disabled)) return eval(this._disabled);
    return this._disabled;
}, set: function(disabled) {
    this._disabled = disabled;
}});

ROMAssembly.prototype.assemble = function(data) {

    // skip external assemblies
    if (this.external) return;

    // encode the data if needed
    if (!this.lazyData) {
        var encodedData = ROMAssembly.encode(this.data, this.format);
        this.data = this.data.subarray(0, encodedData[1])
        this.lazyData = encodedData[0];
    }

    // return if just updating lazyData (no data parameter)
    if (!data) return false;

    // check if assembly won't fit in its range
    var success = true;
    if (this.assembledLength > this.range.length) {
        // truncate the data to fit
        data.set(this.lazyData.subarray(0, this.range.length), this.range.begin);

        // return false if assembly overflowed its range
        success = false;
    } else {
//        if (this.lazyData.length + this.range.begin > data.length) return false;
        data.set(this.lazyData, this.range.begin);
    }

    this.updateReferences();
    return success;
}

ROMAssembly.prototype.disassemble = function(data) {

    if (this.external) return;

    if (!this.range) this.range = new ROMRange(0, 0);
    var range = this.range;

    // if there is no data parameter, disassemble from current data
    if (!data) return;

    // validate the range vs. the input data
    if (range.begin > data.length) {
        // beginning of range is past the end of the data
//        this.rom.log("Invalid range " + range + " for data of length " + data.length);
        range.begin = 0;
        range.end = 0;
    } else if (range.end > data.length) {
        // end of range is past the end of the data
//        this.rom.log("Range " + range + " exceeds data length " + hexString(data.length, 6));
        range.end = data.length;
    }

    // copy the appropriate range of data
    this.lazyData = data.slice(range.begin, range.end);

    // decode the data
    var decodedData = ROMAssembly.decode(this.lazyData, this.format);
    this.data = decodedData[0];
    this.isLoaded = true;

    // trim the raw data if needed
    this.range.length = decodedData[1];
    this.lazyData = this.lazyData.subarray(0, this.range.length);
}

ROMAssembly.prototype.updateReferences = function() {
    for (var r = 0; r < this.reference.length; r++) {
        var reference = this.reference[r];
        if (!(reference instanceof ROMReference)) {
            // reference stored as definition
            reference = new ROMReference(this.rom, reference, this);
        }
        if (reference.update) reference.update();
    }
}

ROMAssembly.prototype.relocate = function(begin, end) {
    // this should be the only way to modify an assembly's range
    var oldBegin = this.range.begin;
    if (!isNumber(begin)) begin = oldBegin;
    if (!isNumber(end)) end = begin + this.assembledLength;

    // update the range
    this.range = new ROMRange(begin, end);
    if (begin === oldBegin) return;

    // log relocation if this is a direct child of the rom
    if (this.parent === this.rom) {
        this.rom.log("Relocating " + this.name + " from " +
             hexString(this.rom.unmapAddress(oldBegin)) + " to " +
             hexString(this.rom.unmapAddress(begin)));
    }

    // update references if the assembly moved
    // (this might be redundant since references get updated during assembly)
    this.updateReferences();
}

ROMAssembly.encode = function(data, format) {
    // return if the data is not compressed
    if (!format) return [data, data.length];

    if (isArray(format)) {
        // multi-pass encoding format
        var firstPass = ROMAssembly.encode(data, format[0]);
        data = [firstPass[0], 0];
        for (var i = 1; i < format.length; i++) {
            data = ROMAssembly.encode(data[0], format[i]);
        }
        return [data[0], firstPass[1]];
    }

    // parse the format name
    var formatName = format.match(/[^\(]+/);
    if (!isArray(formatName)) return [data, data.length];
    formatName = formatName[0];
    var f = ROM.dataFormat[formatName];
    if (!f) return [data, data.length];

    // parse arguments
    var args = [data];
    var argsList = format.match(/\([^\)]+\)/);
    if (isArray(argsList)) {
        argsList = argsList[0];
        argsList = argsList.substring(1, argsList.length - 1).split(",");
        argsList.forEach(function(arg, i) {
            args.push(Number(arg));
        });
    }
    return f.encode.apply(null, args);
}

ROMAssembly.decode = function(data, format) {
    // return if the data is not compressed
    if (!format) return [data, data.length];

    if (isArray(format)) {
        // multi-pass encoding format
        format = format.slice().reverse();
        var firstPass = ROMAssembly.decode(data, format[0]);
        data = [firstPass[0], 0];
        for (var i = 1; i < format.length; i++) {
            data = ROMAssembly.decode(data[0], format[i]);
        }
        return [data[0], firstPass[1]];
    }

    // parse the format name
    var formatName = format.match(/[^\(]+/);
    if (!isArray(formatName)) return [data, data.length];
    formatName = formatName[0];
    var f = ROM.dataFormat[formatName];
    if (!f) return [data, data.length];

    // parse arguments
    var args = [data];
    var argsList = format.match(/\([^\)]+\)/);
    if (isArray(argsList)) {
        argsList = argsList[0];
        argsList = argsList.substring(1, argsList.length - 1).split(",");
        argsList.forEach(function(arg, i) {
            args.push(Number(arg));
        });
    }
    return f.decode.apply(null, args);
}

ROMAssembly.prototype.markAsDirty = function(noUpdate) {
    if (this.external) return;
    if (!noUpdate) this.lazyData = null;
    this.isDirty = true;
    if (this.parent && this.parent.markAsDirty) this.parent.markAsDirty(noUpdate);
}

ROMAssembly.prototype.setData = function(newData, offset) {

    if (this.external) return;

    if (!isNumber(offset)) offset = 0;

    // return if the array didn't change
    var oldData = this.data.slice(offset, offset + newData.length);
    if (compareTypedArrays(oldData, newData)) return;

    // perform an action to set the array
    var assembly = this;
    function redo() {
        assembly.data.set(newData, offset);
        assembly.disassemble();
        assembly.notifyObservers();
    }
    function undo() {
        assembly.data.set(oldData, offset);
        assembly.disassemble();
        assembly.notifyObservers();
    }
    var description = "Set " + this.name + " data [" + offset + "-" + (offset + newData.length) + "]";
    var action = new ROMAction(this, undo, redo, description);
    this.rom.doAction(action);
}

// ROMReference
function ROMReference(rom, definition, parent) {
    ROMObject.call(this, rom, definition, parent);
    this.type = ROMObject.Type.reference;

    // options to determine the value and how to write it
    this.options = definition.options || definition;
    if (this.options.bankByte) this.options.multiplier = 0x010000;

    // the parent is the source of the value
    if (isString(definition.parent)) {
        this.parent = this.rom.parsePath(definition.parent) || eval(definition.parent);
    } else {
        this.parent = definition.parent || parent;
    }

    // the target is the object that the reference will be written to (default is the rom itself)
    if (isString(definition.target)) {
        this.target = this.parent.parsePath(definition.target) || eval(definition.target);
    } else {
        this.target = definition.target || this.rom;
    }

    if (!this.parent || !this.target) this.rom.log("Invalid Reference: Parent or target is missing.");
}

ROMReference.prototype = Object.create(ROMObject.prototype);
ROMReference.prototype.constructor = ROMReference;

ROMReference.prototype.update = function() {
    // calculate the reference value and write it to the target
    var value = 0;

    if (this.options.arrayLength && this.parent instanceof ROMArray) {
        // the value is the length of the array
        value = this.parent.arrayLength;

    } else if (this.options.dataLength && this.parent instanceof ROMAssembly) {
        // the value is the length of the parent's data
        value = this.parent.assembledLength;

    } else if (this.options.eval) {
        // generic value that can be evaluated at run-time
        value = eval(this.options.eval);

    } else if (this.options.fixed) {
        // fixed value
        value = Number(this.options.fixed)

//    } else if (this.options.pointerOffset) {
//        // pointer offset (always unmapped)
//        value = Number(this.parent.pointerOffset)

    } else {
        if (this.options.rangeEnd) {
            // end of the parent's range
            value = this.parent.range.end;
        } else if (this.options.pointerOffset) {
            // pointer offset
            value = this.parent.pointerOffset;
        } else {
            // beginning of the parent's range (default)
            value = this.parent.range.begin;
        }

        if (this.options.relativeTo) value += this.options.relativeTo.range.begin;

        if (this.options.isMapped) {
            // unmap pointers (target is usually a pointer table)
            value = this.rom.unmapAddress(value);
        } else if (this.target.unmapAddress) {
            // unmap references (target is usually the rom)
            value = this.target.unmapAddress(value);
        }

//        if (this.target === this.rom) {
//            value = this.rom.unmapAddress(value);
//        } else if (this.options.isAbsolute) {
//            // this is sort of a temporary fix for 4-byte absolute gba pointers
//            value += this.rom.unmapAddress(this.options.relativeTo.range.begin);
//        } else if (this.options.relativeTo) {
//            // address is relative to the address of some other assembly
//            value += this.options.relativeTo.range.begin;
//        }
    }

    this.value = value;
}

Object.defineProperty(ROMReference.prototype, "value", { get: function() {
    // get the current value from the target
    var value = 0
    if (this.target instanceof ROMProperty) {
        value = this.target.value;
    } else if (this.target instanceof ROMAssembly) {
        var property = new ROMProperty(this.rom, this.options, this.target);
        property.disassemble(this.target.data);
        value =  property.value;
    }
    return value;

}, set: function(value) {
    // write a value to the target
    if (this.target instanceof ROMProperty) {
        if (this.target.value === value) return;
        this.target.value = value;
        this.target.markAsDirty();
    } else if (this.target instanceof ROMAssembly) {
        var property = new ROMProperty(this.rom, this.options, this.target);
        property.disassemble(this.target.data);
        if (property.value === value) return;
        property.value = value;
        property.assemble(this.target.data);
        this.target.markAsDirty();
    }
}});

// ROMGraphics
function ROMGraphics(rom, definition, parent) {
    ROMAssembly.call(this, rom, definition, parent);

    this.palette = definition.palette;
    this.width = definition.width; // width in 8x8 tiles
    this.backColor = (definition.backColor === true);
}

ROMGraphics.prototype = Object.create(ROMAssembly.prototype);
ROMGraphics.prototype.constructor = ROMGraphics;

Object.defineProperty(ROMGraphics.prototype, "definition", { get: function() {
    var definition = Object.getOwnPropertyDescriptor(ROMAssembly.prototype, "definition").get.call(this);

    if (this.palette) definition.palette = this.palette;
    if (this.width) definition.width = this.width;
    if (this.backColor) definition.backColor = true;

    return definition;
}});

// ROMData
function ROMData(rom, definition, parent) {
    ROMAssembly.call(this, rom, definition, parent);

    this.freeSpace = [];
    if (isArray(definition.freeSpace)) {
        for (var r = 0; r < definition.freeSpace.length; r++) {
            var freeRange = ROMRange.parse(definition.freeSpace[r]);
            if (freeRange.isEmpty) continue;
            if (this.mapRange) freeRange = this.mapRange(freeRange);
            this.addFreeSpace(freeRange);
        }
    }

    this.assembly = {};
    this.orphans = null;
    this.special = definition.special || {};
    this.isSequential = definition.isSequential || false;
    this.expandMode = definition.expandMode || ROMData.ExpandMode.truncate;

    // return if there are no sub-assemblies
    if (!definition.assembly) return;
    var keys = Object.keys(definition.assembly);
    if (!keys) return;

    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (!isString(key)) continue;
        var assemblyDefinition = definition.assembly[key];
        if (isString(assemblyDefinition)) {
            // add a category
            this.assembly[key] = assemblyDefinition;
            continue;
        }
        if (!assemblyDefinition.type) assemblyDefinition.type = ROMObject.Type.assembly;
        assemblyDefinition.key = key;
        this.addAssembly(assemblyDefinition);
    }
}

ROMData.prototype = Object.create(ROMAssembly.prototype);
ROMData.prototype.constructor = ROMData;

ROMData.ExpandMode = {
    manual: "manual",
    truncate: "truncate",
    overwrite: "overwrite",
    relocate: "relocate",
    optimize: "optimize",
    expand: "expand"
}

Object.defineProperty(ROMData.prototype, "definition", { get: function() {
    var definition = Object.getOwnPropertyDescriptor(ROMAssembly.prototype, "definition").get.call(this);

    // free space
    if (this.freeSpace.length) {
        definition.freeSpace = [];
        for (var r = 0; r < this.freeSpace.length; r++) {
            var freeRange = this.freeSpace[r];
            if (this.unmapRange) freeRange = this.unmapRange(freeRange);
            definition.freeSpace.push(freeRange.toString());
        }
    }

    if (this.isSequential) definition.isSequential = true;
    if (Object.keys(this.special).length != 0) definition.special = this.special;

    var keys = Object.keys(this.assembly);
    if (keys.length === 0) return definition;

    // add sub-assembly definitions
    definition.assembly = {};
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var assembly = this.assembly[key];

        // strings are category names (not actual assemblies)
        if (isString(assembly)) {
            definition.assembly[key] = assembly;
            continue;
        }

        // don't include pointer tables (they will be defined by their array)
        if (assembly.key.endsWith("PointerTable")) continue;

        // don't include array fragments either
        if (assembly.fragment) continue;

        var assemblyDefinition = assembly.definition;

        if (!assemblyDefinition) continue;
        delete assemblyDefinition.key; // key is implied
        definition.assembly[key] = assemblyDefinition;
    }
    return definition;
}});

ROMData.prototype.updateReferences = function() {

    // update references for children
    var keys = Object.keys(this.assembly);
    for (var i = 0; i < keys.length; i++) {
        var assembly = this.assembly[keys[i]];
        if (!assembly.updateReferences || !assembly.isDirty || assembly.invalid || assembly.disabled) continue;
        assembly.updateReferences();
    }

    ROMAssembly.prototype.updateReferences.call(this);
}

ROMData.prototype.assemble = function(data) {

    // ignore subassemblies if there is a special value
    if (this.getSpecialValue() !== null) return ROMAssembly.prototype.assemble.call(this, data);

    // assemble children
    var keys = Object.keys(this.assembly);

    if (this.isSequential) {
        // put assemblies in order, back to back
        var length = 0;
        var self = this;
        keys.sort(function(a, b) {
            var assembly1 = self[a];
            var assembly2 = self[b];
            return assembly1.range.begin - assembly2.range.begin;
        });
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var assembly = this[key];
            if (!assembly.assemble || assembly.invalid || assembly.disabled) continue;
            assembly.relocate(length);
            assembly.markAsDirty();
            length += assembly.assembledLength;
        }
        if (length > this.data.length) {
            // data got longer
            var newData = new Uint8Array(length);
            newData.set(this.data);
            this.data = newData;
            this.markAsDirty();
        } else if (length < this.data.length) {
            // data got shorter
            this.data = this.data.subarray(0, length);
            this.markAsDirty();
        }
    }

    var dirtyAssemblies = [];
    this.orphans = [];

    // for optimize mode, mark all relocateable assemblies as dirty
    if (this.expandMode === ROMData.ExpandMode.optimize) {
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var assembly = this.assembly[key];
            if (!assembly.canRelocate) continue;

            this[key]; // this ensures that the assembly is loaded
            assembly.markAsDirty();
            this.orphans.push(assembly);
            dirtyAssemblies.push(assembly);
            this.addFreeSpace(assembly.range);
        }
    }

    // make an array of dirty assemblies and orphans
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var assembly = this.assembly[key];

        // we already dealt with assemblies for optimize mode
        if (this.expandMode === ROMData.ExpandMode.optimize && assembly.canRelocate) continue;

        // skip invalid and disabled assemblies
        if (!assembly.assemble || !assembly.isDirty || assembly.invalid || assembly.disabled) continue;
        dirtyAssemblies.push(assembly);

        // adjust the assembly's range
        var newRange = new ROMRange(assembly.range.begin, assembly.range.begin + assembly.assembledLength);
        this.addFreeSpace(assembly.range);
        if (this.expandMode === ROMData.ExpandMode.overwrite) {
            // overwrite adjacent data
            assembly.relocate(newRange.begin);
        } else {
            // truncate to size of free space
            newRange = this.rangeIsFree(newRange);
            assembly.relocate(newRange.begin, newRange.end);
        }

        // check if the assembly fits
        if (assembly.range.length < assembly.assembledLength) {
            this.orphans.push(assembly);
        } else {
            this.removeFreeSpace(assembly.range);
        }
    }

    // resolve orphans
    if (!this.orphans.length) this.orphans = null;
    var success = this.resolveOrphans();

    // assemble all dirty assemblies
    for (var i = 0; i < dirtyAssemblies.length; i++) {
        var assembly = dirtyAssemblies[i];

        if (assembly.assemble(this.data)) {
            // assembled successfully
            assembly.isDirty = false;
        } else {
            // failed to assemble
            success = false;
        }
    }

    // pad free space
    // commenting this out because it was causing issues when using a previously edited ROM
//    this.padFreeSpace();

    return ROMAssembly.prototype.assemble.call(this, data) && success;
}

ROMData.prototype.resolveOrphans = function() {

    // make sure there are actually some orphans
    if (!isArray(this.orphans) || !this.orphans.length) return true;

    // don't bother relocating if we are truncating or overwriting
    if (this.expandMode === ROMData.ExpandMode.overwrite || this.expandMode === ROMData.ExpandMode.truncate)
        return false;

    // sort orphans by assembled length (largest to smallest)
    this.orphans.sort(function(a, b) { return b.assembledLength - a.assembledLength; });

    var success = true;

    var remainingOrphans = [];

    // try to find new homes for relocateable assemblies
    for (var o = 0; o < this.orphans.length; o++) {
        var assembly = this.orphans[o];

        // always return false if one of the assemblies can't be relocated
        if (!assembly.canRelocate) {
            success = false;
            continue;
        }

        // look for a new range
        var range = this.findFreeSpace(assembly.assembledLength, assembly.align);
        if (range.isEmpty) {
            // unable to relocate assembly
            this.rom.log("Unable to relocate assembly: " + assembly.name);
            remainingOrphans.push(assembly);
            success = false;
        } else {
            // relocate and assemble
            assembly.relocate(range.begin);
        }
        this.removeFreeSpace(assembly.range);
    }

    this.orphans = remainingOrphans;

    return success;
}

ROMData.prototype.addAssembly = function(definition) {
    var key = definition.key;
    if (!key) return;
    var assembly = ROMObject.create(this.rom, definition, this);
    assembly.parent = this;
    this.assembly[key] = assembly;

    // create a lazy getter function for this assembly
    function getter(assembly) {
        return function() {
            if (assembly.external) {
                return this.parsePath(assembly.external);
            } else if (!assembly.isLoaded && assembly.disassemble) {
                // disassemble this assembly if it hasn't been loaded yet
                if (this.isSequential && assembly.range.length === 1) assembly.range.end = this.range.length;
                assembly.disassemble(this.data);
            }
            return assembly;
        }
    }

    Object.defineProperty(this, key, { get: getter(assembly), configurable: true });
    return assembly;
}

ROMData.prototype.addFreeSpace = function(freeRange) {

    if (!(freeRange instanceof ROMRange)) return;

    // copy the range
    freeRange = new ROMRange(freeRange.begin, freeRange.end);
    this.freeSpace.push(freeRange);
    this.cleanUpFreeSpace();
}

ROMData.prototype.removeFreeSpace = function(range) {
    var newFreeSpace = [];
    for (var i = 0; i < this.freeSpace.length; i++) {
        var overlap = this.freeSpace[i];
        if (overlap.contains(range.begin)) {
            var topRange = new ROMRange(overlap.begin, range.begin);
            if (!topRange.isEmpty) newFreeSpace.push(topRange);
            overlap.begin = Math.min(overlap.end, range.end);
        } else if (overlap.contains(range.end)) {
            var bottomRange = new ROMRange(range.end, overlap.end);
            if (!bottomRange.isEmpty) newFreeSpace.push(bottomRange);
            overlap.end = Math.max(overlap.begin, range.begin);
        }
    }
    this.freeSpace = this.freeSpace.concat(newFreeSpace);
    this.cleanUpFreeSpace();
}

ROMData.prototype.cleanUpFreeSpace = function() {
    if (this.freeSpace.length < 2) return;

    // sort the ranges (lowest to highest)
    this.freeSpace.sort(function(a, b) { return a.begin - b.begin; });

    // make a new clean array, combining adjacent ranges and eliminating overlaps
    var cleanSpace = [];
    for (var i = 0; i < this.freeSpace.length; i++) {
        var range1 = this.freeSpace[i];
        if (!range1 || range1.isEmpty) continue;
        for (var j = i + 1; j < this.freeSpace.length; j++) {
            var range2 = this.freeSpace[j];
            if (range2.isEmpty) continue;

            // break if not adjacent or overlapping
            if (range1.end < range2.begin) break;

            // combine the two ranges
            range1.end = Math.max(range1.end, range2.end);
            range2.end = range2.begin;
        }
//        range1.end = Math.min(range1.end, this.data.length);
        if (range1.isEmpty) continue;
        cleanSpace.push(range1);
    }

    this.freeSpace = cleanSpace;
    if (!this.freeSpace.length) this.freeSpace = null;
}

ROMData.prototype.padFreeSpace = function() {
//    if (!this.freeSpace || !this.freeSpace.length) return;

    for (var i = 0; i < this.freeSpace.length; i++) {
        var range = this.freeSpace[i];
        for (var d = range.begin; d < range.end; d++) {
            this.data[d] = this.pad;
        }
    }
}

ROMData.prototype.findFreeSpace = function(length, align) {

    align = align || 1;
    var bestRange = ROMRange.emptyRange;
    var bankSize = this.rom.bankSize();

    // find the smallest range of free space that is at least as large as required
    for (var i = 0; i < this.freeSpace.length; i++) {
        var range = this.freeSpace[i];
        if (range.length < length) continue;

        var begin = range.begin;

        // align the range
        var rawAddress = begin;
        if (this.unmapAddress) rawAddress = this.unmapAddress(rawAddress);
        if (align !== 1 && rawAddress % align) begin += Math.floor(rawAddress / align + 1) * align - rawAddress;

        // this doesn't work for world of ruin tile layout so i commented it out
//        // if the data is smaller than one bank, make sure it doesn't straddle two banks
//        if (length < bankSize) {
//            var nextBankOffset = Math.ceil(rawAddress / bankSize) * bankSize - rawAddress;
//            if (nextBankOffset < length) begin += nextBankOffset;
//        }

        range = new ROMRange(begin, range.end);
        if (range.length < length) continue;

        // find the smallest available range larger than the required length
        if (bestRange.isEmpty || range.length < bestRange.length) bestRange = range;
    }
    return bestRange;
}

ROMData.prototype.rangeIsFree = function(range) {
    for (var i = 0; i < this.freeSpace.length; i++) {
        var intersection = this.freeSpace[i].intersection(range);
        if (!intersection.isEmpty) return intersection;
    }
    return ROMRange.emptyRange;
}

ROMData.prototype.getSpecialValue = function() {

    // assemble all sub-assemblies to validate data
//    this.assemble();

    // check each special value
    var keys = Object.keys(this.special);
    for (var s = 0; s < keys.length; s++) {
        var key = keys[s];
        var special = Number(key);
        if (!isNumber(special)) continue;

        // convert the special value to a Uint8Array
        var buffer = new Uint8Array(this.data.length);
        for (var i = 0; i < 4; i++) buffer[i] = (special >> (i * 8)) & 0xFF;
        if (compareTypedArrays(this.data, buffer)) return special;
    }
    return null;
}

ROMData.prototype.setSpecialValue = function(value) {

    // check each special value
    var keys = Object.keys(this.special);
    for (var s = 0; s < keys.length; s++) {
        var key = keys[s];
        var special = Number(key);
        if (!isNumber(special)) continue;

        // compare to the value parameter
        if (special !== value) continue;

        // convert the special value to a Uint8Array
        var buffer = new Uint8Array(this.data.length);
        for (var i = 0; i < 4; i++) buffer[i] = (special >> (i * 8)) & 0xFF;
        this.setData(buffer);
        break;
    }
}

// ROM
function ROM(rom, definition) {

    this.crc32 = Number(definition.crc32);
    this.system = definition.system;
    this.mode = definition.mode;
    this.pointerLength = Number(definition.pointerLength);
    if (!isNumber(this.pointerLength)) { this.pointerLength = 2; }

    var i, key, keys;

    // create hierarchy
    this.hierarchy = definition.hierarchy;

    // copy character tables
    this.charTable = {};
    if (definition.charTable) {
        keys = Object.keys(definition.charTable);
        for (i = 0; i < keys.length; i++) {
            key = keys[i];
            definition.charTable[key].key = key;
            this.charTable[key] = new ROMCharTable(this, definition.charTable[key], this);
        }
    }

    // create text encodings
    this.textEncoding = {};
    if (definition.textEncoding) {
        keys = Object.keys(definition.textEncoding);
        for (i = 0; i < keys.length; i++) {
            key = keys[i];
            definition.textEncoding[key].key = key;
            this.textEncoding[key] = new ROMTextEncoding(this, definition.textEncoding[key], this);
        }
    }

    // load string tables
    this.stringTable = {};
    if (definition.stringTable) {
        keys = Object.keys(definition.stringTable);
        for (i = 0; i < keys.length; i++) {
            key = keys[i];
            definition.stringTable[key].key = key;
            var stringTable = new ROMStringTable(this, definition.stringTable[key], this);
            stringTable.key = key;
            this.stringTable[key] = stringTable;
        }
    }

    // create script encodings
    this.scriptEncoding = {};
    if (definition.scriptEncoding) {
        keys = Object.keys(definition.scriptEncoding);
        for (i = 0; i < keys.length; i++) {
            key = keys[i];
            definition.scriptEncoding[key].key = key;
            this.scriptEncoding[key] = new ROMScriptEncoding(this, definition.scriptEncoding[key], this);
        }
    }

    this.undoStack = [];
    this.redoStack = [];
    this.action = null;
    this.actionDepth = 0;

    // create the assemblies
    ROMData.call(this, this, definition);
}

ROM.prototype = Object.create(ROMData.prototype);
ROM.prototype.constructor = ROM;

Object.defineProperty(ROM.prototype, "definition", { get: function() {
    var definition = Object.getOwnPropertyDescriptor(ROMData.prototype, "definition").get.call(this);

    delete definition.range;
    definition.length = hexString(this.data.length);
    definition.crc32 = hexString(ROM.crc32(this.data), 8);
    definition.system = this.system;
    definition.mode = this.mode;
    if (this.pointerLength != 2) { definition.pointerLength = this.pointerLength; }

    var keys, key;

    // create hierarchy
    definition.hierarchy = this.hierarchy;

    // create character table definitions
    definition.charTable = {};
    keys = Object.keys(this.charTable);
    for (i = 0; i < keys.length; i++) {
        key = keys[i];
        definition.charTable[key] = this.charTable[key].definition;
    }

    // create text encoding definitions
    definition.textEncoding = {};
    keys = Object.keys(this.textEncoding);
    for (i = 0; i < keys.length; i++) {
        key = keys[i];
        definition.textEncoding[key] = this.textEncoding[key].definition;
    }

    // create string table definitions
    definition.stringTable = {};
    keys = Object.keys(this.stringTable);
    for (var i = 0; i < keys.length; i++) {
        key = keys[i];

        // skip script command string tables, they are included
        // in the script encoding definition already
        if (key.startsWith("scriptEncoding")) continue;

        var stringTable = this.stringTable[key];

        // append the string table if it doesn't belong to a sub-assembly
        if (!key.includes(".")) {
            definition.stringTable[key] = stringTable.definition;
            continue;
        }

        // find the sub-assembly definition
        var components = key.split(".");
        var subDefinition = definition;
        for (var c = 0; c < components.length; c++) {
            if (!subDefinition) break;
            while (subDefinition.assembly) subDefinition = subDefinition.assembly;
            key = components[c];
            subDefinition = subDefinition[key];
        }

        if (subDefinition) subDefinition.stringTable = stringTable.definition;
    }

    // create script encoding definitions
    definition.scriptEncoding = {};
    keys = Object.keys(this.scriptEncoding);
    for (i = 0; i < keys.length; i++) {
        key = keys[i];
        definition.scriptEncoding[key] = this.scriptEncoding[key].definition;
    }

    return definition;
}});

ROM.prototype.assemble = function(data) {

    // mark modified assemblies as dirty
    function markDirty(action) {

        if (isArray(action)) {
            for (var a = 0; a < action.length; a++) markDirty(action[a]);
            return;
        }
        if (!action.object || !action.object.markAsDirty) return;
        action.object.markAsDirty();
    }

    this.undoStack.forEach(markDirty);
    this.redoStack.forEach(markDirty);

    // do a first pass assemble to trigger auto-relocation
    // this will also dirty up a lot of things when references get updated
    ROMData.prototype.assemble.call(this, this.data);

    // do a second pass
    var success = ROMData.prototype.assemble.call(this, this.data);

    // fix the SNES checksum
    this.fixChecksum();

    return success;
}

ROM.prototype.disassemble = function(data) {

    // encompass the full data range
    this.range = new ROMRange(0, data.length);

    ROMAssembly.prototype.disassemble.call(this, data);
}

ROM.prototype.expand = function(length) {
    if (length <= this.data.length) return;

    var freeRange = new ROMRange(this.range.end, length);

    // expand the rom
    var expandedData = new Uint8Array(length);
    expandedData.set(this.data);
    this.data = expandedData;
    this.range.end = this.range.begin + length;
    this.markAsDirty();

    // add free space
    this.addFreeSpace(freeRange);

    // update the snes header
    if (this.system === ROM.System.sfc && this.snesHeader) {
        var mbit = 1024 * 1024 / 8;
        var romSize = null;
        if (length <= 4*mbit) {
            romSize = 9;
        } else if (length <= 8*mbit) {
            romSize = 10;
        } else if (length <= 16*mbit) {
            romSize = 11;
        } else if (length <= 32*mbit) {
            romSize = 12;
        } else if (length <= 64*mbit) {
            romSize = 13;
        } else {
            return;
        }
        this.snesHeader.romSize.value = romSize;
        this.snesHeader.romSize.markAsDirty();
        this.snesHeader.assemble(this.data);
    }
}

ROM.prototype.log = function(text) {
    console.log(text);
}

ROM.System = {
    none: "none",
    nes: "nes",
    sfc: "sfc",
    gba: "gba",
    psx: "psx"
}

Object.defineProperty(ROM.prototype, "isNES", { get: function() { return this.system === ROM.System.nes; } });
Object.defineProperty(ROM.prototype, "isSFC", { get: function() { return this.system === ROM.System.sfc; } });
Object.defineProperty(ROM.prototype, "isGBA", { get: function() { return this.system === ROM.System.gba; } });
Object.defineProperty(ROM.prototype, "isPSX", { get: function() { return this.system === ROM.System.psx; } });

ROM.MapMode = {
    none: "none",
    mmc1: "mmc1",
    loROM: "loROM",
    hiROM: "hiROM",
    gba: "gba",
    psx: "psx"
}

ROM.prototype.bankSize = function() {
    switch (this.mode) {
        case ROM.MapMode.mmc1: return 0x4000;
        case ROM.MapMode.loROM: return 0x8000;
        case ROM.MapMode.hiROM: return 0x10000;
        default: return 0x10000;
    }
}

ROM.prototype.mapAddress = function(address) {
    switch (this.mode) {
        case ROM.MapMode.mmc1:
            var bank = address & 0xFF0000;
            return (bank >> 2) + (address & 0x3FFF) + 0x10;

        case ROM.MapMode.loROM:
            var bank = address & 0xFF0000;
            return (bank >> 1) + (address & 0x7FFF);

        case ROM.MapMode.hiROM:
            if (address >= 0xC00000) {
                return address - 0xC00000;
            } else if (address >= 0x800000) {
                return address - 0x800000;
            } else {
                return address;
            }

        case ROM.MapMode.gba:
            if (address >= 0x08000000) {
                return address - 0x08000000;
            } else {
                return address;
            }

        case ROM.MapMode.None:
        default:
            return address;
    }
}

ROM.prototype.mapRange = function(range) {
    var begin = this.mapAddress(range.begin);
    var end = this.mapAddress(range.end);
    return new ROMRange(begin, end);
}

ROM.prototype.unmapAddress = function(address) {
    switch (this.mode) {
        case ROM.MapMode.mmc1:
            address -= 0x10; // header
            var bank = (address << 2) & 0xFF0000;
            return bank | (address & 0x3FFF) | 0x8000;

        case ROM.MapMode.loROM:
            var bank = (address << 1) & 0xFF0000;
            return bank | (address & 0x7FFF) | 0x8000;

        case ROM.MapMode.hiROM:
            return address + 0xC00000;

        case ROM.MapMode.gba:
            return address | 0x08000000;

        case ROM.MapMode.None:
        default:
            return address;
    }
}

ROM.prototype.unmapRange = function(range) {
    var begin = this.unmapAddress(range.begin);
    var end = this.unmapAddress(range.end);
    return new ROMRange(begin, end);
}

ROM.prototype.fixChecksum = function() {
    if (!this.isSFC || !this.snesHeader) return;

    this.snesHeader.checksum.value = 0;
    this.snesHeader.checksumInverse.value = 0xFFFF;

    var checksum = ROM.checksum(this.data);
    this.snesHeader.checksum.value = checksum;
    this.snesHeader.checksum.markAsDirty();
    this.snesHeader.checksumInverse.value = checksum ^ 0xFFFF;
    this.snesHeader.checksumInverse.markAsDirty();

    this.snesHeader.assemble(this.data);
}

ROM.checksum = function(data) {

    function calcSum(data) {
        var sum = 0;
        for (var i = 0; i < data.length; i++) sum += data[i];
        return sum & 0xFFFF;
    }

    function mirrorSum(data, mask) {
        while (!(data.length & mask)) mask >>= 1;

        var part1 = calcSum(data.slice(0, mask));
        var part2 = 0;

        var nextLength = data.length - mask;
        if (nextLength) {
            part2 = mirrorSum(data.slice(mask), nextLength, mask >> 1);

            while (nextLength < mask) {
                nextLength += nextLength;
                part2 += part2;
            }
        }
        return (part1 + part2) & 0xFFFF;
    }

    return mirrorSum(data, 0x800000);
}

// // ROM.crc32Table = [
//     0x00000000, 0x77073096, 0xee0e612c, 0x990951ba, 0x076dc419, 0x706af48f,
//     0xe963a535, 0x9e6495a3, 0x0edb8832, 0x79dcb8a4, 0xe0d5e91e, 0x97d2d988,
//     0x09b64c2b, 0x7eb17cbd, 0xe7b82d07, 0x90bf1d91, 0x1db71064, 0x6ab020f2,
//     0xf3b97148, 0x84be41de, 0x1adad47d, 0x6ddde4eb, 0xf4d4b551, 0x83d385c7,
//     0x136c9856, 0x646ba8c0, 0xfd62f97a, 0x8a65c9ec, 0x14015c4f, 0x63066cd9,
//     0xfa0f3d63, 0x8d080df5, 0x3b6e20c8, 0x4c69105e, 0xd56041e4, 0xa2677172,
//     0x3c03e4d1, 0x4b04d447, 0xd20d85fd, 0xa50ab56b, 0x35b5a8fa, 0x42b2986c,
//     0xdbbbc9d6, 0xacbcf940, 0x32d86ce3, 0x45df5c75, 0xdcd60dcf, 0xabd13d59,
//     0x26d930ac, 0x51de003a, 0xc8d75180, 0xbfd06116, 0x21b4f4b5, 0x56b3c423,
//     0xcfba9599, 0xb8bda50f, 0x2802b89e, 0x5f058808, 0xc60cd9b2, 0xb10be924,
//     0x2f6f7c87, 0x58684c11, 0xc1611dab, 0xb6662d3d, 0x76dc4190, 0x01db7106,
//     0x98d220bc, 0xefd5102a, 0x71b18589, 0x06b6b51f, 0x9fbfe4a5, 0xe8b8d433,
//     0x7807c9a2, 0x0f00f934, 0x9609a88e, 0xe10e9818, 0x7f6a0dbb, 0x086d3d2d,
//     0x91646c97, 0xe6635c01, 0x6b6b51f4, 0x1c6c6162, 0x856530d8, 0xf262004e,
//     0x6c0695ed, 0x1b01a57b, 0x8208f4c1, 0xf50fc457, 0x65b0d9c6, 0x12b7e950,
//     0x8bbeb8ea, 0xfcb9887c, 0x62dd1ddf, 0x15da2d49, 0x8cd37cf3, 0xfbd44c65,
//     0x4db26158, 0x3ab551ce, 0xa3bc0074, 0xd4bb30e2, 0x4adfa541, 0x3dd895d7,
//     0xa4d1c46d, 0xd3d6f4fb, 0x4369e96a, 0x346ed9fc, 0xad678846, 0xda60b8d0,
//     0x44042d73, 0x33031de5, 0xaa0a4c5f, 0xdd0d7cc9, 0x5005713c, 0x270241aa,
//     0xbe0b1010, 0xc90c2086, 0x5768b525, 0x206f85b3, 0xb966d409, 0xce61e49f,
//     0x5edef90e, 0x29d9c998, 0xb0d09822, 0xc7d7a8b4, 0x59b33d17, 0x2eb40d81,
//     0xb7bd5c3b, 0xc0ba6cad, 0xedb88320, 0x9abfb3b6, 0x03b6e20c, 0x74b1d29a,
//     0xead54739, 0x9dd277af, 0x04db2615, 0x73dc1683, 0xe3630b12, 0x94643b84,
//     0x0d6d6a3e, 0x7a6a5aa8, 0xe40ecf0b, 0x9309ff9d, 0x0a00ae27, 0x7d079eb1,
//     0xf00f9344, 0x8708a3d2, 0x1e01f268, 0x6906c2fe, 0xf762575d, 0x806567cb,
//     0x196c3671, 0x6e6b06e7, 0xfed41b76, 0x89d32be0, 0x10da7a5a, 0x67dd4acc,
//     0xf9b9df6f, 0x8ebeeff9, 0x17b7be43, 0x60b08ed5, 0xd6d6a3e8, 0xa1d1937e,
//     0x38d8c2c4, 0x4fdff252, 0xd1bb67f1, 0xa6bc5767, 0x3fb506dd, 0x48b2364b,
//     0xd80d2bda, 0xaf0a1b4c, 0x36034af6, 0x41047a60, 0xdf60efc3, 0xa867df55,
//     0x316e8eef, 0x4669be79, 0xcb61b38c, 0xbc66831a, 0x256fd2a0, 0x5268e236,
//     0xcc0c7795, 0xbb0b4703, 0x220216b9, 0x5505262f, 0xc5ba3bbe, 0xb2bd0b28,
//     0x2bb45a92, 0x5cb36a04, 0xc2d7ffa7, 0xb5d0cf31, 0x2cd99e8b, 0x5bdeae1d,
//     0x9b64c2b0, 0xec63f226, 0x756aa39c, 0x026d930a, 0x9c0906a9, 0xeb0e363f,
//     0x72076785, 0x05005713, 0x95bf4a82, 0xe2b87a14, 0x7bb12bae, 0x0cb61b38,
//     0x92d28e9b, 0xe5d5be0d, 0x7cdcefb7, 0x0bdbdf21, 0x86d3d2d4, 0xf1d4e242,
//     0x68ddb3f8, 0x1fda836e, 0x81be16cd, 0xf6b9265b, 0x6fb077e1, 0x18b74777,
//     0x88085ae6, 0xff0f6a70, 0x66063bca, 0x11010b5c, 0x8f659eff, 0xf862ae69,
//     0x616bffd3, 0x166ccf45, 0xa00ae278, 0xd70dd2ee, 0x4e048354, 0x3903b3c2,
//     0xa7672661, 0xd06016f7, 0x4969474d, 0x3e6e77db, 0xaed16a4a, 0xd9d65adc,
//     0x40df0b66, 0x37d83bf0, 0xa9bcae53, 0xdebb9ec5, 0x47b2cf7f, 0x30b5ffe9,
//     0xbdbdf21c, 0xcabac28a, 0x53b39330, 0x24b4a3a6, 0xbad03605, 0xcdd70693,
//     0x54de5729, 0x23d967bf, 0xb3667a2e, 0xc4614ab8, 0x5d681b02, 0x2a6f2b94,
//     0xb40bbe37, 0xc30c8ea1, 0x5a05df1b, 0x2d02ef8d ];

// CRC32 for uint8 arrays
ROM.crc32Table = [];

ROM.crc32 = function(data) {

    if (!ROM.crc32Table.length) {
        // generate the crc32 table
        for (var n = 0; n < 256; n++) {
    		var c = n;
    		for (var k = 0; k < 8; k++) {
    			c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    		}
    		ROM.crc32Table[n] = c;
    	}
    }

    var crc32 = ~0;
    for (var i = 0; i < data.length; i++)
        crc32 = ((crc32 >> 8) & 0x00FFFFFF) ^ ROM.crc32Table[(crc32 ^ data[i]) & 0xFF];

    return (~crc32) >>> 0;
}

ROM.dataFormat = {
    // generic formats
    "bgr555": {
        encode: GFX.encodeBGR555,
        decode: GFX.decodeBGR555
    },
    "byteSwapped": {
        encode: function(data) {
            return [data.slice().reverse(), data.length];
        },
        decode: function(data) {
            return [data.slice().reverse(), data.length];
        }
    },
    "interlace": {
        encode: function(data, word, layers, stride) {
            var src = data;
            var s = 0;
            var dest = new Uint8Array(data.length);
            var d = 0;
            var step = word * layers; // 2
            var block = word * stride * layers; // 512
            while (s < src.length) {
                var s1 = s;
                while ((s1 - s) < step) {
                    var s2 = s1;
                    while ((s2 - s) < block) {
                        dest.set(src.subarray(s2, s2 + word), d);
                        d += word;
                        s2 += stride * word;
                    }
                    s1 += word;
                }
                s += block;
            }

            return [dest, data.length];
        },
        decode: function(data, word, layers, stride) {
            var src = data;
            var s = 0;
            var dest = new Uint8Array(data.length);
            var d = 0;
            var block = word * stride * layers; // 512
            while (s < src.length) {
                var s1 = s;
                while ((s1 - s) < stride * word) {
                    var s2 = s1;
                    while ((s2 - s) < block) {
                        dest.set(src.subarray(s2, s2 + word), d);
                        d += word;
                        s2 += stride * word;
                    }
                    s1 += word;
                }
                s += block;
            }

            return [dest, data.length];
        }
    },
    "reverse1bpp": {
        encode: GFX.encodeReverse1bpp,
        decode: GFX.decodeReverse1bpp
    },
    "linear1bpp": {
        encode: GFX.encodeLinear1bpp,
        decode: GFX.decodeLinear1bpp
    },
    "linear2bpp": {
        encode: GFX.encodeLinear2bpp,
        decode: GFX.decodeLinear2bpp
    },
    "linear4bpp": {
        encode: GFX.encodeLinear4bpp,
        decode: GFX.decodeLinear4bpp
    },
    "linear8bpp": {
        encode: GFX.encodeLinear8bpp,
        decode: GFX.decodeLinear8bpp
    },
    "nes2bpp": {
        encode: GFX.encodeNES2bpp,
        decode: GFX.decodeNES2bpp
    },
    "nesPalette": {
        encode: GFX.encodeNESPalette,
        decode: GFX.decodeNESPalette
    },
    "none": {
        encode: function(data) { return [data, data.length]; },
        decode: function(data) { return [data, data.length]; }
    },
    "snes2bpp": {
        encode: GFX.encodeSNES2bpp,
        decode: GFX.decodeSNES2bpp
    },
    "snes3bpp": {
        encode: GFX.encodeSNES3bpp,
        decode: GFX.decodeSNES3bpp
    },
    "snes4bpp": {
        encode: GFX.encodeSNES4bpp,
        decode: GFX.decodeSNES4bpp
    },
    "gba4bppTile": {
        encode: GFX.encodeGBA4bppTile,
        decode: GFX.decodeGBA4bppTile
    },
    "terminated": {
        encode: function(data, terminator, stride) {
            terminator = terminator || 0;
            var newData = new Uint8Array(data.length + 1);
            newData.set(data);
            newData[newData.length - 1] = terminator;
            return [newData, data.length];
        },
        decode: function(data, terminator, stride) {
            terminator = terminator || 0;
            stride = stride || 1;
            var length = 0;
            while (length < data.length && data[length] !== terminator) length += stride;
            data = data.subarray(0, length + 1);
            return [data.subarray(0, length), length + 1];
        }
    },

    // game-specific formats
    "ff1-map": {
        encode: function(data) {
            var src = data;
            var s = 0; // source pointer
            var dest = new Uint8Array(4096);
            var d = 0;
            var b, l;

            while (s < src.length) {
                b = src[s++];
                l = 0;
                while (b === src[s + l]) l++;
                if (l > 255) {
                    dest[d++] = b | 0x80;
                    dest[d++] = 0;
                    s += 255;
                } else if (l >= 1) {
                    dest[d++] = b | 0x80;
                    dest[d++] = l + 1;
                    s += l;
                } else {
                    dest[d++] = b;
                }
            }
            dest[d++] = 0xFF;

            return [dest.slice(0, d), s];
        },
        decode: function(data) {
            var src = data;
            var s = 0; // source pointer
            var dest = new Uint8Array(4096);
            var d = 0; // destination pointer
            var b, l;

            while (s < src.length) {
                b = src[s++];
                if (b === 0xFF) break;
                if (b & 0x80) {
                    l = src[s++] || 256;
                    b &= 0x7F;
                    while (l--) dest[d++] = b;
                } else {
                    dest[d++] = b;
                }
            }
            return [dest.slice(0, d), s];
        }
    },
    "ff1-shop": {
        encode: function(data) {
            var newData = new Uint8Array(5);
            var d = 0;
            for (var i = 0; i < 4; i++) {
                if (!data[i]) continue;
                newData[d++] = data[i];
            }
            newData[d++] = 0;
            return [newData.slice(0, d), 4];
        },
        decode: function(data) {
            var newData = new Uint8Array(4);
            for (var i = 0; i < data.length; i++) {
                newData[i] = data[i];
            }
            return [newData, data.length];
        }
    },
    "ff4-battlebg": {
        encode: function(data) {
            var newData = new Uint8Array(data.length);
            for (var i = 0; i < data.length; i++) {
                var t = data[i] & 0x3F;
                var p = data[i] & 0x0400;
                var v = data[i] & 0x8000;
                newData[i] = t | (p >> 4) | (v >> 8);
            }
            return [newData, data.length];
        },
        decode: function(data) {
            var newData = new Uint16Array(data.length);
            for (var i = 0; i < data.length; i++) {
                var t = data[i] & 0x3F;
                var p = data[i] & 0x40;
                var v = data[i] & 0x80;
                newData[i] = t | (p << 4) | (v << 8);
            }
            return [newData, data.length];
        }
    },
    "ff4-monster": {
        encode: function(data) {
            var newData = new Uint8Array(20);
            newData.set(data.subarray(0, 9));
            var flags = 0;
            var i = 10;
            if (data[10] || data[11] || data[12]) {
                flags |= 0x80;
                newData.set(data.subarray(10, 13), i);
                i += 3
            }
            if (data[13] || data[14] || data[15]) {
                flags |= 0x40;
                newData.set(data.subarray(13, 16), i);
                i += 3
            }
            if (data[16]) {
                flags |= 0x20;
                newData[i++] = data[16];
            }
            if (data[17]) {
                flags |= 0x10;
                newData[i++] = data[17];
            }
            if (data[18]) {
                flags |= 0x08;
                newData[i++] = data[18];
            }
            if (data[19]) {
                flags |= 0x04;
                newData[i++] = data[19];
            }
            newData[9] = flags;
            return [newData.slice(0, i), 20];
        },
        decode: function(data) {
            var newData = new Uint8Array(20);
            newData.set(data.subarray(0, 9));
            var flags = data[9];
            var i = 10;
            if (flags & 0x80) {
                newData.set(data.subarray(i, i + 3), 10);
                i += 3;
            }
            if (flags & 0x40) {
                newData.set(data.subarray(i, i + 3), 13);
                i += 3;
            }
            if (flags & 0x20) newData[16] = data[i++];
            if (flags & 0x10) newData[17] = data[i++];
            if (flags & 0x08) newData[18] = data[i++];
            if (flags & 0x04) newData[19] = data[i++];
            return [newData, data.length];
        }
    },
    "ff4-world": {
        encode: function(data) {
            var src = data;
            var s = 0; // source pointer
            var dest = new Uint8Array(256);
            var d = 0;
            var b, l;

            while (s < src.length) {
                b = src[s++];
                if ((b === 0x00) || (b === 0x10) || (b === 0x20) || (b === 0x30)) {
                    dest[d++] = b;
                    s += 3;
                    continue;
                }
                l = 0;
                while (b === src[s + l]) l++;
                if (l > 1) {
                    dest[d++] = b | 0x80;
                    dest[d++] = l;
                    s += l;
                } else {
                    dest[d++] = b;
                }
            }

            return [dest.slice(0, d), s];
        },
        decode: function(data) {
            var src = data;
            var s = 0; // source pointer
            var dest = new Uint8Array(256);
            var d = 0; // destination pointer
            var b, l;

            while (s < src.length) {
                b = src[s++];
                if (b & 0x80) {
                    l = src[s++] + 1;
                    b &= 0x7F;
                    while (l--) dest[d++] = b;
                } else if ((b === 0x00) || (b === 0x10) || (b === 0x20) || (b === 0x30)) {
                    dest[d++] = b;
                    dest[d++] = (b >> 4) * 3 + 0x70;
                    dest[d++] = (b >> 4) * 3 + 0x71;
                    dest[d++] = (b >> 4) * 3 + 0x72;
                } else {
                    dest[d++] = b;
                }
            }
            return [dest.slice(0, d), s];
        }
    },
    "ff4-map": {
        encode: function(data) {
            var src = data;
            var s = 0; // source pointer
            var dest = new Uint8Array(1024);
            var d = 0;
            var b, l;

            while (s < src.length) {
                b = src[s];
                l = 1;
                while (b === src[s + l]) l++;
                if (l > 2) {
                    l = Math.min(l, 256);
                    dest[d++] = b | 0x80;
                    dest[d++] = l - 1;
                    s += l;
                } else {
                    dest[d++] = b;
                    s++;
                }
            }
            return [dest.slice(0, d), s];
        },
        decode: function(data) {
            var src = data;
            var s = 0; // source pointer
            var dest = new Uint8Array(1024);
            var d = 0; // destination pointer
            var b, l;

            while (s < src.length) {
                b = src[s++];
                if (b & 0x80) {
                    l = src[s++] + 1;
                    b &= 0x7F;
                    while (l--) dest[d++] = b;
                } else {
                    dest[d++] = b;
                }
            }
            return [dest.slice(0, d), s];
        }
    },
    "ff4a-world-tile-properties": {
        encode: function(data) {
            var src = data;
            var s = 0; // source pointer
            var dest = new Uint8Array(1024);
            var d = 0; // destination pointer

            while (s < 256) {
                var start = s++;
                var value = src[start];
                if (value === 0) continue;
                var end = s;
                while (src[end] === value) end++;
                dest[d++] = start;
                dest[d++] = end - 1;
                dest[d++] = value - 1; d++;
                s = end;
            }
            d += 4;
            return [dest.slice(0, d), s];
        },
        decode: function(data) {
            var src = data;
            var s = 0; // source pointer
            var dest = new Uint8Array(256);
            var d = 0; // destination pointer
            var start, end, value;

            while (s < src.length) {
                start = src[s++];
                end = src[s++];
                if (start === 0 && end === 0) break;
                value = src[s++]; s++;
                while (start <= end) dest[start++] = value + 1;
            }
            return [dest, s];
        }
    },
    "ff5-battlebg": {
        encode: function(data) {
            return [data, data.length];
        },
        decode: function(data) {
            var newData = new Uint16Array(0x0280);
            var s = 0;
            var d = 0;
            while (d < 0x0280) {
                var b = data[s++];
                if (b !== 0xFF) {
                    newData[d++] = b;
                    continue;
                }

                b = data[s++];
                var t1 = data[s++];
                var t2 = data[s++];

                if (b & 0x80) {
                    b &= 0x3F;
                    for (var i = 0; i < b; i++) {
                        newData[d++] = t1;
                        newData[d++] = t2;
                    }
                } else if (b & 0x40) {
                    b &= 0x3F;
                    for (var i = 0; i < b; i++) {
                        newData[d++] = t1;
                        t1 -= t2;
                    }
                } else {
                    b &= 0x3F;
                    for (var i = 0; i < b; i++) {
                        newData[d++] = t1;
                        t1 += t2;
                    }
                }
            }
            for (var i = 0; i < 0x0280; i++) {
                var b = newData[i];
                if (b & 0x80) {
                    newData[i] |= 0x0880;
                } else {
                    newData[i] |= 0x0480;
                }
            }
            return [newData, data.length];
        }
    },
    "ff5-battlebgflip": {
        encode: function(data) {
            return [data, data.length];
        },
        decode: function(data) {
            var newData = new Uint8Array(0x0280);
            var s = 0;
            var d = 0;
            while (d < 0x0280) {
                var b = data[s++];
                if (b === 0) {
                    // repeat zero
                    var c = data[s++] * 8;
                    for (var i = 0; i < c; i++) newData[d++] = 0;
                    continue;
                }

                for (var i = 0; i < 8; i++) {
                    newData[d++] = b & 0x80;
                    b <<= 1;
                }
            }
            return [newData, data.length];
        }
    },
    "ff5-world": {
        encode: function(data) {
            var src = data;
            var s = 0; // source pointer
            var dest = new Uint8Array(256);
            var d = 0;
            var b, l;

            while (s < 256) {
                b = src[s++];
                if ((b === 0x0C) || (b === 0x1C) || (b === 0x2C)) {
                    dest[d++] = b;
                    s += 2;
                    continue;
                }
                l = 0;
                while (b === src[s + l]) l++;
                if (l > 1) {
                    l = Math.min(l, 32);
                    dest[d++] = 0xC0 + l;
                    dest[d++] = b;
                    s += l;
                } else {
                    dest[d++] = b;
                }
            }

            return [dest.slice(0, d), s];
        },
        decode: function(data) {
            var src = data;
            var s = 0; // source pointer
            var dest = new Uint8Array(256);
            var d = 0; // destination pointer
            var b, l;

            while (s < src.length) {
                b = src[s++];
                if (b > 0xBF) {
                    l = b - 0xBF;
                    b = src[s++];
                    while (l--) dest[d++] = b;
                } else if ((b === 0x0C) || (b === 0x1C) || (b === 0x2C)) {
                    dest[d++] = b;
                    dest[d++] = b + 1;
                    dest[d++] = b + 2;
                } else {
                    dest[d++] = b;
                }
            }
            return [dest, s];
        }
    },
    "ff5-lzss": {
        encode: function(data) {

            // create a source buffer preceded by 2K of empty space (this increases compression for some data)
            var src = new Uint8Array(0x0800 + data.length);
            src.set(data, 0x0800);
            var s = 0x0800; // start at 0x0800 to ignore the 2K of empty space

            var dest = new Uint8Array(0x10000);
            var d = 2; // start at 2 so we can fill in the length at the end

            var header = 0;
            var line = new Uint8Array(17);

            var l = 1; // start at 1 so we can fill in the header at the end
            var b = 0x07DE; // buffer position
            var p = 0;
            var pMax, len, lenMax;

            var w;
            var mask = 1;

            while (s < src.length) {
                // find the longest sequence that matches the decompression buffer
                lenMax = 0;
                pMax = 0;
                for (p = 1; p <= 0x0800; p++) {
                    len = 0;

                    while ((len < 34) && (s + len < src.length) && (src[s + len - p] === src[s + len])) len++;

                    if (len > lenMax) {
                        // this sequence is longer than any others that have been found so far
                        lenMax = len;
                        pMax = (b - p) & 0x07FF;
                    }
                }

                // check if the longest sequence is compressible
                if (lenMax >= 3) {
                    // sequence is compressible - add compressed data to line buffer
                    w = pMax & 0xFF;
                    w |= (pMax & 0x0700) << 5;
                    w |= (lenMax - 3) << 8;
                    line[l++] = w & 0xFF;
                    w >>= 8;
                    line[l++] = w & 0xFF;
                    s += lenMax;
                    b += lenMax;
                } else {
                    // sequence is not compressible - update header byte and add byte to line buffer
                    header |= mask;
                    line[l++] = src[s];
                    s++;
                    b++;
                }

                b &= 0x07FF;
                mask <<= 1;

                if (mask == 0x0100) {
                    // finished a line, copy it to the destination
                    line[0] = header;

                    dest.set(line.subarray(0, l), d);
                    d += l;
                    header = 0;
                    l = 1;
                    mask = 1;
                }
            }

            if (mask != 1) {
                // we're done with all the data but we're still in the middle of a line
                line[0] = header;
                dest.set(line.subarray(0, l), d);
                d += l;
            }

            // fill in the length
            dest[0] = data.length & 0xFF;
            dest[1] = (data.length >> 8) & 0xFF;

            return [dest.slice(0, d), s - 0x0800];
        },
        decode: function(data) {
            var src = data;
            var s = 0; // source pointer
            var dest = new Uint8Array(0x10000);
            var d = 0; // destination pointer
            var buffer = new Uint8Array(0x0800);
            var b = 0x07DE;
            var line = new Uint8Array(34);
            var header, pass, r, w, c, i, l;

            var length = src[s++] | (src[s++] << 8);
            while (d < length) { // ff5

                // read header
                header = src[s++];

                for (pass = 0; pass < 8; pass++, header >>= 1) {
                    l = 0;
                    if (header & 1) {
                        // single byte (uncompressed)
                        c = src[s++];
                        line[l++] = c;
                        buffer[b++] = c;
                        b &= 0x07FF;
                    } else {
                        // 2-bytes (compressed)
                        w = src[s++];
                        r = src[s++];
                        w |= (r & 0xE0) << 3;
                        r = (r & 0x1F) + 3;

                        for (i = 0; i < r; i++) {
                            c = buffer[(w + i) & 0x07FF];
                            line[l++] = c;
                            buffer[b++] = c;
                            b &= 0x07FF;
                        }
                    }
                    if ((d + l) > dest.length) {
                        // maximum buffer length exceeded
                        dest.set(line.subarray(0, dest.length - d), d)
                        return [dest.slice(0, d), s];
                    } else {
                        // copy this pass to the destination buffer
                        dest.set(line.subarray(0, l), d)
                        d += l;
                    }

                    // reached end of compressed data
                    if (d >= length) break; // ff5
                }
            }

//            data = data.subarray(0, s);
            return [dest.slice(0, d), s];
        }
    },
    "tose-70": {
        encode: function(data) {
            var encoder = new Tose70Encoder();
            return encoder.encode(data);
        },
        decode: function(data) {
            var decoder = new Tose70Decoder();
            return decoder.decode(data);
        }
    },
    "tose-graphics": {
        encode: function(data) {
            var header = new Uint32Array(2);
            header[0] = 1;
            header[1] = Math.floor(data.length / 32)
            var header8 = new Uint8Array(header.buffer);
            var dest = new Uint8Array(8 + data.length);
            dest.set(header8, 0);
            dest.set(data, 8);
            return [dest, data.length];
        },
        decode: function(data) {
            header = new Uint32Array(data.buffer, data.byteOffset, 2);
            var mode = header[0]; // always 1
            if (mode !== 1) console.log("Invalid TOSE graphics format " + mode);
            var count = header[1]; // tile count
            var dest = data.subarray(8);
            return [dest, data.length];
        }
    },
    "tose-layout": {
        encode: function(data, width, height) {
            var header = new Uint32Array(2);
            header[0] = 2;
            header[1] = Math.floor(data.length / 2)
            var header8 = new Uint8Array(header.buffer);
            var dest = new Uint8Array(12 + data.length);
            dest.set(header8, 0);
            data[8] = width;
            data[9] = height;
            dest.set(data, 12);
            return [dest, data.length];
        },
        decode: function(data, width, height) {
            header = new Uint32Array(data.buffer, data.byteOffset, 2);
            var mode = header[0]; // always 2
            if (mode !== 2) console.log("Invalid TOSE layout format " + mode);
            var count = header[1]; // tile count
            var width = data[8];
            var height = data[9];
            var dest = data.subarray(12);
            return [dest, data.length];
        }
    },
    "tose-palette": {
        encode: function(data) {
            var count = data.length >> 1; // number of 16-bit colors
            data = data.subarray(0, count * 2);
            var header = new Uint32Array(2);
            header[0] = 3;
            header[1] = count;
            var header8 = new Uint8Array(header.buffer);
            var dest = new Uint8Array(8 + data.length);
            dest.set(header8, 0);
            dest.set(data, 8);
            return [dest, data.length];
        },
        decode: function(data) {
            header = new Uint32Array(data.buffer, data.byteOffset, 2);
            var mode = header[0]; // always 3
            if (mode !== 3) console.log("Invalid TOSE palette format " + mode);
            var count = header[1]; // number of 16-bit colors
            var dest = data.subarray(8);
            return [dest, 8 + count << 1];
        }
    },
    "ff5a-world": {
        encode: function(data) {
            var src = data;
            var s = 0; // source pointer
            var dest = new Uint8Array(256);
            var d = 0;
            var b;

            while (s < 256) {
                b = src[s++];
                while (b === src[s]) s++;
                dest[d++] = b;
                dest[d++] = s - 1;
            }

            return [dest.slice(0, d), s];
        },
        decode: function(data) {
            var src = data;
            var s = 0; // source pointer
            var dest = new Uint8Array(256);
            var d = 0; // destination pointer
            var b, l;

            while (s < src.length) {
                b = src[s++];
                l = src[s++];
                while (d <= l) dest[d++] = b;
            }
            return [dest, s];
        }
    },
    "ff6-lzss": {
        encode: function(data) {

            // create a source buffer preceded by 2K of empty space (this increases compression for some data)
            var src = new Uint8Array(0x0800 + data.length);
            src.set(data, 0x0800);
            var s = 0x0800; // start at 0x0800 to ignore the 2K of empty space

            var dest = new Uint8Array(0x10000);
            var d = 2; // start at 2 so we can fill in the length at the end

            var header = 0;
            var line = new Uint8Array(17);

            var l = 1; // start at 1 so we can fill in the header at the end
            var b = 0x07DE; // buffer position
            var p = 0;
            var pMax, len, lenMax;

            var w;
            var mask = 1;

            while (s < src.length) {
                // find the longest sequence that matches the decompression buffer
                lenMax = 0;
                pMax = 0;
                for (p = 1; p <= 0x0800; p++) {
                    len = 0;

                    while ((len < 34) && (s + len < src.length) && (src[s + len - p] === src[s + len]))
                        len++;

                    if (len > lenMax) {
                        // this sequence is longer than any others that have been found so far
                        lenMax = len;
                        pMax = (b - p) & 0x07FF;
                    }
                }

                // check if the longest sequence is compressible
                if (lenMax >= 3) {
                    // sequence is compressible - add compressed data to line buffer
                    w = ((lenMax - 3) << 11) | pMax;
                    line[l++] = w & 0xFF;
                    w >>= 8;
                    line[l++] = w & 0xFF;
                    s += lenMax;
                    b += lenMax;
                } else {
                    // sequence is not compressible - update header byte and add byte to line buffer
                    header |= mask;
                    line[l++] = src[s];
                    s++;
                    b++;
                }

                b &= 0x07FF;
                mask <<= 1;

                if (mask == 0x0100) {
                    // finished a line, copy it to the destination
                    line[0] = header;

                    dest.set(line.subarray(0, l), d);
                    d += l;
                    header = 0;
                    l = 1;
                    mask = 1;
                }
            }

            if (mask != 1) {
                // we're done with all the data but we're still in the middle of a line
                line[0] = header;
                dest.set(line.subarray(0, l), d);
                d += l;
            }

            // fill in the length
            dest[0] = d & 0xFF;
            dest[1] = (d >> 8) & 0xFF;

            return [dest.slice(0, d), s - 0x0800];
        },
        decode: function(data) {
            var src = data;
            var s = 0; // source pointer
            var dest = new Uint8Array(0x10000);
            var d = 0; // destination pointer
            var buffer = new Uint8Array(0x0800);
            var b = 0x07DE;
            var line = new Uint8Array(34);
            var header, pass, r, w, c, i, l;

            var length = src[s++] | (src[s++] << 8);
            while (s < length) {

                // read header
                header = src[s++];

                for (pass = 0; pass < 8; pass++, header >>= 1) {
                    l = 0;
                    if (header & 1) {
                        // single byte (uncompressed)
                        c = src[s++];
                        line[l++] = c;
                        buffer[b++] = c;
                        b &= 0x07FF;
                    } else {
                        // 2-bytes (compressed)
                        w = src[s++];
                        w |= (src[s++] << 8);
                        r = (w >> 11) + 3;
                        w &= 0x07FF;

                        for (i = 0; i < r; i++) {
                            c = buffer[(w + i) & 0x07FF];
                            line[l++] = c;
                            buffer[b++] = c;
                            b &= 0x07FF;
                        }
                    }
                    if ((d + l) > dest.length) {
                        // maximum buffer length exceeded
                        dest.set(line.subarray(0, dest.length - d), d)
                        return [dest.slice(0, d), s];
                    } else {
                        // copy this pass to the destination buffer
                        dest.set(line.subarray(0, l), d)
                        d += l;
                    }

                    // reached end of compressed data
                    if (s >= length) break;
                }
            }

            data = data.subarray(0, s);
            return [dest.slice(0, d), s];
        }
    },
    "gba-lzss": {
        encode: function(data) {

            // note: gba format doesn't allow an empty preceding buffer
            var src = data;
            var s = 0;

            var dest = new Uint8Array(0x10000);
            var d = 0;

            // fill in the compression identifier byte and the length
            dest[d++] = 0x10;
            dest[d++] = src.length & 0xFF;
            dest[d++] = (src.length >> 8) & 0xFF;
            dest[d++] = (src.length >> 16) & 0xFF;

            var header = 0;
            var line = new Uint8Array(17);

            var l = 1; // start at 1 so we can fill in the header at the end
            var p = 0;
            var pMax, len, lenMax;

            var w;
            var mask = 0x80;

            while (s < src.length) {
                // find the longest sequence that matches the decompression buffer
                lenMax = 0;
                pMax = 0;
                for (p = 1; p <= 0x1000; p++) {
                    len = 0;

                    if (p > s) break;
                    while ((len < 18) && (s + len < src.length) && (src[s + len - p] === src[s + len]))
                        len++;

                    if (len > lenMax) {
                        // this sequence is longer than any others that have been found so far
                        lenMax = len;
                        pMax = (p - 1) & 0x0FFF;
                    }
                }

                // check if the longest sequence is compressible
                if (lenMax >= 3) {
                    // sequence is compressible - update header byte and add compressed data to line buffer
                    header |= mask;
                    w = ((lenMax - 3) << 12) | pMax;
                    line[l++] = w >> 8;
                    line[l++] = w & 0xFF;
                    s += lenMax;
                } else {
                    // sequence is not compressible - add byte to line buffer
                    line[l++] = src[s++];
                }

                mask >>= 1;

                if (!mask) {
                    // finished a line, copy it to the destination
                    line[0] = header;

                    dest.set(line.subarray(0, l), d);
                    d += l;
                    header = 0;
                    l = 1;
                    mask = 0x80;
                }
            }

            if (mask != 1) {
                // we're done with all the data but we're still in the middle of a line
                line[0] = header;
                dest.set(line.subarray(0, l), d);
                d += l;
            }

            return [dest.slice(0, d), s];
        },
        decode: function(data) {
            var src = data;
            var s = 0; // source pointer
            var dest = new Uint8Array(0x10000);
            var d = 0; // destination pointer
            var buffer = new Uint8Array(0x1000);
            var b = 0;
            var line = new Uint8Array(18);
            var header, pass, r, w, c, i, l;

            if (src[s++] !== 0x10) return [new Uint8Array(0), 0];

            var length = src[s++] | (src[s++] << 8) | (src[s++] << 16);
            while (d < length) {

                // read header
                header = src[s++];

                for (pass = 0; pass < 8; pass++, header <<= 1) {
                    l = 0;
                    if (header & 0x80) {
                        // 2-bytes (compressed)
                        w = (src[s++] << 8);
                        w |= src[s++];
                        r = (w >> 12) + 3;
                        w &= 0x0FFF;
                        w++;

                        for (i = 0; i < r; i++) {
                            c = buffer[(b - w) & 0x0FFF];
                            line[l++] = c;
                            buffer[b++] = c;
                            b &= 0x0FFF;
                        }
                    } else {
                        // single byte (uncompressed)
                        c = src[s++];
                        line[l++] = c;
                        buffer[b++] = c;
                        b &= 0x0FFF;
                    }
                    if ((d + l) > dest.length) {
                        // maximum buffer length exceeded
                        dest.set(line.subarray(0, dest.length - d), d)
                        return [dest.slice(0, d), s];
                    } else {
                        // copy this pass to the destination buffer
                        dest.set(line.subarray(0, l), d)
                        d += l;
                    }

                    // reached end of compressed data
                    if (d >= length) break;
                }
            }

//            data = data.subarray(0, s);
            return [dest.slice(0, d), s];
        }
    }
};

ROM.prototype.canUndo = function() { return this.undoStack.length > 0; }
ROM.prototype.canRedo = function() { return this.redoStack.length > 0; }

ROM.prototype.undo = function() {
    if (!this.canUndo()) return;

    var action = this.undoStack.pop()
    this.doAction(action, true);
}

ROM.prototype.redo = function() {
    if (!this.canRedo()) return;

    var action = this.redoStack.pop()
    this.doAction(action, false);
}

ROM.prototype.doAction = function(action, undo) {

    if (undo === undefined) this.redoStack = [];

    this.pushAction(action, undo);
    if (action instanceof ROMAction) {
        action.execute(undo);
    } else if (isArray(action)) {
        for (var i = 0; i < action.length; i++) {
            var a = action[undo ? action.length - i - 1 : i];
            a.execute(undo);
        }
    }
}

ROM.prototype.pushAction = function(action, undo) {

    if (this.action && action instanceof ROMAction) {
        this.action.push(action);

    } else {
        // single action
        if (undo) {
            this.redoStack.push(action);
        } else {
            this.undoStack.push(action);
        }
    }
}

ROM.prototype.beginAction = function() {

    this.actionDepth++;
    if (!this.action) this.action = [];
}

ROM.prototype.endAction = function() {

    this.actionDepth--;
    if (this.actionDepth > 0) return;
    this.actionDepth = 0;
    if (this.action) this.undoStack.push(this.action);
    this.action = null;
}

// ROMAction
function ROMAction(object, undo, redo, description) {
    this.object = object;
    this.undo = undo;
    this.redo = redo;
    this.description = description;
}

ROMAction.prototype.execute = function(undo) {
    if (undo && this.undo) {
//        if (this.description) console.log(this.description);
        this.undo.call(this.object);
    } else if (!undo && this.redo) {
//        if (this.description) console.log(this.description);
        this.redo.call(this.object);
    }
}

// ROMObserver
function ROMObserver(rom, owner, options) {
    this.rom = rom;
    this.owner = owner;
    this.options = options || {};
    this.observees = [];
    this.depth = 0;
}

ROMObserver.prototype.startObserving = function(object, callback, args) {

    // can't observe nothing
    if (!object) return;

    if (this.depth > 5) return;

    this.depth++;

    // start observing the object and add it to the array of observees
    if (this.observees.indexOf(object) === -1) this.observees.push(object);
    if (object.addObserver) object.addObserver(this.owner, callback, args);

    if (this.options.sub) this.startObservingSub(object, callback, args);
    if (this.options.link) this.startObservingLink(object, callback, args);
    if (this.options.array) this.startObservingArray(object, callback, args);
    if (this.options.label) this.startObservingLabel(object, callback, args);

    this.depth--;
}

ROMObserver.prototype.startObservingSub = function(object, callback, args) {
    // don't observe array prototypes
    if (!(object instanceof ROMData)) return;

    var keys = Object.keys(object.assembly);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var sub = object.assembly[key];
        if (sub.invalid) continue;
        this.startObserving(object[key], callback, args);
    }
}

ROMObserver.prototype.startObservingLink = function(object, callback, args) {
    if (!object.link) return;
    this.startObserving(object.parsePath(object.link), callback, args);
}

ROMObserver.prototype.startObservingArray = function(object, callback, args) {
    if (!(object instanceof ROMArray)) return;

    for (var i = 0; i < object.arrayLength; i++) {
        this.startObserving(object.item(i), callback, args);
    }
}

ROMObserver.prototype.startObservingLabel = function(object, callback, args) {
    // don't make strings observe themselves
    if (object instanceof ROMString) return;

    var label = object.labelString;
    if (!label) return;
    this.startObserving(label, callback, args);
}

ROMObserver.prototype.stopObserving = function(object) {

    // can't observe nothing
    if (!object) return;

    // stop observing the object and remove it from the array of observees
    var index = this.observees.indexOf(object);
    if (index !== -1) this.observees.splice(index, 1);
    if (object.removeObserver) object.removeObserver(this.owner);

    if (this.options.sub) this.stopObservingSub(object);
    if (this.options.link) this.stopObservingLink(object);
    if (this.options.array) this.stopObservingArray(object);
    if (this.options.label) this.stopObservingLabel(object);
}

ROMObserver.prototype.stopObservingSub = function(object) {
    // don't observe array prototype assemblies
    if (!(object instanceof ROMData)) return;

    var keys = Object.keys(object.assembly);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var sub = object.assembly[key];
        if (sub.invalid) continue;
        this.stopObserving(object[key]);
    }
}

ROMObserver.prototype.stopObservingLink = function(object) {
    if (!object.link) return;
    this.stopObserving(object.parsePath(object.link));
}

ROMObserver.prototype.stopObservingArray = function(object) {
    if (!(object instanceof ROMArray)) return;

    for (var i = 0; i < object.arrayLength; i++) {
        this.stopObserving(object.item(i));
    }
}

ROMObserver.prototype.stopObservingLabel = function(object) {
    // don't make strings observe themselves
    if (object instanceof ROMString) return;

    var label = object.labelString;
    if (!label) return;
    this.stopObserving(label);
}

ROMObserver.prototype.stopObservingAll = function() {
    while (this.observees.length) this.stopObserving(this.observees[0]);
}

ROMObserver.prototype.sleep = function() {
    for (var o = 0; o < this.observees.length; o++) {
        var object = this.observees[o];
        var observer = object.getObserver(this.owner);
        if (!observer) continue;
        observer.asleep = true;
    }
}

ROMObserver.prototype.wake = function() {
    for (var o = 0; o < this.observees.length; o++) {
        var object = this.observees[o];
        var observer = object.getObserver(this.owner);
        if (!observer) continue;
        observer.asleep = false;
    }
}

// ROMProperty
function ROMProperty(rom, definition, parent) {
    ROMAssembly.call(this, rom, definition, parent);

    this.mask = Number(definition.mask);
    if (!isNumber(this.mask)) this.mask = 0xFF;

    this.offset = Number(definition.offset);
    if (!isNumber(this.offset)) this.offset = 0;

    this.multiplier = Number(definition.multiplier);
    if (!isNumber(this.multiplier)) this.multiplier = 1;

    this.bool = (definition.bool === true);
    this.invert = (definition.invert === true);
    this.flag = (definition.flag === true);
    this.signed = (definition.signed === true);
    this.script = definition.script;
    this.pointerTo = definition.pointerTo;
    this.target = null;
    this.link = definition.link;
    this.msb = definition.msb;
    this.default = definition.default;

    this.special = {};
    var special = definition.special || {};
    var specialKeys = Object.keys(special);
    for (var k = 0; k < specialKeys.length; k++) {
        var key = specialKeys[k];
        var index = Number(key);
        if (!isNumber(index)) continue;
        this.special[index] = special[key];
    }

    // calculate the bit index
    for (var b = 0; b < 32; b++) {
        if (((1 << b) & this.mask) === 0) continue;
        this.bit = b;
        break;
    }

    // calculate the mask width
    this.width = 0;
    for (var m = this.mask >> this.bit; m !== 0; m >>= 1) this.width++;

    // set minimum and maximum values
    this.min = Number(definition.min);
    this.max = Number(definition.max)
    if (this.signed) {
        this.min = this.min || -((this.mask >> (this.bit + 1)) + 1);
        this.max = this.max || (this.mask >> (this.bit + 1));
    } else {
        this.min = this.min || 0;
        this.max = this.max || (this.mask >> this.bit);
    }

    // default to the minimum value
    this.value = isNumber(this.default) ? this.default : this.min;

    // calculate the data length
    var length = 1;
    var mask = this.mask;
    while (mask & (~0 ^ 0xFF) && length < 4) {
        mask >>= 8;
        length++;
    }

    // set the range
    this.range.length = length;
}

ROMProperty.prototype = Object.create(ROMAssembly.prototype);
ROMProperty.prototype.constructor = ROMProperty;

Object.defineProperty(ROMProperty.prototype, "definition", { get: function() {
    var definition = Object.getOwnPropertyDescriptor(ROMAssembly.prototype, "definition").get.call(this);

    if (definition.range) {
        definition.begin = this.range.begin;
        delete definition.range;
    }

    if (this.mask !== 0xFF) definition.mask = hexString(this.mask, this.range.length * 2);
    if (this.offset !== 0) definition.offset = this.offset;
    if (this.multiplier !== 1) definition.multiplier = this.multiplier;
    if (this.bool) definition.bool = true;
    if (this.invert) definition.invert = true;
    if (this.flag) definition.flag = true;
    if (this.signed) definition.signed = true;
    if (this.script) definition.script = this.script;
    if (this.pointerTo) definition.pointerTo = this.pointerTo;
    if (this.link) definition.link = this.link;
    if (this.msb) definition.msb = this.msb;
    if (this.default) definition.default = this.default;
    if (Object.keys(this.special).length != 0) definition.special = this.special;
    if (this.min !== 0) definition.min = this.min;
    if (this.max !== (this.mask >> this.bit)) definition.max = this.max;

    return definition;
}});

ROMProperty.prototype.assemble = function(data) {

    var value = this.value;
//    if (this.pointerTo && !isNumber(value)) {
//        // calculate pointer to object
//        value = value.range.begin;
//        if (this.value.parent instanceof ROMArray) value += this.value.parent.range.begin;
//    }

    // modify the value if needed
    if (this.bool) value = value ? 1 : 0;
    value -= this.offset;
    value = Math.floor(value / this.multiplier);

    if (this.signed && value < 0) {
        value += 1 << this.width;
    }
    value = (value << this.bit) & this.mask;
    if (this.invert) value ^= this.mask;

    // disassemble to get any adjacent data
    if (data) {
        ROMAssembly.prototype.disassemble.call(this, data);
        this.lazyData = null; // need to encode data
    }

    var mask = (~this.mask) >>> 0;
    for (var i = 0; i < this.data.length; i++) {
        this.data[i] &= (mask & 0xFF);
        this.data[i] |= (value & 0xFF);
        mask >>= 8;
        value >>= 8;
    }

    return ROMAssembly.prototype.assemble.call(this, data);
}

ROMProperty.prototype.disassemble = function(data) {

    ROMAssembly.prototype.disassemble.call(this, data);

    this.value = 0;
    for (var i = this.data.length - 1; i >= 0; i--) {
        this.value <<= 8;
        this.value |= this.data[i];
    }
    this.value &= this.mask;
    if (this.invert) this.value ^= this.mask;
    this.value >>= this.bit;
    if (this.bool) {
        this.value = (this.value === 1);
        if (this.invertBool) this.value = !this.value;
        return;
    } else if (this.signed && this.value & (1 << (this.width - 1))) {
        this.value -= (1 << this.width);
    } else if (this.msb) {
        var msb = eval(this.msb);
        this.value |= msb.value << this.width;
        this.max &= (this.mask >> this.bit);
        this.max |= msb.max << this.width;
    }
    this.value *= this.multiplier;
    this.value += this.offset;

    if (this.pointerTo) this.rom.parsePath(this.pointerTo);
}

ROMProperty.prototype.setValue = function(value) {

    // return if the value didn't change
    var oldValue = this.value;
    if (value === oldValue) {
        this.notifyObservers();
        return;
    }

    // functions to undo/redo
    var assembly = this;
    function fixReferences(oldRef, newRef) {
        var script = assembly.rom[assembly.script];
        var oldCommand = script.ref[oldRef];
        // remove the old reference
        for (var r = 0; r < oldCommand.reference.length; r++) {
            var reference = oldCommand.reference[r];
            if (reference.target !== assembly) continue;
            oldCommand.reference.splice(r, 1);
        }

        // add a reference to the new command
        script.addPlaceholder(assembly, newRef);
    }

    function redo() {
        assembly.value = value;
        assembly.notifyObservers();
        if (assembly.script) fixReferences(oldValue, value);
    }
    function undo() {
        assembly.value = oldValue;
        assembly.notifyObservers();
        if (assembly.script) fixReferences(value, oldValue);
    }

    // perform an action to change the value
    var description = "Set " + this.name + " Value";
    var action = new ROMAction(this, undo, redo, description);
    this.rom.beginAction();
    this.rom.doAction(action);
    if (assembly.msb) {
        var msb = eval(assembly.msb);
        msb.setValue(value >> assembly.width);
    }
    this.rom.endAction();
}

ROMProperty.prototype.setTarget = function(target) {
    var pointerTo = this.rom.parsePath(this.pointerTo);
    if (!pointerTo) {
        this.target = null;
        return;
    }

    var oldTarget = this.target;

    // find the old reference
    var oldReference = null;
    if (oldTarget && oldTarget.reference) {
        for (var r = 0; r < oldTarget.reference.length; r++) {
            if (oldTarget.reference[r].target !== this) continue;
            oldReference = oldTarget.reference[r];
            break;
        }
    }

    // create a new reference
    var referenceDefinition = {
        target: this,
        relativeTo: pointerTo.relativeTo,
        isMapped: pointerTo.isMapped
    }
    var newReference = new ROMReference(this.rom, referenceDefinition, target);

    var assembly = this;
    function redo() {
        assembly.target = target;
        if (target && target.reference) {
            target.reference.push(newReference);
            target.markAsDirty(true);
        }

        // remove the old reference
        if (oldTarget && oldTarget.reference && oldReference) {
            var index = oldTarget.reference.indexOf(oldReference);
            if (index !== -1) oldTarget.reference.splice(index);
        }
        assembly.notifyObservers();
    }
    function undo() {
        assembly.target = oldTarget;
        if (oldTarget && oldTarget.reference) {
            oldTarget.reference.push(oldReference);
            oldTarget.markAsDirty(true);
        }

        if (target && target.reference && newReference) {
            var index = target.reference.indexOf(newReference);
            if (index !== -1) target.reference.splice(index);
        }
        assembly.notifyObservers();
    }

    // perform an action to change the value
    var description = "Set " + this.name + " Target";
    var action = new ROMAction(this, undo, redo, description);
    this.rom.doAction(action);
}

// ROMArray
function ROMArray(rom, definition, parent) {
    ROMAssembly.call(this, rom, definition, parent);

    // create the array
    this.array = [];
    this.arrayLength = 0;
    this.min = 0;
    this.max = undefined;
    if (definition.array) {
        // old-style array definition
        var length = Number(definition.array.length);
        if (isNumber(length)) this.arrayLength = length;
        var max = Number(definition.array.max);
        if (isNumber(max)) this.max = max;
        this.min = 0; // default minimum array size is zero
        var min = Number(definition.array.min);
        if (isNumber(min)) this.min = min;
    } else {
        // normal array definition
        var length = Number(definition.arrayLength);
        if (isNumber(length)) this.arrayLength = length;
        var max = Number(definition.arrayMax);
        if (isNumber(max)) this.max = max;
        this.min = 0; // default minimum array size is zero
        var min = Number(definition.arrayMin);
        if (isNumber(min)) this.min = min;
    }

    this.hideCategory = (definition.hideCategory === true);
    this.isFragmented = (definition.isFragmented === true);
    this.isSequential = (definition.isSequential === true);
    this.endPointer = (definition.endPointer === true);
    this.autoBank = (definition.autoBank === true);
    this.terminator = definition.terminator;
    this.pointerAlign = Number(definition.pointerAlign) || 1;
    this.isMapped = false; // pointers are mapped by default
    this.relativeTo = this.isFragmented ? this.parent : this;

    // create the prototype assembly
    this.assembly = this.createPrototype(definition.assembly);

    if (definition.pointerObject) {
        // custom pointers in an external object
        this.pointerObject = definition.pointerObject;
        this.isMapped = true;

    } else if (definition.pointerTable) {
        // standard pointer table
        this.pointerTable = this.createPointerTable(definition.pointerTable);
        this.pointerLength = Number(definition.pointerTable.pointerLength) || this.rom.pointerLength;
        this.isMapped = (definition.pointerTable.isMapped === true);
        var offset = Number(definition.pointerTable.offset);
        if (isNumber(offset)) {
            // map pointer offset immediately
            if (!this.isMapped && this.parent.mapAddress) offset = this.parent.mapAddress(offset);
        } else {
            offset = 0;
            this.isMapped = true;
        }
        this.pointerOffset = offset;
    }
}

/*
    i've spent a good 17 thousand hours trying to make pointer offsets work
    effectively, so i figured it would be a good idea to document what my
    strategy is, because i'm inevitably going to have to fix something or
    add new functionality.

    most pointers are pretty simple. there is a pointer offset, which is stored
    in the definition file as an unmapped address (meaning the same format that
    the assembly code needs it to be in). when the file is opened, the pointer
    offset immediately gets mapped into a rom offset. each pointer value gets
    offset by this amount, and then the parent array's offset is subtracted out,
    then the data can be read. when data gets saved, the new pointers start out
    relative to the parent array, then the parent array's offset is added, and
    then the pointer offset gets subtracted out to get the pointer that is
    written to the rom.

    this doesn't work for absolute pointers though, because a pointer offset of
    0 is going to get mapped to something which doesn't unmap back to zero.
    instead, absolute pointers have an undefined pointer offset (not 0). instead
    of offseting the pointers by a mapped pointer offset, the pointers
    themselves get mapped. in order for this to work, the "isMapped" property of
    the array must be set to true. when the data gets saved, the parent array's
    offset is still added, but then the pointers themselves are unmapped back
    into assembly addresses.

    these two types of pointers cover almost everything i've come across. one
    exception is for nes and lorom mapping where the pointer offsets can't be
    mapped. in particular, this is an issue for the ff1 world map layout. the
    solution i came up with is to leave the pointer offset as an unmapped
    address, add the pointer offset, and then map the resulting value. when the
    data gets saved, the pointers get mapped first, and then the pointer offset
    gets subtracted. this doesn't work if the data spans more than one bank
    though, so it only gets used in specific cases, again by setting "isMapped"
    to true.

    there are also fragmented arrays, which live in the array's parent rather
    than the array itself. the only difference for these is that all of the rom
    addresses are calculated relative to the parent rather than the array. these
    are nice, but because there is no specified subrange they run into issues
    when it's not obvious where each array item ends
*/

ROMArray.prototype = Object.create(ROMAssembly.prototype);
ROMArray.prototype.constructor = ROMArray;

Object.defineProperty(ROMArray.prototype, "definition", { get: function() {
    var definition = Object.getOwnPropertyDescriptor(ROMAssembly.prototype, "definition").get.call(this);

    if (this.arrayLength) definition.arrayLength = this.arrayLength;
    if (this.max) definition.arrayMax = this.max;
    if (this.min) definition.arrayMin = this.min;

    if (this.hideCategory) definition.hideCategory = true;
    if (this.isFragmented) definition.isFragmented = true;
    if (this.isSequential) definition.isSequential = true;
    if (this.endPointer) definition.endPointer = true;
    if (this.autoBank) definition.autoBank = true;
    if (this.terminator !== undefined) definition.terminator = this.terminator;
    if (this.pointerAlign !== 1) definition.pointerAlign = hexString(this.pointerAlign);

    // prototype assembly
    definition.assembly = this.assembly.definition;

    if (definition.assembly.type === ROMObject.Type.assembly) delete definition.assembly.type;
    delete definition.assembly.range;
    delete definition.assembly.key;
    delete definition.assembly.name;
    delete definition.assembly.canRelocate;
    if (this.assembly.range && !this.assembly.range.isEmpty) definition.assembly.length = this.assembly.range.length;
    if (Object.keys(definition.assembly).length === 0) delete definition.assembly;

    if (this.pointerObject) {
        // custom pointers in an external object
        definition.pointerObject = this.pointerObject;

    } else if (this.pointerTable) {
        // standard pointer table
        var pointerTableDefinition = this.pointerTable.definition;
        delete pointerTableDefinition.key;
        delete pointerTableDefinition.name;
        delete pointerTableDefinition.type;
        if (this.pointerLength != this.rom.pointerLength) pointerTableDefinition.pointerLength = this.pointerLength;
        if (this.pointerOffset === 0) {
            if (!this.isMapped) pointerTableDefinition.offset = 0;
        } else if (this.pointerOffset) {
            if (this.isMapped) pointerTableDefinition.isMapped = true;
            var offset = this.pointerOffset;
            if (!this.isMapped && this.parent.unmapAddress) offset = this.parent.unmapAddress(offset);
            pointerTableDefinition.offset = hexString(offset);
        }
        definition.pointerTable = pointerTableDefinition;
    }

    return definition;
}});

ROMArray.prototype.createPrototype = function(definition) {

    // create a prototype assembly
    definition = definition || {};
    definition.type = definition.type || ROMObject.Type.assembly;
    definition.name = definition.name || this.name;
    definition.key = definition.key || this.key;
    definition.canRelocate = true;
    var prototype = ROMObject.create(this.rom, definition, this);
    return prototype;
}

ROMArray.prototype.updateReferences = function() {

    // update references for array items
    for (var i = 0; i < this.arrayLength; i++) {
        var assembly = this.item(i);
        if (assembly.updateReferences) assembly.updateReferences();
    }

    ROMAssembly.prototype.updateReferences.call(this);
}

ROMArray.prototype.relocate = function(begin, end) {

    // no need to relocate fragmented arrays
    if (this.isFragmented) {
        // not sure how to handle fragmented arrays with a cutoff
        return;
    }

    if (begin !== this.range.begin) this.updatePointerOffset(begin);

    ROMAssembly.prototype.relocate.call(this, begin, end);
}

ROMArray.prototype.assemble = function(data) {

    // fragmented assemblies get assembled by the parent
    if (this.isFragmented) return ROMAssembly.prototype.assemble.call(this, data);

    var length = 0;
    var i, assembly, pointer;

    if (!this.pointerTable || this.isSequential) {
        // fixed-length items or sequential items
        for (i = 0; i < this.arrayLength; i++) {
            assembly = this.item(i);
            assembly.relocate(length);
            length += assembly.assembledLength;

            if (length % assembly.align) length = Math.ceil(length / assembly.align) * assembly.align;
        }

    } else {
        // shared items
        var duplicates = [];
        var sharedData = null;
        for (i = 0; i < this.arrayLength; i++) {
            assembly = this.item(i);
            assembly.assemble();
            var assemblyData = assembly.lazyData;

            sharedData = null;
            for (var d = 0; d < duplicates.length; d++) {
                // look for a duplicate item
                sharedData = duplicates[d];
                if (compareTypedArrays(sharedData.data, assemblyData)) break;
                sharedData = null;
            }

            if (sharedData === null) {
                // no duplicate found
                sharedData = {pointer: length, data: assemblyData};
                duplicates.push(sharedData);
                length += assemblyData.length;
            }

            // relocate the assembly
            assembly.relocate(sharedData.pointer);

            // for auto-bank arrays, duplicates must be sequential
            // (otherwise it will be impossible to tell where a bank ends)
            if (this.autoBank && duplicates.length > 1) duplicates = [];
        }
    }

    // create an array and assemble each item
    this.data = new Uint8Array(length);
    for (i = 0; i < this.arrayLength; i++) this.array[i].assemble(this.data);

    return ROMAssembly.prototype.assemble.call(this, data);
}

ROMArray.prototype.disassemble = function(data) {

    ROMAssembly.prototype.disassemble.call(this, data);

    // disassemble the pointer table
    if (this.pointerTable) this.pointerTable.disassemble(data);

    // determine the range of each item in the array
    this.pointers = [];
    var itemRanges = [];
    var begin, end, pointer;
    if (this.terminator === "\\0") {
        // array of null-terminated strings
        begin = 0;
        var textEncoding = this.rom.textEncoding[this.assembly.encoding];
        while (begin < this.data.length) {
            end = begin + textEncoding.textLength(this.data.subarray(begin));
            itemRanges.push(new ROMRange(begin, end));
            begin = end;
        }

    } else if (isNumber(Number(this.terminator))) {
        // terminated data
        var terminator = Number(this.terminator);
        begin = 0;
        end = 0;
        var i = 0;
        var itemLength = this.assembly.range.length || this.assembly.align;
        while (end < this.data.length) {
            while (this.data[end] !== terminator && end < this.data.length) end += itemLength;
            end += this.assembly.align;
            itemRanges.push(new ROMRange(begin, end));
            begin = end;
            if (itemRanges.length === this.arrayLength) break;
        }

    } else if (!this.pointerTable && !this.pointerObject) {
        // fixed-length items
        var length = this.assembly.range.length || 1;

        // validate the number of array items
        if (this.arrayLength === 0) {
            var l = Math.floor(this.data.length / length);
            this.arrayLength = Math.floor(this.data.length / length);
        }

        for (var i = 0; i < this.arrayLength; i++) {
            begin = i * length;
            itemRanges.push(new ROMRange(begin, begin + length));
        }

    } else if (this.isSequential) {
        // sequential items
        var pointerRanges = {};
        var unsorted = this.pointerObject ? this.readPointerObjects() : this.readPointerTable();
        for (i = 0; i < (unsorted.length - 1); i++) {
            pointer = unsorted[i];
            end = Math.max(pointer, unsorted[i + 1]);
            var range = new ROMRange(pointer, end);
            itemRanges.push(range);
            pointerRanges[begin] = {range: range};
        }
        pointer = unsorted[i];
        var range = new ROMRange(pointer, this.range.end);
        itemRanges.push(range);
        pointerRanges[begin] = {range: range};

    } else {
        // read pointers
        var unsorted = this.pointerObject ? this.readPointerObjects() : this.readPointerTable();

        // sort pointers in descending order
        var sorted = unsorted.slice();
        sorted.sort(function(a, b) { return b - a; });

        // create an array of ranges corresponding to each pointer
        var pointerRanges = {};
        end = this.relativeTo.range.end;
//        end = this.range.isEmpty ? this.parent.range.length : this.range.length;
        for (i = 0; i < sorted.length; i++) {
            begin = sorted[i];

            // skip duplicates
            if (pointerRanges[begin] !== undefined) continue;

            // set the length if assemblies have a fixed length
            if (this.assembly.range.length) end = begin + this.assembly.range.length;

            // store the range, indexed by pointer value
            pointerRanges[begin] = { range: new ROMRange(begin, end) };

            // the next pointer ends at the beginning of this pointer
            end = begin;
        }

        if (this.pointerObject) {
            // for external pointers, use each pointer only once
            var filtered = sorted.filter(function(item, pos, self) {
                return self.indexOf(item) === pos;
            });

            // sort in ascending order
            filtered.sort(function(a, b) { return a - b; });
            for (i = 0; i < filtered.length; i++) {
                begin = filtered[i];
                pointerRanges[begin].i = i;
                itemRanges.push(pointerRanges[begin].range);
            }
        } else {
            // create an array of ranges for each item
            for (i = 0; i < this.arrayLength; i++) {
                begin = unsorted[i];
                pointerRanges[begin].i = i;
                itemRanges.push(pointerRanges[begin].range);
            }
        }
    }

    if (this.pointerTable && this.endPointer) {
        // add a final pointer to mark the end of the data
        pointer = this.createPointer(this.arrayLength);
        pointer.options.rangeEnd = true;
        pointer.options.relativeTo = null;
        this.reference.push(pointer);
    }

    // create each array item
    var definition = this.assembly.definition;
    this.array = [];
    for (i = 0; i < itemRanges.length; i++) {
        var range = itemRanges[i];
//        if (!this.range.isEmpty) range = range.intersection(this.range);
        definition.range = range.toString();

        var assembly;
        if (this.isFragmented) {
            definition.key = this.key + "_" + i;
            assembly = this.parent.addAssembly(definition);
            assembly.fragment = true;
//            assembly.canRelocate = true;
            assembly.canRelocate = this.canRelocate;

        } else {
            assembly = ROMObject.create(this.rom, definition, this);
        }

        assembly.i = i;
        this.array[i] = assembly;

        // update pointer references
        if (this.pointerTable) {
            var pointer = this.pointers[i];
            if (!pointer) continue;
            pointer.parent = assembly;
            assembly.reference.push(pointer);
        }
    }
    this.arrayLength = this.array.length;

    // initialize external pointer targets
    if (this.pointerObject) {
        for (i = 0; i < this.pointers.length; i++) {
            var pointer = this.pointers[i];
            var pointerValue = pointer.value;
            if (this.parent.mapAddress) pointerValue = this.parent.mapAddress(pointerValue);
            pointerValue -= this.relativeTo.range.begin;
            var pointerRange = pointerRanges[pointerValue];
            if (!pointerRange) continue;
            var assembly = this.item(pointerRange.i);
            pointer.target = assembly;
            var pointerDefinition = {
                target: pointer,
                relativeTo: this.relativeTo,
                isMapped: this.isMapped
            }
            var pointerReference = new ROMReference(this.rom, pointerDefinition, assembly);
            assembly.reference.push(pointerReference);
        }
    }
}

ROMArray.pointerMask = [1, 0xFF, 0xFFFF, 0xFFFFFF, 0x7FFFFFFF];

ROMArray.prototype.createPointerTable = function(definition) {

    if (!definition) return null;

    // create a pointer table assembly
    definition.type = definition.type || ROMObject.Type.assembly;
    definition.name = definition.name || (this.name + " Pointer Table");
    definition.key = definition.key || (this.key + "PointerTable");
    var pointerTable = this.parent.addAssembly(definition);
    return pointerTable;
}

ROMArray.prototype.createPointer = function(i) {
    if (!this.pointerTable) return null;

    var offset = this.pointerOffset;

    // create a new reference
    var definition = {
        offset: offset,
        begin: i * this.pointerLength,
        mask: ROMArray.pointerMask[this.pointerLength],
        target: this.pointerTable,
        relativeTo: this.relativeTo,
        isMapped: this.isMapped
    };

    return new ROMReference(this.rom, definition, this);
}

ROMArray.prototype.readPointerTable = function() {
    var unsorted = [];
    var bankOffset = 0;
    var bankSize = this.rom.bankSize();
    var previousValue = 0;
    var pointer, pointerValue;

    for (var i = 0; i < this.arrayLength; i++) {
        pointer = this.createPointer(i);
        this.pointers.push(pointer);
        pointerValue = pointer.value;
//        if (this.parent.mapAddress) pointerValue = this.parent.mapAddress(pointerValue);
//        pointerValue -= this.relativeTo.range.begin;
        if (this.isMapped && this.parent.mapAddress) pointerValue = this.parent.mapAddress(pointerValue);
        pointerValue -= this.relativeTo.range.begin;
        unsorted.push(pointerValue);

        // auto-bank pointers
        if (!this.autoBank || i === 0) continue;
        unsorted[i] += bankOffset;

        // check if this pointer value is less than the previous one
        if (unsorted[i] < previousValue) {
            // go to the next bank
            bankOffset += bankSize;
            unsorted[i] += bankSize;
        }
        previousValue = unsorted[i];
    }
    return unsorted;
}

ROMArray.prototype.updatePointers = function() {
    if (!this.pointerTable) return;

    // create new pointers
//    var length = 0;
    for (var i = 0; i < this.arrayLength; i++) {
        var assembly = this.item(i);
        var pointer = this.createPointer(i);
        pointer.parent = assembly;
        assembly.reference[0] = pointer;
//        if (!pointer) {
//            // create a new pointer
//            pointer = this.createPointer(i);
//            if (!pointer) continue;
//            pointer.parent = assembly;
//            assembly.reference.push(pointer);
//        }
//        pointer.options.begin = length;
//        pointer.options.offset = this.pointerOffset;
//        length += this.pointerLength;
    }

    // find and adjust the end pointer
    var pointerTableLength = this.arrayLength * this.pointerLength;
    for (var r = 0; r < this.reference.length; r++) {
        var reference = this.reference[r];
        if (!reference.options || !reference.options.rangeEnd) continue;

        // create a new end pointer
        var pointer = this.createPointer(this.arrayLength);
        pointer.options.rangeEnd = true;
        pointer.options.relativeTo = null;
        this.reference[r] = pointer;
        pointerTableLength += this.pointerLength;
        break;
    }

    // change the length of the pointer table
    if (this.pointerTable.data.length !== pointerTableLength) {
        this.pointerTable.data = new Uint8Array(pointerTableLength);
        this.pointerTable.markAsDirty();
    }
}

ROMArray.prototype.updatePointerOffset = function(offset) {

    // don't modify the pointer offset if the assembly can't relocate
    if (!this.canRelocate) return;

    var rawOffset = offset;
    if (this.parent.unmapAddress) rawOffset = this.parent.unmapAddress(rawOffset);

    // align the pointer offset
    if (this.pointerAlign !== 1) {
        // round the raw offset down to the nearest multiple of the alignment
        if (rawOffset % this.pointerAlign) rawOffset = Math.floor(offset / this.pointerAlign) * this.pointerAlign;
        offset = rawOffset;
        if (this.parent.mapAddress) offset = this.parent.mapAddress(offset);
    }

    if (this.pointerOffset) {
        this.pointerOffset = this.isMapped ? rawOffset : offset;
        this.updatePointers();
        this.pointerTable.markAsDirty();

    } else if (this.pointerObject) {
//        if (this.parent.unmapAddress) offset = this.parent.unmapAddress(offset);

        var pointers = this.getPointerObjects(true);
        for (var p = 0; p < pointers.length; p++) {
            var pointer = pointers[p];
            if (pointer.offset) pointer.offset = rawOffset
        }
    }
}

ROMArray.prototype.getPointerObjects = function(includePrototypes) {
    var objects = [];

    var pointerObjects = this.pointerObject;
    if (!isArray(pointerObjects)) pointerObjects = [pointerObjects];

    for (var i = 0; i < pointerObjects.length; i++) {
        var pointerObject = pointerObjects[i];
        if (!pointerObject || !pointerObject.pointerPath) continue;
        var pointerPath = pointerObject.pointerPath;
        var pointer;

        if (pointerObject.arrayPath) {
            var pointerArray = this.parsePath(pointerObject.arrayPath);
            if (!(pointerArray instanceof ROMArray)) continue;

            // include the array prototype assembly
            if (includePrototypes) objects.push(pointerArray.assembly);

            for (var p = 0; p < pointerArray.arrayLength; p++) {

                // get the array item
                var pointerItem = pointerArray.item(p);
                if (!pointerItem) continue;

                // parse the pointer path
                pointer = this.parsePath(pointerPath, pointerItem);
                objects.push(pointer);
            }
        } else {
            // get pointers from something that is not an array (???)
            pointer = this.parsePath(pointerPath, pointerObject);
            objects.push(pointer);
        }
    }

    return objects;
}

ROMArray.prototype.readPointerObjects = function() {

    var unsorted = [];
    this.pointers = this.getPointerObjects(false);
    for (var p = 0; p < this.pointers.length; p++) {
        var pointer = this.pointers[p];
        var pointerValue = pointer.value;

        // skip special values
        if (pointer.special[pointerValue]) continue;

        if (this.parent.mapAddress) pointerValue = this.parent.mapAddress(pointerValue);
        pointerValue -= this.relativeTo.range.begin;
        unsorted.push(pointerValue);
    }
    return unsorted;
}

ROMArray.prototype.updateArray = function() {
    // update item indices
    this.arrayLength = this.array.length;
    for (var i = 0; i < this.arrayLength; i++) this.array[i].i = i;
    this.updatePointers();

    // update string table

    // update other linked arrays
}

ROMArray.prototype.blankAssembly = function() {
    var assembly = ROMObject.create(this.rom, this.assembly.definition, this);
    var data = new Uint8Array(assembly.range.length);
    assembly.range = new ROMRange(0, data.length);
    assembly.disassemble(data);
    assembly.i = this.arrayLength;
    if (this.isFragmented) {
        assembly.fragment = true;
        assembly.canRelocate = true;
    }
    var pointer = this.createPointer(assembly.i);
    if (pointer) {
        pointer.parent = assembly;
        assembly.reference.push(pointer);
    }
    return assembly;
}

ROMArray.prototype.insertAssembly = function(assembly, i) {
    if (this.max && this.arrayLength >= this.max) {
        // array is full
        this.notifyObservers();
        return null;
    }

    // validate the index
    if (!isNumber(i) || i > this.arrayLength) i = this.arrayLength;

    // perform an action to insert the assembly
    var self = this;
    function redo() {
        self.array.splice(i, 0, assembly);
        self.updateArray();
        self.notifyObservers();
    }
    function undo() {
        self.array.splice(i, 1);
        self.updateArray();
        self.notifyObservers();
    }
    var description = "Insert Assembly";
    var action = new ROMAction(this, undo, redo, description);
    this.rom.doAction(action);
    return this.array[i];
}

ROMArray.prototype.removeAssembly = function(i) {
    // validate the index
    if (!isNumber(i)) i = this.arrayLength - 1;
    if (i >= this.arrayLength || this.arrayLength === this.min) {
        this.notifyObservers();
        return null;
    }

    // perform an action to remove the assembly
    var self = this;
    var assembly = this.array[i];
    function redo() {
        self.array.splice(i, 1);
        self.notifyObservers();
    }
    function undo() {
        self.array.splice(i, 0, assembly);
        self.notifyObservers();
    }
    var description = "Remove Assembly";
    var action = new ROMAction(this, undo, redo, description);
    this.rom.doAction(action);
    return this.array[i];
}

ROMArray.prototype.setLength = function(length) {

    if (!isNumber(length)) return;
    length = Math.max(length, this.min);
    if (this.max) length = Math.min(length, this.max);

    // return if the length didn't change
    if (this.arrayLength === length) return;

    this.rom.beginAction();
    if (this.arrayLength > length) {
        // remove array elements
        while (this.arrayLength !== length) this.removeAssembly();

    } else {
        // insert array elements
        while (this.arrayLength !== length) this.insertAssembly(this.blankAssembly());
    }

    this.rom.endAction();
}

ROMArray.prototype.item = function(i) {

    var assembly = this.array[i];
    if (!assembly) {
        // array index out of bounds
        return undefined;
    }

    if (!assembly.isLoaded) {
        // lazy load the array item
        var data = this.relativeTo.data;
//        var data = this.range.isEmpty ? this.parent.data : this.data;
        assembly.disassemble(data);
    }
    return assembly;
}

// ROMCommand
function ROMCommand(rom, definition, parent) {
    this.encoding = definition.encoding;
    this.ref = definition.ref;
    this._label = definition.label;
    this.category = definition.category;

    ROMData.call(this, rom, definition, parent);
    this.type = ROMObject.Type.command;
    this.canRelocate = true;

    // minimum length 1
    if (this.range.length === 0) this.range.end = this.range.begin + 1;
}

ROMCommand.prototype = Object.create(ROMData.prototype);
ROMCommand.prototype.constructor = ROMCommand;

ROMCommand.prototype.assemble = function(data) {
    var encoding = this.rom.scriptEncoding[this.encoding];
    encoding.willAssemble(this);

    return ROMData.prototype.assemble.call(this, data);
}

ROMCommand.prototype.disassemble = function(data) {
    ROMData.prototype.disassemble.call(this, data);

    var encoding = this.rom.scriptEncoding[this.encoding];
    encoding.didDisassemble(this, data);
}

Object.defineProperty(ROMCommand.prototype, "label", { get: function() {
    // custom label
    return (this._label) ? this._label : this.defaultLabel;
}});

Object.defineProperty(ROMCommand.prototype, "defaultLabel", { get: function() {
    // default label
    var parent = this.parent;
    var address = this.range.begin;
    while (parent) {
        address += parent.range.begin;
        parent = parent.parent;
    }
    address = this.rom.unmapAddress(address);
    var bank = address >> 16;
    address &= 0xFFFF;
    bank = bank.toString(16).toUpperCase().padStart(2, '0');
    address = address.toString(16).toUpperCase().padStart(4, '0');
    return (bank + "/" + address);
}});

Object.defineProperty(ROMCommand.prototype, "description", { get: function() {
    return this.rom.scriptEncoding[this.encoding].description(this);
}});

Object.defineProperty(ROMCommand.prototype, "nextEncoding", { get: function() {
    return this.rom.scriptEncoding[this.encoding].nextEncoding(this);
}});

Object.defineProperty(ROMCommand.prototype, "previousCommand", { get: function() {
    var i = this.parent.command.indexOf(this);
    if (i === -1 || i === 0) return null;
    return this.parent.command[i - 1];
}});

Object.defineProperty(ROMCommand.prototype, "nextCommand", { get: function() {
    var i = this.parent.command.indexOf(this);
    if (i === -1 || i === this.parent.command.length - 1) return null;
    return this.parent.command[i + 1];
}});

ROMCommand.prototype.setLabel = function(label) {

    // return if the value didn't change
    var oldLabel = this._label;
    if (label === oldLabel) {
        this.notifyObservers();
        return;
    }

    // functions to undo/redo
    var command = this;
    function redo() {
        command._label = label;
        command.notifyObservers();
    }
    function undo() {
        command._label = oldLabel;
        command.notifyObservers();
    }

    // perform an action to change the value
    var action = new ROMAction(this, undo, redo, "Set Label " + this.name);
    this.rom.doAction(action);
}

// ROMScript
function ROMScript(rom, definition, parent) {
    ROMAssembly.call(this, rom, definition, parent);

    this.encoding = definition.encoding;
    this.command = []; // commands in sequential order
    this.ref = []; // commands by reference (note that this is distinct from "reference")
    this.label = {}; // commands by label
    this.nextRef = 0;

    // create label placeholders
    if (definition.label) {
        this.label = definition.label;
        var keys = Object.keys(definition.label);
        for (var i = 0; i < keys.length; i++) {
            var label = keys[i];
            var ref = definition.label[label];
            var offset;
            if (isString(ref)) {
                // most labels are just an offset
                offset = Number(ref);
                ref = { label: label };
            } else if (ref.offset) {
                // some are a dictionary with other attributes
                offset = Number(ref.offset);
                ref.label = label;
            }

            if (!isNumber(offset)) {
                this.rom.log("Invalid script reference: " + ref);
                continue;
            }

            offset = rom.mapAddress(Number(offset) - this.range.begin);
            this.ref[offset] = ref;
        }
    }
}

ROMScript.prototype = Object.create(ROMAssembly.prototype);
ROMScript.prototype.constructor = ROMScript;

Object.defineProperty(ROMScript.prototype, "assembledLength", { get: function() {

    if (this.lazyData) return this.lazyData.length;

    var assembledLength = this.updateOffsets();

    this.data = new Uint8Array(assembledLength);
    this.range.end = this.range.begin + assembledLength;
    return assembledLength;
}});

Object.defineProperty(ROMScript.prototype, "definition", { get: function() {
    var definition = Object.getOwnPropertyDescriptor(ROMAssembly.prototype, "definition").get.call(this);

    definition.encoding = this.encoding;

    var keys = Object.keys(this.label);
    if (keys.length) {
        definition.label = {};
        for (var i = 0; i < keys.length; i++) {
            var label = keys[i];
            var ref = this.label[label];
            if (ref instanceof ROMCommand) {
                var command = ref;
                if (!command._label) continue;
                var offset = rom.unmapAddress(command.range.begin) + this.range.begin;
                var previousCommand = command.previousCommand;
                if (previousCommand && previousCommand.nextEncoding === command.encoding) {
                    definition.label[label] = hexString(offset, 6);
                } else {
                    definition.label[label] = { offset: hexString(offset, 6), encoding: command.encoding };
                }
            } else {
                // the script probably hasn't been disassembled
                definition.label[label] = ref;
            }
        }
    }

    return definition;
}});

ROMScript.prototype.updateReferences = function() {

    // update references for commands
    this.ref = [];
    for (i = 0; i < this.command.length; i++) {
        var command = this.command[i];
        command.markAsDirty();
        command.updateReferences();
        command.ref = command.range.begin;
        this.ref[command.ref] = command;
    }

    ROMAssembly.prototype.updateReferences.call(this);
}

ROMScript.prototype.assemble = function(data) {

    // update the length of the script
    this.updateReferences();
    this.assembledLength;
    for (var c = 0; c < this.command.length; c++) {
        this.command[c].assemble(this.data);
    }

    return ROMAssembly.prototype.assemble.call(this, data);
}

ROMScript.prototype.disassemble = function(data) {

    ROMAssembly.prototype.disassemble.call(this, data);

    // start with default encoding
    var encoding = this.defaultEncoding;
    encoding.initScript(this, this.data);

    // disassemble commands
    var offset = 0;
    while (offset < this.data.length) {

        // get placeholder at this offset
        var ref = this.ref[offset];
        if (ref && ref.encoding) {
            encoding = this.rom.scriptEncoding[ref.encoding] || encoding;
        }

        var opcode = this.data[offset];
        var definition = encoding.command[opcode];

        // try a 2-byte opcode
        if (!definition && (offset + 1 <= this.data.length)) {
            var opcode2 = (opcode << 8) | this.data[offset + 1];
            definition = encoding.command[opcode2];
        }

        // use the default command if the opcode is not defined
        if (!definition) definition = encoding.command.default;

        // set the command's offset, ref, and label
        definition.begin = offset.toString();
        definition.ref = offset;
        if (ref && ref.label) definition.label = ref.label;

        // create the new command and disassemble it
        var command = new ROMCommand(this.rom, definition, this);
        delete definition.begin;
        delete definition.ref;
        delete definition.label;
        command.disassemble(this.data);
        this.command.push(command);
        this.ref[offset] = command;

        // copy references from placeholders
        if (ref && ref.reference) {
            for (var r = 0; r < ref.reference.length; r++) {
                // skip references that target the rom, they are just used
                // to update the script encoding during disassembly
                if (ref.reference[r].target === this.rom) continue;
                ref.reference[r].parent = command;
                command.reference.push(ref.reference[r]);
            }
        }

        // get the encoding for the next command
        var nextEncoding = command.nextEncoding;
        if (encoding.key !== nextEncoding) encoding = this.rom.scriptEncoding[nextEncoding];

        // next command
        offset += command.assembledLength || 1;
    }
    this.nextRef = offset;
    this.updateOffsets();
}

ROMScript.prototype.blankCommand = function(identifier) {
    identifier = identifier || "default";
    var components = identifier.split('.');
    var encoding = this.defaultEncoding;
    if (components.length === 2) {
        encoding = this.rom.scriptEncoding[components[0]];
        identifier = components[1];
    }
    if (!encoding) return null;
    var definition = encoding.command[identifier];
    if (!definition) return null;
    var command = new ROMCommand(this.rom, definition, this);
    command.ref = this.nextRef++;
    var data = new Uint8Array(command.range.length);
    var opcode = encoding.opcode[identifier];
    data[0] = opcode & 0xFF;
    if (opcode > 0xFF && data.length > 1) data[1] = opcode >> 8;
    command.disassemble(data);
    return command;
}

ROMScript.prototype.insertCommand = function(command, ref) {

    // validate the ref to insert after
    var previousCommand = this.ref[ref];
    var i = this.command.indexOf(previousCommand);
    if (i === -1) i = this.command.length - 1;

    // perform an action to insert the assembly
    function redo() {
        this.command.splice(i, 0, command);
        if (!command.ref) command.ref = this.nextRef++;
        this.ref[command.ref] = command;
        this.notifyObservers();
    }
    function undo() {
        this.command.splice(i, 1);
        this.ref[command.ref] = null;
        this.notifyObservers();
    }
    var description = "Insert Command";
    var action = new ROMAction(this, undo, redo, description);
    this.rom.doAction(action);
    return this.command[i];
}

ROMScript.prototype.removeCommand = function(command) {

    // validate the command
    var i = this.command.indexOf(command);
    if (i === -1) {
        this.notifyObservers();
        return null;
    }

    // perform an action to remove the assembly
    function redo() {
        this.command.splice(i, 1);
        this.ref[command.ref] = null;
        this.notifyObservers();
    }
    function undo() {
        this.command.splice(i, 0, command);
        if (!command.ref) command.ref = this.nextRef++;
        this.ref[command.ref] = command;
        this.notifyObservers();
    }
    var description = "Remove Command";
    var action = new ROMAction(this, undo, redo, description);
    this.rom.doAction(action);
    return this.command[i];
}

ROMScript.prototype.addPlaceholder = function(target, offset, encoding, label) {
    var placeholder = this.ref[offset] || {};
    placeholder.reference = placeholder.reference || [];
    this.ref[offset] = placeholder;

    // add a reference
    var reference = new ROMReference(this.rom, {target: target}, placeholder);
    placeholder.reference.push(reference);

    if (placeholder instanceof ROMCommand) return;

    // save the encoding and label in the placeholder
    placeholder.encoding = placeholder.encoding || encoding;
    placeholder.label = placeholder.label || label;
}

ROMScript.prototype.updateOffsets = function() {
    var offset = 0;
    this.label = {};
    for (var c = 0; c < this.command.length; c++) {
        var command = this.command[c];
        command.i = c;
        command.range.begin = offset;
        offset += command.assembledLength;
        command.range.end = offset;
        this.label[command.label] = command;
    }
    return offset;
}

Object.defineProperty(ROMScript.prototype, "defaultEncoding", { get: function() {
    var encodingName = isArray(this.encoding) ? this.encoding[0] : this.encoding;
    return this.rom.scriptEncoding[encodingName];
}});

// ROMScriptEncoding
function ROMScriptEncoding(rom, definition, parent) {
    ROMObject.call(this, rom, definition, parent);
    this.type = ROMObject.Type.scriptEncoding;

    if (definition.delegate) this.delegate = window[definition.delegate];

    // default opcode definition
    var opcodeDef = {
        "type": "property",
        "name": "Opcode",
        "begin": 0,
        "mask": "0xFF",
        "invalid": true
    }

    // create the command prototypes
    this.command = {}; // opcode or key -> command definition
    this.opcode = {}; // key -> first (or default) opcode
    if (!definition.command) return;
    var keys = Object.keys(definition.command);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var command = definition.command[key];
        command.key = key;
        command.encoding = this.key;
        if (!command.assembly) command.assembly = {};
        if (!command.assembly.opcode) command.assembly.opcode = opcodeDef;

        // convert single opcodes to an array
        var opcodes = command.opcode;
        if (!opcodes) continue;
        if (!isArray(opcodes)) opcodes = [opcodes];

        // change the mask for 2-byte opcodes
        if (opcodes[0] > 0xFF) command.assembly.opcode.mask = "0xFFFF";

        // store the command definition by all of its opcodes
        for (var o = 0; o < opcodes.length; o++) {
            var opcode = opcodes[o];
            var range = ROMRange.parse(opcode);
            var n = Number(opcode);
            if (!range.isEmpty) {
                if (o === 0) this.opcode[command.key] = range.begin;
                for (var r = range.begin; r < range.end; r++) {
                    this.command[r] = command;
                }
            } else if (isNumber(n)) {
                if (o === 0) this.opcode[command.key] = n;
                this.command[n] = command;
            } else if (opcode === "default") {
                this.command.default = command;
            }
        }

        // store the command definition by key
        this.command[key] = command;
    }

    // default command
    if (!this.command.default) {
        this.command.default = {
            "key": "default",
            "name": "Default Command",
            "length": 1,
            "encoding": this.key,
            "assembly": {
                "opcode": opcodeDef
            }
        };
    }
}

ROMScriptEncoding.prototype = Object.create(ROMObject.prototype);
ROMScriptEncoding.prototype.constructor = ROMScriptEncoding;

Object.defineProperty(ROMScriptEncoding.prototype, "definition", { get: function() {
    var definition = Object.getOwnPropertyDescriptor(ROMObject.prototype, "definition").get.call(this);

    if (this.delegate) definition.delegate = this.delegate.name;

    definition.command = {};

    var keys = Object.keys(this.opcode);
    for (var c = 0; c < keys.length; c++) {
        var key = keys[c];
        var opcode = this.opcode[key];
        var command = this.command[opcode];
        definition.command[command.key] = command;
    }

    return definition;
}});

ROMScriptEncoding.prototype.description = function(command) {
    if (this.delegate && this.delegate.description) {
        return this.delegate.description(command);
    } else {
        var opcode = command.opcode.value;
        return "Command " + hexString(opcode, 2);
    }
}

ROMScriptEncoding.prototype.initScript = function(script, data) {
    if (this.delegate && this.delegate.initScript) {
        return this.delegate.initScript(script, data);
    }
}

ROMScriptEncoding.prototype.didDisassemble = function(command, data) {
    if (this.delegate && this.delegate.didDisassemble) {
        return this.delegate.didDisassemble(command, data);
    }
}

ROMScriptEncoding.prototype.willAssemble = function(command) {
    if (this.delegate && this.delegate.willAssemble) {
        return this.delegate.willAssemble(command);
    }
}

ROMScriptEncoding.prototype.nextEncoding = function(command) {
    if (this.delegate && this.delegate.nextEncoding) {
        return this.delegate.nextEncoding(command);
    } else {
        return command.encoding;
    }
}

ROMScriptEncoding.prototype.populateMenu = function(menu) {
    menu.innerHTML = "";
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
            li.classList.add("menu-item");
            if (command.encoding) {
                // command
                li.id = command.encoding + "." + command.key;
                li.onclick = function() { eval('scriptList.insert("' + this.id + '")'); };
            } else {
                // category
                var ul = document.createElement('ul');
                ul.classList.add("menu-submenu");
                ul.classList.add("menu");
                createSubMenu(ul, command);
                li.appendChild(ul);
            }
            menu.appendChild(li);
        }
    }

    // go through all of the commands and pick out categories
    var keys = Object.keys(this.command);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var opcode = Number(key);
        if (!isNumber(opcode)) continue;
        var command = this.command[key];
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

// ROMText
function ROMText(rom, definition, parent) {
    ROMAssembly.call(this, rom, definition, parent);

    this.encoding = definition.encoding;
    this.text = "";
    this.length = definition.length; // this is different from this.range.length
    this.multiLine = definition.multiLine || false;
}

ROMText.prototype = Object.create(ROMAssembly.prototype);
ROMText.prototype.constructor = ROMText;

Object.defineProperty(ROMText.prototype, "definition", { get: function() {
    var definition = Object.getOwnPropertyDescriptor(ROMAssembly.prototype, "definition").get.call(this);

    delete definition.range;
    if (this.range.begin) definition.begin = this.range.begin;
    definition.encoding = this.encoding;
    definition.length = this.length;
    if (this.multiLine) definition.multiLine = true;

    return definition;
}});

ROMText.prototype.disassemble = function(data) {

    // for variable length text, length is determined by the data
    if (this.range.length === 0) this.range = new ROMRange(0, data.length);

    ROMAssembly.prototype.disassemble.call(this, data);

    var encoding = this.rom.textEncoding[this.encoding];
    if (encoding) {
        this.text = encoding.decode(this.data);
    } else {
        this.text = String.fromCharCode.apply(null, this.data);
    }
}

ROMText.prototype.setText = function(text) {

    // validate the text
    var encoding = this.rom.textEncoding[this.encoding];
    if (!encoding) return; // TODO: add default encoding

    // encode the text to data
    var data = encoding.encode(text);

    // pad data for fixed-length text
    if (this.length) data = encoding.pad(data, this.length);

    // decode the data back to text to fix identify encoding errors
    text = encoding.decode(data);

    // return if the value didn't change
    var oldText = this.text;
    var oldData = this.data;
    if (compareTypedArrays(data, oldData)) {
        this.notifyObservers();
        return;
    }

    // functions to undo/redo
    var assembly = this;
    function redo() {
        assembly.text = text;
        assembly.data = data;
        assembly.notifyObservers();
    }
    function undo() {
        assembly.text = oldText;
        assembly.data = oldData;
        assembly.notifyObservers();
    }

    // perform an action to change the value
    var action = new ROMAction(this, undo, redo, "Set " + this.name);
    this.rom.doAction(action);
}

Object.defineProperty(ROMText.prototype, "formattedText", { get: function() {
    var encoding = this.rom.textEncoding[this.encoding];
    if (encoding) {
        return encoding.format(this.text);
    } else {
        return this.text;
    }
}});

Object.defineProperty(ROMText.prototype, "htmlText", { get: function() {
    var encoding = this.rom.textEncoding[this.encoding];
    if (encoding) {
        return encoding.format(this.text, true);
    } else {
        return this.text;
    }
}});

// ROMCharTable
function ROMCharTable(rom, definition, parent) {
    ROMObject.call(this, rom, definition, parent);
    this.type = ROMObject.Type.charTable;

    this.char = [];

    var keys = Object.keys(definition.char);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var num = Number(key);
        if (!isNumber(num)) continue;
        this.char[num] = definition.char[key];
    }
}

Object.defineProperty(ROMCharTable.prototype, "definition", { get: function() {
    var definition = Object.getOwnPropertyDescriptor(ROMObject.prototype, "definition").get.call(this);

    definition.char = {};

    this.char.forEach(function(c, i) {
        var pad = i > 0xFF ? 4 : 2;
        definition.char[hexString(i, pad)] = c;
    })

    return definition;
}});

// ROMTextEncoding
function ROMTextEncoding(rom, definition, parent) {
    ROMObject.call(this, rom, definition, parent);
    this.type = ROMObject.Type.textEncoding;

    this.encodingTable = {};
    this.decodingTable = [];
    this.charTable = definition.charTable;

    if (!isArray(definition.charTable)) { return; }
    for (var i = 0; i < definition.charTable.length; i++) {
        var charTable = this.rom.charTable[this.charTable[i]];
        if (!charTable) continue;
        var keys = Object.keys(charTable.char);
        for (var c = 0; c < keys.length; c++) {
            var key = Number(keys[c]);
            var value = charTable.char[key];
            this.decodingTable[key] = value;
            this.encodingTable[value] = key;
        }
    }
}

ROMTextEncoding.prototype = Object.create(ROMObject.prototype);
ROMTextEncoding.prototype.constructor = ROMTextEncoding;

Object.defineProperty(ROMTextEncoding.prototype, "definition", { get: function() {
    var definition = Object.getOwnPropertyDescriptor(ROMObject.prototype, "definition").get.call(this);

    definition.charTable = this.charTable;

    return definition;
}});

ROMTextEncoding.prototype.decode = function(data) {
    var text = "";
    var i = 0;
    var b1, b2, c;

    while (i < data.length) {
        c = null;
        b1 = data[i++];
        b2 = data[i++];
        if (b1) c = this.decodingTable[(b1 << 8) | b2];
        if (!c) {
            c = this.decodingTable[b1];
            i--;
        }

        if (!c) {
            text += "\\" + hexString(b1, 2);
        } else if (c == "\\0") {
            break; // string terminator
        } else if (c == "\\pad") {
            continue; // pad
        } else if (c.endsWith("[")) {
            text += c;
            b1 = data[i++] || 0;
            text += hexString(b1, 2);
            text += "]";
        } else {
            text += c;
        }
    }

    return text;
}

ROMTextEncoding.prototype.encode = function(text) {
    var data = [];
    var i = 0;
    var keys = Object.keys(this.encodingTable);

    while (i < text.length) {
        var remainingText = text.substring(i);
        var matches = keys.filter(function(s) {
            return remainingText.startsWith(s);
        });

        if (matches.length === 0) {
            this.rom.log("Invalid character: " + remainingText[0]);
            i++;
            continue;
        }

        var match = matches.reduce(function (a, b) {
            return a.length > b.length ? a : b;
        });

        // end of string
        if (match === "\\0") break;

        var value = this.encodingTable[match];
        i += match.length;

        if (match.endsWith("[")) {
            var end = text.indexOf("]", i);
            parameter = text.substring(i, end);
            var n = Number(parameter);
            if (!isNumber(n) || n > 0xFF) {
                this.rom.log("Invalid parameter: " + parameter);
                n = 0;
                end = i;
            }
            i = end + 1;
            value <<= 8;
            value |= n;
        }

        if (value > 0xFF) {
            data.push(value >> 8);
            data.push(value & 0xFF);
        } else {
            data.push(value);
        }
    }

    var terminator = this.encodingTable["\\0"];
    if (isNumber(terminator) && data[data.length - 1] !== terminator) {
        data.push(terminator);
    }

    return Uint8Array.from(data);
}

ROMTextEncoding.prototype.pad = function(data, length) {
    if (data.length > length) {
        // trim the data if it is too long
        data = data.subarray(0, length);
    } else if (data.length < length) {
        // find the encoding's pad value
        var padValue = this.encodingTable["\\pad"] || 0xFF;
        var newData = new Uint8Array(length);
        newData.set(data);
        newData.fill(padValue, data.length);
        data = newData;
    }
    return data;
}

ROMTextEncoding.prototype.textLength = function(data) {
    var i = 0;
    var b1, b2, c;

    while (i < data.length) {
        c = null;
        b1 = data[i++];
        b2 = data[i++];
        if (b1) c = this.decodingTable[(b1 << 8) | b2];
        if (!c) {
            c = this.decodingTable[b1];
            i--;
        }

        if (!c) {
            continue;
        } else if (c === "\\0") {
            break; // string terminator
        } else if (c.endsWith("[")) {
            i++;
        }
    }

    return Math.min(i, data.length);
}

ROMTextEncoding.prototype.format = function(text, html) {

    var escapeKeys = Object.keys(this.encodingTable);
    escapeKeys = escapeKeys.filter(function(str) { return str.startsWith("\\"); });
    escapeKeys = escapeKeys.sort(function(a, b) { return b.length - a.length; });

    for (var i = 0; i < escapeKeys.length; i++) {
        var key = escapeKeys[i];
        if (!text.includes(key)) continue;

        if (key.endsWith("[")) {
            var regex = new RegExp("\\" + key.slice(0, -1) + "\\\[(\\w+)]", "g");
            if (key === "\\char[") {
                // replace character names (index in brackets)
                var match;
                while ((match = regex.exec(text)) !== null) {
                    var c = Number(match[1]);
                    var characterName = this.rom.stringTable.characterNames.string[c].fString();
                    text = text.replace(match[0], characterName);
                    regex.lastIndex = 0; // reset the regex to the beginning of the string
                }
            } else {
                // delete all other escape codes with brackets
                text = text.replace(regex, "");
            }
            continue;
        }

        var regex = new RegExp("\\" + key, "g");
        if (key === "\\n" || key === "\\page") {
            // replace new line and page break
            text = text.replace(regex, (html ? "<br/>" : "\n"));
        } else if (key === "\\choice") {
            // replace multiple choice indicator
            for (var c = 0; text.includes(key); c++) {
                text = text.replace(key, c + ": ")
            }
        } else if (key.startsWith("\\char") || key.startsWith("\\hchar")) {
            // replace character name (no brackets)
            var c = Number(key.slice(-2));
            var characterName = this.rom.stringTable.characterNames.string[c].fString();
            text = text.replace(regex, characterName);
        } else {
            // delete all other escape codes
            text = text.replace(regex, "");
        }
    }
    return text;
}

// ROMString
function ROMString(rom, definition, parent) {
    ROMObject.call(this, rom, definition, parent);
    this.type = ROMObject.Type.string;
    this.value = definition.value || "";
    this.link = definition.link;
    this.language = definition.language;
    this._fString = null;
    this.observer = new ROMObserver(rom, this, null);
}

ROMString.prototype = Object.create(ROMObject.prototype);
ROMString.prototype.constructor = ROMString;

Object.defineProperty(ROMString.prototype, "path", { get: function() {
    return "stringTable." + this.parent.key;
}});

ROMString.prototype.fString = function(maxLength) {

    // formatted string
    var s = this._fString;
    var i = this.i;

    // check if the string needs to be formatted
    if (!s) {
        this.observer.stopObservingAll();

        // replace string index
        var s = this.value.replace(/%i/g, i.toString());
        this._fString = s;

        // replace links
        var links = s.match(/<([^>]+)>/g);
        if (!links) return s;
        for (var l = 0; l < links.length; l++) {
            var link = links[l];
            var path = link.substring(1, link.length - 1);
            var object = this.rom.parsePath(path);
            this.observer.startObserving(object, this.reset);
            if (object instanceof ROMText) {
                s = s.replace(link, object.formattedText);
            } else if (object instanceof ROMString) {
                s = s.replace(link, object.fString());
            } else if (isString(object)) {
                s = s.replace(link, object);
            } else {
                s = s.replace(link, "Invalid Link");
            }
        }
        this._fString = s;
    }

    if (maxLength && s.length > maxLength) s = s.substring(0, maxLength) + "…";
    return s;
}

ROMString.prototype.htmlString = function(maxLength) {
    return this.fString(maxLength).replace(/\n/g, "<br/>");
}

ROMString.prototype.setValue = function(value) {

    // return if the value didn't change
    var oldValue = this.value;
    if (value === oldValue) {
        this.notifyObservers();
        return;
    }

    // functions to undo/redo
    var string = this;
    function redo() {
        string.value = value;
        string.reset();
    }
    function undo() {
        string.value = oldValue;
        string.reset();
    }

    // perform an action to change the value
    var action = new ROMAction(this, undo, redo, "Set String " + this.name);
    this.rom.doAction(action);
}

ROMString.prototype.reset = function() {
    this._fString = null;
    this.observer.stopObservingAll();
    this.notifyObservers();
}

Object.defineProperty(ROMString.prototype, "labelString", { get: function() {
    return this;
}});

// ROMStringTable
function ROMStringTable(rom, definition, parent) {
    ROMObject.call(this, rom, definition, parent);
    this.type = ROMObject.Type.stringTable;
    this.link = definition.link;
    this.language = definition.language;
    this.hideIndex = (definition.hideIndex === true);

    this.string = [];
    var i, string;

    // convert index strings to numbers
    if (definition.string) {
        var keys = Object.keys(definition.string);
        for (i = 0; i < keys.length; i++) {
            var key = keys[i];
            var range = ROMRange.parse(key)
            var n = Number(key);
            if (!range.isEmpty) {
                for (n = range.begin; n < range.end; n++) {
                    this.string[n] = this.createString(definition.string[key]);
                    this.string[n].i = n;
                }
            } else if (isNumber(n)) {
                this.string[n] = this.createString(definition.string[key]);
                this.string[n].i = n;
            }
        }
    }

    // load default strings
    if (this.link) {
        this.defaultString = "<" + this.link + ">";
    } else if (definition.default) {
        this.defaultString = definition.default;
    } else {
        this.defaultString = "String %i";
    }
//    this.defaultString = definition.default;
//    if (!this.defaultString) this.defaultString = "String %i";
    this.length = definition.length;
    if (this.length) {
        for (i = 0; i < this.length; i++) {
            if (this.string[i]) continue;
            this.string[i] = this.createString(this.defaultString);
            this.string[i].i = i;
        }
    }
}

ROMStringTable.prototype = Object.create(ROMObject.prototype);
ROMStringTable.prototype.constructor = ROMStringTable;

Object.defineProperty(ROMStringTable.prototype, "definition", { get: function() {
    var definition = Object.getOwnPropertyDescriptor(ROMObject.prototype, "definition").get.call(this);

    var defaultString = this.defaultString;
    if (defaultString !== "String %i") definition.default = defaultString;
    if (this.length) definition.length = this.length;
    if (this.link) definition.link = this.link;
    if (this.language) definition.language = this.language;
    if (this.hideIndex === true) definition.hideIndex = true;

    // define the custom string list
    definition.string = {};
    this.string.forEach(function(s, i) {
        if (s.value !== defaultString) definition.string[i] = s.value;
    })

    // delete the string list if there were no custom strings
    if (Object.keys(definition.string).length === 0) definition.string = null;

    return definition;
}});

Object.defineProperty(ROMStringTable.prototype, "path", { get: function() {
    return "stringTable." + this.key;
}});

ROMStringTable.prototype.createString = function(value) {
    if (isString(value)) {
        return new ROMString(this.rom, {value: value, name: this.name, link: this.link}, this);
    } else {
        var definition = value;
        definition.name = value.name || this.name;
        definition.link = this.link;
        return new ROMString(this.rom, definition, this);
    }
    return null;
}

// TODO: add undo functionality for these
ROMStringTable.prototype.setString = function(i, value) {
    this.string[i] = this.createString(value);
    this.string[i].i = i;
}

ROMStringTable.prototype.insertString = function(i, string) {
    this.string.splice(i, 0, string);
}

ROMStringTable.prototype.removeString = function(i) {
    this.string.splice(i, 1);
}

// ROMRange
function ROMRange(begin, end) {
    this.begin = begin;
    this.end = end;
}

Object.defineProperty(ROMRange.prototype, "isEmpty", {
    get: function() {
        return (this.end <= this.begin);
    }
});

Object.defineProperty(ROMRange.prototype, "length", {
    get: function() {
        return (this.end - this.begin);
    },
    set: function(length) {
        this.end = this.begin + length;
    }
});

ROMRange.prototype.toString = function(pad) {
    if (pad) {
        return (hexString(this.begin, pad) + "-" + hexString(this.end, pad));
    } else if (this.end < 0x0100) {
        return (this.begin + "-" + this.end);
    } else if (this.end < 0x010000) {
        return (hexString(this.begin, 4) + "-" + hexString(this.end, 4));
    } else if (this.end < 0x01000000) {
        return (hexString(this.begin, 6) + "-" + hexString(this.end, 6));
    } else {
        return (hexString(this.begin, 8) + "-" + hexString(this.end, 8));
    }
}

ROMRange.parse = function(expression) {
    var range = new ROMRange(0, 0);
    if (!isString(expression)) { return range; }
    var bounds = expression.split("-");
    if (bounds.length != 2) { return range; }
    var begin = Number(bounds[0]);
    var end = Number(bounds[1]);
    if (!isNumber(begin) || !isNumber(end)) { return range; }
    range.begin = begin;
    range.end = end;
    return range;
}

ROMRange.prototype.contains = function(i) {
    return (i >= this.begin && i < this.end);
}

ROMRange.prototype.offset = function(offset) {
    return new ROMRange(this.begin + offset, this.end + offset);
}

ROMRange.prototype.intersection = function(range) {
    if ((range.end < this.begin) || (range.begin > this.end)) return ROMRange.emptyRange;
    return new ROMRange(Math.max(range.begin, this.begin), Math.min(range.end, this.end));
}

ROMRange.prototype.union = function(range) {
    if ((range.end < this.begin) || (range.begin > this.end)) return ROMRange.emptyRange;
    return new ROMRange(Math.min(range.begin, this.begin), Math.max(range.end, this.end));
}

Object.defineProperty(ROMRange, "emptyRange", {
    get: function() { return new ROMRange(0, 0); }
});

// misc. methods

function bytesSwapped16(n) {
    return ((n & 0xFF) << 8) | ((n & 0xFF00) >> 8);
}

// https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
if (!String.prototype.padStart) {
    String.prototype.padStart = function padStart(targetLength,padString) {
        targetLength = targetLength>>0; //truncate if number or convert non-number to 0;
        padString = String((typeof padString !== 'undefined' ? padString : ' '));
        if (this.length > targetLength) {
            return String(this);
        }
        else {
            targetLength = targetLength-this.length;
            if (targetLength > padString.length) {
                // append to original to ensure we are longer than needed
                padString += padString.repeat(targetLength/padString.length);
            }
            return padString.slice(0,targetLength) + String(this);
        }
    };
}

function Rect(l, r, t, b) {

    l = Number(l) || 0;
    r = Number(r) || 0;
    t = Number(t) || 0;
    b = Number(b) || 0;
    if (r <= l) { l = 0; r = 0; }
    if (b <= t) { t = 0; b = 0; }

    this.l = l;
    this.r = r;
    this.t = t;
    this.b = b;
}

//Rect.emptyRect = new Rect(0, 0, 0, 0);
Object.defineProperty(Rect, "emptyRect", {
    get: function() { return new Rect(0, 0, 0, 0); }
});

Rect.prototype.isEmpty = function() {
    return (this.r <= this.l) || (this.b <= this.t);
}

Rect.prototype.isEqual = function(rect) {
    return (rect.l === this.l) &&
           (rect.r === this.r) &&
           (rect.t === this.t) &&
           (rect.b === this.b);
}

Rect.prototype.intersect = function(rect) {
    return new Rect(Math.max(this.l, rect.l),
                    Math.min(this.r, rect.r),
                    Math.max(this.t, rect.t),
                    Math.min(this.b, rect.b));
}

Rect.prototype.contains = function(rect) {
    return this.intersect(rect).isEqual(rect);
}

Rect.prototype.containsPoint = function(x, y) {
    return (x >= this.l) &&
           (x < this.r) &&
           (y >= this.t) &&
           (y < this.b);
}

Rect.prototype.scale = function(x, y) {
    x = Number(x);
    y = Number(y) || x;

    return new Rect((this.l * x) || 0, (this.r * x) || 0, (this.t * y) || 0, (this.b * y) || 0);
}

Rect.prototype.offset = function(x, y) {
    x = Number(x);
    y = Number(y);

    return new Rect(this.l + x, this.r + x, this.t + y, this.b + y);
}

Rect.prototype.inflate = function(l, r, t, b) {
    l = Number(l);
    r = Number(r);
    t = Number(t);
    b = Number(b);

    return new Rect(this.l - l, this.r - r, this.t + t, this.b + b);
}

Object.defineProperty(Rect.prototype, "w", {
    get: function() { return this.r - this.l; },
    set: function(w) { this.r = this.l + w; }
});

Object.defineProperty(Rect.prototype, "h", {
    get: function() { return this.b - this.t; },
    set: function(h) { this.b = this.t + h; }
});

Object.defineProperty(Rect.prototype, "centerX", {
    get: function() { return (this.r + this.l) / 2; }
});

Object.defineProperty(Rect.prototype, "centerY", {
    get: function() { return (this.b + this.t) / 2; }
});

// returns a hex string of a number with optional padding
function hexString(num, pad, prefix) {
    if (prefix === undefined) prefix = "0x";
    if (num < 0) num = 0xFFFFFFFF + num + 1;
    var hex = num.toString(16).toUpperCase();
    if (isNumber(pad)) {
        hex = hex.padStart(pad, "0");
    } else if (num < 0x0100) {
        hex = hex.padStart(2, "0");
    } else if (num < 0x010000) {
        hex = hex.padStart(4, "0");
    } else if (num < 0x01000000) {
        hex = hex.padStart(6, "0");
    } else {
        hex = hex.padStart(8, "0");
    }
    return (prefix + hex);
}

// returns if a value is a string
function isString(value) {
    return typeof value === 'string' || value instanceof String;
}

// returns if a value is really a number
function isNumber(value) {
    return typeof value === 'number' && isFinite(value);
}

// returns if a value is an array
function isArray(value) {
    return value && typeof value === 'object' && value.constructor === Array;
}

function bitCount (value) {
    for (var count = 0, mask = 1; value !== 0; mask <<= 1) {
        if (!(value & mask)) continue;
        count++;
        value ^= mask;
    }
    return count;
}

function compareTypedArrays(a1, a2) {

    if (a1 === a2) return true;

    if (a1.length !== a2.length) return false;

    var i = a1.length;
    while (i--) {
        if (a1[i] !== a2[i]) return false;
    }

    return true;
}

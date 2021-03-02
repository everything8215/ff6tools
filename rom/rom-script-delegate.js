//
// rom-script-delegate.js
// created 2/25/2021
//

class ROMScriptDelegate {
    constructor(rom) {
        this.rom = rom;
    }

    label(script, offset) {
        if (script.ref[offset]) return script.ref[offset].label;
        return 'Invalid';
    }

    description(command) {
        return command.name;
    }

    string(command, assemblyKey, stringTableKey) {
        return command[assemblyKey].fString();

        // const assembly = command(assemblyKey);
        // if (!assembly) return 'Invalid String';
        // stringTableKey = stringTableKey || assembly.stringTable;
        // const stringTable = this.rom.stringTable[stringTableKey];
        // if (!stringTable) return 'Invalid String';
        // const i = command[assemblyKey].value;
        // if (!isNumber(i)) return 'Invalid String';
        // const string = stringTable.string[i];
        // if (!string) return 'Invalid String';
        // return string.fString();
    }

    initScript(script) {

    }

    didDisassemble(command, data) {

    }

    willAssemble(command) {

    }

    nextEncoding(command) {
        return command.encoding;
    }
}

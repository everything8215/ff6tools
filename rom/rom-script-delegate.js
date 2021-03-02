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

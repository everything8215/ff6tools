//
// ff5script.js
// created 12/23/2018
//

var FF5Script = {
    name: "FF5Script",
    
    initScript: function(script) { },
    
    didDisassemble: function(command, data) {
        switch (command.key) {
                
            case "mapBackground":
                var w = command.w.value;
                var h = command.h.value;
                command.range.end += w * h;
                ROMData.prototype.disassemble.call(command, data);
                break;
                
            case "switch":
                if (command.encoding === "event") {
                    var opcode = command.opcode.value;
                    if (opcode === 0xA3 || opcode === 0xA5) {
                        command.onOff.value = 0;
                    } else {
                        command.onOff.value = 1;
                    }
                    if (opcode === 0xA4 || opcode === 0xA5) {
                        command.switch.value += 0x0100;
                    }
                } else if (command.encoding === "trigger") {
                    var opcode = command.opcode.value;
                    if (opcode === 0xFB || opcode === 0xFD) {
                        command.onOff.value = 0;
                    } else {
                        command.onOff.value = 1;
                    }
                    if (opcode === 0xFB || opcode === 0xFC) {
                        command.switch.value += 0x0100;
                    }
                }
                break;

            default:
                break;
        }
    },

    willAssemble: function(command) {
        switch (command.key) {
            case "switch":
                if (command.encoding === "event") {
                    command.opcode.value = 0xA2;
                    if (command.onOff.value) command.opcode.value++;
                    if (command.switch.value >= 0x100) command.opcode.value += 2;
                } else if (command.encoding === "trigger") {
                    command.opcode.value = 0xFD;
                    if (command.onOff.value) command.opcode.value++;
                    if (command.switch.value >= 0x100) command.opcode.value -= 2;
                }
                break;

            default: break;
        }
    },

    nextEncoding: function(command) {
        if (command.encoding === "trigger" && command.key === "end") return "npcDialog";

        return command.encoding;
    },

    description: function(command) {
        var desc = "Invalid Command"

        switch (command.key) {

            case "action":
            case "actionParty":
                var obj;
                if (command.object) {
                    obj = this.string(command, "object", "object");
                } else {
                    obj = "Party";
                }
                return obj + ": " + this.string(command, "action", command.stringTable);
                
            case "bool1":
            case "bool2":
                var width = (command.key === "bool1" ? 2 : 4);
                return "If " + hexString(0x0500 + command.ram.value, 4, "$") + " & " + hexString(command.mask.value, width, "#$");

            case "branchRandom":
                return "Branch Forward at Random (" + command.count.value + " Choices)";

            case "compare1":
            case "compare2":
                var width = (command.key === "compare1" ? 2 : 4);
                var compare = " == ";
                if (command.compare.value === 1) compare = " > ";
                if (command.compare.value === 2) compare = " < ";
                return "If " + hexString(0x0500 + command.ram.value, 4, "$") + compare + command.value.value;

            case "dialog":
            case "dialogYesNo":
                var d = command.dialog.value;
                var dialog = command.rom.dialog.item(d);
                var dialogText = command.name + ":<br/>";
                return dialogText + (dialog ? dialog.htmlText : "Invalid Dialog Message");
                
            case "event":
            case "jump":
                return command.name + ": " + this.string(command, "event", "eventScript");
                
            case "inn":
                return "Inn: " + this.string(command, "price", "eventScript.event.inn.price");

            case "inventoryGP":
                var gp = command.gp.value;
                var giveTake = (command.giveTake.value === 0xAF) ? "Give": "Take";
                return giveTake + " " + gp + " GP";
                
            case "inventoryItem":
                var giveTake = (command.giveTake.value === 0xAA) ? "Give": "Take";
                return giveTake + " Item: " + this.string(command, "item", "itemNames");

            case "inventoryJob":
                return "Give Job: " + this.string(command, "job", "jobName");

            case "map":
                return command.name + ": " + this.string(command, "map", "mapProperties");

            case "mapBackground":
                var x, y;
                if (command.position.value === 0xF3) {
                    x = command.xAbs.value;
                    y = command.yAbs.value;
                } else {
                    x = command.xRel.value;
                    y = command.yRel.value;
                }
                var w = command.w.value;
                var h = command.h.value;
                return command.name + ": " + w + "×" + h + " tiles at (" + x + "," + y + ")";

            case "npcDialog":
                if (command.encoding === "event") {
                    var d = command.dialog.value;
                    return "Show NPC Dialog " + d;
                }
                
                var i = command.i;
                while (command.parent.command[i].encoding === "npcDialog") {
                    i--;
                    if (!command.parent.command[i]) break;
                }
                i = command.i - i;
                
                var d = command.dialog.value;
                var dialog = command.rom.dialog.item(d);
                var dialogText = "NPC Dialog " + i + ":<br/>";
                return dialogText + (dialog ? dialog.htmlText : "Invalid Dialog Message");
                
            case "parallel":
                return "Execute the Next  " + command.bytes.value + " Byte(s) in Parallel";

            case "partyGraphic":
                return "Change Party Graphic to " + this.string(command, "graphics", command.stringTable);

            case "repeat":
                return "Repeat the Next  " + command.bytes.value + " Byte(s) " + command.count.value + " Times";

            case "shop":
                return "Shop: " + this.string(command, "shop", "shopProperties");

            case "npcSwitch":
            case "battleSwitch":
            case "switch":
                if (command.encoding === "trigger") {
                    return "If " + this.string(command, "switch", "eventSwitch") + " is " + this.string(command, "onOff", command.onOff.stringTable);
                } else if (command.encoding === "event") {
                    return this.string(command, "switch", command.switch.stringTable) + " = " + this.string(command, "onOff", command.onOff.stringTable);
                }
                
            case "wait":
                return "Wait " + this.string(command, "duration", command.duration.stringTable);

            case "waitAny":
                if (command.multiplier.value === 0xB2) {
                    return "Wait " + command.duration1.value + " Frame(s)";
                } else {
                    return "Wait " + command.duration15.value + " Frames";
                }

            default: break;
        }
        return command.name;
    },

    string: function(command, key, stringKey) {
        var stringTable;
        if (stringKey) {
            stringTable = command.rom.stringTable[stringKey];
        } else {
            stringTable = command.rom.stringTable[command[key].stringTable];
        }
        var string = stringTable.string[command[key].value];
        if (!string) return "Invalid String"
        return string.fString();
    },

    fixSwitch: function(switchProperty) {
        var map = propertyList.editors["FF5Map"];
        if (map.m > 256 && switchProperty.offset !== 256) {
            switchProperty.offset = 256;
            switchProperty.value += 256;
        } else if (map.m <= 256 && switchProperty.offset !== 0) {
            switchProperty.offset = 0;
            switchProperty.value -= 256;
        }
    }
}
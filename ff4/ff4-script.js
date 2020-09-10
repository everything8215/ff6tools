//
// ff4-script.js
// created 4/8/2018
//

var FF4Script = {};
FF4Script.name = "FF4Script";

FF4Script.initScript = function(script) {
    var offset, label, e;

    if (script.key === "npcScript") {
        script.addPlaceholder(null, 0, "npc", script.rom.stringTable.npcSwitch.string[script.i].fString());

        // look for npc dialog
        var i = script.data.length - 1;
        if (script.data[i] !== 0xFF) {
            while (script.data[i] !== 0xFF && i > 0) i--;
            script.addPlaceholder(null, i + 2, "npcDialog");
        }

    } else if (script.key === "eventScript") {
        // add references for events
        script.addPlaceholder(null, 0, "event", script.rom.stringTable.eventScript.string[script.i].fString());
    }
}

FF4Script.didDisassemble = function(command, data) {
    switch (command.key) {
        case "repeat":
            break;

        default:
            break;
    }
}

FF4Script.description = function(command) {
    var desc = "Invalid Command"

    if (command.encoding === "npcDialog") {

        var script = command.parent;
        var i = script.command.length - 1;
        while (script.command[i].encoding === "npcDialog") i--;
        i = script.command.indexOf(command) - i;
        desc = "NPC Dialog " + i + ":<br/>"

        var map = propertyList.editors["FF4Map"];
        var dialog = command.rom.mapDialog.item(map.m).item(command.dialog.value);
        if (dialog) {
            return desc + dialog.htmlText;
        } else {
            return desc + "Invalid Dialog Message";
        }
    }

    switch (command.key) {

        case "action":
            return "Action for " + this.string(command, "object") + ": " + this.string(command, "action");

        case "end":
            return "End of Script";

        case "dialog":
        case "dialogWait":
        case "dialog0D":
        case "dialog12":
            var dialog = command.rom.stringTable.dialog.string[command.dialog.value];
            if (dialog) {
                return "Display Dialog:<br/>" + dialog.htmlString();
            }

        case "eventDialog":
            var b = command.bank.value;
            var dialog;
            if (b === 0xF0) {
                dialog = command.rom.eventDialog1.item(command.dialog1.value);
            } else if (b === 0xF1) {
                dialog = command.rom.eventDialog1.item(command.dialog2.value);
            } else if (b === 0xF6) {
                dialog = command.rom.eventDialog2.item(command.dialog3.value);
            }
            if (dialog) {
                return "Display Event Dialog:<br/>" + dialog.htmlText;
            } else {
                return "Display Event Dialog:<br/>Invalid Dialog Message";
            }

        case "mapDialog":
            var map = propertyList.editors["FF4Map"];
            if (!map) {
                return "Display Map Dialog " + command.dialog.value.toString();
            }
            var m = map.m;

            var dialog = command.rom.mapDialog.item(m).item(command.dialog.value);
            if (dialog) {
                return "Display Map Dialog:<br/>" + dialog.htmlText;
            } else {
                return "Display Map Dialog:<br/>Invalid Dialog Message";
            }

        case "dialogYesNo":
            var dialog = command.rom.eventDialog1.item(command.dialog.value);
            if (dialog) {
                return "Display Dialog (Yes/No):<br/>" + dialog.htmlText;
            } else {
                return "Display Dialog (Yes/No):<br/>Invalid Dialog Message";
            }

        case "map":
            if (command.mapMSB.value) {
                return "Load Map: " + this.string(command, "map2", "mapProperties");
            } else {
                return "Load Map: " + this.string(command, "map1", "mapProperties");
            }

        case "inn":
            return "Inn: " + this.string(command, "price");

        case "shop":
            return "Shop: " + this.string(command, "shop");

        case "repeat":
            return "Repeat " + command.count.value + " Times";

        case "switch":
            this.fixSwitch(command.eventSwitch);
            this.fixSwitch(command.npcSwitch);
            var onOff = (command.onOff.value === 1) ? "Off" : "On";
            if (command.type.value === 1) {
                return "Turn Event Switch " + onOff + ": " + this.string(command, "eventSwitch", "eventSwitch");
            } else {
                return "Turn NPC Switch " + onOff + ": " + this.string(command, "npcSwitch", "npcSwitch");
            }

        case "event":
            if (command.event.value >= 39 && command.event.value <= 46) {
                // map dialog event
                var d = command.event.value - 39;
                desc = "Display Map Dialog " + d + ": <br/>";
                var map = propertyList.editors["FF4Map"];
                var dialog = command.rom.mapDialog.item(map.m).item(d);
                if (dialog) {
                    return desc + dialog.htmlText;
                } else {
                    return desc + "Invalid Dialog Message";
                }
            }
            return "Execute Event: " + this.string(command, "event", "eventScript");

        case "off":
            this.fixSwitch(command.switch);
            return "If Switch is Off: " + this.string(command, "switch", "eventSwitch");

        case "on":
            this.fixSwitch(command.switch);
            return "If Switch is On: " + this.string(command, "switch", "eventSwitch");

        default: break;
    }
    return command.name;
}

FF4Script.string = function(command, key, stringKey) {
    var stringTable;
    var property = command[key];
    if (!property) return "Invalid String";

    if (stringKey) {
        stringTable = command.rom.stringTable[stringKey];
    } else {
        stringTable = command.rom.stringTable[property.stringTable];
    }

    var value = property.value;
    var string = stringTable.string[value];
    if (!string) return "Invalid String";
    return string.fString();
}

FF4Script.fixSwitch = function(switchProperty) {
    var map = propertyList.editors["FF4Map"];
    if (map.m > 256 && switchProperty.offset !== 256) {
        switchProperty.offset = 256;
        switchProperty.value += 256;
    } else if (map.m <= 256 && switchProperty.offset !== 0) {
        switchProperty.offset = 0;
        switchProperty.value -= 256;
    }
}

var FF4MonsterScript = {
    name: "FF4MonsterScript",

    moonMonsters: [
        32, // Tricker
        53, // D.Bone
        81, // D.Fossil
        107, // Plague
        128, // Breath
        131, // Mind
        134, // PinkPuff
        138, // Kary
        140, // Ging-Ryu
        144, // EvilMask
        146, // RedGiant
        148, // FatalEye
        149, // D.Lunar
        151, // Warlock
        152, // Wyvern
        154, // Ogopogo
        155, // BlueD.
        156, // King-Ryu
        158, // PaleDim
        159, // RedD.
        160, // Behemoth
        190, // Bahamut
        199, // Zemus
        200, // Zeromus 2
        201, // Zeromus 3 (Final Form)
        216 // Zeromus 1 (Golbez & FuSoYa)
    ],

    moonScripts: [],

    initScript: function(script) {

        if (this.moonScripts.length === 0) this.initMoon(script.rom)

        var encoding = (this.moonScripts.includes(script.i)) ? "monsterMoon" : "monster";
        script.encoding = encoding;
        script.addPlaceholder(null, 0, encoding, script.rom.stringTable.monsterScript.string[script.i].fString());
    },

    initMoon: function(rom) {
        // initialize action and condition scripts
        rom.monsterAction;
        rom.monsterActionMoon;
        rom.monsterConditionScript;

        // identify moon scripts
        for (var m = 0; m < this.moonMonsters.length; m++) {
            var monster = rom.monsterProperties.item(this.moonMonsters[m]);
            if (monster.script.value !== 0) {
                this.moonScripts.push(monster.script.value);
            }
            if (monster.counter.value !== 0) {
                this.moonScripts.push(monster.counter.value);
            }
        }
    },

    description: function(command) {
        if (command.key !== "action") return command.name;
        var c = command.condition.value;
        var a = command.action.value;
        var condition = command.rom.stringTable["monsterConditionScript"].string[c].fString();
        var actionKey = (command.encoding === "monsterMoon") ? "monsterActionMoon" : "monsterAction";
        var action = command.rom.stringTable[actionKey].string[a].fString();
        return condition + ":<br/>" + action;
    }
};

var FF4MonsterActionScript = {
    name: "FF4MonsterActionScript",

    initScript: function(script) {
        var string = script.rom.stringTable[script.key].string[script.i];
        if (!string) return;
        script.addPlaceholder(null, 0, "monsterAction", string.fString());
    },

    description: function(command) {
        switch (command.key) {

            case "attack":
                var a = command.attack.value;
                return "Attack: " + command.rom.stringTable["attackNames"].string[a].fString();

            case "chain":
                var chain = command.chain.value;
                if (chain === 0xFB) return "Continue Attack Chain";
                if (chain === 0xFC) return "End Attack Chain";
                if (chain === 0xFD) return "Start Attack Chain";
                break;

            case "command":
                var c = command.command.value;
                return "Command: " + command.rom.stringTable["battleCommandNames"].string[c].fString();

            case "dialog":
                var d = command.dialog.value;
                var dialog = command.rom.battleDialog.item(d);
                if (dialog) {
                    return "Display Dialog:<br/>" + dialog.htmlText;
                } else {
                    return "Display Dialog:<br/>Invalid Dialog Message";
                }

            case "graphics":
                return "Change Graphics: " + command.graphics.value;

            case "target":
                var t = command.target.value;
                return "Change Target: " + command.rom.stringTable["scriptEncoding.monsterAction.target.target"].string[t].fString();

            case "variable":
                var v = command.variable.value;
                var o = command.operation.value;
                var value = command.value.value;
                var variableName;
                if (v === 0xF4) variableName = "Variable 1";
                if (v === 0xF5) variableName = "Variable 2";
                if (v === 0xF6) variableName = "Variable 3";
                if (v === 0xF7) variableName = "Variable 4";
                if (o === 0) return variableName + " += " + value;
                if (o === 1) return variableName + " -= " + value;
                if (o === 2) return variableName + " = " + value;
                break;

            default: break;
        }
        return command.name;
    }
};

var FF4MonsterConditionScript = {
    name: "FF4MonsterConditionScript",

    initScript: function(script) {
        var name = "";
        for (var i = 0; i < script.data.length; i++) {
            var c = script.data[i];
            if (c === 0xFF) break;
            if (name !== "") name += " && ";
            name += script.rom.stringTable.monsterCondition.string[c].fString();
        }
        if (name === "") name = "Always";
        var string = script.rom.stringTable.monsterConditionScript.string[script.i];
        if (!string) return;
        string.value = (name === "Always") ? name : "If " + name;
        script.addPlaceholder(null, 0, "monsterCondition", name);
    },

    description: function(command) {
        if (command.key !== "condition") return command.name;
        var c = command.condition.value;
        var name = command.rom.stringTable["monsterCondition"].string[c].fString();
        return (name === "Always") ? name : "If " + name;
    }
};

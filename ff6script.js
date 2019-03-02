//
// ff6script.js
// created 3/21/2018
//

var FF6Script = {};
FF6Script.name = "FF6Script";

FF6Script.description = function(command) {
    var desc = "Invalid Command";
    var offset, label;
    switch (command.key) {
        case "objectScript":
            return "Object Script for " + FF6Script.string(command, "object", "eventObjects");
        case "objectWait":
            return "Wait for " + FF6Script.string(command, "object", "eventObjects");
        case "objectPassability":
            if (command.opcode.value === 0x36) {
                return "Disable Passability for " + FF6Script.string(command, "object", "eventObjects");
            } else if (command.opcode.value === 0x78) {
                return "Enable Passability for " + FF6Script.string(command, "object", "eventObjects");
            }
            break;
        case "dialog":
            var d = command.dialog.value;
//            var dialog = command.rom.dialog.item(d);
            var dialog = command.rom.stringTable.dialog.string[d];
            if (dialog) {
                return "Display Dialog:<br/>" + dialog.htmlString();
            } else {
                return "Display Dialog:<br/>Invalid Dialog Message";
            }
        case "default":
            desc = "Command " + hexString(command.opcode.value, 2);
            break;
        case "jumpBattleSwitch":
        case "jumpCharacter":
        case "jumpSub":
        case "jumpSubRepeat":
        case "jumpRandom":
            desc = command.name;
            offset = command.scriptPointer.value;
            if (command) desc += ": " + FF6Script.label(command.parent, offset);
            break;
        case "jumpDialog":
            desc = command.name;
            var choices = (command.data.length - 1) / 3;
            for (var c = 1; c <= choices; c++) {
                offset = command["scriptPointer" + c].value;
                label = FF6Script.label(command.parent, offset);
                desc += "<br/>" + c + ": ";
                desc += label;
            }
            break;
        case "jumpSwitch":
            offset = command.scriptPointer.value;
            label = FF6Script.label(command.parent, offset);
            var count = command.count.value;
            var anyAll = command.anyAll.value ? "all" : "any";
            
            desc = "Jump to " + label + " if " + anyAll + " of these are true:"
            for (var s = 1; s <= count; s++) {
                var eventSwitch = this.string(command, "switch" + s, "eventSwitches");
                var state = command["state" + s].value ? "On" : "Off";
                desc += "<br/>" + s + ". " + eventSwitch + " == " + state;
            }
            break;
            
        case "switch":
            desc = this.string(command, "switch", "eventSwitches");
            desc += " = " + (command.onOff.value ? "Off" : "On");
            break;
            
        default:
            desc = command.name;
            break;
    }
    return desc;
}

FF6Script.string = function(command, key, stringKey) {
    var stringTable = command.rom.stringTable[stringKey];
    if (!stringTable) return "Invalid String";
    var i = command[key].value;
    if (!isNumber(i)) return "Invalid String";
    var string = stringTable.string[i];
    if (!string) return "Invalid String";
    return string.fString();
}

FF6Script.label = function(script, offset) {
    if (script.ref[offset]) return script.ref[offset].label;
    return "Invalid Command";
}

FF6Script.initScript = function(script) {
    
    if (script.key !== "eventScript") return;

    // add references for each map's events
    var triggers, m, t, offset, label;
    
    // event triggers
    for (m = 0; m < script.rom.eventTriggers.array.length; m++) {
        triggers = script.rom.eventTriggers.item(m);
        for (t = 0; t < triggers.array.length; t++) {
            offset = triggers.item(t).scriptPointer.value;
            script.addPlaceholder(triggers.item(t).scriptPointer, offset, (m < 3) ? "world" : "event");
        }
    }
    
    // npcs
    for (m = 3; m < script.rom.npcProperties.array.length; m++) {
        triggers = script.rom.npcProperties.item(m);
        for (t = 0; t < triggers.array.length; t++) {
            var npc = triggers.item(t);
            if (npc.vehicle.value === 0 && npc.special.value) continue;
            offset = triggers.item(t).scriptPointer.value;
            script.addPlaceholder(triggers.item(t).scriptPointer, offset, "event");
        }
    }
    
    // startup event
    for (m = 3; m < script.rom.mapProperties.array.length; m++) {
        offset = script.rom.mapProperties.item(m).scriptPointer.value;
        label = script.rom.stringTable.mapProperties.string[m].fString();
        script.addPlaceholder(script.rom.mapProperties.item(m).scriptPointer, offset, "event", label);
    }
    
    // add references for vehicle events
    for (var e = 0; e < script.rom.vehicleEvents.array.length; e++) {
        offset = script.rom.vehicleEvents.item(e).scriptPointer.value;
        label = script.rom.stringTable.vehicleEvents.string[e].fString();
        script.addPlaceholder(script.rom.vehicleEvents.item(e).scriptPointer, offset, "vehicle", label);
    }

    // add references for ff6 advance events
    
}

FF6Script.didDisassemble = function(command, data) {
    
    var offset;
    
    switch (command.key) {
            
        case "objectEvent":
        case "startTimer":
        case "jumpSub":
        case "jumpSubRepeat":
        case "jumpBattleSwitch":
        case "jumpRandom":
        case "jumpKeypress":
        case "jumpDirection":
            offset = command.scriptPointer.value;
            command.parent.addPlaceholder(command.scriptPointer, offset, command.encoding);
            break;

        case "jumpEvent":
            offset = command.scriptPointer.value;
            command.parent.addPlaceholder(command.scriptPointer, offset, "event");
            break;

        case "jumpCharacter":
            var count = command.count.value;
            command.range.end += count * 3;
            ROMData.prototype.disassemble.call(command, data);
            offset = command.scriptPointer.value;
            command.parent.addPlaceholder(command.scriptPointer, offset, command.encoding);
            break;

        case "jumpDialog":
            // default to 2 choices
            var choices = 2;
            
            // find the previous dialog command
            var c = command.parent.command.length - 1;
            while (true) {
                var previous = command.parent.command[c--];
                if (!previous) break;
                if (previous.key !== "dialog") continue;
                
                // get the previous dialog text
                var d = previous.dialog.value;
                var dialog;
//                var dialog = command.rom.stringTable.dialog.string[d];
//                if (!dialog) continue;
                if (command.rom.dialog) {
                    dialog = command.rom.dialog.item(d);
                    if (!dialog || !dialog.text) continue;
                } else if (command.rom.stringTable.dialog) {
                    var dialogString = command.rom.stringTable.dialog.string[d];
                    var language = dialogString.language;
                    if (!language) break;
                    var firstLanguage = Object.keys(language)[0];
                    var link = language[firstLanguage].link;
                    dialog = command.parsePath(link.replace(/%i/g, d.toString()));
                } else {
                    break;
                }

                // count the number of dialog choices
                var matches = dialog.text.match(/\\choice/g);

                // keep looking if there were no dialog choices
                if (!matches) continue;
                choices = matches.length;
                break;
            }
            command.range.end += choices * 3;
            command.count.value = choices;
            
            ROMData.prototype.disassemble.call(command, data);
            for (c = 1; c <= choices; c++) {
                offset = command["scriptPointer" + c].value;
                command.parent.addPlaceholder(command["scriptPointer" + c], offset, "event");
            }
            break;

        case "jumpSwitch":
            var count = command.count.value;
            var length = count * 2 + 4;
            
            // update the command's range
            command.range.end = command.range.begin + length;
            command.assembly.scriptPointer.range = new ROMRange(length - 3, length);
            ROMData.prototype.disassemble.call(command, data);
            
            // add a placeholder at the jump offset
            offset = command.scriptPointer.value;
            command.parent.addPlaceholder(command.scriptPointer, offset, command.encoding);
            break;
            
        case "objectScript":
            // add a placeholder at the end of the object script
            offset = command.range.end + command.scriptLength.value;
            command.parent.addPlaceholder(null, offset, "event");
            break;
            
        case "mapBackground":
            var w = command.w.value;
            var h = command.h.value;
            command.range.end += w * h;
            ROMData.prototype.disassemble.call(command, data);
            break;

        case "switch":
            if (command.encoding === "event") {
                command.switch.value += command.bank.value << 8;
            } else if (command.encoding === "object") {
                var opcode = command.opcode.value;
                if (opcode < 0xE4) {
                    command.onOff.value = 0;
                    opcode -= 0xE1;
                } else {
                    command.onOff.value = 1;
                    opcode -= 0xE4;
                }
                command.switch.value += (opcode << 8);
            }
            break;
            
        default:
            break;
    }
}

FF6Script.willAssemble = function(command) {
    switch (command.key) {
        case "objectScript":
            // find the end of the object script
            var script = command.parent;
            var i = script.command.indexOf(command);
            while (++i < script.command.length) {
                var nextCommand = script.command[i];
                if (nextCommand.encoding !== "object") break;
            }
            var length = nextCommand.range.begin - command.range.end;
            if (length === command.scriptLength.value) break;
            command.scriptLength.value = length;
            command.scriptLength.markAsDirty();
            break;
            
        case "switch":
            if (command.encoding !== "event") break;
            command.bank.value = command.switch.value >> 8;
            break;

        case "jumpSwitch":
            var count = command.count.value;
            var length = count * 2 + 4;
            command.range.end = command.range.begin + length;
            command.assembly.scriptPointer.range = new ROMRange(length - 3, length);
            break;

        default:
            break;
    }
}

FF6Script.nextEncoding = function(command) {
    switch (command.key) {
        case "objectScript":
            return "object";
            
        case "map":
            if (command.map.value >= 3 && command.map.value !== 511) return "event";
            if (command.vehicle.value) return "vehicle";
            return "world";
            
        case "end":
            return "event";

        default:
            return command.encoding;
    }
}

var FF6MonsterScript = {
    name: "FF6MonsterScript",
    
    initScript: function(script) {
        // add references for monsters
        for (var e = 0; e < script.rom.monsterScriptPointers.array.length; e++) {
            var offset = script.rom.monsterScriptPointers.item(e).value;
            var label = script.rom.stringTable.monsterName.string[e].fString();
            if (!label || label.length === 0) continue;
            script.addPlaceholder(script.rom.monsterScriptPointers.item(e), offset, "monster", label);
        }
    },
    
    string: function(command, key, stringKey) {
        var string = command.rom.stringTable[stringKey].string[command[key].value];
        if (!string) return null;
        return string.fString();
    },
    
    attackString: function(command, key) {
        var a = command[key].value;
        if (a === 0xFE) return "Do Nothing";
        return this.string(command, key, "attackName");
    },
    
    commandString: function(command, key) {
        var a = command[key].value;
        if (a === 0xFE) return "Do Nothing";
        return this.string(command, key, "battleCommandName");
    },
    
    elementString: function(command, key) {
        var e = command[key].value;
        if (e === 0) return "No Element";
        var element = "";
        var count = bitCount(e);
        for (var i = 0; i < 8; i++) {
            var mask = 1 << i;
            if (!(e & mask)) continue;
            e ^= mask; // flip the bit
            if (element !== "") {
                // this is not the first element
                if (count === 2) element += " or ";
                else element += (e ? ", " : ", or ");
            }
            element += command.rom.stringTable.element.string[i].fString();
        }
        return element;
    },

    slotString: function(command, prep) {
        var s = command.monsters.value;
        if (s === 0) return "This Monster";
        if (s === 0xFF) return "All Monsters";
        s &= 0x3F;
        var slot = "";
        var count = bitCount(s);
        for (var i = 0; i < 6; i++) {
            var mask = 1 << i;
            if (!(s & mask)) continue;
            s ^= mask; // flip the bit
            if (slot !== "") {
                // this is not the first element
                if (count === 2) slot += (" " + prep + " ");
                else slot += (s ? ", " : (", " + prep + " "));
            } else {
                slot = "Monster Slot ";
            }
            slot += (i + 1).toString();
        }
        return slot;
    },

    conditionalString: function(command) {
        var target = this.string(command, "target", "battleTargets");
        switch (command.condition.value) {
                
            case 1: // command
                var command1 = this.commandString(command, "command1");
                var command2 = this.commandString(command, "command2");
                if (command.command1.value === command.command2.value) return "If " + command1 + " Was Used Against This Monster";
                return "If " + command1 + " or " + command2 + " Was Used Against This Monster";

            case 2: // attack
                var attack1 = this.attackString(command, "attack1");
                var attack2 = this.attackString(command, "attack2");
                if (command.attack1.value === command.attack2.value) return "If " + attack1 + " Was Used Against This Monster";
                return "If " + attack1 + " or " + attack2 + " Was Used Against This Monster";

            case 3: // item
                var item1 = this.string(command, "item1", "itemNames");
                var item2 = this.string(command, "item2", "itemNames");
                if (command.item1.value === command.item2.value) return "If " + item1 + " Was Used On This Monster";
                return "If " + item1 + " or " + item2 + " Was Used On This Monster";

            case 4: // element
                return "If " + this.elementString(command, "element") + " Was Used Against this Monster";

            case 5: // any action
                return "If Any Action Was Used Against This Monster";
                
            case 6: // hp
                return "If " + target + "'s HP < " + command.hp.value.toString();

            case 7: // mp
                return "If " + target + "'s MP < " + command.mp.value.toString();

            case 8: // has status
                return "If " + target + " Has " + this.string(command, "status", "statusNamesReversed") + " Status";

            case 9: // does not have status
                return "If " + target + " Does Not Have " + this.string(command, "status", "statusNamesReversed") + " Status";

            case 11: // monster timer
                return "If Monster Timer > " + command.timer.value.toString();

            case 12: // variable less than
                return "If " + this.string(command, "variable", "battleVariable") + " < " + command.value.value.toString();

            case 13: // variable greater than
                return "If " + this.string(command, "variable", "battleVariable") + " ≥ " + command.value.value.toString();

            case 14: // level less than
                return "If " + target + "'s Level < " + command.level.value.toString();

            case 15: // level greater than
                return "If " + target + "'s Level ≥ " + command.level.value.toString();

            case 16: // only one type of monster
                return "If There is Only One Type of Monster Remaining";

            case 17: // monsters alive
            case 18: // monsters dead
                return "If " + this.slotString(command, "and") + ((bitCount(command.monsters.value) < 2) ? " is " : " are ") + (command.condition.value === 17 ? "Alive" : "Dead");

            case 19: // characters/monsters alive
                if (command.countType.value) {
                    return "If There Are " + command.count.value.toString() + " or Fewer Monsters Remaining";
                }
                return "If There Are " + command.count.value.toString() + " or More Characters Remaining";

            case 20: // switch on
                return "If " + this.string(command, "switch", "battleSwitch") + " == On";

            case 21: // switch off
                return "If " + this.string(command, "switch", "battleSwitch") + " == Off";
                
            case 22: // battle timer
                return "If Battle Timer > " + command.timer.value.toString();

            case 23: // target valid
                return "If " + target + " is a Valid Target";

            case 24: // gau present
                return "If " + command.rom.stringTable.characterNames.string[11].fString() + " is Present";

            case 25: // monster slot
                return "If This Monster is " + this.slotString(command, "or");

            case 26: // weak vs. element
                return "If " + target + " is Weak vs. " + this.elementString(command, "element2");

            case 27: // battle index
                return "If Current Battle is " + this.string(command, "battle", "battleProperties");

            default: return this.string(command, "condition", command.condition.stringTable);
        }
    },
    
    description: function(command) {
        switch (command.key) {
            case "attack":
                var a1 = command.attack1.value;
                var a2 = command.attack2.value;
                var a3 = command.attack3.value;
                if (a1 === a2 && a1 === a3) return "Attack: " + this.attackString(command, "attack1");
                return "Attack: " + this.attackString(command, "attack1") + ", " + this.attackString(command, "attack2") + ", or " + this.attackString(command, "attack3");

            case "attackSingle":
                return "Attack: " + this.attackString(command, "attack");

            case "changeBattle":
                return "Change Battle: " + this.string(command, "battle", "battleProperties");

            case "command":
                var c1 = command.command1.value;
                var c2 = command.command2.value;
                var c3 = command.command3.value;
                if (c1 === c2 && c1 === c3) return "Command: " + this.commandString(command, "command1");
                return "Command: " + this.commandString(command, "command1") + ", " + this.commandString(command, "command2") + ", or " + this.commandString(command, "command3");

            case "conditional":
                return "Conditional: " + this.conditionalString(command);

            case "dialog":
                var d = command.dialog.value;
                var dialog = command.rom.stringTable.monsterDialog.string[d];
                if (dialog) {
                    return "Display Monster Dialog:<br/>" + dialog.htmlString();
                } else {
                    return "Display Monster Dialog:<br/>Invalid Dialog Message";
                }

            case "item":
                var i1 = command.item1.value;
                var i2 = command.item2.value;
                var useThrow = command.useThrow.value ? "Throw Item: " : "Use Item: ";
                if (i1 === i2) return useThrow + this.string(command, "item1", "itemNames");
                return useThrow + this.string(command, "item1", "itemNames") + " or " + this.string(command, "item2", "itemNames");

            case "misc":
                var desc = this.string(command, "effect", command.effect.stringTable);
                if (!command.target.invalid) {
                    desc += ": " + this.string(command, "target", "battleTargets");
                } else if (!command.status.invalid) {
                    desc += ": " + this.string(command, "status", "statusNamesReversed");
                }
                return desc;

            case "showHide":
            case "animation":
                return command.name + ": " + this.slotString(command, "and");

            case "switch":
                if (command.operation.value === 0) {
                    return "Toggle " + this.string(command, "switch", "battleSwitch");
                } else if (command.operation.value === 1) {
                    return this.string(command, "switch", "battleSwitch") + " = On";
                } else if (command.operation.value === 2) {
                    return this.string(command, "switch", "battleSwitch") + " = Off";
                }
                return "Invalid Switch Operation";

            case "target":
                return "Change Target: " + this.string(command, "target", "battleTargets");

            case "variable":
                if (command.operation.value === 0) {
                    return this.string(command, "variable", "battleVariable") + " = " + command.value.value.toString();
                } else if (command.operation.value === 2) {
                    return this.string(command, "variable", "battleVariable") + " += " + command.value.value.toString();
                } else if (command.operation.value === 3) {
                    return this.string(command, "variable", "battleVariable") + " -= " + command.value.value.toString();
                }
                return "Invalid Switch Operation";

            default: break;
        }
        return command.name;
    }
};

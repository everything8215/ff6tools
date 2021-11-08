//
// ff6-script.js
// created 3/21/2018
//

class FF6Script extends ROMScriptDelegate {
    constructor(rom) {
        super(rom);
        this.name = 'FF6Script';
    }

    initScript(script) {

        if (script.key !== 'eventScript') return;

        // add references for each map's events
        var triggers, m, t, offset, label;

        // event triggers
        for (const triggerArray of this.rom.eventTriggers.iterator()) {
            const encoding = (triggerArray.i < 3) ? 'world' : 'event'
            for (const trigger of triggerArray.iterator()) {
                const scriptPointer = trigger.scriptPointer;
                script.addPlaceholder(trigger.scriptPointer, scriptPointer.value, encoding);
            }
        }

        // npcs
        for (const triggerArray of this.rom.npcProperties.iterator()) {
            if (triggerArray.i < 3) continue;
            for (const trigger of triggerArray.iterator()) {
                if (trigger.scriptPointer.invalid) continue;
                const scriptPointer = trigger.scriptPointer;
                script.addPlaceholder(trigger.scriptPointer, scriptPointer.value, 'event');
            }
        }

        // startup event
        for (const map of this.rom.mapProperties.iterator()) {
            if (map.i < 3) continue;
            const scriptPointer = map.scriptPointer;
            label = this.rom.stringTable.mapProperties.string[map.i].fString();
            script.addPlaceholder(scriptPointer, scriptPointer.value, 'event', label);
        }

        // add references for vehicle events
        for (const event of this.rom.vehicleEvents.iterator()) {
            const scriptPointer = event.scriptPointer;
            label = this.rom.stringTable.vehicleEvents.string[event.i].fString();
            script.addPlaceholder(scriptPointer, scriptPointer.value, 'vehicle', label);
        }

        // todo: add references for ff6 advance events

    }

    didDisassemble(command, data) {

        var offset;

        switch (`${command.encoding}.${command.key}`) {

            case 'event.objectEvent':
            case 'event.timerStart':
            case 'event.jumpSub':
            case 'event.jumpSubRepeat':
            case 'event.jumpBattleSwitch':
            case 'event.jumpRandom':
            case 'world.jumpKeypress':
            case 'world.jumpDirection':
                offset = command.scriptPointer.value;
                command.parent.addPlaceholder(command.scriptPointer, offset, command.encoding);
                break;

            case 'object.jumpEvent':
                offset = command.scriptPointer.value;
                command.parent.addPlaceholder(command.scriptPointer, offset, 'event');
                break;

            case 'event.jumpCharacter':
                var count = command.count.value;
                if (count === 0) {
                    this.rom.log(`Invalid Count Parameter for Command at ${command.defaultLabel}`);
                    count = 1;
                }
                command.range.end = command.range.begin + 2 + count * 3;
                command.pointerArray.arrayLength = count;
                command.pointerArray.range.end = command.range.length;
                ROMData.prototype.disassemble.call(command, data);
                command.pointerArray.disassemble(command.data);
                for (c = 0; c < count; c++) {
                    var pointer = command.pointerArray.item(c).scriptPointer;
                    offset = pointer.value;
                    command.parent.addPlaceholder(pointer, offset, command.encoding);
                }
                break;

            case 'event.jumpDialog':
                // default to 2 choices
                var choices = 2;

                // find the previous dialog command
                var c = command.parent.command.length - 1;
                while (true) {
                    var previous = command.parent.command[c--];
                    if (!previous) break;
                    if (previous.key !== 'dialog') continue;

                    // get the previous dialog text
                    var d = previous.dialog.value;
                    var dialog;
                    if (this.rom.dialog) {
                        dialog = this.rom.dialog.item(d);
                        if (!dialog || !dialog.text) continue;
                    } else if (this.rom.stringTable.dialog) {
                        var dialogString = this.rom.stringTable.dialog.string[d];
                        var language = dialogString.language;
                        if (language) {
                            var firstLanguage = Object.keys(language)[0];
                            var link = language[firstLanguage].link;
                        } else {
                            var link = dialogString.link;
                        }
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
                command.range.end = command.range.begin + 1 + choices * 3;
                command.pointerArray.arrayLength = choices;
                command.pointerArray.range.end = command.range.length;

                ROMData.prototype.disassemble.call(command, data);
                command.pointerArray.disassemble(command.data);
                for (c = 0; c < choices; c++) {
                    var pointer = command.pointerArray.item(c).scriptPointer;
                    offset = pointer.value;
                    command.parent.addPlaceholder(pointer, offset, 'event');
                }
                break;

            case 'event.jumpSwitch':
            case 'vehicle.jumpSwitch':
            case 'world.jumpSwitch':
                var count = command.count.value;
                if (count === 0) {
                    this.rom.log(`Invalid Count Parameter for Command at ${command.defaultLabel}`);
                    count = 1;
                }
                var length = count * 2 + 4;

                // update the command's range
                command.range.end = command.range.begin + length;
                command.assembly.scriptPointer.range = new ROMRange(length - 3, length);
                command.switchArray.arrayLength = count;
                command.switchArray.range.end = command.switchArray.range.begin + count * 2;
                ROMData.prototype.disassemble.call(command, data);
                command.switchArray.disassemble(command.data);
                command.scriptPointer.disassemble(command.data);

                // add a placeholder at the jump offset
                offset = command.scriptPointer.value;
                command.parent.addPlaceholder(command.scriptPointer, offset, command.encoding);
                break;

            case 'event.objectScript':
                // add a placeholder at the end of the object script
                offset = command.range.end + command.scriptLength.value;
                command.parent.addPlaceholder(null, offset, 'event');
                break;

            case 'event.mapBackground':
                var w = command.w.value;
                var h = command.h.value;
                command.range.end += w * h;
                ROMData.prototype.disassemble.call(command, data);
                break;

            case 'event.switch':
                var encoding = this.rom.scriptEncoding[command.encoding];
                var bank = command.bank.value - encoding.opcode[command.key];
                if (bank & 1) {
                    command.onOff.value = 1;
                } else {
                    command.onOff.value = 0;
                }
                bank >>= 1;
                command.switch.value += bank << 8;
                break;

            case 'object.switch':
                var encoding = this.rom.scriptEncoding[command.encoding];
                var bank = command.bank.value - encoding.opcode[command.key];
                if (bank < 3) {
                    command.onOff.value = 0;
                } else {
                    command.onOff.value = 1;
                    bank -= 3;
                }
                command.switch.value += bank << 8;
                break;

            default:
                break;
        }
    }

    willAssemble(command) {
        switch (`${command.encoding}.${command.key}`) {

            case 'event.objectScript':
                // find the end of the object script
                var script = command.parent;
                var i = script.command.indexOf(command);
                while (++i < script.command.length) {
                    var nextCommand = script.command[i];
                    if (nextCommand.encoding === 'event') break;
                }
                var length = nextCommand.range.begin - command.range.end;
                if (length === command.scriptLength.value) break;
                command.scriptLength.value = length;
                command.scriptLength.markAsDirty();
                break;

            case 'object.switch':
                var encoding = this.rom.scriptEncoding[command.encoding];
                command.bank.value = encoding.opcode[command.key];
                if (command.switch.value >= 0x0100) command.bank.value++;
                if (command.switch.value >= 0x0200) command.bank.value++;
                if (command.onOff.value) command.bank.value += 3;
                command.bank.markAsDirty();
                command.onOff.isDirty = false;
                break;

            case 'event.switch':
                var encoding = this.rom.scriptEncoding[command.encoding];
                command.bank.value = encoding.opcode[command.key];
                if (command.switch.value >= 0x0100) command.bank.value += 2;
                if (command.switch.value >= 0x0200) command.bank.value += 2;
                if (command.switch.value >= 0x0300) command.bank.value += 2;
                if (command.switch.value >= 0x0400) command.bank.value += 2;
                if (command.switch.value >= 0x0500) command.bank.value += 2;
                if (command.switch.value >= 0x0600) command.bank.value += 2;
                if (command.onOff.value) command.bank.value++;
                command.bank.markAsDirty();
                command.onOff.isDirty = false;
                break;

            case 'event.jumpCharacter':
                var count = command.pointerArray.arrayLength;
                var length = 2 + count * 3;
                var newData = new Uint8Array(length);
                newData.set(command.data);
                command.lazyData = null;
                command.data = newData;
                command.range.end = command.range.begin + length;
                command.assembly.pointerArray.range.end = length;
                break;

            case 'event.jumpDialog':
                var count = command.pointerArray.arrayLength;
                var length = 1 + count * 3;
                var newData = new Uint8Array(length);
                newData.set(command.data);
                command.lazyData = null;
                command.data = newData;
                command.range.end = command.range.begin + length;
                command.assembly.pointerArray.range.end = length;
                break;

            case 'event.jumpSwitch':
            case 'vehicle.jumpSwitch':
            case 'world.jumpSwitch':
                var count = command.switchArray.arrayLength;
                if (command.count.value !== count) {
                    command.count.value = count;
                    command.count.markAsDirty();
                }
                var length = count * 2 + 4;
                var newData = new Uint8Array(length);
                newData.set(command.data);
                command.lazyData = null;
                command.data = newData;
                command.range.end = command.range.begin + length;
                command.assembly.switchArray.range.end = length - 3;
                command.assembly.scriptPointer.range = new ROMRange(length - 3, length);
                break;

            default:
                break;
        }
    }

    nextEncoding(command) {
        switch (`${command.encoding}.${command.key}`) {
            case 'event.objectScript':
                return 'object';

            case 'event.map':
            case 'vehicle.map':
            case 'world.map':
                if (command.map.value >= 3 && command.map.value !== 511) {
                    return 'event';
                } else if (command.vehicle.value) {
                    return 'vehicle';
                } else {
                    return 'world';
                }

            // case 'event.end':
            // case 'object.end': // there are some gba object scripts with a double FF that this messes up
            case 'vehicle.end':
            case 'world.end':
                return 'event';

            default:
                break;
        }
        return super.nextEncoding(command);
    }

    description(command) {
        let desc = '';
        var offset;
        switch (`${command.encoding}.${command.key}`) {
            case 'object.action':
            case 'world.action':
                return `${command.name}: <b>${command.action.fString()}</b>`;

            case 'event.advanceBattle':
                return `${command.name}: <b>${command.battle.fString()}</b>`;

            case 'event.advanceLayerPriority':
                return `${command.name} to <b>${command.priority.value}</b>`;

            case 'event.advanceItem':
                return `${command.name}: <b>${command.item.fString()}</b>`;

            case 'event.advanceSwitch':
                return `${command.name}: <b>${command.switch.fString()}</b> = On`;

            case 'vehicle.airshipPosition':
                return `${command.name} to (<b>${command.x.value}</b>,` +
                       `<b>${command.y.value}</b>)`;

            case 'vehicle.altitude':
                return `${command.name} to <b>${command.altitude.value}</b>`;

            case 'object.animation':
                return `<b>${command.animation.fString()}</b> Animation`;

            case 'vehicle.arrows':
                return `<b>${command.arrows.fString()}</b>`;

            case 'event.battle':
            case 'vehicle.battle':
                return `${command.name}: <b>${command.battle.fString()}</b>`;

            case 'object.branch':
                return `${command.name} <b>${command.branch.fString()}</b> ` +
                       `<b>${command.offset.value}</b> Bytes`;

            case 'event.characterEquip':
                return `<b>${command.equipment.fString()}</b> Equipment for ` +
                       `<b>${command.character.fString()}</b>`;

            case 'event.characterHP':
                return `Change <b>${command.hpmp.fString()}</b> for ` +
                       `<b>${command.character.fString()}</b>: ` +
                       `<b>${command.amount.fString()}</b>`;

            case 'event.characterName':
                return `Change <b>${command.character.fString()}</b>'s Name to ` +
                       `<b>${command.characterName.fString()}</b>`;

            case 'event.characterParty':
                if (command.party.value === 0) {
                    return `Remove <b>${command.character.fString()}</b> from Party`;
                } else {
                    return `Add <b>${command.character.fString()}</b> to Party ` +
                           `<b>${command.party.value}</b>`;
                }

            case 'event.characterPortrait':
                return `Show Portrait for <b>${command.character.fString()}</b>`;

            case 'event.characterProperties':
                return `Change <b>${command.character.fString()}</b>'s ` +
                       `Properties to <b>${command.properties.fString()}</b>`;

            case 'event.characterRestore':
                return `Restore <b>${command.character.fString()}</b> to Full HP/MP`;

            case 'event.characterStatus':
                return `<b>${command.effect.fString()}</b> Status for ` +
                       `<b>${command.character.fString()}</b>: ` +
                       `<b>${command.status.fString()}</b>`;

            case 'event.cinematic':
            case 'vehicle.cinematic':
                return `${command.name}: <b>${command.cinematic.fString()}</b>`;

            case 'event.cinematicEnding':
                return `${command.name}: <b>${command.scene.fString()}</b>`;

            case 'event.dialog':
                var d = command.dialog.value;
                var dialog = this.rom.stringTable.dialog.string[d];
                if (dialog) {
                    desc = dialog.htmlString();
                } else {
                    desc = 'Invalid Dialogue Message';
                }
                return `Display Dialogue:<br/><b>${desc}</b>`;

            case 'object.direction':
            case 'world.direction':
                return `${command.name}: <b>Face ${command.direction.fString()}</b>`;

            case 'vehicle.direction':
                return `Change <b>${command.directionType.fString()}</b> to <b>${command.direction.value}</b>`;

            case 'world.figaro':
                return `Show Animation: <b>${command.animation.fString()}</b>`;

            case 'vehicle.graphic':
                return `${command.name} to <b>${command.graphic.fString()}</b>`;

            case 'event.inventoryEsper':
                return `<b>${command.giveTake.fString()}</b> Esper: ` +
                       `<b>${command.esper.fString()}</b>`;

            case 'event.inventoryGP':
                return `<b>${command.giveTake.fString()}</b> ` +
                       `<b>${command.gp.value}</b> GP`;

            case 'event.inventoryItem':
                return `<b>${command.giveTake.fString()}</b> Item: ` +
                       `<b>${command.item.fString()}</b>`;

            case 'object.jump':
                return `${command.name} (<b>${command.jump.fString()}</b>)`;

            case 'event.jumpBattleSwitch':
                offset = command.scriptPointer.value;
                return `Jump to <b>${this.label(command.parent, offset)}</b> ` +
                       `if <b>${command.switch.fString()}</b> == Off`;

            case 'event.jumpCharacter':
                desc = `${command.name}:`;
                for (const pointer of command.pointerArray.iterator()) {
                    offset = pointer.scriptPointer.value;
                    desc += `<br/>${pointer.character.value}: ` +
                            `${pointer.character.fString()}: ` +
                            `<b>${this.label(command.parent, offset)}</b>`;
                }
                return desc;

            case 'event.jumpDialog':
                desc = `${command.name}:`;
                for (const choiceAssembly of command.pointerArray.iterator()) {
                    offset = choiceAssembly.scriptPointer.value;
                    desc += `<br/>${choiceAssembly.i}: ` +
                            `<b>${this.label(command.parent, offset)}</b>`;
                }
                return desc;

            case 'world.jumpDirection':
                offset = command.scriptPointer.value;
                return `Jump to <b>${this.label(command.parent, offset)}</b> ` +
                       `if Facing <b>${command.direction.fString()}</b>`;

            case 'object.jumpEvent':
                offset = command.scriptPointer.value;
                return `${command.name}: <b>${this.label(command.parent, offset)}</b>`;

            case 'world.jumpKeypress':
                offset = command.scriptPointer.value;
                return `Jump to <b>${this.label(command.parent, offset)}</b> ` +
                       `if A Button is Pressed`;

            case 'event.jumpSub':
                offset = command.scriptPointer.value;
                return `${command.name}: <b>${this.label(command.parent, offset)}</b>`;

            case 'event.jumpRandom':
                offset = command.scriptPointer.value;
                return `Jump to <b>${this.label(command.parent, offset)}</b> (50% Random)`;

            case 'event.jumpSubRepeat':
                offset = command.scriptPointer.value;
                return `Call Subroutine: <b>${this.label(command.parent, offset)}</b> ` +
                       `(Repeat <b>${command.count.value}</b> Times)`;

            case 'event.jumpSwitch':
            case 'vehicle.jumpSwitch':
            case 'world.jumpSwitch':
                offset = command.scriptPointer.value;
                desc = `Jump to <b>${this.label(command.parent, offset)}</b> if ` +
                       `<b>${command.anyAll.fString()}</b> of These are True:`;
                for (const switchAssembly of command.switchArray.iterator()) {
                    desc += `<br/>${switchAssembly.i}: ` +
                            `<b>${switchAssembly.switch.fString()}</b> == ` +
                            `<b>${switchAssembly.state.fString()}</b>`;
                }
                return desc;

            case 'object.layerPriority':
                return `${command.name} to <b>${command.priority.fString()}</b>`;

            case 'event.map':
            case 'event.mapParent':
            case 'vehicle.map':
            case 'world.map':
                return `${command.name}: <b>${command.map.fString()}</b> ` +
                       `at (<b>${command.xDest.value}</b>,<b>${command.yDest.value}</b>)`;

            case 'event.mapAnimationCounter':
                return `${command.name}: <b>Tile ${command.tile.value}</b>, ` +
                       `<b>Frame ${command.frame.value}</b>`;

            case 'event.mapAnimationSpeed':
                return `${command.name}: <b>Tile ${command.tile.value}</b>, ` +
                       `<b>Speed ${command.speed.value}</b>`;

            case 'event.mapBackground':
                return `Change Map <b>${command.layer.fString()}</b> at ` +
                       `(<b>${command.x.value}</b>,<b>${command.y.value}</b>)`;

            case 'event.mapPalette':
                return `Change <b>${command.vramPalette.fString()}</b> to ` +
                       `<b>${command.palette.fString()}</b>`;

            case 'event.menuName':
                return `${command.name} for <b>${command.character.fString()}</b>`;

            case 'event.menuParty':
                return `${command.name}: <b>${command.party.value}</b> Parties`;

            case 'event.menuShop':
                return `${command.name}: <b>${command.shop.fString()}</b>`;

            case 'vehicle.miniMap':
            case 'world.miniMap':
                return `<b>${command.miniMap.fString()}</b>`;

            case 'object.move':
            case 'world.move':
                return `${command.name} <b>${command.direction.fString()} ` +
                       `${command.distance.value}</b>`;

            case 'vehicle.move':
                return `${command.name}: <b>${command.flags.fString()} ` +
                       `${command.duration.value}</b>`;

            case 'object.moveDiagonal':
            case 'world.moveDiagonal':
                return `${command.name} <b>${command.direction.fString()}</b>`;

            case 'vehicle.moveForward':
                return `${command.name} at Speed <b>${command.speed.value}</b>`;

            case 'event.objectCollisions':
                return `<b>${command.enable.fString()}</b> Collision Event for ` +
                       `<b>${command.object.fString()}</b>`;

            case 'event.objectCreate':
                return `<b>${command.create.fString()}</b> Object: ` +
                       `<b>${command.object.fString()}</b>`;

            case 'event.objectEvent':
                offset = command.scriptPointer.value;
                return `Change Event for <b>${command.object.fString()}</b>: ` +
                       `<b>${this.label(command.parent, offset)}</b>`;

            case 'event.objectGraphics':
                return `Change <b>${command.object.fString()}</b>'s Graphics to ` +
                       `<b>${command.graphics.fString()}</b>`;

            case 'event.objectPalette':
                return `Change <b>${command.object.fString()}</b>'s Palette to ` +
                       `<b>${command.palette.fString()}</b>`;

            case 'event.objectPyramid':
                return `${command.name} Around Object: ` +
                       `<b>${command.object.fString()}</b>`;

            case 'event.objectScript':
                return `${command.name} for <b>${command.object.fString()}</b>`;

            case 'event.objectShow':
                return `<b>${command.show.fString()}</b> Object: ` +
                       `<b>${command.object.fString()}</b>`;

            case 'event.objectVehicle':
                return `Change <b>${command.object.fString()}</b>'s Vehicle to ` +
                       `<b>${command.vehicle.fString()}</b>`;

            case 'event.objectWait':
                return `Wait for <b>${command.object.fString()}</b>`;

            case 'event.objectPassability':
                return `<b>${command.passability.fString()}</b> Passability for ` +
                       `<b>${command.object.fString()}</b>`;

            case 'event.party':
                return `${command.name}: <b>Party ${command.party.value}</b>`;

            case 'event.partyCharacters':
                for (let i = 1; i <= 4; i++) {
                    const slot = command[`slot${i}`];
                    if (slot.value === 0xFF) continue;
                    if (desc) desc += ', '
                    desc += slot.fString();
                }
                return `${command.name}: <b>${desc}</b>`;

            case 'event.partyControl':
                return `<b>${command.control.fString()}</b> User Control`;

            case 'event.partyMap':
                return `Move <b>Party ${command.party.value}</b> to Map: ` +
                       `<b>${command.map.fString()}</b>`;

            case 'event.partyPosition':
                return `Move the Active Party to (${command.x.value},${command.y.value})`;

            case 'object.position':
                return `${command.name} to (<b>${command.x.value}</b>,` +
                       `<b>${command.y.value}</b>)`;

            case 'event.repeatStart':
                return `${command.name} (Repeat <b>${command.count.value}</b> Times)`;

            case 'event.repeatSwitch':
                return `End Repeat if <b>${command.switch.fString()}</b> == On`;

            case 'event.screenFade':
            case 'vehicle.screenFade':
            case 'world.screenFade':
                return `<b>${command.fade.fString()}</b>`;

            case 'event.screenFadeManual':
                return `<b>${command.fade.fString()}</b> with ` +
                       `<b>Speed ${command.speed.value}</b>`;

            case 'event.screenFlash':
                return `${command.name} <b>${command.color.fString()}</b>`;

            case 'event.screenFlashlight':
                return `${command.name} <b>Radius ${command.radius.value}</b>`;

            case 'event.screenMath':
                return `Set Fixed Color <b>${command.math.fString()}</b>: ` +
                       `<b>${command.color.fString()}</b>, ` +
                       `<b>Speed ${command.speed.value}</b>, ` +
                       `<b>Intensity ${command.intensity.value}</b>`;

            case 'event.screenMosaic':
                return `${command.name} (<b>Speed ${command.speed.value}</b>)`;

            case 'event.screenPalettes':
                return `Modify ${command.palettes.fString()} Palettes: ` +
                       `<b>${command.function.fString()}</b> ` +
                       `<b>${command.color.fString()}</b>`;

            case 'event.screenPalettesRange':
                return `Modify ${command.palettes.fString()} Palette Colors ` +
                       `<b>${command.colorFirst.value}−${command.colorLast.value}</b>: ` +
                       `<b>${command.function.fString()}</b> ` +
                       `<b>${command.color.fString()}</b>`;

            case 'event.screenScroll':
                return `${command.name} <b>${command.layer.fString()}</b> ` +
                       `(${command.hScroll.value},${command.vScroll.value})`;

            case 'event.screenScrollLock':
                return `<b>${command.lock.fString()}</b> the Screen`;

            case 'event.screenShake':
                return `${command.name} <b>Amplitude ${command.amplitude.value}</b> ` +
                       `<b>Frequency ${command.frequency.value}</b>`;

            case 'event.screenTint':
                return `${command.name} ` +
                       `<b>${command.colorFirst.value}−` +
                       `${command.colorLast.value}</b>: ` +
                       `<b>${command.color.fString()}</b>`;

            case 'object.showHide':
                return `<b>${command.showHide.fString()}</b> Object`;

            case 'vehicle.showHide':
                return `<b>${command.showHide.fString()}</b> Vehicle Sprite`;

            case 'world.showHide':
                return `<b>${command.showHide.fString()}</b> Character Sprite`;

            case 'event.spcInterrupt':
                return `${command.name} <b>${command.interrupt.fString()}</b>`;

            case 'event.spcSong':
            case 'event.spcSongFadeIn':
            case 'event.spcSongManual':
                return `${command.name} <b>${command.song.fString()}</b>`;

            case 'event.spcSoundEffect':
            case 'event.spcSoundEffectManual':
                return `${command.name} <b>${command.soundEffect.value}</b>`;

            case 'event.spcSync':
                return `${command.name} (<b>Position ${command.position.value}</b>)`;

            case 'event.spcWait':
                return `${command.name} (<b>${command.waitType.fString()}</b>)`;

            case 'object.speed':
            case 'world.speed':
                return `${command.name} to <b>${command.speed.fString()}</b>`;

            case 'event.switchBattle':
                return `Change Battle Switch: <b>${command.switch.fString()}</b> = ` +
                       `<b>${command.onOff.fString()}</b>`;

            case 'event.switch':
            case 'object.switch':
            case 'world.switch':
            case 'vehicle.switch':
                return `Change Switch: <b>${command.switch.fString()}</b> = ` +
                       `<b>${command.onOff.fString()}</b>`;

            case 'event.switchControl':
                return `Set Control Switches: <b>${command.switches.fString()}</b>`;

            case 'event.timerStart':
                const duration = command.duration.value;
                const min = Math.floor(duration / 3600);
                const sec = Math.floor(duration / 60) % 60;
                const frame = duration % 60;
                offset = command.scriptPointer.value;
                return `${command.name} <b>${command.timer.value}</b> ` +
                       `(<b>${min}m:${sec}s:${frame}f</b>): ` +
                       `<b>${this.label(command.parent, offset)}</b>`;

            case 'event.timerStop':
                return `${command.name} <b>${command.timer.value}</b>`;

            case 'event.variable':
                return `${command.operation.fString()} Variable ` +
                       `<b>${command.variable.fString()}</b>: ` +
                       `<b>${command.varValue.value}</b>`;

            case 'object.vehicle':
                return `${command.name} to <b>${command.vehicle.fString()}</b>`;

            case 'event.wait':
                return `${command.name} <b>${command.duration.fString()}</b>`;

            case 'object.wait':
            case 'vehicle.wait':
            case 'world.wait':
                return `${command.name} <b>${command.duration.value}</b> Frames`;

            case 'event.waitManual':
                const units = command.units.fString();
                return `${command.name} <b>${command[`duration${units}`].value} ${units}</b>`;

            default:
                break;
        }
        return super.description(command);
    }
}

class FF6MonsterScript extends ROMScriptDelegate {
    constructor(rom) {
        super(rom);
        this.name = 'FF6MonsterScript';
    }

    initScript(script) {
        // add references for monsters
        for (var e = 0; e < this.rom.monsterScriptPointers.arrayLength; e++) {
            var offset = this.rom.monsterScriptPointers.item(e).value;
            var label = this.rom.stringTable.monsterName.string[e].fString() || `Monster ${e}`;
            script.addPlaceholder(this.rom.monsterScriptPointers.item(e), offset, 'monster', label);
        }
    }

    elementString(command, key) {
        let e = command[key].value;
        if (e === 0) return '<b>No Element</b>';
        let element = '';
        const count = bitCount(e);
        const elementStringTable = this.rom.stringTable.element;
        for (let i = 0; i < 8; i++) {
            const mask = 1 << i;
            if (!(e & mask)) continue;
            e ^= mask; // flip the bit
            if (element) {
                // this is not the first element
                if (count === 2) element += ' or ';
                else element += (e ? ', ' : ', or ');
            }
            element += `<b>${elementStringTable.string[i].fString()}</b>`;
        }
        return element;
    }

    slotString(command, prep) {
        let s = command.monsters.value;
        if (s === 0) return '<b>This Monster</b>';
        if (s === 0xFF) return '<b>All Monsters</b>';
        s &= 0x3F;
        let slot = '';
        const count = bitCount(s);
        for (let i = 0; i < 6; i++) {
            const mask = 1 << i;
            if (!(s & mask)) continue;
            s ^= mask; // flip the bit
            if (slot) {
                // this is not the first element
                if (count === 2) slot += (` ${prep} `);
                else slot += (s ? ', ' : (`, ${prep} `));
            } else {
                slot = 'Monster Slot ';
            }
            slot += (i + 1).toString();
        }
        return `<b>${slot}</b>`;
    }

    conditionalString(command) {
        const target = command.target.fString();

        switch (command.condition.value) {

            case 1: // command
                if (command.command1.value === command.command2.value) {
                    return `If <b>${command.command1.fString()}</b> ` +
                           `Was Used Against This Monster`;
                } else {
                    return `If <b>${command.command1.fString()}</b> or ` +
                           `<b>${command.command2.fString()}</b> ` +
                           `Was Used Against This Monster`;
                }

            case 2: // attack
                if (command.attack1.value === command.attack2.value) {
                    return `If <b>${command.attack1.fString()}</b> ` +
                           `Was Used Against This Monster`;
                } else {
                    return `If <b>${command.attack1.fString()}</b> or ` +
                           `<b>${command.attack2.fString()}</b> ` +
                           `Was Used Against This Monster`;
                }

            case 3: // item
                if (command.item1.value === command.item2.value) {
                    return `If <b>${command.item1.fString()}</b> ` +
                           `Was Used Against This Monster`;
                } else {
                    return `If <b>${command.item1.fString()}</b> or ` +
                           `<b>${command.item2.fString()}</b> ` +
                           `Was Used On This Monster`;
                }

            case 4: // element
                return `If <b>${this.elementString(command, 'element')}</b> ` +
                       `Was Used Against this Monster`;

            case 5: // any action
                return 'If <b>Any Action</b> Was Used Against This Monster';

            case 6: // hp
                return `If <b>${target}</b>'s <b>HP</b> &lt; ` +
                       `<b>${command.hp.value}</b>`;

            case 7: // mp
                return `If <b>${target}</b>'s <b>MP</b> &lt; ` +
                       `<b>${command.mp.value}</b>`;

            case 8: // has status
                return `If <b>${target}</b> Has Status ` +
                       `<b>${command.status.fString()}</b>`;

            case 9: // does not have status
                return `If <b>${target}</b> Does Not Have Status ` +
                       `<b>${command.status.fString()}</b>`;

            case 11: // monster timer
                return `If <b>Monster Timer</b> &gt; ` +
                       `<b>${command.timer.value}</b>`;

            case 12: // variable less than
                return `If <b>${command.variable.fString()}</b> &lt; ` +
                       `<b>${command.value.value}</b>`;

            case 13: // variable greater than
                return `If <b>${command.variable.fString()}</b> ≥ ` +
                       `<b>${command.value.value}</b>`;

            case 14: // level less than
                return `If <b>${target}</b>'s Level &lt; ` +
                       `<b>${command.level.value}</b>`;

            case 15: // level greater than
                return `If <b>${target}</b>'s Level ≥ ` +
                       `<b>${command.level.value}</b>`;

            case 16: // only one type of monster
                return 'If <b>There is Only One Type of Monster Remaining</b>';

            case 17: // monsters alive
            case 18: // monsters dead
                return `If <b>${this.slotString(command, 'and')}</b> ` +
                       `${(bitCount(command.monsters.value) < 2) ? 'is' : 'are'} ` +
                       `<b>${command.condition.value === 17 ? 'Alive' : 'Dead'}</b>`;

            case 19: // characters/monsters alive
                if (command.countType.value) {
                    return `If There Are <b>${command.count.value} ` +
                           `or Fewer Monsters Remaining</b>`;
                } else {
                    return `If There Are <b>${command.count.value} ` +
                           `or More Characters Remaining</b>`;
                }

            case 20: // switch on
                return `If <b>${command.switch.fString()}</b> == <b>On</b>`;

            case 21: // switch off
                return `If <b>${command.switch.fString()}</b> == <b>Off</b>`;

            case 22: // battle timer
                return `If <b>Battle Timer</b> > <b>${command.timer.value}</b>`;

            case 23: // target valid
                return `If <b>${target}</b> is a Valid Target`;

            case 24: // gau present
            const gauString = this.rom.stringTable.characterNames.string[11];
                return `If ${gauString.fString()} is Present`;

            case 25: // monster slot
                return `If This Monster is <b>${this.slotString(command, 'or')}</b>`;

            case 26: // weak vs. element
                return `If <b>${target}</b> is Weak vs. ` +
                       `<b>${this.elementString(command, 'element2')}</b>`;

            case 27: // battle index
                return `If Current Battle is <b>${command.battle.fString()}</b>`;

            default:
                break;
        }
        return `<b>${command.condition.fString()}</b>`;
    }

    description(command) {
        switch (command.key) {
            case 'animation':
                return `${command.name}: ${this.slotString(command, 'and')}`;

            case 'attack':
                var a1 = command.attack1.value;
                var a2 = command.attack2.value;
                var a3 = command.attack3.value;
                if (a1 === a2 && a1 === a3) {
                    return `Use Attack: <b>${command.attack1.fString()}</b>`;
                } else {
                    return `Use Attack: <b>${command.attack1.fString()}</b>, ` +
                           `<b>${command.attack2.fString()}</b>, or ` +
                           `<b>${command.attack3.fString()}</b>`;
                }

            case 'attackSingle':
                return `Use Attack: <b>${command.attack.fString()}</b>`;

            case 'battleEvent':
                return `Battle Event <b>${command.battleEvent.value}</b>`;

            case 'changeBattle':
                return `Change Battle: <b>${command.battle.fString()}</b>`;

            case 'command':
                var c1 = command.command1.value;
                var c2 = command.command2.value;
                var c3 = command.command3.value;
                if (c1 === c2 && c1 === c3) {
                    return `Use Command: <b>${command.command1.fString()}</b>`;
                } else {
                    return `Use Command: <b>${command.command1.fString()}</b>, ` +
                           `<b>${command.command2.fString()}</b>, or ` +
                           `<b>${command.command3.fString()}</b>`;
                }

            case 'conditional':
                return `Conditional: ${this.conditionalString(command)}`;

            case 'dialog':
                var d = command.dialog.value;
                var dialog = this.rom.stringTable.monsterDialog.string[d];
                if (dialog) {
                    return `Display Monster Dialogue:<br/>` +
                           `<b>${dialog.htmlString()}</b>`;
                } else {
                    return `Display Monster Dialogue:<br/>` +
                           `<b>Invalid Dialogue Message</b>`;
                }

            case 'item':
                if (command.item1.value === command.item2.value) {
                    return `<b>${command.useThrow.fString()}</b> Item: ` +
                           `<b>${command.item1.fString()}</b>`;
                } else {
                    return `<b>${command.useThrow.fString()}</b> Item: ` +
                           `<b>${command.item1.fString()}</b> or ` +
                           `<b>${command.item2.fString()}</b>`;
                }

            case 'misc':
                if (!command.target.invalid) {
                    return `<b>${command.effect.fString()}</b>: ` +
                           `<b>${command.target.fString()}</b>`;
                } else if (!command.status.invalid) {
                    return `<b>${command.effect.fString()}</b>: ` +
                           `<b>${command.status.fString()}</b>`;
                } else {
                    return `<b>${command.effect.fString()}</b>`
                }

            case 'showHide':
                return `Show/Hide ${this.slotString(command, 'and')} ` +
                       `(<b>${command.showHide.fString()}</b>)`;

            case 'soundEffect':
                return `${command.name} <b>${command.soundEffect.value}</b>`;

            case 'switch':
                if (command.operation.value === 0) {
                    return `Toggle <b>${command.switch.fString()}</b>`;
                } else if (command.operation.value === 1) {
                    return `<b>${command.switch.fString()}</b> = <b>On</b>`;
                } else if (command.operation.value === 2) {
                    return `<b>${command.switch.fString()}</b> = <b>Off</b>`;
                }
                return 'Invalid Switch Operation';

            case 'target':
                return `${command.name}: <b>${command.target.fString()}</b>`;

            case 'variable':
                if (command.operation.value === 0) {
                    return `<b>${command.variable.fString()}</b> = ` +
                           `<b>${command.value.value}</b>`;
                } else if (command.operation.value === 2) {
                    return `<b>${command.variable.fString()}</b> += ` +
                           `<b>${command.value.value}</b>`;
                } else if (command.operation.value === 3) {
                    return `<b>${command.variable.fString()}</b> -= ` +
                           `<b>${command.value.value}</b>`;
                }
                return 'Invalid Variable Operation';

            default:
                break;
        }
        return command.name;
    }
}

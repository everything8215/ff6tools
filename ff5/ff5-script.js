//
// ff5-script.js
// created 12/23/2018
//

class FF5Script extends ROMScriptDelegate {
    constructor(rom) {
        super(rom);
        this.name = 'FF5Script';
    }

    didDisassemble(command, data) {
        switch (`${command.encoding}.${command.key}`) {

            case 'event.mapBackground':
                command.range.end += command.w.value * command.h.value;
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
                if (bank >= 2) command.switch.value += 0x0100;
                break;

            case 'trigger.switch':
                var encoding = this.rom.scriptEncoding[command.encoding];
                var bank = command.bank.value - encoding.opcode[command.key];
                if (bank & 1) {
                    command.onOff.value = 0;
                } else {
                    command.onOff.value = 1;
                }
                if (bank < 2) command.switch.value += 0x0100;
                break;

            default:
                break;
        }
    }

    willAssemble(command) {
        switch (`${command.encoding}.${command.key}`) {
            
            case 'event.switch':
                var encoding = this.rom.scriptEncoding[command.encoding];
                command.bank.value = encoding.opcode[command.key];
                if (command.switch.value >= 0x0100) command.bank.value += 2;
                if (command.onOff.value) command.bank.value++;
                command.bank.markAsDirty();
                command.onOff.isDirty = false;
                break;

            case 'trigger.switch':
                var encoding = this.rom.scriptEncoding[command.encoding];
                command.bank.value = encoding.opcode[command.key];
                if (command.switch.value < 0x0100) command.bank.value += 2;
                if (!command.onOff.value) command.bank.value++;
                command.bank.markAsDirty();
                command.onOff.isDirty = false;
                break;

            default:
                break;
        }
    }

    nextEncoding(command) {
        if (command.encoding === 'trigger' && command.key === 'end') return 'npcDialog';
        return super.nextEncoding(command);
    }

    description(command) {
        var desc = 'Invalid Command'

        switch (`${command.encoding}.${command.key}`) {

            case 'event.action':
                return `${command.name} (<b>${command.object.fString()}</b>): ` +
                    `<b>${command.action.fString()}</b>`;

            case 'event.actionParty':
                return `${command.name}: <b>${command.action.fString()}</b>`;

            case 'event.battle':
                return `${command.name}: <b>${command.battle.fString()}</b>`;

            case 'trigger.bool1':
            case 'trigger.bool2':
                var width = (command.key === 'bool1' ? 2 : 4);
                return `If <b>${hexString(0x0500 + command.ram.value, 4, '$')}</b> ` +
                    `& <b>${hexString(command.mask.value, width, '#$')}</b>`;

            case 'event.branchRandom':
                return `${command.name}: <b>${command.count.value}</b> Bytes`;

            case 'event.character':
                return `<b>${command.addRemove.fString()}</b> Character: ` +
                    `<b>${command.character.fString()}</b>`;

            case 'event.characterHP':
                if (command.hp.value === 0x1F) {
                    return `Change HP for <b>${command.character.fString()}</b>: ` +
                        `<b>${command.hp.fString()}</b>`;
                } else {
                    return `Change HP for <b>${command.character.fString()}</b>: ` +
                        `<b>${command.addSubtract.fString()}</b> <b>${command.hp.fString()}</b>`;
                }

            case 'event.characterMP':
                if (command.mp.value === 0x1F) {
                    return `Change MP for <b>${command.character.fString()}</b>: <b>${command.mp.fString()}</b>`;
                } else {
                    return `Change MP for <b>${command.character.fString()}</b>: <b>${command.addSubtract.fString()}</b> <b>${command.mp.fString()}</b>`;
                }

            case 'event.characterStatus':
            return `<b>${command.operation.fString()}</b> Status for ` +
                `<b>${command.character.fString()}</b>: ` +
                `<b>${command.status.fString()}</b>`;

            case 'trigger.compare1':
            case 'trigger.compare2':
                var width = (command.key === 'compare1' ? 2 : 4);
                var compare = ' == ';
                if (command.compare.value === 1) compare = '>';
                if (command.compare.value === 2) compare = '<';
                return `If <b>${hexString(0x0500 + command.ram.value, 4, '$')} ` +
                    `${compare} ${command.value.value}</b>`;

            case 'event.cutscene':
                return `${command.name}: <b>${command.cutscene.fString()}</b>`;

            case 'event.dialog':
            case 'event.dialogYesNo':
                var d = command.dialog.value;
                var dialog = this.rom.stringTable.dialog.string[d];
                if (dialog) {
                    desc = dialog.htmlString();
                } else {
                    desc = 'Invalid Dialogue Message';
                }
                return `Display Dialogue:<br/><b>${desc}</b>`;

            case 'trigger.direction':
                return `If Facing <b>${command.direction.fString()}</b>`;

            case 'event.fade':
                return `<b>${command.inOut.fString()}</b> at Speed ` +
                    `<b>${command.speed.value}</b>`;

            case 'event.inn':
                return `${command.name}: <b>${command.price.fString()}</b>`;

            case 'event.inventoryGP':
                return `<b>${command.giveTake.fString()}</b> ` +
                    `<b>${command.gp.value}</b> GP`;

            case 'event.inventoryItem':
                return `<b>${command.giveTake.fString()}</b> Item: ` +
                    `<b>${command.item.fString()}</b>`;

            case 'event.inventoryJob':
                return `${command.name}: <b>${command.job.fString()}</b>`;

            case 'event.inventoryMagic':
                return `${command.name}: <b>${command.spell.fString()}</b>`;

            case 'event.jumpSub':
            case 'trigger.jumpEvent':
                return `${command.name}: <b>${command.event.fString()}</b>`;

            case 'event.map':
                if (!command.xWorld.invalid) {
                    return `${command.name}: <b>${command.map.fString()}</b> ` +
                        `at (<b>${command.xWorld.value}</b>,<b>${command.yWorld.value}</b>)`;
                } else {
                    return `${command.name}: <b>${command.map.fString()}</b> ` +
                        `at (<b>${command.x.value}</b>,<b>${command.y.value}</b>)`;
                }

            case 'event.mapBackground':
                if (!command.xAbs.invalid) {
                    return `${command.name}: <b>${command.w.value}×${command.h.value}</b> ` +
                        `tiles at (<b>${command.xAbs.value}</b>,<b>${command.yAbs.value}</b>)`;
                } else {
                    return `${command.name}: <b>${command.w.value}×${command.h.value}</b> ` +
                        `tiles at (<b>${command.xRel.value}</b>,<b>${command.yRel.value}</b>)`;
                }

            case 'event.npcDialog':
                return `${command.name} <b>${command.dialog.value}</b>`;

            case 'npcDialog.npcDialog':
                let i = command.i;
                while (command.parent.command[i].encoding === 'npcDialog') {
                    i--;
                    if (!command.parent.command[i]) break;
                }
                i = command.i - i;

                var dialog = this.rom.stringTable.dialog.string[command.dialog.value];
                let dialogText = `NPC Dialogue ${i}:<br/>`;
                if (dialog) {
                    dialogText += `<b>${dialog.htmlString()}</b>`;
                } else {
                    dialogText += '<b>Invalid Dialog Message</b>';
                }
                return dialogText;

            case 'event.objectPositionAbs':
            case 'event.objectPositionRel':
                return `${command.name}: <b>${command.object.fString()}</b> ` +
                    `(<b>${command.x.value}</b>,<b>${command.y.value}</b>)`;

            case 'event.palette':
                return `Change <b>${command.vramPalette.fString()}</b> to ` +
                    `<b>${command.palette.value}</b>`;
            case 'event.parallel':
                if (!command.bytes) return command.name;
                return `Execute the Next <b>${command.bytes.value}</b> Byte(s) in Parallel`;

            case 'event.partyGraphic':
            case 'event.partyGraphicAlt':
                return `${command.name} to <b>${command.graphics.fString()}</b>`;

            case 'event.ram':
                const ramOffset = hexString(command.offset.value + 0x0500, 4, '$');
                return `${command.name}: <b>${ramOffset}</b>` +
                    ` = <b>${command.ramValue.value}</b>`;

            case 'event.repeat':
                if (!command.bytes) return command.name;
                return `Repeat the Next <b>${command.bytes.value}</b> Byte(s) ` +
                    `<b>${command.count.value}</b> Times ` +
                    `(<b>${command.repeatType.fString()}</b>)`;

            case 'event.screenColor':
                return `Set Fixed Color <b>${command.math.fString()}</b>: ` +
                    `<b>${command.color.fString()}</b>, ` +
                    `<b>${command.speed.fString()}</b>, ` +
                    `<b>Intensity ${command.intensity.value}</b>`;

            case 'event.screenFlash':
                return `${command.name} <b>${command.color.fString()}</b>`;

            case 'event.screenMask':
                return `${command.name} to <b>${command.mask.value}</b>`;

            case 'event.screenPixelate':
                return `${command.name} (<b>Speed ${command.speed.value}</b>)`;

            case 'event.screenShake':
                return `${command.name} (<b>Amplitude ${command.amplitude.value}</b>)`;

            case 'event.scrollSpeed':
                return `${command.name} to <b>${command.speed.fString()}</b>`;

            case 'event.shop':
                return `${command.name}: <b>${command.shop.fString()}</b>`;

            case 'event.song':
            case 'event.songManual':
                return `${command.name}: <b>${command.song.fString()}</b>`;

            case 'event.soundEffect':
            case 'event.soundEffectManual':
                return `${command.name}: <b>${command.soundEffect.fString()}</b>`;

            case 'event.spcInterrupt':
                return `${command.name}: <b>${command.interrupt.fString()}</b>`;

            case 'event.spcWait':
                return `${command.name} (<b>${command.waitType.fString()}</b>)`;

            case 'event.special':
                return `${command.name}: <b>${command.command.fString()}</b>`;

            case 'event.npcSwitch':
            case 'event.battleSwitch':
            case 'event.switch':
                return `${command.name}: <b>${command.switch.fString()}</b> = ` +
                    `<b>${command.onOff.fString()}</b>`;

            case 'trigger.switch':
                return `If <b>${command.switch.fString()}</b> == ` +
                    `<b>${command.onOff.fString()}</b>`;

            case 'event.timerStart':
                const duration = command.duration.value;
                const min = Math.floor(duration / 60);
                const sec = duration % 60;
                return `${command.name} (<b>${min}m:${sec}s</b>): ` +
                       `<b>${command.event.fString()}</b>`;

            case 'event.tutorial':
                return `${command.name}: <b>${command.tutorial.fString()}</b>`;

            case 'event.vehicleChange':
                return `${command.name}: <b>${command.vehicle.fString()}</b>`;

            case 'event.vehicleHide':
                return `${command.name}: <b>${command.vehicle.fString()}</b>`;

            case 'event.vehicleShow':
                return `${command.name}: <b>${command.vehicle.fString()}</b> ` +
                    `at (<b>${command.x.value}</b>,<b>${command.y.value}</b>)`;

            case 'event.wait':
                return `${command.name} <b>${command.duration.fString()}</b>`;

            case 'event.waitManual':
                const units = command.units.fString();
                return `${command.name} <b>${command[`duration${units}`].value} ${units}</b>`;

            default:
                break;
        }
        return super.description(command);
    }
}

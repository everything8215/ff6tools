//
// ff4level.js
// created 2/5/2020
//

function FF4LevelProgression(rom) {
    ROMEditor.call(this, rom);
    this.name = "FF4LevelProgression";

    this.div = document.createElement('div');
    this.div.id = 'chart-edit';

    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 256;
    this.div.appendChild(this.canvas);

    this.tooltip = document.createElement("span");
    this.tooltip.setAttribute("data-balloon-pos", "up");
    this.tooltip.style.position = "absolute";
    this.div.appendChild(this.tooltip);

    this.showStat = [true, false, false, false, false, false, false, false];
    this.showRange = false;
    this.showLegend = true;

    this.c = 0;
    this.selectedPoint = null;
    this.characterStats = null;
    this.levelProgData = null;
    this.observer = new ROMObserver(rom, this, {sub: true, link: true, array: true});

    var levelProg = this;
//    this.div.onscroll = function() { levelProg.resize() };
    this.div.onresize = function() { levelProg.resize() };
    this.div.onmousedown = function(e) { levelProg.mouseDown(e) };
    this.div.onmouseup = function(e) { levelProg.mouseUp(e) };
    this.div.onmouseleave = function(e) { levelProg.mouseLeave(e) };
    this.div.onmousemove = function(e) { levelProg.mouseMove(e) };

    this.initLevelProg();
    this.resetObserver();

    this.resizeSensor = null;
}

FF4LevelProgression.prototype = Object.create(ROMEditor.prototype);
FF4LevelProgression.prototype.constructor = FF4LevelProgression;

FF4LevelProgression.prototype.selectObject = function(object) {
    this.show();
    this.loadCharacter(object.i);
}

FF4LevelProgression.prototype.resize = function() {
    if (!this.div.parentElement) return;
    this.canvas.width = this.div.parentElement.clientWidth;
    this.canvas.height = this.div.parentElement.clientHeight - 4;

    var l = 50;
    var r = this.canvas.width - 20;
    var t = 20;
    var b = this.canvas.height - 60;
    this.chartRect = new Rect(l, r, t, b);
}

FF4LevelProgression.prototype.mouseDown = function(e) {
    this.closeList();
    if (!this.selectedPoint) return;
    propertyList.select(this.selectedPoint.object)
}

FF4LevelProgression.prototype.mouseUp = function(e) {

}

FF4LevelProgression.prototype.mouseLeave = function(e) {
    this.selectedPoint = null;
    this.drawChart();
    this.tooltip.removeAttribute("data-balloon-visible");
}

FF4LevelProgression.prototype.mouseMove = function(e) {

    this.selectedPoint = null;
    var point = this.canvasToPoint(e.offsetX, e.offsetY);
    if (!point) {
        this.drawChart();
        this.tooltip.removeAttribute("data-balloon-visible");
        return;
    }

    for (var p = 0; p < this.chartData.length; p++) {
        if (this.chartData[p].level !== point.x) continue;
        this.selectedPoint = this.chartData[p];
        break;
    }

    if (!this.selectedPoint) return;

    this.drawChart();

    // find the closest stat
    var level = this.selectedPoint.level.toString();
    var statLabel = "Level: " + level;
    var closestValue;

    for (var s = 0; s < 8; s++) {
        if (!this.showStat[s]) continue;

        var statProperties = this.statProperties(s);

        var avgValue = this.selectedPoint[statProperties.key].avg;
        var minValue = this.selectedPoint[statProperties.key].min;
        var maxValue = this.selectedPoint[statProperties.key].max;

        if (avgValue >= 10000) {
            statLabel += "\n" + statProperties.name + ": " + Math.round(avgValue).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        } else {
            statLabel += "\n" + statProperties.name + ": " + Math.round(avgValue);
        }
        if (minValue !== maxValue) {
            statLabel += " (" + minValue + "–" + maxValue + ")";
        }

        if (closestValue === undefined || Math.abs(avgValue / statProperties.multiplier - point.y) < Math.abs(closestValue - point.y)) {
            closestValue = avgValue / statProperties.multiplier;
        }
    }

    // show the tooltip
    this.tooltip.setAttribute("aria-label", statLabel);
    var point = this.pointToCanvas(level, closestValue);
    this.tooltip.style.display = "inline-block";
    this.tooltip.setAttribute("data-balloon-visible", "");
    if (closestValue > 70 && level > 90) {
        this.tooltip.style.left = (point.x + 17) + "px";
        this.tooltip.style.top = (point.y + 15) + "px";
        this.tooltip.setAttribute("data-balloon-pos", "down-right");
    } else if (closestValue > 70) {
        this.tooltip.style.left = point.x + "px";
        this.tooltip.style.top = (point.y + 15) + "px";
        this.tooltip.setAttribute("data-balloon-pos", "down");
    } else if (closestValue < 10 && level > 90) {
        this.tooltip.style.left = (point.x + 17) + "px";
        this.tooltip.style.top = (point.y - this.tooltip.clientHeight - 15) + "px";
        this.tooltip.setAttribute("data-balloon-pos", "up-right");
    } else if (level > 90) {
        this.tooltip.style.left = (point.x - 15) + "px";
        this.tooltip.style.top = (point.y - this.tooltip.clientHeight) + "px";
        this.tooltip.setAttribute("data-balloon-pos", "left");
    } else {
        this.tooltip.style.left = point.x + "px";
        this.tooltip.style.top = (point.y - this.tooltip.clientHeight - 15) + "px";
        this.tooltip.setAttribute("data-balloon-pos", "up");
    }
}

FF4LevelProgression.prototype.show = function() {

    document.getElementById('toolbox-layer-div').classList.add("hidden");
    document.getElementById('toolbox-div').classList.add("hidden");

    this.resetControls();
    this.showControls();
    this.closeList();

    var levelProg = this;
    function statFunction(s) {
        return function(checked) {
            levelProg.showStat[s] = checked;
            levelProg.drawChart();
        }
    }

    for (var s = 0; s < 8; s++) {
        var statName = this.statProperties(s).name;
        this.addTwoState("show" + statName, statFunction(s), statName, this.showStat[s]);
    }
    this.addTwoState("showRange", function(checked) { levelProg.showRange = checked; levelProg.drawChart(); }, "Min/Max", this.showRange);
    this.addTwoState("showLegend", function(checked) { levelProg.showLegend = checked; levelProg.drawChart(); }, "Legend", this.showLegend);
    if (!this.resizeSensor) this.resizeSensor = new ResizeSensor(document.getElementById("edit-top"), function() {
        levelProg.resize();
        levelProg.drawChart();
    });
}

FF4LevelProgression.prototype.hide = function() {
    this.observer.stopObservingAll();
    if (this.resizeSensor) {
        this.resizeSensor.detach(document.getElementById("edit-top"));
        this.resizeSensor = null;
    }
}

FF4LevelProgression.prototype.statProperties = function(s) {
    switch (s) {
        case 0: return {
            name: "Experience",
            axis: "Experience (×100,000)",
            key: "exp",
            color: "hsla(0, 0%, 0%, 1.0)",
            fillColor: "hsla(0, 0%, 0%, 0.25)",
            multiplier: 100000,
            max: 9999999
        };
        case 1: return {
            name: "HP",
            axis: "HP (×100)",
            key: "hp",
            color: "hsla(100, 100%, 30%, 1.0)",
            fillColor: "hsla(100, 100%, 30%, 0.25)",
            multiplier: 100,
            max: 9999
        };
        case 2: return {
            name: "MP",
            axis: "MP (×10)",
            key: "mp",
            color: "hsla(220, 100%, 35%, 1.0)",
            fillColor: "hsla(220, 100%, 60%, 0.25)",
            multiplier: 10,
            max: 999
        };
        case 3: return {
            name: "Strength",
            key: "strength",
            color: "hsla(0, 100%, 40%, 1.0)",
            fillColor: "hsla(0, 100%, 40%, 0.25)",
            multiplier: 1,
            max: 99
        };
        case 4: return {
            name: "Agility",
            key: "agility",
            color: "hsla(50, 100%, 35%, 1.0)",
            fillColor: "hsla(50, 100%, 35%, 0.25)",
            multiplier: 1,
            max: 99
        };
        case 5: return {
            name: this.rom.isSFC ? "Vitality" : "Stamina",
            key: this.rom.isSFC ? "vitality" : "stamina",
            color: "hsla(170, 100%, 35%, 1.0)",
            fillColor: "hsla(170, 100%, 35%, 0.25)",
            multiplier: 1,
            max: 99
        };
        case 6: return {
            name: this.rom.isSFC ? "Wisdom" : "Intellect",
            key: this.rom.isSFC ? "wisdom" : "intellect",
            color: "hsla(270, 100%, 35%, 1.0)",
            fillColor: "hsla(270, 100%, 35%, 0.25)",
            multiplier: 1,
            max: 99
        };
        case 7: return {
            name: this.rom.isSFC ? "Will" : "Spirit",
            key: this.rom.isSFC ? "will" : "spirit",
            color: "hsla(320, 100%, 35%, 1.0)",
            fillColor: "hsla(320, 100%, 35%, 0.25)",
            multiplier: 1,
            max: 99
        };
        default: return null;
    }
}

FF4LevelProgression.highLevelStatsDefiniton = {
    "key": "highLevelStats",
    "name": "Random Stats for Level 71-99",
    "type": "array",
    "range": "5-13",
    "array": {
        "length": 8,
        "min": 8,
        "max": 8
    },
    "assembly": {
        "type": "data",
        "length": 1,
        "assembly": {
            "statMod": {
                "type": "property",
                "name": "Stat Mod.",
                "begin": 0,
                "mask": "0x07",
                "stringTable": {
                    "hideIndex": true,
                    "string": {
                        "0": "0",
                        "1": "+1",
                        "2": "+2",
                        "3": "+3",
                        "4": "+4",
                        "5": "+5",
                        "6": "+6",
                        "7": "-1"
                    }
                }
            },
            "stats": {
                "type": "property",
                "name": "Stats",
                "begin": 0,
                "mask": "0xF8",
                "flag": true,
                "stringTable": {
                    "string": {
                        "4": "Strength",
                        "3": "Agility",
                        "2": "Vitality",
                        "1": "Wisdom",
                        "0": "Will"
                    }
                }
            }
        }
    }
}

FF4LevelProgression.prototype.initLevelProg = function() {
    if (this.rom.isGBA) return;

    var levelProgData = this.rom.characterLevelProgression;
    var levelProgPointers = this.rom.characterLevelPointer;
    var characterStatsData = this.rom.characterStats;

    for (var c = 0; c < characterStatsData.arrayLength; c++) {
        var characterStats = characterStatsData.item(c);
        var level = characterStats.level.value;
        var id = characterStats.properties.value;
        var levelStats = levelProgData.item(c);
        if (!levelStats) continue;

        var pointer = levelProgPointers.item(id);
        var begin = pointer.value;
        begin += (level - 1) * 5;
        begin -= this.rom.unmapAddress(levelProgData.range.begin) & 0xFFFF;

        // set the range for the level stats and disassemble
        levelStats.range.begin = begin;
        levelStats.range.end = begin + (70 - level) * 5 + 8;
        levelStats.arrayLength = 70 - level
        levelStats.disassemble(levelProgData.data);

        // create the high level random stats
        var lastLevelStats = levelStats.item(69 - level);
        lastLevelStats.addAssembly(FF4LevelProgression.highLevelStatsDefiniton);
        lastLevelStats.range.end += 8;
        lastLevelStats.disassemble(levelStats.data);
    }
}

FF4LevelProgression.prototype.resetObserver = function() {
    var levelProg = this;
    function changeStartingLevel(c) {
        if (this.rom.isGBA) {
            return function() {
                levelProg.changeStartingLevelGBA(c);
            }
        } else {
            return function() {
                levelProg.changeStartingLevel(c);
            }
        }
    }

    // start observing the character's starting level so we can update the level progression data
    var c;
    if (this.rom.isGBA) {
        for (c = 0; c < this.rom.characterProperties.arrayLength; c++) {
            var characterProperties = this.rom.characterProperties.item(c);
            this.observer.startObserving(characterProperties.level, changeStartingLevel(c));
            this.observer.startObserving(characterProperties.hp, changeStartingLevel(c));
            this.observer.startObserving(characterProperties.mp, changeStartingLevel(c));
            this.observer.startObserving(characterProperties.strength, changeStartingLevel(c));
            this.observer.startObserving(characterProperties.agility, changeStartingLevel(c));
            this.observer.startObserving(characterProperties.stamina, changeStartingLevel(c));
            this.observer.startObserving(characterProperties.intellect, changeStartingLevel(c));
            this.observer.startObserving(characterProperties.spirit, changeStartingLevel(c));
        }
    } else {
        for (c = 0; c < this.rom.characterStats.arrayLength; c++) {
            var characterStats = this.rom.characterStats.item(c);
            this.observer.startObserving(characterStats.level, changeStartingLevel(c));
        }
        for (c = 0; c < this.rom.characterPartyAdd.arrayLength; c++) {
            this.observer.startObserving(this.rom.characterPartyAdd.item(c), this.updatePointerTable);
        }
        for (c = 0; c < this.rom.characterPartyRemove.arrayLength; c++) {
            this.observer.startObserving(this.rom.characterPartyRemove.item(c), this.updatePointerTable);
        }
    }
}

FF4LevelProgression.prototype.changeStartingLevel = function(c) {
    var characterStats = this.rom.characterStats.item(c);
    var levelStats = this.rom.characterLevelProgression.item(c);

    var level = characterStats.level.value;
    this.observer.stopObservingAll();

    while (level < (70 - levelStats.arrayLength)) {
        var newLevel = levelStats.blankAssembly();
        levelStats.array.splice(0, 0, newLevel);
    }

    while (level > (70 - levelStats.arrayLength)) {
        levelStats.array.splice(0, 1);
    }
    levelStats.markAsDirty();
    levelStats.updateArray();
    levelStats.notifyObservers();

    this.updatePointerTable();
    this.loadCharacter(c);
}

FF4LevelProgression.prototype.changeStartingLevelGBA = function(c) {
    // update stats in level progression data
    var characterProperties = this.rom.characterProperties.item(c);
    var levelStats = this.rom.characterLevelProgression.item(c);
    var startingLevel = this.rom.characterStartingLevel.item(c);

    var level = characterProperties.level.value;
    this.observer.stopObservingAll();

    this.rom.beginAction();
    while (level < (100 - levelStats.arrayLength)) {
        var newLevel = levelStats.blankAssembly();
        levelStats.array.splice(0, 0, newLevel);
    }

    while (level > (100 - levelStats.arrayLength)) {
        levelStats.array.splice(0, 1);
    }
    levelStats.markAsDirty();
    levelStats.updateArray();
    levelStats.notifyObservers();

    startingLevel.level.setValue(level);
    var firstLevelStats = levelStats.item(0);
    firstLevelStats.hp.setValue(0);
    firstLevelStats.hpMax.setValue(0);
    firstLevelStats.mp.setValue(0);
    firstLevelStats.mpMax.setValue(0);
    firstLevelStats.strength.setValue(characterProperties.strength.value);
    firstLevelStats.agility.setValue(characterProperties.agility.value);
    firstLevelStats.stamina.setValue(characterProperties.stamina.value);
    firstLevelStats.intellect.setValue(characterProperties.intellect.value);
    firstLevelStats.spirit.setValue(characterProperties.spirit.value);
    this.rom.endAction();

    this.loadCharacter(c);
}

FF4LevelProgression.prototype.updatePointerTable = function() {

    if (this.rom.isGBA) return;

    var characterStatsData = this.rom.characterStats;
    var levelProgData = this.rom.characterLevelProgression;

    // calculate pointers to each character's level progression data
    var pointers = [];
    var currentPointer = this.rom.unmapAddress(levelProgData.range.begin);
    for (var c = 0; c < characterStatsData.arrayLength; c++) {
        var levelProg = levelProgData.item(c);
        if (!levelProg) continue;
        pointers.push(currentPointer - (69 - levelProg.arrayLength) * 5);
        currentPointer += levelProg.assembledLength;
    }

    // determine which characters get saved to temporary slots
    var levelProgPointers = this.rom.characterLevelPointer;
    var charSlot = [0, 0, 0, 0, 0];
    var slot, l;
    for (var c = 0; c < this.rom.characterPartyRemove.arrayLength; c++) {

        var charAdd = this.rom.characterPartyAdd.item(c);
        if (!charAdd) break;
        if (charAdd.restore.value) {
            // restore a previous character
            slot = charAdd.slot.value;
            l = charSlot[slot || 0];
        } else {
            // new character
            l = charAdd.character.value;
        }

        var pointer = levelProgPointers.item(c);
        if (pointer) {
            pointer.value = pointers[l];
            pointer.markAsDirty();
        }

        var charRemove = this.rom.characterPartyRemove.item(c);
        if (!charRemove) break;
        slot = charRemove.slot.value;
        if ((slot & 0x80) === 0) {
            charSlot[slot] = l;
        }
    }
}

FF4LevelProgression.prototype.loadCharacter = function(c) {

    this.tooltip.removeAttribute("data-balloon-visible");

    this.observer.stopObservingAll();
    this.resetObserver();

    this.characterStats = this.rom.isSFC ? this.rom.characterStats.item(c) : this.rom.characterProperties.item(c);
    if (!this.characterStats) return;
    this.c = c;
    this.levelProgData = this.rom.characterLevelProgression.item(c);
    if (!this.levelProgData) return;
    propertyList.select(this.characterStats);

    this.observer.startObserving(this.characterStats, this.updateStats);
    this.observer.startObserving(this.levelProgData, this.updateStats);
    this.selectedPoint = null;

    this.updateStats();
}

FF4LevelProgression.prototype.getStats = function(level) {

    if (this.rom.isGBA) level++;
    var startingLevel = this.characterStats.level.value;
    level = Math.min(level - startingLevel - 1, this.levelProgData.arrayLength - 1);
    return this.levelProgData.item(level);
}

FF4LevelProgression.prototype.updateStats = function() {

    if (this.rom.isGBA) {
        this.updateStatsGBA();
        return;
    }

    // todo: clean this up, it's a mess
    var level = this.characterStats.level.value;
    var exp = this.characterStats.expLastLevel.value;
    var minHP = this.characterStats.hp.value;
    var maxHP = minHP;
    var minMP = this.characterStats.mp.value;
    var maxMP = minMP;
    var strength = {avg: this.characterStats.strength.value};
    var agility = {avg: this.characterStats.agility.value};
    var vitality = {avg: this.characterStats.vitality.value};
    var wisdom = {avg: this.characterStats.wisdom.value};
    var will = {avg: this.characterStats.will.value};

    this.chartData = [{
        level: level,
        exp: {avg: exp},
        hp: {min: minHP, max: maxHP, avg: minHP},
        mp: {min: minMP, max: maxMP, avg: minMP},
        strength: {avg: strength.avg},
        agility: {avg: agility.avg},
        vitality: {avg: vitality.avg},
        wisdom: {avg: wisdom.avg},
        will: {avg: will.avg},
        object: this.characterStats
    }];

    for (level++; level <= 70; level++) {
        var levelStats = this.getStats(level);

        exp = Math.min(exp + levelStats.exp.value, 9999999);
        minHP = Math.min(minHP + levelStats.hp.value, 9999);
        maxHP = Math.min(maxHP + Math.floor(levelStats.hp.value * 9 / 8), 9999);
        minMP = Math.min(minMP + levelStats.mp.value, 9999);
        maxMP = Math.min(maxMP + Math.floor(levelStats.mp.value * 9 / 8), 999);

        var statMod = levelStats.statMod.value;
        if (statMod === 7) statMod = -1;
        if (levelStats.stats.value & 0x10) strength.avg = Math.min(strength.avg + statMod, 99);
        if (levelStats.stats.value & 0x08) agility.avg = Math.min(agility.avg + statMod, 99);
        if (levelStats.stats.value & 0x04) vitality.avg = Math.min(vitality.avg + statMod, 99);
        if (levelStats.stats.value & 0x02) wisdom.avg = Math.min(wisdom.avg + statMod, 99);
        if (levelStats.stats.value & 0x01) will.avg = Math.min(will.avg + statMod, 99);

        this.chartData.push({
            level: level,
            exp: {avg: exp},
            hp: {min: minHP, max: maxHP, avg: (minHP + maxHP) / 2},
            mp: {min: minMP, max: maxMP, avg: (minMP + maxMP) / 2},
            strength: {min: strength.avg, max: strength.avg, avg: strength.avg},
            agility: {min: agility.avg, max: agility.avg, avg: agility.avg},
            vitality: {min: vitality.avg, max: vitality.avg, avg: vitality.avg},
            wisdom: {min: wisdom.avg, max: wisdom.avg, avg: wisdom.avg},
            will: {min: will.avg, max: will.avg, avg: will.avg},
            object: levelStats
        });
    }

    var expMod = levelStats.exp.value;
    var hpMod = levelStats.hp.value;
    var mpMod = levelStats.mp.value;

    // get min, max, and average random stat bonuses for high levels
    var strengthMod = {min: 0, max: 0, avg: 0};
    var agilityMod = {min: 0, max: 0, avg: 0};
    var vitalityMod = {min: 0, max: 0, avg: 0};
    var wisdomMod = {min: 0, max: 0, avg: 0};
    var willMod = {min: 0, max: 0, avg: 0};

    for (var s = 0; s < 8; s++) {
        var randomStats = levelStats.highLevelStats.item(s);
        var statMod = randomStats.statMod.value;
        if (statMod === 7) statMod = -1;
        if (randomStats.stats.value & 0x10) {
            strengthMod.min = Math.min(strengthMod.min, statMod);
            strengthMod.max = Math.max(strengthMod.max, statMod);
            strengthMod.avg += statMod / 8;
        }
        if (randomStats.stats.value & 0x08) {
            agilityMod.min = Math.min(agilityMod.min, statMod);
            agilityMod.max = Math.max(agilityMod.max, statMod);
            agilityMod.avg += statMod / 8;
        }
        if (randomStats.stats.value & 0x04) {
            vitalityMod.min = Math.min(vitalityMod.min, statMod);
            vitalityMod.max = Math.max(vitalityMod.max, statMod);
            vitalityMod.avg += statMod / 8;
        }
        if (randomStats.stats.value & 0x02) {
            wisdomMod.min = Math.min(wisdomMod.min, statMod);
            wisdomMod.max = Math.max(wisdomMod.max, statMod);
            wisdomMod.avg += statMod / 8;
        }
        if (randomStats.stats.value & 0x01) {
            willMod.min = Math.min(willMod.min, statMod);
            willMod.max = Math.max(willMod.max, statMod);
            willMod.avg += statMod / 8;
        }
    }

    strength.min = strength.avg;
    strength.max = strength.avg;
    agility.min = agility.avg;
    agility.max = agility.avg;
    vitality.min = vitality.avg;
    vitality.max = vitality.avg;
    wisdom.min = wisdom.avg;
    wisdom.max = wisdom.avg;
    will.min = will.avg;
    will.max = will.avg;

    for (; level <= 99; level++) {

        exp = Math.min(exp + expMod, 9999999);
        minHP = Math.min(minHP + hpMod, 9999);
        maxHP = Math.min(maxHP + Math.floor(hpMod * 9 / 8), 9999);
        minMP = Math.min(minMP + mpMod, 9999);
        maxMP = Math.min(maxMP + Math.floor(mpMod * 9 / 8), 999);

        strength.min = Math.max(0, Math.min(strength.min + strengthMod.min, 99));
        strength.max = Math.max(0, Math.min(strength.max + strengthMod.max, 99));
        strength.avg = Math.max(0, Math.min(strength.avg + strengthMod.avg, 99));
        agility.min = Math.max(0, Math.min(agility.min + agilityMod.min, 99));
        agility.max = Math.max(0, Math.min(agility.max + agilityMod.max, 99));
        agility.avg = Math.max(0, Math.min(agility.avg + agilityMod.avg, 99));
        vitality.min = Math.max(0, Math.min(vitality.min + vitalityMod.min, 99));
        vitality.max = Math.max(0, Math.min(vitality.max + vitalityMod.max, 99));
        vitality.avg = Math.max(0, Math.min(vitality.avg + vitalityMod.avg, 99));
        wisdom.min = Math.max(0, Math.min(wisdom.min + wisdomMod.min, 99));
        wisdom.max = Math.max(0, Math.min(wisdom.max + wisdomMod.max, 99));
        wisdom.avg = Math.max(0, Math.min(wisdom.avg + wisdomMod.avg, 99));
        will.min = Math.max(0, Math.min(will.min + willMod.min, 99));
        will.max = Math.max(0, Math.min(will.max + willMod.max, 99));
        will.avg = Math.max(0, Math.min(will.avg + willMod.avg, 99));

        this.chartData.push({
            level: level,
            exp: {avg: exp},
            hp: {min: minHP, max: maxHP, avg: (minHP + maxHP) / 2},
            mp: {min: minMP, max: maxMP, avg: (minMP + maxMP) / 2},
            strength: {min: strength.min, max: strength.max, avg: strength.avg},
            agility: {min: agility.min, max: agility.max, avg: agility.avg},
            vitality: {min: vitality.min, max: vitality.max, avg: vitality.avg},
            wisdom: {min: wisdom.min, max: wisdom.max, avg: wisdom.avg},
            will: {min: will.min, max: will.max, avg: will.avg},
            object: levelStats
        });
    }

    this.resize();
    this.drawChart();
}

FF4LevelProgression.prototype.updateStatsGBA = function() {

    // todo: clean this up, it's a mess
    var level = this.characterStats.level.value;
    var levelStats = this.getStats(level);
    var exp = levelStats.exp.value;
    var minHP = this.characterStats.hp.value;
    var maxHP = minHP;
    var minMP = this.characterStats.mp.value;
    var maxMP = minMP;
    var strength = {avg: this.characterStats.strength.value};
    var agility = {avg: this.characterStats.agility.value};
    var stamina = {avg: this.characterStats.stamina.value};
    var intellect = {avg: this.characterStats.intellect.value};
    var spirit = {avg: this.characterStats.spirit.value};

    this.chartData = [{
        level: level,
        exp: {avg: exp},
        hp: {min: minHP, max: maxHP, avg: minHP},
        mp: {min: minMP, max: maxMP, avg: minMP},
        strength: {avg: strength.avg},
        agility: {avg: agility.avg},
        stamina: {avg: stamina.avg},
        intellect: {avg: intellect.avg},
        spirit: {avg: spirit.avg},
        object: this.characterStats
    }];

    for (level++; level <= 70; level++) {
        levelStats = this.getStats(level);

        exp = levelStats.exp.value;
        minHP = Math.min(minHP + levelStats.hp.value, 9999);
        maxHP = Math.min(maxHP + levelStats.hpMax.value, 9999);
        minMP = Math.min(minMP + levelStats.mp.value, 9999);
        maxMP = Math.min(maxMP + levelStats.mpMax.value, 999);
        strength.avg = levelStats.strength.value;
        agility.avg = levelStats.agility.value;
        stamina.avg = levelStats.stamina.value;
        intellect.avg = levelStats.intellect.value;
        spirit.avg = levelStats.spirit.value;

        this.chartData.push({
            level: level,
            exp: {avg: exp},
            hp: {min: minHP, max: maxHP, avg: (minHP + maxHP) / 2},
            mp: {min: minMP, max: maxMP, avg: (minMP + maxMP) / 2},
            strength: {min: strength.avg, max: strength.avg, avg: strength.avg},
            agility: {min: agility.avg, max: agility.avg, avg: agility.avg},
            stamina: {min: stamina.avg, max: stamina.avg, avg: stamina.avg},
            intellect: {min: intellect.avg, max: intellect.avg, avg: intellect.avg},
            spirit: {min: spirit.avg, max: spirit.avg, avg: spirit.avg},
            object: levelStats
        });
    }

    // get min, max, and average random stat bonuses for high levels
    var strengthMod = {min: 0, max: 0, avg: 0};
    var agilityMod = {min: 0, max: 0, avg: 0};
    var staminaMod = {min: 0, max: 0, avg: 0};
    var intellectMod = {min: 0, max: 0, avg: 0};
    var spiritMod = {min: 0, max: 0, avg: 0};

    for (var s = 0; s < 8; s++) {
        levelStats = this.getStats(71 + s);
        strengthMod.min = Math.min(strengthMod.min, levelStats.strength.value);
        strengthMod.max = Math.max(strengthMod.max, levelStats.strength.value);
        strengthMod.avg += levelStats.strength.value / 8;
        agilityMod.min = Math.min(agilityMod.min, levelStats.agility.value);
        agilityMod.max = Math.max(agilityMod.max, levelStats.agility.value);
        agilityMod.avg += levelStats.agility.value / 8;
        staminaMod.min = Math.min(staminaMod.min, levelStats.stamina.value);
        staminaMod.max = Math.max(staminaMod.max, levelStats.stamina.value);
        staminaMod.avg += levelStats.stamina.value / 8;
        intellectMod.min = Math.min(intellectMod.min, levelStats.intellect.value);
        intellectMod.max = Math.max(intellectMod.max, levelStats.intellect.value);
        intellectMod.avg += levelStats.intellect.value / 8;
        spiritMod.min = Math.min(spiritMod.min, levelStats.spirit.value);
        spiritMod.max = Math.max(spiritMod.max, levelStats.spirit.value);
        spiritMod.avg += levelStats.spirit.value / 8;
    }

    strength.min = strength.avg;
    strength.max = strength.avg;
    agility.min = agility.avg;
    agility.max = agility.avg;
    stamina.min = stamina.avg;
    stamina.max = stamina.avg;
    intellect.min = intellect.avg;
    intellect.max = intellect.avg;
    spirit.min = spirit.avg;
    spirit.max = spirit.avg;

    for (; level <= 99; level++) {

        levelStats = this.getStats(level);

        exp = levelStats.exp.value;
        minHP = Math.min(minHP + levelStats.hp.value, 9999);
        maxHP = Math.min(maxHP + levelStats.hpMax.value, 9999);
        minMP = Math.min(minMP + levelStats.mp.value, 9999);
        maxMP = Math.min(maxMP + levelStats.mpMax.value, 999);

        strength.min = Math.max(0, Math.min(strength.min + strengthMod.min, 99));
        strength.max = Math.max(0, Math.min(strength.max + strengthMod.max, 99));
        strength.avg = Math.max(0, Math.min(strength.avg + strengthMod.avg, 99));
        agility.min = Math.max(0, Math.min(agility.min + agilityMod.min, 99));
        agility.max = Math.max(0, Math.min(agility.max + agilityMod.max, 99));
        agility.avg = Math.max(0, Math.min(agility.avg + agilityMod.avg, 99));
        stamina.min = Math.max(0, Math.min(stamina.min + staminaMod.min, 99));
        stamina.max = Math.max(0, Math.min(stamina.max + staminaMod.max, 99));
        stamina.avg = Math.max(0, Math.min(stamina.avg + staminaMod.avg, 99));
        intellect.min = Math.max(0, Math.min(intellect.min + intellectMod.min, 99));
        intellect.max = Math.max(0, Math.min(intellect.max + intellectMod.max, 99));
        intellect.avg = Math.max(0, Math.min(intellect.avg + intellectMod.avg, 99));
        spirit.min = Math.max(0, Math.min(spirit.min + spiritMod.min, 99));
        spirit.max = Math.max(0, Math.min(spirit.max + spiritMod.max, 99));
        spirit.avg = Math.max(0, Math.min(spirit.avg + spiritMod.avg, 99));

        this.chartData.push({
            level: level,
            exp: {avg: exp},
            hp: {min: minHP, max: maxHP, avg: (minHP + maxHP) / 2},
            mp: {min: minMP, max: maxMP, avg: (minMP + maxMP) / 2},
            strength: {min: strength.min, max: strength.max, avg: strength.avg},
            agility: {min: agility.min, max: agility.max, avg: agility.avg},
            stamina: {min: stamina.min, max: stamina.max, avg: stamina.avg},
            intellect: {min: intellect.min, max: intellect.max, avg: intellect.avg},
            spirit: {min: spirit.min, max: spirit.max, avg: spirit.avg},
            object: levelStats
        });
    }

    this.resize();
    this.drawChart();
}

FF4LevelProgression.prototype.drawChart = function() {

    this.resize();

    var ctx = this.canvas.getContext('2d');
    ctx.textBaseline = 'middle';

    // draw the chart area
    ctx.fillStyle = "white";
    ctx.fillRect(this.chartRect.l, this.chartRect.t, this.chartRect.w, this.chartRect.h);

    // draw the axes
    ctx.beginPath();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1.0;
    ctx.moveTo(this.chartRect.l - 0.5, this.chartRect.t - 0.5);
    ctx.lineTo(this.chartRect.l - 0.5, this.chartRect.b + 0.5);
    ctx.lineTo(this.chartRect.r + 0.5, this.chartRect.b + 0.5);
    ctx.lineTo(this.chartRect.r + 0.5, this.chartRect.t - 0.5);
    ctx.closePath();
    ctx.stroke();

    // draw gridlines and labels
    ctx.textAlign = 'center';
    ctx.font = '12px sans-serif';
    ctx.lineWidth = 0.5;
    for (var x = 0; x <= 100; x += 10) {
        // vertical gridlines
        var startPoint = this.pointToCanvas(x, 0);
        var endPoint = this.pointToCanvas(x, 100);
        ctx.fillStyle = "black";
        ctx.fillText(x.toString(), startPoint.x, startPoint.y + 20);
        if (x === 0 || x === 100) continue;
        ctx.strokeStyle = "gray";
        ctx.beginPath();
        ctx.moveTo(startPoint.x + 0.5, startPoint.y);
        ctx.lineTo(endPoint.x + 0.5, endPoint.y);
        ctx.stroke();
    }
    var labelPoint = this.pointToCanvas(50, 0);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = "black";
    ctx.fillText("Level", labelPoint.x, labelPoint.y + 45);

    ctx.textAlign = 'right';
    ctx.font = '12px sans-serif';
    for (var y = 0; y <= 100; y += 10) {
        // horizontal gridlines
        var startPoint = this.pointToCanvas(0, y);
        var endPoint = this.pointToCanvas(100, y);
        ctx.fillStyle = "black";
        ctx.fillText(y.toString(), startPoint.x - 20, startPoint.y);
        if (y === 0 || y === 100) continue;
        ctx.strokeStyle = "gray";
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y + 0.5);
        ctx.lineTo(endPoint.x, endPoint.y + 0.5);
        ctx.stroke();
    }

    // draw stats
    for (var s = 0; s < 8; s++) {
        if (!this.showStat[s]) continue;
        this.drawStat(s, ctx);
        if (this.showRange) this.drawStatRange(s, ctx);
    }

    // draw legend
    if (this.showLegend) {
        this.drawLegend(ctx);
    }
}

FF4LevelProgression.prototype.drawStatRange = function(stat, ctx) {
    // draw the data
    var statProperties = this.statProperties(stat);
    var startPoint = this.pointToCanvas(this.chartData[0].level, this.chartData[0][statProperties.key].min / statProperties.multiplier);

    ctx.fillStyle = statProperties.fillColor;
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y)

    for (var p = 1; p < this.chartData.length; p++) {
        var dataValue = this.chartData[p];
        var point = this.pointToCanvas(dataValue.level, dataValue[statProperties.key].min / statProperties.multiplier);
        ctx.lineTo(point.x, point.y);
    }
    for (p = this.chartData.length - 1; p >= 0 ; p--) {
        dataValue = this.chartData[p];
        point = this.pointToCanvas(dataValue.level, dataValue[statProperties.key].max / statProperties.multiplier);
        ctx.lineTo(point.x, point.y);
    }
    ctx.fill();
}

FF4LevelProgression.prototype.drawStat = function(stat, ctx) {
    // draw the data
    var statProperties = this.statProperties(stat);
    var startPoint = this.pointToCanvas(this.chartData[0].level, this.chartData[0][statProperties.key].avg / statProperties.multiplier);

    ctx.strokeStyle = statProperties.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y)

    for (var p = 1; p < this.chartData.length; p++) {
        var dataValue = this.chartData[p];
        var point = this.pointToCanvas(dataValue.level, dataValue[statProperties.key].avg / statProperties.multiplier);
        ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();

    // draw the selected point
    if (this.selectedPoint) {
        point = this.pointToCanvas(this.selectedPoint.level, this.selectedPoint[statProperties.key].avg / statProperties.multiplier);
        ctx.beginPath();
        ctx.fillStyle = statProperties.color;
        ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        ctx.fill();
    }
}

FF4LevelProgression.prototype.drawLegend = function(ctx) {

    // find the widest stat
    var maxWidth = 0;
    var height = 10;
    var lineHeight = 15;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (var s = 0; s < 8; s++) {
        if (!this.showStat[s]) continue;
        var statProperties = this.statProperties(s);
        var name = statProperties.axis || statProperties.name;
        var size = ctx.measureText(name);
        maxWidth = Math.max(size.width + 15, maxWidth);
        height += lineHeight;
    }
    if (maxWidth === 0) return;

    var l = this.chartRect.l + 10;
    var t = this.chartRect.t + 10;
    var r = l + 20 + maxWidth;
    var b = t + height;

    var legendRect = new Rect(l, r, t, b);

    // draw the legend box
    ctx.fillStyle = "white";
    ctx.fillRect(legendRect.l, legendRect.t, legendRect.w, legendRect.h);

    ctx.beginPath();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1.0;
    ctx.moveTo(legendRect.l - 0.5, legendRect.t - 0.5);
    ctx.lineTo(legendRect.l - 0.5, legendRect.b + 0.5);
    ctx.lineTo(legendRect.r + 0.5, legendRect.b + 0.5);
    ctx.lineTo(legendRect.r + 0.5, legendRect.t - 0.5);
    ctx.closePath();
    ctx.stroke();

    // draw stat names and color blobs
    var x = l + 10;
    var y = t + 5;
    for (var s = 0; s < 8; s++) {
        if (!this.showStat[s]) continue;

        var statProperties = this.statProperties(s);
        ctx.fillStyle = statProperties.color;
        ctx.fillRect(x, y + 2, 9, 9);
        ctx.strokeStyle = "black";
        ctx.strokeRect(x - 0.5, y + 1.5, 10, 10);

        ctx.fillStyle = "black";
        var name = statProperties.axis || statProperties.name;
        ctx.fillText(name, x + 15, y);
        y += lineHeight;
    }
}

FF4LevelProgression.prototype.pointToCanvas = function(x, y) {
    return {
        x: x / 100 * this.chartRect.w + this.chartRect.l,
        y: (1 - y / 100) * this.chartRect.h + this.chartRect.t
    };
}

FF4LevelProgression.prototype.canvasToPoint = function(x, y) {
    if (!this.chartRect.containsPoint(x, y)) return null;
    return {
        x: Math.round((x - this.chartRect.l) / this.chartRect.w * 100),
        y: Math.round((1 - (y - this.chartRect.t) / this.chartRect.h) * 100)
    };
}
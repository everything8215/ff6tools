//
// ff4-level.js
// created 2/5/2020
//

class FF4LevelProgression extends ROMEditor_ {
    constructor(rom) {
        super(rom);

        this.name = 'FF4LevelProgression';

        this.div.classList.add('chart-edit');

        this.canvas = document.createElement('canvas');
        this.canvas.width = 256;
        this.canvas.height = 256;
        this.div.appendChild(this.canvas);

        this.tooltip = document.createElement('span');
        this.tooltip.setAttribute('data-balloon-pos', 'up');
        this.tooltip.style.position = 'absolute';
        this.div.appendChild(this.tooltip);

        this.showStat = [true, false, false, false, false, false, false, false];
        this.showRange = false;
        this.showLegend = true;

        this.c = 0;
        this.characterStats = null;
        this.levelProgData = null;
        this.selectedPoint = null;
        this.mousePoint = null;

        this.updateStats = this.rom.isSFC ? this.updateStatsSFC : this.updateStatsGBA;

        const self = this;
        this.div.onmousedown = function(e) { self.mouseDown(e); };
        this.div.onmouseleave = function(e) { self.mouseLeave(e); };
        this.div.onmousemove = function(e) { self.mouseMove(e); };

        // create an extra observer to watch character starting levels
        this.levelObserver = new ROMObserver(this.rom, this);

        // saved levels for undo
        this.undoLevels = [];

        if (this.rom.isSFC) {

            const levelProgData = this.rom.characterLevelProgression;
            const levelProgPointers = this.rom.characterLevelPointer;

            for (const char of this.rom.characterStats.iterator()) {
                // start observing each character's starting level so we can update the level progression data
                this.levelObserver.startObserving(char.level, this.changeStartingLevelSFC, [char.i]);
                const level = char.level.value;
                const id = char.properties.value;
                const levelStats = levelProgData.item(char.i);
                if (!levelStats) continue;

                const pointer = levelProgPointers.item(id);
                let begin = pointer.value;
                begin += (level - 1) * 5;
                begin -= this.rom.unmapAddress(levelProgData.range.begin) & 0xFFFF;

                // set the range for the level stats and disassemble
                levelStats.range.begin = begin;
                levelStats.range.end = begin + (70 - level) * 5 + 8;
                levelStats.arrayLength = 70 - level;
                levelStats.disassemble(levelProgData.data);

                // create the high level random stats
                const lastLevelStats = levelStats.item(69 - level);
                lastLevelStats.addAssembly(FF4LevelProgression.highLevelStatsDefiniton);
                lastLevelStats.range.end += 8;
                lastLevelStats.disassemble(levelStats.data);
            }

            // observe characters added and removed from the party
            for (const charAdd of this.rom.characterPartyAdd.iterator()) {
                this.levelObserver.startObservingSub(charAdd, this.updateLevelProgPointers);
            }
            for (const charRemove of this.rom.characterPartyRemove.iterator()) {
                this.levelObserver.startObservingSub(charRemove, this.updateLevelProgPointers);
            }

        } else {
            // observe starting level and stats (GBA)
            for (const char of this.rom.characterProperties.iterator()) {
                this.levelObserver.startObserving([
                    char.level,
                    char.strength,
                    char.agility,
                    char.stamina,
                    char.intellect,
                    char.spirit
                ], this.changeStartingLevelGBA, [char.i]);
            }
        }
    }

    changeStartingLevelSFC(c) {

        const characterStats = this.rom.characterStats.item(c);
        const levelStats = this.rom.characterLevelProgression.item(c);
        const targetLength = 70 - characterStats.level.value;

        if (levelStats.arrayLength !== targetLength) {

            const undoLevels = this.undoLevels[c] || [];

            // add new elements if the starting level decreased
            while (levelStats.arrayLength < targetLength) {
                const newLevel = undoLevels.shift() || levelStats.blankAssembly();
                levelStats.array.unshift(newLevel);
                levelStats.updateArray();
            }

            // remove elements if the starting level increased
            while (levelStats.arrayLength > targetLength) {
                undoLevels.unshift(levelStats.array.shift());
                levelStats.updateArray();
            }
            levelStats.markAsDirty();
            levelStats.notifyObservers();

            this.undoLevels[c] = undoLevels;

            this.updateLevelProgPointers();
        }

        // redraw only if this character is selected
        if (characterStats === this.characterStats) this.updateStats();
    }

    updateLevelProgPointers() {

        // update character stats pointer table (SFC only)
        if (this.rom.isGBA) return;

        const characterStatsData = this.rom.characterStats;
        const levelProgData = this.rom.characterLevelProgression;

        // calculate pointers to each character's level progression data
        const pointers = [];
        let currentPointer = this.rom.unmapAddress(levelProgData.range.begin);
        for (const levelProg of this.rom.characterLevelProgression.iterator()) {
            pointers.push(currentPointer - (69 - levelProg.arrayLength) * 5);
            currentPointer += levelProg.assembledLength;
        }

        // determine which characters get saved to temporary slots
        const levelProgPointers = this.rom.characterLevelPointer;
        const charSlot = [0, 0, 0, 0, 0];
        let slot, l;
        for (const charRemove of this.rom.characterPartyRemove.iterator()) {
            const c = charRemove.i;

            const charAdd = this.rom.characterPartyAdd.item(c);
            if (!charAdd) break;
            if (charAdd.restore.value) {
                // restore a previous character
                slot = charAdd.slot.value;
                l = charSlot[slot || 0];
            } else {
                // new character
                l = charAdd.character.value;
            }

            const pointer = levelProgPointers.item(c);
            if (pointer) {
                pointer.value = pointers[l];
                pointer.markAsDirty();
            }

            if (!charRemove) break;
            slot = charRemove.slot.value;
            if ((slot & 0x80) === 0) {
                charSlot[slot] = l;
            }
        }
    }

    changeStartingLevelGBA(c) {
        // update stats in level progression data
        const characterStats = this.rom.characterProperties.item(c);
        const levelStats = this.rom.characterLevelProgression.item(c);
        const startingLevel = this.rom.characterStartingLevel.item(c);

        const level = characterStats.level.value;
        const targetLength = 100 - level;

        if (levelStats.arrayLength !== targetLength) {

            const undoLevels = this.undoLevels[c] || [];
            // add new elements if the starting level decreased
            while (levelStats.arrayLength < targetLength) {
                const newLevel = undoLevels.shift() || levelStats.blankAssembly();
                levelStats.array.unshift(newLevel);
                levelStats.updateArray();
            }

            // remove elements if the starting level increased
            while (levelStats.arrayLength > targetLength) {
                undoLevels.unshift(levelStats.array.shift());
                levelStats.updateArray();
            }
            levelStats.markAsDirty();
            levelStats.notifyObservers();

            this.undoLevels[c] = undoLevels;

            startingLevel.level.value = level;
            startingLevel.level.markAsDirty();
            startingLevel.level.notifyObservers();
            // const firstLevelStats = levelStats.item(0);
            // firstLevelStats.hp.setValue(0);
            // firstLevelStats.hpMax.setValue(0);
            // firstLevelStats.mp.setValue(0);
            // firstLevelStats.mpMax.setValue(0);
            // firstLevelStats.strength.setValue(characterProperties.strength.value);
            // firstLevelStats.agility.setValue(characterProperties.agility.value);
            // firstLevelStats.stamina.setValue(characterProperties.stamina.value);
            // firstLevelStats.intellect.setValue(characterProperties.intellect.value);
            // firstLevelStats.spirit.setValue(characterProperties.spirit.value);
        }

        // redraw only if this character is selected
        if (characterStats === this.characterStats) this.updateStats();
    }

    mouseDown(e) {
        this.closeList();
        if (!this.selectedPoint) return;
        propertyList.select(this.selectedPoint.object)
    }

    mouseLeave(e) {
        this.mousePoint = null;
        this.selectedPoint = null;
        this.redraw();
    }

    mouseMove(e) {
        this.mousePoint = this.canvasToPoint(e.offsetX, e.offsetY);
        this.redraw();
    }

    show() {
        this.showControls();
        this.closeList();
        this.resize();
        super.show();
    }

    hide() {
        super.hide();
        this.characterStats = null;
    }

    selectObject(object) {

        if (this.characterStats === object) return;

        this.tooltip.removeAttribute('data-balloon-visible');
        this.characterStats = object;
        this.c = object.i;
        this.levelProgData = this.rom.characterLevelProgression.item(this.c);
        this.selectedPoint = null;
        this.mousePoint = null;
        this.loadCharacter();
    }

    resetControls() {
        super.resetControls();

        const self = this;
        function statFunction(s) {
            return function(checked) {
                self.showStat[s] = checked;
                self.redraw();
            }
        }

        for (const [s, stat] of FF4LevelProgression.stats.entries()) {
            const name = this.rom.isGBA ? stat.nameGBA : stat.name;
            this.addTwoState(`show${name}`, statFunction(s), name, this.showStat[s]);
        }
        this.addTwoState('showRange', function(checked) {
            self.showRange = checked;
            self.redraw();
        }, 'Min/Max', this.showRange);
        this.addTwoState('showLegend', function(checked) {
            self.showLegend = checked;
            self.redraw();
        }, 'Legend', this.showLegend);
    }

    loadCharacter() {

        this.resetControls();

        this.observer.stopObservingAll();

        if (!this.characterStats) return;
        if (!this.levelProgData) return;

        // update stats and redraw if stats change
        this.observer.startObservingSub(this.characterStats, this.updateStats);
        for (const level of this.levelProgData.iterator()) {
            this.observer.startObservingSub(level, this.updateStats);
            if (level.highLevelStats) {
                for (const highLevel of level.highLevelStats.iterator()) {
                    this.observer.startObservingSub(highLevel, this.updateStats);
                }
            }
        }
        this.updateStats();
    }

    getStatsSFC(level) {
        const startingLevel = this.characterStats.level.value;
        level = Math.min(level - startingLevel - 1, this.levelProgData.arrayLength - 1);
        return this.levelProgData.item(level);
    }

    updateStatsSFC() {

        let currentStats = {
            object: this.characterStats,
            level: this.characterStats.level.value
        };

        // get initial stats
        for (const stat of FF4LevelProgression.stats) {
            let value = 0;
            if (stat.key === 'exp') {
                value = this.characterStats.expLastLevel.value;
            } else {
                value = this.characterStats[stat.key].value;
            }
            currentStats[stat.key] = {
                min: value,
                max: value,
                avg: value
            }
        }
        this.chartData = [];
        this.chartData.push(currentStats);

        // get stats for levels 2 through 69
        while (currentStats.level < 70) {
            const previousStats = currentStats;
            currentStats = {
                level: previousStats.level + 1
            };

            const levelStats = this.getStatsSFC(currentStats.level);
            currentStats.object = levelStats;

            for (const stat of FF4LevelProgression.stats) {

                // copy the previous stat value
                const value = {};
                Object.assign(value, previousStats[stat.key]);

                if (stat.key === 'exp') {
                    value.min += levelStats.exp.value;
                    value.max += levelStats.exp.value;
                    value.avg += levelStats.exp.value;
                } else if (stat.key === 'hp' || stat.key === 'mp') {
                    value.min += levelStats[stat.key].value;
                    value.max += Math.floor(levelStats[stat.key].value * 9 / 8);
                    value.avg += Math.floor(levelStats[stat.key].value * 17 / 8) / 2;
                } else {
                    let mod = levelStats.statMod.value;
                    if (mod === 7) mod = -1;
                    if (levelStats.stats.value & stat.mask) {
                        // stat bonus
                        value.min += mod;
                        value.max += mod;
                        value.avg += mod;
                    }
                }

                value.min = Math.max(Math.min(value.min, stat.max), 0);
                value.max = Math.max(Math.min(value.max, stat.max), 0);
                value.avg = Math.max(Math.min(value.avg, stat.max), 0);
                currentStats[stat.key] = value;
            }
            this.chartData.push(currentStats);
        }

        // calculate stats for levels 70-99
        const levelStats = this.getStatsSFC(70);
        const statMod = {};
        for (const stat of FF4LevelProgression.stats) {
            statMod[stat.key] = {};
            if (stat.key === 'exp') {
                statMod[stat.key].min = levelStats[stat.key].value;
                statMod[stat.key].max = levelStats[stat.key].value;
                statMod[stat.key].avg = levelStats[stat.key].value;
            } else if (stat.key === 'hp' || stat.key === 'mp') {
                statMod[stat.key].min = levelStats[stat.key].value;
                statMod[stat.key].max = Math.floor(levelStats[stat.key].value * 9 / 8);
                statMod[stat.key].avg = Math.floor(levelStats[stat.key].value * 17 / 8) / 2;
            } else {
                statMod[stat.key].min = 0;
                statMod[stat.key].max = 0;
                statMod[stat.key].avg = 0;
                for (const randomStats of levelStats.highLevelStats.iterator()) {
                    let mod = randomStats.statMod.value;
                    if (mod === 7) mod = -1;
                    if (randomStats.stats.value & stat.mask) {
                        statMod[stat.key].min = Math.min(statMod[stat.key].min, mod);
                        statMod[stat.key].max = Math.max(statMod[stat.key].max, mod);
                        statMod[stat.key].avg += mod / 8;
                    }
                }
            }
        }

        while (currentStats.level < 99) {
            const previousStats = currentStats;
            currentStats = {
                level: previousStats.level + 1
            };

            currentStats.object = levelStats;

            for (const stat of FF4LevelProgression.stats) {

                // copy the previous stat value
                const value = {};
                Object.assign(value, previousStats[stat.key]);

                value.min += statMod[stat.key].min;
                value.max += statMod[stat.key].max;
                value.avg += statMod[stat.key].avg;

                value.min = Math.max(Math.min(value.min, stat.max), 0);
                value.max = Math.max(Math.min(value.max, stat.max), 0);
                value.avg = Math.max(Math.min(value.avg, stat.max), 0);
                currentStats[stat.key] = value;
            }
            this.chartData.push(currentStats);
        }

        this.redraw();
    }

    getStatsGBA(level) {
        const startingLevel = this.characterStats.level.value;
        level = Math.min(level - startingLevel, this.levelProgData.arrayLength - 1);
        return this.levelProgData.item(level);
    }

    updateStatsGBA() {

        let currentStats = {
            object: this.characterStats,
            level: this.characterStats.level.value
        };

        // get initial stats
        let levelStats = this.getStatsGBA(currentStats.level);
        for (const stat of FF4LevelProgression.stats) {
            let value = 0;
            if (stat.key === 'exp') {
                value = levelStats.exp.value;
            } else {
                value = this.characterStats[stat.keyGBA].value;
            }
            currentStats[stat.key] = {
                min: value,
                max: value,
                avg: value
            }
        }
        this.chartData = [];
        this.chartData.push(currentStats);

        // get stats for levels 2 through 69
        while (currentStats.level < 70) {
            const previousStats = currentStats;
            currentStats = {
                level: previousStats.level + 1
            };

            const levelStats = this.getStatsGBA(currentStats.level);
            currentStats.object = levelStats;

            for (const stat of FF4LevelProgression.stats) {

                // copy the previous stat value
                const value = {};
                Object.assign(value, previousStats[stat.key]);

                if (stat.key === 'exp') {
                    value.min = levelStats.exp.value;
                    value.max = levelStats.exp.value;
                    value.avg = levelStats.exp.value;
                } else if (stat.key === 'hp' || stat.key === 'mp') {
                    const minMod = levelStats[stat.key].value;
                    const maxMod = levelStats[`${stat.key}Max`].value;
                    value.min += minMod;
                    value.max += maxMod;
                    value.avg += (minMod + maxMod) / 2;
                } else {
                    value.min = levelStats[stat.keyGBA].value;
                    value.max = levelStats[stat.keyGBA].value;
                    value.avg = levelStats[stat.keyGBA].value;
                }

                value.min = Math.max(Math.min(value.min, stat.max), 0);
                value.max = Math.max(Math.min(value.max, stat.max), 0);
                value.avg = Math.max(Math.min(value.avg, stat.max), 0);
                currentStats[stat.key] = value;
            }
            this.chartData.push(currentStats);
        }

        // calculate stats for levels 70-99
        const statMod = {};
        for (const stat of FF4LevelProgression.stats) {
            if (stat.key === 'exp' || stat.key === 'hp' || stat.key === 'mp') {
                continue;
            }
            statMod[stat.key] = {};
            statMod[stat.key].min = 0;
            statMod[stat.key].max = 0;
            statMod[stat.key].avg = 0;
            for (let s = 0; s < 8; s++) {
                const levelStats = this.getStatsGBA(71 + s);
                let mod = levelStats[stat.keyGBA].value;
                statMod[stat.key].min = Math.min(statMod[stat.key].min, mod);
                statMod[stat.key].max = Math.max(statMod[stat.key].max, mod);
                statMod[stat.key].avg += mod / 8;
            }
        }

        while (currentStats.level < 99) {
            const previousStats = currentStats;
            currentStats = {
                level: previousStats.level + 1
            };

            const levelStats = this.getStatsGBA(currentStats.level);
            currentStats.object = levelStats;

            for (const stat of FF4LevelProgression.stats) {

                // copy the previous stat value
                const value = {};
                Object.assign(value, previousStats[stat.key]);

                if (stat.key === 'exp') {
                    value.min = levelStats.exp.value;
                    value.max = levelStats.exp.value;
                    value.avg = levelStats.exp.value;
                } else if (stat.key === 'hp' || stat.key === 'mp') {
                    const minMod = levelStats[stat.key].value;
                    const maxMod = levelStats[`${stat.key}Max`].value;
                    value.min += minMod;
                    value.max += maxMod;
                    value.avg += (minMod + maxMod) / 2;
                } else {
                    value.min += statMod[stat.key].min;
                    value.max += statMod[stat.key].max;
                    value.avg += statMod[stat.key].avg;
                }

                value.min = Math.max(Math.min(value.min, stat.max), 0);
                value.max = Math.max(Math.min(value.max, stat.max), 0);
                value.avg = Math.max(Math.min(value.avg, stat.max), 0);
                currentStats[stat.key] = value;
            }
            this.chartData.push(currentStats);
        }

        this.redraw();
    }

    resize() {
        if (!this.div.parentElement) return;
        const parentElement = this.div.parentElement;
        parentElement.style.overflow = 'hidden';
        this.div.style.width = `${Math.floor(parentElement.clientWidth)}px`;
        this.div.style.height = `${Math.floor(parentElement.clientHeight)}px`;
        parentElement.style.overflow = '';

        const l = 50;
        const r = this.div.clientWidth - 20;
        const t = 20;
        const b = this.div.clientHeight - 60;
        this.chartRect = new Rect(l, r, t, b);
    }

    redraw() {

        // update the selected point
        if (!this.mousePoint) {
            // mouse point not valid
            this.selectedPoint = null;

        } else if (this.mousePoint.x < this.chartData[0].level) {
            // mouse is to the left of starting level
            this.selectedPoint = this.chartData[0];

        } else {
            // get closest level
            this.selectedPoint = null;
            for (const dataPoint of this.chartData) {
                if (dataPoint.level !== this.mousePoint.x) continue;
                this.selectedPoint = dataPoint;
                break;
            }
        }

        // update the canvas size
        this.canvas.width = this.div.clientWidth;
        this.canvas.height = this.div.clientHeight;
        const ctx = this.canvas.getContext('2d');

        // draw the chart
        this.drawChart(ctx);

        // update the tooltip
        this.updateTooltip();

        // draw stat ranges
        if (this.showRange) {
            for (const [s, stat] of FF4LevelProgression.stats.entries()) {
                if (this.showStat[s]) this.drawStatRange(stat, ctx);
            }
        }

        // draw stats
        for (const [s, stat] of FF4LevelProgression.stats.entries()) {
            if (this.showStat[s]) this.drawStat(stat, ctx);
        }

        // draw legend
        if (this.showLegend) {
            this.drawLegend(ctx);
        }
    }

    drawChart(ctx) {
        // draw the chart area
        ctx.fillStyle = 'white';
        ctx.fillRect(this.chartRect.l, this.chartRect.t, this.chartRect.w, this.chartRect.h);

        // draw the axes
        ctx.beginPath();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1.0;
        ctx.moveTo(this.chartRect.l - 0.5, this.chartRect.t - 0.5);
        ctx.lineTo(this.chartRect.l - 0.5, this.chartRect.b + 0.5);
        ctx.lineTo(this.chartRect.r + 0.5, this.chartRect.b + 0.5);
        ctx.lineTo(this.chartRect.r + 0.5, this.chartRect.t - 0.5);
        ctx.closePath();
        ctx.stroke();

        // draw gridlines and labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '12px sans-serif';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= 100; x += 10) {
            // vertical gridlines
            const startPoint = this.pointToCanvas(x, 0);
            const endPoint = this.pointToCanvas(x, 100);
            ctx.fillStyle = 'black';
            ctx.fillText(x.toString(), startPoint.x, startPoint.y + 20);
            if (x === 0 || x === 100) continue;
            ctx.strokeStyle = 'gray';
            ctx.beginPath();
            ctx.moveTo(startPoint.x + 0.5, startPoint.y);
            ctx.lineTo(endPoint.x + 0.5, endPoint.y);
            ctx.stroke();
        }
        const labelPoint = this.pointToCanvas(50, 0);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = 'black';
        ctx.fillText('Level', labelPoint.x, labelPoint.y + 45);

        ctx.textAlign = 'right';
        ctx.font = '12px sans-serif';
        for (let y = 0; y <= 100; y += 10) {
            // horizontal gridlines
            const startPoint = this.pointToCanvas(0, y);
            const endPoint = this.pointToCanvas(100, y);
            ctx.fillStyle = 'black';
            ctx.fillText(y.toString(), startPoint.x - 20, startPoint.y);
            if (y === 0 || y === 100) continue;
            ctx.strokeStyle = 'gray';
            ctx.beginPath();
            ctx.moveTo(startPoint.x, startPoint.y + 0.5);
            ctx.lineTo(endPoint.x, endPoint.y + 0.5);
            ctx.stroke();
        }
    }

    drawStatRange(stat, ctx) {
        // draw the data
        const y = this.chartData[0][stat.key].min / stat.multiplier;
        const startPoint = this.pointToCanvas(this.chartData[0].level, y);

        ctx.fillStyle = stat.fillColor;
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y)

        for (const dataValue of this.chartData.slice(1)) {
            const y = dataValue[stat.key].min / stat.multiplier;
            const point = this.pointToCanvas(dataValue.level, y);
            ctx.lineTo(point.x, point.y);
        }
        for (const dataValue of this.chartData.slice().reverse()) {
            const y = dataValue[stat.key].max / stat.multiplier;
            const point = this.pointToCanvas(dataValue.level, y);
            ctx.lineTo(point.x, point.y);
        }
        ctx.fill();
    }

    drawStat(stat, ctx) {
        // draw the data
        const y = this.chartData[0][stat.key].avg / stat.multiplier;
        const startPoint = this.pointToCanvas(this.chartData[0].level, y);

        ctx.strokeStyle = stat.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y)

        for (const dataValue of this.chartData) {
            const y = dataValue[stat.key].avg / stat.multiplier;
            const point = this.pointToCanvas(dataValue.level, y);
            ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();

        // draw the selected point
        if (this.selectedPoint) {
            const y = this.selectedPoint[stat.key].avg / stat.multiplier;
            const point = this.pointToCanvas(this.selectedPoint.level, y);
            ctx.beginPath();
            ctx.fillStyle = stat.color;
            ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    drawLegend(ctx) {

        // find the legend height and widest stat
        let width = 0;
        let height = 10;
        const lineHeight = 15;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        for (const [s, stat] of FF4LevelProgression.stats.entries()) {
            if (!this.showStat[s]) continue;
            const name = stat.axis || stat.name;
            const size = ctx.measureText(name);
            width = Math.max(Math.round(size.width) + 15, width);
            height += lineHeight;
        }
        if (width === 0) return;

        // calculate the legend rectangle
        const l = this.chartRect.l + 10;
        const t = this.chartRect.t + 10;
        const r = l + width + 20;
        const b = t + height;
        const rect = new Rect(l, r, t, b);

        // draw the legend box
        ctx.fillStyle = 'white';
        ctx.fillRect(rect.l, rect.t, rect.w, rect.h);

        // ctx.beginPath();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1.0;
        ctx.strokeRect(rect.l - 0.5, rect.t - 0.5, rect.w + 1, rect.h + 1);

        // draw stat names and color blobs
        let x = l + 8;
        let y = t + 8;
        for (const [s, stat] of FF4LevelProgression.stats.entries()) {
            if (!this.showStat[s]) continue;

            ctx.fillStyle = stat.color;
            ctx.fillRect(x, y, 9, 9);
            ctx.strokeStyle = 'black';
            ctx.strokeRect(x - 0.5, y - 0.5, 10, 10);

            ctx.fillStyle = 'black';
            const name = stat.axis || stat.name;
            ctx.fillText(name, x + 15, y + 9);
            y += lineHeight;
        }
    }

    updateTooltip() {

        this.tooltip.removeAttribute('data-balloon-visible');
        if (!this.selectedPoint) return;

        // generate the tooltip string
        const level = this.selectedPoint.level;
        let statLabel = `Level: ${level}`;

        // find the closest stat
        let closestValue;
        for (const [s, stat] of FF4LevelProgression.stats.entries()) {
            if (!this.showStat[s]) continue;

            const avgValue = Math.round(this.selectedPoint[stat.key].avg);
            const minValue = this.selectedPoint[stat.key].min;
            const maxValue = this.selectedPoint[stat.key].max;

            // add a comma separate to numbers larger than 10000
            const name = this.rom.isGBA ? stat.nameGBA : stat.name;
            if (avgValue >= 10000) {
                statLabel += `\n${name}: ${addCommaSep(avgValue)}`;
            } else {
                statLabel += `\n${name}: ${avgValue}`;
            }

            // show stat range
            if (minValue !== maxValue) {
                statLabel += ` (${minValue}–${maxValue})`;
            }

            // check if this is the closest value
            const oldDistance = Math.abs(closestValue - this.mousePoint.y);
            const newDistance = Math.abs(avgValue / stat.multiplier - this.mousePoint.y);
            if (closestValue === undefined || newDistance < oldDistance) {
                closestValue = avgValue / stat.multiplier;
            }
        }

        // show the tooltip
        this.tooltip.setAttribute('aria-label', statLabel);
        const statPoint = this.pointToCanvas(level, closestValue);
        this.tooltip.style.display = 'inline-block';
        this.tooltip.setAttribute('data-balloon-visible', '');
        if (closestValue > 70 && level > 80) {
            statPoint.x += 17;
            statPoint.y += 15;
            this.tooltip.setAttribute('data-balloon-pos', 'down-right');
        } else if (closestValue > 70) {
            statPoint.y += 15;
            this.tooltip.setAttribute('data-balloon-pos', 'down');
        } else if (closestValue < 10 && level > 80) {
            statPoint.x += 17;
            statPoint.y -= this.tooltip.clientHeight + 15;
            this.tooltip.setAttribute('data-balloon-pos', 'up-right');
        } else if (level > 80) {
            statPoint.x -= 15;
            statPoint.y -= this.tooltip.clientHeight;
            this.tooltip.setAttribute('data-balloon-pos', 'left');
        } else {
            statPoint.y -= this.tooltip.clientHeight + 15;
            this.tooltip.setAttribute('data-balloon-pos', 'up');
        }
        this.tooltip.style.left = `${statPoint.x}px`;
        this.tooltip.style.top = `${statPoint.y}px`;
    }

    pointToCanvas(x, y) {
        return {
            x: x / 100 * this.chartRect.w + this.chartRect.l,
            y: (1 - y / 100) * this.chartRect.h + this.chartRect.t
        };
    }

    canvasToPoint(x, y) {
        if (!this.chartRect.containsPoint(x, y)) return null;
        return {
            x: Math.round((x - this.chartRect.l) / this.chartRect.w * 100),
            y: Math.round((1 - (y - this.chartRect.t) / this.chartRect.h) * 100)
        };
    }
}

FF4LevelProgression.stats = [
    {
        name: 'Experience',
        nameGBA: 'Experience',
        axis: 'Experience (×100,000)',
        key: 'exp',
        keyGBA: 'exp',
        color: 'hsla(0, 0%, 0%, 1.0)',
        fillColor: 'hsla(0, 0%, 0%, 0.25)',
        multiplier: 100000,
        max: 9999999
    }, {
        name: 'HP',
        nameGBA: 'HP',
        axis: 'HP (×100)',
        key: 'hp',
        keyGBA: 'hp',
        color: 'hsla(100, 100%, 30%, 1.0)',
        fillColor: 'hsla(100, 100%, 30%, 0.25)',
        multiplier: 100,
        max: 9999
    }, {
        name: 'MP',
        nameGBA: 'MP',
        axis: 'MP (×10)',
        key: 'mp',
        keyGBA: 'mp',
        color: 'hsla(220, 100%, 35%, 1.0)',
        fillColor: 'hsla(220, 100%, 60%, 0.25)',
        multiplier: 10,
        max: 999
    }, {
        name: 'Strength',
        nameGBA: 'Strength',
        key: 'strength',
        keyGBA: 'strength',
        color: 'hsla(0, 100%, 40%, 1.0)',
        fillColor: 'hsla(0, 100%, 40%, 0.25)',
        multiplier: 1,
        max: 99,
        mask: '0x10'
    }, {
        name: 'Agility',
        nameGBA: 'Agility',
        key: 'agility',
        keyGBA: 'agility',
        color: 'hsla(50, 100%, 35%, 1.0)',
        fillColor: 'hsla(50, 100%, 35%, 0.25)',
        multiplier: 1,
        max: 99,
        mask: '0x08'
    }, {
        name: 'Vitality',
        key: 'vitality',
        nameGBA: 'Stamina',
        keyGBA: 'stamina',
        color: 'hsla(170, 100%, 35%, 1.0)',
        fillColor: 'hsla(170, 100%, 35%, 0.25)',
        multiplier: 1,
        max: 99,
        mask: '0x04'
    }, {
        name: 'Wisdom',
        key: 'wisdom',
        nameGBA: 'Intellect',
        keyGBA: 'intellect',
        color: 'hsla(270, 100%, 35%, 1.0)',
        fillColor: 'hsla(270, 100%, 35%, 0.25)',
        multiplier: 1,
        max: 99,
        mask: '0x02'
    }, {
        name: 'Will',
        key: 'will',
        nameGBA: 'Spirit',
        keyGBA: 'spirit',
        color: 'hsla(320, 100%, 35%, 1.0)',
        fillColor: 'hsla(320, 100%, 35%, 0.25)',
        multiplier: 1,
        max: 99,
        mask: '0x01'
    }
]

FF4LevelProgression.highLevelStatsDefiniton = {
    key: 'highLevelStats',
    name: 'Random Stats for Level 71-99',
    type: 'array',
    range: '5-13',
    array: {
        length: 8,
        min: 8,
        max: 8
    },
    assembly: {
        type: 'data',
        length: 1,
        assembly: {
            statMod: {
                type: 'property',
                name: 'Stat Mod.',
                begin: 0,
                mask: '0x07',
                stringTable: {
                    hideIndex: true,
                    string: {
                        '0': '0',
                        '1': '+1',
                        '2': '+2',
                        '3': '+3',
                        '4': '+4',
                        '5': '+5',
                        '6': '+6',
                        '7': '-1'
                    }
                }
            },
            stats: {
                type: 'property',
                name: 'Stats',
                begin: 0,
                mask: '0xF8',
                flag: true,
                stringTable: {
                    string: {
                        '4': 'Strength',
                        '3': 'Agility',
                        '2': 'Vitality',
                        '1': 'Wisdom',
                        '0': 'Will'
                    }
                }
            }
        }
    }
}

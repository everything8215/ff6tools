//
// ff1-level.js
// created 5/19/2020
//

class FF1LevelProgression extends ROMEditor_ {
    constructor(rom) {
        super(rom);

        this.name = 'FF1LevelProgression';

        this.div = document.createElement('div');
        this.div.id = 'chart-edit';

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
        this.selectedPoint = null;
        this.classProperties = null;
        this.classStats = null;
        this.observer = new ROMObserver(rom, this);

        const self = this;
        this.div.onmousedown = function(e) { self.mouseDown(e); };
        this.div.onmouseleave = function(e) { self.mouseLeave(e); };
        this.div.onmousemove = function(e) { self.mouseMove(e); };
        this.resizeSensor = null;
    }

    mouseDown(e) {
        this.closeList();
        if (!this.selectedPoint) return;
        propertyList.select(this.selectedPoint.object)
    }

    mouseLeave(e) {
        this.selectedPoint = null;
        this.drawChart();
        this.tooltip.removeAttribute('data-balloon-visible');
    }

    mouseMove(e) {

        this.selectedPoint = null;
        const mousePoint = this.canvasToPoint(e.offsetX, e.offsetY);
        if (!mousePoint) {
            this.drawChart();
            this.tooltip.removeAttribute('data-balloon-visible');
            return;
        }

        if (mousePoint.x < this.chartData[0].level) {
            this.selectedPoint = this.chartData[0];
        } else {
            for (const dataPoint of this.chartData) {
                if (dataPoint.level !== mousePoint.x) continue;
                this.selectedPoint = dataPoint;
                break;
            }
        }

        if (!this.selectedPoint) return;

        this.drawChart();

        // generate the tooltip string
        const level = this.selectedPoint.level;
        let statLabel = `Level: ${level}`;

        // it would be cool to make the selected stat bold, but unfortunately
        // the text for tooltips is set via the css content property, and
        // css can't contain html markup

        // find the closest stat
        let closestValue;
        for (const [s, stat] of FF1LevelProgression.stats.entries()) {
            if (!this.showStat[s]) continue;

            const avgValue = Math.round(this.selectedPoint[stat.key].avg);
            const minValue = this.selectedPoint[stat.key].min;
            const maxValue = this.selectedPoint[stat.key].max;

            // add a comma separate to numbers larger than 10000
            if (avgValue >= 10000) {
                statLabel += `\n${stat.name}: ${addCommaSep(avgValue)}`;
            } else {
                statLabel += `\n${stat.name}: ${avgValue}`;
            }

            // show stat range
            if (minValue !== maxValue) {
                statLabel += ` (${minValue}–${maxValue})`;
            }

            // check if this is the closest value
            const oldDistance = Math.abs(closestValue - mousePoint.y);
            const newDistance = Math.abs(avgValue / stat.multiplier - mousePoint.y);
            if (closestValue === undefined || newDistance < oldDistance) {
                closestValue = avgValue / stat.multiplier;
            }
        }

        // add mp
        statLabel += '\nMP: ';
        for (let l = 0; l < 8; l++) {
            statLabel += this.selectedPoint.mp[l];
            if (l !== 7) statLabel += '/';
        }

        // show the tooltip
        this.tooltip.setAttribute('aria-label', statLabel);
        const statPoint = this.pointToCanvas(level, closestValue);
        this.tooltip.style.display = 'inline-block';
        this.tooltip.setAttribute('data-balloon-visible', '');
        if (closestValue > 70 && level > 40) {
            statPoint.x += 17;
            statPoint.y += 15;
            this.tooltip.setAttribute('data-balloon-pos', 'down-right');
        } else if (closestValue > 70) {
            statPoint.y += 15;
            this.tooltip.setAttribute('data-balloon-pos', 'down');
        } else if (closestValue < 10 && level > 40) {
            statPoint.x += 17;
            statPoint.y -= this.tooltip.clientHeight + 15;
            this.tooltip.setAttribute('data-balloon-pos', 'up-right');
        } else if (level > 40) {
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

    show() {
        this.showControls();
        this.closeList();
        this.resize();

        const self = this;
        const editTop = document.getElementById('edit-top');
        if (!this.resizeSensor) {
            this.resizeSensor = new ResizeSensor(editTop, function() {
                self.resize();
                self.drawChart();
            });
        }
    }

    hide() {
        this.observer.stopObservingAll();
        if (this.resizeSensor) {
            const editTop = document.getElementById('edit-top');
            this.resizeSensor.detach(editTop);
            this.resizeSensor = null;
        }
    }

    selectObject(object) {

        if (this.classProperties === object) return;

        this.classProperties = object;
        this.c = object.i;
        this.classStats = this.rom.classStats.item(this.c);
        this.loadClass();
    }

    resetControls() {
        super.resetControls();

        const self = this;
        function statFunction(s) {
            return function(checked) {
                self.showStat[s] = checked;
                self.drawChart();
            }
        }

        for (const [s, stat] of FF1LevelProgression.stats.entries()) {
            this.addTwoState(`show${stat.name}`, statFunction(s), stat.name, this.showStat[s]);
        }

        this.addTwoState('showRange', function(checked) {
            self.showRange = checked;
            self.drawChart();
        }, 'Min/Max', this.showRange);

        this.addTwoState('showLegend', function(checked) {
            self.showLegend = checked;
            self.drawChart();
        }, 'Legend', this.showLegend);

    }

    loadClass(c) {
        this.resetControls();

        this.tooltip.removeAttribute('data-balloon-visible');
        this.observer.stopObservingAll();

        if (!this.classProperties) return;
        this.observer.startObserving([
            this.classProperties.hp,
            this.classProperties.strength,
            this.classProperties.agility,
            this.classProperties.vitality,
            this.classProperties.intelligence,
            this.classProperties.luck,
        ], this.updateStats);
        for (const level of this.classStats.iterator()) {
            this.observer.startObserving([
                level.exp, level.stats, level.mp
            ], this.updateStats);
        }
        this.selectedPoint = null;

        this.updateStats();
        this.drawChart();
    }

    getStats(level) {

        return this.classStats.item(level - 2);
    }

    updateStats() {

        let currentStats = {
            level: 1,
            object: this.classProperties
        };

        // get initial stats
        for (const stat of FF1LevelProgression.stats) {
            let value = 0;
            if (stat.key !== 'exp') {
                value = this.classProperties[stat.key].value;
            }
            currentStats[stat.key] = {
                min: value,
                max: value,
                avg: value
            }
        }
        const maxMP = (this.classProperties.i < 2) ? 4 : 9;
        currentStats.mp = [0,0,0,0,0,0,0,0];
        if (this.classProperties.i >= 3) currentStats.mp[0] = 2;

        this.chartData = [];
        this.chartData.push(currentStats);

        while (currentStats.level < 50) {
            const previousStats = currentStats;
            currentStats = {
                level: previousStats.level + 1
            };

            const levelStats = this.getStats(currentStats.level);
            currentStats.object = levelStats;

            for (const stat of FF1LevelProgression.stats) {

                // copy the previous stat value
                const value = {};
                Object.assign(value, previousStats[stat.key]);

                if (stat.key === 'exp') {
                    value.min = levelStats.exp.value;
                    value.max = levelStats.exp.value;
                    value.avg = levelStats.exp.value;
                } else if (stat.key === 'hp') {
                    const hpBonus = levelStats.stats.value & 0x20;
                    value.min += previousStats.vitality.min >> 2;
                    value.min += (hpBonus ? 20 : 0) + 1;
                    value.max += previousStats.vitality.max >> 2;
                    value.max += (hpBonus ? 25 : 0) + 1;
                    value.avg += previousStats.vitality.avg >> 2;
                    value.avg += (hpBonus ? 22.5 : 0) + 1;
                } else {
                    value.max += 1;
                    if (levelStats.stats.value & stat.mask) {
                        // stat bonus
                        value.min += 1;
                        value.avg += 1;
                    } else {
                        // no stat bonus
                        value.avg += 0.25;
                    }
                }

                value.min = Math.min(value.min, stat.max);
                value.max = Math.min(value.max, stat.max);
                value.avg = Math.min(value.avg, stat.max);
                currentStats[stat.key] = value;
            }
            const mp = previousStats.mp.slice();
            for (let l = 0; l < 8; l++) {
                if (mp[l] >= maxMP) continue;
                if (levelStats.mp.value & (1 << l)) mp[l]++;
            }
            currentStats.mp = mp;

            this.chartData.push(currentStats);
        }
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

    drawChart() {

        this.canvas.width = this.div.clientWidth;
        this.canvas.height = this.div.clientHeight;

        const context = this.canvas.getContext('2d');
        context.textBaseline = 'middle';

        // draw the chart area
        context.fillStyle = 'white';
        context.fillRect(this.chartRect.l, this.chartRect.t, this.chartRect.w, this.chartRect.h);

        // draw the axes
        context.beginPath();
        context.strokeStyle = 'black';
        context.lineWidth = 1.0;
        context.moveTo(this.chartRect.l - 0.5, this.chartRect.t - 0.5);
        context.lineTo(this.chartRect.l - 0.5, this.chartRect.b + 0.5);
        context.lineTo(this.chartRect.r + 0.5, this.chartRect.b + 0.5);
        context.lineTo(this.chartRect.r + 0.5, this.chartRect.t - 0.5);
        context.closePath();
        context.stroke();

        // draw gridlines and labels
        context.textAlign = 'center';
        context.font = '12px sans-serif';
        context.lineWidth = 0.5;
        for (let x = 0; x <= 50; x += 5) {
            // vertical gridlines
            const startPoint = this.pointToCanvas(x, 0);
            const endPoint = this.pointToCanvas(x, 100);
            context.fillStyle = 'black';
            context.fillText(x.toString(), startPoint.x, startPoint.y + 20);
            if (x === 0 || x === 50) continue;
            context.strokeStyle = 'gray';
            context.beginPath();
            context.moveTo(startPoint.x + 0.5, startPoint.y);
            context.lineTo(endPoint.x + 0.5, endPoint.y);
            context.stroke();
        }
        const labelPoint = this.pointToCanvas(25, 0);
        context.font = '16px sans-serif';
        context.fillStyle = 'black';
        context.fillText('Level', labelPoint.x, labelPoint.y + 45);

        context.textAlign = 'right';
        context.font = '12px sans-serif';
        for (let y = 0; y <= 100; y += 10) {
            // horizontal gridlines
            const startPoint = this.pointToCanvas(0, y);
            const endPoint = this.pointToCanvas(50, y);
            context.fillStyle = 'black';
            context.fillText(y.toString(), startPoint.x - 20, startPoint.y);
            if (y === 0 || y === 100) continue;
            context.strokeStyle = 'gray';
            context.beginPath();
            context.moveTo(startPoint.x, startPoint.y + 0.5);
            context.lineTo(endPoint.x, endPoint.y + 0.5);
            context.stroke();
        }

        // draw stats
        for (const [s, stat] of FF1LevelProgression.stats.entries()) {
            if (!this.showStat[s]) continue;
            this.drawStat(stat, context);
            if (this.showRange) this.drawStatRange(stat, context);
        }

        // draw legend
        if (this.showLegend) {
            this.drawLegend(context);
        }
    }

    drawStatRange(stat, context) {
        // draw the data
        const y = this.chartData[0][stat.key].min / stat.multiplier;
        const startPoint = this.pointToCanvas(this.chartData[0].level, y);

        context.fillStyle = stat.fillColor;
        context.beginPath();
        context.moveTo(startPoint.x, startPoint.y)

        for (const dataValue of this.chartData.slice(1)) {
            const y = dataValue[stat.key].min / stat.multiplier;
            const point = this.pointToCanvas(dataValue.level, y);
            context.lineTo(point.x, point.y);
        }
        for (const dataValue of this.chartData.slice().reverse()) {
            const y = dataValue[stat.key].max / stat.multiplier;
            const point = this.pointToCanvas(dataValue.level, y);
            context.lineTo(point.x, point.y);
        }
        context.fill();
    }

    drawStat(stat, context) {
        // draw the data
        const y = this.chartData[0][stat.key].avg / stat.multiplier;
        const startPoint = this.pointToCanvas(this.chartData[0].level, y);

        context.strokeStyle = stat.color;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.lineWidth = 2.5;
        context.beginPath();
        context.moveTo(startPoint.x, startPoint.y)

        for (const dataValue of this.chartData) {
            const y = dataValue[stat.key].avg / stat.multiplier;
            const point = this.pointToCanvas(dataValue.level, y);
            context.lineTo(point.x, point.y);
        }
        context.stroke();

        // draw the selected point
        if (this.selectedPoint) {
            const y = this.selectedPoint[stat.key].avg / stat.multiplier;
            const point = this.pointToCanvas(this.selectedPoint.level, y);
            context.beginPath();
            context.fillStyle = stat.color;
            context.arc(point.x, point.y, 5, 0, 2 * Math.PI);
            context.fill();
        }
    }

    drawLegend(context) {

        // find the legend height and widest stat
        let width = 0;
        let height = 10;
        const lineHeight = 15;
        context.font = '12px sans-serif';
        context.textAlign = 'left';
        context.textBaseline = 'alphabetic';
        for (const [s, stat] of FF1LevelProgression.stats.entries()) {
            if (!this.showStat[s]) continue;
            const name = stat.axis || stat.name;
            const size = context.measureText(name);
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
        context.fillStyle = 'white';
        context.fillRect(rect.l, rect.t, rect.w, rect.h);

        // context.beginPath();
        context.strokeStyle = 'black';
        context.lineWidth = 1.0;
        context.strokeRect(rect.l - 0.5, rect.t - 0.5, rect.w + 1, rect.h + 1);

        // draw stat names and color blobs
        let x = l + 8;
        let y = t + 8;
        for (const [s, stat] of FF1LevelProgression.stats.entries()) {
            if (!this.showStat[s]) continue;

            context.fillStyle = stat.color;
            context.fillRect(x, y, 9, 9);
            context.strokeStyle = 'black';
            context.strokeRect(x - 0.5, y - 0.5, 10, 10);

            context.fillStyle = 'black';
            const name = stat.axis || stat.name;
            context.fillText(name, x + 15, y + 9);
            y += lineHeight;
        }
    }

    pointToCanvas(x, y) {
        return {
            x: x / 50 * this.chartRect.w + this.chartRect.l,
            y: (1 - y / 100) * this.chartRect.h + this.chartRect.t
        };
    }

    canvasToPoint(x, y) {
        if (!this.chartRect.containsPoint(x, y)) return null;
        return {
            x: Math.round((x - this.chartRect.l) / this.chartRect.w * 50),
            y: Math.round((1 - (y - this.chartRect.t) / this.chartRect.h) * 100)
        };
    }
}

FF1LevelProgression.stats = [
    {
        name: 'Experience',
        axis: 'Experience (×10,000)',
        key: 'exp',
        color: 'hsla(0, 0%, 0%, 1.0)',
        fillColor: 'hsla(0, 0%, 0%, 0.25)',
        multiplier: 10000,
        max: 999999
    }, {
        name: 'HP',
        axis: 'HP (×10)',
        key: 'hp',
        color: 'hsla(100, 100%, 30%, 1.0)',
        fillColor: 'hsla(100, 100%, 30%, 0.25)',
        multiplier: 10,
        max: 999
    }, {
        name: 'Strength',
        key: 'strength',
        color: 'hsla(0, 100%, 40%, 1.0)',
        fillColor: 'hsla(0, 100%, 40%, 0.25)',
        multiplier: 1,
        max: 99,
        mask: 0x10
    }, {
        name: 'Agility',
        key: 'agility',
        color: 'hsla(50, 100%, 35%, 1.0)',
        fillColor: 'hsla(50, 100%, 35%, 0.25)',
        multiplier: 1,
        max: 99,
        mask: 0x08
    }, {
        name: 'Intelligence',
        key: 'intelligence',
        color: 'hsla(320, 100%, 35%, 1.0)',
        fillColor: 'hsla(320, 100%, 35%, 0.25)',
        multiplier: 1,
        max: 99,
        mask: 0x04
    }, {
        name: 'Vitality',
        key: 'vitality',
        color: 'hsla(170, 100%, 35%, 1.0)',
        fillColor: 'hsla(170, 100%, 35%, 0.25)',
        multiplier: 1,
        max: 99,
        mask: 0x02
    }, {
        name: 'Luck',
        key: 'luck',
        color: 'hsla(270, 100%, 35%, 1.0)',
        fillColor: 'hsla(270, 100%, 35%, 0.25)',
        multiplier: 1,
        max: 99,
        mask: 0x01
    }
];

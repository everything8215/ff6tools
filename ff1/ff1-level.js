//
// ff1-level.js
// created 5/19/2020
//

class FF1LevelProgression extends ROMEditor_ {
    constructor(rom) {
        super(rom);

        this.name = 'FF1LevelProgression';

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
        this.classProperties = null;
        this.classStats = null;
        this.selectedPoint = null;
        this.mousePoint = null;

        const self = this;
        this.div.onmousedown = function(e) { self.mouseDown(e); };
        this.div.onmouseleave = function(e) { self.mouseLeave(e); };
        this.div.onmousemove = function(e) { self.mouseMove(e); };
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
        this.classProperties = null;
    }

    selectObject(object) {

        if (this.classProperties === object) return;

        this.tooltip.removeAttribute('data-balloon-visible');
        this.classProperties = object;
        this.c = object.i;
        this.classStats = this.rom.classStats.item(this.c);
        this.selectedPoint = null;
        this.mousePoint = null;
        this.loadClass();
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
        for (const [s, stat] of FF1LevelProgression.stats.entries()) {
            this.addTwoState(`show${stat.name}`, statFunction(s), stat.name, this.showStat[s]);
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

    loadClass() {
        this.resetControls();

        this.observer.stopObservingAll();

        if (!this.classProperties) return;
        if (!this.classStats) return;

        // update stats and redraw if stats change
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

        this.updateStats();
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

            // update hp, mp, and stats
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

            // update mp
            const mp = previousStats.mp.slice();
            for (let l = 0; l < 8; l++) {
                if (mp[l] >= maxMP) continue;
                if (levelStats.mp.value & (1 << l)) mp[l]++;
            }
            currentStats.mp = mp;

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
            for (const [s, stat] of FF1LevelProgression.stats.entries()) {
                if (this.showStat[s]) this.drawStatRange(stat, ctx);
            }
        }

        // draw stats
        for (const [s, stat] of FF1LevelProgression.stats.entries()) {
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

        // draw vertical gridlines and labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '12px sans-serif';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= 50; x += 5) {
            const startPoint = this.pointToCanvas(x, 0);
            const endPoint = this.pointToCanvas(x, 100);
            ctx.fillStyle = 'black';
            ctx.fillText(x.toString(), startPoint.x, startPoint.y + 20);
            if (x === 0 || x === 50) continue;
            ctx.strokeStyle = 'gray';
            ctx.beginPath();
            ctx.moveTo(startPoint.x + 0.5, startPoint.y);
            ctx.lineTo(endPoint.x + 0.5, endPoint.y);
            ctx.stroke();
        }
        const labelPoint = this.pointToCanvas(25, 0);
        ctx.font = '16px sans-serif';
        ctx.fillStyle = 'black';
        ctx.fillText('Level', labelPoint.x, labelPoint.y + 45);

        // draw horizontal gridlines and labels
        ctx.textAlign = 'right';
        ctx.font = '12px sans-serif';
        for (let y = 0; y <= 100; y += 10) {
            const startPoint = this.pointToCanvas(0, y);
            const endPoint = this.pointToCanvas(50, y);
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
        for (const [s, stat] of FF1LevelProgression.stats.entries()) {
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
        for (const [s, stat] of FF1LevelProgression.stats.entries()) {
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
            const oldDistance = Math.abs(closestValue - this.mousePoint.y);
            const newDistance = Math.abs(avgValue / stat.multiplier - this.mousePoint.y);
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

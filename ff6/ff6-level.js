//
// ff6-level.js
// created 2/10/2020
//

class FF6LevelProgression extends ROMEditor {
    constructor(rom) {
        super(rom);

        this.name = 'FF6LevelProgression';

        this.div.classList.add('chart-edit');

        this.canvas = document.createElement('canvas');
        this.canvas.width = 256;
        this.canvas.height = 256;
        this.div.appendChild(this.canvas);

        this.tooltip = document.createElement('span');
        this.tooltip.setAttribute('data-balloon-pos', 'up');
        this.tooltip.style.position = 'absolute';
        this.div.appendChild(this.tooltip);

        this.showStat = [true, true, true];
        this.showLegend = true;

        this.c = 0;
        this.expProgression = this.rom.characterExpProgression;
        this.hpProgression = this.rom.characterHPProgression;
        this.mpProgression = this.rom.characterMPProgression;
        this.characterProperties = null;
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
        this.characterStats = null;
    }

    selectObject(object) {

        // level progression is a dummy object
        this.tooltip.removeAttribute('data-balloon-visible');
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

        for (const [s, stat] of FF6LevelProgression.stats.entries()) {
            this.addTwoState(`show${stat.name}`, statFunction(s), stat.name, this.showStat[s]);
        }

        // add a control to select a character
        const charNames = [];
        for (let i = 0; i < this.rom.characterProperties.arrayLength; i++) {
            charNames.push(this.rom.stringTable.characterNames.string[i].fString());
        }
        this.addList('selectChar', 'Character', charNames, function(c) {
            self.c = c;
            self.loadCharacter();
        }, function(c) {
            return self.c === c;
        });

        this.addTwoState('showLegend', function(checked) {
            self.showLegend = checked;
            self.redraw();
        }, 'Legend', this.showLegend);
    }

    loadCharacter() {

        this.resetControls();

        this.observer.stopObservingAll();

        if (!this.expProgression) return;
        if (!this.hpProgression) return;
        if (!this.mpProgression) return;

        this.characterProperties = this.rom.characterProperties.item(this.c);
        if (!this.characterProperties) return;
        propertyList.select(this.characterProperties);

        this.observer.startObserving([
            this.characterProperties.hp,
            this.characterProperties.mp
        ], this.updateStats);
        for (const expObject of this.expProgression.iterator()) {
            this.observer.startObserving(expObject.exp, this.updateStats);
        }
        for (const hpObject of this.hpProgression.iterator()) {
            this.observer.startObserving(hpObject.hp, this.updateStats);
        }
        for (const mpObject of this.mpProgression.iterator()) {
            this.observer.startObserving(mpObject.mp, this.updateStats);
        }
        this.selectedPoint = null;

        this.updateStats();
    }

    updateStats() {

        let currentStats = {
            object: this.characterProperties,
            level: 1
        };

        for (const stat of FF6LevelProgression.stats) {
            let value = 0;
            if (stat.key === 'exp') {
                value = 0;
            } else if (stat.key === 'hp') {
                value = this.characterProperties.hp.value;
            } else if (stat.key === 'mp') {
                value = this.characterProperties.mp.value;
            }
            currentStats[stat.key] = {
                avg: value
            }
        }
        this.chartData = [];
        this.chartData.push(currentStats);

        while (currentStats.level < 99) {
            const previousStats = currentStats;
            currentStats = {
                level: previousStats.level + 1
            };
            const i = currentStats.level - 2;
            currentStats.object = this.expProgression.item(i);

            for (const stat of FF6LevelProgression.stats) {
                let value = previousStats[stat.key].avg;
                if (stat.key === 'exp') {
                    value += this.expProgression.item(i).exp.value;
                } else if (stat.key === 'hp') {
                    value += this.hpProgression.item(i).hp.value;
                } else if (stat.key === 'mp') {
                    value += this.mpProgression.item(i).mp.value;
                }
                value = Math.max(Math.min(value, stat.max), 0);
                currentStats[stat.key] = {
                    avg: value
                }
                this.chartData.push(currentStats);
            }
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

        // draw stats
        for (const [s, stat] of FF6LevelProgression.stats.entries()) {
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
        for (const [s, stat] of FF6LevelProgression.stats.entries()) {
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
        for (const [s, stat] of FF6LevelProgression.stats.entries()) {
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
        for (const [s, stat] of FF6LevelProgression.stats.entries()) {
            if (!this.showStat[s]) continue;

            const avgValue = Math.round(this.selectedPoint[stat.key].avg);

            // add a comma separate to numbers larger than 10000
            if (avgValue >= 10000) {
                statLabel += `\n${stat.name}: ${addCommaSep(avgValue)}`;
            } else {
                statLabel += `\n${stat.name}: ${avgValue}`;
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

FF6LevelProgression.stats = [
    {
        name: 'Experience',
        axis: 'Experience (×100,000)',
        key: 'exp',
        color: 'hsla(0, 0%, 0%, 1.0)',
        fillColor: 'hsla(0, 0%, 0%, 0.25)',
        multiplier: 100000,
        max: 9999999
    }, {
        name: 'HP',
        axis: 'HP (×100)',
        key: 'hp',
        color: 'hsla(100, 100%, 25%, 1.0)',
        fillColor: 'hsla(100, 100%, 25%, 0.25)',
        multiplier: 100,
        max: 9999
    }, {
        name: 'MP',
        axis: 'MP (×10)',
        key: 'mp',
        color: 'hsla(220, 100%, 25%, 1.0)',
        fillColor: 'hsla(220, 100%, 50%, 0.25)',
        multiplier: 10,
        max: 999
    }
]

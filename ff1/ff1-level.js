//
// ff1-level.js
// created 5/19/2020
//

function FF1LevelProgression(rom) {
    ROMEditor.call(this, rom);
    this.name = "FF1LevelProgression";

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
    this.classProperties = null;
    this.classStats = null;
    this.observer = new ROMObserver(rom, this, {sub: true, link: true, array: true});

    var levelProg = this;
//    this.div.onscroll = function() { levelProg.resize() };
    this.div.onresize = function() { levelProg.resize() };
    this.div.onmousedown = function(e) { levelProg.mouseDown(e) };
    this.div.onmouseup = function(e) { levelProg.mouseUp(e) };
    this.div.onmouseleave = function(e) { levelProg.mouseLeave(e) };
    this.div.onmousemove = function(e) { levelProg.mouseMove(e) };
    this.resizeSensor = null;
}

FF1LevelProgression.prototype = Object.create(ROMEditor.prototype);
FF1LevelProgression.prototype.constructor = FF1LevelProgression;

FF1LevelProgression.prototype.selectObject = function(object) {
    this.loadClass(object.i);
}

FF1LevelProgression.prototype.resize = function() {
    if (!this.div.parentElement) return;
    this.canvas.width = this.div.parentElement.clientWidth;
    this.canvas.height = this.div.parentElement.clientHeight - 4;

    var l = 50;
    var r = this.canvas.width - 20;
    var t = 20;
    var b = this.canvas.height - 60;
    this.chartRect = new Rect(l, r, t, b);
}

FF1LevelProgression.prototype.mouseDown = function(e) {
    this.closeList();
    if (!this.selectedPoint) return;
    propertyList.select(this.selectedPoint.object)
}

FF1LevelProgression.prototype.mouseUp = function(e) {

}

FF1LevelProgression.prototype.mouseLeave = function(e) {
    this.selectedPoint = null;
    this.drawChart();
    this.tooltip.removeAttribute("data-balloon-visible");
}

FF1LevelProgression.prototype.mouseMove = function(e) {

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

    for (var s = 0; s < 7; s++) {
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

    statLabel += "\nMP: ";
    for (var l = 0; l < 8; l++) {
        statLabel += this.selectedPoint.mp[l];
        if (l !== 7) statLabel += "/";
    }

    // show the tooltip
    this.tooltip.setAttribute("aria-label", statLabel);
    var point = this.pointToCanvas(level, closestValue);
    this.tooltip.style.display = "inline-block";
    this.tooltip.setAttribute("data-balloon-visible", "");
    if (closestValue > 70 && level > 40) {
        this.tooltip.style.left = (point.x + 17) + "px";
        this.tooltip.style.top = (point.y + 15) + "px";
        this.tooltip.setAttribute("data-balloon-pos", "down-right");
    } else if (closestValue > 70) {
        this.tooltip.style.left = point.x + "px";
        this.tooltip.style.top = (point.y + 15) + "px";
        this.tooltip.setAttribute("data-balloon-pos", "down");
    } else if (closestValue < 10 && level > 40) {
        this.tooltip.style.left = (point.x + 17) + "px";
        this.tooltip.style.top = (point.y - this.tooltip.clientHeight - 15) + "px";
        this.tooltip.setAttribute("data-balloon-pos", "up-right");
    } else if (level > 40) {
        this.tooltip.style.left = (point.x - 15) + "px";
        this.tooltip.style.top = (point.y - this.tooltip.clientHeight) + "px";
        this.tooltip.setAttribute("data-balloon-pos", "left");
    } else {
        this.tooltip.style.left = point.x + "px";
        this.tooltip.style.top = (point.y - this.tooltip.clientHeight - 15) + "px";
        this.tooltip.setAttribute("data-balloon-pos", "up");
    }
}

FF1LevelProgression.prototype.show = function() {

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

    for (var s = 0; s < 7; s++) {
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

FF1LevelProgression.prototype.hide = function() {
    this.observer.stopObservingAll();
    if (this.resizeSensor) {
        this.resizeSensor.detach(document.getElementById("edit-top"));
        this.resizeSensor = null;
    }
}

FF1LevelProgression.prototype.statProperties = function(s) {
    switch (s) {
        case 0: return {
            name: "Experience",
            axis: "Experience (×10,000)",
            key: "exp",
            color: "hsla(0, 0%, 0%, 1.0)",
            fillColor: "hsla(0, 0%, 0%, 0.25)",
            multiplier: 10000,
            max: 999999
        };
        case 1: return {
            name: "HP",
            axis: "HP (×10)",
            key: "hp",
            color: "hsla(100, 100%, 30%, 1.0)",
            fillColor: "hsla(100, 100%, 30%, 0.25)",
            multiplier: 10,
            max: 999
        };
        case 2: return {
            name: "Strength",
            key: "strength",
            color: "hsla(0, 100%, 40%, 1.0)",
            fillColor: "hsla(0, 100%, 40%, 0.25)",
            multiplier: 1,
            max: 99
        };
        case 3: return {
            name: "Agility",
            key: "agility",
            color: "hsla(50, 100%, 35%, 1.0)",
            fillColor: "hsla(50, 100%, 35%, 0.25)",
            multiplier: 1,
            max: 99
        };
        case 4: return {
            name: "Intelligence",
            key: "intelligence",
            color: "hsla(320, 100%, 35%, 1.0)",
            fillColor: "hsla(320, 100%, 35%, 0.25)",
            multiplier: 1,
            max: 99
        };
        case 5: return {
            name: "Vitality",
            key: "vitality",
            color: "hsla(170, 100%, 35%, 1.0)",
            fillColor: "hsla(170, 100%, 35%, 0.25)",
            multiplier: 1,
            max: 99
        };
        case 6: return {
            name: "Luck",
            key: "luck",
            color: "hsla(270, 100%, 35%, 1.0)",
            fillColor: "hsla(270, 100%, 35%, 0.25)",
            multiplier: 1,
            max: 99
        };
        default: return null;
    }
}

FF1LevelProgression.prototype.loadClass = function(c) {

    this.tooltip.removeAttribute("data-balloon-visible");

    this.observer.stopObservingAll();

    this.classProperties = this.rom.classProperties.item(c);
    if (!this.classProperties) return;
    this.c = c;
    this.classStats = this.rom.classStats.item(c);
    if (!this.classStats) return;
    propertyList.select(this.classProperties);

    this.observer.startObserving(this.classProperties, this.updateStats);
    this.observer.startObserving(this.classStats, this.updateStats);
    this.selectedPoint = null;

    this.updateStats();
}

FF1LevelProgression.prototype.getStats = function(level) {

    return this.classStats.item(level - 2);
}

FF1LevelProgression.prototype.updateStats = function() {

    // todo: clean this up, it's a mess
    var level = 1;
    var exp = 0;
    var minHP = this.classProperties.hp.value;
    var maxHP = minHP;
    var avgHP = minHP;
    var strength = {avg: this.classProperties.strength.value};
    strength.min = strength.avg;
    strength.max = strength.avg;
    var agility = {avg: this.classProperties.agility.value};
    agility.min = agility.avg;
    agility.max = agility.avg;
    var intelligence = {avg: this.classProperties.intelligence.value};
    intelligence.min = intelligence.avg;
    intelligence.max = intelligence.avg;
    var vitality = {avg: this.classProperties.vitality.value};
    vitality.min = vitality.avg;
    vitality.max = vitality.avg;
    var luck = {avg: this.classProperties.luck.value};
    luck.min = luck.avg;
    luck.max = luck.avg;
    var mp = [0,0,0,0,0,0,0,0];
    if (this.classProperties.i >= 3) mp[0] = 2;

    this.chartData = [{
        level: level,
        exp: {avg: exp},
        hp: {min: minHP, max: maxHP, avg: avgHP},
        strength: {avg: strength.avg},
        agility: {avg: agility.avg},
        intelligence: {avg: intelligence.avg},
        vitality: {avg: vitality.avg},
        luck: {avg: luck.avg},
        mp: mp.slice(),
        object: this.classProperties
    }];

    for (level++; level <= 50; level++) {
        var levelStats = this.getStats(level);

        var hpBonus = levelStats.stats.value & 0x20;
        exp = Math.min(levelStats.exp.value, 999999);
        minHP = Math.min(minHP + (vitality.min >> 2) + (hpBonus ? 20 : 0) + 1, 999);
        maxHP = Math.min(maxHP + (vitality.max >> 2) + (hpBonus ? 25 : 0) + 1, 999);
        avgHP = Math.min(avgHP + (vitality.avg >> 2) + (hpBonus ? 22.5 : 0) + 1, 999);

        strength.max = Math.min(strength.max + 1, 99);
        strength.avg = Math.min(strength.avg + 0.25, 99);
        if (levelStats.stats.value & 0x10) {
            strength.min = Math.min(strength.min + 1, 99);
            strength.avg = Math.min(strength.avg + 0.75, 99);
        }
        agility.max = Math.min(agility.max + 1, 99);
        agility.avg = Math.min(agility.avg + 0.25, 99);
        if (levelStats.stats.value & 0x08) {
            agility.min = Math.min(agility.min + 1, 99);
            agility.avg = Math.min(agility.avg + 0.75, 99);
        }
        intelligence.max = Math.min(intelligence.max + 1, 99);
        intelligence.avg = Math.min(intelligence.avg + 0.25, 99);
        if (levelStats.stats.value & 0x04) {
            intelligence.min = Math.min(intelligence.min + 1, 99);
            intelligence.avg = Math.min(intelligence.avg + 0.75, 99);
        }
        vitality.max = Math.min(vitality.max + 1, 99);
        vitality.avg = Math.min(vitality.avg + 0.25, 99);
        if (levelStats.stats.value & 0x02) {
            vitality.min = Math.min(vitality.min + 1, 99);
            vitality.avg = Math.min(vitality.avg + 0.75, 99);
        }
        luck.max = Math.min(luck.max + 1, 99);
        luck.avg = Math.min(luck.avg + 0.25, 99);
        if (levelStats.stats.value & 0x01) {
            luck.min = Math.min(luck.min + 1, 99);
            luck.avg = Math.min(luck.avg + 0.75, 99);
        }
        var maxMP = (this.classProperties.i < 2) ? 4 : 9;
        for (var l = 0; l < 8; l++) {
            if (mp[l] >= maxMP) continue;
            if (levelStats.mp.value & (1 << l)) mp[l]++;
        }

        this.chartData.push({
            level: level,
            exp: {avg: exp},
            hp: {min: minHP, max: maxHP, avg: avgHP},
            strength: {min: strength.min, max: strength.max, avg: strength.avg},
            agility: {min: agility.min, max: agility.max, avg: agility.avg},
            intelligence: {min: intelligence.min, max: intelligence.max, avg: intelligence.avg},
            vitality: {min: vitality.min, max: vitality.max, avg: vitality.avg},
            luck: {min: luck.min, max: luck.max, avg: luck.avg},
            mp: mp.slice(),
            object: levelStats
        });
    }

    this.resize();
    this.drawChart();
}

FF1LevelProgression.prototype.drawChart = function() {

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
    for (var x = 0; x <= 50; x += 5) {
        // vertical gridlines
        var startPoint = this.pointToCanvas(x, 0);
        var endPoint = this.pointToCanvas(x, 100);
        ctx.fillStyle = "black";
        ctx.fillText(x.toString(), startPoint.x, startPoint.y + 20);
        if (x === 0 || x === 50) continue;
        ctx.strokeStyle = "gray";
        ctx.beginPath();
        ctx.moveTo(startPoint.x + 0.5, startPoint.y);
        ctx.lineTo(endPoint.x + 0.5, endPoint.y);
        ctx.stroke();
    }
    var labelPoint = this.pointToCanvas(25, 0);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = "black";
    ctx.fillText("Level", labelPoint.x, labelPoint.y + 45);

    ctx.textAlign = 'right';
    ctx.font = '12px sans-serif';
    for (var y = 0; y <= 100; y += 10) {
        // horizontal gridlines
        var startPoint = this.pointToCanvas(0, y);
        var endPoint = this.pointToCanvas(50, y);
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
    for (var s = 0; s < 7; s++) {
        if (!this.showStat[s]) continue;
        this.drawStat(s, ctx);
        if (this.showRange) this.drawStatRange(s, ctx);
    }

    // draw legend
    if (this.showLegend) {
        this.drawLegend(ctx);
    }
}

FF1LevelProgression.prototype.drawStatRange = function(stat, ctx) {
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

FF1LevelProgression.prototype.drawStat = function(stat, ctx) {
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

FF1LevelProgression.prototype.drawLegend = function(ctx) {

    // find the widest stat
    var maxWidth = 0;
    var height = 10;
    var lineHeight = 15;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (var s = 0; s < 7; s++) {
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
    for (var s = 0; s < 7; s++) {
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

FF1LevelProgression.prototype.pointToCanvas = function(x, y) {
    return {
        x: x / 50 * this.chartRect.w + this.chartRect.l,
        y: (1 - y / 100) * this.chartRect.h + this.chartRect.t
    };
}

FF1LevelProgression.prototype.canvasToPoint = function(x, y) {
    if (!this.chartRect.containsPoint(x, y)) return null;
    return {
        x: Math.round((x - this.chartRect.l) / this.chartRect.w * 50),
        y: Math.round((1 - (y - this.chartRect.t) / this.chartRect.h) * 100)
    };
}

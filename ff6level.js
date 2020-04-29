//
// ff6level.js
// created 2/10/2020
//

function FF6LevelProgression(rom) {
    ROMEditor.call(this, rom);
    this.name = "FF6LevelProgression";

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

    this.showStat = [true, true, true];
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
    this.div.onmousemove = function(e) { levelProg.mouseMove(e) };
}

FF6LevelProgression.prototype = Object.create(ROMEditor.prototype);
FF6LevelProgression.prototype.constructor = FF6LevelProgression;

FF6LevelProgression.prototype.selectObject = function(object) {
    this.show();
    this.loadCharacter();
}

FF6LevelProgression.prototype.resize = function() {
    if (!this.div.parentElement) return;
    this.canvas.width = this.div.parentElement.clientWidth;
    this.canvas.height = this.div.parentElement.clientHeight - 4;
    
    var l = 50;
    var r = this.canvas.width - 20;
    var t = 20;
    var b = this.canvas.height - 60;
    this.chartRect = new Rect(l, r, t, b);
}

FF6LevelProgression.prototype.mouseDown = function(e) {
    this.closeList();
    if (!this.selectedPoint) return;
    propertyList.select(this.selectedPoint.object)
}

FF6LevelProgression.prototype.mouseUp = function(e) {
    
}

FF6LevelProgression.prototype.mouseMove = function(e) {
    
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
    
    for (var s = 0; s < 3; s++) {
        if (!this.showStat[s]) continue;
        
        var statName = FF6LevelProgression.stats[s].name;
        var statKey = FF6LevelProgression.stats[s].key;
        var multiplier = FF6LevelProgression.stats[s].multiplier;
        
        var value = this.selectedPoint[statKey];

        statLabel += "\n" + statName + ": " + Math.round(value);

        if (closestValue === undefined || Math.abs(value / multiplier - point.y) < Math.abs(closestValue - point.y)) {
            closestValue = value / multiplier;
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

FF6LevelProgression.prototype.show = function() {

    document.getElementById('toolbox-buttons').classList.add("hidden");
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
    
    for (var s = 0; s < 3; s++) {
        var statName = FF6LevelProgression.stats[s].name;
        this.addTwoState("show" + statName, statFunction(s), statName, this.showStat[s]);
    }
    
    var charNames = [];
    for (var i = 0; i < this.rom.characterProperties.arrayLength; i++) {
        charNames.push(this.rom.stringTable.characterNames.string[i].fString());
    }
    var self = this;
    var onChangeChar = function(c) { self.c = c; self.loadCharacter(c); }
    var charSelected = function(c) { return self.c === c; }
    this.addList("selectChar", "Character", charNames, onChangeChar, charSelected);

    this.addTwoState("showLegend", function(checked) { levelProg.showLegend = checked; levelProg.drawChart(); }, "Legend", this.showLegend);
}

FF6LevelProgression.stats = [
    {
        name: "Experience",
        axis: "Experience (×100,000)",
        key: "exp",
        color: "hsla(0, 0%, 0%, 1.0)",
        fillColor: "hsla(0, 0%, 0%, 0.25)",
        multiplier: 100000,
        max: 9999999
    }, {
        name: "HP",
        axis: "HP (×100)",
        key: "hp",
        color: "hsla(100, 100%, 25%, 1.0)",
        fillColor: "hsla(100, 100%, 25%, 0.25)",
        multiplier: 100,
        max: 9999
    }, {
        name: "MP",
        axis: "MP (×10)",
        key: "mp",
        color: "hsla(220, 100%, 25%, 1.0)",
        fillColor: "hsla(220, 100%, 50%, 0.25)",
        multiplier: 10,
        max: 999
    }
]

FF6LevelProgression.prototype.loadCharacter = function(c) {
    
    this.tooltip.removeAttribute("data-balloon-visible");
    
    this.observer.stopObservingAll();

    this.c = c || this.c;
    
    this.characterProperties = this.rom.characterProperties.item(this.c);
    this.expProgression = this.rom.characterExpProgression;
    this.hpProgression = this.rom.characterHPProgression;
    this.mpProgression = this.rom.characterMPProgression;
    if (!this.characterProperties || !this.expProgression) return;
    propertyList.select(this.characterProperties);
    
    this.observer.startObserving(this.characterProperties, this.updateStats);
    this.observer.startObserving(this.expProgression, this.updateStats);
    this.observer.startObserving(this.hpProgression, this.updateStats);
    this.observer.startObserving(this.mpProgression, this.updateStats);
    this.selectedPoint = null;
    
    this.updateStats();
}

FF6LevelProgression.prototype.updateStats = function(c) {
    
    var level = 1;
    var exp = 0;
    var hp = this.characterProperties.hp.value;
    var mp = this.characterProperties.mp.value;
    
    this.chartData = [{
        level: level,
        exp: exp,
        hp: hp,
        mp: mp,
        object: this.characterProperties
    }];

    for (level = 2; level <= 99; level++) {
        var expMod = this.expProgression.item(level - 2).exp.value;
        var hpMod = this.hpProgression.item(level - 2).hp.value;
        var mpMod = this.mpProgression.item(level - 2).mp.value;
        
        exp = Math.min(exp + expMod, 9999999);
        hp = Math.min(hp + hpMod, 9999);
        mp = Math.min(mp + mpMod, 999);

        this.chartData.push({
            level: level,
            exp: exp,
            hp: hp,
            mp: mp,
            object: this.expProgression.item(level - 2)
        });
    }
    
    this.resize();
    this.drawChart();
}

FF6LevelProgression.prototype.drawChart = function() {
    
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
    ctx.font = 'small sans-serif';
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
    ctx.font = 'medium sans-serif';
    ctx.fillStyle = "black";
    ctx.fillText("Level", labelPoint.x, labelPoint.y + 45);
    
    ctx.textAlign = 'right';
    ctx.font = 'small sans-serif';
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
    for (var s = 0; s < 3; s++) {
        if (!this.showStat[s]) continue;
        this.drawStat(s, ctx);
    }
    
    // draw legend
    if (this.showLegend) {
        this.drawLegend(ctx);
    }
}

FF6LevelProgression.prototype.drawStat = function(stat, ctx) {
    // draw the data
    var statKey = FF6LevelProgression.stats[stat].key;
    var multiplier = FF6LevelProgression.stats[stat].multiplier;
    var startPoint = this.pointToCanvas(this.chartData[0].level, this.chartData[0][statKey] / multiplier);

    ctx.strokeStyle = FF6LevelProgression.stats[stat].color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y)
    
    for (var p = 1; p < this.chartData.length; p++) {
        var dataValue = this.chartData[p];
        var point = this.pointToCanvas(dataValue.level, dataValue[statKey] / multiplier);
        ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    
    // draw the selected point
    if (this.selectedPoint) {
        point = this.pointToCanvas(this.selectedPoint.level, this.selectedPoint[statKey] / multiplier);
        ctx.beginPath();
        ctx.fillStyle = FF6LevelProgression.stats[stat].color;
        ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        ctx.fill();
    }
}

FF6LevelProgression.prototype.drawLegend = function(ctx) {
    
    // find the widest stat
    var maxWidth = 0;
    var height = 10;
    var lineHeight = 15;
    ctx.font = 'small sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (var s = 0; s < 8; s++) {
        if (!this.showStat[s]) continue;
        var name = FF6LevelProgression.stats[s].axis || FF6LevelProgression.stats[s].name;
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
        
        ctx.fillStyle = FF6LevelProgression.stats[s].color;
        ctx.fillRect(x, y + 2, 9, 9);
        ctx.strokeStyle = "black";
        ctx.strokeRect(x - 0.5, y + 1.5, 10, 10);
        
        ctx.fillStyle = "black";
        var name = FF6LevelProgression.stats[s].axis || FF6LevelProgression.stats[s].name;
        ctx.fillText(name, x + 15, y);
        y += lineHeight;
    }
}

FF6LevelProgression.prototype.pointToCanvas = function(x, y) {
    return {
        x: x / 100 * this.chartRect.w + this.chartRect.l,
        y: (1 - y / 100) * this.chartRect.h + this.chartRect.t
    };
}

FF6LevelProgression.prototype.canvasToPoint = function(x, y) {
    if (!this.chartRect.containsPoint(x, y)) return null;
    return {
        x: Math.round((x - this.chartRect.l) / this.chartRect.w * 100),
        y: Math.round((1 - (y - this.chartRect.t) / this.chartRect.h) * 100)
    };
}

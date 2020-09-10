//
// toolbox.js
// created 9/3/2020
//

class ROMToolbox {
    constructor(rom) {
        this.rom = rom;

        this.pane = document.getElementById('right-pane');
        this.paneTop = document.getElementById('right-pane-top');
        this.bar = document.getElementById('toolbox-bar');
        this.div = document.getElementById('toolbox');
        this.buttons = [];
        this.resizeSensor = null;
    }

    show(showBar = true) {

        if (showBar) {
            this.bar.classList.remove('hidden');
            this.div.classList.remove('hidden');
            this.paneTop.style.minHeight = `${this.bar.scrollHeight}px`;
            this.paneTop.style.maxHeight = '';
        } else {
            this.bar.classList.add('hidden');
            this.div.classList.remove('hidden');
            this.paneTop.style.minHeight = '0px';
            this.paneTop.style.maxHeight = '';
        }

        // notify on resize
        const self = this;
        this.resizeSensor = new ResizeSensor(this.paneTop, function() {
            self.resize();
            self.redraw();
        });

        // force the toolbox to its max height initially
        this.paneTop.style.flexBasis = '';
        this.paneTop.style.height = 'auto';
    }

    hide() {
        this.bar.classList.add('hidden');
        this.div.classList.add('hidden');
        this.paneTop.style.minHeight = '0px';
        this.paneTop.style.maxHeight = '0px';

        // detach resize sensor
        if (this.resizeSensor) {
            this.resizeSensor.detach(this.paneTop);
            this.resizeSensor = null;
        }
    }

    resize() {}
    redraw() {}

    setHeight(h) {

        // set the splitter range
        const barHeight = this.bar.scrollHeight;
        this.paneTop.style.minHeight = `${barHeight}px`;
        this.paneTop.style.maxHeight = `${barHeight + h}px`;

        // set the toolbox height
        this.div.style.height = `${h}px`;

        // determine if scrollbars are needed
        const clientHeight = this.paneTop.offsetHeight - barHeight;

        this.div.style.overflowY = (h > clientHeight) ? 'scroll' : '';
    }

    addButtons(buttonNames = ['Layer 1', 'Layer 2', 'Layer 3', 'Triggers']) {

        this.bar.innerHTML = '';
        this.buttons = [];

        for (const [b, name] of buttonNames.entries()) {
            const button = document.createElement('button');
            this.buttons.push(button);
            button.classList.add('toolbox-button');
            // select the first button by default
            if (b === 0) this.buttons[0].classList.add('selected');
            button.value = b;
            button.innerHTML = name;
            this.bar.appendChild(button);
        }
    }

    selectButton(b) {
        if (b >= this.buttons.length) return;

        // deselect all buttons
        for (const button of this.buttons) button.classList.remove("selected");

        // select the specified button
        this.buttons[b].classList.add("selected")
    }
}

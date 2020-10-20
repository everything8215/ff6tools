//
// rom-observer.js
// created 9/10/2020
//

class ROMObserver {
    constructor(rom, parent, options = {}) {
        this.rom = rom;
        this.parent = parent;
        this.observees = [];
    }

    sleep() {
        for (const object of this.observees) {
            const observer = object.getObserver(this.parent);
            if (!observer) continue;
            observer.asleep = true;
        }
    }

    wake() {
        for (const object of this.observees) {
            const observer = object.getObserver(this.parent);
            if (!observer) continue;
            observer.asleep = false;
        }
    }

    startObserving(object, callback, args) {
        // can't observe nothing
        if (!object) return;

        if (isArray(object)) {
            for (const obj of object) this.startObserving(obj, callback, args);
            return;
        }

        // start observing the object and add it to the array of observees
        if (this.observees.indexOf(object) === -1) this.observees.push(object);
        if (object.addObserver) object.addObserver(this.parent, callback, args);
    }

    stopObservingAll() {
        for (const object of this.observees) {
            if (object.removeObserver) object.removeObserver(this.parent);
        }
        this.observees = [];
    }

    startObservingSub(object, callback, args) {
        // don't observe array prototypes
        if (!(object instanceof ROMData)) return;

        for (const key in object.assembly) {
            const sub = object.assembly[key];
            this.startObserving(object[key], callback, args);
        }
    }

    startObservingLabel(object, callback, args) {
        // don't make strings observe themselves
        if (object instanceof ROMString) return;
        const label = object.labelString;
        if (!label) return;
        this.startObserving(label, callback, args);
    }
}

// blast.js

var mm6Data;
var nsfBuffer;

var ref;
var emu;
var node;
var ctx;

var instruments;
var labels;
var references;

var title;
var artist;
var copyright;

var offset;
var defaultNote;
var channelFlags;
var channelFlagsRepeat;
var currentChannel;
var repeatDepth;

function Instrument() {
    this.index = 0;
    this.attack = 0;
    this.decay = 0;
    this.sustain = 0;
    this.release = 0;
    this.x = false;
    this.frequency = 0;
    this.vibrato = 0;
    this.tremolo = 0;
    this.noise = 0;
}

function play() {
    var output = parseScript();

    if (node) {
        node.disconnect();
        node = null;
    }

    if (!ctx) {
        // create the audio context
        try {
            ctx = new (window.AudioContext || window.webkitAudioContext || window.mozAudioContext)();
        } catch (e) {
            alert("Web Audio API Error: " + e);
        }
    }

    ref = Module.allocate(1, "i32", Module.ALLOC_STATIC);

    var samplerate = ctx.sampleRate;

    if (Module.ccall("gme_open_data", "number", ["array", "number", "number", "number"], [output, output.length, ref, samplerate]) != 0){
        alert("gme_open_data failed.");
        return;
    }
    emu = Module.getValue(ref, "i32");

    var subtune_count = Module.ccall("gme_track_count", "number", ["number"], [emu]);

    Module.ccall("gme_ignore_silence", "number", ["number"], [emu, 1]);

    var voice_count = Module.ccall("gme_voice_count", "number", ["number"], [emu]);
    console.log("Channel count: " + voice_count.toString());
    console.log("Track count: " + subtune_count.toString());

    if (Module.ccall("gme_start_track", "number", ["number", "number"], [emu, 0]) != 0)
        alert("Could not load track");

    var bufferSize = 1024 * 16;
    var inputs = 2;
    var outputs = 2;

    if(!node && ctx.createJavaScriptNode)
        node = ctx.createJavaScriptNode(bufferSize, inputs, outputs);
    if(!node && ctx.createScriptProcessor)
        node = ctx.createScriptProcessor(bufferSize, inputs, outputs);

    var buffer = Module.allocate(bufferSize * 2, "i32", Module.ALLOC_STATIC);

    var INT16_MAX = Math.pow(2, 32) - 1;

    node.onaudioprocess = function(e) {
        if (Module.ccall("gme_track_ended", "number", ["number"], [emu]) == 1) {
            node.disconnect();
            console.log("End of stream.");
            return;
        }

        var channels = [e.outputBuffer.getChannelData(0), e.outputBuffer.getChannelData(1)];

        Module.ccall("gme_play", "number", ["number", "number", "number"], [emu, bufferSize * 2, buffer]);
        for (var i = 0; i < bufferSize; i++)
            for (var n = 0; n < e.outputBuffer.numberOfChannels; n++)
                channels[n][i] = Module.getValue(buffer + i * e.outputBuffer.numberOfChannels * 2 + n * 4, "i32") / INT16_MAX;
    };

    var analyserNode = ctx.createAnalyser();
    var filterNode = ctx.createBiquadFilter();
    filterNode.connect(ctx.destination);
    filterNode.connect(analyserNode);
    filterNode.type = "allpass";
    filterNode.frequency.value = 5000;
    filterNode.Q.value = 5;
    node.connect(filterNode);

    window.savedReferences = [ctx, node];
}

function stop() {
    if (node) {
        node.disconnect();
        if (Module.ccall("gme_delete", "number", ["number"], [emu]) != 0)
            console.log("Could not stop track.");
        node = null;
    }
}

function download() {
    var output = parseScript();

    var blob = new Blob([output.buffer]);
    //Create a link element, hide it, direct it towards the blob, and then 'click' it programatically
    var a = document.createElement("a");
    a.style = "display: none";
    document.body.appendChild(a);
    //Create a DOMString representing the blob and point the link element towards it
    var url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = 'output.nsf';
    //programatically click the link to trigger the download
    a.click();
    //release the reference to the file by revoking the Object URL
    window.URL.revokeObjectURL(url);
}

function parseScript() {

    nsfBuffer = new Uint8Array(0x8000);

    instruments = [];
    labels = {};
    references = {};

    title = "";
    artist = "";
    copyright = "";

    offset = 0;
    defaultNote = 0x80;
    channelFlags = 0;
    channelFlagsRepeat = 0;
    currentChannel = 0;
    repeatDepth = 0;                    
    // copy the mm6 data
    if (!mm6Data) {
        alert("Error: mm6.dat not found!");
        return;
    }
    nsfBuffer.set(mm6Data);
    offset = mm6Data.length;

    // write number of songs
    writeByte(0x01);

    // placeholder for pointer to instrument table
    references.itable0 = offset;
    writeWord(0);

    // placeholder for pointer to song
    references.start0 = offset;
    writeWord(0);

    // get the input text
    var input = document.getElementById("script").value;
    var lines = input.split("\n");

    // first pass, parse instruments
    labels.itable0 = offset;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.substring(0,2) == '#I') parseInstrument(line.substring(2));
    }

    // use mega man 6 instruments if no instruments were defined
    console.log(instruments.length);
    if (instruments.length == 0)
    {
        for (i = 0; i < mm6Instruments.length; i++) {
            parseInstrument(mm6Instruments[i]);
        }
    }

    // song header
    labels.start0 = offset;
    writeByte(0); // first byte always zero

    // placeholders for channel start pointers
    references.start1 = offset;
    writeWord(0);
    references.start2 = offset;
    writeWord(0);
    references.start3 = offset;
    writeWord(0);
    references.start4 = offset;
    writeWord(0);

    // second pass, parse the script
    for (i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.charAt(0) == '#') parseCommand(line.substring(1));
        else parseLine(line);
    }
    bufferLength = offset;

    // write reference offsets
    var referenceNames = Object.keys(references);
    for (i = 0; i < referenceNames.length; i++) {
        var referenceName = referenceNames[i];
        var labelOffset = labels[referenceName];
        var referenceOffset = references[referenceName];
        if (labelOffset && referenceOffset) {
            offset = referenceOffset;
            writeWord(labelOffset | 0x8000);
        }
    }

    // write the nsf header
    var enc = new TextEncoder("utf-8");
    var nsfHeader = new Uint8Array(0x80);
    nsfHeader.set(enc.encode("NESM"), 0);
    nsfHeader[4] = 0x1A;
    nsfHeader[5] = 0x01; // version number
    nsfHeader[6] = 0x01; // number of songs
    nsfHeader[7] = 0x01; // starting song
    nsfHeader.set([0x00, 0x80], 8); // load
    nsfHeader.set([0x03, 0x80], 10); // init
    nsfHeader.set([0x00, 0x80], 12); // play
    nsfHeader.set(enc.encode(title), 14);
    nsfHeader.set(enc.encode(artist), 46);
    nsfHeader.set(enc.encode(copyright), 78);
    nsfHeader[110] = 0x1A;
    nsfHeader[111] = 0x41; // speed (60Hz)

    var output = new Uint8Array(0x80 + bufferLength);
    output.set(nsfHeader);
    output.set(nsfBuffer.subarray(0, bufferLength), 0x80);

    return output;
}

function parseInstrument(line) {

    // create the instrument
    var instrument = new Instrument();

    // separate the line into space-delimited tokens
    //for (var token in line.split(" ")) {
    var tokens = line.split(" ");
    for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];
        var c = token[0];
        var value = parseInt(token.substring(1));
        switch (c)
        {
            case 'i':
                // index
                instrument.index = value;
                break;
            case 'a':
                // attack
                instrument.attack = value;
                break;
            case 'd':
                // decay
                instrument.decay = value;
                break;
            case 's':
                // sustain
                instrument.sustain = value;
                break;
            case 'r':
                // release
                instrument.release = value;
                break;
            case 'x':
                // ???
                instrument.x = true;
                break;
            case 'f':
                // vibrato/tremolo frequency
                instrument.frequency = value;
                break;
            case 'v':
                // vibrato depth
                instrument.vibrato = value;
                break;
            case 't':
                // tremolo depth
                instrument.tremolo = value;
                break;
            case 'n':
                // ??? noise
                instrument.noise = value;
                break;
            case ';':
                // comment
                return;
        }
    }
    instruments.push(instrument);
    writeInstrument(instrument);
}

function parseLine(line) {
    var tokens = line.split(" ");
    for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];

        // return if a comment
        if (token.charAt(0) == ";") return;

        // parse each token
        parseToken(tokens[i]);
    }
}

function parseCommand(command) {
    var c = command.charAt(0);
    var text = command.substring(2);
    switch (c)
    {
        case 'T':
            // title
            title = text;
            console.log("Title: " + title);
            break;
        case 'A':
            // artist
            artist = text;
            console.log("Artist: " + artist);
            break;
        case 'C':
            // copyright
            copyright = text;
            console.log("Copyright: " + copyright);
            break;
        case 'I':
            // instrument definition
            // these are handled by parseInstrument
            break;
        case '1':
        case '2':
        case '3':
        case '4':
            // channel start
            currentChannel = parseInt(c);
            labels["start" + c] = offset;

            defaultNote = 0x80; // default is a quarter rest
            channelFlags = 0;
            channelFlagsRepeat = 0;
            repeatDepth = -1;

            // parse the rest of the line
            parseLine(command);
            break;
    }
}

function parseToken(token) {
    var c = token.charAt(0);
    var value = parseInt(token.substring(1));

    // set channel to 1 if no channel is selected
    if (currentChannel == 0) parseCommand("1");

    switch (c) {
        case '[':
            // label
            var label = parseLabel(token);
            if (label) {
                labels[label + currentChannel.toString()] = offset;
            }
            break;
        case '|':
        case ':':
            // repeat signs
            if (token == "|:") {
                // start repeat
                repeatDepth++;
                var labelName = "repeat" + currentChannel + ":" + repeatDepth;
                labels[labelName] = offset;

                writeByte(0x04);
                writeByte(channelFlags);
            } else if (token == "|") {
                // first ending
                writeByte(0x12 + repeatDepth);
                writeByte(channelFlags);

                var labelName = "ending" + currentChannel + ":" + repeatDepth;
                labels[labelName] = offset;

                writeWord(0); // placeholder for jump address
                channelFlagsRepeat = (channelFlags | 0x80);
            } else if (token.substring(0,2) == ":|") {
                // end repeat
                writeByte(0x0E + repeatDepth);
                value = parseInt(token.substring(2)); // get the number of repeats
                if (!value || value == 0) value = 1;
                else value--;
                writeByte(value);

                // write repeat start offset
                var repeatLabelName = "repeat" + currentChannel + ":" + repeatDepth;
                var repeatLabel = labels[repeatLabelName];
                //symbol* repeatLabel = symbolGet(labelName, labels);
                if (repeatLabel) {
                    writeWord(repeatLabel | 0x8000);
                    delete labels[repeatLabelName];
                    //labels = symbolDelete(labelName, labels);
                }

                // write repeat end offset at first ending
                var endingLabelName = "ending" + currentChannel + ":" + repeatDepth;
                //symbol* endingLabel = symbolGet(labelName, labels);
                var endingLabel = labels[endingLabelName];
                if (endingLabel) {
                    var currentOffset = offset;
                    offset = endingLabel;
                    //offset = endingLabel->value;
                    writeWord(currentOffset | 0x8000);
                    offset = currentOffset;
                    delete labels[endingLabelName];
                    //labels = symbolDelete(labelName, labels);
                }

                if ((channelFlagsRepeat & 0x80) == 0x80)
                {
                    channelFlagsRepeat &= 0x7F;
                    channelFlags = channelFlagsRepeat;
                }

                // decrement repeat depth
                repeatDepth--;
            }
            break;
        case 'h':
            // toggle hi octave (+2)
            writeByte(0x03);
            channelFlags ^= 0x08;
            break;
        case 'i':
            // set instrument
            writeByte(0x08);
            for (var i = 0; i < instruments.length; i++)
                if (instruments[i].index == value) {
                    value = i;
                    break;
                }
            writeByte(value);
            break;
        case 'j':
            // jump
            writeByte(0x16);
            var reference = parseLabel(token);
            if (reference) {
                references[reference + currentChannel.toString()] = offset;
            }
            writeWord(0); // placeholder for jump address
            break;
        case 'k':
            // set key
            break;
        case 'l':
            // set default duration
            defaultNote = parseDuration(token.substring(1));
            break;
        case 'o':
            // set octave (0-7)
            writeByte(0x09);
            writeByte(value);
            break;
        case 'p':
            // set pitch slide
            writeByte(0x0D);
            writeByte(value);
            break;
        case 'q':
            // set tempo
            writeByte(0x05);
            writeWord(value);
            break;
        case 's':
            // set ADSR sustain
            writeByte(0x06);
            writeByte(value);
            break;
        case 't':
            // set transpose
            writeByte(0x0B);
            writeByte(value);
            break;
        case 'v':
            // set volume
            writeByte(0x07);
            writeByte(value);
            break;
        case 'x':
            // end of channel
            writeByte(0x17);
            break;
        case 'y':
            // set duty cycle
            writeByte(0x18);
            writeByte((value & 3) << 6);
            break;
        case 'z':
            // set detune
            writeByte(0x0C);
            writeByte(value);
            break;
        default:
            // note
            if (/[A-Ga-gRr({]/.test(token)) parseNote(token);
            break;
    }
}

function parseLabel(label) {
    var regExp = /\[([^\]]+)\]/;
    var matches = regExp.exec(label);
    if (matches.length < 2) { return; }
    return matches[1];
}

function parseNote(note)
{    
    var value = defaultNote;
    var isTripletEnd = false;

    // parse the note token
    for (var i = 0; i < note.length; ) {
        var c = note.charAt(i);
        i++;
        switch (c) {
            case '{':
                // triplet start
                writeByte(0x00);
                channelFlags |= 0x20;
                break;
            case '}':
                // triplet end
                isTripletEnd = true;
                channelFlags &= 0xDF;
                break;
            case '(':
                // tie start
                writeByte(0x01);
                channelFlags |= 0x40;
                break;
            case ')':
                // tie end
                writeByte(0x01);
                channelFlags &= 0xBF;
                break;
            case '.':
                // dotted note (1 1/2 duration)
                writeByte(0x02);
                break;
            default:
                if (/^[a-gA-G]/.test(c)) {
                    // note
                    var noteValues = [10, 12, 1, 3, 5, 6, 8];
                    if (c === c.toUpperCase()) value = noteValues[c.charCodeAt(0) - 'A'.charCodeAt(0)];
                    if (c === c.toLowerCase()) value = noteValues[c.charCodeAt(0) - 'a'.charCodeAt(0)] + 12;

                    // check for an accidental
                    while (/[#+]/.test(note.charAt(i))) {
                        // sharp
                        if ((value & 0x1F) < 0x1F) value++;
                        i++;
                    }
                    while (/[b-]/.test(note.charAt(i))) {
                        // flat
                        if ((value & 0x1F) > 1) value--; // don't allow Cb
                        i++;
                    }
                    if (note.charAt(i) == "'") {
                        // high octave mark
                        if ((value & 0x1F) <= 19) value += 12;
                        i++;
                    }

                    // get duration
                    value |= parseDuration(note.substring(i));
                    while (/[0-9]/.test(note.charAt(i))) i++;
                }
                else if (/[Rr]/.test(c)) {
                    // rest
                    value = parseDuration(note.substring(i));
                    while (/[0-9]/.test(note.charAt(i))) i++;
                } else {
                    console.log("Invalid note: " + note);
                }
                break;
        }
    }
    writeByte(value);
    if (isTripletEnd) writeByte(0x00);
    return;
}

function parseDuration(duration)
{
    // return default note if the duration doesn't begin with a number
    if (/^[0-9]/.test(duration) == false) return defaultNote;

    switch (parseInt(duration))
    {
        case 32: return 0x20; // 32nd note
        case 16: return 0x40; // 16th note
        case  8: return 0x60; // 8th note
        case  4: return 0x80; // quarter note
        case  2: return 0xA0; // half note
        case  1: return 0xC0; // whole note
        case  0: return 0xE0; // double whole note
        default:
            console.log("Invalid duration " + duration);
            return defaultNote;
    }
}

function writeByte(b) {
    if (offset >= 0x8000) return;
    nsfBuffer [offset] = b;
    offset++;
}

function writeWord(w) {
    // write high byte first
    writeByte(hiByte(w));
    writeByte(loByte(w));
}

function writeInstrument(i) {
    var freqByte = i.frequency;
    if (i.x) freqByte |= 0x80;
    writeByte(i.attack);
    writeByte(i.decay);
    writeByte(i.sustain);
    writeByte(i.release);
    writeByte(freqByte);
    writeByte(i.vibrato);
    writeByte(i.tremolo);
    writeByte(i.noise);
}

function loByte(w) {
    return w & 0xFF;
}

function hiByte(w) {
    return loByte(w >> 8);
}

var mm6Instruments = [
    "#I i0 a31 d26 s144 r20 x f30 v32 t38",
    "#I i1 a31 d31 s240 r31 x f127 v3",
    "#I i2 a29 d25 s192 r16",
    "#I i3 a29 d25 s192 r16 x f100 v5",
    "#I i4 a31 d31 s208 r15 x f100 v2 t30",
    "#I i5 a29 d24 s176 r6",
    "#I i6 a30 d20 s160 r16 x f73 t66",
    "#I i7 a31 d29 s224 r13 x n128",
    "#I i8 a28 d28 s224 r16",
    "#I i9 a28 d28 s224 r16 x f92 v4",
    "#I i10 a31 d31 s160 r16",
    "#I i11 a31 d29 s208 r15 x f99 v3",
    "#I i12 a30 d13 s128 r7 x f101 v4 t23",
    "#I i13 a31 d29 s208 r15 x f127 v7",
    "#I i14 a30 d13 s224 r18 x f112 v1 t31",
    "#I i15 a30 d28 s208 r16",
    "#I i16 a30 d28 s208 r16 x f127 v5",
    "#I i17 a31 d23 s112 r15 x f30 v32 t38",
    "#I i18 a31 d28 s176 r4 x f84 t70",
    "#I i19 a30 d28 s208 r16 x f127 v2",
    "#I i20 a28 d24 s176 r6 x f127 v3",
    "#I i21 a31 d31 s224 r27 x f30 v88 t124",
    "#I i22 a31 d31 s144 r26 x f46 v32 t38",
    "#I i23 a31 d28 s192 r16",
    "#I i24 a31 d28 s192 r16 x f127 v4",
    "#I i25 a31 d29 s224 r13 x f127 v2 n128",
    "#I i26 a31 d29 s176 r6",
    "#I i27 a31 d29 s176 r6 x f127 v1",
    "#I i28 a31 d31 s0 r31",
    "#I i29 a31 d26 s15 r0",
    "#I i30 a31 d26 s176 r15 x f127 v7",
    "#I i31 a31 d29 s144 r3 x f127 t61",
    "#I i32 a31 d27 s144 r15 x f127 v2",
    "#I i33 a31 d31 s112 r31",
    "#I i34 a28 d25 s96 r15 x f127 v19 t22",
    "#I i35 a31 d31 s240 r31 x f105 t56",
    "#I i36 a25 d31 s240 r31 x f25 v2 t29",
    "#I i37 a31 d28 s144 r15 x f100 v14 t30",
    "#I i38 a23 d2 s224 r15",
    "#I i39 a31 d31 s240 r14 x n128",
    "#I i40 a31 d31 s240 r31" ];
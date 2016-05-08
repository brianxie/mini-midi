var audiocontext = new AudioContext();
var keyboard = "awsedftgyhujk" // lowercase input string
var freqs = {}
var keynums = {}
var active = {}
var oscillators = {}

var height = window.innerHeight;
var ypos = 0;
var railsbackBase = Math.pow(2.0, 1.0/12.0); // base of function given by railsback curve
var a440 = 440.0

for (i = 0; i < keyboard.length; i++) { // equal temperament
    key = keyboard[i];
    keynums[key] = i;
    freq = 440.0 * Math.pow(railsbackBase, i + 40 - 49); // start from middle C
    freqs[key] = freq
    active[key] = false;
}

document.addEventListener("mousedown", function(event) {
    console.log(event);
    var url = "./ce1.ogg";
    var audiobuffer = null;
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = "arraybuffer";
    request.onload = function() {
        audiocontext.decodeAudioData(request.response, function(buffer) {
            audiobuffer = buffer;
        });
    }
    request.send();
    var src = audiocontext.createBufferSource();
    src.buffer = audiobuffer;
    console.log(src.buffer);
    src.connect(audiocontext.destination);
    src.start(0);
});

document.addEventListener("mousemove", function(event) {
    ypos = 1 - (event.clientY / height);
    // console.log(ypos);
});

document.addEventListener("keydown", function(event) {
    var charPressed = String.fromCharCode(event.keyCode || event.which).toLowerCase(); // get lowercase string
    // console.log(charPressed);
    if (!(charPressed in freqs)) {
        console.log("unmapped keydown: " + charPressed);
        return;
    } else if (active[charPressed] == true) {
        // console.log("key already active: " + charPressed);
        return;
    }
    // playTone(audiocontext, freqs[charPressed], 1, 1);
    // startTone(charPressed, ypos);
    msgMidi(keydownToMidi(charPressed, ypos, 0));
});

document.addEventListener("keyup", function(event) {
    var charPressed = String.fromCharCode(event.keyCode || event.which).toLowerCase(); // get lowercase string
    // console.log(charPressed);
    if (!(charPressed in freqs)) {
        console.log("unmapped keyup: " + charPressed);
        return;
    } else if (active[charPressed] == false) {
        // console.log("key already inactive: " + charPressed);
        return;
    }
    // stopTone(charPressed, ypos);
    msgMidi(keyupToMidi(charPressed, ypos, 0));
});

function startTone(key, vol) {
    console.log("key " + key + " down: " + freqs[key] + " hz / " + vol + " loudness");
    var oscillator = audiocontext.createOscillator();
    var gain = audiocontext.createGain();
    gain.gain.value = vol;
    oscillator.frequency.value = freqs[key];
    oscillator.connect(gain)
    gain.connect(audiocontext.destination);
    oscillators[key] = oscillator;
    oscillator.start(0);
    active[key] = true;
}

function stopTone(key, vol) {
    console.log("key " + key + " up: " + freqs[key] + " hz");
    oscillator = oscillators[key];
    oscillator.stop(0);
    active[key] = false;
}

function keydownToMidi(key, vol, channel) {
    var status = (0b1001 << 4) + channel; // note on; always channel 0 for simplicity
    var data1 = 0b0 + keynums[key] + 60; // 60 defined as middle C
    var data2 = 0b0 + Math.round(127.0*vol);
    return (status << 16) + (data1 << 8) + data2;
}

function keyupToMidi(key, vol, channel) {
    var status = (0b1000 << 4) + channel; // note off; always channel 0 for simplicity
    var data1 = 0b0 + keynums[key] + 60; // 60 defined as middle C
    var data2 = 0; // not using velocity for keyup
    return (status << 16) + (data1 << 8) + data2;
}

function msgMidi(msg) {
    console.log("MIDI MESSAGE: 0b" + msg.toString(2));
    var statusoffset = 0;
    var dataoffset = 0
    var data2 = 0;
    // making some assumptions that the message sender is standards-conformant
    // otherwise, behaviour is undefined
    if ((msg >>> 23) == 1) { // 3 bytes
        // console.log("3 bytes");
        statusoffset = 16;
        dataoffset = 8;
        data2 = msg & 0b11111111; // this means we have a data2 block
    } else if ((msg >>> 15) == 1) { // 2 bytes
        // console.log("2 bytes");
        statusoffset = 8;
        dataoffset = 0;
    } else {
        console.log("error: malformed midi message");
        return;
    }

    var data1 = (msg >>> (dataoffset)) & 0b11111111;
    var status = (msg >>> (statusoffset)) & 0b11111111;
    if ((status >> 4) == 0b1001) {
        // console.log("keydown");
        var keynum = data1 - 60;
        var keychar = keyboard[keynum]
        var vol = data2;
        // console.log(keychar);
        startTone(keychar, vol / 127.0);
    } else if ((status >> 4) == 0b1000) {
        // console.log("keyup");
        var keynum = data1 - 60;
        var keychar = keyboard[keynum]
        var vol = data2;
        // console.log(keychar);
        stopTone(keychar, vol / 127.0);
    } else {
        console.log("undefined midi message");
        return;
    }
}






function playTone(context, freq, vol, dur) {
    var oscillator = context.createOscillator();

    oscillator.connect(context.destination);
    oscillator.frequency.value = freq;
    oscillator.start(0);
    oscillator.stop(context.currentTime + dur);
}

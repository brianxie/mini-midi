var audiocontext = new AudioContext();

var freqs = {};
var keynums = {};
var active = {};
var oscillators = {};
var gains = {}
var modes = {};

var keyboard = "awsedftgyhujk"; // lowercase input string
var osctype = "sine";
modes["1"] = "sine";
modes["2"] = "square";
modes["3"] = "sawtooth";
modes["4"] = "triangle";

var railsbackbase = Math.pow(2.0, 1.0 / 12.0); // base of function given by railsback curve
var a440 = 440.0;

var height = window.innerHeight;
var ypos = 1;

for (var i = 0; i < keyboard.length; i++) { // equal temperament
    key = keyboard[i];
    keynums[key] = i;
    freq = 440.0 * Math.pow(railsbackbase, i + 40 - 49); // start from middle C
    freqs[key] = freq;
    active[key] = false;
}

var canvas = document.getElementById("visualization");
var canvascontext = canvas.getContext("2d");
canvascontext.clearRect(0, 0, canvas.width, canvas.height);

var analyser = audiocontext.createAnalyser();
analyser.fftSize = 2048;
analyser.connect(audiocontext.destination);
var bufferlength = analyser.frequencyBinCount;
var dataarray = new Uint8Array(bufferlength);
analyser.getByteTimeDomainData(dataarray);

function draw() {
    var visual = requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataarray);
    canvascontext.fillStyle = "rgb(15, 15, 15)";
    canvascontext.fillRect(0, 0, canvas.width, canvas.height);
    canvascontext.lineWidth = 2;
    canvascontext.strokeStyle = "rgb(255, 255, 255)";
    canvascontext.beginPath();
    var slicewidth = canvas.width * 1.0 / bufferlength;
    var x = 0;
    for (var i = 0; i < bufferlength; i++) {
        var v = dataarray[i] / 128.0;
        var y = v * canvas.height / 2;
        if (i == 0) {
            canvascontext.moveTo(x, y);
        } else {
            canvascontext.lineTo(x, y);
        }
        x += slicewidth;
    }
    canvascontext.lineTo(canvas.width, canvas.height/2);
    canvascontext.stroke();
}
// requestAnimationFrame(draw);
draw();

console.log("mini-midi has launched");
console.log("valid keys: " + keyboard);
console.log("available modes:");
for (var key in modes) {
    console.log("[" + key + "] " + modes[key]);
}

document.addEventListener("mousemove", function(event) {
    ypos = 1 - (event.clientY / height);
    // console.log(ypos);
});

document.addEventListener("keydown", function(event) {
    var charPressed = String.fromCharCode(event.keyCode || event.which).toLowerCase(); // get lowercase string
    // console.log(charPressed);
    if (charPressed in modes) {
        // setOscType(modes[charPressed]);
        msgMidi(modeToMidi(charPressed, 0));
        return;
    } else if (!(charPressed in freqs)) {
        // console.log("unmapped keydown: " + charPressed);
        return;
    } else if (active[charPressed] == true) {
        // console.log("key already active: " + charPressed);
        return;
    } else {
    // playTone(audiocontext, freqs[charPressed], 1, 1);
    // startTone(charPressed, ypos);
        msgMidi(keydownToMidi(charPressed, ypos, 0));
    }
});

document.addEventListener("keyup", function(event) {
    var charPressed = String.fromCharCode(event.keyCode || event.which).toLowerCase(); // get lowercase string
    // console.log(charPressed);
    if (charPressed in modes) {
        // don't need to do anything actually
        return;
    } else if (!(charPressed in freqs)) {
        // console.log("unmapped keyup: " + charPressed);
        return;
    } else if (active[charPressed] == false) {
        // console.log("key already inactive: " + charPressed);
        return;
    } else {
        // stopTone(charPressed, ypos);
        msgMidi(keyupToMidi(charPressed, ypos, 0));
    }
});

function startTone(key, vol) {
    console.log("key " + key + " down: " + freqs[key] + " hz / " + vol + " loudness");
    var oscillator = audiocontext.createOscillator();
    var gain = audiocontext.createGain();
    oscillator.type = osctype;
    oscillator.frequency.value = freqs[key];
    gain.gain.value = vol;
    oscillator.connect(gain);
    gain.connect(analyser);
    // gain.connect(audiocontext.destination);
    oscillators[key] = oscillator;
    gains[key] = gain;
    oscillator.start(0);
    active[key] = true;
}

function stopTone(key, vol) {
    console.log("key " + key + " up: " + freqs[key] + " hz");
    oscillator = oscillators[key];
    gain = gains[key];
    oscillator.stop(0);
    oscillator.disconnect();
    gain.disconnect();
    active[key] = false;
}

function setOscType(mode) {
    var prev = osctype;
    if (prev == mode) {
        console.log("mode is already set to [" + mode + "]");
    } else {
        osctype = mode;
        console.log("mode changed from [" + prev + "] to [" + mode + "]");
    }
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

function modeToMidi(key, channel) {
    var status = (0b1100 << 4) + channel; // program change
    var data1 = 0b0 + parseInt(key);
    return (status << 8) + data1;
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
    } else if ((status >> 4) == 0b1100) {
        var preset = data1.toString();
        setOscType(modes[preset]);
    } else {
        console.log("undefined midi message");
        return;
    }
}





// extras
// var url = "./ce1.ogg";
// var audiobuffer = null;
// var request = new XMLHttpRequest();
// request.open('GET', url, true);
// request.responseType = "arraybuffer";
// request.onload = function() {
//     audiocontext.decodeAudioData(request.response, function(buffer) {
//         audiobuffer = buffer;
//     });
// }
// request.send();

// document.addEventListener("mousedown", function(event) {
//     var src = audiocontext.createBufferSource();
//     src.buffer = audiobuffer;
//     src.connect(audiocontext.destination);
//     src.start(0);
// });

// function playTone(context, freq, vol, dur) {
//     var oscillator = context.createOscillator();

//     oscillator.connect(context.destination);
//     oscillator.frequency.value = freq;
//     oscillator.start(0);
//     oscillator.stop(context.currentTime + dur);
// }
// end extras

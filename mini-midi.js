// this looks really inelegant because midi contains an internal state machine :V


// DEFINING GLOBAL VARS
leftconsole = document.getElementById("console-midi");
rightconsole = document.getElementById("console-js");

var freqs = {};
var keynums = {};
var active = {};
var oscillators = {};
var gains = {}
var modes = {};

var keyboard = "awsedftgyhujk"; // lowercase input string
var currmode = "osc-sine";

modes["1"] = "osc-sine";
modes["2"] = "osc-square";
modes["3"] = "osc-sawtooth";
modes["4"] = "osc-triangle";
modes["8"] = "ks-percussion";
modes["9"] = "ks-string";

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


// SETTING UP AUDIO, DRAWING ENVIRONMENTS
var audiocontext = new AudioContext();

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
    canvascontext.fillStyle = "rgb(31, 31, 31)";
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

var perpetual = audiocontext.createScriptProcessor(4096, 1, 1);
perpetual.connect(analyser);



// FINISHED SETUP
console.log("mini-midi has launched");
console.log("valid keys: " + keyboard);
console.log("volume controlled by mouse y-pos");
console.log("available modes:");
for (var key in modes) {
    console.log("[" + key + "] " + modes[key]);
}
console.log("WARNING: ks-modes prone to high latency (due to live synth) as well as some unfixed bugs");


leftconsole.innerHTML += "mini-midi has launched" + "<br>";
// leftconsole.innerHTML += "licensed under the MIT license" + "<br>";
leftconsole.innerHTML += "uses webaudio oscillators," + "<br>";
leftconsole.innerHTML += "karplus-strong string synthesis" + "<br>";
leftconsole.innerHTML += "to generate samples" + "<br>";
leftconsole.innerHTML += "<br>";
leftconsole.innerHTML += "valid keys: " + keyboard + "<br>";
leftconsole.innerHTML += "volume controlled by mouse y-pos" + "<br>";
rightconsole.innerHTML += "available modes:" + "<br>";
for (var key in modes) {
    rightconsole.innerHTML += "[" + key + "] " + modes[key] + "<br>";
}
leftconsole.innerHTML += "--------------------------------" + "<br>";
rightconsole.innerHTML += "--------------------------------" + "<br>";
leftconsole.scrollTop = leftconsole.scrollHeight;
rightconsole.scrollTop = rightconsole.scrollHeight;



// HANDLE USER INPUT
document.addEventListener("mousemove", function(event) {
    ypos = 1 - (event.clientY / height);
    // console.log(ypos);
});

document.addEventListener("keydown", function(event) {
    var charPressed = String.fromCharCode(event.keyCode || event.which).toLowerCase(); // get lowercase string
    // console.log(charPressed);
    if (charPressed in modes) {
        // setMode(modes[charPressed]);
        msgMidi(modeToMidi(charPressed, 0));
        return;
    } else if (!(charPressed in keynums)) {
        // console.log("unmapped keydown: " + charPressed);
        return;
    } else {
        if (currmode.startsWith("osc-")) {
            if (active[charPressed] == true) {
                // console.log("key already active: " + charPressed);
                return;
            } else {
                // startTone(charPressed, ypos);
                msgMidi(keydownToMidi(charPressed, ypos, 0));
            }
        } else if (currmode.startsWith("ks-")) {
            // ksSynth(charPressed, ypos);
            msgMidi(keydownToMidi(charPressed, ypos, 0));
        } else {
            console.log("current mode is invalid (how?)");
            return;
        }
    }
});

document.addEventListener("keyup", function(event) {
    var charPressed = String.fromCharCode(event.keyCode || event.which).toLowerCase(); // get lowercase string
    // console.log(charPressed);
    if (charPressed in modes) {
        // don't need to do anything actually
        return;
    } else if (!(charPressed in keynums)) {
        // console.log("unmapped keyup: " + charPressed);
        return;
    } else { // want to be able to release key in any mode
        if (active[charPressed] == false) {
            // console.log("key already inactive: " + charPressed);
            return;
        } else {
            // stopTone(charPressed, ypos);
            msgMidi(keyupToMidi(charPressed, ypos, 0));
        }
    }
});


// JS SYNTHESIZER BACKEND
function setMode(mode) {
    var prev = currmode;
    if (prev == mode) {
        console.log("mode is already set to [" + mode + "]");

        rightconsole.innerHTML += "[" + mode + "] already set" + "<br>";
        rightconsole.scrollTop = rightconsole.scrollHeight;

    } else {
        currmode = mode;
        console.log("mode changed from [" + prev + "] to [" + mode + "]");

        rightconsole.innerHTML += "[" + prev + "] to [" + mode + "]" + "<br>";
        rightconsole.scrollTop = rightconsole.scrollHeight;

    }
}

function startTone(key, vol) {
    if (!(currmode.startsWith("osc-"))) {
        console.log("must be on an oscillator mode");
        return;
    }
    console.log("key " + key + " down: " + freqs[key] + " hz / " + vol + " loudness");

    rightconsole.innerHTML += "[strike] " + Math.round(freqs[key]) + " hz / " + Math.round(100*vol) + "% loudness" + "<br>";
    rightconsole.scrollTop = rightconsole.scrollHeight;

    var oscillator = audiocontext.createOscillator();
    var gain = audiocontext.createGain();
    oscillator.type = currmode.slice(4);
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
    // if (!(currmode.startsWith("osc-"))) {
    //     console.log("must be on an oscillator mode");
    //     return;
    // }
    // we actually don't want that block so we can release in a different mode
    console.log("key " + key + " up: " + freqs[key] + " hz");

    rightconsole.innerHTML += "[release] " + Math.round(freqs[key]) + " hz" + "<br>";
    rightconsole.scrollTop = rightconsole.scrollHeight;

    oscillator = oscillators[key];
    gain = gains[key];
    oscillator.stop(0);
    oscillator.disconnect();
    gain.disconnect();
    active[key] = false;
}

function ksSynth(key, vol) {
    if (!(currmode.startsWith("ks-"))) {
        console.log("must be on a karplus-strong mode");
        return;
    }
    var freq;
    var decay;
    var percussion;

    if (currmode == "ks-percussion") {
        freq = freqs[key] * Math.pow(railsbackbase, -12.0); // shift freq 1 octave down
        decay = 1.00; // magic number
        percussion = true;
    } else if (currmode = "ks-string") {
        freq = freqs[key]
        decay = 0.996;
        percussion = false;
    } else {
        console.log("what? on an invalid mode");
        return;
    }
    var bufptr = 0;
    var ringbuf = [];

    console.log("key " + key + " down: " + freq + " hz / " + vol + " loudness");

    rightconsole.innerHTML += "[strike] " + Math.round(freq) + " hz / " + Math.round(100*vol) + "% loudness" + "<br>";
    rightconsole.scrollTop = rightconsole.scrollHeight;


    var sp = audiocontext.createScriptProcessor(4096, 1, 1);
    sp.connect(analyser);
    var delaylen = Math.round(audiocontext.sampleRate / freq);
    var noise = delaylen;

    var empty = false;
    sp.onaudioprocess = function(event) {
        if (empty) {
            sp.disconnect();
            return;
        }
        var output = event.outputBuffer;
        var outputdata = output.getChannelData(0);
        var len = output.length;
        for (var j = 0; j < len; j++) {
            outputdata[j] = getData(ringbuf);
        }
        // console.log(outputdata);
        empty = true;
        for (var k = 0; k < len; k++) {
            if (outputdata[k] != 0.0) {
                empty = false;
                break;
            }
        }
    }

    // sp.connect(audiocontext.destination);
    function getData(ringbuf) {
        var sample = 0; // goes to output buffer; ringbuf maintained separately
        if (noise > 0) {
            sample = vol * ((2 * Math.random()) - 1);
            ringbuf[bufptr] = sample;
            noise -= 1;
        } else {
            sample = ringbuf[bufptr];
            var curr = ringbuf[bufptr];
            var next = ringbuf[(bufptr + 1) % delaylen];
            var qval = decay * (curr + next) / 2.0
            // drum sound
            if (percussion) {
                if (Math.random() > 0.5) {
                    qval = -qval;
                }
            }
            // end drum sound
            if (Math.abs(qval) < 0.001953125) { // 1/512; arbitrary cutoff
                qval = 0;
            }
            ringbuf[bufptr] = qval;
        }
        bufptr = (bufptr + 1) % delaylen;
        return sample;
    }
}


// INPUT-TO-MIDI CONVERSIONS
function keydownToMidi(key, vol, channel) { // 3byte
    var status = (0b1001 << 4) + channel; // note on; always channel 0 for simplicity
    var data1 = 0b0 + keynums[key] + 60; // 60 defined as middle C
    var data2 = 0b0 + Math.round(127.0*vol);
    return (status << 16) + (data1 << 8) + data2;
}

function keyupToMidi(key, vol, channel) { // 3byte
    var status = (0b1000 << 4) + channel; // note off; always channel 0 for simplicity
    var data1 = 0b0 + keynums[key] + 60; // 60 defined as middle C
    var data2 = 0; // not using velocity for keyup
    return (status << 16) + (data1 << 8) + data2;
}

function modeToMidi(key, channel) { // 2byte
    var status = (0b1100 << 4) + channel; // program change
    var data1 = 0b0 + parseInt(key);
    return (status << 8) + data1;
}


// MIDI MESSAGE INTERPRETERS
function msgMidi(msg) {
    console.log("MIDI MESSAGE: 0b" + msg.toString(2));

    leftconsole.innerHTML += msg.toString(2) + "<br>";
    leftconsole.scrollTop = leftconsole.scrollHeight;

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
        if (currmode.startsWith("osc-")) {
            startTone(keychar, vol / 127.0);
        } else if (currmode.startsWith("ks-")) {
            ksSynth(keychar, vol / 127.0);
        } else {
            console.log("not in a mode to handle this command");
            return;
        }
    } else if ((status >> 4) == 0b1000) {
        // console.log("keyup");
        var keynum = data1 - 60;
        var keychar = keyboard[keynum]
        var vol = data2;
        // console.log(keychar);
        // we can definitely call this because keyup only sent if active
        stopTone(keychar, vol / 127.0);
    } else if ((status >> 4) == 0b1100) {
        var preset = data1.toString();
        setMode(modes[preset]);
    } else {
        console.log("undefined midi message");
        return;
    }
}





// extras
// document.addEventListener("mousedown", function(event) {
//     // var jsNode = audiocontext.createJavaScriptNode(2048,1,1);
//     // var noises = [];
//     // var bufferpointers = [];
//     var sp = audiocontext.createScriptProcessor(4096, 1, 1);
//     sp.connect(analyser);
//     var bufptr = 0;
//     var ringbuf = [];
//     var freq = freqs["a"];
//     var decay = 0.996; // magic number
//     var delaylen = Math.round(audiocontext.sampleRate / freq);
//     var noise = delaylen;

//     var timeout = 0;

//     sp.onaudioprocess = function(event) {
//         console.log(event);
//         var output = event.outputBuffer;
//         var numchannels = output.numberOfChannels;
//         // these end up being instantiated already
//         // since we assume only 1 channel
//         // for (var i = 0; i < numchannels; i++) {
//         //     noises[i] = delaylen;
//         //     bufferpointers[i] = 0;
//         // }
//         for (var i = 0; i < numchannels; i++) { // loop through channels
//             outputdata = output.getChannelData(i);
//             var len = output.length;
//             // var ringbuf = []; // can't redefine this in each loop or it restarts
//             for (var j = 0; j < len; j++) {
//                 outputdata[j] = getData(i, ringbuf);
//             }
//         }
//         console.log(outputdata);
//     }
//     // sp.connect(audiocontext.destination);
//     function getData(channel, ringbuf) {
//         var sample = 0;
//         // var bufptr = bufferpointers[channel];
//         // if (noises[channel] > 0) {
//         if (noise > 0) {
//             sample = (2 * Math.random()) - 1;
//             ringbuf[bufptr] = sample;
//             // noises[channel] -= 1;
//             noise -= 1;
//         } else {
//             sample = ringbuf[bufptr];
//             var curr = ringbuf[bufptr];
//             var next = ringbuf[(bufptr + 1) % delaylen];
//             var qval = decay * (curr + next) / 2.0
//             ringbuf[bufptr] = qval;
//         }
//         // bufferpointers[channel] = (bufptr + 1) % delaylen;
//         bufptr = (bufptr + 1) % delaylen;
//         return sample;
//     }
// });

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
// playTone(audiocontext, freqs[charPressed], 1, 1);
// end extras

// dsp on input samples?
// changing waveform envelope?

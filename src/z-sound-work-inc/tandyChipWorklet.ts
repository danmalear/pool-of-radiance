// tandyChipWorklet.ts
//
// An SN76489 (Tandy 1000 sound chip) emulator, shipped as the TEXT of an
// AudioWorklet module so it works without any bundler configuration:
// SoundDriver turns it into a Blob URL and calls audioWorklet.addModule().
//
// The engine's TandyOutput.writes are the exact bytes the original driver sent
// to port C0h. This processor replays them, each at its audio-clock timestamp,
// into a counter-level model of the chip:
//
//   * three tone counters + a noise counter, each decremented at clock/16;
//   * a tone's output flips when its counter hits 0, then reloads from its
//     10-bit period (0 behaves as 1024)  ->  frequency = clock / (32 * period);
//   * noise shift rates clock/512, /1024, /2048, or tone 2's rate (control 3);
//   * a 15-bit LFSR (white) or a rotating single bit (periodic);
//   * writing the noise register resets the LFSR. On the TI chip ('ti15') ANY
//     write resets it, and the original driver rewrites the register every
//     tick, so its noise restarts every ~4.2 ms. On the NCR8496/PSSJ chips used
//     in many Tandy 1000s ('ncr8496') it only resets when the white/periodic bit
//     CHANGES, so the same rewrites leave the noise running continuously (static).
//     Which one you hear is the biggest timbre difference between profiles;
//   * attenuation in 2 dB steps, 15 = off;
//   * each output sample is the AVERAGE of the chip steps inside it (box
//     filter), so tones are as hard-edged and as alias-prone as the real thing;
//   * mixing: 'unipolar' (default) maps each channel to 0/+level like the real output
//     pin, then removes the DC with a ~20 Hz high-pass like the coupling capacitor.
//     Level changes then leave one-sided steps (a faint tick-rate "zipper").
//     'bipolar' maps it to +/-level, which is cleaner because those steps cancel out.
//
// Validation: a DOSBox capture of Tandy tune 8 (white noise with a volume ramp) was
// compared with this emulator's output. With 'ncr8496' the noise bit pattern matches
// at correlation 0.96 (0.06 for 'ti15', i.e. chance), so DOSBox models the NCR8496
// noise register, and these are the defaults. The only mismatch is the first tick,
// whose periodic-noise burst depends on the register's leftover state from whatever
// played before. Per-channel full scale in that capture was 0.25 peak-to-peak.
//
// Profiles (SoundDriver option noiseProfile):
//   'ti15'     15-bit, white-noise feedback = XOR of bits 0,1, reset on every write.
//   'ncr8496'  15-bit, feedback = XNOR of bits 0 and 4 (taps A and E in the usual
//              notation), reset only when the white/periodic bit changes.
//              'pssj3' is the same apart from output polarity (inaudible).
//   { width, taps, xnor?, resetOnChange? }  to experiment.
// Sources: the go-chip-sn76489 README (TI variant), MAME's sn76496 notes and a
// Vogons write-up of the NCR8496/PSSJ differences. Not checked against hardware;
// match whichever sounds like your reference emulator.
//
// Keep this string plain JS: no backticks or dollar-brace sequences inside.

export const TANDY_CHIP_PROCESSOR = 'tandy-chip';

export const TANDY_CHIP_WORKLET_SOURCE = String.raw`
'use strict';
(function () {
  var CLOCK = 3579545;
  var LEVEL = 0.125;                      // bipolar +/-0.125 = 0.25 peak-to-peak per channel at attenuation 0, as measured in DOSBox
  var VOL = [];
  for (var a = 0; a < 16; a++) VOL.push(a >= 15 ? 0 : LEVEL * Math.pow(10, -a / 10));
  // taps: bit mask whose parity is the white-noise feedback; xnor: invert that parity;
  // resetOnChange: reset the shift register only when the white/periodic bit changes.
  var PROFILES = {
    ti15: { width: 15, taps: 3, xnor: false, resetOnChange: false },
    ncr8496: { width: 15, taps: 17, xnor: true, resetOnChange: true },
    pssj3: { width: 15, taps: 17, xnor: true, resetOnChange: true }
  };

  function Chip(sampleRate, noise, mix) {
    var p = typeof noise === 'string' ? PROFILES[noise] : noise;
    if (!p) p = PROFILES.ncr8496;
    this.width = p.width;
    this.taps = p.taps;
    this.xnor = !!p.xnor;
    this.resetOnChange = !!p.resetOnChange;
    this.unipolar = mix !== 'bipolar';      // default: unipolar, like the real output pin
    this.dcR = 1 - (2 * Math.PI * 20) / sampleRate;   // one-pole DC blocker, about 20 Hz corner
    this.dcx = 0;
    this.dcy = 0;
    this.stepPerSample = (CLOCK / 16) / sampleRate;
    this.acc = 0;
    this.period = [0, 0, 0];
    this.cnt = [1, 1, 1];
    this.out = [0, 0, 0];
    this.att = [15, 15, 15, 15];
    this.noiseCtl = 0;
    this.ncnt = 1;
    this.nout = 0;
    this.lfsr = 1 << (this.width - 1);
    this.ch = 0;                          // register selected by the last latch byte
    this.type = 0;                        // 0 = tone period / noise control, 1 = attenuation
  }

  Chip.prototype.write = function (b) {
    if (b & 128) {                        // latch byte: 1 cc t dddd
      this.ch = (b >> 5) & 3;
      this.type = (b >> 4) & 1;
      var d = b & 15;
      if (this.type === 1) {
        this.att[this.ch] = d;
      } else if (this.ch < 3) {
        this.period[this.ch] = (this.period[this.ch] & 1008) | d;
      } else {
        var ctl = d & 7;
        var modeChanged = ((ctl ^ this.noiseCtl) & 4) !== 0;
        this.noiseCtl = ctl;
        if (!this.resetOnChange || modeChanged) this.lfsr = 1 << (this.width - 1);
      }
    } else if (this.type === 0 && this.ch < 3) {   // data byte: 0 xdddddd = high 6 bits of a tone period
      this.period[this.ch] = (this.period[this.ch] & 15) | ((b & 63) << 4);
    }
  };

  Chip.prototype.shift = function () {
    var fb;
    if (this.noiseCtl & 4) {
      var x = this.lfsr & this.taps;
      x ^= x >> 8; x ^= x >> 4; x ^= x >> 2; x ^= x >> 1;
      fb = x & 1;
      if (this.xnor) fb ^= 1;
    } else {
      fb = this.lfsr & 1;                 // periodic: the register just rotates
    }
    this.lfsr = (this.lfsr >> 1) | (fb << (this.width - 1));
  };

  Chip.prototype.tick = function () {     // one step at clock/16
    for (var c = 0; c < 3; c++) {
      if (--this.cnt[c] <= 0) {
        this.cnt[c] = this.period[c] || 1024;
        this.out[c] ^= 1;
      }
    }
    if (--this.ncnt <= 0) {
      var nf = this.noiseCtl & 3;
      this.ncnt = nf === 3 ? (this.period[2] || 1024) : (16 << nf);
      this.nout ^= 1;
      if (this.nout) this.shift();        // shift on the rising edge: half the toggle rate
    }
  };

  Chip.prototype.mix = function () {
    var g = this.unipolar ? 2 : 1;          // 0..2v has the same peak-to-peak as -v..+v
    var off = this.unipolar ? 0 : -1;
    var s = 0, v;
    for (var c = 0; c < 3; c++) { v = VOL[this.att[c]] * g; s += this.out[c] ? v : off * v; }
    v = VOL[this.att[3]] * g;
    s += (this.lfsr & 1) ? v : off * v;
    return s;
  };

  Chip.prototype.block = function (x) {     // y[n] = x[n] - x[n-1] + R * y[n-1]
    var y = x - this.dcx + this.dcR * this.dcy;
    this.dcx = x;
    this.dcy = y;
    return y;
  };

  Chip.prototype.sample = function () {   // average of every chip step inside this output sample
    this.acc += this.stepPerSample;
    var n = this.acc | 0;
    this.acc -= n;
    var out;
    if (n < 1) {
      out = this.mix();
    } else {
      var sum = 0;
      for (var i = 0; i < n; i++) { this.tick(); sum += this.mix(); }
      out = sum / n;
    }
    return this.unipolar ? this.block(out) : out;
  };

  if (typeof registerProcessor === 'function') {
    registerProcessor('tandy-chip', class extends AudioWorkletProcessor {
      constructor(options) {
        super();
        var o = (options && options.processorOptions) || {};
        this.chip = new Chip(sampleRate, o.noise, o.mix);
        this.queue = [];                  // { t: audio time in seconds, writes: byte[] }, in time order
        var self = this;
        this.port.onmessage = function (e) { self.queue.push(e.data); };
      }
      process(inputs, outputs) {
        var out = outputs[0];
        var ch0 = out[0];
        var base = currentFrame;
        for (var i = 0; i < ch0.length; i++) {
          var t = (base + i) / sampleRate;
          while (this.queue.length && this.queue[0].t <= t) {   // late events apply immediately
            var w = this.queue.shift().writes;
            for (var j = 0; j < w.length; j++) this.chip.write(w[j]);
          }
          ch0[i] = this.chip.sample();
        }
        for (var k = 1; k < out.length; k++) out[k].set(ch0);
        return true;
      }
    });
  }
})();
`;

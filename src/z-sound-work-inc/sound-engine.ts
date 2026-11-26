// soundEngine.ts
//
// A hardware-free port of the sequencer in sounddrv.asm. It does everything the
// timer interrupt did (step voices, run tune streams, apply LFO and envelopes)
// but instead of writing to I/O ports, each tick RETURNS what the hardware would
// have been told. A separate audio backend turns that into sound.
//
//   const engine = new SoundEngine();
//   engine.programSpeakerVoices(19);
//   setInterval(() => render(engine.tickSpeaker()), 1000 / TICK_HZ);   // roughly
//
// Pure TypeScript, no DOM or Node APIs. Deterministic: same calls in, same
// outputs out, which is what makes it testable.
//
// Fidelity notes (where the asm does something a clean rewrite would not):
//  * All voice fields are 16-bit and wrap, like the asm words.
//  * outPeriod is computed BEFORE the stream runs in a tick, so a new period
//    from an SSET is first heard on the NEXT tick (note records excepted: they
//    write outPeriod directly).
//  * SCLEAR retargets the stream's "current voice"; later SSETs hit that voice.
//    The stream still yields/ends based on the voice that was being stepped.
//  * seqRet (the SCALL return slot) is ONE global shared by everything.
//  * SLOOP: counter 0 loops forever; counter N>=1 jumps back N-1 times.
//  * LFO is off when lfoRate is 0 (phase + rate == 0).
//  * A voice whose stream ended keeps its last outPeriod/level. The Tandy
//    output still reports it; streams silence themselves with level 0.

import type { Op } from './sound-data.js';
import {
	ENV_SETLEVEL,
	ENVS,
	LFO_MEM,
	OCT,
	OPS,
	PIT_HZ,
	REST,
	SONG_TABLE_SPEAKER,
	SONG_TABLE_TANDY,
	SPEAKER_NOTE_PERIODS,
	TANDY_CLOCK_HZ,
	TANDY_NOTE_PERIODS,
} from './sound-data.js';

// ------------------------------------------------------------------ types ---

/** One voice block (the asm VOICE struct). Every numeric field is a 16-bit word. */
export interface Voice {
	duration: number; // ticks until the sequencer next steps this voice; 0 = voice idle
	stream: number | null; // index into ops; null = no stream
	period: number; // pitch accumulator
	periodAdd: number; // added to period each tick (pitch slide)
	outPeriod: number; // period + LFO; what the chip gets
	level: number;
	levelAdd: number;
	tempo: number; // low byte scales note durations (0 or 1 = unchanged)
	releaseLead: number; // stored by streams, never read by the driver
	transpose: number; // added to a note's pitch before octave reduction
	gateLen: number; // when it expires the envelope jumps to its release (pair 4)
	envBase: number; // 1-based index into envs; 0 = none
	envPos: number; // index of the next [value, ticks] pair
	envWait: number; // ticks left in the current envelope segment
	lfoTable: number; // byte offset into lfoMem
	lfoPhase: number;
	lfoRate: number;
	lfoDepth: number; // signed
	lfoWrap: number;
	loopA: number;
	loopB: number;
}

/** Everything the engine reads. Defaults to the data converted from sounddrv.asm. */
export interface SoundData {
	ops: readonly Op[];
	envs: readonly (readonly (readonly [number, number])[])[];
	lfoMem: Uint8Array;
	songSpeaker: readonly (readonly (number | null)[])[];
	songTandy: readonly (readonly (number | null)[])[];
	speakerNotePeriods: readonly number[];
	tandyNotePeriods: readonly number[];
}

export const DEFAULT_DATA: SoundData = {
	ops: OPS,
	envs: ENVS,
	lfoMem: LFO_MEM,
	songSpeaker: SONG_TABLE_SPEAKER,
	songTandy: SONG_TABLE_TANDY,
	speakerNotePeriods: SPEAKER_NOTE_PERIODS,
	tandyNotePeriods: TANDY_NOTE_PERIODS,
};

export interface Device {
	readonly name: 'speaker' | 'tandy';
	readonly voices: Voice[]; // always 4
	readonly notePeriods: readonly number[];
}

/** What the PC speaker should do for one tick. */
export interface SpeakerOutput {
	/** True only when a voice owns the speaker AND both gate bits (level & 3 === 3) are set. */
	sounding: boolean;
	/** The two low bits of the claiming voice's level (port 61h gate bits). 0 when nobody claims. */
	gate: number;
	/** PIT channel 2 divisor (0 means 65536). 0 when silent. */
	divisor: number;
	/** Square-wave frequency in Hz. 0 when silent. */
	hz: number;
}

export interface ToneOutput {
	n: number; // 10-bit chip period (outPeriod >> 6)
	hz: number; // clock / (32 * n); n = 0 is treated as 1024
	att: number; // 0 = loudest .. 15 = off
	gain: number; // linear gain, 2 dB per attenuation step, 0 at att 15
}

export interface NoiseOutput {
	white: boolean; // feedback bit: true = white noise, false = periodic
	rate: 0 | 1 | 2 | 3; // 0..2 fixed rates; 3 = follows tone voice 2's frequency
	att: number;
	gain: number;
}

/** What the Tandy SN76489 should do for one tick. */
export interface TandyOutput {
	/** True when the chip is muted (no tune, or output disabled). tones/noise then report att 15. */
	off: boolean;
	tones: [ToneOutput, ToneOutput, ToneOutput];
	noise: NoiseOutput;
	/** The exact bytes the asm would send to port C0h this tick, in order. */
	writes: number[];
}

// ---------------------------------------------------------------- helpers ---

const u16 = (n: number): number => n & 0xffff;
const s16 = (n: number): number => (n << 16) >> 16;
const s8 = (n: number): number => (n << 24) >> 24;

const MAX_OPS_PER_RUN = 10_000; // runaway-stream guard (the real ISR would just hang)

function newVoice(): Voice {
	return {
		duration: 0,
		stream: null,
		period: 0,
		periodAdd: 0,
		outPeriod: 0,
		level: 0,
		levelAdd: 0,
		tempo: 0,
		releaseLead: 0,
		transpose: 0,
		gateLen: 0,
		envBase: 0,
		envPos: 0,
		envWait: 0,
		lfoTable: 0,
		lfoPhase: 0,
		lfoRate: 0,
		lfoDepth: 0,
		lfoWrap: 0,
		loopA: 0,
		loopB: 0,
	};
}

/** SRESET / SCLEAR: zero the sound state. Leaves duration, stream, tempo, gateLen and both loop counters alone. */
function resetVoice(v: Voice): void {
	v.period = v.periodAdd = v.outPeriod = 0;
	v.level = v.levelAdd = 0;
	v.releaseLead = v.transpose = 0;
	v.envBase = v.envPos = v.envWait = 0;
	v.lfoTable = v.lfoPhase = v.lfoRate = v.lfoDepth = v.lfoWrap = 0;
}

const attGain = (att: number): number =>
	att >= 15 ? 0 : Math.pow(10, (-2 * att) / 20);
const toneHz = (n: number): number =>
	TANDY_CLOCK_HZ / (32 * (n === 0 ? 1024 : n));

const silentSpeaker = (): SpeakerOutput => ({
	sounding: false,
	gate: 0,
	divisor: 0,
	hz: 0,
});

function tandyOff(): TandyOutput {
	const tone = (): ToneOutput => ({ n: 0, hz: toneHz(0), att: 15, gain: 0 });
	return {
		off: true,
		tones: [tone(), tone(), tone()],
		noise: { white: false, rate: 0, att: 15, gain: 0 },
		writes: [0x9f, 0xbf, 0xdf, 0xff], // tandy_off: attenuate all four channels fully
	};
}

// ----------------------------------------------------------------- engine ---

export class SoundEngine {
	readonly speaker: Device;
	readonly tandy: Device;

	/** Last tune id loaded by either Program*Voices. Only zero / nonzero matters: 0 = silent and frozen. */
	curTune = 0;
	/** SetSoundOutputEnabled. When false, sequencers keep running but output is muted. */
	outputOn = true;
	/** The single global SCALL return slot (op index). -1 = nothing ever saved. */
	seqRet = -1;
	/** Diagnostics from the runaway guard / bad data. Capped at 100 entries. */
	readonly warnings: string[] = [];

	constructor(readonly data: SoundData = DEFAULT_DATA) {
		const mk = (
			name: 'speaker' | 'tandy',
			notePeriods: readonly number[],
		): Device => ({
			name,
			notePeriods,
			voices: [newVoice(), newVoice(), newVoice(), newVoice()],
		});
		this.speaker = mk('speaker', data.speakerNotePeriods);
		this.tandy = mk('tandy', data.tandyNotePeriods);
	}

	// ---- public entry points (the asm's PUBLIC procedures) -------------------

	/** ProgramSpeakerVoices. Tune ids are 0..20; 0 is silence. */
	programSpeakerVoices(tune: number): void {
		this.program(this.speaker, this.data.songSpeaker, tune);
	}

	/** ProgramTandyVoices. Tune ids are 0..20; 0 is silence. */
	programTandyVoices(tune: number): void {
		this.program(this.tandy, this.data.songTandy, tune);
	}

	/** SetSoundOutputEnabled. */
	setOutputEnabled(on: boolean): void {
		this.outputOn = on;
	}

	/** True while any voice of the device still has time left. */
	isPlaying(device: 'speaker' | 'tandy'): boolean {
		const dev = device === 'speaker' ? this.speaker : this.tandy;
		return this.curTune !== 0 && dev.voices.some((v) => v.duration !== 0);
	}

	/** Advance one timer tick for both devices, like the ISR (speaker first). */
	tick(): { speaker: SpeakerOutput; tandy: TandyOutput } {
		return { speaker: this.tickSpeaker(), tandy: this.tickTandy() };
	}

	// ---- program -------------------------------------------------------------

	private program(
		dev: Device,
		table: SoundData['songSpeaker'],
		tune: number,
	): void {
		const row = Number.isInteger(tune) ? table[tune] : undefined;
		if (!row)
			throw new RangeError(`no tune ${tune} (valid: 0..${table.length - 1})`);
		this.curTune = tune;
		row.forEach((ptr, i) => {
			if (ptr === null) return; // zero pointer: this voice keeps playing untouched
			const v = newVoice(); // the whole block is cleared
			v.stream = ptr;
			v.duration = 1; // step on the very next tick
			dev.voices[i] = v;
		});
	}

	// ---- per-device tick -----------------------------------------------------

	/** tick_spkr: step the four voices; the first with a level and time left owns the speaker. */
	tickSpeaker(): SpeakerOutput {
		if (this.curTune === 0) return silentSpeaker();
		const dev = this.speaker;
		let claimed: Voice | null = null;
		for (const v of dev.voices) {
			if (v.duration === 0) continue;
			this.voiceStep(dev, v);
			if (claimed === null && v.level !== 0 && v.duration !== 0) claimed = v;
		}
		if (!this.outputOn || claimed === null) return silentSpeaker();
		const gate = claimed.level & 3; // port 61h bits: timer gate + speaker data
		const divisor = claimed.outPeriod;
		return {
			sounding: gate === 3,
			gate,
			divisor,
			hz: gate === 3 ? PIT_HZ / (divisor === 0 ? 65536 : divisor) : 0,
		};
	}

	/** tick_tandy: step the four voices, then report all four channels (running or not). */
	tickTandy(): TandyOutput {
		if (this.curTune === 0) return tandyOff();
		const dev = this.tandy;
		for (const v of dev.voices) if (v.duration !== 0) this.voiceStep(dev, v);
		if (!this.outputOn) return tandyOff();

		const writes: number[] = [];
		const tones: ToneOutput[] = [];
		let noise!: NoiseOutput;
		dev.voices.forEach((v, i) => {
			const dl = 0x80 + 0x20 * i; // latch byte: 80h, A0h, C0h, E0h
			const n = v.outPeriod >> 6; // 10-bit chip period
			const att = ((0xffff - v.level) >> 12) & 0xf; // level is inverted: the chip attenuates
			writes.push((n & 0xf) ^ dl); // low 4 period bits
			if (i !== 3) writes.push(v.outPeriod >> 10); // high 6 bits (noise has no second byte)
			writes.push((att ^ dl) + 0x10); // attenuation latch
			if (i < 3) tones.push({ n, hz: toneHz(n), att, gain: attGain(att) });
			else
				noise = {
					white: (n & 4) !== 0,
					rate: (n & 3) as 0 | 1 | 2 | 3,
					att,
					gain: attGain(att),
				};
		});
		return { off: false, tones: tones as TandyOutput['tones'], noise, writes };
	}

	// ---- voice_step ----------------------------------------------------------

	private voiceStep(dev: Device, v: Voice): void {
		// 1. slides
		v.level = u16(v.level + v.levelAdd);
		v.period = u16(v.period + v.periodAdd);

		// 2. LFO (off when phase + rate == 0, i.e. rate 0)
		let lfo = 0;
		const p = u16(v.lfoPhase + v.lfoRate);
		if (p !== 0) {
			const phase = p >= v.lfoWrap ? u16(p - v.lfoWrap) : p;
			v.lfoPhase = phase;
			const sample = s8(this.data.lfoMem[v.lfoTable + (s16(phase) >> 4)] ?? 0);
			lfo = (sample * s16(v.lfoDepth)) >> 8; // floor(sample * depth / 256)
		}
		v.outPeriod = u16(v.period + lfo);

		// 3. gate: when it runs out, jump the envelope to its release (pair 4, byte 10h)
		if (v.gateLen !== 0) {
			v.gateLen = u16(v.gateLen - 1);
			if (v.gateLen === 0) {
				v.envPos = 4;
				v.envWait = 1;
			}
		}

		// 4. duration: when it hits zero, run the stream until it yields
		v.duration = u16(v.duration - 1);
		if (v.duration === 0) this.runStream(dev, v);

		// 5. envelope
		if (v.envWait !== 0) {
			v.envWait = u16(v.envWait - 1);
			if (v.envWait === 0) this.stepEnvelope(v);
		}
	}

	private stepEnvelope(v: Voice): void {
		const table = v.envBase !== 0 ? this.data.envs[v.envBase - 1] : undefined;
		if (!table) return; // note played on a voice with no envelope
		for (;;) {
			const seg = table[v.envPos];
			if (!seg) return; // ran off the table: hold
			v.envPos++;
			const [value, ticks] = seg;
			if (ticks === ENV_SETLEVEL) {
				// "load level, continue on the same tick"
				v.level = value;
				if (value === 0) v.levelAdd = 0; // a zero level stops the slide too
				continue;
			}
			v.levelAdd = value; // else: slide at `value` for `ticks`
			v.envWait = ticks; // ticks 0 = hold forever (end of envelope)
			return;
		}
	}

	// ---- seq_proc: run a stream until it yields ------------------------------

	private runStream(dev: Device, seqVoice: Voice): void {
		if (seqVoice.stream === null) return;
		const ops = this.data.ops;
		let pc = seqVoice.stream;
		let cur = seqVoice; // the asm's SI: SCLEAR moves this
		let budget = MAX_OPS_PER_RUN;

		run: for (;;) {
			if (--budget < 0 || pc < 0 || pc >= ops.length) {
				this.warn(
					`${dev.name}: stream left the rails at op ${pc}; voice stopped`,
				);
				seqVoice.duration = 0;
				break run;
			}
			const o = ops[pc++];
			switch (o.k) {
				case 'set':
					(cur as unknown as Record<string, number | null>)[o.f] = o.v;
					if (o.f === 'duration') break run; // SWAIT always yields
					break;

				case 'loop': {
					const n = cur[o.c];
					if (n === 0) {
						pc = o.t;
						break;
					} // counter 0: loop forever
					cur[o.c] = n - 1;
					if (n - 1 !== 0) pc = o.t; // else: loop finished, fall through
					break;
				}

				case 'call':
					this.seqRet = pc;
					pc = o.t;
					break;

				case 'ret':
					if (this.seqRet < 0) {
						// SRET with nothing ever called: the asm would jump to
						seqVoice.duration = 0; // address 0 (garbage). Treat it as end-of-stream.
						break run;
					}
					pc = this.seqRet;
					break;

				case 'reset':
					resetVoice(cur);
					break;

				case 'clear':
					cur = dev.voices[o.v];
					resetVoice(cur);
					break;

				case 'note':
					this.playNote(dev, cur, o);
					if (o.last) break run; // last flag: yield
					break; // else the next op should be another note record
			}
		}

		// seq_end: the stream ends when the voice that was being stepped has no duration left
		seqVoice.stream = seqVoice.duration === 0 ? null : pc;
	}

	/** seq_note: one note record. `cur` is the voice the stream is currently addressing. */
	private playNote(
		dev: Device,
		cur: Voice,
		o: Extract<Op, { k: 'note' }>,
	): void {
		// Duration: scaled by the low byte of tempo when that is > 1 (0 or 1 leaves it as is).
		const tempo = cur.tempo & 0xff;
		cur.duration = tempo > 1 ? (tempo * o.dur) & 0xffff : o.dur;

		if (o.pitch === REST) return; // rest: duration only
		if (o.vnum !== 0) return; // only notes addressed to voice 0 set a pitch

		const v = dev.voices[0];
		v.duration = cur.duration;
		v.gateLen = cur.duration;
		const ax = u16(o.pitch + v.transpose); // 16-bit: a negative transpose wraps, as in the asm
		v.envPos = 0;
		v.envWait = 1; // start the envelope this tick
		const octave = Math.floor(ax / OCT) & 0xff; // the asm counts octaves in CL, 8-bit
		const semitone = ax % OCT;
		// Period shrinks per octave. A shift of 16+ yields 0 (8086 behaviour; a 286+ would mask the count to 5 bits).
		const period = octave >= 16 ? 0 : dev.notePeriods[semitone] >> octave;
		v.period = v.outPeriod = period;
	}

	private warn(msg: string): void {
		if (this.warnings.length < 100) this.warnings.push(msg);
	}
}

// soundDriver.ts
//
// Browser audio backend for SoundEngine. Exposes the same five entry points the
// asm exported, in camelCase, so translated Pascal calls map one-to-one:
//
//   InstallSoundTimer       -> installSoundTimer()      (async; call from a click/keypress)
//   UninstallSoundTimer     -> uninstallSoundTimer()
//   ProgramSpeakerVoices(n) -> programSpeakerVoices(n)
//   ProgramTandyVoices(n)   -> programTandyVoices(n)
//   SetSoundOutputEnabled   -> setSoundOutputEnabled(on)
//
// How it keeps time
// -----------------
// The original ran off a hardware interrupt at ~236.7 Hz. A browser timer can't
// do that reliably (setInterval is coarse and gets throttled), so instead:
//   * a coarse setInterval (default 20 ms) wakes up;
//   * it runs every engine tick that falls inside the next `lookaheadSec` of
//     AUDIO-CLOCK time, and schedules each tick's parameter changes at its exact
//     time with setValueAtTime / setTargetAtTime.
// The audio thread then plays the schedule sample-accurately even if the main
// thread stutters, as long as it wakes up within the lookahead window.
//
// Trade-off: a program change can take up to lookaheadSec (default 60 ms) to be
// heard, because ticks for the old sound are already scheduled.
//
// Sound model
// -----------
// Speaker : one square oscillator, gated on/off by the engine's `sounding` flag.
// Tandy   : by default an SN76489 EMULATOR in an AudioWorklet (tandyChipWorklet.ts).
//           Each tick the engine's exact chip register writes are posted with their
//           audio-clock timestamp and replayed sample-accurately. This reproduces
//           hard-edged squares and the per-tick noise-register reset of the original.
//           Needs AudioWorklet (secure context: https or localhost). Without it, or
//           with tandyBackend: 'oscillators', it falls back to a rougher model:
//           three OscillatorNode squares + a looping noise buffer (softer, band-limited).
// The speaker path is still an approximation: OscillatorNode squares are
// band-limited, and a real PIT only picks up a new divisor at a half-cycle boundary.

import { TANDY_CLOCK_HZ, TICK_HZ } from './sound-data.js';
import {
	SoundEngine,
	type SpeakerOutput,
	type TandyOutput,
} from './sound-engine.js';
import {
	TANDY_CHIP_PROCESSOR,
	TANDY_CHIP_WORKLET_SOURCE,
} from './tandyChipWorklet.js';

export type NoiseProfile =
	| 'ti15'
	| 'ncr8496'
	| 'pssj3'
	| { width: number; taps: number; xnor?: boolean; resetOnChange?: boolean };

export interface SoundDriverOptions {
	/** Which device to play. The original ticked both; in a browser you pick one. Default 'speaker'. */
	device?: 'speaker' | 'tandy';
	/** Use your own AudioContext (it will NOT be closed on uninstall). Default: create one. */
	context?: AudioContext;
	/** Master volume 0..1. Default 1, which matches DOSBox's Tandy level (full scale 0.25 peak-to-peak per channel). */
	volume?: number;
	/** How far ahead of the audio clock to schedule ticks. Default 0.06 s. */
	lookaheadSec?: number;
	/** Scheduler wake-up period. Default 20 ms. null = no timer; call pump() yourself (used by tests). */
	intervalMs?: number | null;
	/** Share an engine with other code (e.g. for tests). Default: a new SoundEngine. */
	engine?: SoundEngine;
	/** Tandy only. 'chip' = SN76489 emulation in an AudioWorklet (default; falls back automatically). 'oscillators' = rough model. */
	tandyBackend?: 'chip' | 'oscillators';
	/**
	 * Tandy chip only. Noise behaviour: 'ncr8496' (default; validated against a DOSBox capture: only resets
	 * the noise register when white/periodic changes, so repeated writes leave continuous static),
	 * 'pssj3' (identical here), 'ti15' (TI chip: resets on every write), or { width, taps, xnor?, resetOnChange? }.
	 */
	noiseProfile?: NoiseProfile;
	/** Tandy chip only. 'unipolar' (default: 0/+level like the real output pin, with DC blocking) or 'bipolar' (cleaner). */
	chipMix?: 'bipolar' | 'unipolar';
	/** Tandy chip only. URL of a worklet file containing TANDY_CHIP_WORKLET_SOURCE, for pages whose CSP forbids blob: URLs. */
	tandyWorkletUrl?: string;
}

const TICK_SEC = 1 / TICK_HZ;
const loadedContexts = new WeakSet<object>(); // contexts that already loaded the Tandy chip worklet
const MAX_AUDIBLE_HZ = 20_000; // above this the hardware is inaudible and a WebAudio oscillator would alias
const MAX_CATCHUP_SEC = 2; // after a longer stall (background tab) drop time instead of flooding events
const SMOOTH_SEC = 0.0005; // tiny gain smoothing so on/off edges don't pop
const SPEAKER_LEVEL = 0.25;
const TONE_LEVEL = 0.15;
const NOISE_LEVEL = 0.15;

/** A parameter that only schedules an event when its value actually changes. */
class Channel {
	private last = NaN;
	constructor(
		readonly param: AudioParam,
		private readonly smooth = 0,
	) {}
	set(value: number, t: number): void {
		if (value === this.last) return;
		this.last = value;
		if (this.smooth > 0) this.param.setTargetAtTime(value, t, this.smooth);
		else this.param.setValueAtTime(value, t);
	}
}

interface ToneVoice {
	osc: OscillatorNode;
	gain: Channel;
	freq: Channel;
}
interface NoiseBank {
	white: { src: AudioBufferSourceNode; gain: Channel; rate: Channel };
	periodic: { src: AudioBufferSourceNode; gain: Channel; rate: Channel };
}

/** SN76489 noise: shift rates for NF 0..2 (clock/512, /1024, /2048); NF 3 follows tone 2's frequency. */
function noiseShiftHz(rate: 0 | 1 | 2 | 3, tone2Hz: number): number {
	return rate === 3 ? tone2Hz : TANDY_CLOCK_HZ / (512 << rate);
}

/** One loop of LFSR output as a centred, normalised ±1 buffer. White: 15-bit, taps 0 and 1. Periodic: a lone bit rotating through 15 stages. */
export function makeNoiseSamples(white: boolean): Float32Array {
	const len = white ? 32767 : 15;
	const raw = new Float32Array(len);
	let state = 0x4000;
	for (let i = 0; i < len; i++) {
		raw[i] = state & 1 ? 1 : -1;
		const feedback = white ? (state ^ (state >> 1)) & 1 : state & 1;
		state = (state >> 1) | (feedback << 14);
	}
	let mean = 0;
	for (const s of raw) mean += s;
	mean /= len;
	let peak = 0;
	for (let i = 0; i < len; i++) {
		raw[i] -= mean;
		peak = Math.max(peak, Math.abs(raw[i]));
	}
	for (let i = 0; i < len; i++) raw[i] /= peak;
	return raw;
}

export class SoundDriver {
	readonly engine: SoundEngine;
	private readonly device: 'speaker' | 'tandy';
	private readonly volume: number;
	private readonly lookahead: number;
	private readonly intervalMs: number | null;
	private readonly suppliedContext: AudioContext | undefined;
	private readonly tandyBackend: 'chip' | 'oscillators';
	private readonly noiseProfile: NoiseProfile;
	private readonly chipMix: 'bipolar' | 'unipolar';
	private readonly tandyWorkletUrl: string | undefined;
	private ready = false;
	private chipNode: AudioWorkletNode | null = null;

	private ctx: AudioContext | null = null;
	private timer: ReturnType<typeof setInterval> | null = null;
	private nextTickTime = 0;

	private master: GainNode | null = null;
	private speakerGain: Channel | null = null;
	private speakerFreq: Channel | null = null;
	private tones: ToneVoice[] = [];
	private noise: NoiseBank | null = null;
	private sources: AudioScheduledSourceNode[] = [];

	constructor(opts: SoundDriverOptions = {}) {
		this.device = opts.device ?? 'speaker';
		this.volume = opts.volume ?? 1;
		this.lookahead = opts.lookaheadSec ?? 0.06;
		this.intervalMs = opts.intervalMs === undefined ? 20 : opts.intervalMs;
		this.suppliedContext = opts.context;
		this.tandyBackend = opts.tandyBackend ?? 'chip';
		this.noiseProfile = opts.noiseProfile ?? 'ncr8496';
		this.chipMix = opts.chipMix ?? 'unipolar';
		this.tandyWorkletUrl = opts.tandyWorkletUrl;
		this.engine = opts.engine ?? new SoundEngine();
	}

	get installed(): boolean {
		return this.ctx !== null;
	}

	// ---- the five asm entry points -------------------------------------------

	/**
	 * InstallSoundTimer. Browsers only allow audio after a user gesture, so call this
	 * from a click/keypress handler. Safe to call twice.
	 */
	async installSoundTimer(): Promise<void> {
		if (this.ctx) return;
		const ctx = this.suppliedContext ?? new AudioContext();
		this.ctx = ctx;
		this.master = ctx.createGain();
		this.master.gain.value = this.volume;
		this.master.connect(ctx.destination);
		if (this.device === 'speaker') this.buildSpeaker(ctx);
		else await this.buildTandy(ctx);
		if (ctx.state === 'suspended') await ctx.resume();
		this.ready = true;
		this.nextTickTime = ctx.currentTime + 0.02;
		if (this.intervalMs !== null)
			this.timer = setInterval(() => this.pump(), this.intervalMs);
		this.pump();
	}

	/** UninstallSoundTimer. Stops the scheduler and all sound; closes the context if the driver created it. */
	uninstallSoundTimer(): void {
		if (this.timer !== null) {
			clearInterval(this.timer);
			this.timer = null;
		}
		for (const s of this.sources) {
			try {
				s.stop();
			} catch {
				/* already stopped */
			}
			s.disconnect();
		}
		this.sources = [];
		this.chipNode?.disconnect();
		this.chipNode = null;
		this.master?.disconnect();
		if (this.ctx && !this.suppliedContext) void this.ctx.close();
		this.ready = false;
		this.ctx = null;
		this.master = null;
		this.speakerGain = this.speakerFreq = null;
		this.tones = [];
		this.noise = null;
	}

	/** ProgramSpeakerVoices. May be called before install; the tune starts once ticking begins. */
	programSpeakerVoices(tune: number): void {
		this.engine.programSpeakerVoices(tune);
	}

	/** ProgramTandyVoices. */
	programTandyVoices(tune: number): void {
		this.engine.programTandyVoices(tune);
	}

	/** SetSoundOutputEnabled. Muting keeps the sequencers running, exactly like the asm. */
	setSoundOutputEnabled(on: boolean): void {
		this.engine.setOutputEnabled(on);
	}

	/** True while the selected device still has a tune running. */
	isPlaying(): boolean {
		return this.engine.isPlaying(this.device);
	}

	/** Resume a suspended context (e.g. from a later user gesture). */
	async resume(): Promise<void> {
		if (this.ctx?.state === 'suspended') await this.ctx.resume();
	}

	// ---- scheduler -----------------------------------------------------------

	/** Run every engine tick due within the lookahead window. Called by the timer; public for tests and manual driving. */
	pump(): void {
		const ctx = this.ctx;
		if (!ctx || !this.ready) return;
		const now = ctx.currentTime;
		if (this.nextTickTime < now - MAX_CATCHUP_SEC) this.nextTickTime = now; // long stall: resync, don't flood
		const horizon = now + this.lookahead;
		while (this.nextTickTime < horizon) {
			// A tick that is already late still runs (the sequencer must advance); its changes apply "now".
			this.runTick(Math.max(this.nextTickTime, now));
			this.nextTickTime += TICK_SEC;
		}
	}

	private runTick(t: number): void {
		if (this.device === 'speaker')
			this.applySpeaker(this.engine.tickSpeaker(), t);
		else this.applyTandy(this.engine.tickTandy(), t);
	}

	// ---- speaker -------------------------------------------------------------

	private track<T extends AudioScheduledSourceNode>(node: T): T {
		this.sources.push(node);
		return node;
	}

	private buildSpeaker(ctx: AudioContext): void {
		const osc = this.track(ctx.createOscillator());
		osc.type = 'square';
		const gain = ctx.createGain();
		gain.gain.value = 0;
		osc.connect(gain);
		gain.connect(this.master!);
		osc.start();
		this.speakerFreq = new Channel(osc.frequency);
		this.speakerGain = new Channel(gain.gain, SMOOTH_SEC);
	}

	private applySpeaker(o: SpeakerOutput, t: number): void {
		const audible = o.sounding && o.hz <= MAX_AUDIBLE_HZ;
		if (audible) this.speakerFreq!.set(o.hz, t); // only retune while sounding: no glitch when it stops
		this.speakerGain!.set(audible ? SPEAKER_LEVEL : 0, t);
	}

	// ---- Tandy ---------------------------------------------------------------

	private async buildTandy(ctx: AudioContext): Promise<void> {
		if (this.tandyBackend === 'chip' && ctx.audioWorklet) {
			try {
				await this.buildChip(ctx);
				return;
			} catch (e) {
				console.warn(
					'SoundDriver: Tandy chip worklet unavailable, using the oscillator fallback.',
					e,
				);
			}
		}
		this.buildTandyOscillators(ctx);
	}

	private async buildChip(ctx: AudioContext): Promise<void> {
		let url = this.tandyWorkletUrl;
		let blobUrl: string | null = null;
		if (!url) {
			blobUrl = URL.createObjectURL(
				new Blob([TANDY_CHIP_WORKLET_SOURCE], { type: 'text/javascript' }),
			);
			url = blobUrl;
		}
		// A context can load the module only once: a second addModule re-registers 'tandy-chip', which throws.
		// Install/Uninstall can repeat on one context (the game does it around every sound in soundAutoStop mode).
		if (!loadedContexts.has(ctx)) {
			try {
				await ctx.audioWorklet.addModule(url);
				loadedContexts.add(ctx);
			} finally {
				if (blobUrl) URL.revokeObjectURL(blobUrl);
			}
		} else if (blobUrl) {
			URL.revokeObjectURL(blobUrl);
		}
		const node = new AudioWorkletNode(ctx, TANDY_CHIP_PROCESSOR, {
			numberOfInputs: 0,
			numberOfOutputs: 1,
			outputChannelCount: [1],
			processorOptions: { noise: this.noiseProfile, mix: this.chipMix },
		});
		node.connect(this.master!);
		this.chipNode = node;
	}

	private buildTandyOscillators(ctx: AudioContext): void {
		for (let i = 0; i < 3; i++) {
			const osc = this.track(ctx.createOscillator());
			osc.type = 'square';
			const gain = ctx.createGain();
			gain.gain.value = 0;
			osc.connect(gain);
			gain.connect(this.master!);
			osc.start();
			this.tones.push({
				osc,
				gain: new Channel(gain.gain, SMOOTH_SEC),
				freq: new Channel(osc.frequency),
			});
		}
		const mk = (white: boolean) => {
			const samples = makeNoiseSamples(white);
			const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
			buffer.getChannelData(0).set(samples);
			const src = this.track(ctx.createBufferSource());
			src.buffer = buffer;
			src.loop = true;
			const gain = ctx.createGain();
			gain.gain.value = 0;
			src.connect(gain);
			gain.connect(this.master!);
			src.start();
			return {
				src,
				gain: new Channel(gain.gain, SMOOTH_SEC),
				rate: new Channel(src.playbackRate),
			};
		};
		this.noise = { white: mk(true), periodic: mk(false) };
	}

	private applyTandy(o: TandyOutput, t: number): void {
		if (this.chipNode) {
			// Always post, even when the bytes repeat: rewriting the noise register resets its shift register.
			this.chipNode.port.postMessage({ t, writes: o.writes });
			return;
		}
		o.tones.forEach((tone, i) => {
			const v = this.tones[i];
			const audible = tone.gain > 0 && tone.hz <= MAX_AUDIBLE_HZ;
			if (audible) v.freq.set(tone.hz, t);
			v.gain.set(audible ? TONE_LEVEL * tone.gain : 0, t);
		});

		const n = this.noise!;
		const ctxRate = this.ctx!.sampleRate;
		// One loop sample per LFSR shift, so playbackRate = shifts per second / sample rate.
		const rate = Math.min(
			8,
			noiseShiftHz(o.noise.rate, o.tones[2].hz) / ctxRate,
		);
		const level = NOISE_LEVEL * o.noise.gain;
		n.white.rate.set(rate, t);
		n.periodic.rate.set(rate, t);
		n.white.gain.set(o.noise.white ? level : 0, t);
		n.periodic.gain.set(o.noise.white ? 0 : level, t);
	}
}

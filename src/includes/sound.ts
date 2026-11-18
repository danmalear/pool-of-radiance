/* Sound: the sound-effect ids, and the soundMode values. */
export namespace Sound {
	/* weapon hit or blocked-movement bump */
	export const IMPACT = 3;
	export const STEP = 6;
	/* The Tandy SN76489 chip, chosen by a T in the sound line of POOL.CFG. */
	export const TANDY = 0;
	/* The PC speaker, chosen by a P. */
	export const SPEAKER = 1;
	/* Sound is off, for any other letter or once Ctrl-S turns it off; SoundCommand then does nothing. */
	export const OFF = 2;
}

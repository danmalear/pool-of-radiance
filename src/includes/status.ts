/* Creature status values (TCharRecord.status). */
export namespace Status {
	/* Creature status values. Conditions such as sleep and paralysis are tracked as effects. */
	export const OKAY = 0;
	export const ANIMATED = 1;
	/* fled combat */
	export const RUNNING = 3;
	export const UNCONSCIOUS = 4;
	export const DYING = 5;
	export const DEAD_STATUS = 6;
	/* petrified */
	export const STONED = 7;
	export const GONE = 8;
}

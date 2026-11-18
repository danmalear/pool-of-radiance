/* Direction indices. */
export namespace Direction {
	/* Direction indices into dirDx/dirDy; cardinals even, diagonals odd */
	export const NORTH = 0;
	export const NORTHEAST = 1;
	export const EAST = 2;
	export const SOUTHEAST = 3;
	export const SOUTH = 4;
	export const SOUTHWEST = 5;
	export const WEST = 6;
	export const NORTHWEST = 7;
	/* self / no movement (delta 0,0) */
	export const CENTER = 8;
}

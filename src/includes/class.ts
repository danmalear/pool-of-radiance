// { Class values (TCharRecord.charClass): single classes 0..7, then multiclass combinations 8..16; and the class-level
//   slots that index classLevels. }
export namespace Class {
  export const CLERIC = 0;
  export const FIGHTER = 2;
  export const MAGE = 5;
  export const CLERIC_FIGHTER = 8;
  export const CLERIC_FIGHTER_MAGE = 9;
  export const CLERIC_RANGER = 10;
  export const FIGHTER_THIEF = 14;
  export const FIGHTER_MAGE_THIEF = 15;
  export const MAGE_THIEF = 16;
  // classLevels indices
  export const CLERIC_LEVEL = 0;
  export const FIGHTER_LEVEL = 2;
  export const MAGE_LEVEL = 5;
  export const THIEF_LEVEL = 6;
  export const MONK_LEVEL = 7;
}

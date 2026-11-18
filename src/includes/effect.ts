/* Effect IDs: TEffectRec.id values used by FxEngine.AddEffect, FxEngine.RemoveEffect and CharHlp.HasEffect, and indices
  into EffHndlr's handler table. */
export namespace Effect {
  export const BLESS = 1;
  export const CURSE = 2;
  export const UNDEAD_SLAYER = 3;
  export const TRAINING_START = 4;
  /* EffNone handler; item labels mark magic items while any creature has it */
  export const DETECT_MAGIC = 5;
  export const FLAME_TONGUE = 6;
  export const TRAINING_MANUAL = 7;
  export const PROTECTION_FROM_EVIL = 8;
  export const PROTECTION_FROM_GOOD = 9;
  export const RESIST_COLD = 10;
  export const CHARM = 11;
  export const ENLARGE = 12;
  export const FRIENDS = 14;
  export const SLOW_POISON_HIT = 15;
  export const READ_MAGIC = 16;
  export const SHIELD = 17;
  export const GNOME_ATTACK_BONUS = 18;
  /* EffNone handler. */
  export const FIND_TRAPS = 19;
  export const RESIST_FIRE = 20;
  export const SILENCE = 21;
  export const SLOW_POISON_END = 22;
  export const SPIRITUAL_HAMMER = 23;
  export const INVISIBLE = 25;
  export const DWARF_ATTACK_BONUS = 26;
  /* EffNone handler; readying the Ring of Feather Falling adds it */
  export const FEATHER_FALL = 27;
  export const MIRROR_IMAGE = 28;
  export const ENFEEBLED = 29;
  export const STINKING_CLOUD_COUGH = 30;
  export const HELPLESS = 31;
  export const ANIMATE_DEAD = 32;
  export const BLIND = 33;
  export const DISEASED = 34;
  /* Prayer's bonus alone: +1 to attack and saving throws. PRAYER grants it to the caster's side. */
  export const ALLIED_PRAYER = 35;
  export const BESTOW_CURSE = 36;
  export const BLINKING = 37;
  export const STRENGTH = 38;
  /* EclMenu.MoveExtremes doubles movement on it */
  export const HASTED = 39;
  export const CAST_STINKING_CLOUD = 40;
  export const PROTECTION_FROM_MISSILES = 41;
  export const SLOWED = 42;
  export const DISEASE_STRENGTH = 43;
  export const DISEASE_HIT_POINTS = 44;
  /* Shares the effect 8 handler, EffProtEvil. */
  export const PROTECTION_FROM_EVIL_RADIUS = 45;
  /* Shares the effect 9 handler, EffProtGood. */
  export const PROTECTION_FROM_GOOD_RADIUS = 46;
  export const DWARF_GIANT_DEFENSE = 47;
  export const GNOME_BUGBEAR_DEFENSE = 48;
  export const PRAYER = 49;
  export const ROT_NO_HEALING = 50;
  /* Shares the effect 31 handler, EffHelpless. */
  export const SNAKE_CHARM = 51;
  export const PARALYSIS = 52;
  export const SLEEP = 53;
  /* Dragon fear, toned down for the game: the handler does nothing, so the effect only marks the creature and camp lists
    it as Repulsed. The full fear effect is DRAGON_FEAR. */
  export const DRAGON_AURA = 54;
  export const POISONED = 55;
  export const RING_OF_INVISIBILITY = 56;
  export const MUMMY_ROT = 57;
  export const IMMOBILE = 58;
  export const TROLL_REGENERATION = 59;
  export const RING_OF_FIRE_RESISTANCE = 61;
  export const POISON_ATTACK = 64;
  export const WEAK_POISON_ATTACK = 65;
  export const MILD_POISON_ATTACK = 66;
  export const KREEN_PARALYSIS = 67;
  export const GHOUL_PARALYSIS = 68;
  export const DRIDER_PARALYSIS = 69;
  export const STRONG_POISON_ATTACK = 70;
  /* Dust of Disappearance: a stronger form of invisibility than INVISIBLE; camp lists it as Invisible. */
  export const DUST_OF_DISAPPEARANCE = 71;
  export const CAMOUFLAGE = 72;
  export const REAR_CLAW_RAKE = 73;
  export const BITE_HOLD = 74;
  export const BLOOD_DRAIN = 75;
  export const BLOOD_ATTACH = 76;
  /* EffBiteHold applies BITE_HOLD. */
  export const BITE_ATTACH = 77;
  export const HEAL_WAKE = 78;
  export const FIRE_TOUCH = 79;
  export const ACID_SQUIRT = 80;
  export const DRAGON_FEAR = 81;
  export const MUMMY_FEAR = 82;
  export const PETRIFYING_GAZE = 83;
  export const CHARM_GAZE = 84;
  export const DRAIN_ONE = 85;
  export const DRAIN_TWO = 86;
  export const ROT_TOUCH = 87;
  export const DRAGON_BREATH = 88;
  export const DISPLACED = 89;
  export const CONSTITUTION_POISON_SAVE = 90;
  export const IMMUNE_MAGIC_MISSILE = 91;
  export const HALF_FIRE = 93;
  export const HALF_BASHING = 94;
  export const FIGHT_ON = 95;
  export const NEED_SILVER = 96;
  export const CONSTITUTION_SPELL_SAVE = 97;
  export const REGENERATION = 98;
  export const CAN_FIGHT_ON = 99;
  export const TROLL_BURN = 100;
  export const TROLL_HEAL = 101;
  export const GASEOUS = 103;
  export const KREEN_DODGE = 104;
  export const STRONG_MAGIC_RESISTANCE = 105;
  export const WEAK_MAGIC_RESISTANCE = 106;
  export const ELF_RESISTANCE = 107;
  export const NO_SLEEP_CHARM = 108;
  export const NO_PARALYSIS = 109;
  export const NO_COLD = 110;
  export const NO_PARALYSIS_POISON = 111;
  export const NO_FIRE = 112;
  export const EFREETI_FIRE = 113;
  export const HALF_ELECTRICITY = 114;
  export const HALF_PIERCING = 115;
  export const HALF_MAGICAL = 116;
  export const HOLY_WATER = 117;
  export const HALF_COLD = 118;
  export const NEED_MAGIC = 119;
  export const BOULDER_DODGE = 120;
  export const ANKHEG_ACID = 121;
  export const MUMMY_FIRE = 122;
  export const SILVER_MAGIC = 123;
  export const HALF_ELF_RESISTANCE = 124;
  export const NO_CHARM_POISON = 125;
  export const GAZE_BLOCK = 126;
  export const ALIGNED_WEAPON = 132;
  /* Spiritual Hammer TItemRec.special, run when unreadied */
  export const SPIRITUAL_HAMMER_GONE = 137;
  /* Ring of Invisibility, effect 56 */
  export const READY_RING_OF_INVISIBILITY = 139;
}

// Saving throw categories

export namespace Save {
  // Saving-throw categories in AD&D 1e order: indices into TCharRecord.saves and the saveType argument of FxEngine.RollSavingThrow

  // paralyzation / poison / death magic
  export const PARALYZATION = 0;
  // petrification / polymorph
  export const PETRIFICATION = 1;
  // breath weapon
  export const BREATH_WEAPON = 3;
  // spell
  export const SPELL = 4;
}

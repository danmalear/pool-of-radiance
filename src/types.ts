// Types shared between units or used by the game's storage: the character, combat, effect and item records, the GBVM
//   zone layouts, and the records behind the rule tables.
// {$F+}

export namespace Types {
	export type TStr40 = string; //40
	export type TBaseItemRec = {
		// equip slot
		slot: number;
		// hands required
		hands: number;
		// damage vs large: dice number
		dmgLgRolls: number;
		// damage vs large: dice sides
		dmgLgDice: number;
		// damage vs large: bonus
		dmgLgMod: number;
		// ranged rate of fire x2
		rateOfFire: number;
		// AC adjustment descriptor
		acDescr: string;
		// melee damage type: EffHndlr.SLASHING, PIERCING or BASHING
		wpnClass: number;
		// reserved
		weaponFlag: number;
		// damage vs small/medium: dice number
		dmgSmRolls: number;
		// damage vs small/medium: dice sides
		dmgSmDice: number;
		// damage vs small/medium: bonus
		dmgSmMod: number;
		// ranged range (exclusive)
		range: number;
		// class usability bitmask
		classMask: number;
		// weapon-property bitmask; see the PROP_ bits of C_Item and CharHlp.ITEM_PROP_DEX_MISSILE }
		props: number;
		// reserved
		entryTail: number;
	};
	export type TIconCols = number[]; //6
	export type TCharRecordBase = {
		// character name
		name: string;
	};
	export type TCharRecord0 = TCharRecordBase & {
		// strength
		strCur: number;
		// intelligence
		intCur: number;
		// wisdom
		wisCur: number;
		// dexterity
		dexCur: number;
		// constitution
		conCur: number;
		// charisma
		chaCur: number;
		// exceptional strength (18/xx pct)
		strExc: number;
		// currently memorized
		memorizedSpells: number[]; // 20
		// camp writes the hours code 0/4/6, rest counts it down
		spellPrepTime: number;
		// base THAC0
		thac0Base: number;
		// Race.
		race: number;
		charClass: number;
		age: number;
		// hit points maximum
		hpMax: number;
		// Known spells, indexed by spell ID.
		spellsKnown: number[]; //56
		attackLevel: number;
		iconDimensions: number;
		// Saving throws: paralysis, petrification, wand, breath and spell.
		saves: number[]; // namespace Save for indexes
		movementBase: number;
		// Highest level across the character's classes.
		levelHighest: number;
		drainedLevels: number;
		drainedHps: number;
		// Undead level for turning.
		levelUndead: number;
		// Thief skill values.
		thiefSkills: number[]; //8
		// far ptr to effects list
		effectsAddr: TEffectRec;
		// reserved
		afterEffects: number;
		// packed -- see C_Npc
		npc: number;
		// Low three bits hold the NPC's treasure-share weight.
		npcTreasureShare: number;
		// reserved
		afterTreasureShare: number;
		// reserved
		beforeCoins: number;
		// Coins: copper, silver, electrum, gold, platinum, gems and jewelry.
		coins: number[]; //namespace Money as index
		// Class levels; indexed by the C_Class level slots.
		classLevels: number[]; //namespace Class as index
		// Gender; see C_Gender.
		gender: number;
		charType: number;
		alignment: number;
		// attacks per round
		attacks: number;
		attacks2: number;
		// unarmed dice rolls
		unarmedRollsA: number[]; //2
		// unarmed dice sides
		unarmedDiceA: number[]; //2
		// unarmed dmg mods
		unarmedModA: number[]; //2
		acBase: number;
		// strength to-hit/damage applies
		useStrength: number;
		// Random duplicate-detection key assigned at creation. The roster loader rejects characters whose name and key both
		// match a party member.
		randnumber: number;
		experience: number;
		itemLimits: number;
		hpRolled: number;
		// Cleric spell slots by level, including wisdom bonuses.
		clericSpells: number[]; //3
		mageSpells: number[]; //3
		xpAward: number;
		xpBonusPerHp: number;
		portraitHead: number;
		portraitBody: number;
		iconHead: number;
		iconBody: number;
		orderNumber: number;
		iconSize: number;
		// Color pairs: body, arm, leg, hair, shield and weapon.
		iconColors: number[]; //5
		numberOfItems: number;
		// far ptr to item list
		itemsAddr: TItemRec;
		// Readied items, indexed by C_Equip.
		equipped: TItemRec[]; //namespace Equip as index
		handsEquipped: number;
		// accumulated save bonus (signed)
		saveBonus: number;
		encumbrance: number;
		// far ptr to next character
		nextCharAddr: TCharRecord;
		// far ptr to combatant
		combatAddr: TCombatRec;
		status: number; //0-127
		enabled: number;
		hostile: number;
		quickfight: number;
		// current THAC0
		thac0Cur: number;
		// current AC
		acCur: number;
		acBehind: number;
		curAttacks: number;
		curAttacks2: number;
		// current dice rolls
		curRollsA: number[]; //2
		// current dice sides
		curDiceA: number[]; //2
		// current dmg mods
		curModA: number[]; //2
		// current hit points
		hpCur: number;
		// current movement
		movementCur: number;
	};
	export type TCharRecord1 = TCharRecordBase & {
		// Current attributes as an array for character creation and display.
		stats: number[]; //namespace Ability as index
	};
	export type TCharRecord2 = TCharRecordBase & {
		// skips to gender
		beforeGender: number[]; //141
		// Signed gender value used to index racial strength limits.
		genderSp: number;
	};
	export type TCharRecord3 = TCharRecordBase & {
		// skips to iconColors
		beforeIconColors: number[]; //176
		// One-based icon-color array for character customization and saving.
		iconColors1: TIconCols;
	};
	export type TCharRecord4 = TCharRecordBase & {
		// skips to clericSpells
		beforeSlots: number[]; //161
		// Spell slots indexed by casting class and level.
		slots: number[]; //1, 3
	};
	export type TCharRecord5 = TCharRecordBase & {
		// skips to gender
		beforeGenderIdx: number[]; //141
		// gender as a 0-127 subrange -- ViewChar indexes genderNames with it
		genderIdx: number; //0-127
		// charType
		charTypeIdx: number;
		// alignment as a 0-127 subrange -- ViewChar indexes alignNames with it
		alignmentIdx: number; //0-127
	};
	export type TCharRecord6 = TCharRecordBase & {
		// skips to acCur
		beforeAcCurArr: number[]; //256
		// Current and rear armor class.
		acCurArr: number[]; //1
		// curAttacks and curAttacks2, by attack phase
		curAttacksArr: number[]; //1-2
	};

	export type TCharRecord =
		| TCharRecord0
		| TCharRecord1
		| TCharRecord2
		| TCharRecord3
		| TCharRecord4
		| TCharRecord5
		| TCharRecord6;
	export type TCombatRec = {
		// spell being cast
		spellCast: number;
		// may cast this round
		castAllowed: number;
		// may use an item this round
		itemUseAllowed: number;
		// signed (Combat.NextCreature and CreatureAction compare signed); cleared on death and by EndActions
		initiative: number;
		attackPhase: number;
		// sweep allowance (attackLevel)
		sweepBudget: number;
		// movement left this round
		movement: number;
		// guarding flag
		guarding: number;
		madeAttack: number;
		// facing 0-7
		direction: number;
		// opponent/target
		other: TCharRecord;
		// damage past 0 hp (dying)
		overkill: number;
		// attackers this round
		flankCount: number;
		// undead-turned flag
		turned: number;
		usedTurnUndead: number;
		// summed offset from facing, mod 8
		flankSpread: number;
		notPcNpc: number;
		fleeing: number;
		// AI approach-pattern index 1-6
		aiStance: number;
	};
	export type TDownedRec = {
		// the downed creature
		cr: TCharRecord;
		// Corpse cell coordinates.
		x: number;
		y: number;
		// cell terrain saved from under it
		terrain: number;
	};
	export type TEffectRec = {
		// effect id
		id: number;
		// minutes; 0 = permanent -- blood drain packs a damage budget in the upper bits
		duration: number;
		// strength; handlers pack flags in the nibbles, and the hold family stores a creature index here
		strength: number;
		// removal calls the handler
		onRemove: Boolean;
		// next effect
		next: TEffectRec;
	};
	// { One line of a list MenuCore.MenuVertical shows. Its fields are the leading fields of TItemRec, so an item list is
	//   shown in place and a line that is never an item is allocated at this size. }
	export type TMenuNode = {
		// the line's text
		name: string[40];
		// Nonzero marks a menu-list title.
		inUse: number;
		// the next line, nil after the last
		next: TItemRec;
	};
	export type TItemRecBase = {
		// item name
		name: string[40];
		// Nonzero marks a menu-list title; zero for inventory items.
		inUse: number;
		// next item in inventory list
		next: TItemRec;
		// base-item index (into baseItems)
		itemType: number;
		// identified name components [1]=component 3, [2]=2, [3]=1
		nameIds: number[]; //1-3
		// magical bonus
		plus: number;
		// saving throw bonus
		saveBonus: number;
		// 0 = unequipped, 1 = equipped
		equipped: number;
		// Unidentified name-component mask.
		unidMask: number;
		cursed: number;
		// weight in coins
		weight: number;
		// 0 = single, non-stacking
		quantity: number;
		// value in gold pieces
		value: number;
	};
	export type TItemRec0 = TItemRecBase & {
		// properties (scroll spells / charges)
		charges: number;
		// effect id
		effect: number;
		// special-item id
		special: number;
	};
	export type TItemRec1 = {
		// scroll spell slots
		spells: number[]; //1-3
	};
	export type TItemRec = TItemRec0 | TItemRec1;
	export type TArenaLoc = {
		// Arena coordinates.
		x: number;
		y: number;
		// Registration slot stored by CombatSt.
		slotIndex: number;
		// icon footprint, zero marks out of play
		size: number;
	};
	// constant rowBand entries
	export type TBandRec = {
		// valid row range
		lo: number;
		hi: number;
	};
	export type TBrkSet = string[];
	export type Tnumbers = number[]; //0-65000
	export type TColorMap = number[]; //0-7
	export type TColorTab = number[]; //0-15 namespace Crt
	export type TCombatTarget = {
		// arena registration index
		idx: number;
		// doubled walk distance from the acting creature
		dist: number;
		// best facing direction
		dir: number;
	};
	export type TIconCoordinateDelta = {
		// cell X offset; negative marks an absent footprint cell
		dx: number;
		// cell Y offset
		dy: number;
	};
	export type TImgBuf = {
		// image height in pixels
		height: number;
		// image width in CHARS (x8 for pixels)
		width: number;
		// image placement X from DAX header
		originX: number;
		// image placement Y from DAX header
		originY: number;
		// images in buffer
		count: number;
		// EGA->CGA color map
		map: TColorMap;
		// numbers in one image
		imgSize: number;
		// extra transparency space (default nil)
		transp: Tnumbers;
		// image data (open-ended)
		data: number[]; //0-32000
	};
	// Krynn class rules SSI left behind (not all of its Krynn declarations were compiled out); PoR never uses them.
	export type TKrynnClassRules = {
		// class/item-usability masks
		createClassBits: number[]; //0-7
		afterCreateClassBits: number;
		// class selection masks
		classBits: number[]; //0-7
		afterClassBits: number[]; //0-8
		// hit-dice cap plus one
		maxClassLevels: number[]; //0-7
	};
	// main-menu entry
	export type TMenuItem = {
		// first character is the hotkey
		name: string[40];
		// MainMenu updates availability
		enabled: number;
	};
	export type TName15 = string;
	export type TRandomItemTemplate = {
		// low numbers copied to TItemRec nameIds (components 3, 2, 1)
		nameIds: number[]; //1-3
		// copied to TItemRec weight (coins) and value (gold pieces)
		weight: number;
		value: number;
		// low numbers copied to TItemRec charges/effect/special
		properties: number[]; //1-3
	};
	export type TWordnumbers = {
		lo: number;
		hi: number;
	};
	// The random item templates, which GenerateRandomItem also reads as one run of words, and of their low numbers, from a
	//   one-based word index. Template n starts at word 8n - 7; word 144 is not a template start: it spans the last word of
	//   template 18 and the first seven of template 19.
	export type TRandomItemTable0 = {
		templates: TRandomItemTemplate[]; //1-19
	};
	export type TRandomItemTable1 = {
		words: number[]; //1-152
	};
	export type TRandomItemTable2 = {
		wordnumbers: TWordnumbers[]; //1-152
	};
	export type TRandomItemTable =
		| TRandomItemTable0
		| TRandomItemTable1
		| TRandomItemTable2;
	export type TRuleAge = {
		// years before the dice roll
		base: number;
		// dice count
		num: number;
		// dice sides
		sides: number;
	};
	export type TRuleGold = {
		// CharGen awards ten gold per point, averaged over the classes
		num: number;
		sides: number;
	};
	// racial ability limits (GDConsts.raceStatLimits)
	export type TRuleRace = {
		// by gender
		strMin: number[]; //C_Gender.MALE-C_Gender.FEMALE
		strMax: number[]; //C_Gender.MALE-C_Gender.FEMALE
		// exceptional-Str cap
		excMax: number[]; //C_Gender.MALE-C_Gender.FEMALE
		intMin: number;
		intMax: number;
		wisMin: number;
		wisMax: number;
		dexMin: number;
		dexMax: number;
		conMin: number;
		conMax: number;
		chaMin: number;
		chaMax: number;
	};
	export type TRuleXp = {
		// XP to reach level; -1 = unavailable
		xp: number[]; //2-9
		// class level, spell level
		slots: number[][]; // 2-9, 1-3
	};
	export type TSpecLoc = {
		x: number;
		y: number;
		icon: number;
	};
	export type TTerrainRec = {
		// movement cost multiplier and passability threshold
		cost: number;
		// initial line-walk clearance
		clearance: number;
		// compared against line-walk clearance
		blocking: number;
		// combat tile graphic index
		tileId: number;
	};
	export type TTurnUndeadTable = number /* 1-10 */[] /* 1-10 */[];
	export type TViewSlotGeom = {
		start: number[]; //0-9
		cols: number[]; //0-9
		rows: number[]; //0-9
		xCol: number[]; //0-9
		yRow: number[]; //0-9
	};
	export type TWallSetCacheSlot = {
		// cached WALLDEF reload ID; -1 invalidates the slot
		wallDefId: number;
		// destination 8x8 slot, also invalidated with -1
		symbolSlot: number;
	};
	// The party's position: GameInit clears it and SaveLoad saves and restores it as one block.
	export type TPartyPosition = {
		// The party's map column; signed for the edge and wrap checks.
		mapX: number;
		// The party's map row.
		mapY: number;
		// The party's facing.
		facing: number;
		// The wall in front of the party on its square.
		wallAhead: number;
		// The event number of the party's square; bit 7 is a flag, not a wall.
		eventAtCell: number;
	};

	// GBVM zone types.
	// A seven-word GBVM clock.
	export type TClock = number[]; //0-6
	export type TGbvmClock0 = {
		values: TClock;
	};
	export type TGbvmClock1 = {
		segment: number;
		minute: number;
		turn: number;
		hour: number;
		day: number;
		month: number;
		year: number;
	};
	export type TGbvmClock = TGbvmClock0 | TGbvmClock1;
	export type TGbvmSavedWalls0 = {
		wallSetIds: number[]; //1-3
		symbolSlots: number[]; //1-3;
	};
	export type TGbvmSavedWalls1 = {
		menuPrefix: number[]; //1-5
		// Shares symbolSlots[3].
		menuAnimation: number;
	};
	export type TGbvmSavedWalls = TGbvmSavedWalls0 | TGbvmSavedWalls1;
	export type TGbvmWord0 = {
		value: number;
	};
	export type TGbvmWord1 = {
		lo: number;
		hi: number;
	};
	export type TGbvmWord = TGbvmWord0 | TGbvmWord1;
	export type TGbvmZone0 = number[]; //$4900-$4CFF
	export type TGbvmZone0State0 = {
		words: TGbvmZone0;
	};
	export type TGbvmZone0State1 = {
		numbers: number[]; //0-2047
	};
	export type TGbvmZone0State2 = {
		scriptWordsBeforePartyX: number[]; //$4900-$49C2
		partyX: TGbvmWord;
		partyY: TGbvmWord;
		mapId: TGbvmWord;
		clock: TGbvmClock;
		scriptWordsAfterClock: number[]; //$49CD-$49E4
		// Nonzero forbids spellcasting here.
		antimagic: number;
		// { Nonzero when a 3D map is loaded, including indoor areas and town streets; zero in the wilderness. This selects
		//   wall graphics or the wilderness backdrop. }
		view3dFlag: number;
		mapGraphics1: number;
		// With mapGraphics1, controls the combined wall load.
		mapGraphics2: number;
		scriptWordsAfterMapGraphics: number[]; //$49E9-$49EF
		previousX: number;
		previousY: number;
		previousScriptId: number;
		scriptWordsAfterPreviousScript: number[]; //$49F3-$49FA
		// 1 disables the automap.
		noAutomap: number;
		gameSpeed: TGbvmWord;
		skyCeilingColor: number;
		alternateSkyColor: number;
		// Twice the monster-picture flag plus the portrait flag.
		settings: number;
		// Cleared on a fresh script entry.
		entryWords: number[]; //$4A00-$4A1F
		scriptWordsAfterEntry: number[]; //$4A20-$4A7B
		// Bit 3 enables the camp icon.
		nomadCampFlags: number;
		scriptWordsAfterCampFlags: number[]; //$4A7D-$4A8B
		buccaneersBaseGate: number;
		scriptWordsAfterBaseGate: number[]; //$4A8D-$4A9E
		// Zero enables the camp icon.
		nomadCampGate: number;
		// Bits 0 and 1 hide the keep and caves.
		easternSitesGate: number;
		scriptWordAfterSitesGate: number;
		// Quest: the party left the Yarash pyramid, cleared.
		yarashPyramidLeft: number;
		scriptWordsAfterPyramidLeft: number[]; //$4AA3-$4AB2
		// Quest: the Yarash mission succeeded.
		yarashMissionDone: number;
		scriptWordsAfterMissionDone: number[]; //$4AB4-$4AD1
		// Nonzero enables the camp icon.
		nomadCampPresent: number;
		scriptWordsAfterCampPresent: number[]; //$4AD3-$4AF9
		savedWalls: TGbvmSavedWalls;
		scriptWordsAfterSavedWalls: number[]; //$4B00-$4CFF;
	};
	export type TGbvmZone0State =
		| TGbvmZone0State0
		| TGbvmZone0State1
		| TGbvmZone0State2;
	export type TGbvmZone1 = number[]; //$6B00-$6EFF

	// Blit types.
	export type TVideoMode = 'Cga' | 'Ega' | 'Tandy';

	// Border types.
	export type TCgaBank = number[][]; // 0-99, 0-79
	export type TTandyBank = number[][]; // 0-49, 0-159

	// CbtMap types.
	export type TArena = {
		// reserved
		header: number;
		headerTail: number;
		// Upper-left cell of the view.
		ox: number;
		oy: number;
		// draw the cursor sprite
		cursorOn: Boolean;
		// cursor icon size
		cursorSize: number;
		// line-walk distance mode (Pathing.WalkLine)
		distMode: number;
		// terrain-info indices
		cells: number[][]; // 0-24, 0-49
	};

	// Spell and downed-{ types.
	export type TSpellRec0 = {
		// 0 cleric / 1 mage / 2 item/special
		castClass: number;
		// spell level
		level: number;
		// base range, 255 = attack roll
		rangeFixed: number;
		// range per caster level
		rangeVar: number;
		// base duration
		durFixed: number;
		// duration per caster level
		durVar: number;
		// packed: low nibble area mode, high nibble radius
		area: number;
		// targeting mode
		target: number;
		// saving-throw result; Magic reads it as Boolean saveEffect
		saveResult: number;
		// saving-throw column 0-4
		saveType: number;
		// effect id added on a hit
		effect: number;
		// 0 noncombat / 1 combat / 2 either
		whenCast: number;
		// casting time
		castTime: number;
		// 0-7, 0 = AI never casts
		aiPriority: number;
		// 1 = offensive
		offensive: number;
		// friendly-fire scan radius
		aiRadius: number;
	};
	export type TSpellRec1 = {
		// Signed class and level view.
		castClassSp: number;
		levelSp: number;
	};
	export type TSpellRec2 = {
		// castClass-target
		savePrefix: number[]; //0-7
		// Boolean view of saveResult
		saveEffect: Boolean;
	};
	export type TSpellRec = TSpellRec0 | TSpellRec1 | TSpellRec2;

	// Combat types.

	// CombatSt types.
	export type TPortSlot = {
		pictureId: number;
		pic: TImgBuf;
	};

	// DaxIo types.
	export type TnumberArr = number[]; //0-65534

	// EclMenu types.
	export type TEclRet = {
		// return GBVM address
		addr: number;
		// node below
		next: TEclRet;
	};
	export type TMonFlags = boolean[]; //0-1
	export type TZone2 = number[]; //$9700-$98FF
	export type TZone3 = number[]; //$9900-$B6FF

	// EffHndlr types.
	export type TEffectHandler = (
		creature: TCharRecord,
		effectData: unknown,
		removed: boolean,
	) => void;

	// MenuCore types.
	export type TMenuAuto = {
		// centiseconds before auto-answer, 0=off
		timeout: number;
		// the auto-answer key
		key: string;
	};

	// Money types.
	export type TMoney = number[]; // C_Money.COPPER-C_Money.JEWELRY

	// Pathing types.
	export type TPathReq = {
		// start / end points
		sx: number;
		sy: number;
		ex: number;
		ey: number;
		// Bresenham error term
		err: number;
		// horizontal extent of the line
		adx: number;
		// vertical extent of the line
		ady: number;
		// error bump on a diagonal step
		incD: number;
		// error bump on a straight step
		incS: number;
		// x step sign (-1/0/1)
		stepX: number;
		// y step sign (-1/0/1)
		stepY: number;
		// Current line position.
		cx: number;
		cy: number;
		// doubled distance walked
		dist: number;
		// direction of last step (0-8)
		step: number;
	};

	// Portrait types.
	export type TAnimFrame = {
		// How long the frame stays up, from the file.
		time: number;
		pic: TImgBuf;
	};
	export type TAnimRec = {
		// frames actually loaded
		count: number;
		// Frame shown, counting from 1; LoadAnimation sets it to 1 and the animation loops advance it.
		current: number;
		frames: TAnimFrame[]; // 1-8
	};
	export type TStr8 = string; // 8

	// Magic types.
	export type TCastUi = (spell: number, b: boolean, sel: boolean) => void;
	export type TSpellProc = () => void;
	// The spell handlers: the target picker the casting code calls, then the handler of each spell.
	export type TSpellHandlers = {
		castTargets: TCastUi;
		spells: TSpellProc[]; //1-67
	};
	export type TStinkRec = {
		caster: TCharRecord;
		next: TStinkRec;
		under: number[]; //1-4
		exists: number[]; //1-4
		// target X
		ulX: number;
		// target Y
		ulY: number;
		// caster cloud #
		idx: number;
	};

	// TextRend types.
	export type TFontArr = number[][]; // 0-176, 0-7

	// View3D types.
	export type TGeoPlane = number[][]; // 0-15, 0-15
	export type TGeoMap = {
		// N = high nibble, E = low
		wallsNorthEast: TGeoPlane;
		// S = high nibble, W = low
		wallsSouthWest: TGeoPlane;
		events: TGeoPlane;
		// 2 bits per facing
		barriers: TGeoPlane;
	};
	export type TView3dWallDef = number[][]; // 1-5, 0-155
	export type TWallDefs = TView3dWallDef[]; // 1-3
	export type TWallSlices = number[][]; // 1-15, 0-155
	// The wall graphics: three wall definitions of five slices each, which the 3D view draws as fifteen slices.
	export type TWallGfx0 = {
		defs: TWallDefs;
	};
	export type TWallGfx1 = {
		slices: TWallSlices;
	};
	export type TWallGfx = TWallGfx0 | TWallGfx1;

	export type TWheelRec = {
		answer: string; //6
		// Outer-ring rune pair.
		espruar: number[]; //2
		// Inner-ring rune pair; C_Rune.NONE omits the second glyph.
		dethek: number[]; //2
		path: string;
	};

	// { The register block for software interrupts, laid out as Dos.Registers so storage can hold one without using Dos;
	//   callers pass it to Intr as a Registers. }
	export type TRegisters0 = {
		ax: number;
		bx: number;
		cx: number;
		dx: number;
		bp: number;
		si: number;
		di: number;
		ds: number;
		es: number;
		flags: number;
	};
	export type TRegisters1 = {
		al: number;
		ah: number;
		bl: number;
		bh: number;
		cl: number;
		ch: number;
		dl: number;
		dh: number;
	};
	export type TRegisters = TRegisters0 | TRegisters1;
}

/* Global variables: the game's variables in storage order, grouped in sections by subsystem. A new section starts
  wherever the data needs a word boundary. */
import { Types } from './types.ts';

export type GdVars = {
	/* Script interpreter run state, combat results and the combat AI's movement state. */
	/* Set to stop the script interpreter and hand control back to the player. */
	eclStop: number | null;
	/* Set by NEWECL; the game loop then calls NewEclDone. */
	newEclFlag: number | null;
	/* Set by LOAD CHARACTER, so that curChar is restored from savedChar afterwards. */
	restoreChar: number | null;
	/* Set once LOAD FILES or LOAD PIECES has run, whether or not the load succeeded. */
	filesLoaded: number | null;
	/* Set while the first LOAD FILES and LOAD PIECES pair of an area still has to draw the interface. */
	enteringLoop: number | null;
	/* Set once LOAD PIECES has run, whether or not the load succeeded. */
	piecesLoaded: number | null;
	/* Set once LOAD FILES has run, whether or not the load succeeded. */
	mapLoaded: number | null;
	/* Monsters added by LOAD MONSTER since CLEAR MONSTERS; LOAD MONSTER stops adding at 63. */
	creatureCnt: number | null;
	/* The current character saved before a script step or LOAD CHARACTER, restored into curChar afterwards. */
	savedChar: Types.TCharRecord | null;
	/* Set by DetermineLootExp when it finds a hostile that did not run away; the summary then reports a win. */
	nonEscapedHostileFound: boolean | null;
	/* Set by DetermineCombatResults when a party member ran and no member is still standing. */
	partyFled: boolean | null;
	/* Direction of the AI's last step this turn; 8 before the first step. */
	lastMoveDir: number | null;
	/* Times this turn the AI reversed direction or found no way forward. */
	stuckCount: number | null;
	/* Cleared at the start of each move and attack loop; never read. */
	aiMoveState: number | null;

	/* Combat placement: the free placement quads and the grid origin of each team. */
	/* Placement quads by team (0 = party, 1 = hostiles), ring 0..3, quad row and quad column; 1 while the quad is free. */
	quadFree: number /* 0-1 */[] /* 0-3 */[] /* 0-5 */[] /* 0-10 */[] | null;
	/* Each team's grid origin across, in cells from the party: 0 for the party, the monster distance along the party's
    facing for the hostiles. */
	placeX: number /* 0..1 */[] | null;
	/* Each team's grid origin down, in cells from the party, set like placeX. */
	placeY: number /* 0..1 */[] | null;
	/* Length of each team's first placement leg: half the team's size, rounded up. */
	teamRows: number /* 0..1 */[] | null;
	/* The quadrant each team faces, 0..3: the party's facing halved for the party, the opposite facing for the hostiles. */
	teamDir: number /* 0..1 */[] | null;
	/* The team being placed. */
	team: number | null;

	/* Wilderness combat terrain. */
	/* The wilderness map cell under the party, which picks the terrain of a wilderness arena. */
	terrainChar: number | null;

	/* Start-up loop counter. */
	/* InitializeGame's loop counter for the scanline tables. */
	gi2: number | null;

	/* Start-up resource loading and the STING training override. */
	/* unused */
	maskIdx: number | null;
	/* Whether OpenWithRetry found the ITEMS file. */
	itemsOk: boolean | null;
	/* The directory to return to once the resources are loaded. */
	savedDir: string /* [40] */ | null;
	/* unused */
	savedDirTail: number /* 0..1 */[] | null;
	/* The ITEMS file while it is read. */
	itemsFile: unknown | null; //file
	/* Nonzero once J is chosen at the main menu with STING on the command line; training then skips its checks. */
	stingMode: number | null;

	/* The end-game pictures. */
	/* The FINAL picture being shown; WinGame hands it to Blit.LoadPic. */
	finalPic: Types.TImgBuf | null;
	/* ifcState saved while the end-game pictures run. */
	savedIfc: number | null;
	/* The virtual disk digit appended to the FINAL picture names. */
	finalSfx: string /* [1] */ | null;

	/* Character menus, timed effects, spell and scroll selection, the configuration file, the play session, the GBVM zones
  and the interface state. */
	/* The character DisplayChar shows, saved while it runs. */
	tempCr1: Types.TCharRecord | null;
	/* The character chosen to trade with; reset when ViewCharMenu opens. */
	tempCr2: Types.TCharRecord | null;
	/* Creatures whose timed effects need processing, by place in the creature list. */
	effFlags: number /* 1..72 */[] | null;
	/* The spell menu's entries, built by GenerateSpellList and freed when the menu closes. */
	spellList: Types.TItemRec | null;
	/* The spell id of each spell menu line. */
	spellIds: number /* 0..20 */[] | null;
	/* The item each scroll spell menu line comes from, so the chosen line's scroll becomes castItem. */
	scrollPtrs: Types.TItemRec /* 0..48 */[] | null;
	/* Lines filled in scrollPtrs. */
	scrollCount: number | null;
	/* Working value of the spell being resolved: the Strength that Strength sets, the hit dice Sleep has left, the hit
    points Snake Charm has left. */
	spellScratch: number | null;
	/* Second working value of the spell being resolved: the exceptional Strength that Strength sets, the cost of the
    creature Sleep is trying. */
	spellScratch2: number | null;
	/* Weight of the current character's readied items. */
	equippedWeight: number | null;
	/* HeapEnd as GameBoot lowers it to reserve graphics memory. */
	gfxReserve: unknown | null;
	/* A character read from POOL.CFG or the keyboard while the configuration is read. */
	cfgChar: string | null;
	/* POOL.CFG, read line by line. */
	cfgText: Text | null;
	/* POOL.CFG, opened to see whether it exists. */
	cfgFile: unknown | null; //file
	/* IOResult of opening POOL.CFG. */
	cfgErr: number | null;
	/* IOResult of DaxIo.FileExists. */
	ioErr: number | null;
	/* Nonzero makes HeapErr force a save before returning to DOS; never set. */
	heapFailureSaveEnabled: number | null;
	/* False stops the title sequence after its first picture (POOL.CFG line 5 is not 'F'). */
	fullIntro: boolean | null;
	/* GBVM word bank 0. */
	zone0: Types.TGbvmZone0State | null;
	/* GBVM word bank 1, indexed directly by GBVM address (the zone-1 C_Gbvm constants). */
	zone1: Types.TGbvmZone1 | null;
	/* GBVM word bank 2. */
	zone2: Types.TZone2 | null;
	/* The running area script's bytes. */
	zone3: Types.TZone3 | null;
	/* Game speed, 0 fastest to 9 slowest; SaveLoad keeps it in the GBVM gameSpeed word. */
	gameDelay: number | null;
	/* The five entry points from the script header: [1] runs before each move and after on-load, [2] on search and Look,
    [3] before camp, [4] when camp is interrupted, [5] on load. */
	scriptEntryAddrs: number /* 1..5 */[] | null;
	/* The script interpreter's instruction pointer into zone3. */
	eclIp: number | null;
	/* reserved */
	eclIpTail: number /* 0..3 */[] | null;
	/* Interface state: one of the C_Ifc constants, or Ending.IFC_WON_GAME. */
	ifcState: number | null;
	/* Nonzero suppresses Combat's Continue Battle prompt. */
	suppressContinuePrompt: number | null;
	/* Zero turns off the portraits ViewChar draws from disk 3. */
	portraitsOn: number | null;
	/* Zero skips the monster close-up while an ENCOUNTER MENU is up (inEncMenu). */
	monsterPics: number | null;
	/* Nonzero makes Debug.PrintDebug show hit points; GameIo toggles it on STING Ctrl-D and GameInit clears it. */
	stingHpFlag: number | null;
	/* Set when the main menu has just loaded a saved game, so EclVm does not reload the area; EclMenu clears it. */
	loadedSave: number | null;
	/* The party's location type before the last change of area. */
	locTypePrev: number | null;
	/* The party's location type, one of the C_Area LOC_ constants. */
	locType: number | null;
	/* Rest time without an interruption, counted against the GBVM's safe-rest time. */
	restTicks: number | null;
	/* Portrait head id. */
	portraitHead: number | null;
	/* Portrait body id. */
	portraitBody: number | null;
	/* Set by DetermineCombatResults, and by the script's defeat check, when no party member is left standing. */
	partyDefeated: boolean | null;
	/* Nonzero delays each message printed to the message window. */
	msgDelayFlag: number | null;

	/* The BIOS register record, the EGA pages and the video modes. */
	/* Register record handed to Dos.Intr for the BIOS video calls; every unit calling the BIOS uses this one record. */
	interruptRegs: Types.TRegisters | null;
	/* EGA segment of the page on display. */
	egaCurPage: number | null;
	/* EGA segment of the other page, which TextRend and the rectangle fills draw into. */
	egaOtherPage: number | null;
	/* Number of the other EGA page. */
	pageNum: number | null;
	/* Number of the EGA page on display. */
	pageMain: number | null;
	/* BIOS mode queried at start-up, then the mode active before the latest Blit.SetVideoMode call; RestoreVideoMode
    returns to it. */
	savedVideoMode: number | null;
	/* BIOS mode queried at start-up, then the mode most recently set through Blit.SetVideoMode. */
	curVideoMode: number | null;
	/* The video mode from line 1 of POOL.CFG. */
	videoMode: Types.TVideoMode | null;

	/* The view buffer, its dirty spans and the per-scanline video address tables. */
	/* Off-screen 168x168 view buffer that the compositors draw into and Blit.FlushView copies to the screen; GameInit
    allocates it. */
	viewBuffer: Types.TImgBuf | null;
	/* Backdrop buffer that Blit.BlitTileClipped fills with the bytes it is about to cover (when the save flag is set), so
    CharHlp can restore the background afterwards. */
	saveUnder: Types.TImgBuf | null;
	/* Nonzero when that view scanline holds changes that Blit.FlushView still has to copy to the screen; one slot per
    scanline, 21 character rows of 8. */
	spanActive: number /* 0..167 */[] | null;
	/* Horizontal byte offset in video memory where the dirty span begins; the screen-side counterpart of spanFirstOfs. */
	spanScreenOfs: number /* 0..167 */[] | null;
	/* Offset of the first dirty byte in the view buffer's image data. Reset to $FFFF when clean so any new span compares
    as earlier. */
	spanFirstOfs: number /* 0..167 */[] | null;
	/* Offset of the last dirty byte in the view buffer's image data. Reset to 0 when clean so any new span compares as
    later. */
	spanLastOfs: number /* 0..167 */[] | null;
	/* Video segment for each CGA scanline, precomputed so row writes need no bank arithmetic: even and odd rows interleave
    between the two CGA banks. */
	cgaRowSeg: number /* 0..199 */[] | null;
	/* Offset into the EGA video segment for each scanline; rows are 40 bytes apart. */
	fbRowOfs: number /* 0..199 */[] | null;
	/* Video segment for each Tandy scanline, precomputed like cgaRowSeg. */
	tandyRowSeg: number /* 0..199 */[] | null;
	/* Nonzero makes Blit.BlitTileClipped clip against the destination bounds; zero trusts the caller to have kept the tile
    inside. GameInit sets it to 1. */
	clipFlag: number | null;

	/* Sound, disks and directories, the item catalog, the party, the font and text cursor, symbol and tile sets, icon images
  and the combat arena. */
	/* Active sound device; GameBoot maps POOL.CFG line 2: 'T' = 0, 'P' = 1, else 2. */
	soundMode: number | null;
	/* soundMode saved while sound is suspended, so the configured mode is not lost. */
	soundSaved: number | null;
	/* Nonzero makes SoundDrv.SoundCommand wait a fixed delay after each command, then silence the voices and remove its
    timer; zero leaves the timer driver resident for persistent playback. */
	soundAutoStop: number | null;
	/* The resource disk in use; saved with the game. */
	virtualDisk: number | null;
	/* The disk DaxIo.PushState saved for PopState. */
	prevVirtualDisk: number | null;
	/* GameInit sets it to 1; otherwise unused. */
	saveDisk: number | null;
	/* The save directory, from line 4 of POOL.CFG. */
	saveDir: string | null;
	/* GameInit sets it to 1; otherwise unused. */
	gameDisk: number | null;
	/* The game directory, from line 3 of POOL.CFG; gameDir[1] is its drive letter. */
	gameDir: string | null;
	/* Not #0 suppresses the insert-disk prompt. */
	suppressDiskPrompt: string | null;
	/* Set by SaveLoad once a save completes; HeapErr and the Exit to DOS loop use it to tell whether a save succeeded. */
	recentSaved: number | null;
	/* Buffer for a compressed DAX block while it is expanded. */
	daxCompressedBuf: Types.TByteArr | null;
	/* Base item types, indexed by TItemRec.itemType. */
	baseItems: Types.TBaseItemRec /* 0..127 */[] | null;
	/* Unused; the ITEMS read takes 129 records, and the last one lands here. */
	baseItemsOverflow: Types.TBaseItemRec | null;
	/* The current creature. */
	curChar: Types.TCharRecord | null;
	/* Head of the creature list: the party, then any monsters. */
	creatureList: Types.TCharRecord | null;
	/* The last missile item added to the treasure in combat. */
	lastMissileItem: Types.TItemRec | null;
	/* unused */
	scratchFile: unknown | null; //file
	/* Bytes the ITEMS read returned. */
	itemsRead: number | null;
	/* The game font, eight bytes per character. */
	gameFont: Types.TFontArr | null;
	/* Text cursor column, shared by TextRend's message window and slow text. */
	curCol: number | null;
	/* Text cursor row, shared like curCol. */
	curRow: number | null;
	/* unused */
	curRowTail: number /* 0..19 */[] | null;
	/* The five 8x8 symbol-set images, by set id 0..4: Sym8x8.Load8x8Set loads an 8X8D picture into a slot and Put8x8Sym
    draws from it. */
	symbolSets: Types.TImgBuf /* 0..4 */[] | null;
	/* The symbol set Put8x8Sym draws from. */
	curSymbolSet: Types.TImgBuf | null;
	/* First 2D map tile set. */
	tileSetLow: Types.TImgBuf | null;
	/* Second 2D map tile set; bit 7 of a tile id selects it. */
	tileSetHigh: Types.TImgBuf | null;
	/* Animation images for the creature, death and cursor icons: frame 0 is the ready pose and frame 1 the action pose. */
	iconAnimation: Types.TImgBuf /* 0..25 */[] /* 0..1 */[] | null;
	/* Next free arena slot, also the inclusive limit of a scan. */
	arenaCount: number | null;
	/* Icon location and size per arena slot. */
	arenaLoc: Types.TArenaLoc /* 1..72 */[] | null;
	/* Each slot's column relative to the view. */
	gridX: number /* 1..72 */[] | null;
	/* Each slot's row relative to the view. */
	gridY: number /* 1..72 */[] | null;
	/* The arena slot standing on each arena cell. */
	crIdxArr: number /* 0..24 */[] /* 0..49 */[] | null;
	/* The creature in each arena slot. */
	creatureArr: Types.TCharRecord /* 1..72 */[] | null;
	/* Corpses lying on the arena. */
	downed: Types.TDownedRec /* 1..8 */[] | null;
	/* Entries used in downed, also its scan limit; a cleared entry leaves a hole. */
	downedCount: number | null;
	/* The combat viewport, which the renderers borrow. */
	arenaPtr: Types.TArena | null;
	/* Entries filled in targetList. */
	targetCount: number | null;
	/* Pathing's potential targets, sorted by distance and facing. */
	targetList: Types.TCombatTarget /* 1..72 */[] | null;

	/* Treasure, combatants per side and the state of the attack or effect being resolved. */
	/* Coins and jewelry in the treasure, copper through jewelry. */
	treasureMoney: Types.TMoney | null;
	/* Items in the treasure. */
	treasureItems: Types.TItemRec | null;
	/* Creatures still fighting on each side; combat ends when a side is empty. */
	teamCount: number /* 0..1 */[] | null;
	/* The saving throw roll after modifiers. */
	saveRoll: number | null;
	/* The effect about to be applied; cleared when the target is immune. */
	pendingEffectId: number | null;
	/* Damage about to be subtracted from the target's hit points. */
	pendingDamage: number | null;
	/* Damage elements of the attack: 1 fire, 2 cold, 4 electricity, 8 magic, 16 acid. */
	elementMask: number | null;
	/* The current attack count, or the current movement, doubled. */
	attackOrMoveX2: number | null;
	/* The spell being cast. */
	curSpell: number | null;
	/* Dice in the current damage roll. */
	damageDice: number | null;
	/* 1 while movement is being calculated. */
	calculatingMovement: number | null;
	/* Nonzero suppresses targeting. */
	suppressTargeting: number | null;
	/* Nonzero makes EffHndlr.AddEffectIfNoLock refuse to add an effect; set while the slow-poison hit is removed. */
	effectLock: number | null;
	/* Nonzero when the spell affects several targets. */
	multiTarget: number | null;
	/* Nonzero makes the inventory menu redraw. */
	redrawInventory: number | null;
	/* The attack roll: a d20, where 1 misses and 20 becomes 100; signed, because EffHndlr can set it to -1. */
	attackRoll: number | null;
	/* Hits this round with the first and second attacks; a rear-claw rake needs both first attacks to hit. */
	hitsMade: number /* 1..2 */[] | null;
	/* The current morale. */
	curMorale: number | null;
	/* The creature this one is interacting with. */
	otherCreature: Types.TCharRecord | null;
	/* Saving throw type, 0..4. */
	saveType: number | null;

	/* Effect handlers, the 3D view, the party's position, wall and portrait caches and menu state. */
	/* Effect handlers, indexed by effect id. */
	effectFns:
		| Types.TEffectHandler /* C_Effect.BLESS-C_Effect.READY_RING_OF_INVISIBILITY */[]
		| null;
	/* The wall symbol slices the 3D view draws from. */
	wallGfx: Types.TWallGfx | null;
	/* The 3D map: four 256-byte GEO planes, which View3D and Explore read through views. */
	map3d: Types.TGeoMap | null;
	/* Sky and ceiling color after palette mapping. */
	skyCeilingColor: number | null;
	/* 3D view color of the ceiling and horizon band; MapView recomputes the band colors from the script's color selectors
    after picRegionW is set. */
	ceilingBandColor: number | null;
	/* 3D view color of the middle band. */
	midBandColor: number | null;
	/* 3D view color of the floor and wall band. */
	floorBandColor: number | null;
	/* unused */
	bandColorsTail: number /* 0..71 */[] | null;
	/* Nonzero while the automap is shown in place of the 3D view. */
	automapOn: boolean | null;
	/* The party's position on the map. */
	partyPos: Types.TPartyPosition | null;
	/* The three WALLDEF wall sets loaded. */
	wallSetCache: Types.TWallSetCacheSlot /* 1..3 */[] | null;
	/* The picture animation. */
	animData: Types.TAnimRec | null;
	/* The HEAD and BODY image caches. */
	portraitCache: Types.TPortSlot /* 1..2 */[] | null;
	/* Name of the picture archive loaded. */
	picArcName: string /* [8] */ | null;
	/* Krynn data SSI left behind (not all of its Krynn declarations were compiled out); PoR never uses it. */
	champSavedPictureName: number /* 0..8 */[] | null;
	/* Picture id loaded from picArcName; 255 invalidates the pair. */
	picArcId: number | null;
	/* Krynn data SSI left behind (not all of its Krynn declarations were compiled out); PoR never uses it. */
	champSavedPictureState: number /* 0..11 */[] | null;
	/* Position of the first visible entry of a vertical menu, from 0. */
	vertTop: number | null;
	/* The highlighted choice of a horizontal menu, from 1; reset to 1 when out of range. */
	horizChoice: number | null;
	/* Set when the key that ended a horizontal menu was an extended key. */
	extFlag: boolean | null;

	/* The menu auto-answer and spell targeting. */
	/* The menu auto-answer: a timeout and the key to answer with. */
	menuAutoAnswer: Types.TMenuAuto | null;
	/* unused */
	menuAutoAnswerTail: number /* 0..76 */[] | null;
	/* The item a spell is cast from. */
	castItem: Types.TItemRec | null;
	/* The spell target picker and the spell handlers, indexed by spell id. */
	spellHandlers: Types.TSpellHandlers | null;
	/* Creatures in spellTargets. */
	spellTargetCount: number | null;
	/* The creatures the spell is aimed at. */
	spellTargets: Types.TCharRecord /* 1..72 */[] | null;
	/* The remembered target of a spell cast outside combat; at first the caster. */
	castTarget: Types.TCharRecord | null;
	/* Arena column aimed at, 0..49. */
	targetX: number | null;
	/* Arena row aimed at, 0..24. */
	targetY: number | null;
	/* Head of the list of Stinking Clouds. */
	stinkHead: Types.TStinkRec | null;
	/* Set while a spell is cast from an item, which casts at level 6. */
	usingItem: boolean | null;
	/* Set while the treasure holds any money. */
	treasureMoneyFlag: boolean | null;

	/* Resting and healing. */
	/* Rest time left, as a seven-word GBVM clock; TClock-typed so it passes to GameTime.ValidateClock as a var
    parameter. */
	restRemaining: Types.TClock | null;
	/* Spell memorization timers for the eight party slots. */
	prepTimers: number /* 1..8 */[] | null;
	/* Time rested today, in five-minute ticks. */
	healTicks: number | null;
	/* Nonzero suppresses the window border. */
	suppressBorder: number | null;

	/* Wilderness animation. */
	/* Party icon frame, 0..5: its parity selects the icon frame and its half the icon animation. */
	wildAnimFrame: number | null;

	/* Door opening. */
	/* Whether each way of opening the door in front of the party is still offered: bash, pick and knock. GameInit sets all
    three to 1. */
	doorOpen: number /* 0..2 */[] | null;

	/* The combat round: targets, attacks and quick combat; the script color selectors and registers, the interpreter's stack
  and comparison flags, script variables and strings, and the experience share after combat. */
	/* Set when the party confirms an attack on an ally (CbtActs.CheckAttackAlly). */
	attackedAllies: number | null;
	/* The combat round, counted from 0. */
	roundCounter: number | null;
	/* unused */
	roundCounterTail: number | null;
	/* Creature indices of the potential targets. */
	potentialTargets: number /* 1..72 */[] | null;
	/* Attacks made this round with the first and second attacks. */
	attacksMade: number /* 1..2 */[] | null;
	/* The hostiles' hit points, as a percentage of their full hit points. */
	hostileHpPct: number | null;
	/* Quick combat casts spells too; Alt-M toggles it. */
	quickMagic: boolean | null;
	/* Set when the acting creature's attacks are done; the combat menus also return their extended-key flag here. */
	doneRoundFlag: boolean | null;
	/* unused */
	doneRoundFlagTail: number /* 0..3 */[] | null;
	/* The combat moving-icon sheet: CombatSt allocates it, CharHlp copies icon facings in and draws from it, Combat frees
    it. */
	moveIconSheet: Types.TImgBuf | null;
	/* unused */
	moveIconSheetTail: number /* 0..301 */[] | null;
	/* Wall color chosen by the script; writing it asks for a view redraw. */
	wallColorSel: number | null;
	/* Ceiling and floor color chosen by the script; writing it asks for a view redraw. */
	ceilFloorColorSel: number | null;
	/* Script register the engine never writes. */
	readReg1: number | null;
	/* Script register the engine never writes. */
	readReg2: number | null;
	/* Script register the engine never writes. */
	readReg3: number | null;
	/* Top node of the script's return stack. */
	eclStackTop: Types.TEclRet | null;
	/* The node below the top of the script's return stack. */
	eclStackPrev: Types.TEclRet | null;
	/* Result of the last comparison: equal, not equal, less, greater, less or equal, greater or equal; cleared together by
    FillChar. */
	cmpFlags: boolean /* 0..5 */[] | null;
	/* The script opcode run before curOpcode. */
	prevOpcode: number | null;
	/* The script opcode being run. */
	curOpcode: number | null;
	/* unused */
	curOpcodeTail: number | null;
	/* The monster a script is showing. */
	monId: number | null;
	/* Picture id of that monster. */
	monPicId: number | null;
	/* The icon animation slot a script loads a character's combat icon into. */
	iconAnim: number | null;
	/* unused */
	iconAnimTail: number /* 0..129 */[] | null;
	/* Type of each decoded script variable. */
	eclVarType: number /* 1..64 */[] | null;
	/* High byte of each decoded script variable. */
	eclVarHi: number /* 1..64 */[] | null;
	/* Low byte of each decoded script variable. */
	eclVarLo: number /* 1..64 */[] | null;
	/* Receives the aim result for the bronze dragon's breath attack. */
	breathAim: boolean | null;
	/* Loop counter shared by the Blit, Portrait and CbtMap drawing loops; its value means nothing outside them. */
	drawLoopIndex: number | null;
	/* The script's string buffers. */
	gbStrings: string /* 1..20 */[] | null;
	/* Monster display flags of the script interpreter; EclVm and EclMenu clear both together. */
	monsterFlags: Types.TMonFlags | null;
	/* unused */
	monsterFlagsTail: number /* 0..1 */[] | null;
	/* Sound effect chosen by a script write (EclMenu.WriteGbvm). */
	sndEffect: number | null;
	/* Script register the engine never reads back. */
	writeReg1: number | null;
	/* Script register the engine never reads back. */
	writeReg2: number | null;
	/* Dump the creature at LOAD CHARACTER; set when a script writes 0 to its trigger word (EclMenu.SpecialWriteZ1). */
	dumpOnStatusClear: boolean | null;
	/* Dump the creature at LOAD CHARACTER; set when a script writes 0 to its trigger word (EclMenu.SpecialWriteZ1). */
	dumpOnNameClear: boolean | null;
	/* Set when a script starts a duel; the experience, the results and the summary then follow the duel's rules. */
	duelFlag: boolean | null;
	/* Disabled or animated creatures, which get no share of the experience. */
	nonAnimCount: number | null;
	/* Each creature's share of the experience before its own bonuses. */
	expShare: number | null;
	/* Set when a party member is still standing after combat, or the duelist won. */
	combatWon: boolean | null;

	/* Script display flags: the 3D box, pictures, the bottom text window and the view colors. */
	/* The running script's id. */
	eclScriptId: number | null;
	/* The search-mode bit (C_Gbvm.SEARCH_FLAGS bit 0) saved while a script runs. */
	savedSearchMode: number | null;
	/* Set once the script has run CLEAR BOX on the 3D view. */
	clearBoxDone: number | null;
	/* Set by EclProtection when it prints its text; PRINTRETURN clears it. */
	protNewLine: number | null;
	/* Set while a script is showing graphics. */
	eclGraphics: boolean | null;
	/* Set once a picture is drawn; the script's animation waits for it. */
	picDrawn: boolean | null;
	/* Set when EclProtection moves its text into the 3D box (after a CLEAR BOX); EclExit then redraws the borders and
    clears it. */
	protTextShown: number | null;
	/* Set while a script is showing a monster sprite. */
	sprShown: boolean | null;
	/* 0 when a script has written a message to the bottom text window; Explore.MapMainMenu clears that window on its way
    out and sets it back to 1. */
	bottomMsgCleared: number | null;
	/* Set when a script changes a view color selector; MapView then applies them. */
	picRegionW: boolean | null;
	/* Set when a script write has moved the party. */
	movedParty: boolean | null;
	/* Nonzero while the creature list holds hostile monsters. */
	monstersOn: number | null;
	/* Set to redraw the sky or ceiling of the 3D view. */
	redrawSky: boolean | null;
	/* Nonzero while an ENCOUNTER MENU is up. */
	inEncMenu: number | null;
	/* The picture id shown last, copied from C_Gbvm.PICTURE_LOADING. */
	picIdShown: number | null;
	/* unused */
	picIdShownTail: number /* 0..3 */[] | null;
};

export const gdVars: GdVars = {
	eclStop: null,
	newEclFlag: null,
	restoreChar: null,
	filesLoaded: null,
	enteringLoop: null,
	piecesLoaded: null,
	mapLoaded: null,
	creatureCnt: null,
	savedChar: null,
	nonEscapedHostileFound: null,
	partyFled: null,
	lastMoveDir: null,
	stuckCount: null,
	aiMoveState: null,
	quadFree: null,
	placeX: null,
	placeY: null,
	teamRows: null,
	teamDir: null,
	team: null,
	terrainChar: null,
	gi2: null,
	maskIdx: null,
	itemsOk: null,
	savedDir: null,
	savedDirTail: null,
	itemsFile: null, //file
	stingMode: null,
	finalPic: null,
	savedIfc: null,
	finalSfx: null,

	tempCr1: null,
	tempCr2: null,
	effFlags: null,
	spellList: null,
	spellIds: null,
	scrollPtrs: null,
	scrollCount: null,
	spellScratch: null,
	spellScratch2: null,
	equippedWeight: null,
	gfxReserve: null,
	cfgChar: null,
	cfgText: null,
	cfgFile: null,
	cfgErr: null,
	ioErr: null,
	heapFailureSaveEnabled: null,
	fullIntro: null,
	zone0: null,
	zone1: null,
	zone2: null,
	zone3: null,
	gameDelay: null,
	scriptEntryAddrs: null,
	eclIp: null,
	eclIpTail: null,
	ifcState: null,
	suppressContinuePrompt: null,
	portraitsOn: null,
	monsterPics: null,
	stingHpFlag: null,
	loadedSave: null,
	locTypePrev: null,
	locType: null,
	restTicks: null,
	portraitHead: null,
	portraitBody: null,
	partyDefeated: null,
	msgDelayFlag: null,
	interruptRegs: null,
	egaCurPage: null,
	egaOtherPage: null,
	pageNum: null,
	pageMain: null,
	savedVideoMode: null,
	curVideoMode: null,
	videoMode: null,
	viewBuffer: null,
	saveUnder: null,
	spanActive: null,
	spanScreenOfs: null,
	spanFirstOfs: null,
	spanLastOfs: null,
	cgaRowSeg: null,
	fbRowOfs: null,
	tandyRowSeg: null,
	clipFlag: null,

	soundMode: null,
	soundSaved: null,
	soundAutoStop: null,
	virtualDisk: null,
	prevVirtualDisk: null,
	saveDisk: null,
	saveDir: null,
	gameDisk: null,
	gameDir: null,
	suppressDiskPrompt: null,
	recentSaved: null,
	daxCompressedBuf: null,
	baseItems: null,
	baseItemsOverflow: null,
	curChar: null,
	creatureList: null,
	lastMissileItem: null,
	scratchFile: null,
	itemsRead: null,
	gameFont: null,
	curCol: null,
	curRow: null,
	curRowTail: null,
	symbolSets: null,
	curSymbolSet: null,
	tileSetLow: null,
	tileSetHigh: null,
	iconAnimation: null,
	arenaCount: null,
	arenaLoc: null,
	gridX: null,
	gridY: null,
	crIdxArr: null,
	creatureArr: null,
	downed: null,
	downedCount: null,
	arenaPtr: null,
	targetCount: null,
	targetList: null,
	treasureMoney: null,
	treasureItems: null,
	teamCount: null,
	saveRoll: null,
	pendingEffectId: null,
	pendingDamage: null,
	elementMask: null,
	attackOrMoveX2: null,
	curSpell: null,
	damageDice: null,
	calculatingMovement: null,
	suppressTargeting: null,
	effectLock: null,
	multiTarget: null,
	redrawInventory: null,
	attackRoll: null,
	hitsMade: null,
	curMorale: null,
	otherCreature: null,
	saveType: null,
	effectFns: null,
	wallGfx: null,
	map3d: null,
	skyCeilingColor: null,
	ceilingBandColor: null,
	midBandColor: null,
	floorBandColor: null,
	bandColorsTail: null,
	automapOn: null,
	partyPos: null,
	wallSetCache: null,
	animData: null,
	portraitCache: null,
	picArcName: null,
	champSavedPictureName: null,
	picArcId: null,
	champSavedPictureState: null,
	vertTop: null,
	horizChoice: null,
	extFlag: null,
	menuAutoAnswer: null,
	menuAutoAnswerTail: null,
	castItem: null,
	spellHandlers: null,
	spellTargetCount: null,
	spellTargets: null,
	castTarget: null,
	targetX: null,
	targetY: null,
	stinkHead: null,
	usingItem: null,
	treasureMoneyFlag: null,
	restRemaining: null,
	prepTimers: null,
	healTicks: null,
	suppressBorder: null,
	wildAnimFrame: null,
	doorOpen: null,

	attackedAllies: null,
	roundCounter: null,
	roundCounterTail: null,
	potentialTargets: null,
	attacksMade: null,
	hostileHpPct: null,
	quickMagic: null,
	doneRoundFlag: null,
	doneRoundFlagTail: null,
	moveIconSheet: null,
	moveIconSheetTail: null,
	wallColorSel: null,
	ceilFloorColorSel: null,
	readReg1: null,
	readReg2: null,
	readReg3: null,
	eclStackTop: null,
	eclStackPrev: null,
	cmpFlags: null,
	prevOpcode: null,
	curOpcode: null,
	curOpcodeTail: null,
	monId: null,
	monPicId: null,
	iconAnim: null,
	iconAnimTail: null,
	eclVarType: null,
	eclVarHi: null,
	eclVarLo: null,
	breathAim: null,
	drawLoopIndex: null,
	gbStrings: null,
	monsterFlags: null,
	monsterFlagsTail: null,
	sndEffect: null,
	writeReg1: null,
	writeReg2: null,
	dumpOnStatusClear: null,
	dumpOnNameClear: null,
	duelFlag: null,
	nonAnimCount: null,
	expShare: null,
	combatWon: null,
	eclScriptId: null,
	savedSearchMode: null,
	clearBoxDone: null,
	protNewLine: null,
	eclGraphics: null,
	picDrawn: null,
	protTextShown: null,
	sprShown: null,
	bottomMsgCleared: null,
	picRegionW: null,
	movedParty: null,
	monstersOn: null,
	redrawSky: null,
	inEncMenu: null,
	picIdShown: null,
	picIdShownTail: null,
};

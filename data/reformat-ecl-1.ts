import fs from 'fs';
import path from 'path';

// #region Setup

const pathName = process.argv[2];
const eclIdInput = process.argv[3];

if (!pathName || !eclIdInput) {
	console.error('Usage: node reformat-ecl.ts <file.txt> <ECL ID>');
	process.exit(1);
}

const eclId = parseInt(eclIdInput);

if (isNaN(eclId)) {
	console.error('Invalid ECL ID supplied');
	process.exit(1);
}

const fileName = path.basename(pathName, '.txt');

// Read as UTF-8, trim trailing whitespace, and normalize CRLF to LF
const input = fs.readFileSync(pathName, 'utf8').replace(/\s*\r?\n/g, '\n');
const inputLines = input.split('\n');

console.log(
	`Loaded ${pathName}: ${input.length} chars, ${inputLines.length} lines`,
);

// #endregion Setup

// #region Validation

for (const lineRaw of inputLines) {
	const line = lineRaw.trim();

	// skip commented and empty lines
	if (line.startsWith(';') || line.length === 0) continue;

	// simple format validation
	if (!line.match(/^([0-9A-F]{4})/) && !line.match(/^L_([0-9A-F]{4}):/)) {
		throw new Error(`Invalid format detected on line: ${line}`);
	}
}

// #endregion Validation

const addrPrefix = `ECL_${eclId}_`;

// used in regex
const addr = '[0-9A-F]{4}';
const addrRef = `(?:\\$str)?[@^]${addr}`;
const str = `"[^"]*"`;

let fullScript = input + '';
let matches: RegExpMatchArray | null = null;

// #region Full Script

// Remove comment lines
const commentLine = /^;(.*)\n/gm;
fullScript = fullScript.replace(commentLine, '');

// Trim lines
const trimLine = /^\s*(.+)\s*$/gm;
fullScript = fullScript.replace(trimLine, '$1');

// #endregion Full Script

// Need to split these because otherwise entry points look identical to in-block GOTOs
const firstLabelIdx = /^\s*L_/gm.exec(fullScript)?.index ?? 0;
let entryPointBlock = fullScript.slice(0, firstLabelIdx);
let mainBlock = fullScript.slice(firstLabelIdx);

// #region Entry Block

const entryPointLine = new RegExp(`^(${addr})\\s+GOTO\\s+L_(${addr}).*$`, 'gm');
entryPointBlock = entryPointBlock.replace(
	entryPointLine,
	`${addrPrefix}$1\tGOTO ${addrPrefix}$2`,
);

// #endregion Entry Block

// #region Data Lines

// Compare lines
const dbValue = '[0-9a-f]{2} ?';
const dbLine = new RegExp(
	`^\\s*${addr}\\s+\\.db (?<values>(?:${dbValue})+)$`,
	'gm',
);

matches = mainBlock.match(
	new RegExp(`^\\s*(?<startAddr>${addr})\\s+\\.db\\s$`, 'gm'),
);
if (matches) {
	for (const match of matches) {
		if (!dbLine.test(match)) {
			throw new Error(`Invalid .db format detected on line: ${match}`);
		}
		dbLine.lastIndex = 0;
	}
}
mainBlock = mainBlock.replace(dbLine, (...args) => {
	const {
		startAddr,
		values,
	}: {
		startAddr: string;
		values: string;
	} = args[args.length - 1];

	let result = '';
	let curAddr = Number(`0x${startAddr}`);

	const valMatches = values.match(new RegExp(dbValue, 'gm'));
	for (const valMatch of valMatches!) {
		let numValue = Number(`0x${valMatch.trim()}`);
		result = `CONST db_$${curAddr.toString(16).toUpperCase()} = ${numValue.toString()}\n`;
		curAddr++;
	}

	return result;
});

// #endregion Data Lines

// #region Op Lines

// Label lines
const labelLine = new RegExp(`^L_(?<addr>${addr}):.*$`, 'gm');
mainBlock = mainBlock.replace(labelLine, `\n${addrPrefix}$<addr>`);

// Remove Line Addresses
const opLine = new RegExp(`^${addr}\\s+(?<op>.*)$`, 'gm');
mainBlock = mainBlock.replace(opLine, '$<op>');

const replaceLine = (
	command: string,
	checkLineRegex: RegExp,
	replace: string | ((substring: string, ...args: any[]) => string),
) => {
	const checkOnce = new RegExp(
		checkLineRegex.source,
		checkLineRegex.flags.replace('g', ''),
	);
	matches = mainBlock.match(new RegExp(`^${command}(\\s.*$|$)`, 'gm'));
	if (matches) {
		for (const match of matches) {
			if (!checkOnce.test(match)) {
				throw new Error(`Invalid ${command} format detected on line: ${match}`);
			}
		}
	}
	mainBlock =
		typeof replace == 'string'
			? mainBlock.replace(checkLineRegex, replace)
			: mainBlock.replace(checkLineRegex, replace);
};

replaceLine(
	'ADD_NPC',
	new RegExp(
		`^ADD_NPC (?<npcId>\\d+|${addrRef}), (?<morale>\\d+|${addrRef})$`,
		'gm',
	),
	'\tADD_NPC (npcId: $<npcId>, morale: $<morale>)',
);

replaceLine(
	'ADD',
	new RegExp(
		`^ADD (?<val1>\\d+|${str}|${addrRef}), (?<val2>\\d+|${str}|${addrRef}), (?<var>${addrRef})`,
		'gm',
	),
	'\t$<var> = $<val1> + $<val2>',
);

replaceLine('APPROACH', /^APPROACH$/gm, '\tAPPROACH ()');

replaceLine(
	'CALL',
	new RegExp(`^CALL (?<opAddr>${addrRef})$`, 'gm'),
	'\tCALL (opAddr: $<opAddr>)',
);

replaceLine(
	'CHECK_PARTY',
	new RegExp(
		`^CHECK_PARTY ` +
			`(?<checkMove>0|${addrRef}), ` +
			`(?<effect>\\d+|${addrRef}), ` +
			`(?<varLow>${addrRef}), ` +
			`(?<varHigh>${addrRef}), ` +
			`(?<varAvg>${addrRef}), ` +
			`(?<varFound>${addrRef})$`,
		'gm',
	),
	'\t[$<varLow>, $<varHigh>, $<varAvg>, $<varFound>] = CHECK_PARTY (checkMove: $<checkMove>, effect: $<effect>)',
);

replaceLine(
	'CLOCK',
	new RegExp(`^CLOCK (?<ticks>\\d+|${addrRef})$`, 'gm'),
	'\tCLOCK (ticks: $<ticks>)',
);

replaceLine('COMBAT', /^COMBAT$/gm, '\tCOMBAT ()');

replaceLine('CLEAR_BOX', /^CLEAR_BOX$/gm, '\tCLEAR_BOX ()');

replaceLine('CLEAR_MONSTERS', /^CLEAR_MONSTERS$/gm, '\tCLEAR_MONSTERS ()');

replaceLine(
	'DAMAGE',
	new RegExp(
		`^DAMAGE (?<attack>\\d+|${addrRef}), (?<dice>\\d+|${addrRef}), (?<sides>\\d+|${addrRef}), (?<bonus>\\d+|${addrRef}), (?<val>\\d+|${addrRef})$`,
		'gm',
	),
	'\tDAMAGE (attack: $<attack>, dice: $<dice>, sides: $<sides>, bonus: $<bonus>, value: $<val>)',
);

replaceLine('DELAY', /^DELAY$/gm, '\tDELAY ()');

replaceLine(
	'DIVIDE',
	new RegExp(
		`^DIVIDE (?<val1>\\d+|${str}|${addrRef}), (?<val2>\\d+|${str}|${addrRef}), (?<var>${addrRef})`,
		'gm',
	),
	'\t$<var> = $<val1> / $<val2>',
);

replaceLine(
	'ENCOUNTER',
	new RegExp(
		`^ENCOUNTER ` +
			`(?<monsterId>\\d+|${addrRef}), ` +
			`(?<distReq>\\d+|${addrRef}), ` +
			`(?<picId>\\d+|${addrRef}), ` +
			`(?<var>${addrRef}), ` +
			`(?<combat>\\d+|${addrRef}), ` +
			`(?<wait>\\d+|${addrRef}), ` +
			`(?<flee>\\d+|${addrRef}), ` +
			`(?<parlay>\\d+|${addrRef}), ` +
			`(?<failFlee>\\d+|${addrRef}), ` +
			`(?<msg1>${str}|${addrRef}), ` +
			`(?<msg2>${str}|${addrRef}), ` +
			`(?<msg3>${str}|${addrRef}), ` +
			`(?<partyFlee>\\d+|${addrRef}), ` +
			`(?<monsterFlee>\\d+|${addrRef})$`,
		'gm',
	),
	'\t$<var> = ENCOUNTER (' +
		'displayMonsterId: $<monsterId>, ' +
		'distanceRequirement: $<distReq>, ' +
		'displayPicId: $<picId>, ' +
		'combatResp: $<combat>, ' +
		'waitResp: $<wait>, ' +
		'fleeResp: $<flee>, ' +
		'parlayResp: $<parlay>, ' +
		'failFleeResp: $<failFlee>, ' +
		'message1: $<msg1>, ' +
		'message2: $<msg2>, ' +
		'message3: $<msg3>, ' +
		'partyFlee: $<partyFlee>, ' +
		'monsterFlee: $<monsterFlee>)',
);

replaceLine('EXIT', /^EXIT.*$/gm, '\tEXIT');

replaceLine(
	'GET_TABLE',
	new RegExp(
		`^GET_TABLE (?<tbl>\\d+|${addrRef}), (?<idx>\\d+|${addrRef}), (?<var1>${addrRef})`,
		'gm',
	),
	(...args) => {
		const {
			tbl,
			idx,
			var1,
		}: {
			tbl: string;
			idx: string;
			var1: string;
		} = args[args.length - 1];
		const tblName = `db_${tbl.replace('@', '$')}`;
		return `\t${var1} = ${tblName}[${idx}]`;
	},
);

replaceLine(
	'GOSUB',
	new RegExp(`^GOSUB L_(?<dest>${addr})$`, 'gm'),
	`\t${addrPrefix}$<dest>()`,
);

replaceLine(
	'GOTO',
	new RegExp(`^GOTO L_(?<dest>${addr})$`, 'gm'),
	`\tGOTO ${addrPrefix}$<dest>`,
);

replaceLine(
	'INPUT_NUMBER',
	new RegExp(
		`^INPUT_NUMBER (?<maxLen>\\d+|${addrRef}), (?<var>${addrRef})$`,
		'gm',
	),
	'\t$<var> = INPUT_NUMBER (maxLen: $<maxLen>)',
);

replaceLine(
	'INPUT_STRING',
	new RegExp(
		`^INPUT_STRING (?<maxLen>\\d+|${addrRef}), (?<var>${addrRef})$`,
		'gm',
	),
	'\t$<var> = INPUT_STRING (maxLen: $<maxLen>)',
);

replaceLine(
	'LOAD_CHARACTER',
	new RegExp(`^LOAD_CHARACTER (?<charId>${addrRef})$`, 'gm'),
	'\tLOAD_CHARACTER (charId: $<charId>)',
);

replaceLine(
	'LOAD_MONSTER',
	new RegExp(
		`^LOAD_MONSTER (?<monsterId>\\d+|${addrRef}), (?<copies>\\d+|${addrRef}), (?<cpicId>\\d+|${addrRef})$`,
		'gm',
	),
	'\tLOAD_MONSTER (monsterId: $<monsterId>, copies: $<copies>, cpicId: $<cpicId>)',
);

replaceLine(
	'LOAD_FILES',
	new RegExp(
		`^LOAD_FILES (?<fileId>\\d+|${addrRef}), (?<arg2>\\d+|${addrRef}), (?<loadTiles>\\d+|${addrRef})$`,
		'gm',
	),
	'\tLOAD_FILES (fileId: $<fileId>, unused: $<arg2>, loadTiles: $<loadTiles>)',
);

replaceLine(
	'LOAD_PIECES',
	new RegExp(
		`^LOAD_PIECES (?<wallSetId1>\\d+|${addrRef}), (?<wallSetId2>\\d+|${addrRef}), (?<wallSetId3>\\d+|${addrRef})$`,
		'gm',
	),
	'\tLOAD_PIECES (wallSetId1: $<wallSetId1>, wallSetId2: $<wallSetId2>, wallSetId3: $<wallSetId3>)',
);

replaceLine(
	'MULTIPLY',
	new RegExp(
		`^MULTIPLY (?<val1>\\d+|${str}|${addrRef}), (?<val2>\\d+|${str}|${addrRef}), (?<var>${addrRef})`,
		'gm',
	),
	'\t$<var> = $<val1> * $<val2>',
);

replaceLine(
	'NEW_ECL',
	new RegExp(`^NEW_ECL (?<eclId>\\d+|${addrRef})$`, 'gm'),
	'\tNEW_ECL (eclId: $<eclId>)',
);

replaceLine(
	'PARLAY',
	new RegExp(
		`^PARLAY (?<haughty>\\d+|${addrRef}), (?<sly>\\d+|${addrRef}), (?<nice>\\d+|${addrRef}), (?<meek>\\d+|${addrRef}), (?<abusive>\\d+|${addrRef}), (?<var>${addrRef})$`,
		'gm',
	),
	'\t$<var> = PARLAY (haughtyVal: $<haughty>, slyVal: $<sly>, niceVal: $<nice>, meekVal: $<meek>, abusiveVal: $<abusive>)',
);

replaceLine(
	'PARTY_STRENGTH',
	new RegExp(`^PARTY_STRENGTH (?<var>${addrRef})$`, 'gm'),
	'\t$<var> = PARTY_STRENGTH ()',
);

replaceLine(
	'PARTY_SURPRISE',
	new RegExp(`^PARTY_SURPRISE (?<var1>${addrRef}), (?<var2>${addrRef})`, 'gm'),
	'\t[$<var1>, $<var2>] = PARTY_SURPRISE ()',
);

replaceLine(
	'PICTURE',
	new RegExp(`^PICTURE (?<blockId>\\d+|${addrRef})$`, 'gm'),
	'\tPICTURE (blockId: $<blockId>)',
);

replaceLine(
	'PRINT',
	new RegExp(`^PRINT (?<message>${str}|${addrRef})$`, 'gm'),
	(...args) => {
		const { message } = args[args.length - 1];
		if (message.startsWith('"')) {
			`\tPRINT_APPEND (message: ${message.replace('"', '`').replace("'", '"')})`;
		}
		return `\tPRINT_APPEND (message: ${message})`;
	},
);

replaceLine(
	'PRINT_CLEAR',
	new RegExp(`^PRINT_CLEAR (?<message>${str}|${addrRef})$`, 'gm'),
	(...args) => {
		const { message } = args[args.length - 1];
		if (message.startsWith('"')) {
			`\tPRINT_CLEAR (message: ${message.replace('"', '`').replace("'", '"')})`;
		}
		return `\tPRINT_CLEAR (message: ${message})`;
	},
);

replaceLine('PRINT_RETURN', /^PRINT_RETURN$/gm, '\tPRINT_RETURN ()');

replaceLine(
	'PROGRAM',
	new RegExp(`^PROGRAM (?<progId>\\d+|${addrRef})$`, 'gm'),
	'\tPROGRAM (progId: $<progId>)',
);

replaceLine(
	'PROTECTION',
	new RegExp(`^PROTECTION (?<str>${addrRef})$`, 'gm'),
	'\tPROTECTION (str: $<str>)',
);

replaceLine(
	'RANDOM',
	new RegExp(`^RANDOM (?<max>\\d+|${addrRef}), (?<var>${addrRef})$`, 'gm'),
	'\t$<var> = RANDOM (max: $<max>)',
);

replaceLine('RETURN', /^RETURN$/gm, '\tRETURN');

replaceLine(
	'ROB',
	new RegExp(
		`^ROB (?<allParty>\\d+|${addrRef}), (?<coinPct>\\d+|${addrRef}), (?<arg3>\\d+|${addrRef})$`,
		'gm',
	),
	'\tROB (allParty: $<allParty>, coinPct: $<coinPct>, unused: $<arg3>)',
);

replaceLine(
	'SAVE',
	new RegExp(`^SAVE (?<val>\\d+|${str}|${addrRef}), (?<var>${addrRef})`, 'gm'),
	'\t$<var> = $<val>',
);

replaceLine(
	'SAVE_TABLE',
	new RegExp(
		`^SAVE_TABLE (?<val>\\d+|${str}|${addrRef}), (?<var>${addrRef}), (?<idx>\\d+|${addrRef})`,
		'gm',
	),
	'\t$<var>[$<idx>] = $<val>',
);

replaceLine(
	'SETUP_MONSTER',
	new RegExp(
		`^SETUP_MONSTER (?<spriteId>\\d+|${addrRef}), (?<maxDistance>\\d+|${addrRef}), (?<picId>\\d+|${addrRef})$`,
		'gm',
	),
	'\tSETUP_MONSTER (spriteId: $<spriteId>, maxDistance: $<maxDistance>, picId: $<picId>)',
);

replaceLine(
	'SPELL',
	new RegExp(
		`^SPELL ` +
			`(?<spellId>\\d+|${addrRef}), ` +
			`(?<varSlot>${addrRef}), ` +
			`(?<varIdx>${addrRef})$`,
		'gm',
	),
	'\t[$<varSlot>, $<varIdx>] = SPELL (spellId: $<spellId>)',
);

replaceLine('SPRITE_OFF', /^SPRITE_OFF$/gm, '\tSPRITE_OFF ()');

// EclArithmetic inverts these for some reason
replaceLine(
	'SUBTRACT',
	new RegExp(
		`^SUBTRACT (?<val1>\\d+|${str}|${addrRef}), (?<val2>\\d+|${str}|${addrRef}), (?<var>${addrRef})`,
		'gm',
	),
	'\t$<var> = $<val2> - $<val1>',
);

// target1 = base1 + 2 - sub1; target2 = base2 + 2 - sub2
replaceLine(
	'SURPRISE',
	new RegExp(
		`^SURPRISE (?<sub1>${addrRef}), (?<base2>${addrRef}), (?<sub2>\\d+|${addrRef}), (?<base1>\\d+|${addrRef})`,
		'gm',
	),
	'\tSURPRISE (sub1: $<sub1>, base2: $<base2>, sub2: $<sub2>, base1: $<base1>)',
);

replaceLine(
	'TREASURE',
	new RegExp(
		`^TREASURE (?<cp>\\d+|${addrRef}), ` +
			`(?<sp>\\d+|${addrRef}), ` +
			`(?<ep>\\d+|${addrRef}), ` +
			`(?<gp>\\d+|${addrRef}), ` +
			`(?<pp>\\d+|${addrRef}), ` +
			`(?<gems>\\d+|${addrRef}), ` +
			`(?<jewels>\\d+|${addrRef}), ` +
			`(?<itemId>\\d+|${addrRef})$`,
		'gm',
	),
	'\tTREASURE (cp: $<cp>, sp: $<sp>, ep: $<ep>, gp: $<gp>, pp: $<pp>, gems: $<gems>, jewels: $<jewels>, itemId: $<itemId>)',
);

replaceLine(
	'WHO',
	new RegExp(`^WHO (?<prompt>${str})$`, 'gm'),
	'\tWHO (prompt: $<prompt>)',
);

// Horizontal Menu
const opt = `(?<val>${str})(?:, )?`;
const horizontalLine = new RegExp(
	`^HORIZONTAL_MENU (?<var1>${addrRef}), \\d+, (?<opts>(?:${opt})+)`,
	'gm',
);

matches = mainBlock.match(/^HORIZONTAL_MENU.*$/gm);
if (matches) {
	for (const match of matches) {
		if (!horizontalLine.test(match)) {
			throw new Error(
				`Invalid HORIZONTAL_MENU format detected on line: ${match}`,
			);
		}
		horizontalLine.lastIndex = 0;
	}
}
mainBlock = mainBlock.replace(horizontalLine, (...args) => {
	const {
		var1,
		opts,
	}: {
		var1: string;
		opts: string;
	} = args[args.length - 1];

	let newOpts = '';

	const optMatches = opts.match(new RegExp(opt, 'gm'));
	for (const optMatch of optMatches!) {
		newOpts += `${optMatch.replaceAll('"', '`')}`;
	}

	return `\t${var1} = HORIZONTAL_MENU (opts: [${newOpts}])`;
});

// Vertical Menu
const verticalLine = new RegExp(
	`^VERTICAL_MENU (?<var1>${addrRef}), (?<prompt>${str}), \\d+, (?<opts>(?:${opt})+)`,
	'gm',
);

matches = mainBlock.match(/^VERTICAL_MENU.*$/gm);
if (matches) {
	for (const match of matches) {
		if (!verticalLine.test(match)) {
			throw new Error(
				`Invalid VERTICAL_MENU format detected on line: ${match}`,
			);
		}
		verticalLine.lastIndex = 0;
	}
}
mainBlock = mainBlock.replace(verticalLine, (...args) => {
	const {
		var1,
		prompt,
		opts,
	}: {
		var1: string;
		prompt: string;
		opts: string;
	} = args[args.length - 1];

	let newOpts = '';
	const newPrompt = prompt.replaceAll('"', '`');

	const optMatches = opts.match(new RegExp(opt, 'gm'));
	for (const optMatch of optMatches!) {
		newOpts += `${optMatch.replaceAll('"', '`')}`;
	}

	return `\t${var1} = VERTICAL_MENU (prompt: ${newPrompt}, opts: [${newOpts}])`;
});

// On-go lines
const destEntry = `L_(?<addr>${addr})(?:, )?`;
const onGoLine = new RegExp(
	`^ON_(?<op>GOTO|GOSUB) (?<switchVar>${addrRef}), (?:\\d+), (?<dests>(?:${destEntry})+)\n`,
	'gm',
);
matches = mainBlock.match(/^ON_(GOTO|GOSUB).*\n/gm);
if (matches) {
	for (const match of matches) {
		if (!onGoLine.test(match)) {
			throw new Error(`Invalid ON format detected on line: ${match}`);
		}
		onGoLine.lastIndex = 0;
	}
}
mainBlock = mainBlock.replace(onGoLine, (...args) => {
	const { op, switchVar, dests }: Record<string, string> =
		args[args.length - 1];

	let result = `\tSWITCH ${switchVar}\n`;

	const destMatches = dests.match(new RegExp(destEntry, 'gm'));
	let i = 0;
	for (const destMatch of destMatches!) {
		result += destMatch.replace(new RegExp(destEntry), (...args) => {
			const { addr } = args[args.length - 1];
			return `\t\tCASE ${i}\n\t\t\t${op === 'GOTO' ? 'GOTO ' : ''}${addrPrefix}${addr}${op === 'GOSUB' ? '()' : ''}\n`;
		});
		i++;
	}

	return result;
});

// Find Item lines
const ifEqNeLine = 'IF_(?<op>EQ|NE)\\n(?<line>[^\\n]+)\\n';
const findItemLines = new RegExp(
	`^FIND_ITEM (?<itemId>\\d+|${addrRef})\\n(?<ifs>(?:${ifEqNeLine})+)`,
	'gm',
);
matches = mainBlock.match(/^FIND_ITEM .*\n(IF_.*\n.*)+\n/gm);
if (matches) {
	for (const match of matches) {
		if (!findItemLines.test(match)) {
			throw new Error(`Invalid FIND_ITEM format detected on line: ${match}`);
		}
		findItemLines.lastIndex = 0;
	}
}
mainBlock = mainBlock.replace(findItemLines, (...args) => {
	const { itemId, ifs }: Record<string, string> = args[args.length - 1];

	let result = '';

	const ifMatches = ifs.match(new RegExp(ifEqNeLine, 'gm'));
	for (const ifMatch of ifMatches!) {
		result += ifMatch.replace(new RegExp(ifEqNeLine), (...args) => {
			const {
				op,
				line,
			}: {
				op: 'EQ' | 'NE';
				line: string;
			} = args[args.length - 1];
			const map = {
				EQ: '',
				NE: '!',
			};
			return `\tIF ${map[op]}FIND_ITEM (${itemId})\n\t${line}\n`;
		});
	}

	return result;
});

// And lines
const andLines = new RegExp(
	`^AND (?<val1>\\d+|${addrRef}), (?<val2>\\d+|${addrRef}), (?<var1>${addrRef})\\n(?<ifs>(?:${ifEqNeLine})*)`,
	'gm',
);
matches = mainBlock.match(/^AND .*\n(IF_.*\n.*)*\n/gm);
if (matches) {
	for (const match of matches) {
		if (!andLines.test(match)) {
			throw new Error(`Invalid AND format detected on line: ${match}`);
		}
		andLines.lastIndex = 0;
	}
}
mainBlock = mainBlock.replace(andLines, (...args) => {
	const { val1, val2, var1, ifs }: Record<string, string> =
		args[args.length - 1];

	let result = `\t${var1} = ${val2} & ${val1}\n`;

	const ifMatches = ifs.match(new RegExp(ifEqNeLine, 'gm'));
	if (ifMatches) {
		for (const ifMatch of ifMatches) {
			result += ifMatch.replace(new RegExp(ifEqNeLine), (...args) => {
				const {
					op,
					line,
				}: {
					op: 'EQ' | 'NE';
					line: string;
				} = args[args.length - 1];
				const map = {
					EQ: '==',
					NE: '!=',
				};
				return `\tIF 0 ${map[op]} ${var1}\n\t${line}\n`;
			});
		}
	}

	return result;
});

// Or lines
const orLines = new RegExp(
	`^OR (?<val1>\\d+|${addrRef}), (?<val2>\\d+|${addrRef}), (?<var1>${addrRef})\\n(?<ifs>(?:${ifEqNeLine})*)`,
	'gm',
);
matches = mainBlock.match(/^OR .*\n(IF_.*\n.*)*\n/gm);
if (matches) {
	for (const match of matches) {
		if (!orLines.test(match)) {
			throw new Error(`Invalid OR format detected on line: ${match}`);
		}
		orLines.lastIndex = 0;
	}
}
mainBlock = mainBlock.replace(orLines, (...args) => {
	const { val1, val2, var1, ifs }: Record<string, string> =
		args[args.length - 1];

	let result = `\t${var1} = ${val2} | ${val1}\n`;

	const ifMatches = ifs.match(new RegExp(ifEqNeLine, 'gm'));
	if (ifMatches) {
		for (const ifMatch of ifMatches) {
			result += ifMatch.replace(new RegExp(ifEqNeLine), (...args) => {
				const {
					op,
					line,
				}: {
					op: 'EQ' | 'NE';
					line: string;
				} = args[args.length - 1];
				const map = {
					EQ: '==',
					NE: '!=',
				};
				return `\tIF 0 ${map[op]} ${var1}\n\t${line}\n`;
			});
		}
	}

	return result;
});

// Compare-and lines
const compareAndLine = `COMPARE_AND (?<val1>\\d+|${str}|${addrRef}), (?<val2>\\d+|${str}|${addrRef}), (?<val3>\\d+|${str}|${addrRef}), (?<val4>\\d+|${str}|${addrRef})`;
const ifEqLines = 'IF_EQ\\n(?<line>[^\\n]+)\\n';

const compareAndEqLines = new RegExp(
	`^${compareAndLine}\\n(?<ifs>(?:${ifEqLines})+)`,
	'gm',
);
matches = mainBlock.match(/^COMPARE_AND.*\n(IF_EQ.*\n.*)+\n/gm);
if (matches) {
	for (const match of matches) {
		if (!compareAndEqLines.test(match)) {
			throw new Error(`Invalid COMPARE_AND format detected on line: ${match}`);
		}
		compareAndEqLines.lastIndex = 0;
	}
}
mainBlock = mainBlock.replace(compareAndEqLines, (...args) => {
	const { val1, val2, val3, val4, ifs }: Record<string, string> =
		args[args.length - 1];

	let result = '';

	const ifMatches = ifs.match(new RegExp(ifEqLines, 'gm'));
	for (const ifMatch of ifMatches!) {
		result += ifMatch.replace(
			new RegExp(ifEqLines),
			`\tIF ${val1} == ${val2} && ${val3} == ${val4}\n\t$<line>\n`,
		);
	}

	return result + '\n';
});
const ifNeLines = 'IF_NE\\n(?<line>[^\\n]+)\\n';
const compareAndNeLines = new RegExp(
	`^${compareAndLine}\\n(?<ifs>(?:${ifNeLines})+)`,
	'gm',
);
matches = mainBlock.match(/^COMPARE_AND.*\n(IF !=.*\n.*)+\n/gm);
if (matches) {
	for (const match of matches) {
		if (!compareAndNeLines.test(match)) {
			throw new Error(`Invalid COMPARE_AND format detected on line: ${match}`);
		}
		compareAndNeLines.lastIndex = 0;
	}
}
mainBlock = mainBlock.replace(compareAndNeLines, (...args) => {
	const { val1, val2, val3, val4, ifs }: Record<string, string> =
		args[args.length - 1];

	let result = '';

	const ifMatches = ifs.match(new RegExp(ifNeLines, 'gm'));
	for (const ifMatch of ifMatches!) {
		result += ifMatch.replace(
			new RegExp(ifNeLines),
			`\tIF ${val1} != ${val2} || ${val3} != ${val4}\n\t$<line>\n`,
		);
	}

	return result + '\n';
});

// Compare lines
const compareLine = `COMPARE (?<val1>\\d+|${str}|${addrRef}), (?<val2>\\d+|${str}|${addrRef})`;
const ifLine = 'IF_(?<op>EQ|NE|LT|GT|LE|GE)\\n(?<line>[^\\n]+)\\n';

const compareLines = new RegExp(
	`^${compareLine}\\n(?<ifs>(?:${ifLine})+)`,
	'gm',
);
matches = mainBlock.match(/^COMPARE .*\n(IF_.*\n.*)+\n/gm);
if (matches) {
	for (const match of matches) {
		if (!compareLines.test(match)) {
			throw new Error(`Invalid COMPARE format detected on line: ${match}`);
		}
		compareLines.lastIndex = 0;
	}
}
mainBlock = mainBlock.replace(compareLines, (...args) => {
	const { val1, val2, ifs }: Record<string, string> = args[args.length - 1];

	let result = '';

	const ifMatches = ifs.match(new RegExp(ifLine, 'gm'));
	for (const ifMatch of ifMatches!) {
		result += ifMatch.replace(new RegExp(ifLine), (...args) => {
			const {
				op,
				line,
			}: {
				op: 'EQ' | 'NE' | 'LT' | 'GT' | 'LE' | 'GE';
				line: string;
			} = args[args.length - 1];
			const map = {
				EQ: '==',
				NE: '!=',
				LT: '<',
				GT: '>',
				LE: '<=',
				GE: '>=',
			};
			return `\tIF ${val1} ${map[op]} ${val2}\n\t${line}\n`;
		});
	}

	return result;
});

// Remaining compares and compare-ands (nonconsecutive if)
replaceLine(
	'COMPARE_AND',
	new RegExp(`^${compareAndLine}$`, 'gm'),
	'\tcompareResult = COMPARE_AND ($<val1>, $<val2>, $<val3>, $<val4>)',
);

replaceLine(
	'COMPARE',
	new RegExp(`^${compareLine}$`, 'gm'),
	'\tcompareResult = COMPARE ($<val1>, $<val2>)',
);

// Remaining ifs (nonconsecutive comparison)
matches = mainBlock.match(new RegExp(`^IF_.*\n.*\n`, 'gm'));
if (matches) {
	for (const match of matches) {
		if (!new RegExp(`^${ifLine}`).test(match)) {
			throw new Error(`Invalid IF format detected on line: ${match}`);
		}
	}
}
mainBlock = mainBlock.replace(new RegExp(ifLine, 'gm'), (...args) => {
	const {
		op,
		line,
	}: {
		op: 'EQ' | 'NE' | 'LT' | 'GT' | 'LE' | 'GE';
		line: string;
	} = args[args.length - 1];

	const map = {
		EQ: '==',
		NE: '!=',
		LT: '<',
		GT: '>',
		LE: '<=',
		GE: '>=',
	};
	return `\tIF compareResult == '${map[op]}'\n\t${line}\n`;
});

// #endregion Op Lines

const output =
	'\n\n/* ENTRY POINTS */\n' +
	entryPointBlock.trim() +
	'\n\n/* MAIN SCRIPT */\n' +
	mainBlock.trim();

const outFileName = `${fileName}.out.txt`;

fs.writeFileSync(`${outFileName}`, output);

const outputLines = output.split('\n');

const missedLines = outputLines.filter(
	(line) =>
		line &&
		!line.startsWith('ECL_') &&
		!line.startsWith('\t') &&
		!line.startsWith('/*') &&
		!line.startsWith('CONST'),
);

console.log(
	`Wrote ${outFileName}: ${output.length} chars, ${outputLines.length} lines`,
);

console.log(`Missed lines (${missedLines.length}):\n${missedLines.join('\n')}`);

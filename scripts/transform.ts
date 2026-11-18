import fs from 'fs';

type Rule = {
	find: string | RegExp;
	replace: string;
};

const file = process.argv[2];

const rules: Rule[] = [
	{ find: /\{ (.+?) \}/gs, replace: '/* $1 */' },
	{ find: /^unit (C_)?(.+?);(.+)/gms, replace: 'export namespace $2 {$3\n}' },
	{
		find: /([^\w])(Byte|Word|ShortInt|LongInt|Integer)([^\w])/g,
		replace: '$1number$3',
	},
	{
		find: /([^\w])String\[(\d*)\]/g,
		replace: '$1string /* [$2] */',
	},
	{
		find: /([^\w])Boolean([^\w])/g,
		replace: '$1boolean$2',
	},
	{
		find: /array\[([\.\d]+)\] of (.+);/g,
		replace: '$2[/* $1 */];',
	},
	{
		find: /array\[([\.\d]+), ?([\.\d]+)\] of (.+);/g,
		replace: '$3[/* $1 */][/* $2 */];',
	},
];

let text = fs.readFileSync(file, 'utf8');

for (const { find, replace } of rules) {
	text = text.replace(find, replace);
}

fs.writeFileSync(file, text);

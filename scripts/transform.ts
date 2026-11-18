import fs from 'fs';

type Rule = {
	find: string | RegExp;
	replace: string;
};

const file = process.argv[2];

const rules: Rule[] = [
	{ find: /\{ (.+?) \}/gs, replace: '/* $1 */' },
	{ find: /^unit (C_)?(.+?);(.+)/gms, replace: 'export namespace $2 {$3\n}' },
];

let text = fs.readFileSync(file, 'utf8');

for (const { find, replace } of rules) {
	text = text.replace(find, replace);
}

fs.writeFileSync(file, text);

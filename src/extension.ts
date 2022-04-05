import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "multicursor-utility" is now active!');

    const geneGetLineRange = (doc: vscode.TextDocument) => ({ start, end }: { start: vscode.Position, end: vscode.Position }) => doc.validateRange(
        new vscode.Selection(start.line, 0, end.line + 1, 0)
    );
    const insertString = (index: number, text: string, word: string) => text.slice(0, index) + word + text.slice(index);
    const range = (size: number) => [...Array(size)].map((_, i) => i);
    const abs = (number: number) => number < 0 ? -number : number;
    const isUpper = (str: string) => /^[A-Z]+$/.test(str);
    /* eslint-disable @typescript-eslint/naming-convention */
    const baseReg: Record<string, string> = {
        b: '[01]',
        o: '[0-7]',
        d: '[0-9]',
        x: '[0-9a-fA-F]'
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    context.subscriptions.push(
        vscode.commands.registerCommand('multicursor-utility.convertTabstops', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor === undefined) return;
            const doc = editor.document;
            const getLineRange = geneGetLineRange(doc);
            const curSelections = editor.selections;
            if (!curSelections.length) return;

            const sorted = [...curSelections].sort((a, b) => (
                b.active.line - a.active.line || b.active.character - a.active.character
            ));
            const snippetRange = getLineRange({
                start: sorted[sorted.length - 1].active,
                end: sorted[0].active,
            });

            const text = doc.getText(snippetRange).split('\n');
            sorted.forEach((v, i) => {
                const line = v.active.line - sorted[sorted.length - 1].active.line;
                const char = v.active.character;
                const textLine = text[line];

                const newText = insertString(char, textLine, String(i && curSelections.length - i));
                text[line] = newText;
            });
            const snippet = new vscode.SnippetString(text.join('\n'));
            editor.insertSnippet(snippet, snippetRange);
        }),
        vscode.commands.registerCommand('multicursor-utility.insertMulticursor', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor === undefined) return;
            const curSelections = editor.selections;

            const input = await vscode.window.showInputBox({
                validateInput: text => !text || /^\d*(:.+)?$/.test(text) ? null : "int (':' string)?"
            });
            if (!input) return;
            const [inputNum, inputWord] = input.split(/(?<=^[^:]*):/);
            const num = Number(inputNum);
            const word = inputWord ?? ' ';

            const newCurSelections = [] as vscode.Selection[];
            for (const cur of curSelections) {
                await editor.edit(edit => edit.insert(cur.active, word.repeat(num)));
                newCurSelections.push(
                    ...range(num).map(v => new vscode.Selection(
                        cur.active.translate(0, word.length * (v + 1)),
                        cur.active.translate(0, word.length * (v + 1))
                    ))
                );
            }
            editor.selections = newCurSelections;
        }),
        vscode.commands.registerCommand('multicursor-utility.insertSerial', async () => {
            const parsePadStart = (text: string, base: keyof typeof baseReg = 'd') => {
                const nR = baseReg[base];

                if (/^.+,\d+,.*$/.test(text)) {
                    const [,padStr, padNumInput, startInput] = text.match(/^(.+),(\d+),([0-9]*)$/) ?? [];
                    const padNum = Number(padNumInput);
                    return { padStr, padNum, startInput };
                } else {
                    const [,padStr, startInput] = text.match(new RegExp(`^(.*?)(-?(?!0)${nR}*|0)$`)) ?? [];
                    const padNum = text.length - startInput.length && text.length;
                    return { padStr, padNum, startInput };
                }
            };
            const shaping = (number: number, padNum: number, padStr = ' ', base = 10, upper = false) => {
                if (!padNum) return upper ? number.toString(base).toUpperCase() : number.toString(base).toLowerCase();
                const padded = abs(number).toString(base).padStart(padNum, padStr);
                const shaped = upper ? padded.toUpperCase() : padded.toLowerCase();
                if (0 <= number) return shaped;
                if (abs(number).toString(base).length < padNum) return shaped.replace(/^./, '-');
                return '-' + shaped;
            };

            const editor = vscode.window.activeTextEditor;
            if (editor === undefined) return;
            const curSelections = editor.selections;
            if (!curSelections.length) return;
            const input = await vscode.window.showInputBox({
                validateInput: text => {
                    const [padandstartInput, stepInput] = text.split(/(?=[+-][^+-]*$)/);
                    if (stepInput && !/^[+-](0[bBoOxX])?\d+$/.test(stepInput)) return "第二引数には数字を入力してください。進数指定をする場合は0X,0x,0O,0o,0B,0bから始めてください。"; 
                    if (stepInput && /^-0[bBoO]\d+$/.test(stepInput)) return "第二引数での負の数は10進数と16進数でしか指定できません"; 
                    return null;
                }
            });
            if (!input) return;
            const [padandstartInput, stepInput] = input.split(/(?=[+-][^+-]*$)/);
            const list: Record<string, number> = { b: 2, o: 8, d: 10, x: 16 };
            const [pre] = stepInput?.match(/(?<=^[+-]0)[bBoOxX]/) ?? ['d'];
            const base = list[pre.toLowerCase()];
            const { padStr, padNum, startInput } = parsePadStart(padandstartInput, pre.toLowerCase());
            const start = parseInt(startInput, base) || 0;
            console.log(startInput, base);
            console.log(start, base);
            const step = parseInt(stepInput, base) || 1;
            await editor.edit(edit => {
                for (const [indexStr, { active }] of Object.entries(curSelections)) {
                    const insertNum = start + Number(indexStr) * step;
                    const insertStr = shaping(insertNum, padNum, padStr, base, isUpper(pre));
                    edit.insert(active, insertStr);
                }
            });
        }),
    );
}

export function deactivate() {}

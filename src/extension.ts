import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "multicursor-utility" is now active!');

    const geneGetLineRange = (doc: vscode.TextDocument) => ({ start, end }: { start: vscode.Position, end: vscode.Position }) => doc.validateRange(
        new vscode.Selection(start.line, 0, end.line + 1, 0)
    );
    const insertString = (index: number, text: string, word: string) => text.slice(0, index) + word + text.slice(index);
    const range = (size: number) => [...Array(size)].map((_, i) => i);
    const abs = (number: number) => number < 0 ? -number : number;

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
            const editor = vscode.window.activeTextEditor;
            if (editor === undefined) return;
            const doc = editor.document;
            const getLineRange = geneGetLineRange(doc);
            const curSelections = editor.selections;
            if (!curSelections.length) return;

            const input = await vscode.window.showInputBox({
                validateInput: text => {
                    const [padandstartInput, stepInput, ...over] = text.split(/(?<!\\):/);
                    if (over.length) return ":が多すぎます。文字として:を使う時は\\:を入力してください。";
                    if (stepInput && !/^-?(0[bBoOxX])?\d+$/.test(stepInput)) return "第二引数には数字を入力してください。進数指定をする場合は0X,0x,0O,0o,0B,0bから始めてください。"; 
                    return null;
                }
            });
            if (!input) return;

            const [padandstartInput, stepInput] = input.split(/(?<!\\):/);

            const parcePadStart = (text: string) => {
                if (/^.+,\d+,.*$/.test(padandstartInput)) {
                    const [,padStr, numInput, startInput] = padandstartInput.match(/^(.+),(-?\d+),(.*)$/) ?? [];
                    const padNum = Number(numInput);
                    return { padStr, padNum, startInput };
                } else {
                    const [all, padStr, startInput] = padandstartInput.match(/^(.*?)((?!0)[0-9]*|0)$/) ?? [];
                    const padNum = all.length;
                    return { padStr, padNum, startInput };
                }
            };
            const shaping = (number: number, padNum: number, padStr: string = ' ') => {
                if (!padNum) return number.toString();
                const padded = abs(number).toString().padStart(padNum, padStr);
                if (0 <= number) return padded;
                if (abs(number).toString().length < padNum) return padded.replace(/^./, '-');
                return '-' + padded;
            };
            
            const { padStr, padNum, startInput } = parcePadStart(padandstartInput);
            const start = Number(startInput);
            const step = Number(stepInput || 1);
            await editor.edit(edit => {
                for (const [indexStr, { active }] of Object.entries(curSelections)) {
                    const insertNum = start + Number(indexStr) * step;
                    const insertStr = shaping(insertNum, padNum, padStr);
                    edit.insert(active, insertStr);
                }
            });
        }),
    );
}

export function deactivate() {}

import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    const geneGetLineRange = (doc: vscode.TextDocument) => ({ start, end }: { start: vscode.Position, end: vscode.Position }) => doc.validateRange(
        new vscode.Selection(start.line, 0, end.line + 1, 0)
    );
    const insertString = (index: number, text: string, word: string) => text.slice(0, index) + word + text.slice(index);
    const range = (size: number) => [...Array(size)].map((_, i) => i);

    /* eslint-disable @typescript-eslint/naming-convention */
    const baseSerialObj: Record<string, string> = {
        あ: 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゐゆゑよわをん',
        ア: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤヰユヱヨワヲン',
        い: 'いろはにほへとちりぬるをわかよたれそつねならむうゐのおくやまけふこえてあさきゆめみしゑひもせす',
        イ: 'イロハニホヘトチリヌルヲワカヨタレソツネナラムウヰノオクヤマケフコエテアサキユメミシヱヒモセス',
        a: 'abcdefghijklmnopqrstuvwxyz',
        A: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        d: '0123456789',
        D: '0123456789',
        b: '01',
        B: '01',
        o: '01234567',
        O: '01234567',
        x: '0123456789abcdef',
        X: '0123456789ABCDEF',
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

                const newText = insertString(char, textLine, '$' + String(i && curSelections.length - i));
                text[line] = newText;
            });
            const snippet = new vscode.SnippetString(text.join('\n'));
            editor.insertSnippet(snippet, snippetRange);
        }),
        vscode.commands.registerCommand('multicursor-utility.insertMulticursor', async () => {
            const parseInput = (input: string) => {
                if (input.includes(',')) {
                    const [inputNum, inputWord, inputGap] = input.split(',');
                    return { inputNum, inputWord, inputGap };
                } else {
                    const [,inputNum, inputWord] = input.match(/^(\d+)(\D*)$/) ?? [];
                    return { inputNum, inputWord };
                }
            };

            const editor = vscode.window.activeTextEditor;
            if (editor === undefined) return;
            const curSelections = editor.selections;

            const input = await vscode.window.showInputBox({
                validateInput: text => /^(|\d+\D*|\d+,[^,]*(,\d+)?)$/.test(text) ? null : "Error!",
                prompt: 'examples: "10", "5,_", "3"'
            });
            if (!input) return;
            const { inputNum, inputWord, inputGap } = parseInput(input);
            const num = Number(inputNum) || 0;
            const word = inputWord ?? '';
            const gap = Number(inputGap) || word.length || 1;
            if (!num) return;

            const newCurSelections = [] as vscode.Selection[];
            await editor.edit(edit => {
                for (const cur of curSelections) {
                    edit.insert(cur.active, word.repeat(num));
                    newCurSelections.push(
                        ...range(num).map(v => new vscode.Selection(
                            cur.active.translate(0, gap * v),
                            cur.active.translate(0, gap * v)
                        ))
                    );
                }
            });
            editor.selections = newCurSelections;
        }),
        vscode.commands.registerCommand('multicursor-utility.insertSerial', async () => {
            const parsePadStart = (text: string, base: keyof typeof baseSerialObj = 'd') => {
                const nR = baseSerialObj[base];

                if (text.includes(',')) {
                    const [padStr, padNumInput, startInput] = text.split(/,(?=[^,]*(,[^,]*)?$)/);
                    const padNum = Number(padNumInput) || 0;
                    const [startStr] = startInput.match(new RegExp(`[${nR}]*$`)) ?? [''];
                    return { padStr, padNum, startStr };
                } else {
                    const [,padStr, startInput] = text.match(new RegExp(`^(.*?)(-?(?!0)[${nR}]*)$`)) ?? [];
                    const padNum = text.length - startInput.length && text.length;
                    const startStr = startInput ?? '';
                    return { padStr, padNum, startStr };
                }
            };
            const shaping = (number: number, padNum: number, padStr = ' ', base = 'd') => {
                const converted = textPadder(convFromDec(number, baseSerialObj[base]) || baseSerialObj[base][0], padNum, padStr);
                if (0 <= number) return converted;
                return '-' + (converted.length < padNum ? converted.slice(1) : converted);
            };
            const convToDec = (before: string, serial: string): number => before.length <= 1 ? serial.indexOf(before) : (convToDec(before.slice(0, -1), serial) + ~~(serial.charAt(0) !== '0')) * serial.length + serial.indexOf(before.slice(-1));
            const convFromDec = (before: number, serial: string): string => before < serial.length ? serial.charAt(before) : convFromDec(before / serial.length - ~~(serial.charAt(0) !== '0') | 0, serial) + serial.charAt(before % serial.length);
            const wordCounter = (text: string) => text.length * 2 - (text.match(/[ -~]/g)?.length ?? 0);
            const textParser = (text: string) => text.split('').reduce((p, c) => p.concat(c.match(/[ -~]/) ? [c] : ['', c]), [] as string[]);
            const textPadder = (mainText: string, padNum: number, padText = ' ', fractionText = ' ') => {
                const parsePad = textParser(padText);
                const len = padNum - wordCounter(mainText);
                if (len < 0) return mainText;
                const repeatLen = len / parsePad.length | 0;
                const modLen = len % parsePad.length;
                const fraction = modLen && !parsePad[modLen - 1] ? fractionText : '';
                return padText.repeat(repeatLen) + parsePad.slice(0, modLen).join('') + fraction + mainText;
            };

            const editor = vscode.window.activeTextEditor;
            if (editor === undefined) return;
            const curSelections = editor.selections;
            if (!curSelections.length) return;
            const argParserReg = /(?=(?<!,)[＋+-][^＋+-]*$)/;
            const input = await vscode.window.showInputBox({
                prompt: 'example: "*,4,1+1", "001-0x1", "c+a"',
                title: 'Insert serials at multicursors position'
            });
            if (!input) return;
            const [padandstartInput, stepInput] = input.split(argParserReg);
            const [pre] = stepInput?.match(/(?<=^[+-]0)[box]|(?<=^[＋+-])[aあアいイ]/i)
                ?? Object.entries(baseSerialObj).find(v => v[1].includes(padandstartInput.slice(-1)))
                ?? ['d'];
            const baseSerial = baseSerialObj[pre];
            const [stepStr] = stepInput?.match(new RegExp(`[${baseSerial}]*$`)) ?? [''];
            const { padStr, padNum, startStr } = parsePadStart(padandstartInput, pre);
            const start = convToDec(startStr, baseSerial) || 0;
            const step = convToDec(stepStr, baseSerial) || 1;
            await editor.edit(edit => {
                for (const [indexStr, { active }] of Object.entries(curSelections)) {
                    const insertNum = start + Number(indexStr) * step;
                    const insertStr = shaping(insertNum, padNum, padStr, pre);
                    edit.insert(active, insertStr);
                }
            });
        }),
    );
}

export function deactivate() {}

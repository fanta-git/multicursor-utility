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
    const parseText = (text: string) => text.split('').reduce((p, c) => p.concat(c.match(/[ -~]/) ? [c] : [c, '']), [] as string[]);
    const padZenkaku = (mainText: string, padNum: number, padText = ' ', fractionText = ' ') => {
        const parseMain = parseText(mainText);
        const parsePad = parseText(padText);
        if (parseMain.length >= padNum) return mainText;
        const len = padNum - parseMain.length;
        const repeatLen = len / parsePad.length | 0;
        const modLen = len % parsePad.length;
        const padding = padText.repeat(repeatLen) + padText.slice(0, modLen) + (modLen && !parsePad[modLen - 1] ? fractionText : '') + mainText;
        return padding;
    };

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
            const editor = vscode.window.activeTextEditor;
            if (editor === undefined) return;
            const curSelections = editor.selections;

            const input = await vscode.window.showInputBox({
                validateInput: text => !text || /^\d*(:.+(\d*)?)?$/.test(text) ? null : "Error!"
            });
            if (!input) return;
            const [inputNum, inputWord, inputGap] = input.split(/(?<!\\):/);
            const num = Number(inputNum);
            const word = inputWord ?? '';
            const gap = Number(inputGap) || word.length || 1;
            if (!num) return;

            const newCurSelections = [] as vscode.Selection[];
            for (const cur of curSelections) {
                await editor.edit(edit => edit.insert(cur.active, word.repeat(num)));
                newCurSelections.push(
                    ...range(num).map(v => new vscode.Selection(
                        cur.active.translate(0, gap * v),
                        cur.active.translate(0, gap * v)
                    ))
                );
            }
            editor.selections = newCurSelections;
        }),
        vscode.commands.registerCommand('multicursor-utility.insertSerial', async () => {
            const parsePadStart = (text: string, base: keyof typeof baseSerialObj = 'd') => {
                const nR = baseSerialObj[base];
                const padPatarnCommaReg = new RegExp(`^(.*),(\\d*),(-?[${nR}]*)$`);
                const padPatarnSimpleReg = new RegExp(`^(.*?)(-?(?!0)[${nR}]*)$`);

                if (padPatarnCommaReg.test(text)) {
                    const [,padStr, padNumInput, startInput] = text.match(padPatarnCommaReg) ?? [];
                    const padNum = Number(padNumInput);
                    return { padStr, padNum, startInput };
                } else {
                    const [,padStr, startInput] = text.match(padPatarnSimpleReg) ?? [];
                    const padNum = text.length - startInput.length && text.length;
                    return { padStr, padNum, startInput };
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
                return padText.repeat(repeatLen) + parsePad.slice(0, modLen).join('') + (modLen && !parsePad[modLen - 1] ? fractionText : '') + mainText;
            };

            const editor = vscode.window.activeTextEditor;
            if (editor === undefined) return;
            const curSelections = editor.selections;
            if (!curSelections.length) return;
            const argParserReg = /(?=(?<!,)[＋+-][^＋+-]*$)/;
            const input = await vscode.window.showInputBox({
                // validateInput: text => {
                //     const [padandstartInput, stepInput] = text.split(argParserReg);
                //     return null;
                // }
            });
            if (!input) return;
            const [padandstartInput, stepInput] = input.split(argParserReg);
            const [pre] = stepInput?.match(/(?<=^[+-]0)[box]|(?<=^[＋+-])[aあアいイ]/i)
                ?? Object.entries(baseSerialObj).find(v => v[1].includes(padandstartInput.slice(-1)))
                ?? ['d'];
            const baseSerial = baseSerialObj[pre];
            const [stepStr] = stepInput?.match(new RegExp(`[${baseSerial}]*$`)) ?? [''];
            const { padStr, padNum, startInput } = parsePadStart(padandstartInput, pre);
            const start = convToDec(startInput, baseSerial) || 0;
            const step = convToDec(stepStr, baseSerial) || 1;
            console.log(start, step);
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

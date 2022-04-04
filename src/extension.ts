import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "multicursor-utility" is now active!');

    const getLineRange = ({ start, end }: { start: vscode.Position, end: vscode.Position }) => new vscode.Selection(
        new vscode.Position(start.line, 0),
        new vscode.Position(end.line + 1, 0)
    );

    const insertMultiCursor = vscode.commands.registerCommand('super-outdent.insertMultiCursor', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor === undefined) return;
        const doc = editor.document;
        const curSelections = editor.selections;
        if (!curSelections.length) return;

        const startLine = curSelections[0].active.line;
        const snippetRange = getLineRange({
            start: curSelections[0].active,
            end: curSelections[curSelections.length - 1].active
        });

        const text = doc.getText(snippetRange).split('\n');
        [...curSelections].reverse().forEach((v, i) => {
            const line = v.active.line - startLine;
            const char = v.active.character;
            const textLine = text[line];

            const newText = `${textLine.slice(0, char)}$${i && curSelections.length - i}${textLine.slice(char)}`;
            text[line] = newText;
        });
        const snippet = new vscode.SnippetString(text.join('\n'));
        editor.insertSnippet(snippet, snippetRange);
    });

    context.subscriptions.push(insertMultiCursor);
}

export function deactivate() {}

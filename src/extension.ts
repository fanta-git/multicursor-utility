import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "multicursor-utility" is now active!');

    const geneGetLineRange = (doc: vscode.TextDocument) => ({ start, end }: { start: vscode.Position, end: vscode.Position }) => doc.validateRange(
        new vscode.Selection(start.line, 0, end.line + 1, 0)
    );

    const insertTabstops = vscode.commands.registerCommand('multicursor-utility.insertTabstops', () => {
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

            const newText = `${textLine.slice(0, char)}$${i && curSelections.length - i}${textLine.slice(char)}`;
            text[line] = newText;
        });
        const snippet = new vscode.SnippetString(text.join('\n'));
        editor.insertSnippet(snippet, snippetRange);
    });

    context.subscriptions.push(insertTabstops);
}

export function deactivate() {}

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const cfcMap = new Map<string, string>(); // Map variable names to CFC names

    const completionProvider = vscode.languages.registerCompletionItemProvider('cfml', {
        async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
            const lineText = document.lineAt(position.line).text.substring(0, position.character);
            const variableMatch = lineText.match(/(\w+)\.$/);
            if (!variableMatch) return undefined;

            const variableName = variableMatch[1];
            const cfcName = cfcMap.get(variableName);
            if (!cfcName) return undefined;

            const cfcFilePath = getCfcFilePath(cfcName, document);
            const cfcContent = await readCfcFileContent(cfcFilePath);
            const methodsInfo = parseMethodsFromCfcContent(cfcContent);

            return Array.from(methodsInfo).map(([methodName, info]) => {
				const completionItem = new vscode.CompletionItem(methodName, vscode.CompletionItemKind.Method);
				
				// Format the method signature with proper parameter names and types, if available
				const paramsDetail = Array.from(info.params.entries())
										  .map(([paramName, paramDesc]) => `${paramName}: ${paramDesc.type}`) // Replace `TypeHere` with actual type if available
										  .join(', ');
										  
				// Set the method detail to include its parameters
				// Note: Adjust according to how you want to present method signatures
				completionItem.detail = `${methodName}(${paramsDetail})`;
			
				// Set the documentation to include the method description (hint) and parameters descriptions
				let documentationContent = info.doc; // Start with the method's main documentation
			
				// Append parameter descriptions
				info.params.forEach((desc, param) => {
					documentationContent += `\n\n**${param}**: ${desc.type}`;
				});
			
				completionItem.documentation = new vscode.MarkdownString(documentationContent);
				return completionItem;
			});
        }
    }, '.'); // Trigger completion when '.' is typed

    context.subscriptions.push(completionProvider);

    context.subscriptions.push(vscode.languages.registerHoverProvider('cfml', {
        provideHover(document, position) {
            const range = document.getWordRangeAtPosition(position);
            const lineText = document.lineAt(position.line).text;

            if (!range) return;

            const match = lineText.substring(0, range.end.character).match(/(\w+)\.(\w+)$/);
            if (!match) return;

            const variableName = match[1];
            const methodName = match[2];
            const cfcName = cfcMap.get(variableName);
            if (!cfcName) return;

            const cfcFilePath = getCfcFilePath(cfcName, document);
            const cfcContent = fs.readFileSync(cfcFilePath, 'utf8');
            const methodsInfo = parseMethodsFromCfcContent(cfcContent);
			const methodInfo = methodsInfo.get(methodName);
			if (methodInfo) {
				// Start with the method signature including return type
				let markdownString = `**function ${methodName}(${Array.from(methodInfo.params).map(([param, { type }]) => {
					return `${param}: ${type}`; // Insert the type information
				}).join(', ')})**: ${methodInfo.returnType}\n\n`;
				markdownString += methodInfo.doc;
	
				// Append parameter descriptions with types
				methodInfo.params.forEach(({ type, desc }, param) => {
					markdownString += `\n\n**${param} (${type})**\n${desc}`; // Include parameter types
				});
	
				const markdown = new vscode.MarkdownString(markdownString);
				return new vscode.Hover(markdown);
			}
		}
    }));

    vscode.workspace.onDidOpenTextDocument(parseCfmDocument);
    vscode.workspace.onDidChangeTextDocument((e) => parseCfmDocument(e.document));

    function parseCfmDocument(document: vscode.TextDocument) {
        if (document.languageId !== 'cfml') return;
        const text = document.getText();
        const pattern = /(?:var\s+)?(\w+)\s*=\s*createObject\((?:["']component["'],\s*)?["']([\w.]+)["']\)/g;
        let match;
        while ((match = pattern.exec(text))) {
            cfcMap.set(match[1], match[2]);
        }
    }
}

function getCfcFilePath(cfcName: string, document: vscode.TextDocument): string {
    const filePath = cfcName.replace(/\./g, path.sep) + '.cfc';
    const baseDir = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || '';
    return path.join(baseDir, filePath);
}

async function readCfcFileContent(cfcFilePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(cfcFilePath, 'utf8', (err, data) => {
            if (err) {
                vscode.window.showErrorMessage(`Error reading CFC file: ${err.message}`);
                reject('');
            }
            resolve(data);
        });
    });
}

export function parseMethodsFromCfcContent(content: string): Map<string, { signature: string, doc: string, returnType: string, params: Map<string, { type: string, desc: string, required: boolean }> }> {
    const methodInfo = new Map();
    const pattern = /\/\*\*\s*([\s\S]*?)\*\/\s*public\s+([\w]+)\s+function\s+([\w]+)\(\s*((?:required\s+)?\w+\s+\w+(?:,\s*(?:required\s+)?\w+\s+\w+)*)?\)/g;
    let match;

    while ((match = pattern.exec(content))) {
        const docBlock = match[1];
        const returnType = match[2];
        const methodName = match[3];
        const paramsSignature = match[4]; // This might be an empty string or undefined for functions without parameters

        const params = new Map();
        if (paramsSignature) { // Only attempt to process parameters if paramsSignature is not empty
            const paramPairs = paramsSignature.split(',').map(param => {
                const parts = param.trim().match(/(required\s+)?(\w+)\s+(\w+)/);
                if (!parts) return null;
                return {
                    name: parts[3], 
                    type: parts[2], 
                    required: !!parts[1] // Convert to boolean
                };
            }).filter(Boolean) as Array<{ name: string; type: string; required: boolean }>;

            for (const { name, type, required } of paramPairs) {
                params.set(name, { type, desc: '', required });
            }
        }

        // Initial documentation block parsing
        const hintMatch = docBlock.match(/@hint\s+([^\*]+)/);
        const doc = hintMatch ? hintMatch[1].trim() : '';

        // Extract parameters details
        const paramsPattern = /@(\w+)\s+([^\*]+)/g;
        let paramsMatch;
        while ((paramsMatch = paramsPattern.exec(docBlock))) {
            if (paramsMatch[1].toLowerCase() !== 'hint') {
                const paramName = paramsMatch[1];
                const paramDesc = paramsMatch[2].trim();

                if (params.has(paramName)) {
                    // Update the description for the parameter
                    const paramInfo = params.get(paramName);
                    if (paramInfo) {
                        paramInfo.desc = paramDesc;
                    }
                }
            }
        }

        // Construct the method signature including parameter types and names
        const paramConstructor = Array.from(params).map(([name, { type, required }]) => `${required ? 'required ' : ''}${type} ${name}`).join(', ');
        const signature = `${methodName}(${paramConstructor}): ${returnType}`;

        // Add method info to the map
        methodInfo.set(methodName, { signature, doc, returnType, params });
    }

    return methodInfo;
}



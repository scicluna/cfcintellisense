"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function activate(context) {
    const cfcMap = new Map(); // Map variable names to CFC names
    const completionProvider = vscode.languages.registerCompletionItemProvider('cfml', {
        async provideCompletionItems(document, position) {
            const lineText = document.lineAt(position.line).text.substring(0, position.character);
            const variableMatch = lineText.match(/(\w+)\.$/);
            if (!variableMatch)
                return undefined;
            const variableName = variableMatch[1];
            const cfcName = cfcMap.get(variableName);
            if (!cfcName)
                return undefined;
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
            if (!range)
                return;
            const match = lineText.substring(0, range.end.character).match(/(\w+)\.(\w+)$/);
            if (!match)
                return;
            const variableName = match[1];
            const methodName = match[2];
            const cfcName = cfcMap.get(variableName);
            if (!cfcName)
                return;
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
    function parseCfmDocument(document) {
        if (document.languageId !== 'cfml')
            return;
        const text = document.getText();
        const pattern = /(?:var\s+)?(\w+)\s*=\s*createObject\((?:["']component["'],\s*)?["']([\w.]+)["']\)/g;
        let match;
        while ((match = pattern.exec(text))) {
            cfcMap.set(match[1], match[2]);
        }
    }
}
exports.activate = activate;
function getCfcFilePath(cfcName, document) {
    const filePath = cfcName.replace(/\./g, path.sep) + '.cfc';
    const baseDir = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || '';
    return path.join(baseDir, filePath);
}
async function readCfcFileContent(cfcFilePath) {
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
function parseMethodsFromCfcContent(content) {
    const methodInfo = new Map();
    // Adjusted pattern to also capture parameter types
    const pattern = /\/\*\*\s*([\s\S]*?)\*\/\s*public\s+([\w]+)\s+function\s+([\w]+)\(([\w\s,:\[\]]*)\)/g;
    let match;
    while ((match = pattern.exec(content))) {
        const docBlock = match[1];
        const returnType = match[2]; // Capture the return type
        const methodName = match[3];
        const paramsSignature = match[4].trim();
        // Extract @hint for method documentation
        const hintMatch = docBlock.match(/@hint\s+([^\*]+)/);
        const doc = hintMatch ? hintMatch[1].trim() : '';
        const params = new Map();
        const paramPairs = paramsSignature.split(',').map(param => param.trim().split(/\s+/));
        for (const [type, name] of paramPairs) {
            if (type && name) {
                params.set(name, { type: type, desc: '' }); // Start with an empty description
            }
        }
        // Extract parameters details
        const paramsPattern = /@(\w+)\s+([^\*]+)/g;
        let paramsMatch;
        while ((paramsMatch = paramsPattern.exec(docBlock))) {
            if (paramsMatch[1].toLowerCase() !== 'hint') {
                const paramInfo = paramsMatch[1].split(':'); // Split the parameter into name and type
                const paramName = paramInfo[0].trim();
                if (params.has(paramName)) {
                    // Update the description for the parameter
                    const paramInfo = params.get(paramName);
                    if (paramInfo) {
                        paramInfo.desc = paramsMatch[2].trim();
                    }
                }
            }
        }
        const signature = `${methodName}(${paramsSignature}): ${returnType}`; // Include return type
        methodInfo.set(methodName, { signature, doc, returnType, params });
    }
    return methodInfo;
}
//# sourceMappingURL=extension.js.map
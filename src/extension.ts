import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// INTERFACES
// ============================================================================

interface CfcParameter {
    name: string;
    type: string;
    required: boolean;
    description: string;
    defaultValue: string | null;
}

interface CfcFunction {
    name: string;
    description: string;
    returnType: string;
    access: string;
    parameters: CfcParameter[];
    signature: string;
}

// ============================================================================
// STATE
// ============================================================================

const cfcCache = new Map<string, CfcFunction[]>();
const variableMap = new Map<string, string>();


// ============================================================================
// ACTIVATION
// ============================================================================

export function activate(context: vscode.ExtensionContext) {
    console.log('ColdFusion CFC Intellisense is now active.');

    scanWorkspace();

    const watcher = vscode.workspace.onDidSaveTextDocument(document => {
        if (document.languageId === 'cfml') {
            parseFile(document.uri);
        }
    });

    // --- Completion Provider (for autocomplete) ---
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        'cfml',
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                const linePrefix = document.lineAt(position).text.substring(0, position.character);
                const match = linePrefix.match(/([\w\.]+)\.$/);

                if (!match) {
                    return undefined;
                }

                const variablePath = match[1];

                // Case 1: The variable path is a known CFC instance (e.g., `application.validator.`)
                const cfcDotPath = variableMap.get(variablePath);
                if (cfcDotPath) {
                    const functions = cfcCache.get(cfcDotPath);
                    if (functions) {
                        return functions.map(func => {
                            const item = new vscode.CompletionItem(func.name, vscode.CompletionItemKind.Method);
                            item.detail = func.signature;
                            
                            const markdownDoc = new vscode.MarkdownString();
                            markdownDoc.appendMarkdown(`**${func.signature}**\n\n`);
                            markdownDoc.appendMarkdown(`${func.description}\n\n`);
                            func.parameters.forEach(p => {
                                markdownDoc.appendMarkdown(`*@param* \`${p.name}\` — ${p.description}\n`);
                            });
                            
                            item.documentation = markdownDoc;
                            return item;
                        });
                    }
                }

                // Case 2: The variable path is a scope like `application.`
                // We suggest child components found in our variable map.
                const childCompletions = new Set<string>();
                for (const key of variableMap.keys()) {
                    if (key.startsWith(variablePath + '.')) {
                        const remainingPath = key.substring(variablePath.length + 1);
                        const nextSegment = remainingPath.split('.')[0];
                        childCompletions.add(nextSegment);
                    }
                }
                
                if (childCompletions.size > 0) {
                    return Array.from(childCompletions).map(name => {
                        // Using 'Module' kind for components seems appropriate.
                        return new vscode.CompletionItem(name, vscode.CompletionItemKind.Module);
                    });
                }

                return undefined;
            }
        },
        '.' // Trigger on dot
    );

    // --- Hover Provider (for showing info on mouse-over) ---
const hoverProvider = vscode.languages.registerHoverProvider(
    'cfml',
    {
        provideHover(document: vscode.TextDocument, position: vscode.Position) {
            // --- This initial part to find the function is the same ---
            const range = document.getWordRangeAtPosition(position, /[\w\.]+/);
            if (!range) return;
            const potentialCall = document.getText(range);
            const parts = potentialCall.split('.');
            if (parts.length < 2) return;
            const methodName = parts.pop() as string;
            const variablePath = parts.join('.');
            const cfcDotPath = variableMap.get(variablePath);
            if (!cfcDotPath) return;
            const functions = cfcCache.get(cfcDotPath);
            const func = functions?.find(f => f.name.toLowerCase() === methodName.toLowerCase());
            if (!func) return;

            // =================================================================
            // NEW, ENHANCED HOVER TOOLTIP
            // =================================================================

            // STEP 1: Build a richly formatted Markdown string for the signature.
            // We can't put this in a code block if we want to use italics,
            // so we build it as a standard Markdown line.
            let hoverSignature = `(${func.access}) *${func.returnType}* **${func.name}**(`;
            
            func.parameters.forEach((param, index) => {
                if (param.required) {
                    hoverSignature += 'required ';
                }
                hoverSignature += `*${param.type}* ${param.name}`;
                if (param.defaultValue !== null) {
                    hoverSignature += ` = ${param.defaultValue}`;
                }
                if (index < func.parameters.length - 1) {
                    hoverSignature += ', ';
                }
            });
            hoverSignature += `)`;
            
            // STEP 2: Assemble the final MarkdownString for the hover pop-up.
            const markdownDoc = new vscode.MarkdownString();
            // Add our rich signature line
            markdownDoc.appendMarkdown(hoverSignature);
            markdownDoc.appendMarkdown('\n\n---\n\n');
            // Add the main function description
            markdownDoc.appendMarkdown(func.description);
            
            // Add parameter descriptions
            if (func.parameters.length > 0) {
                markdownDoc.appendMarkdown('\n\n**Parameters:**\n');
                func.parameters.forEach(p => {
                    markdownDoc.appendMarkdown(`- \`${p.name}\` — ${p.description}\n`);
                });
            }

            return new vscode.Hover(markdownDoc);
        }
    }
);
    
    // --- Signature Help Provider (for parameter info) ---
    const signatureHelpProvider = vscode.languages.registerSignatureHelpProvider(
    'cfml',
        {
            provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position) {
                // --- This initial part to find the function data is the same ---
                const lineText = document.lineAt(position.line).text;
                const textToCursor = lineText.substring(0, position.character);
                const functionCallMatch = textToCursor.match(/([\w\.]+)\(([\s\S]*)$/);
                if (!functionCallMatch) { return undefined; }
                const fullMethodPath = functionCallMatch[1];
                const typedArgs = functionCallMatch[2];
                const pathParts = fullMethodPath.split('.');
                const methodName = pathParts.pop();
                const variablePath = pathParts.join('.');
                if (!methodName || !variablePath) { return undefined; }
                const cfcDotPath = variableMap.get(variablePath);
                if (!cfcDotPath) { return undefined; }
                const functions = cfcCache.get(cfcDotPath);
                const funcData = functions?.find(f => f.name.toLowerCase() === methodName.toLowerCase());
                if (!funcData) { return undefined; }

                // =================================================================
                // THE DEFINITIVE MINIMALIST LAYOUT (WITH ITALIC DESCRIPTION)
                // =================================================================

                // STEP 1: Create the main documentation for the function.
                let mainDocumentation: vscode.MarkdownString | undefined = undefined;
                if (funcData.description && funcData.description !== 'No description provided.') {
                    // **** THIS IS THE ONLY LINE THAT CHANGED ****
                    // We wrap the description in asterisks to make it italic in Markdown.
                    mainDocumentation = new vscode.MarkdownString(`*${funcData.description}*`);
                }
                
                // STEP 2: Build the top-line signature label AND the ParameterInformation array.
                const parameterInfos: vscode.ParameterInformation[] = [];
                let plainTextLabel = `${funcData.name}(`;
                
                funcData.parameters.forEach((param, index) => {
                    let paramString = `${param.type} ${param.name}`;
                    if (param.defaultValue !== null) {
                        paramString += ` = ${param.defaultValue}`;
                    }
                    const start = plainTextLabel.length;
                    const end = start + paramString.length;
                    plainTextLabel += paramString;
                    const paramDoc = (param.description) ? new vscode.MarkdownString(param.description) : undefined;
                    parameterInfos.push(new vscode.ParameterInformation([start, end], paramDoc));
                    if (index < funcData.parameters.length - 1) {
                        plainTextLabel += ', ';
                    }
                });
                plainTextLabel += `): ${funcData.returnType}`;

                // STEP 3: Create the final SignatureInformation object.
                const signatureInfo = new vscode.SignatureInformation(plainTextLabel, mainDocumentation);
                signatureInfo.parameters = parameterInfos;

                const help = new vscode.SignatureHelp();
                help.signatures = [signatureInfo];
                help.activeSignature = 0;
                help.activeParameter = (typedArgs.match(/,/g) || []).length;

                return help;
            }
        },
        '(', ','
    );
    context.subscriptions.push(watcher, completionProvider, hoverProvider, signatureHelpProvider);
}

// ============================================================================
// WORKSPACE SCANNING
// ============================================================================

async function scanWorkspace() {
    cfcCache.clear();
    variableMap.clear();
    const files = await vscode.workspace.findFiles('**/*.{cfc,cfm}');
    console.log(`Found ${files.length} files to scan.`);
    for (const file of files) {
        await parseFile(file);
    }
    console.log(`Workspace scan complete. Mapped ${variableMap.size} variables and cached ${cfcCache.size} CFCs.`);
}

async function parseFile(fileUri: vscode.Uri) {
    try {
        const content = await vscode.workspace.fs.readFile(fileUri);
        const fileContent = Buffer.from(content).toString('utf-8');
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
        if (!workspaceFolder) return;

        if (fileUri.path.endsWith('.cfc')) {
            const cfcDotPath = getCfcDotPath(fileUri.fsPath, workspaceFolder.uri.fsPath);
            const functions = parseCfcFunctions(fileContent);
            if (functions.length > 0) {
                cfcCache.set(cfcDotPath, functions);
            }
        }
        
        parseVariableAssignments(fileContent);

    } catch (error) {
        console.error(`Error parsing file ${fileUri.fsPath}:`, error);
    }
}


// ============================================================================
// PARSING LOGIC
// ============================================================================
function parseCfcFunctions(content: string): CfcFunction[] {
    const functions: CfcFunction[] = [];
    const functionRegex = /\/\*\*\s*([\s\S]+?)\*\/[\s\r\n]*((?:public|private|remote|package|)\s+)?(?:(\w+)\s+)?function\s+([\w]+)\s*\(([\s\S]*?)\)/g;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
        const docBlock = match[1];
        const access = match[2]?.trim() || 'public';
        const returnType = match[3] || 'any';
        const name = match[4];
        const paramsString = match[5];

        const hintMatch = docBlock.match(/@hint\s+([^\r\n\*]+)/);
        const description = hintMatch ? hintMatch[1].trim() : 'No description provided.';
        
        const docParams = new Map<string, string>();
        const paramDocRegex = /@(\w+)\s+([^\r\n\*]+)/g;
        let paramDocMatch;
        while((paramDocMatch = paramDocRegex.exec(docBlock))) {
            if (paramDocMatch[1].toLowerCase() !== 'hint') {
                docParams.set(paramDocMatch[1].toLowerCase(), paramDocMatch[2].trim());
            }
        }

        const parameters: CfcParameter[] = [];
        if (paramsString.trim()) {
            const paramParts = paramsString.split(',');
            for (const part of paramParts) {
                const paramRegex = /(required\s+)?(\w+)\s+(\w+)(?:\s*=\s*([\s\S]+))?/;
                const paramMatch = part.trim().match(paramRegex);
                if (paramMatch) {
                    const paramName = paramMatch[3];
                    parameters.push({
                        name: paramName,
                        type: paramMatch[2],
                        required: !!paramMatch[1],
                        description: docParams.get(paramName.toLowerCase()) || '',
                        defaultValue: paramMatch[4]?.trim() || null
                    });
                }
            }
        }
        
        const paramSignature = parameters.map(p => `${p.type} ${p.name}`).join(', ');
        const signature = `${name}(${paramSignature}): ${returnType}`;

        functions.push({ name, description, returnType, access, parameters, signature });
    }

    return functions;
}

function parseVariableAssignments(content: string) {
    // This new regex has two capture groups:
    // 1. The full variable path on the left of the =
    // 2. The CFC dot-path on the right
    const assignmentRegex = /([\w\.]+)\s*=\s*createObject\(\s*(?:(?:'component'|"component")\s*,\s*)?['"]([\w\.]+)['"]\s*\)/g;
    let match;

    while ((match = assignmentRegex.exec(content)) !== null) {
        const fullVariablePath = match[1]; // e.g., "this.validator", "application.validator", "myValidator"
        const cfcDotPath = match[2];       // e.g., "cfc.Validator"

        if (fullVariablePath && cfcDotPath) {
            // Always map the direct path that was found
            console.log(`[Parser] Mapping variable "${fullVariablePath}" to CFC "${cfcDotPath}"`);
            variableMap.set(fullVariablePath, cfcDotPath);

            // SPECIAL CASE: If the assignment is in the 'this' scope (common in Application.cfc),
            // we ALSO create a mapping for the 'application' scope so it can be accessed both ways.
            if (fullVariablePath.startsWith('this.')) {
                // Create the equivalent application.x.y path
                const applicationPath = 'application.' + fullVariablePath.substring(5);
                console.log(`[Parser] ALSO mapping variable "${applicationPath}" to CFC "${cfcDotPath}" (from 'this' scope)`);
                variableMap.set(applicationPath, cfcDotPath);
            }
        }
    }
}


// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getCfcDotPath(fsPath: string, rootPath: string): string {
    const relativePath = path.relative(rootPath, fsPath);
    return relativePath
        .replace(/\.cfc$/i, '')
        .replace(/\\/g, '.')
        .replace(/\//g, '.');
}

export function deactivate() {}
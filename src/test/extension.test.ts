import * as vscode from 'vscode';
import * as assert from 'assert';
import { parseMethodsFromCfcContent } from '../extension';

suite('Extension Test Suite', () => {
    test('parseMethodsFromCfcContent should parse a function with no arguments correctly', () => {
        const content = `
        /**
         * @hint This method does something.
         */
        public void function doThing() {
        }
        `;

        const result = parseMethodsFromCfcContent(content);
        const methodInfo = result.get('doThing');

        assert.ok(methodInfo, 'doThing method should be parsed');
        assert.strictEqual(methodInfo.signature, 'doThing(): void', 'Signature should match');
        assert.strictEqual(methodInfo.doc, 'This method does something.', 'Documentation should match');
        assert.strictEqual(methodInfo.params.size, 0, 'There should be no parameters');
    });

    test('parseMethodsFromCfcContent should parse functions with required and optional arguments correctly', () => {
        const content = `
        /**
         * @hint Appends the proper root.
         * @param query The query that needs to be fixed
         */
        public query function appendRoot(required query query) {
        }
        `;

        const result = parseMethodsFromCfcContent(content);
        const methodInfo = result.get('appendRoot');

        assert.ok(methodInfo, 'appendRoot method should be parsed');
        assert.strictEqual(methodInfo.signature.includes('required query query'), true, 'Signature should include required query');
        assert.strictEqual(methodInfo.params.has('query'), true, 'Parameters should include query');
        const paramInfo = methodInfo.params.get('query');
        assert.ok(paramInfo, 'query parameter info should be available');
        assert.strictEqual(paramInfo.type, 'query', 'Parameter type should be query');
        assert.strictEqual(paramInfo.required, true, 'Parameter should be required');
    });

    // Add more tests here as needed
});

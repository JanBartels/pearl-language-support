// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { defaultSettings } from '../../settings/pearlSettings';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import type { WorkspaceManager } from '../../utility/workspace';
import { Validator } from '../../validation/validator';
import { TokenLegend } from '../tokenLegend';
import { SourceHighlightMapper } from '../sourceHighlightMapper';

const uri = 'file:///semantic-symbols.P';
const logger: Logger = {info() {}, warn() {}, error() {}};

test('validator provides classified compiler symbols to the LSP mapper', async () => {
    const document = TextDocument.create(uri, 'pearl', 1, `P=MPC603; SC=100; MODULE Test; PROBLEM;
        TYPE MyType STRUCT[E FIXED];
        DCL Value INV MyType INIT((7));
        Main: TASK;
            IF Value.E == 7 THEN ; FIN;
        END;
        MODEND;`);
    const validator = new Validator({} as WorkspaceManager, {} as DocumentRegistry, logger);
    const result = await validator.analyze(document, defaultSettings);
    assert.ok(result.rootAnalysis.sourceHighlights.length > 0);
    const legend = new TokenLegend();
    const mapped = new SourceHighlightMapper(legend).map(document, result.rootAnalysis.sourceHighlights);
    const decoded: {text: string; type: number; modifiers: number}[] = [];
    let line = 0;
    let character = 0;
    for (let i = 0; i < mapped.data.length; i += 5) {
        line += mapped.data[i];
        character = mapped.data[i] === 0 ? character + mapped.data[i + 1] : mapped.data[i + 1];
        const length = mapped.data[i + 2];
        const start = document.offsetAt({line, character});
        decoded.push({text: document.getText().slice(start, start + length),
            type: mapped.data[i + 3], modifiers: mapped.data[i + 4]});
    }
    const type = legend.getType('type');
    const variable = legend.getType('variable');
    const property = legend.getType('property');
    const declaration = legend.getModifierMask(['declaration']);
    const readOnlyDeclaration = legend.getModifierMask(['declaration', 'readonly']);
    const readOnly = legend.getModifierMask(['readonly']);
    assert.ok(decoded.some(token => token.text === 'MyType' && token.type === type
        && token.modifiers === declaration));
    assert.ok(decoded.some(token => token.text === 'MyType' && token.type === type
        && token.modifiers === 0));
    assert.ok(decoded.some(token => token.text === 'Value' && token.type === variable
        && token.modifiers === readOnlyDeclaration));
    assert.ok(decoded.some(token => token.text === 'Value' && token.type === variable
        && token.modifiers === readOnly));
    assert.equal(decoded.filter(token => token.text === 'E' && token.type === property).length, 2);
});

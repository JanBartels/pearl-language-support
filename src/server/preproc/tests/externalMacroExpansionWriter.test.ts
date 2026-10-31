// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mapToOriginalLocation } from '../../core/sourceOffset';
import { FileSource } from '../../source/fileSource';
import { MacroTable } from '../macroTable';
import { ExternalPreprocessorResultBuilder } from '../externalPreprocessorResult';
import { appendExpandedMacro } from '../externalMacroExpansionWriter';

function run(declarations: boolean) {
    const root = new FileSource('file:///RecursiveMacros.P', 'VAR Var( Boundary ) FIXED;');
    const table = new MacroTable();
    table.define('VAR', declarations ? 'DCL' : 'SPC');
    table.define('WertIst', declarations ? ' ' : '/*');
    table.define('WertEnde', declarations ? ' ' : '*/');
    table.define('Count', '40');
    table.define('Boundary', 'WertIst 0:Count WertEnde');
    const builder = new ExternalPreprocessorResultBuilder(root);
    const errors: string[] = [];
    const onError = (_location: unknown, message: string) => errors.push(message);
    const varInvocation = { source: root, span: { start: 0, end: 3 } };
    const boundaryInvocation = { source: root, span: { start: 9, end: 17 } };
    appendExpandedMacro(builder, table.get('VAR')!, varInvocation, name => table.get(name), onError);
    builder.appendOriginal({ source: root, span: { start: 3, end: 9 } });
    appendExpandedMacro(builder, table.get('Boundary')!, boundaryInvocation, name => table.get(name), onError);
    builder.appendOriginal({ source: root, span: { start: 17, end: root.length } });
    return { result: builder.build(), root, errors, boundaryInvocation };
}

test('generated comment reaches final source without premature lexing', () => {
    const { result, errors, boundaryInvocation } = run(false);
    assert.equal(result.source.text, 'SPC Var( /* 0:40 */ ) FIXED;');
    assert.deepEqual(errors, []);
    assert.deepEqual(result.macroReferences.map(ref => ref.definition.name),
        ['VAR', 'Boundary', 'WertIst', 'Count', 'WertEnde']);
    const begin = result.source.text.indexOf('/*');
    assert.deepEqual(mapToOriginalLocation({ source: result.source, span: { start: begin, end: begin + 2 } }), boundaryInvocation);
});

test('declaration variant retains bounds instead of a comment', () => {
    const { result, errors } = run(true);
    assert.equal(result.source.text, 'DCL Var(   0:40   ) FIXED;');
    assert.deepEqual(errors, []);
});

test('unchanged text maps to its precise original span', () => {
    const { result, root } = run(false);
    const start = result.source.text.indexOf('Var(');
    assert.deepEqual(mapToOriginalLocation({ source: result.source, span: { start, end: start + 4 } }),
        { source: root, span: { start: 4, end: 8 } });
});

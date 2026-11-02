// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { expandMacroText } from '../macroTextExpander';
import { MacroTable } from '../macroTable';
import type { Location } from '../../core/location';

// A minimal Source is sufficient: expansion must not invoke the PEARL lexer.
const source = {
    uri: 'file:///RecursiveMacros.P', text: 'Boundary', length: 8,
    getText: (span?: { start: number; end: number }) => span ? 'Boundary'.slice(span.start, span.end) : 'Boundary',
    mapLocation: (location: Location) => location
};
const invocation: Location = { source, span: { start: 0, end: 8 } };

describe('expandMacroText', () => {
    it('produces a comment spanning several nested macro replacements', () => {
        const table = new MacroTable();
        table.define('WertIst', '/*');
        table.define('WertEnde', '*/');
        table.define('Count', '40');
        table.define('Boundary', 'WertIst 0:Count WertEnde');
        const errors: string[] = [];
        const result = expandMacroText(table.get('Boundary')!, invocation,
            name => table.get(name), (_location, message) => errors.push(message));
        assert.equal(result.fragments.map(f => f.text).join(''), '/* 0:40 */');
        assert.deepEqual(result.references.map(r => r.definition.name), [
            'Boundary', 'WertIst', 'Count', 'WertEnde'
        ]);
        assert.deepEqual(errors, []);
        assert.equal(result.fragments.every(f => f.invocation === invocation), true);
    });

    it('preserves the declaration variant and does not expand string contents', () => {
        const table = new MacroTable();
        table.define('Count', '40');
        table.define('WertIst', ' ');
        table.define('WertEnde', ' ');
        table.define('Boundary', "WertIst 0:Count WertEnde 'Count'");
        const result = expandMacroText(table.get('Boundary')!, invocation, name => table.get(name), () => {});
        assert.equal(result.fragments.map(f => f.text).join(''), "  0:40   'Count'");
    });

    it('terminates a cyclic macro expansion with a diagnostic', () => {
        const table = new MacroTable();
        table.define('A', 'B');
        table.define('B', 'A');
        const errors: string[] = [];
        expandMacroText(table.get('A')!, invocation, name => table.get(name),
            (_location, message) => errors.push(message));
        assert.equal(errors.length, 1);
        assert.ok(errors[0]?.includes('A -> B -> A'));
    });
});

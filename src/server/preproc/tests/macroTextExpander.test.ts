// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { describe, expect, it } from 'vitest';
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
        expect(result.fragments.map(f => f.text).join('')).toBe('/* 0:40 */');
        expect(result.references.map(r => r.definition.name)).toEqual([
            'Boundary', 'WertIst', 'Count', 'WertEnde'
        ]);
        expect(errors).toEqual([]);
        expect(result.fragments.every(f => f.invocation === invocation)).toBe(true);
    });

    it('preserves the declaration variant and does not expand string contents', () => {
        const table = new MacroTable();
        table.define('Count', '40');
        table.define('WertIst', ' ');
        table.define('WertEnde', ' ');
        table.define('Boundary', "WertIst 0:Count WertEnde 'Count'");
        const result = expandMacroText(table.get('Boundary')!, invocation, name => table.get(name), () => {});
        expect(result.fragments.map(f => f.text).join('')).toBe("  0:40   'Count'");
    });

    it('terminates a cyclic macro expansion with a diagnostic', () => {
        const table = new MacroTable();
        table.define('A', 'B');
        table.define('B', 'A');
        const errors: string[] = [];
        expandMacroText(table.get('A')!, invocation, name => table.get(name),
            (_location, message) => errors.push(message));
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('A -> B -> A');
    });
});

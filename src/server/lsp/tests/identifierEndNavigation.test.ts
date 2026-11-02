// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import test from 'node:test';
import assert from 'node:assert/strict';
import type { Position } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceValue } from '../../core/sourceValue';
import { FileSource } from '../../source/fileSource';
import type { Analysis } from '../../validation/analysis';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import { MacroOccurrenceIndex } from '../../preproc/macroOccurrenceIndex';
import { findReferences } from '../findReferences';
import { findMacroReferences } from '../findMacroReferences';
import { identifierEndFallbackPosition } from '../identifierEndFallback';

const uri = 'file:///nav-test.P';

function fixture(text: string) {
    const source = new FileSource(uri, text);
    const document = {
        getText: () => text,
        offsetAt(position: Position): number {
            const lines = text.split('\n');
            return lines.slice(0, position.line).reduce((sum, line) => sum + line.length + 1, 0) + position.character;
        },
        positionAt(offset: number): Position {
            const prefix = text.slice(0, offset);
            const lines = prefix.split('\n');
            return { line: lines.length - 1, character: lines[lines.length - 1]!.length };
        }
    } as TextDocument;
    const registry = { get: (candidate: string) => candidate === uri ? document : null } as DocumentRegistry;
    const occurrence = (value: string, start: number) => new SourceValue(value, {
        source,
        span: { start, end: start + value.length }
    });
    return { source, document, registry, occurrence };
}

test('Find References: caret on the last character and just after the name are equivalent', () => {
    const { registry, occurrence } = fixture('aloha;\naloha;');
    const declaration = occurrence('aloha', 0);
    const reference = occurrence('aloha', 7);
    const analysis = { symbolOccurrences: { all: [{
        declaration, declarations: [declaration], references: [reference]
    }] } } as unknown as Analysis;
    const inside = findReferences(analysis, uri, { line: 0, character: 2 }, true, registry);
    const after = findReferences(analysis, uri, { line: 0, character: 5 }, true, registry);
    assert.equal(inside.length, 2);
    assert.deepEqual(after, inside);
    assert.equal(findReferences(analysis, uri, { line: 0, character: 6 }, true, registry).length, 0);
});

test('Find References: an exact hit takes precedence over a left-side fallback', () => {
    const { registry, occurrence } = fixture('one two');
    const left = occurrence('one', 0);
    const right = occurrence('two', 4);
    const analysis = { symbolOccurrences: { all: [
        { declaration: left, declarations: [left], references: [] },
        { declaration: right, declarations: [right], references: [] }
    ] } } as unknown as Analysis;
    const results = findReferences(analysis, uri, { line: 0, character: 4 }, true, registry);
    assert.equal(results.length, 1);
    assert.equal(results[0]!.range.start.character, 4);
});

test('Find References: multiple matching groups stay ambiguous', () => {
    const { registry, occurrence } = fixture('aloha;');
    const a = occurrence('aloha', 0);
    const b = occurrence('aloha', 0);
    const analysis = { symbolOccurrences: { all: [
        { declaration: a, declarations: [a], references: [] },
        { declaration: b, declarations: [b], references: [] }
    ] } } as unknown as Analysis;
    assert.deepEqual(findReferences(analysis, uri, { line: 0, character: 5 }, true, registry), []);
});

test('Macro References: caret at the end of a macro invocation still resolves', () => {
    const { registry, occurrence } = fixture('Boundary;\nBoundary;');
    const definition = { name: 'Boundary', replacement: '40', location: occurrence('Boundary', 0).location };
    const reference = { definition, location: occurrence('Boundary', 10).location! };
    const index = new MacroOccurrenceIndex([definition], [reference]);
    const inside = findMacroReferences(index, uri, { line: 1, character: 2 }, true, registry);
    const after = findMacroReferences(index, uri, { line: 1, character: 8 }, true, registry);
    assert.equal(inside?.length, 2);
    assert.deepEqual(after, inside);
});

test('Caret fallback: recognizes PEARL identifier boundaries, not the interior of names', () => {
    const { document } = fixture('aloha; xyz_9 foo');
    assert.deepEqual(identifierEndFallbackPosition(document, { line: 0, character: 5 }), { line: 0, character: 4 });
    assert.deepEqual(identifierEndFallbackPosition(document, { line: 0, character: 12 }), { line: 0, character: 11 });
    assert.equal(identifierEndFallbackPosition(document, { line: 0, character: 2 }), undefined);
    assert.equal(identifierEndFallbackPosition(document, { line: 0, character: 6 }), undefined);
    assert.equal(identifierEndFallbackPosition(document, { line: 0, character: 0 }), undefined);
});

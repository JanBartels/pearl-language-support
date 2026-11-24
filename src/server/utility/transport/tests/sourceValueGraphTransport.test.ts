// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SourceValue } from '../../../core/sourceValue';
import { ExpandedSourceBuilder } from '../../../source/expandedSource';
import { FileSource } from '../../../source/fileSource';
import { SourceValueGraphEncoder, decodeSourceValueGraph } from '../sourceValueGraphTransport';

const span = (start: number, end: number) => ({ start, end });

test('restores SourceValue identity independent of equal values and locations', () => {
    const file = new FileSource('file:///definitions.h', 'NAME NAME');
    const expandedBuilder = new ExpandedSourceBuilder(file);
    expandedBuilder.appendOriginal({ source: file, span: span(0, 4) });
    expandedBuilder.appendOriginal({ source: file, span: span(5, 9) });
    const expanded = expandedBuilder.build();
    const location = { source: file, span: span(0, 4) };
    const declaration = new SourceValue('NAME', location, { source: expanded, span: span(0, 4) });
    const reference = new SourceValue('NAME', location, { source: expanded, span: span(4, 8) });
    const unrelated = new SourceValue('NAME', location);
    const encoder = new SourceValueGraphEncoder();
    const declarationId = encoder.encode(declaration);
    const referenceId = encoder.encode(reference);
    const otherId = encoder.encode(unrelated);
    assert.equal(encoder.encode(declaration), declarationId);
    assert.notEqual(declarationId, referenceId);
    assert.notEqual(referenceId, otherId);

    const wire = structuredClone(encoder.finish([file, expanded]));
    assert.deepEqual(JSON.parse(JSON.stringify(wire)), wire);
    const decoded = decodeSourceValueGraph(wire);
    const restoredDeclaration = decoded.resolve(declarationId);
    const restoredReference = decoded.resolve(referenceId);
    assert.ok(restoredDeclaration instanceof SourceValue);
    assert.notEqual(restoredDeclaration, restoredReference);
    assert.equal(decoded.resolve(declarationId), restoredDeclaration);
    assert.equal(restoredDeclaration.location?.source, decoded.sources.roots[0]);
    assert.equal(restoredReference.lexicalLocation?.source, decoded.sources.roots[1]);
    assert.equal(restoredReference.contains({ uri: file.uri, offset: 1, occurrenceSpan: span(4, 8) }), true);
    assert.equal(restoredDeclaration.contains({ uri: file.uri, offset: 1, occurrenceSpan: span(4, 8) }), false);

    const bindings = new Map([
        [restoredDeclaration, 'declaration'],
        [restoredReference, 'reference']
    ]);
    assert.equal(bindings.get(decoded.resolve(declarationId)), 'declaration');
    assert.equal(bindings.get(decoded.resolve(referenceId)), 'reference');
    assert.equal(bindings.size, 2);
});

test('supports scalar SourceValue values and explicit synthetic locations', () => {
    const encoder = new SourceValueGraphEncoder();
    const literals = ['STRING', true, false, 42, 0.25, 12345678901234567890n, null, undefined];
    const ids = literals.map(value => encoder.encode(new SourceValue(value)));
    const decoded = decodeSourceValueGraph(structuredClone(encoder.finish()));
    assert.deepEqual(ids.map(id => decoded.resolve(id).value), literals);
    assert.ok(ids.every(id => decoded.resolve(id).location === undefined));
    assert.ok(ids.every(id => decoded.resolve(id).lexicalLocation === undefined));
});

test('fails loudly for unsupported payloads, invalid identities and dangling references', () => {
    const encoder = new SourceValueGraphEncoder();
    assert.throws(() => encoder.encode(new SourceValue({ key: 'value' })), /Unsupported SourceValue payload/);
    const id = encoder.encode(new SourceValue('A'));
    const wire = encoder.finish();
    assert.throws(() => decodeSourceValueGraph({ ...wire, values: [...wire.values, wire.values[0]!] }), /duplicate/);
    assert.throws(() => decodeSourceValueGraph({ ...wire, values: [{ ...wire.values[0]!, id: -1 }] }), /Invalid/);
    const decoded = decodeSourceValueGraph(wire);
    assert.equal(decoded.resolve(id).value, 'A');
    assert.throws(() => decoded.resolve(100), /Missing SourceValue identity/);
});

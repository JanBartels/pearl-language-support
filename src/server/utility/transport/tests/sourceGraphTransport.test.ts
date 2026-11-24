// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Lexer } from '../../../lexer/lexer';
import { ProblemCollection } from '../../../core/problemCollection';
import { MacroTable } from '../../../preproc/macroTable';
import { ConditionalStack } from '../../../preproc/conditionalStack';
import { PreprocessorConditionalBlockStack } from '../../../preproc/preprocessorConditionalBlockStack';
import { PreprocessorConditionalBlockCollection } from '../../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorContext } from '../../../preproc/preprocessorContext';
import { Preprocessor } from '../../../preproc/preprocessor';
import { mapToOriginalLocation, mapToOriginalLocations } from '../../../core/sourceOffset';
import { SourceValue } from '../../../core/sourceValue';
import { ExpandedSource, ExpandedSourceBuilder } from '../../../source/expandedSource';
import { FileSource } from '../../../source/fileSource';
import { MacroSource } from '../../../source/macroSource';
import type { Source } from '../../../source/source';
import {
    SourceGraphEncoder, decodeSourceGraph, encodeSourceGraph,
    type SourceGraphWire
} from '../sourceGraphTransport';

const span = (start: number, end: number) => ({ start, end });

function sample() {
    const root = new FileSource('file:///project/main.P', 'abc CALL xy');
    const include = new FileSource('file:///project/defs.h', '1234');
    const includedAgain = new FileSource('file:///project/defs.h', '1234');
    const macro = new MacroSource({ source: root, span: span(4, 8) }, 'WXYZ');
    const nested = new ExpandedSourceBuilder(macro);
    nested.appendOriginal({ source: macro, span: span(0, 2) });
    nested.appendExpansion('Q', { source: include, span: span(1, 3) });
    const nestedSource = nested.build();
    const expanded = new ExpandedSourceBuilder(root);
    expanded.appendOriginal({ source: root, span: span(0, 3) });
    expanded.appendOriginal({ source: include, span: span(0, 4) });
    expanded.appendOriginal({ source: includedAgain, span: span(2, 4) });
    expanded.appendExpansion('HELLO', { source: root, span: span(4, 8) });
    expanded.appendOriginal({ source: nestedSource, span: span(0, 3) });
    return { root, include, includedAgain, macro, nestedSource, expanded: expanded.build() };
}

function mappedOrigins(source: Source, start: number, end: number) {
    return mapToOriginalLocations({ source, span: span(start, end) })
        .map(item => [item.source.uri, item.span.start, item.span.end]);
}

test('roundtrip restores all three Source classes and direct/generated mappings', () => {
    const original = sample();
    const payload = structuredClone(encodeSourceGraph([original.expanded, original.root, original.macro]));
    const decoded = decodeSourceGraph(payload);
    const [expanded, root, macro] = decoded.roots;
    assert.ok(expanded instanceof ExpandedSource);
    assert.ok(root instanceof FileSource);
    assert.ok(macro instanceof MacroSource);
    assert.equal(expanded.text, original.expanded.text);
    assert.equal(root.text, original.root.text);
    assert.equal(macro.text, original.macro.text);

    for (const [start, end] of [[0, 2], [2, 5], [4, 7], [7, 9], [9, 14], [14, 17]]) {
        const physicalBefore = mapToOriginalLocation({ source: original.expanded, span: span(start, end) });
        const physicalAfter = mapToOriginalLocation({ source: expanded, span: span(start, end) });
        assert.equal(physicalAfter.source.uri, physicalBefore.source.uri);
        assert.deepEqual(physicalAfter.span, physicalBefore.span);
        assert.deepEqual(mappedOrigins(expanded, start, end), mappedOrigins(original.expanded, start, end));
    }
});

test('multiple FileSources with identical URI remain distinct; aliases stay shared', () => {
    const original = sample();
    const encoder = new SourceGraphEncoder();
    const first = encoder.encodeSource(original.include);
    const second = encoder.encodeSource(original.includedAgain);
    assert.notEqual(first, second);
    assert.equal(encoder.encodeSource(original.include), first);
    const reference = encoder.encodeLocation({ source: original.include, span: span(0, 2) });
    assert.equal(reference.sourceId, first);
    const decoded = decodeSourceGraph(structuredClone(encoder.finish([original.expanded])));
    assert.notEqual(decoded.resolve(first), decoded.resolve(second));
    assert.equal(decoded.resolve(first).uri, decoded.resolve(second).uri);
    assert.equal(decoded.decodeLocation(reference).source, decoded.resolve(first));

    const expanded = decoded.roots[0] as ExpandedSource;
    const origins = expanded.originalFragments.map(item => item.origin.source);
    assert.equal(origins[1], decoded.resolve(first));
    assert.equal(origins[2], decoded.resolve(second));
});

test('SourceValue keeps physical and lexical source provenance after a roundtrip', () => {
    const original = sample();
    const encoder = new SourceGraphEncoder();
    const physical = encoder.encodeLocation({ source: original.include, span: span(1, 3) });
    const lexical = encoder.encodeLocation({ source: original.expanded, span: span(4, 6) });
    const decoded = decodeSourceGraph(structuredClone(encoder.finish([original.expanded])));
    const value = new SourceValue('23', decoded.decodeLocation(physical), decoded.decodeLocation(lexical));
    assert.equal(value.contains({ uri: original.include.uri, offset: 1 }), true);
    assert.equal(value.contains({ uri: original.include.uri, offset: 1, occurrenceSpan: span(4, 6) }), true);
    assert.equal(value.contains({ uri: original.include.uri, offset: 1, occurrenceSpan: span(8, 9) }), false);
});

test('source graph is a genuinely data-only transferable payload', () => {
    const wire = encodeSourceGraph([sample().expanded]);
    assert.deepEqual(structuredClone(wire), wire);
    assert.deepEqual(JSON.parse(JSON.stringify(wire)), wire);
    assert.equal(wire.version, 1);
    assert.ok(wire.nodes.some(item => item.kind === 'macro'));
});

test('decoder rejects unsupported versions and missing or duplicate references', () => {
    const sampleWire = encodeSourceGraph([new FileSource('file:///a', 'abc')]);
    assert.throws(() => decodeSourceGraph({ ...sampleWire, version: 2 as 1 }), /version/);
    assert.throws(() => decodeSourceGraph({ ...sampleWire, roots: [100] }), /Missing SourceGraph node/);
    assert.throws(() => decodeSourceGraph({ ...sampleWire, nodes: [...sampleWire.nodes, sampleWire.nodes[0]!] }), /Duplicate/);
    assert.throws(() => decodeSourceGraph({ ...sampleWire, roots: [-1] }), /Invalid SourceGraph reference/);
});

test('decoder rejects cyclic source mapping and invalid direct fragments', () => {
    const cyclic: SourceGraphWire = {
        version: 1, roots: [1], nodes: [
            { id: 1, kind: 'expanded', rootId: 1, fragments: [] }
        ]
    };
    assert.throws(() => decodeSourceGraph(cyclic), /Cyclic SourceGraph/);
    const malformed: SourceGraphWire = {
        version: 1, roots: [2], nodes: [
            { id: 1, kind: 'file', uri: 'file:///a', text: 'abc' },
            { id: 2, kind: 'expanded', rootId: 1, fragments: [
                { text: 'no', mapping: 'direct', origin: { sourceId: 1, span: span(0, 2) } }
            ] }
        ]
    };
    assert.throws(() => decodeSourceGraph(malformed), /Mismatched direct SourceGraph fragment/);
    assert.throws(() => decodeSourceGraph({
        ...malformed, nodes: [...malformed.nodes.slice(0, 1), {
            id: 2, kind: 'expanded', rootId: 1, fragments: [
                { text: 'xx', mapping: 'direct', origin: { sourceId: 1, span: span(2, 4) } }
            ]
        }]
    }), /outside source/);
});

test('the transport accessors do not expose mutable internal fragment arrays', () => {
    const original = sample();
    const expanded = original.expanded;
    const before = expanded.text;
    const fragments = expanded.originalFragments as unknown as { text: string; origin: { span: { start: number } } }[];
    fragments[0]!.text = 'broken';
    fragments[0]!.origin.span.start = 100;
    fragments.push(fragments[0]!);
    assert.equal(expanded.text, before);
    assert.equal(expanded.originalFragments.length, fragments.length - 1);
});

test('real preprocessing with nested and repeated includes preserves source provenance', () => {
    // This runs the production lexer/preprocessor, not a simulated AST.
    const rootUri = 'file:///project/main.P';
    const outerUri = 'file:///project/outer.h';
    const innerUri = 'file:///project/inner.h';
    const fileContents = new Map([
        [outerUri, '#include "inner.h"\nTYPE OUTER FIXED;\n'],
        [innerUri, 'TYPE INNER FLOAT;\n']
    ]);
    const original = new FileSource(rootUri,
        '#define TOKEN "Z"\n#include "outer.h"\n#include "outer.h"\nMODULE M; PROBLEM; TOKEN MODEND;');
    const logger = { info() {}, warn() {}, error() {} };
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({
        resolveIncludeUri(uri: string, path: string) { return new URL(path, uri).href; },
        resolveInclude(uri: string, path: string) {
            const target = new URL(path, uri).href;
            const text = fileContents.get(target);
            return text === undefined ? null : { uri: target, getText: () => text };
        }
    }, new MacroTable(), new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const expanded = Preprocessor.createExpanded(
        new Lexer(original, problems, logger).tokenize(), original, context,
        problems, [], new PreprocessorConditionalBlockCollection(), logger
    ).source;
    assert.equal(context.includeOccurrences.length, 4);
    assert.equal(problems.size(), 0);

    const occurrenceSources = context.includeOccurrences.map(item => item.source!);
    const input = [expanded, original, ...occurrenceSources];
    const envelope = structuredClone(encodeSourceGraph(input));
    const output = decodeSourceGraph(envelope);
    const returned = output.roots[0]!;
    assert.equal(returned.text, expanded.text);
    assert.deepEqual(returned.text.match(/TYPE INNER FLOAT;/g)?.length, 2);
    assert.equal(output.roots.length, input.length);

    // Every include execution has its own physical source object, even when
    // both executions represent exactly the same file on disk.
    const outerSources = occurrenceSources.map((source, index) => ({ source, index }))
        .filter(item => item.source.uri === outerUri);
    assert.equal(outerSources.length, 2);
    assert.notEqual(output.roots[2 + outerSources[0]!.index], output.roots[2 + outerSources[1]!.index]);

    for (const needle of ['TYPE INNER FLOAT;', 'TYPE OUTER FIXED;', 'TYPE INNER FLOAT;']) {
        let from = 0;
        for (let iteration = 0; iteration < 2; iteration++) {
            const offset = expanded.text.indexOf(needle, from);
            if (offset < 0) break;
            const location = { source: expanded, span: span(offset, offset + needle.length) };
            const before = mapToOriginalLocation(location);
            const after = mapToOriginalLocation({ source: returned, span: location.span });
            assert.equal(after.source.uri, before.source.uri);
            assert.deepEqual(after.span, before.span);
            from = offset + needle.length;
        }
    }
});

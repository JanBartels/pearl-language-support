// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mapToOriginalLocation, mapToOriginalLocations } from '../../core/sourceOffset';
import { FileSource } from '../fileSource';
import { ExpandedSourceBuilder } from '../expandedSource';
import type { Location } from '../../core/location';

function loc(source: FileSource, start: number, end: number): Location {
    return { source, span: { start, end } };
}

test('assembled text retains precise locations for unchanged source slices', () => {
    const root = new FileSource('file:///root.p', 'AB CD');
    const include = new FileSource('file:///include.h', 'xy');
    const builder = new ExpandedSourceBuilder(root);
    builder.appendOriginal(loc(root, 0, 2));
    builder.appendOriginal(loc(include, 0, 2));
    builder.appendOriginal(loc(root, 3, 5));
    const expanded = builder.build();
    assert.equal(expanded.text, 'ABxyCD');
    assert.deepEqual(mapToOriginalLocation({ source: expanded, span: { start: 2, end: 4 } }), loc(include, 0, 2));
    assert.deepEqual(mapToOriginalLocation({ source: expanded, span: { start: 4, end: 6 } }), loc(root, 3, 5));
});

test('macro generated text maps to its invocation rather than its definition', () => {
    const root = new FileSource('file:///root.p', 'Boundary');
    const builder = new ExpandedSourceBuilder(root);
    builder.appendExpansion('/* 0:40 */', loc(root, 0, 8));
    const expanded = builder.build();
    assert.deepEqual(mapToOriginalLocation({ source: expanded, span: { start: 0, end: 2 } }), loc(root, 0, 8));
});

test('a token crossing different origins anchors to its first fragment', () => {
    const root = new FileSource('file:///root.p', 'FIRST SECOND');
    const builder = new ExpandedSourceBuilder(root);
    builder.appendExpansion('/', loc(root, 0, 5));
    builder.appendExpansion('*', loc(root, 6, 12));
    const expanded = builder.build();
    assert.equal(expanded.text, '/*');
    assert.deepEqual(mapToOriginalLocation({ source: expanded, span: { start: 0, end: 2 } }), loc(root, 0, 5));
});

test('nested expanded sources preserve transitive origin mapping', () => {
    const root = new FileSource('file:///root.p', 'X');
    const first = new ExpandedSourceBuilder(root);
    first.appendExpansion('Hello', loc(root, 0, 1));
    const inner = first.build();
    const second = new ExpandedSourceBuilder(root);
    second.appendOriginal({ source: inner, span: { start: 0, end: 5 } });
    const outer = second.build();
    assert.deepEqual(mapToOriginalLocation({ source: outer, span: { start: 1, end: 3 } }), loc(root, 0, 1));
});


test('a token crossing adjacent direct fragments maps to its full original span', () => {
    const root = new FileSource('file:///root.p', 'ABCDE');
    const builder = new ExpandedSourceBuilder(root);
    builder.appendOriginal(loc(root, 0, 2));
    builder.appendOriginal(loc(root, 2, 4));
    builder.appendOriginal(loc(root, 4, 5));
    const expanded = builder.build();

    assert.equal(expanded.text, 'ABCDE');
    assert.deepEqual(mapToOriginalLocation({
        source: expanded, span: { start: 1, end: 5 }
    }), loc(root, 1, 5));
    assert.deepEqual(mapToOriginalLocation({
        source: expanded, span: { start: 1, end: 3 }
    }), loc(root, 1, 3));
});

test('a token crossing physically separate direct fragments retains its first anchor', () => {
    const root = new FileSource('file:///root.p', 'AB CD');
    const builder = new ExpandedSourceBuilder(root);
    builder.appendOriginal(loc(root, 0, 2));
    builder.appendOriginal(loc(root, 3, 5));
    const expanded = builder.build();

    assert.equal(expanded.text, 'ABCD');
    assert.deepEqual(mapToOriginalLocation({
        source: expanded, span: { start: 1, end: 3 }
    }), loc(root, 1, 2));
});

test('a token crossing into an include retains its first physical origin', () => {
    const root = new FileSource('file:///root.p', 'AB');
    const include = new FileSource('file:///include.h', 'CD');
    const builder = new ExpandedSourceBuilder(root);
    builder.appendOriginal(loc(root, 0, 2));
    builder.appendOriginal(loc(include, 0, 2));
    const expanded = builder.build();

    assert.deepEqual(mapToOriginalLocation({
        source: expanded, span: { start: 1, end: 3 }
    }), loc(root, 1, 2));
});

test('a token crossing from direct source into macro expansion retains its first anchor', () => {
    const root = new FileSource('file:///root.p', 'A Macro');
    const builder = new ExpandedSourceBuilder(root);
    builder.appendOriginal(loc(root, 0, 1));
    builder.appendExpansion('BC', loc(root, 2, 7));
    const expanded = builder.build();

    assert.equal(expanded.text, 'ABC');
    assert.deepEqual(mapToOriginalLocation({
        source: expanded, span: { start: 0, end: 3 }
    }), loc(root, 0, 1));
    assert.deepEqual(mapToOriginalLocation({
        source: expanded, span: { start: 1, end: 3 }
    }), loc(root, 2, 7));
});

test('an EOF location after adjacent original fragments maps to physical EOF', () => {
    const root = new FileSource('file:///root.p', 'ABC');
    const builder = new ExpandedSourceBuilder(root);
    builder.appendOriginal(loc(root, 0, 1));
    builder.appendOriginal(loc(root, 1, 3));
    const expanded = builder.build();

    assert.deepEqual(mapToOriginalLocation({
        source: expanded, span: { start: 3, end: 3 }
    }), loc(root, 3, 3));
});


test('all macro invocations contributing to a single token remain visible', () => {
    const root = new FileSource('file:///root.p', 'Open Close');
    const builder = new ExpandedSourceBuilder(root);
    builder.appendExpansion('/', loc(root, 0, 4));
    builder.appendExpansion('*', loc(root, 5, 10));
    const expanded = builder.build();
    const token: Location = { source: expanded, span: { start: 0, end: 2 } };

    assert.deepEqual(mapToOriginalLocation(token), loc(root, 0, 4));
    assert.deepEqual(mapToOriginalLocations(token), [loc(root, 0, 4), loc(root, 5, 10)]);
    assert.equal(expanded.text, '/*');
});

test('all original locations are preserved across include boundaries', () => {
    const root = new FileSource('file:///root.p', 'AB');
    const include = new FileSource('file:///include.h', 'CD');
    const builder = new ExpandedSourceBuilder(root);
    builder.appendOriginal(loc(root, 0, 2));
    builder.appendOriginal(loc(include, 0, 2));
    const expanded = builder.build();
    const token: Location = { source: expanded, span: { start: 1, end: 3 } };

    assert.deepEqual(mapToOriginalLocation(token), loc(root, 1, 2));
    assert.deepEqual(mapToOriginalLocations(token), [loc(root, 1, 2), loc(include, 0, 1)]);
});

test('separate direct slices of the same file do not invent a continuous span', () => {
    const root = new FileSource('file:///root.p', 'AB CD');
    const builder = new ExpandedSourceBuilder(root);
    builder.appendOriginal(loc(root, 0, 2));
    builder.appendOriginal(loc(root, 3, 5));
    const expanded = builder.build();

    assert.deepEqual(mapToOriginalLocations({source: expanded, span: {start: 1, end: 3}}),
        [loc(root, 1, 2), loc(root, 3, 4)]);
});

test('adjacent direct slices return a single lossless original location', () => {
    const root = new FileSource('file:///root.p', 'ABCDE');
    const builder = new ExpandedSourceBuilder(root);
    builder.appendOriginal(loc(root, 0, 2));
    builder.appendOriginal(loc(root, 2, 4));
    builder.appendOriginal(loc(root, 4, 5));
    const expanded = builder.build();

    assert.deepEqual(mapToOriginalLocations({source: expanded, span: {start: 1, end: 5}}),
        [loc(root, 1, 5)]);
});

test('direct and generated fragments retain separate origins', () => {
    const root = new FileSource('file:///root.p', 'A Macro');
    const builder = new ExpandedSourceBuilder(root);
    builder.appendOriginal(loc(root, 0, 1));
    builder.appendExpansion('BC', loc(root, 2, 7));
    const expanded = builder.build();

    assert.deepEqual(mapToOriginalLocations({source: expanded, span: {start: 0, end: 3}}),
        [loc(root, 0, 1), loc(root, 2, 7)]);
    assert.deepEqual(mapToOriginalLocations({source: expanded, span: {start: 1, end: 2}}),
        [loc(root, 2, 7)]);
});

test('transitive multi-origin mapping reaches both original files', () => {
    const root = new FileSource('file:///root.p', 'A USE');
    const include = new FileSource('file:///include.h', 'BC');
    const innerBuilder = new ExpandedSourceBuilder(root);
    innerBuilder.appendOriginal(loc(root, 0, 1));
    innerBuilder.appendOriginal(loc(include, 0, 2));
    const inner = innerBuilder.build();

    const outerBuilder = new ExpandedSourceBuilder(root);
    outerBuilder.appendOriginal({source: inner, span: {start: 0, end: 3}});
    outerBuilder.appendExpansion('D', loc(root, 2, 5));
    const outer = outerBuilder.build();

    assert.equal(outer.text, 'ABCD');
    assert.deepEqual(mapToOriginalLocations({source: outer, span: {start: 0, end: 4}}),
        [loc(root, 0, 1), loc(include, 0, 2), loc(root, 2, 5)]);
    assert.deepEqual(mapToOriginalLocation({source: outer, span: {start: 0, end: 4}}),
        loc(root, 0, 1));
});

test('empty expansion and EOF keep their existing primary anchor', () => {
    const root = new FileSource('file:///root.p', 'AB');
    const empty = new ExpandedSourceBuilder(root).build();
    assert.deepEqual(mapToOriginalLocations({source: empty, span: {start: 0, end: 0}}),
        [loc(root, 0, 0)]);

    const builder = new ExpandedSourceBuilder(root);
    builder.appendOriginal(loc(root, 0, 1));
    builder.appendOriginal(loc(root, 1, 2));
    const expanded = builder.build();
    assert.deepEqual(mapToOriginalLocations({source: expanded, span: {start: 2, end: 2}}),
        [loc(root, 2, 2)]);
});

test('multi-origin requests reject foreign and out-of-range locations', () => {
    const root = new FileSource('file:///root.p', 'AB');
    const builder = new ExpandedSourceBuilder(root);
    builder.appendOriginal(loc(root, 0, 2));
    const expanded = builder.build();
    assert.throws(() => expanded.mapLocations(loc(root, 0, 1)), /does not belong/);
    assert.throws(() => expanded.mapLocations({source: expanded, span: {start: 0, end: 3}}),
        RangeError);
});


test('neighboring generated invocations remain distinct even when their source spans touch', () => {
    const root = new FileSource('file:///root.p', 'AB');
    const builder = new ExpandedSourceBuilder(root);
    builder.appendExpansion('/', loc(root, 0, 1));
    builder.appendExpansion('*', loc(root, 1, 2));
    const expanded = builder.build();
    assert.deepEqual(mapToOriginalLocations({source: expanded, span: {start: 0, end: 2}}),
        [loc(root, 0, 1), loc(root, 1, 2)]);
});

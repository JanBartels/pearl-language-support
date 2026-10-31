// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Location } from '../../core/location';
import { mapToOriginalLocation } from '../../core/sourceOffset';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { TokenKind } from '../../lexer/token';
import { FileSource } from '../../source/fileSource';
import { MacroTable } from '../macroTable';
import { MacroOccurrenceIndex } from '../macroOccurrenceIndex';
import { Preprocessor } from '../preprocessor';
import { PreprocessorContext } from '../preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../preprocessorConditionalBlockStack';
import { ConditionalStack } from '../conditionalStack';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import type { MacroReference } from '../macroReference';

const logger: Logger = { info() {}, warn() {}, error() {} };
const rootUri = 'file:///test.P';

function prepare(text: string, definitions: Record<string, string> = {}) {
    const source = new FileSource(rootUri, text);
    const macros = new MacroTable();
    for (const [name, value] of Object.entries(definitions)) macros.define(name, value);
    const registry = { resolveInclude: () => null, addInclude: () => {} } as unknown as DocumentRegistry;
    const context = new PreprocessorContext(
        registry, macros, new ConditionalStack(), new PreprocessorConditionalBlockStack()
    );
    const problems = new ProblemCollection();
    const references: MacroReference[] = [];
    const blocks = new PreprocessorConditionalBlockCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    return { source, context, problems, references, blocks, tokens };
}

function contains(location: Location, start: number, end: number): boolean {
    const actual = mapToOriginalLocation(location);
    return actual.source.uri === rootUri
        && actual.span.start === start && actual.span.end === end;
}

test('compatibility TokenStream lexes macro-created comment delimiters after expansion', () => {
    const text = '#define Begin "/*"\n#define End "*/"\nMODULE M; PROBLEM; DCL A FIXED; Begin DCL Hidden FIXED; End DCL B FIXED; MODEND;';
    const data = prepare(text);
    const stream = Preprocessor.create(
        data.tokens, data.source, data.context, data.problems,
        data.references, data.blocks, logger
    );
    const output: string[] = [];
    let foundComment = false;
    while (!stream.eof()) {
        const token = stream.current();
        if (token.kind === TokenKind.Comment) {
            foundComment = true;
            assert.match(stream.tokenText(token), /\/\* DCL Hidden FIXED; \*\//);
        }
        output.push(stream.tokenText(token));
        stream.next();
    }
    assert.equal(foundComment, true);
    assert.equal(output.includes('Hidden'), false);
    assert.equal(data.problems.size(), 0);
});

test('nested macro references point to the physical spelling in their defining text', () => {
    const text = '#define Inner "FIXED"\n#define Outer "Inner"\nMODULE M; PROBLEM; DCL A Outer; MODEND;';
    const data = prepare(text);
    const result = Preprocessor.createExpanded(
        data.tokens, data.source, data.context, data.problems,
        data.references, data.blocks, logger
    );
    const inner = result.macroReferences.find(r => r.definition.name === 'Inner');
    const outer = result.macroReferences.find(r => r.definition.name === 'Outer');
    assert.ok(inner && outer);
    const writtenInDefinition = text.indexOf('Inner', text.indexOf('#define Outer'));
    const writtenInUse = text.lastIndexOf('Outer');
    assert.equal(contains(inner.location, writtenInDefinition, writtenInDefinition + 5), true);
    assert.equal(contains(outer.location, writtenInUse, writtenInUse + 5), true);
    const index = new MacroOccurrenceIndex(data.context.macroDefinitions, result.macroReferences);
    const hit = index.lookupAt({ uri: rootUri, offset: writtenInUse });
    assert.ok(hit && hit !== 'ambiguous');
    assert.equal(hit.group.definition.name, 'Outer');
    assert.equal(data.problems.size(), 0);
});

test('nested references from predefined replacements cannot obscure the direct macro invocation', () => {
    const text = 'MODULE M; PROBLEM; DCL A Outer; MODEND;';
    const data = prepare(text, { Inner: 'FIXED', Outer: 'Inner' });
    const result = Preprocessor.createExpanded(
        data.tokens, data.source, data.context, data.problems,
        data.references, data.blocks, logger
    );
    const index = new MacroOccurrenceIndex(data.context.macroDefinitions, result.macroReferences);
    const hit = index.lookupAt({ uri: rootUri, offset: text.indexOf('Outer') });
    assert.ok(hit && hit !== 'ambiguous');
    assert.equal(hit.group.definition.name, 'Outer');
    const inner = result.macroReferences.find(r => r.definition.name === 'Inner');
    assert.ok(inner);
    assert.equal(inner.location.source === data.source, false);
    assert.equal(mapToOriginalLocation(inner.location).source, data.source);
});

test('the TokenStream compatibility entry point transfers references without duplicates', () => {
    const text = '#define T "FIXED"\n#ifdef T\n#endif\nMODULE M; PROBLEM; DCL A T; MODEND;';
    const data = prepare(text);
    Preprocessor.create(data.tokens, data.source, data.context, data.problems,
        data.references, data.blocks, logger);
    const instances = data.references.filter(r => r.definition.name === 'T');
    assert.equal(instances.length, 2);
    assert.deepEqual(instances.map(r => r.location.span.start).sort((a, b) => a - b),
        [text.indexOf('T', text.indexOf('#ifdef')), text.lastIndexOf('T;')].sort((a, b) => a - b));
});

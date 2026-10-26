// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { FileSource } from '../../source/fileSource';
import { MacroTable } from '../macroTable';
import { MacroOccurrenceIndex } from '../macroOccurrenceIndex';
import { Preprocessor } from '../preprocessor';
import { PreprocessorContext } from '../preprocessorContext';
import { ConditionalStack } from '../conditionalStack';
import { PreprocessorConditionalBlockStack } from '../preprocessorConditionalBlockStack';
import { PreprocessorConditionalBlockCollection } from '../preprocessorConditionalBlockCollection';
import { findMacroReferences } from '../../lsp/findMacroReferences';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import type { MacroReference } from '../macroReference';
import { Analysis } from '../../validation/analysis';
import { AnalysisResult } from '../../validation/analysisResult';
import { MacroDocumentationProvider } from '../../documentation/macroDocumentationProvider';

const rootUri = 'file:///tests/main.p';
const logger: Logger = { info() {}, warn() {}, error() {} };

function locationAt(text: string, offset: number) {
    const prefix = text.slice(0, offset);
    const line = prefix.split('\n').length - 1;
    return { line, character: prefix.length - prefix.lastIndexOf('\n') - 1 };
}

function registryFor(sources: Map<string, string>): DocumentRegistry {
    return {
        get: (uri: string) => {
            const text = sources.get(uri);
            return text === undefined ? null : {
                positionAt: (offset: number) => locationAt(text, offset),
                offsetAt: (position: { line: number; character: number }) => {
                    const lines = text.split('\n');
                    let offset = 0;
                    for (let i = 0; i < position.line; i++) offset += (lines[i]?.length ?? 0) + 1;
                    return offset + position.character;
                }
            };
        },
        resolveInclude: (_from: string, name: string) => {
            const uri = `file:///tests/${name}`;
            const text = sources.get(uri);
            return text === undefined ? null : { uri, getText: () => text };
        },
        addInclude: () => undefined
    } as unknown as DocumentRegistry;
}

function preprocess(
    text: string,
    included: Record<string, string> = {},
    predefined: Record<string, string> = {}
) {
    const sources = new Map<string, string>([[rootUri, text], ...Object.entries(included)]);
    const registry = registryFor(sources);
    const table = new MacroTable();
    for (const [name, value] of Object.entries(predefined)) table.define(name, value);
    const context = new PreprocessorContext(registry, table,
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const references: MacroReference[] = [];
    const problems = new ProblemCollection();
    const source = new FileSource(rootUri, text);
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, references,
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const index = new MacroOccurrenceIndex(context.macroDefinitions, references);
    const analysis = new Analysis(source, tokens, ast, problems, references,
        new PreprocessorConditionalBlockCollection(), undefined, undefined, undefined,
        undefined, context.macroDefinitions, index);
    const analysisResult = AnalysisResult.create(analysis, [analysis]);
    const at = (uri: string, offset: number, includeDeclaration: boolean) => {
        const sourceText = sources.get(uri)!;
        return findMacroReferences(index, uri, locationAt(sourceText, offset), includeDeclaration, registry);
    };
    return { context, index, references, problems, at, analysisResult };
}

test('macro references: cursor on definition and each usage has identical results', () => {
    const source = '#define T "FIXED"\nMODULE Main; PROBLEM; DCL a T; DCL b T; MODEND;';
    const { index, at, problems } = preprocess(source);
    assert.equal(problems.size(), 0, JSON.stringify([...problems].map(p => [p.message,p.location?.span?.start,p.location?.source?.uri])));
    assert.equal(index.all.length, 1);
    const definition = source.indexOf('T');
    const first = source.indexOf(' T;');
    const last = source.lastIndexOf(' T;');
    const refs = at(rootUri, definition, false)!;
    assert.equal(refs.length, 2);
    assert.deepEqual(refs, at(rootUri, first + 1, false));
    assert.deepEqual(refs, at(rootUri, last + 1, false));
    const withDefinition = at(rootUri, first + 1, true)!;
    assert.equal(withDefinition.length, 3);
    assert.equal(withDefinition[0]!.range.start.character, definition);
    assert.equal(at(rootUri, source.indexOf('MODULE'), true), undefined);
});

test('macro references: unused definitions still have a declaration', () => {
    const source = '#define UNUSED "FIXED"\nMODULE Main; PROBLEM; MODEND;';
    const { at, index } = preprocess(source);
    assert.equal(index.all.length, 1);
    assert.deepEqual(at(rootUri, source.indexOf('UNUSED'), false), []);
    assert.equal(at(rootUri, source.indexOf('UNUSED'), true)?.length, 1);
});

test('macro references: redefine and undef keep distinct definition identities', () => {
    const source = '#define T "FIXED"\nMODULE Main; PROBLEM; DCL a T;\n#undef T\n#define T "FLOAT"\nDCL b T; MODEND;';
    const { at, index } = preprocess(source);
    assert.equal(index.all.length, 2);
    const def1 = source.indexOf('T');
    const def2 = source.indexOf('T', source.indexOf('#define T', 1));
    const first = at(rootUri, def1, true)!;
    const second = at(rootUri, def2, true)!;
    assert.equal(first.length, 3); // definition, use, #undef
    assert.equal(second.length, 2); // definition, use
    assert.notDeepEqual(first, second);
    assert.deepEqual(at(rootUri, source.indexOf('T', source.indexOf('#undef T')), false),
        at(rootUri, def1, false));
});

test('macro references: #ifdef and #ifndef record active definitions', () => {
    const source = '#define FLAG\n#ifdef FLAG\n#endif\n#ifndef FLAG\n#endif\nMODULE Main; PROBLEM; MODEND;';
    const { at, index } = preprocess(source);
    assert.equal(index.all.length, 1);
    assert.equal(at(rootUri, source.indexOf('FLAG'), false)?.length, 2);
});

test('macro references: includes preserve file identity even at identical offsets', () => {
    const includeUri = 'file:///tests/defs.inc';
    const include = '#define T "FIXED"\n';
    const root = '#include "defs.inc"\nMODULE Main; PROBLEM; DCL a T; MODEND;';
    const { at, index, problems } = preprocess(root, { [includeUri]: include });
    assert.equal(problems.size(), 0, JSON.stringify([...problems].map(p => [p.message,p.location?.span?.start,p.location?.source?.uri])));
    assert.equal(index.all.length, 1);
    const fromDefinition = at(includeUri, include.indexOf('T'), true)!;
    const fromUse = at(rootUri, root.indexOf(' T;') + 1, true)!;
    assert.deepEqual(fromUse, fromDefinition);
    assert.deepEqual(fromUse.map(loc => loc.uri).sort(), [includeUri, rootUri].sort());
    assert.equal(at(rootUri, root.indexOf('T;') - 10, true), undefined);
});

test('macro references: macros from settings have uses but no phantom declaration', () => {
    const source = 'MODULE Main; PROBLEM; DCL a Configured; MODEND;';
    const { at, index } = preprocess(source, {}, { Configured: 'FIXED' });
    assert.equal(index.all.length, 1);
    const position = source.indexOf('Configured');
    assert.equal(at(rootUri, position, false)?.length, 1);
    assert.equal(at(rootUri, position, true)?.length, 1);
});


test('macro references: a direct macro use takes priority over nested generated macro uses', () => {
    const text = '#define OUTER "INNER"\n#define INNER "FIXED"\nMODULE Main; PROBLEM; DCL v OUTER; MODEND;';
    const { at, index } = preprocess(text);
    assert.equal(index.all.length, 2);
    const nestedUse = text.lastIndexOf('OUTER');
    const result = at(rootUri, nestedUse, true)!;
    assert.equal(result.length, 2); // OUTER definition and its invocation
    assert.equal(result[0]!.range.start.character, text.indexOf('OUTER'));
    const inner = at(rootUri, text.indexOf('INNER', text.indexOf('#define INNER')), true)!;
    assert.equal(inner.length, 2); // INNER declaration and mapped nested reference
});


test('macro hover and references use the same occurrence in the full AnalysisResult', () => {
    const source = '#define MY_MACRO "FIXED"\nMODULE Main; PROBLEM; DCL value MY_MACRO; MODEND;';
    const { analysisResult, at } = preprocess(source);
    const declarationOffset = source.indexOf('MY_MACRO');
    const usageOffset = source.lastIndexOf('MY_MACRO');
    const definition = analysisResult.lookupMacro({ uri: rootUri, offset: declarationOffset });
    const usage = analysisResult.lookupMacro({ uri: rootUri, offset: usageOffset });
    assert.ok(definition);
    assert.ok(usage);
    assert.equal(definition.definition, usage.definition);
    assert.match(MacroDocumentationProvider.getDocumentation(definition), /MY_MACRO/);
    assert.match(MacroDocumentationProvider.getDocumentation(usage), /MY_MACRO/);
    assert.deepEqual(at(rootUri, declarationOffset, true), at(rootUri, usageOffset, true));
    assert.equal(at(rootUri, declarationOffset, true)?.length, 2);
});

test('macro definition in an include and usage in the root both support hover', () => {
    const includeUri = 'file:///tests/macro_defs.inc';
    const include = '#define INCLUDE_NAME "FIXED"\n';
    const root = '#include "macro_defs.inc"\nMODULE Main; PROBLEM; DCL data INCLUDE_NAME; MODEND;';
    const { analysisResult, at } = preprocess(root, { [includeUri]: include });
    const definition = analysisResult.lookupMacro({ uri: includeUri, offset: include.indexOf('INCLUDE_NAME') });
    const usage = analysisResult.lookupMacro({ uri: rootUri, offset: root.indexOf('INCLUDE_NAME') });
    assert.ok(definition);
    assert.ok(usage);
    assert.equal(definition.definition, usage.definition);
    assert.deepEqual(at(includeUri, include.indexOf('INCLUDE_NAME'), true),
        at(rootUri, root.indexOf('INCLUDE_NAME'), true));
});

test('predefined macros without a source definition still support hover at usage', () => {
    const source = 'MODULE Main; PROBLEM; DCL data CONFIG_MACRO; MODEND;';
    const { analysisResult, at } = preprocess(source, {}, { CONFIG_MACRO: 'FIXED' });
    const offset = source.indexOf('CONFIG_MACRO');
    const reference = analysisResult.lookupMacro({ uri: rootUri, offset });
    assert.ok(reference);
    assert.equal(reference.definition.location, undefined);
    assert.equal(at(rootUri, offset, true)?.length, 1);
});

test('hover at a #define with no usage works and does not guess on arbitrary text', () => {
    const source = '#define UNUSED_NAME "FIXED"\nMODULE Main; PROBLEM; MODEND;';
    const { analysisResult } = preprocess(source);
    assert.equal(analysisResult.lookupMacro({ uri: rootUri, offset: source.indexOf('UNUSED_NAME') })?.definition.name, 'UNUSED_NAME');
    assert.equal(analysisResult.lookupMacro({ uri: rootUri, offset: source.indexOf('MODULE') }), undefined);
    assert.equal(analysisResult.lookupMacro({ uri: 'file:///tests/unrelated.p', offset: source.indexOf('UNUSED_NAME') }), undefined);
});


test('hover on the #define keyword selects the same macro as its name and usage', () => {
    const source = '#define ABC_NAME "FIXED"\nMODULE Main; PROBLEM; DCL v ABC_NAME; MODEND;';
    const { analysisResult, at } = preprocess(source);
    const directive = analysisResult.lookupMacro({ uri: rootUri, offset: source.indexOf('#define') + 2 });
    const declaration = analysisResult.lookupMacro({ uri: rootUri, offset: source.indexOf('ABC_NAME') });
    const use = analysisResult.lookupMacro({ uri: rootUri, offset: source.lastIndexOf('ABC_NAME') });
    assert.ok(directive);
    assert.ok(declaration);
    assert.ok(use);
    assert.equal(directive.definition, declaration.definition);
    assert.equal(declaration.definition, use.definition);
    assert.deepEqual(at(rootUri, source.indexOf('#define') + 2, true),
        at(rootUri, source.lastIndexOf('ABC_NAME'), true));
});
